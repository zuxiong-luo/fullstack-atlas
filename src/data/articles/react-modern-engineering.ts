import type {Article} from '../articleTypes';
export const reactModernEngineeringArticle: Article = {
  "id": "react-modern-engineering",
  "topic": "react",
  "title": "现代 React 工程：客户端、服务端与框架边界",
  "description": "沿一次页面请求讲透 SSR 与 hydration：同一份数据怎样生成 HTML、交给浏览器并恢复交互；再用流式渲染、RSC 和路由导读定位框架的职责。",
  "minutes": 60,
  "labMinutes": 30,
  "tags": [
    "React 18.3.1",
    "七篇系列·第7篇",
    "SSR",
    "Hydration",
    "工程边界"
  ],
  "kind": "series",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "Node.js 22",
    "esbuild 0.28.2",
    "jsdom 26.1.0"
  ],
  "verifiedAt": "2026-10-22",
  "scope": "深入实现 React 18.3.1 的字符串 SSR、hydration、请求隔离与失败恢复；末尾的 streaming、RSC、路由为概念导读，不作为已运行的框架实现。",
  "prerequisites": [
    "函数组件、props、useState 与 Effect",
    "HTTP 请求响应和 Node.js 基础"
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "现代 React 工程是什么：把组件放回完整的请求链路",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React 工程关心的是：组件怎样进入一条完整、可运行的请求链路。浏览器发来地址后，谁读数据、谁生成 HTML、浏览器拿到页面后怎样恢复交互，都需要具体安排。本篇集中回答其中一件事：一页 React 界面如何从服务器走到浏览器，并在这两个环境里保持一致。"
        },
        {
          "type": "paragraph",
          "text": "前面几篇从浏览器中的组件、状态和更新机制出发。本篇把视角向外移一层：浏览器看到的初始 DOM 是谁生成的？服务器已经输出 HTML 后，为什么还要下载 React？不同用户的请求同时到来时，为什么不能像客户端那样随手建一个全局 Store？这些问题的共同点是，执行环境和数据生命周期变了。"
        },
        {
          "type": "paragraph",
          "text": "贯穿案例是一页带标题和计数按钮的页面。Node.js 在请求到来时生成标题、初始计数和请求编号，输出 HTML；浏览器用同一份数据接管这段 HTML，点击按钮后计数增加。功能故意保持小，方便观察边界：服务端处理错误、初始数据转交、hydration 不匹配和请求隔离都能单独验证。"
        },
        {
          "type": "paragraph",
          "text": "阅读分两段。先把普通 SSR 的完整链路做出来：请求 → 数据 → HTML 与 JSON → hydration → 点击更新 → 故障恢复。最后三节是扩展导读，只解释流式 SSR、RSC、客户端路由分别改变哪一段链路。这样读完你能实现和排查前一段，也能判断引入框架时需要继续验证什么。实验固定 Node.js 22、React / React DOM 18.3.1、esbuild 0.28.2、jsdom 26.1.0。"
        }
      ]
    },
    {
      "id": "rendering",
      "title": "CSR、SSR 与 SSG：先分清 HTML 在哪里、何时生成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "CSR 是客户端渲染。初次访问时，服务器可以只返回一个空容器和脚本入口，浏览器执行脚本、取得数据，再由 createRoot 渲染页面。组件逻辑和后续交互集中在浏览器，静态托管也容易；代价是重要内容往往要等脚本下载、解析和数据请求完成后才出现。不要只看服务器返回得快不快，还要看用户什么时候真正看到所需内容。"
        },
        {
          "type": "paragraph",
          "text": "SSR 是服务端渲染。服务器把这一请求的数据交给组件，先生成 HTML 再发送。浏览器可以先解析内容，然后下载脚本并完成交互接管。SSR 并没有消灭客户端代码，也没有保证所有指标都更好：请求端新增了数据读取和渲染成本，服务器忙、缓存失误或脚本过大仍会拖慢体验。它改变的是首屏工作的分配位置。"
        },
        {
          "type": "paragraph",
          "text": "SSG 是静态生成，强调 HTML 在构建阶段提前生成。生成后的文件可以交给 CDN，访问时无需为每个用户重新执行同一段渲染。代价是数据更新要通过重建或框架提供的再生成机制进入页面。一个每分钟变化的个人订单页，不能只因为 SSG 便宜就把个人数据写成公共文件。SSR 与 SSG 的差异首先是生成时机，不是 JSX 写法。"
        },
        {
          "type": "table",
          "headers": [
            "方式",
            "初始 HTML 的来源",
            "数据新鲜度与成本",
            "交互"
          ],
          "rows": [
            [
              "CSR",
              "浏览器执行脚本后产生主要内容",
              "浏览器获取；需处理请求等待和竞态",
              "客户端 React"
            ],
            [
              "SSR",
              "服务端逐请求生成",
              "请求时获取；服务器付出渲染成本",
              "通常还需 hydration"
            ],
            [
              "SSG",
              "构建阶段预生成",
              "更新需要重新生成；适合公共内容",
              "可以 hydration，也可以无脚本"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这些方式可以按路由组合。文章正文适合预生成，登录后的工作台可能采用客户端加载，个性化页面可能按请求渲染。决策要先问内容是否公开、多久变化、是否依赖身份，再比较部署成本。不要把某种模式当成整个站点永远不变的标签。"
        }
      ]
    },
    {
      "id": "hydration",
      "title": "Hydration 是接管已有 DOM，前提是首轮结果一致",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Hydration 可以理解为：React 在浏览器里根据组件和初始数据建立工作记录，并把它们与服务端已有的 DOM 对应起来，使事件和后续更新能够继续运行。服务器传来的是 HTML，不是服务端内存中的 Fiber 或 Hook 对象。浏览器仍然会执行相应的客户端组件代码，建立自己的状态与树。"
        },
        {
          "type": "paragraph",
          "text": "为什么双方的首轮结果必须一致？服务端输出“计数 0”，客户端却认为同一个位置应该是“计数 99”，React 就无法直接相信已有 DOM 正是当前树的结果。本实验故意制造文本不匹配，React 18.3.1 会报告可恢复错误，并把没有 Suspense 边界保护的这个根切换到客户端渲染。其他类型的不匹配并不保证以同样方式修正，尤其不能依赖属性总会被补齐。"
        },
        {
          "type": "paragraph",
          "text": "常见原因包括在 render 中调用 Date.now 或 Math.random、服务端和浏览器使用不同时区、服务器看不到 localStorage 却在浏览器首轮读取它，以及部署期间 HTML 与脚本版本不一致。正确做法是明确首轮数据来源：把服务器已经决定的值传给浏览器；确实只在客户端存在的信息，可以先用一致的占位值，再在 Effect 中更新。后者会多一次更新和可能的视觉变化，需要衡量，而不是到处套一个 mounted 开关。"
        },
        {
          "type": "paragraph",
          "text": "suppressHydrationWarning 适合少量确实无法避免的差异，它是有限的逃生口，不是让两棵不同的树变得兼容。你把告警隐藏了，并不等于状态、事件目标和属性已经变得正确。调试时应先比较“原始响应 HTML”和浏览器第一次 render 的输入，再看后续 Effect，不要一上来怀疑 setState 的异步时机。"
        },
        {
          "type": "reference",
          "title": "hydrateRoot：一致性要求与恢复回调",
          "url": "https://react.dev/reference/react-dom/client/hydrateRoot",
          "note": "当前官方页面还包含新版本选项；本例仅使用 React 18 已支持的 onRecoverableError。"
        },
        {
          "type": "figure",
          "src": "figures/react-modern-engineering/request.svg",
          "title": "一份请求数据，经过两次渲染环境",
          "alt": "请求数据分别进入服务端 HTML 渲染与安全 JSON，浏览器读取 JSON 后 hydrateRoot 接管已有 DOM，随后点击进入客户端更新",
          "caption": "示意图。数据快照被序列化传递；服务端 Fiber、闭包和数据库连接不会随 HTML 传到浏览器。"
        }
      ]
    },
    {
      "id": "data",
      "title": "初始数据与请求隔离：相同快照不等于共享全局变量",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在把流程落到代码。每次 HTTP 请求建立一个独立的 data 对象，其中 title 是待展示文本，count 是初始值，requestId 是关联诊断记录的标识。服务器用 data 渲染 App，同时把 data 序列化到页面里。浏览器从页面读取它，因此不必再请求一次同样的数据才能完成首轮渲染。"
        },
        {
          "type": "paragraph",
          "text": "对象放在请求回调里很重要。Node.js 进程通常同时处理多个用户的请求，如果把“当前用户”“当前购物车”保存在模块级可变 Store 中，后一个请求可能改掉前一个请求要读的数据。JavaScript 在单线程执行不代表一个异步请求从头到尾不可交错：一次 await 就可能让另一个请求继续执行。正确隔离要跟随请求作用域，而不是只看线程数量。"
        },
        {
          "type": "paragraph",
          "text": "共享缓存需要按数据归属决定。公共商品字典可以在请求之间复用；用户订单则需要同时考虑身份、权限和失效规则。本例直接为每个请求创建对象，并使用 Cache-Control: no-store，让你先看清请求与数据的一一对应。前篇讲过客户端 Store，这里新增的关键差别是：服务器模块往往服务很多用户，生命周期比一次请求长。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "App.jsx",
          "purpose": "同一个 App 在服务器和浏览器执行；服务器输出 count=0，浏览器以相同初始 props 建立自己的 Hook 状态。",
          "kind": "excerpt",
          "code": "import React, {useState} from 'react';\nexport function App({data}) {\n  const [count, setCount] = useState(data.count);\n  return <main><h1>{data.title}</h1><p>请求：{data.requestId}</p>\n    <button onClick={() => setCount(n => n + 1)}>计数 {count}</button>\n    <nav><a href=\"/\">重新请求页面</a> | <a href=\"/?mismatch=1\">不匹配反例</a> | <a href=\"/?fail=1\">服务端失败</a></nav>\n  </main>;\n}\n"
        },
        {
          "type": "paragraph",
          "text": "顺着 App 读一次：服务器把 data.count=0 交给 useState，得到带“计数 0”的 HTML；浏览器随后也从 0 初始化。onClick 中的函数只在浏览器事件发生时执行，函数本身不会被序列化到 HTML。点击后浏览器状态变为 1，而服务器已经结束的那次请求仍然没有被修改。"
        },
        {
          "type": "paragraph",
          "text": "“重新请求页面”使用普通 a 链接。点击它会取回一份新文档，服务器新建 requestId 与 count=0，因此计数重置。这正好给后面的客户端导航留下一个比较基线：完整文档导航重建应用，SPA 导航则可以在原来的根中更新页面。"
        }
      ]
    },
    {
      "id": "serialization",
      "title": "安全转交数据：JSON.stringify 并不是 HTML 转义器",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React 默认会把 title 当文本转义，所以标题中出现小于号并不会被当成 HTML 标签。但我们还有第二条数据路径：把 JSON 放进 script 元素。HTML 解析器会先识别 script 的结束位置，然后 JavaScript 或 JSON 解析器才有机会处理内容。即使 type 是 application/json，原始字符串中的 </script> 仍可能提前结束这个元素。"
        },
        {
          "type": "paragraph",
          "text": "因此，单纯 JSON.stringify 只保证 JSON 语法合法，不保证适合 HTML 上下文。本例在序列化后把小于号替换成字面量的 Unicode 转义，并处理 U+2028、U+2029。这样 HTML 源码中没有由数据注入的结束标签，而 JSON.parse 仍能恢复原字符串。不要手动拼接引号，也不要把服务端异常堆栈或访问令牌顺便塞进初始数据。"
        },
        {
          "type": "paragraph",
          "text": "这里需要同时看两层边界：能安全展示的数据不一定可以公开。即使做了完美转义，浏览器仍然能读取所有初始 JSON。API 密钥、数据库连接信息、跨租户的内部字段根本不应进入这个对象。反过来，服务器验证过的数据到客户端之后，也不能作为以后写操作的可信授权证据。"
        },
        {
          "type": "paragraph",
          "text": "先看服务端真正连接两种输出的三行。markup 负责让浏览器先看到内容；JSON 负责让浏览器稍后用相同输入执行 App。这两条路径都读取同一个 data。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "server.mjs · documentFor 的两条数据路径",
          "purpose": "从下面完整文件提取关键调用并命名中间值；HTML 拼接在完整文件中。",
          "kind": "excerpt",
          "code": "const markup = renderToString(React.createElement(App, {data}));\nconst snapshot = serialize(data);\n// markup 放进 #root；snapshot 放进 #initial-data。\n// 浏览器入口只解析 snapshot，再用同一个 App 执行 hydrateRoot。"
        },
        {
          "type": "paragraph",
          "text": "接着读完整文件时，按四个位置找：createServer 的请求回调创建 requestId；路由确认后创建 data；documentFor 在发送响应前完成字符串渲染；catch 在失败时返回 500。静态脚本 /client.js 走独立分支，它负责把客户端代码送过去，不会再生成页面数据。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "server.mjs",
          "purpose": "完整服务端文件：请求作用域、文本渲染、HTML 上下文序列化、500 回退和诊断日志都在这里。",
          "kind": "excerpt",
          "code": "import http from 'node:http';\nimport {randomUUID} from 'node:crypto';\nimport {readFile} from 'node:fs/promises';\nimport {pathToFileURL} from 'node:url';\nimport React from 'react';\nimport {renderToString} from 'react-dom/server';\nimport {App} from './dist/App.mjs';\n// JSON is placed in an HTML script raw-text context; JSON.stringify alone is insufficient.\nexport function serialize(data) {\n  return JSON.stringify(data).replace(/</g, '\\\\u003c').replace(/\\u2028/g,'\\\\u2028').replace(/\\u2029/g,'\\\\u2029');\n}\nexport function documentFor(data) {\n  const markup = renderToString(React.createElement(App, {data}));\n  return '<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>React SSR 实验</title></head><body><div id=\"root\">'\n    + markup + '</div><script type=\"application/json\" id=\"initial-data\">'\n    + serialize(data) + '</script><script defer src=\"/client.js\"></script></body></html>';\n}\nexport function createServer({log = console.log} = {}) {\n  return http.createServer(async (req, res) => {\n    const requestId = randomUUID();\n    const start = performance.now();\n    res.setHeader('X-Request-Id', requestId);\n    res.setHeader('X-Content-Type-Options', 'nosniff');\n    res.setHeader('Cache-Control', 'no-store');\n    res.setHeader('Content-Security-Policy', \"default-src 'none'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'\");\n    try {\n      const url = new URL(req.url, 'http://localhost');\n      if (url.pathname === '/client.js') {\n        res.setHeader('Content-Type','text/javascript; charset=utf-8');\n        res.end(await readFile(new URL('./dist/client.js',import.meta.url))); return;\n      }\n      if (url.pathname !== '/') {res.writeHead(404); res.end('Not found'); return;}\n      if (url.searchParams.has('fail')) throw new Error('simulated loader failure');\n      // Each request owns its own data. Never store the current visitor in a module-global variable.\n      const data = {title: url.searchParams.get('title')?.slice(0,200) || '服务端与浏览器共享一份快照', count:0, requestId};\n      const html = documentFor(data); // Complete before sending headers: failures can still return 500.\n      res.setHeader('Content-Type','text/html; charset=utf-8');\n      res.end(html);\n    } catch (error) {\n      res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'});\n      res.end('页面暂时不可用，请重试。请求编号：' + requestId);\n      log(JSON.stringify({requestId, phase:'render-or-load', error:error.message}));\n    } finally {\n      log(JSON.stringify({requestId,status:res.statusCode, durationMs:Math.round(performance.now()-start)}));\n    }\n  });\n}\nif (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {\n  createServer().listen(4307,'127.0.0.1', () => console.log('http://127.0.0.1:4307'));\n}\n"
        },
        {
          "type": "paragraph",
          "text": "例如请求 /?title=Hello，服务端 data 中是 title=\"Hello\"、count=0 和本次 requestId。响应中的 h1 显示 Hello，JSON 同时保留这三个字段。若标题包含 </script>，serialize 必须使 HTML 源码不再出现由数据形成的结束标签，而 JSON.parse 后仍得到原来的标题。安全检查因此要同时验证“没新增 script 元素”和“还原值完全相等”，只检查没有执行脚本还不够。"
        }
      ]
    },
    {
      "id": "client",
      "title": "客户端接管：读快照、建立状态、接上事件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "浏览器解析完响应后执行 client.js。下面的入口按顺序完成三件事：取出服务器嵌入的 JSON，选择正常或故障实验输入，最后把容器、组件与诊断回调交给 hydrateRoot。这里的初始值必须从响应读取，因为服务器已经用它决定了 DOM。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "client.jsx",
          "purpose": "正常路径读取快照；mismatch 查询参数只用于明确复现首轮差异，不能用于生产。",
          "kind": "excerpt",
          "code": "import React from 'react';\nimport {hydrateRoot} from 'react-dom/client';\nimport {App} from './App.jsx';\nconst data = JSON.parse(document.getElementById('initial-data').textContent);\n// 仅供故障演示：服务端输出 count=0，浏览器故意从 99 开始。\nif (new URL(location.href).searchParams.has('mismatch')) data.count = 99;\nhydrateRoot(document.getElementById('root'), <App data={data} />, {\n  onRecoverableError(error) {\n    console.error('hydration-recovery', {requestId: data.requestId, message: error.message});\n  }\n});\n"
        },
        {
          "type": "paragraph",
          "text": "正常路径中，JSON.parse 得到 data，App 用它初始化 count，React 便能将组件结果与已有 DOM 对应。按钮被接管后，点击更新浏览器里的 count。整个点击不需要新的 HTTP 请求；只有点击页面中的普通导航链接，才会再次进入 Node.js 的页面请求回调。"
        },
        {
          "type": "paragraph",
          "text": "onRecoverableError 用来记录 React 已采取恢复措施的错误。记录 requestId 能把浏览器告警和服务端生成该页面的日志串起来，但不能把“已恢复”直接解释为“没有影响”：丢弃已有 DOM 可能带来闪动、输入丢失或额外工作。实际监控应记录发布版本、路由和错误类别，避免无意上传完整用户输入。"
        },
        {
          "type": "paragraph",
          "text": "本例用 development 构建，目的是观察诊断信息，不拿它测量生产性能。线上构建应关闭开发诊断并压缩资源，同时保留受控的恢复遥测。React 19 文档里的 onCaughtError、onUncaughtError 等配置不能直接复制给 React 18 当作相同能力；升级需要以实际安装版本和测试结果为依据。"
        }
      ]
    },
    {
      "id": "recovery",
      "title": "错误恢复：先找发生在哪一层，再决定谁来处理",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "SSR 应用的失败至少有 HTTP 数据加载、服务端渲染、资源加载、hydration 和后续交互几层。客户端 Error Boundary 能处理其子树某些渲染错误，却不能替代服务端响应处理，也不能自动捕获任意事件处理器或异步任务中的异常。把所有错误都交给一个页面边界，会留下看不见的空白。"
        },
        {
          "type": "paragraph",
          "text": "本例的 fail=1 在输出 HTML 前模拟加载失败，所以服务器可以返回真正的 500 与一个不依赖 React 的文本回退。响应只包含通用提示和请求编号，详细原因进入服务器日志。用户重试发起新的请求，不会复用失败渲染留下的进程级状态。为了避免假成功，测试同时检查 HTTP 状态与响应内容，而不是只看页面上是否出现“错误”。"
        },
        {
          "type": "table",
          "headers": [
            "步骤",
            "正常 /",
            "故障 /?fail=1",
            "故障 /?mismatch=1"
          ],
          "rows": [
            [
              "生成数据",
              "创建 count=0 的 data",
              "在创建页面之前抛异常",
              "创建 count=0 的 data"
            ],
            [
              "HTTP 响应",
              "200，包含 HTML 与 JSON",
              "catch 返回 500 和文本",
              "200，包含 HTML 与 JSON"
            ],
            [
              "浏览器入口",
              "读取 0 后 hydration",
              "没有 App，也没有 hydration",
              "入口故意把 count 改成 99"
            ],
            [
              "观察依据",
              "点击后 0 → 1",
              "网络状态与服务端 phase 日志",
              "恢复回调；本例切换客户端渲染"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这张表也给出了定位顺序。看到 500，先查服务端；HTTP 是 200 且初始文字存在，但按钮不动，先看脚本是否成功加载；脚本已执行又出现 hydration-recovery，再比较响应 JSON 与客户端入口。按实际阶段缩小范围，比把所有现象都归为“React 渲染失败”更有效。"
        },
        {
          "type": "table",
          "headers": [
            "失败位置",
            "可采取的动作",
            "不能假设"
          ],
          "rows": [
            [
              "初始数据加载/字符串渲染",
              "发送 500、通用回退、关联请求日志",
              "客户端 Error Boundary 会自动接住"
            ],
            [
              "流式 shell 已发送之后",
              "记录边界失败、恢复 UI、必要时终止流",
              "还能修改已发送的 HTTP 状态"
            ],
            [
              "客户端脚本 404",
              "部署静态资源兼容、保留旧资源、监控加载失败",
              "SSR 有内容就代表按钮可用"
            ],
            [
              "hydration 不匹配",
              "记录恢复并修复双方初始输入",
              "所有不匹配都会被自动正确修补"
            ],
            [
              "事件/请求失败",
              "显式捕获、展示状态、设计重试",
              "渲染边界会自动捕获所有 Promise"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "“重试”还要考虑幂等性。本例是读取页面，重新请求很容易；如果错误发生在支付或提交订单后，不能仅因为浏览器没收到响应就再次无条件执行写操作。前端恢复按钮必须和服务端幂等协议配套，这已经超出 React 本身的状态恢复能力。"
        }
      ]
    },
    {
      "id": "deployment",
      "title": "部署、测试与观测：检查用户真正经过的链路",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "实验服务器只监听本机 4307。它没有 TLS、账户系统、持久化、负载控制或反向代理配置，不能直接作为公网生产服务。部署时需要先给静态资源设计版本策略：HTML 和脚本要能配对，滚动发布期间仍在访问旧 HTML 的浏览器应能取得对应旧脚本。先删除所有旧资源，再上线新 HTML，可能让已打开页面在导航或懒加载时失败。"
        },
        {
          "type": "paragraph",
          "text": "本例设置了 no-store、nosniff 和限制脚本来源的 CSP，主要用来展示响应边界。CSP 并没有替代序列化；应用未来加入内联脚本或流式 React 指令时，还需要按真实输出设计 nonce 等策略并在浏览器验证。权限也必须在服务端每次数据访问时校验，隐藏导航或把组件移到服务器都不等于获得了访问控制。"
        },
        {
          "type": "paragraph",
          "text": "服务端日志记录 requestId、status、durationMs，错误日志额外记录 phase。这里的 durationMs 是这个示例完成本地处理到调用响应结束附近的耗时，不能代表浏览器下载结束、首屏绘制或可交互时间。客户端应该另外观测页面显示、恢复错误、资源错误和交互延迟，按版本与路由聚合。只看平均 SSR 耗时容易漏掉长尾和客户端瓶颈。"
        },
        {
          "type": "paragraph",
          "text": "自动测试也分层。HTTP 用例确认隔离、状态和资源；DOM 用例确认相同快照复用按钮节点、事件接管生效，以及故意差异会触发恢复。jsdom 没有真实浏览器的布局、网络加载与 CSP 执行模型，所以这些通过不等于完成了浏览器性能或安全审计。发布前仍需在真实浏览器与实际代理链路检验脚本执行、移动网络、刷新深层路由以及错误回退。"
        }
      ]
    },
    {
      "id": "practice",
      "title": "运行实验：从正常接管到三个故障边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "正文已经给出 App.jsx、server.mjs 和 client.jsx。将它们放在同一目录，再加入下面的构建文件。构建做两份产物：浏览器使用包含 React 的 client.js；Node.js 使用 App.mjs，并从安装依赖中加载 React。这样同一个组件才会真的在两种环境执行。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "build.mjs",
          "purpose": "完整构建文件，与配套示例一致。",
          "kind": "excerpt",
          "code": "import {build} from 'esbuild';\nawait build({entryPoints:['client.jsx'],bundle:true,outfile:'dist/client.js',format:'iife',define:{'process.env.NODE_ENV':'\"development\"'}});\nawait build({entryPoints:['App.jsx'],bundle:true,outfile:'dist/App.mjs',format:'esm',platform:'node',external:['react']});\n"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端 · 手工按正文创建文件后",
          "purpose": "先创建正文中的四个文件；命令生成自己的锁文件。配套 ZIP 则使用已提交的锁文件，见下面 npm ci 路径。",
          "kind": "excerpt",
          "code": "npm init -y\nnpm pkg set type=module\nnpm install --save-exact react@18.3.1 react-dom@18.3.1\nnpm install --save-dev --save-exact esbuild@0.28.2\nnode build.mjs\nnode server.mjs"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "purpose": "从配套示例目录安装锁定依赖、构建并执行测试；服务固定 4307，避免与本站 4173 冲突。",
          "kind": "runnable",
          "code": "cd examples/react-modern-engineering\nnpm ci\nnpm test\nnpm start\n# 浏览器打开 http://127.0.0.1:4307\n# Ctrl+C 停止服务器"
        },
        {
          "type": "paragraph",
          "text": "先打开正常页面。查看原始网页源代码，可以在 root 里面找到标题与计数 0；这证明初始内容来自服务器。接着点击按钮，计数变为 1，说明 hydration 后客户端事件能工作。点击重新请求页面，编号改变、计数回到 0，因为这是新文档请求。仅看到标题不代表 hydration 成功，需要实际操作按钮。"
        },
        {
          "type": "paragraph",
          "text": "第二步打开 mismatch=1。服务端仍输出 0，浏览器入口故意改为 99，控制台会出现不匹配与恢复记录。测试进一步确认本例按钮节点被替换；这个结论限定在当前版本和本例根部文本差异，不能推广成“所有 hydration 错误都重新创建整页”。"
        },
        {
          "type": "paragraph",
          "text": "第三步打开 fail=1，网络面板应看到 500。此时不会有可点击计数器，而是独立回退文本。最后尝试把 title 查询值设置为包含 </script> 的字符串，页面应显示它的文本形式，不能执行注入脚本。自动测试使用受控字符串验证 JSON script 未被提前关闭，并恢复出了原始值。"
        },
        {
          "type": "paragraph",
          "text": "配套目录中的 README 和 VERIFICATION 保留命令记录，正文的理解与运行步骤已经完整。已有验证覆盖匹配快照接管、不匹配恢复、JSON 上下文和 HTTP 请求隔离；jsdom 用例不覆盖真实代理的分块、生产负载或浏览器 CSP 审计。运行时若与上面不同，先核对 Node 与 React 版本、构建是否完成，以及 4307 是否被占用。"
        },
        {
          "type": "paragraph",
          "text": "检查一：服务器打印了“计数 0”，为什么还要传 JSON？因为 HTML 只提供显示结果，客户端执行组件还需要初始输入。靠重新请求可能拿到另一份数据；传同一份快照才能解释两次渲染为什么一致。"
        },
        {
          "type": "paragraph",
          "text": "检查二：打开 /?mismatch=1 得到 200，为什么仍然算失败？HTTP 200 只说明本例服务端生成响应成功；客户端随后改变输入，才破坏了 hydration 的前提。修复点是入口数据，不是把服务端状态码改成 500。"
        },
        {
          "type": "paragraph",
          "text": "检查三：并发请求没串数据，是否证明全局 Store 安全？没有。示例正是靠每个请求独立创建 data 避免共享。未来加 await 和模块级可变用户状态后，需要重新验证交错执行下的隔离。"
        }
      ]
    },
    {
      "id": "streaming",
      "title": "扩展导读一：流式 SSR 改变发送与恢复的时间窗口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "到这里，普通 SSR 的实现、运行和失败过程已经闭合。下面三节只定位框架能力，不再引入另一套待运行项目。第一种扩展保留“生成 HTML → hydration”的关系，把一次性发送改为分段发送。"
        },
        {
          "type": "paragraph",
          "text": "前面的 renderToString 把整段结果计算成字符串，再发给浏览器。流式 SSR 则允许把已经就绪的部分先发送，其他内容就绪后继续输出。React 18 在 Node.js 中提供 renderToPipeableStream；外围已就绪的页面结构通常称为 shell，Suspense 边界为尚未就绪的子树提供 fallback。它解决的是输出顺序和等待边界，不是给任意 fetch 自动加缓存。"
        },
        {
          "type": "paragraph",
          "text": "例如标题、导航已经准备好，推荐列表仍在等待。如果把整个页面都挡在推荐列表前面，浏览器只能等待全部完成；把推荐区域放在合适的 Suspense 边界内，shell 可以包含该区域的 fallback，后续内容再补进来。但组件里普通 useEffect 的请求是在客户端提交后发生，不能因为外面包了 Suspense 就变成服务端流式数据源。React 18 的数据接入通常由支持 Suspense 的框架管理；手写抛 Promise 的缓存不是这里承诺的稳定生产接口。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "streaming-lifecycle.js",
          "purpose": "生命周期伪代码，只说明发送头前后能做什么；不是本项目可运行入口，省略了框架数据源、取消监听与客户端脚本配置。",
          "kind": "pseudocode",
          "code": "const stream = renderToPipeableStream(page, {\n  onShellReady() {\n    response.statusCode = didError ? 500 : 200;\n    stream.pipe(response); // 从这里开始，HTTP 状态可能已经发出\n  },\n  onShellError(error) {\n    sendStandaloneErrorPage(500); // shell 本身无法生成\n  },\n  onError(error) {\n    didError = true;\n    recordError(error); // shell 发出后不能把 200 改回 500\n  }\n});\n// 还必须在超时/连接关闭时清理监听与计时器，并按场景 abort。"
        },
        {
          "type": "paragraph",
          "text": "这会改变错误处理的时间窗口。字符串渲染时，我们在 res.end 之前就知道本次渲染是否成功；流式渲染开始发送后，后续区域失败也不能把已经发出去的 200 改成 500。必须把 shell 失败、边界内失败、客户端恢复分别观测。代理/CDN 还可能缓冲响应，所以“服务端调用了 pipe”不证明真实用户逐段看到了页面。验证需要观察实际部署链路的分块到达和浏览器行为。"
        },
        {
          "type": "reference",
          "title": "renderToPipeableStream：shell、错误与终止",
          "url": "https://react.dev/reference/react-dom/server/renderToPipeableStream",
          "note": "本节解释机制；配套项目没有实现 Suspense 数据源，未声称通过流式部署验收。"
        }
      ]
    },
    {
      "id": "rsc",
      "title": "扩展导读二：RSC 改变组件代码的执行与传输边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React Server Components，简称 RSC，是另一层组件执行与传输模型。Server Component 可以在服务器或构建环境执行，把适合跨边界传递的结果交给客户端组合；它的实现代码及只在服务器使用的依赖不必进入浏览器包。SSR 说的是生成 HTML，RSC 说的是组件在哪个环境执行及如何把结果传给客户端，两者可以同时使用，不能互相替代。"
        },
        {
          "type": "paragraph",
          "text": "以文章页面为例，服务器读取正文并做 Markdown 处理，点赞按钮保留浏览器状态。RSC 架构可以把正文处理留在服务器，再将点赞数量等可序列化输入交给 Client Component。首屏仍可以把包含这个按钮的树渲染成 HTML，所以 Client Component 不等于“服务器永远不会渲染它”。浏览器需要的交互模块仍要下载并 hydration。"
        },
        {
          "type": "paragraph",
          "text": "在支持这种模型的框架里，use client 声明的是客户端模块入口边界，它会影响被导入模块所属的客户端依赖图，不只是给一个函数贴标签。把声明放得太高，可能把大量本可留在服务器的依赖带到浏览器。相反，组件作为 children 由服务器组合后传入客户端组件，并不意味着那段服务器组件源码自动变为客户端依赖。理解时要分清 JSX 的嵌套关系与模块的 import 关系。"
        },
        {
          "type": "code",
          "language": "jsx",
          "filename": "模块关系示意 · 不属于上面的 React 18 SSR 项目",
          "purpose": "模块依赖示意伪代码：强调服务器把结果/props 交给交互组件；不是可以直接复制运行的 RSC 服务。",
          "kind": "pseudocode",
          "code": "// ServerPage 模块（服务器侧）\nimport LikeButton from './LikeButton'; // 跨入客户端模块边界\n// 服务器读取正文后组合：\n<ArticleBody text={text} />\n<LikeButton initialCount={count} />\n\n// LikeButton 模块（由兼容 RSC 的打包器识别）\n'use client';\n// 使用 useState，处理点击。正文处理依赖不由此模块导入。"
        },
        {
          "type": "paragraph",
          "text": "本实验是传统 React 18 SSR，没有 RSC 协议、编译器或服务器函数调度。给 App.jsx 随便加 use client，不会让 esbuild 自动生成一套 RSC 应用。React 19 的 Server Components 能力与其框架/打包器集成接口也有不同稳定性边界，不能据此声称 React 18 手工 SSR 已经具备相同能力。选用框架时，应锁定框架与 React 的兼容版本，再验证客户端包和服务端访问边界。"
        },
        {
          "type": "reference",
          "title": "Server Components：执行环境与集成版本边界",
          "url": "https://react.dev/reference/rsc/server-components",
          "note": "仅用于职责区分；本项目没有运行 RSC 或 Next.js。"
        },
        {
          "type": "reference",
          "title": "use client：客户端模块边界与传递依赖",
          "url": "https://react.dev/reference/rsc/use-client",
          "note": "供核对模块关系；本节概念导读与 React 18 传统 SSR 实验分开。"
        }
      ]
    },
    {
      "id": "routing",
      "title": "扩展导读三：客户端路由延长了页面与数据的生命周期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一次完整文档请求的生命周期很直观：建立请求、读数据、渲染、返回、结束。SPA 导航则可能在同一个页面和同一个 React 根里切换地址，布局与部分状态继续存在；框架需要决定哪些 loader 重新运行、哪些缓存可复用、加载期间保留什么 UI，以及地址和数据何时一起提交。把 history.pushState 调一下只改变地址，不会自动完成这些工作。"
        },
        {
          "type": "paragraph",
          "text": "假设你先打开商品 A，再快速切到商品 B。A 的请求更慢，最后才返回。如果返回数据时只写入一个无归属的 detail 状态，就可能把 B 的地址配上 A 的内容。无论手工 Hook 还是路由框架，都需要将结果关联到请求身份、路由参数或缓存键，并对过期响应做取消或忽略。服务器渲染只改善第一次访问，不会自动修复这类客户端竞态。"
        },
        {
          "type": "paragraph",
          "text": "写操作同样需要定义后续动作。用户修改标题成功后，服务器事实已经改变，但页面的 loader 数据、浏览器查询缓存、服务器缓存和 CDN 缓存可能仍然保存旧值。应该明确哪个缓存被标记失效、哪部分 UI 等待重读、乐观更新失败如何回滚。不要把 React 的 useMemo 当请求缓存，也不要把一次 router.refresh 想象成清除了部署链路里的所有缓存。"
        },
        {
          "type": "paragraph",
          "text": "Next.js 等框架把这些环节组织进路由约定，但缓存默认值、导航和再验证接口随具体版本、路由体系和配置变化。本篇不提供未经运行的 Next.js 最小项目，也不列一个跨版本的默认缓存表。迁移本实验时，应先把当前页面对应到具体路由，写出初次请求、客户端导航、写入后重读三条路径，再通过网络面板确认数据到底来自哪里。"
        },
        {
          "type": "paragraph",
          "text": "回到同一页计数器：普通链接重新请求后回到 0；客户端路由可能保留布局中的计数器，同时替换正文；RSC 决定正文处理代码是否需要送到浏览器；流式 SSR 决定首份响应哪些部分先到达。这四个问题各有自己的输入与输出。选框架前先把它们分清，遇到故障时才能找到真正负责的那一层。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "SSR 与 hydration 完整示例 ZIP",
      "path": "react-modern-engineering.zip"
    },
    {
      "label": "实际验证记录",
      "path": "react-modern-engineering/VERIFICATION.md"
    }
  ],
  "references": [
    {
      "title": "hydrateRoot",
      "url": "https://react.dev/reference/react-dom/client/hydrateRoot"
    },
    {
      "title": "renderToPipeableStream",
      "url": "https://react.dev/reference/react-dom/server/renderToPipeableStream"
    },
    {
      "title": "React Server Components",
      "url": "https://react.dev/reference/rsc/server-components"
    }
  ]
};
