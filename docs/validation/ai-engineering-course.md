# AI 应用与 Agent 六篇补充教程：验证记录

日期：2026-10-26。范围见 `docs/AI_APPLICATION_AGENT_COURSE_PLAN.md`。原八章保留独立编号、文章 ID、锚点、评论标识与研习关联；新增六篇按应用入门三篇和进阶实作三篇组织。

## 章节与岗位能力对应

| 文章 | 主要能力 | 示例 | 状态（本篇限定范围） |
|---|---|---|---|
| ai-model-context | 模型接入的概念、真实 Tokenizer、上下文预算 | lesson1_context.py | 已完成 |
| ai-prompt-contracts | Prompt 版本、结构化结果、回归与 HTTP 适配 | lesson2_prompt.py | 已完成；真实模型效果未验证 |
| ai-rag-ingestion | 数据入库、切片、版本、权限内检索与引用 | lesson3_ingestion.py | 已完成；词法基线，非向量检索 |
| ai-agent-workflows | LangGraph、审批、持久检查点与幂等恢复 | lesson4_workflow.py | 已完成；本地固定流程 |
| ai-streaming-delivery | Node/React、SSE、游标、取消与资源界限 | ai-engineering-stream | 已完成；固定文本生成器 |
| ai-data-tools | 数据工具、身份、受限查询与执行预算 | lesson6_data.py | 已完成；无通用自然语言规划器 |

需求采用用户提供的岗位材料中重复出现的 AI 应用与 Agent 工程职责，不复制个人求职分析。MCP、记忆、工具循环、评测、安全和生产交付继续由原八章主讲。本轮不承诺覆盖所有 JD 中的训练、RL、多模态、A2A 或多 Agent 平台。

本次尝试重读西门子官网返回 406，腾讯与小红书页面无可读正文，字节页面未能取得。故不宣称重新确认了招聘状态、年限或薪资，也不把搜索摘要补成完整 JD。技术内容另以官方文档、固定依赖和实测核验。

## 实际环境与命令

- macOS；Python 3.12.14，运行时架构 x86_64，SQLite 3.53.1。
- Python：tiktoken 0.14.0，cl100k_base，LangGraph 1.2.17，langgraph-checkpoint-sqlite 3.1.2；全部依赖锁定在 requirements.lock。
- Node.js 22.12.0，React / ReactDOM 18.3.1，esbuild 0.25.12；package-lock.json 固定依赖。该示例安装时 npm audit 报告 0 项告警，不推广为永久安全结论。

```sh
cd examples/ai-engineering-course
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
python -m unittest discover -s tests -v
python lesson1_context.py
python lesson2_prompt.py
python lesson3_ingestion.py
python lesson4_workflow.py
python lesson6_data.py
```

Python 30 项通过。覆盖：完整轮次、必要输入过大、真实 tokenizer、严格 JSON、Prompt 指纹、拒绝/截断/坏外层响应、真实回环 HTTP 假上游、固定回复中的语义失败、切片偏移、租户过滤、来源/策略版本变化、入库中途失败的事务回滚、旧引用拒绝、LangGraph 审批/拒绝/新实例恢复/内容绑定、写回执后故障重放、幂等冲突、只读查询、字段白名单、跨租户隔离和 VM 指令预算清理。

第一篇规定输入的本地估算为 80；每消息 12 Token 是教学余量，不是供应商账单。第二篇回放 5 条中 4 条符合标签，故意保留一条结构合法而语义错误；这不是模型准确率。第三篇纯词法召回，未伪造 embedding。第四篇正常输出 waiting_approval → completed，effects 表只有一条；故障注入并非 OS 断电或多副本测试。

```sh
cd examples/ai-engineering-stream
npm ci
npm test
npm run build
npm start
```

Node 8 项通过。真实回环 HTTP/SSE 验证顺序、after 与 Last-Event-ID 优先级、重放不创建新任务、HTTP 取消、断开订阅仍完成任务、订阅清理、过载拒绝、非法游标、Origin/内容类型、前端重复去除/缺口以及 JSON 换行编码。浏览器手动操作也完成了暂停→续接至 7 个事件、重新创建→取消至 cancelled（2 个事件）的路径。

## 从下载包复现

从本次构建的两个 ZIP 分别解压到空目录。Python 使用新建 venv 从锁文件安装，运行全部章节测试；Node 在无 node_modules/public-app 的解压目录执行 npm ci、npm test、npm run build。没有借用原例目录中的源码、虚拟环境或构建产物。

最终包保留 README、锁文件、样本、测试及运行入口。网站离线包包含正文、SVG 和源码 ZIP，不包括 Python/Node 运行时、pip/npm 依赖或 tiktoken 初次需要的编码表下载。

## 站点与图形

- 站点 `npm test`：13 个文件，62 项通过。原文章身份与研习关联、代码同步、原八章/新六篇独立翻页、搜索和访问控制均通过回归。
- `npm run build`：通过；当前主 bundle 仍有既有体积提示，未以本轮内容任务宣称解决加载性能。
- 构建交付检查：251 处下载引用、158 处图形引用、431 处源码映射、99 个 ZIP；全部存在且进入离线清单，ZIP 不含本地环境或密钥。
- 六篇关键代码直接位于正文，生成后由现有源码同步检查对照实际下载文件。外部链接用于出处，无关键实现必须跳转补读。
- 桌面 1280px：六图实际渲染并打开查看；修正恢复图中箭头/标签靠近问题，检查箭头方向、条件和状态与代码一致。
- 六篇均在 393px 中字号与 320px 大字号检查，根文档 scrollWidth 等于 innerWidth，代码高亮和本地下载入口可见。
- 393px 图形弹窗内部宽 313px、内容宽 1000px，实际横向滚动到 scrollLeft=393；根文档仍为 393px。图形局部滚动不放大/撑宽整页。
- 新专栏目录显示三篇入门、三篇进阶和原八章。仅更新对应课程展示，不改变全站导航、首页、个人名片与登录规则。

## 未验证与边界

未调用付费模型，因此无真实准确率、成本、首 Token 延迟、Prompt v1/v2 优劣数据；回环假上游只验证传输和解析。没有真实向量模型、OCR/PDF、reranker、外部工单、自由 SQL 或生产认证。

LangGraph 本例为可信本机、单写入者；线程 ID 不是凭证。SSE 事件只存内存，服务重启不能恢复，未验证生产代理、多副本、高并发。手机检查是桌面浏览器视口，不是 iPhone/Android 真机。部署、集群与原生平台的既有未验证限制不因本轮教程而视为完成。
