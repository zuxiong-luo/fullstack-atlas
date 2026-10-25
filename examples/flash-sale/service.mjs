import { randomUUID } from "node:crypto";
import { admitLua, releaseLua } from "./lua.mjs";

const identity = /^[a-z0-9-]{1,40}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function keys(sale) {
  if (typeof sale !== "string" || !identity.test(sale))
    throw new Error("BAD_SALE");
  const base = `seckill:{${sale}}`;
  return {
    stock: base + ":stock",
    users: base + ":users",
    stream: base + ":events",
    releases: base + ":releases",
  };
}
function validate(user, reservation) {
  if (
    typeof user !== "string" ||
    !identity.test(user) ||
    !uuid.test(reservation)
  )
    throw new Error("BAD_IDENTITY");
}
export async function admit(
  redis,
  sale,
  user,
  capacity = 128,
  reservation = randomUUID(),
) {
  validate(user, reservation);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)
    throw new Error("BAD_CAPACITY");
  const k = keys(sale);
  return redis.command(
    "EVAL",
    admitLua,
    3,
    k.stock,
    k.users,
    k.stream,
    user,
    reservation,
    capacity,
  );
}

// Every operation owns one checked-out connection, including rollback.
export async function transaction(pool, fn) {
  const db = await pool.connect();
  let discard;
  try {
    await db.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    await db.query("SET LOCAL lock_timeout='1000ms'");
    await db.query("SET LOCAL statement_timeout='3000ms'");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      discard = rollbackError;
    }
    throw error;
  } finally {
    db.release(discard);
  }
}

export async function createOrder(pool, sale, user, reservation, hooks = {}) {
  keys(sale);
  validate(user, reservation);
  return transaction(pool, async (db) => {
    const accepted = await db.query(
      `INSERT INTO attempts(id,sale_id,user_id,outcome)
      VALUES($1,$2,$3,'PROCESSING') ON CONFLICT(id) DO NOTHING RETURNING id`,
      [reservation, sale, user],
    );
    if (!accepted.rowCount) {
      const old = (
        await db.query("SELECT * FROM attempts WHERE id=$1", [reservation])
      ).rows[0];
      if (old.sale_id !== sale || old.user_id !== user)
        throw new Error("IDEMPOTENCY_CONFLICT");
      return old;
    }
    await db.query("SAVEPOINT order_work");
    const inserted = await db.query(
      `INSERT INTO orders(id,sale_id,user_id,amount_cents,status)
      SELECT $1,id,$3,price_cents,'PENDING_PAYMENT' FROM sales WHERE id=$2
      ON CONFLICT(sale_id,user_id) DO NOTHING RETURNING id`,
      [reservation, sale, user],
    );
    let orderId;
    if (inserted.rowCount) {
      const stock = await db.query(
        `UPDATE sales SET available=available-1,reserved=reserved+1
        WHERE id=$1 AND available>0 RETURNING id`,
        [sale],
      );
      if (!stock.rowCount) {
        await db.query("ROLLBACK TO SAVEPOINT order_work");
        return (
          await db.query(
            "UPDATE attempts SET outcome='SOLD_OUT' WHERE id=$1 RETURNING *",
            [reservation],
          )
        ).rows[0];
      }
      orderId = reservation;
      await db.query(
        "UPDATE orders SET expires_at=clock_timestamp()+interval '10 minutes' WHERE id=$1",
        [orderId],
      );
    } else {
      orderId = (
        await db.query(
          "SELECT id FROM orders WHERE sale_id=$1 AND user_id=$2",
          [sale, user],
        )
      ).rows[0].id;
    }
    await hooks.beforeCommit?.();
    return (
      await db.query(
        "UPDATE attempts SET outcome='ORDER_CREATED',order_id=$2 WHERE id=$1 RETURNING *",
        [reservation, orderId],
      )
    ).rows[0];
  });
}

export async function transition(pool, orderId, target) {
  if (!uuid.test(orderId) || !["PAID", "CLOSED"].includes(target))
    throw new Error("BAD_TRANSITION");
  return transaction(pool, async (db) => {
    const expiration =
      target === "CLOSED" ? " AND expires_at<=clock_timestamp()" : "";
    const changed = await db.query(
      `UPDATE orders SET status=$2
      WHERE id=$1 AND status='PENDING_PAYMENT'${expiration} RETURNING sale_id`,
      [orderId, target],
    );
    if (!changed.rowCount) return false;
    const sale = changed.rows[0].sale_id;
    if (target === "PAID") {
      await db.query(
        "UPDATE sales SET reserved=reserved-1,sold=sold+1 WHERE id=$1",
        [sale],
      );
    } else {
      await db.query(
        "UPDATE sales SET reserved=reserved-1,available=available+1 WHERE id=$1",
        [sale],
      );
      await db.query(
        "INSERT INTO releases(id,order_id,sale_id) VALUES($1,$2,$3)",
        [randomUUID(), orderId, sale],
      );
    }
    return true;
  });
}

export async function releaseToRedis(pool, redis, sale, hooks = {}) {
  keys(sale);
  const events = (
    await pool.query(
      "SELECT * FROM releases WHERE applied=false AND sale_id=$1 ORDER BY id LIMIT 32",
      [sale],
    )
  ).rows;
  for (const event of events) {
    const k = keys(event.sale_id);
    await redis.command("EVAL", releaseLua, 2, k.stock, k.releases, event.id);
    await hooks.afterRedis?.();
    await pool.query("UPDATE releases SET applied=true WHERE id=$1", [
      event.id,
    ]);
  }
  return events.length;
}
