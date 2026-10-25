import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "typeorm-transactions-concurrency",
  "topic": "data",
  "title": "事务与并发：事务 manager、QueryRunner、锁与幂等",
  "description": "用两个真实连接证明事务归属、版本条件和行锁等待，再把唯一键与事务组合成幂等写入。",
  "minutes": 46,
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
      "path": "typeorm-transactions-concurrency.zip"
    },
    {
      "label": "安装、运行与实际输出",
      "path": "typeorm-transactions-concurrency/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "事务是什么：同一连接上的提交边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "事务把一组数据库操作放进同一个提交边界。操作全部成功才提交；中途失败时回滚已经做过的事务内修改。TypeORM 的 transaction 回调提供一个专属 EntityManager，让其中的 SQL 使用这次事务的连接。这里的关键是“使用这次连接”，不是“代码在同一个花括号里”。JavaScript 的调用层级并不会自动让任意 Repository 加入事务。"
        },
        {
          "type": "paragraph",
          "text": "本文继续使用四条笔记，先验证两条修改能否一起回滚，再处理两名调用方同时改同一条笔记的竞争，最后给重复创建加幂等入口。看完后，你应能选择条件更新或行锁，判断一个 Repository 是否归属当前事务，并明确重复请求、事务冲突与网络超时分别应该怎样处理。前提是已经理解 SQL 的 COMMIT、ROLLBACK 和第一篇的池连接。"
        },
        {
          "type": "paragraph",
          "text": "示例固定 PostgreSQL 17.4 的 READ COMMITTED。它每条语句取得适用的可见性视图，并不保证连续两次读取永远相同。REPEATABLE READ、SERIALIZABLE 和其他产品需要重新讨论快照、重试与锁语义；本文不把 TypeORM 的字符串参数当作跨数据库完全等价的保证。"
        }
      ]
    },
    {
      "id": "manager",
      "title": "manager 的归属比方法名更重要",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "全局 Repository 从 DataSource 的普通 manager 取得连接；事务回调里的 manager 则关联当前 QueryRunner。在回调中，必须使用 manager.getRepository(NoteEntity) 或 manager.update，而不是继续用文件顶部缓存的 globalRepo。混用全局对象可能借到另一条池连接，并以自动提交模式独立写入。"
        },
        {
          "type": "paragraph",
          "text": "为了避免把锁等待混进反例，我们分别修改两条笔记：事务 manager 把 Alpha 的 body 改为 rolled-back，全局 Repository 把 Beta 改为 escaped，然后故意抛错。SELECT pg_backend_pid() 证实两次调用的后端 PID 不同。回调回滚后，Alpha 恢复 NULL，Beta 保持 escaped。它不是 PostgreSQL 回滚失效，而是 Beta 从未加入这次事务。"
        },
        {
          "type": "figure",
          "src": "figures/typeorm-transactions-concurrency/mechanism.svg",
          "title": "同一个回调里的两种连接归属",
          "alt": "这是错误示范的因果链：Alpha使用事务连接，Beta使用全局池另一连接；抛错只回滚前者。",
          "caption": "这是错误示范的因果链：Alpha使用事务连接，Beta使用全局池另一连接；抛错只回滚前者。"
        },
        {
          "type": "paragraph",
          "text": "第二段修复路径把两条修改都交给回调 manager，然后故意抛错，确认两条都回到原值。注意此时 Beta 的“原值”已经是反例留下的 escaped，所以断言不能错误地期待它回到最初的 text。实验把每一步的初始状态写明，避免把顺序测试结果当成随机现象。"
        }
      ]
    },
    {
      "id": "runner",
      "title": "QueryRunner：显式拥有连接，也显式释放",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "当你需要手动控制开始、提交、回滚时，可以创建 QueryRunner，connect 后 startTransaction，再通过 runner.manager 操作实体。它将连接从池中借出；release 将连接归还，不是删除数据库行。一个应用同时借走所有连接后，后续调用会排队或超时，所以“finally 忘了 release”会表现为运行一段时间后接口突然卡住。"
        },
        {
          "type": "paragraph",
          "text": "下面的 closeRunner 先检查是否仍有活动事务，必要时回滚，最终 release。外层又用嵌套 finally 关闭两名参与者，防止前一人的关闭异常跳过后一人。已 release 的 runner 再 query 会被拒绝。DataSource.destroy 最后关闭整个池，不能用它替代每个 runner 的及时归还。"
        },
        {
          "type": "code",
          "code": "import 'reflect-metadata';\nimport { DataSource, EntitySchema, type Logger } from 'typeorm';\nexport interface Owner { tenantId: string; id: string; name: string; notes?: Note[] }\nexport interface Note { id: number; tenantId: string; ownerId: string; title: string; body: string | null; amount: string; createdAt: Date; version: number; owner?: Owner }\nexport const OwnerEntity = new EntitySchema<Owner>({ name: 'Owner', tableName: 'owners', columns: {\n  tenantId: { type: String, primary: true }, id: { type: String, primary: true }, name: { type: String }\n}, relations: { notes: { type: 'one-to-many', target: 'Note', inverseSide: 'owner' } } });\nexport const NoteEntity = new EntitySchema<Note>({ name: 'Note', tableName: 'notes', columns: {\n  id: { type: Number, primary: true, generated: true }, tenantId: { type: String }, ownerId: { type: String },\n  title: { type: String }, body: { type: String, nullable: true, default: null },\n  amount: { type: 'numeric', precision: 20, scale: 2, default: '0.00' },\n  createdAt: { type: 'timestamptz', precision: 6, default: () => 'CURRENT_TIMESTAMP' },\n  version: { type: Number, default: 1 }\n}, uniques: [{ columns: ['tenantId', 'title'] }], relations: { owner: {\n  type: 'many-to-one', target: 'Owner', inverseSide: 'notes', nullable: false,\n  joinColumn: [{ name: 'tenantId', referencedColumnName: 'tenantId' }, { name: 'ownerId', referencedColumnName: 'id' }]\n} } });\nexport class SqlLog implements Logger {\n  queries: { sql: string; parameters?: unknown[] }[] = [];\n  logQuery(sql: string, parameters?: unknown[]) { this.queries.push({ sql, parameters }); }\n  logQueryError() {} logQuerySlow() {} logSchemaBuild() {} logMigration() {} log() {}\n  reset() { this.queries = []; }\n  selects() { return this.queries.filter(x => /^SELECT/.test(x.sql)).length; }\n}\nexport function source(schema: string, logger = new SqlLog()) {\n  return new DataSource({ type: 'postgres', url: process.env.DATABASE_URL ?? 'postgres://127.0.0.1:55483/typeorm_content',\n    schema, entities: [OwnerEntity, NoteEntity], synchronize: false, logging: ['query'], logger,\n    extra: { max: 4, connectionTimeoutMillis: 1500 },\n    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' } });\n}\nexport async function seed(ds: DataSource) {\n  await ds.getRepository(OwnerEntity).insert([{ tenantId: 'tenant-a', id: 'alice', name: 'Alice' }, { tenantId: 'tenant-a', id: 'bob', name: 'Bob' }, { tenantId: 'tenant-b', id: 'bob', name: 'Bob B' }]);\n  await ds.getRepository(NoteEntity).insert([\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Alpha', amount: '9007199254740993.10' },\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Beta', body: 'text' },\n    { tenantId: 'tenant-a', ownerId: 'bob', title: 'Gamma' },\n    { tenantId: 'tenant-b', ownerId: 'bob', title: 'Private' }\n  ]);\n}\n",
          "language": "typescript",
          "filename": "examples/typeorm-transactions-concurrency/src/model.ts",
          "purpose": "完整实体与池配置；max=4给两个竞争连接和独立观察连接留下容量。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这里池上限四条，不是生产推荐值。两个业务事务加一个观察查询就需要至少三条可借连接；如果把池改成两条，再用同池查询阻塞状态，观察本身可能等待连接。调试时也要认识观测工具的资源成本，不能把“观察超时”直接当作数据库没有锁。"
        },
        {
          "type": "reference",
          "title": "TypeORM 官方：QueryRunner 与连接释放",
          "url": "https://typeorm.io/docs/query-runner/"
        }
      ]
    },
    {
      "id": "version",
      "title": "乐观检查：比较必须发生在 UPDATE 的条件里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "乐观并发控制的想法是：先读取版本，再在写入时要求版本仍等于自己读到的值。不能先在 JavaScript 比较相等，再不带版本条件地 UPDATE，因为比较与写入之间仍能插入竞争者。真正的原子性来自数据库在同一条语句里检查条件并写入。"
        },
        {
          "type": "paragraph",
          "text": "本模型的 version 是普通整数列，没有暗示 @VersionColumn 或 save 自动拒绝旧对象。两个调用方都先持有 version=1，随后同时执行 UPDATE，WHERE 同时包含 id、tenantId、version；成功者把 version 加一。结果 affected 排序为 [0,1]，最终版本2。测试不仅看最后结果，也检查实际日志中的 WHERE 和绑定参数，避免实现已经丢掉条件却靠运行时机碰巧通过。"
        },
        {
          "type": "paragraph",
          "text": "affected=0 可以映射为冲突或不存在，具体策略取决于是否允许进一步读取资源状态。不能为了重试方便就把旧标题覆盖到新版本；通常要让调用者读取新值并重新合并。对于只做自增的计数，可以直接使用原子算术 UPDATE，不一定需要先读再写的版本协议。"
        }
      ]
    },
    {
      "id": "locking",
      "title": "悲观锁：先拥有修改资格，再计算下一步",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "pessimistic_write 在这里生成 PostgreSQL 的 FOR UPDATE。事务一先锁定 Gamma 并修改 body=after-lock，事务二对同一行申请锁。我们不睡固定毫秒再猜它是否阻塞，而是通过第三条连接查询 pg_blocking_pids，明确看到事务二的 PID 被事务一阻塞，才允许事务一提交。事务二随后取得锁并读到 after-lock，再提交。"
        },
        {
          "type": "paragraph",
          "text": "这个实验说明数据库确实参与协调，不是前端按钮禁用或 Node 单线程让操作自动排队。锁持有时间包括事务中所有等待，如果拿锁后调用慢外部服务，会把数据库连接和行锁一起占住。通常应把可预先完成的计算放到事务外，并缩小锁定的记录范围。多个资源按统一顺序加锁，有助于减少死锁，但仍需处理数据库报出的死锁或序列化失败。"
        },
        {
          "type": "paragraph",
          "text": "本例只验证同一行的等待与释放，不声称覆盖全部锁模式、死锁检测或 MySQL 间隙锁。测试对等待观测设置四秒上限，并用 setImmediate 让出执行，不用延迟猜测保证正确性。超时代表实验没有观察到期望阻塞，应检查事务、PID、查询条件和池容量，不应该直接删掉断言。"
        }
      ]
    },
    {
      "id": "idempotency",
      "title": "幂等写入：唯一键让竞争汇合，事务让结果一起落盘",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "幂等入口解决的是同一个业务请求重复到达时，不能重复创建笔记。它与普通“内容相同不再写”不同：两次合法创建可以内容相同，却使用不同幂等键。这里的键是 tenant+key，并记录请求内容 hash 和已创建 noteId。真实系统应对规范化请求计算摘要；示例使用固定 body-hash-1，避免把哈希算法实现混进连接实验。"
        },
        {
          "type": "paragraph",
          "text": "事务一先插入幂等记录，再创建笔记、填写结果 ID，最后提交。事务二用同样唯一键 INSERT ON CONFLICT DO NOTHING，会等待未提交唯一键的决定。观测到阻塞后事务一提交，事务二得到零条 RETURNING 行，读取已保存的 hash 和 noteId，返回同一个结果。最终只存在一条 idempotent-note。"
        },
        {
          "type": "paragraph",
          "text": "同一个键但不同 hash 必须拒绝，而不是悄悄把第二个请求当作成功。幂等记录与业务行若分开提交，可能出现记录已占位但笔记没保存，或笔记保存了但找不到重放结果。本文通过同事务避免这一窗口；外部支付、邮件等副作用仍需要各自的幂等协议或 Outbox，不能被本地数据库事务回滚。"
        },
        {
          "type": "code",
          "code": "import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {setImmediate} from 'node:timers/promises';\nimport type {DataSource, QueryRunner} from 'typeorm';\nimport {source,seed,NoteEntity,SqlLog} from './model.js';\nasync function waitBlocked(ds:DataSource,pid:number,blocker:number){\n const deadline=Date.now()+4000;\n while(Date.now()<deadline){\n  const [row]=await ds.query('SELECT $2::int=ANY(pg_blocking_pids($1::int)) AS blocked',[pid,blocker]);\n  if(row.blocked)return;\n  await setImmediate();\n }\n throw new Error('expected PostgreSQL lock dependency was not observed');\n}\nasync function closeRunner(r:QueryRunner){try{if(r.isTransactionActive)await r.rollbackTransaction();}finally{await r.release();}}\ntest('事务连接归属、条件版本、锁与幂等',async t=>{\n const log=new SqlLog();const ds=source('typeorm_transactions',log);await ds.initialize();\n try{\n  await ds.query('DROP SCHEMA IF EXISTS typeorm_transactions CASCADE');await ds.query('CREATE SCHEMA typeorm_transactions');await ds.synchronize();await seed(ds);\n  const globalRepo=ds.getRepository(NoteEntity);\n  await t.test('混用全局Repository逃出回滚；事务manager自己的变更回滚',async()=>{\n   let txPid=0,globalPid=0;\n   await assert.rejects(ds.transaction(async manager=>{\n    txPid=(await manager.query('SELECT pg_backend_pid() AS pid'))[0].pid;\n    globalPid=(await ds.query('SELECT pg_backend_pid() AS pid'))[0].pid;\n    await manager.update(NoteEntity,{id:1},{body:'rolled-back'});\n    await globalRepo.update({id:2},{body:'escaped'});\n    throw new Error('rollback-now');\n   }),/rollback-now/);\n   assert.notEqual(txPid,globalPid);\n   assert.equal((await globalRepo.findOneByOrFail({id:1})).body,null);\n   assert.equal((await globalRepo.findOneByOrFail({id:2})).body,'escaped');\n   await assert.rejects(ds.transaction(async manager=>{\n    await manager.update(NoteEntity,{id:1},{body:'not-saved'});\n    await manager.update(NoteEntity,{id:2},{body:'also-not-saved'});throw new Error('both-rollback');\n   }),/both-rollback/);\n   assert.equal((await globalRepo.findOneByOrFail({id:2})).body,'escaped');\n   console.log(JSON.stringify({txPidDiffers:txPid!==globalPid,rollbackBody:null,escapedBody:'escaped'}));\n  });\n  await t.test('真正的乐观检查是SQL条件版本，两个已读版本只有一个成功',async()=>{\n   const before=await globalRepo.findOneByOrFail({id:1});const expectedA=before.version,expectedB=before.version;\n   log.reset();\n   const change=(expected:number,title:string)=>globalRepo.createQueryBuilder().update(NoteEntity).set({title,version:()=> '\"version\" + 1'})\n    .where('id=:id AND \"tenantId\"=:tenant AND version=:expected',{id:1,tenant:'tenant-a',expected}).execute();\n   const results=await Promise.all([change(expectedA,'winner-a'),change(expectedB,'winner-b')]);\n   assert.deepEqual(results.map(x=>x.affected).sort(),[0,1]);\n   assert.equal((await globalRepo.findOneByOrFail({id:1})).version,2);\n   const writes=log.queries.filter(x=>x.sql.startsWith('UPDATE'));assert.equal(writes.length,2);\n   assert.ok(writes.every(x=>/WHERE.*version\"?\\s*=/.test(x.sql) && x.parameters?.includes(expectedA)));\n   console.log(JSON.stringify({conditionalSql:writes[0]}));\n   console.log(JSON.stringify({conditionalUpdates:results.map(x=>x.affected).sort(),version:2}));\n  });\n  await t.test('pessimistic_write确实等待：观测数据库阻塞边，再提交释放',async()=>{\n   const first=ds.createQueryRunner(),second=ds.createQueryRunner();\n   try{\n    await first.connect();await second.connect();await first.startTransaction('READ COMMITTED');await second.startTransaction('READ COMMITTED');\n    const pid1=(await first.query('SELECT pg_backend_pid() AS pid'))[0].pid,pid2=(await second.query('SELECT pg_backend_pid() AS pid'))[0].pid;\n    await first.manager.getRepository(NoteEntity).createQueryBuilder('n').where('n.id=:id',{id:3}).setLock('pessimistic_write').getOneOrFail();\n    await first.manager.update(NoteEntity,{id:3},{body:'after-lock'});\n    const pending=second.manager.getRepository(NoteEntity).createQueryBuilder('n').where('n.id=:id',{id:3}).setLock('pessimistic_write').getOneOrFail();\n    await waitBlocked(ds,pid2,pid1);await first.commitTransaction();\n    assert.equal((await pending).body,'after-lock');await second.commitTransaction();\n    console.log(JSON.stringify({lockDependencyObserved:true,secondRead:'after-lock'}));\n   }finally{try{await closeRunner(first);}finally{await closeRunner(second);}}\n   assert.equal(first.isReleased,true);assert.equal(second.isReleased,true);await assert.rejects(first.query('SELECT 1'));\n  });\n  await t.test('同一租户幂等键并发：唯一键等待后返回同一个结果，异请求体拒绝',async()=>{\n   await ds.query('CREATE TABLE typeorm_transactions.requests(tenant text NOT NULL,key text NOT NULL,hash text NOT NULL,\"noteId\" int,PRIMARY KEY(tenant,key))');\n   const first=ds.createQueryRunner(),second=ds.createQueryRunner();\n   try{\n    await first.connect();await second.connect();await first.startTransaction();await second.startTransaction();\n    const pid1=(await first.query('SELECT pg_backend_pid() AS pid'))[0].pid,pid2=(await second.query('SELECT pg_backend_pid() AS pid'))[0].pid;\n    const sql='INSERT INTO typeorm_transactions.requests(tenant,key,hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key';\n    assert.equal((await first.query(sql,['tenant-a','create-1','body-hash-1'])).length,1);\n    const note=await first.manager.getRepository(NoteEntity).save({tenantId:'tenant-a',ownerId:'alice',title:'idempotent-note'});\n    await first.query('UPDATE typeorm_transactions.requests SET \"noteId\"=$1 WHERE tenant=$2 AND key=$3',[note.id,'tenant-a','create-1']);\n    const pending=second.query(sql,['tenant-a','create-1','body-hash-1']);\n    await waitBlocked(ds,pid2,pid1);await first.commitTransaction();assert.equal((await pending).length,0);\n    const [stored]=await second.query('SELECT hash,\"noteId\" FROM typeorm_transactions.requests WHERE tenant=$1 AND key=$2',['tenant-a','create-1']);\n    assert.equal(stored.hash,'body-hash-1');assert.equal(stored.noteId,note.id);await second.commitTransaction();\n    assert.equal(await globalRepo.countBy({title:'idempotent-note'}),1);\n    const replay=async(hash:string)=>{if(hash!==stored.hash)throw new Error('IDEMPOTENCY_CONFLICT');return stored.noteId as number;};\n    assert.equal(await replay('body-hash-1'),note.id);await assert.rejects(replay('changed-body'),/IDEMPOTENCY_CONFLICT/);\n    console.log(JSON.stringify({duplicateNoteCount:1,sharedResultId:note.id,differentPayload:'IDEMPOTENCY_CONFLICT'}));\n   }finally{try{await closeRunner(first);}finally{await closeRunner(second);}}\n  });\n }finally{try{await ds.query('DROP SCHEMA IF EXISTS typeorm_transactions CASCADE');}finally{await ds.destroy();}}\n});\n",
          "language": "typescript",
          "filename": "examples/typeorm-transactions-concurrency/src/lab.test.ts",
          "purpose": "完整事务、反例、两个连接、数据库阻塞观察、条件版本和幂等测试；代码包含所有决定结果的调用。",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "unknown-commit",
      "title": "超时之后，先确认你知道什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果 COMMIT 已到数据库，但响应在网络中丢失，调用方只看到超时，无法仅凭这个超时判断事务提交还是回滚。再次执行普通 INSERT 可能重复，反向补偿也可能取消一次根本没有完成的操作。幂等键让重试有一个稳定的查询与重放身份，但必须保证保存期限和业务重复窗口一致。"
        },
        {
          "type": "paragraph",
          "text": "本篇没有通过断网注入复现“提交结果未知”，因此只解释协议边界，不把连接拒绝或人工抛错冒充这类证据。自动重试也不能把所有错误一视同仁：唯一约束冲突、权限拒绝、序列化失败和未知提交分别需要不同判断。重试必须有预算，事务回调还要避免无法重复的外部副作用。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "如何复现与读懂结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "独立 ZIP 的 npm ci 与 npm test 会创建私有临时 PostgreSQL；默认端口55483，PG_BIN可覆盖。作者为避免与主审并行争用，用 PG_PORT=55485 执行同一命令。真实 5/5 通过、0 跳过，日志给出 PID不同、escaped保留、版本[0,1]、实际锁依赖、重复笔记数1以及异payload冲突。"
        },
        {
          "type": "paragraph",
          "text": "最初 SQL 日志断言把未加引号的文本当成固定格式，实际生成了带双引号的列名，断言失败；修正为核对真正的 WHERE版本条件和绑定参数后全部通过。这里没有改变 SQL 行为来迎合断言。下篇在相同模型上讨论更长的生命周期：实体变化怎样迁移到已有数据库，以及一个迁移失败后为什么可能留下真实对象。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "TypeORM：QueryRunner",
      "url": "https://typeorm.io/docs/query-runner/"
    },
    {
      "title": "PostgreSQL 17：行锁与死锁",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
    },
    {
      "title": "PostgreSQL 17：事务隔离",
      "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
    }
  ]
};
export default article;
