import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { unlink } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import React from "react";
const output = new URL("./.compiled-test.mjs", import.meta.url);
await build({
  entryPoints: ["App.tsx"],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["react"],
});
const { default: App, score } = await import(output.href);
await unlink(output);
test("CPU work deterministic and depends on workload", () => {
  assert.equal(score(1, 16000), score(1, 16000));
  assert.notEqual(score(1, 4000), score(1, 16000));
  assert.notEqual(score(1, 16000), score(2, 16000));
});
test("initial example renders all rows and controls", () => {
  const html = renderToString(React.createElement(App));
  assert.match(html, /实验输入/);
  assert.match(html, /Transition/);
  assert.equal((html.match(/border-bottom/g) || []).length, 800);
  assert.match(html, /同步计算反例/);
});
