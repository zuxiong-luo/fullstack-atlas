import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "next-routing",
  "topic": "nextjs",
  "title": "Next.js 请求与路由：App Router、布局和客户端导航",
  "description": "先建立路由树，再对照 HTML 首访与 RSC 导航；用共享布局计数器、动态笔记页和真实生产 HTTP 响应辨别哪些工作发生在服务端。",
  "minutes": 40,
  "labMinutes": 30,
  "tags": [
    "Next.js",
    "App Router",
    "布局",
    "RSC",
    "客户端导航",
    "动态路由"
  ],
  "scope": "用两个笔记页面解释 App Router 树、共享布局、首次请求、客户端导航和不存在的资源。交付生产 HTTP/RSC 实验；浏览器状态保留需另行实际操作核验，不实现平行/拦截路由和完整流式错误工程。",
  "prerequisites": [
    "会写 React 组件、props 和 useState",
    "知道浏览器请求 HTML、脚本与 HTTP 响应"
  ],
  "questionIds": [],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0",
    "Next.js 16.4.2",
    "React / React DOM 19.3.1",
    "TypeScript 5.7.2",
    "cacheComponents 关闭；生产 webpack 构建"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    {
      "label": "完整项目与生产 HTTP 测试",
      "path": "next-routing.zip"
    },
    {
      "label": "安装和复现说明",
      "path": "next-routing/README.md"
    }
  ],
  "sections": [
    {
      "id": "router",
      "title": "App Router 是什么：URL 选择一棵组件树",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "App Router 是 Next.js 根据 app 目录组织页面、布局和端点的路由系统。路由不是一个字符串对应一个孤立组件这么简单：URL 选择沿途的布局，再选择末端页面，框架把它们组织成一棵可渲染的树。这样同一组页面可以共享导航、外壳和部分交互状态，而不必每个页面重新复制一份。"
        },
        {
          "type": "paragraph",
          "text": "这一篇先讲清楚“请求选中了谁”和“切换时谁留下”。知识笔记应用只有 n1、n2 两篇，地址分别是 /notes/n1 与 /notes/n2。它们共用根布局与笔记布局，末端页面通过 id 选择正文。我们放一个计数器在共享布局里，以便之后用明确操作观察导航边界；不会一上来要求读者猜某个莫名其妙的状态为什么消失。"
        },
        {
          "type": "figure",
          "src": "figures/next-routing/tree.svg",
          "title": "目录、树和请求方式的对应关系",
          "alt": "根布局包住 notes 布局，再包住动态笔记页面；首次访问取得文档，客户端导航取得目标 RSC 载荷并协调共享树。",
          "caption": "这是本例路由结构，不是网络耗时图。状态保留由共享布局的位置与客户端协调共同决定。"
        },
        {
          "type": "paragraph",
          "text": "根 layout.tsx 负责 html/body 外壳，嵌套 layout.tsx 通过 children 包住下层内容，page.tsx 是可访问页面。普通文件夹定义路径片段，方括号定义动态片段。route.ts 定义 HTTP 端点，不负责返回页面组件树；普通辅助文件可以放在同级目录，但文件存在不意味着它自动成为 URL。"
        }
      ]
    },
    {
      "id": "files",
      "title": "先看完整目录，布局怎样包住页面就不神秘了",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "app/layout.tsx\napp/page.tsx\napp/notes/layout.tsx\napp/notes/Counter.tsx\napp/notes/[id]/page.tsx\napp/notes/[id]/not-found.tsx\napp/api/ping/route.ts\nlib/notes.ts",
          "language": "text",
          "filename": "示例的业务文件目录",
          "purpose": "无路由组、平行插槽或拦截路由。仅目录结构不足以解释行为，下面展示关键文件。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import type { ReactNode } from 'react';\nexport default function RootLayout({children}:{children:ReactNode}) {\n  return <html lang=\"zh-CN\"><body><header>知识笔记 · next-routing</header><main>{children}</main></body></html>;\n}",
          "language": "tsx",
          "filename": "examples/next-routing/app/layout.tsx",
          "purpose": "完整根布局；children 是下级路由树进入外壳的位置。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import type { ReactNode } from 'react';\nimport Link from 'next/link';\nimport Counter from './Counter';\nexport default function NotesLayout({children}:{children:ReactNode}) {\n  return <section><h2>共享笔记布局</h2><Counter /><nav>\n    <Link href=\"/notes/n1\" prefetch={false}>第一篇</Link>{' | '}\n    <Link href=\"/notes/n2\" prefetch={false}>第二篇</Link>{' | '}\n    <a href=\"/notes/n2\">整页打开第二篇</a>\n  </nav><article>{children}</article></section>;\n}",
          "language": "tsx",
          "filename": "examples/next-routing/app/notes/layout.tsx",
          "purpose": "完整共享笔记布局。Counter 位于动态页面外侧；两个 Link 与一个普通 a 提供对照。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "\"use client\";\nimport { useState } from 'react';\nexport default function Counter() {\n  const [count,setCount]=useState(0);\n  return <button onClick={()=>setCount(value=>value+1)}>布局计数：{count}</button>;\n}",
          "language": "tsx",
          "filename": "examples/next-routing/app/notes/Counter.tsx",
          "purpose": "完整客户端计数器；初值零，点击加一。它由共享 notes 布局挂载。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Counter 自己管理 count，但它并不知道当前笔记 id。保持布局位置稳定时，从 n1 切到 n2 可以替换末端内容而保留这个客户端实例。若把 Counter 移到每个 page，或给它一个随 id 变化的 key，状态归属就变了。解释状态保留时要指明是哪一个组件，而不是说“Next 会缓存全部页面状态”。"
        },
        {
          "type": "paragraph",
          "text": "use client 表示这里建立客户端组件入口，需要把相关代码交给浏览器执行交互；它并不表示首次访问绝对没有服务端生成的 HTML。客户端还需要 hydration 把已有标记与事件处理关联。反过来，服务器执行组件函数也不等于整个组件源码或私有数据都应该送到客户端。这一层数据边界，已有服务端与客户端边界文章会深入展开。"
        }
      ]
    },
    {
      "id": "params",
      "title": "动态片段是输入：等待 params，然后明确处理不存在的资源",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nexport const notes: Record<string,{title:string;body:string}> = {\n  n1:{title:'理解路由树',body:'一个 URL 选择沿途布局和最终页面。'},\n  n2:{title:'理解客户端导航',body:'RSC 载荷用于协调目标树，客户端组件可以保留。'},\n};",
          "language": "ts",
          "filename": "examples/next-routing/lib/notes.ts",
          "purpose": "完整受控笔记数据源。server-only 防止把数据模块意外作为客户端依赖。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import { connection } from 'next/server';\nimport { notFound } from 'next/navigation';\nimport { randomUUID } from 'node:crypto';\nimport { notes } from '../../../lib/notes';\nexport default async function NotePage({params}:{params:Promise<{id:string}>}) {\n  await connection();\n  const {id}=await params;\n  const note=Object.hasOwn(notes,id)?notes[id]:undefined;\n  if(!note)notFound();\n  return <><h1>{note.title}</h1><p>{note.body}</p><p>当前笔记：{id}</p><small>服务端渲染标记：{randomUUID()}</small></>;\n}",
          "language": "tsx",
          "filename": "examples/next-routing/app/notes/[id]/page.tsx",
          "purpose": "完整动态页面。Next 16 的 params 按 Promise 读取，connection 显式把示例的随机标记留在请求时计算。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "export default function Missing(){return <h1>该笔记不存在</h1>;}",
          "language": "tsx",
          "filename": "examples/next-routing/app/notes/[id]/not-found.tsx",
          "purpose": "完整缺失页面。普通输入与资源不存在有不同展示。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "普通路径 /notes/n1 先得到 id=n1，确认对象有自己的这个键后取到笔记。/notes/n2 走同一个函数，但输入不同。/notes/unknown 没有对应数据，于是调用 notFound。这里用 Object.hasOwn 排除原型链上的名字，不把用户控制的路径片段直接当作可信对象属性或数据库权限。真实私有笔记还要加用户归属检查，光是存在就展示是不够的。"
        },
        {
          "type": "paragraph",
          "text": "页面中的 randomUUID 是请求时服务端渲染标记，用来说明本例页面没有在构建时固定为一份静态 HTML。它不是用户会话、请求链路追踪，也不是跨请求去重键。connection 在这里明确等待请求，不是所有页面都必须先调用的开场白；能静态生成的公开内容仍可选择不同策略。"
        },
        {
          "type": "paragraph",
          "text": "本例读取 params 使用 await。旧代码里直接访问 params.id 的形式不能不看版本就复制到 Next 16 教程里。searchParams 也属于路由输入，而且布局与页面在接收和更新时机上有各自约束。当前例子不靠布局读取查询串来推导实时页面状态，避免把不重新渲染的共享布局当作每次导航都重新执行的普通函数。"
        }
      ]
    },
    {
      "id": "document",
      "title": "首次访问：服务端先组织文档，浏览器再接上交互",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "当你在地址栏输入 /notes/n1，浏览器请求的是一个文档。服务器解析路由，沿根布局、笔记布局和页面形成目标树，执行需要在服务器完成的工作，生成 HTML 和 React Server Component 相关载荷，并引用必要脚本资源。浏览器先能展示文本，随后脚本接管客户端组件的交互。不要把这个过程压缩成“所有代码都在服务器跑一次”。"
        },
        {
          "type": "paragraph",
          "text": "配套测试对生产服务器发普通 GET，断言响应是 text/html，包含共享布局、初始计数器、所选笔记，以及 /_next/static 资源入口。这证明首个文档已有可见内容，不依赖浏览器先运行 fetch 才拿到那段笔记。但它没有运行 hydration，也没有点击按钮，因此不能仅靠这个断言宣称交互已经验收。"
        },
        {
          "type": "code",
          "code": "const res = await fetch(base + '/notes/n1');\nconst html = await res.text();\nassert.equal(res.status, 200);\nassert.match(res.headers.get('content-type'), /text\\/html/);\nassert.match(html, /共享笔记布局/);\nassert.match(html, /理解路由树/);\nassert.match(html, /_next\\/static/);",
          "language": "js",
          "filename": "生产 HTTP 首访验证 · 项目节选",
          "purpose": "base 是测试启动的 127.0.0.1:4321。完整启动和清理逻辑随项目交付，正文后面解释运行方式。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "布局文件也不等于 HTTP 资源缓存配置。服务器是否每次重新取数据、浏览器是否复用导航载荷、共享客户端组件是否仍挂载，是三个不同的问题。后两篇会分别讲数据缓存和写入后的更新；在当前篇先把“页面树”与“缓存结果”分开，后面就不会把一次布局保留误解释为数据库没有更新。"
        }
      ]
    },
    {
      "id": "navigation",
      "title": "客户端导航：沿原来的树，协调目标分支",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "点击 Next Link 的同站链接时，框架通常可以在当前应用里完成导航，取得目标路由需要的 RSC 载荷，再更新变化的分支。载荷包含服务端组件的结果，以及客户端组件相关引用等信息，不等于把服务端组件的完整实现作为 JS 发给浏览器，也不等于服务器只回一小段 HTML 字符串。具体传输格式属于框架协议，不应被业务手工拼接。"
        },
        {
          "type": "paragraph",
          "text": "为了便于观察，本例 Link 设置 prefetch=false，先把自动预取这一层影响去掉。正式项目可以让框架预取以降低等待，但这会让某次网络请求发生在点击之前。要排查“为什么明明没点击也有请求”，先看预取与可见区域，而不是立刻断定页面重复执行。我们没有用这个小例子测预取收益。"
        },
        {
          "type": "table",
          "headers": [
            "方式",
            "网络与协调范围",
            "观察本例计数器"
          ],
          "rows": [
            [
              "地址栏首次进入",
              "取得新文档并建立客户端环境",
              "从初值零开始"
            ],
            [
              "同站 Link 切 n1/n2",
              "框架协调目标路由分支",
              "共享 notes 布局实例应保留当前计数"
            ],
            [
              "普通 a 整页打开第二篇",
              "重新加载文档",
              "新建客户端环境，计数回零"
            ],
            [
              "浏览器刷新",
              "重新加载当前文档",
              "不是保持旧内存组件树的导航"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "HTTP 测试额外发送 RSC 请求头，验证服务器回 text/x-component，目标笔记为 n2，且不是一个 DOCTYPE 文档。Next 16.4.2 可能先以 307 补齐匹配的 _rsc 参数，辅助函数只跟随同源地址并限制次数。这个行为是测试接近框架请求的一种方法，不是建议业务代码自己维护 _rsc；真实客户端由 Next 管理协议。"
        },
        {
          "type": "paragraph",
          "text": "手动验证的步骤则很具体：打开 n1，把布局计数点到二，点击 Link 第二篇，确认正文变成 n2 且计数仍为二；再点普通 a，确认整页重新加载后变成零。如果不同，先检查实际点击的是哪个元素、Counter 是否仍处于同一个共享布局，以及是否变更了组件 key。HTTP/RSC 验证和这组浏览器验证会分别记录。"
        },
        {
          "type": "reference",
          "title": "Next 官方：链接与导航",
          "url": "https://nextjs.org/docs/app/getting-started/linking-and-navigating",
          "note": "在线文档可能随版本变化；本例锁 16.4.2，关闭预取并用生产 HTTP 记录实际结果。"
        }
      ]
    },
    {
      "id": "failure",
      "title": "页面不存在、端点失败和路由边界，不要混成一种错误",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "notFound 负责当前资源缺失时的路由展示。流式响应有一个实际边界：如果 HTTP 头已经发送，再发现不存在，状态码可能无法改成最初希望的 404。配套测试因此检查缺失 UI 必须出现，并接受此例可能的 200 或 404；它没有据此宣称搜索引擎、CDN 或所有路由都可忽略状态码。需要严格状态语义的 API，应在提交响应前明确验证并返回状态。"
        },
        {
          "type": "code",
          "code": "export async function GET(){return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});}",
          "language": "ts",
          "filename": "examples/next-routing/app/api/ping/route.ts",
          "purpose": "完整 Route Handler。端点返回 JSON，不通过 page/layout 输出页面内容。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "同一地址片段下规划 page 和 route 时，还要避免把两种职责堆到同一条冲突入口。本例把 API 放到 /api/ping，页面留在 /notes/[id]，接口契约清楚。普通运行错误、加载态、Suspense 与 error.tsx 的恢复策略需要另一组完整实验，不在这里用一句“加 error 文件”假装已经交付。"
        },
        {
          "type": "paragraph",
          "text": "再看一次状态反例：如果你把布局 Counter 的 key 设为 params.id，或者离开 notes 分支后回来，就不能沿用“共享布局内切换保留状态”的预期。React 判断的是实际组件身份与挂载关系，框架路由只是组织这些身份的一层。确定性来自范围与前提，而不是背下“布局永远不刷新”这样的绝对句。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "从生产构建开始验证，不用开发日志替代交付证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/next-routing\nnvm use\nnpm ci\nnpm run build\nnpm test\nnpm start\n# 打开 http://127.0.0.1:4321/notes/n1",
          "language": "sh",
          "filename": "终端 · 完整运行流程",
          "purpose": "ZIP 解压后直接进入项目。测试需要已有生产构建，会自行启动并关闭 4321；运行 npm start 前先等测试结束。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "固定环境为 Node 22.12.0、Next 16.4.2、React/React DOM 19.3.1、TypeScript 5.7.2。站点本身使用 React 18，但这是独立服务，不能把实验目录的版本当作站点升级。构建使用 webpack，cacheComponents 未启用；生产构建和四项真实 HTTP/RSC 测试已在 macOS 14.5 x64 通过。"
        },
        {
          "type": "paragraph",
          "text": "测试覆盖首访 HTML、目标 RSC、动态笔记选择与缺失 UI、JSON 端点及两种链接。发布前另用真实浏览器操作确认了 hydration 后的 Counter 点击、Link 切换时保留2、整页导航重置0；文章与图形检查了390px手机视口，但没有做移动真机或返回导航历史的专门验收。也没有部署到 Vercel，不能把本机 Next start 当作所有托管缓存策略的证据。"
        },
        {
          "type": "paragraph",
          "text": "现在可以把一次导航用自己的话解释：URL 选树，布局提供稳定外壳，页面消费目标输入；首次访问建立文档与客户端环境，客户端导航尽量沿现有树协调变化部分。下一篇已有服务端边界文章继续约束数据经过哪里，再往后讲缓存结果是什么、什么时候失效。这样每一层都回答自己的问题，而不是把“全栈框架很方便”当作实现解释。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Next 16.4.2 固定版本源码与文档",
      "url": "https://github.com/vercel/next.js/tree/v16.4.2"
    },
    {
      "title": "Next 官方：布局与页面",
      "url": "https://nextjs.org/docs/app/getting-started/layouts-and-pages"
    },
    {
      "title": "Next 官方：notFound",
      "url": "https://nextjs.org/docs/app/api-reference/functions/not-found"
    }
  ]
};
export default article;
