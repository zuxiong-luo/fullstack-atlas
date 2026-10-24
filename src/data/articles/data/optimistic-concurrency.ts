import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "optimistic-concurrency",
  "topic": "data",
  "title": "乐观并发控制：版本号、条件更新、唯一约束与幂等写入",
  "description": "用两个真实连接读取同一版本，区分丢更新、条件修改和唯一仲裁；交付与库存效果同事务的幂等回执，验证等待、冲突、回滚及丢响应重放。",
  "scope": "用两个真实连接读取同一版本，区分丢更新、条件修改和唯一仲裁；交付与库存效果同事务的幂等回执，验证等待、冲突、回滚及丢响应重放。 教学数据在独立PostgreSQL17实例；不连接用户5432，不将本机测试当生产容量或高可用证明。",
  "minutes": 58,
  "tags": [
    "乐观锁",
    "CAS",
    "版本号",
    "唯一约束",
    "幂等回执"
  ],
  "prerequisites": [
    "会写SELECT/INSERT/UPDATE与基础事务",
    "理解数据库约束和版本的含义；不要求熟记执行计划名称"
  ],
  "versions": [
    "PostgreSQL 17.4",
    "Node.js 22.12.0",
    "pg 8.13.1"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "verifiedAt": "2026-10-24",
  "labMinutes": 35,
  "examples": [
    {
      "label": "完整示例ZIP",
      "path": "optimistic-concurrency.zip"
    },
    {
      "label": "运行与验证边界",
      "path": "optimistic-concurrency/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "concept",
      "title": "乐观并发控制是什么：允许先工作，提交时确认依据没过期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "乐观并发控制是一种冲突处理方法：多个调用者可以先读取和计算，但真正写入时必须检查此前依据是否仍有效。常见做法是保存版本号，UPDATE时同时匹配id与旧版本，只有一方成功后再递增版本。它减少了用户编辑期间长期持锁的需要，却没有消除冲突，也不保证数据库内部完全不使用锁。"
        },
        {
          "type": "paragraph",
          "text": "我们先用文档展示丢更新：A、B都读取同一版本，各自修改后写回，后写者若无条件覆盖就抹掉先写者的意图。然后转到库存预留：两次相同请求可能来自重复点击，也可能是服务端已提交但响应丢失。版本检查防止基于旧值覆盖，幂等回执识别同一业务意图，二者解决的问题不能互换。"
        },
        {
          "type": "paragraph",
          "text": "本文用独立PostgreSQL17.4与真实pg连接，SQLSTATE和业务冲突分别记录。所有故障钩子只在本地测试控制先后，不是给远端用户调用的接口。租户授权由前文处理，这里只演示约定租户内的并发与回执，不声称知道租户ID就有权扣库存。"
        }
      ]
    },
    {
      "id": "lost-update",
      "title": "每条UPDATE原子，不代表读改写组合不会丢意图",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "假设文档正文为counter=0。A读取0，B也读取0；A计算1并UPDATE，B按自己旧快照也计算1并UPDATE，最终仍是1。每条UPDATE都完整执行了，没有半条语句穿插，却丢了“两次加一”的业务意图。把它叫成数据库没加锁，会让排查方向走偏：数据库可以串行执行两次相同的新值赋值，结果仍然是1。"
        },
        {
          "type": "code",
          "filename": "examples/optimistic-concurrency/test.mjs",
          "language": "javascript",
          "code": "  await t.test('unconditional stale replacement loses intent even though each statement is atomic',async()=>{await pool.query(\"UPDATE documents SET body='counter=0' WHERE id='note'\");const beforeA=(await a.query(\"SELECT body FROM documents WHERE id='note'\")).rows[0].body,beforeB=(await b.query(\"SELECT body FROM documents WHERE id='note'\")).rows[0].body;const number=text=>Number(text.split('=')[1]);await a.query(\"UPDATE documents SET body=$1 WHERE id='note'\",['counter='+(number(beforeA)+1)]);await b.query(\"UPDATE documents SET body=$1 WHERE id='note'\",['counter='+(number(beforeB)+1)]);assert.equal((await pool.query(\"SELECT body FROM documents WHERE id='note'\")).rows[0].body,'counter=1');});",
          "purpose": "完整反例：两连接先分别读旧值，再顺序写各自算出的新值，确定性得到counter=1，不靠竞争概率。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "若业务本来是累加，可以直接用UPDATE…SET counter=counter+1让计算基于数据库当前行；若业务是编辑一段整体内容，则不能替用户随意合并，版本冲突更合适。选择机制之前先确定业务意图是增量、替换、转移还是一次性外部动作，不是见到并发就套一个分布式锁。"
        }
      ]
    },
    {
      "id": "cas",
      "title": "版本号必须进入产生效果的条件更新",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/optimistic-concurrency/schema.sql",
          "language": "sql",
          "code": "CREATE TABLE documents(id text PRIMARY KEY,body text NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0));\nINSERT INTO documents VALUES('note','initial',1);",
          "purpose": "文档版本非空且为正，初始版本1。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "filename": "examples/optimistic-concurrency/service.mjs",
          "language": "javascript",
          "code": "export class Conflict extends Error{constructor(code){super(code);this.code=code;}}\nexport async function saveDocument(db,{id,expectedVersion,body}){\n if(typeof id!=='string'||!Number.isSafeInteger(expectedVersion)||expectedVersion<1||typeof body!=='string'||body.length>200)throw new RangeError('invalid document update');\n const {rows}=await db.query('UPDATE documents SET body=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING id,body,version',[body,id,expectedVersion]);\n if(rows.length!==1)throw new Conflict('STALE_OR_MISSING');return rows[0];\n}",
          "purpose": "完整CAS保存：旧版本只作为WHERE条件，版本递增与正文改变在同一UPDATE；影响行数为0时不伪称保存成功。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "A、B都拿到version=1。若A先成功，行变version=2；B再执行WHERE version=1就匹配不到，不会覆盖A。测试让两连接先读完同一版本，再并行保存，断言恰好一个成功、一个STALE_OR_MISSING，最终版本2。这里名字包含missing，因为不额外查询时零行既可能是冲突，也可能是对象不存在；是否细分应结合权限与产品体验。"
        },
        {
          "type": "paragraph",
          "text": "冲突后通常应重新读取、显示差异或让业务决定是否重算。盲目把expectedVersion改成新版本再覆盖，等于把并发检查绕开了。另一个常见错误是在SELECT里检查版本，UPDATE仍只按id，这又回到检查与效果分离的窗口。版本比较与修改必须是一条受控原子语句。"
        },
        {
          "type": "paragraph",
          "text": "版本是用于比较的单调变更标识，不一定是时间戳。时钟回拨、精度碰撞和多个进程的时间来源会让“修改时间相同”不足以表达未变化。本例integer版本有数值上限，长期系统需选择足够范围并处理溢出；不能认为加一永远不会失败。"
        }
      ]
    },
    {
      "id": "unique",
      "title": "唯一约束是并发仲裁点，不是只给前端做重复提示",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/optimistic-concurrency/schema.sql",
          "language": "sql",
          "code": "CREATE TABLE inventory(tenant_id text NOT NULL,product_id text NOT NULL,stock integer NOT NULL CHECK(stock>=0),PRIMARY KEY(tenant_id,product_id));\nCREATE TABLE receipts(tenant_id text NOT NULL,request_id text NOT NULL,payload jsonb NOT NULL,result jsonb,PRIMARY KEY(tenant_id,request_id));\nINSERT INTO inventory VALUES('red','p1',5),('blue','p1',5);",
          "purpose": "库存与幂等回执表，回执键按租户和请求ID唯一；payload保存意图，result保存提交后的可重放结果。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "请求先SELECT看是否存在、没有再INSERT，两个事务仍可能同时看到没有。唯一约束让数据库对这个冲突做最终仲裁。INSERT…ON CONFLICT DO NOTHING RETURNING的返回行表示本事务是否实际建立了回执，不是要求所有调用者猜谁更快。遇到另一个未提交的同键事务，插入可能等待其提交或回滚。"
        },
        {
          "type": "paragraph",
          "text": "我们用真实等待证据控制实验：第一个事务插入回执后在屏障停住，第二个相同键开始，观察pg_blocking_pids确认它确实被阻塞，才释放第一个提交。第二个随后发现自己没有插入，读取已提交的回执并返回同一结果。不是睡50毫秒再假设它“应该在等”，也不是把两个先后调用当并发证明。"
        },
        {
          "type": "paragraph",
          "text": "这个读取使用PostgreSQL默认READ COMMITTED的新语句快照：ON CONFLICT可能由于另一个事务的行放弃插入，随后的SELECT才读取它已提交的结果。更换隔离级别需要重新验证可见性与失败处理；不能把本例推理直接套到固定快照的事务。"
        }
      ]
    },
    {
      "id": "receipt",
      "title": "同一意图只产生一个效果：回执与库存必须一起提交",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/optimistic-concurrency/service.mjs",
          "language": "javascript",
          "code": "const key=/^[a-z0-9-]{1,40}$/;\nexport async function reserve(db,{tenant,requestId,productId,quantity},hooks={}){\n if(typeof tenant!=='string'||typeof requestId!=='string'||typeof productId!=='string'||!key.test(tenant)||!key.test(requestId)||!key.test(productId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100)throw new RangeError('invalid reservation');\n const payload={productId,quantity};let committed=false;\n await db.query('BEGIN');\n try{\n  const claimed=await db.query('INSERT INTO receipts(tenant_id,request_id,payload) VALUES($1,$2,$3) ON CONFLICT (tenant_id,request_id) DO NOTHING RETURNING request_id',[tenant,requestId,payload]);\n  if(!claimed.rowCount){\n   const receipt=await db.query('SELECT payload=$3::jsonb AS same,result FROM receipts WHERE tenant_id=$1 AND request_id=$2',[tenant,requestId,payload]);\n   if(!receipt.rowCount||!receipt.rows[0].same)throw new Conflict('IDEMPOTENCY_CONFLICT');\n   if(!receipt.rows[0].result)throw new Conflict('INCOMPLETE_RECEIPT');\n   await db.query('COMMIT');committed=true;return {replayed:true,result:receipt.rows[0].result};\n  }\n  await hooks.afterClaim?.(); // Controlled fault/barrier for the teaching test, not a remote callback.\n  const changed=await db.query('UPDATE inventory SET stock=stock-$1 WHERE tenant_id=$2 AND product_id=$3 AND stock>=$1 RETURNING stock',[quantity,tenant,productId]);\n  if(!changed.rowCount)throw new Conflict('INSUFFICIENT_OR_MISSING');\n  await hooks.afterEffect?.();\n  const result={productId,quantity,remaining:changed.rows[0].stock};\n  await db.query('UPDATE receipts SET result=$1 WHERE tenant_id=$2 AND request_id=$3',[result,tenant,requestId]);\n  await db.query('COMMIT');committed=true;\n  await hooks.afterCommit?.();\n  return {replayed:false,result};\n }catch(error){if(!committed)await db.query('ROLLBACK');throw error;}\n}",
          "purpose": "完整预留实现：有界输入、唯一claim、载荷比较、条件扣库存、保存回执、提交/回滚与受控故障点，所有决定性步骤在正文。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "新请求的事务先建立回执占位，再按stock>=quantity扣库存，把结果写回同一回执，最后一起COMMIT。失败时库存与占位一起回滚，所以重试不会撞上一条其实没有效果却被误当成功的记录。result允许占位期间为空，但服务函数不会在这个状态提交；该约定依赖所有写路径都走此协议，任意SQL人工写入不在保证范围内，读到异常空回执会明确报错。"
        },
        {
          "type": "paragraph",
          "text": "重复请求只有键相同还不够，还要确认意图相同。本例payload为productId与quantity，存为JSONB并做等价比较。相同key但quantity变了返回IDEMPOTENCY_CONFLICT，不覆盖旧回执、不再扣库存。请求ID按租户隔离，同一个短ID在red与blue是两个独立命名空间；服务端还要确认调用者能访问对应租户，不能靠请求ID本身保密。"
        },
        {
          "type": "paragraph",
          "text": "幂等键应稳定代表一次业务意图；每次网络重试都生成新键，就会被当成多次不同请求。反过来，用户确实想再买一次却沿用旧键，也只会得到旧结果。键保留时间、请求规范化、回执清理与可重试窗口必须一起约定，不能只加一个请求头就宣称接口幂等。"
        }
      ]
    },
    {
      "id": "unknown",
      "title": "提交前失败与提交后丢响应，恢复动作完全不同",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "在afterEffect抛出受控异常时，还没提交，库存与回执一起回滚，测试确认库存不变、没有残留占位。afterCommit抛RESULT_UNKNOWN时，数据库已经完成，但调用者没拿到结果；此时不能再ROLLBACK假装撤销，也不能换键重新扣一次。用同一键重放，读到回执并返回原结果，库存只减少一次。"
        },
        {
          "type": "code",
          "filename": "examples/optimistic-concurrency/test.mjs",
          "language": "javascript",
          "code": "  await t.test('failure before commit rolls back receipt and stock together',async()=>{const request={tenant:'red',requestId:'rollback-intent',productId:'p1',quantity:1};await assert.rejects(reserve(a,request,{afterEffect(){throw new Error('controlled failure');}}),/controlled failure/);assert.equal((await pool.query(\"SELECT stock FROM inventory WHERE tenant_id='red' AND product_id='p1'\")).rows[0].stock,4);assert.equal((await pool.query(\"SELECT * FROM receipts WHERE request_id='rollback-intent'\")).rowCount,0);});\n  await t.test('lost response after commit recovers through same receipt without repeating debit',async()=>{const request={tenant:'red',requestId:'lost-response',productId:'p1',quantity:1};await assert.rejects(reserve(a,request,{afterCommit(){throw new Error('RESULT_UNKNOWN');}}),/RESULT_UNKNOWN/);const retried=await reserve(b,request);assert.equal(retried.replayed,true);assert.equal(retried.result.remaining,3);assert.equal((await pool.query(\"SELECT stock FROM inventory WHERE tenant_id='red' AND product_id='p1'\")).rows[0].stock,3);});",
          "purpose": "提交前回滚与提交后丢响应的真实SQL断言；故障由同步钩子准确插入，不模拟未知的网络时序。",
          "kind": "excerpt"
        },
        {
          "type": "figure",
          "src": "figures/optimistic-concurrency/mechanism.svg",
          "title": "版本冲突与幂等回执各守住一条边界",
          "alt": "上方两个编辑者同读v1，条件更新恰好一胜；下方同键请求在唯一索引仲裁，库存与回执同事务，提交后丢响应通过同键读回",
          "caption": "上方两个编辑者同读v1，条件更新恰好一胜；下方同键请求在唯一索引仲裁，库存与回执同事务，提交后丢响应通过同键读回。箭头表示逻辑关系/受控先后，不代表比例耗时或跨系统原子事务。"
        },
        {
          "type": "paragraph",
          "text": "真实网络中，COMMIT本身报连接错误也可能存在结果未知：客户端不一定知道服务端在断开前是否完成。代码committed标记只区分本地已经收到提交成功的测试路径，不是整个网络协议的判定器。正式恢复仍要在新连接按同一意图查询回执，并处理数据库暂不可达；不能把catch里发了ROLLBACK当成“肯定没提交”。"
        }
      ]
    },
    {
      "id": "inventory",
      "title": "不同请求争最后一件：业务条件也必须在UPDATE里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "幂等只合并同一意图；两个不同请求ID仍是两个正常买家。库存只剩1，各要1，实际UPDATE…WHERE stock>=1使最多一个成功；另一个影响0行并回滚自己的回执。测试两连接并行执行，最终库存0、成功一份、失败一份且只留一条成功回执。CHECK(stock>=0)是兜底，条件谓词给出可解释的业务失败。"
        },
        {
          "type": "paragraph",
          "text": "这里没有预先SELECT FOR UPDATE，也不表示没有锁。PostgreSQL更新同一行仍会协调并发，后来的语句在READ COMMITTED下按更新后的版本重新判断条件。乐观指的是应用选择先尝试条件写、失败再处理冲突，不是宣称底层完全无等待。高冲突场景可能频繁失败，适合排队、短锁或重新设计热点。"
        },
        {
          "type": "paragraph",
          "text": "缺商品与库存不足在本例合成INSUFFICIENT_OR_MISSING，避免额外查读造成又一轮时序判断；产品需要区分时可在已授权边界设计更明确结果。SQLSTATE40001或40P01是另一种事务失败，不应与版本零行混成同一无条件重试循环；前面的锁与隔离文章提供完整事务重试边界。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行并解释每一类结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端 · 清洁复现",
          "language": "bash",
          "kind": "runnable",
          "purpose": "解压ZIP进入目录，Node22.12及PostgreSQL17二进制可用后运行，应8项通过。",
          "code": "cd optimistic-concurrency\nnpm ci --ignore-scripts\nnpm test\n# tests 8; pass 8; fail 0\n# 自定义PG路径可用 PG_BIN=/your/pg17/bin npm test"
        },
        {
          "type": "paragraph",
          "text": "实际macOS14.5、PostgreSQL17.4、Node22.12.0、pg8.13.1通过8项测试：CAS一胜、确定性丢更新反例、唯一键实际等待、载荷冲突/租户范围、提交前回滚、提交后同键恢复和最后库存竞争。默认私有socket编号55446，所有连接在finally归还并关闭，实例随后清理。"
        },
        {
          "type": "paragraph",
          "text": "这些用例证明的是本地数据库事务与函数协议，不证明支付网关、邮件或第三方设备的效果也在同一个事务里。把外部调用塞在库存事务中，连接断开也未必能撤销外部效果；应结合Outbox、下游幂等或结果查询。我们没有把一次测试通过叫作跨系统恰好一次。"
        },
        {
          "type": "paragraph",
          "text": "把这三类问题分开，恢复才不会乱：旧版本修改要处理冲突，相同意图重放要读回执，不同意图争资源要检查业务条件。每一类都在真正产生效果的语句或事务中守住边界，再给上层明确结果，比在接口外层简单套retry更可靠。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：READ COMMITTED更新与ON CONFLICT",
          "url": "https://www.postgresql.org/docs/17/transaction-iso.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：INSERT ON CONFLICT",
          "url": "https://www.postgresql.org/docs/17/sql-insert.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：唯一性检查",
          "url": "https://www.postgresql.org/docs/17/index-unique-checks.html",
          "note": ""
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PostgreSQL17：READ COMMITTED更新与ON CONFLICT",
      "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
    },
    {
      "title": "PostgreSQL17：INSERT ON CONFLICT",
      "url": "https://www.postgresql.org/docs/17/sql-insert.html"
    },
    {
      "title": "PostgreSQL17：唯一性检查",
      "url": "https://www.postgresql.org/docs/17/index-unique-checks.html"
    }
  ]
};
export default article;
