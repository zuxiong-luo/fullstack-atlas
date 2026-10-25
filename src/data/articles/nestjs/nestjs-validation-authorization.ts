import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "nestjs-validation-authorization",
  "topic": "nestjs",
  "title": "输入、身份与权限：让 API 在服务端守住边界",
  "description": "把网络 JSON、演示身份和资源权限分开校验，验证缺失身份、跨租户、越权读写与版本冲突都不会留下业务副作用。",
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
  "scope": "把网络 JSON、演示身份和资源权限分开校验，验证缺失身份、跨租户、越权读写与版本冲突都不会留下业务副作用。",
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
      "path": "nestjs-validation-authorization.zip"
    },
    {
      "label": "阅读运行说明",
      "path": "nestjs-validation-authorization/README.md"
    }
  ],
  "sections": [
    {
      "id": "boundaries",
      "title": "输入校验、认证、授权：三道边界处理不同问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "输入校验判断请求数据是否符合接口约定；认证判断调用者是谁；授权判断这个调用者能否对这个资源执行这个动作。三者相关，但不能互相代替。title 是合法字符串，不代表调用者有权改 alice 的笔记；用户已登录，也不代表客户端发来的 tenantId 可以作为可信身份。"
        },
        {
          "type": "paragraph",
          "text": "本章继续使用 PostgreSQL 中的 tenant-a/alice、tenant-a/bob、tenant-b/bob。alice-demo、bob-a-demo、bob-demo、alice-readonly-demo 是服务端预先登记的固定教学令牌，用来稳定复现身份和权限组合。它们没有签发、过期、撤销和密码保护能力，不是 JWT 验签实现，更不能称为生产身份平台。"
        },
        {
          "type": "paragraph",
          "text": "API 的策略是：缺失或不认识的身份返回 401；已知身份但没有写权限返回 403；按 tenant+owner 查不到的资源统一返回 404，包括它根本不存在和它存在但不属于你。这样调用者不会从错误差异直接枚举别人的笔记。404 隐藏的是可见性差异，不代表数据库里一定没有那一行。"
        },
        {
          "type": "paragraph",
          "text": "威胁模型限定为能够直接构造 HTTP 请求的客户端：可以修改 JSON、路径、普通请求头和演示令牌字符串，不能修改服务端身份登记表或数据库。身份查找显式Object.hasOwn，不允许普通对象继承的toString等键冒充登记身份。数据由服务端约束，安全性不能依赖前端隐藏按钮。"
        }
      ]
    },
    {
      "id": "runtime-dto",
      "title": "DTO 为什么必须在运行时出现",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TypeScript 的类型注解会被编译掉，网络传来的 JSON 不会自行变成可信对象。Nest ValidationPipe 配合 class-validator 读取 DTO 类上的运行时元数据，才会检查 title 类型和长度。接口、type alias 不能直接替代携带装饰器的 class。"
        },
        {
          "type": "paragraph",
          "text": "本章 transform:true 创建 DTO 实例；whitelist:true 限制已声明的校验字段；forbidNonWhitelisted:true 让额外字段直接失败，而不是悄悄删掉。expectedVersion 必须是1到2147483646的 JSON 数字整数，保证加1仍可写入PG integer；enableImplicitConversion:false 保证字符串 \"1\" 不会在我们没说明时变成数字。ParseIntPipe 则负责路径 id 从字符串到整数的转换，这与请求体字段是两条明确的转换路径。"
        },
        {
          "type": "paragraph",
          "text": "body 允许缺失或 null，但它们有不同语义：创建时缺失视为 null；更新时缺失就从UPDATE数据中省略body，保留原值；显式 null 清空。测试分别验证这两条语义，避免把预读快照写回数据库。@IsOptional 在这里允许 null 跳过字符串约束，是刻意选定的接口约定。若你的接口不允许 null，需要更窄的条件校验，不能机械复制一个 Optional 装饰器。"
        },
        {
          "type": "paragraph",
          "text": "固定演示身份来自服务端映射。DTO 根本不接受 tenantId、ownerId，所以客户端把这两个字段放进 JSON 会得到 400；普通 x-tenant-id 请求头也不会改变 identity。多租户隔离必须在查询条件中继续保留，不能只在入口检查一次请求头便忘记资源范围。"
        }
      ]
    },
    {
      "id": "trust-map",
      "title": "从不可信输入到受约束写入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/nestjs-validation-authorization.svg",
          "title": "服务端可信边界",
          "alt": "网络输入先经过身份 Guard 与运行时 DTO；服务层从可信 identity 取 tenantId/ownerId，把它们和资源 id、expectedVersion 一起写进数据库条件；公开输出只投影约定字段。",
          "caption": "网络输入先经过身份 Guard 与运行时 DTO；服务层从可信 identity 取 tenantId/ownerId，把它们和资源 id、expectedVersion 一起写进数据库条件；公开输出只投影约定字段。"
        },
        {
          "type": "paragraph",
          "text": "Guard 放在业务操作之前，负责生成 identity 并检查角色。资源所有权留在服务方法，因为它需要把身份与实际资源绑定。HTTP Guard 通过了，不意味着 Service 可以只按 id 查整个表；未来命令行或内部任务调用 Service 时，也应显式传入可信 identity。"
        },
        {
          "type": "paragraph",
          "text": "下面展示完整核心。create 不展开整个 DTO 后直接 save，而是从白名单字段构造新对象；tenantId/ownerId 只取 identity。read 和 update 同时带 id、tenantId、ownerId。即使客户端猜到了别人的整型 id，也无法越过这个过滤条件。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-validation-authorization/src/app.ts",
          "purpose": "完整运行核心：服务端演示身份、DTO、Guard、资源条件、版本比较、输出投影与错误映射。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport {\n  ArgumentsHost,\n  Body,\n  CanActivate,\n  Catch,\n  Controller,\n  ExecutionContext,\n  ExceptionFilter,\n  ForbiddenException,\n  Get,\n  HttpException,\n  Injectable,\n  Module,\n  NotFoundException,\n  Param,\n  ParseIntPipe,\n  Patch,\n  Post,\n  Req,\n  UnauthorizedException,\n  ValidationPipe,\n  ConflictException,\n} from \"@nestjs/common\";\nimport { APP_GUARD, NestFactory } from \"@nestjs/core\";\nimport { TypeOrmModule } from \"@nestjs/typeorm\";\nimport { DataSource } from \"typeorm\";\nimport {\n  IsInt,\n  IsOptional,\n  IsString,\n  Max,\n  MaxLength,\n  Min,\n  MinLength,\n} from \"class-validator\";\nimport type { Request } from \"express\";\nimport { AuditEntity, Note, NoteEntity, OwnerEntity } from \"./model\";\nimport { databaseUrl } from \"./config\";\nexport type Identity = {\n  tenantId: string;\n  ownerId: string;\n  role: \"writer\" | \"reader\";\n};\ntype AuthRequest = Request & { identity: Identity };\nconst identities: Record<string, Identity> = {\n  \"alice-demo\": { tenantId: \"tenant-a\", ownerId: \"alice\", role: \"writer\" },\n  \"alice-readonly-demo\": {\n    tenantId: \"tenant-a\",\n    ownerId: \"alice\",\n    role: \"reader\",\n  },\n  \"bob-demo\": { tenantId: \"tenant-b\", ownerId: \"bob\", role: \"writer\" },\n  \"bob-a-demo\": { tenantId: \"tenant-a\", ownerId: \"bob\", role: \"writer\" },\n};\n@Injectable()\nclass IdentityGuard implements CanActivate {\n  canActivate(context: ExecutionContext) {\n    const req = context.switchToHttp().getRequest<AuthRequest>();\n    const auth = req.headers.authorization;\n    const identity = auth?.startsWith(\"Bearer \")\n      ? Object.hasOwn(identities, auth.slice(7))\n        ? identities[auth.slice(7)]\n        : undefined\n      : undefined;\n    if (!identity) throw new UnauthorizedException(\"identity required\");\n    req.identity = identity;\n    if (req.method !== \"GET\" && identity.role !== \"writer\")\n      throw new ForbiddenException(\"write permission required\");\n    return true;\n  }\n}\nexport class CreateNoteDto {\n  @IsString() @MinLength(1) @MaxLength(80) title!: string;\n  @IsOptional() @IsString() @MaxLength(2000) body?: string | null;\n}\nexport class UpdateNoteDto extends CreateNoteDto {\n  @IsInt() @Min(1) @Max(2147483646) expectedVersion!: number;\n}\nexport function publicNote(note: Note) {\n  return {\n    id: note.id,\n    title: note.title,\n    body: note.body,\n    amount: note.amount,\n    version: note.version,\n    createdAt: note.createdAt.toISOString(),\n  };\n}\n@Injectable()\nexport class NotesService {\n  operations = 0;\n  constructor(private readonly source: DataSource) {}\n  async read(identity: Identity, id: number) {\n    this.operations++;\n    const note = await this.source.getRepository(NoteEntity).findOneBy({\n      id,\n      tenantId: identity.tenantId,\n      ownerId: identity.ownerId,\n    });\n    if (!note) throw new NotFoundException();\n    return publicNote(note);\n  }\n  async create(identity: Identity, input: CreateNoteDto) {\n    this.operations++;\n    return this.source.transaction(async (manager) => {\n      const note = await manager.getRepository(NoteEntity).save({\n        tenantId: identity.tenantId,\n        ownerId: identity.ownerId,\n        title: input.title,\n        body: input.body ?? null,\n      });\n      await manager\n        .getRepository(AuditEntity)\n        .insert({ noteId: note.id, action: \"create\" });\n      return publicNote(note);\n    });\n  }\n  async update(identity: Identity, id: number, input: UpdateNoteDto) {\n    this.operations++;\n    return this.source.transaction(async (manager) => {\n      const notes = manager.getRepository(NoteEntity);\n      const visible = await notes.findOneBy({\n        id,\n        tenantId: identity.tenantId,\n        ownerId: identity.ownerId,\n      });\n      if (!visible) throw new NotFoundException();\n      const result = await notes.update(\n        {\n          id,\n          tenantId: identity.tenantId,\n          ownerId: identity.ownerId,\n          version: input.expectedVersion,\n        },\n        {\n          title: input.title,\n          ...(input.body === undefined ? {} : { body: input.body }),\n          version: input.expectedVersion + 1,\n        },\n      );\n      if (result.affected !== 1)\n        throw new ConflictException(\"version conflict\");\n      await manager\n        .getRepository(AuditEntity)\n        .insert({ noteId: id, action: \"update\" });\n      return publicNote(\n        await notes.findOneByOrFail({\n          id,\n          tenantId: identity.tenantId,\n          ownerId: identity.ownerId,\n        }),\n      );\n    });\n  }\n}\n@Catch()\nclass ApiFilter implements ExceptionFilter {\n  catch(error: unknown, host: ArgumentsHost) {\n    const response = host.switchToHttp().getResponse();\n    const dbCode = (error as { driverError?: { code?: string } })?.driverError\n      ?.code;\n    const status =\n      error instanceof HttpException\n        ? error.getStatus()\n        : dbCode === \"23505\"\n          ? 409\n          : 500;\n    response.status(status).json({\n      status,\n      error:\n        status === 500\n          ? \"INTERNAL\"\n          : status === 409\n            ? \"CONFLICT\"\n            : error instanceof HttpException\n              ? error.getResponse()\n              : \"INTERNAL\",\n    });\n  }\n}\n@Controller(\"notes\")\nclass NotesController {\n  constructor(private readonly notes: NotesService) {}\n  @Get(\":id\") read(\n    @Req() req: AuthRequest,\n    @Param(\"id\", ParseIntPipe) id: number,\n  ) {\n    return this.notes.read(req.identity, id);\n  }\n  @Post() create(@Req() req: AuthRequest, @Body() input: CreateNoteDto) {\n    return this.notes.create(req.identity, input);\n  }\n  @Patch(\":id\") update(\n    @Req() req: AuthRequest,\n    @Param(\"id\", ParseIntPipe) id: number,\n    @Body() input: UpdateNoteDto,\n  ) {\n    return this.notes.update(req.identity, id, input);\n  }\n}\n@Module({\n  imports: [\n    TypeOrmModule.forRootAsync({\n      useFactory: () => ({\n        type: \"postgres\",\n        url: databaseUrl(),\n        entities: [OwnerEntity, NoteEntity, AuditEntity],\n        synchronize: false,\n        retryAttempts: 1,\n        extra: { max: 4, connectionTimeoutMillis: 1000 },\n        invalidWhereValuesBehavior: { null: \"throw\", undefined: \"throw\" },\n      }),\n    }),\n  ],\n  controllers: [NotesController],\n  providers: [NotesService, { provide: APP_GUARD, useClass: IdentityGuard }],\n})\nclass AppModule {}\nexport async function createApp() {\n  const app = await NestFactory.create(AppModule, {\n    logger: false,\n    abortOnError: false,\n  });\n  app.useGlobalPipes(\n    new ValidationPipe({\n      transform: true,\n      whitelist: true,\n      forbidNonWhitelisted: true,\n      transformOptions: { enableImplicitConversion: false },\n    }),\n  );\n  app.useGlobalFilters(new ApiFilter());\n  await app.listen(0, \"127.0.0.1\");\n  return app;\n}"
        }
      ]
    },
    {
      "id": "compare-and-set",
      "title": "版本条件怎样阻止过期写入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "上一章的 read→version+1 只保证修改与审计原子提交，不能防止并发覆盖。本章客户端读到 version=1 后提交 expectedVersion=1，UPDATE 的 WHERE 同时包含 version=1；SET 写成 version=2，affected 必须等于 1。只有真正改到预期版本的那一行，才继续写审计。"
        },
        {
          "type": "paragraph",
          "text": "如果另一个请求已把版本改成 2，过期请求的条件无法命中，affected=0，服务抛 ConflictException，事务回滚且不增加审计。我们没有假定 TypeORM 的某个 version 装饰器自动替所有 update 生成比较条件，而是显式把比较写进代码。"
        },
        {
          "type": "paragraph",
          "text": "先读 visible 是为了决定 404 与后续返回的字段；它不是并发安全的依据。真正决定“有没有覆盖旧版本”的是数据库 UPDATE 条件和受影响行数。这个设计仍需要客户端处理 409，例如重新读取后让用户选择合并，而不是无限重试同一份旧版本。"
        },
        {
          "type": "paragraph",
          "text": "当前应用没有删除笔记入口，所以可见性检查与修改之间的竞争范围较窄。若增加转移所有者或删除，资源条件仍要保留在 UPDATE 中，并设计清楚 404/409 的业务语义。不能把一次测试通过扩大为所有未来操作都没有竞态。"
        }
      ]
    },
    {
      "id": "output-and-errors",
      "title": "输出投影与错误映射也属于接口边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "把数据库实体原样返回很方便，但以后新增的内部字段也可能跟着泄露。本章 publicNote 显式列出 id、title、body、amount、version、createdAt，不公开 tenantId/ownerId。这是一种清楚的投影策略；Nest ClassSerializerInterceptor 也能承担类似职责，但需要遵循实例与装饰器的前提，不能只给普通对象加一个名字就认为序列化规则已经执行。"
        },
        {
          "type": "paragraph",
          "text": "amount 保留字符串，避免 numeric 精度被 Number 改写；createdAt 以 ISO 字符串返回，表示这是 JavaScript Date 的毫秒级视图，本章不承诺微秒游标。输入边界与输出边界各自都要说明语义。"
        },
        {
          "type": "paragraph",
          "text": "未知错误统一返回 500/INTERNAL；数据库唯一约束 23505 映射成 409/CONFLICT，不向客户端吐出表、索引名或 SQL 参数。这个示例只映射本章实际验证的约束错误，不把所有数据库异常都伪装成用户输入有误。数据库断连与程序错误应保留内部可追踪日志，公开响应则控制信息范围。"
        }
      ]
    },
    {
      "id": "deny-cases",
      "title": "拒绝路径有没有副作用：直接看数据库",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "测试先由 alice 创建一条 Alpha。随后逐条执行：不带令牌、未知令牌、只读身份写入、数字 title、伪造 tenantId/ownerId、跨租户读写、同租户其他 owner 读写、缺失资源、字符串版本、版本溢出及toString/constructor/__proto__原型键伪造令牌。每次请求前后都取 notes、audits 和有序完整笔记数据快照，比较完全相同。"
        },
        {
          "type": "paragraph",
          "text": "这比只断言 HTTP 状态更严格：一个接口可能返回 403 却已经写了审计或修改了数据，用户依然遭受副作用。缺失身份还对比服务 operations 计数，确认拒绝发生在业务方法之外。404 路径虽然进入服务查询，但不产生业务写入。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/nestjs-validation-authorization/test.mjs",
          "purpose": "完整真实PG/HTTP验收：15条拒绝路径逐一比较数据库快照、缺失身份不进入服务、正常更新、过期版本和唯一冲突，以及bob自己的资源恢复访问。",
          "kind": "excerpt",
          "code": "import test from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { createApp, NotesService } from \"./dist/app.js\";\nimport { DataSource } from \"typeorm\";\ntest(\n  \"HTTP DTO, identity, resource ownership and deny without side effects\",\n  { timeout: 25000 },\n  async () => {\n    const app = await createApp(),\n      ds = app.get(DataSource);\n    try {\n      const base = await app.getUrl(),\n        call = async (method, path, body, token = \"alice-demo\", extra = {}) => {\n          const r = await fetch(base + path, {\n            method,\n            headers: {\n              \"content-type\": \"application/json\",\n              ...(token ? { authorization: \"Bearer \" + token } : {}),\n              ...extra,\n            },\n            ...(body === undefined ? {} : { body: JSON.stringify(body) }),\n          });\n          return { status: r.status, body: await r.json() };\n        };\n      const state = async () =>\n        JSON.stringify(\n          await ds.query(\n            \"SELECT (SELECT count(*) FROM notes)::int AS notes,(SELECT count(*) FROM audits)::int AS audits,(SELECT json_agg(row_to_json(n) ORDER BY id) FROM notes n) AS data\",\n          ),\n        );\n      let r = await call(\"POST\", \"/notes\", { title: \"Alpha\", body: \"keep me\" });\n      assert.equal(r.status, 201);\n      const id = r.body.id;\n      assert.ok(!(\"tenantId\" in r.body));\n      assert.ok(!(\"ownerId\" in r.body));\n      assert.equal(r.body.amount, \"0.00\");\n      const rejected = [\n        [\"POST\", \"/notes\", { title: \"missing\" }, null, 401],\n        [\"POST\", \"/notes\", { title: \"invalid\" }, \"invalid\", 401],\n        ...[\"toString\", \"constructor\", \"__proto__\"].map((token) => [\n          \"GET\",\n          \"/notes/\" + id,\n          undefined,\n          token,\n          401,\n        ]),\n        [\"POST\", \"/notes\", { title: \"read only\" }, \"alice-readonly-demo\", 403],\n        [\"POST\", \"/notes\", { title: 123 }, \"alice-demo\", 400],\n        [\n          \"POST\",\n          \"/notes\",\n          { title: \"forged\", tenantId: \"tenant-b\", ownerId: \"bob\" },\n          \"alice-demo\",\n          400,\n        ],\n        [\"GET\", \"/notes/\" + id, undefined, \"bob-demo\", 404],\n        [\n          \"PATCH\",\n          \"/notes/\" + id,\n          { title: \"steal\", expectedVersion: 1 },\n          \"bob-demo\",\n          404,\n        ],\n        [\"GET\", \"/notes/\" + id, undefined, \"bob-a-demo\", 404],\n        [\n          \"PATCH\",\n          \"/notes/\" + id,\n          { title: \"steal\", expectedVersion: 1 },\n          \"bob-a-demo\",\n          404,\n        ],\n        [\"GET\", \"/notes/99999\", undefined, \"alice-demo\", 404],\n        [\n          \"PATCH\",\n          \"/notes/\" + id,\n          { title: \"bad version\", expectedVersion: \"1\" },\n          \"alice-demo\",\n          400,\n        ],\n        [\n          \"PATCH\",\n          \"/notes/\" + id,\n          { title: \"overflow\", expectedVersion: 2147483647 },\n          \"alice-demo\",\n          400,\n        ],\n      ];\n      for (const [method, path, body, token, status] of rejected) {\n        const before = await state(),\n          operationsBefore = app.get(NotesService).operations;\n        r = await call(method, path, body, token);\n        assert.equal(r.status, status);\n        if (status === 401)\n          assert.equal(app.get(NotesService).operations, operationsBefore);\n        assert.equal(\n          await state(),\n          before,\n          method + \" \" + token + \" mutated state\",\n        );\n      }\n      const operations = app.get(NotesService).operations;\n      r = await call(\"POST\", \"/notes\", { title: \"denied\" }, null);\n      assert.equal(r.status, 401);\n      assert.equal(app.get(NotesService).operations, operations);\n      r = await call(\n        \"PATCH\",\n        \"/notes/\" + id,\n        { title: \"Updated\", expectedVersion: 1 },\n        \"alice-demo\",\n        { \"x-tenant-id\": \"tenant-b\" },\n      );\n      assert.equal(r.status, 200);\n      assert.equal(r.body.version, 2);\n      assert.equal(r.body.body, \"keep me\");\n      const cleared = await call(\"PATCH\", \"/notes/\" + id, {\n        title: \"Updated\",\n        expectedVersion: 2,\n        body: null,\n      });\n      assert.equal(cleared.status, 200);\n      assert.equal(cleared.body.body, null);\n      const before = await state();\n      r = await call(\"PATCH\", \"/notes/\" + id, {\n        title: \"Stale\",\n        expectedVersion: 1,\n      });\n      assert.equal(r.status, 409);\n      assert.equal(await state(), before);\n      r = await call(\"POST\", \"/notes\", { title: \"Updated\" });\n      assert.equal(r.status, 409);\n      assert.ok(!JSON.stringify(r.body).includes(\"notes_\"));\n      r = await call(\"POST\", \"/notes\", { title: \"Bob private\" }, \"bob-demo\");\n      assert.equal(r.status, 201);\n      r = await call(\"GET\", \"/notes/\" + r.body.id, undefined, \"bob-demo\");\n      assert.equal(r.status, 200);\n      console.log(\n        JSON.stringify({\n          denyCases: rejected.length,\n          denialsNoWrites: true,\n          missingIdentity: 401,\n          roleDenied: 403,\n          hiddenResource: 404,\n          versionConflict: 409,\n          recovery: true,\n        }),\n      );\n    } finally {\n      await app.close();\n      assert.equal(ds.isInitialized, false);\n    }\n  },\n);"
        },
        {
          "type": "paragraph",
          "text": "本次实际 1 个集成测试通过，其中包含 15 条明确的拒绝用例与附加恢复/冲突断言。401/403/404/400 均符合策略；15 次拒绝数据库快照不变；合法更新携带伪造 x-tenant-id 仍只修改服务端 identity 所属笔记；过期版本 409、唯一冲突 409，不泄露约束名；bob 可以创建并读取自己的笔记。这里没有把“15条用例”冒充 node:test 的15个测试。"
        }
      ]
    },
    {
      "id": "install",
      "title": "独立运行与人工复现",
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
          "text": "Node24.14.1、PostgreSQL17.4 下，npm ci --ignore-scripts、npm test。PG_BIN 默认 /Library/PostgreSQL/17/bin，可以改为同版本二进制目录。测试仅使用私有 PGDATA 和 55482；若端口占用则拒绝，不访问用户 5432。每章 ZIP 复制必要实体和夹具，因此不需要先把第三章项目部署起来。"
        },
        {
          "type": "paragraph",
          "text": "手动 npm run build、npm start，取得打印的 URL。先用 Bearer alice-demo POST /notes {\"title\":\"Alpha\"} 得到 id 与 version=1，再用 Bearer bob-demo GET /notes/id 应返回404；alice PATCH同路径 {\"title\":\"Beta\",\"expectedVersion\":1} 返回version=2，再提交旧版本得到409。额外的 tenantId 字段则在 DTO 阶段400。"
        },
        {
          "type": "paragraph",
          "text": "教学令牌是公开数据，不要把真实业务令牌填进项目文件。样例仅演示服务端边界，未实现 OAuth、JWT 签名、CSRF、浏览器 Cookie 策略或速率限制；这些要依据实际客户端与身份协议补齐。事务、授权与输入校验形成互补保护，而不是一个万能装饰器。"
        }
      ]
    },
    {
      "id": "review",
      "title": "现在应当怎样检查一条新路由",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "新增路由时，依次写下客户端可控制什么、可信身份从哪里来、资源条件包含哪些维度、拒绝发生前是否已有写入、公开输出允许出现哪些字段。然后为每个拒绝路径取数据库快照。这样权限规则能够落到具体 SQL 和结果，而不会停留在“用户已登录”的模糊假设。"
        },
        {
          "type": "paragraph",
          "text": "下一篇讨论更难的一条边界：请求已经超时或客户端走了，外部工作是否真的停止？如果任务必须继续，谁负责保存它、重试它并避免重复写入？这时 HTTP 状态码本身已经不足以证明系统行为。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Nest 运行时校验",
      "url": "https://docs.nestjs.com/techniques/validation"
    },
    {
      "title": "Nest 授权",
      "url": "https://docs.nestjs.com/security/authorization"
    },
    {
      "title": "Nest 序列化",
      "url": "https://docs.nestjs.com/techniques/serialization"
    },
    {
      "title": "Nest v12.2.0 ValidationPipe",
      "url": "https://github.com/nestjs/nest/blob/v12.2.0/packages/common/pipes/validation.pipe.ts"
    },
    {
      "title": "PostgreSQL17 UPDATE",
      "url": "https://www.postgresql.org/docs/17/sql-update.html"
    }
  ]
};
export default article;
