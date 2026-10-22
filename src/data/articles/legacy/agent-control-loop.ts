import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "agent-control-loop",
  "topic": "ai",
  "title": "Agent 工程 04：执行循环、工作流与持久化恢复",
  "description": "用状态机限制自主行动，并处理崩溃、重复事件、人工确认和预算耗尽。",
  "minutes": 8,
  "tags": [
    "AI",
    "Agent",
    "工作流",
    "状态机",
    "Checkpoint",
    "多Agent"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "任务状态机",
    "工具调用与幂等"
  ],
  "sections": [
    {
      "id": "s12-319637",
      "title": "一个循环需要明确停止条件",
      "paragraphs": [
        "最小 Agent 循环是构建上下文、调用模型、解释响应、执行工具、回传结果，再决定是否继续。不能只写 while(true) 然后期望模型自然停止；程序必须限定步骤、时间、费用和输出体积。",
        "停止结果也应细分：完成、需要用户信息、等待审批、预算耗尽、失败或取消。把所有停止都写成 success，会掩盖一半任务没有真正完成的情况。"
      ]
    },
    {
      "id": "s10-266114",
      "title": "状态机承担确定性责任",
      "paragraphs": [
        "身份校验、预算计数、允许工具集合和是否已有审批是程序事实。模型可以提出“下一步发布报告”，但不能通过一句“用户已批准”修改系统审批状态。审批必须关联具体动作、参数和目标。",
        "将计划视为可调整的建议，执行记录视为不可随意改写的事实。每步保存输入摘要、工具调用 ID、结果引用、状态和时间，后续恢复应读取这些记录，而不是让模型猜测之前做过什么。"
      ],
      "code": "created → running → waiting_approval → running → completed\n              ↓             ↓\n           failed         cancelled\n              ↓\n         retry_wait → running\n\n每次推进：校验身份/预算 → 读取持久状态 → 执行动作\n写操作：稳定 operationId → 执行结果查询 → 幂等提交",
      "language": "状态机示意"
    },
    {
      "id": "s14-343997",
      "title": "持久化不能制造恰好一次副作用",
      "paragraphs": [
        "工具完成但 checkpoint 尚未写入时进程崩溃，恢复后可能重复执行。先写 checkpoint 也有“记录已完成但工具未执行”的窗口。需要业务幂等键、结果查询或 outbox 等策略处理跨系统边界。",
        "检查点至少记录当前状态与可恢复的结果引用。大文件、完整工具输出可以放在对象存储中，记录哈希和位置；不要在每一步把全部历史无限复制进数据库。"
      ]
    },
    {
      "id": "s16-235042",
      "title": "多 Agent 先解决职责与合并",
      "paragraphs": [
        "并行检索不同来源或独立审查可以拆给多个执行单元，但共享写入会引入冲突，结果合并会增加成本。给每个角色明确输入、输出和权限，最终由一个协调点决定如何提交。",
        "多 Agent 不能自动提高正确率；若都依赖同一个错误资料或同一评价偏差，投票仍可能一致地错误。先对比单 Agent 基线，并观察总工具调用量、完成时间和失败恢复复杂度。"
      ]
    },
    {
      "id": "s12-349322",
      "title": "练习：在每个边界注入中断",
      "paragraphs": [
        "构建一个“检索资料→生成报告→用户确认→发布”的流程，在检索后、写入后、checkpoint 前分别模拟进程中断。重启后检查是否重复发布、丢失确认或将未完成任务标成成功。",
        "验收应能回答：停止后如何恢复、谁可以批准、批准了哪份内容、预算不足如何展示。把这些写入状态转换测试，比展示一段顺畅的对话更能证明系统可靠。"
      ]
    }
  ],
  "questionIds": [
    "agent-control-loop-checkpoint",
    "agent-control-loop-budget"
  ],
  "references": [
    {
      "title": "Anthropic：构建有效 Agent",
      "url": "https://www.anthropic.com/research/building-effective-agents"
    },
    {
      "title": "LangGraph：持久化",
      "url": "https://docs.langchain.com/oss/python/langgraph/persistence"
    }
  ],
  "status": "overview",
  "kind": "series"
};
export default article;
