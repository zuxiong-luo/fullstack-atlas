import { test } from "node:test";
import assert from "node:assert/strict";
import { createService, makeRuntime, frame } from "../src/server.mjs";
import { applyEvent } from "../src/client-state.mjs";
async function running(t, options = {}) {
  const s = createService({ intervalMs: 2, ...options });
  await new Promise((r) => s.server.listen(0, "127.0.0.1", r));
  t.after(() => s.close());
  return { ...s, url: `http://127.0.0.1:${s.server.address().port}` };
}
const events = (text) =>
  text
    .split("\n\n")
    .filter((f) => f.startsWith("id:"))
    .map((f) => Number(f.match(/^id: (\d+)/)[1]));
test("real HTTP SSE completes and cursor replay never starts a new task", async (t) => {
  const s = await running(t);
  const created = await fetch(s.url + "/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "权限" }),
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const initial = await fetch(s.url + `/runs/${id}/events`);
  assert.match(initial.headers.get("content-type"), /text\/event-stream/);
  const text = await initial.text();
  assert.match(text, /event: completed/);
  assert.deepEqual(events(text), [1, 2, 3, 4, 5, 6, 7]);
  const replay = await fetch(s.url + `/runs/${id}/events?after=2`);
  assert.deepEqual(events(await replay.text()), [3, 4, 5, 6, 7]);
  assert.equal(s.runtime.runs.size, 1);
  const resumed = await fetch(s.url + `/runs/${id}/events?after=0`, {
    headers: { "Last-Event-ID": "6" },
  });
  assert.deepEqual(events(await resumed.text()), [7]);
});
test("cancel transitions once and stops further deltas", async (t) => {
  const s = await running(t, { intervalMs: 100 });
  const run = s.runtime.create("权限");
  s.runtime.cancel(run.id);
  await run.finished;
  assert.equal(run.status, "cancelled");
  assert.deepEqual(
    run.events.map((e) => e.type),
    ["started", "cancelled"],
  );
  s.runtime.cancel(run.id);
  assert.equal(run.events.length, 2);
});
test("admission rejects overload before generating", async () => {
  const r = makeRuntime({ intervalMs: 100, maxActive: 1 });
  try {
    r.create("权限");
    assert.throws(() => r.create("新问题"), /CAPACITY/);
  } finally {
    await r.close();
  }
});
test("cursor, origin and content boundaries", async (t) => {
  const s = await running(t);
  const run = s.runtime.create("权限");
  for (const cursor of ["-1", "1e3", "999"]) {
    const res = await fetch(s.url + `/runs/${run.id}/events?after=${cursor}`);
    assert.ok([400, 409].includes(res.status));
  }
  assert.equal(
    (
      await fetch(s.url + "/runs", {
        method: "POST",
        headers: {
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
        body: '{"question":"x"}',
      })
    ).status,
    403,
  );
  assert.equal(
    (await fetch(s.url + "/runs", { method: "POST", body: "x" })).status,
    415,
  );
});
test("client ignores duplicates and detects gaps instead of corrupting text", () => {
  const initial = { id: "one", lastId: 0, text: "", status: "running" };
  const e = { id: 1, type: "delta", data: { text: "权限" } };
  const next = applyEvent(initial, e);
  assert.equal(next.text, "权限");
  assert.equal(applyEvent(next, e), next);
  assert.throws(() => applyEvent(next, { ...e, id: 3 }), /EVENT_GAP/);
  assert.equal(
    applyEvent(next, { id: 2, type: "completed", data: {} }).status,
    "completed",
  );
});
test("SSE encodes newlines inside JSON instead of creating injected frames", () => {
  const encoded = frame({
    id: 1,
    type: "delta",
    data: { text: "hello\nevent: bad" },
  });
  assert.equal(encoded.split("\n\n").length, 2);
  assert.ok(encoded.includes("hello\\nevent: bad"));
});

test('HTTP cancellation emits a cancelled terminal event', async (t) => {
  const s = await running(t, { intervalMs: 100 });
  const created = await fetch(s.url + '/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: '权限' }),
  });
  const { id } = await created.json();
  const cancelled = await fetch(s.url + `/runs/${id}/cancel`, { method: 'POST' });
  assert.equal(cancelled.status, 202);
  const stream = await fetch(s.url + `/runs/${id}/events`);
  const text = await stream.text();
  assert.match(text, /event: cancelled/);
  assert.doesNotMatch(text, /event: delta/);
});

test('closing one HTTP subscription does not cancel the background task', async (t) => {
  const s = await running(t, { intervalMs: 20 });
  const run = s.runtime.create('权限');
  const response = await fetch(s.url + `/runs/${run.id}/events`);
  await response.body.cancel();
  await run.finished;
  for (let i = 0; i < 50 && run.subscribers !== 0; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(run.status, 'completed');
  assert.equal(run.events.length, 7);
  assert.equal(run.subscribers, 0);
});
