import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "retry-timeout-cancellation",
  "topic": "tasks",
  "title": "重试、超时与取消：退避、预算和失败收敛",
  "description": "把重放安全、单次期限、总预算和父取消连成一条调用链，用真实HTTP失败与丢响应验证重试何时该停。",
  "minutes": 34,
  "labMinutes": 30,
  "tags": [
    "HTTP",
    "重试",
    "超时",
    "取消",
    "退避",
    "幂等"
  ],
  "scope": "单进程Node22客户端与loopback HTTP教学上游；实现有限请求/响应、取消与演示幂等回执，不冒充数据库取消、持久化回执或跨进程可靠执行。",
  "prerequisites": [
    "了解HTTP、异步函数与错误处理",
    "数据库专题需要基本SQL与事务知识"
  ],
  "questionIds": [],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "Node.js22.12.0",
    "HTTP/1.1",
    "macOS14.5 x86_64"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    { "label": "完整源码 ZIP", "path": "retry-timeout-cancellation.zip" },
    {
      "label": "完整隔离实验、测试和运行说明",
      "path": "retry-timeout-cancellation/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "重试、超时、取消分别改变什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "重试是对同一个业务意图再发起一次尝试；超时是在某个期限后不再继续等待；取消是把“不需要继续”的信号传递给正在执行的工作。它们经常一起出现，但没有一个天然能替另外两个完成责任。请求超时了，服务器可能早已提交；调用者停止等待了，上游任务也可能还在占资源。"
        },
        {
          "type": "paragraph",
          "text": "我们实现一个可重试HTTP客户端。正常暂时故障是503两次后恢复；永久输入错误400直接返回；慢请求受总预算限制；用户主动取消后不再重试。最后加入最容易误判的情况：服务端已经增加教学计数，却在响应前断开连接。客户端看到网络错误，是否应该再发一次，取决于业务契约。"
        },
        {
          "type": "paragraph",
          "text": "这不是为所有错误加一个catch再循环。调用方先确定重放是否安全，再限制尝试次数、单次时间、总时间与响应大小。任何一项不受控，都可能让一个小故障放大为重试风暴或无限资源占用。"
        }
      ]
    },
    {
      "id": "safety",
      "title": "先证明重放安全，再讨论退避多少毫秒",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "HTTP把某些方法定义为幂等，但幂等说的是重复请求的意图效果，不是每次返回字节或日志都相同。本文默认仅对GET/HEAD开放重试；POST必须同时显式确认postReplayContract并提供稳定的业务键。该开关表达调用者已经核对服务端契约，不能靠请求里随手加Idempotency-Key就让任意接口变安全。"
        },
        {
          "type": "paragraph",
          "text": "对于转账或创建订单，服务端需要把相同键对应的输入和结果留下；同键同内容返回原结果，同键不同内容拒绝。若第一次已经提交却丢了响应，重放才能查到原结果而不再做一次。只在客户端记录“我发过”，无法证明服务端是否已提交；只在服务器先写完成标志再调用外部接口，也会产生另一种失败窗口。"
        },
        {
          "type": "reference",
          "title": "RFC9110：幂等方法与自动重试的前提",
          "url": "https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods"
        },
        {
          "type": "paragraph",
          "text": "没有确定契约的POST，本客户端最多发送一次。失败后应该保留同一意图标识，查询结果或让上层明确处理不确定状态，而不是换个新键继续冲。取消也不等于撤销：服务端已经提交的效果，不会因为客户端AbortController.abort自动倒退。"
        }
      ]
    },
    {
      "id": "budgets",
      "title": "把时间看成一次调用共享的预算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/retry-timeout-cancellation/budget.svg",
          "title": "单次尝试、总预算与取消的共同边界",
          "alt": "入口先检查重放与父取消，每次尝试受总剩余限制；暂时失败经分类和退避后才下一轮，退避也消耗总预算。",
          "caption": "逻辑决策图，不是时长测量；只有本地合作式上游已实际验证取消后停止。"
        },
        {
          "type": "paragraph",
          "text": "单次超时限制一次请求可以占多久；总预算覆盖从第一次开始到最终结束，包括每次请求、读响应和退避。三次200ms加两次等待，不能声称仍是200ms预算。每轮开始都重新计算剩余时间，实际尝试上限取min(单次上限,总剩余)，没有剩余就不再发起新请求。"
        },
        {
          "type": "paragraph",
          "text": "本例用performance.now计算持续时间，避免系统墙钟调整让剩余预算突然增加。Retry-After若使用HTTP日期，则需要Date.now转换成相对等待；这两个时钟的职责不同。测试可以给纯函数传固定wallNow和remaining做决策验证，但网络预算始终使用真实单调时间和真实计时器。"
        },
        {
          "type": "paragraph",
          "text": "计时器需要事件循环调度，不能抢占正在执行的同步CPU循环。本例还限制响应体最多4096字节，并在返回前再检查总预算；这仍是合作式期限，不是硬实时保证。上游、代理和操作系统的强制终止需要另外安排，不能从一个JS timer推出任意慢任务一定准点停止。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "完整客户端：分类、清理、预算和退避放在同一条路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {setTimeout as pause} from 'node:timers/promises';\nexport class RetryError extends Error {constructor(code){super(code);this.code=code;}}\nexport function retryAfter(value,wallNow=Date.now()) {\n  if(value===null)return 0;\n  if(/^\\d+$/.test(value))return Math.min(Number(value)*1000,86400000);\n  const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-wallNow):0;\n}\nexport function delayFor({attempt,remaining,retryAfterMs=0,random=Math.random}) {\n  const ceiling=Math.min(100,10*2**(attempt-1));\n  const delay=Math.max(Math.floor(random()*ceiling),retryAfterMs);\n  if(delay>=remaining)throw new RetryError('TOTAL_BUDGET');\n  return delay;\n}\nasync function bodyText(response) {\n  const reader=response.body?.getReader();if(!reader)return '';\n  let bytes=0;const chunks=[];\n  try {\n    while(true) {\n      const {value,done}=await reader.read();if(done)break;\n      bytes+=value.byteLength;if(bytes>4096){await reader.cancel();throw new RetryError('RESPONSE_LIMIT');}\n      chunks.push(value);\n    }\n    return Buffer.concat(chunks).toString('utf8');\n  } finally {reader.releaseLock();}\n}\nexport async function requestWithRetry({url,method='GET',body,idempotencyKey,\n  postReplayContract=false,attempts=3,budgetMs=800,attemptMs=200,signal,random=Math.random,onAttempt=()=>{}}) {\n  if(!Number.isSafeInteger(attempts)||attempts<1||attempts>5||\n     !Number.isSafeInteger(budgetMs)||budgetMs<1||budgetMs>10000||\n     !Number.isSafeInteger(attemptMs)||attemptMs<1)throw new RangeError('bounded retry options required');\n  const replayable=['GET','HEAD'].includes(method)||method==='POST'&&postReplayContract===true&&typeof idempotencyKey==='string'&&/^[a-z0-9-]{8,80}$/.test(idempotencyKey);\n  // POST retry is permitted ONLY for the accompanying server's persistent-in-process receipt contract.\n  const limit=replayable?attempts:1;\n  const deadline=performance.now()+budgetMs;\n  for(let attempt=1;attempt<=limit;attempt++) {\n    signal?.throwIfAborted();\n    const remaining=deadline-performance.now();if(remaining<=0)throw new RetryError('TOTAL_BUDGET');\n    const controller=new AbortController();\n    const timer=setTimeout(()=>controller.abort(new RetryError('ATTEMPT_TIMEOUT')),Math.max(1,Math.ceil(Math.min(attemptMs,remaining))));\n    const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;\n    let nextDelay=0;\n    try {\n      onAttempt(attempt);\n      const response=await fetch(url,{method,redirect:'error',signal:combined,\n        headers:{'content-type':'application/json',...(idempotencyKey?{'idempotency-key':idempotencyKey}:{})},\n        ...(body===undefined?{}:{body:JSON.stringify(body)}),\n      });\n      const text=await bodyText(response);\n      if(deadline-performance.now()<=0)throw new RetryError('TOTAL_BUDGET');\n      if(![429,503].includes(response.status))return {status:response.status,text,attempts:attempt};\n      if(attempt===limit)throw new RetryError('ATTEMPTS_EXHAUSTED');\n      nextDelay=retryAfter(response.headers.get('retry-after'));\n    } catch(error) {\n      signal?.throwIfAborted();\n      if(deadline-performance.now()<=0)throw new RetryError('TOTAL_BUDGET');\n      const transient=controller.signal.aborted||error instanceof TypeError&&error.message==='fetch failed';\n      if(!transient)throw error;\n      if(attempt===limit)throw new RetryError(!replayable&&method==='POST'?'RESULT_UNKNOWN':'ATTEMPTS_EXHAUSTED');\n    } finally {clearTimeout(timer);}\n    const delay=delayFor({attempt,remaining:deadline-performance.now(),retryAfterMs:nextDelay,random});\n    try {await pause(delay,undefined,{signal});}\n    catch(error){signal?.throwIfAborted();throw error;}\n  }\n}",
          "language": "js",
          "filename": "examples/retry-timeout-cancellation/client.mjs",
          "purpose": "完整实现：有限次数、明确POST重放契约、单次与总预算、父取消、有限响应、Retry-After和可取消退避。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "requestWithRetry先决定limit。unsafe POST即使传attempts=3，limit仍是1；safe契约开启且键合法时，才允许后续尝试。每轮创建自己的AbortController，与父signal组合。父取消优先向上传播原原因，不被catch误归类成暂时网络错误再发一轮。"
        },
        {
          "type": "paragraph",
          "text": "fetch取得响应头后仍要读取body，所以bodyText也运行在同一attempt signal覆盖下。读取超过4096字节就cancel reader并抛RESPONSE_LIMIT，finally释放reader锁；不会先把任意大正文读完再说超量。真实服务还需要请求大小、连接池和全局在途容量，这个客户端的单次局部限制不能取代它们。"
        },
        {
          "type": "paragraph",
          "text": "HTTP状态仅对429和503进入当前策略的重试候选。400等状态直接交给调用方；状态码之外只把本例fetch failed或单次信号超时当作暂时尝试失败。并非所有TypeError都重试，例如输入错误和响应上限失败应终止。生产要按具体客户端库错误分类，不能到处匹配字符串就称为通用故障诊断。"
        },
        {
          "type": "paragraph",
          "text": "finally清除每次尝试的timer，避免请求成功后仍保留无意义定时器。响应被完整读取或取消后，才计算退避，退避本身也接收父signal。外部工作能否停止，仍由上游合作决定；本例服务器在连接关闭时清理自己的模拟计时器，用真实状态证明这条路径。"
        }
      ]
    },
    {
      "id": "backoff",
      "title": "指数退避和抖动，是为了减少同时再次施压",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "大量调用者同时失败、再同时固定等待一秒，会在下一秒一起冲回上游。指数退避增大等待上限，抖动将这段上限随机打散。它不是修复业务错误的手段，也不应该成为把一次请求拖到无限久的借口。尝试次数与总预算必须同时存在。"
        },
        {
          "type": "paragraph",
          "text": "delayFor的教学上限是10、20、40、80、100ms，随机取上限内的整数；这些数字只是让实验短小，没有生产调优含义。Retry-After表示服务端建议等待的下界，本例取max(抖动等待,Retry-After)。如果等完已经没有预算，就直接返回TOTAL_BUDGET，不把10秒偷偷缩成100ms强行再试。"
        },
        {
          "type": "code",
          "code": "delayFor({attempt:1,remaining:100,random:()=>0.5}); // 5\ndelayFor({attempt:2,remaining:100,random:()=>0.5}); // 10\ndelayFor({attempt:5,remaining:1000,retryAfterMs:200,random:()=>0.5}); // 200\n// remaining=5且Retry-After=5时拒绝，不发起下一轮",
          "language": "js",
          "filename": "纯决策推演",
          "purpose": "函数完整实现已在正文；这里只注入决策输入，不加速或伪造网络时钟。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "退避不能抵消多层叠加重试。如果浏览器重试3次、网关再3次、服务内再3次，底层可能承受远超3次的调用。应让预算沿调用链传播，并确定哪一层负责重放。需要熔断、全局重试额度或队列削峰时也要单独设计，本例没有用一个随机sleep冒充这些能力。"
        }
      ]
    },
    {
      "id": "server",
      "title": "上游必须展示“提交后丢响应”的实际窗口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {createServer} from 'node:http';\nimport {once} from 'node:events';\nexport async function startServer() {\n  const counts=new Map(),receipts=new Map();let effects=0,active=0;\n  let notify;const started=new Promise(resolve=>{notify=resolve;});\n  const sockets=new Set();\n  const server=createServer((req,res)=>{\n    const key=req.url;const count=(counts.get(key)??0)+1;counts.set(key,count);\n    res.setHeader('connection','close');res.setHeader('content-type','application/json');\n    if(key==='/slow') {\n      active++;let complete=false;\n      const finish=()=>{if(!complete){complete=true;active--;}};\n      const timer=setTimeout(()=>{finish();res.end('{\"ok\":true}');},2000);\n      res.once('close',()=>{clearTimeout(timer);finish();});notify();return;\n    }\n    if(key==='/flaky'&&count<3||key==='/always') {res.writeHead(503,{'retry-after':'0'});res.end('{\"error\":\"BUSY\"}');return;}\n    if(key==='/too-late'){res.writeHead(429,{'retry-after':'10'});res.end('{}');return;}\n    if(key==='/bad'){res.writeHead(400);res.end('{}');return;}\n    if(key==='/large'){res.end('x'.repeat(5000));return;}\n    if(key==='/safe'||key==='/unsafe') {\n      const chunks=[];let bytes=0;\n      req.on('data',x=>{bytes+=x.length;if(bytes>1024)req.destroy();else chunks.push(x);});\n      req.on('end',()=>{\n        const value=Buffer.concat(chunks).toString('utf8'),id=req.headers['idempotency-key'];\n        if(key==='/safe'&&(!id||!/^[a-z0-9-]{8,80}$/.test(id))){res.writeHead(422);res.end('{}');return;}\n        if(key==='/safe'&&receipts.has(id)) {\n          const old=receipts.get(id);if(old.input!==value){res.writeHead(409);res.end('{}');return;}\n          res.end(JSON.stringify(old.result));return;\n        }\n        effects++;const result={effect:effects};if(key==='/safe')receipts.set(id,{input:value,result});\n        if(count===1){res.destroy();return;} // Commit happened; response was lost.\n        res.end(JSON.stringify(result));\n      });return;\n    }\n    res.end('{\"ok\":true}');\n  });\n  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});\n  server.listen(0,'127.0.0.1');await once(server,'listening');\n  return {base:`http://127.0.0.1:${server.address().port}`,counts,started,\n    get effects(){return effects;},get active(){return active;},\n    async close(){for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));},\n  };\n}",
          "language": "js",
          "filename": "examples/retry-timeout-cancellation/server.mjs",
          "purpose": "完整本机HTTP上游：503/429/400、慢工作、有限输入，以及safe/unsafe两种提交后丢响应路径。回执仅在当前进程内，不是持久化服务。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "/unsafe先增加effects，第一次调用随后destroy响应。客户端只看到fetch失败，但服务端效果已经存在。测试验证客户端没有自动再发，最终只加一次；这个结果不说明调用者知道成功，而是说明它保留了不确定性，没有凭猜测再产生一次效果。"
        },
        {
          "type": "paragraph",
          "text": "/safe还检查稳定键，把输入原文和结果一起写进当前进程Map。相同键和相同内容重放时返回旧结果，不增加effects；相同键内容不同返回409。这里单进程同步内存操作足以演示丢响应窗口，但进程重启后回执会丢，不能把它称为生产持久化幂等协议。"
        },
        {
          "type": "paragraph",
          "text": "/slow的活动计数在请求到达时增加，响应关闭或正常结束时统一减少并清掉计时器。测试等待实际active>0才发送父取消，随后等待active归零，不用固定睡一秒猜工作已经停。真实数据库驱动或外部服务可能不接受相同取消协议，需要相应集成测试。"
        }
      ]
    },
    {
      "id": "cleanup",
      "title": "取消发生在退避里，也要保留同一个生命周期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "取消不只会发生在fetch期间。上游已返回503，调用方正准备等下一轮时，用户也可能切走页面。这个阶段如果只用普通setTimeout再resolve，取消可能要等整段退避结束才生效。本文的timers/promises等待接收父signal，停止后不会再进入下一轮。"
        },
        {
          "type": "paragraph",
          "text": "测试在delayFor取得随机值的同一条实际失败路径里，排入一个微任务取消父控制器；接着可取消等待立即观察到它。断言错误仍是BACKOFF_CANCELLED，并确认上游调用数量只增加一次。它没有快进网络时间，也没有把“取消函数被调用”当作“没有下一轮请求”的证据。"
        },
        {
          "type": "paragraph",
          "text": "timers/promises可能以AbortError包装取消原因，所以等待的catch再次检查父signal并抛出原reason。这样网络尝试和退避阶段拥有一致的取消原因，而不是一会儿USER_CANCELLED、一会儿只有一个无法辨别的通用错误。跨服务接入时还应把这种分类放进结构化日志，记录尝试号、阶段和剩余预算。"
        },
        {
          "type": "paragraph",
          "text": "无重放契约的POST最多发一次；在父信号未取消、总预算尚未耗尽的网络故障或单次超时分支，本例返回RESULT_UNKNOWN。若总预算先耗尽，返回TOTAL_BUDGET；若父信号取消，保留父reason。这些名字描述客户端为什么停止，不是完整的业务结果状态：只要请求可能已发送，即使错误名是TOTAL_BUDGET或用户取消，服务端效果仍可能已经提交。上层必须另行保留“结果未知”，用同一意图标识查询或人工恢复，不能把某个错误名当成未执行证明，更不能换新键重复扣款。"
        }
      ]
    },
    {
      "id": "evidence",
      "title": "失败分类必须对应可观察结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {setTimeout as pause} from 'node:timers/promises';\nimport {requestWithRetry,retryAfter,delayFor} from './client.mjs';\nimport {startServer} from './server.mjs';\nconst quiet=async server=>{for(let i=0;i<100;i++){if(server.active===0)return;await pause(5);}throw new Error('upstream remained active');};\ntest('pure backoff decisions use supplied budget, do not move network time',()=>{\n  assert.equal(delayFor({attempt:1,remaining:100,random:()=>0.5}),5);\n  assert.equal(delayFor({attempt:2,remaining:100,random:()=>0.5}),10);\n  assert.equal(delayFor({attempt:5,remaining:1000,retryAfterMs:200,random:()=>0.5}),200);\n  assert.throws(()=>delayFor({attempt:1,remaining:5,retryAfterMs:5}),/TOTAL_BUDGET/);\n  assert.equal(retryAfter('2',0),2000);assert.equal(retryAfter('Thu, 01 Jan 1970 00:00:03 GMT',1000),2000);\n});\ntest('real HTTP retries, ambiguity, cancellation and limits',async t=>{\n  const server=await startServer();t.after(()=>server.close());\n  const call=(path,options={})=>requestWithRetry({url:server.base+path,random:()=>0,...options});\n  await t.test('two 503 responses then success, no duplicate extra attempt',async()=>{\n    const result=await call('/flaky');assert.equal(result.status,200);assert.equal(result.attempts,3);assert.equal(server.counts.get('/flaky'),3);\n  });\n  await t.test('permanent status not retried; transient status has finite attempts',async()=>{\n    assert.equal((await call('/bad')).status,400);assert.equal(server.counts.get('/bad'),1);\n    await assert.rejects(call('/always'),/ATTEMPTS_EXHAUSTED/);assert.equal(server.counts.get('/always'),3);\n  });\n  await t.test('Retry-After longer than total budget is not shortened to force retry',async()=>{\n    await assert.rejects(call('/too-late',{budgetMs:100}),/TOTAL_BUDGET/);assert.equal(server.counts.get('/too-late'),1);\n  });\n  await t.test('actual overall budget aborts transport and releases cooperative upstream',async()=>{\n    await assert.rejects(call('/slow',{budgetMs:80,attemptMs:1000}),/TOTAL_BUDGET|ATTEMPTS_EXHAUSTED/);\n    await quiet(server);assert.equal(server.active,0);\n  });\n  await t.test('parent cancellation does not become another retry',async()=>{\n    const controller=new AbortController();\n    const running=call('/slow',{signal:controller.signal,budgetMs:1000,attemptMs:1000});\n    // Wait for a real admitted slow request, not a guessed delay.\n    for(let i=0;i<100&&server.active===0;i++)await pause(5);\n    assert.ok(server.active>0);const before=server.counts.get('/slow');controller.abort(new Error('USER_CANCELLED'));\n    await assert.rejects(running,/USER_CANCELLED/);await quiet(server);assert.equal(server.counts.get('/slow'),before);\n  });\n  await t.test('cancellation during backoff preserves parent reason and sends no next attempt',async()=>{\n    const controller=new AbortController(),before=server.counts.get('/always');\n    await assert.rejects(call('/always',{signal:controller.signal,random:()=>{queueMicrotask(()=>controller.abort(new Error('BACKOFF_CANCELLED')));return 0.5;}}),/BACKOFF_CANCELLED/);\n    assert.equal(server.counts.get('/always'),before+1);\n  });\n  await t.test('ambiguous POST without idempotency contract is sent only once',async()=>{\n    const before=server.effects;\n    await assert.rejects(call('/unsafe',{method:'POST',body:{amount:10}}),/RESULT_UNKNOWN/);\n    assert.equal(server.effects,before+1);assert.equal(server.counts.get('/unsafe'),1);\n  });\n  await t.test('server receipt plus stable key makes lost-response replay return same effect',async()=>{\n    const before=server.effects;\n    const result=await call('/safe',{method:'POST',body:{amount:10},idempotencyKey:'order-key-42',postReplayContract:true});\n    assert.equal(result.status,200);assert.equal(result.attempts,2);assert.equal(server.effects,before+1);\n    const conflict=await call('/safe',{method:'POST',body:{amount:11},idempotencyKey:'order-key-42',postReplayContract:true});assert.equal(conflict.status,409);assert.equal(conflict.attempts,1);\n  });\n  await t.test('response body allocation is bounded; size errors not retried',async()=>{\n    await assert.rejects(call('/large'),/RESPONSE_LIMIT/);assert.equal(server.counts.get('/large'),1);\n  });\n});",
          "language": "js",
          "filename": "examples/retry-timeout-cancellation/test.mjs",
          "purpose": "完整测试：真实503恢复、次数耗尽、Retry-After、总预算、父取消、unsafe POST只发一次、safe丢响应重放和响应上限。",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "输入/故障",
            "实际观察",
            "保护的边界"
          ],
          "rows": [
            [
              "503、503、200",
              "第3次200，计数3",
              "暂时故障有界恢复"
            ],
            [
              "400",
              "一次返回400",
              "永久失败不自动施压"
            ],
            [
              "持续503",
              "3次后ATTEMPTS_EXHAUSTED",
              "不会无限循环"
            ],
            [
              "429 + Retry-After10秒，总预算100ms",
              "一次后TOTAL_BUDGET",
              "不提前违背服务端等待要求"
            ],
            [
              "真实慢请求、父取消",
              "取消异常，无新增尝试，active归零",
              "取消向上传播且本上游合作释放"
            ],
            [
              "POST已提交但响应丢失，无契约",
              "只发1次，效果增加1",
              "不将不确定失败当作未提交"
            ],
            [
              "同故障，服务端回执+稳定键",
              "2次取得原结果，效果只增1",
              "幂等契约而非重试本身保护效果"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "HTTP测试没有把一次计时耗时当作性能收益。预算场景可能因调度先观察到次数耗尽或总预算耗尽，两者都必须终止；真正关键是不无限创建尝试、不在已知预算耗尽后继续发送，以及父取消不被吞掉。对外应稳定区分业务拒绝、上游不可用、用户取消与结果未知，不能全返回“请重试”。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行与把这份代码接入真实系统之前的边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/retry-timeout-cancellation\nnvm use\nnpm ci\nnpm test\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "仅Node22.12.0、无npm第三方依赖、真实loopback临时HTTP端口，不需要Redis或外部服务。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "实际9个HTTP子场景加1个纯决策场景，Node含父测试11项通过。HTTP服务结束会销毁自己创建的socket并停止监听；客户端timer与reader在finally清理。没有付费模型调用、外部支付或公网探测，也没有改变站点运行端口。"
        },
        {
          "type": "paragraph",
          "text": "本例保留少量错误分类和有限重放策略，便于读者逐条推演。生产还需要可取消的真实上游、持久化回执、队列或连接池容量、调用链预算、日志与重试额度；GET语义也取决于服务端真正遵守协议。图形已本机渲染查看，整站及手机浏览器验收单列。"
        },
        {
          "type": "paragraph",
          "text": "可以用一个问题检查实现：第一次POST在服务端提交后断开，客户端catch里“再来一次”究竟保护了谁？如果没有稳定意图、服务端回执和原子结果，就可能重复副作用。先回答这个问题，再调整退避参数，重试才是在收敛故障而不是制造新的故障。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "HTTP语义 RFC9110",
      "url": "https://www.rfc-editor.org/rfc/rfc9110.html"
    },
    {
      "title": "Node22.12 AbortController",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/globals.html#class-abortcontroller"
    },
    {
      "title": "Node22.12 timers promises",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/timers.html#timers-promises-api"
    },
    {
      "title": "Node22.12 HTTP",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/http.html"
    }
  ]
};
export default article;
