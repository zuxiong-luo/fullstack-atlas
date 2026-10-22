import type {Article} from '../articleTypes';
export const agentFoundationsArticle: Article = {
  "id": "agent-foundations",
  "topic": "ai",
  "title": "Agent 工程 01：让模型调用成为一个可验证的服务",
  "description": "从“回答流畅但引用不存在”出发，用 Python 与 TypeScript 实现相同的请求契约、模型适配、结果校验和失败处理。",
  "minutes": 32,
  "tags": [
    "AI",
    "LLM",
    "token",
    "结构化输出",
    "Agent"
  ],
  "scope": "chapter-01-v1：固定模型调用流程；不包含工具、检索、持久化与真实模型质量结论。",
  "prerequisites": [
    "能读懂 HTTP / JSON",
    "Python 或 TypeScript 的异步函数与异常处理"
  ],
  "sections": [
    {
      "id": "problem",
      "title": "回答读起来没问题，业务为什么还是失败了？",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "假设你正在做一个内部知识库助手。用户问“离线阅读怎么用”，模型流畅地回答了操作步骤，还附上一个看起来很像资料编号的引用。页面渲染成功，HTTP 也是 200。可是点开引用，文档根本不存在。对模型而言，生成了一段文字；对用户而言，这次查询已经失败了。"
        },
        {
          "type": "paragraph",
          "text": "如果你的服务只是把模型的字符串转发给页面，这两件事就会被混为一谈。出了问题，你分不清是用户没传资料、供应商没有响应、JSON 写坏了，还是模型引用了不存在的内容。修补提示词或降低温度也许能改变出现频率，却没有建立一个明确的拒绝边界。"
        },
        {
          "type": "paragraph",
          "text": "这一章从这里开始：把一次不确定的文本生成，包进一个可以重复验证的服务。读完后，你能运行 Python 和 TypeScript 两套实现，给它们相同输入，观察相同的成功与失败分类。我们暂时不接数据库、不做检索，也不让模型执行工具。先把入口和出口守住，下一章增加能力时才知道责任落在哪里。"
        },
        {
          "type": "paragraph",
          "text": "这里还不能称为完整的自主 Agent。它是一条固定流程：收请求、调模型、检查结果、回响应。未来模型可以选择工具并根据结果继续决策，但那不改变一个基本事实：决定“是否允许执行”和“结果是否可以进入产品”的代码，应掌握在应用手里。"
        }
      ]
    },
    {
      "id": "scope",
      "title": "先把“成功”写成能检查的条件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "贯穿项目是一份小型知识库助手。第一章先由调用方提供资料，每份资料包含稳定 ID 和正文。模型需要返回回答和引用 ID。这样不用先搭向量库，就能把最容易混淆的几层正确性拆开。注意：调用方提交的资料在本章都是实验数据；它们并没有经过用户权限查询。后续接入真实知识库时，必须由服务端按用户身份选出资料。"
        },
        {
          "type": "code",
          "code": "{\n  \"question\": \"资料中介绍的学习站点可以离线阅读吗？\",\n  \"documents\": [\n    {\n      \"id\": \"guide\",\n      \"text\": \"登录后可以在离线阅读页面下载本站资源；第三方评论仍然需要网络。\"\n    }\n  ]\n}",
          "language": "json",
          "filename": "shared/request.json",
          "purpose": "两种语言、所有示例请求共用这个输入文件。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "这里的成功有意收窄：请求合法，上游返回了可解析文本，文本符合结果结构，引用 ID 都在本次资料集合里。满足这些条件，才返回 ok: true。这个定义没有承诺回答一定正确，更没有承诺引用的文字真正支持每一句结论。把可验证的保证说窄，往往比一个含糊的“智能问答成功率”更有用。"
        },
        {
          "type": "table",
          "headers": [
            "边界",
            "这一章检查什么",
            "仍然不能证明什么"
          ],
          "rows": [
            [
              "请求",
              "类型、长度、数量、唯一 ID、额外字段",
              "调用者有权阅读资料"
            ],
            [
              "模型输出",
              "合法 JSON、answer/citations 字段形状",
              "回答事实正确"
            ],
            [
              "引用归属",
              "ID 来自本次输入资料",
              "引用足以支持结论"
            ],
            [
              "传输",
              "截止时间、响应大小、状态和外层结构",
              "供应商取消计费、模型质量"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "例如资料说“评论需要网络”，模型回答“评论也可以离线提交”，但引用仍然是 guide。它符合本章全部结构检查，却是错误结论。这个反例要保留下来：后续引用片段校验和评测就是为了解决这类问题，而不是重新发明 JSON 校验。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "两次解析之间，隔着两个不可信边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "看下面的图时，先找出两份不同的 JSON。客户端发来的请求是第一份；供应商 HTTP 响应是第二份，它的 message.content 才是模型生成的字符串。那段字符串即使长得像 JSON，也要独立解析。供应商外层包合法，不能推导出模型内层内容合法。"
        },
        {
          "type": "figure",
          "src": "figures/agent-foundations/boundaries.svg",
          "title": "输入与输出边界：传输格式不等于业务结果",
          "alt": "客户端输入经过请求校验进入模型适配器，供应商外层响应解包为原始文本，再经JSON、结构和引用检查后输出产品结果。",
          "caption": "图中每个检查点都有自己的失败分类。模型文本与客户端资料都是数据，不获得改变服务器配置的权限。"
        },
        {
          "type": "paragraph",
          "text": "适配器只负责把统一输入变成供应商请求，再把供应商响应解包为原始文本。它不负责决定引用是否可用。这样更换供应商时，大部分产品规则不用重写；你也能用一个确定性的假模型替换适配器，单独测试服务边界。"
        },
        {
          "type": "paragraph",
          "text": "业务层负责 JSON 解析、结果结构校验和引用集合检查。HTTP 层负责状态码和响应外壳。分层不是为了多建几个文件，而是让失败能落到具体阶段：如果你收到 MODEL_FORMAT_ERROR，应该查看模型输出格式策略；如果是 UPSTREAM_ERROR，就先查连接、供应商状态和外层响应约定。"
        },
        {
          "type": "figure",
          "src": "figures/agent-foundations/sequence.svg",
          "title": "一次请求何时结束",
          "alt": "客户端请求先检查输入；输入无效立即400；有效则在总截止时间内等待适配器；超时返回504；成功文本经过三层校验后返回200，否则返回分类502。",
          "caption": "总截止时间只包住模型调用阶段，不包含上传整个请求的时间。本章不实现自动重试。"
        }
      ]
    },
    {
      "id": "contract",
      "title": "共享契约比两份“差不多”的代码更重要",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "从页面下载ZIP时，解压后直接进入 agent-workshop/python 或 agent-workshop/typescript，后续命令相同；下文的 examples 前缀仅适用于完整仓库。两套实现共用 shared/schema.json、cases.json 和 request.json。schema 描述字段形状，cases 描述应当观察到的行为，CONTRACT.md 说明处理顺序和边界。仅仅复制一份 TypeScript interface 给 Python 不够：TypeScript 类型在运行时不存在，HTTP 请求依然可能把数字塞进 question。"
        },
        {
          "type": "paragraph",
          "text": "本章拒绝隐式类型转换和额外字段。question 必须是字符串，去掉首尾空白后长度为 1～2000；documents 为 1～20 项；每份正文长度 1～10000，ID 只能用字母、数字、下划线、连字符，长度为1～64，且不能重复。字符串长度按 Unicode code point 算，避免 JavaScript 的 UTF-16 length 与 Python len 在 emoji 上产生不同边界。字节限额是另一回事：整个请求最多 256 KiB，不能用字符长度替代网络字节数。"
        },
        {
          "type": "paragraph",
          "text": "结果要求 answer 去除首尾空白后为非空字符串，最多 4000 个字符；citations 是非空、无重复的 ID 数组。先把形状检查通过，再判断引用是否属于输入集合。JSON Schema 可以描述数组元素唯一，却不能直接用一个固定 Schema 表达“这些 ID 必须来自本次另一个数组的 id 字段”；这部分由业务代码承担。"
        },
        {
          "type": "code",
          "code": "const supplied = new Set(input.documents.map(doc => doc.id));\nif (citations.some(id => !supplied.has(id))) {\n  throw new ServiceError(502, \"UNSUPPORTED_CITATION\", \"模型引用了未提供的资料。\");\n}",
          "language": "typescript",
          "filename": "typescript/src/contracts.ts",
          "purpose": "引用归属检查的等价节选；完整解析、错误类型和参数定义在配套项目。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "归一化也必须写清楚。正文和问题在长度判断前去首尾空白，ID 不做模糊修正，不把 guide 和 GUIDE 当成同一个值。否则一个语言放行、另一个拒绝，读者就无法判断自己是在学习框架差异，还是踩中了教程里的不一致。"
        },
        {
          "type": "reference",
          "title": "JSON Schema 2020-12：结构约束",
          "url": "https://json-schema.org/draft/2020-12/json-schema-validation",
          "note": "字段形状与运行时业务关系分开处理。"
        }
      ]
    },
    {
      "id": "python",
      "title": "Python：把超时放在一次调用的外面",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先看 Python 服务的主路径。FastAPI 接收请求后，显式累计请求体字节数，再交给 Pydantic 严格校验。这里没有直接沿用框架默认的请求错误结构，因为两种语言需要返回同一套错误码。你在平常项目中可以使用框架自动校验，但要决定对外接口究竟遵循框架默认，还是遵循自己的产品契约。"
        },
        {
          "type": "code",
          "code": "async with asyncio.timeout(config.timeout_ms / 1000):\n    raw = await model.generate(incoming)\n\ndecoded = strict_json(raw)\nresult = ModelAnswer.model_validate(decoded)\nsupplied = {doc.id for doc in incoming.documents}\nif not set(result.citations) <= supplied:\n    raise ServiceError(502, \"UNSUPPORTED_CITATION\", \"模型引用了未提供的资料\")",
          "language": "python",
          "filename": "python/app.py",
          "purpose": "主路径节选；完整实现把JSON、Schema、引用、超时分别映射为错误响应。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "strict_json 还会拒绝 Python 默认 JSON 解析器容许的 NaN 和 Infinity，保持与 JavaScript JSON.parse 的行为一致。为什么不只给 HTTP 客户端设置一个读取超时？因为读取超时通常限制相邻读取操作之间的等待。一个不断慢慢发送数据的上游，可能一直没有触发那个间隔限制。这里另外包住总截止时间，表达“这一次模型调用最多等多久”。预算耗尽后取消等待，HTTP 流和客户端在上下文退出时释放。"
        },
        {
          "type": "paragraph",
          "text": "这个取消仍然有边界。asyncio 需要被等待的代码配合取消；如果你在协程里塞进一个同步死循环，事件循环没有机会处理截止时间。即便本地连接已经关闭，也不能承诺远端模型停止计算或者不计费。这是“客户端不再等”和“服务端没有发生”的区别，后面讲幂等与恢复还会遇到。"
        },
        {
          "type": "paragraph",
          "text": "HTTP 适配器在本章每次调用中创建并关闭客户端，读者能清楚看到资源所有权。代价是缺少跨请求连接复用。生产服务通常会把客户端放进应用生命周期里，复用连接池并在退出时关闭；调整时需要一起考虑连接数、并发上限和取消后的资源归还。"
        },
        {
          "type": "reference",
          "title": "Python 3.12：asyncio.timeout",
          "url": "https://docs.python.org/3.12/library/asyncio-task.html#asyncio.timeout",
          "note": "截止时间与协作式取消的具体语义。"
        }
      ]
    },
    {
      "id": "typescript",
      "title": "TypeScript：Promise.race 不会自动取消网络请求",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TypeScript 服务使用 Fastify，但验证函数仍从 unknown 开始。类型系统只能约束你编写和编译的代码，不能替 HTTP 调用者做承诺。parseInput 成功之后才得到可信的请求类型；parseAnswer 成功之后才得到产品结果类型。"
        },
        {
          "type": "code",
          "code": "const controller = new AbortController();\nconst deadline = new Promise<never>((_, reject) => {\n  timer = setTimeout(() => {\n    controller.abort();\n    reject(new ServiceError(504, \"UPSTREAM_TIMEOUT\", \"上游调用超时。\"));\n  }, timeoutMs);\n});\ntry {\n  raw = await Promise.race([provider(input, controller.signal), deadline]);\n} finally {\n  clearTimeout(timer);\n}",
          "language": "typescript",
          "filename": "typescript/src/app.ts",
          "purpose": "超时关键逻辑节选：既结束等待，也向适配器传递取消信号；完整代码声明timer并处理错误。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "只有 Promise.race 时，超时 Promise 可以先结束，但另一个 Promise 对应的请求不会凭空停止。示例同时触发 AbortController，把 signal 传进 fetch；如果适配器忽略 signal，网络或计算仍可能继续。因此 provider 接口不仅约定返回什么，还约定如何响应取消。"
        },
        {
          "type": "paragraph",
          "text": "finally 清理定时器，是因为成功请求不应留下一个未来还会触发的超时回调。失败路径也要走清理，不能把释放资源只写在成功分支后面。这里没有重试，错误会按一次调用的真实结果返回。盲目重试会增加请求时间和供应商消耗；如果将来加入有副作用的工具，问题还会扩大成重复执行。"
        },
        {
          "type": "paragraph",
          "text": "同样要记住 Node 运行时的边界：定时器回调需要事件循环获得执行机会。同步 CPU 循环会推迟它，因此 3000ms 是异步等待预算，不是能够强行抢占所有 JavaScript 的硬实时保证。需要隔离 CPU 工作时，应另行设计 worker 或进程边界。"
        },
        {
          "type": "reference",
          "title": "Node.js 22：AbortController",
          "url": "https://nodejs.org/docs/latest-v22.x/api/globals.html#class-abortcontroller",
          "note": "它发出取消信号；具体API必须支持并消费该信号。"
        }
      ]
    },
    {
      "id": "run",
      "title": "从空环境跑通同一个请求",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "完整代码位于 examples/agent-workshop，先运行其中一套即可。下面命令从仓库根目录开始。Python 固定为 3.12，Node 固定为 22.12.0；本章锁定了依赖，复现时先用这些版本，不要把升级框架和理解示例混在一次操作里。安装依赖需要网络，服务默认使用 mock，不需要任何模型账号。"
        },
        {
          "type": "code",
          "code": "cd examples/agent-workshop/python\npython3.12 -m venv .venv\nsource .venv/bin/activate\npython -m pip install -r requirements.lock\npython -m pytest -q\npython -m uvicorn app:create_app --factory --host 127.0.0.1 --port 8000",
          "language": "sh",
          "filename": "终端 A · Python",
          "purpose": "从仓库根目录执行；最后一条保持服务运行。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "cd examples/agent-workshop/typescript\nnvm use\nnpm ci\nnpm run build\nnpm test\nnpm start",
          "language": "sh",
          "filename": "终端 B · TypeScript",
          "purpose": "需要先安装Node22.12.0；如果不用nvm，手动切换版本后跳过nvm use。服务监听3001。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "cd examples/agent-workshop\ncurl -i http://127.0.0.1:8000/v1/answers \\\n  -H \"Content-Type: application/json\" \\\n  --data-binary @shared/request.json\n# TypeScript 使用相同输入，端口改为3001。",
          "language": "sh",
          "filename": "另开终端",
          "purpose": "两套服务都运行时，改变端口对照响应。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "{\"ok\":true,\"result\":{\"answer\":\"示例回答：请查看所附资料。\",\"citations\":[\"guide\"]}}",
          "language": "json",
          "filename": "预期响应",
          "purpose": "HTTP200；这里的固定答案是mock输出，不是真实模型对资料的理解。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果报 connection refused，先看服务是否启动、端口是否一致；如果是找不到 shared/request.json，检查终端当前目录。若 npm ci 提示引擎版本不符，先确认 node --version。不要先修改模型提示词，这几个错误都发生在模型调用之前。"
        },
        {
          "type": "paragraph",
          "text": "为什么默认给一个这么朴素的固定回答？因为这一步要验证的是程序边界能否按约定工作。固定输入得到固定结果，才能稳定判断代码改动是否破坏协议。它不适合展示智能程度，也不能被拿去计算真实知识库回答准确率。"
        }
      ]
    },
    {
      "id": "failures",
      "title": "主动制造坏结果，看看错误落在哪一层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "停止其中一个服务，用 MOCK_SCENARIO 切换模拟上游再启动。场景只能从服务端环境配置，客户端在请求中偷偷加 scenario 会被当成额外字段拒绝。否则测试开关就可能变成用户可控制的后门。"
        },
        {
          "type": "code",
          "code": "MOCK_SCENARIO=unsupported_citation npm start\n# Python终端中用：\nMOCK_SCENARIO=unsupported_citation python -m uvicorn app:create_app --factory --host 127.0.0.1 --port 8000",
          "language": "sh",
          "filename": "失败场景启动命令",
          "purpose": "在对应语言目录选择一条运行，然后发送刚才同一份请求。",
          "kind": "runnable"
        },
        {
          "type": "table",
          "headers": [
            "制造什么输入或输出",
            "HTTP / code",
            "定位方向"
          ],
          "rows": [
            [
              "question为空或文档ID重复",
              "400 INVALID_REQUEST",
              "调用方修正请求；未调用模型"
            ],
            [
              "整个请求体超过256KiB",
              "413 PAYLOAD_TOO_LARGE",
              "缩小请求；检查资料选取"
            ],
            [
              "invalid_json：模型返回非JSON",
              "502 MODEL_FORMAT_ERROR",
              "原始文本不能解析；检查输出约束"
            ],
            [
              "invalid_schema：字段不符合约定",
              "502 MODEL_SCHEMA_ERROR",
              "解析成功，但产品形状不成立"
            ],
            [
              "unsupported_citation：引用未提供的ID",
              "502 UNSUPPORTED_CITATION",
              "形状成立，但引用不属于输入资料"
            ],
            [
              "timeout：预算内不响应",
              "504 UPSTREAM_TIMEOUT",
              "上游耗时、预算和取消"
            ],
            [
              "upstream_error：上游失败",
              "502 UPSTREAM_ERROR",
              "连接、HTTP状态或外层消息结构"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "观察 unsupported_citation 时，重点不是“出现了错误”，而是它经过了前面的检查：模型确实返回了合法 JSON，answer 和 citations 类型也正确，直到引用集合检查才失败。如果把所有错误都合成“模型出错”，你就丢失了这条定位信息。"
        },
        {
          "type": "paragraph",
          "text": "对用户返回稳定的 code 和简洁 message，不透传供应商原始响应。原始内容可能包含提交的资料，也可能包含代理或供应商诊断信息。实际项目要补受控日志时，可以记录请求关联 ID、阶段、耗时、状态码和模型版本；不要默认记录密钥、整份资料与完整模型正文。"
        }
      ]
    },
    {
      "id": "real-http",
      "title": "切换真实模型，只替换适配层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "真实 HTTP 适配器已经提供，但这次没有执行真实付费调用。它约定一种具体线格式：POST 请求带 model、messages 与 response_format: json_object，从 choices[0].message.content 读取文本。这是一项适配器假设，不是所有模型供应商都支持的通用标准。"
        },
        {
          "type": "paragraph",
          "text": "设置 MODEL_PROVIDER=http、MODEL_API_URL、MODEL_API_KEY、MODEL_NAME 后，服务才会启用真实调用。URL 必须是完整端点；不要把浏览器可见的前端环境变量当成密钥保管处。服务端项目只能在本地或你控制的服务器运行，GitHub Pages 只托管文章、图形和源文件。"
        },
        {
          "type": "paragraph",
          "text": "HTTP 适配器限制上游响应为 1 MiB，不跟随重定向。这里的大小限制防止无边界积累响应；不跟随重定向则避免一次意外跳转把授权头送到不预期的位置。即便供应商返回 200，如果外层消息不是预期结构，也只能算 UPSTREAM_ERROR，不能把整个供应商对象当成答案继续传下去。"
        },
        {
          "type": "paragraph",
          "text": "JSON 输出模式能减少格式问题，但不能替代服务自己的验证。供应商拒绝、输出截断、空内容或者不兼容响应，都需要被适配器和业务层明确处理。本章把不符合约定的外层响应归入上游错误，未实现供应商特有的拒绝分类；接入真实服务时应按其文档扩展，不能偷偷用空答案伪装成功。"
        },
        {
          "type": "paragraph",
          "text": "模型的上下文窗口也不是无限资料入口。本章限制的是字符和请求字节，不是精确 token 预算。token 划分依赖模型，不能把一个汉字固定换算成一个 token。接入后应记录供应商实际用量并预留输出预算；没有真实运行数据时，这里不提供成本数字或准确率结论。"
        }
      ]
    },
    {
      "id": "validation",
      "title": "测试通过，到底证明了多少？",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "共享 cases.json 覆盖成功、空问题、重复 ID、额外字段、空资料、坏 JSON、坏结果结构、不存在的引用、超时和上游异常。两套实现都加载它；只改某一语言的测试预期来让测试变绿，会破坏“相同行为”的约定。"
        },
        {
          "type": "paragraph",
          "text": "除了注入 mock，测试还启动回环地址上的假 HTTP 上游，真正经过 HTTP 客户端。这样能检查外层响应解包、非成功状态、超时和连接取消，而不仅仅是验证一个假的函数会抛异常。假上游仍不是模型：它证明协议适配路径在给定条件下如何运行，不证明供应商生产环境表现。"
        },
        {
          "type": "paragraph",
          "text": "运行记录和准确测试数量以各项目 VERIFICATION.md 及仓库 docs/BENCHMARK_VALIDATION.md 为准。这些记录写明执行环境、命令和限制。正文里的成功响应是确定性mock的预期值，不是手工挑选的真实模型好答案。"
        },
        {
          "type": "paragraph",
          "text": "你可以加一条最有价值的反例：让模型返回一个格式正确、引用存在、但与文档矛盾的回答。当前服务会放行，这是已知边界。随后用单独的语义评测把它标记为失败。只有分开“服务契约通过”和“回答质量通过”，才不会把工程测试数量误当成智能水平。"
        },
        {
          "type": "paragraph",
          "text": "第一章也没有认证、限流、全局并发预算和持久化。服务绑定127.0.0.1，方便做本地实验；不能因为两套测试都绿了，就直接暴露给互联网。请求大小限制能控制单次输入规模，却无法阻止同时涌入大量合法请求。这些属于下一层容量和部署问题。"
        }
      ]
    },
    {
      "id": "next",
      "title": "下一章加能力之前，先保留这些边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "回到开头那个不存在的引用：现在它会在业务校验阶段被拒绝，调用者得到明确的 UNSUPPORTED_CITATION，而不是一段看似完整的回答。我们没有让模型突然变聪明，而是让应用知道自己承诺了什么、拒绝了什么，以及失败发生在哪里。"
        },
        {
          "type": "paragraph",
          "text": "chapter-01-v1 标记对应 shared/chapter-01.json；本地这一批尚在标杆预览阶段，后续发布时再记录实际 Git 提交或标签。两种语言共用数据、接口和验收用例，之后的章节会在这个基线上逐步增加工具执行、检索、恢复和记忆，而不是每章另起一个无法对照的小程序。"
        },
        {
          "type": "paragraph",
          "text": "下一章要解决的是：如果模型建议调用工具，应用凭什么允许执行？第一章已经把“文字看起来像结果”和“可以进入业务”分开了。工具场景会把这条线向前再推一步：即便参数结构正确，也要检查当前用户权限、允许的工具与执行预算。到那时，今天保留下来的适配层和错误分类就不再只是代码组织，而是控制副作用的起点。"
        }
      ]
    }
  ],
  "questionIds": [
    "agent-foundations-schema",
    "agent-foundations-choice"
  ],
  "references": [
    {
      "title": "FastAPI：错误响应",
      "url": "https://fastapi.tiangolo.com/tutorial/handling-errors/"
    },
    {
      "title": "Fastify 5：验证和序列化",
      "url": "https://fastify.dev/docs/v5.12.x/Reference/Validation-and-Serialization/"
    },
    {
      "title": "Python 3.12：任务与取消",
      "url": "https://docs.python.org/3.12/library/asyncio-task.html"
    },
    {
      "title": "Node 22：AbortController",
      "url": "https://nodejs.org/docs/latest-v22.x/api/globals.html#class-abortcontroller"
    },
    {
      "title": "JSON Schema 2020-12",
      "url": "https://json-schema.org/draft/2020-12/json-schema-validation"
    }
  ],
  "status": "review",
  "kind": "series",
  "versions": [
    "Python 3.12.14 / FastAPI 0.115.12",
    "Node 22.12.0 / Fastify 5.12.7 / TypeScript 5.7.2"
  ],
  "verifiedAt": "2026-10-21",
  "labMinutes": 35,
  "examples": [
    {
      "label": "下载第一章双语言完整源码（ZIP）",
      "path": "agent-workshop.zip"
    },
    {
      "label": "Python 运行说明",
      "path": "agent-workshop/python/README.md"
    },
    {
      "label": "TypeScript 运行说明",
      "path": "agent-workshop/typescript/README.md"
    },
    {
      "label": "共享契约与失败分类",
      "path": "agent-workshop/shared/CONTRACT.md"
    },
    {
      "label": "共享验收用例",
      "path": "agent-workshop/shared/cases.json"
    }
  ]
};
