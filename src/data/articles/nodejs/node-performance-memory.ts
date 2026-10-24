import type {Article} from '../../articleTypes';
const article:Article={
  "id": "node-performance-memory",
  "topic": "nodejs",
  "title": "Node.js 性能与内存：延迟、堆快照、GC 和压测",
  "description": "先定义负载模型与指标窗口，再用独立服务器进程采集真实HTTP延迟、ELU、循环延迟与GC；生成三份实际堆快照，验证全局引用保留128对象及清理后的变化。",
  "minutes": 60,
  "labMinutes": 40,
  "scope": "Node22.12本机有界教学负载、perf_hooks指标、V8堆快照与引用边解析；不是生产容量报告。闭环最多100请求、并发最多8、服务最多4项在途；快照只处理本例合成对象，不分析用户真实进程。",
  "tags": [
    "Node.js",
    "性能测量",
    "延迟",
    "GC",
    "堆快照",
    "事件循环"
  ],
  "prerequisites": [
    "会读JavaScript Promise、事件监听和ESM模块",
    "理解Node主线程事件循环与进程的基本含义"
  ],
  "kind": "series",
  "status": 'complete',
  "verifiedAt": "2026-10-24",
  "versions": [
    "Node.js22.12.0；ESM；无第三方npm依赖",
    "macOS14.5 x64实测；其他OS与生产负载另验"
  ],
  "questionIds": [],
  "examples": [
    {
      "label": "完整实现、精确锁文件与真实测试",
      "path": "node-performance-memory.zip"
    },
    {
      "label": "运行与验证范围",
      "path": "node-performance-memory/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "性能是什么：先确定正在测哪段时间与哪种负载",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "性能是应用在给定资源与负载下完成工作的表现，不是一个脱离条件的“快慢”标签。延迟描述一次工作从开始到结束花多久，吞吐描述一个时间窗口完成多少工作，资源指标描述为了这些结果占用了什么。三者会互相影响，却不能彼此代替：快速拒绝请求可以抬高完成次数，但不代表业务更可用。"
        },
        {
          "type": "paragraph",
          "text": "本篇用一个有限CPU校验服务贯穿：请求提供迭代数，返回确定性的checksum。服务器单独运行在子进程，负载生成器在主进程发loopback HTTP，避免同一事件循环既发请求又计算，造成无法区分的互相干扰。它仍然共享一台机器与CPU资源，因此只是可复现教学窗口，不是公开的生产容量成绩。"
        },
        {
          "type": "paragraph",
          "text": "我们先比较同步计算与按块让出事件循环的结构，再定义p50、p95、完成率、ELU和事件循环延迟的口径。内存部分则不看一张RSS截图下结论，而是真正生成基线、保留、清理三份堆快照，检查128个合成对象及它们的引用边变化。测量的每一层都有自己能证明和不能证明的事。"
        },
        {
          "type": "figure",
          "src": "figures/node-performance-memory/windows.svg",
          "title": "客户端延迟、服务端活跃与内存不是一条时间线",
          "alt": "客户端窗口从本轮发出到读完响应；服务端窗口从reset到读取metrics，两者接近但不完全重合。延迟分布不能直接当成事件循环延迟。",
          "caption": "客户端窗口从本轮发出到读完响应；服务端窗口从reset到读取metrics，两者接近但不完全重合。延迟分布不能直接当成事件循环延迟。"
        }
      ]
    },
    {
      "id": "workload",
      "title": "同一份计算，两种调度：切片不会自动减少CPU总工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {setImmediate as yieldTurn} from 'node:timers/promises';\nexport function validateIterations(n){if(!Number.isInteger(n)||n<1||n>2000000)throw new RangeError('ITERATION_LIMIT');return n;}\nfunction block(value,start,end){for(let i=start;i<end;i++)value=(Math.imul(value^i,1664525)+1013904223)>>>0;return value;}\nexport function syncWork(n){validateIterations(n);return block(0,0,n);}\nexport async function chunkedWork(n,signal){\n validateIterations(n);let value=0;\n for(let start=0;start<n;start+=4096){signal?.throwIfAborted();value=block(value,start,Math.min(n,start+4096));if(start+4096<n)await yieldTurn();}\n return value;\n}",
          "language": "js",
          "filename": "examples/node-performance-memory/work.mjs",
          "purpose": "完整同步/切片计算：相同状态按相同次序更新，切片每4096次让出一轮，并在块间检查取消。输入上限2,000,000。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "syncWork在一个调用里完成全部循环，期间同一线程不能执行其他JavaScript回调。chunkedWork保留当前checksum，分块计算并用setImmediate让出下一轮。测试先排入一个真实setImmediate观察点，同步计算后它还没执行，切片计算完成前它已经得到执行机会；同时结果必须与同步版一致，防止“优化”漏算。"
        },
        {
          "type": "paragraph",
          "text": "切片提升的是调度机会，不是并行度。这里仍只有一个JavaScript执行线程，所有算式总量没有变，额外调度还可能增加开销。某次短窗口里chunked吞吐更低并不意外；是否改善其他请求的尾延迟，需要在合适负载下同时观察。只把async加到函数声明而没有真正让出，连这份公平性变化也不会出现。"
        },
        {
          "type": "paragraph",
          "text": "取消在块边界观察，不能抢占块内同步计算。块越大，调度开销可能更小，但其他请求和取消等待更久；块越小则可能花更多时间在调度上。4096是让实验短小的教学粒度，不是面向所有CPU、迭代成本与响应目标的最佳值。若工作本身非常重，应结合上一章的Worker或进程隔离，而不是无限细分主线程循环。"
        }
      ]
    },
    {
      "id": "metrics",
      "title": "先读清指标：ELU不是CPU使用率，循环延迟不是请求延迟",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {monitorEventLoopDelay,performance,PerformanceObserver} from 'node:perf_hooks';\nexport function metrics(){\n const histogram=monitorEventLoopDelay({resolution:10});histogram.enable();let baseElu,baseCpu,started,gcObserved=0;\n const gc=[];const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(entry.startTime<started)continue;gcObserved++;gc.push({kind:entry.detail.kind,durationMs:entry.duration});if(gc.length>128)gc.shift();}});observer.observe({entryTypes:['gc']});\n const reset=()=>{histogram.reset();baseElu=performance.eventLoopUtilization();baseCpu=process.cpuUsage();started=performance.now();gcObserved=0;gc.length=0;};reset();\n return {reset,snapshot(){const elapsedMs=performance.now()-started,elu=performance.eventLoopUtilization(baseElu),cpu=process.cpuUsage(baseCpu),samples=Number(histogram.count);\n  return {elapsedMs,eventLoopUtilization:elu.utilization,eventLoopDelayMs:{samples,mean:samples?histogram.mean/1e6:null,p99:samples?histogram.percentile(99)/1e6:null,max:samples?histogram.max/1e6:null},cpuMicroseconds:cpu,memoryBytes:process.memoryUsage(),gcObserved,gcEvents:[...gc]};\n },close(){histogram.disable();observer.disconnect();}};\n}",
          "language": "js",
          "filename": "examples/node-performance-memory/metrics.mjs",
          "purpose": "完整perf_hooks采集器：窗口reset、ELU增量、CPU微秒、RSS/堆/外部内存、纳秒转毫秒与有限GC事件记录；没有样本时返回null而不是伪造0。",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "指标",
            "本例口径",
            "不能直接推出"
          ],
          "rows": [
            [
              "客户端latencyMs",
              "从fetch调用到响应体读完",
              "全部服务端耗时或真实用户可见时刻"
            ],
            [
              "completedRps / successRps",
              "本轮完成尝试/成功数除以客户端窗口秒数",
              "没有错误的业务吞吐或开放到达负载能力"
            ],
            [
              "eventLoopUtilization",
              "当前服务进程事件循环active相对active+idle的比例",
              "整个机器或每个CPU核心的利用率"
            ],
            [
              "eventLoopDelayMs",
              "10ms分辨率探针被调度延后的直方图，原单位纳秒",
              "HTTP p95或所有长任务的精确持续时间"
            ],
            [
              "cpuMicroseconds",
              "进程user/system CPU增量",
              "只有主线程CPU或用户等待总时间"
            ],
            [
              "gcEvents",
              "当前观察窗口GC条目，最多保存128项",
              "没有条目就没有任何内存问题"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "ELU描述事件循环忙于活动的时间比例，与进程CPU时间不是一个公式。同步阻塞调用可能让循环无法进入空闲等待，却不持续消耗同等CPU；Worker或内部线程又可能增加进程CPU而不以相同方式反映在主循环上。排查时把ELU、CPU增量、循环延迟与请求分布放在同一窗口讨论，比从一个高百分比直接喊“CPU满了”更可靠。"
        },
        {
          "type": "paragraph",
          "text": "循环延迟监测本身靠定时调度采样。短于采样分辨率的窗口可能没有足够样本；代码用null表达没有统计依据，而不是把未采到写成0ms。一次有三个样本的p99也没有很强统计意义。正式比较应拉长稳定窗口、记录样本数并重复运行，不能让某个漂亮分位数掩盖观测条件。"
        },
        {
          "type": "paragraph",
          "text": "PerformanceObserver用detail.kind取得GC种类并记录duration。GC消耗时间，并不意味着每次GC都是异常；分配率高、存活对象多、堆规模与引擎策略都会影响它。我们不通过在生产循环里不停global.gc来“修好内存”，强制GC只在后面的合成快照实验中用于控制观察点。"
        },
        {
          "type": "paragraph",
          "text": "GC观察器异步交付条目，所以reset清空数组还不够：一次暖身GC可能在下一轮才送到回调。本例按entry.startTime筛掉窗口开始之前的条目，并另报gcObserved。gcEvents只保留最后128条，数组长度不能当完整窗口总次数；而“已观察到”的计数也不承诺所有刚发生尚未交付的条目都已进入这次快照。"
        }
      ]
    },
    {
      "id": "server",
      "title": "真实HTTP路径也要有边界，否则测量会先拖垮机器",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {createServer} from 'node:http';\nimport {once} from 'node:events';\nimport {syncWork,chunkedWork,validateIterations} from './work.mjs';\nimport {metrics} from './metrics.mjs';\nexport async function startServer(){\n const measure=metrics(),sockets=new Set();let active=0,maxActive=0,completed=0,rejected=0;\n const server=createServer(async(req,res)=>{\n  const url=new URL(req.url,'http://127.0.0.1');res.setHeader('content-type','application/json');res.setHeader('connection','close');\n  const reply=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};\n  if(url.pathname==='/reset'){if(active){reply(409,{error:'BUSY'});return;}measure.reset();maxActive=0;completed=0;rejected=0;reply(200,{ok:true});return;}\n  if(url.pathname==='/metrics'){reply(200,{...measure.snapshot(),active,maxActive,completed,rejected});return;}\n  if(url.pathname!=='/work'){reply(404,{error:'NOT_FOUND'});return;}\n  const mode=url.searchParams.get('mode')??'sync',n=Number(url.searchParams.get('n'));\n  try{validateIterations(n);if(!['sync','chunked'].includes(mode))throw new Error('BAD_MODE');}catch{reply(400,{error:'BAD_INPUT'});return;}\n  if(active>=4){rejected++;reply(429,{error:'CAPACITY'});return;}\n  active++;maxActive=Math.max(maxActive,active);const controller=new AbortController();\n  res.once('close',()=>{if(!res.writableEnded)controller.abort(new Error('CLIENT_GONE'));});\n  try{const checksum=mode==='sync'?syncWork(n):await chunkedWork(n,controller.signal);completed++;if(!res.destroyed)reply(200,{checksum});}\n  catch{if(!res.destroyed)reply(499,{error:'CANCELLED'});}\n  finally{active--;}\n });\n server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});server.listen(0,'127.0.0.1');await once(server,'listening');\n return {base:`http://127.0.0.1:${server.address().port}`,async close(){measure.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}};\n}\nif(process.argv.includes('--child')){\n const app=await startServer();process.send?.({base:app.base});process.on('message',async message=>{if(message==='close'){await app.close();process.disconnect();}});\n for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await app.close();process.exit(0);});\n}",
          "language": "js",
          "filename": "examples/node-performance-memory/server.mjs",
          "purpose": "完整本机服务器：随机loopback端口，最多4项在途工作，输入范围、状态计数、合作式取消与自己的socket/采集器清理。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "每个请求都先验证mode和迭代数，再检查在途容量。超过4项时返回429，不让队列无限堆在内存里。sync模式由于主线程串行处理，观察到的maxActive通常不同于chunked；这说明“代码内有await”改变了调度重叠，而不是产生了多个同时运行JavaScript循环的CPU核心。"
        },
        {
          "type": "paragraph",
          "text": "res的close事件只有在响应尚未正常结束时才传播CLIENT_GONE。不能直接拿IncomingMessage的正常结束当作业务取消，否则一个已经完整收到的GET也可能被误判。切片工作在下个边界观察signal，同步工作则只能先算完；测试没有因为发出了abort就宣称任何CPU函数都已被抢占。"
        },
        {
          "type": "paragraph",
          "text": "reset只在没有活动工作时接受，避免一轮测量把上一轮还在计算的任务清零。metrics请求读取同一进程采集器，这个服务端窗口比客户端窗口多包含一点控制请求与结果收集时间。比较CPU、ELU与吞吐时应保留这个差异，不能把来自不同边界的数字直接当作精确同分母指标。"
        }
      ]
    },
    {
      "id": "load",
      "title": "压测模型：固定并发闭环会主动等前一项结束",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {performance} from 'node:perf_hooks';\nexport function summarize(latencies,elapsedMs,successes){\n if(!latencies.length||!Number.isFinite(elapsedMs)||elapsedMs<=0)throw new RangeError('EMPTY_WINDOW');\n const sorted=[...latencies].sort((a,b)=>a-b),percentile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];\n return {attempts:sorted.length,successes,errors:sorted.length-successes,elapsedMs,completedRps:sorted.length/(elapsedMs/1000),successRps:successes/(elapsedMs/1000),latencyMs:{p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1)}};\n}\nexport async function runLoad(base,{requests=20,concurrency=2,mode='sync',iterations=500000}={}){\n const url=new URL(base);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('LOOPBACK_ONLY');\n if(!Number.isInteger(requests)||requests<1||requests>100||!Number.isInteger(concurrency)||concurrency<1||concurrency>8||!['sync','chunked'].includes(mode)||!Number.isInteger(iterations)||iterations<1||iterations>2000000)throw new RangeError('BOUNDED_LOAD_REQUIRED');\n await(await fetch(base+`/work?mode=${mode}&n=${iterations}`)).text();\n const reset=await fetch(base+'/reset');if(!reset.ok)throw new Error('RESET_BUSY');await reset.text();\n let cursor=0,successes=0,transportErrors=0;const latencies=[],started=performance.now();\n await Promise.all(Array.from({length:concurrency},async()=>{\n  while(cursor<requests){cursor++;const begin=performance.now();try{const response=await fetch(base+`/work?mode=${mode}&n=${iterations}`,{signal:AbortSignal.timeout(10000)});await response.text();if(response.ok)successes++;}catch{transportErrors++;}finally{latencies.push(performance.now()-begin);}}\n }));\n const summary=summarize(latencies,performance.now()-started,successes),server=await(await fetch(base+'/metrics')).json();\n return {model:'closed-loop',concurrency,mode,iterations,...summary,transportErrors,server};\n}",
          "language": "js",
          "filename": "examples/node-performance-memory/load.mjs",
          "purpose": "完整有界负载生成与统计：先暖身、再reset、最多100请求/并发8，所有尝试的延迟进入分位数，成功与错误分别计数。只允许loopback目标。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {fork} from 'node:child_process';\nexport async function spawnServer(){\n const child=fork(new URL('./server.mjs',import.meta.url),['--child'],{stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',x=>errors+=x);\n const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('BOOT_TIMEOUT '+errors)),5000);child.once('message',m=>{clearTimeout(timer);resolve(m.base);});child.once('error',error=>{clearTimeout(timer);reject(error);});});\n return {base,async close(){if(child.exitCode!==null)return;const done=new Promise(resolve=>child.once('exit',resolve));child.send('close');const timer=setTimeout(()=>child.kill('SIGKILL'),2000);try{await done;}finally{clearTimeout(timer);}}};\n}",
          "language": "js",
          "filename": "examples/node-performance-memory/harness.mjs",
          "purpose": "完整独立服务器进程启动/关闭辅助；不让生成器与被测JS循环共享同一个事件循环。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {spawnServer} from './harness.mjs';import {runLoad} from './load.mjs';\nconst app=await spawnServer();try{for(const mode of ['sync','chunked'])console.log(JSON.stringify(await runLoad(app.base,{mode})));}finally{await app.close();}",
          "language": "js",
          "filename": "examples/node-performance-memory/benchmark.mjs",
          "purpose": "完整演示入口：同一参数分别运行两种计算方式；输出原始窗口，未在代码里把某一种模式预设为更快。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "闭环负载意味着一个并发槽位读完上一次响应，才发下一项。服务越慢，生成器的到达速度也会下降，因此它适合观察固定并发下的表现，却可能遗漏开放到达系统在过载时不断增长的排队延迟，这通常被讨论为协调遗漏问题。本文明确标model=closed-loop，不把20次请求的短样本写成系统可承受的恒定公网请求率。"
        },
        {
          "type": "paragraph",
          "text": "p50和p95使用最近秩：把所有尝试耗时升序排列，取ceil(N×p)对应位置。失败响应也计入latencyMs，另报errors和transportErrors；如果大量请求快速429，整体p95可能很好看，成功吞吐却很差。因此必须一起读成功数、错误率和状态分布，正式SLO还可以分别报告成功与失败延迟，不能只挑一个最低数字。"
        },
        {
          "type": "paragraph",
          "text": "连接建立、HTTP客户端开销与本机调度都在客户端测量里。我们先暖身一次再重置服务端窗口，减少一部分首次执行影响；它仍不是完整预热研究。严肃对比应固定版本、输入、并发/到达模型、资源配额与观察窗口，重复多轮并保留原始结果，再检查CPU与内存是否处在稳定状态。"
        },
        {
          "type": "paragraph",
          "text": "负载生成器也可能成为瓶颈。即使与服务分成两个进程，同机资源竞争仍在；若客户端已经无法按计划发出请求，观察到的吞吐不再只由服务能力决定。这里限制loopback，避免误把教学脚本指向别人系统；真实容量验收通常要在授权隔离环境里安排独立负载端，并记录网络与客户端资源。"
        },
        {
          "type": "paragraph",
          "text": "分位数与平均数回答的问题不同。平均延迟可能被大量快速请求拉低，p95关心排序后更靠尾部的位置，但也依赖足够样本；当只有20项时，最近秩p95就是第19项，单个样本变化就能明显移动它。应报告样本数与观察模型，不把分位数的小数点位数当作统计置信度。"
        }
      ]
    },
    {
      "id": "memory",
      "title": "内存指标先分层：RSS不等于JavaScript活对象",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "process.memoryUsage中的rss是进程驻留内存，heapTotal和heapUsed描述V8堆的容量与使用，external包含引擎之外与JS对象关联的分配，arrayBuffers表示ArrayBuffer等使用的部分内存。arrayBuffers已经包含在external中，不能把两者直接相加再称作总量。线程、native库和分配器也会影响RSS，所以只盯heapUsed会漏掉另一类增长。"
        },
        {
          "type": "paragraph",
          "text": "一次heapUsed下降不证明没有泄漏，一次RSS没降也不证明对象仍被引用。GC可能回收对象但保留堆页供后续复用，分配器也不保证马上把驻留页还给操作系统。真正要问的是：经过相同工作量与稳定回收点以后，哪些对象仍然存活，谁还持有它们，这些引用是否符合预期生命周期。"
        },
        {
          "type": "figure",
          "src": "figures/node-performance-memory/retainers.svg",
          "title": "从指标增长走到具体引用：谁使对象仍然可达",
          "alt": "本例全局属性指向holder，holder.notes数组含128个AtlasNote；清空数组后，快照元素边与类实例数回到基线。图为这份合成代码的所有权链，不是对用户进程的诊断。",
          "caption": "本例全局属性指向holder，holder.notes数组含128个AtlasNote；清空数组后，快照元素边与类实例数回到基线。图为这份合成代码的所有权链，不是对用户进程的诊断。"
        }
      ]
    },
    {
      "id": "snapshots",
      "title": "三份真实快照：先保留，再清引用，而不是只相信GC调用成功",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {pathToFileURL} from 'node:url';\nimport {writeHeapSnapshot} from 'node:v8';\nimport {PerformanceObserver} from 'node:perf_hooks';\nimport {mkdir,readFile} from 'node:fs/promises';\nimport {join} from 'node:path';\nexport function countNamedObjects(raw,name){\n const parsed=JSON.parse(raw),{node_fields:fields,node_types:types}=parsed.snapshot.meta;\n const type=fields.indexOf('type'),label=fields.indexOf('name'),step=fields.length;let count=0;\n for(let i=0;i<parsed.nodes.length;i+=step)if(types[type][parsed.nodes[i+type]]==='object'&&parsed.strings[parsed.nodes[i+label]]===name)count++;\n return count;\n}\nexport function inspectRetentionEdges(raw){\n const p=JSON.parse(raw),m=p.snapshot.meta,nf=m.node_fields,ef=m.edge_fields;\n const nt=nf.indexOf('type'),nn=nf.indexOf('name'),nc=nf.indexOf('edge_count'),et=ef.indexOf('type'),en=ef.indexOf('name_or_index'),to=ef.indexOf('to_node');\n const name=index=>p.strings[p.nodes[index+nn]];\n const visit=fn=>{let edge=0;for(let node=0;node<p.nodes.length;node+=nf.length)for(let k=0;k<p.nodes[node+nc];k++,edge+=ef.length)fn(node,m.edge_types[et][p.edges[edge+et]],p.edges[edge+en],p.edges[edge+to]);};\n let holder=-1,array=-1,owned=false,elements=0;\n visit((from,type,key,target)=>{if(type==='property'&&p.strings[key]==='tag'&&name(target)==='atlas-retention-root')holder=from;});\n visit((from,type,key,target)=>{if(from===holder&&type==='property'&&p.strings[key]==='notes')array=target;if(type==='property'&&p.strings[key]==='__atlasMemoryDemo'&&target===holder)owned=true;});\n visit((from,type,_key,target)=>{if(from===array&&type==='element'&&m.node_types[nt][p.nodes[target+nt]]==='object'&&name(target)==='AtlasNote')elements++;});\n return {globalHolder:owned,noteElements:elements};\n}\nclass AtlasNote{constructor(id){this.id=id;this.payload=new Array(512).fill(id);}}\nexport async function retentionProbe(directory){\n if(typeof global.gc!=='function')throw new Error('RUN_WITH_EXPOSE_GC');\n await mkdir(directory,{recursive:true});const gc=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({kind:e.detail.kind,durationMs:e.duration});});observer.observe({entryTypes:['gc']});\n const holder={tag:'atlas-retention-root',notes:[]};globalThis.__atlasMemoryDemo=holder;\n const sample=async name=>{global.gc();await new Promise(setImmediate);const file=writeHeapSnapshot(join(directory,name+'.heapsnapshot'));return {file,memoryBytes:process.memoryUsage()};};\n try{\n  const baseline=await sample('baseline');for(let i=0;i<128;i++)holder.notes.push(new AtlasNote(i));\n  const retained=await sample('retained');holder.notes.length=0;const released=await sample('released');\n  return {baseline,retained,released,gcEvents:gc};\n }finally{delete globalThis.__atlasMemoryDemo;observer.disconnect();}\n}\nif(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){\n const result=await retentionProbe(process.argv[2]??'profiles');\n for(const stage of ['baseline','retained','released']){const raw=await readFile(result[stage].file,'utf8');result[stage].atlasNoteCount=countNamedObjects(raw,'AtlasNote');result[stage].ownership=inspectRetentionEdges(raw);}\n console.log(JSON.stringify(result));\n}",
          "language": "js",
          "filename": "examples/node-performance-memory/snapshot.mjs",
          "purpose": "完整快照与解析工具：用snapshot.meta读取布局，检查AtlasNote对象数，以及全局holder→notes→元素引用；解析限定当前Node/V8格式的本地可信快照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "实验先建立一个标记为atlas-retention-root的holder，并由globalThis.__atlasMemoryDemo持有；基线里没有AtlasNote。随后放入128个对象，每个有一份有限payload数组，再写retained快照。清空holder.notes后写released快照，最后删除全局入口。每个观察点都显式GC并让出一轮，目的是让这份合成实验可判定，不是模拟生产GC策略。"
        },
        {
          "type": "paragraph",
          "text": "快照实际记录中，AtlasNote数量为0→128→0；引用边检查确认保留阶段全局holder存在、notes数组有128条指向实例的元素边，清理阶段变为0。这个证据比“内存看起来降了一些”更具体：它证明本例指定对象不再由这条集合保留。但它不自动计算所有对象的retained size，也不能据此宣称整个Node进程不存在其他泄漏。"
        },
        {
          "type": "paragraph",
          "text": "查看堆快照时，shallow size是对象自身占用，retained size讨论的是若该对象及其支配关系移除，哪些内存才能一起释放。一个很小的数组或闭包可能通过引用保住大图。正式调查通常需要对比快照、查看Retainers与支配关系，再回到生命周期代码；本例解析器只核验已知标记链，不把几行计数当成通用泄漏分析器。"
        },
        {
          "type": "paragraph",
          "text": "writeHeapSnapshot是同步、可能暂停事件循环并增加额外内存压力的操作，快照也可能包含进程中的敏感数据。应在受控环境、合适容量与访问范围内采集；这份示例只创建合成对象，测试临时文件结束就删除，不上传任何用户进程快照。给生产实例定时无限写快照，反而可能成为新的事故来源。"
        },
        {
          "type": "paragraph",
          "text": "格式随V8版本变化，解析器通过meta字段取偏移，而不是硬编码每节点七项；但它仍只验证Node22.12当前结构。若缺字段、换引擎或读取不可信超大文件，必须先做格式与容量校验。这份工具没有公开上传接口，不把本地可信测试快照解析扩展为任意文件服务。"
        },
        {
          "type": "paragraph",
          "text": "快照文件本身需要版本与来源说明。三份文件必须来自同一份程序、同一组输入和可解释的生命周期阶段；比较两个运行环境随手截取的堆，差异可能来自模块加载、调试器或运行时版本。这里让同一子进程完成三阶段，再退出后读文件做有限核验，避免把分析器解析产生的大量对象也混到后续采集阶段中。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "怎样运行，怎样区分观察结果与性能结论",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/node-performance-memory\nnpm ci\nnpm test\nnode benchmark.mjs\nnode --expose-gc snapshot.mjs profiles",
          "language": "bash",
          "filename": "终端",
          "purpose": "无第三方依赖。benchmark仅访问自己创建的loopback服务；profiles内快照是本机生成物，不进入下载ZIP或Git。",
          "kind": "runnable"
        },
        {
          "type": "list",
          "ordered": true,
          "items": [
            "先确认sync与chunked对同一迭代数返回相同checksum，再谈调度变化，不能把漏算当加速。",
            "阅读每个窗口的requests/成功/错误、p50/p95、elapsed与样本数；若样本极少，延长观察，不据一次结果排名。",
            "查看ELU、CPU与循环延迟，判断是否真有主循环活动或调度延后；不要把ELU直接当全机CPU。",
            "比较三份快照对象数与已知引用边；即使released的RSS没有回到基线，也先以可达对象和持有者判断这条生命周期。"
          ]
        },
        {
          "type": "paragraph",
          "text": "macOS14.5/Node22.12.0已通过6项真实测试，包括同结果/实际让出、输入与取消、分位数公式、独立HTTP服务指标、目标边界以及实际GC/堆快照。最后一次快照证据为0/128/0，观察到GC事件；两种演示窗口各20次成功，无错误。这些是运行记录，不是生产吞吐或内存预算承诺，CLI输出会随机器负载变化。"
        },
        {
          "type": "paragraph",
          "text": "优化之前，先保留一个可复现基线和明确的失败现象。若目标是减少交互尾延迟，就同时观察其他请求在计算期间的等待；若目标是查泄漏，就在相同生命周期后追踪仍存活的引用。到这一步，计时、负载、GC和快照才会共同回答一个具体问题，而不是变成几张没有条件的仪表盘。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Node22.12 perf_hooks",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/perf_hooks.html"
    },
    {
      "title": "Node22.12 V8快照",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/v8.html"
    },
    {
      "title": "Node22.12 process.memoryUsage",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/process.html#processmemoryusage"
    }
  ]
};
export default article;
