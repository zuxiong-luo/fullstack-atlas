import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "typeorm-foundations",
  "topic": "data",
  "title": "TypeORM 基础：Entity、DataSource、Repository 与 SQL",
  "description": "先把对象映射、连接池与数据库约束分清，再用真实 SQL 验证 CRUD、返回值和 1.x 空条件边界。",
  "minutes": 40,
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
      "path": "typeorm-foundations.zip"
    },
    {
      "label": "安装、运行与实际输出",
      "path": "typeorm-foundations/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "ORM 是什么：对象操作到 SQL 的映射层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TypeORM 是运行在应用进程中的数据访问库。你用对象描述实体，用 Repository 表达读取或写入意图，它根据数据库驱动生成 SQL，再把数据库返回的行转换为 JavaScript 对象。ORM 没有接管 PostgreSQL 的约束检查、隔离级别或锁管理；这些仍由数据库执行。理解这条边界，才不会因为 TypeScript 编译通过，就以为数据库一定接受输入。"
        },
        {
          "type": "paragraph",
          "text": "本系列用一个租户笔记模型贯穿四篇。tenant-a 有 alice 和 bob，tenant-b 只有 bob；每条 Note 保存租户、所属用户、标题、正文、金额、创建时间和版本号。四条初始笔记分别是 Alpha、Beta、Gamma、Private。它们只是固定实验数据，不代表已经实现了登录系统。本文先让你能解释一次 CRUD 产生了什么 SQL，后面才引入关系查询、并发和迁移。"
        },
        {
          "type": "paragraph",
          "text": "Entity 是数据库表的对象映射定义，不是 HTTP DTO。DTO 处理输入边界，Entity 处理持久化结构；把请求体直接传给 save，会把允许客户端修改哪些字段的问题藏起来。本文在调用中逐个写出字段，租户与用户以后应来自可信身份上下文，不能相信客户端自报。"
        },
        {
          "type": "figure",
          "src": "figures/typeorm-foundations/mechanism.svg",
          "title": "对象、SQL 与约束的责任边界",
          "alt": "从左到右看：元数据说明如何映射，Repository 组织调用，PostgreSQL 最终判断约束与执行结果。",
          "caption": "从左到右看：元数据说明如何映射，Repository 组织调用，PostgreSQL 最终判断约束与执行结果。"
        }
      ]
    },
    {
      "id": "structure",
      "title": "先认识三种对象：Entity、DataSource 和 Repository",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "DataSource 保存驱动、连接选项和实体元数据；initialize 建立可用的数据访问环境。PostgreSQL 下它管理连接池，并不是每个 DataSource 永远只有一条连接。Repository 绑定某个实体及一个 EntityManager；manager 可以操作多种实体。普通全局 manager 按需要借连接，事务专属 manager 才有明确的事务连接归属。第三篇会用失败反例把差别验证出来。"
        },
        {
          "type": "paragraph",
          "text": "这里选择 EntitySchema，而不是装饰器。两者都通过 TypeORM 元数据描述映射；EntitySchema 让本篇只依赖普通 TypeScript 编译，不把 reflect-metadata、装饰器变换顺序混进 SQL 教学。你以后换成 @Entity、@Column，也必须保留相同的数据库类型、约束和关系。下面这份完整模型也包含下一篇会用到的关系；先关注 columns、uniques、source 和 seed，关系方向下一篇展开。"
        },
        {
          "type": "code",
          "code": "import 'reflect-metadata';\nimport { DataSource, EntitySchema, type Logger } from 'typeorm';\nexport interface Owner { tenantId: string; id: string; name: string; notes?: Note[] }\nexport interface Note { id: number; tenantId: string; ownerId: string; title: string; body: string | null; amount: string; createdAt: Date; version: number; owner?: Owner }\nexport const OwnerEntity = new EntitySchema<Owner>({ name: 'Owner', tableName: 'owners', columns: {\n  tenantId: { type: String, primary: true }, id: { type: String, primary: true }, name: { type: String }\n}, relations: { notes: { type: 'one-to-many', target: 'Note', inverseSide: 'owner' } } });\nexport const NoteEntity = new EntitySchema<Note>({ name: 'Note', tableName: 'notes', columns: {\n  id: { type: Number, primary: true, generated: true }, tenantId: { type: String }, ownerId: { type: String },\n  title: { type: String }, body: { type: String, nullable: true, default: null },\n  amount: { type: 'numeric', precision: 20, scale: 2, default: '0.00' },\n  createdAt: { type: 'timestamptz', precision: 6, default: () => 'CURRENT_TIMESTAMP' },\n  version: { type: Number, default: 1 }\n}, uniques: [{ columns: ['tenantId', 'title'] }], relations: { owner: {\n  type: 'many-to-one', target: 'Owner', inverseSide: 'notes', nullable: false,\n  joinColumn: [{ name: 'tenantId', referencedColumnName: 'tenantId' }, { name: 'ownerId', referencedColumnName: 'id' }]\n} } });\nexport class SqlLog implements Logger {\n  queries: { sql: string; parameters?: unknown[] }[] = [];\n  logQuery(sql: string, parameters?: unknown[]) { this.queries.push({ sql, parameters }); }\n  logQueryError() {} logQuerySlow() {} logSchemaBuild() {} logMigration() {} log() {}\n  reset() { this.queries = []; }\n  selects() { return this.queries.filter(x => /^SELECT/.test(x.sql)).length; }\n}\nexport function source(schema: string, logger = new SqlLog()) {\n  return new DataSource({ type: 'postgres', url: process.env.DATABASE_URL ?? 'postgres://127.0.0.1:55483/typeorm_content',\n    schema, entities: [OwnerEntity, NoteEntity], synchronize: false, logging: ['query'], logger,\n    extra: { max: 4, connectionTimeoutMillis: 1500 },\n    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' } });\n}\nexport async function seed(ds: DataSource) {\n  await ds.getRepository(OwnerEntity).insert([{ tenantId: 'tenant-a', id: 'alice', name: 'Alice' }, { tenantId: 'tenant-a', id: 'bob', name: 'Bob' }, { tenantId: 'tenant-b', id: 'bob', name: 'Bob B' }]);\n  await ds.getRepository(NoteEntity).insert([\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Alpha', amount: '9007199254740993.10' },\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Beta', body: 'text' },\n    { tenantId: 'tenant-a', ownerId: 'bob', title: 'Gamma' },\n    { tenantId: 'tenant-b', ownerId: 'bob', title: 'Private' }\n  ]);\n}\n",
          "language": "typescript",
          "filename": "examples/typeorm-foundations/src/model.ts",
          "purpose": "完整模型、连接配置与四行种子数据；本篇不是 Nest 注入示例。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Note.id 是数据库生成的整数主键。tenantId 与 title 的组合唯一，所以不同租户能使用同名标题，同一租户不能重复。body 可空且默认 NULL；amount 为 numeric(20,2)，在应用侧保留字符串。createdAt 保存 PostgreSQL 微秒精度时间，应用 Date 却只有毫秒精度；本篇只展示映射，下一篇专门验证分页时会出什么问题。version 此时是普通整数列，并没有自动提供并发冲突检测。"
        }
      ]
    },
    {
      "id": "columns",
      "title": "NULL、default 与 TypeScript 可选字段各管什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "nullable 决定数据库是否允许 SQL NULL；default 决定 INSERT 没有给出列值时数据库可以填什么。它们与 TypeScript 的 ?、undefined、联合类型不是一回事。数据库不会读取接口定义，HTTP JSON 也不会保留 undefined。省略 body 后数据库填 NULL，省略 amount 后填 0.00，这是实际 INSERT 后再查询得到的值，不是 TypeScript 自动赋值。"
        },
        {
          "type": "paragraph",
          "text": "更新时，undefined 常被当成“没有提供这个修改”，null 则明确表达写入 SQL NULL，前提是列允许为空。过滤条件的 null/undefined 又是另一套规则，不能拿更新字段行为推断 where 行为。业务上应先把 PATCH 的“未出现”与“显式清空”区分清楚，拒绝对非空字段清空，而不是依赖异常消息作为公共接口规范。"
        },
        {
          "type": "paragraph",
          "text": "约束要放在数据库里，因为并发请求可以绕过应用先查后写。下面重复插入 tenant-a 的 Alpha，数据库返回 23505；把 title 显式设置为 null，返回 23502。错误发生后重新 count，还是四行。业务错误映射应该依据驱动 SQLSTATE 或已命名约束，不能按英文消息字符串判断。测试中读取 driverError.code 是 PostgreSQL 专用检查；换产品必须另写映射。"
        }
      ]
    },
    {
      "id": "operations",
      "title": "save、insert、update：选择的是执行语义，不是好看程度",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "insert 表达直接插入，返回 InsertResult，包含驱动支持的 identifiers、generatedMaps 和 raw。它不承诺给你一个已加载完整关系的 Note。save 表达按实体身份持久化：新对象可插入，已有主键的对象可更新，通常需要先判断已有状态，因此不应把它当成“一条固定 INSERT 的别名”。update 直接表达条件更新，结果 affected 告诉你匹配并修改了多少行；它不是更新后的完整实体。"
        },
        {
          "type": "paragraph",
          "text": "在下面实验中，先插入含引号的标题，取返回主键重新查行；再 save 修改后的实体；随后 update 得到 affected=1，使用不存在 id 更新得到 affected=0。0 不自动等于数据库出错，可能是资源不存在，也可能是条件版本不匹配，需要业务自行解释。删除完成后又回到四条种子笔记。"
        },
        {
          "type": "code",
          "code": "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { IsNull } from 'typeorm';\nimport { source, seed, NoteEntity, SqlLog } from './model.js';\ntest('Entity → SQL：约束、返回值、空值与连接清理', async t => {\n const log = new SqlLog(); const ds = source('typeorm_foundations', log);\n await ds.initialize();\n try {\n  await ds.query('DROP SCHEMA IF EXISTS typeorm_foundations CASCADE');\n  await ds.query('CREATE SCHEMA typeorm_foundations'); await ds.synchronize(); await seed(ds);\n  const repo = ds.getRepository(NoteEntity);\n  await t.test('insert 返回标识；save 新建与已有主键更新；update 返回受影响行数', async () => {\n   const created = await repo.save({tenantId:'tenant-a',ownerId:'alice',title:'save-created'});\n   assert.ok(created.id); assert.equal(created.body,null); await repo.delete({id:created.id});\n   const result = await repo.insert({ tenantId:'tenant-a',ownerId:'alice',title:\"quote ' ; --\" });\n   assert.equal(result.identifiers.length,1); const id = result.identifiers[0].id as number;\n   const note = await repo.findOneByOrFail({id}); assert.equal(note.body,null); assert.equal(note.amount,'0.00');\n   note.title = 'saved'; assert.equal((await repo.save(note)).id,id);\n   assert.equal((await repo.update({id},{title:'updated',body:'keep-me'})).affected,1);\n   await repo.update({id},{title:'without-body-change',body:undefined});\n   assert.equal((await repo.findOneByOrFail({id})).body,'keep-me');\n   await repo.update({id},{body:null});\n   assert.equal((await repo.findOneByOrFail({id})).body,null);\n   assert.equal((await repo.update({id:-1},{title:'none'})).affected,0);\n   assert.equal((await repo.findBy({body:IsNull()})).length,4);\n   assert.ok(log.queries.some(q => q.parameters?.includes(\"quote ' ; --\")));\n   assert.equal((await repo.delete({id})).affected,1);\n  });\n  await t.test('唯一与非空由 PG 拒绝，失败语句不被计为成功写入', async () => {\n   await assert.rejects(repo.insert({tenantId:'tenant-a',ownerId:'alice',title:'Alpha'}),e => (e as {driverError:{code:string}}).driverError.code==='23505');\n   await assert.rejects(repo.insert({tenantId:'tenant-a',ownerId:'alice',title:null as never}),e => (e as {driverError:{code:string}}).driverError.code==='23502');\n   assert.equal(await repo.count(),4);\n  });\n  await t.test('1.1.2 高层 where 的 undefined/null 默认拒绝；{}查询却允许', async () => {\n   const defaults = source('typeorm_foundations'); delete (defaults.options as { invalidWhereValuesBehavior?: unknown }).invalidWhereValuesBehavior;\n   await defaults.initialize(); try {\n    await assert.rejects(defaults.getRepository(NoteEntity).findBy({id:undefined}));\n    await assert.rejects(defaults.getRepository(NoteEntity).findBy({body:null as never}));\n   } finally { await defaults.destroy(); }\n   assert.equal((await repo.findBy({})).length,4);\n   assert.ok(await repo.findOneBy({}));\n   await assert.rejects(repo.delete({})); await assert.rejects(repo.update({},{title:'bad'}));\n   // QueryBuilder 是低层 SQL 入口：不能把高层空值策略当成它的保护罩。\n   assert.equal((await repo.createQueryBuilder('n').where('n.id = :id',{id:undefined}).getMany()).length,0);\n   const q = repo.createQueryBuilder('n').where({}).getQuery(); assert.ok(!q.includes(' WHERE '));\n   assert.equal(await repo.count(),4);\n  });\n  console.log(JSON.stringify({version:'1.1.2',rows:await repo.count(),sampleSql:log.queries.find(x=>x.sql.startsWith('INSERT'))}));\n } finally { try { await ds.query('DROP SCHEMA IF EXISTS typeorm_foundations CASCADE'); } finally { await ds.destroy(); } }\n assert.equal(ds.isInitialized,false);\n await t.test('初始化失败不遗留已初始化池',async()=>{\n  const broken=source('unused'); Object.assign(broken.options,{url:'postgres://127.0.0.1:1/none'});\n  await assert.rejects(broken.initialize()); assert.equal(broken.isInitialized,false);\n });\n});\n",
          "language": "typescript",
          "filename": "examples/typeorm-foundations/src/lab.test.ts",
          "purpose": "完整可执行验证；顺序展示 CRUD、约束、默认空值、低层 QueryBuilder 与初始化失败。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "标题里的单引号与分号通过 parameters 传给 PostgreSQL，SQL 文本仍然使用 $1、$2 等占位符。参数化保护的是值，不能把客户端提供的列名、排序方向、表名直接拼进 SQL。排序字段应从服务端白名单映射。日志可能包含真实标题或隐私数据，本篇记录的是虚构夹具；生产日志要按字段裁剪。"
        }
      ]
    },
    {
      "id": "empty-criteria",
      "title": "1.x 空值保护很有用，但不等于空条件永远安全",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TypeORM 1.1.2 默认在高层 find/update/delete 等普通对象 where 中遇到显式 null 或 undefined 时抛错。示例故意再创建一个移除了显式配置的 DataSource，确认验证到的是默认值，不是自己把默认“配出来”。查询 SQL NULL 用 IsNull()，不要写 body:null 再期待生成 IS NULL。网上针对 0.3 旧默认的文章可能说 undefined 会被忽略，不能直接移用到这里。"
        },
        {
          "type": "paragraph",
          "text": "另一个边界容易漏掉：没有字段的 {}，和有 id:undefined 的对象，不是同一个输入。findBy({}) 可以读全部记录，findOneBy({}) 可以得到某条记录；没有 ORDER BY 时不承诺是哪条。当前版本 update({})、delete({}) 则拒绝空条件。我们分别实测这四条路径，而不是从其中一条概括“TypeORM 会自动防止所有全表操作”。"
        },
        {
          "type": "paragraph",
          "text": "QueryBuilder 的 where、andWhere、orWhere 是较低层入口，不受同一套高层无效值正规化保护。实验中 id=:id 且 id=undefined 被传到 SQL，PG 的等号 NULL 不匹配行；where({}) 生成的查询连 WHERE 都没有。这里故意只执行读取，避免为了演示毁坏数据。允许全表写入的 API 和没有 WHERE 的底层 UPDATE 必须由调用者承担授权、预览和影响行数保护。"
        },
        {
          "type": "reference",
          "title": "TypeORM 官方：1.x null/undefined 与空条件规则",
          "url": "https://typeorm.io/docs/data-source/null-and-undefined-handling/"
        }
      ]
    },
    {
      "id": "lifecycle",
      "title": "连接也有生命周期：成功、异常和初始化失败都要收口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "程序先 initialize，再在 try 中执行业务，finally 中 destroy。destroy 关闭的是 DataSource 拥有的池，不能在每次 HTTP 请求结束就销毁共享池。短命令行脚本结束时应该关闭；长期服务在停止接受新请求、收敛在途请求之后再关闭。事务专属 QueryRunner 另有 release，第三篇继续展开。"
        },
        {
          "type": "paragraph",
          "text": "初始化失败时 isInitialized 仍为 false，测试使用本机端口 1 的不可用地址实际验证拒绝。示例设置连接超时，防止等待无限延长；它不是业务总超时。脚本的临时 PGDATA 由外层运行器创建并在 finally 停止，测试中的固定 schema 也被删除。两层资源要分别收口：应用池关闭不代表数据库服务也自动退出。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "实际运行与下一步",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下载 ZIP 后运行 npm ci，再运行 PG_BIN=/Library/PostgreSQL/17/bin npm test。测试先编译，再创建仅监听回环的临时 PostgreSQL，默认端口 55483；Linux 可将 PG_BIN 指向 PostgreSQL 17 的 bin 目录。不要用 root 执行 initdb，不要把 DATABASE_URL 指向业务库。README 给出外部专用实验库模式以及对应销毁范围。"
        },
        {
          "type": "paragraph",
          "text": "本机 Node 24.14.1、PostgreSQL 17.4、macOS 14.5 实测 5/5 通过，0 跳过。SQL 输出包含参数数组；最终四条笔记、23505/23502、空过滤拒绝和空写拒绝分别有断言。没有验证 MySQL、生产池容量或断线后的提交状态，也没有提供性能收益数字。下一篇保留同样的实体和数据，观察关系加载怎样改变 SQL 数量，以及 JS 类型转换怎样影响分页正确性。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "TypeORM：DataSource",
      "url": "https://typeorm.io/docs/data-source/data-source/"
    },
    {
      "title": "TypeORM：空值过滤规则",
      "url": "https://typeorm.io/docs/data-source/null-and-undefined-handling/"
    },
    {
      "title": "PostgreSQL 17：约束",
      "url": "https://www.postgresql.org/docs/17/ddl-constraints.html"
    }
  ]
};
export default article;
