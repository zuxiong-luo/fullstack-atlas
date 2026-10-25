import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import type {DataSource, QueryRunner} from 'typeorm';
import {source,seed,NoteEntity,SqlLog} from './model.js';
async function waitBlocked(ds:DataSource,pid:number,blocker:number){
 const deadline=Date.now()+4000;
 while(Date.now()<deadline){
  const [row]=await ds.query('SELECT $2::int=ANY(pg_blocking_pids($1::int)) AS blocked',[pid,blocker]);
  if(row.blocked)return;
  await setImmediate();
 }
 throw new Error('expected PostgreSQL lock dependency was not observed');
}
async function closeRunner(r:QueryRunner){try{if(r.isTransactionActive)await r.rollbackTransaction();}finally{await r.release();}}
test('事务连接归属、条件版本、锁与幂等',async t=>{
 const log=new SqlLog();const ds=source('typeorm_transactions',log);await ds.initialize();
 try{
  await ds.query('DROP SCHEMA IF EXISTS typeorm_transactions CASCADE');await ds.query('CREATE SCHEMA typeorm_transactions');await ds.synchronize();await seed(ds);
  const globalRepo=ds.getRepository(NoteEntity);
  await t.test('混用全局Repository逃出回滚；事务manager自己的变更回滚',async()=>{
   let txPid=0,globalPid=0;
   await assert.rejects(ds.transaction(async manager=>{
    txPid=(await manager.query('SELECT pg_backend_pid() AS pid'))[0].pid;
    globalPid=(await ds.query('SELECT pg_backend_pid() AS pid'))[0].pid;
    await manager.update(NoteEntity,{id:1},{body:'rolled-back'});
    await globalRepo.update({id:2},{body:'escaped'});
    throw new Error('rollback-now');
   }),/rollback-now/);
   assert.notEqual(txPid,globalPid);
   assert.equal((await globalRepo.findOneByOrFail({id:1})).body,null);
   assert.equal((await globalRepo.findOneByOrFail({id:2})).body,'escaped');
   await assert.rejects(ds.transaction(async manager=>{
    await manager.update(NoteEntity,{id:1},{body:'not-saved'});
    await manager.update(NoteEntity,{id:2},{body:'also-not-saved'});throw new Error('both-rollback');
   }),/both-rollback/);
   assert.equal((await globalRepo.findOneByOrFail({id:2})).body,'escaped');
   console.log(JSON.stringify({txPidDiffers:txPid!==globalPid,rollbackBody:null,escapedBody:'escaped'}));
  });
  await t.test('真正的乐观检查是SQL条件版本，两个已读版本只有一个成功',async()=>{
   const before=await globalRepo.findOneByOrFail({id:1});const expectedA=before.version,expectedB=before.version;
   log.reset();
   const change=(expected:number,title:string)=>globalRepo.createQueryBuilder().update(NoteEntity).set({title,version:()=> '"version" + 1'})
    .where('id=:id AND "tenantId"=:tenant AND version=:expected',{id:1,tenant:'tenant-a',expected}).execute();
   const results=await Promise.all([change(expectedA,'winner-a'),change(expectedB,'winner-b')]);
   assert.deepEqual(results.map(x=>x.affected).sort(),[0,1]);
   assert.equal((await globalRepo.findOneByOrFail({id:1})).version,2);
   const writes=log.queries.filter(x=>x.sql.startsWith('UPDATE'));assert.equal(writes.length,2);
   assert.ok(writes.every(x=>/WHERE.*version"?\s*=/.test(x.sql) && x.parameters?.includes(expectedA)));
   console.log(JSON.stringify({conditionalSql:writes[0]}));
   console.log(JSON.stringify({conditionalUpdates:results.map(x=>x.affected).sort(),version:2}));
  });
  await t.test('pessimistic_write确实等待：观测数据库阻塞边，再提交释放',async()=>{
   const first=ds.createQueryRunner(),second=ds.createQueryRunner();
   try{
    await first.connect();await second.connect();await first.startTransaction('READ COMMITTED');await second.startTransaction('READ COMMITTED');
    const pid1=(await first.query('SELECT pg_backend_pid() AS pid'))[0].pid,pid2=(await second.query('SELECT pg_backend_pid() AS pid'))[0].pid;
    await first.manager.getRepository(NoteEntity).createQueryBuilder('n').where('n.id=:id',{id:3}).setLock('pessimistic_write').getOneOrFail();
    await first.manager.update(NoteEntity,{id:3},{body:'after-lock'});
    const pending=second.manager.getRepository(NoteEntity).createQueryBuilder('n').where('n.id=:id',{id:3}).setLock('pessimistic_write').getOneOrFail();
    await waitBlocked(ds,pid2,pid1);await first.commitTransaction();
    assert.equal((await pending).body,'after-lock');await second.commitTransaction();
    console.log(JSON.stringify({lockDependencyObserved:true,secondRead:'after-lock'}));
   }finally{try{await closeRunner(first);}finally{await closeRunner(second);}}
   assert.equal(first.isReleased,true);assert.equal(second.isReleased,true);await assert.rejects(first.query('SELECT 1'));
  });
  await t.test('同一租户幂等键并发：唯一键等待后返回同一个结果，异请求体拒绝',async()=>{
   await ds.query('CREATE TABLE typeorm_transactions.requests(tenant text NOT NULL,key text NOT NULL,hash text NOT NULL,"noteId" int,PRIMARY KEY(tenant,key))');
   const first=ds.createQueryRunner(),second=ds.createQueryRunner();
   try{
    await first.connect();await second.connect();await first.startTransaction();await second.startTransaction();
    const pid1=(await first.query('SELECT pg_backend_pid() AS pid'))[0].pid,pid2=(await second.query('SELECT pg_backend_pid() AS pid'))[0].pid;
    const sql='INSERT INTO typeorm_transactions.requests(tenant,key,hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key';
    assert.equal((await first.query(sql,['tenant-a','create-1','body-hash-1'])).length,1);
    const note=await first.manager.getRepository(NoteEntity).save({tenantId:'tenant-a',ownerId:'alice',title:'idempotent-note'});
    await first.query('UPDATE typeorm_transactions.requests SET "noteId"=$1 WHERE tenant=$2 AND key=$3',[note.id,'tenant-a','create-1']);
    const pending=second.query(sql,['tenant-a','create-1','body-hash-1']);
    await waitBlocked(ds,pid2,pid1);await first.commitTransaction();assert.equal((await pending).length,0);
    const [stored]=await second.query('SELECT hash,"noteId" FROM typeorm_transactions.requests WHERE tenant=$1 AND key=$2',['tenant-a','create-1']);
    assert.equal(stored.hash,'body-hash-1');assert.equal(stored.noteId,note.id);await second.commitTransaction();
    assert.equal(await globalRepo.countBy({title:'idempotent-note'}),1);
    const replay=async(hash:string)=>{if(hash!==stored.hash)throw new Error('IDEMPOTENCY_CONFLICT');return stored.noteId as number;};
    assert.equal(await replay('body-hash-1'),note.id);await assert.rejects(replay('changed-body'),/IDEMPOTENCY_CONFLICT/);
    console.log(JSON.stringify({duplicateNoteCount:1,sharedResultId:note.id,differentPayload:'IDEMPOTENCY_CONFLICT'}));
   }finally{try{await closeRunner(first);}finally{await closeRunner(second);}}
  });
 }finally{try{await ds.query('DROP SCHEMA IF EXISTS typeorm_transactions CASCADE');}finally{await ds.destroy();}}
});
