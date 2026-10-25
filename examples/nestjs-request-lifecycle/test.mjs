import test from "node:test";
import assert from "node:assert/strict";
import { createApp, NotesService } from "./dist/app.js";
test(
  "real HTTP lifecycle: success / DTO / guard / handler exception and side effects",
  { timeout: 15000 },
  async () => {
    const app = await createApp();
    try {
      const url = await app.getUrl();
      const call = (body, token = "alice-demo") =>
        fetch(url + "/notes", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer " + token,
          },
          body: JSON.stringify(body),
        });
      let r = await call({ title: "first" });
      assert.equal(r.status, 201);
      assert.equal((await r.json()).title, "first");
      assert.equal(
        r.headers.get("x-trace"),
        "middleware,guard,interceptor:before,handler,interceptor:after",
      );
      r = await call({ title: 3 });
      assert.equal(r.status, 400);
      let b = await r.json();
      assert.deepEqual(b.trace.slice(0, 3), [
        "middleware",
        "guard",
        "interceptor:before",
      ]);
      assert.ok(!b.trace.includes("handler"));
      assert.ok(b.trace.includes("interceptor:error"));
      assert.equal(b.trace.at(-1), "filter");
      r = await call({ title: "denied" }, "bob-invalid");
      assert.equal(r.status, 403);
      assert.deepEqual((await r.json()).trace, [
        "middleware",
        "guard",
        "filter",
      ]);
      r = await call({ title: "crash" });
      assert.equal(r.status, 500);
      b = await r.json();
      assert.equal(b.error, "INTERNAL");
      assert.ok(b.trace.includes("handler"));
      assert.ok(b.trace.includes("interceptor:error"));
      assert.ok(!JSON.stringify(b).includes("private detail"));
      r = await call({ title: "extra", tenant: "tenant-b" });
      assert.equal(r.status, 400);
      assert.equal(app.get(NotesService).notes.length, 1);
      r = await call({ title: "recovered" });
      assert.equal(r.status, 201);
      assert.equal(app.get(NotesService).notes.length, 2);
      console.log(
        JSON.stringify({
          success: 201,
          invalid: 400,
          guard: 403,
          handler: 500,
          recovery: 201,
          stored: 2,
        }),
      );
    } finally {
      await app.close();
      assert.equal(app.getHttpServer().listening, false);
    }
  },
);
