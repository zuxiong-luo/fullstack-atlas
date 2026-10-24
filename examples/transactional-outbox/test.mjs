import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {withCluster,sql,session,until} from './postgres.mjs';
import {withRedis,redis,firstMessage} from './redis.mjs';
import {relayOnce} from './relay.mjs';
import {consume} from './consumer.mjs';
const execute=promisify(execFile);
async function crash(file,flag) {
  await assert.rejects(execute(process.execPath,[file,'--once',flag],{cwd:import.meta.dirname,timeout:8000}),error=>error.signal==='SIGKILL');
}
test('real PostgreSQL outbox and Redis recovery, private instances only',async t=>withCluster(async()=>withRedis(async()=>{
  await sql(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  await redis('XGROUP','CREATE','events','wallet-workers','0','MKSTREAM');
  await t.test('order and publication intent commit or rollback together',async()=>{
    await assert.rejects(sql("BEGIN; SELECT place_order('rolled-back',10); SELECT 1/0; COMMIT;"),/division by zero/);
    assert.equal(await sql('SELECT (SELECT count(*) FROM orders),(SELECT count(*) FROM outbox);'),'0|0');
    assert.equal(await redis('XLEN','events'),0);
    await sql("SELECT place_order('order-42',10);");
    assert.equal(await sql('SELECT (SELECT count(*) FROM orders),(SELECT count(*) FROM outbox WHERE published_at IS NULL);'),'1|1');
    assert.equal(await redis('XLEN','events'),0);
  });
  await t.test('publisher dies after XADD, leaving intent retryable; recovery duplicates transport',async()=>{
    await crash('relay.mjs','--crash-after-publish');
    await until(async()=>await sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='outbox-relay';")==='0','crashed publisher database connection closed');
    assert.equal(await redis('XLEN','events'),1);
    assert.equal(await sql('SELECT count(*) FROM outbox WHERE published_at IS NULL;'),'1');
    await relayOnce();assert.equal(await redis('XLEN','events'),2);
    assert.equal(await sql('SELECT count(*) FROM outbox WHERE published_at IS NOT NULL;'),'1');
    assert.equal(await relayOnce(),null);
  });
  await t.test('consumer dies after DB commit; reclaim plus duplicate stream entry applies once',async()=>{
    await crash('consumer.mjs','--crash-after-commit');
    assert.equal(await sql('SELECT balance FROM wallet;'),'10');
    assert.equal((await redis('XPENDING','events','wallet-workers'))[0],1);
    const claimed=await redis('XAUTOCLAIM','events','wallet-workers','consumer-b',0,'0-0','COUNT',1);
    assert.equal(await consume(claimed[1][0]),'duplicate');
    const next=firstMessage(await redis('XREADGROUP','GROUP','wallet-workers','consumer-b','COUNT',1,'STREAMS','events','>'));
    assert.equal(await consume(next),'duplicate');
    assert.equal(await sql('SELECT balance,(SELECT count(*) FROM inbox) FROM wallet;'),'10|1');
    assert.equal((await redis('XPENDING','events','wallet-workers'))[0],0);
  });
  await t.test('inbox and local effect rollback together if a later statement fails',async()=>{
    await assert.rejects(sql("BEGIN; SELECT consume_event('other-created',7); SELECT 1/0; COMMIT;"),/division by zero/);
    assert.equal(await sql("SELECT balance,(SELECT count(*) FROM inbox WHERE event_id='other-created') FROM wallet;"),'10|0');
  });
  await t.test('reused business event with changed content fails, not silently ignored',async()=>{
    await assert.rejects(sql("SELECT consume_event('order-42-created',99);"),/EVENT_ID_CONFLICT/);
    assert.equal(await sql('SELECT balance FROM wallet;'),'10');
  });
  await t.test('an uncommitted row is not publishable and locked row is skipped',async()=>{
    const a=session('outbox-uncommitted');
    a.send("BEGIN; SELECT place_order('future',5);\n\\echo INSERTED");await a.wait('INSERTED');
    assert.equal(await relayOnce(),null);assert.equal(await redis('XLEN','events'),2);
    assert.equal((await a.end('COMMIT;')).code,0);
    const lock=session('outbox-row-lock');lock.send("BEGIN; SELECT event_id FROM outbox WHERE event_id='future-created' FOR UPDATE;\n\\echo LOCKED");await lock.wait('LOCKED');
    assert.equal(await relayOnce(),null);assert.equal((await lock.end()).code,0);
    await relayOnce();assert.equal(await redis('XLEN','events'),3);
  });
})));
