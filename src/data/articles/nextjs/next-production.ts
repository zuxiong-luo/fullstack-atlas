import type {Article} from '../../articleTypes';
const article:Article={
  "id": "next-production",
  "topic": "nextjs",
  "title": "Next.js 生产工程：构建产物、环境配置、部署与请求追踪",
  "description": "真正构建standalone产物并复制到临时目录启动，验证运行时配置与公开构建变量的区别、追踪文件、静态资源、请求ID、结构化日志和缺配置/缺文件故障恢复。",
  "minutes": 60,
  "labMinutes": 40,
  "tags": [
    "Next.js",
    "生产部署",
    "standalone",
    "环境变量",
    "文件追踪",
    "请求日志"
  ],
  "scope": "Next16.4.2自托管Node生产单实例，Cache Components关闭，webpack与standalone。只验证当前macOS/Node平台和单服务请求关联，不声称Docker、Linux、多区域、CDN、反代、真实凭据服务或分布式追踪已验。",
  "prerequisites": [
    "读过App Router、Route Handler与Server/Client边界",
    "能理解环境变量、构建目录与Node进程的区别"
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
      "path": "next-production.zip"
    },
    {
      "label": "运行步骤与验证范围",
      "path": "next-production/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "生产工程是什么：让同一份程序在明确条件下启动、服务与排错",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "生产工程关注的是应用离开开发服务器以后，能否在可重复的环境里启动、找到所需文件、读取正确配置，并让一次失败留下足够证据。它不等于把npm run dev换成start。开发模式的即时编译、错误展示和本机目录都可能掩盖部署缺失，只有实际生产构建与独立运行，才知道交付物里究竟缺了什么。"
        },
        {
          "type": "paragraph",
          "text": "我们继续使用报告服务，但不引入真实云账号。目标是一份release目录：复制到新的临时位置后启动，不依赖源码目录里的node_modules、public或assets。然后用同一份构建切换运行时区域与私有token，检查哪些值能变、哪些已经进入客户端包；再用请求ID把响应与日志对齐。每个结论都有可重复的失败条件，不把“本机页面打开了”当成部署完成。"
        },
        {
          "type": "paragraph",
          "text": "示例固定Next16.4.2、React19.3.1和Node22.12.0，明确关闭Cache Components，使用webpack生产构建。它是当前平台单进程Node自托管，不是GitHub Pages静态导出，也不是托管平台多区域实验。这里只保存一个非秘密构建说明文件，没有数据库、付费上游或真实用户数据。"
        },
        {
          "type": "figure",
          "src": "figures/next-production/artifact.svg",
          "title": "先区分源码、构建结果与实际部署目录",
          "alt": "next build生成standalone与static；打包脚本补public、启动器和显式运行时asset，再复制到新位置验证。没有把仓库整个目录当作部署产物。",
          "caption": "next build生成standalone与static；打包脚本补public、启动器和显式运行时asset，再复制到新位置验证。没有把仓库整个目录当作部署产物。"
        }
      ]
    },
    {
      "id": "artifact",
      "title": "构建产物的结构：standalone不会替你复制所有文件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import type {NextConfig} from 'next';\nconst config:NextConfig={cacheComponents:false,output:'standalone',poweredByHeader:false,outputFileTracingRoot:process.cwd(),outputFileTracingIncludes:{'/api/report':['./assets/build-info.json']},experimental:{cpus:1}};\nexport default config;",
          "language": "ts",
          "filename": "examples/next-production/next.config.ts",
          "purpose": "完整生产配置：standalone、固定追踪根、显式包含运行时asset，关闭Cache Components。cpus1仅为本机构建资源约束，不是线上请求并发设置。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "output=standalone会让Next把运行所需的服务器文件和部分依赖复制到.next/standalone，并生成最小server.js。文件追踪尝试通过import、require和文件读取推导依赖；它不是把整个源码和所有资源自动打包，更不保证任意运行时计算路径都能被准确猜中。配置追踪根，也不等于部署机必须拥有相同绝对目录。"
        },
        {
          "type": "paragraph",
          "text": "public和.next/static需要显式处理。前者是应用公开文件，后者是浏览器需要的构建资源；最小服务器能启动，不代表这些URL都已经有文件。漏static常表现为HTML到达、客户端脚本404、按钮不工作。我们不仅请求首页，还从HTML提取实际JS路径再发HTTP请求，避免拿“服务器200”替代完整资源验收。"
        },
        {
          "type": "code",
          "code": "import {cp,mkdir,rm,access} from 'node:fs/promises';\nawait access('.next/standalone/server.js');\nawait rm('release',{recursive:true,force:true});\nawait cp('.next/standalone','release',{recursive:true});\nawait mkdir('release/.next',{recursive:true});\nawait cp('.next/static','release/.next/static',{recursive:true});\nawait cp('public','release/public',{recursive:true});\nawait cp('boot.mjs','release/boot.mjs');await cp('runtime','release/runtime',{recursive:true});\nawait access('release/assets/build-info.json');\nconsole.log('release/ 已包含standalone、static、public、显式追踪asset与启动校验');",
          "language": "js",
          "filename": "examples/next-production/scripts/stage.mjs",
          "purpose": "完整交付装配：先验证最小server存在，再复制standalone、static、public、boot与runtime，最后检查显式asset。release为生成目录，不进源码ZIP。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "assets/build-info.json在Route Handler里通过process.cwd拼路径读取，构建器不应被要求从任意动态表达式推断全部业务文件。这里在outputFileTracingIncludes中把它关联到/api/report；测试读取实际.nft.json，确认路径进入追踪列表，再检查独立部署目录真的有文件。两个检查分别覆盖“声明被生成”和“装配没有漏掉”。"
        },
        {
          "type": "paragraph",
          "text": "追踪清单不是安全权限清单。过宽的包含规则可能把多余文件、测试数据甚至秘密带入交付物，过窄则会在请求时缺文件。生产应针对确定的运行资源匹配，并扫描最终产物；不能用一个指向整个用户目录的通配符把错误藏起来。本例只包含固定的非秘密JSON资产。"
        },
        {
          "type": "reference",
          "title": "固定16.4.2 output与文件追踪",
          "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/03-api-reference/05-config/01-next-config-js/output.mdx",
          "note": "standalone与静态资源装配分工；本文提供实际stage脚本与独立运行证据。"
        },
        {
          "type": "paragraph",
          "text": "源码ZIP和部署release是两种交付：前者包含锁文件、测试和构建说明，用于重现；后者包含构建结果与运行所需文件，用于启动。ZIP不带node_modules，也不把本机生成的release塞进站点离线包。读者下载后需要按精确锁安装，再在目标平台构建；直接打开源码目录中的HTML，不能替代这个服务器工程。"
        }
      ]
    },
    {
      "id": "config",
      "title": "配置有两个时间点：构建时固化，运行时读取",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export function loadConfig(env=process.env){\n const token=env.DEMO_API_TOKEN,region=env.DEMO_REGION;\n if(typeof token!=='string'||token.length<16||token.length>128)throw new Error('CONFIG_DEMO_API_TOKEN');\n if(typeof region!=='string'||!/^[a-z0-9-]{1,32}$/.test(region))throw new Error('CONFIG_DEMO_REGION');\n return {token,region};\n}",
          "language": "js",
          "filename": "examples/next-production/runtime/config.mjs",
          "purpose": "完整私有运行时配置校验。token只用于展示服务端配置生命周期，不接真实上游，也不把它当作本例API访问鉴权。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import 'server-only';\nimport {loadConfig} from '../runtime/config.mjs';\nexport const runtimeConfig=()=>loadConfig();",
          "language": "ts",
          "filename": "examples/next-production/lib/config.ts",
          "purpose": "server-only边界：服务端渲染和Route Handler从这里读取配置，客户端组件不导入。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "'use client';\nimport {useState} from 'react';\nexport default function Title(){const [clicks,setClicks]=useState(0);return <section><h2>公开构建标题：{process.env.NEXT_PUBLIC_SITE_TITLE??'unset'}</h2><button onClick={()=>setClicks(n=>n+1)}>客户端计数 {clicks}</button></section>;}",
          "language": "tsx",
          "filename": "examples/next-production/app/Title.tsx",
          "purpose": "完整客户端组件：公开标题采用直接NEXT_PUBLIC读取，构建时进入客户端包；同时提供按钮供真实hydrate验收。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import Title from './Title';\nimport {runtimeConfig} from '@/lib/config';\nexport const dynamic='force-dynamic';\nexport default function Page(){const {region}=runtimeConfig();return <main><h1>独立生产部署</h1><p>运行时区域：{region}</p><Title/><p>公开构建变量固化在客户端包中；私有token仅在服务端读取。</p><a href=\"/api/report\">查看请求追踪JSON</a></main>;}",
          "language": "tsx",
          "filename": "examples/next-production/app/page.tsx",
          "purpose": "完整动态页：运行时区域在服务端读取，公开标题由上面的Client Component输出。没有把私有token作为props传到客户端。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "NEXT_PUBLIC前缀的用途是允许公开值进入浏览器代码，不是给环境变量加密。本例直接访问process.env.NEXT_PUBLIC_SITE_TITLE，构建时设置Build-A；用同一份产物启动时即使环境里改成Runtime-B，客户端仍显示Build-A。原因不是浏览器缓存没清，而是旧值已经作为构建内容的一部分。要改变这个公开常量，需要重新构建。"
        },
        {
          "type": "paragraph",
          "text": "运行时token与region走另一条路径：动态Server Component和Route Handler在服务器进程里读取。token不通过props或JSON返回，region则刻意作为非秘密配置显示在首页并返回报告JSON。两次启动同一份产物，region可以从local-a变成local-b。这个结论依赖当前动态读取路径；静态预渲染时读到的普通环境变量也可能固化在生成结果里，不能泛称“没NEXT_PUBLIC就一定每次请求动态变化”。"
        },
        {
          "type": "paragraph",
          "text": "server-only能防止把某个模块错误导入客户端，却不能阻止你在服务端手动把秘密return出去。我们还扫描全部浏览器JS，检查私有变量名与两组实际测试token未出现；同时检查响应和日志没有秘密。扫描是当前路径的回归证据，不是对任意未来修改的泄漏证明，数据流边界仍需要审查。"
        },
        {
          "type": "paragraph",
          "text": "本例.env.example只有教学占位，真实.env与真实token不提交。构建服务器、运行服务器和CI可能有不同配置来源，正式系统应明确谁注入、什么时候校验、如何轮换，以及缺配置时是否拒绝服务。把一个只能在开发机shell里偶然取得的变量当成默认值，会让部署问题变成难以复现的“有时好使”。"
        },
        {
          "type": "paragraph",
          "text": "生产构建标题在测试中固定为Build-A，是为了让配置时间线可判定；如果你自行用另一个值构建，测试里对应期望也应一起调整，不能据此误判Next环境变量坏了。示例命令把这个输入写在build前，运行时只提供私有配置，避免操作步骤依赖读者之前终端里残留的公开变量。"
        }
      ]
    },
    {
      "id": "startup",
      "title": "启动先校验：配置缺失不应该等第一位用户撞见",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {loadConfig} from './runtime/config.mjs';\ntry{loadConfig();}catch(error){console.error(JSON.stringify({event:'boot.rejected',code:error.message}));process.exit(1);}\nprocess.env.PORT||='4336';process.env.HOSTNAME='127.0.0.1';process.env.NEXT_TELEMETRY_DISABLED='1';\nawait import('./server.js');",
          "language": "js",
          "filename": "examples/next-production/boot.mjs",
          "purpose": "交付目录中的完整启动器：先校验私有配置再导入最小server，固定本机端口4336。异常日志只记录配置项代码，不输出值。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "boot在导入server.js之前调用loadConfig。缺token或region格式错误就以退出码1结束，没有先监听再等第一条请求触发异常。这个顺序使进程管理器能够识别启动失败，也避免短暂接受一个注定不能工作的实例。它是我们明确增加的启动协议，不是宣称Next默认会验证所有应用环境变量。"
        },
        {
          "type": "paragraph",
          "text": "最小服务器的监听端口默认4336，可用PORT覆盖；教学启动器把HOSTNAME限定127.0.0.1，以免本机控制服务无意公开。真实部署需按容器或服务网络策略调整监听地址；Node绑定某个地址和反向代理给外部用户提供HTTPS是不同层次。这个例子没有申请证书、开启公网入口或假装执行云部署。"
        },
        {
          "type": "paragraph",
          "text": "/api/health只表示进程能响应，是存活探针而非完整依赖就绪探针。后面的“缺asset”实验中，进程仍活着，但报告接口500。如果生产依赖数据库或模型服务，应该按可用性需求设计就绪与降级策略，防止简单healthy标签掩盖关键路径损坏；也不要让每次存活探测都触发昂贵上游调用。"
        },
        {
          "type": "code",
          "code": "export function GET(){return Response.json({alive:true},{headers:{'cache-control':'no-store'}});}",
          "language": "ts",
          "filename": "examples/next-production/app/api/health/route.ts",
          "purpose": "完整轻量存活接口，没有额外远程探测或伪造依赖健康状态。",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "trace",
      "title": "请求追踪先做关联：一个ID贯穿当前服务的入口与响应",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/next-production/trace.svg",
          "title": "请求与结果靠同一ID关联",
          "alt": "请求头沿调用方向传递，响应带回关联ID；结构化日志仅包含受控字段，不构成分布式追踪系统。",
          "caption": "请求头沿调用方向传递，响应带回关联ID；结构化日志仅包含受控字段，不构成分布式追踪系统。"
        },
        {
          "type": "code",
          "code": "import {randomUUID} from 'node:crypto';\nimport {NextResponse,type NextRequest} from 'next/server';\nexport function proxy(request:NextRequest){\n const supplied=request.headers.get('x-request-id');\n const requestId=supplied&&/^[A-Za-z0-9_-]{8,64}$/.test(supplied)?supplied:randomUUID();\n const headers=new Headers(request.headers);headers.set('x-request-id',requestId);\n const response=NextResponse.next({request:{headers}});response.headers.set('x-request-id',requestId);return response;\n}\nexport const config={matcher:['/api/report']};",
          "language": "ts",
          "filename": "examples/next-production/proxy.ts",
          "purpose": "完整请求ID入口：只接受长度与字符集合符合约定的外部ID，否则生成UUID；把同一ID注入下游请求并带回响应。Next16这里使用proxy.ts约定。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "request ID用于把一条响应与相关日志连起来。它不是登录身份，不证明用户权限，也不是订单幂等键。外部调用者可以提供格式合法的ID，所以生产不能据它做授权；如果需要防止日志关联冲突，可以由边界网关始终生成自己的内部ID，并另外保存经约束的外部关联值。"
        },
        {
          "type": "paragraph",
          "text": "本例接受8～64字符的字母、数字、下划线与连字符，拒绝任意换行、长文本或原样URL。限制格式使日志行更容易分析，也避免把大段用户输入变成关联字段。框架响应头、Route Handler收到的请求头与返回JSON都使用同一个ID，测试能验证它真正经过边界，而不是每一层各自随机生成。"
        },
        {
          "type": "code",
          "code": "import {readFile} from 'node:fs/promises';\nimport {join} from 'node:path';\nimport {runtimeConfig} from '@/lib/config';\nexport const runtime='nodejs';\nexport async function GET(request:Request){\n const id=request.headers.get('x-request-id')??'missing',started=performance.now();\n console.log(JSON.stringify({event:'request.start',id,route:'/api/report',method:'GET'}));\n try{\n  const {region}=runtimeConfig();\n  const asset=JSON.parse(await readFile(join(process.cwd(),'assets','build-info.json'),'utf8'));\n  if(new URL(request.url).searchParams.get('fail')==='1')throw new Error('PRIVATE_INTERNAL_DETAIL');\n  const body={ok:true,id,region,asset:asset.service};\n  console.log(JSON.stringify({event:'request.finish',id,status:200,durationMs:Number((performance.now()-started).toFixed(3))}));\n  return Response.json(body,{headers:{'cache-control':'no-store','x-request-id':id}});\n }catch{\n  console.error(JSON.stringify({event:'request.finish',id,status:500,code:'REPORT_UNAVAILABLE',durationMs:Number((performance.now()-started).toFixed(3))}));\n  return Response.json({ok:false,id,error:'REPORT_UNAVAILABLE'},{status:500,headers:{'cache-control':'no-store','x-request-id':id}});\n }\n}",
          "language": "ts",
          "filename": "examples/next-production/app/api/report/route.ts",
          "purpose": "完整服务路径：读取运行时配置与追踪asset，输出关联ID和区域；成功/失败都有结构化finish，错误响应不暴露内部原文。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "日志记录event、id、route、method、status与durationMs，不把Authorization、Cookie、请求体或完整查询串复制进去。duration采用performance.now的差值，描述这一段处理范围，不包括用户设备、所有网络和代理耗时；它不能直接等同于端到端延迟。这里没有对多服务traceparent传播或分布式span做出承诺。"
        },
        {
          "type": "paragraph",
          "text": "GET中的fail=1只用于当前教学故障，最终响应固定REPORT_UNAVAILABLE和请求ID。内部错误常量不进入用户正文；日志也使用受控错误码，而不是把可能包含敏感信息的整份上游异常序列化。真实排错需要在保护数据的前提下记录足够分层信息，不能在“什么都不记”和“把所有头打出来”之间二选一。"
        }
      ]
    },
    {
      "id": "framework-errors",
      "title": "应用内捕获与框架捕获，要知道两份记录各自覆盖什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import type {Instrumentation} from 'next';\nexport const onRequestError:Instrumentation.onRequestError=async(error,request,context)=>{\n const digest=typeof error==='object'&&error!==null&&'digest' in error?String(error.digest):undefined;\n console.error(JSON.stringify({event:'next.error',digest,method:request.method,route:context.routePath,kind:context.routeType}));\n};",
          "language": "ts",
          "filename": "examples/next-production/instrumentation.ts",
          "purpose": "完整框架错误观察入口：unknown收窄后只记录digest与框架路由上下文，不输出任意原始message或请求headers。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Route Handler已经catch的失败由自己的request.finish记录，不会因为返回500就自动变成onRequestError里的未捕获异常。instrumentation的钩子用于Next捕获到的服务器错误，覆盖面与业务错误日志不同。两者可以互补，但监控计数要避免同一故障被重复当成两次业务失败。"
        },
        {
          "type": "paragraph",
          "text": "onRequestError收到的error可能经过React或框架处理，不应假设一定是你原来throw的Error实例。digest可以帮助对齐错误来源，routePath则比原样记录用户完整路径和查询更可控。本例钩子仅输出本机结构化日志，没有上传遥测服务；它的存在不证明告警、存储、采样、脱敏和故障通知都已经建设完成。"
        },
        {
          "type": "paragraph",
          "text": "需要跨服务追踪时，要定义上下游上下文传递、采样和span生命周期，尤其把排队、执行和等待区分开。仅添加一个x-request-id不等于分布式追踪系统。这里先建立单服务可验证关联，读者能从某个500响应找到同ID的finish，再逐步扩展，而不把一张架构图当成已交付的可观测性平台。"
        },
        {
          "type": "reference",
          "title": "16.4.2 instrumentation约定",
          "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/03-api-reference/03-file-conventions/instrumentation.mdx",
          "note": "钩子是框架观察点，应用已处理错误仍需明确自己的日志。"
        }
      ]
    },
    {
      "id": "real-deployment",
      "title": "真正脱离源码运行：用缺文件、缺配置反驳“构建成功就够了”",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {test,before,after} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {spawn} from 'node:child_process';\nimport {mkdtemp,cp,rm,readFile,readdir,lstat,rename} from 'node:fs/promises';\nimport {tmpdir} from 'node:os';\nimport {join,resolve,relative} from 'node:path';\nconst pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));\nconst base='http://127.0.0.1:4336';let deployment,child,logs='';\nconst privateA='runtime-secret-a-never-public',privateB='runtime-secret-b-never-public';\nasync function stop(){if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(4000)]);if(child.exitCode===null){child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));}}}\nasync function start(overrides={}){\n logs='';child=spawn(process.execPath,['boot.mjs'],{cwd:deployment,env:{...process.env,DEMO_API_TOKEN:privateA,DEMO_REGION:'local-a',NEXT_PUBLIC_SITE_TITLE:'Runtime-B',...overrides},stdio:['ignore','pipe','pipe']});\n child.stdout.on('data',d=>{logs+=d;});child.stderr.on('data',d=>{logs+=d;});child.on('error',e=>{logs+=e.stack;});\n for(let i=0;i<200;i++){if(child.exitCode!==null)throw new Error('boot failed: '+logs);try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await pause(50);}\n throw new Error('standalone not ready: '+logs);\n}\nasync function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())out.push(...await files(path));else out.push(path);}return out;}\nbefore(async()=>{deployment=await mkdtemp(join(tmpdir(),'atlas-standalone-'));await cp('release',deployment,{recursive:true});await start();});\nafter(async()=>{await stop();if(deployment)await rm(deployment,{recursive:true,force:true});});\ntest('traced output is self-contained and includes explicit runtime asset',async()=>{\n const manifest=JSON.parse(await readFile('.next/server/app/api/report/route.js.nft.json','utf8'));\n assert(manifest.files.some(name=>name.endsWith('assets/build-info.json')));\n assert.equal(JSON.parse(await readFile(join(deployment,'assets/build-info.json'),'utf8')).service,'atlas-production');\n for(const path of await files(deployment))if((await lstat(path)).isSymbolicLink()){const {realpath}=await import('node:fs/promises');const target=await realpath(path);assert(!relative(deployment,target).startsWith('..'),'external symlink '+path);}\n});\ntest('same detached artifact serves HTML, Next static bundle and public asset',async()=>{\n const html=await(await fetch(base)).text();assert.match(html,/local-a/);assert.match(html,/Build-A/);assert.doesNotMatch(html,/Runtime-B/);\n const script=html.match(/src=\"([^\\\"]*\\/_next\\/static\\/[^\\\"]+\\.js)\"/);assert(script);\n assert.equal((await fetch(base+script[1])).status,200);assert.equal(await(await fetch(base+'/health.txt')).text(),'standalone public asset\\n');\n});\ntest('private runtime token is absent from all browser JS',async()=>{\n for(const file of await files(join(deployment,'.next/static'))){if(!file.endsWith('.js'))continue;const source=await readFile(file,'utf8');assert(!source.includes(privateA));assert(!source.includes(privateB));assert(!source.includes('DEMO_API_TOKEN'));}\n});\ntest('request ID and structured start/finish logs correlate without logging credentials',async()=>{\n const res=await fetch(base+'/api/report',{headers:{'x-request-id':'known_request_42',authorization:'Bearer do-not-log'}}),body=await res.json();\n for(let i=0;i<100&&!logs.includes('\\\"id\\\":\\\"known_request_42\\\",\\\"status\\\":200');i++)await pause(10);\n assert.equal(res.status,200);assert.equal(res.headers.get('x-request-id'),'known_request_42');assert.equal(body.id,'known_request_42');assert.equal(body.asset,'atlas-production');\n assert.match(logs,/\"event\":\"request.start\",\"id\":\"known_request_42\"/);assert.match(logs,/\"event\":\"request.finish\",\"id\":\"known_request_42\",\"status\":200/);assert.doesNotMatch(logs,/do-not-log|runtime-secret/);\n});\ntest('untrusted invalid request ID is replaced, internal failure is redacted',async()=>{\n const res=await fetch(base+'/api/report?fail=1',{headers:{'x-request-id':'bad id'}}),body=await res.json();assert.equal(res.status,500);assert.equal(body.error,'REPORT_UNAVAILABLE');assert.match(body.id,/^[a-f0-9-]{36}$/);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_INTERNAL_DETAIL|runtime-secret/);\n});\ntest('missing traced asset is a real production failure, restored file recovers',async()=>{\n const file=join(deployment,'assets/build-info.json');await rename(file,file+'.hidden');try{assert.equal((await fetch(base+'/api/report')).status,500);}finally{await rename(file+'.hidden',file);}\n assert.equal((await fetch(base+'/api/report')).status,200);\n});\ntest('one immutable build accepts different private runtime config without changing public build value',async()=>{\n await stop();await start({DEMO_API_TOKEN:privateB,DEMO_REGION:'local-b'});const html=await(await fetch(base)).text();assert.match(html,/local-b/);assert.match(html,/Build-A/);assert.doesNotMatch(html,/Runtime-B|runtime-secret/);\n});\ntest('missing required startup config fails before accepting requests',async()=>{\n await stop();logs='';child=spawn(process.execPath,['boot.mjs'],{cwd:deployment,env:{...process.env,DEMO_API_TOKEN:'',DEMO_REGION:'local-b'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);\n const code=await new Promise(resolve=>child.once('exit',resolve));assert.equal(code,1);assert.match(logs,/boot.rejected/);assert.match(logs,/CONFIG_DEMO_API_TOKEN/);await assert.rejects(fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)}));\n});",
          "language": "js",
          "filename": "examples/next-production/test/integration.mjs",
          "purpose": "完整生产验收：复制release到新临时目录，从boot启动，验证静态资源、追踪文件、配置切换、包扫描、日志与两条失败恢复路径。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "测试不是在源码目录里next start后宣称standalone可部署。它先把release复制到系统临时目录，只在这个副本里运行boot；再扫描其中符号链接，拒绝指向部署目录之外的目标。这样能发现“本机能跑只是因为链接回原项目node_modules”的假独立。当前源项目也实际执行过精确锁的npm ci，没有让生产验收依赖另一个示例的符号链接。"
        },
        {
          "type": "paragraph",
          "text": "缺文件实验把部署副本里的build-info.json改名，真实报告接口返回500；恢复文件后再请求回到200。这说明追踪asset确实被运行路径使用，而不是只在ZIP里摆一个从未读取的文件。缺配置实验则停止服务，以空token重新启动，断言退出码1、配置错误码和端口不可达，验证故障发生在接收请求之前。"
        },
        {
          "type": "paragraph",
          "text": "同一构建先以local-a与私有token A启动，再以local-b与token B重启，首页区域改变而公开标题仍是Build-A。这个对照同时检查了两条配置时间线。它没有在测试间重新build，因此不能把结果误读为“部署时每次都重新编译后才成功”。"
        },
        {
          "type": "paragraph",
          "text": "本机复制的standalone只证明当前OS、架构、Node版本和文件布局可运行。若依赖含原生二进制，换Linux或ARM时需要在匹配的构建/运行环境验证；容器镜像、健康探针、信号转发、只读文件系统和滚动部署也要各自验收。这里没有以macOS本机进程替代Docker或多区域生产证据。"
        },
        {
          "type": "paragraph",
          "text": "运行成功还不意味着发布过程原子。本例测试每次启动一份完整复制的产物，不演示一边服务一边覆盖文件。实际多实例发布要让服务器与它引用的版本化静态资源共存，明确何时切流、旧请求怎样完成，以及失败后回滚到哪份构建。这个问题与standalone能否独立启动相关，却不能由一次本机启动测试全部证明。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行方式、结果与交付检查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/next-production\nnpm ci\nNEXT_PUBLIC_SITE_TITLE=Build-A NEXT_TELEMETRY_DISABLED=1 npm run build\nnpm test\nDEMO_API_TOKEN=local-demo-token-at-least-16 DEMO_REGION=local-a npm start\n# http://127.0.0.1:4336/",
          "language": "bash",
          "filename": "终端",
          "purpose": "先build再test；test临时部署副本结束会删除。手工启动使用release，不依赖开发服务器。示例值是公开教学占位，不是线上凭据。",
          "kind": "runnable"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "检查release内有server.js、.next/static、public、assets与boot；从独立目录运行后分别请求首页、实际JS和health.txt。",
            "请求/api/report并自带known_request_42，核对响应头、JSON和start/finish日志同ID；带非法ID确认被替换。",
            "请求/api/report?fail=1，确认500中只有公开错误码与ID，没有内部错误原文或token；根据日志找到同一次失败。",
            "在同一产物上切换region与私有token，确认服务器值改变、公开构建标题不变；缺配置应在监听前退出。"
          ]
        },
        {
          "type": "paragraph",
          "text": "已在macOS14.5/Node22.12.0执行独立npm ci、webpack构建、standalone装配与8项真实HTTP测试，全部通过。验证包含追踪清单、临时部署目录、静态/public资源、浏览器包秘密扫描、请求关联、缺asset恢复、配置切换与启动拒绝。客户端按钮hydrate、浏览器移动视口由发布验收单列，不用服务器HTML文本替代点击结果。"
        },
        {
          "type": "paragraph",
          "text": "部署时还应把构建标识、运行版本、配置来源和回滚产物关联起来；不要在旧进程继续服务时原地覆盖一半static。正式运维还需信号和超时预算、访问日志保留、错误采样与依赖SLA。本篇给出的基础是能够解释并复现：程序从哪些文件启动、什么时候读取什么配置、一次失败留下哪条证据。只有这些边界清楚，后续容器与云平台才不会把问题变得更隐蔽。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Next16.4.2 output与追踪",
      "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/03-api-reference/05-config/01-next-config-js/output.mdx"
    },
    {
      "title": "Next16.4.2环境变量",
      "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/02-guides/environment-variables.mdx"
    },
    {
      "title": "Next16.4.2 instrumentation",
      "url": "https://raw.githubusercontent.com/vercel/next.js/v16.4.2/docs/01-app/03-api-reference/03-file-conventions/instrumentation.mdx"
    },
    {
      "title": "Next自托管说明",
      "url": "https://nextjs.org/docs/app/guides/self-hosting"
    }
  ]
};
export default article;
