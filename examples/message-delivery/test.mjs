import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {withRedis,redis,apply,firstMessage} from './redis.mjs';
const execute=promisify(execFile);
async function worker(mode,fault) {
  try {await execute(process.execPath,['worker.mjs',mode,fault],{cwd:import.meta.dirname,timeout:5000});return 0;}
  catch(error){assert.equal(error.code,23);return error.code;}
}
async function reset() {await redis('FLUSHDB');await redis('XGROUP','CREATE','events','workers','0','MKSTREAM');}
async function add(event='order-42',amount=10){return redis('XADD','events','*','event',event,'amount',amount);}
async function claim(){const response=await redis('XAUTOCLAIM','events','workers','worker-b',0,'0-0','COUNT',10);return response[1];}
test('real Redis Streams delivery boundaries',async t=>withRedis(async cluster=>{
  await t.test('read is not ACK; a stopped process leaves pending work',async()=>{
    await reset();const id=await add();assert.equal(await worker('safe','after-read'),23);
    assert.equal((await redis('XPENDING','events','workers'))[0],1);
    assert.equal(firstMessage(await redis('XREADGROUP','GROUP','workers','worker-b','COUNT',1,'STREAMS','events','>')),null);
    const [reclaimed]=await claim();assert.equal(reclaimed[0],id);
    await apply(reclaimed);assert.equal(await redis('XACK','events','workers',id),1);
    assert.equal(await redis('XACK','events','workers',id),0);
    assert.equal((await redis('XPENDING','events','workers'))[0],0);
    assert.equal(await redis('XLEN','events'),1);
  });
  await t.test('ACK before the effect loses the group recovery signal',async()=>{
    await reset();await add();await worker('safe','after-ack');
    assert.equal((await redis('XPENDING','events','workers'))[0],0);
    assert.deepEqual(await claim(),[]);
    assert.equal(await redis('HGET','consumer-state','balance'),null);
    assert.equal(await redis('XLEN','events'),1);
  });
  await t.test('effect before ACK can happen twice without business idempotency',async()=>{
    await reset();await add();await worker('naive','after-effect');
    const [again]=await claim();await redis('INCRBY','naive-balance',10);await redis('XACK','events','workers',again[0]);
    assert.equal(await redis('GET','naive-balance'),'20');
  });
  await t.test('atomic receipt and effect survive repeated delivery and AOF restart',async()=>{
    await reset();await add();await worker('safe','after-effect');
    assert.equal((await redis('XPENDING','events','workers'))[0],1);
    await cluster.restart();
    const [again]=await claim();assert.equal((await apply(again)).result[0],'duplicate');
    await redis('XACK','events','workers',again[0]);
    const other=await add();const message=firstMessage(await redis('XREADGROUP','GROUP','workers','worker-b','STREAMS','events','>'));
    assert.equal(message[0],other);assert.equal((await apply(message)).result[0],'duplicate');
    await redis('XACK','events','workers',other);
    assert.equal(await redis('HGET','consumer-state','balance'),'10');
    assert.equal((await redis('XPENDING','events','workers'))[0],0);
  });
  await t.test('same business ID with changed content remains pending as conflict',async()=>{
    await add('order-42',99);const message=firstMessage(await redis('XREADGROUP','GROUP','workers','worker-b','STREAMS','events','>'));
    await assert.rejects(apply(message),/IDEMPOTENCY_CONFLICT/);
    assert.equal((await redis('XPENDING','events','workers'))[0],1);
    assert.equal(await redis('HGET','consumer-state','balance'),'10');
  });
  await t.test('delivery order does not imply completion order across consumers',async()=>{
    await reset();await add('first',1);await add('second',2);
    const a=firstMessage(await redis('XREADGROUP','GROUP','workers','a','COUNT',1,'STREAMS','events','>'));
    const b=firstMessage(await redis('XREADGROUP','GROUP','workers','b','COUNT',1,'STREAMS','events','>'));
    const completed=[];await apply(b);completed.push('second');await apply(a);completed.push('first');
    assert.deepEqual(completed,['second','first']);
    assert.equal(await redis('HGET','consumer-state','balance'),'3');
  });
}));
