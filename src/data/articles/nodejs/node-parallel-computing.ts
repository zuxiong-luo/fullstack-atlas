import type {Article} from '../../articleTypes';
const article:Article={
  "id": "node-parallel-computing",
  "topic": "nodejs",
  "title": "Node.js 并行计算：Worker、进程池与通信边界",
  "description": "用同一份有界计算池分别驱动Worker线程和fork进程，验证准入、排队、取消、超时、崩溃替换与关闭；再实际比较ArrayBuffer转移与进程IPC复制，不靠耗时猜并行。",
  "minutes": 60,
  "labMinutes": 40,
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
          "text": "macOS14.5/Node22.12.0已通过13项真实线程/进程测试并实际运行demo。没有把线程池写成内存模拟器，也没有以短样本耗时宣称某种模式更快。CLI、容量和生命周期已验证；Linux、容器CPU配额、native扩展与生产吞吐未验证。此队列只在本进程内，主进程退出就丢失，不能替代前面可靠异步系统中的持久任务与回执协议。"
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
