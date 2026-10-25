import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "typeorm-relations-queries",
  "topic": "data",
  "title": "关系与查询：JOIN、QueryBuilder、分页和 N+1",
  "description": "从关系所有方推导实际 SQL，验证 JOIN 行数、父实体计数，以及微秒时间和 numeric 在应用边界上的保真。",
  "minutes": 43,
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
      "path": "typeorm-relations-queries.zip"
    },
    {
      "label": "安装、运行与实际输出",
      "path": "typeorm-relations-queries/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "关系映射是什么：让外键与对象引用对齐",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "关系映射描述数据库行之间怎样连接，以及查询结果怎样恢复为对象引用。many-to-one 表示多条笔记可以指向同一个用户；one-to-many 是从用户反向观察那些笔记。对象里有 owner 属性，不等于内存里随时都有 owner，也不等于访问这个属性一定不会发 SQL。先分清“关系存在”和“数据已经加载”，才能解释 N+1。"
        },
        {
          "type": "paragraph",
          "text": "本文延续 tenant-a/alice 两条笔记 Alpha、Beta，tenant-a/bob 一条 Gamma，tenant-b/bob 一条 Private。Owner 有三个父实体，Note 有四条行。我们用这组很小的数据，先预测每条查询应该返回什么，再核对日志。小数据足以证明查询次数和分页语义，不足以证明哪条 SQL 在生产最快；执行计划留到第四篇。"
        },
        {
          "type": "paragraph",
          "text": "前置知识是第一篇的 DataSource、Repository 与参数化 SQL。本篇看完，你应该能说明外键在哪张表，区分 JOIN 行和父实体，识别循环加载引入的 SQL，并为微秒时间构造不丢精度的游标。本文不讲复杂多对多业务，也不假设应用已经完成认证。"
        }
      ]
    },
    {
      "id": "ownership",
      "title": "所有方决定外键：关系不能只看属性名",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'reflect-metadata';\nimport { DataSource, EntitySchema, type Logger } from 'typeorm';\nexport interface Owner { tenantId: string; id: string; name: string; notes?: Note[] }\nexport interface Note { id: number; tenantId: string; ownerId: string; title: string; body: string | null; amount: string; createdAt: Date; version: number; owner?: Owner }\nexport const OwnerEntity = new EntitySchema<Owner>({ name: 'Owner', tableName: 'owners', columns: {\n  tenantId: { type: String, primary: true }, id: { type: String, primary: true }, name: { type: String }\n}, relations: { notes: { type: 'one-to-many', target: 'Note', inverseSide: 'owner' } } });\nexport const NoteEntity = new EntitySchema<Note>({ name: 'Note', tableName: 'notes', columns: {\n  id: { type: Number, primary: true, generated: true }, tenantId: { type: String }, ownerId: { type: String },\n  title: { type: String }, body: { type: String, nullable: true, default: null },\n  amount: { type: 'numeric', precision: 20, scale: 2, default: '0.00' },\n  createdAt: { type: 'timestamptz', precision: 6, default: () => 'CURRENT_TIMESTAMP' },\n  version: { type: Number, default: 1 }\n}, uniques: [{ columns: ['tenantId', 'title'] }], relations: { owner: {\n  type: 'many-to-one', target: 'Owner', inverseSide: 'notes', nullable: false,\n  joinColumn: [{ name: 'tenantId', referencedColumnName: 'tenantId' }, { name: 'ownerId', referencedColumnName: 'id' }]\n} } });\nexport class SqlLog implements Logger {\n  queries: { sql: string; parameters?: unknown[] }[] = [];\n  logQuery(sql: string, parameters?: unknown[]) { this.queries.push({ sql, parameters }); }\n  logQueryError() {} logQuerySlow() {} logSchemaBuild() {} logMigration() {} log() {}\n  reset() { this.queries = []; }\n  selects() { return this.queries.filter(x => /^SELECT/.test(x.sql)).length; }\n}\nexport function source(schema: string, logger = new SqlLog()) {\n  return new DataSource({ type: 'postgres', url: process.env.DATABASE_URL ?? 'postgres://127.0.0.1:55483/typeorm_content',\n    schema, entities: [OwnerEntity, NoteEntity], synchronize: false, logging: ['query'], logger,\n    extra: { max: 4, connectionTimeoutMillis: 1500 },\n    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' } });\n}\nexport async function seed(ds: DataSource) {\n  await ds.getRepository(OwnerEntity).insert([{ tenantId: 'tenant-a', id: 'alice', name: 'Alice' }, { tenantId: 'tenant-a', id: 'bob', name: 'Bob' }, { tenantId: 'tenant-b', id: 'bob', name: 'Bob B' }]);\n  await ds.getRepository(NoteEntity).insert([\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Alpha', amount: '9007199254740993.10' },\n    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Beta', body: 'text' },\n    { tenantId: 'tenant-a', ownerId: 'bob', title: 'Gamma' },\n    { tenantId: 'tenant-b', ownerId: 'bob', title: 'Private' }\n  ]);\n}\n",
          "language": "typescript",
          "filename": "examples/typeorm-relations-queries/src/model.ts",
          "purpose": "与第一篇相同的完整模型；关注 Note.owner 的复合 joinColumn 与 Owner.notes 的 inverseSide。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Note.owner 是 many-to-one，外键列位于 notes，joinColumn 指向 owners 的 tenantId、id 复合主键。Owner.notes 只是反向集合，不再额外创建一个 notesId 列。alice 只存在 tenant-a，因此向 tenant-b 写 ownerId=alice 会触发 23503；即使不同租户都出现 bob，也必须按两个列同时匹配。"
        },
        {
          "type": "paragraph",
          "text": "这条外键保证的是“引用的用户属于同一个租户”，不能保证“当前登录人有权替这个用户写笔记”。授权发生在服务边界，数据库结构只是补上一层不变量。不要因为用了复合外键，就把服务端 tenant 过滤删掉。每条列表查询仍应从可信上下文拿租户并放进 WHERE。"
        },
        {
          "type": "figure",
          "src": "figures/typeorm-relations-queries/mechanism.svg",
          "title": "同一关系的三种观察单位",
          "alt": "alice 对应两条笔记，因此 JOIN 展开为两行；恢复对象后可能只有一个 Owner，SQL LIMIT 作用在哪个阶段决定分页结果。",
          "caption": "alice 对应两条笔记，因此 JOIN 展开为两行；恢复对象后可能只有一个 Owner，SQL LIMIT 作用在哪个阶段决定分页结果。"
        }
      ]
    },
    {
      "id": "loading",
      "title": "先看加载过程，再给 N+1 下定义",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "N+1 不是某个 ORM 独有的报错，而是一种访问模式：先查一组父项，再为每个父项单独查询关联。这里先查三个 Owner，随后循环查每人的 Note，实际是 1+3=4 条 SELECT。如果三个 Owner 变成三百个，循环形状不变，查询次数也跟着增加。是否存在网络往返、池等待和数据库缓存，会继续影响总耗时，不能拿“4对1”直接换算速度倍数。"
        },
        {
          "type": "paragraph",
          "text": "为了同时观察复合租户键，本段 owners.find 故意跨租户取出三个受控夹具父项，这是内部数据库结构实验，不是对外授权列表。真实HTTP接口必须使用来自可信身份的 tenantId 过滤，例如 tenant-a 只应先得到 alice、bob 两位父项，对应循环查询就变成1+2=3条。不能把本例跨租户观察当成已经实现了多租户API。"
        },
        {
          "type": "paragraph",
          "text": "模型没有开启 eager 或 lazy，关联加载由调用显式决定。eager 是某些高层查找时自动加载关系的声明，QueryBuilder 不应凭这个声明假定自己已经 JOIN；lazy 则用 Promise 形式按访问时机加载，容易把 SQL 藏在属性读取里。本文选择显式循环与 leftJoinAndSelect 对照，目的是让查询边界可见，而不是宣称两种策略永远不能用。"
        },
        {
          "type": "paragraph",
          "text": "日志只统计 SELECT，先完成建表和种子写入，再 reset。这样不会把 schema 元数据查询、初始化检查混进 N+1 数字。左连接使用关系映射生成双列连接条件，getMany 将重复的父列归并，得到三个 Owner。读日志时要同时保留 SQL 与参数，只有次数没有语句，仍然不知道漏掉了租户条件还是误加载了大字段。"
        }
      ]
    },
    {
      "id": "join-shape",
      "title": "JOIN 展开的是行，实体转换恢复的是身份",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "alice 的 Alpha 和 Beta 各产生一条 JOIN 行，其余两个 bob 各一条，因此 getRawMany 返回四行。getMany 依据父实体身份恢复对象，返回三位 Owner，alice.notes 包含两条 Note。两者都正确，只是输出单位不同。自己对 getRawMany 的数组 length 计数，就不能把它称作“用户数量”。"
        },
        {
          "type": "paragraph",
          "text": "选择字段也会影响恢复结果。实体恢复需要识别主键，特别是复合主键不能只挑 id 丢掉 tenantId；原始报表则可以明确 SELECT 聚合字段并使用 getRawMany。只选择必要列有助于控制传输与对象构造，但应依据接口所需字段做白名单，不能把部分实体再直接 save 当成“完整对象”。"
        },
        {
          "type": "paragraph",
          "text": "下面完整测试把 N+1、JOIN、父项分页和时间精度连续跑完。先看两个数量断言，再看分页单位如何改变结果；无需跳到外站才能理解它们。"
        },
        {
          "type": "code",
          "code": "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { source, seed, NoteEntity, OwnerEntity, SqlLog } from './model.js';\ntest('关系、查询数量、分页和精度',async t=>{\n const log=new SqlLog();const ds=source('typeorm_relations',log);await ds.initialize();\n try{\n  await ds.query('DROP SCHEMA IF EXISTS typeorm_relations CASCADE');await ds.query('CREATE SCHEMA typeorm_relations');await ds.synchronize();await seed(ds);\n  const notes=ds.getRepository(NoteEntity),owners=ds.getRepository(OwnerEntity);\n  await t.test('复合外键同时约束租户和用户',async()=>{\n   await assert.rejects(notes.insert({tenantId:'tenant-b',ownerId:'alice',title:'cross-tenant'}),e=>(e as {driverError:{code:string}}).driverError.code==='23503');\n  });\n  await t.test('循环加载 1+N=4；JOIN=1；原始行4而实体父项3',async()=>{\n   log.reset();const all=await owners.find({order:{tenantId:'ASC',id:'ASC'}});\n   for(const o of all)await notes.findBy({tenantId:o.tenantId,ownerId:o.id});\n   assert.equal(log.selects(),4);\n   log.reset();const entities=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').getMany();\n   assert.equal(log.selects(),1);assert.equal(entities.length,3);\n   const raw=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').getRawMany();assert.equal(raw.length,4);\n   const [page,count]=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').orderBy('o.tenantId').addOrderBy('o.id').take(1).getManyAndCount();\n   assert.equal(page.length,1);assert.equal(page[0].notes?.length,2);assert.equal(count,3);\n   const limited=await owners.createQueryBuilder('o').leftJoinAndSelect('o.notes','n').orderBy('o.tenantId').addOrderBy('o.id').addOrderBy('n.id').limit(2).getRawMany();\n   assert.equal(new Set(limited.map(x=>x.o_id)).size,1);\n   console.log(JSON.stringify({nPlusOne:4,joinSelects:1,joinedRawRows:4,parentCount:count,pageParents:page.length}));\n  });\n  await t.test('微秒游标用数据库文本精度；金额保留字符串',async()=>{\n   await ds.query(`UPDATE typeorm_relations.notes SET \"createdAt\"=t.ts FROM (VALUES (1,'2026-01-01 00:00:00.123456+00'::timestamptz),(2,'2026-01-01 00:00:00.123457+00'::timestamptz),(3,'2026-01-01 00:00:00.123458+00'::timestamptz)) AS t(id,ts) WHERE notes.id=t.id`);\n   const first=await ds.query(`SELECT id,to_char(\"createdAt\" AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor FROM typeorm_relations.notes WHERE \"tenantId\"=$1 ORDER BY \"createdAt\",id LIMIT 1`,['tenant-a']);\n   const row=first[0] as {id:number;cursor:string};assert.equal(row.cursor,'2026-01-01T00:00:00.123456Z');\n   const page=await ds.query('SELECT id FROM typeorm_relations.notes WHERE \"tenantId\"=$1 AND (\"createdAt\",id)>($2::timestamptz,$3) ORDER BY \"createdAt\",id LIMIT 2',['tenant-a',row.cursor,row.id]);\n   assert.deepEqual(page.map((x:{id:number})=>x.id),[2,3]);\n   const truncated=new Date(row.cursor).toISOString();assert.equal(truncated,'2026-01-01T00:00:00.123Z');\n   const wrong=await ds.query('SELECT id FROM typeorm_relations.notes WHERE \"tenantId\"=$1 AND (\"createdAt\",id)>($2::timestamptz,$3) ORDER BY \"createdAt\",id LIMIT 2',['tenant-a',truncated,row.id]);\n   assert.deepEqual(wrong.map((x:{id:number})=>x.id),[1,2]);\n   const amount=(await notes.findOneByOrFail({id:1})).amount;assert.equal(amount,'9007199254740993.10');assert.notEqual(Number(amount).toFixed(2),amount);\n   console.log(JSON.stringify({exactCursor:row.cursor,truncatedCursor:truncated,correctPage:[2,3],wrongPage:[1,2],amount}));\n  });\n }finally{try{await ds.query('DROP SCHEMA IF EXISTS typeorm_relations CASCADE');}finally{await ds.destroy();}}\n});\n",
          "language": "typescript",
          "filename": "examples/typeorm-relations-queries/src/lab.test.ts",
          "purpose": "完整查询与断言，包含复合外键失败、真实 SELECT 数、JOIN 行与父实体、微秒游标和金额。",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "pagination",
      "title": "分页先确定单位：两条 SQL 行不等于两位用户",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果业务要“一页一位用户，并带上该用户全部笔记”，先对 JOIN 结果 limit(2) 不等于拿两位用户。测试按租户、用户、笔记排序后，前两条原始行都属于 alice；用 Set 去重之后只剩一位。这个反例没有随机性，初始数据和排序都固定。"
        },
        {
          "type": "paragraph",
          "text": "在本版本 PostgreSQL 的这条关系查询上，take(1) 与 getManyAndCount 走父项身份分页，返回一个 Owner、完整两条 Note，count=3。它可能产生额外查询，count 与列表也不是同一个事务快照的天然保证。日志应该观察每次查询；不能把前面“没有分页 JOIN 一条 SELECT”的测量推广到所有 take/count 组合。"
        },
        {
          "type": "paragraph",
          "text": "列表若只需要笔记，最简单的分页单位就是 Note 自身；若先按父项分页，也可以显式两步：先拿稳定排序的父主键，再带这些键取关系。两步之间数据可能变化，需要结合业务一致性要求选择事务或允许短暂变化。无论哪种方案，都要补并列排序键，否则同一时间值的记录顺序不确定。"
        }
      ]
    },
    {
      "id": "precision",
      "title": "时间游标和金额：类型转换也会改变正确性",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "PostgreSQL timestamptz(6) 能保存六位小数秒，JavaScript Date 只保存三位毫秒。这里三条 tenant-a 笔记时间分别为 .123456、.123457、.123458 秒。第一条读成 Date 再 toISOString，得到 .123Z，后三位已经丢失；补一个 id 排序键并不能凭空恢复它们。"
        },
        {
          "type": "paragraph",
          "text": "正确游标通过数据库 to_char 在 UTC 输出完整六位时间文本，下一页条件是 (createdAt,id) > (精确时间,id)。它是按时间升序的 keyset 分页：先比较时间，相等时比较唯一 id。正确下一页得到 [2,3]；把游标换成 Date 截断结果，条件落回第一行之前，错误返回 [1,2]，出现重复并推迟第三行。降序分页需要对应改为小于与倒序，不能只改 ORDER BY。"
        },
        {
          "type": "paragraph",
          "text": "本例是可读的原始游标，还没有签名。对外接口要限制租户、校验格式，并将筛选条件和排序方向绑定到游标；不能允许用户在 tenant-a 列表拿 tenant-b 的游标推断权限。并发插入时 keyset 解决的是位置推进，不自动提供全量快照一致性。"
        },
        {
          "type": "paragraph",
          "text": "numeric(20,2) 的 9007199254740993.10 在 pg 默认解析下保留字符串。强制 Number 会超出可安全精确表示的整数范围，也不能精确保留所有十进制小数。测试只证明 Number 转换后的两位文本不同，不提供金融运算库。应用可以使用十进制定点库，或在明确范围内使用最小货币单位 bigint；JSON 序列化 bigint 和币种小数位规则还需要单独处理。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：时间类型精度",
          "url": "https://www.postgresql.org/docs/17/datatype-datetime.html"
        }
      ]
    },
    {
      "id": "verify",
      "title": "运行、核验与下一章",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "ZIP 内 npm ci 后运行 PG_BIN=/Library/PostgreSQL/17/bin npm test。测试自己建立并销毁隔离库，真实结果 4/4 通过，0 跳过。输出 N+1=4、JOIN=1、rawRows=4、parentCount=3、correctPage=[2,3]、wrongPage=[1,2] 与完整金额文本。这些是结构和语义证据，不是吞吐基准。"
        },
        {
          "type": "paragraph",
          "text": "如果结果不符，先查依赖是否确为 lock 文件中的 1.1.2，再核对种子行、排序、日志 reset 的位置和 pg 类型解析是否被项目全局覆盖。不要先通过增加 LIMIT 来“修复”丢行。本文没有验证其他数据库产品或所有关系加载组合；第四篇用真实 EXPLAIN 讨论访问计划。下一篇先解决更基础的写入问题：多条 SQL 怎样归属同一事务，以及为什么全局 Repository 能逃出回滚。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "TypeORM：Select QueryBuilder",
      "url": "https://typeorm.io/docs/query-builder/select-query-builder/"
    },
    {
      "title": "TypeORM：关系",
      "url": "https://typeorm.io/docs/relations/relations/"
    },
    {
      "title": "PostgreSQL 17：时间类型",
      "url": "https://www.postgresql.org/docs/17/datatype-datetime.html"
    },
    {
      "title": "PostgreSQL 17：numeric",
      "url": "https://www.postgresql.org/docs/17/datatype-numeric.html"
    }
  ]
};
export default article;
