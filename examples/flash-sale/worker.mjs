import { keys, createOrder } from "./service.mjs";
export const GROUP = "orders";
export async function group(redis, sale) {
  await redis.command(
    "XGROUP",
    "CREATE",
    keys(sale).stream,
    GROUP,
    "0",
    "MKSTREAM",
  );
}
function fields(values) {
  const result = {};
  for (let i = 0; i < values.length; i += 2) result[values[i]] = values[i + 1];
  return result;
}
// A finite batch, at most 32 entries and 8 active handlers in THIS call.
// A deployment must also bound the sum across calls and process replicas.
export async function processEntries(
  pool,
  redis,
  sale,
  entries,
  { concurrency = 2, afterCommit = () => {} } = {},
) {
  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 8 ||
    entries.length > 32
  )
    throw new Error("BAD_BUDGET");
  const results = new Array(entries.length);
  let next = 0;
  async function work() {
    for (;;) {
      const index = next++;
      if (index >= entries.length) return;
      const [id, raw] = entries[index];
      try {
        const event = fields(raw);
        const result = await createOrder(
          pool,
          sale,
          event.user,
          event.reservation,
        );
        await afterCommit(result);
        await redis.command("XACK", keys(sale).stream, GROUP, id);
        results[index] = { ok: true, id, result };
      } catch (error) {
        results[index] = { ok: false, id, error: String(error) };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, entries.length) }, work),
  );
  return results;
}
export async function consume(pool, redis, sale, options = {}) {
  const data = await redis.command(
    "XREADGROUP",
    "GROUP",
    GROUP,
    "worker-a",
    "COUNT",
    32,
    "STREAMS",
    keys(sale).stream,
    ">",
  );
  return processEntries(pool, redis, sale, data?.[0]?.[1] ?? [], options);
}
export async function reclaim(
  pool,
  redis,
  sale,
  { idleMs = 30000, cursor = "0-0", ...options } = {},
) {
  if (!Number.isInteger(idleMs) || idleMs < 0 || typeof cursor !== "string")
    throw new Error("BAD_RECLAIM");
  const data = await redis.command(
    "XAUTOCLAIM",
    keys(sale).stream,
    GROUP,
    "worker-recovery",
    idleMs,
    cursor,
    "COUNT",
    32,
  );
  return {
    cursor: data[0],
    results: await processEntries(pool, redis, sale, data[1], options),
  };
}
