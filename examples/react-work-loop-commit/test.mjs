import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { unlink } from "node:fs/promises";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = () => 1;
const file = new URL("./.compiled-test.mjs", import.meta.url);
await build({
  entryPoints: ["App.tsx"],
  outfile: file.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["react"],
});
const { default: App } = await import(file.href);
await unlink(file);
test("DOM, stable callback ref and effect lifecycle across update/replacement/unmount", async () => {
  const logs = [];
  const original = console.log;
  console.log = (...args) => {
    if (args[0] === "[commit-lab]")
      logs.push({ phase: args[1], data: JSON.parse(args[2]) });
    else original(...args);
  };
  const root = createRoot(document.getElementById("root"));
  const phases = () => logs.map((x) => x.phase);
  try {
    await act(async () => root.render(React.createElement(App)));
    assert.deepEqual(phases(), [
      "render attempt",
      "ref attach",
      "layout setup",
      "passive setup",
    ]);
    assert.equal(
      logs.find((x) => x.phase === "layout setup").data.dom,
      "数值 0",
    );
    logs.length = 0;
    await act(async () =>
      document
        .querySelector("button")
        .dispatchEvent(new window.MouseEvent("click", { bubbles: true })),
    );
    assert.equal(
      document.querySelector('[data-testid="value"]').textContent,
      "数值 1",
    );
    assert.ok(!phases().includes("ref attach"));
    assert.ok(!phases().includes("ref detach"));
    for (const phase of ["layout cleanup", "layout setup", "passive cleanup", "passive setup"]) assert.ok(phases().includes(phase), `missing ${phase}`);
    assert.equal(logs.find(x => x.phase === "layout cleanup").data.dom, "数值 1");
    assert.ok(
      phases().indexOf("layout cleanup") < phases().indexOf("layout setup"),
    );
    assert.ok(
      phases().indexOf("passive cleanup") < phases().indexOf("passive setup"),
    );
    assert.equal(
      logs.find((x) => x.phase === "layout cleanup").data.capturedValue,
      0,
    );
    assert.equal(
      logs.find((x) => x.phase === "layout setup").data.dom,
      "数值 1",
    );
    logs.length = 0;
    await act(async () =>
      document
        .querySelectorAll("button")[1]
        .dispatchEvent(new window.MouseEvent("click", { bubbles: true })),
    );
    assert.ok(phases().includes("ref detach"));
    assert.ok(phases().includes("ref attach"));
    logs.length = 0;
    await act(async () => root.unmount());
    assert.ok(phases().includes("layout cleanup"));
    assert.ok(phases().includes("ref detach"));
    assert.ok(phases().includes("passive cleanup"));
  } finally {
    console.log = original;
    dom.window.close();
  }
});
