import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "distributed-coordination",
  "title": "并发与分布式协调：限流、租约、锁和 fencing",
  "topic": "tasks",
  "description": "分别验证配额、互斥资格与资源端拒旧写；真实数据库过期展示旧持有者为什么还能覆盖，以及递增token究竟保护什么。",
  "minutes": 42,
  "tags": [
    "分布式协调",
    "Redis",
    "租约",
    "fencing"
  ],
  "scope": "私有 PostgreSQL 权威租约与条件资源写、真实 Redis 单键配额；教学单机复现，不宣称高可用共识、主从切换或外部资源支持fencing。",
  "prerequisites": [
    "事务与条件 UPDATE",
    "任务所有权和重试基础",
    "Redis 基本命令"
  ],
  "sections": [
    {
      "id": "concept",
      "title": "1. 并发协调的概念：让哪些动作遵守同一条规则",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "并发是多份工作在时间上重叠；分布式协调则是在不同进程可能各自暂停、失联的条件下，让它们对共享资源遵守同一套规则。最先要说清楚的不是“上哪一种锁”，而是想保持哪个不变量。例如每个窗口最多允许三个请求、同一报表只有一个当前持有者、或者新的报表结果一旦落地就不能再被旧持有者覆盖。这三条规则并不等价。"
        },
        {
          "type": "paragraph",
          "text": "本篇把限流、锁、租约和 fencing 拆开实现。限流决定是否给一次调用放行；锁表达互斥的访问资格；租约给资格加上到期规则；fencing 让资源识别持有者的代次并拒绝陈旧写入。它们可以组合，但没有哪一个词天然承诺“业务只执行一次”。如果同一个合法持有者把一笔付款提交两遍，仍然需要业务幂等键。"
        },
        {
          "type": "paragraph",
          "text": "示例只使用私有 PostgreSQL 和 Redis：Redis 保存限流窗口，PostgreSQL 作为租约权威，同时发放递增 token。最后用一张带条件更新的资源表验证拒旧写。这个实验刻意不用“先 Redis 抢锁，过一会儿再到另一处领 token”的两步拼接，后文会解释那个顺序为什么可能出错。"
        }
      ]
    },
    {
      "id": "comparison",
      "title": "2. 作用与结构：配额、资格和写入约束各放哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "机制",
            "维护的规则",
            "独自解决不了什么"
          ],
          "rows": [
            [
              "固定窗口配额",
              "该主体在此窗口最多放行N次",
              "同一任务并发执行、陈旧写"
            ],
            [
              "数据库行锁",
              "某个短事务中互斥修改同一行",
              "事务提交后远程工作的所有权"
            ],
            [
              "租约",
              "权威处记录谁在期限内持有资格",
              "让暂停的旧进程立即停止"
            ],
            [
              "资源端 fencing",
              "拒绝比已接受代次更旧的写入",
              "重复同代写、业务授权、撤销外部副作用"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "如果业务变更和冲突判断本来就在一个数据库事务里，优先考虑唯一约束、条件 UPDATE 或行锁。不要为了“分布式”三个字，把本来能原子完成的规则拆成应用、Redis 和数据库三份状态。只有工作需要跨越较长时间、远程资源或实例职责时，才继续讨论租约与资源端约束。"
        },
        {
          "type": "paragraph",
          "text": "本文的权威不是客户端当前时间，也不是 Worker 本地一个 locked=true。租约行记录 resource、holder、token、expires_at；所有客户端向同一个权威申请。另有 fenced_resources 保存 last_token，表示这个资源已经接受过的最大代次。两个记录承担不同职责，即使教学中放在同一个 PostgreSQL 里，也不能把它们在概念上合成“那把锁”。"
        },
        {
          "type": "code",
          "filename": "examples/distributed-coordination/schema.sql",
          "language": "sql",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "CREATE SEQUENCE fencing_tokens AS bigint NO CYCLE CACHE 1;\nCREATE TABLE leases (\n resource text PRIMARY KEY, holder uuid, token bigint NOT NULL,\n expires_at timestamptz NOT NULL\n);\nCREATE TABLE unsafe_resources(id text PRIMARY KEY,value text NOT NULL);\nCREATE TABLE fenced_resources(id text PRIMARY KEY,value text NOT NULL,last_token bigint NOT NULL DEFAULT 0);\nINSERT INTO unsafe_resources VALUES ('report','initial');\nINSERT INTO fenced_resources(id,value) VALUES ('report','initial');"
        },
        {
          "type": "figure",
          "src": "figures/distributed-coordination/mechanism.svg",
          "title": "资格过期不等于旧代码停止",
          "alt": "A得到旧token后暂停，数据库租约到期后B得到新token并写资源；A恢复后，无保护资源被覆盖，有fencing的资源拒绝旧token。",
          "caption": "拒绝发生在资源写入处，条件是 token 小于资源已经接受的最大 token，而不是客户端自称已经拿到锁。"
        }
      ]
    },
    {
      "id": "quota",
      "title": "3. 先做限流：一次原子判断，最多放行三次",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "固定窗口限流把一个主体的一段时间映射到计数器。这里的窗口从首次允许开始，键第一次创建时设置 TTL；后续允许只增加计数，不刷新到期时间；达到 3 后拒绝，也不继续累加。若把 GET、判断、INCR 分成三个独立往返，十个客户端可能一起读取 0，随后全部放行。我们把判断与修改放进同一个短 Lua 脚本。"
        },
        {
          "type": "code",
          "filename": "examples/distributed-coordination/coordination.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "const quotaLua=`\nlocal count=tonumber(redis.call('GET',KEYS[1]) or '0')\nif count>=tonumber(ARGV[1]) then return {0,count,math.max(0,redis.call('PTTL',KEYS[1]))} end\nif count==0 then redis.call('SET',KEYS[1],1,'PX',ARGV[2]);count=1\nelse count=redis.call('INCR',KEYS[1]) end\nreturn {1,count,redis.call('PTTL',KEYS[1])}\n`;\nexport async function takeQuota(subject,{limit=3,windowMs=10000}={}){\n key(subject);\n if(!Number.isSafeInteger(limit)||limit<1||limit>10||!Number.isSafeInteger(windowMs)||windowMs<50||windowMs>60000)throw new RangeError('bounded fixed window configuration required');\n const [allowed,count,remainingMs]=await redis('EVAL',quotaLua,1,'quota:{'+subject+'}',limit,windowMs);\n return {allowed:allowed===1,count,remainingMs};\n}"
        },
        {
          "type": "paragraph",
          "text": "KEYS 中显式传入同一个主体的计数键，ARGV 传入限额和窗口长度。脚本运行时没有别的命令插进这段读改写，因此并发请求会依次看到更新后的计数。Lua 的原子执行不是 SQL 那种遇错自动回滚；要先约束输入、保持键类型受控，并让脚本足够短。大循环会阻塞 Redis，这不是把任意业务搬进脚本的理由。"
        },
        {
          "type": "paragraph",
          "text": "本实验十个真实 redis-cli 并发调用同一脚本，恰有三个 allowed，计数仍为 3，另一个主体可以独立获得额度。它证明的是单个 Redis 权威上同一键的判断，没有证明跨主故障切换不丢额度。窗口配置也必须稳定：同一键今天用 3 次、下次改 10 次，不再是同一个固定配额协议。"
        },
        {
          "type": "reference",
          "title": "Redis：Lua 原子执行与阻塞边界",
          "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/"
        }
      ]
    },
    {
      "id": "window",
      "title": "4. 固定窗口的失败边界：重置会带来什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TTL 到期会重建窗口，因此边界前允许三次，边界后还能立即允许三次。不能把这实现描述成“任意滑动一秒最多三次”；它只约束各自窗口。如果接口需要平滑速率，应选择令牌桶、漏桶或真正的滑动窗口，并明确是否允许突发、计费何时发生，以及失败请求是否返还配额。"
        },
        {
          "type": "paragraph",
          "text": "测试用 500 毫秒窗口允许三次、拒绝第四次，然后轮询 Redis 的 EXISTS，只有观察到键已经不存在，才再次申请三次。这是在真实 Redis 上观察过期，轮询里的短等待只是避免空转，不是拿 sleep(500) 作为过期证明。测试进程可能被系统暂停，因此没有根据两批调用的墙钟时间推导吞吐或边界性能。"
        },
        {
          "type": "paragraph",
          "text": "Redis 不可达时，takeQuota 抛错，而不是把异常当成 allowed。这里选择停止放行。实际服务可以按业务选择保守拒绝、降级本地额度或允许通过，但每种选择都改变规则：多个实例各自发本地额度，不能继续声称具有原来的全局上限。配额也不能代替队列活跃数量限制，慢请求即使进入速率不高，仍可能长期堆积。"
        }
      ]
    },
    {
      "id": "lease",
      "title": "5. 租约：用期限释放资格，但不要推断旧进程死亡",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "普通数据库行锁的寿命通常绑定事务。长任务若一直开着事务，会占用连接并延长锁持有时间；用租约则把资格记成可查询的业务数据：到 expires_at 之后，另一个持有者可以取得新资格。任务可以在事务外运行，代价是你必须接受“旧持有者还活着，只是资格到期了”这个事实。"
        },
        {
          "type": "paragraph",
          "text": "申请过程在同一个数据库事务里创建资源行并条件 UPDATE。只有 expires_at 不晚于数据库当前时刻时才成功。并发 UPDATE 同一行会经过数据库锁仲裁；它们不能都基于同一个旧期限成功取得新租约。token 的 nextval 也写在这个成功更新里，资格变更与发号的顺序由同一行操作连接起来。"
        },
        {
          "type": "code",
          "filename": "examples/distributed-coordination/coordination.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "export async function acquire(db,resource,holder,ttlMs){\n key(resource);ttl(ttlMs);await db.query('BEGIN');\n try{\n  await db.query(\"INSERT INTO leases VALUES ($1,NULL,0,'-infinity') ON CONFLICT DO NOTHING\",[resource]);\n  const {rows}=await db.query(\"UPDATE leases SET holder=$1,token=nextval('fencing_tokens'),expires_at=clock_timestamp()+($2::int*interval '1 millisecond') WHERE resource=$3 AND expires_at<=clock_timestamp() RETURNING resource,holder,token,expires_at\",[holder,ttlMs,resource]);\n  await db.query('COMMIT');return rows[0]??null;\n }catch(error){await db.query('ROLLBACK');throw error;}\n}"
        },
        {
          "type": "paragraph",
          "text": "这里用数据库 clock_timestamp 作为期限权威，而不是客户端 Date.now。它避免不同客户端时钟直接互相比大小，但仍依赖权威数据库的时间及运行假设；时钟跳变会改变何时允许接替。TTL 参数不能证明任务一定按时结束，只影响接替时机。六个独立连接竞争同一资源的测试恰有一个非空结果；这是互斥资格的真实竞争检查，不是分布式网络分区证明。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：行锁和事务锁",
          "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
        }
      ]
    },
    {
      "id": "renew-release",
      "title": "6. 续期和释放：必须同时匹配持有者与代次",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "续期不只是延长某个 key 的 TTL。必须验证 resource、holder、token 都匹配，并且租约还没过期。否则 A 的迟到续期可能把 B 刚获得的租约延长，或者把自己已经失去的资格复活。释放同样需要 owner 和 token 匹配：旧 A 不能无条件删除资源上属于 B 的资格。"
        },
        {
          "type": "code",
          "filename": "examples/distributed-coordination/coordination.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "export async function renew(db,lease,ttlMs){\n ttl(ttlMs);const {rowCount}=await db.query(\"UPDATE leases SET expires_at=clock_timestamp()+($1::int*interval '1 millisecond') WHERE resource=$2 AND holder=$3 AND token=$4 AND expires_at>clock_timestamp()\",[ttlMs,lease.resource,lease.holder,lease.token]);return rowCount===1;\n}\nexport async function release(db,lease){\n const {rowCount}=await db.query(\"UPDATE leases SET holder=NULL,expires_at='-infinity' WHERE resource=$1 AND holder=$2 AND token=$3\",[lease.resource,lease.holder,lease.token]);return rowCount===1;\n}"
        },
        {
          "type": "paragraph",
          "text": "测试分别验证错 holder 不能续期、错 token 不能释放，当前持有者可以续期和释放。释放不回退 token 序列；下一次仍会获得更高代次。续期必须安排足够提前，遇到超时不能假装成功继续无限工作。即使客户端在远程调用前再检查一次租约，检查结束与写入到达之间仍可以发生暂停，所以“先查锁还在，再写”无法单独封住陈旧写窗口。"
        },
        {
          "type": "paragraph",
          "text": "本篇不实现自动心跳线程和重试框架，避免把不同问题藏进一个大类。生产 Worker 可以在失去续期确认后主动停止新工作，但无法收回已经发出去、在网络里延迟的请求；接下来需要由资源自己判断请求是否来自旧代次。"
        }
      ]
    },
    {
      "id": "stale-writer",
      "title": "7. 用一个真实反例理解租约的局限",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "A 获得报表租约后暂停，数据库期限到达；B 获得新租约并写入 B new；A 恢复继续写 A stale。如果资源只接受 value 而不检查资格代次，最后保存的就是 A stale。租约协议并没有“失灵”：权威确实只承认 B 是当前持有者。出错的是资源无法识别这次迟到写来自旧持有者。"
        },
        {
          "type": "paragraph",
          "text": "实验先实际查询数据库时钟已经不早于 expires_at，再申请 B。随后验证 A 不能再续期，也不能释放 B 的租约；但对 unsafe_resources 的普通 UPDATE 仍然成功覆盖 B。这些步骤不需要故意制造一次长 GC，就能复现暂停后迟到写的核心因果关系。模拟的是 A 的执行顺序暂停，租约过期和数据库修改都是真实的。"
        },
        {
          "type": "paragraph",
          "text": "让 TTL 更长只是在降低发生概率，同时增加故障恢复等待。把 TTL 设得很短会更频繁接替，并不能神奇地提升正确性。你也无法仅靠最后一次心跳证明另一台机器已经永久停止。对共享资源的安全规则，最终要落到那个真正接收写入的地方。"
        }
      ]
    },
    {
      "id": "fencing",
      "title": "8. Fencing：在资源端拒绝陈旧代次",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Fencing token 是随资格代次递增的编号，Worker 写资源时附上它。资源在原子写入里比较本次 token 与已经接受的 last_token，若更旧就拒绝；若不旧则写值并更新 last_token。判断和修改必须在同一个受保护操作里，不能先普通 SELECT 再无条件 UPDATE，否则两个写入仍然可能穿过检查。"
        },
        {
          "type": "code",
          "filename": "examples/distributed-coordination/coordination.mjs",
          "language": "javascript",
          "purpose": "下载工程的连续原文节选；依赖同目录文件，不能作为单文件运行。",
          "kind": "excerpt",
          "code": "export async function fencedWrite(db,resource,token,value){\n key(resource);\n if(typeof token!=='string'||!(/^[1-9][0-9]{0,18}$/).test(token)||BigInt(token)>9223372036854775807n)throw new RangeError('positive PostgreSQL bigint token string required');\n if(typeof value!=='string'||value.length>64)throw new TypeError('bounded value required');\n const {rowCount}=await db.query('UPDATE fenced_resources SET value=$1,last_token=$2 WHERE id=$3 AND last_token<=$2::bigint',[value,token,resource]);return rowCount===1;\n}"
        },
        {
          "type": "paragraph",
          "text": "当资源已接受 B 的新 token，A 携带旧 token 的写入会得到 rowCount=0，原值保持 B new。这里的比较允许同一个 token 再次写入，所以第二次 B again 仍成功：fencing 保护代次顺序，不保证同代请求去重。token 也不是权限凭证。这个内部实验信任协调服务签发的编号；公共 API 必须认证调用者，禁止用户随意提交一个巨大编号把其他合法写者全部挡住。"
        },
        {
          "type": "paragraph",
          "text": "还要把承诺说准确：资源拒绝的是低于“资源已接受最大值”的代次，并非读取时钟就自动拒绝一切已到期持有者。在 B 的更高 token 被资源观察到以前，旧 A 仍可能写入。这套机制用于阻止新一代已经接管资源之后的倒退；若还要求更强的即时撤销，需要资源参与权限或租约校验，并明确原子性边界。"
        },
        {
          "type": "reference",
          "title": "Mike Burrows：Chubby 原论文 §2.1、§2.4",
          "url": "https://storage.googleapis.com/gweb-research2023-media/pubtools/4444.pdf"
        }
      ]
    },
    {
      "id": "token-order",
      "title": "9. Token 为什么不能随手在锁外补发",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "考虑另一种设计：A 先在 Redis 得到租约，随后暂停；租约到期后 B 得到租约并到数据库领编号 10；A 恢复后才到数据库领编号 11。若资源只比较编号，过期 A 反而拥有更大的值。问题不在序列是否原子，而在发号顺序没有绑定资格转移顺序。因此本例由一个数据库权威在成功修改租约行时分配编号，不把两个独立服务的操作拼成不存在的原子步骤。"
        },
        {
          "type": "paragraph",
          "text": "PostgreSQL 序列允许跳号，事务回滚也不会把用过的号收回；fencing 只需要后续有效代次更大，不需要连续。要禁止人为重置、循环或恢复旧备份导致编号回退，并把故障切换的持久化、脑裂防护和权威唯一性一起设计。当前本地实验没有验证数据库切换，不能声称单凭一个 sequence 就完成了高可用协调。"
        },
        {
          "type": "paragraph",
          "text": "驱动默认把 bigint 返回字符串，这是正确性的一部分。编号超过 JavaScript 安全整数范围后，强转 Number 会丢失相邻代次差异。测试把序列推进后真实领取 9007199254740993，断言它仍是精确字符串。资源比较由 PostgreSQL bigint 完成，JavaScript 仅用 BigInt 校验输入范围，不把编号作为浮点数运算。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：序列原子分配与持久化边界",
          "url": "https://www.postgresql.org/docs/17/functions-sequence.html"
        }
      ]
    },
    {
      "id": "verify",
      "title": "10. 复现实验，再决定实际业务用哪种规则",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "解压示例后执行 npm ci、npm test。需要 Node 22.12.0、PostgreSQL 17 工具、Redis 7.0.4 的 server 和 cli。脚本使用私有临时 PGDATA、Unix socket 55449，以及独立 loopback Redis 56383；不访问用户 5432 或 6379。Redis 通过真实 CLI 调用，因此这些结果不是内存模拟器的承诺。"
        },
        {
          "type": "paragraph",
          "text": "预期 9 项通过，包含父测试：所有者校验、六连接一个胜者、数据库真实过期与旧写覆盖、资源拒旧代次且允许同代再次写、超安全整数精度、十次并发只放行三次、真实窗口过期重置，以及 Redis 停止时拒绝后重启恢复。每次结束关闭自建进程并删除临时数据；完整 schema、脚本和断言均在 ZIP 中。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24 在 macOS 14.5、PostgreSQL 17.4、Redis 7.0.4 实跑上述检查。资源使用同库表来演示条件写，没有接第三方对象存储、文件服务或支付接口；没有验证 Redis Cluster、主从故障切换、Linux 部署或真实网络分区。若目标资源不支持比较 token，就不能仅在应用层加个参数便宣布 fencing 已经成立。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "PostgreSQL 17：行锁和事务锁",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
    },
    {
      "title": "PostgreSQL 17：序列原子分配与持久化边界",
      "url": "https://www.postgresql.org/docs/17/functions-sequence.html"
    },
    {
      "title": "Redis：Lua 原子执行与阻塞边界",
      "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/"
    },
    {
      "title": "Redis 7.0.4：整数更新实现",
      "url": "https://github.com/redis/redis/blob/7.0.4/src/t_string.c"
    },
    {
      "title": "Mike Burrows：Chubby 原论文 §2.1、§2.4",
      "url": "https://storage.googleapis.com/gweb-research2023-media/pubtools/4444.pdf"
    }
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Node.js 22.12.0",
    "PostgreSQL 17.4",
    "pg 8.13.1",
    "Redis 7.0.4"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 25,
  "examples": [
    {
      "label": "下载完整本地实验 ZIP",
      "path": "distributed-coordination.zip"
    },
    {
      "label": "运行说明与验收边界",
      "path": "distributed-coordination/README.md"
    }
  ]
};
export default article;
