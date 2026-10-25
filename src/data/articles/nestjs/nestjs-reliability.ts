import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "nestjs-reliability",
  "topic": "nestjs",
  "title": "可靠交互：超时、取消、后台任务与幂等入口",
  "description": "用真实上游连接、事务取消反例和可恢复的 PostgreSQL 任务，分清停止等待、取消工作、业务幂等与持久任务所有权。",
  "minutes": 45,
  "labMinutes": 20,
  "tags": [
    "NestJS",
    "Node.js",
    "TypeScript",
    "租户笔记服务",
    "PostgreSQL",
    "TypeORM"
  ],
  "scope": "用真实上游连接、事务取消反例和可恢复的 PostgreSQL 任务，分清停止等待、取消工作、业务幂等与持久任务所有权。",
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
      "path": "nestjs-reliability.zip"
    },
    {
      "label": "阅读运行说明",
      "path": "nestjs-reliability/README.md"
    }
  ],
  "sections": [
    {
      "id": "three-lifetimes",
      "title": "请求、工作、业务结果：先分清三种寿命",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "超时表示等待者不愿再等；取消表示向执行者提出停止工作的请求；幂等表示重复调用在约定范围内不重复产生业务效果。这三个概念作用于不同位置。一个 HTTP 请求已经结束，数据库事务可能仍然执行，外部系统也可能早已接收了消息。"
        },
        {
          "type": "paragraph",
          "text": "上一章已经把 DTO、演示身份、tenant/owner 和版本条件连到数据库。本章保留固定教学身份 Guard，但缩小接口到两种动作：一个接口先调用自有上游，再创建笔记；另一个接口把创建笔记的任务持久化，供受控 worker 处理。固定令牌只用来维持相同身份边界，不是生产认证。"
        },
        {
          "type": "paragraph",
          "text": "我们需要分别回答：等待到期时，底层 HTTP 连接有没有断开？取消发生在数据库事务之后时，写入还会不会提交？客户端重发相同请求时，数据库里有几份任务和笔记？worker 拿到任务后消失，谁能重新处理？把这些问题都叫“接口超时处理”会掩盖不同失败窗口。"
        }
      ]
    },
    {
      "id": "rxjs-timeout",
      "title": "RxJS timeout 为什么不等于撤销副作用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Interceptor 很适合统一限制响应等待时间，但它能控制的是结果流。把一个已经启动的 Promise 包装成 Observable，再给它加 timeout，订阅者超时取消订阅，并不会让普通 Promise 内部的数据库调用倒着运行。被调用 API 必须另有明确的取消机制。"
        },
        {
          "type": "paragraph",
          "text": "本章第一个测试启动一个等待60ms后改变计数的 Promise，在它外面设置5ms的 RxJS timeout。等待者确实收到 TimeoutError；随后等待原 Promise 结束，计数仍然从0变成1。这是确定性的反例，不需要调用付费服务，也没有拿主观“感觉卡住”判断取消。完整测试在下文给出。"
        },
        {
          "type": "paragraph",
          "text": "因此，在 Nest Interceptor 中使用 timeout 可以作为接口预算策略，但业务不能从“客户端已经收到504”推导出“什么都没发生”。对于请求中调用的 fetch，需要把 AbortSignal 传下去；对于数据库，需要知道驱动是否支持取消、取消针对哪条语句、事务是否已提交。"
        }
      ]
    },
    {
      "id": "upstream-abort",
      "title": "把取消传到真正做事的上游连接",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "PreviewService 把请求断开信号与 AbortSignal.timeout 合并，并把结果传给 fetch。预算覆盖获取响应与消费响应体；只等响应头到达还不够，因为大响应体也可能永远读不完。成功读完后再检查 signal，然后才进入数据库阶段。"
        },
        {
          "type": "paragraph",
          "text": "控制器同时监听 req.aborted 和 res.close。只监听 req.close 不可靠，因为请求体正常读取完成也可能触发相关生命周期；客户端在等待响应时离开，需要从响应是否 writableEnded 判断。finally 中移除这次请求安装的监听器，服务 active 计数也在 finally 中递减。"
        },
        {
          "type": "paragraph",
          "text": "phase 明确分成 upstream 与 database。只有上游阶段确实发生 abort，才映射成上游取消504；已经进入数据库后的错误按数据库路径继续抛出。否则一个恰好同时到来的预算超时可能把唯一约束错误错误归因为网络超时。"
        },
        {
          "type": "figure",
          "src": "figures/nestjs-reliability.svg",
          "title": "短请求与持久任务的两种所有权",
          "alt": "上游阶段允许取消并在DB前检查；进入事务后必须接受提交窗口。持久任务从pending领成running，令牌更换后旧owner被fence，完成后done，尝试耗尽或最后一次租约过期进入failed。",
          "caption": "上游阶段允许取消并在DB前检查；进入事务后必须接受提交窗口。持久任务从pending领成running，令牌更换后旧owner被fence，完成后done，尝试耗尽或最后一次租约过期进入failed。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-reliability/src/app.ts",
          "purpose": "完整 HTTP 核心：固定教学 Guard、DTO、请求断开监听、fetch预算传播、阶段区分和幂等任务入口。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport {\n  Body,\n  Controller,\n  Get,\n  Inject,\n  Injectable,\n  Module,\n  Post,\n  Req,\n  Res,\n  ServiceUnavailableException,\n  ValidationPipe,\n  Headers,\n  BadRequestException,\n  GatewayTimeoutException,\n  UseGuards,\n} from \"@nestjs/common\";\nimport { NestFactory } from \"@nestjs/core\";\nimport { TypeOrmModule } from \"@nestjs/typeorm\";\nimport { DataSource } from \"typeorm\";\nimport { IsString, MinLength, MaxLength } from \"class-validator\";\nimport type { Request, Response } from \"express\";\nimport { AuditEntity, NoteEntity, OwnerEntity } from \"./model\";\nimport { databaseUrl } from \"./config\";\nimport { DurableJobs } from \"./reliability\";\nimport { IdentityGuard, Identity, AuthRequest } from \"./auth\";\nconst UPSTREAM = Symbol(\"UPSTREAM\");\nexport type Options = {\n  url: string;\n  budgetMs: number;\n  waitOnDatabaseLock?: boolean;\n};\nclass TitleInput {\n  @IsString() @MinLength(1) @MaxLength(80) title!: string;\n}\n@Injectable()\nexport class PreviewService {\n  active = 0;\n  cancelled = 0;\n  constructor(\n    private readonly ds: DataSource,\n    @Inject(UPSTREAM) private readonly options: Options,\n  ) {}\n  async create(identity: Identity, title: string, disconnect: AbortSignal) {\n    const signal = AbortSignal.any([\n      disconnect,\n      AbortSignal.timeout(this.options.budgetMs),\n    ]);\n    this.active++;\n    let phase: \"upstream\" | \"database\" = \"upstream\";\n    try {\n      const response = await fetch(this.options.url, { signal });\n      if (!response.ok)\n        throw new ServiceUnavailableException(\"upstream failed\");\n      await response.text();\n      signal.throwIfAborted();\n      phase = \"database\";\n      return await this.ds.transaction(async (manager) => {\n        signal.throwIfAborted();\n        if (this.options.waitOnDatabaseLock)\n          await manager.query(\n            \"SELECT pg_advisory_xact_lock(642) /* nest-preview-barrier */\",\n          );\n        const note = await manager.getRepository(NoteEntity).save({\n          tenantId: identity.tenantId,\n          ownerId: identity.ownerId,\n          title,\n        });\n        await manager\n          .getRepository(AuditEntity)\n          .insert({ noteId: note.id, action: \"create\" });\n        return { id: note.id, title: note.title };\n      });\n    } catch (error) {\n      if (phase === \"upstream\" && signal.aborted) {\n        this.cancelled++;\n        throw new GatewayTimeoutException(\n          \"upstream cancelled before database work\",\n        );\n      }\n      throw error;\n    } finally {\n      this.active--;\n    }\n  }\n}\n@Controller()\nclass ApiController {\n  constructor(\n    private readonly preview: PreviewService,\n    private readonly jobs: DurableJobs,\n  ) {}\n  @Post(\"notes/from-upstream\")\n  @UseGuards(IdentityGuard)\n  async create(\n    @Body() input: TitleInput,\n    @Req() req: AuthRequest,\n    @Res({ passthrough: true }) res: Response,\n  ) {\n    const disconnected = new AbortController();\n    const abort = () => {\n      if (!res.writableEnded)\n        disconnected.abort(new Error(\"CLIENT_DISCONNECTED\"));\n    };\n    res.once(\"close\", abort);\n    req.once(\"aborted\", abort);\n    try {\n      return await this.preview.create(\n        req.identity,\n        input.title,\n        disconnected.signal,\n      );\n    } finally {\n      res.removeListener(\"close\", abort);\n      req.removeListener(\"aborted\", abort);\n    }\n  }\n  @Post(\"jobs\") @UseGuards(IdentityGuard) enqueue(\n    @Req() req: AuthRequest,\n    @Headers(\"idempotency-key\") key: string | undefined,\n    @Body() input: TitleInput,\n  ) {\n    if (!key || !/^[a-zA-Z0-9_-]{1,64}$/.test(key))\n      throw new BadRequestException(\"idempotency-key required\");\n    return this.jobs\n      .enqueue(key, input.title, req.identity)\n      .then((job) => ({\n        id: job.id,\n        status: job.status,\n        resultId: job.resultId,\n      }));\n  }\n  @Get(\"health\") health() {\n    return { ok: true };\n  }\n}\nexport async function createApp(options: Options) {\n  const url = new URL(options.url);\n  if (url.hostname !== \"127.0.0.1\")\n    throw new Error(\"only owned loopback upstream accepted\");\n  if (\n    !Number.isInteger(options.budgetMs) ||\n    options.budgetMs < 1 ||\n    options.budgetMs > 5000\n  )\n    throw new Error(\"invalid budget\");\n  @Module({\n    imports: [\n      TypeOrmModule.forRootAsync({\n        useFactory: () => ({\n          type: \"postgres\",\n          url: databaseUrl(),\n          entities: [OwnerEntity, NoteEntity, AuditEntity],\n          synchronize: false,\n          retryAttempts: 1,\n          extra: { max: 4, connectionTimeoutMillis: 1000 },\n          invalidWhereValuesBehavior: { null: \"throw\", undefined: \"throw\" },\n        }),\n      }),\n    ],\n    providers: [\n      IdentityGuard,\n      DurableJobs,\n      PreviewService,\n      { provide: UPSTREAM, useValue: options },\n    ],\n    controllers: [ApiController],\n  })\n  class AppModule {}\n  const app = await NestFactory.create(AppModule, {\n    logger: false,\n    abortOnError: false,\n  });\n  app.useGlobalPipes(\n    new ValidationPipe({\n      transform: true,\n      whitelist: true,\n      forbidNonWhitelisted: true,\n    }),\n  );\n  await app.listen(0, \"127.0.0.1\");\n  return app;\n}"
        },
        {
          "type": "paragraph",
          "text": "正常启动的自有上游200ms返回，预算500ms；POST /notes/from-upstream {\"title\":\"preview\"} 能保存一条笔记与审计。测试把上游延迟拉到1000ms、预算缩到60ms，确认API504、自有上游响应连接close、完成计数0、服务active=0，数据库没有笔记。随后直接断开真实客户端连接，观察第二次上游连接也被取消。这些才是“底层工作收到取消”的证据。"
        }
      ]
    },
    {
      "id": "commit-window",
      "title": "取消的边界：事务开始后仍然可能提交",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "请注意关键边界：本项目没有把 AbortSignal 传进 pg 的事务执行，也没有实现 PostgreSQL CancelRequest。进入事务时的 signal.throwIfAborted 只是一个检查点，不能阻止检查点之后发生的新取消，更不能撤销已经提交的数据。"
        },
        {
          "type": "paragraph",
          "text": "为避免这段限制停留在口头上，测试使用一条独立连接持有事务级 advisory lock。应用读取完快速上游后进入数据库事务，并等待相同锁；监控连接确认它已在 PostgreSQL 等锁。此时断开客户端，并让请求预算到期，再释放锁。应用随后保存笔记、写审计、提交，尽管客户端已经接收不到结果。"
        },
        {
          "type": "paragraph",
          "text": "实际断言是一条 committed-after-disconnect 笔记和一条审计都存在。这个反例说明“HTTP断开”与“业务没有发生”没有必然关系。监控使用独立autocommit连接，避免长事务内统计快照缓存让观察一直看不到新等待者。不要只用固定sleep猜测事务已经走到哪个位置。"
        },
        {
          "type": "paragraph",
          "text": "如果产品要求用户超时后能查结果，就应提供业务操作ID和可查询状态；如果要撤销，必须设计一个新的补偿动作，而不是假定网络断开等同于回滚。强行中断数据库连接也可能处于提交结果未知窗口，重试仍需要幂等性保护。"
        }
      ]
    },
    {
      "id": "idempotency",
      "title": "幂等入口：同一个键代表同一份输入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "POST /jobs 必须带 Idempotency-Key，它与 tenantId、ownerId 共同组成唯一范围。相同用户用相同键重发同一 title，返回同一个任务的公开投影id/status/resultId；租约token、fingerprint与owner等内部信息不直接返回客户端；同键却换了 title 则409。指纹由明确的业务输入生成，不把整个原始JSON的属性顺序当成业务等价性。"
        },
        {
          "type": "paragraph",
          "text": "数据库唯一约束承担并发仲裁，不能先 SELECT 发现没有任务再 INSERT。两个真实 HTTP 请求同时提交同键，INSERT ON CONFLICT DO NOTHING 保留一行，随后的 SELECT 检查已有指纹。我们没有把内存 Map 当作跨重启幂等记录。"
        },
        {
          "type": "paragraph",
          "text": "幂等记录只保护本接口定义的业务范围。不同键创建同标题仍可能触发tenant/title唯一约束；外部支付等副作用不会因为这里有一行job就自动exactly-once。本章worker只在同一个PG事务中写笔记、审计和任务done，因此可以共同提交。"
        }
      ]
    },
    {
      "id": "durable-jobs",
      "title": "持久任务怎样获得与失去处理权",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "jobs表保存状态、尝试次数、租约截止、随机leaseToken和结果id。claim通过行锁与SKIP LOCKED选择一条可处理任务，用单条更新把它标记running并返回领取令牌。QueryRunner使用结构化QueryResult.records读取UPDATE RETURNING结果，并在finally释放；不能把不同SQL种类的raw返回形态一概当成同一种数组。"
        },
        {
          "type": "paragraph",
          "text": "完成时再在事务中锁住任务行，检查status仍为running且token等于本次领取的token，然后写笔记、审计和done。这个token是提交门槛：如果任务已经被另一个worker重领，旧worker提交会得到LEASE_LOST，不会再写第二份笔记。"
        },
        {
          "type": "paragraph",
          "text": "本章的租约含义是：到期后允许其他worker重领，不是时钟一过期旧worker立即绝对丧失写权。旧token在被新owner替换前仍可能完成；因此不能用本实现证明“租约截止就是所有外部动作的绝对停止时间”。我们没有外部副作用，且事务完成路径重新锁行检查token，这个范围内可以证明不重复提交。"
        },
        {
          "type": "paragraph",
          "text": "还有一个容易漏掉的窗口：第3次领取后进程崩溃，没人执行catch，任务会停在running。claim开始前会把“attempts>=3且租约已过期”的running任务移到failed；否则只筛attempts<3会让它永远卡住。对于活着捕获错误的worker，失败后前两次回pending，第3次直接failed。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-reliability/src/reliability.ts",
          "purpose": "完整持久任务实现：输入指纹、唯一键、领取、结构化结果、令牌隔离、共同提交、失败上限和最终租约回收。",
          "kind": "excerpt",
          "code": "import { ConflictException, Injectable } from \"@nestjs/common\";\nimport { DataSource } from \"typeorm\";\nimport { randomUUID, createHash } from \"node:crypto\";\nimport { AuditEntity, NoteEntity } from \"./model\";\nimport { Identity } from \"./auth\";\nexport interface Job {\n  id: number;\n  tenantId: string;\n  ownerId: string;\n  key: string;\n  title: string;\n  status: string;\n  attempts: number;\n  leaseToken: string;\n  resultId: number | null;\n  fingerprint: string;\n}\n@Injectable()\nexport class DurableJobs {\n  constructor(private readonly source: DataSource) {}\n  async enqueue(key: string, title: string, identity: Identity) {\n    const fingerprint = createHash(\"sha256\")\n      .update(JSON.stringify({ title }))\n      .digest(\"hex\");\n    await this.source.query(\n      'INSERT INTO jobs (\"tenantId\",\"ownerId\",key,fingerprint,title) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (\"tenantId\",\"ownerId\",key) DO NOTHING',\n      [identity.tenantId, identity.ownerId, key, fingerprint, title],\n    );\n    const [job] = (await this.source.query(\n      'SELECT * FROM jobs WHERE \"tenantId\"=$1 AND \"ownerId\"=$2 AND key=$3',\n      [identity.tenantId, identity.ownerId, key],\n    )) as Job[];\n    if (job.fingerprint !== fingerprint)\n      throw new ConflictException(\"same key, different payload\");\n    return job;\n  }\n  async claim(leaseMs = 100) {\n    await this.source.query(\n      `UPDATE jobs SET status='failed',\"leaseToken\"=NULL,\"leaseUntil\"=NULL WHERE status='running' AND attempts>=3 AND \"leaseUntil\"<clock_timestamp()`,\n    );\n    const token = randomUUID();\n    const runner = this.source.createQueryRunner();\n    try {\n      const result = await runner.query(\n        `WITH picked AS (SELECT id FROM jobs WHERE attempts<3 AND (status='pending' OR (status='running' AND \"leaseUntil\"<clock_timestamp())) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs j SET status='running',attempts=attempts+1,\"leaseToken\"=$1,\"leaseUntil\"=clock_timestamp()+($2::int * interval '1 millisecond') FROM picked WHERE j.id=picked.id RETURNING j.*`,\n        [token, leaseMs],\n        true,\n      );\n      return (result.records[0] as Job | undefined) ?? null;\n    } finally {\n      await runner.release();\n    }\n  }\n  async complete(claim: Job) {\n    return this.source.transaction(async (manager) => {\n      const [job] = (await manager.query(\n        \"SELECT * FROM jobs WHERE id=$1 FOR UPDATE\",\n        [claim.id],\n      )) as Job[];\n      if (\n        !job ||\n        job.status !== \"running\" ||\n        job.leaseToken !== claim.leaseToken\n      )\n        throw new Error(\"LEASE_LOST\");\n      // Token fencing prevents a replaced owner from committing. This worker does no external side effects.\n      const note = await manager.getRepository(NoteEntity).save({\n        tenantId: job.tenantId,\n        ownerId: job.ownerId,\n        title: job.title,\n      });\n      await manager\n        .getRepository(AuditEntity)\n        .insert({ noteId: note.id, action: \"create\" });\n      await manager.query(\n        'UPDATE jobs SET status=\\'done\\',\"resultId\"=$1,\"leaseToken\"=NULL,\"leaseUntil\"=NULL WHERE id=$2',\n        [note.id, job.id],\n      );\n      return note.id;\n    });\n  }\n  async runOnce() {\n    const claim = await this.claim();\n    if (!claim) return null;\n    try {\n      return await this.complete(claim);\n    } catch (error) {\n      await this.source.query(\n        \"UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,\\\"leaseToken\\\"=NULL,\\\"leaseUntil\\\"=NULL WHERE id=$1 AND \\\"leaseToken\\\"=$2 AND status='running'\",\n        [claim.id, claim.leaseToken],\n      );\n      throw error;\n    }\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "这里用runOnce明确表达一次处理，由测试或操作人员持有这个Promise。没有启动一个无人持有的setInterval然后声称“可靠队列”。要长期部署，需要有界并发worker循环、进程监督、任务积压与失败告警；这些运行职责不改变数据库里的状态所有权协议。"
        }
      ]
    },
    {
      "id": "schema-and-fixtures",
      "title": "任务表与演示身份仍然需要明确边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "sql",
          "filename": "examples/nestjs-reliability/schema.sql",
          "purpose": "完整本章空库schema：与前章一致的owners/notes/audits，加持久jobs与用户范围唯一键。",
          "kind": "excerpt",
          "code": "CREATE TABLE owners (\"tenantId\" varchar NOT NULL,id varchar NOT NULL,name varchar NOT NULL,PRIMARY KEY(\"tenantId\",id));\nCREATE TABLE notes (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\"tenantId\" varchar NOT NULL,\"ownerId\" varchar NOT NULL,title varchar NOT NULL,body varchar DEFAULT NULL,amount numeric(20,2) NOT NULL DEFAULT '0.00',\"createdAt\" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(\"tenantId\",title),FOREIGN KEY(\"tenantId\",\"ownerId\") REFERENCES owners(\"tenantId\",id));\nCREATE TABLE audits (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\"noteId\" integer NOT NULL REFERENCES notes(id),action varchar NOT NULL CHECK(action IN ('create','update')));\nINSERT INTO owners VALUES ('tenant-a','alice','Alice'),('tenant-a','bob','Bob A'),('tenant-b','bob','Bob B');\nCREATE TABLE jobs (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,\"tenantId\" varchar NOT NULL,\"ownerId\" varchar NOT NULL,key varchar NOT NULL,fingerprint varchar NOT NULL,title varchar NOT NULL,status varchar NOT NULL DEFAULT 'pending' CHECK(status IN('pending','running','done','failed')),attempts integer NOT NULL DEFAULT 0,\"leaseToken\" uuid,\"leaseUntil\" timestamptz,\"resultId\" integer REFERENCES notes(id),UNIQUE(\"tenantId\",\"ownerId\",key));"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-reliability/src/auth.ts",
          "purpose": "完整固定身份Guard：Map查找不接受对象原型键，租户与owner只由服务端登记产生。",
          "kind": "excerpt",
          "code": "import {\n  CanActivate,\n  ExecutionContext,\n  ForbiddenException,\n  Injectable,\n  UnauthorizedException,\n} from \"@nestjs/common\";\nimport type { Request } from \"express\";\nexport type Identity = {\n  tenantId: string;\n  ownerId: string;\n  role: \"writer\" | \"reader\";\n};\nexport type AuthRequest = Request & { identity: Identity };\nconst identities = new Map<string, Identity>([\n  [\"alice-demo\", { tenantId: \"tenant-a\", ownerId: \"alice\", role: \"writer\" }],\n  [\"bob-demo\", { tenantId: \"tenant-b\", ownerId: \"bob\", role: \"writer\" }],\n  [\n    \"alice-readonly-demo\",\n    { tenantId: \"tenant-a\", ownerId: \"alice\", role: \"reader\" },\n  ],\n]);\n@Injectable()\nexport class IdentityGuard implements CanActivate {\n  canActivate(context: ExecutionContext) {\n    const req = context.switchToHttp().getRequest<AuthRequest>();\n    const value = req.headers.authorization;\n    const identity = value?.startsWith(\"Bearer \")\n      ? identities.get(value.slice(7))\n      : undefined;\n    if (!identity) throw new UnauthorizedException();\n    if (req.method !== \"GET\" && identity.role !== \"writer\")\n      throw new ForbiddenException();\n    req.identity = identity;\n    return true;\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "下载项目自足，复制了必要实体和配置，不需要先启动前章服务。start启动临时私有PG与自有loopback上游，退出时清理；这是方便复现的环境，不是部署后会长期保留的生产数据卷。要观察worker，使用本项目导出的DurableJobs.runOnce；网页仅把示例作为源码提供，不在GitHub Pages执行服务端任务。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "四组实测分别证明什么",
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
          "type": "code",
          "language": "javascript",
          "filename": "examples/nestjs-reliability/test.mjs",
          "purpose": "完整四组测试：普通Promise的超时反例、真实HTTP取消、事务后取消仍提交、持久幂等/重启/租约和失败恢复。",
          "kind": "excerpt",
          "code": "import test from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { createServer, request } from \"node:http\";\nimport { setTimeout as delay } from \"node:timers/promises\";\nimport { lastValueFrom, from, timeout } from \"rxjs\";\nimport { createApp, PreviewService } from \"./dist/app.js\";\nimport { DurableJobs } from \"./dist/reliability.js\";\nimport { DataSource } from \"typeorm\";\nasync function until(check) {\n  const end = Date.now() + 3000;\n  while (Date.now() < end) {\n    if (await check()) return;\n    await delay(5);\n  }\n  throw new Error(\"barrier deadline\");\n}\nasync function fixture(waitMs = 1000) {\n  let begun = 0,\n    closed = 0,\n    completed = 0;\n  const server = createServer((_req, res) => {\n    begun++;\n    const timer = setTimeout(() => {\n      completed++;\n      res.end(\"ok\");\n    }, waitMs);\n    res.once(\"close\", () => {\n      clearTimeout(timer);\n      closed++;\n    });\n  });\n  await new Promise((r) => server.listen(0, \"127.0.0.1\", r));\n  return {\n    url: `http://127.0.0.1:${server.address().port}`,\n    get begun() {\n      return begun;\n    },\n    get closed() {\n      return closed;\n    },\n    get completed() {\n      return completed;\n    },\n    close: () => new Promise((r) => server.close(r)),\n  };\n}\ntest(\n  \"RxJS timeout does not cancel a Promise side effect\",\n  { timeout: 5000 },\n  async () => {\n    let changed = 0;\n    const work = delay(60).then(() => {\n      changed++;\n      return \"done\";\n    });\n    await assert.rejects(lastValueFrom(from(work).pipe(timeout(5))), /Timeout/);\n    await work;\n    assert.equal(changed, 1);\n  },\n);\ntest(\n  \"real upstream budget timeout and client disconnect abort work and clear listeners\",\n  { timeout: 15000 },\n  async () => {\n    const upstream = await fixture(),\n      app = await createApp({ url: upstream.url, budgetMs: 60 });\n    try {\n      const base = await app.getUrl();\n      let response = await fetch(base + \"/notes/from-upstream\", {\n        method: \"POST\",\n        headers: {\n          \"content-type\": \"application/json\",\n          authorization: \"Bearer alice-demo\",\n        },\n        body: JSON.stringify({ title: \"timeout\" }),\n      });\n      assert.equal(response.status, 504);\n      await until(() => upstream.closed === 1);\n      assert.equal(upstream.completed, 0);\n      assert.equal(app.get(PreviewService).active, 0);\n      assert.equal(\n        (\n          await app\n            .get(DataSource)\n            .query(\"SELECT count(*)::int AS n FROM notes\")\n        )[0].n,\n        0,\n      );\n      const before = upstream.begun;\n      const client = request(\n        base + \"/notes/from-upstream\",\n        {\n          method: \"POST\",\n          headers: {\n            \"content-type\": \"application/json\",\n            authorization: \"Bearer alice-demo\",\n          },\n        },\n        (res) => res.resume(),\n      );\n      client.on(\"error\", () => {});\n      client.end(JSON.stringify({ title: \"disconnected\" }));\n      await until(() => upstream.begun > before);\n      client.destroy();\n      await until(\n        () => app.get(PreviewService).active === 0 && upstream.closed === 2,\n      );\n      assert.equal(upstream.completed, 0);\n      assert.equal(app.get(PreviewService).cancelled, 2);\n      assert.equal(\n        (\n          await app\n            .get(DataSource)\n            .query(\"SELECT count(*)::int AS n FROM notes\")\n        )[0].n,\n        0,\n      );\n    } finally {\n      await app.close();\n      await upstream.close();\n    }\n  },\n);\ntest(\n  \"cancellation after transaction entry does not undo PG commit\",\n  { timeout: 15000 },\n  async () => {\n    const upstream = await fixture(1),\n      app = await createApp({\n        url: upstream.url,\n        budgetMs: 100,\n        waitOnDatabaseLock: true,\n      });\n    const { Client } = await import(\"pg\");\n    const blocker = new Client({ connectionString: process.env.DATABASE_URL });\n    await blocker.connect();\n    try {\n      await blocker.query(\"BEGIN\");\n      await blocker.query(\"SELECT pg_advisory_xact_lock(642)\");\n      const client = request(\n        (await app.getUrl()) + \"/notes/from-upstream\",\n        {\n          method: \"POST\",\n          headers: {\n            \"content-type\": \"application/json\",\n            authorization: \"Bearer alice-demo\",\n          },\n        },\n        (res) => res.resume(),\n      );\n      client.on(\"error\", () => {});\n      client.end(JSON.stringify({ title: \"committed-after-disconnect\" }));\n      await until(async () =>\n        Boolean(\n          (\n            await app\n              .get(DataSource)\n              .query(\n                \"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND query LIKE '%nest-preview-barrier%') AS waiting\",\n              )\n          )[0].waiting,\n        ),\n      );\n      client.destroy();\n      await delay(130);\n      await blocker.query(\"COMMIT\");\n      await until(() => app.get(PreviewService).active === 0);\n      const ds = app.get(DataSource);\n      assert.equal(\n        (\n          await ds.query(\n            \"SELECT count(*)::int AS n FROM notes WHERE title='committed-after-disconnect'\",\n          )\n        )[0].n,\n        1,\n      );\n      assert.equal(\n        (await ds.query(\"SELECT count(*)::int AS n FROM audits\"))[0].n,\n        1,\n      );\n      await ds.query(\"TRUNCATE audits,notes RESTART IDENTITY CASCADE\");\n    } finally {\n      await blocker.query(\"ROLLBACK\").catch(() => {});\n      await blocker.end();\n      await app.close();\n      await upstream.close();\n    }\n  },\n);\ntest(\n  \"persistent idempotency, lease replacement fencing, restart recovery and poison bound\",\n  { timeout: 20000 },\n  async () => {\n    const upstream = await fixture();\n    let app = await createApp({ url: upstream.url, budgetMs: 500 });\n    try {\n      let base = await app.getUrl(),\n        jobs = app.get(DurableJobs),\n        ds = app.get(DataSource);\n      const submit = async (title) => {\n        const r = await fetch(base + \"/jobs\", {\n          method: \"POST\",\n          headers: {\n            \"content-type\": \"application/json\",\n            authorization: \"Bearer alice-demo\",\n            \"idempotency-key\": \"key-one\",\n          },\n          body: JSON.stringify({ title }),\n        });\n        return { status: r.status, body: await r.json() };\n      };\n      const [a, b] = await Promise.all([submit(\"durable\"), submit(\"durable\")]);\n      assert.equal(a.status, 201);\n      assert.equal(b.status, 201);\n      assert.equal(a.body.id, b.body.id);\n      assert.deepEqual(Object.keys(a.body).sort(), [\n        \"id\",\n        \"resultId\",\n        \"status\",\n      ]);\n      assert.equal((await submit(\"different\")).status, 409);\n      const oldClaim = await jobs.claim(60);\n      assert.ok(oldClaim);\n      await app.close();\n      app = await createApp({ url: upstream.url, budgetMs: 500 });\n      base = await app.getUrl();\n      jobs = app.get(DurableJobs);\n      ds = app.get(DataSource);\n      await until(async () =>\n        Boolean(\n          (\n            await ds.query(\n              'SELECT \"leaseUntil\"<clock_timestamp() AS expired FROM jobs WHERE id=$1',\n              [oldClaim.id],\n            )\n          )[0].expired,\n        ),\n      );\n      const result = await jobs.runOnce();\n      assert.equal(typeof result, \"number\");\n      await assert.rejects(jobs.complete(oldClaim), /LEASE_LOST/);\n      const row = (\n        await ds.query(\"SELECT * FROM jobs WHERE id=$1\", [oldClaim.id])\n      )[0];\n      assert.equal(row.status, \"done\");\n      assert.equal(row.attempts, 2);\n      assert.equal((await submit(\"durable\")).body.resultId, result);\n      assert.equal(\n        (await ds.query(\"SELECT count(*)::int AS n FROM notes\"))[0].n,\n        1,\n      );\n      assert.equal(\n        (await ds.query(\"SELECT count(*)::int AS n FROM audits\"))[0].n,\n        1,\n      );\n      await jobs.enqueue(\"poison\", \"durable\", {\n        tenantId: \"tenant-a\",\n        ownerId: \"alice\",\n        role: \"writer\",\n      });\n      for (let i = 0; i < 3; i++)\n        await assert.rejects(jobs.runOnce(), /duplicate key/);\n      assert.equal(\n        (await ds.query(\"SELECT status FROM jobs WHERE key='poison'\"))[0]\n          .status,\n        \"failed\",\n      );\n      assert.equal(await jobs.runOnce(), null);\n      assert.equal(\n        (await ds.query(\"SELECT count(*)::int AS n FROM notes\"))[0].n,\n        1,\n      );\n      await jobs.enqueue(\"last-crash\", \"never-completed\", {\n        tenantId: \"tenant-a\",\n        ownerId: \"alice\",\n        role: \"writer\",\n      });\n      const expire = async (claim) =>\n        until(async () =>\n          Boolean(\n            (\n              await ds.query(\n                'SELECT \"leaseUntil\"<clock_timestamp() AS expired FROM jobs WHERE id=$1',\n                [claim.id],\n              )\n            )[0].expired,\n          ),\n        );\n      let abandoned;\n      for (let i = 0; i < 3; i++) {\n        abandoned = await jobs.claim(20);\n        assert.ok(abandoned);\n        await expire(abandoned);\n      }\n      await app.close();\n      app = await createApp({ url: upstream.url, budgetMs: 500 });\n      jobs = app.get(DurableJobs);\n      ds = app.get(DataSource);\n      assert.equal(await jobs.claim(), null);\n      const exhausted = (\n        await ds.query(\"SELECT * FROM jobs WHERE key='last-crash'\")\n      )[0];\n      assert.equal(exhausted.status, \"failed\");\n      assert.equal(exhausted.attempts, 3);\n      assert.equal(\n        (await ds.query(\"SELECT count(*)::int AS n FROM notes\"))[0].n,\n        1,\n      );\n      console.log(\n        JSON.stringify({\n          sameKeyOneJob: true,\n          payloadConflict: 409,\n          restarted: true,\n          staleOwner: \"LEASE_LOST\",\n          notes: 1,\n          audits: 1,\n          poisonAttempts: 3,\n          thirdCrashReaped: true,\n        }),\n      );\n    } finally {\n      await app.close();\n      await upstream.close();\n    }\n  },\n);"
        },
        {
          "type": "paragraph",
          "text": "Node24.14.1、Nest12.2.0、TypeORM1.1.2、PG17.4下执行npm ci --ignore-scripts、npm test，实际4/4通过。RxJS超时后普通Promise仍写计数；上游预算与客户端断开取消了真实连接；PG屏障之后取消仍保存一条业务记录；同键并发只有一份job，重建Nest应用后能恢复租约、旧token拒绝、最终notes=1/audits=1，毒任务3次失败进入failed，第3次领取后消失也在重启后回收为failed。"
        },
        {
          "type": "paragraph",
          "text": "这里重启恢复是关闭并重新创建Nest应用，保留同一个测试PG实例；没有声称模拟了宿主机断电或复制集故障。第三次崩溃路径通过“领取后丢弃处理器并重建应用”控制窗口，而不是对系统随机kill再猜任务走到了哪里。"
        },
        {
          "type": "paragraph",
          "text": "本次实现修正中测试先后抓到UPDATE RETURNING raw形态差异和统计快照观测问题；记录最终修复后的4组通过，没有把这些失败藏成“首次运行一切正常”。PG服务端命令有自己的超时与私有目录所有权，缺少PG17.4工具时应明确失败，不能用内存假数据库代替。"
        }
      ]
    },
    {
      "id": "decisions",
      "title": "什么时候直接取消，什么时候交给持久任务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "结果只对当前页面有用的上游预览，可以在调用者离开时尽力取消；必须最终保存的导入或通知，应先持久接受任务，返回任务ID并让调用者查状态。决定依据是业务责任什么时候转移，不能只看动作能否写成async函数。"
        },
        {
          "type": "paragraph",
          "text": "本章没有交付分布式外部exactly-once、生产退避调度、人工重放UI或任意数据库取消。它交付的结论更具体：停止等待与停止执行不同；提交窗口必须承认；幂等性由数据库约束与输入等价性定义；重启后能继续处理依赖持久状态与明确的worker所有权。最后一篇把这些服务放进真实启动、健康检查和SIGTERM关闭流程。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Nest 拦截器",
      "url": "https://docs.nestjs.com/interceptors"
    },
    {
      "title": "Nest v12.2.0 InterceptorsConsumer",
      "url": "https://github.com/nestjs/nest/blob/v12.2.0/packages/core/interceptors/interceptors-consumer.ts"
    },
    {
      "title": "Node v24.14.1 globals源码",
      "url": "https://github.com/nodejs/node/blob/v24.14.1/doc/api/globals.md"
    },
    {
      "title": "PostgreSQL17显式锁",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
    },
    {
      "title": "PostgreSQL17事务隔离",
      "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
    }
  ]
};
export default article;
