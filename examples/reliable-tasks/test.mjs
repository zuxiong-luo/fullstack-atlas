import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { temporaryCluster, sql, session } from './harness.mjs';
const execute=promisify(execFile);
test('durable jobs on dedicated PostgreSQL17 instance',async t=>temporaryCluster(async cluster=>{
 await sql(await readFile('schema.sql','utf8'));
 async function reset(){await sql("TRUNCATE effects,artifacts,jobs RESTART IDENTITY CASCADE; INSERT INTO jobs(business_key) VALUES('job');");}
 const claim=owner=>sql(`SELECT * FROM claim_job('${owner}',1000);`);
 const complete=(owner,token,key)=>sql(`SELECT complete_job(1,'${owner}',${token},'${key}');`);
 await t.test('two connections skip locked candidate; only the first owns job',async()=>{
  await reset();const a=session('task-claim-a');a.send("BEGIN; SELECT * FROM claim_job('a',1000);\n\\echo CLAIM_HELD");await a.wait('CLAIM_HELD');
  assert.equal(await claim('b'),'');assert.equal((await a.end('COMMIT;')).code,0);
  assert.equal(await sql('SELECT status,generation,owner FROM jobs;'),'running|1|a');
 });
 await t.test('lease renewal and expired owner cannot revive or finish',async()=>{
  await reset();assert.equal(await claim('a'),'1|1');
  assert.equal(await sql("SELECT renew_job(1,'a',1,2000);"),'t');
  await sql("UPDATE jobs SET lease_until=clock_timestamp()-interval '1 millisecond';");
  assert.equal(await sql("SELECT renew_job(1,'a',1,2000);"),'f');
  assert.equal(await complete('a',1,'old'),'stale');
  assert.equal(await claim('b'),'1|2');
  assert.equal(await complete('a',1,'old'),'stale');
  assert.equal(await complete('b',2,'new'),'completed');
  assert.equal(await sql('SELECT generation,result_key FROM artifacts;'),'2|new');
 });
 await t.test('duplicate completion keeps one effect and changed result conflicts',async()=>{
  await reset();await claim('a');assert.equal(await complete('a',1,'asset'),'completed');
  assert.equal(await complete('a',1,'asset'),'duplicate');assert.equal(await complete('a',1,'different'),'conflict');
  assert.equal(await sql('SELECT count(*) FROM effects;'),'1');
 });
 await t.test('transaction failure cannot partially publish or charge',async()=>{
  await reset();await claim('a');
  await assert.rejects(sql("BEGIN; SELECT complete_job(1,'a',1,'asset'); SELECT 1/0; COMMIT;"),/division by zero/);
  assert.equal(await sql('SELECT status,(SELECT count(*) FROM effects),(SELECT result_key IS NULL FROM artifacts) FROM jobs;'),'running|0|t');
 });
 await t.test('retry budget and expired last attempt become terminal failed',async()=>{
  await reset();await sql('UPDATE jobs SET max_attempts=2;');await claim('a');
  assert.equal(await sql("SELECT fail_job(1,'a',1,0);"),'t');assert.equal(await claim('b'),'1|2');
  await sql("UPDATE jobs SET lease_until=clock_timestamp()-interval '1 millisecond';");
  assert.equal(await claim('c'),'');assert.equal(await sql('SELECT reap_exhausted();'),'1');
  assert.equal(await sql('SELECT status,attempts FROM jobs;'),'failed|2');
 });
 await t.test('worker crash after external artifact leaves orphan; persisted lease recovers after DB restart',async()=>{
  await reset();const artifacts=join(cluster.directory,'artifacts');await mkdir(artifacts);
  await assert.rejects(execute(process.execPath,['worker.mjs','--crash-after-file'],{env:{...process.env,ARTIFACT_DIR:artifacts}}),error=>error.code===23);
  assert.deepEqual(await readdir(artifacts),['1-1.txt']);assert.equal(await sql('SELECT status,generation FROM jobs;'),'running|1');
  await cluster.restart();assert.equal(await sql('SELECT status,generation FROM jobs;'),'running|1');
  // Fault injection sets DB time relation deterministically; no worker is assumed dead by expiry alone.
  await sql("UPDATE jobs SET lease_until=clock_timestamp()-interval '1 millisecond';");
  const recovered=await execute(process.execPath,['worker.mjs'],{env:{...process.env,ARTIFACT_DIR:artifacts}});
  assert.match(recovered.stdout,/completed/);assert.deepEqual((await readdir(artifacts)).sort(),['1-1.txt','1-2.txt']);
  assert.equal(await sql('SELECT status,generation,result_key,(SELECT count(*) FROM effects) FROM jobs;'),'completed|2|1-2.txt|1');
 });
}));
