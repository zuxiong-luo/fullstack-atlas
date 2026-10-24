import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "next-server-writes",
  "topic": "nextjs",
  "title": "Server Actions 与 Route Handlers：表单、验证、鉴权和幂等",
  "description": "让 HTML 表单与 JSON 接口走同一条服务端写入路径，逐层验证身份、字段和资源归属，再用持久回执处理并发重复提交与冲突。",
  "minutes": 52,
  "labMinutes": 40,
  "tags": [
    "Next.js",
    "Server Actions",
    "Route Handlers",
    "鉴权",
    "幂等",
    "CSRF"
  ],
  "scope": "本地单进程笔记服务，带固定演示凭据、签名会话、服务端输入边界、用户隔离和文件内幂等回执。实际提交生产 SSR Action 表单并测试 API；不把文件锁当作跨实例事务，不实现生产账号体系、支付或全球 exactly-once。",
  "prerequisites": [
    "理解 App Router 和服务端/客户端数据边界",
    "能读 HTTP Cookie、JSON 与 async/await",
    "知道重复请求与重复业务效果的区别"
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
      "path": "next-server-writes.zip"
    },
    {
      "label": "安装和复现说明",
      "path": "next-server-writes/README.md"
    }
  ],
  "sections": [
    {
      "id": "transports",
      "title": "两种入口是什么：传输方式不同，业务约束仍由服务器负责",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Route Handler 是你用 Request/Response 设计的 HTTP 端点，可以明确选择方法、状态码和请求体格式。Server Action 是可由表单或框架客户端调用的服务端函数；Next 负责把调用带到服务器，并把结果、重定向或界面更新接回应用。它们都能执行写入，但都不会因为“在服务端文件里”就自动拥有完整授权与幂等语义。"
        },
        {
          "type": "paragraph",
          "text": "这一篇给知识笔记应用加入真正的受控写入：alice 与 bob 用演示凭据建立会话，各自创建和读取自己的笔记。相同用户、相同提交键、相同内容的重复请求得到原结果；同一提交键换成不同内容则拒绝。表单与 JSON API 调用同一个 createNote，避免一条入口校验严格、另一条入口偷偷绕过。"
        },
        {
          "type": "figure",
          "src": "figures/next-server-writes/boundaries.svg",
          "title": "不要在两条传输入口里复制两套业务规则",
          "alt": "HTML 表单进入 Server Action，JSON 进入 Route Handler，二者都校验可信 owner 与字段，再在同 owner/key 范围查询或保存回执。",
          "caption": "Action 标识、隐藏按钮和浏览器校验都不是权限。示例锁只保护本机一个进程。"
        },
        {
          "type": "paragraph",
          "text": "本例的文件存储只用于让并发与失败过程可见，不是生产数据库替代品。Node 22.12.0、Next 16.4.2、React 19.3.1、TypeScript 5.7.2 全部锁定，cacheComponents 关闭。站点主应用的 React 版本不受这个独立示例影响。先建立小而明确的契约，再讨论如何把它搬到事务数据库。"
        }
      ]
    },
    {
      "id": "identity",
      "title": "可信身份从会话取得，客户端提交的 owner 不作数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nexport class Failure extends Error{constructor(public status:number,public code:string){super(code);}}",
          "language": "ts",
          "filename": "examples/next-server-writes/lib/errors.ts",
          "purpose": "完整受控错误类型，供身份、输入与业务共同使用。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import 'server-only';\nimport { cookies,headers } from 'next/headers';\nimport { createHmac,createHash,timingSafeEqual } from 'node:crypto';\nimport { Failure } from './errors';\nexport type User='alice'|'bob';\nfunction secret(){const value=process.env.DEMO_SESSION_SECRET;if(!value||value.length<32)throw new Error('set a 32+ character secret');return value;}\nfunction signature(value:string){return createHmac('sha256',secret()).update(value).digest('hex');}\nexport function issueSession(user:User){const value=user+'.'+(Date.now()+3600000);return value+'.'+signature(value);}\nexport async function requireUser():Promise<User>{\n const token=(await cookies()).get('atlas-session')?.value??'';\n const [user,expires,sig,...extra]=token.split('.');\n if(extra.length||(user!=='alice'&&user!=='bob')||!/^\\d+$/.test(expires??'')||!/^[a-f0-9]{64}$/.test(sig??''))throw new Failure(401,'AUTH_REQUIRED');\n if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(user+'.'+expires),'hex'))||Number(expires)<=Date.now())throw new Failure(401,'AUTH_REQUIRED');\n return user;\n}\nexport async function requireSameOrigin(){\n const expected=process.env.DEMO_APP_ORIGIN;if(!expected)throw new Error('set DEMO_APP_ORIGIN');\n if((await headers()).get('origin')!==expected)throw new Failure(403,'CROSS_SITE');\n}\nexport function checkPassword(user:unknown,password:unknown):User{\n if((user!=='alice'&&user!=='bob')||typeof password!=='string')throw new Failure(401,'BAD_CREDENTIALS');\n const expected=process.env[user==='alice'?'DEMO_ALICE_PASSWORD':'DEMO_BOB_PASSWORD'];\n if(!expected||expected.length<12)throw new Error('set demo passwords');\n const hash=(x:string)=>createHash('sha256').update(x).digest();\n if(!timingSafeEqual(hash(password),hash(expected)))throw new Failure(401,'BAD_CREDENTIALS');\n return user;\n}",
          "language": "ts",
          "filename": "examples/next-server-writes/lib/auth.ts",
          "purpose": "完整演示身份边界：凭据校验、会话签名与到期、同源写入检查。所有秘密只从服务端环境读取。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "登录端点验证演示用户名和密码后，把 user 与到期时间签名。后续 requireUser 从服务器读取 cookie，检查格式、签名和过期，再返回 alice 或 bob。写入函数的 owner 只能来自这个返回值。即使浏览器把隐藏字段改成 bob，或者直接手工发 JSON，也不能让客户端自己选择账户归属。"
        },
        {
          "type": "paragraph",
          "text": "这里用环境变量保存本地演示密码，并对比较材料作定长摘要比较；这不等于生产密码存储方案。真实账号应接可信身份系统，或使用合适的慢密码哈希、登录速率限制、重置与撤销流程。本地 HTTP cookie 没有 Secure，公开部署必须使用 HTTPS 和对应安全设置。HttpOnly 只限制普通脚本读取 cookie，不能替代 CSRF 与服务端授权。"
        },
        {
          "type": "code",
          "code": "import {checkPassword,issueSession,requireSameOrigin} from '../../../lib/auth';\nimport {readJson} from '../../../lib/input';\nimport {handle} from '../../../lib/http';\nimport {Failure} from '../../../lib/errors';\nexport async function POST(request:Request){\n let token='';const result=await handle(async()=>{\n  await requireSameOrigin();const input=await readJson(request);\n  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['user','password'].includes(key)))throw new Failure(422,'BAD_LOGIN');\n  const {user,password}=input as Record<string,unknown>;const owner=checkPassword(user,password);token=issueSession(owner);return {user:owner};\n });\n if(result.status===200){result.headers.set('Set-Cookie',`atlas-session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);}\n return result;\n}",
          "language": "ts",
          "filename": "examples/next-server-writes/app/api/session/route.ts",
          "purpose": "完整登录 Route Handler。输入、来源与凭据都在服务器检查；成功后发 HttpOnly/SameSite 会话。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "演示会话是签名的自包含值，只有到期检查，没有服务端会话表和主动撤销；不要把删除浏览器 cookie 解释成旧令牌已被服务器撤销。登录与退出、轮换、撤销的完整取舍由身份专题展开。当前实验的重点，是所有写入口都能从同一可信边界取得身份，而不是做一套看起来复杂却未经验证的账号产品。"
        }
      ]
    },
    {
      "id": "input",
      "title": "正文是未知输入：大小、语法、形状分别检查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nimport {Failure} from './errors';\nexport function parseNote(value:unknown):{title:string;key:string}{\n if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['title','key'].includes(key)))throw new Failure(422,'BAD_NOTE');\n const {title,key}=value as Record<string,unknown>;\n if(typeof title!=='string'||!title.trim()||title.length>80||typeof key!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(key))throw new Failure(422,'BAD_NOTE');\n return {title:title.trim(),key};\n}\nexport async function readJson(request:Request):Promise<unknown>{\n if(!/^application\\/json(?:\\s*;|$)/i.test(request.headers.get('content-type')??''))throw new Failure(415,'JSON_REQUIRED');\n const reader=request.body?.getReader();if(!reader)throw new Failure(400,'BODY_REQUIRED');\n let bytes=0;const chunks:Uint8Array[]=[];\n try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();throw new Failure(413,'BODY_TOO_LARGE');}chunks.push(value);}}\n finally{reader.releaseLock();}\n try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Failure(400,'BAD_JSON');}\n}",
          "language": "ts",
          "filename": "examples/next-server-writes/lib/input.ts",
          "purpose": "完整输入边界。JSON 按字节受限，parseNote 同时服务于 API 与 Action；key 和 title 都有确定范围。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "JSON API 先要求媒体类型，再边读边累计 1024 字节上限，随后解析语法，最后检查字段。title 需要非空并限制原字符串的 UTF-16 长度；key 是 8～80 位受限字符。额外字段拒绝，因此 owner、admin 等属性不能被顺手合并进内部对象。和上一章一样，实际保留量、底层缓冲与连接时限不是同一个概念。"
        },
        {
          "type": "paragraph",
          "text": "表单携带的 FormData 也不可信。字段可能重复，值可能是 File，也可能带不认识的名字；Action 在提取前检查字段集合和 title/key 的出现次数，再交给同一个 parseNote。框架内部的 $ACTION_ 字段只为传输服务，不传播到业务对象。HTML required 和 maxLength 让正常用户少犯错，服务器仍然要覆盖直接发请求的人。"
        },
        {
          "type": "paragraph",
          "text": "签名校验、来源校验和字段校验各自解决不同问题。合法 cookie 不代表用户有权读任意资源；同源请求也可能由恶意脚本发出；字段合法更不代表请求来自登录用户。接下来让这些判断按固定顺序进入同一业务路径，才能知道某条拒绝究竟保护了哪一层。"
        }
      ]
    },
    {
      "id": "idempotency",
      "title": "幂等先定义身份：owner + key，以及它对应的内容",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nimport {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';\nimport {dirname} from 'node:path';\nimport {randomUUID,createHash} from 'node:crypto';\nimport type {User} from './auth';\nimport {Failure} from './errors';\ntype Note={id:string;owner:User;title:string};\ntype Receipt={owner:User;key:string;fingerprint:string;note:Note};\ntype State={notes:Note[];receipts:Receipt[]};\nconst file=process.env.DEMO_DATA_FILE??'data/notes.json';\nconst shared=globalThis as typeof globalThis & {atlasNextWritesQueue?:Promise<void>};\nasync function readState():Promise<State>{\n let raw:string;try{raw=await readFile(file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {notes:[],receipts:[]};throw error;}\n const state=JSON.parse(raw);if(!Array.isArray(state.notes)||!Array.isArray(state.receipts))throw new Error('invalid state');return state;\n}\nasync function locked<T>(work:()=>Promise<T>):Promise<T>{\n const previous=shared.atlasNextWritesQueue??Promise.resolve();let release=()=>{};\n shared.atlasNextWritesQueue=new Promise<void>(resolve=>{release=resolve;});\n await previous;try{return await work();}finally{release();}\n}\nexport async function listNotes(owner:User){return (await readState()).notes.filter(note=>note.owner===owner);}\nexport async function createNote(owner:User,input:{title:string;key:string}):Promise<Note>{\n return locked(async()=>{\n  const state=await readState();\n  const fingerprint=createHash('sha256').update(JSON.stringify({title:input.title})).digest('hex');\n  const old=state.receipts.find(item=>item.owner===owner&&item.key===input.key);\n  if(old){if(old.fingerprint!==fingerprint)throw new Failure(409,'KEY_REUSED');return old.note;}\n  const note={id:randomUUID(),owner,title:input.title};\n  state.notes.push(note);state.receipts.push({owner,key:input.key,fingerprint,note});\n  await mkdir(dirname(file),{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';\n  try{await writeFile(temporary,JSON.stringify(state));await rename(temporary,file);}\n  finally{await rm(temporary,{force:true});}\n  return note;\n });\n}",
          "language": "ts",
          "filename": "examples/next-server-writes/lib/store.ts",
          "purpose": "完整业务与文件存储路径。进程级串行门保护“查回执到保存”的整个区间；笔记和回执放进同一份替换文件。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "一次新提交以可信 owner 和 key 查回执。没有记录才生成 note.id，并把 note 与包含 fingerprint 的回执一起保存。第二次同用户同 key 到达，先比较规范化内容的指纹，相同就返回原 note，不再创建新笔记；不同则抛 KEY_REUSED。bob 使用同样的 key 仍属于另一个范围，所以不会拿到 alice 的结果。"
        },
        {
          "type": "paragraph",
          "text": "真正的竞争窗口在“先查没有，再创建”之间。两个并发请求如果都读到空回执，就可能各自写一条。locked 先接上进程共享的 Promise 门，再等待上一项结束；上一项无论成功失败都在 finally release，下一项才读取最新状态。全局保存的只是协调门，不是当前用户；用户仍通过每次调用参数传入。"
        },
        {
          "type": "paragraph",
          "text": "这不是分布式锁。多个进程各有一把门，共同写一个文件仍会竞争。临时文件加 rename 避免半截 JSON 可见，也没有提供断电后的 fsync 持久保证。换成真实数据库时，应把 owner/key 唯一约束、请求内容校验、笔记写入和回执提交放进恰当事务，再测试冲突与崩溃恢复。回执还需要清理与保留期限，不能无限积累。"
        },
        {
          "type": "paragraph",
          "text": "单进程门的等待队列本例也没有实现总容量控制，适合受控演示，不适合直接承诺任意生产负载。幂等解决重复业务效果，限流和容量保护解决工作规模，取消解决不再需要的等待，它们不能互相代替。用户故意每次换一个 key，服务器应将其视作新意图，而不是把幂等当成防刷策略。"
        }
      ]
    },
    {
      "id": "handlers",
      "title": "Route Handler 的正常与失败响应，先走通一遍",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\nimport {randomUUID} from 'node:crypto';\nimport {Failure} from './errors';\nexport function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}\nexport async function handle(work:()=>Promise<unknown>){\n try{return json(await work());}catch(error){\n  if(error instanceof Failure)return json({error:error.code},error.status);\n  const requestId=randomUUID();console.error('write unavailable',{requestId,error});return json({error:'UNAVAILABLE',requestId},503);\n }\n}",
          "language": "ts",
          "filename": "examples/next-server-writes/lib/http.ts",
          "purpose": "完整错误响应边界。内部细节只进入服务端日志，客户端得到请求标识与通用错误。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {requireUser,requireSameOrigin} from '../../../lib/auth';\nimport {createNote,listNotes} from '../../../lib/store';\nimport {readJson,parseNote} from '../../../lib/input';\nimport {handle} from '../../../lib/http';\nexport async function GET(){return handle(async()=>listNotes(await requireUser()));}\nexport async function POST(request:Request){return handle(async()=>{\n await requireSameOrigin();const owner=await requireUser();return createNote(owner,parseNote(await readJson(request)));\n});}",
          "language": "ts",
          "filename": "examples/next-server-writes/app/api/notes/route.ts",
          "purpose": "完整列表与写入端点：来源、身份、输入、业务按顺序执行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {requireUser} from '../../../../lib/auth';\nimport {listNotes} from '../../../../lib/store';\nimport {Failure} from '../../../../lib/errors';\nimport {handle} from '../../../../lib/http';\nexport async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{\n const owner=await requireUser();const {id}=await params;const note=(await listNotes(owner)).find(item=>item.id===id);\n if(!note)throw new Failure(404,'NOT_FOUND');return note;\n});}",
          "language": "ts",
          "filename": "examples/next-server-writes/app/api/notes/[id]/route.ts",
          "purpose": "完整资源读取：先按可信 owner 取自己的集合，再匹配 id，不向其他用户暴露存在性。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "正常 POST 先检查 Origin，再验证会话，再读取受限 JSON，并将 owner 与规范化输入交给 createNote。返回 200 与服务端生成的 note。重复同内容返回同一对象内容，包括相同 id；同 key 内容不同返回 409。GET 指定资源时先限定用户自己的集合，不属于当前用户的笔记和不存在的笔记都返回 404。"
        },
        {
          "type": "table",
          "headers": [
            "失败输入或状态",
            "API 结果",
            "验证对象"
          ],
          "rows": [
            [
              "错误密码、缺失或篡改会话",
              "401",
              "身份边界"
            ],
            [
              "跨站写入",
              "403",
              "Origin 与预期站点不一致"
            ],
            [
              "坏 JSON / 字节过大 / 字段不符",
              "400 / 413 / 422",
              "三种输入边界分开"
            ],
            [
              "同 owner/key 换内容",
              "409",
              "避免同一个重试身份悄悄代表另一笔操作"
            ],
            [
              "其他用户的 note.id",
              "404",
              "资源归属"
            ],
            [
              "存储损坏",
              "503 + requestId",
              "不泄露 JSON 解析和文件路径细节"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "Origin 检查是浏览器跨站防护的一部分，不能把它当作身份凭据：非浏览器调用者可以自己设置这个头，但仍必须拿到有效会话。真实代理部署还要明确信任哪些转发头和允许的来源。本例只接受配置的一个 loopback origin，避免为了让演示跑通就放开任意站点。"
        }
      ]
    },
    {
      "id": "actions",
      "title": "Server Action 共用业务函数，但表单调用还有自己的边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "\"use server\";\nimport {redirect} from 'next/navigation';\nimport {revalidatePath} from 'next/cache';\nimport {requireUser,requireSameOrigin} from '../lib/auth';\nimport {parseNote} from '../lib/input';\nimport {createNote} from '../lib/store';\nimport {Failure} from '../lib/errors';\nexport async function saveNote(form:FormData){\n let destination:string;\n try{\n  await requireSameOrigin();const owner=await requireUser();\n  const fields=[...form.keys()].filter(key=>!key.startsWith('$ACTION_'));\n  if(fields.some(key=>!['title','key'].includes(key))||form.getAll('title').length!==1||form.getAll('key').length!==1)throw new Failure(422,'BAD_NOTE');\n  const input=parseNote({title:form.get('title'),key:form.get('key')});\n  const note=await createNote(owner,input);revalidatePath('/');destination='/?saved='+note.id;\n }catch(error){\n  if(!(error instanceof Failure))console.error('action unavailable',error);\n  destination='/?error='+(error instanceof Failure?error.code:'UNAVAILABLE');\n }\n redirect(destination);\n}",
          "language": "ts",
          "filename": "examples/next-server-writes/app/actions.ts",
          "purpose": "完整 Action。关键判断与 API 相同；redirect 放在 try/catch 之外，避免把框架控制流误当业务失败吞掉。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {randomUUID} from 'node:crypto';\nimport {requireUser} from '../lib/auth';\nimport {listNotes} from '../lib/store';\nimport {Failure} from '../lib/errors';\nimport {saveNote} from './actions';\nimport Login from './Login';\nexport default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){\n let owner:null|'alice'|'bob'=null;\n try{owner=await requireUser();}catch(error){if(!(error instanceof Failure))throw error;}\n const notes=owner?await listNotes(owner):[];const query=await searchParams;\n const errors:Record<string,string>={AUTH_REQUIRED:'请先登录',BAD_NOTE:'输入不符合约定',KEY_REUSED:'提交键已用于不同内容',CROSS_SITE:'拒绝跨站提交',UNAVAILABLE:'服务暂不可用'};\n const message=typeof query.error==='string'?(errors[query.error]??'提交失败'):query.saved?'笔记已保存':'';\n return <><h1>服务端写入实验</h1><p>当前用户：{owner??'未登录'}</p><Login/>\n <p role=\"status\">{message}</p><form action={saveNote}><label>标题<input name=\"title\" required maxLength={80}/></label>\n <input type=\"hidden\" name=\"key\" value={randomUUID()}/><button>保存笔记</button></form>\n <ul>{notes.map(note=><li key={note.id}>{note.title}</li>)}</ul></>;\n}",
          "language": "tsx",
          "filename": "examples/next-server-writes/app/page.tsx",
          "purpose": "完整服务端页面：从会话加载自己的列表、呈现表单与结果提示，每个新表单获得一个提交键。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "use server 声明可在服务器调用的函数，表单 action 直接使用 saveNote。浏览器表单键不是秘密，它承担的是“这次提交意图”的身份；双击或重发同一份表单时复用这个键，新生成的表单则获得新键。页面展示的 saved/error 查询提示只用于体验，不是权限或持久化证据，真正的数据仍由服务端列表读取。"
        },
        {
          "type": "paragraph",
          "text": "Action 不能因为只从自己页面调用就省掉鉴权。测试实际读取生产 SSR 中的 $ACTION_ID 字段，以普通 multipart 表单 POST 回来：成功 303 跳转；重复表单跳向同一个 saved id；坏字段跳向受控错误；无会话也被拒绝。它证明经过了真实框架 Action 入口，不是只在测试里直接 import 并调用函数。"
        },
        {
          "type": "paragraph",
          "text": "Next 本身还会对 Server Action 的 Origin 与 Host 等关系做检查。跨站测试中，框架可能在进入自定义函数前已经拒绝，生产响应可为 500；我们检查拒绝且笔记数不变，不把它伪装成自己的 403 契约。Route Handler 的 JSON 端点则由本例明确返回 403。两条入口共享业务规则，不代表框架传输层状态码也完全相同。"
        },
        {
          "type": "paragraph",
          "text": "revalidatePath 只放在成功写入之后，用来让页面结果重新获取；它不负责把写操作变成事务。redirect 也不是数据提交函数。代码先形成目标位置，再在 try/catch 外执行 redirect，因为重定向通过框架控制流实现，放在普通 catch 中可能被误判成失败。无论最后怎样更新界面，createNote 的回执规则都必须独立成立。"
        },
        {
          "type": "reference",
          "title": "Next 官方：写入与 Server Actions",
          "url": "https://nextjs.org/docs/app/getting-started/mutating-data",
          "note": "用于核对表单传输与重定向；配套项目实际提交生产 SSR Action，未手工伪造函数直接调用测试。"
        },
        {
          "type": "reference",
          "title": "Next 官方：数据安全",
          "url": "https://nextjs.org/docs/app/guides/data-security",
          "note": "可调用 Action 是服务端入口，权限与输入仍需自行核验。"
        }
      ]
    },
    {
      "id": "client",
      "title": "浏览器只负责交互，秘密和所有权判断留在服务器",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "\"use client\";\nimport {useState} from 'react';\nimport {useRouter} from 'next/navigation';\nexport default function Login(){\n const router=useRouter();const [message,setMessage]=useState('');\n return <form onSubmit={async event=>{\n  event.preventDefault();const data=new FormData(event.currentTarget);setMessage('登录中');\n  try{\n   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:data.get('user'),password:data.get('password')})});\n   if(response.ok){setMessage('已登录');router.refresh();}else{setMessage('登录失败，请检查演示账号和服务端配置');}\n  }catch{setMessage('网络失败');}\n }}>\n <label>演示账号<select name=\"user\"><option value=\"alice\">alice</option><option value=\"bob\">bob</option></select></label>\n <label>密码<input name=\"password\" type=\"password\" required autoComplete=\"current-password\"/></label>\n <button>登录</button><p role=\"status\">{message}</p></form>;\n}",
          "language": "tsx",
          "filename": "examples/next-server-writes/app/Login.tsx",
          "purpose": "完整客户端登录表单。浏览器提交演示凭据，成功后请求路由刷新；会话 cookie 由响应建立。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "客户端组件没有会话签名密钥、文件写入函数或用户归属判断。它把表单输入送到 /api/session，服务器建立 cookie，成功后 router.refresh 更新当前用户展示。测试扫描 .next/static 下的 JS，确认没有 DEMO_SESSION_SECRET、演示密码配置名、进程写入门或实际测试密钥。仅靠文件名叫 server 并不足够，所以模块也使用 server-only。"
        },
        {
          "type": "paragraph",
          "text": "这里没有实现断网重试队列和自动重放。客户端收到网络错误时，应保留原请求键再查询或重试同一意图；不能每次失败都立即生成新键，否则重复副作用又回来了。也不能根据前端显示“失败”断定服务器没写成功：网络可能在提交后断开。可靠业务需要能查询结果与记录重试身份，这正是把回执放在服务器的原因。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "从生产服务复现并发、越权和表单失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/next-server-writes\nnvm use\nnpm ci\ncp .env.example .env.local\n# 设置本地演示密钥、两个密码与固定 Origin\nnpm run build\nnpm test\nnpm start\n# 打开 http://127.0.0.1:4323，在页面输入演示账号密码",
          "language": "sh",
          "filename": "终端 · 安装与生产运行",
          "purpose": "示例仅绑定 loopback。测试自行注入独立凭据和临时数据，手动运行使用 .env.local。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本机 macOS 14.5 x64 已完成生产构建和八项测试：凭据/会话、真实并发重复提交、同键冲突与跨用户隔离、来源/输入/体积限制、实际 Action 正常/重复/坏输入/未登录、存储损坏恢复、跨站 Action 拒绝、客户端静态包边界。测试使用真实 HTTP，4323 服务由辅助函数启动并总会关闭；没有把 mock 调用当成框架传输验证。"
        },
        {
          "type": "paragraph",
          "text": "一个检查：隐藏 owner 字段能否用来决定作者？不能，服务器应从会话重新取得。随机 Action ID 是否足以授权？不能，它只是可调用入口的标识。相同 key 换标题应该覆盖原笔记吗？本例拒绝，因为它代表同一重试身份携带了不同意图；需要编辑操作时应另设资源与版本契约。"
        },
        {
          "type": "paragraph",
          "text": "人工浏览器与手机交互仍待发布阶段，HTTP 测试不能替代点击、hydration 或视觉验收。单进程受控文件也不能替代数据库事务、会话撤销、登录防刷、容量上限和部署安全。到这里两种入口的分工已经明确：框架帮助传输与更新界面，业务函数承担可信身份、数据规则和重复提交语义，后续生产专题再把这些责任接到真实基础设施。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Next 16.4.2 固定 tag",
      "url": "https://github.com/vercel/next.js/tree/v16.4.2"
    },
    {
      "title": "Next 官方：Route Handlers",
      "url": "https://nextjs.org/docs/app/api-reference/file-conventions/route"
    },
    {
      "title": "Next 官方：redirect",
      "url": "https://nextjs.org/docs/app/api-reference/functions/redirect"
    }
  ]
};
export default article;
