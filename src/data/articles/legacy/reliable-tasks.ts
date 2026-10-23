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
  "id": "reliable-tasks",
  "topic": "tasks",
  "title": "可靠异步任务：用持久化状态、租约和幂等走完崩溃恢复",
  "description": "实现PostgreSQL队列表、原子认领、递增token、本库资源fence、限次重试；杀掉写完文件的Worker，再重启数据库验证恢复。",
  "minutes": 55,
  "labMinutes": 40,
  "tags": [
    "Worker",
    "租约",
    "幂等",
    "PostgreSQL",
    "fencing"
  ],
  "scope": "深入单PostgreSQL事实源和本机文件产物的教学系统；实现DB内有条件发布与唯一effects，不承诺外部支付/消息/文件端到端exactly once。数据库/Worker使用独立临时环境。",
  "questionIds": [
    "worker-lease",
    "distributed-lock",
    "idempotency",
    "retry",
    "system-design",
    "ts-model"
  ],
  "examples": [
    {
      "label": "任务恢复工程与测试",
      "path": "reliable-tasks.zip"
    },
    {
      "label": "运行步骤与限制",
      "path": "reliable-tasks/README.md"
    }
  ],
  "sections": [
    {
      "id": "states",
      "title": "可靠任务是什么：让一次业务意图跨越多次执行尝试",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "异步任务把请求的业务意图持久化，交给Worker稍后执行。可靠性不是“Worker永不崩溃”，而是在重试、失联和重复回调之后，仍能明确谁有执行资格、哪个结果被采用、哪些副作用还要核对。任务身份表示用户的一次意图，执行尝试表示为完成它而启动的一轮工作，二者必须分开。"
        },
        {
          "type": "paragraph",
          "text": "本篇实现一个生成文本产物的小系统：jobs是任务事实源；Worker认领后在数据库事务外生成文件；确认本次仍有效以后，才发布结果并登记一条本库effects记录。初始任务queued、generation=0；第一次认领变running、token=1，崩溃恢复再次认领token=2。业务键始终不变。"
        },
        {
          "type": "figure",
          "src": "figures/reliable-tasks/flow.svg",
          "title": "租约恢复会产生新token，旧进程不会自动消失",
          "alt": "任务queued变running1，租约过期可变running2；旧token1提交被拒绝。文件写入后Worker崩溃留下孤儿文件，新尝试发布另一个产物并只写一条本库effects。",
          "caption": "教学时序/状态示意，不代表真实时间比例；具体交错由配套测试控制。"
        },
        {
          "type": "paragraph",
          "text": "本例把效果收窄到可验证范围：effects是同一PG数据库中的记账式教学记录，不是真实扣费；artifacts表是接受token检查的本库资源发布点，磁盘文件则是数据库外部副作用。两者特意分开，才能看到数据库幂等与外部重复之间的差距。"
        },
        {
          "type": "table",
          "headers": [
            "状态",
            "含义",
            "下一步"
          ],
          "rows": [
            [
              "queued",
              "等待not_before到期并且仍有尝试额度",
              "原子认领进入running"
            ],
            [
              "running",
              "某owner持有指定generation的有限租约",
              "续租/完成/显式失败/到期被接管"
            ],
            [
              "completed",
              "当前结果已在本库发布并登记effects",
              "相同回调duplicate，改变结果conflict"
            ],
            [
              "failed",
              "尝试额度用尽后的终态",
              "本例不自动恢复，需业务人工处理或显式新任务"
            ]
          ]
        }
      ]
    },
    {
      "id": "claim",
      "title": "原子认领：把查找、改状态和递增token放在短事务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "sql",
          "filename": "schema.sql · 完整文件",
          "kind": "excerpt",
          "purpose": "完整表与全部业务函数。后面按认领、续租、完成与失败顺序带读。所有SQL来自实际测试版本，不是省略错误路径的伪代码。",
          "code": "CREATE TABLE jobs (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  business_key text UNIQUE NOT NULL,\n  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),\n  generation bigint NOT NULL DEFAULT 0,\n  owner text,\n  lease_until timestamptz,\n  not_before timestamptz NOT NULL DEFAULT clock_timestamp(),\n  attempts integer NOT NULL DEFAULT 0,\n  max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts > 0),\n  result_key text,\n  CHECK ((status='running' AND owner IS NOT NULL AND lease_until IS NOT NULL) OR (status<>'running' AND lease_until IS NULL))\n);\nCREATE TABLE artifacts (job_id bigint PRIMARY KEY REFERENCES jobs, generation bigint NOT NULL, result_key text);\nCREATE TABLE effects (job_id bigint PRIMARY KEY REFERENCES jobs, generation bigint NOT NULL, result_key text NOT NULL);\n\nCREATE FUNCTION claim_job(p_owner text, p_lease_ms integer DEFAULT 1000)\nRETURNS TABLE(job_id bigint, token bigint) LANGUAGE plpgsql AS $$\nDECLARE chosen jobs%ROWTYPE;\nBEGIN\n  IF length(p_owner)=0 OR p_owner IS NULL OR p_lease_ms NOT BETWEEN 1 AND 60000 THEN RAISE EXCEPTION 'INVALID_CLAIM'; END IF;\n  SELECT j.* INTO chosen FROM jobs j\n  WHERE ((j.status='queued' AND j.not_before<=clock_timestamp()) OR\n         (j.status='running' AND j.lease_until<=clock_timestamp()))\n    AND j.attempts<j.max_attempts\n  ORDER BY j.id FOR UPDATE SKIP LOCKED LIMIT 1;\n  IF NOT FOUND THEN RETURN; END IF;\n  UPDATE jobs j SET status='running', owner=p_owner,\n    generation=j.generation+1, attempts=j.attempts+1,\n    lease_until=clock_timestamp()+p_lease_ms * interval '1 millisecond'\n  WHERE j.id=chosen.id RETURNING j.* INTO chosen;\n  INSERT INTO artifacts(job_id,generation) VALUES(chosen.id,chosen.generation)\n  ON CONFLICT ON CONSTRAINT artifacts_pkey DO UPDATE SET generation=EXCLUDED.generation, result_key=NULL;\n  RETURN QUERY SELECT chosen.id,chosen.generation;\nEND $$;\n\nCREATE FUNCTION renew_job(p_id bigint,p_owner text,p_token bigint,p_ms integer)\nRETURNS boolean LANGUAGE plpgsql AS $$\nBEGIN\n  IF p_ms NOT BETWEEN 1 AND 60000 THEN RAISE EXCEPTION 'INVALID_LEASE'; END IF;\n  UPDATE jobs SET lease_until=clock_timestamp()+p_ms * interval '1 millisecond'\n  WHERE id=p_id AND owner=p_owner AND generation=p_token AND status='running'\n    AND lease_until>clock_timestamp();\n  RETURN FOUND;\nEND $$;\n\nCREATE FUNCTION complete_job(p_id bigint,p_owner text,p_token bigint,p_key text)\nRETURNS text LANGUAGE plpgsql AS $$\nDECLARE current_job jobs%ROWTYPE;\nBEGIN\n  SELECT * INTO current_job FROM jobs WHERE id=p_id FOR UPDATE;\n  IF NOT FOUND OR current_job.owner IS DISTINCT FROM p_owner OR current_job.generation<>p_token THEN RETURN 'stale'; END IF;\n  IF current_job.status='completed' THEN\n    IF current_job.result_key=p_key THEN RETURN 'duplicate'; END IF;\n    RETURN 'conflict';\n  END IF;\n  IF current_job.status<>'running' OR current_job.lease_until<=clock_timestamp() THEN RETURN 'stale'; END IF;\n  UPDATE artifacts SET result_key=p_key WHERE job_id=p_id AND generation=p_token;\n  IF NOT FOUND THEN RAISE EXCEPTION 'FENCE_REJECTED'; END IF;\n  INSERT INTO effects(job_id,generation,result_key) VALUES(p_id,p_token,p_key);\n  UPDATE jobs SET status='completed',lease_until=NULL,result_key=p_key WHERE id=p_id;\n  RETURN 'completed';\nEND $$;\n\nCREATE FUNCTION fail_job(p_id bigint,p_owner text,p_token bigint,p_retry_ms integer DEFAULT 100)\nRETURNS boolean LANGUAGE plpgsql AS $$\nBEGIN\n  IF p_retry_ms NOT BETWEEN 0 AND 60000 THEN RAISE EXCEPTION 'INVALID_RETRY'; END IF;\n  UPDATE jobs SET status=CASE WHEN attempts<max_attempts THEN 'queued' ELSE 'failed' END,\n    owner=NULL,lease_until=NULL,not_before=clock_timestamp()+p_retry_ms * interval '1 millisecond'\n  WHERE id=p_id AND owner=p_owner AND generation=p_token AND status='running'\n    AND lease_until>clock_timestamp();\n  RETURN FOUND;\nEND $$;\nCREATE FUNCTION reap_exhausted() RETURNS integer LANGUAGE plpgsql AS $$\nDECLARE changed integer;\nBEGIN\n  UPDATE jobs SET status='failed',owner=NULL,lease_until=NULL\n  WHERE status='running' AND lease_until<=clock_timestamp() AND attempts>=max_attempts;\n  GET DIAGNOSTICS changed=ROW_COUNT;\n  RETURN changed;\nEND $$;"
        },
        {
          "type": "paragraph",
          "text": "先读claim_job。候选是已到执行时间的queued，或者租约已过期的running；attempts必须小于max_attempts。FOR UPDATE SKIP LOCKED让本轮略过已经被其他认领事务锁住的候选，拿到一行后立即改为running、记录owner、generation加一、attempts加一并设置数据库时间计算的lease_until。整次函数调用在同一事务完成。"
        },
        {
          "type": "paragraph",
          "text": "同一事务还更新artifacts上的generation，使这个本库发布点知道最新有效token。返回job_id和token给Worker，随后事务结束。重活在事务外运行，不把“持续持有行锁”当作执行租约。测试用A事务认领后暂不提交，B的独立连接立即返回空；A提交后，jobs仅有一个owner。"
        },
        {
          "type": "paragraph",
          "text": "SKIP LOCKED返回的是当时可用的一部分候选，不是一个适合普通报表的一致视图，也不承诺全局公平或严格FIFO。某个低id任务长期被锁，其他Worker仍可先处理后面的。没有拿到候选也不表示永远没有任务；轮询需要退避，而不是在空队列上无限紧循环。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：锁定子句与SKIP LOCKED",
          "url": "https://www.postgresql.org/docs/17/sql-select.html"
        }
      ]
    },
    {
      "id": "lease",
      "title": "租约与fencing：时间给恢复机会，token阻止旧结果覆盖",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "租约是一段有期限的执行资格。到期意味着系统可以允许其他尝试恢复，不意味着旧Worker已经停止。旧进程可能只是暂停，稍后恢复；因此状态写入必须在数据库里同时检查任务id、owner、generation、running状态和租约仍有效，而不是先SELECT检查后无条件UPDATE。"
        },
        {
          "type": "paragraph",
          "text": "renew_job只延长当前有效尝试，过期后返回false，不允许旧Worker自行复活。claim_job接管时生成更大的token。complete_job先锁住任务行，再检查这些条件；过期或token不匹配返回stale，不发布、不记effects。测试先把租约设置到数据库过去时间，模拟调度端确实看见到期，再让新owner取得token2。旧owner带token1提交被拒绝，最终artifacts只发布token2。"
        },
        {
          "type": "paragraph",
          "text": "这里的generation严格递增，是按每个job独立编号的token；它不是认证秘密。owner也只是教学身份，真实API仍需鉴权，不应该接受任何人自己声称是Worker。随机attempt ID适合比较是否当前尝试，但不能表达哪个新旧；递增token则能帮助资源端拒绝较旧序号。"
        },
        {
          "type": "paragraph",
          "text": "fencing真正生效的前提是被保护资源检查token。本例artifacts与jobs同在PG：claim时把最新generation登记给artifacts，complete时按generation条件更新，并在同一个事务写effects及任务状态。只在Worker内比较一次变量，无法阻止远端存储接受旧请求。若外部对象存储或支付端不支持条件版本，就不能把这里的本库fence能力声称为它们也有。"
        },
        {
          "type": "paragraph",
          "text": "时间都取数据库clock_timestamp，避免Worker机器时钟直接仲裁。仍需考虑数据库时钟调整和租约预算；续租应留余量，不在临界毫秒上赌调度。完成检查是在取得行锁后的业务接受点，不能把它宣传成“磁盘和网络在时刻T同时停止”的硬截止。"
        }
      ]
    },
    {
      "id": "effects",
      "title": "幂等的对象是什么：本库完成、记账记录与外部文件分别讨论",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "complete_job把artifacts发布、effects唯一记录和jobs.completed放进同一数据库事务。正常完成返回completed；相同owner/token/result_key再回调返回duplicate；同一已完成尝试改result_key返回conflict；旧token返回stale。effects以job_id为主键，数据库最终约束每个任务只有一条本库记录。"
        },
        {
          "type": "paragraph",
          "text": "这段设计接受的是当前代次的一次结果。它不把重复回调又当作新的执行，也不把任意旧代次“完成”宽松当成成功。实际测试还在complete_job之后故意SELECT 1/0，整个事务回滚，任务仍running、effects为0、artifacts.result_key为空，证明三项没有部分提交。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "worker.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整真实Worker进程：认领、生成不可变的attempt专属文件、可控崩溃点、数据库完成。文件写入明确发生在PG事务之外。",
          "code": "import { writeFile } from 'node:fs/promises';\nimport { join } from 'node:path';\nimport { sql } from './harness.mjs';\nconst owner = 'worker-process';\nconst claimed = await sql(\"SELECT * FROM claim_job('worker-process',1000);\");\nif (!claimed) process.exit(0);\nconst [id, token] = claimed.split('|');\nif (![id, token].every(value => /^\\d+$/.test(value))) throw new Error('invalid database identity');\n// An immutable attempt-specific artifact. This write is outside the DB transaction.\nconst key = `${id}-${token}.txt`;\nawait writeFile(join(process.env.ARTIFACT_DIR, key), `generated:${id}:${token}`, { flag: 'wx' });\nif (process.argv.includes('--crash-after-file')) process.exit(23);\nconst result = await sql(`SELECT complete_job(${id},'${owner}',${token},'${key}');`);\nconsole.log(result);"
        },
        {
          "type": "paragraph",
          "text": "Worker的产物键是job-token.txt，例如1-1.txt。文件用wx创建，避免同一次尝试静默覆盖；写完后才请求本库发布。此处没有实现无限循环、自动续租或生产调度器，单次进程只处理一份任务，便于精确制造崩溃窗口。若真实计算可能超过租约，必须周期续租，续租失败时停止可取消工作，并仍让最终写入接受token检查。"
        },
        {
          "type": "paragraph",
          "text": "关键反例：文件1-1.txt写完，Worker在complete_job之前退出23。此时数据库仍running，effects为0，文件确实存在。租约过期后另一个进程拿token2，生成1-2.txt并完成；最后数据库只发布1-2.txt、effects只有1条，但磁盘上两份文件都存在。旧文件需要后续按任务引用核对、隔离与清理，不能把“数据库只完成一次”当作文件只生成一次。"
        },
        {
          "type": "paragraph",
          "text": "外部扣费也有类似窗口：调用成功后进程未记录就崩溃，重试可能再次调用。应复用业务幂等键，让真正收款端仲裁；或者通过可恢复协议、对账与补偿解决。事务outbox可以保证本库提交时同时记录待发送意图，投递仍可能重复，消费者仍要幂等。本文未实现这些外部协议，也不宣称端到端exactly once。"
        }
      ]
    },
    {
      "id": "retry-policy",
      "title": "失败不只分为完成和没完成：把次数与等待写成数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "fail_job只接受当前有效owner/token。还有尝试额度时回到queued，写not_before作为下次最早时间；额度耗尽则failed。not_before与attempts持久化，进程重启后不会把失败历史忘掉。本例让调用方提供有上限的retry_ms，未实现基于错误类型的指数退避策略；生产应结合临时/永久错误、抖动、依赖压力和总时限决定。"
        },
        {
          "type": "paragraph",
          "text": "另一个边界是最后一次尝试崩溃：它不会主动调用fail_job。claim_job又因尝试额度用尽不再接管，所以必须由reap_exhausted把已过期且额度用尽的running置failed。否则任务会永久显示运行中。测试把max_attempts设2，第一次显式失败、第二次过期，确认第三次不再认领，再由reaper进入终态。"
        },
        {
          "type": "paragraph",
          "text": "显式失败和失联恢复都可能产生新尝试，但任务business_key不变。创建入口必须使用相同业务键，并核对同键请求输入；当前schema只提供唯一business_key，没有额外业务参数，不能照搬到包含用户、模型、金额等输入的系统却省掉输入一致性校验。"
        }
      ]
    },
    {
      "id": "operations",
      "title": "把崩溃恢复变成真正会执行的测试",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "harness与事务专题各自独立复制，运行时每次生成自己的临时PGDATA。固定127.0.0.1:55439，账号atlas，完全不连接现有5432。并发测试不能同时运行两个专题；端口冲突就报错。测试finally停止自己启动的PG，删除自己创建的目录，不能用它管理任意已有服务。"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "harness.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整独立PG/psql测试辅助。Node只负责启动进程及控制交错；SQL在真实PostgreSQL17执行，不用SQLite模拟行锁。",
          "code": "import { execFile, execFileSync, spawn } from 'node:child_process';\nimport { promisify } from 'node:util';\nimport { mkdtemp, rm, mkdir } from 'node:fs/promises';\nimport { tmpdir } from 'node:os';\nimport { join } from 'node:path';\nconst execute = promisify(execFile);\nexport const bin = process.env.PG_BIN || '/Library/PostgreSQL/17/bin';\nexport const port = '55439';\nexport function clientArgs() { return ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'atlas', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']; }\nexport async function sql(statement, name = 'atlas-lab') {\n  const { stdout } = await execute(join(bin, 'psql'), [...clientArgs(), '-c', statement], { env: { ...process.env, PGAPPNAME: name, PGCONNECT_TIMEOUT: '2' } });\n  return stdout.trim();\n}\nexport function session(name) {\n  const child = spawn(join(bin, 'psql'), clientArgs(), { env: { ...process.env, PGAPPNAME: name, PGCONNECT_TIMEOUT: '2' }, stdio: ['pipe', 'pipe', 'pipe'] });\n  let output = '', error = '';\n  child.stdout.on('data', chunk => { output += chunk; });\n  child.stderr.on('data', chunk => { error += chunk; });\n  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve({ code, output, error })); });\n  return {\n    send(text) { child.stdin.write(text + '\\n'); },\n    async wait(marker) { for (let n = 0; n < 400; n++) { if (output.includes(marker)) return output; await new Promise(r => setTimeout(r, 5)); } throw new Error('session marker not reached: ' + marker + error); },\n    async end(text = 'ROLLBACK;') { child.stdin.end(text + '\\n\\\\q\\n'); return done; },\n  };\n}\nexport async function waitFor(predicate) { for (let n = 0; n < 400; n++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error('condition not reached'); }\nexport async function temporaryCluster(run) {\n  const directory = await mkdtemp(join(tmpdir(), 'atlas-pg-lab-'));\n  const data = join(directory, 'data'), socket = join(directory, 'socket');\n  await mkdir(socket, { mode: 0o700 });\n  let started = false;\n  function start() { execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket}`, '-w', 'start'], { stdio: 'pipe' }); started = true; }\n  function stop() { if (started) { execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'pipe' }); started = false; } }\n  try {\n    execFileSync(join(bin, 'initdb'), ['-D', data, '-U', 'atlas', '-A', 'trust', '--no-locale', '-E', 'UTF8'], { stdio: 'pipe' });\n    start();\n    await run({ directory, async restart() { stop(); start(); } });\n  } finally { stop(); await rm(directory, { recursive: true, force: true }); }\n}"
        },
        {
          "type": "code",
          "language": "js",
          "filename": "test.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整恢复测试：真实第二连接、租约失效、幂等冲突、事务回滚、终态、子进程崩溃与数据库重启。",
          "code": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile, mkdir, readdir } from 'node:fs/promises';\nimport { execFile } from 'node:child_process';\nimport { promisify } from 'node:util';\nimport { join } from 'node:path';\nimport { temporaryCluster, sql, session } from './harness.mjs';\nconst execute=promisify(execFile);\ntest('durable jobs on dedicated PostgreSQL17 instance',async t=>temporaryCluster(async cluster=>{\n await sql(await readFile('schema.sql','utf8'));\n async function reset(){await sql(\"TRUNCATE effects,artifacts,jobs RESTART IDENTITY CASCADE; INSERT INTO jobs(business_key) VALUES('job');\");}\n const claim=owner=>sql(`SELECT * FROM claim_job('${owner}',1000);`);\n const complete=(owner,token,key)=>sql(`SELECT complete_job(1,'${owner}',${token},'${key}');`);\n await t.test('two connections skip locked candidate; only the first owns job',async()=>{\n  await reset();const a=session('task-claim-a');a.send(\"BEGIN; SELECT * FROM claim_job('a',1000);\\n\\\\echo CLAIM_HELD\");await a.wait('CLAIM_HELD');\n  assert.equal(await claim('b'),'');assert.equal((await a.end('COMMIT;')).code,0);\n  assert.equal(await sql('SELECT status,generation,owner FROM jobs;'),'running|1|a');\n });\n await t.test('lease renewal and expired owner cannot revive or finish',async()=>{\n  await reset();assert.equal(await claim('a'),'1|1');\n  assert.equal(await sql(\"SELECT renew_job(1,'a',1,2000);\"),'t');\n  await sql(\"UPDATE jobs SET lease_until=clock_timestamp()-interval '1 millisecond';\");\n  assert.equal(await sql(\"SELECT renew_job(1,'a',1,2000);\"),'f');\n  assert.equal(await complete('a',1,'old'),'stale');\n  assert.equal(await claim('b'),'1|2');\n  assert.equal(await complete('a',1,'old'),'stale');\n  assert.equal(await complete('b',2,'new'),'completed');\n  assert.equal(await sql('SELECT generation,result_key FROM artifacts;'),'2|new');\n });\n await t.test('duplicate completion keeps one effect and changed result conflicts',async()=>{\n  await reset();await claim('a');assert.equal(await complete('a',1,'asset'),'completed');\n  assert.equal(await complete('a',1,'asset'),'duplicate');assert.equal(await complete('a',1,'different'),'conflict');\n  assert.equal(await sql('SELECT count(*) FROM effects;'),'1');\n });\n await t.test('transaction failure cannot partially publish or charge',async()=>{\n  await reset();await claim('a');\n  await assert.rejects(sql(\"BEGIN; SELECT complete_job(1,'a',1,'asset'); SELECT 1/0; COMMIT;\"),/division by zero/);\n  assert.equal(await sql('SELECT status,(SELECT count(*) FROM effects),(SELECT result_key IS NULL FROM artifacts) FROM jobs;'),'running|0|t');\n });\n await t.test('retry budget and expired last attempt become terminal failed',async()=>{\n  await reset();await sql('UPDATE jobs SET max_attempts=2;');await claim('a');\n  assert.equal(await sql(\"SELECT fail_job(1,'a',1,0);\"),'t');assert.equal(await claim('b'),'1|2');\n  await sql(\"UPDATE jobs SET lease_until=clock_timestamp()-interval '1 millisecond';\");\n  assert.equal(await claim('c'),'');assert.equal(await sql('SELECT reap_exhausted();'),'1');\n  assert.equal(await sql('SELECT status,attempts FROM jobs;'),'failed|2');\n });\n await t.test('worker crash after external artifact leaves orphan; persisted lease recovers after DB restart',async()=>{\n  await reset();const artifacts=join(cluster.directory,'artifacts');await mkdir(artifacts);\n  await assert.rejects(execute(process.execPath,['worker.mjs','--crash-after-file'],{env:{...process.env,ARTIFACT_DIR:artifacts}}),error=>error.code===23);\n  assert.deepEqual(await readdir(artifacts),['1-1.txt']);assert.equal(await sql('SELECT status,generation FROM jobs;'),'running|1');\n  await cluster.restart();assert.equal(await sql('SELECT status,generation FROM jobs;'),'running|1');\n  // Fault injection sets DB time relation deterministically; no worker is assumed dead by expiry alone.\n  await sql(\"UPDATE jobs SET lease_until=clock_timestamp()-interval '1 millisecond';\");\n  const recovered=await execute(process.execPath,['worker.mjs'],{env:{...process.env,ARTIFACT_DIR:artifacts}});\n  assert.match(recovered.stdout,/completed/);assert.deepEqual((await readdir(artifacts)).sort(),['1-1.txt','1-2.txt']);\n  assert.equal(await sql('SELECT status,generation,result_key,(SELECT count(*) FROM effects) FROM jobs;'),'completed|2|1-2.txt|1');\n });\n}));"
        },
        {
          "type": "code",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "需要已安装PostgreSQL17的initdb/pg_ctl/psql。默认路径/Library/PostgreSQL/17/bin，可设PG_BIN覆盖；测试自动隔离、启动、停止。",
          "code": "cd examples/reliable-tasks\nnvm use\nnpm ci\nnpm test\nnpm run check"
        },
        {
          "type": "paragraph",
          "text": "恢复测试不是仅把一个JavaScript对象重新赋值：它启动Worker子进程，文件写入后以23退出；确认数据库running和文件存在；真正停止再启动这份PGDATA，确认状态仍在；把租约时间改为过去作为确定性故障注入；再启动新进程完成。它验证进程/服务重启下的持久状态与恢复，不模拟整机断电、磁盘丢失或数据库复制故障。"
        },
        {
          "type": "paragraph",
          "text": "测试使用数据库时间关系注入到期，避免靠模糊sleep假设租约已经失效。这与测试“旧进程还活着但凭token无权完成”互补；测试不会因为数据库过期就声称进程已经死亡。Worker发布前验证与资源fence才是防旧写的核心。"
        },
        {
          "type": "paragraph",
          "text": "运行时观察应至少包含job_id、generation、owner、status、lease_until、attempts、not_before和结果键。统计等待时长、执行时长、过期接管、重复/过期回调和终态失败。只看成功率，会漏掉已经排队很久但还没失败的任务。本例提供数据库状态和测试断言，未搭建监控平台。"
        }
      ]
    },
    {
      "id": "reader-check",
      "title": "仅凭正文推演三个故障窗口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "故障窗口",
            "数据库与文件状态",
            "恢复与仍有的限制"
          ],
          "rows": [
            [
              "认领后、文件前崩溃",
              "running/token1，无文件无effects",
              "租约到期可接管；token2继续"
            ],
            [
              "文件后、完成前崩溃",
              "running/token1，存在旧文件，无effects",
              "新attempt可生成另一文件；旧文件需对账清理"
            ],
            [
              "完成提交后、确认丢失",
              "completed、唯一effects、已发布结果",
              "相同回调duplicate，不再次登记本库效果"
            ],
            [
              "旧Worker恢复",
              "可能仍持有token1并继续本地工作",
              "数据库/资源检查token2拒绝旧写；外部系统须自己支持幂等/条件写"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "为什么需要lease和token两件事？lease决定何时允许恢复，token决定哪个尝试有权改变当前事实。到期不能杀进程，只有资源端检查才会拒绝旧写。为什么文件名含token？不同尝试生成的文件不可互相覆盖，但仍可能有孤儿文件，必须承认并处理。"
        },
        {
          "type": "paragraph",
          "text": "本系统的保证停在明确边界：同一PG事务中当前代次的发布与唯一effects原子提交，任务身份可持久恢复；外部文件仍可能多次生成。面对真实支付、消息与对象存储，继续沿“事实来源、业务键、条件写、部分成功恢复”设计协议，而不是把一个分布式锁命名为可靠性。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PostgreSQL17 SELECT锁定子句",
      "url": "https://www.postgresql.org/docs/17/sql-select.html"
    },
    {
      "title": "AWS事务outbox模式",
      "url": "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"
    }
  ]
};
export default article;
