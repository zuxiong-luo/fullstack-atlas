import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "cache-consistency",
  "topic": "data",
  "title": "数据库与缓存一致性：失效、并发回填和更新顺序",
  "description": "用真实PostgreSQL与私有Redis复现更新后删除仍被旧读回填的窗口；实现代际校验发布、持久失效意图和故障恢复，明确最终修复与强一致读取的区别。",
  "scope": "用真实PostgreSQL与私有Redis复现更新后删除仍被旧读回填的窗口；实现代际校验发布、持久失效意图和故障恢复，明确最终修复与强一致读取的区别。 教学数据在独立PostgreSQL17实例；不连接用户5432，不将本机测试当生产容量或高可用证明。",
  "minutes": 58,
  "tags": [
    "缓存一致性",
    "旧回填",
    "代际令牌",
    "Outbox",
    "Redis"
  ],
  "prerequisites": [
    "会写SELECT/INSERT/UPDATE与基础事务",
    "理解数据库约束和版本的含义；不要求熟记执行计划名称"
  ],
  "versions": [
    "PostgreSQL 17.4",
    "Node.js 22.12.0",
    "pg 8.13.1",
    "Redis 7.0.4"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "verifiedAt": "2026-10-24",
  "labMinutes": 35,
  "examples": [
    {
      "label": "完整示例ZIP",
      "path": "cache-consistency.zip"
    },
    {
      "label": "运行与验证边界",
      "path": "cache-consistency/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "数据库与缓存的一致性，先说明谁是事实来源",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "缓存保存可以重新获取的数据副本，用较低读取成本换取额外的更新与失效协议。数据库与Redis是两个独立系统，普通数据库事务不会自动把Redis命令包含进去。所以“一致性”不能只说一个词：我们需要说明什么时候可能读到旧值，故障后靠什么修复，以及哪些请求必须绕过缓存得到数据库当前已提交状态。"
        },
        {
          "type": "paragraph",
          "text": "本文使用一项有tenant、id、body、version的记录。数据库是事实来源，缓存采用cache-aside：先查Redis，未命中再读库并回填；修改先提交数据库，再使副本失效。我们先复现这个常见顺序仍然出错，再加代际令牌限制旧加载发布，最后把失效意图与业务修改一起写入数据库，处理Redis真正不可用的情况。"
        },
        {
          "type": "paragraph",
          "text": "这里不承诺线性一致缓存。提交数据库到应用失效之间，已有缓存仍可能被命中；Redis故障、失效积压和持续并发更新也有各自边界。对资金、权限撤销等必须按权威事实决策的请求，应设计直接读库或更强的协议，不能因为缓存值带了version字段就自动取得强一致性。"
        }
      ]
    },
    {
      "id": "race",
      "title": "更新后删除为什么仍可能被旧回填覆盖",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/cache-consistency/schema.sql",
          "language": "sql",
          "code": "CREATE TABLE items(tenant_id text NOT NULL,id text NOT NULL,body text NOT NULL,version integer NOT NULL CHECK(version>0),PRIMARY KEY(tenant_id,id));\nCREATE TABLE invalidations(event_id bigserial PRIMARY KEY,tenant_id text NOT NULL,item_id text NOT NULL,version integer NOT NULL,applied boolean NOT NULL DEFAULT false);\nINSERT INTO items VALUES('red','naive','v1',1),('red','fenced','v1',1),('red','failure','v1',1),('red','eviction','v1',1),('red','duplicate','v1',1),('blue','naive','blue-only',1);",
          "purpose": "真实数据库记录与持久失效意图表。每篇演示用独立记录，避免用其他测试的缓存状态碰巧通过。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "filename": "examples/cache-consistency/service.mjs",
          "language": "javascript",
          "code": "import {randomUUID} from 'node:crypto';import {redis} from './redis.mjs';\nconst part=/^[a-z0-9-]{1,40}$/;\nexport function cacheKey(tenant,id){if(typeof tenant!=='string'||typeof id!=='string'||!part.test(tenant)||!part.test(id))throw new RangeError('bad identity');return `cache:{${tenant}:${id}}`;}\nexport async function databaseRead(db,tenant,id){\n const {rows}=await db.query('SELECT tenant_id,id,body,version FROM items WHERE tenant_id=$1 AND id=$2',[tenant,id]);\n if(rows.length!==1)throw new Error('NOT_FOUND');return rows[0];\n}\nexport async function naiveRead(db,tenant,id,afterLoad=()=>{}){\n const key=cacheKey(tenant,id),old=await redis('HGET',key,'value');if(old)return JSON.parse(old);\n const item=await databaseRead(db,tenant,id);await afterLoad(item);\n await redis('HSET',key,'value',JSON.stringify(item));return item;\n}",
          "purpose": "缓存键、权威读取与刻意错误的naiveRead。租户维度进入键；naive版本只用于复现晚到旧值，不可作为生产读取器。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "初始数据库v1，缓存为空。读者R查库得到v1，但在写Redis前停住；写者W把数据库提交成v2，随后删除缓存；R恢复，把先前读到的v1写回。此后即使W已经完成删除，其他读者仍命中v1。问题不是“删除没成功”，而是删除之后又来了一个基于旧快照的发布。"
        },
        {
          "type": "paragraph",
          "text": "测试把R停在afterLoad屏障，确定W提交并执行DEL后才释放，最终直接断言缓存v1、数据库v2。它不需要两线程随机抢先，也不拿睡眠时间模拟网速。先把这个失败顺序说准确，才能看出修复需要约束回填资格，而不只是重复背“先写库再删缓存”。"
        }
      ]
    },
    {
      "id": "generation",
      "title": "代际令牌：加载前取得资格，发布时确认没有失效",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/cache-consistency/service.mjs",
          "language": "javascript",
          "code": "const prepareLua=`\n local generation=redis.call('HGET',KEYS[1],'generation')\n if not generation then\n  generation=ARGV[1];redis.call('HDEL',KEYS[1],'value');redis.call('HSET',KEYS[1],'generation',generation);redis.call('EXPIRE',KEYS[1],60)\n end\n return {generation,redis.call('HGET',KEYS[1],'value') or false}\n`;\nconst publishLua=`\n if redis.call('HGET',KEYS[1],'generation')~=ARGV[1] then return 0 end\n redis.call('HSET',KEYS[1],'value',ARGV[2]);redis.call('EXPIRE',KEYS[1],60);return 1\n`;\nexport async function invalidate(tenant,id){\n return redis('EVAL',`redis.call('HSET',KEYS[1],'generation',ARGV[1]);redis.call('HDEL',KEYS[1],'value');redis.call('EXPIRE',KEYS[1],60);return ARGV[1]`,1,cacheKey(tenant,id),randomUUID());\n}",
          "purpose": "完整代际读取、条件发布与失效Lua。每次失效换随机新令牌并删值；缺失代际时清理孤立旧值，不默认接受。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "每个缓存键是一个Hash，保存generation与可选value。读者在查数据库前取得当前代际g；写者失效时原子地把代际换成新值并删除value；读者回填时只有仍等于g才允许发布。检查和写入在同一Lua执行中，避免先GET比较、再HSET之间又被失效穿过。"
        },
        {
          "type": "paragraph",
          "text": "代际使用随机UUID，不是版本大小比较；它只表示“还是不是我开始时的那一代”。整键被驱逐或重启丢失时，新读者创建新随机令牌，旧发布者不能因为计数重新回到0而再次合法。这避免简单清零计数器的ABA问题，依赖随机标识碰撞可忽略的工程假设，不是持久单调fencing编号，也不负责给不同数据库写入排序。"
        },
        {
          "type": "paragraph",
          "text": "缺失generation但残留value时不能给它补一个新代际后立即当命中，否则迁移或坏数据会被无条件接纳。prepare先删这种孤立值，再创建代际。值与令牌放在同一个键，一起设置60秒过期；超时或整键丢失会导致旧发布被拒绝，不能让未匹配的读者直接重建value。"
        }
      ]
    },
    {
      "id": "read",
      "title": "被拒绝的回填怎么恢复：有限重读，不无限追赶写入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/cache-consistency/service.mjs",
          "language": "javascript",
          "code": "function decode(text,tenant,id){\n try{const value=JSON.parse(text);if(value.tenant_id===tenant&&value.id===id&&typeof value.body==='string'&&Number.isSafeInteger(value.version)&&value.version>0)return value;}catch{}\n return null;\n}\nexport async function readThrough(db,tenant,id,hooks={}){\n const key=cacheKey(tenant,id);\n for(let attempt=0;attempt<2;attempt++){\n  let generation,cached;\n  try{[generation,cached]=await redis('EVAL',prepareLua,1,key,randomUUID());}\n  catch{return {source:'database',item:await databaseRead(db,tenant,id),stored:false};}\n  const hit=cached&&decode(cached,tenant,id);if(hit)return {source:'cache',item:hit,stored:true};\n  const item=await databaseRead(db,tenant,id);await hooks.afterLoad?.(item,attempt);\n  try{if(await redis('EVAL',publishLua,1,key,generation,JSON.stringify(item)))return {source:'database',item,stored:true};}\n  catch{return {source:'database',item,stored:false};}\n }\n return {source:'database',item:await databaseRead(db,tenant,id),stored:false};\n}",
          "purpose": "完整安全读取：验证缓存身份与版本，最多两轮代际尝试；Redis不可达转库，持续冲突则返回一次未缓存数据库读取。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "若回填发现代际变了，直接返回旧item会让我们刚刚检测到的冲突失去意义。本例最多重新读两轮；受控测试中R第一次拿到v1，W提交v2并失效，R发布失败，再读取v2后成功缓存。持续写入时不无限循环，最后从数据库读一次并且不缓存，避免为了追赶不断变化的代际耗尽请求预算。"
        },
        {
          "type": "paragraph",
          "text": "Redis读取或发布报错时也不把数据库当失败：读取路径降级查库或返回本次已取得的数据库快照，stored=false说明没有确认缓存发布。数据库快照仍只代表这次查询的已提交可见性，不承诺在响应到达客户端前绝无其他修改。生产还需总预算、连接池与限流，避免缓存故障把所有流量同时压回数据库；本例未实现完整降级容量控制。"
        },
        {
          "type": "paragraph",
          "text": "缓存值还要校验tenant、id、body与正整数version。不属于目标租户的内容被当未命中，而不是直接返回。键含租户维度，不能用同一个id覆盖不同组织；这仍不能替代服务端身份和权限，尤其权限敏感缓存不应把公开与私有读取随意共用。本例只更新已存在记录；数据库删除、负缓存和关联列表缓存，还要分别定义结果及失效范围，没有在这里假装覆盖。"
        }
      ]
    },
    {
      "id": "outbox",
      "title": "Redis没收到失效怎么办：先持久记录“需要失效”",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/cache-consistency/service.mjs",
          "language": "javascript",
          "code": "export async function updateDatabase(db,tenant,id,body,hooks={}){\n cacheKey(tenant,id);if(typeof body!=='string'||body.length>200)throw new RangeError('bad body');\n await db.query('BEGIN');\n try{\n  const {rows}=await db.query('UPDATE items SET body=$1,version=version+1 WHERE tenant_id=$2 AND id=$3 RETURNING version',[body,tenant,id]);\n  if(!rows.length)throw new Error('NOT_FOUND');\n  const event=await db.query('INSERT INTO invalidations(tenant_id,item_id,version) VALUES($1,$2,$3) RETURNING event_id',[tenant,id,rows[0].version]);\n  await hooks.beforeCommit?.();await db.query('COMMIT');return event.rows[0].event_id;\n }catch(error){await db.query('ROLLBACK');throw error;}\n}",
          "purpose": "数据库修改与失效意图在同一事务：业务更新、版本递增、插入invalidations、提交；受控异常会一起回滚。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "只在数据库提交后调用一次DEL，遇到Redis不可达或进程崩溃，就可能永久丢失这次失效动作。我们把tenant、item、version写入invalidations，与业务记录同事务提交。之后中继可以扫描pending行，执行Redis失效，再标记applied。它是Outbox思路在缓存上的窄应用：保存的是可重试失效意图，不是把Redis变成数据库事务的一部分。"
        },
        {
          "type": "code",
          "filename": "examples/cache-consistency/service.mjs",
          "language": "javascript",
          "code": "export async function drain(db,hooks={}){\n const {rows}=await db.query('SELECT * FROM invalidations WHERE applied=false ORDER BY event_id');\n for(const event of rows){\n  await invalidate(event.tenant_id,event.item_id);\n  await hooks.afterInvalidate?.(event);\n  await db.query('UPDATE invalidations SET applied=true WHERE event_id=$1',[event.event_id]);\n }\n return rows.length;\n}",
          "purpose": "完整中继：先失效，再标记。可能重复执行；每次调用invalidate都产生新代际，不能用同一个事件ID重复赋值导致旧资格重新有效。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "若失效成功后还没标记就崩溃，重放会再次失效，最多多一次缓存淘汰，不重新产生业务更新。本例每次invalidate都生成新UUID，不能把事件ID当作反复写回的代际：读者在上一次同ID失效后开始，再发生同ID重复赋值，若代际不变就可能让该读者错误地跨过新失效。"
        },
        {
          "type": "paragraph",
          "text": "中继按事件ID顺序扫描只是本地实现选择，不保证所有部署下全局顺序。旧失效晚于新失效只会多删除一次，不会把旧值写回，因此本文不需要靠事件版本给缓存写旧内容。生产多worker要进一步控制扫描负载、重试预算和事件清理；这里允许重复失效，不把单进程循环称为完整消息平台。"
        }
      ]
    },
    {
      "id": "failure",
      "title": "真实故障与恢复：提交、发送和应用各有证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "测试先缓存failure/v1，真正停止自己创建的Redis56382进程，再把数据库更新成v2和pending事件。中继实际连接失败，事件仍在，读取器降级返回数据库v2、stored=false。随后启动同一个私有Redis并重放pending，失效后读取v2。它不是把适配器改成返回成功的模拟测试，也没有连接用户6379。"
        },
        {
          "type": "code",
          "filename": "examples/cache-consistency/test.mjs",
          "language": "javascript",
          "code": "  await t.test('database commit and durable invalidation remain when Redis really stops',async()=>{await readThrough(reader,'red','failure');await cache.stop();await updateDatabase(writer,'red','failure','v2');await assert.rejects(drain(writer));assert.equal((await databaseRead(reader,'red','failure')).version,2);assert.equal((await pool.query(\"SELECT * FROM invalidations WHERE item_id='failure' AND applied=false\")).rowCount,1);const fallback=await readThrough(reader,'red','failure');assert.equal(fallback.item.version,2);assert.equal(fallback.stored,false);await cache.start();assert.ok(await drain(writer)>=1);assert.equal((await readThrough(reader,'red','failure')).item.version,2);});\n  await t.test('crash window after invalidation before marking can replay safely with a new generation',async()=>{await updateDatabase(writer,'red','duplicate','v2');await assert.rejects(drain(writer,{afterInvalidate(){throw new Error('controlled relay crash');}}),/controlled relay crash/);const key=cacheKey('red','duplicate'),first=await redis('HGET',key,'generation');await drain(writer);const second=await redis('HGET',key,'generation');assert.notEqual(first,second);assert.equal((await readThrough(reader,'red','duplicate')).item.version,2);});",
          "purpose": "真实Redis停止/恢复，以及失效后未标记的受控崩溃窗口。两个用例分别检查pending持久记录和新代际重放。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "另一个实验在R加载后删除整个缓存键，再由新读者创建代际并加载v2，最后释放旧R；旧发布被拒绝，R重读得到v2。DEL模拟的是整键丢失，不是冒称真实TTL到期测试。数据库事务中beforeCommit异常则让业务值和失效意图一起回滚，不会留下一个声称需要传播却从未提交的业务修改。"
        },
        {
          "type": "figure",
          "src": "figures/cache-consistency/mechanism.svg",
          "title": "失效要约束旧发布，也要能在故障后重新送达",
          "alt": "读者加载v1时持有g1；写者提交v2与Outbox后失效成g2；旧g1回填被拒绝；Redis故障时pending保留，恢复后可重放，但提交到失效之间仍可能读旧缓存",
          "caption": "读者加载v1时持有g1；写者提交v2与Outbox后失效成g2；旧g1回填被拒绝；Redis故障时pending保留，恢复后可重放，但提交到失效之间仍可能读旧缓存。箭头表示逻辑关系/受控先后，不代表比例耗时或跨系统原子事务。"
        },
        {
          "type": "paragraph",
          "text": "Lua的原子执行只保证Redis内这些步骤不被其他命令穿插，不是数据库与Redis的两阶段提交，也不代表Lua出错能像SQL事务一样回滚此前所有写。脚本保持短小，先检查资格再修改。我们没有运行集群故障切换、主从复制延迟或磁盘损坏测试，因此不从本机重启推广出高可用保证。"
        }
      ]
    },
    {
      "id": "promises",
      "title": "能承诺什么，不能靠TTL或双删含糊带过",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本方案的具体承诺是：发生已应用的失效后，持有旧代际的加载不能再发布；数据库成功提交时有持久失效意图，在中继最终恢复并成功处理、写入暂时稳定的条件下，可清除过期副本。它不是“所有读永远最新”：数据库提交到中继应用前，旧命中仍可能出现；持续更新也可能让读取降级为未缓存快照。"
        },
        {
          "type": "paragraph",
          "text": "TTL是清理与缓解机制，不能代替可靠失效，也不能未经证明直接写“最多旧60秒”。读者延迟加载、重试、服务暂停和发布时重置过期都会影响陈旧窗口。延迟双删同样需要对并发时序与延迟上界作假设；没有这种保证时，睡几秒再删不是严格正确性的证明。"
        },
        {
          "type": "paragraph",
          "text": "如果业务需要更强承诺，可以按需求选择权威读取、条件版本验证、同步等待失效确认或改变数据所有权，但每个选择都有延迟与可用性代价。先写下读者允许看见什么，再决定缓存层能否介入，比在代码完成后给它贴“最终一致”标签更可验证。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行与验证：故障路径必须能重复",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端 · 清洁复现",
          "language": "bash",
          "kind": "runnable",
          "purpose": "解压ZIP进入目录，Node22.12及PostgreSQL17二进制可用后运行，应7项通过。另外需要redis-server/redis-cli7.0.4。",
          "code": "cd cache-consistency\nnpm ci --ignore-scripts\nnpm test\n# tests 7; pass 7; fail 0\n# 自定义PG路径可用 PG_BIN=/your/pg17/bin npm test"
        },
        {
          "type": "paragraph",
          "text": "macOS14.5、PostgreSQL17.4、Redis/redis-cli7.0.4、Node22.12.0、pg8.13.1实际通过7项测试，含6组场景与父测试：旧回填反例、代际修复、真实Redis故障与降级、重复失效、整键丢失及DB回滚/租户校验。PG使用私有socket55447，Redis只用自建56382和临时目录，结束自动清理。"
        },
        {
          "type": "paragraph",
          "text": "夹具Redis采用本地AOF以便重启观察，不据此声称应用已经验收持久高可用缓存。测试屏障控制加载、提交和发布，固定等待只用于观察自有进程就绪，不用睡眠猜竞争顺序。示例无真实用户或付费服务，离线包能带走代码，但仍需本地安装PG与Redis运行。"
        },
        {
          "type": "paragraph",
          "text": "你现在可以用三问检查自己的缓存：旧加载有什么资格写回？这次失效丢了从哪里补？客户端读到的版本到底承诺什么？若其中一个只能回答“通常很快”，就还缺少一个可描述、可复现的边界。本文的代码与失败用例提供的是这三问的一组具体答案。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：事务隔离",
          "url": "https://www.postgresql.org/docs/17/transaction-iso.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "Redis：Lua原子执行",
          "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/",
          "note": ""
        },
        {
          "type": "reference",
          "title": "Redis7.0.4源码：脚本执行",
          "url": "https://github.com/redis/redis/blob/7.0.4/src/eval.c",
          "note": ""
        },
        {
          "type": "reference",
          "title": "Redis：EXPIRE",
          "url": "https://redis.io/docs/latest/commands/expire/",
          "note": ""
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PostgreSQL17：事务隔离",
      "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
    },
    {
      "title": "Redis：Lua原子执行",
      "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/"
    },
    {
      "title": "Redis7.0.4源码：脚本执行",
      "url": "https://github.com/redis/redis/blob/7.0.4/src/eval.c"
    },
    {
      "title": "Redis：EXPIRE",
      "url": "https://redis.io/docs/latest/commands/expire/"
    }
  ]
};
export default article;
