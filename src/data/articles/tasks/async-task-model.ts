import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "async-task-model",
  "title": "异步任务模型：请求、队列、Worker 与持久化边界",
  "topic": "tasks",
  "description": "用真实 API/Worker 子进程与 PostgreSQL 队列，区分202、事务提交和任务完成，复现响应丢失、进程退出与容量竞争。",
  "minutes": 38,
  "tags": [
    "异步任务",
    "PostgreSQL",
    "可靠性"
  ],
  "scope": "从单个教学身份的持久化任务模型开始；纯计算、真实本地HTTP和进程故障，不声称自动租约恢复、FIFO或外部副作用只执行一次。",
  "prerequisites": [
    "HTTP 请求与响应",
    "Promise 与进程的区别",
    "SQL 事务基础"
  ],
  "sections": [
    {
      "id": "concept",
      "title": "1. 异步任务是什么：把请求寿命和工作寿命分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "异步任务是一份可以在当前请求结束后继续处理的工作记录。它至少包含输入、身份、当前状态，以及查询最终结果的方式。这里的“异步”描述的是业务交付过程：调用方先得到任务凭证，执行方之后完成工作。JavaScript 函数前面的 async 只决定它返回 Promise；如果工作仍然只存在于这个 HTTP 进程的内存里，进程退出后，Promise 并不会替你保管任务。"
        },
        {
          "type": "paragraph",
          "text": "它的作用是把需要持续很久、容易失败或需要独立调度的工作，从一次连接里搬出来。你可以先确认收到导出请求，再让 Worker 生成文件，客户端通过任务 ID 查询进度。代价也很具体：原本一个成功或失败的函数调用，变成了接受、排队、执行、结果查询等多个阶段，每个阶段都需要清楚的承诺。"
        },
        {
          "type": "paragraph",
          "text": "本文先实现最小的持久化任务模型，再主动展示它还缺少什么。任务只做字符串转大写，另有一个受控失败模式。选择简单计算，是为了把注意力放在任务状态和进程边界上；我们不会把一次字符串计算实验，推导成支付、邮件或第三方模型调用“只执行一次”的证明。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "2. 先列三项承诺：接受、持久化、完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "请求校验通过，只说明格式和当前权限允许接收。任务事务提交，说明这份工作记录进入了本实验数据库的持久化边界。Worker 写下 succeeded，才说明本次教学计算得到结果。这三个时点不能互相代替。尤其不要在任务刚入队时向用户显示“导出成功”：此时连 Worker 是否启动都还不知道。"
        },
        {
          "type": "paragraph",
          "text": "HTTP 202 适合表达“已接受，尚未完成”。它自身不保证数据库一定保存，也不保证最终成功；这些是应用需要额外建立的契约。我们的契约收窄为：只有 COMMIT 成功返回后才发送 202，响应包含任务 ID 和当时状态；客户端用 GET /jobs/:id 查询。为了方便核对，演示返回 JSON，不实现轮询 UI、推送或下载成品。"
        },
        {
          "type": "paragraph",
          "text": "重复提交不一定仍处于排队阶段。相同 key 找回 queued 或 running 时返回 202；如果原任务已 succeeded 或 failed，则返回 200 并携带终态，避免用“尚未完成”的状态码表达一个已完成资源。HTTP 成功取回任务不代表业务必然成功，failed 仍是需要读取的任务结果。"
        },
        {
          "type": "table",
          "headers": [
            "时点",
            "本实验已经确认",
            "仍未确认"
          ],
          "rows": [
            [
              "输入校验后",
              "字段和教学身份合法",
              "任务已保存"
            ],
            [
              "提交后、202 前",
              "任务记录已提交",
              "客户端收到凭证、计算成功"
            ],
            [
              "202 queued",
              "服务给出查询身份",
              "Worker 已处理"
            ],
            [
              "succeeded",
              "纯计算结果已保存",
              "任何外部副作用的一次性"
            ]
          ]
        },
        {
          "type": "reference",
          "title": "RFC 9110 §15.3.3：202 Accepted",
          "url": "https://www.rfc-editor.org/rfc/rfc9110.html#name-202-accepted"
        }
      ]
    },
    {
      "id": "structure",
      "title": "3. 结构与状态：API、数据库队列、Worker 各管一段",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "API 负责验证、申请容量、保存输入和返回任务身份。数据库同时保存队列和结果；这里没有另接消息代理，因此不存在数据库提交与 broker 发布两份写入的缺口。Worker 是另一个 Node 进程，拿到任务后独立计算。它不引用 API 的请求对象，也不依赖 API 继续在线。"
        },
        {
          "type": "paragraph",
          "text": "状态采用 queued → running → succeeded/failed。数据库 CHECK 把每个状态允许的数据形状固定下来：排队时不能带 Worker，运行时必须有持有者，成功时必须有结果，失败时必须有错误码。CHECK 能禁止错误形状，却不会自动禁止所有错误迁移；哪些角色可以把 queued 改成 running，仍由操作语句及数据库权限决定。"
        },
        {
          "type": "code",
          "filename": "examples/async-task-model/schema.sql",
          "language": "sql",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "CREATE TABLE jobs(\n id uuid PRIMARY KEY,request_key text NOT NULL UNIQUE,payload jsonb NOT NULL,\n status text NOT NULL CHECK(status IN('queued','running','succeeded','failed')),\n worker_id uuid,result text,error_code text,\n CHECK(jsonb_typeof(payload)='object'),\n CHECK(\n  (status='queued' AND worker_id IS NULL AND result IS NULL AND error_code IS NULL) OR\n  (status='running' AND worker_id IS NOT NULL AND result IS NULL AND error_code IS NULL) OR\n  (status='succeeded' AND worker_id IS NOT NULL AND result IS NOT NULL AND error_code IS NULL) OR\n  (status='failed' AND worker_id IS NOT NULL AND result IS NULL AND error_code IS NOT NULL)\n )\n);"
        },
        {
          "type": "figure",
          "src": "figures/async-task-model/mechanism.svg",
          "title": "请求结束后，任务由谁负责",
          "alt": "API 在提交后返回202，独立 Worker 抢占数据库中的queued记录并提交终态；提交前和提交后各有一个响应丢失故障点。",
          "caption": "所有状态都是数据库记录；HTTP 响应只是其中一个观察窗口。图中的提交前/后故障在实验里由真实子进程退出触发。"
        }
      ]
    },
    {
      "id": "admission",
      "title": "4. 接受工作：用同一事务绑定输入、身份和容量",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先看 accept 的完整关键路径。requestKey 代表一次业务意图，相同 key 和相同输入可以取回同一任务；相同 key 配不同输入返回冲突。它不是任意请求的全局去重魔法。实际产品还要加入租户或用户维度，并规定凭证保留多久。本实验只有一个共享教学身份和一个队列，所以 key 的作用域也是整个夹具。"
        },
        {
          "type": "paragraph",
          "text": "容量判断不能写成两个互不协调的步骤：“先数出 7 条，再插入一条”。两个请求都看到 7，就可能一起插入。这里用事务级 advisory lock 串行化所有接收事务，把查旧 key、统计活跃任务和插入放在锁内。它要求所有接收入口遵守同一个协议；绕过函数直接 INSERT，自然能绕过应用容量限制。"
        },
        {
          "type": "code",
          "filename": "examples/async-task-model/jobs.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "export async function accept(db,requestKey,payload,hooks={}){\n if(typeof requestKey!=='string'||!/^[a-z0-9-]{1,64}$/.test(requestKey))throw new JobError('BAD_KEY');\n const input=validate(payload);let committed=false;\n await db.query('BEGIN');\n try{\n  // One bounded teaching queue; serialize admission/counting in this database.\n  await db.query('SELECT pg_advisory_xact_lock(55448)');\n  const existing=await db.query('SELECT id,payload=$2::jsonb AS same,status FROM jobs WHERE request_key=$1',[requestKey,input]);\n  if(existing.rowCount){if(!existing.rows[0].same)throw new JobError('KEY_CONFLICT');await db.query('COMMIT');committed=true;return {id:existing.rows[0].id,status:existing.rows[0].status,replayed:true};}\n  const active=(await db.query(\"SELECT count(*)::int n FROM jobs WHERE status IN('queued','running')\")).rows[0].n;\n  if(active>=8)throw new JobError('QUEUE_FULL');\n  const id=randomUUID();\n  await db.query(\"INSERT INTO jobs(id,request_key,payload,status) VALUES($1,$2,$3,'queued')\",[id,requestKey,input]);\n  await hooks.beforeCommit?.();await db.query('COMMIT');committed=true;\n  await hooks.afterCommit?.();return {id,status:'queued',replayed:false};\n }catch(error){if(!committed)await db.query('ROLLBACK');throw error;}\n}"
        },
        {
          "type": "paragraph",
          "text": "queued 加 running 达到 8 就拒绝新的意图，但先查已有 key：客户端重取凭证不应该消耗新名额。8 是便于测试的上限，不是容量建议。这个粗粒度锁也意味着接收有串行瓶颈；锁内不做远程 I/O，故障钩子只在测试中暂停。生产中需要按队列分片、锁等待预算或独立的配额记录，不能把这个小实验当成高吞吐方案。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：事务级 advisory locks",
          "url": "https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS"
        }
      ]
    },
    {
      "id": "claim",
      "title": "5. 领取工作：短事务锁住选择，不把计算放进事务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "claim 先选择一条 queued 记录，用行锁保护选择与状态修改，再提交 running。若两个消费者都先普通 SELECT 再 UPDATE，它们可能选择同一任务；FOR UPDATE 把这两个动作连接起来。SKIP LOCKED 让另一个消费者跳过已被锁定的行，不必为这一条等待。它适合队列表，但不是获得完整、一致业务视图的查询方式。"
        },
        {
          "type": "code",
          "filename": "examples/async-task-model/jobs.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "export async function claim(db,workerId){\n await db.query('BEGIN');\n try{\n  const {rows}=await db.query(\"SELECT id,payload FROM jobs WHERE status='queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1\");\n  if(!rows.length){await db.query('COMMIT');return null;}\n  await db.query(\"UPDATE jobs SET status='running',worker_id=$1 WHERE id=$2\",[workerId,rows[0].id]);\n  await db.query('COMMIT');return rows[0];\n }catch(error){await db.query('ROLLBACK');throw error;}\n}"
        },
        {
          "type": "paragraph",
          "text": "事务提交后行锁就释放了。持续的所有权来自 running 和 worker_id，而不是那把还存在着的数据库行锁。计算必须在短事务外进行，否则慢任务会长期占连接和锁。示例按随机 UUID 的字典序领取，只为了得到确定的选择顺序，并没有 FIFO 承诺；如果要求业务顺序，需要单独的序列、分区和前序完成约束。"
        },
        {
          "type": "paragraph",
          "text": "测试实际开启两条连接：第一条锁住唯一 queued 行且不提交，另一条调用 claim 得到 null；第一条回滚后，同一条任务可以被领取。null 只说明这一次查询没拿到任务，不能据此宣布整个系统永久空闲。常驻 Worker 的等待、唤醒和公平性是额外的调度设计，本实验使用一次领取后退出的子进程。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：SELECT 锁定子句与 SKIP LOCKED",
          "url": "https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE"
        }
      ]
    },
    {
      "id": "completion",
      "title": "6. 完成工作：状态修改也要验证持有者",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "execute 处理的输入是已经保存的 payload，仍会再次校验，避免存量坏数据进入计算。mode=upper 保存大写文本；mode=fail 进入可预测的失败分支。失败信息压成 PROCESSING_FAILED，而不是把堆栈、数据库配置或输入秘密原样返回给用户。接受失败与执行失败有不同接口语义：前者是 POST 的错误，后者是任务资源的终态。"
        },
        {
          "type": "code",
          "filename": "examples/async-task-model/jobs.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "export async function execute(db,job,workerId){\n let result=null,error=null;\n try{const input=validate(job.payload);if(input.mode==='fail')throw new Error('controlled processing failure');result=input.text.toUpperCase();}\n catch{error='PROCESSING_FAILED';}\n const status=error?'failed':'succeeded';\n const changed=await db.query(\"UPDATE jobs SET status=$1,result=$2,error_code=$3 WHERE id=$4 AND worker_id=$5 AND status='running' RETURNING id\",[status,result,error,job.id,workerId]);\n if(changed.rowCount!==1)throw new JobError('OWNERSHIP_LOST');return status;\n}"
        },
        {
          "type": "paragraph",
          "text": "最后的 UPDATE 同时检查 ID、worker_id 和 running。假如任务已经被明确转移给别的 Worker，旧持有者不能覆盖新的结果。rowCount 不等于 1 是所有权丢失，需要停止当前提交。这个条件只保护这里这张结果表；如果旧进程已经向外部系统发出邮件，数据库拒绝它写结果，也不能收回邮件。外部副作用要由业务幂等、Outbox 或资源端 fencing 继续保护。"
        },
        {
          "type": "paragraph",
          "text": "注意 succeeded 的含义由任务定义决定。这里是纯计算和结果落库；换成文件导出时，还需要先保证文件写入可用位置，再提交带版本的结果引用，并定义文件缺失时如何重建。把状态字段改成 succeeded，不会自动替你验证结果资源真的存在。"
        }
      ]
    },
    {
      "id": "failures",
      "title": "7. 两个提交故障：断开连接，结果到底确定了吗",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "实验用 fork 启动真实 API 子进程，在 COMMIT 前和 COMMIT 后各放一个 IPC 屏障。父进程等到“已到达此阶段”的消息后发送 SIGKILL，再等待实际退出。这里没有用睡眠估计服务执行到哪一步。提交前退出，数据库连接关闭使未提交事务回滚，查询不到这个 requestKey。提交后、响应前退出，fetch 失败，但任务已经存在。"
        },
        {
          "type": "code",
          "filename": "examples/async-task-model/test.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "await t.test('kill before commit leaves no accepted job',async()=>{const broken=await api('before-commit'),pending=post(broken.base,'before').then(()=>false,()=>true);await broken.process.wait('before-commit');await broken.process.stop('SIGKILL');assert.equal(await pending,true);assert.equal((await pool.query(\"SELECT * FROM jobs WHERE request_key='before'\")).rowCount,0);});\n  await t.test('kill after commit before 202 loses response, same key recovers one queued job',async()=>{const broken=await api('after-commit'),pending=post(broken.base,'after').then(()=>false,()=>true);await broken.process.wait('after-commit');await broken.process.stop('SIGKILL');assert.equal(await pending,true);const before=(await pool.query(\"SELECT id FROM jobs WHERE request_key='after'\")).rows[0].id;const reply=await (await post(web.base,'after')).json();assert.equal(reply.id,before);assert.equal(reply.replayed,true);assert.equal((await pool.query(\"SELECT * FROM jobs WHERE request_key='after'\")).rowCount,1);});"
        },
        {
          "type": "paragraph",
          "text": "第二种情况最容易误导调用方：网络失败并不等于业务没有接受。客户端拿同一个 key 再 POST，得到原来的 ID 和 replayed=true，而不是创建第二条。这是“恢复同一意图”的协议，不能随手换一个新 key 重试。测试还断言数据库中只有一条该 key 的任务，让 HTTP 观察和持久状态相互印证。"
        },
        {
          "type": "paragraph",
          "text": "本实验的故障点是明确的，所以我们知道事务属于哪一边。真实网络若在 COMMIT 交互中断开，应用可能不知道服务端有没有提交，不能仅根据本地 committed 布尔值判断真相。仍然应该通过业务 key 查询或恢复。自动 ROLLBACK 也不会逆转一个已经成功提交的事务。"
        }
      ]
    },
    {
      "id": "lifetimes",
      "title": "8. API 退出与 Worker 退出，是两种不同故障",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "正常路径先让 Worker 领取任务，再暂停在计算前；此时 GET 返回 running。随后停止 API，允许 Worker 继续并自然退出。重新启动 API，读取到 succeeded 和 HELLO。这说明工作寿命不再绑定某次 HTTP 请求或某个 API 实例。它验证的是独立进程与数据库状态，而不是浏览器把连接多保持了几秒。"
        },
        {
          "type": "paragraph",
          "text": "反过来，在领取后杀掉 Worker，记录会一直停在 running。当前模型没有租约、心跳或自动重领，因此不会假装自己具有崩溃自愈能力。测试只有在父进程确认自己启动的这个本地子进程已经退出后，才用指定 ID 和 worker_id 把这一条重新放回 queued，接着启动替代 Worker。这是受控修复演示，不能拿去当成分布式环境里的“没心跳就证明旧进程死了”。"
        },
        {
          "type": "paragraph",
          "text": "分布式失联可能是暂停或网络隔离。自动重领意味着旧、新 Worker 可能同时继续工作，需要领取代次、过期判定和拒绝陈旧提交；与外部资源交互时还要传递 fencing token。本站可靠任务和协调文章分别展开这些协议。先明确本篇没有自动恢复，反而能看清后续机制到底补了哪个缺口。"
        }
      ]
    },
    {
      "id": "capacity",
      "title": "9. 排队不是无限缓冲：容量与保留期分别算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据库接收上限控制未完成任务数量；API 另设最多 16 个正在处理的 HTTP 请求；连接池最多 2 条连接。三者限制的对象不同，不能把“队列只剩 8 条”当成服务器最多占 8 份内存的证明。输入先按字节限定 1024，再一次性严格解码 UTF-8 和解析 JSON，避免分片把中文拆坏。文本长度另按 JavaScript 字符串单位限制为 80。"
        },
        {
          "type": "paragraph",
          "text": "容量测试并发发出 10 个不同 key 的合法请求，断言 8 个 202、2 个 429，表里恰有 8 条未完成任务。这个结果依赖接收事务遵守同一把锁；它是并发不变量测试，不是压测或吞吐数据。任务完成后不占活跃名额，但终态行和唯一 key 仍被保留，磁盘会继续增长，因此上线还需要结果保留、归档和 key 过期策略。"
        },
        {
          "type": "paragraph",
          "text": "业务还应观察最老排队年龄、失败原因、运行时长和消费者进度。单看队列长度不能发现“少量任务永远卡住”。取消也需要定义阶段：接受前可以拒绝，排队时可以标记取消，运行中通常只能请求协作停止；HTTP 连接断开不能自动代表撤销一个已提交的后台工作。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "10. 运行、预期结果与本篇的边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下载 ZIP 后解压，在示例目录执行 npm ci 和 npm test。需要 Node 22.12.0 与 PostgreSQL 17 的 initdb、pg_ctl、postgres；默认目录见 README，可用 PG_BIN 指定。脚本建立私有临时 PGDATA，只使用临时 Unix socket 和端口号 55448，不连接个人 5432 数据库。HTTP 监听随机 loopback 端口，教学凭证每轮随机生成，不使用本站登录密码。"
        },
        {
          "type": "paragraph",
          "text": "验收应看到 9 项测试全部通过，包含父测试；重点是提交前无记录、提交后断响应仍仅一任务、API 重启看见 HELLO、Worker 崩溃保持 running、锁住行时被跳过，以及 10 个并发接受只有 8 个进入队列。所有受控子进程、连接池和临时数据库由 finally 清理。若端口或二进制版本不对，先修环境，不要改用用户数据库来“跑通”。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24 在 macOS 14.5、Node 22.12.0、PostgreSQL 17.4、pg 8.13.1 实际执行了这些 HTTP、进程和事务检查。没有验证 Linux 守护进程部署、容器重启策略、集群切换、外部副作用或生产容量；源码 SVG 的可视检查也不能代替手机阅读验收。下载资源属于离线资料，真正运行服务仍需要另装本地依赖。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "RFC 9110 §15.3.3：202 Accepted",
      "url": "https://www.rfc-editor.org/rfc/rfc9110.html#name-202-accepted"
    },
    {
      "title": "PostgreSQL 17：SELECT 锁定子句与 SKIP LOCKED",
      "url": "https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE"
    },
    {
      "title": "PostgreSQL 17：事务级 advisory locks",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS"
    },
    {
      "title": "Node.js 22.12.0：child_process.fork 与 IPC",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/child_process.html#child_processforkmodulepath-args-options"
    }
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Node.js 22.12.0",
    "PostgreSQL 17.4",
    "pg 8.13.1"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 25,
  "examples": [
    {
      "label": "下载完整本地实验 ZIP",
      "path": "async-task-model.zip"
    },
    {
      "label": "运行说明与验收边界",
      "path": "async-task-model/README.md"
    }
  ]
};
export default article;
