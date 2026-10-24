import type {Article} from '../../articleTypes';
const article:Article={
  "id": "next-streaming-errors",
  "topic": "nextjs",
  "title": "流式渲染与错误恢复：Suspense、loading 与 error",
  "description": "用受控报告工作台追踪壳、等待占位和后续内容的真实HTTP分段，解释Suspense与路由loading的边界；固定Next16.4.2的retry语义，验证生产错误隐藏、重新请求与超时恢复范围。",
  "minutes": 60,
  "labMinutes": 40,
  "tags": [
    "Next.js",
    "Suspense",
    "流式渲染",
    "loading",
    "错误边界",
    "恢复"
  ],
  "scope": "Next16.4.2 App Router，Cache Components关闭。单Node进程、内存受控门、生产HTML字节流与段落错误恢复；浏览器hydrate/retry按钮另行验收，不把HTTP重请求当作点击测试。无真实模型、外部报告服务或多实例共享状态。",
  "prerequisites": [
    "理解Server/Client Component与App Router布局层次",
    "会读Promise与async/await；知道HTML响应头和响应体是不同阶段"
  ],
  "kind": "series",
  "status": 'complete',
  "verifiedAt": "2026-10-24",
  "versions": [
    "Node.js22.12.0",
    "Next.js16.4.2 / React与ReactDOM19.3.1",
    "TypeScript5.7.2；App Router；webpack生产构建",
    "cacheComponents:false；本机单进程示例"
  ],
  "questionIds": [],
  "examples": [
    {
      "label": "完整生产构建示例、锁文件与真实HTTP测试",
      "path": "next-streaming-errors.zip"
    },
    {
      "label": "运行步骤与验证范围",
      "path": "next-streaming-errors/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "流式渲染是什么：一次响应可以分阶段交付可用界面",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "流式渲染是在一次响应尚未完全结束时，先发送已经准备好的界面，再发送后续完成的内容。它解决的是页面里不同区域准备时间不同的问题：导航、标题与操作面板可以先出现，较慢的报告区域继续等待。流式不是把所有数据变成客户端fetch，也不是让网络请求本身变快，而是改变可用内容的交付时机。"
        },
        {
          "type": "paragraph",
          "text": "Suspense是围绕一个渲染子树建立的等待边界。边界内的渲染需要一个尚未完成的异步结果时，外层可以用fallback占位继续输出；完成后再补齐真正内容。fallback表达“这一块尚未就绪”，不是错误提示。错误边界则处理意外渲染失败，两者负责的状态不同，不能靠一个loading文本掩盖所有失败。"
        },
        {
          "type": "paragraph",
          "text": "这篇沿用Next全栈笔记，但把业务收窄到报告工作台：共享布局有输入框和控制按钮，报告页有独立等待区域。报告数据不是靠固定sleep假装慢，而是由测试明确释放一扇门。只有先观察到等待字节，再释放数据，才能证明响应确实分阶段交付；若先把整页读完再查到两个文本，只能说明内容都出现过，无法证明谁先谁后。"
        },
        {
          "type": "figure",
          "src": "figures/next-streaming-errors/boundaries.svg",
          "title": "先区分共享布局、路由等待和局部等待",
          "alt": "外层布局包含控制面板。loading约定包裹page及其后代，page内还有一个更细的Suspense；同段error包住它们下面的意外错误，不覆盖同段layout自身。",
          "caption": "外层布局包含控制面板。loading约定包裹page及其后代，page内还有一个更细的Suspense；同段error包住它们下面的意外错误，不覆盖同段layout自身。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "loading 与 error 放在哪里，决定了它们能覆盖哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "在App Router里，loading.tsx会建立约定的Suspense边界，包住同段page和下级内容。它很适合页面导航时的整体准备状态；如果页面里只有一份报告慢，而标题和说明已经准备好，可以在page内部再放一个显式Suspense，只让报告显示局部占位。边界越细并非越好，应该对应读者能理解的独立内容单元。"
        },
        {
          "type": "code",
          "code": "import {Suspense} from 'react';\nimport {notFound} from 'next/navigation';\nimport {readReport,state,validId} from '@/lib/gates';\nexport const dynamic='force-dynamic';\nasync function Report({id}:{id:string}){\n const report=await readReport(id);\n return <section data-testid=\"ready\"><h2>{report.title}</h2><p>当前报告：{report.id}；实际读取次数：{report.reads}</p></section>;\n}\nexport default async function Page({params}:{params:Promise<{id:string}>}){\n const {id}=await params;if(!validId(id)||!state(id))notFound();\n return <article><h2>报告 {id}</h2><Suspense fallback={<p data-testid=\"pending\">REGION_PENDING · 报告仍在等待</p>}><Report id={id}/></Suspense></article>;\n}",
          "language": "tsx",
          "filename": "examples/next-streaming-errors/app/reports/[id]/page.tsx",
          "purpose": "完整动态报告页：先取得params与校验ID，再把真正等待的Report放在局部Suspense里。只有组件实际读取Promise的层次才构成这条等待路径。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "export default function Loading(){return <p>ROUTE_LOADING · 正在准备报告路由</p>;}",
          "language": "tsx",
          "filename": "examples/next-streaming-errors/app/reports/[id]/loading.tsx",
          "purpose": "路由准备占位；真实分段测试观测的是REGION_PENDING，不把存在这个文件本身当作用户一定见过ROUTE_LOADING。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "page顶层提前await整份报告，再在返回值里包Suspense，已经来不及为那段等待提供局部fallback。因为等待发生在构造子树之前，边界还没有机会包住它。本例把readReport放进Report组件，让它处在已声明的边界之内；这是结构上的差别，不能只看源码里是否出现过Suspense标签。"
        },
        {
          "type": "paragraph",
          "text": "同段error.tsx不能捕获同段layout里的错误，因为layout在它上方。共享导航若也依赖可能失败的数据，需要把边界放到更高层，根布局异常则考虑global-error。边界也不会自动捕获点击回调和任意定时器里的异常；预期的表单拒绝应作为结果状态处理，不能throw所有输入错误再指望整页错误界面恢复。"
        },
        {
          "type": "reference",
          "title": "固定16.4.2 loading约定",
          "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/03-api-reference/03-file-conventions/loading.mdx",
          "note": "这里看边界关系；文档链接用于追溯，正文已经提供决定行为的完整组件。"
        },
        {
          "type": "paragraph",
          "text": "边界也不会自动消除数据依赖。若报告正文必须先拿到权限结果，再用该结果请求数据，两个步骤仍然串行；Suspense只能让外层先可用。相互独立的数据可以尽早开始请求，再在不同子树等待，但要先确认它们真的独立，不能为了并行把授权前置条件跳过。本例故意只保留一份受控报告，避免把网络并行收益与流式交付混为一谈。"
        },
        {
          "type": "paragraph",
          "text": "等待区中的局部状态也需要有明确身份。用户切换报告ID时，旧报告的数据不应被当成新报告的结果；读取和导航都要跟着当前路由身份。这里readReport接收当前params里的ID，Controls释放也显式带同一ID，因此测试能确认自己放行的是哪份报告，而不是靠一个全局“加载完成”布尔值影响所有页面。"
        }
      ]
    },
    {
      "id": "controlled-data",
      "title": "受控异步源：先观察等待，再决定成功、失败或超时",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import 'server-only';\ntype Gate={mode:'ok'|'fail-once';reads:number;failureUsed:boolean;released:boolean;timedOut:boolean;promise:Promise<void>;release:()=>void;timer:ReturnType<typeof setTimeout>};\nconst shared=globalThis as typeof globalThis&{__atlasStreamGates?:Map<string,Gate>};\nconst gates=shared.__atlasStreamGates??=new Map<string,Gate>();\nexport const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-z0-9-]{1,40}$/.test(id);\nexport function initialize(id:string,mode:Gate['mode'],timeoutMs=30000){\n  if(!validId(id)||!['ok','fail-once'].includes(mode)||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw new Error('BAD_INPUT');\n  const old=gates.get(id);if(old&&!old.released)throw new Error('GATE_BUSY');\n  if(!old&&gates.size>=32)throw new Error('LAB_CAPACITY');\n  if(old)clearTimeout(old.timer);\n  let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});\n  const gate:Gate={mode,reads:0,failureUsed:false,released:false,timedOut:false,promise,release(){if(gate.released)return;gate.released=true;clearTimeout(gate.timer);resolve();},timer:undefined as unknown as ReturnType<typeof setTimeout>};\n  gate.timer=setTimeout(()=>{gate.timedOut=true;gate.release();},timeoutMs);gate.timer.unref();gates.set(id,gate);\n}\nexport function release(id:string){const gate=gates.get(id);if(!gate)throw new Error('NOT_FOUND');gate.release();}\nexport function state(id:string){const gate=gates.get(id);return gate?{reads:gate.reads,released:gate.released,timedOut:gate.timedOut,failureUsed:gate.failureUsed}:null;}\nexport async function readReport(id:string){\n  const gate=gates.get(id);if(!gate)throw new Error('NOT_FOUND');\n  gate.reads++;await gate.promise;\n  if(gate.timedOut)throw new Error('INTERNAL_GATE_TIMEOUT');\n  if(gate.mode==='fail-once'&&!gate.failureUsed){gate.failureUsed=true;throw new Error('INTERNAL_ONCE_FAILURE_DO_NOT_SEND');}\n  return {id,title:'REPORT_READY',reads:gate.reads};\n}",
          "language": "ts",
          "filename": "examples/next-streaming-errors/lib/gates.ts",
          "purpose": "完整受控数据源：最多32个ID、每个最长30秒，先初始化、再释放；fail-once只在第一次已释放读取时失败，下一次读取可成功。它是本机测试装置，不是生产共享存储。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "门对象保存一个Promise和release函数。readReport增加真实读取次数，再等待这个Promise；控制面板或HTTP测试释放后，读取继续。这让“已开始等待”与“允许继续”成为可观测的两个状态，测试不需要睡一秒猜测服务器是不是已经卡在某一行。timeoutMs只负责限制测试装置的生命周期，不用它模拟真实上游性能。"
        },
        {
          "type": "paragraph",
          "text": "同一ID尚未释放时不允许重新初始化，否则旧渲染可能永远等着一份已经被替换的Promise。已完成的ID可重置，Map最多保留32个ID，单个门到30秒会以超时失败收尾。这个上限故意很小，方便读者理解资源边界；它没有跨进程复制、持久化和用户隔离，不能放进公开生产后台当成任务系统。"
        },
        {
          "type": "paragraph",
          "text": "globalThis只让同一Node进程里的路由模块共享这个受控装置。多个进程、Serverless冷启动或多区域部署可能有不同Map，控制请求与报告请求不一定到达同一份状态。正式应用要把报告状态放到真实服务或共享存储，并保留取消、期限、权限和查询契约；一个教学Map的恢复结果不能替代这些条件。"
        },
        {
          "type": "paragraph",
          "text": "客户端离开页面会中断导航或响应消费，但并不自动撤销readReport已经开始的工作。本例没有从Server Component取得一个可取消的上游业务信号；等待最多由自己的30秒期限结束。你可以据此理解流式与取消是不同协议，而不能因为浏览器切走了，就声称报告工作已经回滚或资源立即归零。"
        }
      ]
    },
    {
      "id": "controls",
      "title": "控制面板保持在布局里，才能在报告等待时继续操作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import type {ReactNode} from 'react';\nimport Controls from './Controls';\nexport default function RootLayout({children}:{children:ReactNode}){\n return <html lang=\"zh-CN\"><body style={{fontFamily:'system-ui',maxWidth:850,margin:'auto',padding:20}}><header><h1>STREAM_SHELL · 报告工作台</h1><Controls/></header><main>{children}</main></body></html>;\n}",
          "language": "tsx",
          "filename": "examples/next-streaming-errors/app/layout.tsx",
          "purpose": "共享布局保留工作台标题与客户端控制面板。请求流的壳文本STREAM_SHELL来自这里。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "'use client';\nimport {useState} from 'react';\nimport {useRouter} from 'next/navigation';\nexport default function Controls(){\n  const router=useRouter(),[id,setId]=useState('browser-demo'),[message,setMessage]=useState('先初始化，再释放等待');\n  async function act(op:'init'|'release',mode:'ok'|'fail-once'='ok'){\n    try{const response=await fetch('/api/gates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,id,mode})});const result=await response.json();\n      if(!response.ok)throw new Error(result.error);setMessage(JSON.stringify(result.state));if(op==='init')router.push('/reports/'+encodeURIComponent(id));\n    }catch(error){setMessage(error instanceof Error?error.message:'操作失败');}\n  }\n  return <aside><label>实验ID <input value={id} maxLength={40} onChange={e=>setId(e.target.value)}/></label><button onClick={()=>act('init')}>初始化正常等待</button><button onClick={()=>act('init','fail-once')}>初始化一次失败</button><button onClick={()=>act('release')}>释放等待</button><p role=\"status\">{message}</p></aside>;\n}",
          "language": "tsx",
          "filename": "examples/next-streaming-errors/app/Controls.tsx",
          "purpose": "完整客户端控制：先初始化，再导航到报告；释放请求不依赖等待区是否已经完成。所有异常作为面板状态展示。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {initialize,release,state,validId} from '@/lib/gates';\nexport const runtime='nodejs';\nexport async function POST(request:Request){\n  if(process.env.DEMO_LAB!=='1')return Response.json({error:'LAB_DISABLED'},{status:403});\n  if(request.headers.get('origin')!==process.env.DEMO_APP_ORIGIN)return Response.json({error:'ORIGIN'},{status:403});\n  const reader=request.body?.getReader();let text='',bytes=0;\n  try {\n    if(!reader)throw new Error('BAD_INPUT');const decoder=new TextDecoder();\n    for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();throw new Error('BAD_INPUT');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();\n    const input=JSON.parse(text);if(!validId(input.id))throw new Error('BAD_INPUT');\n    if(input.op==='init')initialize(input.id,input.mode,input.timeoutMs??30000);\n    else if(input.op==='release')release(input.id);\n    else throw new Error('BAD_INPUT');\n    return Response.json({ok:true,state:state(input.id)});\n  }catch(error){const message=error instanceof Error?error.message:'BAD_INPUT';return Response.json({error:message},{status:['GATE_BUSY','LAB_CAPACITY'].includes(message)?409:message==='NOT_FOUND'?404:400});}\n  finally{reader?.releaseLock();}\n}\nexport async function GET(request:Request){\n  if(process.env.DEMO_LAB!=='1')return Response.json({error:'LAB_DISABLED'},{status:403});\n  const id=new URL(request.url).searchParams.get('id');if(!validId(id))return Response.json({error:'BAD_INPUT'},{status:400});\n  return Response.json({state:state(id)});\n}",
          "language": "ts",
          "filename": "examples/next-streaming-errors/app/api/gates/route.ts",
          "purpose": "完整本机控制入口：显式DEMO_LAB和服务端Origin配置、输入ID/模式/容量校验、1024字节读取上限与reader收尾。没有服务端报告密钥。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Origin比较使用显式DEMO_APP_ORIGIN，而不是直接相信内部Request URL的origin。实际自托管时，框架内部URL、监听地址和反向代理外部地址可能不同；本例第一次校验就发现内部地址与外部127.0.0.1不一致。改为部署配置后，既能把合法请求识别清楚，也避免用任意Host反射来扩大允许来源。"
        },
        {
          "type": "paragraph",
          "text": "这仍不是鉴权实现。DEMO_LAB开关和同源校验只是限制教学控制面误用，不能证明调用者是某个登录用户。GET状态也仅限本机实验场景。要公开部署，必须增加身份、资源归属、跨实例状态与运维限制，而不是把Origin正确误认为已经具备安全后台。"
        },
        {
          "type": "paragraph",
          "text": "notFound也是框架的控制流程：page对非法或不存在的ID调用它，由not-found界面表达资源不存在；它没有进入受控报告Promise。不要在page外层用一个不加区分的catch把notFound、redirect和普通意外异常全部转换成“稍后重试”，否则资源缺失和权限导航会丢掉原本语义。控制Route Handler则返回明确HTTP状态，两条入口各自有合适的结果形式。"
        }
      ]
    },
    {
      "id": "wire",
      "title": "真实字节分段怎样验：别把chunk数量当协议承诺",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/next-streaming-errors/wire.svg",
          "title": "真实HTTP分段的控制点",
          "alt": "先观察壳与占位，再放行数据，原响应后续交付；图为逻辑时序，不把箭头长度当实测耗时。",
          "caption": "先观察壳与占位，再放行数据，原响应后续交付；图为逻辑时序，不把箭头长度当实测耗时。"
        },
        {
          "type": "code",
          "code": "import {test,before,after} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {get} from 'node:http';\nimport {start} from './harness.mjs';\nlet app;before(async()=>{app=await start(4335);});after(async()=>{await app?.stop();});\nasync function control(input){const res=await fetch(app.base+'/api/gates',{method:'POST',headers:{origin:app.base,'content-type':'application/json'},body:JSON.stringify(input)});return {res,body:await res.json()};}\nconst pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));\nasync function stream(path){\n const chunks=[];let status=0,html='',closed=false;\n let accept,reject;const done=new Promise((resolve,fail)=>{accept=resolve;reject=fail;});\n const request=get(app.base+path,{headers:{'user-agent':'Mozilla/5.0 Chrome/128.0.0.0'}},res=>{\n  status=res.statusCode;res.setEncoding('utf8');res.on('data',data=>{chunks.push(data);html+=data;});res.on('end',()=>{closed=true;accept();});res.on('error',reject);\n });request.on('error',reject);request.setTimeout(15000,()=>request.destroy(new Error('stream test timeout')));\n return {chunks,done,get html(){return html;},get status(){return status;},async wait(marker){for(let i=0;i<200;i++){if(html.includes(marker))return;if(closed)throw new Error('stream closed before '+marker);await pause(10);}throw new Error('marker not observed: '+marker);},close(){request.destroy();}};\n}\ntest('real HTTP bytes contain a shell and fallback before controlled data release',async()=>{\n assert.equal((await control({op:'init',id:'normal',mode:'ok'})).res.status,200);\n const wire=await stream('/reports/normal');try{\n  await wire.wait('REGION_PENDING');assert.match(wire.html,/STREAM_SHELL/);assert.doesNotMatch(wire.html,/REPORT_READY/);\n  const before=wire.chunks.length;assert.equal((await control({op:'release',id:'normal'})).res.status,200);\n  await wire.done;assert.equal(wire.status,200);assert.match(wire.html,/REPORT_READY/);assert(wire.chunks.length>before);console.log(JSON.stringify({evidence:'controlled-stream',chunksBeforeRelease:before,chunksAfterRelease:wire.chunks.length,status:wire.status}));\n }finally{wire.close();}\n});\ntest('streamed server error hides internal detail; same segment can be fetched again successfully',async()=>{\n await control({op:'init',id:'one-failure',mode:'fail-once'});const wire=await stream('/reports/one-failure');\n try{await wire.wait('REGION_PENDING');await control({op:'release',id:'one-failure'});await wire.done;\n  assert.doesNotMatch(wire.html,/INTERNAL_ONCE_FAILURE_DO_NOT_SEND/);assert.match(wire.html,/digest/);\n  const state=await(await fetch(app.base+'/api/gates?id=one-failure')).json();assert.equal(state.state.failureUsed,true);\n  const recovered=await(await fetch(app.base+'/reports/one-failure')).text();assert.match(recovered,/REPORT_READY/);assert.doesNotMatch(recovered,/INTERNAL_ONCE_FAILURE_DO_NOT_SEND/);\n }finally{wire.close();}\n});\ntest('gate timeout becomes an encoded server error, not fake successful report',async()=>{\n await control({op:'init',id:'timeout',mode:'ok',timeoutMs:100});\n const res=await fetch(app.base+'/reports/timeout'),html=await res.text();assert.doesNotMatch(html,/REPORT_READY|INTERNAL_GATE_TIMEOUT/);assert.match(html,/digest/);\n assert.equal((await(await fetch(app.base+'/api/gates?id=timeout')).json()).state.timedOut,true);\n});\ntest('input and origin guards fail before creating uncontrolled waits',async()=>{\n assert.equal((await control({op:'init',id:'bad id',mode:'ok'})).res.status,400);\n await control({op:'init',id:'busy',mode:'ok'});assert.equal((await control({op:'init',id:'busy',mode:'ok'})).res.status,409);await control({op:'release',id:'busy'});\n const forbidden=await fetch(app.base+'/api/gates',{method:'POST',headers:{origin:'https://outside.invalid'},body:'{}'});assert.equal(forbidden.status,403);\n const missing=await(await fetch(app.base+'/reports/absent')).text();assert.match(missing,/报告未初始化/);\n});",
          "language": "js",
          "filename": "examples/next-streaming-errors/test/integration.mjs",
          "purpose": "完整HTTP验收：用node:http逐段记录响应，等待fallback确实到达后才发release。后续章节还验证错误隐藏、同段重新读取、期限与输入边界。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一条测试在收到REGION_PENDING时立即检查：共享壳已经在累计字节里，REPORT_READY尚未出现。接着记录当前data事件数量，发送独立release请求，等原响应结束，断言内容出现且收到更多数据事件。这个顺序提供了因果证据，比根据控制台总耗时猜测流式更直接。"
        },
        {
          "type": "paragraph",
          "text": "HTTP data事件、TCP包、HTTP/1分块与React逻辑片段不是一一对应关系。代理可以合并字节，浏览器可能等缓冲达到阈值才绘制，HTTP/2又有自己的帧。因此不把“正好两个chunk”写成框架保证；测试只证明在当前本机链路上，释放之前和之后存在可区分的字节阶段。部署到有代理的环境，需要重新检查缓冲策略。"
        },
        {
          "type": "paragraph",
          "text": "这里也不使用完整.response.text()去证明先显示壳。text会等整个响应完成，适合最终内容检查，却丢掉中途观察点。自动化测试保留分段，浏览器验收还要观察真实可见DOM与控制面板是否能交互：字节先到不必然意味着用户已经看到，也不代表hydrate已经完成。"
        },
        {
          "type": "paragraph",
          "text": "状态码有类似边界。若响应头和壳已经作为200发出，后面报告渲染抛错，服务器不能再把同一个HTTP响应头改成500，只能通过流内框架协议通知客户端处理错误。搜索引擎、监控和客户端错误UI都要据具体阶段理解；不能只统计页面200比例就认定所有流式区域成功。"
        },
        {
          "type": "paragraph",
          "text": "流里既可能包含HTML，也可能包含框架用来恢复组件树和替换区域的指令或数据。它不是每段都能直接作为独立HTML文档解释。客户端导航还可能请求RSC响应而不是重新取得整份文档；本测试选择首访HTML，结论限定这一条链路，不能据它宣布所有导航协议和预取缓存已经验证。"
        },
        {
          "type": "paragraph",
          "text": "浏览器预取还会改变你观察到的等待。某条路由可能在点击之前已经准备了部分数据或加载界面；反过来，预取未完成也可能仍要等待。本例控制面板先初始化明确的ID再导航，不把鼠标悬停造成的预取当成报告业务动作。正式系统应让读取可重复、没有写副作用，避免一次预取就不小心触发支付或任务提交。"
        },
        {
          "type": "paragraph",
          "text": "想测“先可用”带来的收益，还要分别记录首字节、壳可见、关键区域就绪与交互可用的时间，而不是只报一个页面总耗时。这里提供顺序证据，没有发布性能提升百分比；本机loopback绕过公网和代理，数据源又是受控门，把其毫秒数字写成真实报告服务性能会误导读者。"
        }
      ]
    },
    {
      "id": "recovery",
      "title": "错误恢复：16.4.2的 retry 会重新读取，reset只清边界状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "'use client';\nexport default function ReportError({error,retry}:{error:unknown;retry:()=>void}){\n const digest=typeof error==='object'&&error!==null&&'digest' in error?String(error.digest):'unavailable';\n return <section role=\"alert\"><h2>报告加载失败</h2><p>诊断编号：{digest}。不会在这里展示内部错误原文。</p><button onClick={()=>retry()}>重新读取并恢复</button><a href=\"/\">回工作台</a></section>;\n}",
          "language": "tsx",
          "filename": "examples/next-streaming-errors/app/reports/[id]/error.tsx",
          "purpose": "固定本例Next16.4.2的完整段落错误组件。error按unknown收窄，界面只显示诊断编号；按钮使用该版本提供的retry。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "error边界必须是Client Component。生产Server Component异常通常会把通用消息与digest交给客户端，而不直接暴露服务器原始错误。我们自己的错误组件也不渲染error.message，避免把内部路径、密钥或上游响应当成用户提示。digest帮助与服务端诊断关联，但它不是用户权限或稳定业务事件ID。"
        },
        {
          "type": "paragraph",
          "text": "需要特别注意版本：本例16.4.2同时提供reset和retry。固定源码里，reset只把错误边界状态设为null；retry则在transition中调用路由refresh，再reset。于是本例“重新读取并恢复”采用retry，而不是照旧资料只调用reset却期待已经失败的服务器结果自动重新产生。升级框架后，应重新核对这个契约。"
        },
        {
          "type": "reference",
          "title": "16.4.2错误边界与retry固定源码",
          "url": "https://github.com/vercel/next.js/blob/v16.4.2/packages/next/src/client/components/error-boundary.tsx",
          "note": "该版本reset清错误状态；retry组合refresh与reset。这里注明出处，关键业务错误组件已经在正文。"
        },
        {
          "type": "code",
          "code": "retry = () => {\n  startTransition(() => {\n    this.context?.refresh()\n    this.reset()\n  })\n}",
          "language": "tsx",
          "filename": "Next.js v16.4.2 · error-boundary.tsx",
          "purpose": "固定版本MIT许可源码节选，出处为下方Next仓库链接。只展示retry关键逻辑：重新读取与重置边界是两项操作，不能将reset等同于refresh。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "fail-once在第一次已释放读取后记录failureUsed并抛错；同ID下一次读取就返回报告。HTTP测试先确认生产流里没有INTERNAL_ONCE_FAILURE_DO_NOT_SEND，再重新请求同一路由并得到REPORT_READY。这证明服务端重新读取具备恢复条件；它没有点击浏览器里的retry按钮，按钮能否在hydrate后触发正确请求仍由真实浏览器验收单列。"
        },
        {
          "type": "paragraph",
          "text": "如果上游一直坏，retry不会把错误魔法般修好。永久无权限、数据不存在与输入不合法应有各自结果；反复自动重试还可能放大故障。这里按钮由用户明确触发，且每次读取有界。正式业务应记录尝试、请求身份和上游状态，而不是在错误边界useEffect里无限refresh。"
        },
        {
          "type": "paragraph",
          "text": "这份恢复只涉及只读报告重新渲染，没有自动重发写操作。若错误发生在提交动作之后、成功响应之前，调用retry可能重新读取界面，却不能凭空证明写操作未生效；业务仍要有幂等键和结果查询。不要把错误边界的“重试”按钮直接接到不安全POST，再把可见界面恢复当成业务恰好执行一次。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行与验收：分别记录服务端流、客户端恢复和部署限制",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/next-streaming-errors\nnpm ci\nnpm run build\nnpm test\nDEMO_LAB=1 DEMO_APP_ORIGIN=http://127.0.0.1:4335 npm start",
          "language": "bash",
          "filename": "终端",
          "purpose": "固定端口4335。生产构建与开发模式行为分开；命令中的LAB只用于本机教学。",
          "kind": "runnable"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "先在工作台使用browser-demo初始化正常等待，确认标题和面板保留，报告区域显示占位；30秒内点击释放，报告出现。",
            "初始化一次失败并释放，确认段落错误界面显示，外层布局仍可操作；点击“重新读取并恢复”，确认真正发出新的服务器请求并成功。",
            "浏览器开发工具保留网络日志，观察文档/RSC请求与响应过程；不要拿一次完整HTML下载代替中途DOM检查。",
            "关闭JavaScript或阻止hydrate时，记录流式内容与错误恢复的差别；不能默认所有交互都会工作。"
          ]
        },
        {
          "type": "paragraph",
          "text": "macOS14.5/Node22.12.0已完成webpack生产构建及4项真实HTTP测试。受控流、生产错误隐藏、同段重新请求、真实期限与控制输入均通过。当前记录不宣称浏览器retry点击、移动设备、代理或托管多区域通过；发布时将这些结果单列，避免把服务器HTTP证据扩大为完整客户端体验。"
        },
        {
          "type": "paragraph",
          "text": "如果页面始终到最后才一起出现，先看等待是否真的处在边界内，再看测试读取方式与代理缓冲；如果壳正常但按钮不能用，先检查客户端资源和hydrate；如果retry后继续失败，确认上游状态和新请求是否真的发生。用这条分层排查顺序，你就能把“加载慢、没流式、没水合、重试无效”四种现象拆开，而不是统一归结为Suspense失效。"
        },
        {
          "type": "paragraph",
          "text": "实验属于独立Next服务器工程，不能把page.tsx直接扔进本站React18沙箱就期待路由约定生效。本站离线包可以保存正文、图形与源码ZIP，Next运行依赖、Node服务器和本地端口仍需另行准备。手机只离线阅读文章时不会自动拥有一个可用的报告后端；把阅读能力与工程运行条件分开写，才能让复现步骤真正可执行。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Next16.4.2 loading",
      "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/03-api-reference/03-file-conventions/loading.mdx"
    },
    {
      "title": "Next16.4.2 error",
      "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/03-api-reference/03-file-conventions/error.mdx"
    },
    {
      "title": "Next16.4.2 error boundary源码",
      "url": "https://github.com/vercel/next.js/blob/v16.4.2/packages/next/src/client/components/error-boundary.tsx"
    },
    {
      "title": "Next自托管流式与代理",
      "url": "https://nextjs.org/docs/app/guides/self-hosting"
    }
  ]
};
export default article;
