import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "node-execution-model",
  "topic": "nodejs",
  "title": "Node.js 执行模型：进程、事件循环与异步 I/O",
  "description": "从进程和执行线程开始，逐步解释异步等待、回调检查点、CPU 阻塞与进程退出；用实际子进程区分 CJS/ESM 的顺序边界。",
  "minutes": 38,
  "labMinutes": 25,
  "tags": [
    "Node.js",
    "事件循环",
    "libuv",
    "微任务",
    "异步 I/O",
    "AbortSignal"
  ],
  "scope": "解释单个 Node 22 进程的普通 JavaScript 执行、等待与退出，用确定顺序实验和有界分块计算验证。Worker 线程池实现、跨进程调度及吞吐压测留给后续文章。",
  "prerequisites": [
    "会读函数、Promise 与 async/await",
    "知道程序可以访问文件或网络，但无需了解 libuv"
  ],
  "questionIds": [],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0",
    "macOS 14.5 x64 实测",
    "无第三方运行依赖"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    {
      "label": "完整示例与行为测试",
      "path": "node-execution-model.zip"
    },
    {
      "label": "运行说明",
      "path": "node-execution-model/README.md"
    }
  ],
  "sections": [
    {
      "id": "runtime",
      "title": "Node.js 是运行时：先把进程、线程和事件循环分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Node.js 是在浏览器之外运行 JavaScript 的运行时。它把 V8 执行引擎、文件与网络接口、模块加载器以及事件循环放进同一个可启动的程序。你执行 node main.mjs，操作系统创建进程，Node 加载入口模块并执行代码；进程有自己的地址空间、打开的连接和退出状态。理解这一层后，才有必要问“这段异步代码由谁执行”。"
        },
        {
          "type": "paragraph",
          "text": "线程是进程内实际执行指令的单位。本文关注的普通 JavaScript 回调，通常在所属事件循环线程上一次执行一段。Node 进程内部还可能有 V8 的后台线程、libuv 工作线程，应用也可以显式创建 Worker。因此，“一个事件循环线程串行执行回调”有明确对象；说整个进程永远只有一个线程，就会误判 CPU、内存与并行能力。"
        },
        {
          "type": "paragraph",
          "text": "事件循环是组织计时器、I/O 等回调继续执行的机制。它解决的是：这段代码等待外部结果时，线程能否接着处理别的就绪工作。它不会抢占正在运行的 JavaScript 函数；当前函数里一段很长的同步循环，仍要自己执行完或主动返回。回调是否已经就绪，与它能否立刻取得执行机会，是两件事。"
        },
        {
          "type": "figure",
          "src": "figures/node-execution-model/runtime.svg",
          "title": "运行时中的职责分工",
          "alt": "JavaScript 与事件循环协作；操作系统处理网络就绪；部分文件和加密任务走工作线程池；显式 Worker 拥有独立 JS 环境。",
          "caption": "职责示意，不表示线程数量或耗时比例。箭头表示协作与完成通知；回调最终回到自己的 JavaScript 执行环境。"
        },
        {
          "type": "paragraph",
          "text": "网络连接的等待通常借助操作系统提供的能力；文件系统接口、部分加密和名称解析接口等可能使用 libuv 线程池，具体要看 API。不能把“异步”统一翻译为“去线程池执行”，更不能以为 await 后面的业务函数已经换了线程。后面的实验只推导可观察的 JavaScript 顺序，不凭日志猜测内核内部的每一次调度。"
        }
      ]
    },
    {
      "id": "waiting",
      "title": "异步释放的是等待机会，async 不会搬走同步计算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先把例子缩小：知识笔记程序计算一组整数，然后读取一个很小的文件。计算的输入是 0 到 9999，结果可以手算为 49995000；文件固定为 notes。我们不比较毫秒数，只记录哪一步先发生。这样即使电脑负载不同，也能检验核心判断：async 函数内部的同步循环，发生在调用者拿到 Promise 之前。"
        },
        {
          "type": "code",
          "code": "import { readFile } from 'node:fs/promises';\nimport { setImmediate as nextTurn } from 'node:timers/promises';\n\n// An async function runs synchronously until it reaches a suspension point.\nexport async function cpuInAsync(trace) {\n  trace.push('cpu:start');\n  let total = 0;\n  for (let i = 0; i < 10000; i += 1) total += i;\n  trace.push(`cpu:end:${total}`);\n  return total;\n}\n\nexport async function experiment() {\n  const trace = [];\n  const work = cpuInAsync(trace);\n  trace.push('caller:promise');\n  await work;\n  trace.push('caller:awaited');\n  const content = await readFile(new URL('./fixture.txt', import.meta.url), 'utf8');\n  trace.push(`file:${content.trim()}`);\n  await nextTurn();\n  trace.push('turn:resumed');\n  return trace;\n}\nif (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {\n  console.log((await experiment()).join('\\n'));\n}",
          "language": "js",
          "filename": "examples/node-execution-model/main.mjs",
          "purpose": "完整入口与实验。cpuInAsync 的循环没有 await；experiment 展示调用、等待文件和显式让出一轮。可直接 node main.mjs。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "cpu:start\ncpu:end:49995000\ncaller:promise\ncaller:awaited\nfile:notes\nturn:resumed",
          "language": "text",
          "filename": "本机实际输出",
          "purpose": "Node 22.12.0 执行 main.mjs；记录的是先后关系，不是性能测量。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "调用 cpuInAsync 时，执行立即进入函数并完成循环。函数返回后，work 才是调用者能拿到的 Promise，所以 caller:promise 在 cpu:end 后面。await work 把后续语句安排为异步继续执行，即使 work 已经完成，也不等于从这里起业务计算都在后台运行。await 是等待表达式，不是线程创建语句。"
        },
        {
          "type": "paragraph",
          "text": "readFile 则真的把文件等待交给运行时。等待完成后，await 后面的代码重新获得执行机会。这里没有其他业务回调，输出显得很直线；在服务器里，等待文件的间隙可以处理别的短请求。但如果等待之前先做一次巨大的 JSON.parse、排序或压缩，那个同步阶段仍会阻塞其他请求。容量规划必须同时考虑等待数量和每段回调的 CPU 成本。"
        }
      ]
    },
    {
      "id": "checkpoints",
      "title": "为什么同一份日志换成 ESM 后，nextTick 顺序变了",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "微任务是 Promise reaction、queueMicrotask 等使用的继续执行机制；process.nextTick 有 Node 自己的处理队列。它们不应被画成事件循环某个普通阶段里的“最后一步”。想判断顺序，先交代代码执行的上下文：入口是 CommonJS 还是 ES module？注册发生在入口顶层，还是某次 I/O 回调里？忽略这些前提，背顺序口诀很容易失效。"
        },
        {
          "type": "code",
          "code": "const trace = ['sync'];\nprocess.nextTick(() => trace.push('nextTick'));\nPromise.resolve().then(() => trace.push('promise'));\nqueueMicrotask(() => trace.push('microtask'));\nsetImmediate(() => console.log(JSON.stringify(trace)));",
          "language": "js",
          "filename": "examples/node-execution-model/order.cjs",
          "purpose": "CJS 顶层完整文件；order.mjs 使用逐字相同的代码，只改变入口模块格式。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "node order.cjs\n# [\"sync\",\"nextTick\",\"promise\",\"microtask\"]\nnode order.mjs\n# [\"sync\",\"promise\",\"microtask\",\"nextTick\"]",
          "language": "sh",
          "filename": "终端 · 两种入口的实际输出",
          "purpose": "在示例目录执行。setImmediate 只负责等这些记录形成后打印，不纳入本例数组。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "CJS 入口这一轮同步代码结束后，观察到 nextTick 先于这里注册的 Promise 与 queueMicrotask。ESM 入口的模块求值已经处在异步模块执行上下文，同样的 nextTick 会表现为另一种检查点关系。两条微任务按本例注册先后进入队列，因此 promise 位于 microtask 前。结论必须连同入口上下文保留，不能把第二行当成 Node 随机乱序。"
        },
        {
          "type": "figure",
          "src": "figures/node-execution-model/checkpoints.svg",
          "title": "入口上下文属于顺序结论的一部分",
          "alt": "CJS 顶层先 nextTick 再 Promise 和 queueMicrotask；ESM 顶层本例先微任务后 nextTick。",
          "caption": "图只对应两个原文件，不表示任意嵌套调度都服从同一行顺序。"
        },
        {
          "type": "paragraph",
          "text": "反过来，如果一个回调不断排入新的 nextTick，或者 Promise 链不断追加微任务，处理这些队列可能拖延其他回调。把循环每轮改成 await Promise.resolve() 并不等于把执行机会交还给文件 I/O。选择 queueMicrotask 应是为了当前回调之后的小型一致性工作，不应把它当成大任务切片工具。process.nextTick 的特殊语义还增加理解成本，新代码应先考虑是否真需要这一层。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0：process.nextTick 的 CJS / ESM 上下文说明",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/process.html#processnexttickcallback-args",
          "note": "固定版本的行为依据；上面的完整程序和子进程测试可在本地复现。"
        }
      ]
    },
    {
      "id": "phases",
      "title": "计时器表示最早可执行条件，不承诺精准时间",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "setTimeout(fn, 0) 的含义不是“现在执行 fn”，而是满足计时条件后等待回调机会。事件循环还要处理其他工作，系统也有调度延迟。setImmediate 则安排在 check 阶段执行。Node 20 起使用的 libuv 变化会影响计时器与 poll 阶段的相对关系，因此不能拿不同 Node 主版本的阶段图混着推导。"
        },
        {
          "type": "paragraph",
          "text": "在入口顶层同时注册 timeout 和 immediate，不宜把某一台机器的一次日志当成普遍顺序。为了得到具有明确前提的实验，我们把注册放在一次文件读取回调内。此时 I/O 回调先记录 io，再安排 immediate 和 timeout；本文固定环境下，immediate 在新计时器之前执行。测试断言的是这个有上下文的关系。"
        },
        {
          "type": "code",
          "code": "const { readFile } = require('node:fs');\nreadFile(__filename, () => {\n  const trace = ['io'];\n  setTimeout(() => { trace.push('timer'); console.log(JSON.stringify(trace)); }, 0);\n  setImmediate(() => trace.push('immediate'));\n});",
          "language": "js",
          "filename": "examples/node-execution-model/io-order.cjs",
          "purpose": "完整文件 I/O 实验。只有进入 readFile 回调后才创建计时器与 immediate，输出包含该前提。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "[\"io\",\"immediate\",\"timer\"]",
          "language": "text",
          "filename": "io-order.cjs 实际输出",
          "purpose": "在 Node 22.12.0 上执行 node io-order.cjs。没有耗时指标。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这不会证明某个 HTTP 请求一定比另一个快。读文件、DNS、网络和业务回调各有外部状态，完成顺序不等于提交顺序。需要串行时就显式 await 前一个操作；允许并发时用任务 ID 关联结果，不靠猜日志顺序建立业务一致性。计时器主要表达预算、重试或周期意图，业务正确性不能依赖它刚好在某个毫秒执行。"
        },
        {
          "type": "reference",
          "title": "Node 官方事件循环说明",
          "url": "https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick",
          "note": "用于核对阶段与版本差异；本篇不给出全部底层阶段实现。"
        }
      ]
    },
    {
      "id": "cooperation",
      "title": "怎样把 CPU 工作切小，并且真的可以取消",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果任务可以拆成小块，可以在块之间让出一轮事件循环。这样没有增加 CPU 核心，也没有减少求和次数，但其他就绪回调有机会运行，取消信号也有机会被观察。关键是同时限制总工作量和单块大小：只限制块长，攻击者仍可申请无限多块；只限制总量，单块也可能长到影响响应。"
        },
        {
          "type": "code",
          "code": "import { setImmediate as nextTurn } from 'node:timers/promises';\nexport async function sumInChunks(count, { signal, chunkSize = 1000 } = {}) {\n  if (!Number.isSafeInteger(count) || count < 0 || count > 1000000 ||\n      !Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 10000) {\n    throw new RangeError('bounded count and chunkSize required');\n  }\n  let sum = 0;\n  for (let start = 0; start < count; start += chunkSize) {\n    signal?.throwIfAborted();\n    const end = Math.min(start + chunkSize, count);\n    for (let i = start; i < end; i += 1) sum += i;\n    await nextTurn(undefined, { signal });\n  }\n  signal?.throwIfAborted();\n  return sum;\n}",
          "language": "js",
          "filename": "examples/node-execution-model/chunks.mjs",
          "purpose": "完整有界分块求和器。count 最多一百万，chunkSize 最多一万；在块边界检查取消并等待 setImmediate。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "普通输入 sumInChunks(10000) 仍返回 49995000。第一块开始前检查 signal，每块计算完等待 nextTurn，下一块再检查。测试先注册一个 setImmediate 来 abort，然后启动一百万项计算；函数进入首次等待后，取消回调可以运行，Promise 以 AbortError 拒绝。测试证明合作式取消路径存在，不声称任何输入都有同样的取消延迟。"
        },
        {
          "type": "paragraph",
          "text": "信号不能打断内层已经执行的 for 循环，也不能让一个不支持信号的外部库自动终止。一次昂贵的原生调用仍可能超过目标延迟。重 CPU 任务应比较 Worker、独立进程或任务服务，并给工作池设置队列与内存边界；不能为每个请求无限创建 Worker。这里选择分块，是为了把“让出”的位置暴露给读者，而不是替所有 CPU 场景选定方案。"
        }
      ]
    },
    {
      "id": "errors",
      "title": "异步错误属于哪个调用者：异常也要沿等待关系返回",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "执行线程没有变化，不表示错误处理方式也完全相同。普通函数同步 throw，调用者当前的 try/catch 可以直接捕获；async 函数内部 throw 会使返回的 Promise 拒绝。若调用者只启动它、不等待也不附加拒绝处理，外层同步 try/catch 并没有承担这次失败。服务里出现“已经返回成功，随后报未处理拒绝”，常常就是等待关系断开了。"
        },
        {
          "type": "code",
          "code": "async function parse(text) { return JSON.parse(text); }\nconst pending = parse('{');\nconsole.log('caller continued');\ntry { await pending; }\ncatch (error) { console.log(`caught ${error.name}`); }",
          "language": "js",
          "filename": "examples/node-execution-model/errors.mjs",
          "purpose": "完整失败实验。parse 在函数内部立即抛出语法错误，但调用者先得到拒绝的 Promise，再通过 await 捕获它。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "实际输出先是 caller continued，再是 caught SyntaxError。这不是说 JSON.parse 在后台执行了：它已经在调用过程中运行并失败，只是 async 把异常转换成了 Promise 的拒绝。你应分别追踪“代码在哪个线程执行”和“失败通过哪个值传播”，两个问题可以同时有不同层次的答案。"
        },
        {
          "type": "paragraph",
          "text": "把多个工作交给 Promise.all 时，它的结果可以在某个任务失败后提前拒绝，已经启动的其他任务却不会因此自动取消。需要整体失败即停时，要让这些任务共用明确的取消控制，并在收尾阶段等待必要清理；需要收集所有结果时再考虑 allSettled。Promise 组合器组织结果，资源所有者负责停止工作。"
        },
        {
          "type": "paragraph",
          "text": "回调接口也有自己的错误约定，例如 error-first callback 或 EventEmitter 的 error 事件，不能假设在注册监听的那一层 try/catch 会捕获未来回调抛出的异常。接入一个新库时，先查它如何报告失败、支持什么取消，以及成功或失败后谁关闭资源。这比在最外层加一个 catch 后继续当作什么也没发生更能维持程序状态。"
        },
        {
          "type": "paragraph",
          "text": "本例没有启动一个无限增长的并发数组。即使每个 Promise 都能正确拒绝，一次建立几十万个任务，也已经创建了大量闭包、输入和外部请求。异步模型让等待可以重叠，不能证明容量无限。下一章先整理模块与输入边界，HTTP 章节再用“满额立即拒绝”建立最小容量约束，输出服务进一步处理背压。"
        }
      ]
    },
    {
      "id": "lifetime",
      "title": "Promise、连接和计时器：进程究竟在等什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "进程生命周期与 Promise 状态不是一回事。一个永远 pending 的普通 Promise，如果没有计时器、I/O 或其他需要继续维持进程的工作，不会单独让进程一直活着。示例在独立子进程里创建这种 Promise，随后打印 returned；测试要求子进程正常退出，并设置三秒的外部时限，避免一旦判断错了就把整个测试挂住。"
        },
        {
          "type": "code",
          "code": "node -e 'new Promise(() => {}); console.log(\"returned\")'\nnode -e 'setTimeout(() => console.log(\"late\"), 60000).unref(); console.log(\"returned\")'\n# 两次都只输出 returned，随后退出",
          "language": "sh",
          "filename": "终端 · 进程保活实验",
          "purpose": "使用子进程观察退出；unref 取消的是此句柄对保活的要求，不是删除或立刻执行计时器。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "第二条命令仍注册了计时器，但 unref 允许进程在只剩这类工作时退出。所以它不是可靠任务的持久化方案：进程退出后，内存里的回调就没有了。需要必须完成的工作，应由受控停机等待、持久化任务或其他明确机制保证；不要通过随意加一个长计时器掩盖资源清理错误。"
        },
        {
          "type": "paragraph",
          "text": "服务进程长期不退出时，沿资源生命周期查：有没有还在 listen 的 server、未关闭的客户端连接、未释放的 interval、尚未结束的子进程？退出过早则反过来检查：所谓“后台任务”是否只有一个没有外部操作的 Promise，或重要句柄是否被 unref。诊断时先确定是谁拥有资源、在哪个 finally 关闭，再决定是否需要额外观测。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "运行、核对，以及下一章要补上的工程边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/node-execution-model\nnvm use\nnpm ci\nnpm start\nnpm test",
          "language": "sh",
          "filename": "终端 · 从干净依赖状态执行",
          "purpose": "独立 ZIP 解压后直接进入目录。没有 nvm 时使用已安装的 Node 22.12.0。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本机 Node 22.12.0、macOS 14.5 x64 已执行，8 项测试全部通过：同步计算顺序、CJS/ESM 检查点、I/O 内 immediate、普通 pending Promise 的退出、unref 计时器、分块结果和非法规模、分块取消、异步错误传播。测试内部的子进程都有超时；没有把“过了多少毫秒”当作吞吐或延迟收益。"
        },
        {
          "type": "paragraph",
          "text": "试着遮住输出再判断：把 cpuInAsync 改名为 backgroundWork，循环会不会移到后台？不会，名称与 async 修饰都没有创建执行线程。把 order.cjs 原样保存为 order.mjs，是否还能直接套用第一行顺序？不能，入口上下文已经改变。把 count 放大到无上限是否只影响用户自己的等待？也不是，CPU 与在途任务会竞争整个进程的资源。"
        },
        {
          "type": "paragraph",
          "text": "到这里，你已经能把执行、等待、调度与保活分开解释。下一篇把这种运行模型落实到模块工程：源文件是 TS，产物由哪个加载器处理，模块路径何时检查，网络输入为什么仍需要运行时校验。再下一篇才进入 HTTP 请求的开始、取消、错误和停机。配套图形已检查桌面和手机视口；这不代替原生设备验证。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Node 22.12.0 timers",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/timers.html"
    },
    {
      "title": "Node 官方：不要阻塞事件循环",
      "url": "https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop"
    },
    {
      "title": "Node 22.12.0 process",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/process.html"
    }
  ]
};
export default article;
