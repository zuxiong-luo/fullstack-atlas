import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IsNull } from 'typeorm';
import { source, seed, NoteEntity, SqlLog } from './model.js';
test('Entity → SQL：约束、返回值、空值与连接清理', async t => {
 const log = new SqlLog(); const ds = source('typeorm_foundations', log);
 await ds.initialize();
 try {
  await ds.query('DROP SCHEMA IF EXISTS typeorm_foundations CASCADE');
  await ds.query('CREATE SCHEMA typeorm_foundations'); await ds.synchronize(); await seed(ds);
  const repo = ds.getRepository(NoteEntity);
  await t.test('insert 返回标识；save 新建与已有主键更新；update 返回受影响行数', async () => {
   const created = await repo.save({tenantId:'tenant-a',ownerId:'alice',title:'save-created'});
   assert.ok(created.id); assert.equal(created.body,null); await repo.delete({id:created.id});
   const result = await repo.insert({ tenantId:'tenant-a',ownerId:'alice',title:"quote ' ; --" });
   assert.equal(result.identifiers.length,1); const id = result.identifiers[0].id as number;
   const note = await repo.findOneByOrFail({id}); assert.equal(note.body,null); assert.equal(note.amount,'0.00');
   note.title = 'saved'; assert.equal((await repo.save(note)).id,id);
   assert.equal((await repo.update({id},{title:'updated',body:'keep-me'})).affected,1);
   await repo.update({id},{title:'without-body-change',body:undefined});
   assert.equal((await repo.findOneByOrFail({id})).body,'keep-me');
   await repo.update({id},{body:null});
   assert.equal((await repo.findOneByOrFail({id})).body,null);
   assert.equal((await repo.update({id:-1},{title:'none'})).affected,0);
   assert.equal((await repo.findBy({body:IsNull()})).length,4);
   assert.ok(log.queries.some(q => q.parameters?.includes("quote ' ; --")));
   assert.equal((await repo.delete({id})).affected,1);
  });
  await t.test('唯一与非空由 PG 拒绝，失败语句不被计为成功写入', async () => {
   await assert.rejects(repo.insert({tenantId:'tenant-a',ownerId:'alice',title:'Alpha'}),e => (e as {driverError:{code:string}}).driverError.code==='23505');
   await assert.rejects(repo.insert({tenantId:'tenant-a',ownerId:'alice',title:null as never}),e => (e as {driverError:{code:string}}).driverError.code==='23502');
   assert.equal(await repo.count(),4);
  });
  await t.test('1.1.2 高层 where 的 undefined/null 默认拒绝；{}查询却允许', async () => {
   const defaults = source('typeorm_foundations'); delete (defaults.options as { invalidWhereValuesBehavior?: unknown }).invalidWhereValuesBehavior;
   await defaults.initialize(); try {
    await assert.rejects(defaults.getRepository(NoteEntity).findBy({id:undefined}));
    await assert.rejects(defaults.getRepository(NoteEntity).findBy({body:null as never}));
   } finally { await defaults.destroy(); }
   assert.equal((await repo.findBy({})).length,4);
   assert.ok(await repo.findOneBy({}));
   await assert.rejects(repo.delete({})); await assert.rejects(repo.update({},{title:'bad'}));
   // QueryBuilder 是低层 SQL 入口：不能把高层空值策略当成它的保护罩。
   assert.equal((await repo.createQueryBuilder('n').where('n.id = :id',{id:undefined}).getMany()).length,0);
   const q = repo.createQueryBuilder('n').where({}).getQuery(); assert.ok(!q.includes(' WHERE '));
   assert.equal(await repo.count(),4);
  });
  console.log(JSON.stringify({version:'1.1.2',rows:await repo.count(),sampleSql:log.queries.find(x=>x.sql.startsWith('INSERT'))}));
 } finally { try { await ds.query('DROP SCHEMA IF EXISTS typeorm_foundations CASCADE'); } finally { await ds.destroy(); } }
 assert.equal(ds.isInitialized,false);
 await t.test('初始化失败不遗留已初始化池',async()=>{
  const broken=source('unused'); Object.assign(broken.options,{url:'postgres://127.0.0.1:1/none'});
  await assert.rejects(broken.initialize()); assert.equal(broken.isInitialized,false);
 });
});
