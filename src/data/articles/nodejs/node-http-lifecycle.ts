import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "node-http-lifecycle",
  "topic": "nodejs",
  "title": "Node.js HTTP 服务：请求边界、错误处理与优雅关闭",
  "description": "从 IncomingMessage 与 ServerResponse 建立请求模型，完整实现输入限额、错误分类、客户端取消、业务预算和有宽限期的关闭，并通过真实 HTTP 验证。",
  "minutes": 46,
  "labMinutes": 35,
  "tags": [
    "Node.js",
    "HTTP",
    "请求校验",
    "取消",
    "超时",
    "优雅关闭"
  ],
  "scope": "实现一个单进程、HTTP/1.1、本机笔记确认服务，验证语法/业务/容量错误、取消和停机。无持久化、账号鉴权、WebSocket、HTTP/2、TLS 和生产负载测试。",
  "prerequisites": [
    "理解 Promise、AbortController 和 finally",
    "知道 HTTP 方法、状态码、请求头与 JSON",
    "读过 Node 执行模型和模块工程，或具备相同基础"
  ],
  "questionIds": [],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0",
    "macOS 14.5 x64 真实 loopback HTTP",
    "无第三方运行依赖"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    {
      "label": "完整示例与行为测试",
      "path": "node-http-lifecycle.zip"
    },
    {
      "label": "运行说明",
      "path": "node-http-lifecycle/README.md"
    }
  ],
  "sections": [
    {
      "id": "request-model",
      "title": "HTTP 服务处理的是什么：一条消息，加上一组有归属的资源",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "HTTP 服务接收请求消息，检查它想做的操作，读取输入并产生响应。Node 的 node:http 把请求暴露为 IncomingMessage，把响应暴露为 ServerResponse。请求体是陆续到达的字节流，响应也有自己的缓冲与结束过程；它们不等同于已经解析好的 JSON 对象。连接可能提前断开，客户端也可能只发送一部分内容，这些都是正常需要处理的边界。"
        },
        {
          "type": "paragraph",
          "text": "一次请求除了业务变量，还会拥有计时器、事件监听和执行名额。所谓请求生命周期，就是这些资源从创建、使用到释放的过程。没有明确归属的资源，最容易在异常时遗漏：坏输入已经返回了，计时器还在；用户关掉页面了，数据库查询仍在跑；服务收到停机信号了，新任务还继续进入。正确响应只是其中一半，另一半是及时停止不再需要的工作。"
        },
        {
          "type": "paragraph",
          "text": "我们交付 POST /notes 笔记确认接口。正常输入是 {title:\"  note  \",delayMs:0}，返回 200 与 {title:\"note\"}。delayMs 只是为了复现可取消等待的教学参数，不代表生产接口应让用户选择服务器休眠时间。服务不写数据库，返回成功只表示此处的确认流程已经完成；不能拿它证明持久化或“客户端一定收到”。"
        },
        {
          "type": "figure",
          "src": "figures/node-http-lifecycle/lifecycle.svg",
          "title": "把请求开始、异常和清理放在同一张图里",
          "alt": "校验入口后取得名额，读取 JSON 与等待受同一取消信号控制；finally 清理计时器、监听和名额；停机先停止接入再等候。",
          "caption": "图对应当前实现。业务预算从 request 回调开始，HTTP 头部接收与连接层另有设置；长同步代码仍会推迟所有定时回调。"
        }
      ]
    },
    {
      "id": "contract",
      "title": "先收窄接口承诺，再给每一类失败一个确定位置",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "输入边界先于业务等待。服务只接受精确的 POST /notes；Content-Type 要求 application/json，可以附带参数。请求体最多 1024 字节，title 是去空格后非空、原始长度最多 80 个 UTF-16 代码单元的字符串；delayMs 是 0 到 2000 的安全整数。额外字段也拒绝，让本例的契约变更在测试中显现。"
        },
        {
          "type": "table",
          "headers": [
            "边界",
            "结果",
            "判断依据"
          ],
          "rows": [
            [
              "路由不支持",
              "404 NOT_FOUND",
              "本例只实现一个精确入口，不做完整 REST 路由器"
            ],
            [
              "媒体类型不支持",
              "415 JSON_REQUIRED",
              "没有把任意文本都当作 JSON"
            ],
            [
              "字节量超过上限",
              "413 BODY_TOO_LARGE",
              "按 Buffer.length 累计，包括 UTF-8 多字节内容"
            ],
            [
              "JSON 语法错误",
              "400 BAD_JSON",
              "JSON.parse 无法形成合法值"
            ],
            [
              "字段不符合契约",
              "422 BAD_NOTE",
              "语法有效不代表业务字段有效"
            ],
            [
              "在途数量已满",
              "503 BUSY",
              "无业务等待队列，默认最多四个在途请求"
            ],
            [
              "应用预算到期",
              "408 REQUEST_BUDGET",
              "从当前请求进入处理开始计算，取消本例合作式等待"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "400 与 422 的区分是本例接口约定，不要求所有团队统一；重要的是调用者能稳定识别可纠正的输入错误。内部异常统一为 500 INTERNAL，不向客户端回传堆栈。客户端离开时只在统计中用 CLIENT_LEFT 分类，代码里的 499 是内部表示，不声称 Node 或 HTTP 标准会自动向断开的客户端送达一个 499 响应。"
        },
        {
          "type": "code",
          "code": "import { createServer } from 'node:http';\nimport { setTimeout as pause } from 'node:timers/promises';\n\nexport class HttpError extends Error {\n  constructor(status, code) { super(code); this.status = status; this.code = code; }\n}\n// Event listeners keep body-limit errors separate from destroying the socket.\nexport function readBody(req, signal, limit) {\n  return new Promise((resolve, reject) => {\n    let bytes = 0;\n    const chunks = [];\n    const cleanup = () => {\n      req.off('data', onData); req.off('end', onEnd);\n      req.off('error', onError); req.off('close', onClose);\n      signal.removeEventListener('abort', onAbort);\n    };\n    const fail = error => { cleanup(); reject(error); };\n    const onData = chunk => {\n      bytes += chunk.length;\n      if (bytes > limit) {\n        fail(new HttpError(413, 'BODY_TOO_LARGE'));\n        req.resume(); // Discard remaining input; the response closes the connection.\n      } else chunks.push(chunk);\n    };\n    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };\n    const onError = error => fail(error);\n    const onClose = () => { if (!req.complete) fail(new HttpError(499, 'CLIENT_LEFT')); };\n    const onAbort = () => { fail(signal.reason); req.resume(); };\n    if (signal.aborted) { reject(signal.reason); return; }\n    req.on('data', onData); req.once('end', onEnd);\n    req.once('error', onError); req.once('close', onClose);\n    signal.addEventListener('abort', onAbort, { once: true });\n  });\n}\nexport function parseInput(text) {\n  let value;\n  try { value = JSON.parse(text); } catch { throw new HttpError(400, 'BAD_JSON'); }\n  if (!value || typeof value !== 'object' || Array.isArray(value) ||\n      typeof value.title !== 'string' || value.title.trim().length < 1 || value.title.length > 80 ||\n      !Number.isSafeInteger(value.delayMs) || value.delayMs < 0 || value.delayMs > 2000 ||\n      Object.keys(value).some(key => !['title', 'delayMs'].includes(key))) {\n    throw new HttpError(422, 'BAD_NOTE');\n  }\n  return { title: value.title.trim(), delayMs: value.delayMs };\n}",
          "language": "js",
          "filename": "examples/node-http-lifecycle/server.mjs",
          "purpose": "输入错误类型、受限请求体读取与结构校验。这里是 server.mjs 的连续前半段；后续展示同一文件其余实现。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "readBody 为什么没有直接把流全部收集后再判断长度？因为那样必须先分配完攻击者指定的空间，限制已经来晚了。此处每块到达先累计字节，越限即拒绝，不再保留新块。底层 HTTP 自身仍可能交付一个较大的块，内核也有缓冲，所以 1024 是应用保留的正文上限，不是整个连接或进程的内存硬上限。并发上限还会进一步限制这些对象同时存在的数量。"
        },
        {
          "type": "paragraph",
          "text": "拒绝后调用 req.resume 丢弃剩余输入，并通过 Connection: close 的小响应结束连接。它不再把后续正文追加到 chunks。正常路径在 end 拼接并解析；连接未完整结束或信号取消则拒绝。每条路径先 cleanup，移除本次读取器的监听，避免把已经完成的闭包继续挂在对象上。外围保留传输错误观察器，防止读取器退出后的晚到错误变成未处理事件。"
        }
      ]
    },
    {
      "id": "handling",
      "title": "把成功、坏输入和取消串进同一个处理函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "接下来进入应用工厂。它不立刻监听固定端口，测试可以让系统分配空闲端口；终端入口才选择 4313。并发用 Set 记录本进程已经接纳的控制器，取得名额发生在首次 await 之前，因此同一个事件循环中不会有两个回调在一次检查与加入之间交错。满额直接拒绝，没有无限等待列表。"
        },
        {
          "type": "code",
          "code": "function json(res, status, value) {\n  if (res.destroyed || res.writableEnded) return;\n  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Connection': 'close' });\n  res.end(JSON.stringify(value));\n}\nexport function createApp({ bodyLimit = 1024, budgetMs = 1000, maxActive = 4 } = {}) {\n  for (const value of [bodyLimit, budgetMs, maxActive]) {\n    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('positive limits required');\n  }\n  const active = new Set();\n  const stats = { completed: 0, cancelled: 0, timedOut: 0, rejected: 0 };\n  let draining = false, closing;\n  const server = createServer({ headersTimeout: 5000, requestTimeout: 10000, maxHeaderSize: 8192 }, (req, res) => {\n    req.on('error', () => {}); // Observe late transport errors after body readers detach.\n    void handle(req, res).catch(() => res.destroy());\n  });\n  async function handle(req, res) {\n    if (draining) { json(res, 503, { error: 'DRAINING' }); return; }\n    if (req.method !== 'POST' || req.url !== '/notes') { json(res, 404, { error: 'NOT_FOUND' }); return; }\n    if (active.size >= maxActive) { json(res, 503, { error: 'BUSY' }); return; }\n    if (!/^application\\/json(?:\\s*;|$)/i.test(req.headers['content-type'] ?? '')) {\n      json(res, 415, { error: 'JSON_REQUIRED' }); return;\n    }\n    const controller = new AbortController();\n    active.add(controller);\n    const clientLeft = () => {\n      if (!res.writableFinished) controller.abort(new HttpError(499, 'CLIENT_LEFT'));\n    };\n    res.once('close', clientLeft);\n    const timer = setTimeout(() => controller.abort(new HttpError(408, 'REQUEST_BUDGET')), budgetMs);\n    try {\n      const input = parseInput(await readBody(req, controller.signal, bodyLimit));\n      await pause(input.delayMs, undefined, { signal: controller.signal });\n      controller.signal.throwIfAborted();\n      json(res, 200, { title: input.title }); // No durable write: an acknowledgement demo.\n      stats.completed += 1;\n    } catch (error) {\n      const cause = controller.signal.aborted ? controller.signal.reason : error;\n      if (cause.code === 'CLIENT_LEFT') stats.cancelled += 1;\n      else {\n        if (cause.code === 'REQUEST_BUDGET') stats.timedOut += 1;\n        else stats.rejected += 1;\n        json(res, cause instanceof HttpError ? cause.status : 500, {\n          error: cause instanceof HttpError ? cause.code : 'INTERNAL',\n        });\n      }\n    } finally {\n      clearTimeout(timer);\n      res.off('close', clientLeft);\n      active.delete(controller);\n    }\n  }",
          "language": "js",
          "filename": "examples/node-http-lifecycle/server.mjs",
          "purpose": "响应函数、应用工厂与完整请求处理。承接上一块，包含预算、断开监听、错误分类和统一 finally。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入正常请求：active 从零变一，创建预算计时器并监听响应 close；readBody 得到合法文本，parseInput 返回整理后的标题和时长；可取消 pause 完成后再次检查 signal，向响应写入 JSON，随后 finally 清除计时器、移除 close 监听、删除 active。默认 completed 记录“本应用已调用成功响应”的次数，不等于客户端消费成功，也不等于数据库提交数量。"
        },
        {
          "type": "paragraph",
          "text": "带入坏 JSON：读取完成后 parseInput 抛出 HttpError(400)，不会进入 pause；catch 把它转换成固定错误体，finally 仍释放名额。若程序内部抛出其他异常，则返回 500 与通用错误码。真实服务还需要在服务端记录请求 ID、当前阶段和内部堆栈；本例没有接日志平台，不把几项内存计数称为完整可观测系统。"
        },
        {
          "type": "paragraph",
          "text": "同一个 AbortController 同时覆盖正文读取和可取消工作。业务计时器触发后，signal.reason 保留 REQUEST_BUDGET；客户端提前断开则保留 CLIENT_LEFT。catch 优先读取已经取消的 signal.reason，而不是只看底层 pause 抛出的 AbortError，这样能区分“为什么取消”。如果竞争同时发生，AbortController 的首次取消原因保持不变，日志不能事后随意改成另一个原因。"
        },
        {
          "type": "paragraph",
          "text": "代码没有用 Promise.race 来假装取消。race 只能让调用方先得到一个结果，另一边的工作可能仍在运行；这里把 signal 真正传给 timers/promises 的等待，并在 finally 归还名额。若以后换成数据库或上游请求，必须确认目标接口实际支持取消，并把连接、游标和事务清理也纳入生命周期。超时返回了但资源没有停下，会使容量统计变得虚假。"
        }
      ]
    },
    {
      "id": "disconnect",
      "title": "客户端断开和请求读完不是同一件事",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "IncomingMessage 的 close 不能直接当成“用户离开”，因为消息读取完成也可能到达相关生命周期事件。正文读取器用 req.complete 辨别是否收到完整消息；业务等待阶段则观察响应的 close，并检查 writableFinished。用户发送完 JSON 后关掉连接，读入已经成功，工作仍需要停止，这就是为什么只监听上传中断不足以覆盖整个请求。"
        },
        {
          "type": "paragraph",
          "text": "测试先把容量设为一，发送 delayMs=1000 的请求，等 snapshot.active 明确变成一，再发送第二个请求验证 503。随后主动销毁第一个客户端连接，等待 cancelled 增加且 active 回零，最后发送第三个请求验证 200。这条顺序把“断开后资源释放”转化成可见行为，没有靠睡一秒猜测服务器应当处理完了。"
        },
        {
          "type": "code",
          "code": "// test.mjs 中的同一正常 / 取消行为\nconst req = request({hostname:'127.0.0.1',port,path:'/notes',method:'POST',agent:false,headers:{'content-type':'application/json'}});\nreq.on('error',()=>{});\nreq.end('{\"title\":\"cancel\",\"delayMs\":1000}');\nawait waitFor(() => app.snapshot.active===1);\nassert.equal((await send(port,'{\"title\":\"busy\",\"delayMs\":0}')).status,503);\nreq.destroy();\nawait waitFor(() => app.snapshot.cancelled===1 && app.snapshot.active===0);\nassert.equal((await send(port,'{\"title\":\"next\",\"delayMs\":0}')).status,200);",
          "language": "js",
          "filename": "取消测试 · 阅读节选",
          "purpose": "调用方、输入和判定顺序在此展示；request、send 与 waitFor 的完整实现随后给出。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "传输取消也不自动回滚业务。一旦真实数据库提交已经完成，即使用户断开，也不应该把已发生的写入说成不存在。需要重试写操作时，必须定义幂等键、提交边界和查询结果方式。本篇只确认输入，不进行持久化，正是为了先把取消作用在哪里讲清楚，而不把一次 pause 的取消包装成分布式事务保证。"
        }
      ]
    },
    {
      "id": "timeouts",
      "title": "接收时限、应用预算和关闭期限，分别约束什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "示例设置 headersTimeout=5000、requestTimeout=10000、maxHeaderSize=8192；这些属于 HTTP 接收层的约束。应用另设默认 1000ms 预算，从 request 处理开始覆盖正文接收和模拟工作。两个时钟的起点与职责不同：应用预算没有覆盖进入处理回调之前的全部连接时间，也没有证明一个响应在一秒内必达客户端。"
        },
        {
          "type": "paragraph",
          "text": "这篇用 408 表示本接口的应用处理预算耗尽，并返回可识别的 REQUEST_BUDGET。若生产系统区分上传超时、业务截止和上游网关超时，应分别设计状态码和错误码；不要把本例 408 约定直接套给所有架构。测试包含声明 Content-Length=100、只发送一个左花括号的慢正文，它得到预算错误且 active 回零，证明限制不只作用在已经读完的请求上。"
        },
        {
          "type": "paragraph",
          "text": "定时回调仍需要事件循环取得执行机会。若处理函数先运行两秒的同步循环，设置 30ms timer 也不能把循环在 30ms 时抢占。这是上一章执行模型在 HTTP 中的直接后果。因此预算必须与有界输入、短同步阶段和可取消操作配合。想要操作系统级硬终止，还需外部进程监督与资源隔离；本例没有把 JS 计时器承诺为硬实时机制。"
        }
      ]
    },
    {
      "id": "shutdown",
      "title": "优雅关闭：先停止接入，再给在途工作一个有限宽限期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "停机不是立刻 process.exit。立即退出会截断正在完成的响应，也可能丢掉尚未清理的资源。反过来，只写 server.close 而无限等待，也会被一个永不结束的操作拖住。我们让应用进入 draining，拒绝处理边界上仍到达的新任务，调用 server.close 停止接入，并给已接纳工作一个宽限期。"
        },
        {
          "type": "code",
          "code": "  return {\n    server,\n    get snapshot() { return { ...stats, active: active.size, draining }; },\n    close(graceMs = 500) {\n      if (closing) return closing;\n      draining = true;\n      closing = new Promise((resolve, reject) => {\n        // Stop accepting before force-closing, avoiding an admission race.\n        const deadline = setTimeout(() => {\n          for (const controller of active) controller.abort(new HttpError(503, 'SHUTDOWN'));\n          server.closeAllConnections();\n        }, graceMs);\n        server.close(error => {\n          clearTimeout(deadline);\n          if (error) reject(error); else resolve();\n        });\n      });\n      return closing;\n    },\n  };\n}",
          "language": "js",
          "filename": "examples/node-http-lifecycle/server.mjs",
          "purpose": "同一文件的关闭实现与返回接口。close 复用同一个 Promise；期限到达先取消业务，再强制关闭本服务 HTTP 连接。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import { createApp } from './server.mjs';\nconst app = createApp();\napp.server.listen(4313, '127.0.0.1', () => console.log('http://127.0.0.1:4313 POST /notes'));\nlet stopping = false;\nasync function stop(signal) {\n  if (stopping) return;\n  stopping = true;\n  console.log(`draining:${signal}`);\n  try { await app.close(500); console.log(JSON.stringify(app.snapshot)); }\n  catch (error) { console.error(error); process.exitCode = 1; }\n}\nprocess.on('SIGTERM', () => void stop('SIGTERM'));\nprocess.on('SIGINT', () => void stop('SIGINT'));",
          "language": "js",
          "filename": "examples/node-http-lifecycle/main.mjs",
          "purpose": "完整终端入口。SIGTERM/SIGINT 共用停机流程，重复信号不会重复发起关闭。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "正常情况中，已经开始的 30ms 请求在 500ms 宽限内返回 200，close Promise 随连接结束而完成。故障情况中，请求要等待 2000ms，我们只给 20ms 宽限：计时器取消 active 中的控制器，并 closeAllConnections，测试接受连接错误或及时形成的 503，随后检查 active 清空。强制关闭时客户端收不到完整 JSON 很正常，不能要求“强制断开”同时保证响应送达。"
        },
        {
          "type": "paragraph",
          "text": "调用次序保留先 close 后强制断开，避免强制动作与继续接入之间的窗口。这个策略只管理本例的 HTTP/1.1 连接；升级的 WebSocket、其他协议连接、数据库池和后台消费都需要自己的停止及清理流程。close 的宽限也受事件循环调度影响；若进程已失去响应，外部监督者仍需执行最终退出策略。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0：server.close 与 closeAllConnections",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/http.html#servercloseallconnections",
          "note": "用于核对关闭顺序与强制断开的协议范围；本例实际测试使用真实 loopback HTTP。"
        }
      ]
    },
    {
      "id": "ownership",
      "title": "响应结束之后，还有哪些责任属于其他层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "active 记录的是本例正在读入或执行的应用工作，而不是所有 TCP 连接数量。处理器调用 res.end 后就可以完成这项短工作，但字节仍可能在底层等待发送。因此“active 回零”证明应用名额已经归还，不证明网络缓冲为空。流式大响应需要继续把名额与输出生命周期绑定，已有导出文章会把这个范围接下去。"
        },
        {
          "type": "paragraph",
          "text": "本例主动关闭连接，是为了让请求隔离和停机实验更直接；生产服务通常会复用连接来降低建立成本，届时要设置空闲连接策略并检查代理行为。进程内 maxActive 也只对当前实例有效，多实例部署不能把它当作全站总配额。需要全局限流时应明确配额的归属、同步成本以及协调服务失效时的处理方式。"
        },
        {
          "type": "paragraph",
          "text": "最后把边界带回业务：本地验证能证明坏正文被拒绝、取消信号生效、短任务排空、长任务在关闭期限后停止。它没有覆盖上游数据库是否真正中止、写入是否幂等、代理是否缓存错误或不同系统的信号行为。下一步接入这些资源时，逐个增加对应失败用例，不能把现有七个通过项当作未来新增能力也已经验证过。"
        }
      ]
    },
    {
      "id": "test-client",
      "title": "验证也要交付调用方，不能只把服务器代码贴出来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "请求测试直接使用 node:http，不经过浏览器或代理。send 返回状态和解析后的响应体，客户端设置三秒保护；waitFor 只轮询明确状态并有最大次数。测试本身还各设五秒上限，确保服务关闭出错时能失败退出。这样读者知道一次绿灯证明了什么，也能定位是客户端没结束还是服务器没释放。"
        },
        {
          "type": "code",
          "code": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { request } from 'node:http';\nimport { once } from 'node:events';\nimport { setTimeout as pause } from 'node:timers/promises';\nimport { createApp } from './server.mjs';\n\nasync function start(t, options) {\n  const app = createApp(options);\n  app.server.listen(0, '127.0.0.1');\n  await once(app.server, 'listening');\n  t.after(() => app.close(20));\n  return { app, port: app.server.address().port };\n}\nfunction send(port, text, headers = {}) {\n  return new Promise((resolve, reject) => {\n    const req = request({ hostname:'127.0.0.1', port, method:'POST', path:'/notes', agent:false,\n      headers: { 'content-type':'application/json', ...headers } }, res => {\n      let data = '';\n      res.setEncoding('utf8');\n      res.on('data', chunk => { data += chunk; });\n      res.once('end', () => resolve({ status:res.statusCode, body:JSON.parse(data) }));\n      res.once('error', reject);\n    });\n    req.once('error', reject);\n    req.setTimeout(3000, () => req.destroy(new Error('TEST_TIMEOUT')));\n    req.end(text);\n  });\n}\nasync function waitFor(check) {\n  for (let i=0;i<200;i+=1) { if (check()) return; await pause(5); }\n  throw new Error('condition not observed');\n}",
          "language": "js",
          "filename": "examples/node-http-lifecycle/test.mjs",
          "purpose": "测试客户端与启动/清理辅助函数，连续原文。端口 0 由操作系统分配；after 总会触发有期限的服务关闭。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "cd examples/node-http-lifecycle\nnvm use\nnpm ci\nnpm test\nnpm start\n# 另一个终端\ncurl -i -X POST http://127.0.0.1:4313/notes \\\n  -H 'Content-Type: application/json' \\\n  --data '{\"title\":\"  note  \",\"delayMs\":0}'\n# 返回 200 与 {\"title\":\"note\"}\n# 在服务终端按 Ctrl+C，观察 draining:SIGINT 和最终快照",
          "language": "sh",
          "filename": "终端 · 运行服务和人工请求",
          "purpose": "4313 是此独立教学服务端口，不改变站点固定的 4173 端口。curl 只作为人工查看，自动断言由 npm test 完成。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本机 Node 22.12.0、macOS 14.5 x64 已通过 7 项真实 HTTP 测试：正常及连续请求、语法/结构/媒体类型/UTF-8 字节限制、应用预算、断开释放容量、短请求正常排空、关闭期限强制停止、未完成正文受限。最后两个测试特意把正常响应和被强制断开分开验证，没有用一条健康检查代替生命周期证明。"
        },
        {
          "type": "paragraph",
          "text": "做一个理解检查：把 title 换成四十个汉字、正文限制改成 100 字节，虽然 title.length 小于 80，仍应先得到 413，因为编码后的正文已经越过字节边界。再把工作换成不可取消的 Promise，只保留 catch 和 finally，并不能证明资源及时停止；需要真正的上游取消能力或另一个生命周期所有者。"
        },
        {
          "type": "paragraph",
          "text": "本文到这里交付的是一个有界、能清理的确认服务。下一篇已有的导出服务会继续讲流背压与输出容量，再往后才是 Worker 池、性能与内存。本文没有数据库、鉴权、代理、TLS、原生手机或生产压测；图形与页面已检查桌面和手机视口。真实环境还要补反向代理约束、请求日志、连接策略和外部停机期限，不能从本机测试直接推导生产吞吐。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Node 22.12.0 HTTP API",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/http.html"
    },
    {
      "title": "Node 22.12.0 timers/promises 取消",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/timers.html#cancelling-timers"
    },
    {
      "title": "Node 22.12.0 AbortController",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/globals.html#class-abortcontroller"
    }
  ]
};
export default article;
