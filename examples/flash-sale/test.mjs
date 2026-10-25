import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { withServices } from "./fixtures.mjs";
import {
  keys,
  admit,
  createOrder,
  transition,
  releaseToRedis,
} from "./service.mjs";
import { group, consume, reclaim } from "./worker.mjs";
function gate() {
  let release;
  const wait = new Promise((resolve) => (release = resolve));
  return { wait, release };
}
async function until(check) {
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("barrier not reached");
}
test(
  "flash sale: real Redis7/PG17 correctness and bounded recovery",
  { timeout: 90000 },
  async (t) =>
    withServices(async ({ redis, config }) => {
      const pool = new pg.Pool(config);
      async function seed(sale, total, capacity = 128) {
        await pool.query(
          "INSERT INTO sales(id,price_cents,total,available) VALUES($1,1990,$2,$2)",
          [sale, total],
        );
        const k = keys(sale);
        assert.equal(await redis.command("SET", k.stock, total, "NX"), "OK");
        await group(redis, sale);
        return k;
      }
      async function invariant(sale) {
        const row = (
          await pool.query("SELECT * FROM sales WHERE id=$1", [sale])
        ).rows[0];
        assert.equal(row.available + row.reserved + row.sold, row.total);
        assert.ok(Math.min(row.available, row.reserved, row.sold) >= 0);
        return row;
      }
      try {
        await pool.query(
          await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
        );
        await t.test(
          "separate GET/DECR lets both callers pass the last-item check",
          async () => {
            const k = keys("wrong");
            await redis.command("SET", k.stock, 1);
            const snapshots = await Promise.all([
              redis.command("GET", k.stock),
              redis.command("GET", k.stock),
            ]);
            assert.deepEqual(snapshots, ["1", "1"]);
            await Promise.all(
              snapshots.map((s) =>
                Number(s) > 0 ? redis.command("DECR", k.stock) : null,
              ),
            );
            assert.equal(await redis.command("GET", k.stock), "-1");
          },
        );
        await t.test(
          "Lua admits one of sixteen; duplicates reuse the ID and never add events",
          async () => {
            const k = await seed("last", 1);
            const answers = await Promise.all(
              Array.from({ length: 16 }, (_, i) =>
                admit(redis, "last", "u-" + i),
              ),
            );
            assert.equal(answers.filter((a) => a[0] === "RESERVED").length, 1);
            assert.equal(answers.filter((a) => a[0] === "SOLD_OUT").length, 15);
            const user = "u-" + answers.findIndex((a) => a[0] === "RESERVED"),
              id = answers.find((a) => a[0] === "RESERVED")[1];
            assert.deepEqual(await admit(redis, "last", user), [
              "EXISTING",
              id,
            ]);
            assert.equal(await redis.command("XLEN", k.stream), 1);
            assert.equal(await redis.command("GET", k.stock), "0");
            assert.equal((await invariant("last")).reserved, 0); // Redis qualification is not an order.
          },
        );
        await t.test(
          "20 applicants / 5 units reach DB through only five events, two handlers at a time",
          async () => {
            const k = await seed("burst", 5);
            const replies = await Promise.all(
              Array.from({ length: 20 }, (_, i) =>
                admit(redis, "burst", "buyer-" + i),
              ),
            );
            assert.equal(replies.filter((r) => r[0] === "RESERVED").length, 5);
            assert.equal(await redis.command("XLEN", k.stream), 5);
            const barrier = gate();
            let active = 0,
              peak = 0;
            const processing = consume(pool, redis, "burst", {
              concurrency: 2,
              afterCommit: async () => {
                peak = Math.max(peak, ++active);
                try {
                  await barrier.wait;
                } finally {
                  active--;
                }
              },
            });
            try {
              await until(() => peak === 2);
            } finally {
              barrier.release();
            }
            const results = await processing;
            assert.ok(results.every((r) => r.ok));
            assert.equal(peak, 2);
            assert.equal(
              (await pool.query("SELECT * FROM orders WHERE sale_id='burst'"))
                .rowCount,
              5,
            );
            assert.equal((await invariant("burst")).reserved, 5);
            assert.equal(
              (await redis.command("XPENDING", k.stream, "orders"))[0],
              0,
            );
          },
        );
        await t.test(
          "PG row waiter is observed, then rechecks the condition after the winner commits",
          async () => {
            await seed("db-lock", 1);
            const a = await pool.connect(),
              b = await pool.connect();
            let waiting;
            try {
              await a.query("BEGIN");
              await b.query("BEGIN");
              const aPid = (await a.query("SELECT pg_backend_pid() pid"))
                  .rows[0].pid,
                bPid = (await b.query("SELECT pg_backend_pid() pid")).rows[0]
                  .pid;
              await a.query(
                "UPDATE sales SET available=available-1,reserved=reserved+1 WHERE id='db-lock' AND available>0",
              );
              waiting = b.query(
                "UPDATE sales SET available=available-1,reserved=reserved+1 WHERE id='db-lock' AND available>0",
              );
              // Capture immediately; a failed waiter cannot create an unhandled rejection.
              const observed = waiting.then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
              await until(async () => {
                const r = await pool.query(
                  "SELECT $1=ANY(pg_blocking_pids($2)) blocked",
                  [aPid, bPid],
                );
                return r.rows[0].blocked;
              });
              await a.query("COMMIT");
              const result = await observed;
              if (result.error) throw result.error;
              assert.equal(result.value.rowCount, 0);
              await b.query("COMMIT");
              await invariant("db-lock");
            } finally {
              await a.query("ROLLBACK");
              await b.query("ROLLBACK");
              a.release();
              b.release();
            }
          },
        );
        await t.test(
          "rollback restores stock; same-user and same-request concurrency produce one order",
          async () => {
            await seed("rollback", 2);
            const id = randomUUID();
            await assert.rejects(
              createOrder(pool, "rollback", "alice", id, {
                beforeCommit() {
                  throw new Error("controlled rollback");
                },
              }),
              /controlled rollback/,
            );
            assert.equal((await invariant("rollback")).available, 2);
            assert.equal(
              (await pool.query("SELECT * FROM attempts WHERE id=$1", [id]))
                .rowCount,
              0,
            );
            const [a, b] = await Promise.all([
              createOrder(pool, "rollback", "alice", id),
              createOrder(pool, "rollback", "alice", id),
            ]);
            assert.equal(a.order_id, b.order_id);
            const c = await createOrder(
              pool,
              "rollback",
              "alice",
              randomUUID(),
            );
            assert.equal(c.order_id, a.order_id);
            assert.equal((await invariant("rollback")).reserved, 1);
            await assert.rejects(
              createOrder(pool, "rollback", "mallory", id),
              /IDEMPOTENCY_CONFLICT/,
            );
          },
        );
        await t.test(
          "DB remains authoritative when Redis has too many permits",
          async () => {
            const k = await seed("mismatch", 0);
            await redis.command("SET", k.stock, 1);
            const accepted = await admit(redis, "mismatch", "alice");
            assert.equal(accepted[0], "RESERVED");
            const processed = await consume(pool, redis, "mismatch");
            assert.ok(processed[0].ok);
            assert.equal(processed[0].result.outcome, "SOLD_OUT");
            assert.equal(
              (
                await pool.query(
                  "SELECT * FROM orders WHERE sale_id='mismatch'",
                )
              ).rowCount,
              0,
            );
            await invariant("mismatch");
          },
        );
        await t.test(
          "history capacity rejects before deducting or recording another user",
          async () => {
            const k = await seed("capacity", 2);
            assert.equal(
              (await admit(redis, "capacity", "alice", 1))[0],
              "RESERVED",
            );
            assert.equal((await admit(redis, "capacity", "bob", 1))[0], "BUSY");
            assert.equal(await redis.command("GET", k.stock), "1");
            assert.equal(await redis.command("HGET", k.users, "bob"), null);
          },
        );
        await t.test(
          "DB commit / ACK crash window survives owned Redis restart and reclaims idempotently",
          async () => {
            const k = await seed("restart", 1);
            const accepted = await admit(redis, "restart", "alice");
            const first = await consume(pool, redis, "restart", {
              afterCommit() {
                throw new Error("controlled before ACK");
              },
            });
            assert.equal(first[0].ok, false);
            assert.equal(
              (await redis.command("XPENDING", k.stream, "orders"))[0],
              1,
            );
            assert.equal((await invariant("restart")).reserved, 1);
            await redis.stop();
            await assert.rejects(
              admit(redis, "restart", "bob"),
              /REDIS_UNAVAILABLE/,
            );
            await redis.start();
            assert.deepEqual(await admit(redis, "restart", "alice"), [
              "EXISTING",
              accepted[1],
            ]);
            // The previous handler has ended. Zero idle is solely a deterministic test/recovery control.
            const recovered = await reclaim(pool, redis, "restart", {
              idleMs: 0,
            });
            assert.ok(recovered.results[0].ok);
            assert.equal(
              (await pool.query("SELECT * FROM orders WHERE sale_id='restart'"))
                .rowCount,
              1,
            );
            assert.equal(
              (await redis.command("XPENDING", k.stream, "orders"))[0],
              0,
            );
            assert.equal((await invariant("restart")).reserved, 1);
          },
        );
        await t.test(
          "payment and expired close compete; repeated messages never move stock twice",
          async () => {
            await seed("payment", 1);
            const result = await createOrder(
              pool,
              "payment",
              "alice",
              randomUUID(),
            );
            await pool.query(
              "UPDATE orders SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
              [result.order_id],
            );
            const changes = await Promise.all([
              transition(pool, result.order_id, "PAID"),
              transition(pool, result.order_id, "CLOSED"),
            ]);
            assert.equal(changes.filter(Boolean).length, 1);
            const state = (
              await pool.query("SELECT status FROM orders WHERE id=$1", [
                result.order_id,
              ])
            ).rows[0].status;
            assert.equal(await transition(pool, result.order_id, state), false);
            assert.equal((await invariant("payment")).reserved, 0);
          },
        );
        await t.test(
          "close release replays Redis success / DB marking failure without double credit",
          async () => {
            const k = await seed("release", 1);
            const accepted = await admit(redis, "release", "alice");
            await consume(pool, redis, "release");
            await pool.query(
              "UPDATE orders SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
              [accepted[1]],
            );
            assert.equal(await transition(pool, accepted[1], "CLOSED"), true);
            await assert.rejects(
              releaseToRedis(pool, redis, "release", {
                afterRedis() {
                  throw new Error("controlled before marking");
                },
              }),
              /before marking/,
            );
            assert.equal(await redis.command("GET", k.stock), "1");
            assert.equal(await releaseToRedis(pool, redis, "release"), 1);
            assert.equal(await redis.command("GET", k.stock), "1");
            assert.equal(await transition(pool, accepted[1], "PAID"), false); // External late payments require reconciliation.
            assert.equal(
              (await admit(redis, "release", "alice"))[0],
              "EXISTING",
            );
            assert.equal((await admit(redis, "release", "bob"))[0], "RESERVED");
            await consume(pool, redis, "release");
            assert.equal((await invariant("release")).reserved, 1);
          },
        );
        await t.test(
          "bad types fail before writes; Lua runtime error itself does NOT roll back prior writes",
          async () => {
            const k = await seed("bad-type", 2);
            await redis.command("SET", k.users, "wrong type");
            await assert.rejects(
              admit(redis, "bad-type", "alice"),
              /BAD_KEY_TYPE/,
            );
            assert.equal(await redis.command("GET", k.stock), "2");
            assert.equal(await redis.command("XLEN", k.stream), 0);
            const demo = "seckill:{partial}:counter";
            await redis.command("SET", demo, 1);
            await assert.rejects(
              redis.command(
                "EVAL",
                "redis.call('DECR',KEYS[1]); return redis.call('HSET',KEYS[1],'x','y')",
                1,
                demo,
              ),
              /WRONGTYPE/,
            );
            assert.equal(await redis.command("GET", demo), "0");
          },
        );
      } finally {
        await pool.end();
      }
    }),
);
