import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "typeorm-migrations-performance",
  "topic": "data",
  "title": "迁移与性能：Schema 演进、索引、批处理与观测",
  "description": "真实执行 generate/run/revert 与非事务 DDL 故障，再用相同结果和 EXPLAIN 检查索引，控制批次与连接生命周期。",
  "minutes": 48,
  "labMinutes": 30,
  "tags": [
    "TypeORM",
    "PostgreSQL",
    "TypeScript",
    "租户笔记"
  ],
  "scope": "TypeORM 1.1.2 的独立 TypeScript/Node 入口与 PostgreSQL 17.4；不依赖 Nest 注入，不将 PostgreSQL 行为推广到 MySQL。",
  "prerequisites": [
    "会读写 TypeScript 和基本 SQL",
    "按 TypeORM 子系列顺序阅读；示例各自可运行，无需下载后章"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 24.14.1",
    "TypeORM 1.1.2",
    "pg 8.23.1",
    "TypeScript 5.7.2",
    "PostgreSQL 17.4"
  ],
  "verifiedAt": "2026-10-25",
  "examples": [
    {
      "label": "独立实验 ZIP",
      "path": "typeorm-migrations-performance.zip"
    },
    {
      "label": "安装、运行与实际输出",
      "path": "typeorm-migrations-performance/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "迁移是什么：把数据库演进变成可审阅的步骤",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "迁移是一段明确的数据库结构变更程序，描述从旧结构到新结构要执行哪些操作，并记录哪些步骤已经完成。实体是应用期望的映射，数据库却可能已经保存了多年数据；把实体文件改好，并不等于所有已部署数据库都自动安全地变成新结构。"
        },
        {
          "type": "paragraph",
          "text": "前几篇用 synchronize 创建临时实验 schema，是为了让你尽快观察数据访问机制。本篇转向已有数据的演进：空库先建立 Owner/Note；已有笔记后新增可空的 reviewedAt；最后回退这一结构修改。每一步都检查真实列、数据和迁移历史。目标是让你能够审阅生成 SQL，区分事务内回滚与非事务残留，而不是背下三条 CLI 命令。"
        },
        {
          "type": "paragraph",
          "text": "本文固定 TypeORM1.1.2 与 PostgreSQL17.4。CLI运行编译后的独立 DataSource，不经过 Nest；未来集成到服务时，迁移任务与常驻HTTP进程仍应拥有清楚的部署顺序和连接关闭责任。性能部分是同一数据库上的访问路径实验，不声称完成生产容量评测。"
        }
      ]
    },
    {
      "id": "source",
      "title": "先把开发映射与发布执行分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'reflect-metadata';\nimport { DataSource, EntitySchema, type Logger } from 'typeorm';\nexport interface Owner { tenantId: string; id: string; name: string; notes?: Note[] }\nexport interface Note { id: number; tenantId: string; ownerId: string; title: string; body: string | null; amount: string; createdAt: Date; version: number; owner?: Owner }\nexport const OwnerEntity = new EntitySchema<Owner>({ name: 'Owner', tableName: 'owners', columns: {\n  tenantId: { type: String, primary: true }, id: { type: String, primary: true }, name: { type: String }\n}, relations: { notes: { type: 'one-to-many', target: 'Note', inverseSide: 'owner' } } });\nexport const NoteEntity = new EntitySchema<Note>({ name: 'Note', tableName: 'notes', columns: {\n  id: { type: Number, primary: true, generated: true }, tenantId: { type: String }, ownerId: { type: String },\n  title: { type: String }, body: { type: String, nullable: true, default: null },\n  amount: { type: 'numeric', precision: 20, scale: 2, default: '0.00' },\n  createdAt: { type: 'timestamptz', precision: 6, default: () => 'CURRENT_TIMESTAMP' },\n  version: { type: Number, default: 1 }\n}, uniques: [{ columns: ['tenantId', 'title'] }], relations: { owner: {\n  type: 'many-to-one', target: 'Owner', inverseSide: 'notes', nullable: false,\n  joinColumn: [{ name: 'tenantId', referencedColumnName: 'tenantId' }, { name: 'ownerId', referencedColumnName: 'id' }]\n} } });\nexport class SqlLog implements Logger {\n  queries: { sql: string; parameters?: unknown[] }[] = [];\n  logQuery(sql: string, parameters?: unknown[]) { this.queries.push({ sql, parameters }); }\n  logQueryError() {} logQuerySlow() {} logSchemaBuild() {} logMigration() {} log() {}\n  reset() { this.queries = []; }\n  selects() { return this.queries.filter(x => /^SELECT/.test(x.sql)).length; }\n}\nexport function source(schema: string, logger = new SqlLog()) {\n  return new DataSource({ type: 'postgres', url: process.env.DATABASE_URL ?? 'postgres://127.0.0.1:55483/typeorm_content',\n    schema, entities: [OwnerEntity, NoteEntity], synchronize: false, logging: ['query'], logger,\n    extra: { max: 4, connectionTimeoutMillis: 1500 },\n    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' } });\n}\nexport async function seed(ds: DataSource) {\n  await ds.getRepository(OwnerEntity).insert([{ tenantId: 'tenant-a', id: 'alice', name: 'Alice' }, { tenantId: 'tenant-a', id: 'bob', name: 'Bob' }, { tenantId: 'tenant-b', id: 'bob', name: 'Bob B' }]);\n  await ds.getRepository(NoteEntity).insert([\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Alpha', amount: '9007199254740993.10' },\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Beta', body: 'text' },\n    { tenantId: 'tenant-a', ownerId: 'bob', title: 'Gamma' },\n    { tenantId: 'tenant-b', ownerId: 'bob', title: 'Private' }\n  ]);\n}\n",
          "language": "typescript",
          "filename": "examples/typeorm-migrations-performance/src/model.ts",
          "purpose": "同一租户笔记模型，synchronize=false；本篇由迁移实际创建表。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {EntitySchema} from 'typeorm';\nimport {source,NoteEntity,OwnerEntity,type Note} from './model.js';\nconst ds=source(process.env.LAB_SCHEMA??'typeorm_migrations');\nif(process.env.ADD_REVIEW_COLUMN==='1'){\n const extended=new EntitySchema<Note & {reviewedAt:Date|null}>({...NoteEntity.options,columns:{...NoteEntity.options.columns,reviewedAt:{type:'timestamptz',nullable:true}}});\n ds.setOptions({entities:[OwnerEntity,extended]});\n}\nds.setOptions({migrations:process.env.LAB_MIGRATIONS?[process.env.LAB_MIGRATIONS]:[],migrationsTableName:'migration_history'});\nexport default ds;\n",
          "language": "typescript",
          "filename": "examples/typeorm-migrations-performance/src/migration-source.ts",
          "purpose": "CLI DataSource入口；通过显式环境选择期望实体版本与迁移目录。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "migration-source 仅在 ADD_REVIEW_COLUMN=1 时给 Note 增加 nullable reviewedAt。这个分支是教学中的两个实体版本，实际项目通常由两次提交表达；它不是运行时按用户请求切换数据库结构。LAB_MIGRATIONS 指向本次临时生成的迁移文件，migration_history 保存在本篇 schema 中。"
        },
        {
          "type": "paragraph",
          "text": "synchronize 会尝试直接对齐元数据，适合可丢弃环境，却没有替你完成锁时长评估、旧版本兼容、数据回填、备份和恢复演练。生产变更通常采用扩展、迁移数据、切换读写、最后收缩的步骤。加一个可空列和删除一列，虽然都可能只有一句 ALTER TABLE，风险显然不同。"
        }
      ]
    },
    {
      "id": "generate",
      "title": "generate 只生成建议：先读 SQL，再决定能否执行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "测试先对空 schema 执行 migration:generate，再通过 migration:run 创建表。之后写入 tenant-a/alice 的 kept 笔记，切换到增加 reviewedAt 的实体版本，生成第二个迁移。CLI使用 -o --esm 直接生成ESM JavaScript，避免临时目录还需要另一轮TypeScript编译。时间戳固定，文件名稳定可追踪。"
        },
        {
          "type": "paragraph",
          "text": "第二个迁移实际包含 ADD reviewedAt TIMESTAMP WITH TIME ZONE，还出现 amount 默认值的文本正规化：从数据库读取的 0.00 被生成器写成字符串形式的默认。这个额外差异没有改变本例金额语义，但说明生成器给出的是“它观察到的差异”，不是“你这一业务需求必需的最小修改”。审阅时必须逐条理解，不能因为文件自动生成就直接批准。"
        },
        {
          "type": "paragraph",
          "text": "CLI run 后 reviewedAt 列存在且旧行值为 NULL；写入审核时间后执行 revert，列被删除、kept 笔记仍存在、迁移历史只剩Initial一条。注意，“笔记还在”和“所有数据恢复”不是一回事：reviewedAt里刚写过的审核时间已经随列删除。down表达结构回退，不是数据库时间机器。"
        },
        {
          "type": "code",
          "code": "import {test} from 'node:test';import assert from 'node:assert/strict';\nimport {spawnSync} from 'node:child_process';import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';\nimport {tmpdir} from 'node:os';import {join,resolve} from 'node:path';\nimport type {MigrationInterface,QueryRunner} from 'typeorm';\nimport {source,NoteEntity,SqlLog} from './model.js';\nconst schema='typeorm_migrations';\nfunction cli(args:string[],env:NodeJS.ProcessEnv={}){\n const r=spawnSync(process.execPath,['node_modules/typeorm/cli.js',...args,'-d','dist/migration-source.js'],{\n  env:{...process.env,LAB_SCHEMA:schema,...env},encoding:'utf8',timeout:20000});\n assert.equal(r.status,0,`${r.stdout}\\n${r.stderr}`);return r.stdout;\n}\nclass PartialDdl1761350400000 implements MigrationInterface{\n name='PartialDdl1761350400000';transaction=false;\n async up(q:QueryRunner){await q.query(`CREATE INDEX CONCURRENTLY partial_title_idx ON ${schema}.notes(title)`);await q.query('SELECT 1/0');}\n async down(q:QueryRunner){await q.query(`DROP INDEX IF EXISTS ${schema}.partial_title_idx`);}\n}\ntest('迁移的生成、演进、失败状态与计划',async t=>{\n const log=new SqlLog(),ds=source(schema,log);await ds.initialize();\n const generated=mkdtempSync(join(tmpdir(),'typeorm-generated-'));const migrationGlob=join(generated,'*.js');\n try{\n  await ds.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await ds.query(`CREATE SCHEMA ${schema}`);\n  await t.test('空库 generate/run；带数据 generate/run/revert并保留原笔记',async()=>{\n   const env={LAB_MIGRATIONS:migrationGlob};\n   cli(['migration:generate',join(generated,'Initial'),'-o','--esm','-t','1761350300000'],env);\n   const initial=readdirSync(generated).find(x=>x.includes('Initial'))!;\n   assert.match(readFileSync(join(generated,initial),'utf8'),/CREATE TABLE/);\n   cli(['migration:run'],env);\n   await ds.query(`INSERT INTO ${schema}.owners(\"tenantId\",id,name) VALUES('tenant-a','alice','Alice')`);\n   await ds.getRepository(NoteEntity).insert({tenantId:'tenant-a',ownerId:'alice',title:'kept'});\n   cli(['migration:generate',join(generated,'Review'),'-o','--esm','-t','1761350300001'],{...env,ADD_REVIEW_COLUMN:'1'});\n   const review=readdirSync(generated).find(x=>x.includes('Review'))!;\n   const sql=readFileSync(join(generated,review),'utf8');assert.match(sql,/ADD \"reviewedAt\"/);assert.match(sql,/DROP COLUMN \"reviewedAt\"/);\n   cli(['migration:run'],{...env,ADD_REVIEW_COLUMN:'1'});\n   assert.equal((await ds.query(`SELECT \"reviewedAt\" FROM ${schema}.notes`))[0].reviewedAt,null);\n   await ds.query(`UPDATE ${schema}.notes SET \"reviewedAt\"='2026-01-01Z'`);\n   cli(['migration:revert'],{...env,ADD_REVIEW_COLUMN:'1'});\n   assert.equal((await ds.getRepository(NoteEntity).findOneByOrFail({title:'kept'})).title,'kept');\n   assert.equal((await ds.query('SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',[schema,'notes','reviewedAt']))[0].n,0);\n   assert.equal((await ds.query(`SELECT count(*)::int AS n FROM ${schema}.migration_history`))[0].n,1);\n   console.log(JSON.stringify({generatedInitial:true,reviewMigration:sql,historyAfterRevert:1,baseNoteRetained:true,reviewedColumnDropped:true}));\n  });\n  await t.test('非事务DDL后失败：索引留下，历史未记录；显式修复',async()=>{\n   const partial=source(schema);partial.setOptions({migrations:[PartialDdl1761350400000],migrationsTableName:'partial_history',migrationsTransactionMode:'each'});\n   await partial.initialize();try{\n    await assert.rejects(partial.runMigrations(),e=>(e as {driverError:{code:string}}).driverError.code==='22012');\n    assert.equal((await ds.query('SELECT to_regclass($1) AS name',[`${schema}.partial_title_idx`]))[0].name,`${schema}.partial_title_idx`);\n    assert.equal((await ds.query(`SELECT count(*)::int AS n FROM ${schema}.partial_history`))[0].n,0);\n    const q=partial.createQueryRunner();try{await new PartialDdl1761350400000().down(q);}finally{await q.release();}\n    assert.equal((await ds.query('SELECT to_regclass($1) AS name',[`${schema}.partial_title_idx`]))[0].name,null);\n    console.log(JSON.stringify({failedSqlState:'22012',indexSurvivedFailure:true,historyRows:0,manualRecoveryRemovedIndex:true}));\n   }finally{await partial.destroy();}\n  });\n  await t.test('相同结果的EXPLAIN前后对照，不用查询数伪造提速',async()=>{\n   await ds.query(`INSERT INTO ${schema}.notes(\"tenantId\",\"ownerId\",title) SELECT 'tenant-a','alice','bulk-'||i FROM generate_series(1,20000) AS i`);\n   await ds.query(`INSERT INTO ${schema}.owners(\"tenantId\",id,name) VALUES('tenant-a','bob','Bob')`);\n   await ds.getRepository(NoteEntity).insert({tenantId:'tenant-a',ownerId:'bob',title:'rare-bob'});\n   await ds.query(`ANALYZE ${schema}.notes`);\n   const sql=`SELECT id,title FROM ${schema}.notes WHERE \"tenantId\"=$1 AND \"ownerId\"=$2 ORDER BY id LIMIT 10`;\n   const beforeRows=await ds.query(sql,['tenant-a','bob']);\n   const before=(await ds.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,['tenant-a','bob']))[0]['QUERY PLAN'][0];\n   await ds.query(`CREATE INDEX notes_owner_id_idx ON ${schema}.notes(\"tenantId\",\"ownerId\",id)`);await ds.query(`ANALYZE ${schema}.notes`);\n   const afterRows=await ds.query(sql,['tenant-a','bob']);\n   const after=(await ds.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,['tenant-a','bob']))[0]['QUERY PLAN'][0];\n   assert.deepEqual(afterRows,beforeRows);assert.equal(afterRows.length,1);assert.equal(afterRows[0].title,'rare-bob');\n   assert.ok(JSON.stringify(before).includes('Seq Scan'));assert.ok(JSON.stringify(after).includes('notes_owner_id_idx'));\n   console.log(JSON.stringify({inputRows:20002,resultRows:afterRows.length,beforePlan:before.Plan,afterPlan:after.Plan}));\n  });\n  await t.test('有界批写与事务池回收：每批100行，受控失败整批回滚',async()=>{\n   const rows=Array.from({length:250},(_,i)=>({tenantId:'tenant-a',ownerId:'alice',title:`batch-${i}`}));\n   for(let start=0;start<rows.length;start+=100)await ds.getRepository(NoteEntity).insert(rows.slice(start,start+100));\n   assert.equal((await ds.query(`SELECT count(*)::int AS n FROM ${schema}.notes WHERE title LIKE 'batch-%'`))[0].n,250);\n   await assert.rejects(ds.transaction(async m=>{await m.getRepository(NoteEntity).insert({tenantId:'tenant-a',ownerId:'alice',title:'batch-rollback'});throw new Error('rollback');}),/rollback/);\n   assert.equal(await ds.getRepository(NoteEntity).countBy({title:'batch-rollback'}),0);\n   const pids=await Promise.all(Array.from({length:12},()=>ds.query('SELECT pg_backend_pid() AS pid')));\n   assert.ok(new Set(pids.map(x=>x[0].pid)).size<=4);\n   console.log(JSON.stringify({batchRows:250,batchSizes:[100,100,50],rollbackRows:0,poolMax:4,observedPids:new Set(pids.map(x=>x[0].pid)).size}));\n  });\n }finally{try{await ds.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}finally{try{await ds.destroy();}finally{rmSync(generated,{recursive:true,force:true});}}}\n assert.equal(ds.isInitialized,false);\n});\n",
          "language": "typescript",
          "filename": "examples/typeorm-migrations-performance/src/lab.test.ts",
          "purpose": "完整可运行迁移实验：包括真实 CLI generate/run/revert、非事务失败、EXPLAIN与有界批写；没有用模拟调用代替数据库执行。",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "transactional-ddl",
      "title": "DDL 失败后为什么不能只看迁移历史",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "PostgreSQL 很多 DDL 可以放在事务里，但 CREATE INDEX CONCURRENTLY 不能在事务块中执行。示例的 PartialDdl 迁移明确 transaction=false，并将执行模式设为 each，允许这条迁移单独退出事务包裹。它先成功创建 concurrent index，接着执行 SELECT1/0，触发22012。这里故障位置是可控的，因此可以准确判断哪些语句已经成功。"
        },
        {
          "type": "paragraph",
          "text": "结果不是“迁移失败，所以什么都没发生”。索引partial_title_idx实际存在，partial_history却没有已完成记录。只有整个up成功后才写完成历史；非事务执行中较早成功的DDL不会因为后续错误自动撤销。若直接重跑，可能撞到已经存在的对象；若直接revert，历史中又没有这条迁移可退。"
        },
        {
          "type": "paragraph",
          "text": "恢复过程先读 to_regclass 与历史表，确认残留，再明确调用已审阅的 down 删除本例索引，并再次确认 to_regclass 为 NULL。真实系统不能仅凭对象同名就DROP：还应检查定义、有效性、创建来源以及是否被其他版本使用。CREATE INDEX CONCURRENTLY 自己失败时还可能留下无效索引，本例是在它成功之后故意失败，不能把两类状态混为一谈。"
        },
        {
          "type": "figure",
          "src": "figures/typeorm-migrations-performance/mechanism.svg",
          "title": "非事务 DDL 失败前后：索引与历史是两份状态",
          "alt": "CREATE INDEX CONCURRENTLY成功后index存在/history0；后续22012失败后index仍在/history0；检查残留再显式down，index不存在/history仍0。这里失败发生在索引已经创建成功之后，不是索引构建自身失败。",
          "caption": "CREATE INDEX CONCURRENTLY成功后index存在/history0；后续22012失败后index仍在/history0；检查残留再显式down，index不存在/history仍0。这里失败发生在索引已经创建成功之后，不是索引构建自身失败。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：并发建立索引的事务和失败边界",
          "url": "https://www.postgresql.org/docs/17/sql-createindex.html"
        }
      ]
    },
    {
      "id": "plans",
      "title": "索引验证：先保持结果，再比较访问路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第二篇统计了N+1查询数量，但减少SQL条数并不自动等于减少数据库工作。这里向同一表写入20000条alice笔记，再加一条bob稀有笔记，总量20002。业务查询限定tenant-a和bob，按id取前十条。加索引前后，SQL、参数、ORDER BY和返回列完全相同，先断言结果逐行相同且是rare-bob，再解释计划。"
        },
        {
          "type": "paragraph",
          "text": "索引是(tenantId,ownerId,id)：前两列等值收窄租户与用户，最后一列承接排序。没有它时，本次真实计划包含Seq Scan与Sort；建索引、ANALYZE后计划访问notes_owner_id_idx。EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)实际运行查询，输出实际行数、过滤行数和页命中等数据，不只是优化器估价。"
        },
        {
          "type": "paragraph",
          "text": "我们没有关闭enable_seqscan来强迫数据库接受结论，也没有只截取最好的一次耗时。这个夹具的bob极少，索引选择与它的分布有关。生产热点用户匹配大多数行时，优化器可能选择别的计划；必须带着实际分布重查。单次暖缓存实验不足以给出稳定提速倍数，因此正文只承诺计划与结果变化，不发布吞吐收益。"
        },
        {
          "type": "paragraph",
          "text": "EXPLAIN ANALYZE会真的执行语句，观察UPDATE或DELETE时要特别注意事务与回滚，不能把它当成无副作用的预览。本篇只对SELECT执行它。生产观测还要把池排队、网络传输、对象恢复与序列化纳入请求耗时，数据库执行时间只是其中一段。"
        }
      ]
    },
    {
      "id": "batching",
      "title": "批处理控制工作量，池上限控制同时拥有的资源",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "批处理不是把所有记录塞进Promise.all。它首先规定一次SQL或一次事务处理多少数据，减少无限参数、内存和锁持有时间。这里250条笔记分成100、100、50三次insert，每次等待完成再推进；使用的是直接批量INSERT，不额外触发每个实体save的查询判断。"
        },
        {
          "type": "paragraph",
          "text": "这三批按当前实现分别提交，因此第三批失败时前两批已经存在。若业务要求全有或全无，应放进显式事务，同时接受更长事务的成本。测试另加受控异常事务，确认batch-rollback没有留下记录，避免把“分批成功”和“整批原子”混成一个宣传。去重、恢复检查点与断点续传又是不同协议，不能只靠批次大小解决。"
        },
        {
          "type": "paragraph",
          "text": "连接池max=4限制的是本进程最多借用多少数据库连接，不限制请求队列长度。实验同时发12个很短的PID查询，观察到的后端PID不超过4；这只是本次上限证据，不是12请求生产压测。若每个实例都配置4条连接，部署10个实例，数据库面对的潜在总量还要乘上实例数，并计入迁移、管理与其他服务。"
        },
        {
          "type": "paragraph",
          "text": "finally先清理自己的schema，再保证destroy关闭池，最后移除临时生成的迁移文件；外层运行器再停止自己创建的PG进程。这些收尾发生在正常与异常路径。长期服务应该先停止接新请求、等待或取消在途业务，再关池，不能把CLI退出方式照抄成HTTP每请求初始化/销毁。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "复现记录、限制与系列回顾",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "从ZIP运行npm ci后，PG_BIN=/Library/PostgreSQL/17/bin npm test会依次执行CLI和真实PG测试。作者实际使用PG_PORT=55485避免与并行审校争用；5/5通过、0跳过。最初新增列的EntitySchema泛型没有包含reviewedAt导致编译失败，补充扩展类型后重跑通过；没有通过关闭strict绕开。"
        },
        {
          "type": "paragraph",
          "text": "验收包括空库生成与执行、带数据新增与revert、非事务故障后的真实索引和历史、显式恢复、20002行相同结果的计划前后对照、250行分批写和连接上限。MySQL DDL、生产锁窗口、备份恢复和跨版本灰度没有验证。离线包保存的是源码与锁文件；第一次安装依赖仍需要npm网络或预备缓存。"
        },
        {
          "type": "paragraph",
          "text": "四篇主线现在连起来了：Entity映射对象和列，Repository组织SQL；关系查询改变行与实体的形状；事务和锁约束并发写入；迁移负责已有数据的结构演进。进入Nest集成时，框架会提供模块注册与依赖注入，但这里验证过的SQL、连接归属与精度规则仍然成立。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "TypeORM：迁移文档",
      "url": "https://typeorm.io/docs/migrations/why/"
    },
    {
      "title": "PostgreSQL 17：CREATE INDEX",
      "url": "https://www.postgresql.org/docs/17/sql-createindex.html"
    },
    {
      "title": "PostgreSQL 17：EXPLAIN",
      "url": "https://www.postgresql.org/docs/17/using-explain.html"
    }
  ]
};
export default article;
