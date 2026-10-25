import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "nestjs-request-lifecycle",
  "topic": "nestjs",
  "title": "NestJS 基础与请求流程：从启动到响应",
  "description": "认识 Nest 的模块、控制器和服务，跟踪一条真实 HTTP 请求经过身份拒绝、DTO 校验、处理器与异常过滤器的过程。",
  "minutes": 35,
  "labMinutes": 20,
  "tags": [
    "NestJS",
    "Node.js",
    "TypeScript",
    "租户笔记服务"
  ],
  "scope": "认识 Nest 的模块、控制器和服务，跟踪一条真实 HTTP 请求经过身份拒绝、DTO 校验、处理器与异常过滤器的过程。",
  "prerequisites": [
    "会编写 TypeScript 函数与类",
    "理解 HTTP 请求、响应和 Promise"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 24.14.1",
    "NestJS 12.2.0",
    "TypeScript 5.7.2",
    "RxJS 7.8.2"
  ],
  "verifiedAt": "2026-10-25",
  "examples": [
    {
      "label": "下载本章独立项目、锁文件与测试",
      "path": "nestjs-request-lifecycle.zip"
    },
    {
      "label": "阅读运行说明",
      "path": "nestjs-request-lifecycle/README.md"
    }
  ],
  "sections": [
    {
      "id": "what-is-nest",
      "title": "Nest 是什么：先分清框架、适配器与运行时",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "NestJS 是运行在 Node.js 上的服务端应用框架。它给应用规定了组织业务的方式，并在 HTTP 处理的不同位置放置可组合的扩展点。它不会替代 JavaScript 执行引擎，也不会创造一个独立的网络操作系统。我们使用 TypeScript 写类和装饰器，编译后仍由 Node 执行 JavaScript。"
        },
        {
          "type": "paragraph",
          "text": "这一层关系容易被一句“基于 Express”带过去。更准确地说，本章 Nest 使用 platform-express 适配器把控制器方法连接到 Express 的路由和响应对象；Express 处理 HTTP 层的路由与中间件；Node 的 HTTP 服务接收连接和请求。换 Fastify 适配器可以保留许多 Nest 业务代码，但依赖 Express Request/Response 的代码必须重新核对。本文明确只验证 Express。"
        },
        {
          "type": "paragraph",
          "text": "为什么不直接在 Express 路由里写全部逻辑？小服务完全可以这样做。当路由、权限、配置和资源越来越多时，我们需要回答：业务对象由谁创建、能被谁使用、错误怎样统一返回、测试怎样替换依赖。Nest 的价值主要在这些组织与执行约定。装饰器只是告诉框架“这个类承担什么职责”的入口，机制要从模块注册和请求执行中理解。"
        },
        {
          "type": "paragraph",
          "text": "本系列贯穿租户笔记服务：tenant-a 的 alice 和 tenant-b 的 bob 是虚构用户。本章先使用内存保存 tenant-a/alice 的笔记，固定 Bearer alice-demo 只为了控制 Guard 分支，不能作为可上线的身份认证。数据库、真实的服务端边界和关闭预算会逐章补齐。读完本篇应能画出一条请求走到响应的路径，解释为什么某些失败不会进入处理器。"
        }
      ]
    },
    {
      "id": "three-roles",
      "title": "Module、Controller、Service 各自负责什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Controller 是 HTTP 入口：它把路径、方法和请求参数映射到具体方法。Service 承担业务动作，例如创建笔记。Module 把控制器和服务放进一个有边界的容器，让 Nest 知道应创建哪些对象、如何满足构造函数依赖。模块并不等于一个操作系统进程，也不会自动隔离内存。"
        },
        {
          "type": "paragraph",
          "text": "本章 NotesController 构造函数接收 NotesService。调用者无需在每个请求里 new 一个服务，Nest 会按注册方式创建并注入它。默认情况下服务实例由应用复用，因此 notes 数组也在请求之间共享；进程退出后它就消失。这是为了先看清请求流程作出的教学选择。并发读写和持久化并没有因为用了 Service 类就获得保障。"
        },
        {
          "type": "paragraph",
          "text": "控制器只负责取 DTO、调用服务和返回结果，业务存储留在服务中。若把所有操作写在控制器里，单元测试必须先制造 HTTP 上下文；若让服务拿 Express Response，则服务又被 HTTP 适配器绑住。这里采用较窄的接口，让服务接收 title、返回 note。这个取舍在后面的数据库事务服务中仍然成立。"
        }
      ]
    },
    {
      "id": "bootstrap",
      "title": "启动不是处理请求：先注册，再初始化与监听",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "NestFactory.create(AppModule) 从根模块建立应用，解析依赖并创建对象。接着我们注册全局 Guard、Interceptor、Pipe 和 Filter，再 listen。listen 会确保应用完成初始化后才接受 HTTP 流量。这个顺序有意义：运行中的请求不应看见尚未准备好的策略或资源。启动失败则由 main 的 catch 记录并设置非零退出码。"
        },
        {
          "type": "paragraph",
          "text": "下面展示完整应用核心文件。为了能在同一进程启动多个独立测试实例，端口传 0，请操作系统分配空闲端口；程序打印真实 URL。网站自己的 4173 是预览端口，与这些教学服务无关。app.use 的 Express 中间件先建立每次请求独立的 trace 和 requestId，避免把所有请求写到一个全局数组导致记录串线。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-request-lifecycle/src/app.ts",
          "purpose": "本章完整核心应用：DTO、Service、Guard、Interceptor、Filter、Controller、Module 与启动注册。只省略进程信号入口，见下一段。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport {\n  ArgumentsHost,\n  Body,\n  CallHandler,\n  CanActivate,\n  Catch,\n  Controller,\n  ExecutionContext,\n  ExceptionFilter,\n  ForbiddenException,\n  HttpException,\n  Injectable,\n  Module,\n  NestInterceptor,\n  Post,\n  Req,\n  ValidationPipe,\n} from \"@nestjs/common\";\nimport { NestFactory } from \"@nestjs/core\";\nimport { IsString, MaxLength, MinLength } from \"class-validator\";\nimport { Observable, catchError, finalize, tap, throwError } from \"rxjs\";\nimport { randomUUID } from \"node:crypto\";\nimport { Request, Response } from \"express\";\n\ntype TracedRequest = Request & { trace: string[]; requestId: string };\nexport class CreateNoteDto {\n  @IsString() @MinLength(1) @MaxLength(80) title!: string;\n}\n@Injectable()\nexport class NotesService {\n  readonly notes: {\n    id: string;\n    tenant: string;\n    owner: string;\n    title: string;\n  }[] = [];\n  create(title: string) {\n    const note = {\n      id: randomUUID(),\n      tenant: \"tenant-a\",\n      owner: \"alice\",\n      title,\n    };\n    this.notes.push(note);\n    return note;\n  }\n}\n@Injectable()\nclass DemoGuard implements CanActivate {\n  canActivate(context: ExecutionContext) {\n    const req = context.switchToHttp().getRequest<TracedRequest>();\n    req.trace.push(\"guard\");\n    if (req.headers.authorization !== \"Bearer alice-demo\")\n      throw new ForbiddenException(\"demo identity required\");\n    return true;\n  }\n}\n@Injectable()\nclass TraceInterceptor implements NestInterceptor {\n  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {\n    const http = context.switchToHttp();\n    const req = http.getRequest<TracedRequest>();\n    const res = http.getResponse<Response>();\n    req.trace.push(\"interceptor:before\");\n    return next.handle().pipe(\n      tap(() => {\n        req.trace.push(\"interceptor:after\");\n        res.setHeader(\"x-trace\", req.trace.join(\",\"));\n      }),\n      catchError((error) => {\n        req.trace.push(\"interceptor:error\");\n        return throwError(() => error);\n      }),\n      finalize(() => req.trace.push(\"interceptor:finalize\")),\n    );\n  }\n}\n@Catch()\nclass JsonFilter implements ExceptionFilter {\n  catch(error: unknown, host: ArgumentsHost) {\n    const http = host.switchToHttp(),\n      req = http.getRequest<TracedRequest>(),\n      res = http.getResponse<Response>();\n    req.trace.push(\"filter\");\n    const status = error instanceof HttpException ? error.getStatus() : 500;\n    res.status(status).json({\n      status,\n      requestId: req.requestId,\n      trace: [...req.trace],\n      error:\n        status === 500\n          ? \"INTERNAL\"\n          : error instanceof HttpException\n            ? error.getResponse()\n            : \"INTERNAL\",\n    });\n  }\n}\n@Controller(\"notes\")\nclass NotesController {\n  constructor(private readonly notes: NotesService) {}\n  @Post()\n  create(@Body() dto: CreateNoteDto, @Req() req: TracedRequest) {\n    req.trace.push(\"handler\");\n    if (dto.title === \"crash\")\n      throw new Error(\"private detail must not escape\");\n    return this.notes.create(dto.title);\n  }\n}\n@Module({\n  controllers: [NotesController],\n  providers: [NotesService, DemoGuard, TraceInterceptor],\n})\nclass AppModule {}\nexport async function createApp() {\n  const app = await NestFactory.create(AppModule, { logger: false });\n  app.use((req: TracedRequest, _res: Response, next: () => void) => {\n    req.trace = [\"middleware\"];\n    req.requestId = randomUUID();\n    next();\n  });\n  app.useGlobalGuards(app.get(DemoGuard));\n  app.useGlobalInterceptors(app.get(TraceInterceptor));\n  app.useGlobalPipes(\n    new ValidationPipe({\n      transform: true,\n      whitelist: true,\n      forbidNonWhitelisted: true,\n    }),\n  );\n  app.useGlobalFilters(new JsonFilter());\n  await app.listen(0, \"127.0.0.1\");\n  return app;\n}"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-request-lifecycle/src/main.ts",
          "purpose": "独立进程入口，打印随机端口并在 SIGTERM/SIGINT 时关闭本应用。第六章再验证有预算的在途收敛。",
          "kind": "excerpt",
          "code": "import { createApp } from \"./app\";\nvoid createApp()\n  .then(async (app) => {\n    console.log(\n      JSON.stringify({\n        event: \"listening\",\n        url: await app.getUrl(),\n        identity: \"Bearer alice-demo\",\n      }),\n    );\n    process.once(\"SIGTERM\", () => void app.close());\n    process.once(\"SIGINT\", () => void app.close());\n  })\n  .catch((error) => {\n    console.error(error);\n    process.exitCode = 1;\n  });"
        }
      ]
    },
    {
      "id": "pipeline",
      "title": "先看正常路径：参与位置决定能够看见什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "请求生命周期描述的是一次请求经过的处理钩子，不是所有对象何时被实例化的时间表。尤其不要把“Guard 之后才创建 request scope 依赖”当作结论；路由上下文与依赖实例准备属于另一层机制。第二篇会单独验证作用域。"
        },
        {
          "type": "figure",
          "src": "figures/nestjs-request-lifecycle.svg",
          "title": "当前注册方式下的一次请求",
          "alt": "处理钩子的示意：Middleware → Guard → Interceptor 前段 → Pipe → Handler → Interceptor 后段 → HTTP 响应；Guard 拒绝直接进入 Filter，Pipe 与 Handler 错误经过已进入的 Interceptor 错误支路。",
          "caption": "处理钩子的示意：Middleware → Guard → Interceptor 前段 → Pipe → Handler → Interceptor 后段 → HTTP 响应；Guard 拒绝直接进入 Filter，Pipe 与 Handler 错误经过已进入的 Interceptor 错误支路。"
        },
        {
          "type": "paragraph",
          "text": "现在发送 title=first、Authorization=Bearer alice-demo。中间件创建 trace；Guard 记录 guard 并放行；Interceptor 先记录 before，再调用 next.handle；全局 ValidationPipe 校验参数；控制器写 handler；服务把新笔记加入内存；成功结果通过 tap 写入 after 和 x-trace 响应头。默认 POST 成功返回 201，而不是因为 JSON 里某个字段决定状态码。"
        },
        {
          "type": "paragraph",
          "text": "这里 next.handle 返回 Observable，Interceptor 把额外的处理连接在这条结果流上。tap 不改变 note 本身；catchError 把错误记录后重新抛出；finalize 用于记录无论成功失败都会到来的清理阶段。它们并不意味着 JavaScript 线程上的普通同步函数可以被抢占。"
        },
        {
          "type": "paragraph",
          "text": "响应头是 tap 执行时的快照，所以成功的 x-trace 没有之后的 interceptor:finalize。不能因为头里没有 finalize 就断定清理没有执行。同样，Filter 的 JSON 是 catch 时复制出来的 trace，后续 push 不能修改已经序列化的响应。测试只对稳定的责任边界作断言，不把快照冒充完整系统追踪。"
        }
      ]
    },
    {
      "id": "four-boundaries",
      "title": "四种结果：为什么错误不都走同一条支路",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "输入",
            "响应",
            "关键观察"
          ],
          "rows": [
            [
              "合法标题 + 演示令牌",
              "201",
              "handler、interceptor:after 出现，服务写入一条"
            ],
            [
              "title 是数字或出现 tenant 字段",
              "400",
              "Guard 和 interceptor:before 已执行，handler 不执行"
            ],
            [
              "演示令牌不匹配",
              "403",
              "只有 middleware、guard、filter；Interceptor 没有进入"
            ],
            [
              "title=crash",
              "500",
              "handler 已进入，interceptor:error 与 filter 接管，私有错误信息不返回"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "Guard 在本章负责一个非常窄的放行条件。它抛出 ForbiddenException 时，后面的 Interceptor、Pipe 和处理器都还没进入，因此 Interceptor 的 catchError 无法捕获这个错误。Filter 是 HTTP 异常最终映射位置，可以处理这个拒绝。第三方中间件自行写响应、流式响应已经发出响应头等情况不在这张简化表内。"
        },
        {
          "type": "paragraph",
          "text": "Pipe 负责把“拿到一个 JSON 对象”变成“得到满足输入约束的对象”。CreateNoteDto 在运行时是一个类，class-validator 能读取装饰器元数据。title:number 在编译时写不出来，并不能阻止网络发送 {title:3}。没有运行时校验，控制器拿到的数据不会因为 TypeScript 类型注解而自动变好。"
        },
        {
          "type": "paragraph",
          "text": "whitelist 与 forbidNonWhitelisted 配合，直接拒绝没有校验装饰器的额外属性。因此客户端试图夹带 tenant-b 时返回 400；它不能覆盖服务端固定的 tenant-a。transform:true 创建 DTO 实例，不代表任意字符串数字都被隐式接受。本例没有启用 enableImplicitConversion，业务转换必须明确定义。"
        },
        {
          "type": "paragraph",
          "text": "处理器的 crash 分支故意在写入之前抛错，用来证明这条路径不会保存笔记。Filter 对未知错误只返回 INTERNAL 和 requestId，不把堆栈或私有消息暴露出去。它不是“修复了失败的业务”，只是把错误变成可管理的 HTTP 输出。若在写库后才抛错，Filter 也不会撤销写入；那需要数据库事务。"
        }
      ]
    },
    {
      "id": "run-it",
      "title": "自己运行：同时检查响应与服务状态",
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
          "text": "本项目锁定 Node 24.14.1、Nest 12.2.0、TypeScript 5.7.2、RxJS 7.8.2。解压本章 ZIP 后，在项目根目录执行 npm ci --ignore-scripts、npm test。测试会先 tsc，再在真实 loopback HTTP 端口上发请求，finally 中 app.close，不会占用网站端口，也不访问任何数据库。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/nestjs-request-lifecycle/test.mjs",
          "purpose": "完整 HTTP 验收：成功、运行时类型错误、Guard 拒绝、处理器异常、额外字段、恢复请求，以及内存副作用计数。",
          "kind": "excerpt",
          "code": "import test from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { createApp, NotesService } from \"./dist/app.js\";\ntest(\n  \"real HTTP lifecycle: success / DTO / guard / handler exception and side effects\",\n  { timeout: 15000 },\n  async () => {\n    const app = await createApp();\n    try {\n      const url = await app.getUrl();\n      const call = (body, token = \"alice-demo\") =>\n        fetch(url + \"/notes\", {\n          method: \"POST\",\n          headers: {\n            \"content-type\": \"application/json\",\n            authorization: \"Bearer \" + token,\n          },\n          body: JSON.stringify(body),\n        });\n      let r = await call({ title: \"first\" });\n      assert.equal(r.status, 201);\n      assert.equal((await r.json()).title, \"first\");\n      assert.equal(\n        r.headers.get(\"x-trace\"),\n        \"middleware,guard,interceptor:before,handler,interceptor:after\",\n      );\n      r = await call({ title: 3 });\n      assert.equal(r.status, 400);\n      let b = await r.json();\n      assert.deepEqual(b.trace.slice(0, 3), [\n        \"middleware\",\n        \"guard\",\n        \"interceptor:before\",\n      ]);\n      assert.ok(!b.trace.includes(\"handler\"));\n      assert.ok(b.trace.includes(\"interceptor:error\"));\n      assert.equal(b.trace.at(-1), \"filter\");\n      r = await call({ title: \"denied\" }, \"bob-invalid\");\n      assert.equal(r.status, 403);\n      assert.deepEqual((await r.json()).trace, [\n        \"middleware\",\n        \"guard\",\n        \"filter\",\n      ]);\n      r = await call({ title: \"crash\" });\n      assert.equal(r.status, 500);\n      b = await r.json();\n      assert.equal(b.error, \"INTERNAL\");\n      assert.ok(b.trace.includes(\"handler\"));\n      assert.ok(b.trace.includes(\"interceptor:error\"));\n      assert.ok(!JSON.stringify(b).includes(\"private detail\"));\n      r = await call({ title: \"extra\", tenant: \"tenant-b\" });\n      assert.equal(r.status, 400);\n      assert.equal(app.get(NotesService).notes.length, 1);\n      r = await call({ title: \"recovered\" });\n      assert.equal(r.status, 201);\n      assert.equal(app.get(NotesService).notes.length, 2);\n      console.log(\n        JSON.stringify({\n          success: 201,\n          invalid: 400,\n          guard: 403,\n          handler: 500,\n          recovery: 201,\n          stored: 2,\n        }),\n      );\n    } finally {\n      await app.close();\n      assert.equal(app.getHttpServer().listening, false);\n    }\n  },\n);"
        },
        {
          "type": "paragraph",
          "text": "本次实际运行的断言组为 1 个测试，包含上表四条路径和恢复检查；不是只检查“进程能启动”。结果 success=201、invalid=400、guard=403、handler=500、recovery=201、stored=2。数字 title、越权字段和 crash 都没有增加数组长度；随后正常请求仍能保存，说明单次失败没有把服务永久弄坏。"
        },
        {
          "type": "paragraph",
          "text": "要手动观察，执行 npm start，用打印的 URL 发 POST /notes。请求头 Content-Type: application/json、Authorization: Bearer alice-demo，请求体 {\"title\":\"first\"}。缺 Content-Type 的结果不能直接拿来推翻 DTO 测试，因为解析层拿到的请求形态已经不同。调试时按入口、Guard、Pipe、Handler、Filter 顺序定位，不要看到 400 就先猜数据库。"
        }
      ]
    },
    {
      "id": "source-and-limits",
      "title": "回到源码与边界：知道结论来自哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "固定 Nest v12.2.0 的 RouterExecutionContext 在建立处理链时连接 Guard、参数 Pipe 与 Interceptor，ExceptionsHandler 决定过滤器的选择。下面的引用用于追溯实现，不承担补齐上文代码的责任。我们验证的是本项目的全局注册组合，没有声称多个参数 Pipe 的顺序、全局/控制器/方法级组合都与这张单链图完全相同。"
        },
        {
          "type": "paragraph",
          "text": "本章 403 是故意选择的演示 Guard 结果，不是一个完整身份协议的状态码规范。第四篇将把缺失或无效身份映射为 401，把已知身份但无操作权限映射为 403，并用 tenant+owner 条件隐藏不可见资源为 404。当前固定令牌、内存存储和无请求容量限制，都明确不适合作为生产笔记服务。"
        },
        {
          "type": "paragraph",
          "text": "读到这里，你应能回答：非法输入为什么没有进入处理器？Guard 错误为什么没有 Interceptor 记录？错误过滤器为什么不能回滚已发生的业务？这些答案来自参与位置和副作用边界。下一篇继续处理同样重要、但不属于请求钩子顺序的问题：这些对象由谁创建、可以被谁注入、到底活多久。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Nest 官方请求生命周期",
      "url": "https://docs.nestjs.com/faq/request-lifecycle"
    },
    {
      "title": "Nest v12.2.0 RouterExecutionContext",
      "url": "https://github.com/nestjs/nest/blob/v12.2.0/packages/core/router/router-execution-context.ts"
    },
    {
      "title": "Nest v12.2.0 ExceptionsHandler",
      "url": "https://github.com/nestjs/nest/blob/v12.2.0/packages/core/exceptions/exceptions-handler.ts"
    },
    {
      "title": "ValidationPipe 官方文档",
      "url": "https://docs.nestjs.com/techniques/validation"
    }
  ]
};
export default article;
