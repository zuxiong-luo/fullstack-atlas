import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "agent-context-memory",
  "topic": "ai",
  "title": "Agent 工程 05：上下文、记忆与数据生命周期",
  "description": "让模型得到当下需要的证据，同时让长期记忆可纠正、可删除、可追溯。",
  "minutes": 8,
  "tags": [
    "AI",
    "上下文工程",
    "记忆",
    "摘要",
    "数据隔离"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "token 与上下文",
    "数据库与缓存"
  ],
  "sections": [
    {
      "id": "s12-292236",
      "title": "上下文是一份本轮工作材料",
      "paragraphs": [
        "系统指令、用户目标、已确认事实、工具能力、检索证据和历史交互承担不同角色。把全部内容拼接成一大段文本，会丢失来源和权威层级；外部文档中的要求不能悄悄变成系统规则。",
        "每轮构造上下文时明确当前目标、尚未解决的问题和可用证据。与其保留重复工具日志，不如保留可回查的结果引用及关键事实，但摘要不能凭空提高事实可信度。"
      ]
    },
    {
      "id": "s13-350593",
      "title": "短期状态与长期记忆分开存放",
      "paragraphs": [
        "任务状态记录正在做什么，长期记忆记录适合跨任务复用的信息，例如用户主动确认的偏好。一个模型推测“用户喜欢某种风格”不应未经验证就变成永久偏好。",
        "记忆条目应记录主体、来源、时间、有效期、确认状态和适用范围。区分用户提供、工具观察与模型推断，发生冲突时按明确规则解决，必要时询问用户。不要永远用最新生成的摘要覆盖历史事实。"
      ]
    },
    {
      "id": "s13-387507",
      "title": "压缩是有损操作，需要可回查",
      "paragraphs": [
        "摘要能减少 token，但会丢掉否定、条件、金额、时间和异常细节。对关键约束保留原始片段或引用，对长工具输出只保留摘要和结果地址。恢复时可按需重新读取，而不是信任压缩后的每个词。",
        "评测上下文压缩时，应使用跨多轮才暴露的约束，例如“只能操作测试环境”“报价上限固定”。短问答看起来正常，并不能证明长任务压缩没有丢失重要边界。"
      ],
      "code": "MemoryRecord\n  subjectId: 当前用户或租户\n  fact: 被记录的内容\n  provenance: 用户确认 / 工具观察 / 模型推断\n  sourceRef: 可回查来源\n  confirmedAt / expiresAt\n  scope: 本任务 / 项目 / 全局偏好\n  status: active / corrected / deleted",
      "language": "数据模型"
    },
    {
      "id": "s13-377441",
      "title": "删除与隔离必须覆盖所有副本",
      "paragraphs": [
        "用户删除记忆时，除了主表，还要考虑向量索引、摘要、检索缓存和备份保留规则。旧缓存再次把已删除信息取出，会让“删除成功”变成界面假象。",
        "会话之间和租户之间的检索范围必须隔离。公共知识缓存与私人偏好缓存分别设计，调用工具时仍使用当前认证主体。长期记忆不应保存原始密码、访问令牌或无必要的敏感数据。"
      ]
    },
    {
      "id": "s14-419470",
      "title": "练习：构造记忆修正与遗忘场景",
      "paragraphs": [
        "先让用户确认一个偏好，再明确修改，最后删除。检查新会话是否按最新确认信息行动，旧摘要和检索索引是否仍返回旧值。为不同用户写入相似偏好，验证检索不会混入他人记录。",
        "自测：把聊天历史全部存进向量库是否等于记忆系统？不是。它缺少事实提取规则、确认、版本、删除和授权等生命周期管理，只提供了可检索的历史文本。"
      ]
    }
  ],
  "questionIds": [
    "agent-context-memory-memory",
    "agent-context-memory-compression"
  ],
  "references": [
    {
      "title": "Anthropic：上下文工程",
      "url": "https://www.anthropic.com/research/effective-context-engineering-for-ai-agents"
    },
    {
      "title": "LangGraph：记忆",
      "url": "https://docs.langchain.com/oss/python/langgraph/memory"
    }
  ],
  "status": "overview",
  "kind": "series"
};
export default article;
