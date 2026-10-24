import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "next-data-cache",
  "topic": "nextjs",
  "title": "Next.js 数据与缓存：缓存对象、作用域和失效",
  "description": "把单次渲染去重、跨请求数据缓存、路由载荷与 HTTP 缓存分开；用真实读取标记复现命中、旧值窗口、标签失效和故障恢复。",
  "minutes": 45,
  "labMinutes": 30,
  "tags": [
    "Next.js",
    "Data Cache",
    "React cache",
    "失效",
    "revalidateTag",
    "一致性"
  ],
  "scope": "固定 Next 16.4.2、cacheComponents 关闭，显式使用 unstable_cache 和 React cache 实测各自范围。受控单写者 JSON 目录作为数据源；不实现多实例缓存协调、Cache Components 完整迁移或生产数据库并发写入。",
  "prerequisites": [
    "理解 App Router 的 HTML 首访与 RSC 导航",
    "能读异步函数，知道数据源和 HTTP 响应是不同层"
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
      "path": "next-data-cache.zip"
    },
    {
      "label": "安装和复现说明",
      "path": "next-data-cache/README.md"
    }
  ],
  "sections": [
    {
      "id": "definition",
      "title": "缓存是什么：保存某个计算结果，按一套条件复用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "缓存把已经取得的结果留下，在条件允许时再次使用。它的价值是省掉重复工作，但代价也明确：保存的数据占空间，来源变更后旧值可能继续可见，而且“什么时候算同一份请求”必须有一致定义。讨论 Next 缓存，先问保存的对象、查找键、作用范围、过期方式与失败行为，不要一上来就在页面顶部随机加 no-store。"
        },
        {
          "type": "paragraph",
          "text": "知识笔记应用有一个公开课程目录，字段是 title 与 revision。每次真正读底层文件时，额外生成 readId。revision 表示受控数据版本，readId 表示这一次读取；连续请求看到同一个 readId，才有证据说明某个结果被复用了。我们不使用毫秒差推测缓存，因为本地文件读取即使没有缓存也可能非常快。"
        },
        {
          "type": "paragraph",
          "text": "Next 16 推荐启用 Cache Components 并使用 use cache；本篇刻意沿用本站已有边界示例的 cacheComponents 关闭路线，用仍可运行的 unstable_cache 验证跨请求缓存。两套配置不能混写成同一个默认行为。这里的结论固定为 16.4.2、webpack 生产构建；在线最新文档当前是 16.4.3，引用用于核对概念，实验版本由锁文件和真实结果负责。"
        },
        {
          "type": "figure",
          "src": "figures/next-data-cache/scopes.svg",
          "title": "四种常被混在一起的对象",
          "alt": "React cache 在单次服务端组件渲染中去重；unstable_cache 跨请求复用；底层文件有自己的值；HTTP 与客户端路由缓存另有职责。",
          "caption": "箭头表示需要真实读取时访问数据源，不表示这些缓存共享相同生命周期或失效策略。"
        }
      ]
    },
    {
      "id": "objects",
      "title": "先区分层次，才知道 refresh 或 no-store 改了哪一个",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "机制",
            "缓存或复用的对象",
            "范围与关键限制"
          ],
          "rows": [
            [
              "React cache(fn)",
              "这次服务端组件渲染中 fn 的结果",
              "同一包装函数与相同参数；不是全进程永久 Map"
            ],
            [
              "unstable_cache(fn)",
              "昂贵读取的返回值",
              "跨请求 Data Cache；键与标签要显式设计"
            ],
            [
              "Full Route Cache",
              "可缓存路由的渲染输出",
              "动态请求与配置会影响；本篇页面 connection 强制请求时渲染"
            ],
            [
              "客户端 Router Cache",
              "客户端导航使用的路由载荷",
              "浏览器内存中的路由状态；不是后端数据源"
            ],
            [
              "HTTP Cache-Control",
              "HTTP 响应的缓存许可",
              "对浏览器/CDN等中间层有意义，不会替你删除 Data Cache"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "本例 /api/catalog 每次返回 Cache-Control: no-store，但服务器内部仍显式调用 getCatalog。两次 HTTP 请求虽然都到达服务器，读到的结果仍可能来自 Data Cache。所以“HTTP 响应不缓存”不能推出“每次都查数据库”。反过来，让服务器数据过期，也不等于已经显示在浏览器里的旧页面立刻自动改字。"
        },
        {
          "type": "paragraph",
          "text": "router.refresh 主要让当前路由取得新的服务端结果并进行协调，不能绕过仍然命中的数据缓存。revalidateTag 则针对带标签的数据条目，不负责提交你的数据库事务。把它们看成不同层的动作，才可以解释“我明明 refresh 了，标题怎么还是旧的”。本篇先用 HTTP 验证服务端结果，客户端刷新与导航缓存的人工行为单独记录。"
        }
      ]
    },
    {
      "id": "source",
      "title": "先把真实读取做成可观察函数，再加缓存",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nimport { readFile,writeFile,mkdir,rename,rm } from 'node:fs/promises';\nimport { dirname } from 'node:path';\nimport { randomUUID } from 'node:crypto';\nexport const dataFile=process.env.DEMO_DATA_FILE??'data/catalog.json';\nexport async function readCatalog(){\n  let text:string;\n  try{text=await readFile(dataFile,'utf8');}catch(error){\n    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;\n    await writeCatalog({title:'课程目录 v1',revision:1});text=await readFile(dataFile,'utf8');\n  }\n  const value=JSON.parse(text);\n  if(typeof value.title!=='string'||!Number.isSafeInteger(value.revision))throw new Error('invalid catalog');\n  return {title:value.title as string,revision:value.revision as number,readId:randomUUID()};\n}\nexport async function writeCatalog(value:{title:string;revision:number}){\n  await mkdir(dirname(dataFile),{recursive:true});\n  const temporary=dataFile+'.'+randomUUID()+'.tmp';\n  try{await writeFile(temporary,JSON.stringify(value));await rename(temporary,dataFile);}\n  finally{await rm(temporary,{force:true});}\n}",
          "language": "ts",
          "filename": "examples/next-data-cache/lib/store.ts",
          "purpose": "完整数据源。读取完成后才生成 readId；写入用临时文件替换，未把缓存副本当作真数据。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "普通首次读取不存在的演示文件时，建立 title=课程目录 v1、revision=1，再读出并返回随机 readId。之后每次真实调用 readCatalog 都产生新的 readId，即使 title 没变。这里的文件是受控小型样本，JSON 解析不等于数据库驱动；随机标记也不是随机向量或性能得分，只用于识别是否执行过底层读取。"
        },
        {
          "type": "paragraph",
          "text": "写入先写临时文件再 rename，避免读取者看见半截 JSON，但它没有把“读 revision、加一、写回”做成跨进程事务。缓存实验按单写者顺序操作，不承诺并发管理员修改不会丢失更新。真正的并发写入、版本校验与幂等，应由下一篇和数据库专题建立明确约束，不能因为这里用了文件替换就宣称一致性已经解决。"
        }
      ]
    },
    {
      "id": "keys",
      "title": "缓存键回答“同一份结果”，标签回答“哪些结果一起失效”",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nimport { cache } from 'react';\nimport { unstable_cache } from 'next/cache';\nimport { readCatalog,dataFile } from './store';\nexport const getCatalog=unstable_cache(readCatalog,['atlas-cache-chapter-v1',dataFile],{tags:['chapter-catalog'],revalidate:3600});\nexport const getRequestCatalog=cache(readCatalog);",
          "language": "ts",
          "filename": "examples/next-data-cache/lib/cache.ts",
          "purpose": "完整两个缓存包装器。定义在模块顶层，保证每次调用使用相同的包装函数；路径进入键以隔离测试数据源。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "getCatalog 使用函数本身、调用参数及附加 keyParts 参与缓存身份；这里没有调用参数，但数据文件路径是被闭包读取的外部配置，因此也放进 keyParts。否则不同演示数据源可能意外使用同一身份。缓存里不能直接暗读当前用户 cookie 再按一个公共键存私人资料；若确实缓存用户数据，身份、权限和所有相关输入都必须进入可信设计。"
        },
        {
          "type": "paragraph",
          "text": "chapter-catalog 是分类标签，不是缓存键。多个不同键可以共用标签以批量失效；相同标签也不会让不同参数自动变成同一个结果。revalidate=3600 表达按时间重新验证策略，不是后台每小时准点执行一次数据库查询。我们没有等待一小时测试时间策略，因此不编造它的实测刷新延迟；本篇实际验证的是显式失效。"
        },
        {
          "type": "paragraph",
          "text": "getRequestCatalog 使用 React cache，目的是同次 Server Component 渲染里多个调用者需要同一份结果。它不替代上述跨请求缓存，也不应在任意 route handler 上期待同样的组件渲染语义。包装函数放在模块级复用，但请求结果范围仍由 React 渲染上下文决定；“函数定义复用”和“结果永远复用”不能混为一谈。"
        },
        {
          "type": "reference",
          "title": "Next 16.4.2 固定文档：revalidateTag",
          "url": "https://github.com/vercel/next.js/blob/v16.4.2/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx",
          "note": "固定 tag 用于追溯版本；关键读取、写入及失效代码均在正文。"
        },
        {
          "type": "reference",
          "title": "Next 官方：unstable_cache 与 Cache Components 迁移提示",
          "url": "https://nextjs.org/docs/app/api-reference/functions/unstable_cache",
          "note": "本篇明确未启用 Cache Components；不把旧包装器写成所有 Next 16 项目的推荐终点。"
        }
      ]
    },
    {
      "id": "render-scope",
      "title": "同一渲染去重，用两次读取标记验证而不是猜",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import { connection } from 'next/server';\nimport { getCatalog,getRequestCatalog } from '../lib/cache';\nexport default async function Page(){\n await connection();\n const [catalog,one,two]=await Promise.all([getCatalog(),getRequestCatalog(),getRequestCatalog()]);\n return <><h1>缓存对象实验</h1><p>持久缓存标题：{catalog.title}</p><p>持久缓存读取：{catalog.readId}</p>\n <p>同次渲染读取一：{one.readId}</p><p>同次渲染读取二：{two.readId}</p></>;\n}",
          "language": "tsx",
          "filename": "examples/next-data-cache/app/page.tsx",
          "purpose": "完整页面：同时调用跨请求缓存一次、请求内包装两次。connection 保证页面按当前请求生成。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一次打开页面，同次渲染读取一和二的 readId 相同；再次发起一个新的文档请求，两者仍各自相同，但会换成另一个 readId。生产 HTTP 测试实际提取这两个标记，断言“请求内同值、请求间变值”。因此它既能发现根本没去重，也能发现错误地把请求范围结果留到了后续请求。"
        },
        {
          "type": "paragraph",
          "text": "这份证据限定当前页面渲染和无参数调用。若传入两个内容相同但引用不同的对象，参数比较和身份会影响命中，不能想当然地按深度内容相等理解。更安全的初始设计是用稳定的原始值作为明确参数。数据读取副作用也要保持可理解：如果函数在“读取”时还扣库存，缓存命中会跳过副作用，程序语义就已经错了。"
        }
      ]
    },
    {
      "id": "stale-window",
      "title": "缓存旧值怎样出现：先改源，再显式失效",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {getCatalog} from '../../../lib/cache';\nimport {handle} from '../../../lib/http';\nexport async function GET(){return handle(getCatalog);}",
          "language": "ts",
          "filename": "examples/next-data-cache/app/api/catalog/route.ts",
          "purpose": "完整读端点。HTTP no-store 来自 handle，但内部结果仍由 getCatalog 决定。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {readCatalog,writeCatalog} from '../../../lib/store';\nimport {handle,requireAdmin,jsonInput} from '../../../lib/http';\n// Deliberately skip cache invalidation so a stale-result window is reproducible.\nexport async function POST(request:Request){return handle(async()=>{\n requireAdmin(request);const title=await jsonInput(request);const before=await readCatalog();\n const next={title,revision:before.revision+1};await writeCatalog(next);return next;\n});}",
          "language": "ts",
          "filename": "examples/next-data-cache/app/api/source/route.ts",
          "purpose": "完整受控写端点，故意不失效，目的是把旧值窗口可重复地暴露出来。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import { revalidateTag } from 'next/cache';\nimport { handle,requireAdmin } from '../../../lib/http';\nexport async function POST(request:Request){return handle(async()=>{\n requireAdmin(request);revalidateTag('chapter-catalog',{expire:0});return {invalidated:true};\n});}",
          "language": "ts",
          "filename": "examples/next-data-cache/app/api/invalidate/route.ts",
          "purpose": "完整失效端点。鉴权后标记标签立即过期，下一次读取回到数据源。",
          "kind": "excerpt"
        },
        {
          "type": "figure",
          "src": "figures/next-data-cache/invalidation.svg",
          "title": "一次有意保留再修复的旧值窗口",
          "alt": "revision1 读两次命中 A，源修改为 revision2 后仍读 A；显式失效后再读得到 revision2 和 B。",
          "caption": "这不是推荐生产系统把写入和失效拆成两个用户动作；分开是为了精确观察每个机制。"
        },
        {
          "type": "paragraph",
          "text": "实验初始值为 v1。连续两次 GET /api/catalog 的 readId 都是 A，说明跨请求复用成立。管理员 POST /api/source 写入 v2 后，再 GET 仍得到 v1/A；这次不是写入失败，而是缓存没有收到失效信号。接着 POST /api/invalidate，再 GET 得到 v2/B，后续再次命中 B。每一步都检查 title、revision 与 readId，避免单看一个数字猜过程。"
        },
        {
          "type": "paragraph",
          "text": "这里选 revalidateTag(tag,{expire:0})，让下一次访问等待重新取值，便于验证立即过期路径。推荐的 max profile 通常采用 stale-while-revalidate，可能先交旧结果再后台更新；updateTag 则用于 Server Action 的另一种即时更新语义和使用范围。三者应根据体验与一致性需要选择，不能只改一个字符串就把测试里“下一读必新”的承诺原封不动带过去。"
        },
        {
          "type": "paragraph",
          "text": "生产写入应把持久化成功与失效通知安排在受控流程里，并处理二者之间的失败窗口。先失效后写入会允许并发读重新填回旧值；先写后失效也可能在进程崩溃时漏掉通知。需要更强保证时可以用版本键、事务事件或 Outbox 组织恢复，而不是期待某个缓存 API 替业务自动完成跨系统事务。"
        }
      ]
    },
    {
      "id": "security-failure",
      "title": "演示控制入口，也必须防止任意访客改写",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nimport { randomUUID,timingSafeEqual,createHash } from 'node:crypto';\nexport class Failure extends Error{constructor(public status:number,public code:string){super(code);}}\nexport function requireAdmin(request:Request){\n const expected=process.env.CACHE_ADMIN_TOKEN;\n if(!expected||expected.length<32)throw new Error('set CACHE_ADMIN_TOKEN');\n const supplied=request.headers.get('authorization')??'';\n const hash=(x:string)=>createHash('sha256').update(x).digest();\n if(!timingSafeEqual(hash(supplied),hash('Bearer '+expected)))throw new Failure(401,'AUTH_REQUIRED');\n}\nexport async function jsonInput(request:Request){\n if(!/^application\\/json(?:\\s*;|$)/i.test(request.headers.get('content-type')??''))throw new Failure(415,'JSON_REQUIRED');\n const reader=request.body?.getReader();if(!reader)throw new Failure(400,'BODY_REQUIRED');\n let bytes=0;const chunks:Uint8Array[]=[];\n try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();throw new Failure(413,'BODY_TOO_LARGE');}chunks.push(value);}}\n finally{reader.releaseLock();}\n let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Failure(400,'BAD_JSON');}\n if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||typeof (value as {title?:unknown}).title!=='string')throw new Failure(422,'BAD_CATALOG');\n const title=(value as {title:string}).title.trim();if(!title||title.length>80)throw new Failure(422,'BAD_CATALOG');return title;\n}\nexport async function handle(work:()=>Promise<unknown>){\n try{return Response.json(await work(),{headers:{'Cache-Control':'no-store'}});}\n catch(error){if(error instanceof Failure)return Response.json({error:error.code},{status:error.status,headers:{'Cache-Control':'no-store'}});\n const requestId=randomUUID();console.error('catalog failed',{requestId,error});return Response.json({error:'UNAVAILABLE',requestId},{status:503,headers:{'Cache-Control':'no-store'}});}\n}",
          "language": "ts",
          "filename": "examples/next-data-cache/lib/http.ts",
          "purpose": "完整演示 HTTP 边界：管理令牌只留在服务端，按字节限额读取输入，错误统一处理。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "公开目录允许所有人读取，但只有带服务端配置令牌的调用者能执行写入或失效。本例用 Authorization Bearer，不用浏览器自动附带的会话 cookie，因此不会把 API 令牌直接塞进客户端组件。它不是一套完整账号权限系统；令牌保管、轮换、限流和审计仍属于部署要求。正文与示例都不给真实服务凭据。"
        },
        {
          "type": "paragraph",
          "text": "如果缓存仍有效，源文件损坏未必立刻被观察到。测试先使标签过期，再把源改成坏 JSON，下一读得到 503、通用错误码和 requestId，堆栈只留服务端日志。恢复文件并再次失效后，读取回到 v2。它说明缓存命中可能暂时遮住源故障，也说明故障测试必须明确到底经过了哪一层。"
        },
        {
          "type": "paragraph",
          "text": "这个实验没有证明托管平台之间缓存会共享、失效通知永不丢失或多地区强一致。文件缓存、远程适配器和容器重启的持久性各有前提。部署前应记录实际缓存后端、版本与边界，再设计故障恢复；不能把本机 next start 的五个通过项扩写成分布式 SLA。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "复现步骤、真实结果和下一篇的写入责任",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/next-data-cache\nnvm use\nnpm ci\ncp .env.example .env.local\n# 将 CACHE_ADMIN_TOKEN 换成至少32字符的本地演示值\nnpm run build\nnpm test\nnpm start\n# 浏览器打开 http://127.0.0.1:4322",
          "language": "sh",
          "filename": "终端 · 安装与验证",
          "purpose": "自动测试注入独立令牌和临时数据文件，不会写你的运行 data；手动运行使用 .env.local。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "curl http://127.0.0.1:4322/api/catalog\ncurl -X POST http://127.0.0.1:4322/api/source \\\n -H 'Content-Type: application/json' \\\n -H \"Authorization: Bearer $CACHE_ADMIN_TOKEN\" \\\n --data '{\"title\":\"课程目录 v2\"}'\ncurl http://127.0.0.1:4322/api/catalog\ncurl -X POST http://127.0.0.1:4322/api/invalidate \\\n -H \"Authorization: Bearer $CACHE_ADMIN_TOKEN\"\ncurl http://127.0.0.1:4322/api/catalog",
          "language": "sh",
          "filename": "终端 · 手动观察旧值与新值",
          "purpose": "先在本终端设置与你 .env.local 相同的 CACHE_ADMIN_TOKEN。测试不要求某个固定 UUID，而比较相等或变化。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "已在 macOS 14.5 x64、固定版本生产构建运行五项 HTTP 测试：Data Cache 命中、源写入后的旧值窗口与失效、React cache 请求内去重、写入权限和字段失败、源损坏及恢复。没有使用开发模式重复执行日志推断生产缓存，也没有根据一次快响应声称性能提升。"
        },
        {
          "type": "paragraph",
          "text": "理解检查：给 API 响应加 no-store 后，Data Cache 会被清掉吗？不会，它控制不同对象。修改源文件后 readId 还相同能证明写入失败吗？不能，还要直接检查源或执行失效。给两个缓存相同标签能让它们自动使用同一键吗？不能，标签负责分类失效，身份仍由各自键定义。"
        },
        {
          "type": "paragraph",
          "text": "下一篇会把写入责任补齐：用户身份从可信会话取得，输入校验放在服务器，重复提交按 owner 和 key 去重，表单 Action 与 JSON Handler 共用同一业务函数。当前文章状态仍为 review，页面、手机与浏览器 Router Cache 的人工验收单列；锁文件和完整项目可下载，服务端依赖及运行时不由站点离线阅读自动提供。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Next 官方：缓存与重新验证",
      "url": "https://nextjs.org/docs/app/guides/caching"
    },
    {
      "title": "React 官方：cache",
      "url": "https://react.dev/reference/react/cache"
    },
    {
      "title": "Next 官方：updateTag",
      "url": "https://nextjs.org/docs/app/api-reference/functions/updateTag"
    }
  ]
};
export default article;
