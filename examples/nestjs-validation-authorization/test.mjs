import test from "node:test";
import assert from "node:assert/strict";
import { createApp, NotesService } from "./dist/app.js";
import { DataSource } from "typeorm";
test(
  "HTTP DTO, identity, resource ownership and deny without side effects",
  { timeout: 25000 },
  async () => {
    const app = await createApp(),
      ds = app.get(DataSource);
    try {
      const base = await app.getUrl(),
        call = async (method, path, body, token = "alice-demo", extra = {}) => {
          const r = await fetch(base + path, {
            method,
            headers: {
              "content-type": "application/json",
              ...(token ? { authorization: "Bearer " + token } : {}),
              ...extra,
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
          return { status: r.status, body: await r.json() };
        };
      const state = async () =>
        JSON.stringify(
          await ds.query(
            "SELECT (SELECT count(*) FROM notes)::int AS notes,(SELECT count(*) FROM audits)::int AS audits,(SELECT json_agg(row_to_json(n) ORDER BY id) FROM notes n) AS data",
          ),
        );
      let r = await call("POST", "/notes", { title: "Alpha", body: "keep me" });
      assert.equal(r.status, 201);
      const id = r.body.id;
      assert.ok(!("tenantId" in r.body));
      assert.ok(!("ownerId" in r.body));
      assert.equal(r.body.amount, "0.00");
      const rejected = [
        ["POST", "/notes", { title: "missing" }, null, 401],
        ["POST", "/notes", { title: "invalid" }, "invalid", 401],
        ...["toString", "constructor", "__proto__"].map((token) => [
          "GET",
          "/notes/" + id,
          undefined,
          token,
          401,
        ]),
        ["POST", "/notes", { title: "read only" }, "alice-readonly-demo", 403],
        ["POST", "/notes", { title: 123 }, "alice-demo", 400],
        [
          "POST",
          "/notes",
          { title: "forged", tenantId: "tenant-b", ownerId: "bob" },
          "alice-demo",
          400,
        ],
        ["GET", "/notes/" + id, undefined, "bob-demo", 404],
        [
          "PATCH",
          "/notes/" + id,
          { title: "steal", expectedVersion: 1 },
          "bob-demo",
          404,
        ],
        ["GET", "/notes/" + id, undefined, "bob-a-demo", 404],
        [
          "PATCH",
          "/notes/" + id,
          { title: "steal", expectedVersion: 1 },
          "bob-a-demo",
          404,
        ],
        ["GET", "/notes/99999", undefined, "alice-demo", 404],
        [
          "PATCH",
          "/notes/" + id,
          { title: "bad version", expectedVersion: "1" },
          "alice-demo",
          400,
        ],
        [
          "PATCH",
          "/notes/" + id,
          { title: "overflow", expectedVersion: 2147483647 },
          "alice-demo",
          400,
        ],
      ];
      for (const [method, path, body, token, status] of rejected) {
        const before = await state(),
          operationsBefore = app.get(NotesService).operations;
        r = await call(method, path, body, token);
        assert.equal(r.status, status);
        if (status === 401)
          assert.equal(app.get(NotesService).operations, operationsBefore);
        assert.equal(
          await state(),
          before,
          method + " " + token + " mutated state",
        );
      }
      const operations = app.get(NotesService).operations;
      r = await call("POST", "/notes", { title: "denied" }, null);
      assert.equal(r.status, 401);
      assert.equal(app.get(NotesService).operations, operations);
      r = await call(
        "PATCH",
        "/notes/" + id,
        { title: "Updated", expectedVersion: 1 },
        "alice-demo",
        { "x-tenant-id": "tenant-b" },
      );
      assert.equal(r.status, 200);
      assert.equal(r.body.version, 2);
      assert.equal(r.body.body, "keep me");
      const cleared = await call("PATCH", "/notes/" + id, {
        title: "Updated",
        expectedVersion: 2,
        body: null,
      });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.body, null);
      const before = await state();
      r = await call("PATCH", "/notes/" + id, {
        title: "Stale",
        expectedVersion: 1,
      });
      assert.equal(r.status, 409);
      assert.equal(await state(), before);
      r = await call("POST", "/notes", { title: "Updated" });
      assert.equal(r.status, 409);
      assert.ok(!JSON.stringify(r.body).includes("notes_"));
      r = await call("POST", "/notes", { title: "Bob private" }, "bob-demo");
      assert.equal(r.status, 201);
      r = await call("GET", "/notes/" + r.body.id, undefined, "bob-demo");
      assert.equal(r.status, 200);
      console.log(
        JSON.stringify({
          denyCases: rejected.length,
          denialsNoWrites: true,
          missingIdentity: 401,
          roleDenied: 403,
          hiddenResource: 404,
          versionConflict: 409,
          recovery: true,
        }),
      );
    } finally {
      await app.close();
      assert.equal(ds.isInitialized, false);
    }
  },
);
