import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "ai-streaming-delivery",
  "topic": "ai",
  "title": "流式 AI 交互：SSE 事件、断线重连和取消",
  "description": "用 Node.js 与 React 做一个能运行的流式页面，区分任务与连接，逐步实现事件编号、游标续接、重复去除、用户取消和资源上限。",
  "scope": "本地 Node.js 22 + React 18 示例，默认确定性文本生成器。验证真实 HTTP/SSE 与前端状态处理；事件存在内存，不声称重启恢复、真实模型首 Token 性能或生产鉴权已完成。",
  "minutes": 60,
  "labMinutes": 40,
  "prerequisites": [
    "理解 HTTP 请求、Promise 和基础 React State/Effect",
    "建议先读工作流篇，理解任务状态与连接状态的区别"
  ],
  "sections": [
    {
      "id": "concept",
      "title": "流式响应是什么，SSE 又解决哪一层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "流式响应是服务端在结果尚未全部产生时，就把已经可用的部分逐步发给客户端。SSE 是基于 HTTP 的一种文本事件流格式：服务端保持响应，按规定格式持续发送事件，浏览器可以使用 EventSource 接收。它解决传输和订阅问题，不替你判断模型结果是否正确，也不自动保存后台任务。"
        },
        {
          "type": "paragraph",
          "text": "用户看到“文字逐步出现”时，背后至少有三层对象：生成答案的任务、传递事件的连接，以及把事件变成界面的前端状态。如果把三者当成同一个对象，刷新页面可能重复创建任务，点停止也可能只是关闭浏览器连接，服务端仍在持续调用模型。"
        },
        {
          "type": "paragraph",
          "text": "我们给上一章的内部知识助手补一个独立交互实验。后端先创建任务，生成器逐段输出，浏览器订阅事件。为了让你能实际观察暂停与继续，生成器人为设置每段间隔 400ms，总共五段。它不调用模型，片段不等于模型 Token，这个间隔也不是测量出的首 Token 延迟。"
        },
        {
          "type": "table",
          "headers": [
            "选择",
            "适用条件",
            "需要额外处理什么"
          ],
          "rows": [
            [
              "普通 JSON 响应",
              "结果很短或要一次展示",
              "等待期间的状态提示"
            ],
            [
              "SSE / EventSource",
              "主要是服务端向浏览器推送文本事件",
              "断线续接、身份、终态关闭"
            ],
            [
              "fetch 读取响应流",
              "需要 POST 或自定义认证头",
              "自己解析分块、事件和重连"
            ],
            [
              "WebSocket",
              "需要双向高频互动或特定协议",
              "连接状态、背压、鉴权和恢复"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "不要因为一个项目出现 WebSocket 就认定它更高级。先看是否真的需要双向长连接；如果取消和创建都是普通 HTTP 操作，单向 SSE 已经能够清楚表达这篇的职责划分。供应商向后端发送什么流式协议，与后端向浏览器选择什么协议，也可以独立设计。"
        }
      ]
    },
    {
      "id": "events",
      "title": "事件要表达事实，而不只是往页面 append 字符串",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "事件是执行过程中已经发生的事实。本例使用 started、delta、completed、cancelled、failed 五种类型。started 表示任务已接受，delta 携带新增展示文本，后三种是互斥终态。每个任务内的事件 ID 从 1 严格递增，任务 ID 则区分不同请求。"
        },
        {
          "type": "figure",
          "src": "figures/ai-course/streaming.svg",
          "title": "任务生命周期与订阅连接分开",
          "alt": "POST runs 创建一次后台任务；GET events 按事件 ID 订阅；暂停只关闭订阅；继续使用游标；取消由独立 POST 触发后台 AbortController。",
          "caption": "同一个任务可以多次连接。图中的重连不会再次调用创建任务接口，也不会重新从头生成。 手机端可在图形区域横向滑动查看完整图。"
        },
        {
          "type": "paragraph",
          "text": "SSE 一条事件以空行结束，可以带 id、event 和 data。本例的 data 始终 JSON.stringify，文字中的换行成为 JSON 字符串转义，不会被解释成额外的 SSE 控制行。浏览器收到后再 JSON.parse。HTTP 网络读取的一块字节也不必恰好等于一条事件，原生 EventSource 会按协议解析。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-stream/src/client-state.mjs",
          "code": "export function applyEvent(view, event) {\n  if (!Number.isSafeInteger(event.id) || event.id <= view.lastId) return view;\n  if (event.id !== view.lastId + 1) throw new Error(\"EVENT_GAP\");\n  const status = [\"completed\", \"cancelled\", \"failed\"].includes(event.type)\n    ? event.type\n    : view.status;\n  return {\n    ...view,\n    lastId: event.id,\n    status,\n    text: view.text + (event.type === \"delta\" ? event.data.text : \"\"),\n  };\n}",
          "language": "javascript",
          "purpose": "完整前端状态归并函数：忽略重复 ID，检测缺口，只把 delta 内容拼入展示文本。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入一次序列：当前 lastId=2，收到 id=3 的 delta，追加文字并把 lastId 设为 3；若重连又收到 id=3，就原样返回，防止重复文字；收到 id=5 却没有 4 时，不猜测跳过内容，而是报 EVENT_GAP。这个承诺要求服务端提供一个任务内完整的顺序日志。以后若采用窗口淘汰，就要为旧游标定义快照恢复协议。"
        },
        {
          "type": "reference",
          "title": "WHATWG：Server-sent events",
          "url": "https://html.spec.whatwg.org/multipage/server-sent-events.html",
          "note": "事件格式、Last-Event-ID、重连和 EventSource 行为以标准为依据；任务创建、保留和取消属于本例应用协议。"
        }
      ]
    },
    {
      "id": "server",
      "title": "后端完整实现：先创建，再订阅",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面给出服务端文件全部代码，不把决定正确性的分支藏在下载链接里。先看 makeRuntime：它保存任务和有序事件，生成器接受自己的 AbortSignal，终态之后 append 不再写入。再看 createService：POST 创建、GET 订阅、POST 取消分别进入不同分支。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-stream/src/server.mjs",
          "code": "import http from \"node:http\";\nimport { randomUUID } from \"node:crypto\";\nimport { setTimeout as delay } from \"node:timers/promises\";\nimport { once } from \"node:events\";\nimport { readFile } from \"node:fs/promises\";\nimport { fileURLToPath } from \"node:url\";\n\nconst terminal = new Set([\"completed\", \"cancelled\", \"failed\"]);\nexport function makeRuntime({\n  intervalMs = 400,\n  maxActive = 4,\n  maxRuns = 16,\n  ttlMs = 600000,\n} = {}) {\n  const runs = new Map();\n  function append(run, type, data) {\n    if (terminal.has(run.status)) return;\n    run.events.push({ id: run.events.length + 1, type, data });\n    if (terminal.has(type)) run.status = type;\n  }\n  function create(question) {\n    if (\n      typeof question !== \"string\" ||\n      !question.trim() ||\n      question.length > 2000\n    )\n      throw new Error(\"INVALID_QUESTION\");\n    for (const [id, run] of runs)\n      if (terminal.has(run.status) && Date.now() - run.createdAt > ttlMs)\n        runs.delete(id);\n    if (\n      [...runs.values()].filter((r) => !terminal.has(r.status)).length >=\n        maxActive ||\n      runs.size >= maxRuns\n    )\n      throw new Error(\"CAPACITY\");\n    const run = {\n      id: randomUUID(),\n      createdAt: Date.now(),\n      status: \"running\",\n      events: [],\n      controller: new AbortController(),\n      subscribers: 0,\n    };\n    runs.set(run.id, run);\n    append(run, \"started\", { mode: \"deterministic-demo-not-model\" });\n    run.finished = (async () => {\n      try {\n        // These are text chunks, not tokenizer tokens and not paid-model measurements.\n        for (const text of [\n          \"权限申请需要\",\n          \"先由主管确认角色，\",\n          \"再向管理员提交工单。\",\n          \"审批通过后，\",\n          \"管理员才可以调整权限。\",\n        ]) {\n          await delay(intervalMs, undefined, { signal: run.controller.signal });\n          append(run, \"delta\", { text });\n        }\n        append(run, \"completed\", {\n          answer:\n            \"权限申请需要先由主管确认角色，再向管理员提交工单。审批通过后，管理员才可以调整权限。\",\n        });\n      } catch (error) {\n        append(run, run.controller.signal.aborted ? \"cancelled\" : \"failed\", {\n          code: run.controller.signal.aborted\n            ? \"USER_CANCELLED\"\n            : \"GENERATION_ERROR\",\n        });\n      }\n    })();\n    return run;\n  }\n  function cancel(id) {\n    const run = runs.get(id);\n    if (!run) throw new Error(\"NOT_FOUND\");\n    if (!terminal.has(run.status)) run.controller.abort();\n    return run;\n  }\n  return {\n    runs,\n    create,\n    cancel,\n    async close() {\n      for (const run of runs.values()) run.controller.abort();\n      await Promise.all([...runs.values()].map((r) => r.finished));\n    },\n  };\n}\nexport function frame(event) {\n  return `id: ${event.id}\\nevent: ${event.type}\\ndata: ${JSON.stringify(event.data)}\\n\\n`;\n}\nasync function jsonBody(req) {\n  const chunks = [];\n  let bytes = 0;\n  for await (const chunk of req) {\n    bytes += chunk.length;\n    if (bytes > 8192) throw new Error(\"BODY_TOO_LARGE\");\n    chunks.push(chunk);\n  }\n  return JSON.parse(Buffer.concat(chunks).toString(\"utf8\"));\n}\nexport function createService(options = {}) {\n  const runtime = makeRuntime(options);\n  const send = (res, status, data) => {\n    res.writeHead(status, {\n      \"Content-Type\": \"application/json; charset=utf-8\",\n    });\n    res.end(JSON.stringify(data));\n  };\n  const server = http.createServer(async (req, res) => {\n    try {\n      const url = new URL(req.url, \"http://127.0.0.1\");\n      const origin = req.headers.origin;\n      if (origin && origin !== `http://${req.headers.host}`)\n        return send(res, 403, { error: \"ORIGIN_DENIED\" });\n      if (req.method === \"POST\" && url.pathname === \"/runs\") {\n        if (!req.headers[\"content-type\"]?.startsWith(\"application/json\"))\n          return send(res, 415, { error: \"JSON_REQUIRED\" });\n        const { question } = await jsonBody(req);\n        const run = runtime.create(question);\n        return send(res, 201, {\n          id: run.id,\n          mode: \"deterministic-demo-not-model\",\n        });\n      }\n      const match = url.pathname.match(\n        /^\\/runs\\/([a-f0-9-]{36})\\/(events|cancel)$/,\n      );\n      if (match) {\n        const run = runtime.runs.get(match[1]);\n        if (!run) return send(res, 404, { error: \"RUN_UNKNOWN_OR_EXPIRED\" });\n        if (req.method === \"POST\" && match[2] === \"cancel\") {\n          runtime.cancel(run.id);\n          return send(res, 202, { status: run.status });\n        }\n        if (req.method === \"GET\" && match[2] === \"events\") {\n          const cursorText =\n            req.headers[\"last-event-id\"] ??\n            url.searchParams.get(\"after\") ??\n            \"0\";\n          if (!/^\\d{1,8}$/.test(cursorText))\n            return send(res, 400, { error: \"INVALID_CURSOR\" });\n          let cursor = Number(cursorText);\n          if (cursor > run.events.length)\n            return send(res, 409, { error: \"CURSOR_AHEAD\" });\n          if (run.subscribers >= 4)\n            return send(res, 429, { error: \"SUBSCRIBER_CAPACITY\" });\n          const connection = new AbortController();\n          res.on(\"close\", () => connection.abort());\n          run.subscribers++;\n          res.writeHead(200, {\n            \"Content-Type\": \"text/event-stream; charset=utf-8\",\n            \"Cache-Control\": \"no-cache, no-transform\",\n            \"X-Accel-Buffering\": \"no\",\n          });\n          res.flushHeaders();\n          const deadline = Date.now() + 25000;\n          let heartbeat = Date.now();\n          try {\n            while (!connection.signal.aborted && Date.now() < deadline) {\n              for (const event of run.events.slice(cursor)) {\n                if (!res.write(frame(event)))\n                  await once(res, \"drain\", { signal: connection.signal });\n                cursor = event.id;\n              }\n              if (terminal.has(run.status) && cursor === run.events.length)\n                break;\n              if (Date.now() - heartbeat >= 10000) {\n                res.write(\": heartbeat\\n\\n\");\n                heartbeat = Date.now();\n              }\n              await delay(20, undefined, { signal: connection.signal });\n            }\n          } catch (error) {\n            if (!connection.signal.aborted) throw error;\n          } finally {\n            run.subscribers--;\n            res.end();\n          }\n          return;\n        }\n      }\n      if (req.method === \"GET\" && [\"/\", \"/client.js\"].includes(url.pathname)) {\n        const file = url.pathname === \"/\" ? \"index.html\" : \"client.js\";\n        const body = await readFile(\n          new URL(\"../public-app/\" + file, import.meta.url),\n        );\n        res.writeHead(200, {\n          \"Content-Type\": file.endsWith(\".js\")\n            ? \"text/javascript; charset=utf-8\"\n            : \"text/html; charset=utf-8\",\n        });\n        return res.end(body);\n      }\n      send(res, 404, { error: \"NOT_FOUND\" });\n    } catch (error) {\n      if (res.headersSent) {\n        res.end();\n        return;\n      }\n      const code = error.message;\n      send(\n        res,\n        code === \"CAPACITY\" ? 429 : code === \"BODY_TOO_LARGE\" ? 413 : 400,\n        { error: code === \"CAPACITY\" ? code : \"INVALID_REQUEST\" },\n      );\n    }\n  });\n  server.requestTimeout = 15000;\n  server.headersTimeout = 10000;\n  return {\n    server,\n    runtime,\n    async close() {\n      await runtime.close();\n      server.closeAllConnections();\n      await new Promise((resolve) => server.close(resolve));\n    },\n  };\n}\nif (process.argv[1] === fileURLToPath(import.meta.url)) {\n  const service = createService();\n  service.server.listen(4190, \"127.0.0.1\", () =>\n    console.log(\"http://127.0.0.1:4190 — deterministic demo\"),\n  );\n  for (const signal of [\"SIGINT\", \"SIGTERM\"])\n    process.once(signal, () => service.close().then(() => process.exit(0)));\n}",
          "language": "javascript",
          "purpose": "完整 Node.js 服务，含本地静态文件、输入上限、任务容量、游标校验、SSE、取消与退出清理。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "POST /runs 只创建一次任务并返回 id，不把连接一直占到生成结束。GET /runs/:id/events 根据游标读已有事件，再跟随新事件。两者分开以后，断线重连只执行 GET；不会因为浏览器重新订阅，就发起第二次模型请求或第二次创建工单。"
        },
        {
          "type": "paragraph",
          "text": "Last-Event-ID 用于同一个 EventSource 的自动重连。用户主动关闭后再 new EventSource，浏览器不会替新对象记住旧游标，因此例子把最后收到的 ID 放进 after 参数。服务端优先使用 Last-Event-ID，再看 after。负数、非整数文本和超出当前末尾的游标都会被拒绝，而不是悄悄重置为零。"
        },
        {
          "type": "paragraph",
          "text": "连接最长订阅 25 秒，运行中每 10 秒发送一条 SSE 注释心跳。已完成任务如果游标已到末尾，就结束响应。浏览器收到终态时必须 close；否则 EventSource 可能把正常结束也当成需要重连的断开。代理端还要禁止缓存和聚合缓冲；X-Accel-Buffering 仅是某些代理认识的提示，不能替代你的实际代理配置与观察。"
        }
      ]
    },
    {
      "id": "react",
      "title": "React 怎么管理连接，为什么游标不能当订阅触发器",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在把事件送到界面。view 保存展示所需的 id、lastId、text 和 status；ref 中的 cursor 保存下一次连接使用的游标。Effect 由任务 ID、暂停状态和任务状态驱动，不把每个 delta 更新的 lastId 作为依赖，否则收到一段文字就可能清理并重建一次连接。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-stream/src/client.jsx",
          "code": "import React, { useEffect, useState, useRef } from \"react\";\nimport { createRoot } from \"react-dom/client\";\nimport { applyEvent } from \"./client-state.mjs\";\nfunction App() {\n  const [question, setQuestion] = useState(\"账号没有权限怎么办？\");\n  const [view, setView] = useState({\n    id: \"\",\n    lastId: 0,\n    text: \"\",\n    status: \"idle\",\n  });\n  const cursor = useRef(0);\n  const { id: runId, status } = view;\n  const [paused, setPaused] = useState(false);\n  const [error, setError] = useState(\"\");\n  const [creating, setCreating] = useState(false);\n  useEffect(() => {\n    if (\n      !runId ||\n      paused ||\n      [\"completed\", \"cancelled\", \"failed\"].includes(status)\n    )\n      return;\n    const source = new EventSource(\n      `/runs/${runId}/events?after=${cursor.current}`,\n    );\n    let lastSeen = cursor.current;\n    let disposed = false;\n    for (const type of [\"started\", \"delta\", \"completed\", \"cancelled\", \"failed\"])\n      source.addEventListener(type, (event) => {\n        if (disposed) return;\n        const message = {\n          id: Number(event.lastEventId),\n          type,\n          data: JSON.parse(event.data),\n        };\n        if (message.id <= lastSeen) return;\n        if (message.id !== lastSeen + 1) {\n          source.close();\n          setError(\"事件有缺口，请重新开始\");\n          setView((current) => ({ ...current, status: \"failed\" }));\n          return;\n        }\n        lastSeen = message.id;\n        cursor.current = message.id;\n        setView((current) =>\n          current.id === runId ? applyEvent(current, message) : current,\n        );\n        if ([\"completed\", \"cancelled\", \"failed\"].includes(type)) source.close();\n      });\n    source.onerror = () =>\n      setError(\"连接异常；临时断线会尝试续接。若本地服务已重启，请刷新页面重新创建任务。\");\n    source.onopen = () => setError(\"\");\n    return () => {\n      disposed = true;\n      source.close();\n    };\n  }, [runId, paused, status]);\n  async function start() {\n    setCreating(true);\n    setError(\"\");\n    try {\n      const response = await fetch(\"/runs\", {\n        method: \"POST\",\n        headers: { \"Content-Type\": \"application/json\" },\n        body: JSON.stringify({ question }),\n      });\n      if (!response.ok) throw new Error(\"创建失败：\" + response.status);\n      const { id } = await response.json();\n      cursor.current = 0;\n      setPaused(false);\n      setView({ id, lastId: 0, text: \"\", status: \"running\" });\n    } catch (error) {\n      setError(error.message);\n    } finally {\n      setCreating(false);\n    }\n  }\n  async function cancel() {\n    try {\n      const response = await fetch(`/runs/${view.id}/cancel`, {\n        method: \"POST\",\n      });\n      if (!response.ok) throw new Error(\"取消失败\");\n      setPaused(false);\n    } catch (error) {\n      setError(error.message);\n    }\n  }\n  return (\n    <main>\n      <h1>内部知识助手 · 流式交互实验</h1>\n      <p>本地确定性文本生成器，不调用真实模型。</p>\n      <label htmlFor=\"question\">问题</label>\n      <textarea\n        id=\"question\"\n        value={question}\n        maxLength={2000}\n        onChange={(e) => setQuestion(e.target.value)}\n      />\n      <div className=\"actions\">\n        <button\n          disabled={creating || view.status === \"running\"}\n          onClick={start}\n        >\n          开始\n        </button>\n        <button\n          disabled={view.status !== \"running\"}\n          onClick={() => setPaused((p) => !p)}\n        >\n          {paused ? \"继续接收\" : \"暂停接收\"}\n        </button>\n        <button disabled={view.status !== \"running\"} onClick={cancel}>\n          取消任务\n        </button>\n      </div>\n      <p role=\"status\">\n        状态：{view.status} · 已接收事件：{view.lastId}\n        {paused ? \" · 接收已暂停\" : \"\"}\n      </p>\n      <output>{view.text || \"等待输出…\"}</output>\n      <p role=\"alert\">{error}</p>\n      <p>\n        暂停只关闭订阅，后台继续。取消会向后台发出取消请求。本例事件仅保留在进程内，重启不恢复。\n      </p>\n    </main>\n  );\n}\ncreateRoot(document.getElementById(\"root\")).render(<App />);",
          "language": "jsx",
          "purpose": "完整 React 页面：创建任务、订阅与清理、游标更新、暂停续接、终态关闭和取消。样式放在同项目 index.html。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "连接建立时读取 cursor.current，收到连续事件后同步更新它，再通过函数式 setView 合并展示状态。这样处理的是同一条连接的事件序列，不需要等 React 完成下一次渲染才知道刚刚接到哪个 ID。切换任务时将 cursor 重置为 0，防止把上一个任务的游标用于新任务。"
        },
        {
          "type": "paragraph",
          "text": "Effect 的清理函数关闭旧 EventSource，并标记 disposed。任务切换、暂停或组件卸载时，旧连接不能继续往当前界面写内容。函数式 setView 还会检查任务 ID，避免一个旧闭包把新任务的文字拼坏。不要把关闭连接放到“读者自行补充”的角落，它和建立连接是同一项资源生命周期责任。"
        },
        {
          "type": "paragraph",
          "text": "这里直接把模型式文本作为 React 文本节点显示，没有调用 dangerouslySetInnerHTML。后续如果要支持 Markdown、链接或富文本，需要专门决定允许的内容和过滤方式；供应商输出依然是不可信数据。流式传输不会使 HTML 安全问题消失。"
        }
      ]
    },
    {
      "id": "cancel",
      "title": "暂停、断线、取消分别改变什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "暂停接收只 close 当前 EventSource。后台任务仍然运行，事件继续写入本例的内存日志；点继续时从保存的游标重放缺失事件。它适合模拟页面短暂不可见、用户暂停观看，或者重连过程。暂停按钮不能宣称已经节省模型费用。"
        },
        {
          "type": "paragraph",
          "text": "取消任务是独立的 POST 操作。后端找到任务的 AbortController，发出 abort，本地生成器正在等待的 delay 接收同一个 signal，随后进入 cancelled 终态。停止不会追溯撤销已经产生的文字；对已经 completed 的任务，取消也不会抹掉结果。"
        },
        {
          "type": "paragraph",
          "text": "接入真实模型时，还要让该 Signal 传给上游请求、检索和工具等待。只取消一个 Promise.race，并不会自动终止实际 HTTP 连接；供应商是否停止计算或收费又是另一层承诺。不能把本地演示取消测试通过，写成“任何模型取消后立即不再计费”。"
        },
        {
          "type": "table",
          "headers": [
            "动作",
            "浏览器连接",
            "后台任务",
            "事件记录"
          ],
          "rows": [
            [
              "暂停接收",
              "关闭",
              "继续",
              "保留并继续追加"
            ],
            [
              "网络断开",
              "断开，原生对象会尝试重连",
              "本例继续",
              "重连按游标补齐"
            ],
            [
              "取消任务",
              "可继续接收取消终态",
              "协作式停止",
              "追加 cancelled"
            ],
            [
              "完成后关闭",
              "主动关闭避免重连",
              "已经结束",
              "终态记录仍可重放"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "生产应用要先决定断线策略。短聊天可能在全部观察者离开后取消生成；长任务可能需要继续跑并等待用户回来。两种都合理，但要有明确任务所有权、预算和生命周期。本例选择“订阅断开不取消任务”，方便完整观察这两层边界。"
        }
      ]
    },
    {
      "id": "capacity",
      "title": "流式接口也有容量边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "长连接不会免费等待。每个连接占有 socket、缓冲区和订阅状态；每个生成任务占有模型/工具资源。例子把同时生成限制为 4 个，保留任务限制为 16 个，同一任务最多 4 个订阅连接。超过时尽早返回 429，而不是一直把合法请求堆在内存里。"
        },
        {
          "type": "paragraph",
          "text": "事件数组在这个生成器里最多只有 7 条，保留任务十分钟后可在下一次创建时清理。真实模型输出长度不固定，必须增加累计字节数、事件数、总运行时间和日志保留预算。不能因为固定五段文本没有占满内存，就宣称实现了任意长对话的稳定容量。"
        },
        {
          "type": "paragraph",
          "text": "写 SSE 时，res.write 返回 false 意味着当前缓冲需要等待，例子等待 drain 再继续；连接关闭会取消等待并退出订阅循环。这里背压约束的是向该客户端写入的速度，不会自动让独立运行的生成器停下。若生成更快而日志无限积累，仍然需要持久队列或截断/失败策略。"
        },
        {
          "type": "paragraph",
          "text": "本例只绑定 127.0.0.1，Origin 检查用于本机浏览器来源边界，不是完整用户认证。正式服务需要给创建、订阅和取消都加任务所有权校验，不能因为任务 ID 很长就允许所有人读取。原生 EventSource 不能传任意 Authorization 请求头，可以使用经过设计的同源会话 Cookie，或自己实现 fetch 流读取；不要把长期密钥放进 URL。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "运行和观察：先暂停续接，再取消另一个任务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/ai-engineering-stream\nnpm ci\nnpm test\nnpm run build\nnpm start",
          "language": "bash",
          "purpose": "使用 Node.js 22.12.0。打开固定端口 http://127.0.0.1:4190；端口被占用会报错，不自动漂移。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "第一次点开始，应看到事件从 1 增到 7，状态最终 completed，正文逐段出现。在完成前暂停，等待后台继续，再点继续，应该补回遗漏片段，之前的文字不会重复。另建一个任务，生成时点取消，应进入 cancelled，之后不再出现新 delta。"
        },
        {
          "type": "paragraph",
          "text": "Node 测试通过真实本地 HTTP 读取 SSE，检查事件顺序，使用 after=2 得到 3～7，再用 Last-Event-ID=6 得到事件 7，且任务注册表仍只有一个任务。其他测试验证取消、容量、非法游标、来源边界和客户端去重。它们没有模拟生产网络丢包、负载均衡、多副本或真实模型速度。"
        },
        {
          "type": "paragraph",
          "text": "如果网络面板显示响应迟迟一次性返回，先检查服务器是否及时 flush，再检查反向代理是否缓冲。若重连后文字重复，核对服务器 ID 是否稳定、客户端是否忽略已处理 ID。若看不到终态，检查连接是否被错误地提前取消、JSON 是否能解析。若服务重启后任务不存在，这是本例内存保留策略的边界，不能通过更频繁重连恢复。"
        },
        {
          "type": "callout",
          "title": "本章交付与下一步",
          "text": "现在你有可启动的 Node/React 页面，任务与连接分开，能验证续接与协作取消。下一篇把模型式计划连接到数据库工具，继续落实“谁能读什么、生成结果能变成哪一种查询”的边界。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "WHATWG：SSE 协议与 EventSource",
      "url": "https://html.spec.whatwg.org/multipage/server-sent-events.html"
    },
    {
      "title": "Node.js 22：流与背压",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/stream.html"
    },
    {
      "title": "React：Effect 连接外部系统及清理",
      "url": "https://18.react.dev/reference/react/useEffect"
    },
    {
      "title": "Node.js 22：AbortController",
      "url": "https://nodejs.org/docs/latest-v22.x/api/globals.html#class-abortcontroller"
    }
  ],
  "tags": [
    "SSE",
    "React",
    "流式响应",
    "事件游标",
    "取消",
    "背压",
    "Node.js"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0 / React 18.3.1 / esbuild 0.25.12"
  ],
  "verifiedAt": "2026-10-26",
  "examples": [
    {
      "label": "完整源码、测试、数据和锁文件 ZIP",
      "path": "ai-engineering-stream.zip"
    },
    {
      "label": "安装、运行与能力边界",
      "path": "ai-engineering-stream/README.md"
    }
  ]
};
export default article;
