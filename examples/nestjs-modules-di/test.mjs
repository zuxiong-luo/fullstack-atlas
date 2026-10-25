import test from "node:test";
import assert from "node:assert/strict";
import { createApp, AUDIT, events } from "./dist/app.js";
import { missingExport } from "./dist/missing.js";
test(
  "scope identity, async configuration, singleton resources and release",
  { timeout: 15000 },
  async () => {
    const app = await createApp(),
      audit = app.get(AUDIT);
    try {
      const base = await app.getUrl();
      const read = async (who) => {
        const r = await fetch(base + "/notes/identities", {
          headers: { "x-client-id": who },
        });
        assert.equal(r.status, 200);
        return r.json();
      };
      const a = await read("alice"),
        b = await read("bob");
      assert.equal(a.tenant, "tenant-a");
      assert.equal(a.now, "2026-10-25T00:00:00Z");
      assert.equal(a.audit, b.audit);
      assert.notEqual(a.request, b.request);
      assert.equal(a.requestHeader, "alice");
      assert.equal(b.requestHeader, "bob");
      assert.notEqual(a.a, a.b);
      assert.equal(a.a, b.a);
      assert.equal(a.b, b.b);
      assert.equal(a.opened, true);
      assert.deepEqual(events, ["config:ready", "audit:opened"]);
      console.log(
        JSON.stringify({
          singletonSame: true,
          requestDifferent: true,
          transientDifferentConsumers: true,
          transientStableConsumer: true,
          asyncInitialized: true,
        }),
      );
    } finally {
      await app.close();
      assert.equal(audit.closed, true);
      assert.equal(events.at(-1), "audit:closed");
    }
  },
);
test(
  "a provider that is not exported cannot be injected through imports",
  { timeout: 10000 },
  async () => {
    await assert.rejects(missingExport(), /resolve dependencies/);
  },
);

test('forwardRef resolves a class reference cycle without relying on constructor order',{timeout:10000},async()=>{
 const {Left,Right,circularExample}=await import('./dist/circular.js');const module=await circularExample();
 try{const left=module.get(Left),right=module.get(Right);assert.equal(left.right,right);assert.equal(right.left,left);}finally{await module.close();}
});
