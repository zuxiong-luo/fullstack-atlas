import {splitRequest} from './split-request.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {readFile} from 'node:fs/promises';
import {withCluster} from './postgres.mjs';import {startServer} from './server.mjs';import {inTenant} from './service.mjs';
const {Pool}=pg;
test('real PostgreSQL 17 RLS and HTTP authorization use an unprivileged application role',async t=>withCluster(async config=>{
 const admin=new Pool({...config,max:1}),pool=new Pool({...config,user:'atlas_app',max:1});let server;
 try{
  assert.match((await admin.query('SHOW server_version')).rows[0].server_version,/^17\./);
  await admin.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));server=await startServer(pool);
  const alice=server.issue('alice'),bob=server.issue('bob'),sue=server.issue('sue'),carol=server.issue('carol'),outsider=server.issue('nobody');
  const call=(token,path,options={})=>fetch(server.base+path,{...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),...options.headers}});
  const patch=(token,path,body)=>call(token,path,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  await t.test('reject unknown identity/default tenant membership, ignore client role/user hints',async()=>{assert.equal((await call(null,'/tenants/red/docs')).status,401);assert.equal((await call('forged','/tenants/red/docs')).status,401);assert.equal((await call(outsider,'/tenants/red/docs')).status,403);assert.equal((await call(alice,'/tenants/blue/docs/b1?role=admin&user=carol')).status,403);});
  await t.test('owner and shared reads work; private peer resources remain hidden',async()=>{assert.equal((await call(alice,'/tenants/red/docs/a1')).status,200);assert.equal((await call(bob,'/tenants/red/docs/a2')).status,200);assert.equal((await call(bob,'/tenants/red/docs/a1')).status,404);const rows=await (await call(bob,'/tenants/red/docs')).json();assert.deepEqual(rows.map(x=>x.id),['a2']);});
  await t.test('same-tenant admin does not become global admin; foreign IDs stay hidden',async()=>{const rows=await (await call(sue,'/tenants/red/docs')).json();assert.deepEqual(rows.map(x=>x.id),['a1','a2','e1']);assert.equal((await call(sue,'/tenants/red/docs/b1')).status,404);assert.equal((await call(sue,'/tenants/blue/docs/b1')).status,403);assert.equal((await call(carol,'/tenants/blue/docs/b1')).status,200);});
  await t.test('viewer cannot write; editor cannot alter peer private docs or mass assign fields',async()=>{assert.equal((await patch(bob,'/tenants/red/docs/a2',{body:'bad',version:1})).status,403);assert.equal((await patch(alice,'/tenants/red/docs/e1',{body:'bad',version:1})).status,404);assert.equal((await patch(alice,'/tenants/red/docs/a1',{body:'bad',version:1,tenant_id:'blue',role:'admin'})).status,422);});
  await t.test('conditional authorized update succeeds; stale version reports conflict only to authorized writer',async()=>{const response=await patch(alice,'/tenants/red/docs/a1',{body:'Alice updated',version:1});assert.equal(response.status,200);assert.equal((await response.json()).version,2);assert.equal((await patch(alice,'/tenants/red/docs/a1',{body:'stale',version:1})).status,409);assert.equal((await patch(alice,'/tenants/red/docs/e1',{body:'guess',version:99})).status,404);});
  await t.test('membership downgrade/revocation affects next request without reissuing token',async()=>{await admin.query("UPDATE memberships SET role='viewer' WHERE tenant_id='red' AND user_id='alice'");assert.equal((await patch(alice,'/tenants/red/docs/a1',{body:'denied',version:2})).status,403);await admin.query("DELETE FROM memberships WHERE tenant_id='red' AND user_id='bob'");assert.equal((await call(bob,'/tenants/red/docs/a2')).status,403);});
  await t.test('RLS blocks accidentally broad SQL, tenant movement and unauthorized membership edits',async()=>{await inTenant(pool,'sue','red',async db=>{assert.deepEqual((await db.query('SELECT id FROM documents ORDER BY id')).rows.map(x=>x.id),['a1','a2','e1']);assert.equal((await db.query("UPDATE documents SET body='no' WHERE id='b1'")).rowCount,0);});await assert.rejects(inTenant(pool,'sue','red',db=>db.query("UPDATE documents SET tenant_id='blue' WHERE id='a1'")),e=>e.code==='42501');await assert.rejects(inTenant(pool,'sue','red',db=>db.query("UPDATE memberships SET role='admin' WHERE user_id='alice'")),e=>e.code==='42501');});
  await t.test('transaction-local context does not leak through a one-connection pool',async()=>{await inTenant(pool,'sue','red',db=>db.query('SELECT id FROM documents'));assert.equal((await pool.query('SELECT id FROM documents')).rowCount,0);const blue=await inTenant(pool,'carol','blue',db=>db.query('SELECT id FROM documents'));assert.deepEqual(blue.rows.map(x=>x.id),['b1']);const context=await pool.query("SELECT current_setting('app.tenant_id',true) AS tenant");assert.equal(context.rows[0].tenant,'');});
  await t.test('token revocation and parse failures are bounded and never log credential material',async()=>{server.revoke(carol);assert.equal((await call(carol,'/tenants/blue/docs')).status,401);assert.equal((await patch(sue,'/tenants/red/docs/a1',{body:'x'.repeat(2000),version:2})).status,413);assert.equal((await call(sue,'/tenants/red/docs/a1',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'broken'})).status,400);assert.ok(server.audit.length>0);assert.ok(!JSON.stringify(server.audit).includes(alice));});

  await t.test('split UTF-8 preserves stored Unicode and rejects invalid byte sequences',async()=>{
   let observed;const first=new Promise(resolve=>observed=resolve),sizes=[];
   const fragmented=await startServer(pool,{onBodyChunk:count=>{sizes.push(count);observed();}});
   try{
    const token=fragmented.issue('sue'),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    const body=Buffer.from(JSON.stringify({body:'你好',version:1})),cut=body.indexOf(Buffer.from('你'))+1;
    const response=await splitRequest(fragmented.base+'/tenants/red/docs/e1',{method:'PATCH',headers,body,cut,firstObserved:first});
    assert.equal(response.status,200);assert.ok(sizes.length>=2);
    assert.equal((await admin.query("SELECT body FROM documents WHERE id='e1'")).rows[0].body,'你好');
    const invalid=Buffer.concat([Buffer.from('{"body":"'),Buffer.from([0xff]),Buffer.from('","version":2}')]);
    assert.equal((await fetch(fragmented.base+'/tenants/red/docs/e1',{method:'PATCH',headers,body:invalid})).status,400);
   }finally{await fragmented.close();}
  });
 }finally{if(server)await server.close();await pool.end();await admin.end();}
}));
