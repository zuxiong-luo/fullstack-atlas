import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "nestjs-typeorm-integration",
  "topic": "nestjs",
  "title": "NestJS 与 TypeORM：数据访问边界和事务服务",
  "description": "把模块注入接到真实 PostgreSQL，分清 Repository、连接池与事务 manager，用笔记和审计的共同提交验证服务边界。",
  "minutes": 40,
  "labMinutes": 20,
  "tags": [
    "NestJS",
    "Node.js",
    "TypeScript",
    "租户笔记服务",
    "PostgreSQL",
    "TypeORM"
  ],
  "scope": "把模块注入接到真实 PostgreSQL，分清 Repository、连接池与事务 manager，用笔记和审计的共同提交验证服务边界。",
  "prerequisites": [
    "会编写TypeScript类和Promise",
    "理解Nest模块与依赖注入",
    "理解SQL约束和事务"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 24.14.1",
    "NestJS 12.2.0",
    "@nestjs/typeorm 12.0.2",
    "TypeORM 1.1.2",
    "pg 8.23.1",
    "PostgreSQL 17.4",
    "TypeScript 5.7.2",
    "RxJS 7.8.2"
  ],
  "verifiedAt": "2026-10-25",
  "examples": [
    {
      "label": "下载本章独立项目、锁文件与测试",
      "path": "nestjs-typeorm-integration.zip"
    },
    {
      "label": "阅读运行说明",
      "path": "nestjs-typeorm-integration/README.md"
    }
  ],
  "sections": [
    {
      "id": "data-access",
      "title": "数据库集成是什么：把两种边界接起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Nest 与 TypeORM 的集成，是让依赖注入容器负责提供 DataSource 和 Repository，并把它们交给业务服务使用。Nest 管对象装配与应用生命周期，TypeORM 管映射、连接与 SQL 执行，PostgreSQL 最终执行约束和事务。给类加 Injectable 不会自动开启事务，也不会把任意两个 SQL 变成一个原子动作。"
        },
        {
          "type": "paragraph",
          "text": "上一章已经验证模块可见性和资源作用域。这一章把教学状态换成真实数据库：tenant-a/alice 创建笔记时，同步写入一条审计记录；修改标题时也写审计。我们希望两份数据共同成功或共同失败。这里的审计是数据库内的业务记录，不是外部日志平台，因此可以由同一个 PostgreSQL 事务保护。"
        },
        {
          "type": "paragraph",
          "text": "本章固定 PostgreSQL 17.4、TypeORM 1.1.2、@nestjs/typeorm 12.0.2、Nest 12.2.0 与 Node 24.14.1。TypeORM 的旧 Connection/getConnection 风格不参与实现。笔记核心字段与 TypeORM 子系列一致：tenantId、ownerId、title、body、amount、createdAt、version。前两章内存对象用 UUID，进入 PG 后 id 明确改为数据库生成的整数，HTTP 返回的数字类型也有断言，避免把阶段变化藏起来。"
        },
        {
          "type": "paragraph",
          "text": "为了先看清集成与事务，本章把身份固定为 tenant-a/alice，并保留故障夹具 failAudit。它只允许在自有 loopback 教学服务中使用，不能原样当生产 API。第四篇将删除这个故障入口，加入服务端身份、权限和运行时输入边界。"
        }
      ]
    },
    {
      "id": "source-and-repository",
      "title": "DataSource、Repository 和 manager 是不同层次的对象",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "DataSource 是应用到数据库的连接入口，持有驱动、实体元数据和连接池。初始化会建立可用的数据访问环境；destroy 会释放它拥有的连接。Repository 绑定一类实体，提供查询、保存和更新等操作；EntityManager 可以访问多个实体。它们本身并不代表“一次事务”。"
        },
        {
          "type": "paragraph",
          "text": "默认注入的 Repository 由应用 DataSource 创建，适合普通独立查询。事务回调得到的 manager 则与事务专属 QueryRunner/连接关联，必须用它创建本次事务里的 Repository。即便全局 Repository 指向同一台数据库，它也可能从连接池拿到另一条连接，因而处在另一个事务上下文。"
        },
        {
          "type": "figure",
          "src": "figures/nestjs-typeorm-integration.svg",
          "title": "应用资源与事务连接的所有权",
          "alt": "Nest 容器拥有 DataSource；普通 Repository 来自应用 manager。transaction 回调获得事务 manager，笔记与审计都经它落在同一事务连接中，最后提交或回滚。",
          "caption": "Nest 容器拥有 DataSource；普通 Repository 来自应用 manager。transaction 回调获得事务 manager，笔记与审计都经它落在同一事务连接中，最后提交或回滚。"
        },
        {
          "type": "paragraph",
          "text": "这里的“同一连接”决定了原子性：PostgreSQL 的 BEGIN、写笔记、写审计、COMMIT 必须形成同一事务。容器注入只是把对象交给你，不能替你推断两次数据库调用是否属于同一业务动作。因此我们把事务起止放在 write 服务方法里，而不是放在每一个 Repository 的单独调用外。"
        }
      ]
    },
    {
      "id": "schema",
      "title": "实体注册不等于自动修改生产表",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "实体告诉 TypeORM 如何把字段映射到表。数据库约束仍然由真实表决定：Owner 的 tenantId+id 是复合主键；Note 的 tenantId+ownerId 共同引用它；tenantId+title 唯一；amount 使用 numeric(20,2)，读出保留字符串；createdAt 是 timestamptz(6)。数据库里不能存在一个不存在的租户用户笔记。"
        },
        {
          "type": "paragraph",
          "text": "下面给出完整教学实体。它与 TypeORM 子系列使用相同的核心模型，本章额外增加 audits。保存精确金额时不把字符串先转成 Number；createdAt 读成 JavaScript Date 后只有毫秒精度，本章不拿它做微秒分页游标。字段存在不表示本篇展开全部关系和精度机制，这些问题在 TypeORM 系列有专门实验。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-typeorm-integration/src/model.ts",
          "purpose": "独立 ZIP 内完整实体：复合 owner 身份、笔记映射与审计动作约束。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport { EntitySchema } from \"typeorm\";\nexport interface Owner {\n  tenantId: string;\n  id: string;\n  name: string;\n  notes?: Note[];\n}\nexport interface Note {\n  id: number;\n  tenantId: string;\n  ownerId: string;\n  title: string;\n  body: string | null;\n  amount: string;\n  createdAt: Date;\n  version: number;\n  owner?: Owner;\n}\nexport const OwnerEntity = new EntitySchema<Owner>({\n  name: \"Owner\",\n  tableName: \"owners\",\n  columns: {\n    tenantId: { type: String, primary: true },\n    id: { type: String, primary: true },\n    name: { type: String },\n  },\n  relations: {\n    notes: { type: \"one-to-many\", target: \"Note\", inverseSide: \"owner\" },\n  },\n});\nexport const NoteEntity = new EntitySchema<Note>({\n  name: \"Note\",\n  tableName: \"notes\",\n  columns: {\n    id: { type: Number, primary: true, generated: true },\n    tenantId: { type: String },\n    ownerId: { type: String },\n    title: { type: String },\n    body: { type: String, nullable: true, default: null },\n    amount: { type: \"numeric\", precision: 20, scale: 2, default: \"0.00\" },\n    createdAt: {\n      type: \"timestamptz\",\n      precision: 6,\n      default: () => \"CURRENT_TIMESTAMP\",\n    },\n    version: { type: Number, default: 1 },\n  },\n  uniques: [{ columns: [\"tenantId\", \"title\"] }],\n  relations: {\n    owner: {\n      type: \"many-to-one\",\n      target: \"Owner\",\n      inverseSide: \"notes\",\n      nullable: false,\n      joinColumn: [\n        { name: \"tenantId\", referencedColumnName: \"tenantId\" },\n        { name: \"ownerId\", referencedColumnName: \"id\" },\n      ],\n    },\n  },\n});\nexport interface Audit {\n  id: number;\n  noteId: number;\n  action: string;\n}\nexport const AuditEntity = new EntitySchema<Audit>({\n  name: \"Audit\",\n  tableName: \"audits\",\n  columns: {\n    id: { type: Number, primary: true, generated: true },\n    noteId: { type: Number },\n    action: { type: String },\n  },\n  checks: [{ expression: \"\\\"action\\\" IN ('create','update')\" }],\n});"
        },
        {
          "type": "paragraph",
          "text": "forRootAsync 显式设置 synchronize:false。测试启动器只在它自己创建的空 PGDATA 中执行下面的 schema；不是让每次业务应用启动都猜测并修改已有生产表。要演进已有数据库，应审查迁移 SQL 并按发布顺序执行。"
        },
        {
          "type": "code",
          "language": "sql",
          "filename": "examples/nestjs-typeorm-integration/schema.sql",
          "purpose": "本章自有空库的显式建表与虚构用户夹具，不对用户现有数据库执行。",
          "kind": "excerpt",
          "code": "CREATE TABLE owners (\"tenantId\" varchar NOT NULL,id varchar NOT NULL,name varchar NOT NULL,PRIMARY KEY(\"tenantId\",id));\nCREATE TABLE notes (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\"tenantId\" varchar NOT NULL,\"ownerId\" varchar NOT NULL,title varchar NOT NULL,body varchar DEFAULT NULL,amount numeric(20,2) NOT NULL DEFAULT '0.00',\"createdAt\" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(\"tenantId\",title),FOREIGN KEY(\"tenantId\",\"ownerId\") REFERENCES owners(\"tenantId\",id));\nCREATE TABLE audits (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\"noteId\" integer NOT NULL REFERENCES notes(id),action varchar NOT NULL CHECK(action IN ('create','update')));\nINSERT INTO owners VALUES ('tenant-a','alice','Alice'),('tenant-a','bob','Bob A'),('tenant-b','bob','Bob B');"
        }
      ]
    },
    {
      "id": "nest-registration",
      "title": "Nest 注册入口：根连接与功能 Repository",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TypeOrmModule.forRootAsync 注册 DataSource，工厂返回带版本约定的配置。entities 声明参与映射的实体；forFeature([NoteEntity]) 注册当前模块可注入的 Note Repository；@InjectRepository(NoteEntity) 使用同一个实体 token 获取它。只写 forFeature 并不能凭空建立数据库连接。"
        },
        {
          "type": "paragraph",
          "text": "本章不用 autoLoadEntities 隐藏实体来源，也没有重复 new DataSource。默认注入 Repository 仅用于说明应用级读入口，write 内部从事务 manager 取 Repository，不混用。retryAttempts:1 让错误尽快显露，连接建立另设 1000ms 截止；自动重试整个业务事务涉及幂等性，不能因为连接模块有 retry 参数就顺带解决。"
        },
        {
          "type": "paragraph",
          "text": "配置验证只接受 atlas 用户、127.0.0.1:55482/postgres 这套教学夹具。启动器发现 55482 已被占用便拒绝运行，不连接、停止或清理那个已有服务。DATABASE_URL 未设置时也失败。这种限制用于避免示例碰到你的 5432 数据库，不是生产环境配置模板。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-typeorm-integration/src/config.ts",
          "purpose": "显式教学资源边界：拒绝用户默认端口、其他数据库与缺失配置。",
          "kind": "excerpt",
          "code": "export function databaseUrl() {\n  const value = process.env.DATABASE_URL;\n  if (!value)\n    throw new Error(\"DATABASE_URL required: use owned cluster launcher\");\n  const url = new URL(value);\n  if (\n    url.hostname !== \"127.0.0.1\" ||\n    url.port !== \"55482\" ||\n    url.username !== \"atlas\" ||\n    url.pathname !== \"/postgres\"\n  )\n    throw new Error(\n      \"Teaching fixture only: loopback atlas/postgres port 55482\",\n    );\n  return value;\n}"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-typeorm-integration/src/app.ts",
          "purpose": "完整集成核心：TypeOrmModule 注册、Repository 注入、服务事务、HTTP 路由和 DTO。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport {\n  Body,\n  Controller,\n  Injectable,\n  Module,\n  NotFoundException,\n  Param,\n  ParseIntPipe,\n  Patch,\n  Post,\n  ValidationPipe,\n} from \"@nestjs/common\";\nimport { NestFactory } from \"@nestjs/core\";\nimport { InjectRepository, TypeOrmModule } from \"@nestjs/typeorm\";\nimport { DataSource, Repository } from \"typeorm\";\nimport {\n  IsBoolean,\n  IsOptional,\n  IsString,\n  MaxLength,\n  MinLength,\n} from \"class-validator\";\nimport { AuditEntity, Note, NoteEntity, OwnerEntity } from \"./model\";\nimport { databaseUrl } from \"./config\";\nexport class NoteInput {\n  @IsString() @MinLength(1) @MaxLength(80) title!: string;\n  @IsOptional() @IsBoolean() failAudit?: boolean;\n}\n@Injectable()\nexport class NotesService {\n  constructor(\n    private readonly source: DataSource,\n    @InjectRepository(NoteEntity) readonly readRepository: Repository<Note>,\n  ) {}\n  async write(input: NoteInput, id?: number) {\n    return this.source.transaction(async (manager) => {\n      const notes = manager.getRepository(NoteEntity);\n      let note: Note;\n      if (id === undefined) {\n        note = await notes.save(\n          notes.create({\n            tenantId: \"tenant-a\",\n            ownerId: \"alice\",\n            title: input.title,\n          }),\n        );\n      } else {\n        const current = await notes.findOneBy({\n          id,\n          tenantId: \"tenant-a\",\n          ownerId: \"alice\",\n        });\n        if (!current) throw new NotFoundException();\n        await notes.update(\n          { id, tenantId: \"tenant-a\", ownerId: \"alice\" },\n          { title: input.title, version: current.version + 1 },\n        );\n        note = await notes.findOneByOrFail({\n          id,\n          tenantId: \"tenant-a\",\n          ownerId: \"alice\",\n        });\n      }\n      await manager.getRepository(AuditEntity).insert({\n        noteId: note.id,\n        action: input.failAudit\n          ? \"BROKEN\"\n          : id === undefined\n            ? \"create\"\n            : \"update\",\n      });\n      return note;\n    });\n  }\n}\n@Controller(\"notes\")\nclass NotesController {\n  constructor(private readonly notes: NotesService) {}\n  @Post() create(@Body() input: NoteInput) {\n    return this.notes.write(input);\n  }\n  @Patch(\":id\") update(\n    @Param(\"id\", ParseIntPipe) id: number,\n    @Body() input: NoteInput,\n  ) {\n    return this.notes.write(input, id);\n  }\n}\n@Module({\n  imports: [\n    TypeOrmModule.forRootAsync({\n      useFactory: () => ({\n        type: \"postgres\",\n        url: databaseUrl(),\n        entities: [OwnerEntity, NoteEntity, AuditEntity],\n        synchronize: false,\n        retryAttempts: 1,\n        extra: { max: 4, connectionTimeoutMillis: 1000 },\n        invalidWhereValuesBehavior: { null: \"throw\", undefined: \"throw\" },\n      }),\n    }),\n    TypeOrmModule.forFeature([NoteEntity]),\n  ],\n  providers: [NotesService],\n  controllers: [NotesController],\n})\nclass AppModule {}\nexport async function createApp() {\n  const app = await NestFactory.create(AppModule, {\n    logger: false,\n    abortOnError: false,\n  });\n  app.useGlobalPipes(\n    new ValidationPipe({\n      transform: true,\n      whitelist: true,\n      forbidNonWhitelisted: true,\n    }),\n  );\n  await app.listen(0, \"127.0.0.1\");\n  return app;\n}"
        }
      ]
    },
    {
      "id": "atomic-write",
      "title": "带着一条输入走事务：审计失败会怎样",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "从空库开始，POST /notes 的 title=Alpha。服务开启事务，manager.getRepository(NoteEntity) 保存笔记，随后用同一 manager 插入 create 审计。只有回调完成，transaction 才提交并把 note 返回到 HTTP 层。响应 201 时数据库应有一条笔记、一条审计。"
        },
        {
          "type": "paragraph",
          "text": "PATCH 把标题改成 Beta，并增加 version，再插入 update 审计。如果审计遇到数据库 CHECK 约束，回调抛错，事务回滚。测试的 failAudit:true 会把 action 变成 BROKEN，让真正的 PostgreSQL 约束拒绝，而不是在客户端伪造一个失败。回滚后标题仍是 Beta，审计数量不增加；创建失败也不留下半条笔记。序列值可能出现空洞，这是 PostgreSQL 序列与事务的正常边界，不应据此判断回滚失败。"
        },
        {
          "type": "paragraph",
          "text": "请特别留意 update 中的 read→version+1。这一章只证明“修改笔记和审计共同提交”，没有证明并发请求不会覆盖对方。两个事务可能先后读取相同 version，再分别写入新标题；普通事务不会自动把整段业务变成全局串行。第四篇会把 expectedVersion 写进 UPDATE 的 WHERE，检查 affected=1，才形成显式冲突检测。"
        },
        {
          "type": "paragraph",
          "text": "事务还不能保护数据库之外的动作。如果 write 中先给外部 API 发送通知，之后审计失败，数据库回滚不会把通知收回。对于需要跨边界交付的动作，应建立持久任务或 Outbox，在提交之后处理，并接受可重试的投递语义。第五篇会以同一个笔记模型演示任务所有权。"
        }
      ]
    },
    {
      "id": "failure-and-close",
      "title": "初始化与关闭：连接所有权要能验证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "初始化失败时应用不应该先变成“健康服务”。下面使用一个在自有集群里不存在的数据库角色，真实触发驱动连接拒绝，NestFactory 设置 abortOnError:false 让测试能捕获错误，避免直接终止测试进程。它不是只故意传错一段配置字符串。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-typeorm-integration/src/initialization-failure.ts",
          "purpose": "真实数据库初始化失败夹具：保留自有地址，只更换不存在的数据库角色。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport { Module } from \"@nestjs/common\";\nimport { NestFactory } from \"@nestjs/core\";\nimport { TypeOrmModule } from \"@nestjs/typeorm\";\nimport { databaseUrl } from \"./config\";\nexport async function failInitialization() {\n  const url = new URL(databaseUrl());\n  url.username = \"missing_fixture_role\";\n  @Module({\n    imports: [\n      TypeOrmModule.forRoot({\n        type: \"postgres\",\n        url: url.toString(),\n        retryAttempts: 1,\n        extra: { connectionTimeoutMillis: 500 },\n      }),\n    ],\n  })\n  class BrokenDatabaseModule {}\n  return NestFactory.create(BrokenDatabaseModule, {\n    logger: false,\n    abortOnError: false,\n  });\n}"
        },
        {
          "type": "paragraph",
          "text": "@nestjs/typeorm 12.0.2 的 TypeOrmCoreModule 在应用关闭时检查所管理 DataSource 是否已初始化，再销毁它。本章只创建一份由该模块拥有的 DataSource。正常测试 finally 调用 app.close，断言 ds.isInitialized=false。这个断言证明这份连接入口关闭，不扩大为所有驱动、所有故障下全进程绝无句柄泄漏。"
        },
        {
          "type": "paragraph",
          "text": "不能用单元测试里的 fake Repository 证明数据库事务成功。假对象很容易让“两个调用都被执行过”的测试通过，却完全没有连接、约束和回滚。这里保留真实 PostgreSQL 的集成测试，后续再用单元测试隔离纯权限或配置逻辑。"
        }
      ]
    },
    {
      "id": "commands-and-results",
      "title": "从干净环境复现提交、失败与恢复",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "filename": "终端 · 解压后的本章项目目录",
          "purpose": "使用锁文件安装，执行本章真实测试，再启动独立演示。PG章节先安装PostgreSQL17.4二进制并确认55482未占用。",
          "kind": "runnable",
          "code": "npm ci --ignore-scripts\nnpm test\nnpm run build\nnpm start"
        },
        {
          "type": "paragraph",
          "text": "安装 Node 24.14.1 与 PostgreSQL 17.4 的二进制工具后，执行 npm ci --ignore-scripts、npm test；macOS 默认 PG_BIN=/Library/PostgreSQL/17/bin，其他环境把 PG_BIN 指向同版本 bin。不能用 root 运行 initdb。测试启动器创建临时目录、绑定 127.0.0.1:55482、建空库，再启动真实 HTTP 测试进程，结束时停止自己的实例并删除自己的目录。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/nestjs-typeorm-integration/test.mjs",
          "purpose": "完整两项验收：真实HTTP共同提交/回滚/恢复与连接关闭，以及缺失角色导致初始化拒绝。",
          "kind": "excerpt",
          "code": "import test from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { createApp, NotesService } from \"./dist/app.js\";\nimport { DataSource } from \"typeorm\";\nimport { NoteEntity, AuditEntity } from \"./dist/model.js\";\ntest(\n  \"real PG create/update/audit atomic commit, rollback and connection release\",\n  { timeout: 20000 },\n  async () => {\n    const app = await createApp();\n    const ds = app.get(DataSource);\n    try {\n      const url = await app.getUrl(),\n        write = async (method, path, body) => {\n          const r = await fetch(url + path, {\n            method,\n            headers: { \"content-type\": \"application/json\" },\n            body: JSON.stringify(body),\n          });\n          return { status: r.status, body: await r.json() };\n        };\n      let r = await write(\"POST\", \"/notes\", { title: 3 });\n      assert.equal(r.status, 400);\n      assert.equal(await ds.getRepository(NoteEntity).count(), 0);\n      assert.equal(await ds.getRepository(AuditEntity).count(), 0);\n      r = await write(\"POST\", \"/notes\", { title: \"Alpha\" });\n      assert.equal(r.status, 201);\n      const id = r.body.id;\n      assert.equal(typeof id, \"number\");\n      assert.equal(r.body.amount, \"0.00\");\n      assert.equal(r.body.tenantId, \"tenant-a\");\n      r = await write(\"PATCH\", \"/notes/\" + id, { title: \"Beta\" });\n      assert.equal(r.status, 200);\n      assert.equal(r.body.version, 2);\n      r = await write(\"PATCH\", \"/notes/\" + id, {\n        title: \"bad-update\",\n        failAudit: true,\n      });\n      assert.equal(r.status, 500);\n      assert.equal(\n        (await ds.getRepository(NoteEntity).findOneByOrFail({ id })).title,\n        \"Beta\",\n      );\n      r = await write(\"POST\", \"/notes\", {\n        title: \"bad-create\",\n        failAudit: true,\n      });\n      assert.equal(r.status, 500);\n      assert.equal(await ds.getRepository(NoteEntity).count(), 1);\n      assert.equal(await ds.getRepository(AuditEntity).count(), 2);\n      r = await write(\"PATCH\", \"/notes/\" + id, { title: \"Recovered\" });\n      assert.equal(r.status, 200);\n      assert.equal(await ds.getRepository(AuditEntity).count(), 3);\n      assert.equal(app.get(NotesService).readRepository.manager.connection, ds);\n      console.log(\n        JSON.stringify({\n          created: 201,\n          updated: 200,\n          rollbackCreate: 500,\n          rollbackUpdate: 500,\n          notes: 1,\n          audits: 3,\n          recovered: 200,\n        }),\n      );\n    } finally {\n      await app.close();\n      assert.equal(ds.isInitialized, false);\n    }\n  },\n);\ntest(\n  \"initialization failure is bounded and leaves no healthy app\",\n  { timeout: 10000 },\n  async () => {\n    const { failInitialization } = await import(\n      \"./dist/initialization-failure.js\"\n    );\n    const began = Date.now();\n    await assert.rejects(failInitialization(), /role.*does not exist/);\n    assert.ok(Date.now() - began < 5000);\n  },\n);"
        },
        {
          "type": "paragraph",
          "text": "本次 macOS14.5、PostgreSQL17.4、Node24.14.1 实际执行 2/2 通过。create=201，update=200，rollbackCreate=500、rollbackUpdate=500，恢复修改=200；最终 notes=1、audits=3。初始化失败在测试规定的 5 秒上限内返回，未生成健康应用。这里只记录界限断言，不把单次耗时当性能结论。"
        },
        {
          "type": "paragraph",
          "text": "手动运行先 npm run build，再 npm start。启动器会暂时创建自有数据库并打印 HTTP URL；退出会清理，所以手动数据不会长期保留。这个方便教学的生命周期与生产持久卷不同，不能拿来部署持久笔记服务。"
        }
      ]
    },
    {
      "id": "take-away",
      "title": "把集成问题与数据库问题分开排查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "遇到依赖找不到，查 module imports/exports、forFeature 和实体 token；遇到表不存在，查显式 schema/迁移是否执行；遇到一半数据留下，查是否所有 SQL 都使用同一个事务 manager；遇到并发覆盖，查是否有真正写进 WHERE 的版本条件。这四类问题可能出现在同一服务里，但证据与修复位置不同。"
        },
        {
          "type": "paragraph",
          "text": "本章最终交付的是一条有明确所有权的路径：应用拥有 DataSource，服务拥有事务边界，事务 manager 承担两类实体写入，PG 执行约束并决定提交。下一章在这条已经能回滚的路径外，加上用户输入与授权边界。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Nest TypeORM 集成",
      "url": "https://docs.nestjs.com/techniques/sql"
    },
    {
      "title": "@nestjs/typeorm v12.0.2 TypeOrmCoreModule",
      "url": "https://github.com/nestjs/typeorm/blob/12.0.2/lib/typeorm-core.module.ts"
    },
    {
      "title": "TypeORM 事务",
      "url": "https://typeorm.io/docs/advanced-topics/transactions/"
    },
    {
      "title": "PostgreSQL17事务",
      "url": "https://www.postgresql.org/docs/17/tutorial-transactions.html"
    }
  ]
};
export default article;
