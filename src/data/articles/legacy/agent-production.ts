import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "agent-production",
  "topic": "ai",
  "title": "Agent 工程 08：成本、延迟与生产部署",
  "description": "把模型请求接入完整服务生命周期，完成从演示到可运营系统的最后一段。",
  "minutes": 8,
  "tags": [
    "AI",
    "部署",
    "成本",
    "延迟",
    "限流",
    "可观测性"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "Node.js 或 Python 服务",
    "队列、容器与可观测性"
  ],
  "sections": [
    {
      "id": "s11-302915",
      "title": "前端展示与执行服务解耦",
      "paragraphs": [
        "浏览器负责交互、流式展示与取消请求；服务端保存凭证、鉴权、预算与工具执行。长任务进入有界队列，返回任务 ID 后可查询状态。不要把模型提供商密钥打包进静态前端。",
        "一次网络连接断开不应让任务状态消失。任务与执行 attempt 分开，结果持久化后再通知客户端；前端重连基于任务 ID 和事件序号恢复，而不是重新创建相同收费意图。"
      ]
    },
    {
      "id": "s15-397295",
      "title": "拆开首字延迟、总时长和工具等待",
      "paragraphs": [
        "流式输出改善开始反馈的时间，但不必然减少任务完成时长。记录首个有效输出、模型完成、工具等待和整体耗时，才能判断是长提示、工具调用还是排队拖慢体验。",
        "并行调用只适合相互独立且资源预算允许的步骤。无限并发会触发限流并加剧尾延迟。重试使用退避与抖动，且共享总体 deadline，避免每一层都重试三次形成放大。"
      ]
    },
    {
      "id": "s9-225100",
      "title": "成本按完成任务核算",
      "paragraphs": [
        "单次 token 价格只是成本的一部分，还包括检索、重排、工具、存储和失败重试。记录每个完成任务的费用与成功率；低价模型反复重试可能比更强模型一次完成更贵。",
        "缓存可复用的公共上下文和结果时，需要定义版本、失效与身份范围。包含私人文档的回答不能使用跨用户共享缓存。模型路由应由评测支持，例如简单提取走较轻模型，复杂任务升级，而非凭感觉切换。"
      ],
      "code": "每个任务预算\n  maxSteps / maxToolCalls\n  totalDeadline / perToolTimeout\n  inputOutputTokenBudget\n  maxConcurrentJobs / queueLimit\n  tenantDailyBudget\n\n监控：成功率、p95 总时长、首字时间、费用/完成任务、\n      限流、重复执行、待审批时长、取消后继续执行数量",
      "language": "预算与指标"
    },
    {
      "id": "s13-334788",
      "title": "部署要包含灰度、取消和回滚",
      "paragraphs": [
        "应用版本应关联模型配置、提示、工具 Schema、检索索引版本与评测报告。只回滚代码而保留已变更的提示或索引，可能无法真正恢复旧行为。发布前明确哪些组件一起版本化。",
        "健康检查反映进程和依赖状态，任务成功率反映产品效果，两者不能互相替代。优雅退出时停止领取任务，给在途任务时间完成，超时部分依靠租约与幂等恢复。"
      ]
    },
    {
      "id": "s14-457123",
      "title": "结课项目：可追溯的知识库助手",
      "paragraphs": [
        "最低交付包含受控文档集、权限过滤检索、引用回答、只读工具、任务状态、结构化日志和自动评测。写工具作为扩展，必须带草稿审批和幂等执行；不要求一开始就引入多个框架。",
        "验收演练：上游限流、检索为空、恶意文档、进程崩溃、客户端断连、预算耗尽和租户切换。说明每种情况下用户看到什么、状态如何保存、如何恢复。能稳定解释这些失败路径，才说明你掌握了 Agent 工程的服务端部分。"
      ]
    }
  ],
  "questionIds": [
    "agent-production-cost",
    "agent-production-recovery"
  ],
  "references": [
    {
      "title": "Anthropic：Agent 评测",
      "url": "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"
    },
    {
      "title": "Google SRE：处理过载",
      "url": "https://sre.google/sre-book/handling-overload/"
    },
    {
      "title": "OpenTelemetry：可观测性",
      "url": "https://opentelemetry.io/docs/concepts/observability-primer/"
    }
  ],
  "status": "overview",
  "kind": "series"
};
export default article;
