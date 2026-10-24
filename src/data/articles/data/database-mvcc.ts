import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "database-mvcc",
  "topic": "data",
  "title": "MVCC 与并发可见性：快照、版本和旧数据清理",
  "description": "先理解记录版本与快照，再用两个真实连接观察读已提交、可重复读、写偏斜和长快照影响清理的过程。",
  "minutes": 34,
  "labMinutes": 30,
  "tags": [
    "PostgreSQL",
    "MVCC",
    "快照",
    "隔离级别",
    "VACUUM",
    "写偏斜"
  ],
  "scope": "以 PostgreSQL 17 的普通表和本机独立实例为准；解释可见性、隔离与清理的关系，不模拟存储引擎，也不声称覆盖复制和故障转移。",
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
    {"label":"完整实验与测试 ZIP","path":"database-mvcc.zip"},
    {
      "label": "独立 PostgreSQL 实验、测试与运行说明",
      "path": "database-mvcc/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "MVCC 是什么，它把哪两件事分开了",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "MVCC 是多版本并发控制：数据库为记录保留不同版本，读操作按自己的可见性规则选择版本。一个业务订单只有一个订单号，在数据库内部却可能先后对应多个元组版本。更新后的新值出现，不意味着所有正在读取的事务必须立刻改看新值。先区分“当前有哪些版本”和“这次读取允许看见哪个版本”，后面的隔离级别就容易理解了。"
        },
        {
          "type": "paragraph",
          "text": "这样做主要是协调并发观察。假设余额原来是10，另一个事务正在把它改成20。普通读操作不必为了知道一个已提交的值，就等对方整个修改事务结束；它可以读取对自己的快照可见的版本。写事务仍然需要锁与冲突处理，DDL也可能阻塞读。MVCC降低读写之间的某些冲突，没有取消数据库里的全部等待。"
        },
        {
          "type": "paragraph",
          "text": "这里的快照不是把整张表复制进内存，也不是一个永远固定的查询结果缓存。它是一组用于判定版本可见性的事务信息。查询仍然走扫描、索引与条件判断，只是在遇到行版本时按快照决定是否可见。本文先建立版本模型，再观察快照何时变化，最后解释为什么旧版本不能想删就删。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：多版本并发控制概述",
          "url": "https://www.postgresql.org/docs/17/mvcc-intro.html"
        }
      ]
    },
    {
      "id": "versions",
      "title": "一条记录更新后，内部留下什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "在 PostgreSQL 普通堆表中，一次 UPDATE 通常产生一个新元组版本。旧版本带着原值，新版本带着更新后的值，相关事务信息用于决定它们分别对谁可见。用账户号 id=1 表示业务身份，和用某个物理元组位置表示当前版本，是两个层次。更新、清理或表重写之后，物理位置都可能改变。"
        },
        {
          "type": "code",
          "code": "CREATE TABLE account(id integer PRIMARY KEY, balance integer NOT NULL);\nINSERT INTO account VALUES(1,10);\nSELECT id,balance,xmin::text,xmax::text,ctid FROM account;\nUPDATE account SET balance=20 WHERE id=1;\nSELECT id,balance,xmin::text,xmax::text,ctid FROM account;",
          "language": "sql",
          "filename": "观察用SQL",
          "purpose": "在临时实例中逐条执行。事务号和ctid每次可能不同；本段用于理解系统列，不以固定数字验收。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "xmin标识创建这个元组版本的事务。xmax与删除或替代版本、行锁等内部状态有关，不能只看它非零就断言这行已经被删掉；中止事务和锁也会影响解释。ctid是表内物理位置，不适合作为跨请求的业务主键。普通SELECT在当前快照下通常只返回应当看见的版本，不会把所有历史版本都列出来。"
        },
        {
          "type": "paragraph",
          "text": "你可能见过“xmin比我的事务号小就能读”的解释。它漏掉了最重要的并发情况：编号较小的事务可能当时还没提交，之后才提交。快照需要知道哪些事务当时仍在进行，还要结合元组上的事务状态。本文不编写一份只有两次数字比较的伪实现来冒充 PostgreSQL 的完整可见性判断。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：xmin、xmax和ctid系统列",
          "url": "https://www.postgresql.org/docs/17/ddl-system-columns.html"
        },
        {
          "type": "figure",
          "src": "figures/database-mvcc/snapshot-lifetime.svg",
          "title": "同一个账户，为什么两次读取可能不同",
          "alt": "写者把10提交成20后，Read Committed下新语句读到20，Repeatable Read旧事务仍读10；旧快照保留会限制旧版本清理。",
          "caption": "时间线只表示受控事件顺序。下方版本图是教学模型，不展开冻结、MultiXact和全部元组标志。"
        }
      ]
    },
    {
      "id": "snapshots",
      "title": "快照的生命周期，才是两次读取差异的关键",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Read Committed是PostgreSQL默认隔离级别。对本文的普通SELECT，快照按语句建立：语句开始时已经提交的版本可以参与判断，语句执行途中别的事务提交，不会让这条扫描随时切换到另一份全局观察。下一条SELECT重新建立快照，就可能看到新的已提交值。"
        },
        {
          "type": "paragraph",
          "text": "Repeatable Read为事务维持稳定的快照，通常在第一次非事务控制语句时建立，而不只是执行BEGIN就立即抓住整个数据库的状态。这个细节会影响实验：如果只是先BEGIN，等别人提交后才第一次SELECT，你看到新值并不违背可重复读。配套测试必须确认第一次读取已完成，才允许写者更新提交。"
        },
        {
          "type": "table",
          "headers": [
            "事件顺序",
            "Read Committed读者",
            "Repeatable Read读者"
          ],
          "rows": [
            [
              "读者BEGIN，再首次SELECT",
              "读到10",
              "读到10，建立事务快照"
            ],
            [
              "独立写者UPDATE到20并提交",
              "写者事务完成",
              "写者事务完成"
            ],
            [
              "原读者第二次普通SELECT",
              "新语句快照读20",
              "同一事务快照仍读10"
            ],
            [
              "原读者提交，再开新事务SELECT",
              "20",
              "20"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "“稳定”约束的是其他事务对观察的影响。事务自身前面语句写入的值仍可被自身后面的查询看到。实验在Repeatable Read中将余额写成99，立即SELECT得到99，随后ROLLBACK，新事务又得到之前已提交的20。因此不要把快照想成一张连自己的操作都不允许改变的冻结截图。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：不同隔离级别的实际行为",
          "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
        }
      ]
    },
    {
      "id": "controlled",
      "title": "两个连接怎样保证真的按这个顺序执行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "CREATE TABLE account(id integer PRIMARY KEY, balance integer NOT NULL);\nINSERT INTO account VALUES(1,10);\nCREATE TABLE versions(id integer PRIMARY KEY, payload text NOT NULL)\nWITH (autovacuum_enabled=false);\nINSERT INTO versions SELECT i,repeat('old',100) FROM generate_series(1,5000) s(i);",
          "language": "sql",
          "filename": "examples/database-mvcc/schema.sql",
          "purpose": "完整初始数据：account用于可见性对照，versions用于保留与清理实验。只在实验表上关闭自动清理，避免后台操作干扰观察。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "测试里的session创建一个长期存活的psql进程，连接对应一笔会话。send把SQL发进去，wait等待该进程真正输出指定的\\echo标记。另一个sql调用使用独立连接，等到更新完成后才返回。屏障表示数据库已经跨过某个事件，而不是用固定睡眠猜测“更新应该完成了”。"
        },
        {
          "type": "code",
          "code": "  for(const [level,second] of [['READ COMMITTED',20],['REPEATABLE READ',10]]) {\n    await t.test(level+' determines snapshot lifetime',async()=>{\n      await sql('UPDATE account SET balance=10 WHERE id=1;');\n      const a=session('snapshot-reader');\n      a.send(`BEGIN ISOLATION LEVEL ${level}; SELECT 'first='||balance FROM account WHERE id=1;\\n\\\\echo FIRST`);\n      assert.match(await a.wait('FIRST'),/first=10/);\n      await sql('UPDATE account SET balance=20 WHERE id=1;','snapshot-writer');\n      a.send(\"SELECT 'second='||balance FROM account WHERE id=1;\\n\\\\echo SECOND\");\n      assert.match(await a.wait('SECOND'),new RegExp('second='+second));\n      assert.equal((await a.end('COMMIT;')).code,0);\n      assert.equal(await sql('SELECT balance FROM account WHERE id=1;'),'20');\n      console.log(level,`first=10 second=${second} new-transaction=20`);\n    });\n  }",
          "language": "js",
          "filename": "examples/database-mvcc/test.mjs",
          "purpose": "实际运行的快照对照：同一函数分别带入READ COMMITTED/20和REPEATABLE READ/10。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入Read Committed：FIRST先证明读者确实读到10；独立连接写20并完成；SECOND所对应的是下一条SELECT，因此读取20。换成Repeatable Read，FIRST建立的快照仍有效，SECOND读取10。提交后在新连接读到20，说明20早已提交成功，只是旧快照选择了旧版本。解释到这里，不需要跳到外部代码猜测输出为何不同。"
        },
        {
          "type": "paragraph",
          "text": "会话辅助把psql设为ON_ERROR_STOP，SQL错误会让进程返回非零状态，end返回code、output和error。until只在有界期限内检查明确条件，10ms轮询间隔是观察频率，不是“睡10ms就认为并发成立”。完整harness随示例下载，启动、退出及临时目录清理都由它负责。"
        }
      ]
    },
    {
      "id": "write-conflict",
      "title": "可重复读保护观察，但不会替你完成过期写入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "假设一个Repeatable Read事务已经读到余额20；另一个事务把它改成21并提交。旧事务随后执行balance=balance+1，数据库不能简单把“我此前的快照一直稳定”解释为“我仍能基于旧版本完成任意写入”。在这个冲突路径中，PostgreSQL返回序列化失败40001，要求应用重新开始事务。"
        },
        {
          "type": "code",
          "code": "  await t.test('repeatable-read stale writer receives SQLSTATE 40001',async()=>{\n    const a=session('stale-writer');\n    a.send('BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT balance FROM account WHERE id=1;\\n\\\\echo SNAPSHOT');\n    await a.wait('SNAPSHOT');\n    await sql('UPDATE account SET balance=21 WHERE id=1;');\n    const result=await a.end('UPDATE account SET balance=balance+1 WHERE id=1; COMMIT;');\n    assert.notEqual(result.code,0);\n    assert.match(result.error,/40001/);\n    assert.equal(await sql('SELECT balance FROM account WHERE id=1;'),'21');\n  });",
          "language": "js",
          "filename": "examples/database-mvcc/test.mjs",
          "purpose": "真实失败路径：先固定旧快照，再由另一个连接提交；断言40001和余额未被旧写者修改。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "测试中的40001不是数据库丢失更新的证据，而是数据库拒绝让这个过期写入成功。应用如果决定重试，范围应包括BEGIN、读取、业务判断和全部相关写入。只把失败UPDATE再发一次，或者捕获错误后继续向同一个失败事务发送COMMIT，都没有重新做决策。"
        },
        {
          "type": "paragraph",
          "text": "在Read Committed的并发UPDATE路径中，还可能先等待被更新行的持有者，再针对新版本重新检查条件；这与普通SELECT的语句快照不是同一句口号能概括的。读、锁定读和写入要分开分析。本篇用RR失败强调边界，锁与死锁专题进一步复现实际等待。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：序列化失败怎样恢复",
          "url": "https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html"
        }
      ]
    },
    {
      "id": "write-skew",
      "title": "稳定快照为什么仍可能做出不一致的跨行决定",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在把业务规则说具体：医生1和2最初都在岗，要求至少保留一人值班。每人只有在看见总在岗人数大于1时才能下班。两个事务先在各自快照里读到2，再分别把自己的那一行改成false。它们修改不同的记录，不必争同一行的写锁。"
        },
        {
          "type": "code",
          "code": "-- 仅在本教学实例准备\nCREATE TABLE doctors(id integer PRIMARY KEY,on_call boolean NOT NULL);\nINSERT INTO doctors VALUES(1,true),(2,true);\n\n-- 会话A：先执行到读取，暂不提交\nBEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT count(*) FROM doctors WHERE on_call; -- 2\n-- 会话B：也执行到读取，暂不提交\nBEGIN ISOLATION LEVEL REPEATABLE READ;\nSELECT count(*) FROM doctors WHERE on_call; -- 2\n\n-- A继续：\nUPDATE doctors SET on_call=false WHERE id=1;\nCOMMIT;\n-- B在自己的原事务中继续：\nUPDATE doctors SET on_call=false WHERE id=2;\nCOMMIT;\n-- 新会话最终检查：\nSELECT count(*) FROM doctors WHERE on_call; -- 0",
          "language": "sql",
          "filename": "双会话教学步骤",
          "purpose": "带会话标签的步骤需要分别在A/B连接执行，不能作为一个连接中的整段脚本。自动测试用屏障实现相同交错。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Repeatable Read下两笔都提交，最后在岗人数0。两边读取过程都“很稳定”，跨行不变量却被破坏，这就是写偏斜。把同一交错改成Serializable，实际测试中第二个事务得到40001，最终还剩1人。成功提交的事务必须能解释成某个串行顺序；必要时让一方失败，是实现这一保证的方式。"
        },
        {
          "type": "paragraph",
          "text": "Serializable没有承诺你的每笔事务都会成功，也没有替应用重新读取并判断是否仍可下班。如果重试者在新事务里看到只剩1人，就应该拒绝下班，不再执行旧决定。另一种设计是让所有相关路径争用一个明确的协调记录或锁定完整的决策集合，但必须说明覆盖范围，不能随意锁一行就宣称保护了整个条件。"
        }
      ]
    },
    {
      "id": "vacuum",
      "title": "旧版本为何需要VACUUM，又为何有时删不掉",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "既然更新留下旧版本，数据库就需要回收不再需要的空间。普通VACUUM清理已经对相关事务不再有用的版本，让空间供后续写入复用，也维护可见性映射等信息。它不是“回滚所有旧数据”，也不是执行一次就把表文件压成最小尺寸。ANALYZE主要更新统计信息，不能用它替代版本清理。"
        },
        {
          "type": "paragraph",
          "text": "配套实验为versions表插入5000行旧内容。一个Repeatable Read会话先读取old内容并保持事务，然后写者将所有行改成new并提交。此时旧快照仍有权看到old，所以VACUUM不能为了省空间把它们清掉。实验观察的是VACUUM VERBOSE明确报告的不可回收版本数，而不是根据文件大小没变猜测清理失败。"
        },
        {
          "type": "code",
          "code": "  await t.test('a retained snapshot prevents old-version removal until released',async()=>{\n    const a=session('vacuum-reader');\n    a.send(\"BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM versions WHERE payload LIKE 'old%';\\n\\\\echo HELD\");\n    await a.wait('HELD');\n    await sql(\"UPDATE versions SET payload=repeat('new',100);\");\n    const held=await query('VACUUM (VERBOSE) versions;');\n    assert.match(held.stderr,/5000 are dead but not yet removable/);\n    a.send(\"SELECT 'old-visible='||count(*) FROM versions WHERE payload LIKE 'old%';\\n\\\\echo STILL_OLD\");\n    assert.match(await a.wait('STILL_OLD'),/old-visible=5000/);\n    assert.equal((await a.end('COMMIT;')).code,0);\n    const released=await query('VACUUM (VERBOSE) versions;');\n    assert.match(released.stderr,/0 are dead but not yet removable/);\n    assert.equal(await sql(\"SELECT count(*) FROM versions WHERE payload LIKE 'new%';\"),'5000');\n    console.log('held snapshot: 5000 old versions not yet removable; released: 0');\n  });",
          "language": "js",
          "filename": "examples/database-mvcc/test.mjs",
          "purpose": "完整保留与释放实验；VERBOSE证据来自stderr。结束读事务后再次VACUUM，检查不可移除旧版本归零。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "顺着这段代码看：HELD先证明旧观察已建立；写者更新完成；第一次VACUUM说5000个旧版本尚不可移除；旧读者再查确实仍看到5000条old。读者COMMIT后，第二次VACUUM报告0个仍不可移除的旧版本，新会话看到5000条new。观察与清理是同一机制的两面，不是两个偶然同时变化的指标。"
        },
        {
          "type": "paragraph",
          "text": "普通VACUUM通常让空间在表内部复用，不保证把所有空洞归还操作系统；部分尾部空页可能被截断。VACUUM FULL通过重写压缩表，需要更强锁和额外空间，不能因为磁盘占用没有立刻下降就直接在线上执行。本文验证的是旧快照限制回收的机制，不提供生产膨胀治理或停机窗口承诺。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：日常清理、可见性映射与空间回收",
          "url": "https://www.postgresql.org/docs/17/routine-vacuuming.html"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：VACUUM选项与锁、事务限制",
          "url": "https://www.postgresql.org/docs/17/sql-vacuum.html"
        }
      ]
    },
    {
      "id": "diagnose",
      "title": "面对长事务和膨胀，先观察哪个边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "“事务开得久”值得关注，但仅看BEGIN时间不能完整判断它是否一直保留旧快照。Read Committed两条语句之间的行为，与Repeatable Read持续持有事务快照并不相同。实际排查应结合backend_xmin、事务状态、当前查询和清理日志，确认是哪个会话或其他机制维持回收边界。"
        },
        {
          "type": "code",
          "code": "SELECT pid,application_name,state,xact_start,backend_xmin,\n       wait_event_type,wait_event,left(query,160) AS query\nFROM pg_stat_activity\nWHERE datname=current_database() AND pid<>pg_backend_pid()\nORDER BY xact_start NULLS LAST;\n\nSELECT relname,n_live_tup,n_dead_tup,last_vacuum,last_autovacuum\nFROM pg_stat_user_tables\nWHERE relname IN ('account','versions');",
          "language": "sql",
          "filename": "诊断查询",
          "purpose": "系统统计中的活/死元组数是估计值；权限会影响看到的其他会话信息。不能把某一时刻估计值当作精确版本清单。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "先问长会话是否正在处理必要工作，还是忘记提交而idle in transaction；再问应用为何在事务内等用户、慢接口或大文件。能把无关等待挪出事务，往往比盲目提高清理频率更直接。监控、超时与连接池回收要配合业务语义；取消或终止会话会让其事务回滚，需要先确认影响。"
        },
        {
          "type": "paragraph",
          "text": "复制槽、备库反馈、准备事务等也可能影响版本保留边界，但不在本实验环境里。不要把本文“释放一个RR会话后可清理”的结果扩大成所有生产场景的唯一原因。PostgreSQL还需要处理事务号回卷等维护问题，保留autovacuum并观察它的进度是基础工作，不应只在磁盘满了以后手工运行一次。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：活动会话与表统计字段",
          "url": "https://www.postgresql.org/docs/17/monitoring-stats.html"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行结果、限制和一个可推演的练习",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/database-mvcc\nnvm use\nnpm ci\nPG_BIN=/Library/PostgreSQL/17/bin npm test\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "使用已安装PostgreSQL17；没有npm第三方依赖。端口55441仅用于本套临时实例，三个数据库实验顺序运行。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "独立harness创建并清理自己的PGDATA，只监听本机55441，不连接5432。会话出现SQL错误时测试保留SQLSTATE，失败也经finally停止实例。固定轮询上限是测试故障保护，不是数据库响应时间指标；机器休眠或调度暂停可能让整套测试超时，需要在正常运行环境复现，不能据此推导数据库性能。"
        },
        {
          "type": "paragraph",
          "text": "实际执行通过7个子场景，含顶层Node报告8项：RC与RR两种读取、事务自身读写与回滚、RR过期写40001、RR与Serializable写偏斜对照，以及旧快照释放前后VACUUM。没有验证物理备库、复制槽、故障恢复或并发高负载；图形已在macOS及站点桌面、手机视口中查看，尚未做原生手机验证。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "BEGIN之后等别人提交，再首次SELECT，会不会必然看见旧值？",
              "不会。RR关键在首次非事务控制语句建立的快照，不是只看BEGIN先后。"
            ],
            [
              "RR不能看到别人的新提交，为什么能看到自己写99？",
              "可见性规则包含事务自身操作，稳定观察不等于冻结自身全部变化。"
            ],
            [
              "旧快照读者提交后，VACUUM为什么能清理？",
              "仍需访问旧版本的观察被释放，回收边界得以前进。"
            ],
            [
              "RR写偏斜为什么没有争同一行锁？",
              "两笔分别修改不同医生；冲突来自对跨行条件的共同判断。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "可以把真正在岗人数改为3，再让三个事务先读后各自下班，推演RR与Serializable的差异。写出不变量、读取范围和写入行，比先背隔离现象表更有帮助。MVCC解决的是并发可见性；想把业务规则落实为并发下的正确写入，还需要约束、锁或可重试的串行化事务。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PG17 MVCC",
      "url": "https://www.postgresql.org/docs/17/mvcc-intro.html"
    },
    {
      "title": "PG17 事务隔离",
      "url": "https://www.postgresql.org/docs/17/transaction-iso.html"
    },
    {
      "title": "PG17 系统列",
      "url": "https://www.postgresql.org/docs/17/ddl-system-columns.html"
    },
    {
      "title": "PG17 VACUUM",
      "url": "https://www.postgresql.org/docs/17/routine-vacuuming.html"
    },
    {
      "title": "PG17 序列化失败处理",
      "url": "https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html"
    },
    {
      "title": "PG17 活动统计",
      "url": "https://www.postgresql.org/docs/17/monitoring-stats.html"
    }
  ]
};
export default article;
