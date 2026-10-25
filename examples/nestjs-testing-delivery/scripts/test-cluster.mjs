import { withCluster } from "./cluster.mjs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { drainBudget, requestId } from "../dist/runtime.js";
import { Client } from "pg";
async function until(test, label) {
  const end = Date.now() + 7000;
  while (Date.now() < end) {
    if (await test()) return;
    await delay(10);
  }
  throw new Error("deadline " + label);
}
function launch(env) {
  const child = spawn(process.execPath, ["dist/main.js"], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const records = [];
  let text = "",
    stderr = "";
  child.stdout.on("data", (part) => {
    text += part;
    let nl;
    while ((nl = text.indexOf("\n")) >= 0) {
      const line = text.slice(0, nl);
      text = text.slice(nl + 1);
      try {
        records.push(JSON.parse(line));
      } catch {}
    }
  });
  child.stderr.on("data", (x) => (stderr += x));
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stderr }));
  });
  return { child, records, done };
}
assert.equal(drainBudget(undefined), 150);
assert.throws(() => drainBudget("NaN"), /INVALID/);
assert.throws(() => drainBudget("-1"), /INVALID/);
assert.equal(requestId("alice_request"), "alice_request");
assert.notEqual(requestId("bad\nheader"), "bad\nheader");
await withCluster(async (cluster) => {
  const app = launch({ DATABASE_URL: cluster.url, DRAIN_MS: "150" });
  const killTimer = setTimeout(() => app.child.kill("SIGKILL"), 25000);
  try {
    await until(
      () => app.records.some((x) => x.event === "listening"),
      "listen",
    );
    const base = app.records.find((x) => x.event === "listening").url;
    assert.equal((await fetch(base + "/health/live")).status, 200);
    assert.equal((await fetch(base + "/health/ready")).status, 200);
    await cluster.stop();
    assert.equal((await fetch(base + "/health/live")).status, 200);
    assert.equal((await fetch(base + "/health/ready")).status, 503);
    await cluster.start();
    await until(
      async () => (await fetch(base + "/health/ready")).status === 200,
      "dependency recovery",
    );
    const request = (ms, id) =>
      fetch(base + "/work?ms=" + ms, {
        method: "POST",
        headers: {
          "x-request-id": id,
          authorization: "Bearer alice-demo",
          "x-unused-secret": "never-log-this-secret",
        },
      }).then(async (r) => ({
        status: r.status,
        body: await r.json(),
        id: r.headers.get("x-request-id"),
      }));
    const short = request(80, "short_work"),
      long = request(1200, "long_work");
    await until(
      () => app.records.filter((x) => x.event === "work_started").length === 2,
      "both in flight",
    );
    const started = Date.now();
    app.child.kill("SIGTERM");
    const a = await short,
      b = await long;
    assert.equal(a.status, 200);
    assert.equal(a.id, "short_work");
    assert.equal(b.status, 503);
    const exit = await app.done;
    console.log(
      JSON.stringify({ diagnostic: app.records, stderr: exit.stderr }),
    );
    assert.equal(exit.code, 0);
    assert.ok(Date.now() - started < 3000);
    assert.ok(app.records.some((x) => x.event === "budget_exhausted"));
    assert.ok(app.records.some((x) => x.event === "closed" && x.active === 0));
    assert.ok(!app.records.some((x) => x.event === "shutdown_forced"));
    await assert.rejects(fetch(base + "/health/live"));
    const client = new Client({ connectionString: cluster.url });
    await client.connect();
    try {
      const rows = (await client.query("SELECT title FROM notes ORDER BY id"))
        .rows;
      assert.deepEqual(rows, [{ title: "short_work" }]);
    } finally {
      await client.end();
    }
    assert.ok(!JSON.stringify(app.records).includes("never-log-this-secret"));
    assert.ok(!JSON.stringify(app.records).includes("Bearer alice-demo"));
    console.log(
      JSON.stringify({
        unitConfig: true,
        liveWithDependencyDown: 200,
        readyDown: 503,
        readyRecovered: 200,
        short: 200,
        long: 503,
        exit: exit.code,
        activeAfterClose: 0,
        onlyShortPersisted: true,
        authorizationNotLogged: true,
      }),
    );
  } finally {
    clearTimeout(killTimer);
    if (app.child.exitCode === null) {
      app.child.kill("SIGTERM");
      await app.done;
    }
  }
  // A PG lock demonstrates non-cooperative work: AbortSignal cannot cancel this SQL.
  const blocker = new Client({ connectionString: cluster.url });
  await blocker.connect();
  const forced = launch({
    DATABASE_URL: cluster.url,
    DRAIN_MS: "20",
    QUERY_TIMEOUT_MS: "5000",
  });
  const forcedKill = setTimeout(() => forced.child.kill("SIGKILL"), 10000);
  try {
    await until(
      () => forced.records.some((x) => x.event === "listening"),
      "forced listen",
    );
    await blocker.query("BEGIN");
    await blocker.query("LOCK TABLE notes IN ACCESS EXCLUSIVE MODE");
    const base = forced.records.find((x) => x.event === "listening").url;
    const response = fetch(base + "/work?ms=0", {
      method: "POST",
      headers: {
        authorization: "Bearer alice-demo",
        "x-request-id": "blocked_sql",
      },
    })
      .then((r) => r.text())
      .catch(() => "connection-closed");
    await until(
      async () =>
        (await cluster.sql(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'INSERT INTO%notes%')",
        )) === "t",
      "SQL waiting",
    );
    forced.child.kill("SIGTERM");
    const exit = await forced.done;
    assert.equal(exit.code, 1);
    assert.ok(forced.records.some((x) => x.event === "shutdown_forced"));
    await response;
  } finally {
    clearTimeout(forcedKill);
    if (forced.child.exitCode === null) {
      forced.child.kill("SIGKILL");
      await forced.done;
    }
    await blocker.query("ROLLBACK");
    await blocker.end();
  }
  assert.equal(await cluster.sql("SELECT count(*) FROM notes"), "1");
  const broken = launch({ DATABASE_URL: cluster.url, DRAIN_MS: "no-number" });
  const exit = await broken.done;
  assert.equal(exit.code, 1);
  assert.ok(broken.records.some((x) => x.event === "startup_failed"));
  assert.ok(!broken.records.some((x) => x.event === "listening"));
});
console.log(
  "PASS configuration unit checks + real PostgreSQL dependency failure/recovery + HTTP E2E + real SIGTERM child process",
);
