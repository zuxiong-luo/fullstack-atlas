import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { start,flight } from './harness.mjs';
let app;
before(async()=>{app=await start(4321);});
after(async()=>{await app?.stop();});
test('first visit returns a complete HTML shell and the chosen note',async()=>{
 const res=await fetch(app.base+'/notes/n1'),html=await res.text();
 assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/html/);
 for(const value of ['共享笔记布局','布局计数：','理解路由树','当前笔记：','n1','/_next/static'])assert.ok(html.includes(value),value);
});
test('RSC navigation returns the target tree instead of an HTML document',async()=>{
 const {res,text}=await flight(app.base,'/notes/n2');assert.equal(res.status,200);
 assert.match(res.headers.get('content-type'),/text\/x-component/);assert.match(text,/理解客户端导航/);
 assert.doesNotMatch(text,/<!DOCTYPE html>/i);
});
test('dynamic segment chooses known notes and missing input gets not-found UI',async()=>{
 const one=await(await fetch(app.base+'/notes/n1')).text(),two=await(await fetch(app.base+'/notes/n2')).text();
 assert.match(one,/理解路由树/);assert.match(two,/理解客户端导航/);
 const missing=await fetch(app.base+'/notes/unknown');const html=await missing.text();
 // Streaming can have sent 200 before notFound is resolved; UI must still be correct.
 assert.ok([200,404].includes(missing.status));assert.match(html,/该笔记不存在/);
});
test('route handler produces JSON, and HTML includes both Link and full-document alternatives',async()=>{
 const res=await fetch(app.base+'/api/ping');assert.deepEqual(await res.json(),{ok:true});
 const html=await(await fetch(app.base+'/notes/n1')).text();
 assert.match(html,/整页打开第二篇/);assert.match(html,/href="\/notes\/n2"/);
});
