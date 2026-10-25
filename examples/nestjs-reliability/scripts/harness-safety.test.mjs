import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  chmod,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
for (const mode of ["start-timeout", "status-unknown", "stop-fails"])
  test("owned harness cleanup: " + mode, { timeout: 8000 }, async () => {
    const fake = await mkdtemp(join(tmpdir(), "atlas-nest-fake-bin-")),
      trace = join(fake, "trace.jsonl");
    let data;
    const program = `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(2),name=path.basename(process.argv[1]),data=args[args.indexOf('-D')+1];fs.appendFileSync(process.env.NEST_FAKE_TRACE,JSON.stringify({name,args,data})+'\\n');const mode=process.env.NEST_FAKE_MODE;if(name==='initdb'){fs.mkdirSync(data,{recursive:true});process.exit(0);}if(name==='pg_ctl'){const flag=path.join(data,'fake-running');if(args.includes('start')){fs.writeFileSync(flag,'1');if(mode==='start-timeout')setTimeout(()=>{},60000);else process.exit(1);}else if(args.includes('status')){process.exit(mode==='status-unknown'?5:fs.existsSync(flag)?0:3);}else if(args.includes('stop')){if(mode==='stop-fails')process.exit(5);fs.unlinkSync(flag);process.exit(0);}}`;
    for (const bin of ["initdb", "pg_ctl", "psql"]) {
      const file = join(fake, bin);
      await writeFile(file, program);
      await chmod(file, 0o700);
    }
    const previous = {
      PG_BIN: process.env.PG_BIN,
      NEST_FAKE_TRACE: process.env.NEST_FAKE_TRACE,
      NEST_FAKE_MODE: process.env.NEST_FAKE_MODE,
      NEST_PG_COMMAND_MS: process.env.NEST_PG_COMMAND_MS,
    };
    Object.assign(process.env, {
      PG_BIN: fake,
      NEST_FAKE_TRACE: trace,
      NEST_FAKE_MODE: mode,
      NEST_PG_COMMAND_MS: "1200",
    });
    try {
      const { withCluster } = await import("./cluster.mjs?case=" + mode);
      await assert.rejects(
        withCluster(() => {
          throw new Error("must not reach SQL work");
        }).catch(error=>{console.error("expected fixture error",error.message);throw error;}),
      );
      const calls = (await readFile(trace, "utf8"))
        .trim()
        .split("\n")
        .map(JSON.parse);
      data = calls.find((x) => x.name === "initdb").data;
      const directory = join(data, "..");
      assert.ok(calls.some((x) => x.args.includes("status")));
      if (mode === "start-timeout") {
        assert.ok(calls.some((x) => x.args.includes("stop")));
        await assert.rejects(access(directory));
      } else {
        await access(directory);
        if (mode === "stop-fails")
          assert.ok(calls.some((x) => x.args.includes("stop")));
        else assert.ok(!calls.some((x) => x.args.includes("stop")));
      }
    } finally {
      for (const [key, value] of Object.entries(previous))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      // These directories contain only this test's fake marker, never a postmaster.
      if (data) await rm(join(data, ".."), { recursive: true, force: true });
      await rm(fake, { recursive: true, force: true });
    }
  });
