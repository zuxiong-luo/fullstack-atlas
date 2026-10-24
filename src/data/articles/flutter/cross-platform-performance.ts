import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "cross-platform-performance",
  "topic": "flutter",
  "title": "跨平台性能：启动、滚动、内存和通信成本",
  "description": "在真实Web代表平台固定测量边界，比较全量与窗口化列表，实际Worker通信并检测内存能力；不给未测真机编造排名。",
  "minutes": 40,
  "labMinutes": 30,
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Node.js22.12.0",
    "React18.3.1",
    "TypeScript5.7.3",
    "esbuild0.25.12"
  ],
  "verifiedAt": "2026-10-25",
  "tags": [
    "跨平台",
    "性能测量",
    "虚拟列表",
    "Worker"
  ],
  "scope": "React18.3.1 Web DOM生产构建代表平台；测回调间隔、实际通信和可用堆指标，不等同手机FPS、原生冷启或进程RSS。",
  "prerequisites": [
    "理解请求与响应、状态更新",
    "能阅读一门语言的函数与事务；核心代码不依赖已安装移动框架"
  ],
  "sections": [
    {
      "id": "concept",
      "title": "1. 性能的概念：先固定谁，在什么条件下，完成什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "性能不是给框架贴一个“快”字，而是在确定平台、工作负载和资源条件下，完成某个用户目标的表现。启动关注多久能进入有用状态，滚动关注更新是否及时，内存关注哪些资源被持有，通信关注跨执行边界付出多少成本。它们会相互影响，却不能用一个总分互相代替。"
        },
        {
          "type": "paragraph",
          "text": "跨平台比较首先要保留平台差异。同一份数据，Web 更新 DOM，Flutter 经过自己的构建与渲染流程，React Native 的 JS 和原生 UI 也有各自的工作边界。把浏览器 rAF 间隔叫成手机真实帧率，或者把桌面调试构建和手机发布包放进同一排名，得到的小数点再多也没有解释力。"
        },
        {
          "type": "paragraph",
          "text": "本篇先选当前可实际运行的 Web DOM 作为代表平台，使用 React 18.3.1 生产构建，把启动、2000 行列表、真实 Worker 通信和可用堆指标做成一个小实验。我们测真实调用，不用 setTimeout 人为等一段时间来模拟慢接口。Flutter/RN 提供迁移测量方法，但没有真机数据的地方保持未验证。"
        }
      ]
    },
    {
      "id": "workload",
      "title": "2. 先写实验条件，再写计时代码",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/cross-platform-performance/mechanism.svg",
          "title": "固定工作负载下的四个测量边界",
          "alt": "四个并列测量框：启动记录 HTML 标记到 React 提交及第二次 rAF，滚动记录固定 2000 行和 120 步的回调间隔与 DOM 数，通信记录真实 Worker 的 clone 和 transfer 往返，内存只读取能力允许的近似 JavaScript 堆。",
          "caption": "四项数据各有起止和适用范围：启动不是原生冷启动，rAF 间隔不是显示器实际 FPS，Worker 往返不包含 buffer 创建，也不能证明底层零拷贝；近似 JavaScript 堆不是进程 RSS 或 GPU 内存。先固定这些边界，再比较相同工作负载的样本。"
        },
        {
          "type": "table",
          "headers": [
            "项目",
            "本篇固定条件",
            "为什么需要记录"
          ],
          "rows": [
            [
              "构建",
              "React18.3.1生产bundle，esbuild0.25.12",
              "避免调试检查和热更新混入"
            ],
            [
              "列表",
              "2000行，行高32px，容器320px，120步",
              "确保两实现做同一段滚动"
            ],
            [
              "通信",
              "新Worker，1次8字节预热，8次1MiB",
              "启动与稳态调用分别说明"
            ],
            [
              "浏览器状态",
              "前台可见、记录视口/版本/加载顺序",
              "后台节流与缓存会改变结果"
            ],
            [
              "内存",
              "能力检测，存在才读取近似JS堆",
              "缺失不能当0，JS堆不是RSS"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "每次运行先固定任务成功标准，再看耗时。列表必须走到同一个 scrollTop，通信必须检查接收字节数和首尾值；如果所谓优化只是少画内容或漏传数据，就不能继续比较。还需要记录样本数和运行顺序，避免只保留最漂亮的一轮。"
        },
        {
          "type": "paragraph",
          "text": "实验提供独立本地页面，并把核心与视图合成仅导入 React 的 App.tsx 供站点实验室使用。独立页面能测从 HTML 前置标记开始的路径；在已经运行的实验室 iframe 里，宿主的脚本下载和生命周期不同，因此不能把两种入口的启动数字直接混用。"
        }
      ]
    },
    {
      "id": "startup",
      "title": "3. 启动边界：渲染提交、可绘制机会和用户可用不同",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "独立 index.html 在加载本地 bundle 前写入一个 performance.now 标记。App 在 useLayoutEffect 中观察首次 React 提交后的时刻，若实验室宿主没有这份 HTML 标记，则明确显示不支持启动计时，不输出 NaN 或 null 冒充时长。独立入口再通过两次 requestAnimationFrame 观察后续调度机会。输出分别标 htmlToCommitMs 和 htmlToSecondFrameMs，不把第二个值命名为首屏完成或用户可交互时间。"
        },
        {
          "type": "code",
          "language": "typescript",
          "code": "React.useLayoutEffect(()=>{if(booted.current)return;booted.current=true;const begin=startupMark((window as unknown as {__atlasBoot?:number}).__atlasBoot),commit=performance.now();\n  if(begin===null){setStartup({supported:false,note:'HTML pre-bundle mark absent: startup timing requires the independent local index.html; lab host lifecycle is different'});return;}\n  requestAnimationFrame(()=>requestAnimationFrame(()=>setStartup({supported:true,cacheCondition:'本页未强制清缓存；请记录首次或重复加载',begin:'HTML inline mark, before local JS bundle',end:'React layout effect / second requestAnimationFrame opportunity',htmlToCommitMs:commit-begin,htmlToSecondFrameMs:performance.now()-begin,navigationType:(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type??'unavailable'})));\n },[]);",
          "filename": "examples/cross-platform-performance/view.tsx.txt",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "为什么不直接说“两帧后一定绘制完成”？rAF 回调在下一次重绘之前调用，浏览器还可能省略、合并或延迟实际呈现；两次回调只给出一个便于复现的机会边界。如果产品要测首个有意义内容、图片真正显示或点击可用，应给那个业务条件定义独立标记，再配合浏览器追踪或原生平台工具确认。"
        },
        {
          "type": "paragraph",
          "text": "缓存条件也必须写出来。这个教学服务器对 HTML 和 bundle 返回 no-store，每次导航重新取资源，但没有清操作系统文件缓存、重新启动浏览器或清掉所有运行时缓存。因此“首次打开本页”不是设备冷启动，“刷新”也不能自动叫做完全热缓存。要研究缓存收益，应设计明确的缓存策略和对照条件，而不是根据 navigationType 一个字段猜测。"
        },
        {
          "type": "reference",
          "title": "MDN：requestAnimationFrame回调与后台暂停",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame"
        }
      ]
    },
    {
      "id": "list-structure",
      "title": "4. 列表结构：全量与窗口化减少的是哪部分工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "全量模式创建 2000 个 data-row 元素，窗口化模式只保留可视范围和上下各 3 项 overscan，用前后占位高度保持总滚动范围。固定行高让结构简单：scrollTop 除以 32 决定第一项，容器能显示 10 项，再扩出缓冲范围。它减少 DOM 数量及相关协调、布局候选，不意味着网络输入、数据数组或所有 JS 分配也按同样比例下降。"
        },
        {
          "type": "code",
          "language": "typescript",
          "code": "export function visibleRange(scrollTop:number,count=2000,height=320,rowHeight=32,overscan=3){\n if(!Number.isFinite(scrollTop)||scrollTop<0||!Number.isSafeInteger(count)||count<1||!Number.isFinite(height)||height<=0||!Number.isFinite(rowHeight)||rowHeight<=0||!Number.isSafeInteger(overscan)||overscan<0)throw new RangeError('bounded list parameters required');\n const first=Math.min(count-1,Math.floor(scrollTop/rowHeight)),start=Math.max(0,first-overscan),end=Math.min(count,Math.ceil((scrollTop+height)/rowHeight)+overscan);\n return {start,end,before:start*rowHeight,after:(count-end)*rowHeight};\n}",
          "filename": "examples/cross-platform-performance/core.ts",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "每次计算保留 start/end，前占位是 start×rowHeight，后占位是剩余行数×rowHeight。测试覆盖所有可达滚动位置，检查可视项不会被剪掉、元素数量不超过 17，以及占位加真实行高始终等于 64000。这样即使某次计时更快，也先有结构不变量证明没有缩短实际滚动内容。"
        },
        {
          "type": "paragraph",
          "text": "固定行高是算法前提。动态文本换行、图片加载后改高、吸顶分组和无障碍焦点都会增加测量与锚点维护问题。窗口化还可能影响浏览器页内查找和屏幕阅读器读取未挂载项；真实产品要在数据规模、交互要求和可访问性之间取舍，不能只为把 DOM 计数降到最低就宣布优化完成。"
        }
      ]
    },
    {
      "id": "scroll",
      "title": "5. 滚动测量：记录回调间隔，不伪造显示器帧率",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "每轮固定执行 120 个 rAF 步骤，从起点均匀推进到同一个底部。相邻回调形成 119 个间隔，按最近秩计算 p50、p95、最大值，另外输出超过 16.7ms 的数量、最后 scrollTop 和当时 DOM 行数。运行中切换标签页会丢弃结果，避免把后台节流当成前台性能。"
        },
        {
          "type": "code",
          "language": "typescript",
          "code": "async function scroll(){\n  if(!box.current||document.visibilityState!=='visible')return;setBusy(true);setScrollResult(null);\n  const intervals:number[]=[];let previous:number|undefined;const target=box.current,begin=performance.now();\n  try{for(let step=0;step<120;step++){const now=await new Promise<number>(requestAnimationFrame);if(document.visibilityState!=='visible')throw new Error('TAB_HIDDEN: discard this run');if(previous!==undefined)intervals.push(now-previous);previous=now;const next=Math.floor(step*(2000*32-320)/119);target.scrollTop=next;setTop(next);}\n   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));\n   setScrollResult({platform:'Web DOM',mode,rows:2000,viewportPx:320,rowHeightPx:32,steps:120,...summarizeFrames(intervals),elapsedMs:performance.now()-begin,domRows:target.querySelectorAll('[data-row]').length,scrollTop:target.scrollTop,note:'rAF callback intervals, not physical frame presentation or native FPS; identical fixed workload'});\n  }catch(error){setScrollResult({error:(error as Error).message});}finally{setBusy(false);}\n }",
          "filename": "examples/cross-platform-performance/view.tsx.txt",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "typescript",
          "code": "export function summarizeFrames(intervals:readonly number[]){\n if(!intervals.length||intervals.some(x=>!Number.isFinite(x)||x<=0))throw new RangeError('positive frame samples required');\n const sorted=[...intervals].sort((a,b)=>a-b),rank=(p:number)=>sorted[Math.ceil(sorted.length*p)-1];\n return {samples:sorted.length,p50Ms:rank(.5),p95Ms:rank(.95),maxMs:sorted.at(-1)!,over16_7Ms:sorted.filter(x=>x>16.7).length};\n}",
          "filename": "examples/cross-platform-performance/core.ts",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "16.7ms 只是约 60Hz 的参考线，不是所有屏幕的固定预算；120Hz 的预算不同，rAF 也不等于显卡或屏幕实际呈现记录。实验还通过程序设置 scrollTop，不能替代手势惯性、合成线程滚动与原生输入链的端到端体验。应把它叫作固定工作负载下的调度观察，再结合目标平台工具定位真正的长帧。"
        },
        {
          "type": "paragraph",
          "text": "全量和窗口化每轮都更新 top 状态，因此包含 React 重新计算列表的成本。测量不是只数浏览器滚动条移动速度。由于工作量和刷新节奏存在耦合，elapsedMs 也不能单独解释成“渲染 2000 行花了这么久”；要同时阅读结构、样本和跟踪信息，重复多轮再看是否稳定。"
        }
      ]
    },
    {
      "id": "communication",
      "title": "6. 通信：传输的是数据，测到的是一次往返路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Worker 实验真实创建浏览器 Worker，将 1MiB ArrayBuffer 发过去；Worker 读取首尾字节并返回有限元数据。clone 路径不提供转移列表，发送方缓冲仍可用；transfer 路径传入该 buffer，发送方 byteLength 变为 0。每次都校验接收 ID、大小、首值 7 和尾值 19，避免把“很快返回了空结果”当成成功。"
        },
        {
          "type": "code",
          "language": "typescript",
          "code": "async function communicate(transfer:boolean){\n  setBusy(true);\n  try{await withOwnedWorker(workerSource,async worker=>{\n   const samples:number[]=[],records:unknown[]=[];let nextId=0;\n   const round=async(size:number,measured:boolean)=>{const expected=expectedBytes(size),buffer=new ArrayBuffer(size),a=new Uint8Array(buffer);a[0]=7;a[a.length-1]=19;const id=nextId++,start=performance.now();\n    const received=await new Promise<{id:number;size:number;first:number;last:number}>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('WORKER_TIMEOUT')),5000);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.onerror=()=>{clearTimeout(timer);reject(new Error('WORKER_ERROR'));};worker.postMessage({id,buffer},transfer?[buffer]:[]);});\n    const ms=performance.now()-start;if(received.id!==id||received.size!==expected.size||received.first!==7||received.last!==19)throw new Error('BAD_RESULT');\n    if(measured){samples.push(ms);records.push({id,senderBytes:buffer.byteLength,receivedBytes:received.size});}\n   };\n   await round(8,false);for(let i=0;i<8;i++)await round(1024*1024,true);\n   setChannel({transport:'real browser Worker',mode:transfer?'transfer':'clone',warmup:1,payloadBytes:1024*1024,...summarizeFrames(samples),records,note:'round trip includes dispatch, clone/transfer, worker response; no claim of universal zero-copy or speed ranking'});\n  });}catch(error){setChannel({error:(error as Error).message});}finally{setBusy(false);}\n }",
          "filename": "examples/cross-platform-performance/view.tsx.txt",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "typescript",
          "code": "export async function withOwnedWorker<T>(source:string,run:(worker:Worker)=>Promise<T>,environment:WorkerEnvironment={\n createURL:source=>URL.createObjectURL(new Blob([source],{type:'text/javascript'})),\n createWorker:url=>new Worker(url),revokeURL:url=>URL.revokeObjectURL(url)\n}){\n let url:string|undefined,worker:Worker|undefined;\n try{url=environment.createURL(source);worker=environment.createWorker(url);return await run(worker);}\n finally{try{worker?.terminate();}finally{if(url!==undefined)environment.revokeURL(url);}}\n}",
          "filename": "examples/cross-platform-performance/core.ts",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "计时从 postMessage 前开始，到收到 Worker 响应为止，包含调度、复制或转移和返回元数据的成本，不包含大 buffer 创建和写首尾的时间。新 Worker 先做一次 8 字节往返作为明确预热，随后测 8 次 1MiB；不是每一项都新建 Worker，也不是证明底层实现对所有数据都零拷贝。"
        },
        {
          "type": "paragraph",
          "text": "transfer 更重要的语义是所有权交接，速度只是可测结果。发送后还要继续使用同一个 buffer 的逻辑会失效；若业务需要两边同时保留数据，应考虑复制，或使用共享内存并承担同步问题。把每项 UI 变更都拆成一次跨边界消息，还可能让调度和序列化盖过实际计算；批量传递要同时限制批次大小和在途字节数。"
        },
        {
          "type": "reference",
          "title": "MDN：Worker.postMessage与转移所有权",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage"
        }
      ]
    },
    {
      "id": "memory",
      "title": "7. 内存：先看指标覆盖范围，再谈增长与释放",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "页面只在 performance.memory 存在时读 usedJSHeapSize、totalJSHeapSize 和 jsHeapSizeLimit，明确标注这是非标准、近似的 JS 堆观察，可能按浏览器策略粗化，也可能漏掉 Worker 的独立堆。不可用时显示 unsupported，不用 0 伪装测量成功。这一入口只是教学诊断，不能当成跨浏览器统一遥测协议。"
        },
        {
          "type": "code",
          "language": "typescript",
          "code": "function inspectMemory(){const data=(performance as Performance&{memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}}).memory;setMemory(data?{supported:true,usedJSHeapSize:data.usedJSHeapSize,totalJSHeapSize:data.totalJSHeapSize,jsHeapSizeLimit:data.jsHeapSizeLimit,note:'non-standard approximate JS heap of this browser context; not RSS, not retained size, no forced GC'}:{supported:false,note:'performance.memory unavailable; do not substitute fabricated zero'});}",
          "filename": "examples/cross-platform-performance/view.tsx.txt",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "DOM、图像、GPU 纹理、运行时和原生对象可能分布在不同内存区域。JS 堆稳定不代表进程 RSS 稳定，列表少了 1980 个节点也不能直接换算成具体节省多少字节。反过来，移除列表后堆没立即下降，也不等于必然泄漏；GC、堆页保留与其他对象都会影响读数。"
        },
        {
          "type": "paragraph",
          "text": "调查生命周期问题时，应重复进入、滚动、退出同一个页面，在相同条件下比较仍存活的对象和持有链。浏览器堆快照、Flutter DevTools 与平台原生工具有不同覆盖范围，必要时组合使用。当前例子没有强制 GC、没有访问用户真实进程，也不把单次内存按钮读数包装成泄漏验收。"
        },
        {
          "type": "reference",
          "title": "MDN：performance.memory非标准与精度限制",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory"
        }
      ]
    },
    {
      "id": "platform",
      "title": "8. 将方法迁移到Flutter、RN和桌面时，哪些要换",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Flutter 应在目标真机的 profile 模式看 UI 与 raster 等阶段及其时间线，区分构建计算与实际绘制负担。RN 要区分 JS 线程计算、原生 UI 更新及具体架构的通信与调用路径；桌面 Electron 还要分开主进程、渲染进程和 IPC。不同平台的“帧”与“内存”字段不一定同义，不能把工具名称相同当作口径一致。"
        },
        {
          "type": "paragraph",
          "text": "迁移时保留工作负载和成功标准：相同数量的行、相同尺寸与图片策略、相同滚动区间、相同输入响应和消息内容。再替换测量工具，记录设备型号、系统、框架版本、构建模式、刷新率和热状态。对调试构建明显慢的现象，先确认发布或 profile 配置，避免去优化只在调试器里存在的开销。"
        },
        {
          "type": "paragraph",
          "text": "如果需要框架选型排名，还要先定义目标产品约束和代表设备，做多轮公平对照。本篇没有启动 Flutter/RN 真机包，也没有用 Web 的数据推断它们谁更快。没有环境的结果保持空缺，比填一张来自不同机器和不同页面的排行榜更能帮助真正做决定。"
        },
        {
          "type": "reference",
          "title": "Flutter：真机与profile模式性能检查",
          "url": "https://docs.flutter.dev/perf/ui-performance"
        },
        {
          "type": "reference",
          "title": "React Native：性能与JS/UI帧率",
          "url": "https://reactnative.dev/docs/performance"
        }
      ]
    },
    {
      "id": "run",
      "title": "9. 运行和读取结果：先验证正确，再保存原始条件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "cross-platform-performance",
          "title": "实际Web启动、列表、Worker和内存观察",
          "description": "生产React代表平台。固定2000行全量/窗口化与120步，真实Worker clone/transfer，输出样本数和能力边界；不是手机真机排名。"
        },
        {
          "type": "paragraph",
          "text": "下载工程后使用 Node 22.12.0 执行 npm ci、npm test，再 npm run serve，打开 127.0.0.1:4353。构建锁定 React 18.3.1、TypeScript 5.7.3 和 esbuild 0.25.12，无外部图片或 CDN。服务器只提供固定 HTML 与构建资源，不对任意文件路径做读取；运行后可用 Ctrl+C 退出。"
        },
        {
          "type": "paragraph",
          "text": "CPU 校验实际通过 8 项，覆盖最近秩、非法样本、全滚动范围、总高度、通信尺寸和 App 原文同步。它们证明计算与输入边界，不能代替浏览器执行。浏览器记录单独放在验证文档里，必须连同原始工作负载与环境阅读，不能把示例构建通过叫作滚动性能已经验过。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24 由主代理在 Codex 内置 Chromium 实际运行；工具未公开发行版号，首次导航未主动清缓存。全量与窗口化各得到 119 个回调间隔样本，最终 scrollTop 都是 63680，DOM 行数分别为 2000 和 13；真实 Worker 的 clone 每次发送端仍为 1MiB，transfer 每次发送端为 0、接收端仍为 1MiB。详细短窗口数值与约 607×954 视口记录见验证文档，它们只代表本次运行，不是框架排名。"
        },
        {
          "type": "paragraph",
          "text": "每次至少保存加载次序、缓存政策、浏览器与视口、实现模式、DOM 数、样本数、p50/p95/max、最终 scrollTop、错误和内存支持状态。先确认两实现同样到达终点，再谈分布；遇到页面隐藏、Worker 超时或异常结果，保留失败并重做条件，不把失败样本删掉后继续宣布效果。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-25 修正非整行窗口和能力失败分支后，主代理另在 390×844 手机视口重跑窗口化：119 样本、终点仍为 63680、DOM 末端 13，页面宽 374 与滚动宽相同；站内沙箱也实际编译，缺少独立 HTML 标记时明确 supported=false。新版结果单独保存，不与前一天不同视口的全量数字拼成性能对照；这里的手机视口仍是桌面 Chromium，不能当作 Android/iOS 真机。"
        },
        {
          "type": "paragraph",
          "text": "最终的优化判断应回到产品目标：减少首个有用界面等待、避免滚动时计算阻塞、控制长会话资源，还是减少跨边界数据复制。每次只改变可解释的一项实现，并用相同条件复测。即使当前 Web 例子测量完整，Android/iOS 原生、真实手势、物理 GPU 帧与系统内存仍需独立验收。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "MDN：requestAnimationFrame回调与后台暂停",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame"
    },
    {
      "title": "MDN：performance.memory非标准与精度限制",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory"
    },
    {
      "title": "Flutter：真机与profile模式性能检查",
      "url": "https://docs.flutter.dev/perf/ui-performance"
    },
    {
      "title": "React Native：性能与JS/UI帧率",
      "url": "https://reactnative.dev/docs/performance"
    },
    {
      "title": "MDN：Worker.postMessage与转移所有权",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage"
    },
    {
      "title": "React18.3.1：useLayoutEffect实现入口",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react/src/ReactHooks.js"
    }
  ],
  "examples": [
    {
      "label": "下载完整实验",
      "path": "cross-platform-performance.zip"
    },
    {
      "label": "安装、运行与验收范围",
      "path": "cross-platform-performance/README.md"
    }
  ],
  "experiment": "react"
};
export default article;
