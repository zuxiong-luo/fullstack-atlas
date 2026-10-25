import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "flash-sale",
  "topic": "data",
  "title": "秒杀后端：从库存行锁到 Redis Lua 与有界异步下单",
  "description": "先讲清库存、行锁和原子检查，再用真实 PostgreSQL、Redis Lua 与 Stream 验证不超卖、资格预占、受控消费、支付取消竞争和故障恢复。",
  "scope": "单活动单件、每人一单的教学后端。交付真实本地PG/Redis服务函数与受控实验，解释从正确性到过载保护的演进；不声称提供生产商城、百万QPS、真实支付接入或分布式高可用认证。",
  "minutes": 65,
  "labMinutes": 25,
  "tags": [
    "秒杀",
    "库存",
    "行锁",
    "Redis",
    "Lua",
    "Stream",
    "幂等",
    "削峰"
  ],
  "prerequisites": [
    "会写基础SQL和JavaScript async/await",
    "理解HTTP请求；事务、行锁、Lua和消息确认在文中逐步解释"
  ],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0",
    "PostgreSQL 17.4",
    "pg 8.13.1",
    "Redis 7.0.4",
    "node-redis 4.7.0"
  ],
  "verifiedAt": "2026-10-25",
  "questionIds": [],
  "examples": [
    {
      "label": "完整实验、锁文件与测试ZIP",
      "path": "flash-sale.zip"
    },
    {
      "label": "环境、命令与验证边界",
      "path": "flash-sale/README.md"
    }
  ],
  "references": [
    {
      "title": "PostgreSQL17：行锁与持有期限",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
    },
    {
      "title": "PostgreSQL17：Read Committed并发更新",
      "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
    },
    {
      "title": "Redis：Lua脚本与原子执行",
      "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/"
    },
    {
      "title": "Redis：EVAL的KEYS与ARGV",
      "url": "https://redis.io/docs/latest/commands/eval/"
    },
    {
      "title": "Redis：XAUTOCLAIM恢复未确认消息",
      "url": "https://redis.io/docs/latest/commands/xautoclaim/"
    },
    {
      "title": "Redis：复制、WAIT与故障切换边界",
      "url": "https://redis.io/docs/latest/operate/oss_and_stack/management/replication/"
    },
    {
      "title": "Redis官方仓库：Lua错误不会自动回滚",
      "url": "https://github.com/redis/redis/issues/10576"
    },
    {
      "title": "RabbitMQ：确认与重复投递",
      "url": "https://www.rabbitmq.com/docs/confirms"
    },
    {
      "title": "RabbitMQ：队列容量与溢出策略",
      "url": "https://www.rabbitmq.com/docs/maxlength"
    }
  ],
  "sections": [
    {
      "id": "concepts",
      "title": "秒杀是什么：有限库存、并发申请和订单承诺",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "秒杀是在短时间内，把有限商品分配给大量购买申请的业务。后端要同时回答两件事：谁真正获得了商品，以及系统最多接收多少工作。前者是正确性问题，例如不能超卖、不能给同一用户建两张有效订单；后者是容量问题，例如不能让几十万个失败请求都占着数据库连接。先把两者分开，后面的组件才有明确职责。"
        },
        {
          "type": "paragraph",
          "text": "本文用同一个活动贯穿：100件商品，每人一件，创建订单后预占库存，10分钟内支付，关闭未支付订单后释放名额。规则特意固定为“一人一场活动只建立一张订单，关闭后本人不能再参与，新用户可以使用释放的名额”。如果产品允许取消后重买，就要重新设计参与记录的生命周期，不能原样复用这里的唯一约束。"
        },
        {
          "type": "paragraph",
          "text": "还要分清三个结果。入口收到请求，不等于获得资格；Redis预占成功，不等于数据库已经有订单；订单存在，也不等于已经支付。页面文案与查询接口应分别表达QUEUED、待支付、售罄或已支付，不能在拿到一个Redis返回值时就宣布“抢购成功”。"
        },
        {
          "type": "paragraph",
          "text": "实现使用普通Node.js服务函数、pg和node-redis，方便直接观察底层行为。NestJS可在Controller中完成鉴权和输入校验，再调用这些逻辑；TypeORM则必须使用事务专属manager实现同一套SQL语义。本文不额外交付HTTP登录、网关或真实支付适配器，也不把函数调用测试说成HTTP端到端验收。"
        }
      ]
    },
    {
      "id": "inventory",
      "title": "库存怎样表示：可用、预占、已售与业务约束",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "可用库存available是还能分配的数量；预占reserved是已经生成待支付订单、暂时不能再分配的数量；已售sold对应已经确认支付的数量。在没有补货、退款和售后变更的本文模型里，三者之和等于总库存，而且每一项都不能小于零。这是我们后续每个实验都会检查的不变量。"
        },
        {
          "type": "table",
          "headers": [
            "动作",
            "available",
            "reserved",
            "sold"
          ],
          "rows": [
            [
              "活动开始",
              "100",
              "0",
              "0"
            ],
            [
              "A创建订单",
              "99",
              "1",
              "0"
            ],
            [
              "A支付",
              "99",
              "0",
              "1"
            ],
            [
              "B创建订单",
              "98",
              "1",
              "1"
            ],
            [
              "B超时关闭",
              "99",
              "0",
              "1"
            ]
          ]
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/schema.sql",
          "language": "sql",
          "kind": "excerpt",
          "purpose": "完整实验表结构：数量检查、用户限购、请求结果和释放Outbox。所有金额用整数分，价格由服务端sales表读取。",
          "code": "CREATE TABLE sales (\n  id text PRIMARY KEY,\n  price_cents integer NOT NULL CHECK (price_cents > 0),\n  total integer NOT NULL CHECK (total >= 0),\n  available integer NOT NULL CHECK (available >= 0),\n  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),\n  sold integer NOT NULL DEFAULT 0 CHECK (sold >= 0),\n  CHECK (available + reserved + sold = total)\n);\nCREATE TABLE orders (\n  id uuid PRIMARY KEY,\n  sale_id text NOT NULL REFERENCES sales(id),\n  user_id text NOT NULL,\n  amount_cents integer NOT NULL CHECK (amount_cents > 0),\n  status text NOT NULL CHECK (status IN ('PENDING_PAYMENT','PAID','CLOSED')),\n  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '10 minutes'),\n  UNIQUE (sale_id,user_id)\n);\nCREATE TABLE attempts (\n  id uuid PRIMARY KEY,\n  sale_id text NOT NULL REFERENCES sales(id),\n  user_id text NOT NULL,\n  outcome text NOT NULL CHECK (outcome IN ('PROCESSING','ORDER_CREATED','SOLD_OUT')),\n  order_id uuid REFERENCES orders(id)\n);\nCREATE TABLE releases (\n  id uuid PRIMARY KEY,\n  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),\n  sale_id text NOT NULL REFERENCES sales(id),\n  applied boolean NOT NULL DEFAULT false\n);"
        },
        {
          "type": "paragraph",
          "text": "orders的活动＋用户唯一约束把限购落实到数据库。attempts则记录每个预占编号对应的处理结果，解决同一任务重复消费和客户端结果未知。两者不能混为一谈：同一个用户换一个请求编号，仍然不能多买；同一个编号换成另一个用户，也必须被拒绝。releases稍后负责可靠地把数据库确认的库存释放通知Redis。"
        }
      ]
    },
    {
      "id": "row-lock",
      "title": "行锁怎样防超卖：条件更新与短事务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "行锁是数据库协调同一行并发修改的机制。对这个库存记录执行UPDATE时，数据库会自动取得相应行锁，不要求应用先申请一把Redis锁。仅修改普通数量字段、不修改相关键列时，PostgreSQL通常使用FOR NO KEY UPDATE级别的行锁；持有期间其他冲突更新需要等待，普通MVCC查询并不会因此全部阻塞。"
        },
        {
          "type": "code",
          "filename": "SQL · 库存条件预占",
          "language": "sql",
          "kind": "excerpt",
          "purpose": "机制片段，实际同语义SQL位于后文createOrder。检查与扣减必须由同一条UPDATE完成。",
          "code": "UPDATE sales\nSET available = available - 1,\n    reserved  = reserved + 1\nWHERE id = $1\n  AND available > 0\nRETURNING id;"
        },
        {
          "type": "paragraph",
          "text": "假设只剩1件。A先取得行锁，把可用改为0，但还没有提交；B尝试更新同一行会等待。A提交以后，在本文固定的Read Committed隔离级别下，B会根据更新后的行重新检查available>0，结果影响0行。如果A回滚，库存恢复，B则可能成功。不能把这个结论不加说明地推广到Repeatable Read：后者可能遇到序列化失败，需要重试整个事务。"
        },
        {
          "type": "figure",
          "src": "figures/flash-sale/atomic.svg",
          "title": "两种并发：分开的检查会交错，数据库条件更新会等待并重检",
          "alt": "上半部分两个GET都看到1，两个DECR把Redis减到负1；下半部分数据库A持有行锁，B等待A提交后重检条件，只允许一个更新成功。",
          "caption": "上半部分两个GET都看到1，两个DECR把Redis减到负1；下半部分数据库A持有行锁，B等待A提交后重检条件，只允许一个更新成功。 图为教学结构／顺序示意，不代表实测耗时或生产容量。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：行锁与持有期限",
          "url": "https://www.postgresql.org/docs/17/explicit-locking.html",
          "note": "行锁由UPDATE取得；不修改键列的锁模式与普通查询的关系。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：Read Committed并发更新",
          "url": "https://www.postgresql.org/docs/17/transaction-iso.html",
          "note": "本段等待后重检的前提是PostgreSQL17的Read Committed。"
        },
        {
          "type": "paragraph",
          "text": "扣库存和创建订单必须同事务，否则可能只扣库存没有订单，或者有订单但没有库存。事务也要短：获取连接、执行几条SQL、提交或回滚。不能在锁住最后一件库存后，再去等待支付、短信或者一个慢外部HTTP接口。后面的真实实验会用pg_blocking_pids确认B确实在等A，再释放A，不靠sleep猜竞争顺序。"
        }
      ]
    },
    {
      "id": "overload",
      "title": "为什么还会被打垮：正确不等于能够无限等待",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "行锁不会自动给业务提供容量上限。如果十万个请求都进入连接池等待，池外会积压Promise、HTTP连接和请求上下文；若还不断扩大连接数，数据库可能因过量并发和资源压力失去响应。问题不只是某一把锁慢，而是系统接收了超出处理能力的工作。增加数据库连接上限，往往只是把等待搬到数据库里。"
        },
        {
          "type": "paragraph",
          "text": "爆款活动的策略应是先筛选，再排队，再按预算处理。页面和图片交给CDN；网关限制异常和超量请求；API根据已认证身份检查资格；Redis执行短小的预占逻辑；获得资格的事件进入有界队列；消费者以受控并发访问数据库。本文实现后半条链，网关与全站总限流属于部署职责，没有声称本地函数已经具备完整反机器人能力。"
        },
        {
          "type": "figure",
          "src": "figures/flash-sale/admission.svg",
          "title": "让少量有效申请进入数据库，过载时明确拒绝",
          "alt": "网关限流在Redis之前；Redis拒绝重复、售罄及历史容量已满的新申请；预占和Stream事件在同一脚本写入；单个批次最多32条、同时处理2条，数据库仍校验库存；结果供调用者查询。",
          "caption": "网关限流在Redis之前；Redis拒绝重复、售罄及历史容量已满的新申请；预占和Stream事件在同一脚本写入；单个批次最多32条、同时处理2条，数据库仍校验库存；结果供调用者查询。 图为教学结构／顺序示意，不代表实测耗时或生产容量。"
        },
        {
          "type": "paragraph",
          "text": "Redis同样有容量边界。一个爆款键仍集中在一个分片执行，随意增加Cluster节点不等于这个键就能并行处理所有请求。售罄状态可以帮助入口快速返回，但释放库存后要及时失效；用户状态轮询也要有退避和缓存。Redis或队列失效时应暂停入口或走已验证的小流量降级，不能把所有失败流量突然透传给数据库。"
        }
      ]
    },
    {
      "id": "atomic-check",
      "title": "原子检查是什么意思：不要把GET和DECR分开发送",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "“原子检查”更准确地说是原子完成“检查并修改”。单条Redis命令各自不会被另一条命令从中间切开，但应用分别await GET、判断、再await DECR，仍然给其他请求留下插入机会。最小反例是库存1，A和B都先GET到1，随后各自DECR，最终变成负1。检查本身没有约束后面的修改资格。"
        },
        {
          "type": "code",
          "filename": "JavaScript · 刻意错误的两步请求",
          "language": "javascript",
          "kind": "pseudocode",
          "purpose": "反例，不要作为秒杀实现。完整测试会控制两个GET先完成，再执行两个DECR。",
          "code": "const stock = Number(await redis.get('stock'));\nif (stock > 0) {\n  await redis.decr('stock');\n  return '获得资格';\n}"
        },
        {
          "type": "paragraph",
          "text": "我们需要把“是否已参与、是否有库存、减一、记录用户”放在一次不可穿插的执行里。Lua是描述这段条件逻辑的编程语言，Redis内置Lua执行环境，应用通过EVAL把脚本和参数交给Redis执行。Lua自己不是一把分布式锁；这里的执行隔离由Redis提供，而且范围只覆盖本次涉及的Redis数据。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "职责"
          ],
          "rows": [
            [
              "Node.js服务",
              "鉴权后传用户ID、活动ID与服务端预占编号；接收结果"
            ],
            [
              "Redis",
              "保存名额、用户预占映射和Stream事件"
            ],
            [
              "Lua脚本",
              "在Redis内部表达分支和命令顺序"
            ],
            [
              "PostgreSQL",
              "保留最终订单、库存与业务约束"
            ]
          ]
        },
        {
          "type": "reference",
          "title": "Redis：Lua脚本与原子执行",
          "url": "https://redis.io/docs/latest/develop/programmability/eval-intro/",
          "note": "脚本执行期间不被其他命令穿插；慢脚本也会阻塞其他客户端。"
        }
      ]
    },
    {
      "id": "lua",
      "title": "把筛选写出来：预占、去重和事件进入同一段Lua",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "每个活动有stock字符串、users Hash和events Stream。Hash可以看成用户ID到预占UUID的字典；Stream是带消息ID的追加事件日志。先查用户记录，重复请求返回原编号；再查库存，为0直接售罄；再查容量，满了返回BUSY；最后才扣名额、登记用户、追加下单事件。返回RESERVED表示有可恢复的预占与事件，不能解释成数据库订单已提交。"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/lua.mjs",
          "language": "lua",
          "kind": "excerpt",
          "purpose": "预占脚本完整定义。stock/users/stream类型和数值先校验，再写入；releaseLua在后文解释。 这里直接展示Lua正文；JavaScript的字符串包装与export位于同一下载文件。",
          "code": "local stockKey, usersKey, streamKey = KEYS[1], KEYS[2], KEYS[3]\nlocal user, reservation, capacity = ARGV[1], ARGV[2], tonumber(ARGV[3])\nif not capacity or capacity < 1 or capacity % 1 ~= 0 then\n  return redis.error_reply('BAD_CAPACITY')\nend\nif redis.call('TYPE', stockKey).ok ~= 'string' then\n  return redis.error_reply('STOCK_NOT_INITIALIZED')\nend\nlocal usersType = redis.call('TYPE', usersKey).ok\nlocal streamType = redis.call('TYPE', streamKey).ok\nif (usersType ~= 'none' and usersType ~= 'hash') or\n   (streamType ~= 'none' and streamType ~= 'stream') then\n  return redis.error_reply('BAD_KEY_TYPE')\nend\nlocal stock = tonumber(redis.call('GET', stockKey))\nif not stock or stock < 0 or stock % 1 ~= 0 then\n  return redis.error_reply('BAD_STOCK')\nend\nlocal existing = redis.call('HGET', usersKey, user)\nif existing then return {'EXISTING', existing} end\nif stock == 0 then return {'SOLD_OUT', ''} end\nif redis.call('XLEN', streamKey) >= capacity then return {'BUSY', ''} end\nredis.call('DECR', stockKey)\nredis.call('HSET', usersKey, user, reservation)\nredis.call('XADD', streamKey, '*', 'user', user, 'reservation', reservation)\nreturn {'RESERVED', reservation}"
        },
        {
          "type": "paragraph",
          "text": "脚本用KEYS接收键名、ARGV接收用户与预占编号。所有键都由服务端生成，并采用同一个{活动ID}哈希标签，使Redis Cluster中这些键落在同一槽；这只是部署前提，本例没有运行Cluster验证。用户ID来自已认证上下文，不能从不可信请求体随便接受一个“我是别人”的userId。价格也不由调用者决定。"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/service.mjs",
          "language": "javascript",
          "kind": "excerpt",
          "purpose": "完整键构造、身份约束和EVAL调用。node-redis客户端最终通过command适配器发送命令；适配器有失败与连接预算。",
          "code": "import { randomUUID } from \"node:crypto\";\nimport { admitLua, releaseLua } from \"./lua.mjs\";\n\nconst identity = /^[a-z0-9-]{1,40}$/;\nconst uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;\nexport function keys(sale) {\n  if (typeof sale !== \"string\" || !identity.test(sale))\n    throw new Error(\"BAD_SALE\");\n  const base = `seckill:{${sale}}`;\n  return {\n    stock: base + \":stock\",\n    users: base + \":users\",\n    stream: base + \":events\",\n    releases: base + \":releases\",\n  };\n}\nfunction validate(user, reservation) {\n  if (\n    typeof user !== \"string\" ||\n    !identity.test(user) ||\n    !uuid.test(reservation)\n  )\n    throw new Error(\"BAD_IDENTITY\");\n}\nexport async function admit(\n  redis,\n  sale,\n  user,\n  capacity = 128,\n  reservation = randomUUID(),\n) {\n  validate(user, reservation);\n  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)\n    throw new Error(\"BAD_CAPACITY\");\n  const k = keys(sale);\n  return redis.command(\n    \"EVAL\",\n    admitLua,\n    3,\n    k.stock,\n    k.users,\n    k.stream,\n    user,\n    reservation,\n    capacity,\n  );\n}"
        },
        {
          "type": "paragraph",
          "text": "这里特意使用Stream而不是“Lua扣库存后再调用RabbitMQ发送”。扣库存和XADD都在同一Redis执行范围，应用在两次网络请求之间崩溃的窗口被消掉。若选择独立RabbitMQ，Lua不能跨系统帮你提交消息，必须保留预占意图、可靠中继与核对恢复，或者采用其他明确的数据所有权方案，不能把换一种MQ当成自动获得原子事务。"
        },
        {
          "type": "paragraph",
          "text": "容量检查用XLEN，限制的是本活动保留的历史事件总数，包含已确认记录，并不等于ready积压数量。实验默认128，ACK后仍保留历史供核验，因此多轮关闭再参与可能在有库存时返回BUSY。这是保守、有界的教学选择；生产要设计保留与清理，不能直接XTRIM删掉未完成任务，也不能把历史上限宣称为完整的实时队列背压。"
        },
        {
          "type": "reference",
          "title": "Redis：EVAL的KEYS与ARGV",
          "url": "https://redis.io/docs/latest/commands/eval/",
          "note": "脚本访问的键显式放入KEYS，普通输入放入ARGV。"
        }
      ]
    },
    {
      "id": "transaction",
      "title": "真正创建订单：请求去重、用户限购与库存一起提交",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Redis通过以后，数据库仍然可能拒绝：名额重建错误、旧消息重放或人工调整，都可能让两层数量暂时不一致。因此最终写入仍执行available>0，并保留活动＋用户唯一约束。这里展示完整createOrder，而不是只留一句“做好幂等”。"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/service.mjs",
          "language": "javascript",
          "kind": "excerpt",
          "purpose": "完整事务连接所有权和下单实现：同编号去重、身份冲突检查、用户限购、条件库存、失败结果和整体回滚。",
          "code": "// Every operation owns one checked-out connection, including rollback.\nexport async function transaction(pool, fn) {\n  const db = await pool.connect();\n  let discard;\n  try {\n    await db.query(\"BEGIN ISOLATION LEVEL READ COMMITTED\");\n    await db.query(\"SET LOCAL lock_timeout='1000ms'\");\n    await db.query(\"SET LOCAL statement_timeout='3000ms'\");\n    const result = await fn(db);\n    await db.query(\"COMMIT\");\n    return result;\n  } catch (error) {\n    try {\n      await db.query(\"ROLLBACK\");\n    } catch (rollbackError) {\n      discard = rollbackError;\n    }\n    throw error;\n  } finally {\n    db.release(discard);\n  }\n}\n\nexport async function createOrder(pool, sale, user, reservation, hooks = {}) {\n  keys(sale);\n  validate(user, reservation);\n  return transaction(pool, async (db) => {\n    const accepted = await db.query(\n      `INSERT INTO attempts(id,sale_id,user_id,outcome)\n      VALUES($1,$2,$3,'PROCESSING') ON CONFLICT(id) DO NOTHING RETURNING id`,\n      [reservation, sale, user],\n    );\n    if (!accepted.rowCount) {\n      const old = (\n        await db.query(\"SELECT * FROM attempts WHERE id=$1\", [reservation])\n      ).rows[0];\n      if (old.sale_id !== sale || old.user_id !== user)\n        throw new Error(\"IDEMPOTENCY_CONFLICT\");\n      return old;\n    }\n    await db.query(\"SAVEPOINT order_work\");\n    const inserted = await db.query(\n      `INSERT INTO orders(id,sale_id,user_id,amount_cents,status)\n      SELECT $1,id,$3,price_cents,'PENDING_PAYMENT' FROM sales WHERE id=$2\n      ON CONFLICT(sale_id,user_id) DO NOTHING RETURNING id`,\n      [reservation, sale, user],\n    );\n    let orderId;\n    if (inserted.rowCount) {\n      const stock = await db.query(\n        `UPDATE sales SET available=available-1,reserved=reserved+1\n        WHERE id=$1 AND available>0 RETURNING id`,\n        [sale],\n      );\n      if (!stock.rowCount) {\n        await db.query(\"ROLLBACK TO SAVEPOINT order_work\");\n        return (\n          await db.query(\n            \"UPDATE attempts SET outcome='SOLD_OUT' WHERE id=$1 RETURNING *\",\n            [reservation],\n          )\n        ).rows[0];\n      }\n      orderId = reservation;\n      await db.query(\n        \"UPDATE orders SET expires_at=clock_timestamp()+interval '10 minutes' WHERE id=$1\",\n        [orderId],\n      );\n    } else {\n      orderId = (\n        await db.query(\n          \"SELECT id FROM orders WHERE sale_id=$1 AND user_id=$2\",\n          [sale, user],\n        )\n      ).rows[0].id;\n    }\n    await hooks.beforeCommit?.();\n    return (\n      await db.query(\n        \"UPDATE attempts SET outcome='ORDER_CREATED',order_id=$2 WHERE id=$1 RETURNING *\",\n        [reservation, orderId],\n      )\n    ).rows[0];\n  });\n}"
        },
        {
          "type": "paragraph",
          "text": "attempts首先用预占UUID争取一次处理权。重复编号的并发INSERT由数据库唯一性仲裁，等待前一个事务结束以后读取已提交结果；若相同编号的用户或活动不同则拒绝。用户换了编号，也会被orders的用户唯一约束挡住，并关联原订单，而不是再扣一件。所有查询都使用同一checked-out连接，finally归还；回滚连接本身失败就丢弃，不把未知状态连接放回池。"
        },
        {
          "type": "paragraph",
          "text": "SAVEPOINT把订单与库存部分包起来。数据库无库存时，回滚刚插入的订单，然后提交attempts中的SOLD_OUT结果；因此轮询能看到明确失败，而不是永远等待。受控beforeCommit异常则回滚整个事务，连attempts也不保留，允许安全重投。示例钩子仅用于实验设置屏障或故障，生产事务里不应塞入任意外部调用。"
        },
        {
          "type": "paragraph",
          "text": "价格从sales.price_cents读取，避免相信前端传来的金额；支付期限在获得库存之后重新设置，避免长时间等待锁把10分钟提前耗尽。例子没有实现活动开关和开始结束时间：线上须在可信服务端校验，并按规则把停卖与抢购竞争落实到一致的数据决策中，不能只依赖前端倒计时。"
        }
      ]
    },
    {
      "id": "worker",
      "title": "队列怎样削峰：有界批次、有限并发、提交后ACK",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "消息队列把任务保存下来，消费者决定它们以多快速度进入数据库。Stream消费者组把已领取未确认的消息记入pending；只有数据库结果已经提交，才XACK确认。若先确认再写库，消费者崩溃可能丢任务；若提交后还没确认就崩溃，则可能重复处理，所以数据库去重仍然必要。"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/worker.mjs",
          "language": "javascript",
          "kind": "excerpt",
          "purpose": "完整教学消费者：每批最多32条、每次调用并发1～8（默认2）、提交后确认、恢复pending并保留扫描游标。未启动无限后台循环。",
          "code": "import { keys, createOrder } from \"./service.mjs\";\nexport const GROUP = \"orders\";\nexport async function group(redis, sale) {\n  await redis.command(\n    \"XGROUP\",\n    \"CREATE\",\n    keys(sale).stream,\n    GROUP,\n    \"0\",\n    \"MKSTREAM\",\n  );\n}\nfunction fields(values) {\n  const result = {};\n  for (let i = 0; i < values.length; i += 2) result[values[i]] = values[i + 1];\n  return result;\n}\n// A finite batch, at most 32 entries and 8 active handlers in THIS call.\n// A deployment must also bound the sum across calls and process replicas.\nexport async function processEntries(\n  pool,\n  redis,\n  sale,\n  entries,\n  { concurrency = 2, afterCommit = () => {} } = {},\n) {\n  if (\n    !Number.isInteger(concurrency) ||\n    concurrency < 1 ||\n    concurrency > 8 ||\n    entries.length > 32\n  )\n    throw new Error(\"BAD_BUDGET\");\n  const results = new Array(entries.length);\n  let next = 0;\n  async function work() {\n    for (;;) {\n      const index = next++;\n      if (index >= entries.length) return;\n      const [id, raw] = entries[index];\n      try {\n        const event = fields(raw);\n        const result = await createOrder(\n          pool,\n          sale,\n          event.user,\n          event.reservation,\n        );\n        await afterCommit(result);\n        await redis.command(\"XACK\", keys(sale).stream, GROUP, id);\n        results[index] = { ok: true, id, result };\n      } catch (error) {\n        results[index] = { ok: false, id, error: String(error) };\n      }\n    }\n  }\n  await Promise.all(\n    Array.from({ length: Math.min(concurrency, entries.length) }, work),\n  );\n  return results;\n}\nexport async function consume(pool, redis, sale, options = {}) {\n  const data = await redis.command(\n    \"XREADGROUP\",\n    \"GROUP\",\n    GROUP,\n    \"worker-a\",\n    \"COUNT\",\n    32,\n    \"STREAMS\",\n    keys(sale).stream,\n    \">\",\n  );\n  return processEntries(pool, redis, sale, data?.[0]?.[1] ?? [], options);\n}\nexport async function reclaim(\n  pool,\n  redis,\n  sale,\n  { idleMs = 30000, cursor = \"0-0\", ...options } = {},\n) {\n  if (!Number.isInteger(idleMs) || idleMs < 0 || typeof cursor !== \"string\")\n    throw new Error(\"BAD_RECLAIM\");\n  const data = await redis.command(\n    \"XAUTOCLAIM\",\n    keys(sale).stream,\n    GROUP,\n    \"worker-recovery\",\n    idleMs,\n    cursor,\n    \"COUNT\",\n    32,\n  );\n  return {\n    cursor: data[0],\n    results: await processEntries(pool, redis, sale, data[1], options),\n  };\n}"
        },
        {
          "type": "paragraph",
          "text": "这里的2是实验预算，不是压测得出的生产推荐值。processEntries限制单次调用的活跃处理器；同一进程并行启动多次调用、多台实例同时消费时，总并发会相加。部署必须统一预算，例如控制实例数×每实例消费并发，再限制数据库连接池总数，不能每个实例都开很大的池然后期待它们自动协调。"
        },
        {
          "type": "paragraph",
          "text": "XAUTOCLAIM把空闲足够久的pending交给恢复消费者，但不会杀死旧worker。测试的idleMs=0只在旧处理器已经确定结束后使用；生产要给正常处理留预算，保留cursor持续扫描，并承认旧、新处理器可能重叠。重复写库由请求UUID与用户唯一约束防护，不是由“抢到消息”等同于获得永久独占权。毒消息、最大投递次数、死信和自动长期监督在本文没有交付，要单独设计。"
        },
        {
          "type": "reference",
          "title": "Redis：XAUTOCLAIM恢复未确认消息",
          "url": "https://redis.io/docs/latest/commands/xautoclaim/",
          "note": "恢复需要处理返回游标；pending所有权变化不等于旧业务进程被终止。"
        },
        {
          "type": "paragraph",
          "text": "队列的可靠性还要包括持久化。本地Redis采用AOF和appendfsync always，实验真正停止并重启自有进程，观察预占与pending保留。它不能证明断电、磁盘损坏或主从切换不丢数据；Redis异步复制与WAIT也不能自动变成强一致共识。若产品不能接受这一持久边界，应改变接受承诺或使用更强的持久接入方案。"
        },
        {
          "type": "reference",
          "title": "Redis：复制、WAIT与故障切换边界",
          "url": "https://redis.io/docs/latest/operate/oss_and_stack/management/replication/",
          "note": "本地重启不是复制集故障转移证明。"
        }
      ]
    },
    {
      "id": "payment",
      "title": "支付与关闭：竞争同一个旧状态，库存只移动一次",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下单后预占库存，支付确认把预占移到已售，超时关闭把预占移回可用。两个动作都必须从PENDING_PAYMENT出发，并在同一个数据库事务里修改订单与库存。谁先成功转换状态，另一个就影响0行，不再动库存；重复回调和重复关闭也不会反复扣加。"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/service.mjs",
          "language": "javascript",
          "kind": "excerpt",
          "purpose": "完整状态转换：支付/关闭条件更新、库存同行事务、关闭时写入释放意图。此函数只接收假定已验证的业务支付通知，不实现支付渠道验签。",
          "code": "export async function transition(pool, orderId, target) {\n  if (!uuid.test(orderId) || ![\"PAID\", \"CLOSED\"].includes(target))\n    throw new Error(\"BAD_TRANSITION\");\n  return transaction(pool, async (db) => {\n    const expiration =\n      target === \"CLOSED\" ? \" AND expires_at<=clock_timestamp()\" : \"\";\n    const changed = await db.query(\n      `UPDATE orders SET status=$2\n      WHERE id=$1 AND status='PENDING_PAYMENT'${expiration} RETURNING sale_id`,\n      [orderId, target],\n    );\n    if (!changed.rowCount) return false;\n    const sale = changed.rows[0].sale_id;\n    if (target === \"PAID\") {\n      await db.query(\n        \"UPDATE sales SET reserved=reserved-1,sold=sold+1 WHERE id=$1\",\n        [sale],\n      );\n    } else {\n      await db.query(\n        \"UPDATE sales SET reserved=reserved-1,available=available+1 WHERE id=$1\",\n        [sale],\n      );\n      await db.query(\n        \"INSERT INTO releases(id,order_id,sale_id) VALUES($1,$2,$3)\",\n        [randomUUID(), orderId, sale],\n      );\n    }\n    return true;\n  });\n}"
        },
        {
          "type": "paragraph",
          "text": "支付示例没有连真实支付渠道。线上还必须验证签名、商户、订单金额与币种，按渠道协议查询和关单。即使用户在10分钟内付钱，回调也可能在本地关闭后才到；不能因为收到一个成功通知，就无条件把CLOSED改回PAID，因为库存可能已经分给别人。例子返回false，生产要进一步区分已支付重复、已关闭待对账等原因，并在无法履约时进入退款流程。"
        },
        {
          "type": "paragraph",
          "text": "关闭任务应由持久调度和补扫保证最终执行，不依赖应用进程里一个10分钟setTimeout。本文测试把expires_at改为过去时间，明确验证状态竞争；没有等待真实10分钟，也没有把这个受控时间输入声称为完整延迟调度器。"
        }
      ]
    },
    {
      "id": "release",
      "title": "释放也会重试：用Outbox与事件去重避免重复加名额",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "只把数据库可用加1还不够，Redis入口也要知道名额恢复。但不能在数据库事务中指望Redis一起提交。我们在关闭事务里插入releases事件，之后中继先给Redis应用，再标记applied。若Redis不可达，事件留待重试；若Redis成功后、数据库标记前崩溃，同一个事件ID重放时必须不再加一次。"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/lua.mjs",
          "language": "lua",
          "kind": "excerpt",
          "purpose": "完整名额释放Lua：同事件先查applied映射，未执行才加一并登记；用户参与记录不删除，保留本场一人一单规则。 这里直接展示Lua正文；JavaScript的字符串包装与export位于同一下载文件。",
          "code": "if redis.call('TYPE', KEYS[1]).ok ~= 'string' then\n  return redis.error_reply('STOCK_NOT_INITIALIZED')\nend\nlocal appliedType = redis.call('TYPE', KEYS[2]).ok\nif appliedType ~= 'none' and appliedType ~= 'hash' then\n  return redis.error_reply('BAD_KEY_TYPE')\nend\nlocal stock = tonumber(redis.call('GET', KEYS[1]))\nif not stock or stock < 0 or stock % 1 ~= 0 then\n  return redis.error_reply('BAD_STOCK')\nend\nif redis.call('HEXISTS', KEYS[2], ARGV[1]) == 1 then return 0 end\nredis.call('INCR', KEYS[1])\nredis.call('HSET', KEYS[2], ARGV[1], 'applied')\nreturn 1"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/service.mjs",
          "language": "javascript",
          "kind": "excerpt",
          "purpose": "完整单活动、有界释放中继。数据库中的event.id作为Redis去重键，Redis成功但标记失败可再次执行。",
          "code": "export async function releaseToRedis(pool, redis, sale, hooks = {}) {\n  keys(sale);\n  const events = (\n    await pool.query(\n      \"SELECT * FROM releases WHERE applied=false AND sale_id=$1 ORDER BY id LIMIT 32\",\n      [sale],\n    )\n  ).rows;\n  for (const event of events) {\n    const k = keys(event.sale_id);\n    await redis.command(\"EVAL\", releaseLua, 2, k.stock, k.releases, event.id);\n    await hooks.afterRedis?.();\n    await pool.query(\"UPDATE releases SET applied=true WHERE id=$1\", [\n      event.id,\n    ]);\n  }\n  return events.length;\n}"
        },
        {
          "type": "figure",
          "src": "figures/flash-sale/recovery.svg",
          "title": "接受、提交和确认是三个不同的恢复位置",
          "alt": "预占与Stream写入位于Redis内；DB提交订单后才ACK，提交到ACK之间崩溃可重投；订单从待支付走向PAID或CLOSED；关闭与释放Outbox同DB事务，Redis释放后未标记的窗口按事件ID去重。",
          "caption": "预占与Stream写入位于Redis内；DB提交订单后才ACK，提交到ACK之间崩溃可重投；订单从待支付走向PAID或CLOSED；关闭与释放Outbox同DB事务，Redis释放后未标记的窗口按事件ID去重。 图为教学结构／顺序示意，不代表实测耗时或生产容量。"
        },
        {
          "type": "paragraph",
          "text": "该Outbox只解决“数据库确认关闭，Redis尚未恢复名额”的窗口。它不自动解决任意Redis数据丢失。如果stock或释放去重映射丢失，不能随手把剩余库存重置后继续重放旧事件，否则可能把一次释放重复算进去。生产重建应冻结准入、使用可追溯活动代际并核对权威订单与未完成预占；这个完整重建协议不在本例交付范围。"
        },
        {
          "type": "paragraph",
          "text": "Lua原子执行也不等于错误自动回滚。实验故意先DECR，再对同一个字符串执行HSET，引发WRONGTYPE，最后确认前面的扣减仍然存在。正式脚本因此先检查类型、参数和容量，再进行写入；内存不足等写入阶段失败仍需要异常检测、停止入口与核对，不能把“一个Lua脚本”当成覆盖所有故障的SQL事务。"
        },
        {
          "type": "reference",
          "title": "Redis官方仓库：Lua错误不会自动回滚",
          "url": "https://github.com/redis/redis/issues/10576",
          "note": "Redis维护者说明已执行写入不会因后续脚本错误自动回滚。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "怎样复现：让正常、竞争和失败都留下证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端 · 解压后的flash-sale目录",
          "language": "bash",
          "kind": "runnable",
          "purpose": "需要指定版本的Node、PostgreSQL和Redis；测试会创建自己的临时实例，不使用用户现有数据库或Redis。",
          "code": "cd flash-sale\nnpm ci --ignore-scripts\nnpm test\n# tests 12; pass 12; fail 0\n# 非默认PG目录：PG_BIN=/your/postgresql17/bin npm test"
        },
        {
          "type": "table",
          "headers": [
            "实验",
            "实际断言"
          ],
          "rows": [
            [
              "两个独立GET/DECR",
              "初始1，两个GET先完成，最终-1，复现错误交错"
            ],
            [
              "Lua最后一件与重试",
              "16人只有1个新预占；其余15售罄；重试返回原UUID，不多加事件"
            ],
            [
              "筛选与受控消费",
              "20人、5件，只生成5个事件；屏障确认活跃处理器峰值2；数据库5张订单"
            ],
            [
              "数据库真实等锁",
              "pg_blocking_pids确认B等A；A提交后B更新0行"
            ],
            [
              "回滚、请求与用户去重",
              "提交前异常恢复库存；同编号并发与换编号同用户仍1单"
            ],
            [
              "Redis／DB数量不一致",
              "Redis允许申请而DB库存0，最终SOLD_OUT且没有订单，不超卖"
            ],
            [
              "有界接收",
              "历史事件上限1时第二人BUSY，库存与参与记录不变"
            ],
            [
              "提交到ACK的恢复",
              "故意提交后抛错；真实重启Redis；pending重领后仍1单、1次预占"
            ],
            [
              "支付与关闭竞争",
              "两个并发转换恰好一个成功；重复动作不再修改库存"
            ],
            [
              "释放Outbox重放",
              "Redis加回后抛错，重复中继不再加名额；新用户可以参与"
            ],
            [
              "Lua运行时错误",
              "预检查挡住错类型；刻意错误脚本证明先前写入不回滚"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "2026-10-25在macOS14.5 x64、Node22.12.0、PostgreSQL17.4、Redis7.0.4、pg8.13.1和node-redis4.7.0实际运行，11组子场景加父测试共12项通过。并发顺序使用Promise屏障、数据库阻塞关系或明确结束的处理器控制，没有凭一次随机运行猜“应该成功”。20人／5件是正确性输入，不是压测，也没有据此宣称百万QPS或性能提升倍数。"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/test.mjs",
          "language": "javascript",
          "kind": "excerpt",
          "purpose": "真实提交到ACK故障窗口、Redis进程重启及pending恢复测试；零空闲只在旧处理器已结束时使用。",
          "code": "await t.test(\n          \"DB commit / ACK crash window survives owned Redis restart and reclaims idempotently\",\n          async () => {\n            const k = await seed(\"restart\", 1);\n            const accepted = await admit(redis, \"restart\", \"alice\");\n            const first = await consume(pool, redis, \"restart\", {\n              afterCommit() {\n                throw new Error(\"controlled before ACK\");\n              },\n            });\n            assert.equal(first[0].ok, false);\n            assert.equal(\n              (await redis.command(\"XPENDING\", k.stream, \"orders\"))[0],\n              1,\n            );\n            assert.equal((await invariant(\"restart\")).reserved, 1);\n            await redis.stop();\n            await assert.rejects(\n              admit(redis, \"restart\", \"bob\"),\n              /REDIS_UNAVAILABLE/,\n            );\n            await redis.start();\n            assert.deepEqual(await admit(redis, \"restart\", \"alice\"), [\n              \"EXISTING\",\n              accepted[1],\n            ]);\n            // The previous handler has ended. Zero idle is solely a deterministic test/recovery control.\n            const recovered = await reclaim(pool, redis, \"restart\", {\n              idleMs: 0,\n            });\n            assert.ok(recovered.results[0].ok);\n            assert.equal(\n              (await pool.query(\"SELECT * FROM orders WHERE sale_id='restart'\"))\n                .rowCount,\n              1,\n            );\n            assert.equal(\n              (await redis.command(\"XPENDING\", k.stream, \"orders\"))[0],\n              0,\n            );\n            assert.equal((await invariant(\"restart\")).reserved, 1);\n          },\n        );"
        },
        {
          "type": "code",
          "filename": "examples/flash-sale/test.mjs",
          "language": "javascript",
          "kind": "excerpt",
          "purpose": "真实最后一件与重复请求实验：不是预设返回值，直接查询Redis名额和事件数量。",
          "code": "await t.test(\n          \"Lua admits one of sixteen; duplicates reuse the ID and never add events\",\n          async () => {\n            const k = await seed(\"last\", 1);\n            const answers = await Promise.all(\n              Array.from({ length: 16 }, (_, i) =>\n                admit(redis, \"last\", \"u-\" + i),\n              ),\n            );\n            assert.equal(answers.filter((a) => a[0] === \"RESERVED\").length, 1);\n            assert.equal(answers.filter((a) => a[0] === \"SOLD_OUT\").length, 15);\n            const user = \"u-\" + answers.findIndex((a) => a[0] === \"RESERVED\"),\n              id = answers.find((a) => a[0] === \"RESERVED\")[1];\n            assert.deepEqual(await admit(redis, \"last\", user), [\n              \"EXISTING\",\n              id,\n            ]);\n            assert.equal(await redis.command(\"XLEN\", k.stream), 1);\n            assert.equal(await redis.command(\"GET\", k.stock), \"0\");\n            assert.equal((await invariant(\"last\")).reserved, 0); // Redis qualification is not an order.\n          },\n        );"
        },
        {
          "type": "paragraph",
          "text": "PG只监听临时目录内的Unix socket，端口标识55486；Redis只启动自有127.0.0.1:56390，并检查其版本。测试不读取DATABASE_URL，不连用户5432或6379，不执行FLUSHALL。夹具只清理自己创建的资源；无法确认服务退出就保留目录并报错。完整夹具、测试和锁文件都在下载包，服务端运行依赖需本地安装，GitHub Pages只能离线带走源码。"
        }
      ]
    },
    {
      "id": "tradeoffs",
      "title": "回到设计取舍：先确定承诺，再决定增加哪些组件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "小规模活动可以从短事务、唯一约束、入口限流开始。只有受控压测证明库存热点或入库吞吐成为瓶颈，再引入名额预占与有界队列。采用异步后，需要接受“已排队并非已成单”的产品语义，以及pending恢复、补偿和对账的运行成本。把所有组件画上架构图，并不会自动得到一个更可靠的商城。"
        },
        {
          "type": "table",
          "headers": [
            "必须继续考虑的生产项",
            "为什么不能由本例推定完成"
          ],
          "rows": [
            [
              "网关与全局预算",
              "本例验证单次有限批次；没有运行多副本联合限流"
            ],
            [
              "公平与反机器人",
              "同Redis执行顺序不等于全网点击顺序，用户身份仍需验证"
            ],
            [
              "队列保留与毒任务",
              "历史上限保守拒绝；未交付长期清理、退避和死信控制器"
            ],
            [
              "支付与超时调度",
              "仅验证状态竞争和晚支付不复活；未接真实渠道或延迟任务平台"
            ],
            [
              "Redis容量和故障切换",
              "本地AOF重启通过，不证明OOM、磁盘故障、Cluster或复制丢失恢复"
            ],
            [
              "生产吞吐",
              "需测请求拒绝率、入场速率、pending年龄、锁等待、连接池等待和数据库尾延迟"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "如果改用RabbitMQ，要开启符合队列类型和持久策略的发布确认，消费者仍在提交后确认并处理重投；队列达到长度上限时要明确选择拒绝发布等策略，不能默认认为设置上限就不会丢旧任务。发布确认不代表订单已经完成，数据库Outbox也只覆盖由它实际记录的发布意图。这些规则在Redis Stream之外仍然成立。"
        },
        {
          "type": "reference",
          "title": "RabbitMQ：确认与重复投递",
          "url": "https://www.rabbitmq.com/docs/confirms",
          "note": "发布确认和消费确认是不同阶段，业务去重仍由应用负责。"
        },
        {
          "type": "reference",
          "title": "RabbitMQ：队列容量与溢出策略",
          "url": "https://www.rabbitmq.com/docs/maxlength",
          "note": "最大长度、未确认消息和溢出策略各有范围，不能无限堆积。"
        },
        {
          "type": "paragraph",
          "text": "现在可以把整条链用自己的话说清：数据库条件更新与事务保证最终库存正确；入口预算和Redis预占减少进入数据库的申请；有限队列与受控消费者限制积压；请求编号、状态转换与Outbox让重试不重复产生效果；故障与容量超出承诺时拒绝并核对，而不是偷偷绕过保护。每一项都应有对应代码和实验，而不是只背几个组件名字。"
        }
      ]
    }
  ]
};
export default article;
