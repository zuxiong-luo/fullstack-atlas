# Agent workshop 02—08 · TypeScript v2

本目录不覆盖旧chapter01。它使用 `../shared/v2/CONTRACT.md`、schema/documents/http-cases/retrieval-cases，按CHAPTER=2..8逐步开放同一份实现。版本入口由主仓库shared章节标记定位，不声称已经创建独立Git tags。

实际验证 Node.js22.12.0、Fastify5.12.7、TypeScript5.7.2、tsx4.20.6、内置SQLite3.47.0。Node22.12的 `node:sqlite` **需要--experimental-sqlite**，scripts已包含；终端的ExperimentalWarning是真实稳定性边界，没有屏蔽。全部默认无密钥、无付费调用。

```sh
cd examples/agent-workshop/typescript-v2
npm ci
npm test
npm run build
npm run eval
CHAPTER=8 PORT=4340 npm start
```

只监听127.0.0.1。另开终端：

```sh
curl http://127.0.0.1:4340/health
curl -H 'Authorization: Bearer demo-alice' -H 'Content-Type: application/json' \
  -d '{"question":"lease worker recovery"}' http://127.0.0.1:4340/v2/answers
curl -H 'Authorization: Bearer demo-alice' -H 'Content-Type: application/json' \
  -d '{"request_id":"r-one","question":"lease worker recovery"}' http://127.0.0.1:4340/v2/runs
curl -H 'Authorization: Bearer demo-alice' -X POST http://127.0.0.1:4340/v2/runs/r-one/resume
```

示例令牌demo-alice/demo-bob只映射固定教学主体；HTTP body.owner无效。不能用作生产认证。64KiB入口限制、fatal UTF8（拒BOM/UTF16）、严格字段/Unicode码点校验（拒孤立surrogate，合法emoji正常）；logger:false不记录token、密钥或私有正文。数据库/日志/模型凭据不属于GitHub Pages资源。

## 章节与模块

| 章 | 开放能力 | 完整关键模块 |
| --- | --- | --- |
| 02 | POST /v2/tools；stdio子集 | contracts.ts、tools.ts、mcp.ts |
| 03 | POST /v2/answers | retrieval.ts、providers.ts、service.ts |
| 04 | POST/GET runs、显式resume | store.ts、service.ts |
| 05 | POST/GET/DELETE memory | store.ts、app.ts |
| 06 | JSON检索评测CLI | eval.ts |
| 07 | 受控注入/权限反例 | tools.ts、app/provider tests |
| 08 | 执行槽、字符/调用预算、部署说明 | service.ts、server.ts、Dockerfile |

尚未开放路由返回404 ROUTE_NOT_FOUND；/health始终公开。2..7不启用第08章context/call/concurrency门槛；模型超时一直启用。

## 检索与模型边界

KeywordRetriever按NFKC+lower question包含的关键词数排序，最多top3且分数>0，平分按ASCII文档ID升序。只选public或owner文档；不是向量相似度，没有随机embedding。Retriever接口允许替换实现，但实现者必须继续承担文档授权和选中证据完整性。

本地mock返回第一条证据原文与ID；无命中不调用模型，固定“没有找到可引用的资料。”。响应引用唯一且必须来自选中证据；仅证明引用ID支持，不证明答案语义正确。文档中的注入样本文字可以作为不可信资料被引用，但不能新建工具权限或调用shell/任意URL。

仅显式 `MODEL_PROVIDER=http` 才启用服务端HTTP适配，wire使用OpenAI兼容chat-completions envelope：choices[0].message.content为JSON字符串。环境配置URL/key/model，不接受HTTP用户配置任意上游；请求拒绝重定向，读响应最多1MiB，finally关闭reader。无真实付费提供商测试，只有本机fake HTTP上游。

## 检查点、认领与恢复

SQLite按(owner,request_id)唯一，问题不同返回409 IDEMPOTENCY_CONFLICT。BEGIN IMMEDIATE只包短事务：创建、认领；不跨模型等待。lease默认10000ms，认领epoch递增，检查点/最终提交都用owner+ID+epoch且lease仍有效的条件更新，旧执行者无法覆盖新结果。

状态queued → retrieved → completed，checkpoint最后为done。retrieved保存选中证据JSON，进程崩溃后显式resume复用它、不重复检索；模型调用可能重试，不承诺exactly once。模型失败释放当前认领但保留检查点；同run有效占用409 RUN_BUSY，过期旧提交409 STALE_RUN。没有后台生产调度、自动续租或外部副作用事务；默认timeout3000ms短于lease，但自定义长预算仍须规划续租/认领策略。

测试真的启动子进程，写retrieved后 `process.exit(27)`，第二个新进程打开同一数据库恢复；故障钩子只在测试fixture，不向HTTP开放。

## 记忆、评测与容量

记忆只存用户显式写入，按owner/id隔离并按id排序，不自动加入问答；删除只改变后续读取，不抹除备份或此前送到模型的副本。

`npm run eval`读取统一6例，stdout输出JSON报告与每例IDs/Recall@3/无命中；它是固定关键词检索回归，不是模型语义质量、token计数或美元成本。

Chapter08默认执行槽2、context12000码点、model_calls预算1。context_chars严格等于question与选中evidence各id/title/text的码点数之和。无命中0调用；completed幂等重放不再次检索/调模型，并在缓存命中时绕过执行槽。tools/读/记忆不占模型槽。

超时会AbortSignal取消provider并返回504；若自定义provider不协作取消，槽仍保留到真实promise结算，避免“超时后释放槽”造成隐形无界调用。这种情况下容量可能持续占满，需要更强的进程隔离/关闭策略；JavaScript不能强行终止任意函数。正常关闭用Ctrl-C/SIGTERM，Fastify等待请求结束后关闭SQLite；没有证明多实例或容器运维能力。

## MCP stdio子集

```sh
MCP_OWNER=alice npm run --silent mcp
```

输入逐行JSON-RPC2.0；initialize(protocolVersion2025-06-18)、notifications/initialized、tools/list、tools/call。唯一工具lookup_document复用HTTP参数/授权。通知不回复，未知method -32601，参数-32602，执行错误作为isError工具结果。使用npm启动时必须加--silent避免npm banner混入协议；server自身stdout仅协议，诊断到stderr。不是完整MCP SDK：未覆盖HTTP传输、OAuth、完整会话协商、分页和取消协议。身份由启动环境固定，不能由模型参数替换。

## 部署边界

.env.example无真实密钥；Dockerfile提供可复现构建配置但本机未运行Docker构建/容器。容器默认仍监听loopback，只适合容器内部试验，不声称已有公网服务部署。生产还需真实auth、TLS、租户级配额、磁盘加密/权限/备份、数据库迁移、跨进程准入、日志与恢复运维。对本SQLite本地教学实现，不承诺多主机分布式锁。
