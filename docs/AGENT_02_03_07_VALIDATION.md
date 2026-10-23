# Agent 02、03、07 重写与源码对照

2026-10-23。依据 ARTICLE_WRITING_GUIDE.md 第1—14节。三篇保留review状态，交付以已实现shared/v2契约为界，不把设计延伸描述为已运行功能。

## 原缺口与本轮结构

| 文章 | 原先缺口 | 修订后正文 |
| --- | --- | --- |
| agent-tools-mcp | 只有动作提议、通用接口草图和要求读者自行做工具；无真正MCP消息处理 | 先定义工具/执行职责，收窄单一lookup_document；完整双语言公共输入层、执行器、HTTP身份/caller、MCPstdio模块；普通/越权/参数失败推演；明确只读/协议子集 |
| agent-rag | 文字覆盖入库/向量/混合检索，实际无实现，无证据数据或模型边界 | 六份共享真实教学样本直接正文；可手算关键词基线、owner过滤、Retriever接口、双语言完整输出契约/provider与HTTP caller、Service到answer连续调用链；无命中/错误引用、检索与生成分开验收 |
| agent-security | 仅提示注入/沙箱/审批清单，无可检查执行层；容易把未来设计当现有能力 | 定义不可信资料与权限边界，实际injection-demo；完整工具/HTTP身份/输出schema/检索-provider链，拒shell/任意URL/越权；审批明确设计延伸；不声称通用代码沙箱或模型免疫 |

所有原文章ID、节ID与研习关联保留。02增加为7节、03为7节、07为9节，结构分别围绕执行/证据/能力，不机械统一。所有关键代码均在正文，源码出处不承担补齐实现。

## 代码与数据对应

代码直接读取：

- TypeScript v2：contracts.ts、tools.ts、mcp.ts、retrieval.ts、providers.ts、service.ts到answer连续段、app.ts。
- Python v2：contracts.py、tools.py、mcp_stdio.py、retrieval.py、providers.py、service.py到answer连续段、app.py。
- shared/v2/documents.json：03完整样本；07真实injection-demo源行。

最终本代理自查32个映射到production源文件的代码块，逐一是对应源文件完整内容或连续子串；TS/Python最终UTF8、BOM/UTF16与孤立surrogate规则已同步重提取。Service截取明确标注从imports/字段/配置到answer，后面的run持久化不在本章展开，不伪装独立可编译文件。

交叉审稿由upgrade_memo只读完成，已落实其建议：02补齐lookup依赖evidence_of；3篇实际HTTP身份/caller代码可见；07补检索至provider链；stdio通过npm启动使用--silent，避免npm banner污染stdout。修订后审稿人复看未发现新的阻断机制错误。

## 实现与测试证据

TypeScript v2由本代理实现，Node22.12.0、Fastify5.12.7、TypeScript5.7.2、tsx4.20.6、SQLite3.47.0。需要--experimental-sqlite，脚本和正文明确、未屏蔽warning。最终33项测试与tsc构建通过；覆盖全部11组shared HTTP cases、严格UTF8/JSON/码点/孤立surrogate、fake HTTP有界上游、真正MCP子进程、owner隔离/引用拒绝、SQLite双连接/实际进程崩溃恢复与预算。具体记录在typescript-v2/VERIFICATION.md。

Python v2由upgrade_scheduling实现并反馈：Python3.12.14下36项测试通过，最终contracts/providers已冻结；含同一HTTPcases、MCP真子进程、SQLite崩溃恢复和UTF8/孤立surrogate。正文安装使用requirements.lock与pytest，版本来自锁文件（FastAPI0.161.1、HTTPX0.28.1）。不把作者反馈当本代理另行重跑结果。

父级正在统一跑两个真实HTTP进程的parity；本记录不提前宣称最终parity/线上发布成功。章节命令按CHAPTER门槛使用同一最终v2实现，不冒称每章都创建了独立Git tag。

## 图形与资料

每篇一张仓库SVG：execution.svg、retrieval.svg、boundary.svg，分别解释HTTP/stdio共用执行策略、检索/生成/校验分层、注入内容与能力授权不相通。源码可编辑、有title/desc与正文解释；SVG XML解析通过，最终手机与页面视觉由父级集成验收。

已读官方MCP2025-06-18 transports/tools、固定RAG论文v4、OWASP Prompt Injection/AI Agent Security。引用放在对应论述，不以外部链接代替正文。

## 明确保留的限制

- MCP只实现initialize/initialized、tools/list/call的stdio子集，不覆盖完整HTTP/OAuth/会话/分页/取消协议。
- 工具没有任意shell/路径/URL；模型不自动规划循环，安全结论是能力收窄与授权拒绝，不是任意代码沙箱安全。
- 检索只是关键词基线，没实现自动文档入库、分块、embedding或向量库；无随机向量效果图。
- mock可回显恶意文档原文，只用于确定性契约测试；合法引用不证明结论受支持，未做真实模型质量/抗注入评测或付费调用。
- 审批机制作为新增写工具前的设计要求，当前v2没有审批引擎，不接受模型自报approved。
- 长期生产认证、数据保留、部署者上游选择、出站/进程隔离、备份与密钥权限另需实现；Dockerfile未跑容器，不据此作生产安全认证。

例子链接使用agent-workshop.zip和两端v2 README；共享下载/离线索引、目录、路由/评论、手机展示与线上发布由父级统一整合。本代理没有提交。
