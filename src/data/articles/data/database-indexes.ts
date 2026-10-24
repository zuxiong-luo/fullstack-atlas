import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "database-indexes",
  "topic": "data",
  "title": "数据库索引：B-tree、联合索引与访问路径",
  "description": "从索引的结构和代价出发，为订单列表设计联合 B-tree，再用真实执行计划验证排序、覆盖与堆访问。",
  "minutes": 32,
  "labMinutes": 30,
  "tags": [
    "PostgreSQL",
    "B-tree",
    "联合索引",
    "EXPLAIN",
    "Index Only Scan"
  ],
  "scope": "主线是 PostgreSQL 17 的 B-tree 和单表访问路径；不把 PostgreSQL 的堆表结构套到 InnoDB，也不展开 JOIN 优化器实现。",
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
    {"label":"完整实验与测试 ZIP","path":"database-indexes.zip"},
    {
      "label": "独立 PostgreSQL 实验、测试与运行说明",
      "path": "database-indexes/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "索引是什么：一份有组织的访问结构",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据库索引是数据库另外维护的数据结构。它保存用于定位记录的信息，让查询有机会沿着一条更短的访问路径找到数据。这里的“另外维护”很关键：表里有订单，索引里还要有与这些订单对应的条目。读操作可能少做工作，写操作却多了一份维护任务。索引既不是查询结果缓存，也不会让所有查询都自动变快。"
        },
        {
          "type": "paragraph",
          "text": "本文使用 PostgreSQL 的普通堆表。堆表可以理解为存放行版本的数据页集合；B-tree 索引单独存储，叶子条目通常携带键值和指向堆元组的位置。先沿索引找位置、再访问表，这两步不能简单当作同一次内存取值。主键也会建立索引，但 PostgreSQL 普通表不会因为主键存在，就持续按主键重排所有行。不要把 InnoDB 聚簇主键的知识原样套进来。"
        },
        {
          "type": "paragraph",
          "text": "我们会围绕一张多租户订单表回答三个问题：联合索引为什么要考虑键顺序；索引为什么能省排序却仍访问表；为什么有索引，优化器还是可能选择扫描表。学完后，你应该能针对一个明确的查询提出访问路径，再用执行计划判断它有没有真的减少工作，而不是看到索引名字就宣布优化成功。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：索引类型与适用操作",
          "url": "https://www.postgresql.org/docs/17/indexes-types.html"
        }
      ]
    },
    {
      "id": "structure",
      "title": "B-tree 怎样支持查找、范围与顺序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "B-tree 把键有序地组织在多个页中。内部页保存分隔信息和下层页位置，搜索时比较目标键，逐层缩小范围；到达叶子层后，可以继续沿有序条目扫描相邻范围。一个页能放多个条目，所以树不需要像“一节点一键”的二叉搜索树那样深。教学中常说查找近似对数级，但数据库实际代价还包括访问几个页、页是否已经缓存、匹配多少条目，以及还要读取多少表页。"
        },
        {
          "type": "paragraph",
          "text": "因此，B-tree 不只适用于等值查找，也能承接可索引的范围条件和有序输出。查询需要全表大多数记录时，定位到叶子后仍然要读很多条目，再回表取很多行，这条路径未必比顺序扫描合算。把“查树很快”直接推成“查出十万行也很快”，漏掉的是结果规模。"
        },
        {
          "type": "figure",
          "src": "figures/database-indexes/btree-access.svg",
          "title": "从联合键到可见性检查的一次访问",
          "alt": "内部页定位租户42且状态paid的区间，沿日期和id顺序取行；根据可见性映射决定是否访问堆元组。",
          "caption": "教学简化结构，不表示真实树高、页数或耗时。读图时把“缩小索引范围”和“省掉堆访问”分成两件事。"
        },
        {
          "type": "paragraph",
          "text": "联合键按列顺序比较。例如键为 tenant_id、status、created_at、id，先比较租户，租户相同再比较状态，状态也相同才比较日期，最后用 id 打破日期相同的并列。这个排序规则决定哪些条件能圈定连续范围，也决定输出能否满足 ORDER BY。SQL 的 WHERE 条件写在哪个文本位置，并不改变索引键的物理顺序。"
        }
      ]
    },
    {
      "id": "fixture",
      "title": "先固定问题，再准备能复现的数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "订单列表的需求是：租户42查看已支付订单，只取2026年1月2日以来最近的20条，返回订单号和金额。日期可能相同，所以排序末尾加 id，使同一组查询结果具有确定的并列顺序。示例的 timestamp 不涉及跨时区业务；真实系统使用 timestamptz 时要另外明确输入时区与展示规则。"
        },
        {
          "type": "code",
          "code": "CREATE TABLE orders (\n  id bigint PRIMARY KEY,\n  tenant_id integer NOT NULL,\n  status text NOT NULL,\n  created_at timestamp NOT NULL,\n  amount_cents integer NOT NULL,\n  note text NOT NULL\n) WITH (autovacuum_enabled=false);\nINSERT INTO orders\nSELECT i, i%100,\n       CASE WHEN i%3=0 THEN 'paid' ELSE 'pending' END,\n       timestamp '2026-01-01' + i*interval '1 second',\n       i%10000, repeat('x',120)\nFROM generate_series(1,200000) AS s(i);\nANALYZE orders;",
          "language": "sql",
          "filename": "examples/database-indexes/schema.sql",
          "purpose": "完整建表与确定性数据：20万行、100个租户、paid/pending两种状态。仅实验表关闭autovacuum，便于控制可见性映射；生产不要照抄关闭。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "i%100把订单分给100个租户；i%3让部分订单已支付；日期随 i 递增。note 故意放一段不参与查询的文本，让“读取整行”和“只需要两个输出列”的差异更容易解释。这个数据分布是教学夹具，不是对真实租户活跃度的猜测。生产数据可能存在热点租户和强烈相关性，必须重新检查估算。"
        },
        {
          "type": "code",
          "code": "SELECT id, amount_cents FROM orders\nWHERE tenant_id=42 AND status='paid'\n  AND created_at >= timestamp '2026-01-02'\nORDER BY created_at DESC, id DESC LIMIT 20;",
          "language": "sql",
          "filename": "订单列表查询",
          "purpose": "后续所有前后对照使用相同条件与排序；WHERE、ORDER BY、输出列一起决定候选索引。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "没有匹配的联合索引时，只有 id 主键索引。id 的顺序不能直接定位指定租户和状态，数据库仍需要检查许多订单。测试先保存查询结果，再获取 JSON 执行计划，后面确认加索引改变了访问方式，却没有改变业务结果。"
        }
      ]
    },
    {
      "id": "design",
      "title": "为什么这个查询选择这样的联合键",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "CREATE INDEX orders_recent ON orders\n  (tenant_id, status, created_at DESC, id DESC)\n  INCLUDE (amount_cents);\nVACUUM (ANALYZE) orders;",
          "language": "sql",
          "filename": "建立候选访问路径",
          "purpose": "VACUUM必须在事务块之外单独执行。这里有意先清理并更新统计，观察覆盖索引的理想可见性条件。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "tenant_id=42 和 status=paid 都是等值条件。先用它们圈定索引中的一段，再按 created_at 的范围下界限制扫描。因为日期与 id 已按需求倒序排列，执行器可以从符合条件的最新条目开始，取够20行后停止，不需要先把全部候选记录排序。这个推导同时利用了筛选、输出顺序和 LIMIT，单独看某一个字段的区分度不够。"
        },
        {
          "type": "paragraph",
          "text": "在本查询两个前导列都有等值条件时，交换 tenant_id 与 status 也可能有效。这里把租户放在前面，是因为订单访问天然以租户为范围；如果另有大量跨租户的状态检索，那个查询可能需要不同的索引。没有一份脱离查询集合、写入成本和数据分布的万能列顺序。"
        },
        {
          "type": "paragraph",
          "text": "日期后面的 id 用于稳定排序。amount_cents 则放在 INCLUDE 中：它只是要返回的负载，不参与联合键的搜索顺序。把它列为 INCLUDE，表达的是“查到条目时顺便拿到金额”，并不让 amount_cents>100 自动拥有一个按金额排列的定位路径。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：多列索引的前导等值与范围规则",
          "url": "https://www.postgresql.org/docs/17/indexes-multicolumn.html"
        },
        {
          "type": "paragraph",
          "text": "所谓“最左前缀”最好理解为扫描范围怎样收窄，而不是背成“缺少第一列索引绝对失效”。在 PostgreSQL 17，多列 B-tree 可以被用于只约束后续列的条件，但可能需要扫描很大一段甚至整个索引。后续列上的条件即使出现在 Index Cond，也不意味着它一定像前导等值一样缩短遍历区间。还要结合条件位置、实际扫描规模和表访问判断。"
        }
      ]
    },
    {
      "id": "plans",
      "title": "从执行计划确认工作究竟少在哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)\nSELECT id, amount_cents FROM orders\nWHERE tenant_id=42 AND status='paid'\n  AND created_at >= timestamp '2026-01-02'\nORDER BY created_at DESC, id DESC LIMIT 20;",
          "language": "sql",
          "filename": "计划观察命令",
          "purpose": "ANALYZE会真正执行查询。写语句也会被执行，不能在生产库随意拿更新语句做试验。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "EXPLAIN 给出计划结构；加 ANALYZE 后会执行并报告实际行数等信息；BUFFERS 补充缓冲页访问。cost 是优化器的估算单位，不是毫秒；Actual Rows 也要结合 Loops 理解，不能把一个内层节点的单次行数当作整次查询总工作量。本文把计划作为机制证据，不用单次耗时给硬盘或生产吞吐做结论。"
        },
        {
          "type": "table",
          "headers": [
            "本机17.4实测阶段",
            "观察结果",
            "它支持的判断"
          ],
          "rows": [
            [
              "只有主键索引",
              "Limit → Gather Merge → Sort → Seq Scan",
              "并行扫描分支过滤后排序，再归并有序结果"
            ],
            [
              "新增联合索引并VACUUM",
              "Limit → Index Only Scan；20行；Heap Fetches=0",
              "候选索引承接筛选和排序，本次无堆元组读取"
            ],
            [
              "只改金额，尚未再次VACUUM",
              "仍是Index Only Scan；Heap Fetches=40",
              "计划名称没有保证零堆访问"
            ],
            [
              "再次VACUUM",
              "Heap Fetches=0",
              "本例可见性条件恢复，不能据此关闭autovacuum"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "没有索引时，测试观察到 Gather Merge，是因为优化器选择了并行计划。其他机器也可能只有 Limit、Sort、Seq Scan；本测试不要求某个并行度或精确成本。它要求找到顺序扫描和排序，建立索引后找到 orders_recent，且结果不变、独立 Sort 消失。这比把一张本机计划截图当成所有环境的固定答案更稳妥。"
        },
        {
          "type": "code",
          "code": "  await t.test('leading equalities plus ordered suffix return same rows without Sort',async()=>{\n    assert.equal(await sql(recent),expected);\n    const nodes=flatten(await plan(recent));\n    const index=nodes.find(n=>n['Index Name']==='orders_recent');\n    assert.ok(index);\n    assert.equal(index['Node Type'],'Index Only Scan');\n    assert.ok(!nodes.some(n=>n['Node Type']==='Sort'));\n    assert.equal(index['Heap Fetches'],0);\n    console.log('after:',JSON.stringify({type:index['Node Type'],rows:index['Actual Rows'],heapFetches:index['Heap Fetches'],condition:index['Index Cond']}));\n  });",
          "language": "js",
          "filename": "examples/database-indexes/test.mjs",
          "purpose": "从实际JSON计划中遍历节点，并核验无Sort与零堆访问；这是已运行测试的连续原文节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "上段中的 recent 就是正文的完整查询；expected 是建索引前保存的结果。flatten 递归展平 Plan 的子节点，plan 调用前面的 EXPLAIN JSON。下面补齐这两个函数，避免“看到一个测试名”就当成证据。连接辅助负责调用独立实例中的 psql，完整夹具随下载提供。"
        },
        {
          "type": "code",
          "code": "const flatten=node=>[node,...(node.Plans??[]).flatMap(flatten)];\nconst plan=async query=>JSON.parse(await sql(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`))[0].Plan;",
          "language": "js",
          "filename": "examples/database-indexes/test.mjs",
          "purpose": "实际计划解析与树遍历：不靠正则判断一长段计划是否“有索引”。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：怎样解读EXPLAIN",
          "url": "https://www.postgresql.org/docs/17/using-explain.html"
        }
      ]
    },
    {
      "id": "covering",
      "title": "覆盖了输出列，为什么还可能回表",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "覆盖索引表示查询所需的列值能从索引取得，但数据库还必须确认相应行版本对当前快照可见。普通 B-tree 条目没有保存完成这项判断所需的全部 MVCC 信息。PostgreSQL 用可见性映射记录哪些堆页已经处于 all-visible 状态；满足条件时，可以跳过到堆页验证每个元组的步骤。"
        },
        {
          "type": "paragraph",
          "text": "这就把两个条件拆开了：列是否覆盖，是索引结构与查询的关系；能否省掉堆访问，还依赖表页状态。测试先 VACUUM，再查最近20行，Heap Fetches 为0；更新租户42的金额后，对应页的可见性状态改变，本机同一查询报告40次堆获取。40不是“20行必然查两次”的通用公式，它受旧版本与索引条目、页状态、执行计划影响。"
        },
        {
          "type": "code",
          "code": "  await t.test('INCLUDE is payload: dirty visibility map requires heap checks',async()=>{\n    await sql('UPDATE orders SET amount_cents=amount_cents+1 WHERE tenant_id=42;');\n    const dirty=flatten(await plan(recent)).find(n=>n['Index Name']==='orders_recent');\n    assert.equal(dirty['Node Type'],'Index Only Scan');\n    assert.ok(dirty['Heap Fetches']>0);\n    console.log('dirty heap fetches:',dirty['Heap Fetches']);\n    await sql('VACUUM (ANALYZE) orders;');\n    const clean=flatten(await plan(recent)).find(n=>n['Index Name']==='orders_recent');\n    assert.equal(clean['Heap Fetches'],0);\n  });",
          "language": "js",
          "filename": "examples/database-indexes/test.mjs",
          "purpose": "实际反例：更新后断言需要堆访问，再VACUUM验证恢复；只断言>0，不把本机40写成跨环境常量。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "对于频繁更新的订单表，复制一批很宽的列进 INCLUDE，可能增加索引尺寸、写放大和缓存压力，却未必稳定获得零堆访问。对较少变化的归档查询，收益条件可能更好。是否增加覆盖列，应同时查看数据变更频率、查询投影和 Heap Fetches，不能只看“覆盖”这两个字。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：Index-Only Scan与覆盖索引",
          "url": "https://www.postgresql.org/docs/17/indexes-index-only-scans.html"
        }
      ]
    },
    {
      "id": "counterexamples",
      "title": "几个容易被误叫作“索引失效”的情况",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先看没有 tenant_id 的查询：SELECT * FROM orders WHERE status=paid。示例中有66666条记录匹配，测试观察到 Seq Scan。它并没有证明 PostgreSQL 禁止使用联合索引，而是说明面对这个访问范围，表扫描是本机优化器认为更合算的路径。把查询改成很少的结果列、不同数据分布或不同成本参数，计划可能变化。"
        },
        {
          "type": "code",
          "code": "SELECT count(*) FROM orders WHERE status='paid';\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM orders WHERE status='paid';\n\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT id FROM orders WHERE tenant_id+1=43 AND status='paid';\nCREATE INDEX orders_tenant_expression ON orders((tenant_id+1));\nANALYZE orders;",
          "language": "sql",
          "filename": "对照查询",
          "purpose": "前一个查询观察大量匹配时的路径；后一个展示表达式与普通键不等价。不要通过关闭seqscan来证明生产应该用索引。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "再看 tenant_id+1=43。人能看出它和 tenant_id=42 的关系，不代表优化器必然把任意表达式改写成同一种索引条件。测试在未建表达式索引前观察到相关 Filter；建立与条件一致的表达式索引后，计划出现 orders_tenant_expression。真实业务优先考虑能否把条件自然写成 tenant_id=42；不要为了每个随意变换的表达式都追加一份索引。"
        },
        {
          "type": "paragraph",
          "text": "还要区分类型转换、文本排序规则与运算符族是否匹配，统计估算是否过时，以及一次查询到底返回多少数据。不要只凭SQL里有函数、OR或模糊匹配，就断言全部索引都不可用。这些语法各有可能的访问方式，必须落到具体表达式、索引定义和计划上。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL 17：B-tree输出顺序与显式排序的取舍",
          "url": "https://www.postgresql.org/docs/17/indexes-ordering.html"
        }
      ]
    },
    {
      "id": "costs",
      "title": "读得快的代价，最终由写入和维护支付",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "新增订单时，需要维护相应索引条目；更新索引涉及的列，也可能产生额外条目和页面工作。索引越宽，单页能放的条目越少，常用页更难全留在缓存。INCLUDE 的金额虽然不用于定位，仍是需要维护的索引数据。本篇修改金额的案例正好提醒我们：查询负载列不是免费的复制品。"
        },
        {
          "type": "paragraph",
          "text": "真实环境建立索引还涉及锁和资源。普通 CREATE INDEX 会阻止目标表的写入；CREATE INDEX CONCURRENTLY 降低这种写入阻塞，却有不同阶段、耗时和失败清理要求，不能放在普通事务块内执行。本文是在临时实例中建索引，不提供在线迁移的可用性承诺。发布前应单独演练构建、失败后检查无效索引，以及回滚办法。"
        },
        {
          "type": "paragraph",
          "text": "选择时先整理高频查询及其限制：哪些必须租户隔离、哪些要求最近N条、哪些是全量分析。为决定性访问路径建立少量索引，再验证写入成本与数据增长。两个看起来相近的索引是否能合并，也要检查前导列、排序方向、部分谓词和覆盖列；仅凭字段集合相同不能认定重复。"
        }
      ]
    },
    {
      "id": "run",
      "title": "复现、解释结果与继续练习",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/database-indexes\nnvm use\nnpm ci\n# PG_BIN改成你的PostgreSQL 17 bin目录；默认是macOS安装位置\nPG_BIN=/Library/PostgreSQL/17/bin npm test\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "无第三方npm依赖。三个新数据库实验均使用55441，按顺序运行；占用时启动失败，不连接现有5432。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "harness 每次创建独立临时 PGDATA 和私有socket目录，只监听127.0.0.1:55441。initdb 的 trust 认证只用于本机教学实例，不是部署建议。结束时 finally 停止本实例并删除自己创建的目录；启动失败也不会接管已有服务。不要把连接参数换成公司的数据库后运行建表脚本。"
        },
        {
          "type": "paragraph",
          "text": "2026年10月23日，在 macOS14.5、PostgreSQL17.4、Node22.12.0 实际通过5个子场景，Node报告包含顶层共6项通过。没有进行冷缓存、持续负载或并发写入基准，因此本文不给提速倍数。SVG已通过本机渲染与站点桌面、手机视口检查；手机视口不等于原生设备验证。"
        },
        {
          "type": "paragraph",
          "text": "如果结果不同，先确认版本、数据是否完整生成、ANALYZE是否运行、是否真的在临时实例，以及执行计划是否因成本环境改变。若Index Only Scan有堆访问，先检查更新与可见性条件，不要先认定索引坏了。可以做一个修改练习：把查询改成按金额排序，解释为什么原索引的日期顺序不能直接满足它，再用计划检验。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "INCLUDE金额后，能按金额快速定位吗？",
              "不能据此推出。它是负载列，不参与这份索引的搜索排序。"
            ],
            [
              "计划叫Index Only Scan，Heap Fetches为何不是0？",
              "列已覆盖，但页不可直接确认为全可见，需要检查堆元组。"
            ],
            [
              "缺租户条件还能用联合索引吗？",
              "语义上可能使用；扫描范围与成本可能使优化器选择表扫描。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "设计索引的起点是查询怎样筛选、排序和返回数据。B-tree提供有序访问，联合键决定范围，优化器选择路径，MVCC决定是否还需验证表版本。接下来理解MVCC，会让Heap Fetches、长事务和清理不再是互不相关的指标。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PG17 多列索引",
      "url": "https://www.postgresql.org/docs/17/indexes-multicolumn.html"
    },
    {
      "title": "PG17 Index Only Scan",
      "url": "https://www.postgresql.org/docs/17/indexes-index-only-scans.html"
    },
    {
      "title": "PG17 EXPLAIN",
      "url": "https://www.postgresql.org/docs/17/using-explain.html"
    },
    {
      "title": "PG17 索引与排序",
      "url": "https://www.postgresql.org/docs/17/indexes-ordering.html"
    },
    {
      "title": "PG17 CREATE INDEX",
      "url": "https://www.postgresql.org/docs/17/sql-createindex.html"
    }
  ]
};
export default article;
