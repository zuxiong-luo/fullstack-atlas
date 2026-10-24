import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "database-locks-deadlocks",
  "topic": "data",
  "title": "数据库锁与死锁：锁范围、等待关系和重试",
  "description": "从锁的兼容性与事务生命周期出发，观察普通读、锁定读、表锁和双向转账死锁，再验证统一顺序及完整事务恢复。",
  "minutes": 35,
  "labMinutes": 30,
  "tags": [
    "PostgreSQL",
    "行锁",
    "表锁",
    "死锁",
    "40P01",
    "事务重试"
  ],
  "scope": "PostgreSQL17的行级锁、表级锁及死锁恢复；不把行锁等同InnoDB间隙锁，不实现分布式锁，也不宣称本例覆盖所有外键与触发器路径。",
  "prerequisites": [
    "能读写 SELECT、UPDATE 和 CREATE TABLE",
    "了解事务提交与回滚；不要求已经掌握数据库内部实现"
  ],
  "questionIds": [],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "PostgreSQL 17.4",
    "Node.js 22.12.0",
    "macOS 14.5 x86_64"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    {"label":"完整实验与测试 ZIP","path":"database-locks-deadlocks.zip"},
    {
      "label": "独立 PostgreSQL 实验、测试与运行说明",
      "path": "database-locks-deadlocks/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "锁是什么：数据库怎样协调不兼容的操作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据库锁是一套并发协调机制。事务对某个资源提出某种访问要求；如果已有要求与它不兼容，就需要等待、立即失败或按明确策略跳过。资源可以是表、元组、事务号等，锁模式决定兼容关系。锁并不是一个业务对象上随手放置的布尔值，也不是只要SQL写了事务就自动把所有相关业务范围封住。"
        },
        {
          "type": "paragraph",
          "text": "最常见的作用，是防止两个事务同时以不被允许的方式修改同一份数据，或让表结构变更与正在使用这张表的操作协调。代价则是等待：连接在等，事务还开着，已经持有的其他资源也可能继续占用。理解锁的范围、模式和持有时间，才能区分必要串行化与错误地把慢工作塞进事务。"
        },
        {
          "type": "paragraph",
          "text": "本文围绕两个账户转账：账户1与2各有100，事务A从1转10到2，事务B从2转20到1。普通MVCC读取、显式锁定、逆序加锁、死锁受害者回滚和重试，都在同一套数据上观察。完成后你应能画出“谁持有、谁等待、等待谁”的关系，而不是只说数据库有锁竞争。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：显式锁模式、兼容关系及死锁",
          "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
        }
      ]
    },
    {
      "id": "scope",
      "title": "行锁与表锁解决不同层次的问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "行级锁协调目标行上的写入或锁定请求。SELECT ... FOR UPDATE可以先锁住查询实际返回的行，让后续业务计算建立在受协调的数据上。事务结束时通常释放这些事务级锁；回滚到保存点会释放保存点之后取得的相关锁，所以“只有整笔提交才能释放”也不是无条件规则。本文不使用保存点。"
        },
        {
          "type": "paragraph",
          "text": "普通SELECT一般不需要等待另一个事务对行的未提交更新，它按MVCC读取可见旧版本。SELECT ... FOR UPDATE却明确要求对行进行协调，可能等写者结束。这两条SQL虽然都以SELECT开头，等待行为不是一回事。锁定读也不能自动锁住一个查询条件所有“将来可能存在”的记录。"
        },
        {
          "type": "paragraph",
          "text": "表级锁的名字不要按字面理解成行粒度。普通SELECT取得AccessShare表锁；UPDATE等操作也会有相应表锁，同时协调目标行。AccessExclusive会与AccessShare冲突，因此某些结构变更或显式表锁可以阻塞普通读取。说“MVCC下读写永不阻塞”，就把行版本读取与表级协调混在一起了。"
        },
        {
          "type": "table",
          "headers": [
            "操作或要求",
            "本篇观察对象",
            "典型行为"
          ],
          "rows": [
            [
              "普通SELECT",
              "已被别的事务UPDATE但未提交的行",
              "可读到自己快照可见的旧值"
            ],
            [
              "SELECT ... FOR UPDATE",
              "同一行的并发修改者",
              "不兼容时等待对方事务完成"
            ],
            [
              "FOR UPDATE NOWAIT",
              "已经被不兼容锁占用的行",
              "立即报锁不可用55P03"
            ],
            [
              "FOR UPDATE SKIP LOCKED",
              "候选集合中的已锁行",
              "跳过该行，返回可取得锁的其他行"
            ],
            [
              "LOCK TABLE ... ACCESS EXCLUSIVE",
              "已有AccessShare读事务",
              "等待读事务释放不兼容表锁"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这张表只覆盖当前实验路径。行锁还有FOR NO KEY UPDATE、FOR SHARE和FOR KEY SHARE等模式，兼容性并不相同。选择模式时应根据自己到底要保护哪些读写关系，而不是默认把所有读取升级成最强锁。锁更强通常意味着更多等待，不意味着业务规则自动更完整。"
        }
      ]
    },
    {
      "id": "wait",
      "title": "先复现等待，再谈等待为什么发生",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "CREATE TABLE accounts(\n  id integer PRIMARY KEY,\n  balance integer NOT NULL CHECK(balance>=0)\n);\nINSERT INTO accounts VALUES(1,100),(2,100);",
          "language": "sql",
          "filename": "初始账户",
          "purpose": "完整初始表；CHECK保护单行余额不负，转账总额不变还需要将两次写入放在同一事务。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "-- 会话A，停在COMMIT之前\nBEGIN;\nUPDATE accounts SET balance=90 WHERE id=1;\n-- 会话B，独立连接：普通读取立即返回已提交旧值100\nSELECT balance FROM accounts WHERE id=1;\n-- B再执行锁定读取，这条语句开始等待\nBEGIN;\nSELECT balance FROM accounts WHERE id=1 FOR UPDATE;\n-- 回到A提交\nCOMMIT;\n-- B获得锁，在本例默认Read Committed下读取90；然后结束B\nROLLBACK;",
          "language": "sql",
          "filename": "双会话受控步骤",
          "purpose": "按会话标签逐步执行；ROLLBACK属于B。整段不能贴进单一连接当成有效并发实验。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "A将100改成90但没有提交，B的普通读取返回100，说明B没有读到A的未提交值。B接着用FOR UPDATE要求锁定这行，就开始等待。只有确认B已经处于实际锁等待后，自动测试才让A提交；B随后取到90，最后回滚释放自己取得的锁。"
        },
        {
          "type": "code",
          "code": "const isBlocked=name=>sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND cardinality(pg_blocking_pids(pid))>0;`).then(x=>x==='1');\nconst observe=`SELECT application_name,wait_event_type,wait_event,pg_blocking_pids(pid)\nFROM pg_stat_activity WHERE application_name LIKE 'locks-%' ORDER BY application_name;`;",
          "language": "js",
          "filename": "examples/database-locks-deadlocks/test.mjs",
          "purpose": "测试依据真实阻塞者观测，不根据进程启动先后猜测锁已取得。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "本机观察到锁持有者在ClientRead等客户端继续发命令，等待者的wait_event_type为Lock，wait_event为transactionid，pg_blocking_pids返回持有者PID。transactionid并不说明业务在等待一个“事务号表”；它是数据库实现行更新等待时暴露出来的对象之一。不能因为pg_locks没列出每一把持有行锁，就断言没有行锁。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：pg_locks视图及行锁观察限制",
          "url": "https://www.postgresql.org/docs/17/view-pg-locks.html"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：pg_blocking_pids等系统信息函数",
          "url": "https://www.postgresql.org/docs/17/functions-info.html"
        }
      ]
    },
    {
      "id": "policies",
      "title": "等待、立即失败、跳过：必须对应业务语义",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "-- A已经BEGIN并锁住id=1；下面是另一个连接\nSELECT id FROM accounts WHERE id=1 FOR UPDATE NOWAIT;\n-- 本实验返回SQLSTATE 55P03，立即失败\n\nSELECT id FROM accounts ORDER BY id FOR UPDATE SKIP LOCKED;\n-- 只返回2；不是说账户1已经不存在",
          "language": "sql",
          "filename": "不同冲突处理方式",
          "purpose": "两个语句分别在独立自动提交调用中执行；若放同一显式事务，第一次错误后必须先回滚。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "NOWAIT适合业务愿意立即告诉调用者“当前资源忙，请稍后再试”的路径；它没有消除冲突。SKIP LOCKED常用于队列消费者领取一部分尚可处理的任务，但返回的是不完整的候选集合。用它计算总余额、检查所有账户或确认没有待处理记录，会把被锁住的记录悄悄漏掉。"
        },
        {
          "type": "paragraph",
          "text": "测试锁住id=1后，NOWAIT明确返回55P03；SKIP LOCKED只返回id=2。它验证的是当前锁冲突下的行为，没有实现任务租约、消费确认或崩溃重领，所以不能只凭这段SQL宣称交付了可靠队列。挑选策略之前，先明确跳过一行在业务上到底意味着什么。"
        },
        {
          "type": "paragraph",
          "text": "超时又是另一个维度。lock_timeout限制等锁时间；statement_timeout限制语句执行总时间。把超时值设得极小，可能只是把正常短等待转成大量失败。超时错误、死锁和业务拒绝应分别记录，再根据请求预算决定是否重试，不能看见“失败”就立即无限循环。"
        }
      ]
    },
    {
      "id": "table-lock",
      "title": "普通读也可能挡住表级独占操作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "-- 会话A先完成SELECT，仍保持事务\nBEGIN;\nSELECT count(*) FROM accounts;\n-- 会话B要求不兼容表锁，此时等待\nBEGIN;\nLOCK TABLE accounts IN ACCESS EXCLUSIVE MODE;\n-- A执行ROLLBACK后，B获得表锁；B也ROLLBACK结束",
          "language": "sql",
          "filename": "表级兼容性实验",
          "purpose": "这里显式LOCK TABLE用于单独验证模式冲突，不用DDL副作用混淆观察。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "A的SELECT已经返回结果，但事务没有结束，它取得的表锁仍然存在。B的AccessExclusive请求因此等待。自动测试先确认阻塞关系，再结束A，之后B才输出TABLE_HELD屏障。这个实验解释了为什么“查询本身只跑几毫秒，结构变更却等很久”：要看持锁事务的生命周期，不只是SQL运行时长。"
        },
        {
          "type": "paragraph",
          "text": "反过来，若独占请求已经进入队列，后来的请求也可能受到等待链影响；只找表上当前跑得最慢的查询并不总能找到根因。排查时沿pg_blocking_pids向上找阻塞者，同时检查它是否idle in transaction、是否在等应用端外部操作。不要在未确认业务影响前自动终止所有持锁会话。"
        }
      ]
    },
    {
      "id": "cycle",
      "title": "死锁怎样形成：两个人都等对方继续",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/database-locks-deadlocks/wait-graph.svg",
          "title": "两笔转账的等待环，以及统一顺序的修复",
          "alt": "A持有账户1并等待B释放账户2；B持有账户2并等待A释放账户1。统一先锁1再锁2后，等待方没有先持有第二个资源。",
          "caption": "上半图箭头表示“等待谁”，下半图为统一顺序示意；不表示真实等待时长。"
        },
        {
          "type": "paragraph",
          "text": "先让A给账户1扣10但不提交，同时让B给账户2扣20但不提交。两笔事务各自持有一行。A接着想给账户2加10，会等B释放；B接着想给账户1加20，又要等A。此时不是“数据库慢一点就能好”，而是两条等待边组成了环，在没有外部干预的情况下双方都无法完成。"
        },
        {
          "type": "code",
          "code": "    const a=session('locks-dead-a'),b=session('locks-dead-b');\n    a.send('BEGIN; SET deadlock_timeout=\\'2s\\'; UPDATE accounts SET balance=balance-10 WHERE id=1;\\n\\\\echo A_FIRST');\n    b.send('BEGIN; SET deadlock_timeout=\\'2s\\'; UPDATE accounts SET balance=balance-20 WHERE id=2;\\n\\\\echo B_FIRST');\n    await Promise.all([a.wait('A_FIRST'),b.wait('B_FIRST')]);\n    a.send('UPDATE accounts SET balance=balance+10 WHERE id=2;');\n    await until(()=>isBlocked('locks-dead-a'),'A waits for B');\n    b.send('UPDATE accounts SET balance=balance+20 WHERE id=1;');\n    await until(async()=>await isBlocked('locks-dead-a')&&await isBlocked('locks-dead-b'),'observed wait cycle');\n    console.log('Observed both wait edges before PostgreSQL detector ran');\n    const [ra,rb]=await Promise.all([a.end('COMMIT;'),b.end('COMMIT;')]);",
          "language": "js",
          "filename": "examples/database-locks-deadlocks/test.mjs",
          "purpose": "实际死锁交错的连续原文：先证实两边都持有第一行，再建立并观察双向等待，最后允许提交/错误结果返回。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "数据库检测到死锁后会中止其中一笔事务，返回40P01。受害者不应该被应用预先假定为A或B；测试只要求恰好一个失败。失败连接退出时，未提交的扣款会回滚，另一个事务得以继续完成。因此只看到一次扣款成功、一次数据库错误时，必须结合事务边界判断，不能把受害者已经回滚的中间值当成最终余额。"
        },
        {
          "type": "paragraph",
          "text": "实验将deadlock_timeout设为2秒，是为了留出观察双向等待的窗口，不是生产推荐值；它也不是“等锁最长2秒”。测试通过系统视图证明等待环已经建立，之后由数据库检测打破环。没有环的长等待不会因为超过deadlock_timeout就自动变成死锁错误。"
        }
      ]
    },
    {
      "id": "ordering",
      "title": "用统一资源顺序消除这一类交叉持有",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "CREATE TABLE accounts(id integer PRIMARY KEY, balance integer NOT NULL CHECK(balance>=0));\nINSERT INTO accounts VALUES(1,100),(2,100);\nCREATE FUNCTION move_funds(p_from integer,p_to integer,p_amount integer)\nRETURNS void LANGUAGE plpgsql AS $$\nDECLARE locked_count integer;\nBEGIN\n  IF p_from=p_to OR p_amount<=0 THEN\n    RAISE EXCEPTION 'INVALID_TRANSFER' USING ERRCODE='22023';\n  END IF;\n  PERFORM id FROM accounts WHERE id IN(p_from,p_to) ORDER BY id FOR UPDATE;\n  GET DIAGNOSTICS locked_count = ROW_COUNT;\n  IF locked_count<>2 THEN\n    RAISE EXCEPTION 'ACCOUNT_MISSING' USING ERRCODE='22023';\n  END IF;\n  UPDATE accounts SET balance=balance-p_amount WHERE id=p_from;\n  UPDATE accounts SET balance=balance+p_amount WHERE id=p_to;\nEND $$;",
          "language": "sql",
          "filename": "examples/database-locks-deadlocks/schema.sql",
          "purpose": "完整修复实现：固定升序锁定两个账户，确认两行都存在，再完成借贷；负余额CHECK错误会回滚整笔操作。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "move_funds先检查转出和转入不同、金额为正，再对两个账户按id排序并FOR UPDATE。假设两个请求都涉及1和2，无论钱向哪边转，都先争账户1。一个事务先取得1，另一个就在1等待，不会先占住2。先行者能够继续取得2并提交，这就移除了本例的交叉等待环。"
        },
        {
          "type": "paragraph",
          "text": "锁完还检查ROW_COUNT是否为2。这个判断与死锁无关，却决定业务正确性：如果转出账户不存在，只给转入账户加钱，会凭空创造余额。行锁只保护选中的行，不会自动验证两方账户都存在。因此完整关键路径必须把输入、存在性、余额约束和事务一起交代，不能只展示ORDER BY就称为安全转账。"
        },
        {
          "type": "paragraph",
          "text": "这段函数用于教学的两个整数账户。真实账户还要有币种、状态、租户授权和审计等约束；多币种不能直接相加，跨库账户也不在单库事务承诺内。这里的统一顺序只消除已说明资源集合上的逆序问题，其他触发器、外键和额外表仍可能带来新的锁路径。"
        },
        {
          "type": "paragraph",
          "text": "锁的粒度也有取舍。把整张账户表锁住更容易串行，但会让不相干账户之间也相互等待。只锁实际涉及的两行，可以允许不同账户组合并行；前提是所有影响共同不变量的路径都遵守同一协调约定。把外部支付HTTP调用留在持锁期间，会显著延长竞争窗口，应另外设计提交边界。"
        }
      ]
    },
    {
      "id": "retry",
      "title": "失败以后，重试的是事务决定而不只是SQL文本",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export async function transfer(from,to,amount,maxAttempts=3) {\n  for(let attempt=1;attempt<=maxAttempts;attempt++) {\n    try {\n      // Inputs are trusted integers in this lab. Real drivers must bind parameters.\n      assert.ok([from,to,amount].every(Number.isSafeInteger)&&from!==to&&amount>0);\n      return await sql(`BEGIN; SELECT move_funds(${from},${to},${amount}); COMMIT;`);\n    } catch(error) {\n      if(!/\\b(40P01|40001)\\b/.test(error.stderr??'')||attempt===maxAttempts)throw error;\n      // Reopen a connection and BEGIN again; never retry only the failed UPDATE.\n      await new Promise(resolve=>setTimeout(resolve,attempt*10));\n    }\n  }\n}",
          "language": "js",
          "filename": "examples/database-locks-deadlocks/test.mjs",
          "purpose": "实际有界重试包装：仅对40P01/40001重新打开连接开始整个事务；其他错误直接抛出。这里使用可信整数夹具，生产驱动应使用参数绑定。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "每次调用sql都会新建一个psql连接，执行BEGIN、move_funds、COMMIT。发生40P01或40001时，错误连接退出，未提交事务回滚；下一轮重新建立连接和事务。示例最多尝试3次，等待10ms、20ms作为教学退避。生产还要按请求剩余时间、竞争程度加入抖动与总预算，这些固定数字没有性能调优含义。"
        },
        {
          "type": "paragraph",
          "text": "Number.isSafeInteger只服务于这份可信测试输入，不替代面向外部请求的范围校验；PostgreSQL integer本身还有范围限制。这里用整数插值是为了不引入数据库驱动，不能把任意HTTP参数直接拼进SQL。生产使用驱动的参数化调用，并在服务端检查账户归属、金额范围和错误映射。"
        },
        {
          "type": "paragraph",
          "text": "死锁实验先确认受害者的整笔操作已回滚，再只重放那一笔转账。另一笔已经提交，不能也重放，否则资金会重复移动。最终两笔各成功一次，账户1是110，账户2是90，总额200。另一个测试让双方一开始就使用统一顺序，两笔也能并发发起并完成；测试不声称系统所有死锁从此消失。"
        },
        {
          "type": "paragraph",
          "text": "CHECK失败23514表示余额不够满足约束，缺账户22023表示本例输入所引用资源无效；直接重试相同决定没有意义。自动测试确认这两种错误不会被40P01/40001分类器吞掉，余额也不留下部分变更。SQLSTATE是分类起点，仍需结合具体业务决定是否可重试。"
        },
        {
          "type": "paragraph",
          "text": "还有一种不同的问题：COMMIT已成功但响应丢失，调用者不知道结果。它不能简单归类成“肯定失败，整笔再转一次”。这种不确定提交结果需要请求ID与持久化幂等记录等额外协议；本文只对数据库明确报告并中止的40P01/40001做重试，不声称解决网络断连后的恰好一次转账。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：为什么需要重新执行完整事务",
          "url": "https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html"
        }
      ]
    },
    {
      "id": "inspect",
      "title": "等待排查时，先画关系，再定位代码范围",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "SELECT a.pid,a.application_name,a.state,\n       a.wait_event_type,a.wait_event,\n       pg_blocking_pids(a.pid) AS blockers,\n       a.xact_start,left(a.query,160) AS query\nFROM pg_stat_activity a\nWHERE a.datname=current_database()\nORDER BY a.xact_start NULLS LAST;\n\nSELECT pid,locktype,mode,granted,relation::regclass,transactionid\nFROM pg_locks\nWHERE pid IN (SELECT pid FROM pg_stat_activity\n              WHERE application_name LIKE 'locks-%');",
          "language": "sql",
          "filename": "锁观察查询",
          "purpose": "先在教学实例观察；系统视图权限和统计时刻影响可见信息。不要硬编码示例输出中的PID。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "先区分正在计算、等客户端和Lock等待；再找阻塞者PID，并沿链条继续向上。持有者也可能在等另一把锁，所以单看“当前阻塞我的进程”还不够。对照事务起点、SQL、应用请求ID与日志，确认锁是在什么调用路径取得、为什么迟迟没有结束。"
        },
        {
          "type": "paragraph",
          "text": "pg_locks用于补充资源与模式，pg_blocking_pids帮助确定真实阻塞关系。不要凭自己把pg_locks各列随意自连接，就忽略队列顺序和锁兼容性的细节。死锁日志通常能提供更多相关语句；本测试保留错误信息以确认40P01，但没有交付生产日志采集或自动终止阻塞者的运维系统。"
        }
      ]
    },
    {
      "id": "run",
      "title": "复现、验收结果与边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/database-locks-deadlocks\nnvm use\nnpm ci\nPG_BIN=/Library/PostgreSQL/17/bin npm test\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "PostgreSQL17及Node22已安装；三套新数据库实验共享55441，必须依次运行。无需npm第三方依赖。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "harness新建临时PGDATA，只监听127.0.0.1:55441。遇到端口占用会启动失败，不连接已有5432实例。测试成功和普通异常都通过finally终止自己创建的会话、停止本实例并清理临时目录；若用户强制杀死整个进程，仍需根据本机残留进程确认，不能把finally当作操作系统故障后也一定执行的保证。"
        },
        {
          "type": "paragraph",
          "text": "已实际验证普通MVCC读与锁定读的差异、NOWAIT与SKIP LOCKED、表级兼容性等待、双向等待环及唯一死锁受害者、只重放失败事务、统一顺序转账、缺账户拒绝和余额CHECK拒绝。实测环境为macOS14.5/PostgreSQL17.4/Node22.12.0，具体结果见配套验证记录；本篇不发布吞吐或尾延迟结论。"
        },
        {
          "type": "paragraph",
          "text": "图形已经通过本机与站点渲染检查，代码高亮和手机视口已检查；原生设备验证另计。没有测试真实银行支付、多数据库事务、主从切换、数据库断电或生产连接池。把这些边界写清楚，是为了让读者知道实验真正证明了哪件事。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "普通SELECT返回旧值，为何FOR UPDATE却等待？",
              "前者按可见版本读取，后者额外提出行级协调要求。"
            ],
            [
              "超过deadlock_timeout就必然失败吗？",
              "不是。它影响死锁检测时机，等待没有形成环仍可能继续。"
            ],
            [
              "为何失败事务要整笔重做？",
              "之前的读和业务决定可能依赖旧状态，且数据库已让失败事务中止。"
            ],
            [
              "统一加锁顺序为何仍要检查账户存在？",
              "锁不替代存在性与业务约束；只选中一行仍能取得锁。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "面对锁问题，先说清资源和模式，再画持有与等待关系。对正常竞争缩短持锁事务，对本例死锁统一顺序，对明确可恢复失败重做整笔事务，对不确定提交结果增加幂等协议。它们是不同问题的处理方式，不能全部压缩成一句“加锁再重试”。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PG17 显式锁",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
    },
    {
      "title": "PG17 pg_locks",
      "url": "https://www.postgresql.org/docs/17/view-pg-locks.html"
    },
    {
      "title": "PG17 活动与等待事件",
      "url": "https://www.postgresql.org/docs/17/monitoring-stats.html"
    },
    {
      "title": "PG17 pg_blocking_pids",
      "url": "https://www.postgresql.org/docs/17/functions-info.html"
    },
    {
      "title": "PG17 失败事务恢复",
      "url": "https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html"
    }
  ]
};
export default article;
