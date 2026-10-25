import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "node-parallel-computing",
  "topic": "nodejs",
  "title": "Node.js 并行计算：Worker、进程池与通信边界",
  "description": "先定义主线程、libuv 工作池、Worker 与 OS 进程，再用真实 spawn/exec/fork、cluster 和有界计算池验证通信、取消、崩溃和资源回收。",
  "minutes": 78,
  "labMinutes": 45,
  "scope": "Node22.12的可信纯CPU教学任务，thread/process双模式本地池；内存队列、有限任务与有限重启，不提供持久可靠队列、任意代码沙箱或生产加速承诺。",
  "tags": [
    "Node.js",
    "Worker",
    "进程池",
    "背压",
    "取消",
    "通信"
  ],
  "prerequisites": [
    "会读JavaScript Promise、事件监听和ESM模块",
    "理解Node主线程事件循环与进程的基本含义"
  ],
  "kind": "series",
  "status": "complete",
  "verifiedAt": "2026-10-25",
  "versions": [
    "Node.js22.12.0；ESM；无第三方npm依赖",
    "macOS14.5 x64实测；其他OS与生产负载另验"
  ],
  "questionIds": [],
  "examples": [
    {
      "label": "完整实现、精确锁文件与真实测试",
      "path": "node-parallel-computing.zip"
    },
    {
      "label": "运行与验证范围",
      "path": "node-parallel-computing/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "并行计算是什么：把CPU工作放到另一个执行上下文",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "并行计算是在不同执行上下文中推进可以独立完成的计算。Node主线程上的JavaScript不会因为函数标了async就被搬到另一个CPU线程；一个同步循环仍会占着当前执行线程，让它暂时不能处理其他JavaScript回调。要隔离这类CPU工作，可以使用Worker线程，也可以启动独立Node进程，再通过消息交付任务与结果。"
        },
        {
          "type": "paragraph",
          "text": "Worker线程拥有自己的JavaScript执行环境和事件循环，但和主线程处于同一个操作系统进程。fork则创建另一个Node进程，有独立地址空间与进程生命周期。两者都需要付出启动、通信、数据转换和调度成本，因此不适合每处理一个很小数字就临时创建一只Worker。池复用执行者，是为了控制这些成本和同时运行数量。"
        },
        {
          "type": "paragraph",
          "text": "本文统一实现一个计算池，mode切换thread或process。任务只做有限范围内的质数计数，不访问数据库和公网；10以内质数为4个，100以内25个，1000以内168个。这样能把CPU结果、任务身份与资源生命周期分开观察。异常、退出和取消会真实发生，但不会让一个教学副作用冒充可回滚事务。"
        },
        {
          "type": "figure",
          "src": "figures/node-parallel-computing/isolation.svg",
          "title": "执行上下文不同，通信与失败边界也不同",
          "alt": "thread同PID、不同threadId；process不同PID、主threadId0。示意的是隔离关系，不代表两个任务在某台机器上必然获得两倍CPU。",
          "caption": "thread同PID、不同threadId；process不同PID、主threadId0。示意的是隔离关系，不代表两个任务在某台机器上必然获得两倍CPU。"
        }
      ]
    },
    {
      "id": "execution-owners",
      "title": "四种执行者：名字都有“线程”，它们的所有者却不同",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "主线程是应用入口所在的线程，普通请求回调在自己的 JavaScript 执行环境里运行。libuv 工作池是运行时安排特定原生任务的设施，例如本机文件读取与 PBKDF2；你不能向它提交任意 JavaScript 闭包。Worker 是应用显式创建的 JavaScript 线程，拥有独立 V8 isolate、JavaScript 堆和事件循环。OS 进程则有自己的地址空间、运行时、文件句柄和退出状态。理解这四者，才能决定是减少等待、并行计算，还是增加隔离边界。"
        },
        {
          "type": "paragraph",
          "text": "Worker 与主线程处在同一个进程，process.pid 相同，threadId 不同；普通 JavaScript 对象不能直接跨 isolate 共享，消息一般结构化克隆。ArrayBuffer 可以转移所有权，SharedArrayBuffer 才建立显式共享内存并需要同步。进程的 PID 不同，IPC 或管道传数据，普通消息不会把两个进程的对象变成同一份地址。后文的转移实验会实际检查发送端 byteLength，而不是只背“线程快、进程安全”。"
        },
        {
          "type": "figure",
          "src": "figures/node-parallel-computing/owners.svg",
          "title": "运行时工作池、Worker 与独立进程的边界",
          "alt": "同一 Node 进程内主 isolate 和 Worker isolate 各有 JS 堆与循环，libuv 工作池执行原生工作并在该进程共享；进程 B 是独立地址空间，经过 IPC 通信。",
          "caption": "职责图，未按线程数或内存比例绘制；共享内存必须显式设计，Worker 不是权限沙箱。"
        },
        {
          "type": "paragraph",
          "text": "libuv 的工作池在一个进程的事件循环之间共享。创建更多 Worker，不会为每个 Worker 额外复制一套可无限扩展的文件 I/O 工作池。因此 Worker 擅长把 CPU 密集的 JavaScript 从请求线程移开，但若瓶颈是所有线程共同争用的池任务，仅加 Worker 可能没有解决排队。独立进程拥有另一套运行时资源，代价是启动、内存、序列化与管理开销。"
        },
        {
          "type": "paragraph",
          "text": "故障边界也要逐个说：任务里正常 throw 可以由 Worker 模块捕获并回传业务失败；未捕获 JavaScript 异常通常终止该 Worker 并发出 error/exit；进程退出则让父进程收到对应退出事件。原生扩展崩溃、进程级 OOM 等不保证被 Worker 边界隔离。独立进程给地址空间和终止提供更强边界，但没有容器/权限配置时仍能以当前用户访问系统资源。下面的池只运行下载内可信模块，不提供任意代码执行。"
        }
      ]
    },
    {
      "id": "choice",
      "title": "先选择隔离层次，再决定池的大小",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "维度",
            "Worker线程",
            "fork进程"
          ],
          "rows": [
            [
              "JavaScript环境",
              "独立执行环境，同一个进程",
              "独立Node进程"
            ],
            [
              "普通对象",
              "通过消息复制，不自动共享引用",
              "通过IPC序列化传递，不共享普通JS堆"
            ],
            [
              "可转移/共享数据",
              "可transfer ArrayBuffer；可显式使用SharedArrayBuffer",
              "本例advanced IPC复制ArrayBuffer，不提供同样transferList"
            ],
            [
              "故障范围",
              "JS线程退出可被主线程观察；仍共享进程级资源与权限",
              "子进程有独立生命周期，但不自动获得权限沙箱"
            ],
            [
              "成本与预算",
              "每Worker仍需堆、栈和运行环境",
              "每进程还增加独立运行时与OS开销"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "不要把Worker理解为libuv线程池里那几条后台线程。worker_threads承载的是显式启动的JavaScript工作；文件系统等API的某些底层工作可能走另一个线程池，它们与这里的池不是同一套配额。把池开得很大，也不代表事件循环或网络调用一定更快。"
        },
        {
          "type": "paragraph",
          "text": "池的目标先是有界，再是快。size限制最多有几个执行者，queue限制已经接受但尚未开始的任务数。输入很小也要限制排队，因为每个任务还有Promise、回调和超时状态；如果任务带大对象，内存压力更明显。本例size限制1～4、队列0～32，具体生产值应根据CPU配额、响应目标、单任务内存和其他服务负载测量。"
        },
        {
          "type": "paragraph",
          "text": "线程数与可用CPU并不相同。操作系统调度、容器CPU配额和同机竞争都影响实际并行度；即使机器显示很多逻辑核，也不意味着把每个请求都放进一个新进程是合适方案。本篇不比较具体吞吐提升，而是先交付同一契约在两种隔离方式下都能解释的实现。"
        },
        {
          "type": "paragraph",
          "text": "是否需要线程池，还取决于工作能否被明确拆成独立任务。大量共享可变状态会把成本移到同步与通信上，不能只因任务名称听起来“CPU密集”就自动并行。当前质数计数只读一个上限、返回一个整数，没有共享写与输出合并冲突，适合先把调度生命周期学清楚。"
        },
        {
          "type": "paragraph",
          "text": "进程池也不是cluster的同义词。cluster常用于多个Node进程分担服务连接，而本文由主进程主动分派有限计算任务，消息队列与结果匹配都由自己的池维护。两个方案可以服务不同架构，也可能组合使用，但各自的准入、进程数量与CPU预算不能互相假定。"
        }
      ]
    },
    {
      "id": "process-api-boundaries",
      "title": "spawn、exec、fork：传参、输出和 IPC 都是设计选择",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "spawn(file, args, {shell:false}) 直接启动目标程序，args 是独立参数，stdout/stderr 是流，适合持续输出和需要背压处理的工具；仍须验证可执行文件、参数中的路径与工具自己的选项，shell:false 只消除了 shell 对分号等字符的解释。exec(command) 默认经过 shell，并把输出缓冲到回调，所以拼接用户输入会多一个命令解释边界，输出过多还会触发 maxBuffer。execFile(file,args) 默认不经 shell，但也使用缓冲回调。"
        },
        {
          "type": "paragraph",
          "text": "fork(module) 在 child_process 里表示启动另一个 Node 程序并建立 IPC 通道，不是复制当前 JavaScript 堆，也不是 Worker 的别名。下面固定子模块收到 count:7 后返回 count:8 和自己的 PID，随后断开 IPC。进程池采用 fork 是因为现有纯 CPU 模块就是 Node 程序，不需要用 shell 包一层 node 命令。"
        },
        {
          "type": "paragraph",
          "text": "IPC 等待也需要失败边界：子进程先退出、发出 error 或一直不回消息，都必须结算等待并移除监听。下面 firstMessage 在三条路径都清理自己的计时器/监听，childExit 等到真实退出才回收容量；silence/exit 模式只用于固定故障验收，不能提供公网执行入口。"
        },
        {
          "type": "code",
          "filename": "examples/node-parallel-computing/child-events.mjs",
          "language": "js",
          "code": "// Await one IPC message, with explicit exit/error/deadline ownership.\nexport function firstMessage(child,{timeoutMs=3000}={}){\n return new Promise((resolve,reject)=>{\n  const cleanup=()=>{clearTimeout(timer);child.off('message',message);child.off('error',error);child.off('exit',exit);};\n  const settle=(fn,value)=>{cleanup();fn(value);};\n  const message=value=>settle(resolve,value),error=value=>settle(reject,value);\n  const exit=(code,signal)=>settle(reject,new Error(`CHILD_EXIT_BEFORE_MESSAGE:${code}:${signal}`));\n  const timer=setTimeout(()=>settle(reject,new Error('CHILD_MESSAGE_TIMEOUT')),timeoutMs);\n  child.once('message',message);child.once('error',error);child.once('exit',exit);\n  if(child.exitCode!==null||child.signalCode!==null)exit(child.exitCode,child.signalCode);\n });\n}\nexport function childExit(child,{timeoutMs=3000,signal='SIGTERM'}={}){\n if(!child.pid||child.exitCode!==null||child.signalCode!==null)return Promise.resolve();\n return new Promise(resolve=>{\n  const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);\n  child.once('exit',()=>{clearTimeout(timer);resolve();});\n  if(signal)child.kill(signal);\n });\n}",
          "purpose": "完整 IPC 消息等待与退出清理；deadline 不依赖下一条业务消息，避免杀死子进程以后 await 仍永远悬空。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-parallel-computing/process-modes.mjs",
          "code": "import { spawn, exec, execFile, fork } from 'node:child_process';\nimport { promisify } from 'node:util';\nimport { pathToFileURL } from 'node:url';\nimport { once } from 'node:events';\nimport {firstMessage,childExit} from './child-events.mjs';\nconst execute=promisify(exec), executeFile=promisify(execFile);\nexport async function processModes({peerMode='ok'}={}) {\n  if(!['ok','exit','silence'].includes(peerMode))throw new RangeError('INVALID_PEER_MODE');\n  // The text is fixed teaching data. Never interpolate external input into a shell command.\n  const input='hello; printf SHELL_MARK';\n  const child=spawn(process.execPath,['-e','process.stdout.write(process.argv[1])',input],{shell:false,stdio:['ignore','pipe','pipe']});\n  let literal='';child.stdout.setEncoding('utf8');child.stdout.on('data',part=>literal+=part);\n  const [code]=await once(child,'close');if(code!==0)throw new Error('SPAWN_FAILED');\n  const {stdout:fileOutput}=await executeFile(process.execPath,['-e','process.stdout.write(process.argv[1])',input],{timeout:2000});\n  let shellOutput=null;\n  if(process.platform!=='win32') shellOutput=(await execute('printf hello; printf SHELL_MARK',{timeout:2000})).stdout;\n  let bufferError=null;\n  try { await executeFile(process.execPath,['-e','process.stdout.write(\"x\".repeat(4096))'],{maxBuffer:64,timeout:2000}); }\n  catch(error){bufferError=error.code;}\n  const peer=fork(new URL('./process-modes.mjs',import.meta.url),['--peer',peerMode],{stdio:['ignore','ignore','pipe','ipc']});\n  try {const message=firstMessage(peer,{timeoutMs:peerMode==='silence'?300:3000});peer.send({count:7});const reply=await message;await childExit(peer,{signal:null});return {input,literal,fileOutput,shellOutput,bufferError,reply,parentPid:process.pid};}\n  finally {await childExit(peer);}\n}\nif(process.argv.includes('--peer')) process.once('message',message=>{\n const mode=process.argv.at(-1);if(mode==='exit'){process.exitCode=7;process.disconnect();return;}if(mode==='silence'){setInterval(()=>{},1000);return;}\n process.send({count:message.count+1,pid:process.pid},()=>process.disconnect());\n});\nelse if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) console.log(JSON.stringify(await processModes()));",
          "purpose": "完整受控对照，字符串全为固定教学数据；从不接收外部命令。shell 示例只在 POSIX 执行，子进程有期限与退出收尾。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "text",
          "filename": "本机输出中用于判断的字段",
          "code": "input/literal/fileOutput = \"hello; printf SHELL_MARK\"\nshellOutput = \"helloSHELL_MARK\"\nbufferError = \"ERR_CHILD_PROCESS_STDIO_MAXBUFFER\"\nreply.count = 8；reply.pid 与 parentPid 不同",
          "purpose": "实际 PID 随运行变化；不是建议把外部输入交给 exec。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "同一个带分号的固定输入，在 spawn/execFile 中原样成为参数；exec 的固定命令则把分号解释为下一条 printf。这个差异就是 shell 注入风险的机制。正确修复通常是固定可执行文件和参数数组、验证目标操作，不能只给字符串外面随手套引号。工具本身接受 --output、@file 或路径等语义时，还须约束参数含义；避免 shell 并不会消除工具级参数注入。"
        },
        {
          "type": "paragraph",
          "text": "输出 4096 字节、maxBuffer 64 的 execFile 真实失败，说明缓冲 API 的容量必须显式设计。spawn 的流也不是无限存储：父进程要消费数据、限制总量，并在写往其他流时处理背压。超时或 kill 表示发出信号，不等于子进程已消失；现有 endpoint.stop 等到 exit，SIGTERM 后还有自己的 SIGKILL 收尾。取消了进程也不会撤销它已提交的数据库事务。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0 child_process",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/child_process.html",
          "note": "API、默认 shell、maxBuffer、IPC 语义的固定版本依据；当前正文已有实际对照代码。"
        }
      ]
    },
    {
      "id": "cluster-distribution",
      "title": "cluster 管服务连接分发，计算池管具体任务准入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "cluster 让多个 Node worker 进程运行同一服务入口，主进程协调 worker 与监听句柄；常见轮询调度由主进程接受连接后分发，其他策略/平台有差别。它适合把多个服务进程组织在一个端口后面，不会自动把某一个请求内部的 CPU 循环拆到各 worker，也不会替你实现持久任务队列、幂等或数据库一致性。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "examples/node-parallel-computing/cluster-demo.mjs",
          "code": "import cluster from 'node:cluster';\nimport { createServer, get } from 'node:http';\nimport {firstMessage,childExit} from './child-events.mjs';\nif(cluster.isPrimary){\n  cluster.schedulingPolicy=cluster.SCHED_RR;\n  const workers=[];\n  try {\n    for(let i=0;i<2;i++)workers.push(cluster.fork({ATLAS_CLUSTER_FAIL:process.argv.includes('--startup-fail')?'1':'0'}));\n    const ready=await Promise.all(workers.map(worker=>firstMessage(worker.process).then(message=>message)));\n    const replies=[];\n    for(let i=0;i<8;i++)replies.push(await new Promise((resolve,reject)=>{\n      const request=get({host:'127.0.0.1',port:ready[0].port,agent:false},response=>{let data='';response.on('data',part=>data+=part);response.once('end',()=>resolve(JSON.parse(data)));});\n      request.setTimeout(1000,()=>request.destroy(new Error('TIMEOUT')));request.once('error',reject);\n    }));\n    console.log(JSON.stringify({workerPids:ready.map(row=>row.pid),ports:ready.map(row=>row.port),servedBy:[...new Set(replies.map(row=>row.pid))],requests:replies.length}));\n  } catch(error){console.error(error.message);process.exitCode=1;}\n  finally {for(const worker of workers)if(worker.isConnected())worker.send('close');await Promise.all(workers.map(worker=>childExit(worker.process,{signal:null})));}\n}else{\n  if(process.env.ATLAS_CLUSTER_FAIL==='1'){process.exit(7);}\n  const server=createServer((_req,res)=>res.end(JSON.stringify({pid:process.pid})));\n  server.listen(0,'127.0.0.1',()=>process.send({pid:process.pid,port:server.address().port}));\n  process.once('message',()=>server.close(()=>process.disconnect()));\n}",
          "purpose": "完整两 worker 本机演示；显式 SCHED_RR，8 次独立连接、随机同一端口，自己的 worker 与服务退出后回收。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "text",
          "filename": "本次实际 cluster 输出",
          "code": "workerPids: [54217,54218]\nports: [54790,54790]\nservedBy: [54218,54217]\nrequests: 8",
          "purpose": "示例 PID/端口仅是一次记录，测试断言共享端口、独立 worker 身份和响应来自已知 worker，不断言公平分配比率。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "运行结果验证的是两个进程提供同一个监听端口，以及本轮请求由这些 worker 服务。8 次请求不能给出负载均衡公平性结论，keep-alive 复用还会改变按连接分发的表现。每个 worker 的内存缓存和会话都独立；登录态不能靠“都在同一台机器”就认为共享。若需要统一状态，必须选择外部存储或明确通信协议。"
        },
        {
          "type": "paragraph",
          "text": "回到本文质数任务：我们需要知道一个任务排队还是运行、何时取消、何时替换崩溃执行者，所以使用下文有界计算池，而不是把 cluster 当通用解法。HTTP 服务也可以同时使用多进程与每进程有限 Worker，但总数要按整体 CPU/内存配额规划，不能把“进程数 × 线程数”无边界放大。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0 cluster",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/cluster.html",
          "note": "主/worker 进程、连接分发和调度策略；本例 POSIX macOS 实测，不声明 Windows 同行为。"
        }
      ]
    },
    {
      "id": "job",
      "title": "任务契约：只传数据，不把闭包和业务状态偷偷带过去",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export function validateJob(job){\n if(!job||typeof job!=='object'||!['count','throw','crash'].includes(job.kind))throw new RangeError('BAD_JOB');\n if(job.kind==='count'&&(!Number.isInteger(job.limit)||job.limit<2||job.limit>5000000))throw new RangeError('BAD_LIMIT');\n return {kind:job.kind,...(job.kind==='count'?{limit:job.limit}:{})};\n}\nexport function countPrimes(limit){\n let count=0;for(let n=2;n<=limit;n++){let prime=true;for(let d=2;d*d<=n;d++)if(n%d===0){prime=false;break;}if(prime)count++;}return count;\n}",
          "language": "js",
          "filename": "examples/node-parallel-computing/compute.mjs",
          "purpose": "完整任务输入约束与纯CPU函数。count限制在2～5,000,000；throw/crash是受控故障操作，仅用于本机教学。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {isMainThread,parentPort,threadId} from 'node:worker_threads';\nimport {validateJob,countPrimes} from './compute.mjs';\nconst send=value=>isMainThread?process.send?.(value):parentPort.postMessage(value);\nconst receive=handler=>isMainThread?process.on('message',handler):parentPort.on('message',handler);\nreceive(message=>{\n if(message?.type==='buffer'){\n  const data=new Uint8Array(message.data);send({type:'buffer',bytes:data.byteLength,first:data[0],pid:process.pid,threadId});return;\n }\n if(message?.type!=='run'||typeof message.id!=='string')return;\n const {id}=message;send({type:'started',id});\n try{\n  const job=validateJob(message.job);\n  if(job.kind==='crash')process.exit(23);\n  if(job.kind==='throw')throw new Error('intentional demonstration');\n  send({type:'result',id,ok:true,result:{count:countPrimes(job.limit),pid:process.pid,threadId}});\n }catch{send({type:'result',id,ok:false,error:'COMPUTE_FAILED'});}\n});",
          "language": "js",
          "filename": "examples/node-parallel-computing/worker.mjs",
          "purpose": "完整工作者：同一模块在Worker或fork中选择各自通信端；started与result带相同任务ID。普通计算错误返回受控结果，crash主动退出23。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "任务ID标识池里这一份执行请求，不能依靠数组下标或“最新一次Promise”匹配结果。结果在协议中再次带ID，主线程只接受当前slot对应任务的消息；错ID或非法结果视为协议错误，停止该执行者。即使今天只有一个任务，也要把关联关系写进契约，才能避免以后加并发时把旧结果交给新调用方。"
        },
        {
          "type": "paragraph",
          "text": "普通函数、捕获了主线程状态的闭包或带原型方法的业务实例，并不会像同堆引用那样跨消息边界工作。更稳妥的做法是传可解释的数据，Worker导入自己固定的可信模块。结构化克隆对类、访问器和某些特殊对象有自己的规则；不要把“能postMessage”理解成任意对象都保持原有身份与行为。"
        },
        {
          "type": "paragraph",
          "text": "本例Worker只运行仓库内固定模块，输入是kind和有限数字；它没有eval用户代码。线程和子进程也都继承当前用户能使用的资源，操作系统进程隔离不等于权限沙箱。若要执行不可信代码，需要独立的操作系统与资源隔离策略，不能把这份池直接公开成任意脚本执行服务。"
        },
        {
          "type": "paragraph",
          "text": "worker模块是在执行者里重新加载的，它不会继承主线程模块里某个普通变量的最新值。需要初始化字典或算法参数时，应在创建或首次任务阶段发送明确数据，并确定更新版本；把配置藏在闭包里，会使主线程已经修改而Worker继续用旧值的情况很难排查。"
        }
      ]
    },
    {
      "id": "transport",
      "title": "把通信差异集中在适配层，池只关心消息和退出",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {Worker} from 'node:worker_threads';\nimport {fork} from 'node:child_process';\nconst file=new URL('./worker.mjs',import.meta.url);\nexport function endpoint(mode){\n const target=mode==='thread'?new Worker(file,{resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8,stackSizeMb:4}}):fork(file,[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc']});\n let exited=false,stopping;const done=new Promise(resolve=>target.once('exit',()=>{exited=true;resolve();}));\n return {onMessage:fn=>target.on('message',fn),onError:fn=>target.on('error',fn),onExit:fn=>target.once('exit',fn),\n  send(value,transfers=[]){if(mode==='thread')target.postMessage(value,transfers);else target.send(value);},\n  stop(){\n   if(stopping)return stopping;\n   stopping=(async()=>{if(exited)return;if(mode==='thread'){await target.terminate();return;}\n    target.kill('SIGTERM');const timer=setTimeout(()=>{if(!exited)target.kill('SIGKILL');},1000);\n    try{await done;}finally{clearTimeout(timer);}\n   })();return stopping;\n  },get pid(){return mode==='process'?target.pid:process.pid;},\n };\n}",
          "language": "js",
          "filename": "examples/node-parallel-computing/endpoint.mjs",
          "purpose": "完整thread/process适配器。进程用advanced序列化，停止时先SIGTERM，有限等待后SIGKILL；Worker用terminate并等待退出。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "池只需要send、message、error、exit和stop，不应该在每个排队分支里都写一遍Worker与ChildProcess的差异。适配器保证stop可重复调用，关闭路径等待真正退出；否则你可能已经把slot算作空闲，旧计算却仍在占CPU。进程停止还需要兜底超时，避免只发一个信号就永远等待。"
        },
        {
          "type": "paragraph",
          "text": "Worker的resourceLimits在这里约束部分V8堆与栈，不是整个进程RSS的硬上限，也不能限制所有外部分配。多个Worker仍共享进程的一部分资源；native扩展、ArrayBuffer和其他句柄需要另外预算。本例给出的数字只为防止教学实现毫无限制地增长，不是通用安全配置。"
        },
        {
          "type": "paragraph",
          "text": "进程IPC的send可能有背压，实际系统应观察发送结果与发送回调，不能无限往一个通道塞消息。当前池每个slot同时只发送一个小任务，结果也只有少量整数，输入队列有上限，因此没有构造任意大IPC洪泛。要扩展成大批数据流水线时，应把通道在途字节数也纳入预算。"
        }
      ]
    },
    {
      "id": "pool",
      "title": "完整有界池：准入、执行、结算与替换是一套状态机",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {randomUUID} from 'node:crypto';\nimport {endpoint} from './endpoint.mjs';\nimport {validateJob} from './compute.mjs';\nexport class PoolError extends Error{constructor(code){super(code);this.code=code;}}\nexport class ComputePool{\n #slots=new Set();#queue=[];#closed=false;#closing;#restarts=0;#startedWaiters=new Map();\n constructor({mode='thread',size=2,queue=4,maxRestarts=8}={}){\n  if(!['thread','process'].includes(mode)||!Number.isInteger(size)||size<1||size>4||!Number.isInteger(queue)||queue<0||queue>32||!Number.isInteger(maxRestarts)||maxRestarts<0||maxRestarts>32)throw new RangeError('BAD_POOL_OPTIONS');\n  this.mode=mode;this.size=size;this.queueCapacity=queue;this.maxRestarts=maxRestarts;\n  for(let i=0;i<size;i++)this.#spawn();\n }\n #spawn(){\n  if(this.#closed)return;const transport=endpoint(this.mode),slot={transport,task:null,stopping:false};this.#slots.add(slot);\n  transport.onMessage(message=>this.#message(slot,message));\n  transport.onError(()=>this.#stopSlot(slot,new PoolError('WORKER_ERROR')));\n  transport.onExit(()=>{\n   this.#slots.delete(slot);if(slot.task)this.#finish(slot.task,new PoolError('WORKER_EXIT'));\n   if(!this.#closed){if(this.#restarts++<this.maxRestarts){this.#spawn();this.#pump();}else void this.close(new PoolError('RESTART_LIMIT'));}\n  });this.#pump();\n }\n #finish(task,error,result){\n  if(task.settled)return;task.settled=true;clearTimeout(task.timer);task.signal?.removeEventListener('abort',task.abort);\n  const waiter=this.#startedWaiters.get(task.id);if(waiter){waiter.reject(error??new PoolError('NO_START_OBSERVED'));this.#startedWaiters.delete(task.id);}\n  error?task.reject(error):task.resolve(result);\n }\n #stopSlot(slot,error){\n  if(slot.stopping)return;slot.stopping=true;if(slot.task)this.#finish(slot.task,error);void slot.transport.stop();\n }\n #cancel(task,error){\n  if(task.settled)return;const at=this.#queue.indexOf(task);\n  if(at>=0){this.#queue.splice(at,1);this.#finish(task,error);return;}\n  const slot=[...this.#slots].find(slot=>slot.task===task);if(slot)this.#stopSlot(slot,error);\n }\n #pump(){\n  if(this.#closed)return;\n  for(const slot of this.#slots){\n   if(slot.stopping||slot.task)continue;\n   while(this.#queue.length){const task=this.#queue.shift();if(task.settled)continue;\n    if(performance.now()>=task.deadline){this.#finish(task,new PoolError('TIMEOUT'));continue;}\n    slot.task=task;try{slot.transport.send({type:'run',id:task.id,job:task.job});}catch{this.#stopSlot(slot,new PoolError('SEND_FAILED'));}break;\n   }\n  }\n }\n #message(slot,message){\n  const task=slot.task;if(slot.stopping||!task||task.settled)return;\n  if(message?.id!==task.id||!['started','result'].includes(message.type)){this.#stopSlot(slot,new PoolError('PROTOCOL'));return;}\n  if(message.type==='started'){\n   task.started=true;const waiter=this.#startedWaiters.get(task.id);if(waiter){waiter.resolve();this.#startedWaiters.delete(task.id);}return;\n  }\n  if(performance.now()>=task.deadline){this.#stopSlot(slot,new PoolError('TIMEOUT'));return;}\n  if(typeof message.ok!=='boolean'||message.ok&&(!Number.isInteger(message.result?.count)||message.result.count<0||message.result.count>task.job.limit||!Number.isInteger(message.result?.pid)||message.result.pid<1||!Number.isInteger(message.result?.threadId)||message.result.threadId<0)){this.#stopSlot(slot,new PoolError('PROTOCOL'));return;}\n  slot.task=null;this.#finish(task,message.ok?null:new PoolError('COMPUTE_FAILED'),message.result);this.#pump();\n }\n submit(input,{timeoutMs=5000,signal}={}){\n  const job=validateJob(input);if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new RangeError('BAD_TIMEOUT');\n  signal?.throwIfAborted();if(this.#closed)throw new PoolError('POOL_CLOSED');\n  const available=[...this.#slots].filter(s=>!s.task&&!s.stopping).length;\n  if(this.#queue.length>=this.queueCapacity+available)throw new PoolError('QUEUE_FULL');\n  let resolve,reject;const result=new Promise((yes,no)=>{resolve=yes;reject=no;});\n  const task={id:randomUUID(),job,resolve,reject,signal,settled:false,started:false,deadline:performance.now()+timeoutMs,timer:null,abort:null};\n  task.abort=()=>this.#cancel(task,signal.reason);signal?.addEventListener('abort',task.abort,{once:true});\n  task.timer=setTimeout(()=>this.#cancel(task,new PoolError('TIMEOUT')),timeoutMs);this.#queue.push(task);this.#pump();\n  return {id:task.id,result,started:()=>task.started?Promise.resolve():task.settled?Promise.reject(new PoolError('ALREADY_SETTLED')):new Promise((resolve,reject)=>{const old=this.#startedWaiters.get(task.id);if(old){reject(new PoolError('START_WAITER_EXISTS'));return;}this.#startedWaiters.set(task.id,{resolve,reject});})};\n }\n snapshot(){return {closed:this.#closed,workers:this.#slots.size,running:[...this.#slots].filter(s=>s.task).length,queued:this.#queue.length,restarts:this.#restarts};}\n close(reason=new PoolError('POOL_CLOSED')){\n  if(this.#closing)return this.#closing;this.#closed=true;\n  for(const task of this.#queue.splice(0))this.#finish(task,reason);\n  for(const slot of this.#slots){slot.stopping=true;if(slot.task)this.#finish(slot.task,reason);}\n  this.#closing=Promise.all([...this.#slots].map(slot=>slot.transport.stop())).then(()=>{});return this.#closing;\n }\n}",
          "language": "js",
          "filename": "examples/node-parallel-computing/pool.mjs",
          "purpose": "完整池实现，没有把关键排队/取消/崩溃分支留给读者补。submit的参数与准入失败同步抛出；已接受任务的result按执行结果结算。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "submit先验证输入、期限、父取消与池状态，再检查可用slot和排队容量。立即可运行的任务计入available，不占用等待队列配额；没有空位时，最多只保留queueCapacity项。测试在同一段主线程调用里连续提交三项给size1/queue1，前两项已接受、第三项QUEUE_FULL，不需要靠sleep猜队列是否填满。"
        },
        {
          "type": "paragraph",
          "text": "pump只给没有任务且不在停止中的slot派发。每项任务有一次性settled标记、deadline、timer和父signal监听。finish统一清理timer与监听，再resolve或reject；错误、超时、退出、关闭可能竞争同一任务，但不能让它重复结算。这里的id与settled解决结果归属，slot.stopping解决资源归属，它们不是同一个状态。"
        },
        {
          "type": "paragraph",
          "text": "普通计算错误只拒绝当前任务，Worker仍可复用；进程或线程退出则释放slot并按有限预算创建替代者。崩溃的任务不会自动重放，排队任务可以交给恢复后的执行者。把失败悄悄重新执行可能对纯计算安全，但未来若接入外部写入就会重复副作用，所以重放策略不能隐藏在通用池的退出回调里。"
        },
        {
          "type": "figure",
          "src": "figures/node-parallel-computing/lifecycle.svg",
          "title": "容量什么时候能重新使用，必须跟退出事件对齐",
          "alt": "排队取消只移除队列；运行取消先结算调用方、停止整个执行者，等exit后再替换。不会在发出terminate后立即把同一个slot重新派给下一项。",
          "caption": "排队取消只移除队列；运行取消先结算调用方、停止整个执行者，等exit后再替换。不会在发出terminate后立即把同一个slot重新派给下一项。"
        },
        {
          "type": "paragraph",
          "text": "消息复制本身也消耗时间，尤其大对象可能在主线程产生序列化或分配工作。即使最终CPU函数跑在Worker里，提交之前复制几十兆数据仍可能拖慢入口。本文任务字段始终很小，并单独用8字节ArrayBuffer解释所有权；没有据此声称大型对象提交完全不阻塞，也没有把transfer的效果自动推广到所有嵌套对象。"
        },
        {
          "type": "paragraph",
          "text": "这里每个任务都建立自己的timer和取消监听，finish会解除它们。只删除queue里的条目却忘了监听，父signal可能长期持有回调与任务对象；只清timer却忘了结算Promise，调用者又会永远等待。资源清理不只是线程退出，还包括围绕任务创建的这组主线程引用。"
        }
      ]
    },
    {
      "id": "cancellation",
      "title": "取消、超时与关闭：停止等待和停止执行要分别完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "排队中的任务尚未发给Worker，取消时从队列移除即可。运行中的CPU循环不会因为主线程AbortController改变而自动检查信号；本例选择终止整个执行者，再补一只。这会丢掉它所有局部状态，所以任务应当独立、输入可重建。不是给同步循环加一个Promise.race就能让它停止占CPU。"
        },
        {
          "type": "paragraph",
          "text": "deadline覆盖等待队列与执行，总上限1～10000ms。timer只是合作式通知，主线程若被其他同步代码堵住，会延后处理；因此收到结果时还会再次检查performance.now是否超过deadline，避免把迟到成功误认为预算内完成。这个判断限制调用方接受结果，不承诺操作系统硬实时终止。"
        },
        {
          "type": "paragraph",
          "text": "close先关闭准入、拒绝排队与当前任务，再等待所有执行者退出。它是明确的中止关闭，不是“把已接受任务全部做完”的排空关闭；需要drain时应设计另一个协议，包含停止接单、等待完成与最终强制期限。调用两次close返回同一收尾过程，不能让第二次关闭又生成一批替代者。"
        },
        {
          "type": "paragraph",
          "text": "有限重启也很重要。若模块启动时一直失败，无限新建Worker会把一次错误变成资源风暴。本例设置maxRestarts，超过后关闭池并拒绝等待任务；正常取消产生的替换同样消耗这份预算，行为保守且可解释。生产可以按时间窗区分故障与主动回收，但必须保留明确上限。"
        },
        {
          "type": "paragraph",
          "text": "完成与取消有竞争，定义必须明确。若正确结果已被接收并结算，之后的abort不会改变已完成Promise；若先观察到取消，迟到结果不能重新使任务成功。settled是单次结算防线，stopping又阻止这个执行者继续接新工作。这解释了为什么不能只在catch里改一个“取消中”布尔值，而要把结果、队列和执行者状态一起协调。"
        },
        {
          "type": "paragraph",
          "text": "终止计算不等于撤销外部效果。此例只有纯CPU输入输出，所以丢弃局部结果就能结束；若以后在Worker里发邮件或写数据库，进程被杀时请求可能已经提交，应该保留业务结果未知状态与恢复协议。不要因为计算池能拒绝Promise，就宣称外部任务也被事务性回滚。"
        }
      ]
    },
    {
      "id": "ownership",
      "title": "数据转移不是共享引用：真实查看发送端缓冲是否还可用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {endpoint} from './endpoint.mjs';\nexport async function inspectChannel(mode){\n const transport=endpoint(mode),buffer=new ArrayBuffer(8);new Uint8Array(buffer)[0]=42;\n try{\n  const reply=new Promise((resolve,reject)=>{transport.onError(reject);transport.onMessage(resolve);});\n  transport.send({type:'buffer',data:buffer},mode==='thread'?[buffer]:[]);\n  const senderBytes=buffer.byteLength;return {senderBytes,received:await reply};\n }finally{await transport.stop();}\n}",
          "language": "js",
          "filename": "examples/node-parallel-computing/communication.mjs",
          "purpose": "完整通信实验：在线程模式把独立ArrayBuffer放入transferList；进程模式通过advanced IPC复制。finally等待执行者退出。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "线程transferList把ArrayBuffer的所有权移交出去，发送端原buffer随后detached，byteLength变成0；接收端仍读到8字节和首值42。进程实验没有同样的transferList语义，advanced IPC序列化后原buffer仍为8字节。测试实际检查发送端和接收端两边，不把“没有报错”当作零拷贝证明。"
        },
        {
          "type": "paragraph",
          "text": "SharedArrayBuffer则允许线程共享同一段内存，含义和transfer不同：双方都可能读写，因此还要定义同步、可见性与竞态，通常需要Atomics。本文不引入共享写，以免把队列正确性和共享内存协议叠到一起；也不把一个可转移缓冲的结果推广为所有Buffer都能安全直接转移。池里分配的Buffer或其他视图可能有共享底层存储，使用前要确认所有权。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行与证据：看身份、状态与回收，不看一次耗时猜加速",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {ComputePool} from './pool.mjs';\nimport {inspectChannel} from './communication.mjs';\nfor(const mode of ['thread','process']){\n const pool=new ComputePool({mode,size:2,queue:2});\n try{const jobs=[10,100,1000].map(limit=>pool.submit({kind:'count',limit}).result);console.log(JSON.stringify({mode,results:await Promise.all(jobs),snapshot:pool.snapshot(),channel:await inspectChannel(mode)}));}\n finally{await pool.close();}\n}",
          "language": "js",
          "filename": "examples/node-parallel-computing/demo.mjs",
          "purpose": "完整演示：两种模式各复用2个执行者完成3项任务，最后关闭池；通信演示也有独立清理。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "cd examples/node-parallel-computing\nnpm ci\nnpm test\nnode demo.mjs",
          "language": "bash",
          "filename": "终端",
          "purpose": "无需第三方依赖、数据库或密钥；Node22.12.0。输出PID和threadId来自当前运行，不要求与文中数字一致。",
          "kind": "runnable"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "对10/100/1000得到4/25/168；thread结果PID与主进程相同且threadId不同，process结果PID不同且threadId0。",
            "size1/queue1同时接受两项、拒绝第三项；队列取消没有再发出该任务。",
            "throw拒绝当前项但不重启；crash退出后补一只，下一项成功；已started CPU任务取消后等待旧执行者退出再恢复。",
            "期限、close与重启预算均有失败断言；结束后无剩余Worker或子进程挂住测试。"
          ]
        },
        {
          "type": "paragraph",
          "text": "macOS14.5/Node22.12.0已通过17项真实线程/进程测试并实际运行demo。没有把线程池写成内存模拟器，也没有以短样本耗时宣称某种模式更快。CLI、容量和生命周期已验证；Linux、容器CPU配额、native扩展与生产吞吐未验证。此队列只在本进程内，主进程退出就丢失，不能替代前面可靠异步系统中的持久任务与回执协议。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Node22.12 Worker threads",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/worker_threads.html"
    },
    {
      "title": "Node22.12 Child process",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/child_process.html"
    }
  ]
};
export default article;
