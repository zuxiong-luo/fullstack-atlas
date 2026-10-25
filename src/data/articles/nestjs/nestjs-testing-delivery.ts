import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "nestjs-testing-delivery",
  "topic": "nestjs",
  "title": "测试与交付：配置、健康检查、日志和优雅关闭",
  "description": "把笔记服务的启动、依赖可用性与SIGTERM关闭变成可重复验证的流程，分清单元检查、真实数据库集成与进程级E2E。",
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
  "scope": "把笔记服务的启动、依赖可用性与SIGTERM关闭变成可重复验证的流程，分清单元检查、真实数据库集成与进程级E2E。",
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
      "path": "nestjs-testing-delivery.zip"
    },
    {
      "label": "阅读运行说明",
      "path": "nestjs-testing-delivery/README.md"
    }
  ],
  "sections": [
    {
      "id": "delivery-contract",
      "title": "服务交付是什么：把运行状态变成约定",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "服务交付不仅是编译出dist。一个进程需要说明自己何时能够接流量、依赖失效后如何对外表态、收到关闭信号后接不接新请求、已有请求还能做多久。测试与交付的共同目标，是把这些运行约定变成外部能观察、能重复验证的行为。"
        },
        {
          "type": "paragraph",
          "text": "前几章分别建立请求流程、容器、数据库原子性、授权和任务责任。本章保留同一租户笔记模型与固定教学身份，但把业务入口缩成一个受控POST /work诊断动作，便于在准确的时刻触发数据库写入和关闭；它不是给整个生产笔记API补上一张“可上线认证”。每章仍有独立项目，不需要前五个服务同时启动。"
        },
        {
          "type": "paragraph",
          "text": "我们锁定Node24.14.1、Nest12.2.0、TypeORM1.1.2和PG17.4。以下关闭结论来自macOS上的真实子进程与loopback HTTP/PG，不等同于已经验证Kubernetes摘流、负载均衡传播、Windows信号或容器镜像供应链。"
        }
      ]
    },
    {
      "id": "test-layers",
      "title": "单元、集成和E2E分别能证明哪一层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "单元测试把一个逻辑单元与环境隔开，例如检查DRAIN_MS不是合法整数时必须失败、requestId不接受换行。这些测试快，失败原因也直接，但没有证明数据库存在。"
        },
        {
          "type": "paragraph",
          "text": "集成测试让真实组件连起来，例如PG停止后SELECT 1失败、重启后新连接恢复。它能发现驱动与连接池行为，不能替代外部HTTP协议和进程退出检查。Mock Repository只能证明业务调用约定，不能证明事务回滚、约束或连接释放。"
        },
        {
          "type": "paragraph",
          "text": "E2E从外部启动实际编译后的main.js，等待它打印listening，发送HTTP请求，再向这个子进程发送SIGTERM并检查退出状态。这里不调用一个假的shutdown函数冒充操作系统信号。完整验收把三层检查放在一个明确的运行脚本里，按各自证据报告，不虚构node:test测试数量。"
        }
      ]
    },
    {
      "id": "config-and-logging",
      "title": "配置先校验，日志先决定允许出现什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "启动前校验DRAIN_MS，允许20～2000ms整数，默认150ms；DATABASE_URL只接受自有教学集群的atlas/127.0.0.1:55482/postgres。错误配置必须在listening前失败，公开日志只记录CONFIG_OR_DEPENDENCY_INVALID，而不是把带密码的URL直接打印出来。这里没有真实业务密钥。"
        },
        {
          "type": "paragraph",
          "text": "结构化日志是每行一个JSON事件。工作开始/结束记录event、requestId、active；HTTP完成记录path与status。requestId只接受1～64位字母数字下划线横线，否则由服务生成UUID。日志不复制Authorization、Cookie、完整请求体或任意请求头；安全字段白名单比事后用字符串replace更容易检查。"
        },
        {
          "type": "paragraph",
          "text": "日志输出到stdout，保留与轮转由运行环境负责，不在应用里无限push到一个全局数组。active Set只保存当前运行的AbortController，在finally删除，不会随着历史请求无限增长。下面是完整运行状态实现。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-testing-delivery/src/runtime.ts",
          "purpose": "完整运行状态：配置校验、请求ID约束、结构化输出、当前工作集合与协作取消。",
          "kind": "excerpt",
          "code": "import { randomUUID } from \"node:crypto\";\nimport { ServiceUnavailableException } from \"@nestjs/common\";\nexport function log(event: Record<string, unknown>) {\n  console.log(JSON.stringify(event));\n}\nexport class Runtime {\n  draining = false;\n  readonly active = new Set<AbortController>();\n  async run<T>(requestId: string, work: (signal: AbortSignal) => Promise<T>) {\n    if (this.draining) throw new ServiceUnavailableException(\"draining\");\n    const controller = new AbortController();\n    this.active.add(controller);\n    log({ event: \"work_started\", requestId, active: this.active.size });\n    try {\n      return await work(controller.signal);\n    } finally {\n      this.active.delete(controller);\n      log({ event: \"work_finished\", requestId, active: this.active.size });\n    }\n  }\n  abort() {\n    for (const controller of this.active)\n      controller.abort(new Error(\"SHUTDOWN_BUDGET\"));\n  }\n}\nexport function requestId(value: unknown) {\n  return typeof value === \"string\" && /^[A-Za-z0-9_-]{1,64}$/.test(value)\n    ? value\n    : randomUUID();\n}\nexport function drainBudget(value: string | undefined) {\n  const n = Number(value ?? \"150\");\n  if (!Number.isInteger(n) || n < 20 || n > 2000)\n    throw new Error(\"INVALID_DRAIN_MS\");\n  return n;\n}\n\nexport function queryBudget(value: string | undefined) {\n  const n = Number(value ?? \"500\");\n  if (!Number.isInteger(n) || n < 100 || n > 5000)\n    throw new Error(\"INVALID_QUERY_MS\");\n  return n;\n}"
        }
      ]
    },
    {
      "id": "health",
      "title": "存活与就绪：依赖不可用不必等于进程死亡",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "GET /health/live回答当前进程还能处理这个轻量检查；GET /health/ready回答当前是否愿意承担需要数据库的业务。就绪检查在draining时返回503，也会实际SELECT 1，数据库不可用则503。存活检查不查询数据库，所以外部PG停止时仍返回200。"
        },
        {
          "type": "paragraph",
          "text": "这两个接口的区别很实际：如果每次数据库短暂故障都让存活失败并重启所有服务，只会增加连接抖动；但继续声称ready又会把业务请求送到无法处理它们的实例。本章查询设置了驱动连接/查询预算，避免健康检查自己无限挂住。生产检查频率、阈值与依赖优先级仍需依据系统容量设计。"
        },
        {
          "type": "paragraph",
          "text": "POST /work需要演示writer身份，并接受0～1500ms的受控等待参数。它先用可取消timer等待，再创建一条当前identity所属笔记。为了清楚比较关闭前后结果，显式HttpCode(200)。这是一条会写数据的诊断POST，不能用GET做业务写入后说它是安全幂等读取。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-testing-delivery/src/app.ts",
          "purpose": "完整应用：存活/就绪、输入边界、固定身份、请求日志、draining准入和可取消工作。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport {\n  Controller,\n  HttpCode,\n  Get,\n  Inject,\n  Module,\n  Query,\n  Req,\n  ServiceUnavailableException,\n  Post,\n  UseGuards,\n} from \"@nestjs/common\";\nimport { NestFactory } from \"@nestjs/core\";\nimport { TypeOrmModule } from \"@nestjs/typeorm\";\nimport { DataSource } from \"typeorm\";\nimport { setTimeout as delay } from \"node:timers/promises\";\nimport type { Request, Response } from \"express\";\nimport { NoteEntity, OwnerEntity, AuditEntity } from \"./model\";\nimport { databaseUrl } from \"./config\";\nimport { Runtime, log, requestId, queryBudget } from \"./runtime\";\nimport { IdentityGuard, AuthRequest } from \"./auth\";\nexport const RUNTIME = Symbol(\"RUNTIME\");\ntype Traced = AuthRequest & { requestId: string };\n@Controller()\nclass DeliveryController {\n  constructor(\n    private readonly ds: DataSource,\n    @Inject(RUNTIME) private readonly runtime: Runtime,\n  ) {}\n  @Get(\"health/live\") live() {\n    return { live: true };\n  }\n  @Get(\"health/ready\") async ready() {\n    if (this.runtime.draining)\n      throw new ServiceUnavailableException(\"draining\");\n    try {\n      await this.ds.query(\"SELECT 1\");\n      return { ready: true };\n    } catch {\n      throw new ServiceUnavailableException(\"database unavailable\");\n    }\n  }\n  @Post(\"work\") @HttpCode(200) @UseGuards(IdentityGuard) async work(\n    @Query(\"ms\") raw: string,\n    @Req() req: Traced,\n  ) {\n    const ms = Number(raw);\n    if (!Number.isInteger(ms) || ms < 0 || ms > 1500)\n      throw new ServiceUnavailableException(\"invalid work fixture\");\n    try {\n      return await this.runtime.run(req.requestId, async (signal) => {\n        await delay(ms, undefined, { signal });\n        signal.throwIfAborted();\n        const note = await this.ds.getRepository(NoteEntity).save({\n          tenantId: req.identity.tenantId,\n          ownerId: req.identity.ownerId,\n          title: req.requestId,\n        });\n        return { id: note.id, title: note.title };\n      });\n    } catch (error) {\n      if ((error as Error).name === \"AbortError\")\n        throw new ServiceUnavailableException(\"shutdown budget exhausted\");\n      throw error;\n    }\n  }\n}\nexport async function createApp() {\n  const runtime = new Runtime();\n  @Module({\n    imports: [\n      TypeOrmModule.forRootAsync({\n        useFactory: () => ({\n          type: \"postgres\",\n          url: databaseUrl(),\n          entities: [NoteEntity, OwnerEntity, AuditEntity],\n          synchronize: false,\n          retryAttempts: 1,\n          extra: {\n            max: 4,\n            connectionTimeoutMillis: 500,\n            query_timeout: queryBudget(process.env.QUERY_TIMEOUT_MS),\n          },\n          invalidWhereValuesBehavior: { null: \"throw\", undefined: \"throw\" },\n        }),\n      }),\n    ],\n    providers: [IdentityGuard, { provide: RUNTIME, useValue: runtime }],\n    controllers: [DeliveryController],\n  })\n  class AppModule {}\n  const app = await NestFactory.create(AppModule, {\n    logger: false,\n    abortOnError: false,\n  });\n  app.use((req: Traced, res: Response, next: () => void) => {\n    req.requestId = requestId(req.headers[\"x-request-id\"]);\n    res.setHeader(\"x-request-id\", req.requestId);\n    res.once(\"finish\", () =>\n      log({\n        event: \"http_finished\",\n        requestId: req.requestId,\n        path: req.path,\n        status: res.statusCode,\n      }),\n    );\n    if (runtime.draining && !req.path.startsWith(\"/health/\"))\n      return res.status(503).json({ error: \"DRAINING\" });\n    next();\n  });\n  await app.listen(0, \"127.0.0.1\");\n  return { app, runtime };\n}"
        }
      ]
    },
    {
      "id": "drain-sequence",
      "title": "SIGTERM之后：先停止承担新责任，再收敛已有工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "关闭顺序要与资源依赖相反。先把runtime.draining置true，停止接新的业务责任；启动Nest app.close让HTTP服务关闭接收；在途工作仍可使用数据库完成；最后由Nest生命周期关闭它拥有的DataSource。如果先销毁连接池，再等处理器写笔记，短请求也会被自己关掉的资源击中。"
        },
        {
          "type": "figure",
          "src": "figures/nestjs-testing-delivery.svg",
          "title": "一次有预算的关闭",
          "alt": "SIGTERM后draining=true并停止接收；80ms工作在150ms预算内提交200，1200ms等待收到AbortSignal后503；HTTP闲置连接收敛后应用关闭数据库。若SQL不响应取消，额外1000ms硬截止以非零退出。",
          "caption": "SIGTERM后draining=true并停止接收；80ms工作在150ms预算内提交200，1200ms等待收到AbortSignal后503；HTTP闲置连接收敛后应用关闭数据库。若SQL不响应取消，额外1000ms硬截止以非零退出。"
        },
        {
          "type": "paragraph",
          "text": "本章预算150ms到期时对active工作发AbortSignal。长timer会抛AbortError，映射503，不执行之后的写入；短请求80ms已完成并保存。取消是协作式的：普通同步循环或已经进入驱动的SQL不会因为发了signal就停止。"
        },
        {
          "type": "paragraph",
          "text": "HTTP还有keep-alive连接寿命。实验曾出现active已经0、两条响应也已结束，但关闭仍等在连接收敛；现在关闭期间每20ms调用closeIdleConnections，只清理闲置HTTP连接，不杀掉仍在处理的短请求。正常关闭完成后清理这个interval和两个deadline timer。它是本固定环境的实测修复，不能拿一个app.close调用替代生命周期验证。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-testing-delivery/src/main.ts",
          "purpose": "完整子进程入口：配置先验、信号去重、准入关闭、协作取消、闲置连接回收、硬截止和正常完成清理。",
          "kind": "excerpt",
          "code": "import { createApp } from \"./app\";\nimport { drainBudget, log } from \"./runtime\";\nasync function main() {\n  const budget = drainBudget(process.env.DRAIN_MS);\n  const { app, runtime } = await createApp();\n  let closing = false;\n  const close = async (signal: string) => {\n    if (closing) return;\n    closing = true;\n    runtime.draining = true;\n    log({\n      event: \"draining\",\n      signal,\n      active: runtime.active.size,\n      budgetMs: budget,\n    });\n    const idleSweep = setInterval(\n      () => app.getHttpServer().closeIdleConnections(),\n      20,\n    );\n    const abortTimer = setTimeout(() => {\n      log({ event: \"budget_exhausted\", active: runtime.active.size });\n      runtime.abort();\n    }, budget);\n    const hardTimer = setTimeout(() => {\n      log({ event: \"shutdown_forced\", active: runtime.active.size });\n      app.getHttpServer().closeAllConnections();\n      process.exit(1);\n    }, budget + 1000);\n    try {\n      await app.close();\n      log({ event: \"closed\", active: runtime.active.size });\n    } finally {\n      clearInterval(idleSweep);\n      clearTimeout(abortTimer);\n      clearTimeout(hardTimer);\n    }\n  };\n  process.once(\"SIGTERM\", () => void close(\"SIGTERM\"));\n  process.once(\"SIGINT\", () => void close(\"SIGINT\"));\n  log({ event: \"listening\", url: await app.getUrl() });\n}\nvoid main().catch(() => {\n  log({ event: \"startup_failed\", code: \"CONFIG_OR_DEPENDENCY_INVALID\" });\n  process.exitCode = 1;\n});"
        }
      ]
    },
    {
      "id": "hard-deadline",
      "title": "不能取消的工作：硬截止意味着什么代价",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "额外1000ms到期仍未关闭时，程序记录shutdown_forced，关闭HTTP连接并process.exit(1)。这确实终止本应用进程，不会优雅执行所有finally；因此非零退出是可观测的失败结果，不应该记成“平滑关闭成功”。硬退出也不能撤销早已提交的数据库事务或外部副作用。"
        },
        {
          "type": "paragraph",
          "text": "为了真实验证这个分支，测试用独立PG连接对notes持有ACCESS EXCLUSIVE锁，再启动第二个应用，并将测试QUERY_TIMEOUT_MS显式设为5000ms（正常默认500ms），让它的INSERT卡在锁等待。监控确认SQL已经阻塞后发SIGTERM；AbortSignal无法取消这个驱动SQL，预算耗尽后触发硬截止。子进程退出1、HTTP连接关闭，释放测试锁后数据库仍只保留前面短请求的笔记。"
        },
        {
          "type": "paragraph",
          "text": "这个结果只证明测试中“尚未提交、连接随进程断开”的INSERT没有持久化，不证明任意故障下都能知道commit结果。部署平台的terminationGracePeriod必须大于应用的工作预算与清理上限，也要为网络摘流留余量；本章未实际运行编排平台，不填写虚构的容器验收结果。"
        }
      ]
    },
    {
      "id": "migrations",
      "title": "发布顺序：结构变化不能靠每次启动猜测",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本章仍使用synchronize:false与明确的空库schema，不把实体更新当生产迁移。对于已有数据，先验证向后兼容的扩展，例如新增允许空值的列或新表；迁移完成后部署兼容新旧结构的应用；数据回填与观测通过后，再在后续发布收紧约束或删除旧字段。"
        },
        {
          "type": "paragraph",
          "text": "如果启动同时跑破坏性迁移、多个副本又并发执行，应用就绪与schema所有权会混在一起。生产应由有明确权限和互斥的迁移步骤承担演进，业务实例不自动获得任意DDL权限。TypeORM迁移专题提供空库/已有数据/失败恢复实验，本篇只确定它与应用接流量的相对位置，不声称这份临时空库夹具已验证生产升级。"
        }
      ]
    },
    {
      "id": "actual-e2e",
      "title": "完整验收脚本：从进程外观察",
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
          "filename": "examples/nestjs-testing-delivery/scripts/test-cluster.mjs",
          "purpose": "完整交付验收：配置与请求ID、PG真实停启、HTTP就绪变化、两条在途请求、真实SIGTERM、结构化日志、非协作SQL硬退出、错误配置拒绝启动。",
          "kind": "excerpt",
          "code": "import { withCluster } from \"./cluster.mjs\";\nimport { spawn } from \"node:child_process\";\nimport assert from \"node:assert/strict\";\nimport { setTimeout as delay } from \"node:timers/promises\";\nimport { drainBudget, requestId } from \"../dist/runtime.js\";\nimport { Client } from \"pg\";\nasync function until(test, label) {\n  const end = Date.now() + 7000;\n  while (Date.now() < end) {\n    if (await test()) return;\n    await delay(10);\n  }\n  throw new Error(\"deadline \" + label);\n}\nfunction launch(env) {\n  const child = spawn(process.execPath, [\"dist/main.js\"], {\n    env: { ...process.env, ...env },\n    stdio: [\"ignore\", \"pipe\", \"pipe\"],\n  });\n  const records = [];\n  let text = \"\",\n    stderr = \"\";\n  child.stdout.on(\"data\", (part) => {\n    text += part;\n    let nl;\n    while ((nl = text.indexOf(\"\\n\")) >= 0) {\n      const line = text.slice(0, nl);\n      text = text.slice(nl + 1);\n      try {\n        records.push(JSON.parse(line));\n      } catch {}\n    }\n  });\n  child.stderr.on(\"data\", (x) => (stderr += x));\n  const done = new Promise((resolve, reject) => {\n    child.once(\"error\", reject);\n    child.once(\"close\", (code, signal) => resolve({ code, signal, stderr }));\n  });\n  return { child, records, done };\n}\nassert.equal(drainBudget(undefined), 150);\nassert.throws(() => drainBudget(\"NaN\"), /INVALID/);\nassert.throws(() => drainBudget(\"-1\"), /INVALID/);\nassert.equal(requestId(\"alice_request\"), \"alice_request\");\nassert.notEqual(requestId(\"bad\\nheader\"), \"bad\\nheader\");\nawait withCluster(async (cluster) => {\n  const app = launch({ DATABASE_URL: cluster.url, DRAIN_MS: \"150\" });\n  const killTimer = setTimeout(() => app.child.kill(\"SIGKILL\"), 25000);\n  try {\n    await until(\n      () => app.records.some((x) => x.event === \"listening\"),\n      \"listen\",\n    );\n    const base = app.records.find((x) => x.event === \"listening\").url;\n    assert.equal((await fetch(base + \"/health/live\")).status, 200);\n    assert.equal((await fetch(base + \"/health/ready\")).status, 200);\n    await cluster.stop();\n    assert.equal((await fetch(base + \"/health/live\")).status, 200);\n    assert.equal((await fetch(base + \"/health/ready\")).status, 503);\n    await cluster.start();\n    await until(\n      async () => (await fetch(base + \"/health/ready\")).status === 200,\n      \"dependency recovery\",\n    );\n    const request = (ms, id) =>\n      fetch(base + \"/work?ms=\" + ms, {\n        method: \"POST\",\n        headers: {\n          \"x-request-id\": id,\n          authorization: \"Bearer alice-demo\",\n          \"x-unused-secret\": \"never-log-this-secret\",\n        },\n      }).then(async (r) => ({\n        status: r.status,\n        body: await r.json(),\n        id: r.headers.get(\"x-request-id\"),\n      }));\n    const short = request(80, \"short_work\"),\n      long = request(1200, \"long_work\");\n    await until(\n      () => app.records.filter((x) => x.event === \"work_started\").length === 2,\n      \"both in flight\",\n    );\n    const started = Date.now();\n    app.child.kill(\"SIGTERM\");\n    const a = await short,\n      b = await long;\n    assert.equal(a.status, 200);\n    assert.equal(a.id, \"short_work\");\n    assert.equal(b.status, 503);\n    const exit = await app.done;\n    console.log(\n      JSON.stringify({ diagnostic: app.records, stderr: exit.stderr }),\n    );\n    assert.equal(exit.code, 0);\n    assert.ok(Date.now() - started < 3000);\n    assert.ok(app.records.some((x) => x.event === \"budget_exhausted\"));\n    assert.ok(app.records.some((x) => x.event === \"closed\" && x.active === 0));\n    assert.ok(!app.records.some((x) => x.event === \"shutdown_forced\"));\n    await assert.rejects(fetch(base + \"/health/live\"));\n    const client = new Client({ connectionString: cluster.url });\n    await client.connect();\n    try {\n      const rows = (await client.query(\"SELECT title FROM notes ORDER BY id\"))\n        .rows;\n      assert.deepEqual(rows, [{ title: \"short_work\" }]);\n    } finally {\n      await client.end();\n    }\n    assert.ok(!JSON.stringify(app.records).includes(\"never-log-this-secret\"));\n    assert.ok(!JSON.stringify(app.records).includes(\"Bearer alice-demo\"));\n    console.log(\n      JSON.stringify({\n        unitConfig: true,\n        liveWithDependencyDown: 200,\n        readyDown: 503,\n        readyRecovered: 200,\n        short: 200,\n        long: 503,\n        exit: exit.code,\n        activeAfterClose: 0,\n        onlyShortPersisted: true,\n        authorizationNotLogged: true,\n      }),\n    );\n  } finally {\n    clearTimeout(killTimer);\n    if (app.child.exitCode === null) {\n      app.child.kill(\"SIGTERM\");\n      await app.done;\n    }\n  }\n  // A PG lock demonstrates non-cooperative work: AbortSignal cannot cancel this SQL.\n  const blocker = new Client({ connectionString: cluster.url });\n  await blocker.connect();\n  const forced = launch({\n    DATABASE_URL: cluster.url,\n    DRAIN_MS: \"20\",\n    QUERY_TIMEOUT_MS: \"5000\",\n  });\n  const forcedKill = setTimeout(() => forced.child.kill(\"SIGKILL\"), 10000);\n  try {\n    await until(\n      () => forced.records.some((x) => x.event === \"listening\"),\n      \"forced listen\",\n    );\n    await blocker.query(\"BEGIN\");\n    await blocker.query(\"LOCK TABLE notes IN ACCESS EXCLUSIVE MODE\");\n    const base = forced.records.find((x) => x.event === \"listening\").url;\n    const response = fetch(base + \"/work?ms=0\", {\n      method: \"POST\",\n      headers: {\n        authorization: \"Bearer alice-demo\",\n        \"x-request-id\": \"blocked_sql\",\n      },\n    })\n      .then((r) => r.text())\n      .catch(() => \"connection-closed\");\n    await until(\n      async () =>\n        (await cluster.sql(\n          \"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'INSERT INTO%notes%')\",\n        )) === \"t\",\n      \"SQL waiting\",\n    );\n    forced.child.kill(\"SIGTERM\");\n    const exit = await forced.done;\n    assert.equal(exit.code, 1);\n    assert.ok(forced.records.some((x) => x.event === \"shutdown_forced\"));\n    await response;\n  } finally {\n    clearTimeout(forcedKill);\n    if (forced.child.exitCode === null) {\n      forced.child.kill(\"SIGKILL\");\n      await forced.done;\n    }\n    await blocker.query(\"ROLLBACK\");\n    await blocker.end();\n  }\n  assert.equal(await cluster.sql(\"SELECT count(*) FROM notes\"), \"1\");\n  const broken = launch({ DATABASE_URL: cluster.url, DRAIN_MS: \"no-number\" });\n  const exit = await broken.done;\n  assert.equal(exit.code, 1);\n  assert.ok(broken.records.some((x) => x.event === \"startup_failed\"));\n  assert.ok(!broken.records.some((x) => x.event === \"listening\"));\n});\nconsole.log(\n  \"PASS configuration unit checks + real PostgreSQL dependency failure/recovery + HTTP E2E + real SIGTERM child process\",\n);"
        },
        {
          "type": "paragraph",
          "text": "运行npm ci --ignore-scripts、npm test。测试先编译，再创建自己的临时PGDATA。PG_BIN默认/Library/PostgreSQL/17/bin，必须使用PG17.4；端口55482若已占用就拒绝。它不会停止用户的5432服务，也不会借用其他文章的数据库。"
        },
        {
          "type": "paragraph",
          "text": "实际结果按场景记录：依赖正常live200/ready200；停止PG后live200/ready503；同一集群重启后ready200。正常SIGTERM用例短请求200、长请求503，active=0后closed，退出0，数据库只有short_work；结构化记录不含Authorization或测试秘密头。SQL锁阻塞用例触发shutdown_forced并退出1，回收后没有blocked_sql笔记。错误DRAIN_MS在listening之前退出1。"
        },
        {
          "type": "paragraph",
          "text": "测试的finally始终先收回自己启动的子进程，再停止私有PG；启动异常也按自有PGDATA状态清理。无法证明私有数据库停止时保留目录并报错，避免把仍运行的数据库目录删掉。这个失败策略比为了“测试干净”强行删除文件更安全。"
        }
      ]
    },
    {
      "id": "completion",
      "title": "交付时可以怎样使用这份证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "单元检查说明输入规则，真实PG场景说明依赖变化，子进程E2E说明外部可见的关闭行为。三者共同缩小了“本地看起来能跑”和“发生故障仍知道会怎样”的距离；任何一层都不能替代其他层。"
        },
        {
          "type": "paragraph",
          "text": "本系列现在把Nest服务的主要责任串起来：模块装配对象、请求钩子执行策略、DTO与身份约束输入、事务约束数据库结果、持久任务承担跨请求责任，最后由启动和关闭协议管理资源寿命。尚未交付真实身份平台、生产TLS/密钥托管、多副本任务运维、真实编排滚动发布及负载指标；这些限制与本章已经真实执行的HTTP/PG/信号用例分开记录。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Nest 测试",
      "url": "https://docs.nestjs.com/fundamentals/testing"
    },
    {
      "title": "Nest 生命周期",
      "url": "https://docs.nestjs.com/fundamentals/lifecycle-events"
    },
    {
      "title": "Nest v12.2.0 ExpressAdapter",
      "url": "https://github.com/nestjs/nest/blob/v12.2.0/packages/platform-express/adapters/express-adapter.ts"
    },
    {
      "title": "Node v24.14.1 HTTP源码文档",
      "url": "https://github.com/nodejs/node/blob/v24.14.1/doc/api/http.md"
    },
    {
      "title": "PostgreSQL17锁",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
    }
  ]
};
export default article;
