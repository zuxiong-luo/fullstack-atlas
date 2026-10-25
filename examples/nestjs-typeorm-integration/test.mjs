import test from "node:test";
import assert from "node:assert/strict";
import { createApp, NotesService } from "./dist/app.js";
import { DataSource } from "typeorm";
import { NoteEntity, AuditEntity } from "./dist/model.js";
test(
  "real PG create/update/audit atomic commit, rollback and connection release",
  { timeout: 20000 },
  async () => {
    const app = await createApp();
    const ds = app.get(DataSource);
    try {
      const url = await app.getUrl(),
        write = async (method, path, body) => {
          const r = await fetch(url + path, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          return { status: r.status, body: await r.json() };
        };
      let r = await write("POST", "/notes", { title: 3 });
      assert.equal(r.status, 400);
      assert.equal(await ds.getRepository(NoteEntity).count(), 0);
      assert.equal(await ds.getRepository(AuditEntity).count(), 0);
      r = await write("POST", "/notes", { title: "Alpha" });
      assert.equal(r.status, 201);
      const id = r.body.id;
      assert.equal(typeof id, "number");
      assert.equal(r.body.amount, "0.00");
      assert.equal(r.body.tenantId, "tenant-a");
      r = await write("PATCH", "/notes/" + id, { title: "Beta" });
      assert.equal(r.status, 200);
      assert.equal(r.body.version, 2);
      r = await write("PATCH", "/notes/" + id, {
        title: "bad-update",
        failAudit: true,
      });
      assert.equal(r.status, 500);
      assert.equal(
        (await ds.getRepository(NoteEntity).findOneByOrFail({ id })).title,
        "Beta",
      );
      r = await write("POST", "/notes", {
        title: "bad-create",
        failAudit: true,
      });
      assert.equal(r.status, 500);
      assert.equal(await ds.getRepository(NoteEntity).count(), 1);
      assert.equal(await ds.getRepository(AuditEntity).count(), 2);
      r = await write("PATCH", "/notes/" + id, { title: "Recovered" });
      assert.equal(r.status, 200);
      assert.equal(await ds.getRepository(AuditEntity).count(), 3);
      assert.equal(app.get(NotesService).readRepository.manager.connection, ds);
      console.log(
        JSON.stringify({
          created: 201,
          updated: 200,
          rollbackCreate: 500,
          rollbackUpdate: 500,
          notes: 1,
          audits: 3,
          recovered: 200,
        }),
      );
    } finally {
      await app.close();
      assert.equal(ds.isInitialized, false);
    }
  },
);
test(
  "initialization failure is bounded and leaves no healthy app",
  { timeout: 10000 },
  async () => {
    const { failInitialization } = await import(
      "./dist/initialization-failure.js"
    );
    const began = Date.now();
    await assert.rejects(failInitialization(), /role.*does not exist/);
    assert.ok(Date.now() - began < 5000);
  },
);
