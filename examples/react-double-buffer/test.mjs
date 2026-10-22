import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { unlink } from "node:fs/promises";
await build({
  entryPoints: ["App.tsx"],
  outfile: ".compiled-test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["react"],
});
const { createModel, prepare, complete, commit, abandon, STATIC } =
  await import("./.compiled-test.mjs");
await unlink(".compiled-test.mjs");
test("first update allocates partner, commit swaps and next update reuses original object", () => {
  const m = createModel(),
    first = m.current;
  assert.equal(first.alternate, null);
  prepare(m, "B");
  const second = m.work;
  assert.notEqual(second, first);
  assert.equal(second.alternate, first);
  assert.equal(first.alternate, second);
  complete(m);
  commit(m);
  assert.equal(m.current, second);
  prepare(m, "C");
  assert.equal(m.work, first);
  complete(m);
  commit(m);
  assert.equal(m.current, first);
  assert.equal(m.created, 2);
  assert.equal(m.visible, "C");
});
test("preparation carries references but clones dependency wrapper", () => {
  const m = createModel();
  prepare(m, "B");
  assert.equal(m.work.child, m.current.child);
  assert.equal(m.work.updateQueue, m.current.updateQueue);
  assert.equal(m.work.memoizedState, m.current.memoizedState);
  assert.notEqual(m.work.dependencies, m.current.dependencies);
  assert.equal(
    m.work.dependencies.firstContext,
    m.current.dependencies.firstContext,
  );
});
test("incomplete work cannot commit and abandoned work never becomes visible", () => {
  const m = createModel(),
    original = m.current;
  prepare(m, "bad");
  assert.throws(() => commit(m));
  complete(m);
  const abandoned = m.work;
  abandoned.subtreeFlags = 7;
  abandoned.deletions = ["old"];
  abandon(m);
  assert.equal(m.current, original);
  assert.equal(m.visible, "任务 A");
  prepare(m, "good");
  assert.equal(m.work, abandoned);
  assert.equal(m.work.flags, STATIC);
  assert.equal(m.work.subtreeFlags, 0);
  assert.equal(m.work.deletions, null);
  assert.equal(m.work.memoizedProps, m.current.memoizedProps);
  complete(m);
  commit(m);
  assert.equal(m.visible, "good");
});
