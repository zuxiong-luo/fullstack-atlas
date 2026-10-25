import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "nestjs-modules-di",
  "topic": "nestjs",
  "title": "模块与依赖注入：Provider、作用域和生命周期",
  "description": "把租户笔记服务拆成明确的模块边界，验证 token、可见性、异步初始化、不同实例作用域与资源释放。",
  "minutes": 35,
  "labMinutes": 20,
  "tags": [
    "NestJS",
    "Node.js",
    "TypeScript",
    "租户笔记服务"
  ],
  "scope": "把租户笔记服务拆成明确的模块边界，验证 token、可见性、异步初始化、不同实例作用域与资源释放。",
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
      "path": "nestjs-modules-di.zip"
    },
    {
      "label": "阅读运行说明",
      "path": "nestjs-modules-di/README.md"
    }
  ],
  "sections": [
    {
      "id": "container-and-token",
      "title": "容器与 token：注入的是哪一个对象",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "依赖注入是一种对象装配方式：一个类声明自己需要什么，由容器按注册规则提供对象，而不是让它自己在内部 new 全部依赖。Nest 模块把这组注册规则组织起来。理解它时先分开两个问题：token 决定“要找谁”，scope 决定“何时创建、由谁共享”。"
        },
        {
          "type": "paragraph",
          "text": "Controller 接收 NotesService 时，类本身可以作为 token。接口却不能直接用作运行时 token，因为 TypeScript 接口在编译后消失了。因此本章用 Symbol 创建 CONFIG、CLOCK、AUDIT 三个 token。符号描述相同不代表同一个 token；在两个文件各写 Symbol(\"CONFIG\") 会得到两个不同值，应导出同一份常量再导入。"
        },
        {
          "type": "paragraph",
          "text": "笔记服务现在要读取固定教学时钟、租户配置和审计资源。配置属于基础设施模块，HTTP 控制器只声明需要哪些接口，不负责创建它们。我们仍用 tenant-a/alice、tenant-b/bob 作为教学数据；x-client-id 只是观测请求实例的标签，没有任何认证能力。"
        },
        {
          "type": "paragraph",
          "text": "容器不会因为某个文件 import 了一个类，就自动允许注入它。ES module/CommonJS 的 import 让 JavaScript 能引用这个值，Nest 的 imports/exports 则决定提供者在哪个模块可见。这两个“导入”作用于不同层次，混在一起最容易造成“文件明明存在为什么找不到”的困惑。"
        }
      ]
    },
    {
      "id": "provider-shapes",
      "title": "useValue、useClass、useFactory 各自解决什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "注册方式",
            "对象来源",
            "本章用途"
          ],
          "rows": [
            [
              "useValue",
              "调用者已准备好的值",
              "固定 clock 对象，测试可以直接替换"
            ],
            [
              "useClass",
              "容器创建指定类的实例",
              "AUDIT 由 AuditSink 实现，类可声明依赖与生命周期"
            ],
            [
              "useFactory",
              "容器调用工厂，等待它的返回值",
              "CONFIG 异步读到冻结的租户配置"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "useValue 很直接：CLOCK 对应的就是我们传入的对象。它适合已经创建的客户端或测试替身，但这个对象是可变的，冻结与并发安全需要自己决定。useClass 表示“请求 AUDIT 时按 AuditSink 类创建”，不是把所有 AuditSink 的任意注册都变成同一对象；如果另行注册 AuditSink 类 token，可能得到另一实例。要做别名应考虑 useExisting。"
        },
        {
          "type": "paragraph",
          "text": "useFactory 适合需要额外装配步骤的依赖。工厂可以声明 inject 的 token，也可以返回 Promise；Nest 会等待它完成，依赖该值的对象才具备可用配置。这里用 setImmediate 表示一个可观察的异步步骤，不声称它模拟了真实密钥服务。返回 Object.freeze 是为了固定这份教学配置，冻结也只是浅层冻结。"
        },
        {
          "type": "paragraph",
          "text": "三种方式不是谁更高级，而是对象所有权不同。自己创建 useValue 资源时，要明确由应用、调用者还是测试负责关闭；不要在两个容器都 close 同一条共享连接。下一章 DataSource 的所有权会直接决定连接池能否正确销毁。"
        }
      ]
    },
    {
      "id": "visibility",
      "title": "模块可见性：imports 不等于把所有内部对象摊开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "InfrastructureModule.forRoot 返回 DynamicModule。所谓动态模块，是一个由函数计算出来的模块注册描述，不是请求进来时动态下载一段代码。这里把 tenant 作为参数，组装三个 provider，并且显式 exports 它们；AppModule imports 这个模块后，控制器才能注入这些 token。"
        },
        {
          "type": "paragraph",
          "text": "导出边界的作用类似一份服务接口：模块内部可以增加连接缓存或解析器，而不要求业务模块知道全部实现。不要为了消除报错把所有模块都设为 global，也不要到处重复注册同一个有状态 Service。重复注册通常意味着多个实例和多份缓存，而不是“确保它存在”。"
        },
        {
          "type": "figure",
          "src": "figures/nestjs-modules-di.svg",
          "title": "模块可见性与对象共享",
          "alt": "Controller 分别注入基础设施 token、RequestIdentity 和 ConsumerA/B；两个 Consumer 各自拥有独立 Scratch。箭头表示依赖分支，不是请求执行顺序。",
          "caption": "Controller 分别注入基础设施 token、RequestIdentity 和 ConsumerA/B；两个 Consumer 各自拥有独立 Scratch。箭头表示依赖分支，不是请求执行顺序。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-modules-di/src/app.ts",
          "purpose": "本章完整运行核心：动态模块、三种 Provider、请求实例、两个 transient 消费者，以及可观察的资源生命周期。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport {\n  Controller,\n  Get,\n  Inject,\n  Injectable,\n  Module,\n  OnApplicationShutdown,\n  OnModuleInit,\n  Scope,\n  DynamicModule,\n} from \"@nestjs/common\";\nimport { NestFactory, REQUEST } from \"@nestjs/core\";\nimport { randomUUID } from \"node:crypto\";\nimport type { Request } from \"express\";\nexport const CONFIG = Symbol(\"CONFIG\");\nexport const CLOCK = Symbol(\"CLOCK\");\nexport const AUDIT = Symbol(\"AUDIT\");\nexport const events: string[] = [];\n@Injectable()\nexport class AuditSink implements OnModuleInit, OnApplicationShutdown {\n  readonly id = randomUUID();\n  opened = false;\n  closed = false;\n  async onModuleInit() {\n    await new Promise((resolve) => setImmediate(resolve));\n    this.opened = true;\n    events.push(\"audit:opened\");\n  }\n  onApplicationShutdown() {\n    this.closed = true;\n    events.push(\"audit:closed\");\n  }\n}\n@Module({})\nexport class InfrastructureModule {\n  static forRoot(tenant: string): DynamicModule {\n    return {\n      module: InfrastructureModule,\n      providers: [\n        {\n          provide: CONFIG,\n          useFactory: async () => {\n            await new Promise((resolve) => setImmediate(resolve));\n            events.push(\"config:ready\");\n            return Object.freeze({ tenant });\n          },\n        },\n        { provide: CLOCK, useValue: { now: () => \"2026-10-25T00:00:00Z\" } },\n        { provide: AUDIT, useClass: AuditSink },\n      ],\n      exports: [CONFIG, CLOCK, AUDIT],\n    };\n  }\n}\n@Injectable({ scope: Scope.REQUEST })\nclass RequestIdentity {\n  readonly id = randomUUID();\n  constructor(@Inject(REQUEST) readonly request: Request) {}\n}\n@Injectable({ scope: Scope.TRANSIENT })\nclass Scratch {\n  readonly id = randomUUID();\n}\n@Injectable()\nclass ConsumerA {\n  constructor(readonly scratch: Scratch) {}\n}\n@Injectable()\nclass ConsumerB {\n  constructor(readonly scratch: Scratch) {}\n}\n@Controller(\"notes\")\nclass NotesController {\n  constructor(\n    @Inject(CONFIG) private readonly config: { tenant: string },\n    @Inject(CLOCK) private readonly clock: { now: () => string },\n    @Inject(AUDIT) private readonly audit: AuditSink,\n    private readonly request: RequestIdentity,\n    private readonly a: ConsumerA,\n    private readonly b: ConsumerB,\n  ) {}\n  @Get(\"identities\")\n  identities() {\n    return {\n      tenant: this.config.tenant,\n      owner: \"alice\",\n      now: this.clock.now(),\n      audit: this.audit.id,\n      opened: this.audit.opened,\n      request: this.request.id,\n      requestHeader: this.request.request.headers[\"x-client-id\"] ?? null,\n      a: this.a.scratch.id,\n      b: this.b.scratch.id,\n    };\n  }\n}\n@Module({\n  imports: [InfrastructureModule.forRoot(\"tenant-a\")],\n  controllers: [NotesController],\n  providers: [RequestIdentity, Scratch, ConsumerA, ConsumerB],\n})\nexport class AppModule {}\nexport async function createApp() {\n  const app = await NestFactory.create(AppModule, { logger: false });\n  await app.listen(0, \"127.0.0.1\");\n  return app;\n}"
        }
      ]
    },
    {
      "id": "scopes",
      "title": "实例作用域：共享范围比“每次 new”更精确",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "默认 scope 是 singleton：在当前应用容器中复用一个提供者实例。两个 HTTP 请求读到相同 audit.id，且 opened=true。请留意“当前容器”这个前提，另一个应用或进程有自己的实例，singleton 不是跨进程全局单例。"
        },
        {
          "type": "paragraph",
          "text": "REQUEST 表示每个请求上下文各有一个实例。RequestIdentity 注入 REQUEST 后能读取当前请求头；alice 与 bob 两次请求得到不同 id。依赖请求作用域对象的控制器也需要在相应请求上下文中解析，这叫作用域传播。不能因为控制器装饰器没写 scope 就假定它必定全局单例。"
        },
        {
          "type": "paragraph",
          "text": "TRANSIENT 的关键是消费方。每个注入该 provider 的消费对象得到独立实例，而不是每次调用方法、每次读取属性或每次 HTTP 请求都刷新。ConsumerA 与 ConsumerB 都是 singleton，分别拿到自己的 Scratch；所以 a.scratch.id 与 b.scratch.id 不同，但第二次请求仍能看见各自相同的 id。"
        },
        {
          "type": "paragraph",
          "text": "这组对照比背定义更可靠。如果你把 Scratch 改成默认 scope，两个消费者会看到同一个 id；如果把消费者也放到请求作用域，每个请求的消费对象变了，transient 身份随之变化。选择 scope 时看数据寿命：数据库连接池适合应用级，当前用户信息适合显式参数或请求上下文。为避免一份小配置变成整个依赖链每请求重建，能用参数表达的请求信息不必全部放进 scope。"
        }
      ]
    },
    {
      "id": "initialization-and-release",
      "title": "初始化与关闭：资源有寿命，不能只看构造函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "构造函数适合建立对象关系，不适合发起无法等待的异步连接。AuditSink 用 onModuleInit 完成异步准备，并在完成后设置 opened；配置工厂先产生配置，应用初始化阶段再准备资源，最后才监听。测试直接观察 opened=true，避免只看到一个方法存在就声称初始化完成。"
        },
        {
          "type": "paragraph",
          "text": "应用关闭时，onApplicationShutdown 释放由这个应用拥有的审计资源。这里资源是教学状态，真实连接应 await 它的 close/end。请求作用域实例不适用这些应用生命周期钩子；请求结束清理要通过明确的 finally、响应关闭监听或受控上下文完成，不能期待它们逐请求调用 onApplicationShutdown。"
        },
        {
          "type": "paragraph",
          "text": "本章测试使用 app.close 直接关闭，并验证 closed=true。独立 main 为 SIGTERM/SIGINT 调用 app.close；它演示信号连接，不声称已完成在途请求预算或 Kubernetes 摘流。第六章会用子进程和真实请求验证 drain。关闭动作若永远等待外部资源，进程仍会挂住；生命周期钩子只是放置清理的位置，预算必须另外实现。"
        }
      ]
    },
    {
      "id": "missing-export",
      "title": "可复现的注入失败：错误告诉你哪一层没连上",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面故意创建一个没有 exports 的 HiddenModule。NeedsPrivate 所在模块 imports 它，但 PRIVATE 仍然是内部提供者。TestingModule.compile 会拒绝并给出无法解析依赖的信息。这个测试没有发 HTTP，因为错误发生在应用构建期，比请求早得多。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-modules-di/src/missing.ts",
          "purpose": "完整失败样例：文件能够引用同一个 token，但模块未导出它，业务模块无法注入。",
          "kind": "excerpt",
          "code": "import \"reflect-metadata\";\nimport { Inject, Injectable, Module } from \"@nestjs/common\";\nimport { Test } from \"@nestjs/testing\";\nconst PRIVATE = Symbol(\"PRIVATE\");\n@Module({ providers: [{ provide: PRIVATE, useValue: { tenant: \"tenant-a\" } }] })\nclass HiddenModule {}\n@Injectable()\nclass NeedsPrivate {\n  constructor(@Inject(PRIVATE) readonly config: unknown) {}\n}\n@Module({ imports: [HiddenModule], providers: [NeedsPrivate] })\nclass BrokenModule {}\nexport async function missingExport() {\n  return Test.createTestingModule({ imports: [BrokenModule] }).compile();\n}"
        },
        {
          "type": "paragraph",
          "text": "修复时先看错误指出的参数位置，再检查 token 是否同一个值、provider 是否注册、其所属模块是否 exports、调用模块是否 imports。不要第一步就 new 一个对象绕过容器，否则依赖中的配置、钩子和测试替换可能全部失效。"
        },
        {
          "type": "paragraph",
          "text": "循环依赖是另一个问题：NotesService 需要 PolicyService，同时 PolicyService 又需要 NotesService，容器无法按普通的有向依赖关系完成装配。forwardRef 可以延后部分类引用的解析，但不会让这个业务环变得好理解，构造顺序仍不能依赖。本章选择把“是否能写笔记”抽成不反向调用存储服务的 Policy，让依赖方向保持单向。异步工厂互相等待的循环尤其不能指望 forwardRef 消除。下面补一个独立的双向类引用实验，验证forwardRef确实能解析这种引用，但两个构造函数都只保存引用，不调用对方方法。"
        }
      ]
    },
    {
      "id": "circular-reference",
      "title": "forwardRef解决引用时机，不消除业务依赖环",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/nestjs-modules-di/src/circular.ts",
          "purpose": "完整双向类引用实验：用forwardRef延迟token求值，构造函数不依赖另一对象已初始化。",
          "kind": "excerpt",
          "code": "import 'reflect-metadata';\nimport {Inject,Injectable,forwardRef} from '@nestjs/common';import {Test} from '@nestjs/testing';\n@Injectable()\nexport class Left {\n // The interface-like object type avoids an eager JS metadata reference to Right before its declaration.\n constructor(@Inject(forwardRef(()=>Right)) readonly right:object){}\n}\n@Injectable()\nexport class Right {constructor(@Inject(forwardRef(()=>Left)) readonly left:object){}}\nexport async function circularExample(){return Test.createTestingModule({providers:[Left,Right]}).compile();}"
        },
        {
          "type": "paragraph",
          "text": "TypeScript发射设计类型元数据也会求值类型引用；当Right尚未声明时，直接把它作为构造参数的具体类型可能在容器运行前就触发JavaScript暂时性死区。本例参数标为object，而运行时token由@Inject(forwardRef(...))给出，避免把语言求值错误与容器循环混为一谈。测试在容器编译完成后比较双向引用，证明对象图连上；它不承诺构造顺序，也不把循环当作推荐业务边界。"
        }
      ]
    },
    {
      "id": "reproduce",
      "title": "运行与验证：身份不靠随机值的具体字符串判断",
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
          "text": "本章 ZIP 可独立运行，不依赖第一篇目录。Node 24.14.1 下执行 npm ci --ignore-scripts、npm test。编译完成后测试启动真实 HTTP 服务，发两次请求比较对象身份；最后 app.close 并验证资源关闭。另一个测试只编译故意缺少导出的模块，确认它失败；第三个验证forwardRef双向引用在容器完成后指向同一组对象。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/nestjs-modules-di/test.mjs",
          "purpose": "完整三项测试：作用域与资源身份关系、异步就绪、关闭回收，以及缺失 exports 的构建失败。",
          "kind": "excerpt",
          "code": "import test from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { createApp, AUDIT, events } from \"./dist/app.js\";\nimport { missingExport } from \"./dist/missing.js\";\ntest(\n  \"scope identity, async configuration, singleton resources and release\",\n  { timeout: 15000 },\n  async () => {\n    const app = await createApp(),\n      audit = app.get(AUDIT);\n    try {\n      const base = await app.getUrl();\n      const read = async (who) => {\n        const r = await fetch(base + \"/notes/identities\", {\n          headers: { \"x-client-id\": who },\n        });\n        assert.equal(r.status, 200);\n        return r.json();\n      };\n      const a = await read(\"alice\"),\n        b = await read(\"bob\");\n      assert.equal(a.tenant, \"tenant-a\");\n      assert.equal(a.now, \"2026-10-25T00:00:00Z\");\n      assert.equal(a.audit, b.audit);\n      assert.notEqual(a.request, b.request);\n      assert.equal(a.requestHeader, \"alice\");\n      assert.equal(b.requestHeader, \"bob\");\n      assert.notEqual(a.a, a.b);\n      assert.equal(a.a, b.a);\n      assert.equal(a.b, b.b);\n      assert.equal(a.opened, true);\n      assert.deepEqual(events, [\"config:ready\", \"audit:opened\"]);\n      console.log(\n        JSON.stringify({\n          singletonSame: true,\n          requestDifferent: true,\n          transientDifferentConsumers: true,\n          transientStableConsumer: true,\n          asyncInitialized: true,\n        }),\n      );\n    } finally {\n      await app.close();\n      assert.equal(audit.closed, true);\n      assert.equal(events.at(-1), \"audit:closed\");\n    }\n  },\n);\ntest(\n  \"a provider that is not exported cannot be injected through imports\",\n  { timeout: 10000 },\n  async () => {\n    await assert.rejects(missingExport(), /resolve dependencies/);\n  },\n);\n\ntest('forwardRef resolves a class reference cycle without relying on constructor order',{timeout:10000},async()=>{\n const {Left,Right,circularExample}=await import('./dist/circular.js');const module=await circularExample();\n try{const left=module.get(Left),right=module.get(Right);assert.equal(left.right,right);assert.equal(right.left,left);}finally{await module.close();}\n});"
        },
        {
          "type": "paragraph",
          "text": "本次实际执行 3/3 测试通过。观察输出 singletonSame=true、requestDifferent=true、transientDifferentConsumers=true、transientStableConsumer=true、asyncInitialized=true。UUID 每次运行会变化；验收依据是相等/不等关系，而不是把一次 UUID 写死。"
        },
        {
          "type": "paragraph",
          "text": "手动执行 npm start 后访问打印 URL 的 /notes/identities，分别带 x-client-id: alice 和 bob。返回 requestHeader 会不同，request id 也不同；audit id 则相同。这里 GET 的 owner:alice 只是沿用笔记服务背景，不表明 bob 已获得 alice 的权限。真正的资源授权在第四篇验证。"
        }
      ]
    },
    {
      "id": "design-cost",
      "title": "知道什么时候不用更多容器技巧",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "把全部函数都包装成 provider 会提高配置成本，模块间来回导出也会掩盖真正的业务边界。纯计算函数不需要生命周期，可以直接作为函数使用。需要替换策略、共享有寿命的资源、按上下文装配对象时，再让容器介入。"
        },
        {
          "type": "paragraph",
          "text": "本篇的结论可以归为三条因果链：相同 token 加可见模块注册才能找到依赖；scope 加消费对象寿命决定实例共享关系；应用钩子加明确资源所有权才能完成关闭。它们共同解释了“同一个类为什么有时不是同一个对象”。下一篇让同样的边界承担真实 PostgreSQL 连接与事务，届时重复注册资源或拿错 manager 会造成实际数据库后果。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Nest 自定义 Provider",
      "url": "https://docs.nestjs.com/fundamentals/custom-providers"
    },
    {
      "title": "Nest 作用域",
      "url": "https://docs.nestjs.com/fundamentals/injection-scopes"
    },
    {
      "title": "Nest 生命周期",
      "url": "https://docs.nestjs.com/fundamentals/lifecycle-events"
    },
    {
      "title": "Nest v12.2.0 Injector",
      "url": "https://github.com/nestjs/nest/blob/v12.2.0/packages/core/injector/injector.ts"
    },
    {
      "title": "Nest 动态模块",
      "url": "https://docs.nestjs.com/fundamentals/dynamic-modules"
    }
  ]
};
export default article;
