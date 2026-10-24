import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "message-delivery",
  "topic": "tasks",
  "title": "消息投递与消费：ACK、重复、顺序和幂等",
  "description": "用真实Redis Streams和退出的Worker观察待确认、重领与重复效果，再把业务回执与结果放进同一个原子边界。",
  "minutes": 32,
  "labMinutes": 30,
  "tags": [
    "Redis Streams",
    "ACK",
    "PEL",
    "幂等",
    "重复投递",
    "顺序"
  ],
  "scope": "固定Redis7.0.4的Streams消费者组；交付单节点投递与幂等计数实验，不把RabbitMQ/Kafka语义混用，也不承诺外部邮件或支付恰好一次。",
  "prerequisites": [
    "了解HTTP、异步函数与错误处理",
    "数据库专题需要基本SQL与事务知识"
  ],
  "questionIds": [],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "Redis server/cli 7.0.4",
    "Node.js22.12.0",
    "macOS14.5 x86_64"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    { "label": "完整源码 ZIP", "path": "message-delivery.zip" },
    {
      "label": "完整隔离实验、测试和运行说明",
      "path": "message-delivery/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "消息是什么：把生产者意图交给独立的处理者",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "消息是生产者交给接收系统的一份数据，通常包含业务事件、标识和处理所需字段。消息代理可以保存并分派这些数据，让生产者与消费者不必在同一请求里同步完成全部工作。但“代理接收了消息”“某个消费者读到消息”“业务结果已落地”是不同的状态，不能用一个发送成功日志代替。"
        },
        {
          "type": "paragraph",
          "text": "本文用订单事件order-42给教学计数增加10。生产者把event和amount写进Redis Stream；一个消费者组workers分配给不同Worker。我们故意让Worker在读取后或产生效果后退出，再观察另一Worker怎样找回工作。结果是计数10还是20，会清楚展示确认与幂等各自承担的责任。"
        },
        {
          "type": "paragraph",
          "text": "实验不需要RabbitMQ或Docker。本机实际安装Redis7.0.4，Streams有追加记录、消费者组和待确认列表。它不同于Redis Pub/Sub的即时广播，也不能照搬另一个broker的ACK、可见性超时或分区语义。后文每条命令和失败推导都限定这个版本与模型。"
        }
      ]
    },
    {
      "id": "identities",
      "title": "先分清Stream ID、业务ID和消费者组进度",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "XADD返回的Stream ID表示流中这一条传输记录，event=order-42表示业务意图。同一个业务事件在发布确认丢失后重发，可能获得另一个Stream ID；因此用传输ID去重，并不一定阻止同一业务效果重复。本例的去重键来自业务event，并比较同ID对应的amount。"
        },
        {
          "type": "paragraph",
          "text": "消费者组维护自己的读取进度。XREADGROUP配合>领取尚未作为新消息交付给该组的记录，正常不带NOACK时，会把它放进该组的PEL，也就是Pending Entries List。PEL记的是已经交付但还没有确认完成的记录及归属，不是另一份业务结果表。其他消费者组有各自的进度和PEL。"
        },
        {
          "type": "code",
          "code": "XGROUP CREATE events workers 0 MKSTREAM\nXADD events * event order-42 amount 10\nXREADGROUP GROUP workers worker-a COUNT 1 STREAMS events >\nXPENDING events workers\nXACK events workers <刚取得的Stream-ID>\nXLEN events",
          "language": "text",
          "filename": "redis-cli命令顺序示意",
          "purpose": "需在本示例新建的56381私有实例中执行，不能把尖括号替换规则当作可直接粘贴的脚本；自动测试提供实际ID传递。",
          "kind": "pseudocode"
        },
        {
          "type": "paragraph",
          "text": "组从0开始，已有记录可以被读取；若组从$开始，则初始位置选择不同。这里不使用NOACK，因为要观察崩溃后的待确认状态。COUNT只限制本次取得多少条，不自动构成整个消费系统的最大在途容量；持续读取不处理，PEL仍会增长。"
        },
        {
          "type": "reference",
          "title": "Redis7.0.4固定命令定义：XREADGROUP",
          "url": "https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xreadgroup.json"
        }
      ]
    },
    {
      "id": "states",
      "title": "ACK只改变交付状态，不替你证明业务效果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/message-delivery/pending.svg",
          "title": "消费者组的待确认与重领",
          "alt": "读后进入PEL；业务结果和回执共同提交；确认前退出需要重领。XACK清该组待确认信息，不删除原流记录。",
          "caption": "本例副作用只是Redis内的计数，不是邮件或支付；进程退出后才用零空闲阈值重领。"
        },
        {
          "type": "paragraph",
          "text": "如果读到就立即XACK，随后处理失败，该组已经没有待确认记录提醒你补做，这会形成丢工作窗口。相反，先完成业务再ACK，确认前崩溃会让消息再次进入处理路径，因此要允许重复。至少一次投递的代价正是消费者必须面对重放；它不意味着每次都只交付一次。"
        },
        {
          "type": "paragraph",
          "text": "XACK的返回1表示本次从该组PEL移除了记录；重复确认同一条返回0。本实验最后XLEN仍是1，说明ACK没有删除流里的原始记录。消息保留、裁剪和其他组的进度需要另外管理。把ACK当作XDEL或把流长度当作未处理任务数，都容易让监控失真。"
        },
        {
          "type": "code",
          "code": "import {redis,apply,firstMessage} from './redis.mjs';\nconst [mode='safe',fault='none']=process.argv.slice(2);\nconst message=firstMessage(await redis('XREADGROUP','GROUP','workers','worker-a','COUNT',1,'STREAMS','events','>'));\nif(!message)throw new Error('NO_MESSAGE');\nif(fault==='after-read')process.exit(23);\nif(fault==='after-ack'){await redis('XACK','events','workers',message[0]);process.exit(23);}\nif(mode==='naive')await redis('INCRBY','naive-balance',10);else await apply(message);\nif(fault==='after-effect')process.exit(23);\nawait redis('XACK','events','workers',message[0]);",
          "language": "js",
          "filename": "examples/message-delivery/worker.mjs",
          "purpose": "完整单次Worker：after-read和after-effect让真实子进程以23退出；正常路径只有效果处理成功后才ACK。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "after-read发生在XREADGROUP已经返回之后，所以测试先确认子进程退出，再检查XPENDING=1。另一个消费者继续用>不会自动取得这条旧pending。恢复者需要处理自己的历史pending或显式重领，而不是永远只读新消息。"
        },
        {
          "type": "reference",
          "title": "Redis官方：XACK移除消费者组待确认信息",
          "url": "https://redis.io/docs/latest/commands/xack/"
        }
      ]
    },
    {
      "id": "reclaim",
      "title": "重领是所有权变化，不是旧处理者已经停止的证明",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "XAUTOCLAIM扫描符合空闲条件的pending并将归属交给新的消费者。Redis7.0的返回值包含下一次扫描游标、取得的记录，以及被清理的已删除记录ID列表；生产扫描不能永远只处理第一次返回的那几条。本文COUNT很小、数据有限，测试确实取得目标ID，不把一次空响应当作PEL完全为空的证据。"
        },
        {
          "type": "code",
          "code": "const reply=await redis('XAUTOCLAIM','events','workers','worker-b',0,'0-0','COUNT',10);\nconst messages=reply[1];\nfor(const message of messages){\n  await apply(message);\n  await redis('XACK','events','workers',message[0]);\n}",
          "language": "js",
          "filename": "受控恢复的调用方",
          "purpose": "redis和apply完整实现下一节给出。这里只在已确认原进程退出的测试中使用min-idle-time=0。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "零空闲阈值使测试无需等待几秒猜测状态，但它不是生产建议。如果旧Worker只是慢，立即重领会让两个Worker同时工作。真实系统应结合最长正常处理时间、心跳、容量和旧执行者隔离来选阈值；仅改变PEL归属，不会撤销旧进程已经发出的邮件或支付。"
        },
        {
          "type": "paragraph",
          "text": "在本实验里，parent等待worker退出码23，明确知道没有原进程继续处理，再重领。这个前提必须和示例一起保留。它证明恢复路径存在，没有证明生产环境可以仅凭一个idle数字判断所有任务都安全可抢。"
        },
        {
          "type": "reference",
          "title": "Redis7.0.4：XAUTOCLAIM定义及7.0返回值变化",
          "url": "https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xautoclaim.json"
        }
      ]
    },
    {
      "id": "idempotency",
      "title": "幂等要保护“业务效果和回执”之间的窗口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "朴素版本先INCRBY增加10，再ACK。进程在两者之间退出后，计数已经是10但PEL还在。恢复者再加10，结果就是20；代理并没有违反投递约定，错的是消费者把重复投递理解成了新意图。"
        },
        {
          "type": "paragraph",
          "text": "正确路径把业务回执与计数放在同一个Hash，用同一次Lua执行先检查event字段。已经有相同amount就返回duplicate；同ID不同amount报冲突；新事件计算新计数，再用一条HSET同时存回执与结果。不是先SETNX成功就对外发邮件，因为外部动作不在这个原子边界里。"
        },
        {
          "type": "code",
          "code": "import { execFile,spawn } from 'node:child_process';\nimport { promisify } from 'node:util';\nimport { mkdtemp,rm } from 'node:fs/promises';\nimport { tmpdir } from 'node:os';\nimport { join } from 'node:path';\nconst execute=promisify(execFile);\nexport const port=56381;\nexport async function redis(...args) {\n  const {stdout}=await execute(process.env.REDIS_CLI||'redis-cli',['--json','-h','127.0.0.1','-p',String(port),...args.map(String)],{timeout:5000,maxBuffer:1024*1024});\n  if(args[0]==='INFO')return stdout; // redis-cli 7 emits INFO as plain text even with --json.\n  try {return JSON.parse(stdout);}catch {throw new Error('Redis command failed: '+stdout.trim());}\n}\nexport async function withRedis(run) {\n  const directory=await mkdtemp(join(tmpdir(),'atlas-streams-'));\n  let child;\n  async function start() {\n    let logs='';\n    child=spawn(process.env.REDIS_SERVER||'redis-server',['--bind','127.0.0.1','--port',String(port),'--protected-mode','yes','--dir',directory,'--save','','--appendonly','yes','--appendfsync','always'],{stdio:['ignore','pipe','pipe']});\n    child.stdout.on('data',x=>{logs+=x;});child.stderr.on('data',x=>{logs+=x;});\n    let failed;child.once('error',error=>{failed=error;});\n    const deadline=Date.now()+5000;\n    while(!logs.includes('Ready to accept connections')) {\n      if(failed)throw failed;\n      if(child.exitCode!==null||Date.now()>=deadline)throw new Error('Private Redis did not start: '+logs);\n      await new Promise(resolve=>setTimeout(resolve,10));\n    }\n    const info=await redis('INFO','server');\n    if(!info.includes('redis_version:7.0.4'))throw new Error('Lab verified with Redis 7.0.4; got '+info.split('\\r\\n').find(x=>x.startsWith('redis_version:')));\n  }\n  async function stop() {\n    if(child&&child.exitCode===null) {\n      const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;\n    }\n  }\n  try {await start();await run({restart:async()=>{await stop();await start();}});}\n  finally {await stop();await rm(directory,{recursive:true,force:true});}\n}\nexport async function apply(message) {\n  const [id,fields]=message,values=Object.fromEntries(Array.from({length:fields.length/2},(_,i)=>[fields[i*2],fields[i*2+1]]));\n  if(!/^[a-z0-9-]{1,40}$/.test(values.event)||!/^\\d{1,6}$/.test(values.amount))throw new Error('BAD_EVENT');\n  const result=await redis('EVAL',`\n    local receipt='event:'..ARGV[1]\n    local old=redis.call('HGET',KEYS[1],receipt)\n    local balance=tonumber(redis.call('HGET',KEYS[1],'balance') or '0')\n    if not balance then return redis.error_reply('BAD_BALANCE') end\n    if old then\n      if old~=ARGV[2] then return redis.error_reply('IDEMPOTENCY_CONFLICT') end\n      return {'duplicate',tostring(balance)}\n    end\n    local next=balance+tonumber(ARGV[2])\n    redis.call('HSET',KEYS[1],receipt,ARGV[2],'balance',tostring(next))\n    return {'applied',tostring(next)}\n  `,1,'consumer-state',values.event,values.amount);\n  return {id,result};\n}\nexport function firstMessage(reply){return reply ? (Array.isArray(reply)?reply[0]?.[1]?.[0]:Object.values(reply)[0]?.[0])??null : null;}",
          "language": "js",
          "filename": "examples/message-delivery/redis.mjs",
          "purpose": "完整运行辅助与关键apply函数：只连接56381私有实例，真实CLI命令和原子回执逻辑都在此；INFO是CLI7的特例文本响应。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "脚本执行期间不会被其他Redis命令穿插，但Lua脚本不是通用可回滚事务：发生错误不意味着此前写入自动撤销。本例先校验格式和当前计数，再以同一HSET写回执与计数，避免“先写完成标志，后面失败”的窗口。金额字段实际是小整数教学计数，Lua数值精度不适合无限增长的金融账务。"
        },
        {
          "type": "paragraph",
          "text": "同业务ID、不同amount不会被直接忽略。它可能代表生产者错误复用ID或数据被不当修改，应作为冲突保留待排查。回执保留时间也要覆盖可能重投的时间范围；删掉回执后再重放历史消息，副作用仍会发生，不能宣称去重能力永久存在。"
        },
        {
          "type": "reference",
          "title": "Redis官方：Lua执行原子性及阻塞边界",
          "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/"
        }
      ]
    },
    {
      "id": "order",
      "title": "记录有顺序，为什么效果还会乱序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Stream里的记录按ID排列，多个消费者却可以同时处理不同记录。测试让a领取first，b领取second，再明确先执行b的业务效果，后执行a，完成顺序是second、first。没有网络故障也能发生这种情况。读取有序，不等于跨消费者执行完成有序。"
        },
        {
          "type": "paragraph",
          "text": "当前计数加法可以交换顺序，所以最后仍为3。如果业务是“创建账户，再冻结账户”，逆序可能使第二步找不到对象。需要按同一实体串行、在消费者检查版本，或设计能接受乱序并等待补齐的状态机；不能只因broker记录有序就省掉这个决定。"
        },
        {
          "type": "paragraph",
          "text": "保持全局严格顺序会降低并发。更常见的是先确定业务到底要求哪个范围有序，例如同一订单或账户，而不是所有用户共用一个串行Worker。本篇只证明乱序可发生，不交付分区路由、全局排序或跨节点消费调度。"
        }
      ]
    },
    {
      "id": "observing",
      "title": "交付语义要指向哪一份结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "至多一次、至少一次和恰好一次，最好都加上对象再使用。先ACK再做事，可能只执行零次，换来的是消费者组不再提醒；先做事再ACK，可能执行多次，需要回执。所谓业务效果一次，是在具体原子边界和去重期限内成立，不等于网络上传输记录只有一条。"
        },
        {
          "type": "paragraph",
          "text": "新增反例会在读取后先ACK，再让进程退出，结果PEL为0、重领为空、业务计数不存在，而XLEN仍为1。原流记录还在，并不代表恢复者能通过普通pending流程自动找到它。运维若只看流长度，既无法区分这次漏做，也无法确认前面的重复已经收敛。"
        },
        {
          "type": "paragraph",
          "text": "可以把观测分成三组：代理的Stream ID与PEL状态，业务的event与内容，消费者的处理结果/回执。一次事件需要把这些值关联起来。只记录“消费成功”而没有事件ID，重投后很难知道是重复、另一个意图，还是回执已经被误清理。"
        },
        {
          "type": "paragraph",
          "text": "本例的计数和回执一起保存在Redis，两个Worker并发处理同event也经过同一原子脚本，故障点可以在进程退出后继续检验。真实业务若迁到PostgreSQL，就应重新建立本库唯一回执与业务写入事务；拿Redis里一个成功标记跨过去，并不能保护另一个数据库的写入。"
        }
      ]
    },
    {
      "id": "persistence",
      "title": "代理确认以后，数据还依赖什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "临时Redis启用AOF和appendfsync=always，并在测试中正常停止再启动，验证pending、回执和计数能恢复。这比只在同一进程里重读一遍更强，但它仍不是断电、磁盘损坏或主从切换的证明。持久化、复制确认和故障转移是独立的可靠性条件。"
        },
        {
          "type": "paragraph",
          "text": "本机所有连接只指向新建实例56381，不使用6379。启动辅助先等自己启动的进程明确输出Ready，再检查版本，不会因为端口已被别的服务占着就连接过去FLUSHDB。测试只清自己的临时实例，结束SIGTERM停止并删除自己创建的AOF目录。"
        },
        {
          "type": "paragraph",
          "text": "生产还要限制流长度、消费在途量、重领批次和单条消息大小，观察PEL年龄、投递次数、成功吞吐与冲突数量。毒消息无限重试会消耗恢复能力，应该有明确隔离与人工处理流程。本例冲突保留pending，不把它偷偷ACK，也没有伪称已经实现死信队列。"
        },
        {
          "type": "reference",
          "title": "Redis官方：AOF和RDB持久化的不同保证",
          "url": "https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/"
        }
      ]
    },
    {
      "id": "verify",
      "title": "从命令运行到正常、重复与恢复的证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {execFile} from 'node:child_process';\nimport {promisify} from 'node:util';\nimport {withRedis,redis,apply,firstMessage} from './redis.mjs';\nconst execute=promisify(execFile);\nasync function worker(mode,fault) {\n  try {await execute(process.execPath,['worker.mjs',mode,fault],{cwd:import.meta.dirname,timeout:5000});return 0;}\n  catch(error){assert.equal(error.code,23);return error.code;}\n}\nasync function reset() {await redis('FLUSHDB');await redis('XGROUP','CREATE','events','workers','0','MKSTREAM');}\nasync function add(event='order-42',amount=10){return redis('XADD','events','*','event',event,'amount',amount);}\nasync function claim(){const response=await redis('XAUTOCLAIM','events','workers','worker-b',0,'0-0','COUNT',10);return response[1];}\ntest('real Redis Streams delivery boundaries',async t=>withRedis(async cluster=>{\n  await t.test('read is not ACK; a stopped process leaves pending work',async()=>{\n    await reset();const id=await add();assert.equal(await worker('safe','after-read'),23);\n    assert.equal((await redis('XPENDING','events','workers'))[0],1);\n    assert.equal(firstMessage(await redis('XREADGROUP','GROUP','workers','worker-b','COUNT',1,'STREAMS','events','>')),null);\n    const [reclaimed]=await claim();assert.equal(reclaimed[0],id);\n    await apply(reclaimed);assert.equal(await redis('XACK','events','workers',id),1);\n    assert.equal(await redis('XACK','events','workers',id),0);\n    assert.equal((await redis('XPENDING','events','workers'))[0],0);\n    assert.equal(await redis('XLEN','events'),1);\n  });\n  await t.test('ACK before the effect loses the group recovery signal',async()=>{\n    await reset();await add();await worker('safe','after-ack');\n    assert.equal((await redis('XPENDING','events','workers'))[0],0);\n    assert.deepEqual(await claim(),[]);\n    assert.equal(await redis('HGET','consumer-state','balance'),null);\n    assert.equal(await redis('XLEN','events'),1);\n  });\n  await t.test('effect before ACK can happen twice without business idempotency',async()=>{\n    await reset();await add();await worker('naive','after-effect');\n    const [again]=await claim();await redis('INCRBY','naive-balance',10);await redis('XACK','events','workers',again[0]);\n    assert.equal(await redis('GET','naive-balance'),'20');\n  });\n  await t.test('atomic receipt and effect survive repeated delivery and AOF restart',async()=>{\n    await reset();await add();await worker('safe','after-effect');\n    assert.equal((await redis('XPENDING','events','workers'))[0],1);\n    await cluster.restart();\n    const [again]=await claim();assert.equal((await apply(again)).result[0],'duplicate');\n    await redis('XACK','events','workers',again[0]);\n    const other=await add();const message=firstMessage(await redis('XREADGROUP','GROUP','workers','worker-b','STREAMS','events','>'));\n    assert.equal(message[0],other);assert.equal((await apply(message)).result[0],'duplicate');\n    await redis('XACK','events','workers',other);\n    assert.equal(await redis('HGET','consumer-state','balance'),'10');\n    assert.equal((await redis('XPENDING','events','workers'))[0],0);\n  });\n  await t.test('same business ID with changed content remains pending as conflict',async()=>{\n    await add('order-42',99);const message=firstMessage(await redis('XREADGROUP','GROUP','workers','worker-b','STREAMS','events','>'));\n    await assert.rejects(apply(message),/IDEMPOTENCY_CONFLICT/);\n    assert.equal((await redis('XPENDING','events','workers'))[0],1);\n    assert.equal(await redis('HGET','consumer-state','balance'),'10');\n  });\n  await t.test('delivery order does not imply completion order across consumers',async()=>{\n    await reset();await add('first',1);await add('second',2);\n    const a=firstMessage(await redis('XREADGROUP','GROUP','workers','a','COUNT',1,'STREAMS','events','>'));\n    const b=firstMessage(await redis('XREADGROUP','GROUP','workers','b','COUNT',1,'STREAMS','events','>'));\n    const completed=[];await apply(b);completed.push('second');await apply(a);completed.push('first');\n    assert.deepEqual(completed,['second','first']);\n    assert.equal(await redis('HGET','consumer-state','balance'),'3');\n  });\n}));",
          "language": "js",
          "filename": "examples/message-delivery/test.mjs",
          "purpose": "完整六个场景：真实进程退出、PEL、ACK、朴素重复、安全去重、AOF重启、冲突和乱序。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "cd examples/message-delivery\nnvm use\nnpm ci\nredis-server --version\nredis-cli --version\nnpm test\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "固定Redis server/cli7.0.4，Node22.12.0；无npm第三方依赖，只用56381私有实例，不能和Outbox实验同时启动。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "六个子场景全部通过，Node含父测试7项。朴素效果最终20，原子回执版本在重领和第二次发布后仍10；ACK后PEL为0但流记录仍在；冲突不改变计数，跨消费者完成顺序可以反转。没有用测试总时长推导生产性能。"
        },
        {
          "type": "paragraph",
          "text": "图形是可编辑逻辑图，发布前应检查站点实际渲染和手机视口；当前作者记录只覆盖本机SVG查看。没有验证RabbitMQ、Kafka、Redis集群、复制切换、Linux或外部副作用。要跨到消费者数据库，就需要把回执与本库写入放在真正数据库事务中，这正是Outbox配套章节接下来的边界。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Redis7 XREADGROUP",
      "url": "https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xreadgroup.json"
    },
    {
      "title": "Redis7 XAUTOCLAIM",
      "url": "https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xautoclaim.json"
    },
    {
      "title": "XACK",
      "url": "https://redis.io/docs/latest/commands/xack/"
    },
    {
      "title": "Lua",
      "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/"
    },
    {
      "title": "Redis7配置",
      "url": "https://raw.githubusercontent.com/redis/redis/7.0.4/redis.conf"
    }
  ]
};
export default article;
