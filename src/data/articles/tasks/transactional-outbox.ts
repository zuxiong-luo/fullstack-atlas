import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "transactional-outbox",
  "topic": "tasks",
  "title": "Outbox 与跨系统一致性：数据库提交后怎样可靠发出消息",
  "description": "把订单和待发事件放进本库事务，再真实杀死发布者与消费者，验证重复传输怎样通过本地回执收敛为一次余额效果。",
  "minutes": 36,
  "labMinutes": 40,
  "tags": [
    "Outbox",
    "Inbox",
    "PostgreSQL",
    "Redis Streams",
    "幂等",
    "崩溃恢复"
  ],
  "scope": "PostgreSQL17.4加Redis7.0.4单节点恢复实验。生产与消费使用同临时PG实例的不同表和独立事务，Redis始终在事务之外；不声称跨数据库两阶段提交或全链路exactly-once。",
  "prerequisites": [
    "了解HTTP、异步函数与错误处理",
    "数据库专题需要基本SQL与事务知识"
  ],
  "questionIds": [],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "PostgreSQL17.4",
    "Redis server/cli7.0.4",
    "Node.js22.12.0",
    "macOS14.5 x86_64"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    { "label": "完整源码 ZIP", "path": "transactional-outbox.zip" },
    {
      "label": "完整隔离实验、测试和运行说明",
      "path": "transactional-outbox/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "Outbox是什么：把待通知意图先变成数据库事实",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "事务Outbox是在业务数据库里保存“这次业务提交后需要发出的事件”，并让它与业务变更在同一个本地事务中提交。之后由独立中继扫描待发记录，发送给消息代理，再标记发布状态。它把不可恢复的一句“提交后记得发消息”，变成了数据库里可查询、可重试的事实。"
        },
        {
          "type": "paragraph",
          "text": "它解决的是双写窗口：先提交订单，进程在发送消息前崩溃，下游不知道订单存在；先发消息，再提交订单，数据库回滚后下游却处理了不存在的订单。交换两条语句的顺序不能同时消除这两个窗口。Outbox选择先把订单与通知意图共同提交，让后续发布可以恢复。"
        },
        {
          "type": "paragraph",
          "text": "本文订单order-42对应金额10，消费者收到事件后给教学余额增加10。中继在XADD成功、发布标记提交前被SIGKILL；消费者在数据库效果提交、ACK前也被SIGKILL。我们不躲开重复，而是让重复真实发生，再用消费者本地事务证明最终余额只加一次。"
        },
        {
          "type": "reference",
          "title": "AWS官方模式说明：事务Outbox与双写窗口",
          "url": "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "先画原子边界，再看哪些地方会失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/transactional-outbox/windows.svg",
          "title": "两个本地提交与两个跨系统窗口",
          "alt": "订单与Outbox共同提交；发布后标记前死亡会重复XADD。消费回执与余额共同提交；提交后ACK前死亡会重投，业务事件ID让重复不再加余额。",
          "caption": "实际测试杀死自己的子进程。生产与消费为同一个教学PG实例中的不同逻辑表/独立事务，没有利用一个事务跨Redis提交。"
        },
        {
          "type": "paragraph",
          "text": "第一个原子边界是orders和outbox；第二个原子边界是inbox和wallet。Redis发布和确认都不在这两个数据库事务里。这样划分后，有些窗口被变成可恢复状态，有些窗口仍会产生重复；不能因为图中画了两个框，就宣称跨系统已经存在一个共同COMMIT。"
        },
        {
          "type": "paragraph",
          "text": "Stream ID标识一次传输，event_id标识一次业务事件。中继重试同一Outbox记录时必须沿用event_id；若每次重新生成业务ID，下游会认为每次都是新意图。生产还要确定事件ID范围、实体版本和schema版本，本例只有固定账户和整数amount，缩小到能完整验证的契约。"
        }
      ]
    },
    {
      "id": "schema",
      "title": "本库事务先确保订单与意图一起出现",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "CREATE TABLE orders(id text PRIMARY KEY,amount integer NOT NULL CHECK(amount BETWEEN 1 AND 999999));\nCREATE TABLE outbox(\n  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  event_id text UNIQUE NOT NULL,\n  amount integer NOT NULL CHECK(amount BETWEEN 1 AND 999999),\n  published_at timestamptz\n);\nCREATE TABLE inbox(event_id text PRIMARY KEY,amount integer NOT NULL CHECK(amount BETWEEN 1 AND 999999));\nCREATE TABLE wallet(id integer PRIMARY KEY,balance bigint NOT NULL);\nINSERT INTO wallet VALUES(1,0);\nCREATE FUNCTION place_order(p_id text,p_amount integer) RETURNS void LANGUAGE plpgsql AS $$\nBEGIN\n  IF p_id!~'^[a-z0-9-]{1,40}$' THEN RAISE EXCEPTION 'BAD_ID'; END IF;\n  INSERT INTO orders VALUES(p_id,p_amount);\n  INSERT INTO outbox(event_id,amount) VALUES(p_id||'-created',p_amount);\nEND $$;\nCREATE FUNCTION consume_event(p_id text,p_amount integer) RETURNS text LANGUAGE plpgsql AS $$\nDECLARE previous integer;\nBEGIN\n  IF p_id!~'^[a-z0-9-]{1,60}$' OR p_amount NOT BETWEEN 1 AND 999999 THEN RAISE EXCEPTION 'BAD_AMOUNT'; END IF;\n  INSERT INTO inbox VALUES(p_id,p_amount) ON CONFLICT DO NOTHING;\n  IF FOUND THEN\n    UPDATE wallet SET balance=balance+p_amount WHERE id=1;\n    IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_MISSING'; END IF;\n    RETURN 'applied';\n  END IF;\n  SELECT amount INTO previous FROM inbox WHERE event_id=p_id;\n  IF previous<>p_amount THEN RAISE EXCEPTION 'EVENT_ID_CONFLICT'; END IF;\n  RETURN 'duplicate';\nEND $$;",
          "language": "sql",
          "filename": "examples/transactional-outbox/schema.sql",
          "purpose": "完整DDL和两个关键函数：place_order写订单+Outbox；consume_event写Inbox+余额，所有决定正确性的分支在正文。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "place_order先验证订单ID，再插入orders和outbox。一次SELECT place_order运行在数据库事务中；显式BEGIN还可以把它与其他本库写入一起提交。测试故意在函数之后执行1/0，确认订单和Outbox都为0，Redis也没有消息。正常提交后订单1、待发记录1，但Redis仍0，说明此时承诺是“通知意图已保存”，不是“下游已完成”。"
        },
        {
          "type": "paragraph",
          "text": "金额限制1到999999，ID限制小写字母、数字与连字符，目的是让发布者和消费者共享一套最小有效输入。真实应用要有币种、账户、权限与schema兼容规则。订单ID主键拒绝重复插入，但这里没有完整HTTP下单回执接口；不能把一个唯一约束直接说成已完成所有请求内容比较和结果查询。"
        },
        {
          "type": "paragraph",
          "text": "Outbox中的sequence用于扫描先后，event_id用于业务去重。published_at只是中继按当前协议记录的状态，不是下游业务处理成功。生产通常还需要重试次数、失败原因、事件版本和保留期限；本篇不把这些列名堆上去冒充已经实现监控平台。"
        }
      ]
    },
    {
      "id": "relay",
      "title": "领取待发记录：锁住本条，发布后再标记",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {session} from './postgres.mjs';\nimport {redis} from './redis.mjs';\nexport async function relayOnce({crashAfterPublish=false}={}) {\n  const connection=session('outbox-relay');\n  let ended=false;\n  try {\n    connection.send(\"BEGIN; SELECT json_build_object('id',event_id,'amount',amount) FROM outbox WHERE published_at IS NULL ORDER BY sequence FOR UPDATE SKIP LOCKED LIMIT 1;\\n\\\\echo SELECTED\");\n    const output=await connection.wait('SELECTED');\n    const line=output.split('\\n').find(x=>x.startsWith('{'));\n    if(!line){await connection.end();ended=true;return null;}\n    const event=JSON.parse(line);\n    if(!/^[a-z0-9-]{1,60}$/.test(event.id)||!Number.isSafeInteger(event.amount)||event.amount<=0)throw new Error('BAD_EVENT');\n    const streamId=await redis('XADD','events','*','event',event.id,'amount',event.amount);\n    if(crashAfterPublish)process.kill(process.pid,'SIGKILL');\n    const result=await connection.end(`UPDATE outbox SET published_at=clock_timestamp() WHERE event_id='${event.id}'; COMMIT;`);\n    ended=true;if(result.code!==0)throw new Error(result.error);\n    return {event,streamId};\n  } finally {if(!ended)await connection.end();}\n}\nif(process.argv.includes('--once'))await relayOnce({crashAfterPublish:process.argv.includes('--crash-after-publish')});",
          "language": "js",
          "filename": "examples/transactional-outbox/relay.mjs",
          "purpose": "完整一次中继：FOR UPDATE SKIP LOCKED领取一条，XADD后才更新并COMMIT；受控故障点对自己SIGKILL。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "中继开启一个独立psql会话，读取已提交、published_at为空的最早候选，并FOR UPDATE SKIP LOCKED。未提交的新订单对它不可见；其他中继锁住的记录会被跳过。这个行为适合争领队列工作，但本次返回空不代表系统所有待发记录都不存在，也可能是尚未提交或被其他处理者占着。"
        },
        {
          "type": "paragraph",
          "text": "读取之后，父逻辑等待SELECTED屏障，从实际JSON输出取得event_id和amount。它不在多个短连接之间假装持有同一把事务锁。XADD成功后，在这个仍开的数据库会话里更新published_at并COMMIT；如果Redis返回错误，finally回滚，让记录保留待发。"
        },
        {
          "type": "paragraph",
          "text": "本实现发布期间保持一把数据库行锁和一个连接，适合小型明确示例。慢broker会延长事务，生产可选择短事务租约、CDC等方式，但那会引入租约过期、旧持有者和恢复协议。不能只把锁去掉，就当作性能优化而保留相同正确性结论。"
        },
        {
          "type": "paragraph",
          "text": "示例用经过严格格式限制的夹具值拼SQL，方便无npm依赖运行；真实驱动应使用绑定参数。pg与redis辅助仅连接55442和56381的私有实例，完整辅助随ZIP提供，不会读取你现有数据库账号或向5432/6379发命令。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：锁定查询与SKIP LOCKED限制",
          "url": "https://www.postgresql.org/docs/17/sql-select.html"
        }
      ]
    },
    {
      "id": "publish-window",
      "title": "XADD成功以后死掉，为什么仍要再发布",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "故障点准确放在await redis(XADD)返回之后，更新数据库标记之前。进程收到SIGKILL，不会执行JavaScript的finally。它的psql输入管道关闭，数据库连接结束后未提交事务回滚。测试明确等pg_stat_activity里的outbox-relay连接消失，才判断行锁和未提交状态已经释放。"
        },
        {
          "type": "paragraph",
          "text": "此时Redis里有1条消息，outbox仍有1条待发记录。恢复中继再次领取同一event_id，产生另一个Stream ID，Redis长度变成2，然后published_at提交。再跑中继返回空，表示当前受控样本已没有可领工作。两条传输记录不是bug被隐藏，而是跨系统确认窗口的真实结果。"
        },
        {
          "type": "code",
          "code": "  await t.test('publisher dies after XADD, leaving intent retryable; recovery duplicates transport',async()=>{\n    await crash('relay.mjs','--crash-after-publish');\n    await until(async()=>await sql(\"SELECT count(*) FROM pg_stat_activity WHERE application_name='outbox-relay';\")==='0','crashed publisher database connection closed');\n    assert.equal(await redis('XLEN','events'),1);\n    assert.equal(await sql('SELECT count(*) FROM outbox WHERE published_at IS NULL;'),'1');\n    await relayOnce();assert.equal(await redis('XLEN','events'),2);\n    assert.equal(await sql('SELECT count(*) FROM outbox WHERE published_at IS NOT NULL;'),'1');\n    assert.equal(await relayOnce(),null);\n  });",
          "language": "js",
          "filename": "examples/transactional-outbox/test.mjs",
          "purpose": "实际发布后死亡与恢复测试：验证子进程SIGKILL、数据库会话回收、重复传输和发布状态。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "若在XADD前就标记已发，崩溃可能留下永远不再发送的记录，丢消息窗口又回来了。选择先发后标记，是接受可识别重复以换取可重试恢复；这个取舍必须由消费者幂等承接，而不是对外宣称每条消息物理上只出现一次。"
        }
      ]
    },
    {
      "id": "consumer",
      "title": "消费者Inbox与业务效果必须同库同事务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {sql} from './postgres.mjs';\nimport {redis,firstMessage} from './redis.mjs';\nexport async function consume(message,{crashAfterCommit=false}={}) {\n  const [streamId,fields]=message;\n  const event=Object.fromEntries(Array.from({length:fields.length/2},(_,i)=>[fields[i*2],fields[i*2+1]]));\n  if(!/^[a-z0-9-]{1,60}$/.test(event.event)||!/^\\d{1,6}$/.test(event.amount))throw new Error('BAD_EVENT');\n  // Trusted bounded fixture values; production driver must bind parameters.\n  const result=await sql(`SELECT consume_event('${event.event}',${Number(event.amount)});`,'outbox-consumer');\n  if(crashAfterCommit)process.kill(process.pid,'SIGKILL');\n  await redis('XACK','events','wallet-workers',streamId);\n  return result;\n}\nif(process.argv.includes('--once')) {\n  const message=firstMessage(await redis('XREADGROUP','GROUP','wallet-workers','consumer-a','COUNT',1,'STREAMS','events','>'));\n  if(!message)throw new Error('NO_MESSAGE');\n  await consume(message,{crashAfterCommit:process.argv.includes('--crash-after-commit')});\n}",
          "language": "js",
          "filename": "examples/transactional-outbox/consumer.mjs",
          "purpose": "完整消费路径：先由本地数据库函数提交回执与效果，再XACK；故障点放在数据库已提交、确认前。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "consume_event先尝试插入以event_id为主键的inbox。如果插入成功，更新wallet并返回applied；如果已经存在，比较已记录amount，相同返回duplicate，不再加余额；不同报EVENT_ID_CONFLICT。缺wallet也抛错误，使回执插入回滚，避免凭空记“处理完了”却没产生效果。"
        },
        {
          "type": "paragraph",
          "text": "INSERT ... ON CONFLICT负责竞争同一个唯一键，但不替你比较业务内容。默认Read Committed下，重复处理会走既有回执判断。若修改隔离级别或增加其他并发规则，还需要处理相应事务冲突。本篇不把“插入失败就忽略”当作完整幂等。"
        },
        {
          "type": "paragraph",
          "text": "测试在consume_event成功返回后杀死消费者，此时SQL的隐式事务已经提交，wallet是10而PEL仍是1。确认进程已死后，以零空闲阈值重领，得到duplicate再ACK；再读取另一个Stream ID但同event_id的记录，也返回duplicate。最后wallet10、inbox1、PEL0。"
        },
        {
          "type": "paragraph",
          "text": "为方便安装，生产表与消费表放在同一临时PG实例里，但使用不同连接和独立事务；消费函数只依赖自己的inbox/wallet，不与订单或中继共享一个跨系统事务。没有声称测试跨两台数据库或网络分区。真正拆服务时，要保留“回执和消费效果在消费者自己的本库事务里”这个约束。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：ON CONFLICT与唯一性",
          "url": "https://www.postgresql.org/docs/17/sql-insert.html"
        }
      ]
    },
    {
      "id": "failures",
      "title": "失败不只有重复，还包括内容冲突与局部回滚",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "同事件ID换amount=99会被拒绝，余额保持10。它不是一个应当无限重试的暂时错误，而是业务身份和内容不一致，应进入告警、隔离或人工核对。只有明确确认相同业务意图，才可以复用旧结果。"
        },
        {
          "type": "paragraph",
          "text": "另一个用例先执行consume_event(other-created,7)，再在同事务执行1/0。结果余额仍10，这个事件的inbox记录也不存在。这个测试直接证明“业务回执和效果一起回滚”，避免只测两次正常调用后误以为原子性已经成立。"
        },
        {
          "type": "paragraph",
          "text": "测试还在一个未提交事务里新增future订单，中继读不到；提交后由另一个会话锁住对应Outbox，中继SKIP LOCKED也跳过；释放后才成功发送。这些都是实际屏障和锁状态，没有靠睡眠推断事务已经处在某一步。"
        },
        {
          "type": "paragraph",
          "text": "Inbox只能保护同一数据库里的效果。若函数里先给外部邮件服务发信再插回执，数据库回滚不会收回邮件；若先提交回执再发信，崩溃又可能漏信。需要给外部服务提供稳定幂等键、查询协议或进一步的本地Outbox，不要把本例wallet加法的证明扩大到所有外部动作。"
        }
      ]
    },
    {
      "id": "guarantees",
      "title": "到底保证了什么，还依赖哪些条件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Outbox让业务提交与发布意图原子出现，中继使待发状态可恢复，消费者Inbox让同一业务事件的本库效果可去重。它们组合后能在明确持久化和重试前提下收敛，不等于消息代理、数据库和外部副作用共享一个恰好一次承诺。"
        },
        {
          "type": "paragraph",
          "text": "如果Redis确认后又在故障切换中丢失已确认数据，PG记录可能已经标记已发；没有额外对账就不会自动知道要重放。本文启用单节点AOF always，只验证受控进程恢复，不证明磁盘断电、复制多数确认或跨机故障。生产应明确broker确认语义、持久化和恢复范围，必要时保留事件并做对账。"
        },
        {
          "type": "paragraph",
          "text": "SKIP LOCKED并行中继还可能打乱同一业务实体的发布完成顺序。扫描sequence不是端到端排序保证；消费者若依赖版本先后，需要实体序号、分区串行或状态机。回执与已发记录的保留也影响历史重放：过早清理去重记录，旧消息可能再次产生效果。"
        },
        {
          "type": "paragraph",
          "text": "数据库索引、批量领取、连接预算、毒事件隔离、回执清理和监控都需要按负载设计。本例保留一个短小的一次中继入口，故障点能逐行定位；没有持续守护进程、调度器、死信产品或生产SLA。读者应先把这条正确性链跑通，再增加容量和运维机制。"
        }
      ]
    },
    {
      "id": "run",
      "title": "复现自己的崩溃，不接触已有数据库",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/transactional-outbox\nnvm use\nnpm ci\nredis-server --version\nredis-cli --version\nPG_BIN=/Library/PostgreSQL/17/bin npm test\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "PostgreSQL17.4、Redis7.0.4、Node22.12.0；用55442与56381私有临时实例，不可和message-delivery同时运行。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "六个子场景全部通过，Node含父测试7项。订单和意图共同回滚、发布后SIGKILL、消费后SIGKILL、Inbox局部回滚、内容冲突、未提交/已锁记录跳过都已实际执行。最终核心恢复用例为两条传输、余额10、回执1、PEL0，没有隐藏重复，也没有依靠固定sleep猜时序。"
        },
        {
          "type": "paragraph",
          "text": "测试只杀自己的relay/consumer子进程，未杀数据库或用户服务。PG和Redis正常结束后清理私有目录与AOF；OS强杀整个测试或断电不保证finally。SVG本机渲染检查和站点手机浏览器验收分别记录；依赖安装、服务启动和持久化不是文章离线下载自动提供的能力。"
        },
        {
          "type": "paragraph",
          "text": "从一个订单开始，把提交点、确认点和崩溃点逐个标出来，你就能解释为什么有些失败该重试、有些需要去重、有些必须人工核对。可靠性不是承诺“永远没有重复”，而是让已说明的失败在可观测、可恢复的规则下继续前进。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "事务Outbox模式",
      "url": "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"
    },
    {
      "title": "PG17 SELECT锁",
      "url": "https://www.postgresql.org/docs/17/sql-select.html"
    },
    {
      "title": "PG17 INSERT冲突",
      "url": "https://www.postgresql.org/docs/17/sql-insert.html"
    },
    {
      "title": "Redis7配置",
      "url": "https://raw.githubusercontent.com/redis/redis/7.0.4/redis.conf"
    },
    {
      "title": "Redis XACK",
      "url": "https://redis.io/docs/latest/commands/xack/"
    }
  ]
};
export default article;
