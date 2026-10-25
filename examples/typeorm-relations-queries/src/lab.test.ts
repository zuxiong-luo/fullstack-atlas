import { test } from 'node:test';
import assert from 'node:assert/strict';
import { source, seed, NoteEntity, OwnerEntity, SqlLog } from './model.js';
test('关系、查询数量、分页和精度',async t=>{
 const log=new SqlLog();const ds=source('typeorm_relations',log);await ds.initialize();
 try{
  await ds.query('DROP SCHEMA IF EXISTS typeorm_relations CASCADE');await ds.query('CREATE SCHEMA typeorm_relations');await ds.synchronize();await seed(ds);
  const notes=ds.getRepository(NoteEntity),owners=ds.getRepository(OwnerEntity);
  await t.test('复合外键同时约束租户和用户',async()=>{
   await assert.rejects(notes.insert({tenantId:'tenant-b',ownerId:'alice',title:'cross-tenant'}),e=>(e as {driverError:{code:string}}).driverError.code==='23503');
  });
  await t.test('循环加载 1+N=4；JOIN=1；原始行4而实体父项3',async()=>{
   log.reset();const all=await owners.find({order:{tenantId:'ASC',id:'ASC'}});
   for(const o of all)await notes.findBy({tenantId:o.tenantId,ownerId:o.id});
   assert.equal(log.selects(),4);
   log.reset();const entities=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').getMany();
   assert.equal(log.selects(),1);assert.equal(entities.length,3);
   const raw=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').getRawMany();assert.equal(raw.length,4);
   const [page,count]=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').orderBy('o.tenantId').addOrderBy('o.id').take(1).getManyAndCount();
   assert.equal(page.length,1);assert.equal(page[0].notes?.length,2);assert.equal(count,3);
   const limited=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').orderBy('o.tenantId').addOrderBy('o.id').addOrderBy('n.id').limit(2).getRawMany();
   assert.equal(new Set(limited.map(x=>x.o_id)).size,1);
   console.log(JSON.stringify({nPlusOne:4,joinSelects:1,joinedRawRows:4,parentCount:count,pageParents:page.length}));
  });
  await t.test('微秒游标用数据库文本精度；金额保留字符串',async()=>{
   await ds.query(`UPDATE typeorm_relations.notes SET "createdAt"=t.ts FROM (VALUES (1,'2026-01-01 00:00:00.123456+00'::timestamptz),(2,'2026-01-01 00:00:00.123457+00'::timestamptz),(3,'2026-01-01 00:00:00.123458+00'::timestamptz)) AS t(id,ts) WHERE notes.id=t.id`);
   const first=await ds.query(`SELECT id,to_char("createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor FROM typeorm_relations.notes WHERE "tenantId"=$1 ORDER BY "createdAt",id LIMIT 1`,['tenant-a']);
   const row=first[0] as {id:number;cursor:string};assert.equal(row.cursor,'2026-01-01T00:00:00.123456Z');
   const page=await ds.query('SELECT id FROM typeorm_relations.notes WHERE "tenantId"=$1 AND ("createdAt",id)>($2::timestamptz,$3) ORDER BY "createdAt",id LIMIT 2',['tenant-a',row.cursor,row.id]);
   assert.deepEqual(page.map((x:{id:number})=>x.id),[2,3]);
   const truncated=new Date(row.cursor).toISOString();assert.equal(truncated,'2026-01-01T00:00:00.123Z');
   const wrong=await ds.query('SELECT id FROM typeorm_relations.notes WHERE "tenantId"=$1 AND ("createdAt",id)>($2::timestamptz,$3) ORDER BY "createdAt",id LIMIT 2',['tenant-a',truncated,row.id]);
   assert.deepEqual(wrong.map((x:{id:number})=>x.id),[1,2]);
   const amount=(await notes.findOneByOrFail({id:1})).amount;assert.equal(amount,'9007199254740993.10');assert.notEqual(Number(amount).toFixed(2),amount);
   console.log(JSON.stringify({exactCursor:row.cursor,truncatedCursor:truncated,correctPage:[2,3],wrongPage:[1,2],amount}));
  });
 }finally{try{await ds.query('DROP SCHEMA IF EXISTS typeorm_relations CASCADE');}finally{await ds.destroy();}}
});
