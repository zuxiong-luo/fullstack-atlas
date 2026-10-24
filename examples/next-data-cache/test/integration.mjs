import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {start} from './harness.mjs';
let app;const token='cache-test-token-at-least-32-characters';
const get=async()=>{const response=await fetch(app.base+'/api/catalog');return {response,data:await response.json()};};
async function post(path,body,auth=true){return fetch(app.base+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
before(async()=>{app=await start(4322,{CACHE_ADMIN_TOKEN:token});});
after(async()=>{await app?.stop();});
test('HTTP no-store does not prevent explicit server Data Cache reuse',async()=>{
 const a=await get(),b=await get();assert.equal(a.response.status,200);assert.match(a.response.headers.get('cache-control'),/no-store/);
 assert.equal(a.data.readId,b.data.readId);assert.equal(a.data.revision,1);
});
test('source changes remain stale until the tag is explicitly expired',async()=>{
 const before=(await get()).data;assert.equal((await post('/api/source',{title:'课程目录 v2'})).status,200);
 assert.equal((await get()).data.readId,before.readId);assert.equal((await get()).data.title,'课程目录 v1');
 assert.equal((await post('/api/invalidate')).status,200);
 const fresh=(await get()).data;assert.equal(fresh.title,'课程目录 v2');assert.equal(fresh.revision,2);assert.notEqual(fresh.readId,before.readId);
 assert.equal((await get()).data.readId,fresh.readId);
});
test('React cache deduplicates only within this component render',async()=>{
 const first=await(await fetch(app.base)).text(),second=await(await fetch(app.base)).text();
 const ids=html=>[...html.matchAll(/同次渲染读取[一二]：<!-- -->([a-f0-9-]{36})/g)].map(x=>x[1]);
 const a=ids(first),b=ids(second);assert.equal(a.length,2);assert.equal(b.length,2);assert.equal(a[0],a[1]);assert.equal(b[0],b[1]);assert.notEqual(a[0],b[0]);
});
test('mutation authorization and input failure leave source unchanged',async()=>{
 assert.equal((await post('/api/source',{title:'forbidden'},false)).status,401);
 assert.equal((await post('/api/source',{title:''})).status,422);
 assert.equal((await post('/api/source',{title:'ok',owner:'alice'})).status,422);
 assert.equal((await get()).data.title,'课程目录 v2');
});
test('corrupt source after expiration produces safe failure and recovery',async()=>{
 const file=join(app.dir,'state.json'),good=await readFile(file,'utf8');
 await writeFile(file,'{broken');await post('/api/invalidate');
 const failed=await get();assert.equal(failed.response.status,503);assert.equal(failed.data.error,'UNAVAILABLE');assert.ok(failed.data.requestId);
 await writeFile(file,good);await post('/api/invalidate');assert.equal((await get()).data.title,'课程目录 v2');
});
