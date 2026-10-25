import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { lastValueFrom, from, timeout } from "rxjs";
import { createApp, PreviewService } from "./dist/app.js";
import { DurableJobs } from "./dist/reliability.js";
import { DataSource } from "typeorm";
async function until(check) {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(5);
  }
  throw new Error("barrier deadline");
}
async function fixture(waitMs = 1000) {
  let begun = 0,
    closed = 0,
    completed = 0;
  const server = createServer((_req, res) => {
    begun++;
    const timer = setTimeout(() => {
      completed++;
      res.end("ok");
    }, waitMs);
    res.once("close", () => {
      clearTimeout(timer);
      closed++;
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    get begun() {
      return begun;
    },
    get closed() {
      return closed;
    },
    get completed() {
      return completed;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}
test(
  "RxJS timeout does not cancel a Promise side effect",
  { timeout: 5000 },
  async () => {
    let changed = 0;
    const work = delay(60).then(() => {
      changed++;
      return "done";
    });
    await assert.rejects(lastValueFrom(from(work).pipe(timeout(5))), /Timeout/);
    await work;
    assert.equal(changed, 1);
  },
);
test(
  "real upstream budget timeout and client disconnect abort work and clear listeners",
  { timeout: 15000 },
  async () => {
    const upstream = await fixture(),
      app = await createApp({ url: upstream.url, budgetMs: 60 });
    try {
      const base = await app.getUrl();
      let response = await fetch(base + "/notes/from-upstream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer alice-demo",
        },
        body: JSON.stringify({ title: "timeout" }),
      });
      assert.equal(response.status, 504);
      await until(() => upstream.closed === 1);
      assert.equal(upstream.completed, 0);
      assert.equal(app.get(PreviewService).active, 0);
      assert.equal(
        (
          await app
            .get(DataSource)
            .query("SELECT count(*)::int AS n FROM notes")
        )[0].n,
        0,
      );
      const before = upstream.begun;
      const client = request(
        base + "/notes/from-upstream",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer alice-demo",
          },
        },
        (res) => res.resume(),
      );
      client.on("error", () => {});
      client.end(JSON.stringify({ title: "disconnected" }));
      await until(() => upstream.begun > before);
      client.destroy();
      await until(
        () => app.get(PreviewService).active === 0 && upstream.closed === 2,
      );
      assert.equal(upstream.completed, 0);
      assert.equal(app.get(PreviewService).cancelled, 2);
      assert.equal(
        (
          await app
            .get(DataSource)
            .query("SELECT count(*)::int AS n FROM notes")
        )[0].n,
        0,
      );
    } finally {
      await app.close();
      await upstream.close();
    }
  },
);
test(
  "cancellation after transaction entry does not undo PG commit",
  { timeout: 15000 },
  async () => {
    const upstream = await fixture(1),
      app = await createApp({
        url: upstream.url,
        budgetMs: 100,
        waitOnDatabaseLock: true,
      });
    const { Client } = await import("pg");
    const blocker = new Client({ connectionString: process.env.DATABASE_URL });
    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(642)");
      const client = request(
        (await app.getUrl()) + "/notes/from-upstream",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer alice-demo",
          },
        },
        (res) => res.resume(),
      );
      client.on("error", () => {});
      client.end(JSON.stringify({ title: "committed-after-disconnect" }));
      await until(async () =>
        Boolean(
          (
            await app
              .get(DataSource)
              .query(
                "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND query LIKE '%nest-preview-barrier%') AS waiting",
              )
          )[0].waiting,
        ),
      );
      client.destroy();
      await delay(130);
      await blocker.query("COMMIT");
      await until(() => app.get(PreviewService).active === 0);
      const ds = app.get(DataSource);
      assert.equal(
        (
          await ds.query(
            "SELECT count(*)::int AS n FROM notes WHERE title='committed-after-disconnect'",
          )
        )[0].n,
        1,
      );
      assert.equal(
        (await ds.query("SELECT count(*)::int AS n FROM audits"))[0].n,
        1,
      );
      await ds.query("TRUNCATE audits,notes RESTART IDENTITY CASCADE");
    } finally {
      await blocker.query("ROLLBACK").catch(() => {});
      await blocker.end();
      await app.close();
      await upstream.close();
    }
  },
);
test(
  "persistent idempotency, lease replacement fencing, restart recovery and poison bound",
  { timeout: 20000 },
  async () => {
    const upstream = await fixture();
    let app = await createApp({ url: upstream.url, budgetMs: 500 });
    try {
      let base = await app.getUrl(),
        jobs = app.get(DurableJobs),
        ds = app.get(DataSource);
      const submit = async (title) => {
        const r = await fetch(base + "/jobs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer alice-demo",
            "idempotency-key": "key-one",
          },
          body: JSON.stringify({ title }),
        });
        return { status: r.status, body: await r.json() };
      };
      const [a, b] = await Promise.all([submit("durable"), submit("durable")]);
      assert.equal(a.status, 201);
      assert.equal(b.status, 201);
      assert.equal(a.body.id, b.body.id);
      assert.deepEqual(Object.keys(a.body).sort(), [
        "id",
        "resultId",
        "status",
      ]);
      assert.equal((await submit("different")).status, 409);
      const oldClaim = await jobs.claim(60);
      assert.ok(oldClaim);
      await app.close();
      app = await createApp({ url: upstream.url, budgetMs: 500 });
      base = await app.getUrl();
      jobs = app.get(DurableJobs);
      ds = app.get(DataSource);
      await until(async () =>
        Boolean(
          (
            await ds.query(
              'SELECT "leaseUntil"<clock_timestamp() AS expired FROM jobs WHERE id=$1',
              [oldClaim.id],
            )
          )[0].expired,
        ),
      );
      const result = await jobs.runOnce();
      assert.equal(typeof result, "number");
      await assert.rejects(jobs.complete(oldClaim), /LEASE_LOST/);
      const row = (
        await ds.query("SELECT * FROM jobs WHERE id=$1", [oldClaim.id])
      )[0];
      assert.equal(row.status, "done");
      assert.equal(row.attempts, 2);
      assert.equal((await submit("durable")).body.resultId, result);
      assert.equal(
        (await ds.query("SELECT count(*)::int AS n FROM notes"))[0].n,
        1,
      );
      assert.equal(
        (await ds.query("SELECT count(*)::int AS n FROM audits"))[0].n,
        1,
      );
      await jobs.enqueue("poison", "durable", {
        tenantId: "tenant-a",
        ownerId: "alice",
        role: "writer",
      });
      for (let i = 0; i < 3; i++)
        await assert.rejects(jobs.runOnce(), /duplicate key/);
      assert.equal(
        (await ds.query("SELECT status FROM jobs WHERE key='poison'"))[0]
          .status,
        "failed",
      );
      assert.equal(await jobs.runOnce(), null);
      assert.equal(
        (await ds.query("SELECT count(*)::int AS n FROM notes"))[0].n,
        1,
      );
      await jobs.enqueue("last-crash", "never-completed", {
        tenantId: "tenant-a",
        ownerId: "alice",
        role: "writer",
      });
      const expire = async (claim) =>
        until(async () =>
          Boolean(
            (
              await ds.query(
                'SELECT "leaseUntil"<clock_timestamp() AS expired FROM jobs WHERE id=$1',
                [claim.id],
              )
            )[0].expired,
          ),
        );
      let abandoned;
      for (let i = 0; i < 3; i++) {
        abandoned = await jobs.claim(20);
        assert.ok(abandoned);
        await expire(abandoned);
      }
      await app.close();
      app = await createApp({ url: upstream.url, budgetMs: 500 });
      jobs = app.get(DurableJobs);
      ds = app.get(DataSource);
      assert.equal(await jobs.claim(), null);
      const exhausted = (
        await ds.query("SELECT * FROM jobs WHERE key='last-crash'")
      )[0];
      assert.equal(exhausted.status, "failed");
      assert.equal(exhausted.attempts, 3);
      assert.equal(
        (await ds.query("SELECT count(*)::int AS n FROM notes"))[0].n,
        1,
      );
      console.log(
        JSON.stringify({
          sameKeyOneJob: true,
          payloadConflict: 409,
          restarted: true,
          staleOwner: "LEASE_LOST",
          notes: 1,
          audits: 1,
          poisonAttempts: 3,
          thirdCrashReaped: true,
        }),
      );
    } finally {
      await app.close();
      await upstream.close();
    }
  },
);
