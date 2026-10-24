import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "sql-execution-plans",
  "topic": "data",
  "title": "SQL 与执行计划：JOIN、排序、聚合和分页怎样变慢",
  "description": "在可复现的6万行订单数据上读取实际计划树，解释行数与loops、排序落盘、统计偏差和深分页，比较相同结果背后的工作量。",
  "scope": "在可复现的6万行订单数据上读取实际计划树，解释行数与loops、排序落盘、统计偏差和深分页，比较相同结果背后的工作量。 教学数据在独立PostgreSQL17实例；不连接用户5432，不将本机测试当生产容量或高可用证明。",
  "minutes": 58,
  "tags": [
    "SQL",
    "EXPLAIN",
    "JOIN",
    "排序",
    "分页",
    "统计信息"
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
      "path": "sql-execution-plans.zip"
    },
    {
      "label": "运行与验证边界",
      "path": "sql-execution-plans/README.md"
    }
  ],
  "questionIds": [],
  "sections": [
    {
      "id": "plan",
      "title": "执行计划是什么：SQL描述结果，计划安排怎样得到它",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "SQL声明需要哪些行和怎样组合它们，执行计划则描述数据库准备采用的扫描、连接、排序与聚合步骤。同一条SQL可以有不同合法计划，选择受索引、数据量、值分布、统计信息、配置和成本估算影响。因此慢查询排查不是看到Seq Scan就添加索引，而是先问：哪些步骤处理了多少行，为什么需要这些行，估算和实际是否相符。"
        },
        {
          "type": "paragraph",
          "text": "本文用1000个客户和60000条订单做一组实验。前30000条都属于客户1，其余分到其他客户；时间戳刻意有重复，排序最后用id打破平局。数据包含较宽payload，让外部排序可观察。这个分布是教学输入，不是某个真实业务的用户画像；我们比较的是路径与工作量，不发布“加索引快多少倍”的机器相关结论。"
        },
        {
          "type": "code",
          "filename": "examples/sql-execution-plans/schema.sql",
          "language": "sql",
          "code": "CREATE TABLE customers(id integer PRIMARY KEY,region text NOT NULL);\nCREATE TABLE orders(id integer PRIMARY KEY,customer_id integer NOT NULL REFERENCES customers(id),\n created_at timestamptz NOT NULL,amount integer NOT NULL,payload text NOT NULL);\nINSERT INTO customers SELECT i,CASE WHEN i%2=0 THEN 'east' ELSE 'west' END FROM generate_series(1,1000)i;\nINSERT INTO orders SELECT i,CASE WHEN i<=30000 THEN 1 ELSE 2+i%999 END,\n '2026-01-01T00:00:00Z'::timestamptz+(i%1000)*interval '1 second',i%100,\n repeat(md5(i::text),8) FROM generate_series(1,60000)i;\nANALYZE customers;ANALYZE orders;",
          "purpose": "完整数据生成脚本，固定规模与偏斜。每次在新的PostgreSQL17实例重建，不依赖读者已有数据库。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "EXPLAIN只显示规划，EXPLAIN ANALYZE会真正执行语句。本文只分析受控SELECT；如果换成写入，要先评估副作用，不能把“查看计划”当只读操作。即使包ROLLBACK，序列等非事务效果也未必回退。在线环境还要考虑执行负载、锁与敏感查询文本，先在隔离数据上复现通常更容易判断。"
        }
      ]
    },
    {
      "id": "read-tree",
      "title": "读计划树：从数据来源往上，区别估算与实际",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/sql-execution-plans/plan.mjs",
          "language": "javascript",
          "code": "export async function explain(db,query,params=[]){return (await db.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+query,params)).rows[0]['QUERY PLAN'][0];}\nexport function nodes(plan){const root=plan.Plan??plan;return [root,...(root.Plans??[]).flatMap(nodes)];}\nexport function summary(plan){return nodes(plan).map(node=>({type:node['Node Type'],estimated:node['Plan Rows'],actual:node['Actual Rows'],loops:node['Actual Loops'],removed:node['Rows Removed by Filter']??0,index:node['Index Name'],sort:node['Sort Method'],space:node['Sort Space Type']}));}",
          "purpose": "实际计划采集与摘要。JSON保留节点层次，摘要不以耗时排名；文中选择关键节点解释。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "底层扫描节点产出行，上层可能连接、过滤、排序、汇总和截断。Plan Rows是规划器估计这个节点输出多少行；Actual Rows是实际平均每次执行输出多少行，Actual Loops表示执行次数。遇到内层多次循环或并行节点，不能只看一个Actual Rows就当全局处理量，通常要结合loops、上下文及各worker信息理解。"
        },
        {
          "type": "paragraph",
          "text": "Rows Removed by Filter说明节点过滤掉的行，但不等于所有未返回工作的总数。索引条件可能已经在访问路径中排除候选，排序还要处理输入，LIMIT截断前的数据也可能已经生成。BUFFERS里的hit/read是缓冲页访问统计，不是每一个read都等同物理磁盘冷读；OS缓存与重复访问会影响解释。"
        },
        {
          "type": "paragraph",
          "text": "cost是规划器自己的相对成本单位，不是毫秒；各节点耗时也不能随意相加，因为父节点通常包含等待子节点产出的时间。本文摘要刻意聚焦节点、行数、loops与排序空间，原始JSON仍可按需要查看。先理解工作发生在哪里，再决定是否需要专项性能测量。"
        }
      ]
    },
    {
      "id": "index",
      "title": "同一查询前后：少量结果也可能先扫描大量数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/sql-execution-plans/test.mjs",
          "language": "javascript",
          "code": "  const query='SELECT id,created_at FROM orders WHERE customer_id=500 ORDER BY created_at DESC,id DESC LIMIT 20';\n  await t.test('before index scans rows and sorts, after index obtains same rows by access path',async()=>{const before=await explain(db,query),rows=(await db.query(query)).rows;assert.ok(nodes(before).some(n=>n['Node Type']==='Seq Scan'));await db.query('CREATE INDEX order_customer_time ON orders(customer_id,created_at DESC,id DESC)');await db.query('VACUUM (ANALYZE) orders');const after=await explain(db,query);assert.deepEqual((await db.query(query)).rows,rows);assert.ok(nodes(after).some(n=>/Index/.test(n['Node Type'])&&n['Index Name']==='order_customer_time'));console.log('index change',JSON.stringify({before:summary(before),after:summary(after)}));});",
          "purpose": "同一SQL加复合索引前后验证结果完全一致，并打印实际计划。VACUUM/ANALYZE只作用于新夹具。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "客户500只有30条订单，查询最新20条。在没有匹配索引时，本次实际路径是Seq Scan输出30、过滤59970，再Sort与Limit输出20。20条响应很小，并不代表数据库只处理了20条。加(customer_id,created_at DESC,id DESC)索引并维护可见性后，实际是Limit→Index Only Scan，输出20，不再为这个查询单独排序。"
        },
        {
          "type": "paragraph",
          "text": "索引列顺序与谓词和排序共同决定作用：先固定customer_id，再沿时间和id的降序读取。只给customer_id建索引可能仍要排序；只给created_at建索引则可能为了某个客户过滤很多候选。Index Only也有可见性前提，不是列都在索引里就保证永远零堆访问；已有索引文章对此有单独实验。"
        },
        {
          "type": "paragraph",
          "text": "这一观察说明访问路径减少了本次查询的工作，不代表所有查询都该强迫Index Scan。客户1有半张表的订单，读取大量列时，顺序扫描可能合理。为了让测试好看而全局关闭enable_seqscan，会掩盖真正的成本选择；我们的对照没有这样强制指定计划。"
        }
      ]
    },
    {
      "id": "join",
      "title": "JOIN与聚合：关注乘法放大，而不是看到连接就害怕",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "JOIN本身不等于慢。本文按客户ID连接订单，再按region汇总金额，实际为Hash Join，客户1000行构建哈希，订单60000行匹配，上层Aggregate形成2组，再排序2行。外层最终只显示两行，但完整订单参与汇总是查询语义要求，不是数据库多做了无意义工作。"
        },
        {
          "type": "code",
          "filename": "examples/sql-execution-plans/test.mjs",
          "language": "javascript",
          "code": "  await t.test('JOIN and GROUP BY preserve aggregate semantics; inspect actual loops',async()=>{const sql='SELECT c.region,sum(o.amount)::text total FROM customers c JOIN orders o ON o.customer_id=c.id GROUP BY c.region ORDER BY c.region';const plan=await explain(db,sql),rows=(await db.query(sql)).rows;const reference=(await db.query(\"SELECT CASE WHEN customer_id%2=0 THEN 'east' ELSE 'west' END region,sum(amount)::text total FROM orders GROUP BY 1 ORDER BY 1\")).rows;assert.deepEqual(rows,reference);assert.ok(nodes(plan).some(n=>n['Node Type'].includes('Join')||n['Node Type']==='Nested Loop'));assert.ok(nodes(plan).every(n=>n['Actual Loops']>=1));console.log('join/aggregate',JSON.stringify(summary(plan)));});",
          "purpose": "连接聚合与等价直接计算对照，防止优化讨论改变业务结果。输出节点与loops供阅读。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果连接键本来是一对一，却因为漏了租户维度或唯一约束而变成多对多，行数会在JOIN后放大；聚合再把重复数据加进去，可能又慢又错。先核对关系基数与连接条件，不能只在外层加DISTINCT掩盖原因。嵌套循环也不是天然错误：外层很少且内层有合适索引时很有效，真正危险的是外层规模估错、内层又每次扫描大量行。"
        },
        {
          "type": "paragraph",
          "text": "看内层节点时，把输出行数与loops一起读。比如一次返回5行、执行10000次，和一次返回5行完全不是同样工作量。存在缓存节点、并行聚合或从未执行分支时还要结合具体计划，不能把一个简化乘法公式当所有节点的精确I/O计数。"
        }
      ]
    },
    {
      "id": "sort",
      "title": "排序为何会落盘：内存预算属于节点，不是整台服务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "排序需要暂存候选值。work_mem约束某些查询操作可用的基础内存预算，超出时排序可能使用临时磁盘文件；多个排序、哈希节点和并发会话会各自消耗内存，不能把work_mem设成“我机器可用内存的一大半”，再以为全实例只分配一次。"
        },
        {
          "type": "code",
          "filename": "examples/sql-execution-plans/test.mjs",
          "language": "javascript",
          "code": "  await t.test('low work_mem makes a real sort use disk without changing sorted result',async()=>{await db.query('BEGIN');try{await db.query(\"SET LOCAL work_mem='64kB'\");const plan=await explain(db,'SELECT id,payload FROM orders ORDER BY payload,id');assert.ok(nodes(plan).some(n=>n['Node Type']==='Sort'&&n['Sort Space Type']==='Disk'));assert.equal(plan.Plan['Actual Rows'],60000);console.log('disk sort',JSON.stringify(summary(plan)));}finally{await db.query('ROLLBACK');}});",
          "purpose": "事务局部work_mem=64kB，真实宽数据排序落盘；最终ROLLBACK恢复配置，不修改全局参数。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "本次ORDER BY payload,id实际出现Gather Merge，其下Sort采用external merge、Sort Space Type为Disk。摘要中Sort平均Actual Rows=30000、loops=2，合计对应60000行输入；这不是两次都只处理30000就只排序了半张表。是否使用并行、worker数量以及空间数字可能随环境变化，测试只坚持本设置确实产生磁盘排序和结果行数正确。"
        },
        {
          "type": "paragraph",
          "text": "落盘不一定意味着应该马上加大内存。先检查能否减少进入排序的行和列、是否可用索引顺序、排序是否真是业务必需，再结合并发预算调整。本例刻意使用最低小预算以触发机制，不把64kB建议为生产默认值，也不比较同机冷暖缓存的排序耗时。"
        }
      ]
    },
    {
      "id": "pagination",
      "title": "深分页：OFFSET跳过的行仍需要生成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/sql-execution-plans/test.mjs",
          "language": "javascript",
          "code": "  await t.test('deep OFFSET reads skipped rows; keyset returns same page with a smaller index range',async()=>{const offsetSql='SELECT id,created_at FROM orders WHERE customer_id=1 ORDER BY created_at DESC,id DESC OFFSET 10000 LIMIT 20';const previous=(await db.query('SELECT id,created_at FROM orders WHERE customer_id=1 ORDER BY created_at DESC,id DESC OFFSET 9999 LIMIT 1')).rows[0];const keySql='SELECT id,created_at FROM orders WHERE customer_id=1 AND (created_at,id)<($1,$2) ORDER BY created_at DESC,id DESC LIMIT 20',params=[previous.created_at,previous.id];assert.deepEqual((await db.query(offsetSql)).rows,(await db.query(keySql,params)).rows);const offset=await explain(db,offsetSql),keyset=await explain(db,keySql,params);const a=nodes(offset).find(n=>n['Index Name']==='order_customer_time'),b=nodes(keyset).find(n=>n['Index Name']==='order_customer_time');assert.ok(a['Actual Rows']>=10020);assert.equal(b['Actual Rows'],20);console.log('pagination',JSON.stringify({offset:summary(offset),keyset:summary(keyset)}));});",
          "purpose": "完整深分页与keyset对照。先取得前一项游标，再验证两种方法返回同一页。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "客户1跳过10000条再取20条，Limit输出仍20，但其Index Only Scan实际输出10020：被OFFSET跳过的行也来自下层。keyset使用上一项的(created_at,id)作为边界，沿相同复合索引向后取，实际只输出20。我们比较同一页相同内容，不把从第一页开始的查询和第500页混在一起说更快。"
        },
        {
          "type": "paragraph",
          "text": "游标必须覆盖完整稳定排序。时间戳有重复，只放created_at会漏掉或重复同一时间内的其他订单；id提供唯一平局规则。若允许空时间、可变排序字段或不同方向，比较表达式和NULL顺序都要重新设计。游标还需和筛选条件绑定，不能拿另一个客户的游标继续同一个分页。"
        },
        {
          "type": "paragraph",
          "text": "keyset不擅长随意跳到第N页，且普通多次READ COMMITTED查询不是固定历史快照：分页期间插入、删除或排序值变化，仍可能影响可见内容。它解决这个访问路径上的深度跳过成本，不承诺所有并发情况下都给出一次冻结的完整导出。"
        }
      ]
    },
    {
      "id": "statistics",
      "title": "估算偏差：数据库选择的是它相信的数据分布",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/sql-execution-plans/test.mjs",
          "language": "javascript",
          "code": "  await t.test('stale statistics can misestimate rows; ANALYZE refreshes evidence',async()=>{await db.query('CREATE TABLE events(id integer,status text) WITH(autovacuum_enabled=false)');await db.query(\"INSERT INTO events SELECT i,'done' FROM generate_series(1,10000)i\");await db.query('ANALYZE events');await db.query(\"INSERT INTO events SELECT i,'queued' FROM generate_series(10001,40000)i\");const query=\"SELECT * FROM events WHERE status='queued'\",before=await explain(db,query);assert.equal(before.Plan['Actual Rows'],30000);assert.ok(before.Plan['Plan Rows']<3000);await db.query('ANALYZE events');const after=await explain(db,query);assert.ok(after.Plan['Plan Rows']>15000&&after.Plan['Plan Rows']<=40000);console.log('statistics',JSON.stringify({before:summary(before),after:summary(after)}));});",
          "purpose": "关闭仅测试表自动分析后，构造旧统计与新数据的差异，再ANALYZE比较；不是让读者关闭生产autovacuum。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "events先装10000条done并ANALYZE，再插入30000条queued而不刷新统计。实际查询queued返回30000，旧计划只估1；重新ANALYZE后本次估30009、实际30000。统计是抽样，重跑可能不是同一个精确数字，测试只要求明显偏差被收窄，不把30009写成版本保证。"
        },
        {
          "type": "paragraph",
          "text": "偏差不一定来自统计过期。多列相关性、过滤表达式、参数与预编译计划、数据倾斜都可能影响估计。先找到从哪个节点开始偏离，再核对该处谓词和统计；不要因为最后Hash Join慢，就忽略上游已经把行数估小几个数量级。扩展统计、查询改写或不同索引要围绕具体证据选择。"
        },
        {
          "type": "figure",
          "src": "figures/sql-execution-plans/mechanism.svg",
          "title": "相同结果背后的工作量差异",
          "alt": "无匹配索引先扫描60000再过滤/排序；深OFFSET索引产出10020而keyset产出20；统计旧时估1/实30000，ANALYZE后估算接近实际",
          "caption": "无匹配索引先扫描60000再过滤/排序；深OFFSET索引产出10020而keyset产出20；统计旧时估1/实30000，ANALYZE后估算接近实际。箭头表示逻辑关系/受控先后，不代表比例耗时或跨系统原子事务。"
        },
        {
          "type": "paragraph",
          "text": "读取计划不是让估算等于实数就结束。即使估得准确，查询也可能真的要求处理很大数据；即使只返回20条，扫描、排序、临时文件和循环仍可能很重。把估算、实际工作与业务结果放在一起，才能区分“数据库选错路径”和“请求本身代价很高”。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "复现与边界：计划可以变，结论必须有证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端 · 清洁复现",
          "language": "bash",
          "kind": "runnable",
          "purpose": "解压ZIP进入目录，Node22.12及PostgreSQL17二进制可用后运行，应6项通过。",
          "code": "cd sql-execution-plans\nnpm ci --ignore-scripts\nnpm test\n# tests 6; pass 6; fail 0\n# 自定义PG路径可用 PG_BIN=/your/pg17/bin npm test"
        },
        {
          "type": "paragraph",
          "text": "PostgreSQL17.4、Node22.12.0与pg8.13.1上实际通过6项测试：五组场景与父测试。每次独立PGDATA、私有socket编号55445，无TCP监听。测试输出JSON摘要，完整输入、SQL和断言都在下载包；不依赖现有用户数据库的统计和索引。"
        },
        {
          "type": "paragraph",
          "text": "首次夹具路径过长导致Unix socket启动失败，已改短前缀并保留服务日志后重跑通过。实际计划中的成本、估算与并行细节允许随环境变化，正文明确标注本次观察；相同结果、关键工作量与目标机制由断言保护。我们没有运行生产压测、远程磁盘或冷缓存基准。"
        },
        {
          "type": "paragraph",
          "text": "下次遇到慢查询，先拿可安全执行的样本计划，核对结果语义与实际参数；从扫描到连接、排序、聚合逐层看行数，找到工作放大或估算失真处，再改变一个条件做对照。改完重新验证结果一致，比只盯着一条耗时数字更能避免“优化后更快但算错了”。"
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：使用EXPLAIN",
          "url": "https://www.postgresql.org/docs/17/using-explain.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：规划器统计",
          "url": "https://www.postgresql.org/docs/17/planner-stats.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：LIMIT与OFFSET",
          "url": "https://www.postgresql.org/docs/17/queries-limit.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：运行时资源配置",
          "url": "https://www.postgresql.org/docs/17/runtime-config-resource.html",
          "note": ""
        }
      ]
    }
  ],
  "references": [
    {
      "title": "PostgreSQL17：使用EXPLAIN",
      "url": "https://www.postgresql.org/docs/17/using-explain.html"
    },
    {
      "title": "PostgreSQL17：规划器统计",
      "url": "https://www.postgresql.org/docs/17/planner-stats.html"
    },
    {
      "title": "PostgreSQL17：LIMIT与OFFSET",
      "url": "https://www.postgresql.org/docs/17/queries-limit.html"
    },
    {
      "title": "PostgreSQL17：运行时资源配置",
      "url": "https://www.postgresql.org/docs/17/runtime-config-resource.html"
    }
  ]
};
export default article;
