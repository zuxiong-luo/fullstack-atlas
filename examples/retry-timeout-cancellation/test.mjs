import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {requestWithRetry,retryAfter,delayFor} from './client.mjs';
import {startServer} from './server.mjs';
const quiet=async server=>{for(let i=0;i<100;i++){if(server.active===0)return;await pause(5);}throw new Error('upstream remained active');};
test('pure backoff decisions use supplied budget, do not move network time',()=>{
  assert.equal(delayFor({attempt:1,remaining:100,random:()=>0.5}),5);
  assert.equal(delayFor({attempt:2,remaining:100,random:()=>0.5}),10);
  assert.equal(delayFor({attempt:5,remaining:1000,retryAfterMs:200,random:()=>0.5}),200);
  assert.throws(()=>delayFor({attempt:1,remaining:5,retryAfterMs:5}),/TOTAL_BUDGET/);
  assert.equal(retryAfter('2',0),2000);assert.equal(retryAfter('Thu, 01 Jan 1970 00:00:03 GMT',1000),2000);
});
test('real HTTP retries, ambiguity, cancellation and limits',async t=>{
  const server=await startServer();t.after(()=>server.close());
  const call=(path,options={})=>requestWithRetry({url:server.base+path,random:()=>0,...options});
  await t.test('two 503 responses then success, no duplicate extra attempt',async()=>{
    const result=await call('/flaky');assert.equal(result.status,200);assert.equal(result.attempts,3);assert.equal(server.counts.get('/flaky'),3);
  });
  await t.test('permanent status not retried; transient status has finite attempts',async()=>{
    assert.equal((await call('/bad')).status,400);assert.equal(server.counts.get('/bad'),1);
    await assert.rejects(call('/always'),/ATTEMPTS_EXHAUSTED/);assert.equal(server.counts.get('/always'),3);
  });
  await t.test('Retry-After longer than total budget is not shortened to force retry',async()=>{
    await assert.rejects(call('/too-late',{budgetMs:100}),/TOTAL_BUDGET/);assert.equal(server.counts.get('/too-late'),1);
  });
  await t.test('actual overall budget aborts transport and releases cooperative upstream',async()=>{
    await assert.rejects(call('/slow',{budgetMs:80,attemptMs:1000}),/TOTAL_BUDGET|ATTEMPTS_EXHAUSTED/);
    await quiet(server);assert.equal(server.active,0);
  });
  await t.test('parent cancellation does not become another retry',async()=>{
    const controller=new AbortController();
    const running=call('/slow',{signal:controller.signal,budgetMs:1000,attemptMs:1000});
    // Wait for a real admitted slow request, not a guessed delay.
    for(let i=0;i<100&&server.active===0;i++)await pause(5);
    assert.ok(server.active>0);const before=server.counts.get('/slow');controller.abort(new Error('USER_CANCELLED'));
    await assert.rejects(running,/USER_CANCELLED/);await quiet(server);assert.equal(server.counts.get('/slow'),before);
  });
  await t.test('cancellation during backoff preserves parent reason and sends no next attempt',async()=>{
    const controller=new AbortController(),before=server.counts.get('/always');
    await assert.rejects(call('/always',{signal:controller.signal,random:()=>{queueMicrotask(()=>controller.abort(new Error('BACKOFF_CANCELLED')));return 0.5;}}),/BACKOFF_CANCELLED/);
    assert.equal(server.counts.get('/always'),before+1);
  });
  await t.test('ambiguous POST without idempotency contract is sent only once',async()=>{
    const before=server.effects;
    await assert.rejects(call('/unsafe',{method:'POST',body:{amount:10}}),/RESULT_UNKNOWN/);
    assert.equal(server.effects,before+1);assert.equal(server.counts.get('/unsafe'),1);
  });
  await t.test('server receipt plus stable key makes lost-response replay return same effect',async()=>{
    const before=server.effects;
    const result=await call('/safe',{method:'POST',body:{amount:10},idempotencyKey:'order-key-42',postReplayContract:true});
    assert.equal(result.status,200);assert.equal(result.attempts,2);assert.equal(server.effects,before+1);
    const conflict=await call('/safe',{method:'POST',body:{amount:11},idempotencyKey:'order-key-42',postReplayContract:true});assert.equal(conflict.status,409);assert.equal(conflict.attempts,1);
  });
  await t.test('response body allocation is bounded; size errors not retried',async()=>{
    await assert.rejects(call('/large'),/RESPONSE_LIMIT/);assert.equal(server.counts.get('/large'),1);
  });
});
