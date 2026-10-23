# TypeScript v2 验证记录

2026-10-23。范围是Agent02—08的本地教学实现，旧chapter01与shared/v2未修改。

## 环境

macOS，Node.js22.12.0，Fastify5.12.7，TypeScript5.7.2，tsx4.20.6，node:sqlite实际SQLite3.47.0。Node22.12需要--experimental-sqlite；脚本含flag，ExperimentalWarning保留。npm锁文件固定依赖。

## 已执行

- npm install --ignore-scripts：成功。
- npm run build：TypeScript通过。
- npm test：33项通过（含下列集成与进程实验）。
- npm run eval：shared六例逐例选中IDs符合预期，五个正例Recall@3均1，一个无命中正确；model_calls=0。这是关键词回归，不是模型语义质量。空数据/无正例/无负例会拒绝，不以NaN通过；eval层独立截前3，排第4的目标不计入Recall@3。
- compiled server使用PORT4346启动真实loopback HTTP；GET health=200/chapter8，POST run和相同请求重放均completed，答案、引用、done检查点相同；Ctrl-C关闭。

### 统一HTTP用例

测试直接读取shared/v2/http-cases.json，全11组通过：public工具、private拒绝、shell白名单拒绝、未知参数、无身份、cache回答、无命中0调用、严格字段、幂等冲突/跨owner、memory隔离删除、注入资料/越权拒绝。未复制一份测试常量后假装共享。

### 额外行为

- 2..8章门槛与公开health；未开路由404，JSON/字段/码点/64KiB413；fatal UTF8解码拒非法字节、BOM/UTF16；text/model answer/citations拒孤立surrogate，正常emoji通过。
- NFKC问题归一化、共享检索数据、owner过滤；memory按id排序，删除生效且记忆不自动进入问答。
- 模型JSON、schema、重复/未知引用、模型伪工具字段拒绝。
- context_chars按question+evidence id/title/text码点精确计数；预算0时拒绝有证据调用，无命中仍0调用。
- chapter8单执行槽实际阻止并发，tools/读/记忆仍可用；非协作provider超时后直到其promise真正结算才释放槽。2..7不启用08预算。
- SQLite两真实连接测试BEGIN IMMEDIATE认领、有效lease RUN_BUSY、过期后epoch递增、旧提交STALE_RUN、新结果不被覆盖；幂等冲突异常后能继续新事务，确认ROLLBACK释放。
- 实际子进程在retrieved检查点提交后process.exit(27)，不执行Store.close；第二个新进程打开同文件，注入已过lease时钟，恢复到done。第二进程检索器若被调用会抛错，测试成功证明检查点复用，而非只在同进程改变量。
- 上游失败保留retrieved检查点并释放占用，重试不再检索；completed重放不再次调模型。同键并发一个成功占用另一个RUN_BUSY。
- 实际本机HTTP fake上游：成功wire、授权头、模型名；302不跟随（目标调用0）；503、超1MiB、坏envelope、坏模型JSON/schema、未知引用、超时。未调用外部付费模型。
- 实际MCP stdio子进程：2025-06-18 initialize、通知静默、tools/list自足Schema、成功读取、shell/跨owner工具错误、未知method -32601、错误参数-32602；stdout每行只为JSON-RPC。

## 事实核对与限制

已读MCP2025-06-18的stdio传输/工具规范，Node22.12官方sqlite文档。只实现明确子集，不声称完整MCP会话、HTTP传输或OAuth。

没有运行真实模型，不声称模拟回答质量。没有创建随机向量。引用存在不证明结论支持；注入文档可以被模型回显，安全结论只针对程序能力和授权，不声称prompt或模型始终识别恶意内容。

没有运行Docker构建/容器，Dockerfile仅交付配置。没有生产auth/TLS、跨实例准入、自动lease续租、后台调度、数据库迁移/加密/备份验收。默认单次模型timeout3000ms小于lease10000ms，但外部调用重试可能重复，不承诺exactly once。

持久化run/记忆含用户数据，必须留在服务端；不能复制到GitHub Pages离线包。demo身份不适合公网。测试故障钩子仅在本地fixture或依赖注入，不作为HTTP功能。数据库与日志权限/持久卷owner需要生产部署单独设计。
