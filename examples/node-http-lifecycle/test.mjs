import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
import { createApp } from './server.mjs';

async function start(t, options) {
  const app = createApp(options);
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close(20));
  return { app, port: app.server.address().port };
}
function send(port, text, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname:'127.0.0.1', port, method:'POST', path:'/notes', agent:false,
      headers: { 'content-type':'application/json', ...headers } }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.once('end', () => resolve({ status:res.statusCode, body:JSON.parse(data) }));
      res.once('error', reject);
    });
    req.once('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('TEST_TIMEOUT')));
    req.end(text);
  });
}
async function waitFor(check) {
  for (let i=0;i<200;i+=1) { if (check()) return; await pause(5); }
  throw new Error('condition not observed');
}
test('valid request and subsequent request work', { timeout:5000 }, async t => {
  const { app, port } = await start(t);
  assert.deepEqual(await send(port, JSON.stringify({ title:'  note  ', delayMs:0 })), { status:200, body:{title:'note'} });
  assert.equal((await send(port, JSON.stringify({ title:'two', delayMs:0 }))).status,200);
  assert.equal(app.snapshot.completed,2);
});
test('syntax, schema, content type, and byte limit failures stay distinct', { timeout:5000 }, async t => {
  const {port} = await start(t,{bodyLimit:100});
  assert.deepEqual(await send(port,'{'),{status:400,body:{error:'BAD_JSON'}});
  assert.equal((await send(port,'{"title":"ok"}')).status,422);
  assert.equal((await send(port,'{"title":"ok","delayMs":0,"admin":true}')).status,422);
  assert.equal((await send(port,'hello',{'content-type':'text/plain'})).status,415);
  assert.deepEqual(await send(port,JSON.stringify({title:'汉'.repeat(40),delayMs:0})),{status:413,body:{error:'BODY_TOO_LARGE'}});
  assert.equal((await send(port,'{"title":"after","delayMs":0}')).status,200);
});
test('application budget cancels cooperative work', {timeout:5000}, async t => {
  const {app,port} = await start(t,{budgetMs:30});
  assert.deepEqual(await send(port,'{"title":"slow","delayMs":1000}'), {status:408,body:{error:'REQUEST_BUDGET'}});
  assert.equal(app.snapshot.active,0);
  assert.equal(app.snapshot.timedOut,1);
});
test('a disconnected client releases work and admission capacity', {timeout:5000}, async t => {
  const {app,port} = await start(t,{maxActive:1});
  const req = request({hostname:'127.0.0.1',port,path:'/notes',method:'POST',agent:false,headers:{'content-type':'application/json'} });
  req.on('error',()=>{});
  req.end('{"title":"cancel","delayMs":1000}');
  await waitFor(() => app.snapshot.active===1);
  assert.equal((await send(port,'{"title":"busy","delayMs":0}')).status,503);
  req.destroy();
  await waitFor(() => app.snapshot.cancelled===1 && app.snapshot.active===0);
  assert.equal((await send(port,'{"title":"next","delayMs":0}')).status,200);
});
test('close drains a short admitted request and is idempotent', {timeout:5000}, async t => {
  const {app,port} = await start(t);
  const pending = send(port,'{"title":"finish","delayMs":30}');
  await waitFor(() => app.snapshot.active===1);
  const closing = app.close(500);
  assert.equal(app.close(500),closing);
  assert.equal((await pending).status,200);
  await closing;
  assert.equal(app.snapshot.active,0);
  assert.equal(app.server.listening,false);
});
test('shutdown deadline aborts long work and closes sockets', {timeout:5000}, async t => {
  const {app,port} = await start(t,{budgetMs:3000});
  const pending = send(port,'{"title":"long","delayMs":2000}').then(value=>value,error=>error);
  await waitFor(() => app.snapshot.active===1);
  await app.close(20);
  const result = await pending;
  assert.ok(result instanceof Error || result.status===503);
  await waitFor(() => app.snapshot.active===0);
  assert.equal(app.server.listening,false);
});
test('incomplete upload is bounded by the application budget', {timeout:5000}, async t => {
  const {app,port} = await start(t,{budgetMs:40});
  const response = new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path:'/notes',method:'POST',agent:false,headers:{'content-type':'application/json','content-length':'100'}},res=>{
      res.resume();res.once('end',()=>resolve(res.statusCode));res.once('error',reject);
    });
    req.on('error',reject);req.write('{');
  });
  assert.equal(await response,408);
  assert.equal(app.snapshot.active,0);
});
