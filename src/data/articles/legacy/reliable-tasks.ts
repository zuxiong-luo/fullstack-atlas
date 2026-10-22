import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "reliable-tasks",
  "topic": "tasks",
  "title": "设计可靠的异步任务：认领、租约、幂等与恢复",
  "description": "以媒体任务为线索，分析成功之外的重复执行、旧回调和部分失败。",
  "minutes": 17,
  "tags": [
    "Worker",
    "幂等",
    "租约",
    "分布式"
  ],
  "scope": "教学设计示例，结合媒体任务场景；不代表某个项目的全部现行实现。",
  "prerequisites": [
    "数据库事务",
    "HTTP 超时与重试"
  ],
  "questionIds": [
    "worker-lease",
    "distributed-lock",
    "idempotency",
    "retry",
    "system-design",
    "ts-model"
  ],
  "sections": [
    {
      "id": "states",
      "title": "状态机先于队列选型",
      "paragraphs": [
        "媒体生成任务通常经历创建、等待、执行、上传和完成。用户请求超时、Worker 崩溃、回调重复以及上传成功但结算失败，都不是罕见事件，应作为状态转换的一部分设计。",
        "先区分任务身份和执行尝试。任务 ID 代表用户的一次业务意图，attempt ID 代表某一轮执行。重试可以产生新的 attempt，但不应随意变成新的收费意图。",
        "不要只记录一个 failed 布尔值。应明确哪些失败可重试，哪些需要人工处理，以及失败后额度、产物和用户状态分别如何变化。"
      ],
      "code": "queued → running → completed\n             ↓\n        retry_wait → queued\n             ↓\n           failed\n\ntaskId：业务身份保持稳定\nattemptId：每次执行尝试单独标识",
      "language": "状态示意"
    },
    {
      "id": "claim",
      "title": "原子认领，短事务提交",
      "paragraphs": [
        "多个消费者不能都先查出同一批任务，再分别把它们改成 running。认领应当在数据库事务或队列原子操作中完成。",
        "PostgreSQL 的 FOR UPDATE SKIP LOCKED 可以让消费者跳过已锁定行，适合部分队列表场景。它提供的是认领阶段的协调，不是整个任务执行恰好一次的保证。",
        "认领事务应尽快提交。真正的转码、网络请求和上传在事务外执行，避免长时间占用数据库锁和连接。"
      ]
    },
    {
      "id": "lease",
      "title": "租约过期不等于旧进程消失",
      "paragraphs": [
        "Worker 周期性续租，调度端在租约到期后允许恢复任务。但网络暂停或进程长时间停顿后，旧 Worker 仍可能恢复执行。新的任务尝试已经开始时，旧回调不能覆盖当前状态。",
        "回调应带执行尝试标识，状态更新时原子地校验当前 attempt 和预期状态。不要先检查一次，再无条件写入，因为检查与写入之间可能发生调度切换。",
        "随机 attempt ID 用于判断是不是当前尝试；严格递增的 fencing token 则可让资源端拒绝旧序号。两者不能仅凭名字混为一谈。"
      ],
      "code": "UPDATE jobs\nSET status = 'completed', result_key = $3\nWHERE id = $1\n  AND attempt_id = $2\n  AND status = 'running'\nRETURNING id;\n-- 无返回行：当前状态不允许本次提交，需按业务处理",
      "language": "sql"
    },
    {
      "id": "effects",
      "title": "状态幂等不等于副作用幂等",
      "paragraphs": [
        "完成回调只接受一次，并不自动保证外部扣费、通知或对象写入只发生一次。每一类重要副作用都需要自己的业务唯一键或可重复执行策略。",
        "上传成功、数据库提交失败时，可以保留可追踪的产物键并安排对账；数据库提交成功、消息发送失败时，可以考虑事务 outbox。选择方案时，先明确哪一个系统是事实来源。",
        "遇到超时，调用方通常无法仅凭超时判断对方有没有成功。重试应复用相同业务意图的幂等键，并限制尝试次数与退避节奏，避免放大依赖故障。"
      ]
    },
    {
      "id": "operations",
      "title": "把恢复过程变成可观察的行为",
      "paragraphs": [
        "记录任务与尝试之间的关系，统计等待时长、执行时长、重试次数、租约过期量和最终失败原因。只有“成功率”无法说明队列是否正在积压。",
        "发布 Worker 时先停止领取新任务，再处理在途任务。超过终止预算的任务，应依靠已设计的租约和重试路径恢复，而不是希望进程永远不会被杀掉。",
        "设计完成后，主动演练在上传后、提交前、回调后确认前等位置中断进程。失败路径能被验证，才说明恢复机制不是停留在文档里。"
      ]
    }
  ],
  "references": [
    {
      "title": "PostgreSQL：SELECT 与锁定子句",
      "url": "https://www.postgresql.org/docs/current/sql-select.html"
    },
    {
      "title": "AWS：事务 outbox 模式",
      "url": "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
