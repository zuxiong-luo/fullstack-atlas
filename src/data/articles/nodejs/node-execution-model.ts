import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "node-execution-model",
  "topic": "nodejs",
  "title": "Node.js 执行模型：进程、事件循环与异步 I/O",
  "description": "从 V8、Node 原生绑定、libuv 到操作系统串起运行时；跟踪真实文件读取与 loopback HTTP，再解释检查点、CPU 阻塞和退出。",
  "minutes": 58,
  "labMinutes": 35,
  "tags": [
    "Node.js",
    "事件循环",
    "libuv",
    "微任务",
    "异步 I/O",
    "AbortSignal"
  ],
  "scope": "Node.js 22.12.0 单进程的 V8/原生绑定/libuv/OS 协作、文件与数值地址 TCP 请求、检查点、合作式取消与退出；固定 Unix 源码并单列平台边界，不凭 JS 日志冒称内核级追踪。",
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
  "verifiedAt": "2026-10-25",
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
      "id": "runtime-layers",
      "title": "V8、原生绑定、libuv 和操作系统：一条调用穿过哪些层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "V8 负责解析、执行与优化 JavaScript，管理 JavaScript 堆，并提供 Promise 微任务的执行机制。它不因为能执行 await，就知道某个文件放在哪块磁盘。Node 在 V8 之上安装 fs、net、http、process 等宿主接口。原生绑定是 JavaScript 与 Node 的 C++ 实现之间的入口；libuv 再提供事件循环、跨平台 I/O 与工作池等设施。操作系统最终拥有文件描述符、socket、线程和调度器。先把这四层分清，后面的“异步”才有具体的执行者。"
        },
        {
          "type": "paragraph",
          "text": "以 readFile(path, callback) 为例，先在当前 JavaScript 调用栈中校验输入、创建上下文、向原生绑定提交请求，再把执行机会交回调用者。底层读文件取得结果后，Node 才在所属执行环境中继续调用 JavaScript。文件读操作的实际执行、完成通知的排队、JavaScript 回调真正开始，是三个时刻。最后一个时刻仍会被一段未返回的同步 JavaScript 拖后。"
        },
        {
          "type": "figure",
          "src": "figures/node-execution-model/layers.svg",
          "title": "同一个请求经过的层次与两条 I/O 路径",
          "alt": "顶部是 V8 执行 JavaScript，向下经 Node 原生绑定进入 libuv；文件路径经工作池，数字地址 TCP 经非阻塞 socket 与 OS 就绪通知，完成后回到 JS。",
          "caption": "这是 macOS 本例职责图，不表示实际线程数量；Linux 的文件 I/O 可能经过版本和配置相关的 io_uring 分支。"
        },
        {
          "type": "paragraph",
          "text": "HTTP 又多了一层协议解释：node:http 处理请求行、响应头和消息体，node:net 提供 TCP 连接与字节流。网络等待通常利用非阻塞 socket 与系统事件通知，macOS 对应 kqueue 一类设施，Linux 通常是 epoll。不能把 TCP 等待想成一个 libuv 工作线程一直坐在那里等数据。这里使用 127.0.0.1，刻意排除名称解析；若改为域名，dns.lookup 可能再引入操作系统 getaddrinfo 与工作池，dns.resolve 系列又有不同的实现路径。"
        },
        {
          "type": "paragraph",
          "text": "V8 还有 GC 等后台线程，libuv 有工作池，应用可以再建 Worker。这些线程与普通业务回调的执行位置要分别讨论。V8 优化一段函数不意味着 Node 自动把它分散到多个核心；大量 Promise 也只建立继续执行关系。下一节先用源码看清文件路径，再运行真正的调用来验证可以观察到的边界。"
        }
      ]
    },
    {
      "id": "file-native-path",
      "title": "跟踪 fs.readFile：上下文怎样一直带到读结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本文使用 callback 版 fs.readFile，而不是 fs/promises，目的是把 FSReqCallback 与完成函数直接对应起来。传入路径、编码 utf8 和回调后，下面的完整 readFile 函数建立 ReadFileContext。普通路径分支创建 FSReqCallback，把上下文挂到 req.context，把完成入口设为 readFileAfterOpen，然后 binding.open。已传入文件描述符的 isUserFd 分支有不同的所有权和检查点；不能裁掉这一分支，再声称所有 readFile 都自行打开并关闭文件。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-execution-model/source-fragments/node-readFile.js",
          "code": "function readFile(path, options, callback) {\n  callback ||= options;\n  validateFunction(callback, 'cb');\n  options = getOptions(options, { flag: 'r' });\n  const ReadFileContext = require('internal/fs/read/context');\n  const context = new ReadFileContext(callback, options.encoding);\n  context.isUserFd = isFd(path); // File descriptor ownership\n\n  if (options.signal) {\n    context.signal = options.signal;\n  }\n  if (context.isUserFd) {\n    process.nextTick(function tick(context) {\n      ReflectApply(readFileAfterOpen, { context }, [null, path]);\n    }, context);\n    return;\n  }\n\n  if (checkAborted(options.signal, callback))\n    return;\n\n  const flagsNumber = stringToFlags(options.flag, 'options.flag');\n  const req = new FSReqCallback();\n  req.context = context;\n  req.oncomplete = readFileAfterOpen;\n  binding.open(getValidatedPath(path), flagsNumber, 0o666, req);\n}",
          "purpose": "Node.js v22.12.0 原源码连续节选：lib/fs.js:362–388。这里只完成打开请求的提交；函数返回不表示文件已读完。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · lib/fs.js",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/lib/fs.js#L362-L388",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "paragraph",
          "text": "先把打开和读取之间的接力展示完整。readFileAfterOpen 拿到错误时直接回调；成功则保存 fd 并提交 fstat。readFileAfterStat 再按普通文件大小分配缓冲，过大或分配失败进入 close，正常调用 context.read。输入 fixture.txt 是普通小文件，所以 size 非零，走一次有限缓冲路径。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-execution-model/source-fragments/node-open-stat.js",
          "code": "function readFileAfterOpen(err, fd) {\n  const context = this.context;\n\n  if (err) {\n    context.callback(err);\n    return;\n  }\n\n  context.fd = fd;\n\n  const req = new FSReqCallback();\n  req.oncomplete = readFileAfterStat;\n  req.context = context;\n  binding.fstat(fd, false, req);\n}\n\nfunction readFileAfterStat(err, stats) {\n  const context = this.context;\n\n  if (err)\n    return context.close(err);\n\n  // TODO(BridgeAR): Check if allocating a smaller chunk is better performance\n  // wise, similar to the promise based version (less peak memory and chunked\n  // stringify operations vs multiple C++/JS boundary crossings).\n  const size = context.size = isFileType(stats, S_IFREG) ? stats[8] : 0;\n\n  if (size > kIoMaxLength) {\n    err = new ERR_FS_FILE_TOO_LARGE(size);\n    return context.close(err);\n  }\n\n  try {\n    if (size === 0) {\n      // TODO(BridgeAR): If an encoding is set, use the StringDecoder to concat\n      // the result and reuse the buffer instead of allocating a new one.\n      context.buffers = [];\n    } else {\n      context.buffer = Buffer.allocUnsafeSlow(size);\n    }\n  } catch (err) {\n    return context.close(err);\n  }\n  context.read();\n}",
          "kind": "excerpt",
          "purpose": "Node.js v22.12.0 lib/fs.js:294–338 连续原文。完整打开/状态完成函数；保留大小上限与分配失败分支。 依赖Node内部上下文，不可独立运行；MIT归属在THIRD_PARTY_NOTICES.txt。"
        },
        {
          "type": "reference",
          "title": "源码出处 · lib/fs.js",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/lib/fs.js#L294-L338",
          "note": "正文已给出关键实现；固定tag、连续行号与原文保留在下载包。"
        },
        {
          "type": "paragraph",
          "text": "打开完成后，内部 readFileAfterOpen / readFileAfterStat 取得描述符、大小并准备缓冲，再进入上下文的 read 方法。下面保留 read 中的取消检查、按剩余大小决定本块长度，以及为当前读操作设置 readFileAfterRead。this.pos 随读完成前进；大文件会分块继续读，末尾才收束输出和关闭。readFile 是读完整文件的上层编排，不是一次 uv_fs_read 就永远能拿到全部内容。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-execution-model/source-fragments/node-context-read.js",
          "code": "  read() {\n    let buffer;\n    let offset;\n    let length;\n\n    if (this.signal?.aborted) {\n      return this.close(\n        new AbortError(undefined, { cause: this.signal.reason }));\n    }\n    if (this.size === 0) {\n      buffer = Buffer.allocUnsafeSlow(kReadFileUnknownBufferLength);\n      offset = 0;\n      length = kReadFileUnknownBufferLength;\n      this.buffer = buffer;\n    } else {\n      buffer = this.buffer;\n      offset = this.pos;\n      length = MathMin(kReadFileBufferLength, this.size - this.pos);\n    }\n\n    const req = new FSReqCallback();\n    req.oncomplete = readFileAfterRead;\n    req.context = this;\n\n    read(this.fd, buffer, offset, length, -1, req);\n  }",
          "purpose": "Node.js v22.12.0 原源码连续节选：lib/internal/fs/read/context.js:85–110。本段从 read 方法开始到提交 read 调用，方法闭合括号属于紧随其后的原文件。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · lib/internal/fs/read/context.js",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/lib/internal/fs/read/context.js#L85-L110",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "paragraph",
          "text": "读完成后也不凭一句“然后调用回调”跳过去。readFileAfterRead 增加 context.pos，达到 size 或读到0就 close，否则继续 read。描述符关闭完成后，readFileAfterClose 汇总错误、按实际位置裁剪或拼接缓冲，按 encoding 转换，最后 callback(null, buffer)。这样输入 notes 到 utf8 字符串输出的主路径在正文内可以走通；其中 close 方法负责按照描述符所有权安排关闭，传入现成 fd 的所有权规则不能和路径读取混用。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-execution-model/source-fragments/node-read-close.js",
          "code": "function readFileAfterRead(err, bytesRead) {\n  const context = this.context;\n\n  if (err)\n    return context.close(err);\n\n  context.pos += bytesRead;\n\n  if (context.pos === context.size || bytesRead === 0) {\n    context.close();\n  } else {\n    if (context.size === 0) {\n      // Unknown size, just read until we don't get bytes.\n      const buffer = bytesRead === kReadFileUnknownBufferLength ?\n        context.buffer : context.buffer.slice(0, bytesRead);\n      ArrayPrototypePush(context.buffers, buffer);\n    }\n    context.read();\n  }\n}\n\nfunction readFileAfterClose(err) {\n  const context = this.context;\n  const callback = context.callback;\n  let buffer = null;\n\n  if (context.err || err)\n    return callback(aggregateTwoErrors(err, context.err));\n\n  try {\n    if (context.size === 0)\n      buffer = Buffer.concat(context.buffers, context.pos);\n    else if (context.pos < context.size)\n      buffer = context.buffer.slice(0, context.pos);\n    else\n      buffer = context.buffer;\n\n    if (context.encoding)\n      buffer = buffer.toString(context.encoding);\n  } catch (err) {\n    return callback(err);\n  }\n\n  callback(null, buffer);\n}",
          "kind": "excerpt",
          "purpose": "Node.js v22.12.0 lib/internal/fs/read/context.js:25–69 连续原文。完整读完成与关闭完成函数；保留错误聚合与编码异常分支。 依赖Node内部上下文，不可独立运行；MIT归属在THIRD_PARTY_NOTICES.txt。"
        },
        {
          "type": "reference",
          "title": "源码出处 · lib/internal/fs/read/context.js",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/lib/internal/fs/read/context.js#L25-L69",
          "note": "正文已给出关键实现；固定tag、连续行号与原文保留在下载包。"
        },
        {
          "type": "paragraph",
          "text": "这个 read 是绑定暴露的读取入口。C++ 分支通过参数个数区分带请求对象的异步方式与同步方式：当前案例 argc > 5，因此把 fd、缓冲区、偏移和长度交给 AsyncCall，再调用 uv_fs_read。这里只节选异步分支，不以这段代码解释同步分支的全部异常处理。"
        },
        {
          "type": "code",
          "language": "cpp",
          "filename": "examples/node-execution-model/source-fragments/node-file-binding.cc",
          "code": "\n  char* buf = buffer_data + off;\n  uv_buf_t uvbuf = uv_buf_init(buf, len);\n\n  if (argc > 5) {  // read(fd, buffer, offset, len, pos, req)\n    FSReqBase* req_wrap_async = GetReqWrap(args, 5);\n    CHECK_NOT_NULL(req_wrap_async);\n    FS_ASYNC_TRACE_BEGIN0(UV_FS_READ, req_wrap_async)\n    AsyncCall(env, req_wrap_async, args, \"read\", UTF8, AfterInteger,\n              uv_fs_read, fd, &uvbuf, 1, pos);\n  } else {  // read(fd, buffer, offset, len, pos)",
          "purpose": "Node.js v22.12.0 原源码连续节选：src/node_file.cc:2515–2525。异步分支把完成处理器 AfterInteger 与本次请求关联。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · src/node_file.cc",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/src/node_file.cc#L2515-L2525",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "paragraph",
          "text": "到 libuv 的 Unix 实现，在本机 macOS 的通用工作路径里，POST 宏看到 cb 非空，就注册请求并通过 uv__work_submit 把 uv__fs_work 放入工作池，完成端是 uv__fs_done；cb 为空时才在当前调用路径直接执行 uv__fs_work。读操作最终使用系统文件读取能力。等待期间 JavaScript 主线程可以接着做别的短工作；工作池忙时，读文件自身也要排队。"
        },
        {
          "type": "code",
          "language": "c",
          "filename": "examples/node-execution-model/source-fragments/uv-fs-post.c",
          "code": "#define POST                                                                  \\\n  do {                                                                        \\\n    if (cb != NULL) {                                                         \\\n      uv__req_register(loop);                                                 \\\n      uv__work_submit(loop,                                                   \\\n                      &req->work_req,                                         \\\n                      UV__WORK_FAST_IO,                                       \\\n                      uv__fs_work,                                            \\\n                      uv__fs_done);                                           \\\n      return 0;                                                               \\\n    }                                                                         \\\n    else {                                                                    \\\n      uv__fs_work(&req->work_req);                                            \\\n      return req->result;                                                     \\\n    }                                                                         \\\n  }                                                                           \\\n  while (0)",
          "purpose": "Node.js v22.12.0 原源码连续节选：deps/uv/src/unix/fs.c:139–155。这是工作池通用路径，不包含调用它之前的系统专属快速路径。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · deps/uv/src/unix/fs.c",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/deps/uv/src/unix/fs.c#L139-L155",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "paragraph",
          "text": "平台边界必须放在这里：同版本 uv_fs_read 在到达 POST 之前会尝试 uv__iou_fs_read_or_write。该分支涉及 Linux 的 io_uring 配置与运行条件，本机没有验证它。上面的 macOS 结论有固定源码和本机环境支撑，但不能扩展成“任何系统的每次异步文件读取都一定占一个池线程”。性能篇会在本机用受控 PBKDF2 排队验证工作池竞争，不把资源名称当成底层线程探针。"
        }
      ]
    },
    {
      "id": "network-native-path",
      "title": "跟踪数值地址 TCP：连接等待怎样回到 JavaScript",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在把输入换成 http.get({host:\"127.0.0.1\", port, agent:false})。http 客户端建立本例自己的连接；net 层知道这是 IPv4 地址，创建 TCPConnectWrap 并设置 afterConnect，然后调用底层 handle.connect。agent:false 避免复用另一次实验已经存在的连接，端口使用 listen(0) 随机分配，不碰用户服务。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-execution-model/source-fragments/node-net-connect.js",
          "code": "  if (addressType === 6 || addressType === 4) {\n    const req = new TCPConnectWrap();\n    req.oncomplete = afterConnect;\n    req.address = address;\n    req.port = port;\n    req.localAddress = localAddress;\n    req.localPort = localPort;\n    req.addressType = addressType;\n\n    if (addressType === 4)\n      err = self._handle.connect(req, address, port);\n    else\n      err = self._handle.connect6(req, address, port);\n  } else {",
          "purpose": "Node.js v22.12.0 原源码连续节选：lib/net.js:1075–1088。保留 IPv4/IPv6 分支，本例走 addressType === 4。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · lib/net.js",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/lib/net.js#L1075-L1088",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "paragraph",
          "text": "C++ TCPWrap 把地址转成原生结构后，将连接请求交给 uv_tcp_connect，并绑定完成处理器 AfterConnect。Dispatch 返回错误要清理请求包装；成功提交也不表示 JavaScript 的 response 回调已经可运行，因为连接建立之后还要发送 HTTP、等待服务响应并解析消息。"
        },
        {
          "type": "code",
          "language": "cpp",
          "filename": "examples/node-execution-model/source-fragments/node-tcp-binding.cc",
          "code": "\n  if (err == 0) {\n    AsyncHooks::DefaultTriggerAsyncIdScope trigger_scope(wrap);\n    ConnectWrap* req_wrap =\n        new ConnectWrap(env, req_wrap_obj, AsyncWrap::PROVIDER_TCPCONNECTWRAP);\n    err = req_wrap->Dispatch(uv_tcp_connect,\n                             &wrap->handle_,\n                             reinterpret_cast<const sockaddr*>(&addr),\n                             AfterConnect);\n    if (err) {\n      delete req_wrap;\n    } else {",
          "purpose": "Node.js v22.12.0 原源码连续节选：src/tcp_wrap.cc:332–343。此连续节选包含提交与错误/成功分支开头；后续原文件还有追踪与状态记录，不在这里展开。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · src/tcp_wrap.cc",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/src/tcp_wrap.cc#L332-L343",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "paragraph",
          "text": "再看 libuv：非阻塞 connect 可能返回 EINPROGRESS，这表示连接尚在进行，代码没有把它当最终失败。其他错误按分支返回或延期报告。之后把 req 关联到 handle，并监听 POLLOUT，就绪后才继续连接完成处理。POLLOUT 在这里是连接完成检查所需的事件兴趣，不等于已经收到完整 HTTP 响应。"
        },
        {
          "type": "code",
          "language": "c",
          "filename": "examples/node-execution-model/source-fragments/uv-tcp-connect.c",
          "code": "  do {\n    errno = 0;\n    r = connect(uv__stream_fd(handle), addr, addrlen);\n  } while (r == -1 && errno == EINTR);\n\n  /* We not only check the return value, but also check the errno != 0.\n   * Because in rare cases connect() will return -1 but the errno\n   * is 0 (for example, on Android 4.3, OnePlus phone A0001_12_150227)\n   * and actually the tcp three-way handshake is completed.\n   */\n  if (r == -1 && errno != 0) {\n    if (errno == EINPROGRESS)\n      ; /* not an error */\n    else if (errno == ECONNREFUSED\n#if defined(__OpenBSD__)\n      || errno == EINVAL\n#endif\n      )\n    /* If we get ECONNREFUSED (Solaris) or EINVAL (OpenBSD) wait until the\n     * next tick to report the error. Solaris and OpenBSD wants to report\n     * immediately -- other unixes want to wait.\n     */\n      handle->delayed_error = UV__ERR(ECONNREFUSED);\n    else\n      return UV__ERR(errno);\n  }",
          "purpose": "Node.js v22.12.0 原源码连续节选：deps/uv/src/unix/tcp.c:308–333。这段是真实错误分支，不能删掉 EINPROGRESS 后只说“调用 connect 就完成连接”。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · deps/uv/src/unix/tcp.c",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/deps/uv/src/unix/tcp.c#L308-L333",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "code",
          "language": "c",
          "filename": "examples/node-execution-model/source-fragments/uv-tcp-watch.c",
          "code": "  uv__req_init(handle->loop, req, UV_CONNECT);\n  req->cb = cb;\n  req->handle = (uv_stream_t*) handle;\n  uv__queue_init(&req->queue);\n  handle->connect_req = req;\n\n  uv__io_start(handle->loop, &handle->io_watcher, POLLOUT);",
          "purpose": "Node.js v22.12.0 原源码连续节选：deps/uv/src/unix/tcp.c:337–344。后续通过事件循环的就绪通知继续推进。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · deps/uv/src/unix/tcp.c",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/deps/uv/src/unix/tcp.c#L337-L344",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
        },
        {
          "type": "paragraph",
          "text": "整个网络等待没有调用上面文件路径的 uv__work_submit。我们能据固定源码解释职责分工，却没有通过本篇 JS 程序记录 kqueue 的每个内核事件；网络 ready、HTTP 消息完成和用户回调之间仍有 Node 内部处理。需要内核级时间线时，下一步应在对应 OS 的受控环境加入系统追踪，而不是给 async_hooks 日志补上猜出来的纳秒。"
        }
      ]
    },
    {
      "id": "real-io-trace",
      "title": "真实调用记录：哪些是观察，哪些来自源码推导",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "完整实验先读取固定文本 notes，完成后才启动自己的 loopback HTTP 服务并发起请求。先后安排是为了让每条记录有明确归属，不用于证明“文件永远比网络快”。async_hooks 只收集目标资源类型，不在 hook 内调用 console，避免日志本身再触发异步资源而递归。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-execution-model/io-trace.mjs",
          "code": "import { createHook } from 'node:async_hooks';\nimport { readFile } from 'node:fs';\nimport { createServer, get } from 'node:http';\nimport { pathToFileURL } from 'node:url';\n// async_hooks observes Node resources, not kernel scheduling or pool thread IDs.\nexport async function traceIO({file=new URL('./fixture.txt',import.meta.url)}={}) {\n  const resources = [], events = [];\n  const hook = createHook({ init(_id, type) {\n    if (['FSREQCALLBACK','TCPWRAP','TCPCONNECTWRAP','HTTPCLIENTREQUEST'].includes(type)) resources.push(type);\n  }});\n  const sockets = new Set();\n  const server = createServer((_req, res) => { events.push('server:request'); res.end('notes'); });\n  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });\n  hook.enable();\n  try {\n    events.push('file:submit');\n    const text = await new Promise((resolve, reject) => readFile(file, 'utf8', (error, value) => {\n      events.push('file:callback'); error ? reject(error) : resolve(value.trim());\n    }));\n    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });\n    events.push('http:submit');\n    const body = await new Promise((resolve, reject) => {\n      const request = get({host:'127.0.0.1', port:server.address().port, path:'/', agent:false}, response => {\n        events.push('http:response'); let value=''; response.setEncoding('utf8');\n        response.on('data', part => value += part); response.once('end', () => { events.push('http:end'); resolve(value); }); response.once('error', reject);\n      });\n      request.setTimeout(2000, () => request.destroy(new Error('LOCAL_HTTP_TIMEOUT'))); request.once('error', reject);\n    });\n    return {text, body, events, resources:[...new Set(resources)]};\n  } finally { hook.disable(); for (const socket of sockets) socket.destroy(); if (server.listening) await new Promise(resolve => server.close(resolve)); }\n}\nif (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) console.log(JSON.stringify(await traceIO()));",
          "purpose": "完整真实 I/O 实验；资源、socket、服务都有本地所有者，finally 关闭。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "text",
          "filename": "终端 · 2026-10-25 Node 22.12.0 实测",
          "code": "node io-trace.mjs\n{\"text\":\"notes\",\"body\":\"notes\",\"events\":[\"file:submit\",\"file:callback\",\"http:submit\",\"server:request\",\"http:response\",\"http:end\"],\"resources\":[\"FSREQCALLBACK\",\"TCPWRAP\",\"TCPCONNECTWRAP\",\"HTTPCLIENTREQUEST\"]}",
          "purpose": "只断言固定输入、业务先后与这些资源存在；不据事件名称推算工作线程 ID。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "直接观察有四件事：文件和 HTTP 都实际返回 notes；file:callback 在 file:submit 之后；服务先收到请求，客户端随后收到响应和结束；运行时为这次调用建立了相应的 FS、TCP 和 HTTP 资源。由源码推导的部分是：这些 Node 请求包装怎样交给 libuv，文件通用路径和网络就绪路径为什么不同。FSREQCALLBACK 不是“某个特定 OS 线程”，TCPWRAP 也不是“HTTP 完成”。"
        },
        {
          "type": "paragraph",
          "text": "网络连接和工作池都可能完成了底层工作，但若主线程还卡在同步计算，用户回调仍只能等待。下文原有 async CPU 实验、CJS/ESM 检查点和分块取消会逐个验证这一层，避免把 I/O 的异步与业务代码的并行混为一谈。"
        },
        {
          "type": "paragraph",
          "text": "失败输入也实际跑：把 file 传为示例目录内确定不存在的 absent-controlled-fixture.txt，打开回调以 ENOENT 拒绝，HTTP 服务尚未 listen，finally 关闭钩子。测试同时给出错误码并正常结束，不把“发起了读取”当成成功。若你的报错是 EACCES，应检查文件权限；若返回内容不对，则先检查路径与编码，而不是直接怀疑事件循环顺序。"
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
        },
        {
          "type": "paragraph",
          "text": "固定版本的检查点实现也可以直接读：processTicksAndRejections 用 while 取出 nextTick 队列的项，执行并维护 async_hooks 上下文；这一轮队列耗尽后调用 V8 的 runMicrotasks，再视新入队项与拒绝处理重复。ESM 顶层本身的模块求值上下文解释了为何前面的入口输出不同。这段内部循环支撑“不同队列在检查点交替排空”的判断，不提供任意嵌套任务的万能总排序。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-execution-model/source-fragments/node-tick-drain.js",
          "code": "function processTicksAndRejections() {\n  let tock;\n  do {\n    while ((tock = queue.shift()) !== null) {\n      const priorContextFrame =\n        AsyncContextFrame.exchange(tock[async_context_frame]);\n\n      const asyncId = tock[async_id_symbol];\n      emitBefore(asyncId, tock[trigger_async_id_symbol], tock);\n\n      try {\n        const callback = tock.callback;\n        if (tock.args === undefined) {\n          callback();\n        } else {\n          const args = tock.args;\n          switch (args.length) {\n            case 1: callback(args[0]); break;\n            case 2: callback(args[0], args[1]); break;\n            case 3: callback(args[0], args[1], args[2]); break;\n            case 4: callback(args[0], args[1], args[2], args[3]); break;\n            default: callback(...args);\n          }\n        }\n      } finally {\n        if (destroyHooksExist())\n          emitDestroy(asyncId);\n      }\n\n      emitAfter(asyncId);\n\n      AsyncContextFrame.set(priorContextFrame);\n    }\n    runMicrotasks();\n  } while (!queue.isEmpty() || processPromiseRejections());\n  setHasTickScheduled(false);\n  setHasRejectionToWarn(false);\n}",
          "purpose": "Node.js v22.12.0 原源码连续节选：lib/internal/process/task_queues.js:72–110。完整 processTicksAndRejections 函数；内部调用依赖 Node 运行时，不是手写模拟器。 依赖内部上下文，不能单独运行；MIT 归属见下载内 THIRD_PARTY_NOTICES.txt。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "源码出处 · lib/internal/process/task_queues.js",
          "url": "https://github.com/nodejs/node/blob/v22.12.0/lib/internal/process/task_queues.js#L72-L110",
          "note": "固定 tag；上面的正文已展示决定当前结论的代码。"
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
          "text": "本机 Node 22.12.0、macOS 14.5 x64 已执行，10 项测试全部通过：同步计算顺序、CJS/ESM 检查点、I/O 内 immediate、普通 pending Promise 的退出、unref 计时器、分块结果和非法规模、分块取消、异步错误传播。测试内部的子进程都有超时；没有把“过了多少毫秒”当作吞吐或延迟收益。"
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
