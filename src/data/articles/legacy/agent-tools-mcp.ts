import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "agent-tools-mcp",
  "topic": "ai",
  "title": "Agent 工程 02：工具调用、Schema 与 MCP",
  "description": "把模型提出的动作转换成可校验、可观测、可恢复的业务能力。",
  "minutes": 8,
  "tags": [
    "AI",
    "Tool Calling",
    "MCP",
    "JSON Schema",
    "幂等"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "结构化输出",
    "接口鉴权与幂等"
  ],
  "sections": [
    {
      "id": "s16-473090",
      "title": "工具调用是动作提议，不是执行证明",
      "paragraphs": [
        "模型选择工具并生成参数后，宿主程序负责验证与执行，再把工具结果返回上下文。只有服务端实际执行成功才能标记业务完成。模型说“已经发送”不等于消息已发送，工具返回超时也不等于执行必定失败。",
        "一个工具应描述清楚适用时机、必填参数、结果结构与失败含义。像 doEverything(text) 这样的万能接口把约束都推给模型，既难评测也难限制权限。"
      ]
    },
    {
      "id": "s10-233147",
      "title": "把接口收窄到业务动作",
      "paragraphs": [
        "知识助手的工具可以是 searchDocuments(query, limit) 和 readDocument(id)，而非任意 SQL 或任意 HTTP。写操作再进一步分为准备、确认和提交，使用户可审阅具体变更。",
        "参数校验包括类型、范围与业务含义。搜索 limit 必须有上限，文档 ID 要核对当前租户，路径不能越出允许目录。模型提供的 userId 不能代替由认证层确定的主体身份。"
      ],
      "code": "工具：search_documents\n参数：{query: string, limit: integer 1..10}\n身份：从服务端会话取得，不接受模型自报\n结果：{items: [{id, title, excerpt}], truncated: boolean}\n错误：{code: \"FORBIDDEN\" | \"TIMEOUT\" | \"INVALID_INPUT\"}\n日志：toolCallId、耗时、结果分类，不记录访问密钥",
      "language": "接口契约"
    },
    {
      "id": "s18-384953",
      "title": "MCP 统一连接方式，不统一业务信任",
      "paragraphs": [
        "MCP 描述 host、client、server 之间的协议交互。工具、资源与提示等能力可以通过统一协议发现和使用，但协议支持一个能力不等于应用应该允许它执行。本文按 2025-06-18 架构规范讨论角色，具体传输与授权细节需核对实现版本。",
        "连接第三方 MCP 服务时，仍要评估提供者、数据流向、授权范围与返回内容。工具描述和结果可能含不可信文本，不能因此升级为系统指令。OAuth 等授权流程也不能被一个工具名称替代。"
      ]
    },
    {
      "id": "s13-336859",
      "title": "重试和幂等从副作用开始分析",
      "paragraphs": [
        "读取失败通常可按预算重试，写操作则要使用业务幂等键并确认结果。对一次创建报告的请求，网络超时后再次调用如果生成新 ID，可能产生重复报告或重复收费。",
        "给工具调用设置 deadline、响应大小与并发上限。结果太大时返回摘要与可分页读取的引用，避免把整个数据库输出塞进模型上下文。错误信息既要便于下一步判断，也不能泄露内部密钥和完整堆栈。"
      ]
    },
    {
      "id": "s13-376761",
      "title": "练习：做一个只读工具适配器",
      "paragraphs": [
        "先实现搜索与读取两个工具，构造未知工具名、缺字段、越权文档、超时和超大结果五类测试。以工具执行日志验证调用次数、授权拒绝和预算执行，不仅观察最后一句自然语言。",
        "自测：MCP server 声称自己可以读取所有文件，客户端是否应直接授权？答案是否定的；可发现能力、用户授权和运行时策略是不同层次。先把只读最小范围做对，再扩展写操作。"
      ]
    }
  ],
  "questionIds": [
    "agent-tools-mcp-trust",
    "agent-tools-mcp-retry"
  ],
  "references": [
    {
      "title": "MCP：架构（2025-06-18 规范）",
      "url": "https://modelcontextprotocol.io/specification/2025-06-18/architecture"
    },
    {
      "title": "Anthropic：设计有效工具",
      "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
    }
  ],
  "status": "overview",
  "kind": "series"
};
export default article;
