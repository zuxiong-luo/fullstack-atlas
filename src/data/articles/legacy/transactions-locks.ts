import type { Article } from '../../articleTypes';
const article: Article = {
  "kind": "tutorial",
  "status": "review",
  "verifiedAt": "2026-10-23",
  "versions": [
    "PostgreSQL 17.4",
    "Node.js 22.12.0 / psql内置客户端，无npm运行依赖"
  ],
  "prerequisites": [
    "SQL读写与BEGIN/COMMIT基础",
    "能区分并发操作与同一线程顺序执行"
  ],
  "id": "transactions-locks",
  "topic": "data",
  "title": "库存事务与行锁：从条件扣减到隔离级别的实际边界",
  "description": "先定义数据库事务与业务不变量，再用两个真实PostgreSQL连接观察超卖、锁等待、回滚、幂等和写偏斜。",
  "minutes": 48,
  "labMinutes": 30,
  "tags": [
    "PostgreSQL",
    "MVCC",
    "行锁",
    "事务",
    "幂等"
  ],
  "scope": "PostgreSQL17单实例教学，深入单行库存与订单、业务键幂等、行级竞争和跨行写偏斜。SQL与测试完整给出；不声称涵盖跨系统事务、全部锁模式或生产压测。",
  "questionIds": [
    "db-transactions",
    "db-index",
    "redis-cache"
  ],
  "examples": [
    {
      "label": "PostgreSQL独立实例与测试",
      "path": "transactions-locks.zip"
    },
    {
      "label": "安装与运行",
      "path": "transactions-locks/README.md"
    }
  ],
  "sections": [
    {
      "id": "invariant",
      "title": "事务是什么：先让一组数据库操作共同成功或失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据库事务把一组读写组织成一个整体：在提交之前，执行结果可能被回滚；成功提交后，它们成为数据库认可的结果。原子性回答“这一组写入能否只完成一半”，隔离性回答“并发事务之间能看见什么、怎样协调”。它们不会自动理解用户所说的“库存只有一份，所以只能卖一次”。"
        },
        {
          "type": "paragraph",
          "text": "先写出本篇业务不变量：库存不能为负；一次成功购买必须同时产生一个订单并扣减一份库存；同一个业务请求重试不能再扣一份；同一业务键不能换一个商品继续使用。接下来每个约束都对应明确代码，而不是先拿一把锁再猜它保护什么。"
        },
        {
          "type": "paragraph",
          "text": "初始库存sku=1、stock=1。两个独立会话A和B都先读到1，再按自己记住的值把stock设成0，各插入一个订单。两笔事务都能提交，库存从未为负，却已经有两份订单。CHECK(stock>=0)保护了单行数值范围，没有表达订单数量与扣减之间的业务关系。事务包住错误算法，仍可能正确地提交错误业务。"
        },
        {
          "type": "code",
          "language": "sql",
          "filename": "psql 教学会话",
          "kind": "excerpt",
          "purpose": "故意错误的两会话算法。数据库并不知道应用为何把stock设为0；完整测试为A/B使用不同业务键。",
          "code": "-- A 与 B 都先执行并读取1\nBEGIN;\nSELECT stock FROM inventory WHERE sku=1;\n-- A 先执行并提交，然后 B 用自己记住的1也执行同样赋值\nUPDATE inventory SET stock=0 WHERE sku=1;\nINSERT INTO orders(request_key,sku) VALUES('本会话不同业务键',1);\nCOMMIT;"
        },
        {
          "type": "paragraph",
          "text": "这个失败既没有脏读，也没有负库存。它的核心是应用把“先前观察”误当成“现在仍可使用的许可”。我们需要把检查和改变放进数据库同一个受协调的操作，再把订单写入放进同一事务。"
        }
      ]
    },
    {
      "id": "atomic",
      "title": "条件更新怎样把业务判断放进竞争边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "sql",
          "filename": "schema.sql · 完整文件",
          "kind": "excerpt",
          "purpose": "完整表结构和purchase函数。它是本文全部业务实现，后面逐分支带读；测试辅助的doctors表用于隔离级别反例。",
          "code": "CREATE TABLE inventory (sku integer PRIMARY KEY, stock integer NOT NULL CHECK (stock >= 0));\nCREATE TABLE orders (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_key text NOT NULL UNIQUE, sku integer NOT NULL REFERENCES inventory(sku));\nCREATE TABLE doctors (id integer PRIMARY KEY, on_call boolean NOT NULL);\nCREATE FUNCTION purchase(p_key text, p_sku integer) RETURNS text LANGUAGE plpgsql AS $$\nDECLARE new_order bigint; old_sku integer;\nBEGIN\n  INSERT INTO orders(request_key, sku) VALUES(p_key, p_sku)\n  ON CONFLICT(request_key) DO NOTHING RETURNING id INTO new_order;\n  IF new_order IS NULL THEN\n    SELECT sku INTO old_sku FROM orders WHERE request_key = p_key;\n    IF old_sku IS DISTINCT FROM p_sku THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT'; END IF;\n    RETURN 'duplicate';\n  END IF;\n  UPDATE inventory SET stock = stock - 1 WHERE sku = p_sku AND stock > 0;\n  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;\n  RETURN 'created';\nEND $$;"
        },
        {
          "type": "paragraph",
          "text": "purchase先尝试插入唯一request_key。成功拿到new_order，才进入库存条件更新。UPDATE把sku匹配、stock>0和stock-1放在同一条语句里；FOUND为false就抛出INSUFFICIENT_STOCK，整个函数所在事务失败。订单在前面临时插入，也随之回滚，不会留下“没买到却创建成功订单”的部分结果。"
        },
        {
          "type": "paragraph",
          "text": "带入sku1、库存1、业务键a：订单插入，库存从1变0，函数返回created。相同请求再来，唯一键冲突不再插入新订单；读取已存在订单的sku，相同则返回duplicate，库存仍是0。若同一个键改成sku2，函数抛IDEMPOTENCY_KEY_CONFLICT。这一比较让幂等键绑定业务输入，不把“键存在”直接当作任何请求都成功。"
        },
        {
          "type": "paragraph",
          "text": "当前请求模型只有sku这个会变化的业务字段；真实订单还包括数量、币种、用户、价格版本等，要把全部影响业务含义的字段纳入比较或请求摘要。幂等键也应在明确租户/用户范围内唯一。示例使用全局唯一text键，是为了让数据边界容易验证。"
        },
        {
          "type": "paragraph",
          "text": "这里一次SELECT purchase就运行在一笔隐式事务中；如果还要写其他本库数据，可以显式BEGIN，把它们一起提交。后面故意在purchase之后执行1/0，真实测试确认库存回到1、订单归零。不要捕获库存不足后仍无条件提交后续逻辑；也不要把函数中的RETURN当成跨系统操作已经完成。"
        },
        {
          "type": "code",
          "language": "sql",
          "filename": "psql 教学会话",
          "kind": "excerpt",
          "purpose": "正常调用与重试边界。40001为序列化失败，40P01为死锁；不是所有错误都应该重试。",
          "code": "BEGIN;\nSELECT purchase('order-42',1);\n-- 同一数据库里的其他必要写入可以放在这里\nCOMMIT;\n-- SQLSTATE为40001或40P01时，应回滚并按策略重试整个事务"
        }
      ]
    },
    {
      "id": "locks",
      "title": "行锁的作用：让冲突写入等待，再按当前版本判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/transactions-locks/flow.svg",
          "title": "两个连接争同一份库存",
          "alt": "A扣减后持锁，B等待同一库存行；A提交后B重新检查stock条件，库存0导致失败并回滚自己的订单。",
          "caption": "教学时序/状态示意，不代表真实时间比例；具体交错由配套测试控制。"
        },
        {
          "type": "paragraph",
          "text": "A在显式事务中调用purchase(a,1)，暂不提交，数据库保存了库存行的写锁。B用另一个连接调用purchase(b,1)，在竞争同一行时等待。测试先确认pg_stat_activity里B的wait_event_type为Lock，才让A提交，所以没有靠“睡一会儿应该就竞争了”来证明并发。"
        },
        {
          "type": "paragraph",
          "text": "在本例Read Committed路径中，A提交后，B针对已被并发更新的目标行重新检查WHERE。stock现在是0，不再满足stock>0；UPDATE没影响行，purchase抛库存不足，B的订单也被回滚。最终不是“B读到的1被神奇改写”，而是B的写入判断在行级协调后以新的行版本重新决定。"
        },
        {
          "type": "code",
          "language": "sql",
          "filename": "psql 教学会话",
          "kind": "excerpt",
          "purpose": "完整测试为两个连接指定不同PGAPPNAME。查询只针对自己的教学实例，不能凭一次等待推断业务SQL一定执行慢。",
          "code": "SELECT application_name,state,wait_event_type,wait_event\nFROM pg_stat_activity\nWHERE application_name IN ('lock-a','lock-b');\n-- 测试期待lock-b处于Lock等待；不要把某个具体wait_event名称写成所有锁的通用值"
        },
        {
          "type": "paragraph",
          "text": "需要先读取完整数据再计算复杂变更时，可以在短事务内SELECT ... FOR UPDATE，显式协调目标行；但锁只覆盖已经选中的行，不能自动锁住“尚不存在的满足某条件的行”。涉及多资源时尽量统一锁定顺序，并仍处理死锁。锁持有期间等待支付、上传或慢外部接口，会把数据库连接和竞争一起拖住。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：行级锁与死锁",
          "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
        }
      ]
    },
    {
      "id": "isolation",
      "title": "快照是什么：稳定观察不等于所有决策都可串行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "MVCC让读操作依据可见的数据版本工作。PostgreSQL默认Read Committed通常按语句取快照；Repeatable Read为事务提供稳定快照，但仍可能出现跨行决策的写偏斜。Serializable要求成功提交的并发事务可解释为某个串行顺序，并可能主动让一方失败。不能把别的数据库对同名级别的行为直接套过来。"
        },
        {
          "type": "paragraph",
          "text": "现在换一个更能说明边界的数据：值班医生1和2都on_call=true，不变量是至少一人值班。A和B都读到count=2，A只把医生1设false，B只把医生2设false。它们写不同的行，所以没有争同一个库存行的写锁。"
        },
        {
          "type": "code",
          "language": "sql",
          "filename": "psql 教学会话",
          "kind": "excerpt",
          "purpose": "写偏斜的完整核心。自动测试用两个会话屏障确认两边都完成读取，再依次更新提交。",
          "code": "-- 两连接都先执行，建立各自的快照\nBEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT count(*) FROM doctors WHERE on_call; -- 两边都是2\n-- A执行：\nUPDATE doctors SET on_call=false WHERE id=1;\nCOMMIT;\n-- B在自己仍打开的事务执行id=2并COMMIT"
        },
        {
          "type": "paragraph",
          "text": "实际Repeatable Read实验两边成功，最后count=0，违反跨行不变量。用同一交错改成Serializable，一方出现could not serialize，最终还剩1人。测试故意不把失败偷偷吞掉；应用必须回滚并重新读取、重新决定是否还能下班，重试整个事务后，另一人已不在岗，就不能照原决定继续。"
        },
        {
          "type": "paragraph",
          "text": "更强隔离不意味着永不失败，也不意味着随时无限重试。给40001、40P01等可重试错误设置有限次数和退避；区分库存不足、参数错误、幂等冲突等业务拒绝。重试范围内只做可重复的数据库逻辑，不要把每次重试都扣一次外部费用的调用包进来。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：事务隔离及序列化重试",
          "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
        }
      ]
    },
    {
      "id": "validation",
      "title": "独立数据库怎样建立，交错怎样控制",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "配套项目不连接机器现有5432，也不读取现有数据库密码。harness每次在临时目录initdb，账号atlas、仅loopback端口55439、私有socket目录；测试结束pg_ctl停止本实例并清掉它自己的临时目录。55439被占用则启动失败，不自动接管其他服务。下面完整给出辅助实现，连接参数不是依赖读者猜测。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "harness.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整测试辅助。PG_BIN可改为本机PostgreSQL17的bin目录；它只启动/停止自己初始化的PGDATA。trust认证仅适用于本机隔离教学，不是部署建议。",
          "code": "import { execFile, execFileSync, spawn } from 'node:child_process';\nimport { promisify } from 'node:util';\nimport { mkdtemp, rm, mkdir } from 'node:fs/promises';\nimport { tmpdir } from 'node:os';\nimport { join } from 'node:path';\nconst execute = promisify(execFile);\nexport const bin = process.env.PG_BIN || '/Library/PostgreSQL/17/bin';\nexport const port = '55439';\nexport function clientArgs() { return ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'atlas', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']; }\nexport async function sql(statement, name = 'atlas-lab') {\n  const { stdout } = await execute(join(bin, 'psql'), [...clientArgs(), '-c', statement], { env: { ...process.env, PGAPPNAME: name, PGCONNECT_TIMEOUT: '2' } });\n  return stdout.trim();\n}\nexport function session(name) {\n  const child = spawn(join(bin, 'psql'), clientArgs(), { env: { ...process.env, PGAPPNAME: name, PGCONNECT_TIMEOUT: '2' }, stdio: ['pipe', 'pipe', 'pipe'] });\n  let output = '', error = '';\n  child.stdout.on('data', chunk => { output += chunk; });\n  child.stderr.on('data', chunk => { error += chunk; });\n  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve({ code, output, error })); });\n  return {\n    send(text) { child.stdin.write(text + '\\n'); },\n    async wait(marker) { for (let n = 0; n < 400; n++) { if (output.includes(marker)) return output; await new Promise(r => setTimeout(r, 5)); } throw new Error('session marker not reached: ' + marker + error); },\n    async end(text = 'ROLLBACK;') { child.stdin.end(text + '\\n\\\\q\\n'); return done; },\n  };\n}\nexport async function waitFor(predicate) { for (let n = 0; n < 400; n++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error('condition not reached'); }\nexport async function temporaryCluster(run) {\n  const directory = await mkdtemp(join(tmpdir(), 'atlas-pg-lab-'));\n  const data = join(directory, 'data'), socket = join(directory, 'socket');\n  await mkdir(socket, { mode: 0o700 });\n  let started = false;\n  function start() { execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket}`, '-w', 'start'], { stdio: 'pipe' }); started = true; }\n  function stop() { if (started) { execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'pipe' }); started = false; } }\n  try {\n    execFileSync(join(bin, 'initdb'), ['-D', data, '-U', 'atlas', '-A', 'trust', '--no-locale', '-E', 'UTF8'], { stdio: 'pipe' });\n    start();\n    await run({ directory, async restart() { stop(); start(); } });\n  } finally { stop(); await rm(directory, { recursive: true, force: true }); }\n}"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "test.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整并发与失败测试。session.wait等待psql明确输出屏障；锁等待观察实际系统视图。schema由上文完整提供。",
          "code": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nimport { temporaryCluster, sql, session, waitFor } from './harness.mjs';\ntest('PostgreSQL 17 real transaction experiments, isolated cluster only', async t => temporaryCluster(async () => {\n  await sql(await readFile('schema.sql', 'utf8'));\n  async function reset(stock = 1) { await sql(`TRUNCATE orders, inventory RESTART IDENTITY CASCADE; INSERT INTO inventory VALUES(1,${stock}),(2,1);`); }\n  await t.test('naive read-then-assign allows two orders even with stock CHECK', async () => {\n    await reset();\n    const a=session('naive-a'), b=session('naive-b');\n    a.send(\"BEGIN; SELECT stock FROM inventory WHERE sku=1;\\n\\\\echo READ_A\");\n    b.send(\"BEGIN; SELECT stock FROM inventory WHERE sku=1;\\n\\\\echo READ_B\");\n    await Promise.all([a.wait('READ_A'),b.wait('READ_B')]);\n    assert.equal((await a.end(\"UPDATE inventory SET stock=0 WHERE sku=1; INSERT INTO orders(request_key,sku) VALUES('a',1); COMMIT;\")).code,0);\n    assert.equal((await b.end(\"UPDATE inventory SET stock=0 WHERE sku=1; INSERT INTO orders(request_key,sku) VALUES('b',1); COMMIT;\")).code,0);\n    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'0|2');\n  });\n  await t.test('second connection waits, rechecks stock and fails without a second order', async () => {\n    await reset();\n    const a=session('lock-a');\n    a.send(\"BEGIN; SELECT purchase('a',1);\\n\\\\echo LOCK_HELD\");\n    await a.wait('LOCK_HELD');\n    const waiting=sql(\"SELECT purchase('b',1);\",'lock-b').then(value=>({value}),error=>({error}));\n    await waitFor(async()=>await sql(\"SELECT count(*) FROM pg_stat_activity WHERE application_name='lock-b' AND wait_event_type='Lock';\")==='1');\n    assert.equal((await a.end('COMMIT;')).code,0);\n    assert.match((await waiting).error.stderr,/INSUFFICIENT_STOCK/);\n    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'0|1');\n  });\n  await t.test('a later error rolls back stock and order together', async () => {\n    await reset();\n    await assert.rejects(sql(\"BEGIN; SELECT purchase('rollback',1); SELECT 1/0; COMMIT;\"),/division by zero/);\n    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'1|0');\n  });\n  await t.test('idempotency key neither deducts twice nor accepts changed business input', async () => {\n    await reset(2);\n    assert.equal(await sql(\"SELECT purchase('same',1);\"),'created');\n    assert.equal(await sql(\"SELECT purchase('same',1);\"),'duplicate');\n    await assert.rejects(sql(\"SELECT purchase('same',2);\"),/IDEMPOTENCY_KEY_CONFLICT/);\n    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'1|1');\n  });\n  for(const level of ['REPEATABLE READ','SERIALIZABLE']) await t.test(`${level} cross-row write skew`, async()=>{\n    await sql('TRUNCATE doctors; INSERT INTO doctors VALUES(1,true),(2,true);');\n    const a=session('skew-a'), b=session('skew-b');\n    a.send(`BEGIN ISOLATION LEVEL ${level}; SELECT count(*) FROM doctors WHERE on_call;\\n\\\\echo SEEN_A`);\n    b.send(`BEGIN ISOLATION LEVEL ${level}; SELECT count(*) FROM doctors WHERE on_call;\\n\\\\echo SEEN_B`);\n    await Promise.all([a.wait('SEEN_A'),b.wait('SEEN_B')]);\n    const first=await a.end('UPDATE doctors SET on_call=false WHERE id=1; COMMIT;');\n    const second=await b.end('UPDATE doctors SET on_call=false WHERE id=2; COMMIT;');\n    assert.equal(first.code,0);\n    if(level==='REPEATABLE READ') { assert.equal(second.code,0); assert.equal(await sql('SELECT count(*) FROM doctors WHERE on_call;'),'0'); }\n    else { assert.notEqual(second.code,0); assert.match(second.error,/could not serialize/); assert.equal(await sql('SELECT count(*) FROM doctors WHERE on_call;'),'1'); }\n  });\n}));"
        },
        {
          "type": "code",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "Node22.12.0与PostgreSQL17已安装时直接运行。两个数据库专题都使用55439，测试必须依次执行。",
          "code": "cd examples/transactions-locks\nnvm use\nnpm ci\n# 默认使用 /Library/PostgreSQL/17/bin，可通过PG_BIN覆盖\nnpm test\nnpm run check"
        },
        {
          "type": "paragraph",
          "text": "本机macOS/PostgreSQL17.4/Node22.12.0实际通过6个场景，Node测试报告含顶层合计7个通过。首次initdb与启动可能明显慢于SQL本身，报告中的整套时长不是查询性能。测试覆盖行为与恢复，不输出吞吐或锁优化收益。"
        }
      ]
    },
    {
      "id": "outside",
      "title": "事务边界之外，还要设计什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "事务回滚只约束同一数据库的相关写入。已经发出的支付、邮件或对象存储上传，不能被数据库自动撤销。数据库提交后消息没有发出去，可以用事务outbox记录待发送意图；消息发送后确认丢失，接收方仍需要业务幂等键。outbox不是跨系统恰好一次的魔法。"
        },
        {
          "type": "paragraph",
          "text": "本例尚未实现outbox、支付、连接池容量、故障转移与持久化参数调优；不把本机测试当生产灾备证据。采购系统还要防止不同商品/订单路径绕开共同不变量，所有写入路径都应遵守约定。唯一键、CHECK、条件写入与隔离是不同层的工具，不能拿其中一个替代全部。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "库存从未为负，为什么还能超卖？",
              "两个请求用旧读数各自设成0，CHECK只保护数值；订单/扣减关系仍错。"
            ],
            [
              "B等待A后为什么没再卖一份？",
              "Read Committed的并发写路径按目标新版本重新判断stock>0，0不满足。"
            ],
            [
              "RR读到稳定快照，为何医生全下班？",
              "两个事务基于同一旧观察写不同记录，稳定快照不排除写偏斜；需要串行化或共同协调资源。"
            ],
            [
              "幂等键相同就能返回成功吗？",
              "先比较业务输入，变更sku必须冲突；相同意图才可复用结果。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "面对一次库存争抢，先说明绝不能发生什么，再把竞争窗口落到条件写入、唯一约束和事务边界上。看见并发失败时，区分业务拒绝、等待、死锁与序列化冲突；每种现象有自己的恢复策略。这个顺序比先给所有查询加锁更可审计。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PostgreSQL17事务隔离",
      "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
    },
    {
      "title": "PostgreSQL17显式锁",
      "url": "https://www.postgresql.org/docs/17/explicit-locking.html"
    }
  ]
};
export default article;
