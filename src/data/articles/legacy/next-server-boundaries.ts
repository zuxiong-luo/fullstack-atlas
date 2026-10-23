import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "next-server-boundaries",
  "topic": "nextjs",
  "title": "Next.js 服务端与客户端边界：用账户页走通渲染、写入与缓存",
  "description": "以 Next.js 16.4.2 的完整本地账户页为例，解释 Server/Client Components、首次与导航请求、私有数据、公开缓存、写后失效及失败恢复。",
  "minutes": 55,
  "labMinutes": 40,
  "tags": [
    "Next.js 16.4.2",
    "RSC",
    "App Router",
    "Data Cache",
    "服务端边界"
  ],
  "scope": "Node 单进程、App Router、未开启 Cache Components；用演示会话和JSON文件验证边界。覆盖真实读写、HTML/RSC请求和显式缓存，不实现生产身份认证、多实例事务或完整RSC协议。",
  "prerequisites": [
    "会写React状态与事件",
    "理解HTTP请求、Cookie与JSON",
    "有Node22环境"
  ],
  "sections": [
    {
      "id": "s16-390231",
      "title": "先分清四个概念：服务器组件、客户端组件、SSR 与 hydration",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Next.js App Router 是围绕路由、React Server Components 与服务端执行环境组织应用的一套框架。它把“组件代码在哪里运行”和“某次访问怎样生成界面”分别处理。Server Component 描述一种服务端组件边界；SSR 描述在服务器生成初始 HTML 的过程；Client Component 提供状态、事件与浏览器交互；hydration 则把客户端交互接到已有 HTML 上。先分清这些对象，后面才好判断一个文件、一条数据和一份缓存分别属于哪里。"
        },
        {
          "type": "paragraph",
          "text": "一个 Server Component 可以直接 await 数据，再返回元素。它自身的模块实现不会作为客户端组件代码发送给浏览器，但返回的内容仍然要进入 HTML 或 RSC Payload。Client Component 通过 use client 建立模块入口，导入的依赖进入客户端模块图；完整页面加载时，它也可能参与服务器预渲染。因此，use client 说明交互代码的边界，不表示可以在渲染时无条件读取 window。"
        },
        {
          "type": "paragraph",
          "text": "RSC Payload 是描述服务端组件结果、客户端组件引用和相关 props 的数据。首次访问通常同时需要 HTML、RSC 结果和客户端 JavaScript：HTML先展示内容，RSC用于协调树，客户端脚本让编辑按钮等交互可用。它们共同组成第一次加载，不能把“服务器生成过 HTML”推成“所有组件代码都会发到浏览器”。"
        },
        {
          "type": "paragraph",
          "text": "本文用一个账户页把这些机制串起来：Alice 与 Bob 各有私人笔记，二人共用一个公开课程目录，只有演示编辑者 Alice 能改公开名称。我们将完整展示读取、编辑、验证、持久化、缓存与刷新链路。项目使用 Next.js 16.4.2、React/React DOM 19.3.1、Node.js 22.12.0，和本站 React 18.3.1 原理实验分开安装；没有把两个版本混在一个运行时中。"
        },
        {
          "type": "paragraph",
          "text": "原稿只有概览与服务端伪代码，这次改成可运行的本地 Node 项目。演示账户切换器允许任何本地访客选择 Alice 或 Bob，目的是建立会话归属实验，不是生产身份认证。存储是单个 JSON 文件，只保证本例单进程内的写入串行；涉及多实例、交易与真实用户时，应换数据库和完整登录系统。"
        },
        {
          "type": "reference",
          "title": "服务器/客户端组件、首次访问与后续导航",
          "url": "https://nextjs.org/docs/app/getting-started/server-and-client-components",
          "note": "官方资料用于核对出处；本文运行环境与 API 行为固定到示例锁定版本。"
        },
        {
          "type": "reference",
          "title": "固定版本的安全修订依据：16.4.1 修复线，示例采用 16.4.2",
          "url": "https://nextjs.org/blog/nextjs-security-update-october-14-2026",
          "note": "官方资料用于核对出处；本文运行环境与 API 行为固定到示例锁定版本。"
        }
      ]
    },
    {
      "id": "project",
      "title": "把项目边界和运行条件摆出来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "示例只依赖 Next、React 与 Node 自带文件/加密 API，不访问远程模型、数据库或付费服务。页面中的目录缓存由 Next 的 Data Cache 管理；浏览器无需知道服务器存储路径或签名密钥。锁文件固定间接依赖，示例配置没有开启 Cache Components，我们显式使用仍受支持的 unstable_cache，避免把不同缓存模型混在同一套说明中。"
        },
        {
          "type": "code",
          "language": "json",
          "filename": "examples/next-server-boundaries/package.json",
          "purpose": "锁定运行和工具依赖。项目使用 webpack 生产构建，避免读者设备上的默认构建器差异干扰本次实验。",
          "kind": "excerpt",
          "code": "{\"name\":\"next-server-boundaries-example\",\"private\":true,\"version\":\"1.0.0\",\"type\":\"module\",\"engines\":{\"node\":\">=22.12.0 <23\"},\"scripts\":{\"dev\":\"next dev --hostname 127.0.0.1 --port 4319\",\"build\":\"next build --webpack\",\"start\":\"next start --hostname 127.0.0.1 --port 4319\",\"test\":\"node --test --test-concurrency=1 test/integration.mjs\",\"typecheck\":\"tsc --noEmit\"},\"dependencies\":{\"next\":\"16.4.2\",\"react\":\"19.3.1\",\"react-dom\":\"19.3.1\",\"server-only\":\"0.0.1\"},\"devDependencies\":{\"@types/node\":\"22.20.5\",\"@types/react\":\"19.2.2\",\"@types/react-dom\":\"19.2.2\",\"typescript\":\"5.7.2\"}}\n"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/next.config.ts",
          "purpose": "明确本地示例的文件追踪根；cacheComponents 保持关闭，后文按这一前提解释缓存。",
          "kind": "excerpt",
          "code": "import type {NextConfig} from 'next';\nconst config:NextConfig={poweredByHeader:false,outputFileTracingRoot:process.cwd()};\n// cacheComponents 保持关闭；显式使用 Data Cache 的 unstable_cache。\nexport default config;\n"
        },
        {
          "type": "code",
          "language": "text",
          "filename": "关键目录",
          "kind": "excerpt",
          "purpose": "下文直接展示全部读写关键文件；tsconfig、next-env 与锁文件属于下载项目的构建脚手架。",
          "code": "app/\n  layout.tsx / page.tsx\n  account/page.tsx / error.tsx\n  components/Login.tsx / Editor.tsx\n  api/session/route.ts\n  api/account/route.ts\n  api/note/route.ts\n  api/catalog/route.ts\nlib/\n  auth.ts / http.ts / store.ts / catalog.ts\ntest/integration.mjs\n.env.example / package-lock.json"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "从完整仓库根目录开始；独立ZIP解压后进入示例目录即可。首次安装依赖需要网络。",
          "code": "cd examples/next-server-boundaries\nnvm use\nnpm ci\ncp .env.example .env.local\nnpm run build\nnpm test\nnpm start"
        },
        {
          "type": "paragraph",
          "text": "不用 nvm 时，先手动准备 Node 22.12.0，再跳过 nvm use。浏览器打开 http://127.0.0.1:4319，使用示例指定的域名和端口；写请求的 Origin 必须与 DEMO_APP_ORIGIN 完全一致。DEMO_SESSION_SECRET 至少32字符；示例值只用于本地教学，真实部署要换随机密钥。npm test 在自己的临时数据目录启动生产服务器，不会覆盖 data/state.json，但会清理该示例 .next/cache，所以不要和同目录正在运行的服务并行测试。"
        }
      ]
    },
    {
      "id": "s18-200107",
      "title": "模块边界：Page 读取数据，Editor 只接收必要结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/next-server-boundaries/boundaries.svg",
          "title": "代码执行边界与数据发送边界分别检查",
          "alt": "服务器内的认证和存储模块返回账户DTO给Server Page，Page把初始笔记和编辑许可传给浏览器Editor，浏览器POST回Route Handler重新校验。",
          "caption": "本项目的结构/顺序示意；不表示耗时或生产部署拓扑。"
        },
        {
          "type": "paragraph",
          "text": "先沿一条读取路径走：浏览器请求 /account，AccountPage 调用 requireUser 得到已验证的 alice；readAccount 以这个ID读取自己的记录；getCatalog 读取可公开共享的目录。页面只向 Editor 传 initialNote 与 canEditCatalog。身份判断在服务器完成，但发出的初始笔记已经是浏览器可以读取的数据。不要把 Server Component 当作“返回什么都保密”的容器。"
        },
        {
          "type": "code",
          "language": "tsx",
          "filename": "examples/next-server-boundaries/app/account/page.tsx",
          "purpose": "完整 Server Component。cookies在认证函数中读取，使这个账户页面按请求执行；两个独立读操作并行等待。",
          "kind": "excerpt",
          "code": "import {requireUser,RequestFailure} from '@/lib/auth';\nimport {readAccount} from '@/lib/store';\nimport {getCatalog} from '@/lib/catalog';\nimport Editor from '../components/Editor';\nimport {redirect} from 'next/navigation';\nexport default async function AccountPage(){\n let id;\n try{id=await requireUser();}catch(error){if(error instanceof RequestFailure&&error.status===401)redirect('/');throw error;}\n const [account,catalog]=await Promise.all([readAccount(id),getCatalog()]);\n return <main><h1>{account.displayName} 的账户</h1><p>当前私人笔记：{account.note}</p>\n  <h2>公开内容：{catalog.title}</h2><p>目录版本 {catalog.revision} · 来源读取标识 {catalog.readId}</p>\n  <Editor key={account.id} initialNote={account.note} canEditCatalog={id==='alice'}/>\n </main>;\n}\n"
        },
        {
          "type": "paragraph",
          "text": "无会话时，requireUser 抛出带401的 RequestFailure，页面将用户重定向到首页；其它服务异常继续抛给路由错误边界。redirect 放在 catch 的条件分支里，后面不再用一个大 catch 把框架重定向异常误当业务错误吞掉。readAccount 返回的 DTO 只有显示所需字段，服务端内部 token 没有传给客户端。"
        },
        {
          "type": "code",
          "language": "tsx",
          "filename": "examples/next-server-boundaries/app/components/Editor.tsx",
          "purpose": "完整 Client Component。它承担输入状态、事件、错误显示和刷新请求，不导入服务端存储或签名模块。",
          "kind": "excerpt",
          "code": "'use client';\nimport {useState} from 'react';\nimport {useRouter} from 'next/navigation';\nexport default function Editor({initialNote,canEditCatalog}:{initialNote:string;canEditCatalog:boolean}){\n const router=useRouter();const [note,setNote]=useState(initialNote),[title,setTitle]=useState('');\n const [busy,setBusy]=useState(false),[message,setMessage]=useState('');\n async function save(url:string,payload:Record<string,string>){\n  setBusy(true);setMessage('');\n  try{\n   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});\n   const data=await response.json();if(!response.ok)throw new Error(data.error+(data.requestId?' · '+data.requestId:''));\n   setMessage('保存成功，正在读取最新视图');router.refresh();\n  }catch(error){setMessage(error instanceof Error?error.message:'网络不可用，请稍后重试');}\n  finally{setBusy(false);}\n }\n return <section><h2>私人笔记</h2><label>笔记 <input value={note} maxLength={80} onChange={e=>setNote(e.target.value)}/></label>{' '}\n  <button disabled={busy} onClick={()=>save('/api/note',{note})}>保存自己的笔记</button>\n  {canEditCatalog&&<div><h2>公开目录管理</h2><input aria-label=\"新目录名称\" value={title} maxLength={80} onChange={e=>setTitle(e.target.value)}/>{' '}\n   <button disabled={busy} onClick={()=>save('/api/catalog',{title})}>保存公开目录</button></div>}\n  <p role=\"status\">{message}</p></section>;\n}\n"
        },
        {
          "type": "paragraph",
          "text": "初始值来自本次服务器结果。点击保存时，Editor 把 note 发到 /api/note；只有服务器返回成功才调用 router.refresh。refresh 会请求当前路由的新服务端结果并与现有客户端树协调，保留适用的客户端状态。这里输入框本地 state 不会因 initialNote prop 变化自动重置，正好避免把用户尚未提交的草稿覆盖掉；需要服务端规范化后回填或外部编辑同步时，应明确实现重置规则。切换账户则用完整导航销毁上个账户的草稿与路由内存。"
        },
        {
          "type": "paragraph",
          "text": "隐藏公开目录编辑按钮只是界面提示，真正的权限检查在写接口。即使把 canEditCatalog 改成 true 或直接手工发请求，Bob 仍会被服务器拒绝。server-only 导入提供构建期保护：若把这些服务端模块直接导入 Editor，Next会报告边界错误；DTO筛选则解决另一件事——服务端主动返回了哪些数据。"
        }
      ]
    },
    {
      "id": "session",
      "title": "会话例子：先确定谁在请求，再决定读取哪一行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/lib/auth.ts",
          "purpose": "完整会话与Origin实现。HMAC确认cookie未被改动，过期时间限制有效期；Origin从服务端可信配置读取。",
          "kind": "excerpt",
          "code": "import 'server-only';\nimport {cookies} from 'next/headers';\nimport {createHmac,timingSafeEqual} from 'node:crypto';\nimport type {UserId} from './store';\nexport class RequestFailure extends Error{constructor(public status:number,message:string){super(message);}}\nfunction sign(value:string){\n const secret=process.env.DEMO_SESSION_SECRET;\n if(!secret||secret.length<32)throw new Error('Set DEMO_SESSION_SECRET to at least 32 characters');\n return createHmac('sha256',secret).update(value).digest('hex');\n}\nexport function createSession(id:UserId){const value=id+'.'+(Date.now()+3600000);return value+'.'+sign(value);}\nexport async function requireUser():Promise<UserId>{\n const token=(await cookies()).get('demo-session')?.value||'';\n const [id,expires,signature,...extra]=token.split('.');\n if(extra.length||(id!=='alice'&&id!=='bob')||!/^\\d+$/.test(expires||'')||!signature||!/^[a-f0-9]{64}$/.test(signature))throw new RequestFailure(401,'请先选择演示账户');\n const expected=Buffer.from(sign(id+'.'+expires),'hex'),actual=Buffer.from(signature,'hex');\n if(actual.length!==expected.length||!timingSafeEqual(actual,expected)||Number(expires)<=Date.now())throw new RequestFailure(401,'会话无效或已过期');\n return id;\n}\nexport function requireSameOrigin(request:Request){\n const expected=process.env.DEMO_APP_ORIGIN||'http://127.0.0.1:4319';\n if(request.headers.get('origin')!==expected)throw new RequestFailure(403,'拒绝跨站写入');\n}\n"
        },
        {
          "type": "paragraph",
          "text": "createSession 先组合 id 与一小时后的过期时间，再附上 HMAC 签名。requireUser 对形状、ID、签名长度与过期条件逐一检查，验证通过才返回 UserId。请求里没有独立的 ownerId 可覆盖这个结果。HMAC的含义是检测改动，不是加密：cookie值中的用户名与过期时间仍是明文。HttpOnly阻止普通脚本读取cookie，但不替代身份验证或防御所有跨站攻击。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/app/api/session/route.ts",
          "purpose": "完整演示账户切换接口。任何本地用户可选择两个固定演示ID；签名token只写HttpOnly cookie，不出现在JSON响应正文。",
          "kind": "excerpt",
          "code": "import {NextResponse} from 'next/server';\nimport {createSession,RequestFailure,requireSameOrigin} from '@/lib/auth';\nimport {handle,textInput} from '@/lib/http';\nexport async function POST(request:Request){\n let user:'alice'|'bob'|undefined;\n const result=await handle(async()=>{\n  requireSameOrigin(request);const id=await textInput(request,'user');\n  if(id!=='alice'&&id!=='bob')throw new RequestFailure(400,'未知演示账户');\n  user=id;return {ok:true,token:createSession(id)};\n });\n if(!user||!result.ok)return result;\n const data=await result.json();\n const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});\n response.cookies.set('demo-session',data.token,{\n  httpOnly:true,sameSite:'lax',secure:process.env.DEMO_SECURE_COOKIE==='1',path:'/',maxAge:3600,\n });\n return response;\n}\n"
        },
        {
          "type": "code",
          "language": "tsx",
          "filename": "examples/next-server-boundaries/app/components/Login.tsx",
          "purpose": "完整演示入口；切换账号后使用完整导航，销毁原账户页面状态。",
          "kind": "excerpt",
          "code": "'use client';\nimport {useState} from 'react';\nexport default function Login(){\n const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);\n async function enter(user:'alice'|'bob'){\n  setBusy(true);setMessage('');\n  try{\n   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user})});\n   const data=await response.json();if(!response.ok)throw new Error(data.error);\n   window.location.assign('/account');\n  }catch(error){setMessage(error instanceof Error?error.message:'网络错误');setBusy(false);}\n }\n return <section><p>这是本地账号切换器，任何访客都可选择两个演示账号。它没有验证真实身份。</p>\n  <button disabled={busy} onClick={()=>enter('alice')}>使用 Alice</button>{' '}\n  <button disabled={busy} onClick={()=>enter('bob')}>使用 Bob</button><p role=\"status\">{message}</p>\n </section>;\n}\n"
        },
        {
          "type": "code",
          "language": "tsx",
          "filename": "examples/next-server-boundaries/app/page.tsx",
          "purpose": "首页接入演示切换器；它也是一个 Server Component，只把交互交给 Login。",
          "kind": "excerpt",
          "code": "import Login from './components/Login';\nexport default function Home(){return <main><h1>Next.js 服务端与客户端边界实验</h1><p>公开目录可跨请求缓存，个人笔记按会话读取。请选择演示账户。</p><Login/></main>;}\n"
        },
        {
          "type": "paragraph",
          "text": "这里刻意把“识别一个已建立的会话”和“证明此人有权获得这个会话”分开讲。签名能阻止把 alice cookie篡改为 bob，却无法让一个公开提供账户切换的演示接口变成真实登录。真实系统要在创建会话之前完成密码或OIDC认证、风控等步骤，并提供撤销、密钥轮换和HTTPS cookie策略。本文不把可选演示账号声称为生产认证。"
        },
        {
          "type": "paragraph",
          "text": "Origin检查使用固定 DEMO_APP_ORIGIN，不直接信任请求Host或代理重建后的 request.url。生产代理必须把应用公开源配置正确；示例默认127.0.0.1:4319，本地改成localhost也要同步改环境变量。浏览器同源fetch会发送Origin，跨站来源或缺少Origin的写请求都会返回403。需要服务间调用时，应单独设计认证接口，而不是关闭浏览器写接口的检查。"
        }
      ]
    },
    {
      "id": "storage",
      "title": "存储与DTO：哪些内容读取，哪些内容发送",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/lib/store.ts",
          "purpose": "完整文件存储。初始化、读取、按身份投影、单进程串行修改与临时文件原子替换都在本页。",
          "kind": "excerpt",
          "code": "import 'server-only';\nimport {mkdir,readFile,writeFile,rename} from 'node:fs/promises';\nimport {dirname,resolve} from 'node:path';\nimport {randomUUID} from 'node:crypto';\nexport type UserId='alice'|'bob';\ntype Store={catalog:{title:string;revision:number};users:Record<UserId,{displayName:string;note:string;internalToken:string}>};\nconst file=resolve(process.env.DEMO_DATA_FILE||'data/state.json');\nconst initial:Store={catalog:{title:'公开课程目录',revision:1},users:{\n alice:{displayName:'Alice',note:'Alice的私人笔记',internalToken:'server-alice-token'},\n bob:{displayName:'Bob',note:'Bob的私人笔记',internalToken:'server-bob-token'},\n}};\nasync function load():Promise<Store>{\n await mkdir(dirname(file),{recursive:true});\n try{await writeFile(file,JSON.stringify(initial),{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}\n return JSON.parse(await readFile(file,'utf8')) as Store;\n}\n// 同一 Node 进程内串行修改，避免两个请求同时读旧版本后相互覆盖。\nconst shared=globalThis as typeof globalThis & {__atlasDemoWrites?:Promise<unknown>};\nfunction change(edit:(data:Store)=>void):Promise<void>{\n const run=(shared.__atlasDemoWrites||Promise.resolve()).then(async()=>{\n  const data=await load();edit(data);const temp=file+'.'+randomUUID()+'.tmp';\n  await writeFile(temp,JSON.stringify(data));await rename(temp,file);\n });\n shared.__atlasDemoWrites=run.catch(()=>{});return run;\n}\nexport async function readAccount(id:UserId){\n const user=(await load()).users[id];\n // internalToken 不进入页面、RSC props 或 API。\n return {id,displayName:user.displayName,note:user.note};\n}\nexport async function readCatalog(){return {...(await load()).catalog,readId:randomUUID()};}\nexport function writeNote(id:UserId,note:string){return change(data=>{data.users[id].note=note;});}\nexport function writeCatalog(title:string){return change(data=>{data.catalog={title,revision:data.catalog.revision+1};});}\n"
        },
        {
          "type": "paragraph",
          "text": "初始JSON有公开catalog和两份user记录。Alice行包含displayName、note、internalToken；readAccount只选择前两项并加上ID。因此源文件和服务器存储里有演示token，不代表它进入HTML、RSC或客户端包。我们对这三种输出分别检查，而不只检查浏览器JavaScript。"
        },
        {
          "type": "paragraph",
          "text": "写入先进入共享Promise链，等前一次修改结束再读取最新文件，修改后写临时文件并rename替换。这样本例两个并发请求不会都从同一旧快照写回，把其中一个覆盖掉。Promise失败被链尾消化，让下一次修改仍可继续；原调用者仍拿到拒绝，由接口转换成503。"
        },
        {
          "type": "paragraph",
          "text": "这只覆盖同一Node进程中的顺序与完整文件替换。另一个进程有自己的全局Promise，仍可能竞争；文件系统也没有提供跨业务记录事务、唯一约束与审计。这里选JSON是为了没有额外服务也能复现完整链路，代价是需要明确单进程、本地可写磁盘与小数据量。serverless临时磁盘、多实例部署要改持久化方案。"
        }
      ]
    },
    {
      "id": "s10-261709",
      "title": "缓存契约：公开数据共享，私人结果按请求读取",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/next-server-boundaries/cache-flow.svg",
          "title": "公开目录缓存复用与写后失效顺序",
          "alt": "两次公开目录读取共用readId，Alice写入后使标签立即过期，下一次刷新获得新版本；私人笔记每次先从cookie取得用户ID再读取。",
          "caption": "本项目的结构/顺序示意；不表示耗时或生产部署拓扑。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/lib/catalog.ts",
          "purpose": "完整公开目录缓存封装。keyParts标明该数据版本，tag负责批量失效，revalidate表示时间策略。",
          "kind": "excerpt",
          "code": "import 'server-only';\nimport {unstable_cache} from 'next/cache';\nimport {readCatalog} from './store';\nexport const getCatalog=unstable_cache(readCatalog,['atlas-public-catalog-v1',process.env.DEMO_DATA_FILE||'default-local-data'],{\n tags:['atlas-public-catalog'],revalidate:60,\n});\n"
        },
        {
          "type": "paragraph",
          "text": "先明确缓存对象：缓存的是readCatalog返回的公开目录快照。两个请求命中同一结果时，title、revision、readId都相同；readId只在真正读取源文件时生成，便于验证复用，不能当作性能测量值。缓存键包括函数表示、调用参数与额外keyParts；此处数据文件位置由环境闭包决定，所以也加入keyParts，避免测试临时数据和本地默认文件误命中同一缓存。tag是失效分组，不是缓存键，也不是身份权限。"
        },
        {
          "type": "paragraph",
          "text": "私有的readAccount没有包进unstable_cache，页面先await cookies取得身份，每次按该ID读取。不要把整个账户页的查询封装成不接收userId的共享闭包缓存：一旦读到某个用户后命中同一键，正确验签也无法阻止返回别人的缓存结果。如果确实要缓存私有数据，必须在缓存之外验证身份，把ID和影响结果的权限版本作为明确输入，并设计撤权后的失效策略。"
        },
        {
          "type": "table",
          "headers": [
            "层次",
            "本例缓存对象/条件",
            "如何更新或失效"
          ],
          "rows": [
            [
              "服务端Data Cache",
              "公开catalog，函数+参数+keyParts；tag分组，60秒时间策略",
              "Alice写成功后按tag立即过期；自然时间策略可能先提供旧值并在后台重取"
            ],
            [
              "账户服务端结果",
              "读取cookies后按请求生成；私有读取没有显式共享缓存",
              "每次新请求校验身份并读对应行"
            ],
            [
              "客户端Router Cache/本地state",
              "浏览器的路由结果与Editor草稿",
              "router.refresh更新服务端结果；切换账号完整导航"
            ],
            [
              "浏览器/CDN响应缓存",
              "API明确private,no-store；页面按请求执行",
              "不把no-store响应当作共享快照；代理部署另核对缓存头"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "60秒是数据缓存的重新验证策略，不表示每隔60秒必有后台定时器主动更新，也不承诺第61秒每个请求都等待新值。时间重验证与显式立即过期的语义不同。本例写后使用{expire:0}，要求下次读取不继续返回旧内容；后面的HTTP测试分别验证命中与失效。"
        },
        {
          "type": "paragraph",
          "text": "这里没有把React的请求内去重、服务器Data Cache、路由产物和CDN统称一个“缓存”。Server Component直接调用服务函数，也不必为了复用JSON接口而绕到自己的/api发HTTP；浏览器或外部客户端需要接口时才走Route Handler。本文服务端没有使用fetch，因此不把框架不同版本的fetch默认缓存结论套在文件读取上。"
        },
        {
          "type": "reference",
          "title": "unstable_cache：输入参与键、tags用于失效、请求上下文在外部读取",
          "url": "https://nextjs.org/docs/app/api-reference/functions/unstable_cache",
          "note": "官方资料用于核对出处；本文运行环境与 API 行为固定到示例锁定版本。"
        }
      ]
    },
    {
      "id": "s14-336522",
      "title": "一次写入：验证、持久化、失效和刷新分别完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/lib/http.ts",
          "purpose": "完整输入与错误边界。限制类型、字段和长度，业务拒绝返回明确状态，意外错误只给请求ID。",
          "kind": "excerpt",
          "code": "import 'server-only';\nimport {randomUUID} from 'node:crypto';\nimport {RequestFailure} from './auth';\nexport async function textInput(request:Request,key:string){\n if(!request.headers.get('content-type')?.startsWith('application/json'))throw new RequestFailure(415,'需要 JSON');\n const raw=await request.text();if(raw.length>2048)throw new RequestFailure(413,'请求过大');\n let body:unknown;try{body=JSON.parse(raw);}catch{throw new RequestFailure(400,'JSON 格式错误');}\n if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!==key))throw new RequestFailure(400,'字段不符合接口约定');\n const value=(body as Record<string,unknown>)[key];\n if(typeof value!=='string'||value.trim().length<1||value.trim().length>80)throw new RequestFailure(400,'请输入 1～80 字符');\n return value.trim();\n}\nexport function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}\nexport async function handle(work:()=>Promise<unknown>){\n try{return json(await work());}catch(error){\n  if(error instanceof RequestFailure)return json({error:error.message},error.status);\n  const requestId=randomUUID();console.error('[next-boundary-error]',{requestId,error});\n  return json({error:'服务暂时不可用',requestId},503);\n }\n}\n"
        },
        {
          "type": "paragraph",
          "text": "request.text之后检查字符长度让教学输入有上界，但它仍先把请求体读入内存；生产服务还应在反向代理或框架入口限制原始字节数，不能把这2048字符检查当作抗大包DoS方案。验证拒绝额外字段，所以客户端同时传note和userId会返回400；更新对象归属从服务器会话取得。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/app/api/note/route.ts",
          "purpose": "完整私人笔记写接口。先检查Origin与身份，再验输入；writeNote的ID只来自会话。",
          "kind": "excerpt",
          "code": "import {requireUser,requireSameOrigin} from '@/lib/auth';\nimport {handle,textInput} from '@/lib/http';\nimport {writeNote} from '@/lib/store';\nimport {revalidatePath} from 'next/cache';\nexport async function POST(request:Request){return handle(async()=>{\n requireSameOrigin(request);const id=await requireUser();const note=await textInput(request,'note');\n await writeNote(id,note);revalidatePath('/account');return {ok:true};\n});}\n"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/app/api/catalog/route.ts",
          "purpose": "完整公共读写接口。公开GET读取Data Cache，POST在服务端检查Alice权限，写成功后立即使tag过期。",
          "kind": "excerpt",
          "code": "import {requireUser,requireSameOrigin,RequestFailure} from '@/lib/auth';\nimport {handle,textInput} from '@/lib/http';\nimport {writeCatalog} from '@/lib/store';\nimport {getCatalog} from '@/lib/catalog';\nimport {revalidateTag,revalidatePath} from 'next/cache';\nexport async function GET(){return handle(getCatalog);}\nexport async function POST(request:Request){return handle(async()=>{\n requireSameOrigin(request);const id=await requireUser();\n if(id!=='alice')throw new RequestFailure(403,'只有演示编辑者 Alice 可以修改公开目录');\n const title=await textInput(request,'title');await writeCatalog(title);\n revalidateTag('atlas-public-catalog',{expire:0});revalidatePath('/account');\n return {ok:true};\n});}\n"
        },
        {
          "type": "paragraph",
          "text": "带入Alice修改公开课程名称：Origin匹配，签名会话得到alice，权限判断通过，textInput得到trim后的标题；writeCatalog先把revision从1变2，成功后才调用revalidateTag(tag,{expire:0})和revalidatePath。返回200只表示此请求的写入和失效调用完成；浏览器还要router.refresh请求新RSC，界面才会看到新revision。"
        },
        {
          "type": "paragraph",
          "text": "这里选择Route Handler，所以立即失效用revalidateTag的双参数形式。revalidateTag(tag,\"max\")采用先返回旧内容、后台重取的策略，适合允许短暂旧数据的公开信息；本例编辑后希望看到自己的新结果，因此用expire:0。updateTag只可在Server Action内调用，不能直接挪进本接口。若以后改成Server Action，仍需保留身份、归属、输入校验；use server也不替这些检查。"
        },
        {
          "type": "paragraph",
          "text": "失效和客户端刷新处理的是不同层次。仅router.refresh时，服务器仍可能命中旧Data Cache；仅revalidateTag时，当前浏览器也不会自动把已有界面替换掉。revalidatePath针对路由路径，不等于让所有使用同tag的其它页面都同时失效。接口失效与新请求配合，才走完本例写后读取。"
        },
        {
          "type": "paragraph",
          "text": "再看Bob直接POST目录：cookie验证成功，只能说明“他是Bob”；服务端权限判断仍返回403，数据不变。重复提交同一个标题则会再加一次revision，本例不是订单或支付，所以没有实现请求幂等。涉及扣款、发货等不可重复业务，必须另加幂等键与事务，不能拿按钮disabled代替。"
        },
        {
          "type": "reference",
          "title": "revalidateTag：max与立即过期的语义",
          "url": "https://nextjs.org/docs/app/api-reference/functions/revalidateTag",
          "note": "官方资料用于核对出处；本文运行环境与 API 行为固定到示例锁定版本。"
        },
        {
          "type": "reference",
          "title": "updateTag只可在Server Action使用",
          "url": "https://nextjs.org/docs/app/api-reference/functions/updateTag",
          "note": "官方资料用于核对出处；本文运行环境与 API 行为固定到示例锁定版本。"
        },
        {
          "type": "reference",
          "title": "revalidatePath针对路径，和tag失效范围不同",
          "url": "https://nextjs.org/docs/app/api-reference/functions/revalidatePath",
          "note": "官方资料用于核对出处；本文运行环境与 API 行为固定到示例锁定版本。"
        }
      ]
    },
    {
      "id": "navigation",
      "title": "首次访问和站内导航：数据怎样走到页面",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "tsx",
          "filename": "examples/next-server-boundaries/app/layout.tsx",
          "purpose": "布局提供两个真实Link；关闭自动prefetch便于第一次观察Network，生产站点应按体验决定预取策略。",
          "kind": "excerpt",
          "code": "import Link from 'next/link';\nimport type {ReactNode} from 'react';\nexport default function Layout({children}:{children:ReactNode}){\n return <html lang=\"zh-CN\"><body style={{fontFamily:'system-ui',maxWidth:850,margin:'32px auto',padding:20,lineHeight:1.8}}>\n  <nav style={{display:'flex',gap:24}}><Link href=\"/\" prefetch={false}>首页</Link><Link href=\"/account\" prefetch={false}>账户页</Link></nav>\n  {children}\n </body></html>;\n}\n"
        },
        {
          "type": "paragraph",
          "text": "首次从首页选择Alice后，Login先POST拿cookie，再完整导航到/account。服务器验证cookie、读取两份数据、执行Page，返回初始HTML与RSC相关数据；浏览器下载Editor脚本后绑定输入与保存事件。测试会直接请求HTML，确认页面已有Alice笔记和按钮文字，并验证内部token没有出现在这份输出中。"
        },
        {
          "type": "paragraph",
          "text": "以后在首页与账户页的Link之间切换，App Router可以请求RSC而不是重新获取整份文档，更新变化的页面部分并复用布局。路由缓存、预取和访问历史会影响是否出现新请求；本例prefetch=false只为降低第一次观察的干扰，不代表每次导航都必然重新执行所有服务端函数。"
        },
        {
          "type": "paragraph",
          "text": "在DevTools的Network打开Preserve log：完整导航关注Document与JS；站内点击Link关注路由数据请求及text/x-component响应。RSC请求可能带_rsc参数与路由状态相关请求头，那些属于Next内部协议，业务代码不要自己硬编码。集成测试以RSC请求头核对Payload，并保留同源307补齐_rsc参数的过程；这只能验证HTTP协议路径，不能替代真实浏览器hydration或键盘交互测试。"
        },
        {
          "type": "paragraph",
          "text": "如果首页是静态产物而账户页是动态响应，这是同一应用的合理组合：首页不读个人上下文，账户页读取cookies。Server Component并不自动等于静态，Client Component也不自动等于完全浏览器首次渲染。判断时回到这次访问的数据依赖与具体输出。"
        }
      ]
    },
    {
      "id": "failures",
      "title": "错误怎样表现：接口拒绝和页面失败分开看",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "tsx",
          "filename": "examples/next-server-boundaries/app/account/error.tsx",
          "purpose": "完整路由错误边界。只展示可理解的提示和重试按钮，服务器日志保存内部细节。",
          "kind": "excerpt",
          "code": "'use client';\nexport default function ErrorPage({reset}:{reset:()=>void}){\n return <main><h1>账户数据暂时不可用</h1><p>服务端会记录错误详情，页面不展示内部堆栈或凭据。</p><button onClick={reset}>重试</button></main>;\n}\n"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/next-server-boundaries/app/api/account/route.ts",
          "purpose": "完整JSON读接口，用于双账户隔离与后端失败验证；没有把内部行直接序列化。",
          "kind": "excerpt",
          "code": "import {requireUser} from '@/lib/auth';\nimport {handle} from '@/lib/http';\nimport {readAccount} from '@/lib/store';\nexport async function GET(){return handle(async()=>readAccount(await requireUser()));}\n"
        },
        {
          "type": "table",
          "headers": [
            "输入或故障",
            "可观察结果",
            "判断依据"
          ],
          "rows": [
            [
              "未登录读取API / 页面",
              "401 JSON / 重定向首页",
              "读取开始前取得身份"
            ],
            [
              "Bob修改公共目录",
              "403",
              "认证通过后仍需权限"
            ],
            [
              "空值、额外ownerId、坏JSON",
              "400；媒体类型错误415；过长413",
              "输入契约在服务器执行"
            ],
            [
              "Origin不匹配或缺失",
              "403",
              "固定服务端可信源"
            ],
            [
              "存储JSON损坏",
              "API 503+requestId；页面进入错误边界",
              "日志有细节，响应无堆栈"
            ],
            [
              "网络断开或非2xx",
              "Editor保留草稿并显示错误",
              "只有成功才refresh"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "在本地复现后端失败前先备份data/state.json，再把内容临时改成不完整JSON；请求/api/account会得到503和requestId，终端日志可用同一ID定位JSON解析异常。恢复文件后再次请求应成功。集成测试对临时文件做同样操作并在finally恢复，避免把一条故障用例污染后面的验证。"
        },
        {
          "type": "paragraph",
          "text": "写存储成功与失效成功之间仍有故障窗口。如果磁盘已提交但随后失效异常，接口可能返回503，读者应先用原始存储和revision判断写入是否已经发生。这个本地项目不提供跨文件与缓存的原子事务，也未实现持久化失效重试；生产系统需要根据一致性要求增加outbox、重试或版本化读取，不能从本例“正常流程通过”推导所有故障都能自动恢复。"
        }
      ]
    },
    {
      "id": "s12-338026",
      "title": "验证结果、理解检查与部署取舍",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "验证要区分三个证据：生产build确认框架与类型能生成产物；HTTP集成确认真实服务的会话、HTML/RSC、读写与缓存行为；浏览器检查确认hydration、按钮、导航与布局。前两项已经实际执行，后一项需按整合记录验收。不能把一次server render字符串测试说成完整浏览器交互通过。"
        },
        {
          "type": "paragraph",
          "text": "集成用例启动真实next start，使用独立临时文件与随机端口，完成8类检查：首屏HTML不含内部token、RSC路径、缺失/篡改/过期会话、双账户读写隔离、公开缓存命中与失效、非法请求、503恢复，以及客户端JS无服务端token和签名环境变量。命中由相同readId验证，失效由新readId与revision+1验证，不以请求耗时作为推断。"
        },
        {
          "type": "paragraph",
          "text": "理解检查一：服务端验签成功后，能否把完整user记录传给Editor？解析：不能按“在服务器查到的”决定发送范围；所有props都是数据发送边界。本文readAccount的DTO筛选才是防止internalToken泄漏的关键，server-only主要保护模块实现的导入边界。"
        },
        {
          "type": "paragraph",
          "text": "理解检查二：笔记已经写进文件，router.refresh之后公开目录还旧，应该先检查哪里？解析：两种数据读取策略不同。私人笔记每次按会话读文件，公开目录可能命中Data Cache；应核对写了哪份数据、tag是否一致、失效是否执行及采用的是max还是expire:0，而不是给整个页面随机加key强制重挂载。"
        },
        {
          "type": "paragraph",
          "text": "理解检查三：为什么不能直接把它上传GitHub Pages保留写操作？解析：Pages托管静态文件，没有运行Node服务、处理cookie验签、文件写入或Route Handler的进程。本站可以公开阅读和下载此示例，项目本身需在支持当前Next版本的Node环境运行。单机演示可保留本地文件；多实例上线要换持久数据库、可靠认证和符合实际代理的缓存策略。"
        },
        {
          "type": "paragraph",
          "text": "本篇完成的是一个有明确边界的App Router账户页，不是流式SSR、RSC协议实现或完整身份系统。后续扩展时，先为数据写清读取者、缓存键、有效期和失效事件，再决定用哪一个API；这样框架版本改变时，你仍能用输入、输出和测试验证自己的设计。"
        }
      ]
    }
  ],
  "questionIds": [
    "next-server-boundaries-rsc",
    "next-server-boundaries-cache"
  ],
  "references": [
    {
      "title": "Next.js 服务器与客户端组件",
      "url": "https://nextjs.org/docs/app/getting-started/server-and-client-components"
    },
    {
      "title": "Next.js unstable_cache",
      "url": "https://nextjs.org/docs/app/api-reference/functions/unstable_cache"
    },
    {
      "title": "Next.js revalidateTag",
      "url": "https://nextjs.org/docs/app/api-reference/functions/revalidateTag"
    },
    {
      "title": "Next.js 2026-10-14安全修订",
      "url": "https://nextjs.org/blog/nextjs-security-update-october-14-2026"
    }
  ],
  "status": "review",
  "kind": "tutorial",
  "versions": [
    "Next.js 16.4.2",
    "React / React DOM 19.3.1",
    "Node.js 22.12.0",
    "TypeScript 5.7.2"
  ],
  "verifiedAt": "2026-10-23",
  "examples": [
    {
      "label": "完整本地项目ZIP",
      "path": "next-server-boundaries.zip"
    },
    {
      "label": "安装、运行与输入",
      "path": "next-server-boundaries/README.md"
    },
    {
      "label": "实际核验与限制",
      "path": "next-server-boundaries/VERIFICATION.md"
    }
  ]
};
export default article;
