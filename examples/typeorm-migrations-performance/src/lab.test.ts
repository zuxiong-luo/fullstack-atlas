import {test} from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import type {MigrationInterface,QueryRunner} from 'typeorm';
import {source,NoteEntity,SqlLog} from './model.js';
const schema='typeorm_migrations';
function cli(args:string[],env:NodeJS.ProcessEnv={}){
 const r=spawnSync(process.execPath,['node_modules/typeorm/cli.js',...args,'-d','dist/migration-source.js'],{
  env:{...process.env,LAB_SCHEMA:schema,...env},encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,`${r.stdout}\n${r.stderr}`);return r.stdout;
}
class PartialDdl1761350400000 implements MigrationInterface{
 name='PartialDdl1761350400000';transaction=false;
 async up(q:QueryRunner){await q.query(`CREATE INDEX CONCURRENTLY partial_title_idx ON ${schema}.notes(title)`);await q.query('SELECT 1/0');}
 async down(q:QueryRunner){await q.query(`DROP INDEX IF EXISTS ${schema}.partial_title_idx`);}
}
test('迁移的生成、演进、失败状态与计划',async t=>{
 const log=new SqlLog(),ds=source(schema,log);await ds.initialize();
 const generated=mkdtempSync(join(tmpdir(),'typeorm-generated-'));const migrationGlob=join(generated,'*.js');
 try{
  await ds.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await ds.query(`CREATE SCHEMA ${schema}`);
  await t.test('空库 generate/run；带数据 generate/run/revert并保留原笔记',async()=>{
   const env={LAB_MIGRATIONS:migrationGlob};
   cli(['migration:generate',join(generated,'Initial'),'-o','--esm','-t','1761350300000'],env);
   const initial=readdirSync(generated).find(x=>x.includes('Initial'))!;
   assert.match(readFileSync(join(generated,initial),'utf8'),/CREATE TABLE/);
   cli(['migration:run'],env);
   await ds.query(`INSERT INTO ${schema}.owners("tenantId",id,name) VALUES('tenant-a','alice','Alice')`);
   await ds.getRepository(NoteEntity).insert({tenantId:'tenant-a',ownerId:'alice',title:'kept'});
   cli(['migration:generate',join(generated,'Review'),'-o','--esm','-t','1761350300001'],{...env,ADD_REVIEW_COLUMN:'1'});
   const review=readdirSync(generated).find(x=>x.includes('Review'))!;
   const sql=readFileSync(join(generated,review),'utf8');assert.match(sql,/ADD "reviewedAt"/);assert.match(sql,/DROP COLUMN "reviewedAt"/);
   cli(['migration:run'],{...env,ADD_REVIEW_COLUMN:'1'});
   assert.equal((await ds.query(`SELECT "reviewedAt" FROM ${schema}.notes`))[0].reviewedAt,null);
   await ds.query(`UPDATE ${schema}.notes SET "reviewedAt"='2026-01-01Z'`);
   cli(['migration:revert'],{...env,ADD_REVIEW_COLUMN:'1'});
   assert.equal((await ds.getRepository(NoteEntity).findOneByOrFail({title:'kept'})).title,'kept');
   assert.equal((await ds.query('SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',[schema,'notes','reviewedAt']))[0].n,0);
   assert.equal((await ds.query(`SELECT count(*)::int AS n FROM ${schema}.migration_history`))[0].n,1);
   console.log(JSON.stringify({generatedInitial:true,reviewMigration:sql,historyAfterRevert:1,baseNoteRetained:true,reviewedColumnDropped:true}));
  });
  await t.test('非事务DDL后失败：索引留下，历史未记录；显式修复',async()=>{
   const partial=source(schema);partial.setOptions({migrations:[PartialDdl1761350400000],migrationsTableName:'partial_history',migrationsTransactionMode:'each'});
   await partial.initialize();try{
    await assert.rejects(partial.runMigrations(),e=>(e as {driverError:{code:string}}).driverError.code==='22012');
    assert.equal((await ds.query('SELECT to_regclass($1) AS name',[`${schema}.partial_title_idx`]))[0].name,`${schema}.partial_title_idx`);
    assert.equal((await ds.query(`SELECT count(*)::int AS n FROM ${schema}.partial_history`))[0].n,0);
    const q=partial.createQueryRunner();try{await new PartialDdl1761350400000().down(q);}finally{await q.release();}
    assert.equal((await ds.query('SELECT to_regclass($1) AS name',[`${schema}.partial_title_idx`]))[0].name,null);
    console.log(JSON.stringify({failedSqlState:'22012',indexSurvivedFailure:true,historyRows:0,manualRecoveryRemovedIndex:true}));
   }finally{await partial.destroy();}
  });
  await t.test('相同结果的EXPLAIN前后对照，不用查询数伪造提速',async()=>{
   await ds.query(`INSERT INTO ${schema}.notes("tenantId","ownerId",title) SELECT 'tenant-a','alice','bulk-'||i FROM generate_series(1,20000) AS i`);
   await ds.query(`INSERT INTO ${schema}.owners("tenantId",id,name) VALUES('tenant-a','bob','Bob')`);
   await ds.getRepository(NoteEntity).insert({tenantId:'tenant-a',ownerId:'bob',title:'rare-bob'});
   await ds.query(`ANALYZE ${schema}.notes`);
   const sql=`SELECT id,title FROM ${schema}.notes WHERE "tenantId"=$1 AND "ownerId"=$2 ORDER BY id LIMIT 10`;
   const beforeRows=await ds.query(sql,['tenant-a','bob']);
   const before=(await ds.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,['tenant-a','bob']))[0]['QUERY PLAN'][0];
   await ds.query(`CREATE INDEX notes_owner_id_idx ON ${schema}.notes("tenantId","ownerId",id)`);await ds.query(`ANALYZE ${schema}.notes`);
   const afterRows=await ds.query(sql,['tenant-a','bob']);
   const after=(await ds.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,['tenant-a','bob']))[0]['QUERY PLAN'][0];
   assert.deepEqual(afterRows,beforeRows);assert.equal(afterRows.length,1);assert.equal(afterRows[0].title,'rare-bob');
   assert.ok(JSON.stringify(before).includes('Seq Scan'));assert.ok(JSON.stringify(after).includes('notes_owner_id_idx'));
   console.log(JSON.stringify({inputRows:20002,resultRows:afterRows.length,beforePlan:before.Plan,afterPlan:after.Plan}));
  });
  await t.test('有界批写与事务池回收：每批100行，受控失败整批回滚',async()=>{
   const rows=Array.from({length:250},(_,i)=>({tenantId:'tenant-a',ownerId:'alice',title:`batch-${i}`}));
   for(let start=0;start<rows.length;start+=100)await ds.getRepository(NoteEntity).insert(rows.slice(start,start+100));
   assert.equal((await ds.query(`SELECT count(*)::int AS n FROM ${schema}.notes WHERE title LIKE 'batch-%'`))[0].n,250);
   await assert.rejects(ds.transaction(async m=>{await m.getRepository(NoteEntity).insert({tenantId:'tenant-a',ownerId:'alice',title:'batch-rollback'});throw new Error('rollback');}),/rollback/);
   assert.equal(await ds.getRepository(NoteEntity).countBy({title:'batch-rollback'}),0);
   const pids=await Promise.all(Array.from({length:12},()=>ds.query('SELECT pg_backend_pid() AS pid')));
   assert.ok(new Set(pids.map(x=>x[0].pid)).size<=4);
   console.log(JSON.stringify({batchRows:250,batchSizes:[100,100,50],rollbackRows:0,poolMax:4,observedPids:new Set(pids.map(x=>x[0].pid)).size}));
  });
 }finally{try{await ds.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}finally{try{await ds.destroy();}finally{rmSync(generated,{recursive:true,force:true});}}}
 assert.equal(ds.isInitialized,false);
});
