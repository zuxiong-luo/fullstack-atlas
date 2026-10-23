import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "node-capacity",
  "topic": "nodejs",
  "title": "Node.js：事件循环、流背压与有边界的导出服务",
  "description": "先理解JavaScript执行与异步等待，再实现带背压、并发限制、取消、错误分类和有限退出的Node 22 HTTP导出服务。",
  "minutes": 45,
  "labMinutes": 30,
  "kind": "tutorial",
  "status": "review",
  "verifiedAt": "2026-10-23",
  "versions": [
    "Node.js 22.12.0",
    "仅Node内置模块，无第三方运行依赖"
  ],
  "tags": [
    "Node.js",
    "事件循环",
    "背压",
    "容量",
    "AbortController",
    "HTTP"
  ],
  "scope": "围绕本机CSV导出服务，深入实现字节流、无等待队列的并发上限、客户端取消、总时限、源错误与有界退出。真实数据库游标、Worker线程池及生产压测只作边界导读；不声称交付它们。",
  "prerequisites": [
    "能读ESM、Promise和async/await",
    "知道HTTP状态码、响应头与响应体的区别"
  ],
  "questionIds": [
    "node-capacity-pressure",
    "node-capacity-cpu"
  ],
  "examples": [
    {
      "label": "完整服务与行为测试",
      "path": "node-capacity.zip"
    },
    {
      "label": "运行与复现说明",
      "path": "node-capacity/README.md"
    }
  ],
  "sections": [
    {
      "id": "s15-423830",
      "title": "事件循环是什么：同一线程执行代码，把等待交还运行时",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Node.js中的事件循环，是运行时安排计时器、I/O等回调继续执行的机制。普通JavaScript逻辑通常在当前进程的事件循环线程上执行：这一段函数还没返回，另一段JavaScript回调就得继续等待。网络等待可以交给操作系统；部分文件、加密等操作会使用运行时工作线程池。这些协作让单进程能管理多个连接，但没有把每个JavaScript函数变成并行任务。"
        },
        {
          "type": "paragraph",
          "text": "这套模型适合大量等待I/O的服务。一个请求等待数据库时，主线程可以处理另一个请求的短回调。真正需要控制的是每次占用线程多久、同时启动多少外部工作，以及结果来不及发送时积压在哪里。接下来用CSV导出串起这三件事：生成数据、向客户端写数据、限制导出数量。"
        },
        {
          "type": "paragraph",
          "text": "先消除一个误解：async函数在执行到可让出的等待之前，仍同步执行。下面的程序没有网络请求，也不测耗时，只验证执行顺序。把calculate声明成async，并不会把其中循环搬到工作线程。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "event-loop.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整可执行顺序实验。进入示例目录后 node event-loop.mjs；此处循环仅用于观察顺序，不是生产负载或基准测试。",
          "code": "import { setImmediate as yieldTurn } from 'node:timers/promises';\nconst order = [];\nsetImmediate(() => order.push('immediate callback'));\nasync function calculate() {\n  order.push('calculate start');\n  let sum = 0;\n  for (let n = 0; n < 10000; n += 1) sum += n;\n  order.push(`calculate end:${sum}`);\n  return sum;\n}\nconst result = calculate();\norder.push('caller received promise');\nawait result;\norder.push('after await');\nawait yieldTurn();\norder.push('after setImmediate');\nconsole.log(order.join('\\n'));"
        },
        {
          "type": "code",
          "language": "text",
          "filename": "实际运行的顺序输出",
          "kind": "excerpt",
          "purpose": "Node 22.12.0本机执行。sum是输入0至9999的确定结果，输出顺序用于说明await与事件循环让出。",
          "code": "calculate start\ncalculate end:49995000\ncaller received promise\nafter await\nimmediate callback\nafter setImmediate"
        },
        {
          "type": "paragraph",
          "text": "先出现calculate end，随后调用者才拿到Promise，说明循环在函数调用过程中已经完成。await一个已完成Promise后，继续部分进入微任务；它也不会自动等待setImmediate阶段。若你在循环中不断await Promise.resolve()，仍可能持续占着微任务处理，让其他I/O回调得不到及时机会。示例行源采用可取消的计时等待，delay=0时用setImmediate让出一轮，而不是伪装成异步的紧循环。"
        },
        {
          "type": "reference",
          "title": "Node 22：不要阻塞事件循环",
          "url": "https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop"
        },
        {
          "type": "paragraph",
          "text": "这一步只证明执行关系。若每行包含昂贵压缩、排序或巨大JSON.stringify，定时让出也无法消除总CPU成本。可分离的CPU任务可以放进有界Worker线程池或任务服务；需要考虑创建、传输和排队成本。本文没有实现Worker线程池，不把下面的异步行生成器当成CPU并行方案。"
        }
      ]
    },
    {
      "id": "service-shape",
      "title": "把目标缩到一个可以验证的服务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "初始服务没有在途导出。GET /export?rows=3返回表头和3行CSV；每行由id与1024个x组成。GET /health返回当前导出数、累计完成/拒绝/取消/超时/源失败、RSS及事件循环延迟。默认最多同时2个导出，每个导出从取得名额开始设置1000ms总预算；这是教学配置，生产值需要测量后决定。"
        },
        {
          "type": "table",
          "headers": [
            "入口或参数",
            "约定",
            "为什么这样限制"
          ],
          "rows": [
            [
              "rows",
              "整数1–10000，默认100",
              "限制单请求工作规模，避免调用者申请任意大输出"
            ],
            [
              "delay",
              "每行模拟等待0–50ms，默认1",
              "让等待、取消与过载可复现；并非数据库性能模型"
            ],
            [
              "failAt",
              "默认0；仅显式开启故障注入后生效",
              "测试流中源错误；正常启动不接受故障参数"
            ],
            [
              "导出并发",
              "每进程2个，无等待队列",
              "满额立即503，避免无限等待"
            ],
            [
              "health",
              "不占导出名额",
              "可以观察导出压力，但仍会受主线程阻塞影响"
            ]
          ]
        },
        {
          "type": "figure",
          "src": "figures/node-capacity/lifecycle.svg",
          "title": "请求从校验到释放，只有一个受控的生命周期",
          "alt": "校验参数后尝试取得名额，无名额503，有名额进入可取消的pipeline。成功、断开、超时、源错误统一进入finally释放。",
          "caption": "本项目的实际控制流程。CSV头发送后错误会截断响应；图中的无队列只针对导出业务，不表示TCP层没有其他缓冲。"
        },
        {
          "type": "paragraph",
          "text": "项目有capacity.mjs、rows.mjs、server.mjs三个业务文件，后面全部展示；event-loop.mjs和backpressure.mjs是独立实验，test.mjs验证真实HTTP与同一行源。package.json和package-lock.json锁定项目，.nvmrc固定Node22.12.0；没有额外HTTP框架或模拟数据库。数据只由生成器产生，不写磁盘、不调用外部服务。"
        },
        {
          "type": "code",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "完整仓库根目录执行。独立ZIP解压后进入node-capacity目录，从nvm use开始；未使用nvm时自行安装Node22.12.0。",
          "code": "cd examples/node-capacity\nnvm use\nnpm ci\nnpm test\nnpm run check\nnpm start"
        },
        {
          "type": "code",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在第二个终端执行。正常导出200，tasks.csv含表头共4行；health中的内存和延迟随环境变化，不能照抄为固定数字。",
          "code": "curl -i 'http://127.0.0.1:4310/health'\ncurl -f 'http://127.0.0.1:4310/export?rows=3&delay=0' -o /tmp/tasks.csv\nwc -l /tmp/tasks.csv"
        }
      ]
    },
    {
      "id": "s16-457034",
      "title": "背压是什么：下游写不动，就暂时少取上游数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "流把全部结果拆成一小块一小块。它的作用并不只是“用更少代码读取文件”：生产者无需先把所有数据装进数组，消费者也不必等全部生成才开始发送。但生产和消费速度不同，必须有反馈机制；背压就是这种“先别继续供给”的反馈。"
        },
        {
          "type": "paragraph",
          "text": "Writable.write(chunk)返回false，表示缓冲达到背压阈值，调用者应停止继续写，等drain后再供给。当前这块已经被接收，不应重复写一次。返回true也只说明本地允许继续写，并不代表客户端已经看见数据。我们用pipeline连接Readable和HTTP响应，由流管道处理暂停、继续、结束与错误。"
        },
        {
          "type": "figure",
          "src": "figures/node-capacity/backpressure.svg",
          "title": "pipeline把慢消费者的压力传回行源",
          "alt": "异步生成器经Readable缓冲和HTTP可写缓冲发送给客户端，写入false后停止继续读取，drain后恢复；高水位线不是全进程内存硬上限。",
          "caption": "结构示意。项目Readable明确采用字节模式16KiB阈值；HTTP、socket、内核以及其他请求有各自缓冲。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "rows.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整行源。delay模拟可取消I/O，setImmediate提供delay=0的合作让出；onRow只记已经生成的数据行，不包含表头。",
          "code": "import { Readable } from 'node:stream';\nimport { setTimeout as pause, setImmediate as yieldTurn } from 'node:timers/promises';\n\nexport function createRows({ count, delayMs = 1, failAt = 0, signal, onRow = () => {}, highWaterMark = 16 * 1024 }) {\n  async function* generate() {\n    yield Buffer.from('id,payload\\n');\n    for (let id = 1; id <= count; id += 1) {\n      signal?.throwIfAborted();\n      if (id === failAt) throw new Error('INJECTED_SOURCE_FAILURE');\n      // Simulated cancellable I/O, not a real database cursor.\n      if (delayMs > 0) await pause(delayMs, undefined, { signal });\n      else await yieldTurn(undefined, { signal });\n      signal?.throwIfAborted();\n      onRow(id);\n      yield Buffer.from(`${id},${'x'.repeat(1024)}\\n`);\n    }\n  }\n  return Readable.from(generate(), { objectMode: false, highWaterMark });\n}"
        },
        {
          "type": "paragraph",
          "text": "初次拉取先得到表头id,payload。接下来每次读取推进生成器：检查取消、检查故障位置、等待、再次检查取消，然后生成一行Buffer。Readable.from按下游需求读取，可能为填充自己的缓冲提前取若干行，所以“逐行生成”不等于任何时刻只存在一行。highWaterMark明确为16KiB；objectMode=false使阈值按字节计算。"
        },
        {
          "type": "paragraph",
          "text": "行块大小可能跨过阈值，其他层又有缓冲，因此高水位线是触发反馈的阈值，不是整个进程的硬上限。粗略预算要包括每个在途请求的可读/可写缓冲、socket与上游驱动缓冲，再乘并发数量；还要加上应用缓存和运行时开销。流式实现减少一次性全量聚合，并不允许并发数无限增大。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "backpressure.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整背压实验。node backpressure.mjs；同一个createRows接入故意放慢的Writable，把高水位线缩小以便看到生产者受控。",
          "code": "import { Writable } from 'node:stream';\nimport { pipeline } from 'node:stream/promises';\nimport { createRows } from './rows.mjs';\nlet produced = 0, consumed = 0, maxAhead = 0;\nconst source = createRows({\n  count: 30, delayMs: 0, highWaterMark: 1024,\n  onRow: () => { produced += 1; maxAhead = Math.max(maxAhead, produced - consumed); },\n});\nconst destination = new Writable({\n  highWaterMark: 1,\n  write(chunk, encoding, callback) {\n    setTimeout(() => { if (chunk.toString() !== 'id,payload\\n') consumed += 1; callback(); }, 3);\n  },\n});\nawait pipeline(source, destination);\nconsole.log(JSON.stringify({ produced, consumed, maxAhead }));"
        },
        {
          "type": "paragraph",
          "text": "本机一次实际运行输出produced=30、consumed=30、maxAhead=2。maxAhead是生成行数减去已完成写入行数的最大值，不是毫秒或内存值。测试只要求它不超过3，避免把某一机器的具体调度细节当承诺。这个实验验证同一行源通过pipeline尊重背压，没有把HTTP客户端是否足够慢当作可重复的测试前提。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0：Streams、write与pipeline",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/stream.html"
        },
        {
          "type": "paragraph",
          "text": "真实数据库接入时，需要把生成器内部换成有边界的游标/分页读取，并在finally关闭游标。若驱动早已把全部记录载入内存，外面再包装Readable不会退回已经分配的内存；若驱动不支持AbortSignal，也需要它自己的取消或连接清理接口。本文没有数据库，不能把信号传入计时器的效果宣称为所有驱动都能取消。"
        }
      ]
    },
    {
      "id": "s15-394781",
      "title": "并发上限先落到一个很小的资源租约",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "并发限制控制此刻有多少任务同时占资源；速率限制控制单位时间启动多少；队列上限控制允许多少任务等待。它们解决不同问题。这里先实现最容易审计的一种策略：最多N个在途导出，满了立即返回503，不保留任何业务等待队列。客户端可以稍后重试，但应该退避并加随机抖动，避免所有人一秒后同时再次冲入。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "capacity.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整无等待队列的名额管理器。tryAcquire返回释放函数或null；释放函数幂等，最终计数不会重复减。",
          "code": "// No waiting queue: a caller either receives a lease or is rejected immediately.\nexport function createCapacity(maxActive) {\n  if (!Number.isSafeInteger(maxActive) || maxActive < 1) {\n    throw new RangeError('maxActive must be a positive integer');\n  }\n  let active = 0;\n  return {\n    get active() { return active; },\n    tryAcquire() {\n      if (active >= maxActive) return null;\n      active += 1;\n      let released = false;\n      return () => {\n        if (released) return;\n        released = true;\n        active -= 1;\n      };\n    },\n  };\n}"
        },
        {
          "type": "paragraph",
          "text": "用maxActive=2走一遍：A申请后active从0到1，B申请后从1到2，C此时得到null。C不会启动生成器，也不占等待内存。A结束调用release后active回到1，之后的新请求才有机会进入。同步检查和加一之间没有await；在单个Node事件循环中的这段同步执行不会被另一个请求插入。"
        },
        {
          "type": "paragraph",
          "text": "这个性质仅限单进程。开4个进程，每个上限2，整体可能同时8个；不同机器更不会共享这个变量。需要全局控制数据库、外部API等稀缺资源时，应同时设置资源池上限，必要时使用集中准入/配额策略。不要把这里的闭包变量称为分布式信号量。"
        },
        {
          "type": "paragraph",
          "text": "如果业务必须排队，就要增加最大队长、排队时限、取消等待、出队时的权限/时限检查，以及队列等待指标。否则“并发只有2”仍可能积压数万条等待对象。Little定律L=λW可以在稳定系统中检查平均在系统任务数、到达率与平均停留时间是否自洽；它不能为瞬时突发、尾延迟或无限队列作安全保证。"
        }
      ]
    },
    {
      "id": "http-start",
      "title": "HTTP入口先校验，再占资源",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "接着把上面的资源限制接到HTTP。为了让正文可以独立阅读，server.mjs按职责连续分段展示，顺序拼接就是完整文件，未省略影响结论的调用者或清理路径。先看依赖、参数解析、服务状态和入口："
        },
        {
          "type": "code",
          "language": "js",
          "filename": "server.mjs · 1–58",
          "kind": "excerpt",
          "purpose": "第1段，连续1–58行。包含全部依赖、integer/json辅助函数、服务初始化、路由、参数校验和拒绝路径。",
          "code": "import { createServer } from 'node:http';\nimport { pipeline } from 'node:stream/promises';\nimport { monitorEventLoopDelay } from 'node:perf_hooks';\nimport { pathToFileURL } from 'node:url';\nimport { createCapacity } from './capacity.mjs';\nimport { createRows } from './rows.mjs';\n\nfunction integer(params, key, fallback, min, max) {\n  if (!params.has(key)) return fallback;\n  const raw = params.get(key);\n  if (params.getAll(key).length !== 1 || !/^\\d+$/.test(raw)) throw new Error(`invalid ${key}`);\n  const value = Number(raw);\n  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`invalid ${key}`);\n  return value;\n}\nfunction json(response, status, value, extra = {}) {\n  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra });\n  response.end(JSON.stringify(value));\n}\n\nexport function createExportService({ maxActive = 2, deadlineMs = 1000, enableFaults = false } = {}) {\n  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1) throw new RangeError('invalid deadlineMs');\n  const capacity = createCapacity(maxActive);\n  const controllers = new Set();\n  const stats = { completed: 0, rejected: 0, cancelled: 0, timedOut: 0, failed: 0, generatedRows: 0 };\n  const lag = monitorEventLoopDelay({ resolution: 20 });\n  lag.enable();\n  let closing = false;\n  let closePromise;\n  const snapshot = () => ({\n    ...stats, active: capacity.active, maxActive, closing,\n    rssBytes: process.memoryUsage().rss,\n    eventLoopDelayMs: lag.count > 0 ? { mean: lag.mean / 1e6, p99: lag.percentile(99) / 1e6 } : null,\n  });\n\n  async function handle(request, response) {\n    if (request.method !== 'GET') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'GET' });\n    const url = new URL(request.url, 'http://127.0.0.1');\n    if (url.pathname === '/health') return json(response, closing ? 503 : 200, snapshot());\n    if (url.pathname !== '/export') return json(response, 404, { error: 'NOT_FOUND' });\n    if (closing) return json(response, 503, { error: 'SHUTTING_DOWN' });\n    let count, delayMs, failAt;\n    try {\n      for (const key of url.searchParams.keys()) {\n        if (!['rows', 'delay', 'failAt'].includes(key)) throw new Error('unknown query');\n      }\n      count = integer(url.searchParams, 'rows', 100, 1, 10000);\n      delayMs = integer(url.searchParams, 'delay', 1, 0, 50);\n      failAt = integer(url.searchParams, 'failAt', 0, 0, count);\n      if (failAt > 0 && !enableFaults) throw new Error('fault injection disabled');\n    } catch {\n      return json(response, 400, { error: 'INVALID_QUERY' });\n    }\n    const release = capacity.tryAcquire();\n    if (!release) {\n      stats.rejected += 1;\n      return json(response, 503, { error: 'EXPORT_BUSY' }, { 'retry-after': '1' });\n    }"
        },
        {
          "type": "paragraph",
          "text": "以rows=3为输入：integer读到字符串3，通过纯数字、安全整数和范围检查，得到数值3；随后尝试申请名额。rows=0、rows=1.2、重复rows以及未知字段都在占资源之前返回400。故障开关默认关闭，failAt=2同样先返回400。这样输入错误不会产生一份半完成CSV。"
        },
        {
          "type": "paragraph",
          "text": "capacity已满时返回503与Retry-After:1，stats.rejected加一；它是服务容量不足，不是账号访问频次过高，所以这里没有用429。这个头是最早建议重试间隔，不是服务器预留了下一秒的名额。health不走tryAcquire，可以在导出满额时查看active；若JavaScript本身被同步循环阻塞，health也仍然得等。"
        },
        {
          "type": "paragraph",
          "text": "rssBytes来自进程RSS，包含堆、原生分配等进程驻留内存，不等于每个请求持有多少；eventLoopDelayMs来自monitorEventLoopDelay，单位从纳秒转换成毫秒。刚启动没有采样时返回null。它们是诊断线索，不是“这个请求为什么慢”的完整答案；快照没有持久化，也没有清零窗口策略。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0：monitorEventLoopDelay",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/perf_hooks.html#perf_hooksmonitoreventloopdelayoptions"
        }
      ]
    },
    {
      "id": "request-lifecycle",
      "title": "让成功、断开、超时和源错误都走到finally",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "取得名额以后，最重要的工作是给它一个清晰的结束路径。每次导出创建一个AbortController，把相同signal同时交给行源和pipeline；它把下游终止和上游等待接到一起。计时器负责总时限，response.close负责发现未正常完成的连接关闭。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "server.mjs · 59–91",
          "kind": "excerpt",
          "purpose": "第2段，连续59–91行。接在上一段后；覆盖Controller、时限、CSV头、pipeline、错误分类和finally。",
          "code": "    const controller = new AbortController();\n    controllers.add(controller);\n    let timedOut = false;\n    let sourceFailed = false;\n    const timer = setTimeout(() => {\n      timedOut = true;\n      controller.abort(new Error('EXPORT_DEADLINE'));\n    }, deadlineMs);\n    const onClose = () => {\n      if (!response.writableFinished) controller.abort(new Error('CLIENT_CLOSED'));\n    };\n    response.on('close', onClose);\n    try {\n      response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename=\"tasks.csv\"' });\n      response.flushHeaders();\n      const source = createRows({ count, delayMs, failAt, signal: controller.signal, onRow: () => { stats.generatedRows += 1; } });\n      source.once('error', error => { if (error.name !== 'AbortError') sourceFailed = true; });\n      await pipeline(source, response, { signal: controller.signal });\n      stats.completed += 1;\n    } catch {\n      if (timedOut) stats.timedOut += 1;\n      else if (sourceFailed) stats.failed += 1;\n      else if (controller.signal.aborted) stats.cancelled += 1;\n      else stats.failed += 1;\n      // Headers may already be on the wire. Terminate instead of appending JSON to CSV.\n      if (!response.destroyed) response.destroy();\n    } finally {\n      clearTimeout(timer);\n      response.off('close', onClose);\n      controllers.delete(controller);\n      release();\n    }\n  }"
        },
        {
          "type": "paragraph",
          "text": "普通路径很直接：active已经增加，写出200和CSV头，pipeline开始拉取行源；生成3行并正常结束后，completed增加。无论成功失败，finally都清定时器、移除close监听、从集合删除Controller，再释放名额。completed表示服务端这条管道完成，不等于用户已把文件安全保存到磁盘。"
        },
        {
          "type": "paragraph",
          "text": "反例一是客户端放弃下载。我们监听响应的close，而不是把请求体结束当作下载完成；如果response.writableFinished仍为false，就取消Controller。计时等待收到signal后结束，pipeline也销毁相关流，生成停止，finally释放。这个GET请求的请求体早就结束了，但响应可能还在发送，两者的生命周期不同。"
        },
        {
          "type": "paragraph",
          "text": "反例二是超时。总时限从取得名额后开始计时，覆盖生成与发送等待；它与连接建立时限、单次数据库调用超时、无数据空闲时限不是同一概念。本例的计时器达到1000ms预算后请求取消整个导出；回调仍要等事件循环有机会执行，长同步计算也不能被AbortSignal强行打断，所以这不是抢占式硬时限。实际业务可分层配置预算，但要确保预算之间有一致含义，别让上游“继续重试”超过请求总预算。"
        },
        {
          "type": "paragraph",
          "text": "反例三是行源抛错。pipeline会把错误传播并结束/销毁相关流；此时响应close也可能发生。如果只看Controller有没有被close取消，就可能把源故障误记成客户端取消。所以source的error先记录sourceFailed；catch按超时、已知源失败、其他取消、其他错误分类。这个策略是本例的诊断约定，不代表网络故障都能唯一归因。"
        },
        {
          "type": "table",
          "headers": [
            "路径",
            "已经发出CSV头？",
            "对客户端的行为",
            "finally之后"
          ],
          "rows": [
            [
              "参数错误/容量不足",
              "否",
              "400或503 JSON",
              "未占名额"
            ],
            [
              "正常导出",
              "是",
              "200，完整CSV",
              "completed增加，active减一"
            ],
            [
              "客户端断开",
              "是",
              "连接已关闭",
              "cancelled增加，停止生成"
            ],
            [
              "总时限",
              "是",
              "中断响应体",
              "timedOut增加，停止生成"
            ],
            [
              "源错误",
              "是",
              "截断响应，不追加JSON",
              "failed增加，可接后续请求"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "为什么错误后不return一个500 JSON？因为writeHead和flushHeaders已经发送200，状态不能重新写；把JSON追加到CSV尾部更会造成一个混合格式文件。客户端应把响应体读取失败当作导出未完成。若业务要求可靠交付、可重试下载和明确完整性，应改成后台生成文件、记录任务状态，再提供完成文件的下载入口；那是另一种任务协议。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0：ServerResponse close / writableFinished",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/http.html#class-httpserverresponse"
        }
      ]
    },
    {
      "id": "s11-181294",
      "title": "服务退出也要有时间边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "进程收到SIGTERM，不应该立刻退出把所有正在发送的文件切断，也不该永远等待一个不再读取的客户端。这里先停止接收新连接，给现有请求有限宽限；到期则取消所有导出，强制关闭仍存连接。最后停掉事件循环延迟采样。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "server.mjs · 92–127",
          "kind": "excerpt",
          "purpose": "第3段，连续92–127行，补齐服务创建、未预料异常防护、close和CLI启动。到此三个业务文件已在正文完整展示。",
          "code": "  const server = createServer((request, response) => {\n    handle(request, response).catch(() => {\n      // Protect the process from unexpected handler errors outside the export try block.\n      if (!response.headersSent) json(response, 500, { error: 'INTERNAL_ERROR' });\n      else response.destroy();\n    });\n  });\n  async function close({ graceMs = 1000 } = {}) {\n    if (!Number.isSafeInteger(graceMs) || graceMs < 0) throw new RangeError('invalid graceMs');\n    if (closePromise) return closePromise;\n    closing = true;\n    closePromise = new Promise((resolve, reject) => {\n      const force = setTimeout(() => {\n        for (const controller of controllers) controller.abort(new Error('SERVER_SHUTDOWN'));\n        server.closeAllConnections();\n      }, graceMs);\n      server.close(error => {\n        clearTimeout(force);\n        lag.disable();\n        if (error) reject(error); else resolve();\n      });\n    });\n    return closePromise;\n  }\n  return { server, snapshot, close };\n}\n\nif (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {\n  const service = createExportService({ enableFaults: process.env.EXPORT_FAULTS === '1' });\n  service.server.listen(4310, '127.0.0.1', () => console.log('http://127.0.0.1:4310 — maxActive=2, deadlineMs=1000'));\n  for (const signal of ['SIGINT', 'SIGTERM']) {\n    process.once(signal, () => {\n      service.close().then(() => console.log('closed', service.snapshot())).catch(error => { console.error(error); process.exitCode = 1; });\n    });\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "closePromise让重复退出信号共享同一次退出过程，closing使尚能进入入口的请求得到关闭提示。server.close停止接受新连接，并等现有连接处理；宽限计时器到期调用Controller.abort和closeAllConnections，避免无期限等待。close回调不等于所有异步finally恰好已经同步执行完，测试因此继续等active回到0，验证资源最终释放。"
        },
        {
          "type": "paragraph",
          "text": "在本服务中cancelled同时包含客户端取消与强制退出取消。生产可增加shutdownCancelled等更细标签，但要避免把用户ID等高基数字段放进指标维度；详细归因可写结构化日志。这里没有引入日志平台，所以没有声称提供生产级追踪。"
        },
        {
          "type": "paragraph",
          "text": "部署时需要让平台给进程的终止宽限大于应用自己的退出预算，并确保反向代理、数据库池等也有清理流程。本例只监听127.0.0.1，供本机教学；没有登录、TLS、代理信任、数据库或互联网发布配置。不能把它作为公网大文件导出的完整生产模板。"
        }
      ]
    },
    {
      "id": "s10-352596",
      "title": "实际验证：先确认正确与回收，再设计容量实验",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "npm test使用Node自带测试运行器，启动真实HTTP服务并随机分配测试端口。它不只测计数器：普通导出核对全部CSV字节；满额测试保持一个慢导出，再确认另一个收到503、health仍可用；取消/超时/源错误后，检查名额释放并重新成功导出。背压另用真实同一行源接慢Writable，验证生产不无限跑在消费前面。"
        },
        {
          "type": "table",
          "headers": [
            "验收项",
            "实际断言",
            "结果"
          ],
          "rows": [
            [
              "资源租约",
              "满额返回null、重复释放不减成负数",
              "通过"
            ],
            [
              "正常响应",
              "200、表头和3行完整字节、名额归零",
              "通过"
            ],
            [
              "输入边界",
              "非法/重复/未知输入和未启用故障400，方法405",
              "通过"
            ],
            [
              "饱和",
              "并发1时第二导出503、health200",
              "通过"
            ],
            [
              "断开取消",
              "生成提前结束，计数停止，下一导出成功",
              "通过"
            ],
            [
              "总时限",
              "已发200的响应体失败，timedOut增加，名额归零",
              "通过"
            ],
            [
              "源异常",
              "响应体中断，failed增加，服务可恢复",
              "通过"
            ],
            [
              "背压",
              "30行全部消费，最大领先不超过3",
              "通过"
            ],
            [
              "退出",
              "有限宽限后中断在途响应并回收",
              "通过"
            ]
          ]
        },
        {
          "type": "code",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "前两条先验证取消；随后Ctrl+C停止原服务，再开启故障模式。被中断的CSV是不完整文件，curl失败是这一反例的预期结果。",
          "code": "# 正常运行时在另一个终端：客户端0.1秒后主动放弃\ncurl --max-time 0.1 'http://127.0.0.1:4310/export?rows=1000&delay=20' -o /tmp/interrupted.csv\ncurl 'http://127.0.0.1:4310/health'\n# 关闭服务后，单独启动故障测试模式\nEXPORT_FAULTS=1 npm start\n# 另一个终端发起：收到200头后，响应体在第3行前中断\ncurl -v 'http://127.0.0.1:4310/export?rows=5&delay=10&failAt=3' -o /tmp/failed.csv"
        },
        {
          "type": "paragraph",
          "text": "本机macOS、Node22.12.0实际执行10项测试全部通过，语法检查通过，两个独立实验运行成功。测试中的几十毫秒用于制造因果关系和等待回收，不能作为吞吐或延迟基准；没有数据库、代理和真实慢网压测，也没有得出任何提速百分比。"
        },
        {
          "type": "paragraph",
          "text": "如果要评估业务容量，先固定导出规模、并发、客户端消费速度、设备与Node版本；同时观测成功/503比例、请求p50/p95/p99、RSS、事件循环延迟、CPU及数据库池。保持相同输入，比较全量聚合与流式方案的多轮样本，并记录预热和采样窗口。本项目交付的是正确性与生命周期实验，未实现这个聚合对照，也没有发布它的性能结论。"
        },
        {
          "type": "paragraph",
          "text": "CPU高且事件循环延迟高时，先找同步工作与长回调；CPU低但延迟高时，检查连接池等待、数据库锁、外部请求和排队。RSS持续增长时，区分堆对象留存、原生缓冲、并发增加以及缓冲是否真正排出。指标的作用是选择下一条证据，不是拿一个数直接宣布原因。"
        }
      ]
    },
    {
      "id": "reader-check",
      "title": "把源码遮住以后，仍能说清这三件事",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "为什么流式发送仍然需要并发限制？背压协调单条管道的生产与消费；每个导出都有缓冲、计时器、连接与上游资源。无限增加管道，单条受控也会汇总成不可接受的总资源量。"
        },
        {
          "type": "paragraph",
          "text": "为什么超时后还要把signal传给行源？仅让HTTP promise失败，无法自动停止一个不听取消的数据库查询或循环。本例的等待和生成器主动检查signal，配合pipeline才会停止无用工作；真实驱动需核对自己的取消能力。"
        },
        {
          "type": "paragraph",
          "text": "为什么一个await不能保证服务不卡？await只在相应位置让出，执行到它之前的同步计算仍占用线程；反复微任务等待也不保证I/O机会。先缩短单次同步工作，必要时让出事件循环或把CPU任务移到有界工作池，再用真实指标验证。"
        },
        {
          "type": "paragraph",
          "text": "本篇的核心关系已经闭合：事件循环解释何时能继续运行，背压解释什么时候继续生产，并发上限限制同时有多少工作，取消/时限/退出保证这些工作能结束。把这四个问题分别落到代码，你才能区分是主线程忙、下游慢，还是服务接了过多未完成任务。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Node.js 22.12.0 Streams",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/stream.html"
    },
    {
      "title": "Node.js 22.12.0 HTTP",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/http.html"
    },
    {
      "title": "Node.js 22.12.0 performance measurement",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/perf_hooks.html"
    }
  ]
};
export default article;
