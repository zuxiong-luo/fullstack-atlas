import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "transactions-locks",
  "topic": "data",
  "title": "从一次库存扣减，理解事务、锁与业务不变量",
  "description": "先确定什么绝不能发生，再选择原子更新、唯一约束、行锁和隔离级别。",
  "minutes": 15,
  "tags": [
    "PostgreSQL",
    "MVCC",
    "锁",
    "事务"
  ],
  "scope": "以 PostgreSQL 为例；不同数据库的隔离实现不可直接套用。",
  "prerequisites": [
    "SQL 基础",
    "并发请求"
  ],
  "questionIds": [
    "db-transactions",
    "db-index",
    "redis-cache"
  ],
  "sections": [
    {
      "id": "invariant",
      "title": "先定义业务不变量",
      "paragraphs": [
        "假设库存只有 1，两个请求同时读到 1，再各自更新库存或创建订单。即使两个请求都放进事务，也可能违反“只能成功一次”的业务约束。事务不是为业务意图自动推理的系统。",
        "设计前先写清楚不变量：库存不能为负、同一业务单据不能重复结算、已完成任务不能回到运行中。然后找出哪个数据层操作能够原子地约束它。",
        "应用层先检查再插入存在竞争窗口。若是业务唯一性，数据库唯一约束通常应作为最终边界；应用检查主要用于提供友好提示。"
      ]
    },
    {
      "id": "atomic",
      "title": "能用条件更新，就不先读后改",
      "paragraphs": [
        "单行库存扣减可以把检查条件直接放入 UPDATE。以实际返回行数判断是否成功，而不是相信请求开始时读到的值。没有返回行可能表示库存不足，也可能是记录不存在，应按业务需要区分。",
        "若还要创建订单，则把扣减与订单写入放在同一个事务里。给订单建立业务幂等键，可以避免客户端重试创建第二份订单。示例仅展示核心 SQL，不包含完整订单流程。"
      ],
      "code": "UPDATE inventory\nSET stock = stock - 1\nWHERE id = $1 AND stock > 0\nRETURNING id, stock;",
      "language": "sql"
    },
    {
      "id": "isolation",
      "title": "快照不代表所有并发都是串行的",
      "paragraphs": [
        "MVCC 让读取看到符合规则的数据版本，减少读写直接阻塞。但业务跨多次查询、多行数据时，仍需检查观察到的状态是否足以支撑后续决策。",
        "在 PostgreSQL 的 Read Committed 下，不同语句可能使用不同快照；Repeatable Read 和 Serializable 提供不同程度的保证。更强的隔离并不意味着应用永远不会收到冲突错误。",
        "采用需要重试的事务策略时，要重跑整个业务事务，而不是仅重试最后一条写入。重试也应有上限，并避免把不可重复的外部副作用混入其中。"
      ]
    },
    {
      "id": "locks",
      "title": "锁的范围、顺序与时间都重要",
      "paragraphs": [
        "需要先读取再根据数据做复杂变更时，可以在事务中锁定目标行。多个路径锁定相同资源时，统一锁定顺序有助于减少死锁，但仍需处理数据库报告的死锁。",
        "锁持有期间不要等待慢速外部服务。数据库连接和锁都是有限资源，等待支付、AI 生成或文件上传会扩大阻塞范围。",
        "乐观并发控制通过版本号或条件判断发现冲突；悲观锁通过协调访问减少冲突窗口。选择应取决于竞争程度与冲突后重试成本，而不是哪种名字听起来更先进。"
      ]
    },
    {
      "id": "outside",
      "title": "事务边界到数据库为止",
      "paragraphs": [
        "数据库回滚不会让外部支付自动退款，也不会删除已经写入对象存储的文件。跨系统工作应明确部分成功时的恢复机制，例如业务幂等、outbox、补偿和对账。",
        "慢 SQL 排查也要区分“执行慢”和“等待慢”。连接池耗尽、锁等待与扫描数据过多，需要不同证据和解决方式。先观察，再决定是否增加索引或调整隔离级别。"
      ],
      "takeaway": "先表达不变量，再选择机制；不要先选一把锁，再猜它能保护什么。"
    }
  ],
  "references": [
    {
      "title": "PostgreSQL：事务隔离",
      "url": "https://www.postgresql.org/docs/current/transaction-iso.html"
    },
    {
      "title": "PostgreSQL：显式锁",
      "url": "https://www.postgresql.org/docs/current/explicit-locking.html"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
