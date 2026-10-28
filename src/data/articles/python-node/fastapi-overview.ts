import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-fastapi-overview",
  "topic": "python",
  "title": "FastAPI 做什么：定位、能力边界，以及它和 NestJS 的差异",
  "description": "面向有Node.js与NestJS经验的开发者，先厘清FastAPI、Starlette、Pydantic和Uvicorn的分工，再用真实双端报价接口解释路由、校验、依赖、生命周期与响应边界。",
  "minutes": 55,
  "tags": [
    "FastAPI",
    "NestJS对照",
    "ASGI",
    "Pydantic",
    "Depends",
    "APIRouter",
    "Uvicorn"
  ],
  "scope": "新版Python系列第9篇，先行交付的框架总览。主讲组件分工和请求处理；配套报价接口只做本地计算，不提交AI任务、不扣费、不接数据库。",
  "prerequisites": [
    "熟悉JavaScript / TypeScript、Node.js与HTTP接口",
    "有NestJS经验更容易对照；陌生Python语法会就近展开说明"
  ],
  "sections": [
    {
      "id": "position",
      "title": "先定位：FastAPI 在你熟悉的后端架构里处于哪一层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "你已经写过NestJS服务，可以先把FastAPI放在“把业务能力开放成HTTP接口”这一层来看。它是Python的Web框架，负责将URL和HTTP方法匹配到处理函数，根据声明读取和校验参数，组织依赖调用，再把返回结果变成响应。它还可以根据这些声明生成OpenAPI描述和交互文档。"
        },
        {
          "type": "paragraph",
          "text": "它很适合把Python里的数据处理、模型调用或普通业务逻辑提供给Web、移动端和其他服务。你可以写一个视频报价接口、一个调用AI模型的接口，也可以提供流式响应或WebSocket。选用它的理由是这些能力和Python生态的组合，并不是只要业务里出现AI，就必须使用FastAPI。"
        },
        {
          "type": "paragraph",
          "text": "但把它直接称为“Python版NestJS”容易带错预期。NestJS围绕Module、Controller、Provider等组织整套应用；FastAPI的主要使用方式是应用对象、路由函数、类型声明与依赖函数。两者都能做后端服务，却不意味着项目组织、依赖生命周期和外围工具都有一一对应的实现。"
        },
        {
          "type": "paragraph",
          "text": "这篇先完成一件事：让你看到一个FastAPI项目时，知道谁接收网络连接、哪个对象负责路由、哪段代码在校验数据、业务服务怎样被拿到，以及框架替你做到了哪里。我们会交付一个真实可运行的报价接口，并用NestJS实现相同业务作对照。数据库、完整账号系统和可靠任务队列先放在能力边界里说明。"
        },
        {
          "type": "reference",
          "title": "FastAPI：功能与组成",
          "url": "https://fastapi.tiangolo.com/features/",
          "note": "用于核对Web能力、OpenAPI、Starlette和Pydantic的分工。本文代码与行为另以锁定依赖实测，不把官方功能列表当作示例已实现的功能。"
        }
      ]
    },
    {
      "id": "components",
      "title": "先分清四个名字：Uvicorn、Starlette、FastAPI、Pydantic",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "你可能会同时在依赖里看到这四个包。它们不是四个互相替代的Web框架，也不是每次请求都严格依次经过的四个独立服务。Uvicorn运行应用；Starlette提供底层Web能力；FastAPI在这些能力之上组织API；Pydantic参与数据处理。"
        },
        {
          "type": "table",
          "headers": [
            "组件",
            "本篇里负责什么",
            "用Node经验理解"
          ],
          "rows": [
            [
              "Python / asyncio",
              "执行Python代码，提供异步运行基础",
              "对应语言运行时和异步机制这一层；不要把FastAPI当成Node.js运行时"
            ],
            [
              "Uvicorn",
              "监听端口、处理协议，通过ASGI调用应用并发送响应",
              "是HTTP/ASGI服务器；与Node HTTP服务器承担的部分职责相近"
            ],
            [
              "ASGI",
              "服务器和应用之间交换连接信息与事件的接口约定",
              "是接口规范，不是另外一台服务器，也不是业务SDK"
            ],
            [
              "Starlette",
              "底层ASGI应用、Request/Response、路由、中间件、WebSocket等能力",
              "可以借Express/Fastify的底层Web职责理解，但具体结构不同"
            ],
            [
              "FastAPI",
              "结合函数签名、路由声明、依赖和模型组织API处理，生成OpenAPI",
              "与NestJS接口层有交集；不照搬Nest的Module/Provider组织方式"
            ],
            [
              "Pydantic",
              "按模型处理输入、验证字段，并参与输出序列化与校验",
              "覆盖DTO运行时数据处理的一部分，不只是TS类型，也不是ORM"
            ]
          ]
        },
        {
          "type": "figure",
          "src": "figures/python-fastapi-overview/components.svg",
          "title": "一次报价请求用到哪些组件",
          "alt": "客户端通过HTTP连接Uvicorn；Uvicorn通过ASGI调用FastAPI应用。应用使用Starlette底层能力，FastAPI解析依赖和参数并调用Pydantic处理模型，最后调用业务服务。",
          "caption": "Pydantic是应用调用的库，不是独立网络节点。图形区域在手机上可以横向滚动，或放大查看。"
        },
        {
          "type": "paragraph",
          "text": "ASGI最小形态可以理解成一个可等待的调用入口：application(scope, receive, send)。scope描述连接与请求上下文，receive提供输入事件，send发送响应事件。你平常写的路由函数不用手动操作这三个参数，因为框架已在它们之上提供Request、参数和响应抽象。"
        },
        {
          "type": "paragraph",
          "text": "这也解释了启动命令中的main:app：Uvicorn导入main模块，找到其中名叫app的ASGI应用对象，然后负责运行它。FastAPI()创建出对象，并不会因为文件执行到这一行，就自动把4195端口监听起来。"
        },
        {
          "type": "reference",
          "title": "ASGI：服务器与应用接口",
          "url": "https://asgi.readthedocs.io/en/latest/introduction.html",
          "note": "这里只解释协议分工，不要求先手写ASGI服务器。"
        }
      ]
    },
    {
      "id": "boundary",
      "title": "能力边界：框架直接提供什么，哪些还得自己组合",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "需求",
            "FastAPI及底层组件能提供的部分",
            "仍由你的应用负责"
          ],
          "rows": [
            [
              "HTTP API",
              "路径操作、参数读取、响应、错误处理入口",
              "业务规则、幂等、容量与数据一致性"
            ],
            [
              "输入与文档",
              "Pydantic模型处理、OpenAPI、Swagger UI",
              "决定允许什么数据，补充业务错误与授权规则"
            ],
            [
              "身份与权限",
              "Header/Cookie、依赖和安全相关工具",
              "账号体系、令牌校验、角色/资源权限及撤销策略"
            ],
            [
              "数据库",
              "可以用依赖和生命周期管理数据访问资源",
              "选择ORM/驱动，设计事务、索引、连接池与迁移"
            ],
            [
              "流式响应 / WebSocket",
              "底层Web通信能力与相应接口",
              "上游调用、连接数量、断连处理、背压与消息语义"
            ],
            [
              "后台工作",
              "BackgroundTasks可安排响应后的进程内工作",
              "持久化投递、工作进程、失败恢复、重试与幂等"
            ],
            [
              "部署",
              "应用可交给ASGI服务器运行",
              "反向代理、进程数、健康检查、日志、密钥及资源预算"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "比如你在MV里用BullMQ处理长任务，换成FastAPI并不会让队列消失。BackgroundTasks适合某些响应后的小工作，但它没有替你把工作持久化成跨进程可靠队列。进程退出时如何恢复、重复任务怎样处理，仍然需要单独设计。"
        },
        {
          "type": "paragraph",
          "text": "同样，Pydantic模型描述接口输入输出，不负责把记录存进PostgreSQL。SQLAlchemy、数据库驱动和Alembic属于另外一组工具。不要看到class QuoteInput(BaseModel)，就把它当成TypeORM实体。"
        },
        {
          "type": "reference",
          "title": "FastAPI：BackgroundTasks的适用范围",
          "url": "https://fastapi.tiangolo.com/tutorial/background-tasks/",
          "note": "本篇没有实现队列，也不把进程内后台工作描述成持久任务系统。"
        }
      ]
    },
    {
      "id": "concepts",
      "title": "核心概念地图：先知道每个名字要去哪里找",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "概念 / API",
            "你在代码中会看到什么",
            "和NestJS经验的联系及差异"
          ],
          "rows": [
            [
              "FastAPI应用",
              "app = FastAPI(...)",
              "应用装配入口，随后交给服务器运行"
            ],
            [
              "APIRouter",
              "router = APIRouter(...); app.include_router(router)",
              "组织路由和公共配置；不是有Provider可见性规则的Nest Module"
            ],
            [
              "路径操作",
              "@router.post(\"/quotes\")",
              "类似路由声明；下面通常是函数，不要求Controller类"
            ],
            [
              "参数声明",
              "body: QuoteInput、路径/查询/Header参数",
              "函数签名参与参数来源识别；不是只有编辑器提示"
            ],
            [
              "BaseModel / Field",
              "描述字段及限制",
              "运行时数据处理，不能与纯TS类型声明混为一谈"
            ],
            [
              "Depends",
              "Depends(get_pricing_service)",
              "框架求解并调用依赖；不是自动发现所有业务类的单例容器"
            ],
            [
              "response_model",
              "response_model=QuoteOutput",
              "会处理正常返回数据，也用于文档；不是仅给编译器看的返回类型"
            ],
            [
              "HTTPException",
              "raise HTTPException(status_code=409, ...)",
              "将一个已知应用结果转成HTTP错误响应的方式"
            ],
            [
              "middleware",
              "在应用周围处理请求和响应",
              "与HTTP中间件作用相近；与Nest Guard/Interceptor不机械对应"
            ],
            [
              "lifespan",
              "应用启动、运行、关闭的上下文",
              "用于实例内初始化/收尾；多worker会有多份生命周期"
            ],
            [
              "OpenAPI / docs",
              "/openapi.json与/docs",
              "Schema描述与展示界面，不自动执行业务或完成鉴权"
            ],
            [
              "TestClient",
              "测试中直接调用ASGI应用",
              "用途类似接口测试工具；不代表真实打开了监听端口"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "有了这张地图，下面每个代码文件就有位置了：schemas.py描述数据，service.py实现报价，api.py声明路由和依赖，main.py装配应用。我们只拆这四个职责，不为了看起来像大项目而先造一套多层目录。"
        }
      ]
    },
    {
      "id": "minimal",
      "title": "先运行最小应用：装饰器注册路由，服务器负责启动",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "from fastapi import FastAPI\n\napp = FastAPI()\n\n\n@app.get(\"/health\")\ndef health():\n    return {\"ok\": True}",
          "language": "python",
          "filename": "examples/python-node-course/09-fastapi-overview/minimal.py",
          "purpose": "完整最小文件。先看FastAPI应用与一条GET路由，不带报价、依赖或数据库。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "@app.get(\"/health\")是Python装饰器写法。在这个具体API里，它把下面的health函数注册为GET /health的处理函数。注册发生在模块导入时；收到匹配请求时，框架才调用处理函数，最后把字典转成JSON响应。"
        },
        {
          "type": "code",
          "code": "from fastapi import FastAPI\n\napp = FastAPI()\n\n\ndef health():\n    return {\"ok\": True}\n\n\nregister = app.get(\"/health\")\nhealth = register(health)\nprint(health())\nprint(any(route.path == \"/health\" for route in app.routes))",
          "language": "python",
          "filename": "examples/python-node-course/09-fastapi-overview/decorator-plain.py",
          "purpose": "同一个注册动作的展开写法。可以直接运行观察返回值和路由是否已注册，不是另一个HTTP服务。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{'ok': True}\nTrue",
          "purpose": "程序输出，供你和终端结果对照。",
          "language": "text",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "register = app.get(\"/health\")先得到一个用于注册的装饰器，再把health交给它。这样读@语法，就能看到实际调用关系。Python的其他装饰器可以返回新的包装函数，因此不能把所有@都简单理解成只保存元数据；这里只解释FastAPI这一种注册用法。"
        },
        {
          "type": "code",
          "code": "cd examples/python-node-course\npython3.12 --version\npython3.12 -m venv .venv\nsource .venv/bin/activate\npython -m pip install -r requirements.lock\ncd 09-fastapi-overview\npython -m uvicorn minimal:app --host 127.0.0.1 --port 4194",
          "purpose": "从仓库根目录开始，选择Python3.12。下载ZIP后进入python-node-course再执行安装。Windows的激活方式不同；本次验证环境见文末。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "curl -s http://127.0.0.1:4194/health",
          "purpose": "另开终端执行。完成后在服务终端按Ctrl+C停止。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "{\"ok\":true}",
          "purpose": "程序输出，供你和终端结果对照。",
          "language": "text",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "冒号前是模块名，后面是模块中的应用变量名；4194是示例端口。与NestFactory.create(...).listen(...)写在Node入口里不同，这次由Uvicorn命令承担启动动作。开发时可使用reload，但这篇先保持一个进程、不自动重载，方便看清生命周期。"
        }
      ]
    },
    {
      "id": "case",
      "title": "报价业务的范围：本篇验证HTTP能力，不提交生成任务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "接口是POST /api/quotes，输入视频时长seconds与画质quality。standard每秒2积分，hd每秒4积分；省略画质按standard。时长结构限制是1～120的整数，而HD超过60秒属于当前业务暂不支持的组合。报价只是计算结果，不扣积分、不存订单、不调用AI，也没有登录保护。"
        },
        {
          "type": "paragraph",
          "text": "这两层限制特意分开：seconds=\"30\"是输入类型不符合声明，返回422；seconds=61且quality=\"hd\"在字段层面有效，但业务不接受，返回409。你可以据此区分“框架校验参数”与“业务服务决定是否可做”。实际产品的报价规则还要考虑版本与计费，本例不把这几个固定数字当成生产方案。"
        },
        {
          "type": "code",
          "code": "POST /api/quotes\nContent-Type: application/json\n\n{\"seconds\":30,\"quality\":\"standard\"}",
          "purpose": "HTTP请求形状。成功响应应为seconds=30、quality=standard、credits=60。",
          "language": "text",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "python-node-course/\n  requirements.lock / package-lock.json\n  shared/quotes.json\n  09-fastapi-overview/\n    schemas.py       # 输入、输出模型\n    service.py       # 报价规则\n    api.py           # 路由、依赖、错误映射\n    main.py          # 应用与生命周期\n    nest-comparison.ts\n    test_app.py / test_http.py / test_nest.cjs",
          "purpose": "这是目录说明，不是可执行程序。Python文件在同一示例目录中，下面会给出全部关键实现。",
          "language": "text",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "models",
      "title": "输入模型：类型提示不会自己变成运行时校验",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先对照一件你在TypeScript里已经熟悉的事：类型声明不等于检查外部JSON。下面两段都故意把字符串\"30\"交给数字类型的函数，观察运行时实际保留了什么。TS里的as是故意制造的错误断言，Python的注解同样没有自动修复数据。"
        },
        {
          "type": "code",
          "code": "function echo(seconds: number): number {\n return seconds;\n}\n\nconst raw: unknown = JSON.parse('\"30\"');\nconsole.log(typeof echo(raw as number));",
          "language": "typescript",
          "filename": "examples/python-node-course/09-fastapi-overview/annotation-demo.ts",
          "purpose": "独立TS实验。npm run build后，node dist/annotation-demo.js；故意使用as展示静态断言不检查外部数据。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "string",
          "purpose": "程序输出，供你和终端结果对照。",
          "language": "text",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "def echo(seconds: int) -> int:\n    return seconds\n\n\nraw = \"30\"\nprint(type(echo(raw)).__name__)",
          "language": "python",
          "filename": "examples/python-node-course/09-fastapi-overview/annotation-demo.py",
          "purpose": "独立Python实验。在本示例目录运行python annotation-demo.py；静态检查器可能指出不匹配，但解释器仍按实际对象运行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "str",
          "purpose": "程序输出，供你和终端结果对照。",
          "language": "text",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "FastAPI的运行时处理来自它主动读取声明并调用校验工具，而不是Python语法自己突然有了强制检查。现在再看真正的输入输出模型："
        },
        {
          "type": "code",
          "code": "from typing import Literal\nfrom pydantic import BaseModel, ConfigDict, Field\n\n\nclass QuoteInput(BaseModel):\n    model_config = ConfigDict(extra=\"forbid\")\n    seconds: int = Field(strict=True, ge=1, le=120)\n    quality: Literal[\"standard\", \"hd\"] = \"standard\"\n\n\nclass QuoteOutput(BaseModel):\n    seconds: int\n    quality: Literal[\"standard\", \"hd\"]\n    credits: int",
          "language": "python",
          "filename": "examples/python-node-course/09-fastapi-overview/schemas.py",
          "purpose": "完整模型文件。输入严格限制整数及额外字段；输出只列公开字段。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "seconds: int = Field(strict=True, ge=1, le=120)把类型、严格校验和范围放在一个字段上。Literal[\"standard\",\"hd\"]限定可接受值，不是随便一个str；右侧默认值用于省略该字段时。ConfigDict(extra=\"forbid\")让额外字段被拒绝，而不是悄悄忽略。"
        },
        {
          "type": "paragraph",
          "text": "这个配置是本例主动选择的策略。Pydantic有类型转换能力，不能笼统说它永远拒绝字符串数字。本例为seconds打开strict，正是为了让参数规则与NestJS里关闭隐式转换后的IsInt检查更容易对照。下一篇会专门展开转换与严格模式。"
        },
        {
          "type": "reference",
          "title": "Pydantic：严格模式",
          "url": "https://docs.pydantic.dev/latest/concepts/strict_mode/",
          "note": "本文结果以Pydantic2.14.1和本例从JSON到模型的实际路径为准。"
        }
      ]
    },
    {
      "id": "service",
      "title": "业务服务：普通Python代码，不依赖Web框架才能运行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "class HdDurationExceeded(Exception):\n    pass\n\n\nclass PricingService:\n    def quote(self, seconds: int, quality: str) -> dict:\n        if quality == \"hd\" and seconds > 60:\n            raise HdDurationExceeded(\"HD报价最多支持60秒\")\n        rate = 4 if quality == \"hd\" else 2\n        return {\n            \"seconds\": seconds,\n            \"quality\": quality,\n            \"credits\": seconds * rate,\n            \"internal_rule\": \"demo-rate-v1\",\n        }",
          "language": "python",
          "filename": "examples/python-node-course/09-fastapi-overview/service.py",
          "purpose": "完整业务实现。HdDurationExceeded是业务异常；internal_rule故意保留在内部返回值，稍后验证响应过滤。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这段没有FastAPI装饰器，没有HTTP请求，也不认识409状态码。quote接收时长和画质，检查HD组合限制，计算积分，再返回一个字典。self这里只表示正在调用的服务实例；本篇不重新讲类的通用定义，后续类语法篇会对照JS的this与绑定方法。"
        },
        {
          "type": "paragraph",
          "text": "业务函数返回的internal_rule是内部诊断字段。公开接口不应该仅因服务多返回一个字段，就跟着多暴露它。我们接下来用QuoteOutput规定对外形状；它也让你看到输出模型不只是文档装饰。"
        },
        {
          "type": "paragraph",
          "text": "独立调用PricingService().quote(30,\"standard\")会得到包含internal_rule的字典；调用quote(61,\"hd\")会抛HdDurationExceeded。把同一段逻辑挂到命令行或其他调用入口时，不需要伪造一个HTTP请求。"
        }
      ]
    },
    {
      "id": "routing",
      "title": "路由与依赖：从签名看出参数来自哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "from typing import Annotated\nfrom fastapi import APIRouter, Depends, HTTPException, Request\nfrom schemas import QuoteInput, QuoteOutput\nfrom service import HdDurationExceeded, PricingService\n\nrouter = APIRouter(prefix=\"/api\", tags=[\"quotes\"])\n\n\ndef get_pricing_service(request: Request) -> PricingService:\n    return request.app.state.pricing\n\n\n@router.post(\"/quotes\", response_model=QuoteOutput)\ndef create_quote(\n    body: QuoteInput,\n    pricing: Annotated[PricingService, Depends(get_pricing_service)],\n):\n    try:\n        return pricing.quote(body.seconds, body.quality)\n    except HdDurationExceeded as error:\n        raise HTTPException(\n            status_code=409,\n            detail={\"code\": \"HD_LIMIT\", \"message\": str(error)},\n        ) from error",
          "language": "python",
          "filename": "examples/python-node-course/09-fastapi-overview/api.py",
          "purpose": "完整路由模块。请求体、依赖、业务调用、正常响应模型与409映射都在这里，没有把关键判断藏到外链。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "APIRouter(prefix=\"/api\")先组织一组路由，@router.post(\"/quotes\")提供后半段路径；随后main.py的include_router把这一组注册到应用。它承担路由组合的职责，不会因为你建了一个router，就自动获得Nest Module的imports/providers/exports规则。"
        },
        {
          "type": "paragraph",
          "text": "body: QuoteInput让框架按这个模型处理请求体。pricing: Annotated[PricingService, Depends(get_pricing_service)]可以拆成两部分看：PricingService说明你期望拿到的对象类型，Depends(...)是框架读取的参数元信息。Annotated用于把类型与这些附加信息放在一起；它不是在收到请求前就创建一个服务实例。"
        },
        {
          "type": "paragraph",
          "text": "Depends里传的是函数本身，所以没有写get_pricing_service()。框架求解请求依赖时才调用它，并为它提供Request。与Nest构造器注入可以类比的是“处理函数不用自己创建依赖”；不能照搬的是“声明类以后容器就自动找到并长期保存一个单例”。这里实例到底来自哪里，由get_pricing_service的实现明确决定。"
        },
        {
          "type": "paragraph",
          "text": "发生HD业务异常后，路由把它转换为HTTPException，detail保存公开的错误内容。raise ... from error保留异常原因链；HTTPException由框架的异常处理流程生成响应，属于已知业务错误，不是把所有异常都包装成成功JSON。其他程序错误仍应按服务端错误处理。"
        },
        {
          "type": "reference",
          "title": "FastAPI：依赖函数与参数",
          "url": "https://fastapi.tiangolo.com/tutorial/dependencies/",
          "note": "本例只展示普通依赖获取；依赖缓存、yield清理与鉴权将在后续专篇继续。"
        },
        {
          "type": "reference",
          "title": "FastAPI：APIRouter组织方式",
          "url": "https://fastapi.tiangolo.com/tutorial/bigger-applications/",
          "note": "路由组织与完整应用模块系统分开理解。"
        }
      ]
    },
    {
      "id": "assembly",
      "title": "应用装配：lifespan创建对象，中间件包住请求",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "from contextlib import asynccontextmanager\nfrom fastapi import FastAPI, Request\nfrom api import router\nfrom service import PricingService\n\n\ndef create_app() -> FastAPI:\n    @asynccontextmanager\n    async def lifespan(app: FastAPI):\n        app.state.pricing = PricingService()\n        try:\n            yield\n        finally:\n            app.state.pricing = None\n\n    app = FastAPI(title=\"MV Quote Demo\", lifespan=lifespan)\n\n    @app.middleware(\"http\")\n    async def identify(request: Request, call_next):\n        response = await call_next(request)\n        response.headers[\"X-Demo-Framework\"] = \"fastapi\"\n        return response\n\n    @app.get(\"/health\")\n    def health():\n        return {\"ok\": True}\n\n    app.include_router(router)\n    return app\n\n\napp = create_app()",
          "language": "python",
          "filename": "examples/python-node-course/09-fastapi-overview/main.py",
          "purpose": "完整应用入口，包含应用工厂、lifespan、HTTP中间件、health与路由注册。Uvicorn运行文件末尾的app。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这里有两个时间点。create_app()在装配应用：定义生命周期、中间件和路由，返回FastAPI对象。Uvicorn开始运行这个对象时，进入lifespan，创建PricingService并放进app.state.pricing；关闭时经过finally，将这个引用清掉。@asynccontextmanager把yield前后两部分组织成可由async with管理的上下文。"
        },
        {
          "type": "paragraph",
          "text": "PricingService本身没有打开数据库或网络连接，因此这里清掉引用只是演示生命周期，并不冒充真实连接关闭。后续如果换成HTTP客户端或数据库资源，必须调用那些资源真实的关闭逻辑。app.state也是应用实例内的状态，不是跨进程存储。"
        },
        {
          "type": "paragraph",
          "text": "get_pricing_service每次取回的是这一个应用已创建的对象，所以本例多个请求使用同一个服务实例，是因为我们显式这样保存和返回。测试新建第二个app会得到另一个服务实例。多worker部署还会有各进程自己的应用与资源，不能把它理解成全站只初始化一次。"
        },
        {
          "type": "paragraph",
          "text": "identify中间件先await call_next，让里面的路由/错误处理产生响应，再补X-Demo-Framework响应头。你可以用它验证正常200、输入422和业务409都经过了这个中间件。这里没有实现Nest所有Interceptor或Guard行为，middleware也不是它们的统一替代品。"
        }
      ]
    },
    {
      "id": "nestjs",
      "title": "把同一业务放回NestJS：熟悉之处与不能直接对应之处",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'reflect-metadata';\nimport {\n Body, ConflictException, Controller, HttpCode, Injectable, Module,\n Post, UnprocessableEntityException, ValidationPipe,\n} from '@nestjs/common';\nimport {NestFactory} from '@nestjs/core';\nimport {IsIn, IsInt, Max, Min} from 'class-validator';\n\nexport class QuoteInput {\n @IsInt() @Min(1) @Max(120)\n seconds!: number;\n\n @IsIn(['standard', 'hd'])\n quality: 'standard' | 'hd' = 'standard';\n}\n\nexport class HdDurationExceeded extends Error {}\n\n@Injectable()\nexport class PricingService {\n quote(seconds: number, quality: 'standard' | 'hd') {\n  if (quality === 'hd' && seconds > 60) {\n   throw new HdDurationExceeded('HD报价最多支持60秒');\n  }\n  const rate = quality === 'hd' ? 4 : 2;\n  return {seconds, quality, credits: seconds * rate, internal_rule: 'demo-rate-v1'};\n }\n}\n\n@Controller('api/quotes')\nexport class QuotesController {\n constructor(private readonly pricing: PricingService) {}\n\n @Post() @HttpCode(200)\n create(@Body() body: QuoteInput) {\n  try {\n   const {seconds, quality, credits} = this.pricing.quote(body.seconds, body.quality);\n   return {seconds, quality, credits};\n  } catch (error) {\n   if (error instanceof HdDurationExceeded) {\n    throw new ConflictException({detail: {code: 'HD_LIMIT', message: error.message}});\n   }\n   throw error;\n  }\n }\n}\n\n@Module({controllers: [QuotesController], providers: [PricingService]})\nclass AppModule {}\n\nexport async function createApp() {\n const app = await NestFactory.create(AppModule, {logger: false});\n app.useGlobalPipes(new ValidationPipe({\n  transform: true,\n  transformOptions: {enableImplicitConversion: false},\n  whitelist: true,\n  forbidNonWhitelisted: true,\n  exceptionFactory: () => new UnprocessableEntityException({code: 'INPUT_INVALID'}),\n }));\n return app;\n}\n\nif (require.main === module) {\n void (async () => {\n  const app = await createApp();\n  app.enableShutdownHooks();\n  await app.listen(Number(process.env.PORT ?? 4196), '127.0.0.1');\n  console.log(JSON.stringify({event: 'listening', port: app.getHttpServer().address().port}));\n })();\n}",
          "language": "typescript",
          "filename": "examples/python-node-course/09-fastapi-overview/nest-comparison.ts",
          "purpose": "完整NestJS对照入口。DTO、Provider、Controller、Module、ValidationPipe与启动都可见；下载项目可直接构建运行。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "你熟悉的部分保持直白：DTO声明字段，ValidationPipe执行运行时检查，Controller接收参数，Provider做计算，Module负责装配。为了和本例FastAPI的输入错误状态对照，这里主动将校验失败配置成422；这不是在宣称Nest默认也是422。Post也显式使用HttpCode(200)，避免把Nest常见的默认创建响应与本例报价语义混在一起。"
        },
        {
          "type": "paragraph",
          "text": "Controller解构seconds、quality、credits后重新组成返回对象，因而不泄露internal_rule。这个投影是我们显式写的。仅给TS方法写一个返回类型，不会把运行时多余字段自动删除；若在Nest里选用序列化拦截器，那又是另一套明确配置的运行时机制。"
        },
        {
          "type": "paragraph",
          "text": "FastAPI对应的公开输出来自response_model=QuoteOutput。这里的比较重点不是哪一边代码短，而是你能指出：哪段声明触发了运行时校验，哪段配置决定了状态码，哪段逻辑负责输出字段，服务实例又由谁建立。"
        },
        {
          "type": "paragraph",
          "text": "对照工程固定NestJS10.4.22，便于与你现有10.x经验对应，不把当前Nest官网新增能力混入这一版本。两边的依赖和锁文件都在下载中。它是本机教学对照，依赖告警与未验证范围在验证记录中列明，不当作可直接上线的生产模板。"
        }
      ]
    },
    {
      "id": "request-flow",
      "title": "带一个正常请求走完，再走两条失败路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/python-fastapi-overview/request.svg",
          "title": "报价请求的正常返回与失败出口",
          "alt": "Uvicorn通过ASGI进入应用和中间件，路由求解依赖并校验参数；有效输入进入报价服务。正常结果通过QuoteOutput；输入错误返回422，HD业务限制通过异常映射返回409。",
          "caption": "依赖与各项参数校验不是一条固定的“先全部校验再解依赖”流水线；正常结果与异常响应也走不同处理路径。手机可局部横向滚动或放大。"
        },
        {
          "type": "paragraph",
          "text": "正常输入是{\"seconds\":30,\"quality\":\"standard\"}。路由匹配POST /api/quotes，请求数据被处理为QuoteInput，pricing依赖取得app.state里的实例，然后调用quote(30,\"standard\")。业务返回60积分和内部规则字段；QuoteOutput只保留seconds、quality、credits，最后由Web层编码成JSON。"
        },
        {
          "type": "code",
          "code": "{\"seconds\":30,\"quality\":\"standard\",\"credits\":60}",
          "purpose": "程序输出，供你和终端结果对照。",
          "language": "text",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "换成{\"seconds\":\"30\"}，seconds严格整数校验失败，正常报价处理函数不会执行，客户端得到422。注意这不意味着所有依赖函数都完全没运行：本例的无请求体输入依赖可以先被求解。测试替换依赖并记录调用，实际看到了依赖已运行、业务方法未运行。不要在依赖中随意放必须“全部校验成功后才做”的不可逆副作用。"
        },
        {
          "type": "paragraph",
          "text": "再换成{\"seconds\":61,\"quality\":\"hd\"}。字段结构有效，业务方法会运行，并发现当前HD规则不接受这个时长。路由转换为HTTPException，客户端得到409及下面的JSON；它不会被当成QuoteOutput的正常结果处理。"
        },
        {
          "type": "code",
          "code": "{\"detail\":{\"code\":\"HD_LIMIT\",\"message\":\"HD报价最多支持60秒\"}}",
          "purpose": "程序输出，供你和终端结果对照。",
          "language": "text",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "最后看输出端反例：若业务返回缺少seconds/quality、credits也非法的数据，正常响应模型校验会失败，这属于服务端实现错误。本例用测试确认返回500，不把它混成“客户端参数有误”的422。"
        }
      ]
    },
    {
      "id": "numeric-difference",
      "title": "一个不能硬画等号的差异：JSON里的30.0",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "相同业务，不代表两种语言对每一处输入都天然等价。本篇故意保留一个真实差异：将原始请求体写为{\"seconds\":30.0}，FastAPI本例返回422，而NestJS对照返回200。"
        },
        {
          "type": "paragraph",
          "text": "Python的JSON解析在这条路径上得到float，strict整数字段拒绝它。JS的JSON解析得到Number，30.0和30没有独立的运行时数值类型；class-validator的IsInt按数值检查，因而接受它。二者都拒绝字符串\"30\"，却不代表它们对所有JSON number都采取相同规则。"
        },
        {
          "type": "paragraph",
          "text": "共享用例里特意用raw字符串保存这个请求体，避免Node先JSON.parse再JSON.stringify把30.0改写成30，导致你以为比较了同一份原始输入，实际上已经换了数据。这就是跨语言验证需要同时看协议表示和解析结果的原因。"
        },
        {
          "type": "paragraph",
          "text": "如果产品要求两边完全一致，需要先决定是否允许数学上为整数的小数表示，再在对应层写出相同规则。本文不悄悄调校验器掩盖差异；这个反例会保留在共享HTTP验收中。"
        }
      ]
    },
    {
      "id": "async",
      "title": "def与async def：不要照搬“Node接口全部写async”的习惯",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例报价函数是普通def，只有很短的同步计算。FastAPI调用普通def路径操作时，会按相应机制在线程池执行它；async def路径操作则在异步执行流程里推进。二者都能处理HTTP请求，写async并不是注册路由的必要条件。"
        },
        {
          "type": "paragraph",
          "text": "如果你在async def里直接调用阻塞数据库客户端、time.sleep或很长的同步计算，这些调用不会因为外面多了async就自动被挪到线程池。与Node事件循环相似，阻塞工作会妨碍同一循环中的其他任务推进。要看调用的库到底提供同步还是异步API，再选等待、线程或独立工作进程。"
        },
        {
          "type": "paragraph",
          "text": "还有一个语言差异要先记住：JS async函数被调用时会开始执行到暂停处，并返回Promise；Python async函数调用先得到协程对象，需要await、创建Task或交给相应运行入口驱动。普通HTTP处理函数交给FastAPI后由框架驱动，你不需要每次请求都再写asyncio.run。完整取消、并发和线程选择放在第7、8篇，不在这里用一个async关键字代替解释。"
        },
        {
          "type": "reference",
          "title": "FastAPI：同步/异步函数的执行边界",
          "url": "https://fastapi.tiangolo.com/async/",
          "note": "区分框架调用的路径操作与自己直接调用的普通辅助函数。"
        }
      ]
    },
    {
      "id": "run",
      "title": "把两套服务实际跑起来，再核对OpenAPI和返回值",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-node-course\nsource .venv/bin/activate\ncd 09-fastapi-overview\npython -m uvicorn main:app --host 127.0.0.1 --port 4195",
          "purpose": "已经完成前面的Python依赖安装。运行的是完整报价服务，与4194上的minimal示例分开。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "curl -s -X POST http://127.0.0.1:4195/api/quotes \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"seconds\":30,\"quality\":\"standard\"}'\ncurl -s http://127.0.0.1:4195/openapi.json",
          "purpose": "POST应返回60积分；GET应返回机器可读的OpenAPI描述。浏览器访问/docs可看到Swagger UI。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本站离线包会保存本文、图形与示例源码，但不会替电脑安装Python、Node或依赖。示例里的/docs默认使用外部Swagger UI资源，完全断网时不能把测试返回HTML的200等同于交互界面资源也已缓存；需要离线文档界面时，应另外自托管这些资源。/openapi.json的协议描述由本地服务生成。"
        },
        {
          "type": "paragraph",
          "text": "OpenAPI来自已声明的路由和模型，不会执行每个业务分支然后猜出全部错误。比如代码抛出了409，但当前路由没有额外声明responses，生成的文档不会自动补出这条业务响应；本篇测试确认了这一点。正式接口应主动补充错误响应契约，不能把“有/docs”当作所有协议都已完整描述。"
        },
        {
          "type": "code",
          "code": "cd examples/python-node-course\nnode --version\nnpm ci --ignore-scripts\nnpm run build\nnpm run start:nest",
          "purpose": "另一个终端运行Node22.12.x。本例Nest监听127.0.0.1:4196；相同POST请求只需把4195换成4196。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "cd examples/python-node-course\nnpm test\ncd 09-fastapi-overview\n../.venv/bin/python -m unittest -v",
          "purpose": "先构建Nest对照，再运行Python与真实HTTP对照。测试动态选择空闲本机端口，不需要手动同时启动两个服务。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "测试覆盖成功、默认值、范围、额外字段、字符串/布尔/小数输入、HD业务失败、输出过滤、生命周期和依赖替换，还真实启动Uvicorn与NestHTTP服务使用同一组14条原始请求。TestClient用于快速验证应用行为，真实端口对照另行验证，不把两者混称为同一种测试。"
        }
      ]
    },
    {
      "id": "review",
      "title": "读到这里应当能判断的三件事",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第一，看到FastAPI()和uvicorn main:app，你能指出前者在装配应用，后者在运行ASGI服务器。Starlette和Pydantic分别承担底层Web与模型处理职责，不会因为都写在requirements.lock里就变成同一种组件。"
        },
        {
          "type": "paragraph",
          "text": "第二，看到Annotated[...,Depends(...)]和response_model，你能说明它们怎样参与运行时处理，以及实例是谁创建的。你不需要先背完Python对象模型，也不应该把它们全部翻译成Nest同名概念。"
        },
        {
          "type": "paragraph",
          "text": "第三，你知道框架边界：本篇交付了可校验、可测试的报价HTTP接口。真正扣费、保存订单、长期运行AI任务，还需要数据库事务、可靠队列、权限与部署设计。后面的语言篇补齐Python特有写法，后续FastAPI篇再逐层把这些能力接上。"
        },
        {
          "type": "callout",
          "title": "核验范围",
          "text": "本篇固定版本与实际运行环境见验证记录。没有调用付费模型，没有测量生产吞吐量；模拟报价不产生真实扣费。其余13篇仍是规划条目，不会被显示为已发布文章。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "FastAPI：功能与组成",
      "url": "https://fastapi.tiangolo.com/features/"
    },
    {
      "title": "ASGI：服务器与应用接口",
      "url": "https://asgi.readthedocs.io/en/latest/introduction.html"
    },
    {
      "title": "FastAPI：BackgroundTasks的适用范围",
      "url": "https://fastapi.tiangolo.com/tutorial/background-tasks/"
    },
    {
      "title": "Pydantic：严格模式",
      "url": "https://docs.pydantic.dev/latest/concepts/strict_mode/"
    },
    {
      "title": "FastAPI：依赖函数与参数",
      "url": "https://fastapi.tiangolo.com/tutorial/dependencies/"
    },
    {
      "title": "FastAPI：APIRouter组织方式",
      "url": "https://fastapi.tiangolo.com/tutorial/bigger-applications/"
    },
    {
      "title": "FastAPI：同步/异步函数的执行边界",
      "url": "https://fastapi.tiangolo.com/async/"
    }
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython3.12.14 / Node22.12.0",
    "FastAPI0.162.0 / Starlette1.10.0",
    "Pydantic2.14.1 / Uvicorn0.54.0",
    "NestJS10.4.22 / TypeScript5.7.2"
  ],
  "verifiedAt": "2026-10-28",
  "labMinutes": 35,
  "examples": [
    {
      "label": "Python / NestJS完整对照项目与共享用例",
      "path": "python-node-course.zip"
    },
    {
      "label": "安装、运行与验收说明",
      "path": "python-node-course/README.md"
    }
  ]
};
export default article;
