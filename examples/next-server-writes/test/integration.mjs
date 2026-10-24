import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {start} from './harness.mjs';
let app,alice,bob,firstId;
const password='demo-password-for-test-only';
async function call(path,{method='GET',body,raw,cookie,origin,headers={}}={}){
 const res=await fetch(app.base+path,{method,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin??app.base}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body)),signal:AbortSignal.timeout(5000)});
 return {res,text:await res.text()};
}
async function login(user){const {res}=await call('/api/session',{method:'POST',body:{user,password}});assert.equal(res.status,200);const cookie=res.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);return cookie.split(';')[0];}
before(async()=>{app=await start(4323,{DEMO_SESSION_SECRET:'server-only-test-secret-32-characters',DEMO_ALICE_PASSWORD:password,DEMO_BOB_PASSWORD:password});alice=await login('alice');bob=await login('bob');});
after(async()=>{await app?.stop();});
test('credentials and session are required at the server boundary',async()=>{
 assert.equal((await call('/api/session',{method:'POST',body:{user:'alice',password:'wrong'}})).res.status,401);
 assert.equal((await call('/api/notes')).res.status,401);
 assert.equal((await call('/api/notes',{cookie:alice.replace('alice','bob')})).res.status,401);
});
test('same owner and idempotency key return one result, including concurrent calls',async()=>{
 const options={method:'POST',cookie:alice,body:{title:'first',key:'first-key-001'}};
 const [a,b]=await Promise.all([call('/api/notes',options),call('/api/notes',options)]);
 assert.equal(a.res.status,200);assert.equal(b.res.status,200);assert.deepEqual(JSON.parse(a.text),JSON.parse(b.text));firstId=JSON.parse(a.text).id;
 const rows=JSON.parse((await call('/api/notes',{cookie:alice})).text);assert.equal(rows.length,1);
});
test('conflicting reuse is rejected; users and resource reads are isolated',async()=>{
 assert.equal((await call('/api/notes',{method:'POST',cookie:alice,body:{title:'changed',key:'first-key-001'}})).res.status,409);
 assert.equal((await call('/api/notes/'+firstId,{cookie:bob})).res.status,404);
 assert.equal((await call('/api/notes/'+firstId,{cookie:alice})).res.status,200);
 const other=await call('/api/notes',{method:'POST',cookie:bob,body:{title:'Bob note',key:'first-key-001'}});assert.equal(other.res.status,200);assert.notEqual(JSON.parse(other.text).id,firstId);
});
test('origin, malformed input, unknown owner and oversized body fail safely',async()=>{
 assert.equal((await call('/api/notes',{method:'POST',cookie:alice,origin:'https://invalid.example',body:{title:'x',key:'key-12345'}})).res.status,403);
 assert.equal((await call('/api/notes',{method:'POST',cookie:alice,raw:'{'})).res.status,400);
 assert.equal((await call('/api/notes',{method:'POST',cookie:alice,body:{title:'x',key:'key-12345',owner:'bob'}})).res.status,422);
 assert.equal((await call('/api/notes',{method:'POST',cookie:alice,body:{title:'x'.repeat(2000),key:'key-12345'}})).res.status,413);
});
async function formSubmit(cookie,title,key,origin=app.base){
 const html=(await call('/',{cookie})).text;const match=html.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);assert.ok(match,'SSR action identifier present');
 const form=new FormData();form.set(match[1],'');form.set('title',title);form.set('key',key);
 return fetch(app.base,{method:'POST',redirect:'manual',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{})},body:form,signal:AbortSignal.timeout(5000)});
}
test('actual progressively enhanced Server Action shares validation and idempotency',async()=>{
 const first=await formSubmit(alice,'action note','action-key-001');assert.equal(first.status,303);assert.match(first.headers.get('location'),/saved=/);
 const again=await formSubmit(alice,'action note','action-key-001');assert.equal(again.status,303);assert.equal(again.headers.get('location'),first.headers.get('location'));
 const invalid=await formSubmit(alice,'','action-key-bad');assert.equal(invalid.status,303);assert.match(invalid.headers.get('location'),/error=BAD_NOTE/);
 const absent=await formSubmit(undefined,'blocked','action-noauth');assert.equal(absent.status,303);assert.match(absent.headers.get('location'),/error=AUTH_REQUIRED/);
 const rows=JSON.parse((await call('/api/notes',{cookie:alice})).text);assert.equal(rows.filter(note=>note.title==='action note').length,1);
});
test('corrupt storage yields a safe API failure, then restores operation',async()=>{
 const file=join(app.dir,'state.json'),good=await readFile(file,'utf8');await writeFile(file,'broken');
 try{const failed=await call('/api/notes',{cookie:alice});assert.equal(failed.res.status,503);assert.match(failed.text,/UNAVAILABLE/);assert.doesNotMatch(failed.text,/SyntaxError|stack|state.json/);}
 finally{await writeFile(file,good);}
 assert.equal((await call('/api/notes',{cookie:alice})).res.status,200);
});

test('cross-site Server Action is rejected without changing owned records',async()=>{
 const before=JSON.parse((await call('/api/notes',{cookie:alice})).text).length;
 const denied=await formSubmit(alice,'cross-site','cross-site-key','https://invalid.example');
 assert.ok([403,500].includes(denied.status));
 const after=JSON.parse((await call('/api/notes',{cookie:alice})).text).length;assert.equal(after,before);
});
test('client bundles do not contain server secrets or storage implementation',async()=>{
 async function files(path){let result=[];for(const entry of await readdir(path,{withFileTypes:true})){const item=join(path,entry.name);if(entry.isDirectory())result.push(...await files(item));else if(item.endsWith('.js'))result.push(item);}return result;}
 const names=await files('.next/static');assert.ok(names.length>0);
 for(const file of names)assert.doesNotMatch(await readFile(file,'utf8'),/DEMO_SESSION_SECRET|DEMO_ALICE_PASSWORD|atlasNextWritesQueue|server-only-test-secret-32-characters/);
});
