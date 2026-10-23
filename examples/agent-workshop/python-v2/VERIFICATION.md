# Python-v2 实际验证

2026-10-23。用户本机macOS14.5 x86_64；Python3.12.14，独立venv；SQLite3.53.1。FastAPI0.161.1、uvicorn0.54.0、httpx0.28.1、pytest9.1.1，所有间接依赖精确锁定。

实际命令：

```bash
.venv/bin/python -m pytest -q
.venv/bin/python -m pip check
.venv/bin/python evaluate.py
```

当前36测试全部通过，pip check无依赖冲突。测试覆盖：

- 直接读取shared/v2/http-cases.json的全部11组，用对应CHAPTER执行；还验证未开放路由404。
- 真实64KiB计数、严格JSON/字段、服务端身份、Unicode code point、JS trim等价、孤立surrogate拒绝/合法emoji通过、模型Schema和引用。
- 真实本地HTTP fake上游11种路径：正确wire/Authorization、成功、禁止重定向、非2xx、>1MiB、非法UTF8/BOM/envelope、模型JSON/Schema/引用错误与慢流timeout；结束后client/response任务与执行槽归零。
- 真实MCP stdio子进程：initialize、通知静默、不允许通知绕过initialize、tools/list自足schema、tools/call成功/权限/参数/未知方法/非法ID、超长行排空后恢复协议。
- 两个真实SQLite连接与两个并行线程争抢同一认领，只一个获得epoch；过期后新epoch使旧提交失效，冲突事务正常回滚。
- 真实子进程在retrieved持久化后os._exit(27)，第二个新进程在注入的过期时钟下resume。恢复用会抛错的Retriever证明未重复检索。这里不是等待真实10秒lease，时钟注入已明确。
- 模型失败保留retrieved；成功retry之后completed重放无新检索/模型；同key并发RUN_BUSY。
- context/call/concurrency只第8章启用；读取/工具/记忆不占执行槽。非协作provider收到取消却未结算时，504后槽仍占用，后续503；真正结算后释放。
- memory显式写入、按owner隔离、排序、删除；不会自动加进模型输入。
- shell/任意URL/越权文档提议不能扩展工具权限；模型额外动作字段不是可执行回答。
- 评测层强制top3，第4名目标不计Recall@3；空数据/缺正负样本不能产出虚假满分。

实际CLI报告：共享6例，5正例Recall@3均1，1无命中正确；mean_recall_at_3=1、no_hit_pass=true、model_calls=0、not_model_quality=true。这只证明这份小型关键词回归，没有真实模型语义、向量质量或性能结论。

主任务提供shared/v2/verify-http-parity.py，可另行启动两端真实loopback服务逐章比较同一HTTP案例。该结果应以主任务实际记录为准，不把本目录ASGI测试冒充双语言网络结果。

限制：未调用付费模型；真实HTTP只fake上游。无后台worker、自动记忆、向量检索实现、生产auth、数据库加密、备份删除或跨attempt费用账本。Dockerfile未实跑。忽略取消的协程可能继续占槽；CPU阻塞代码无法被asyncio强行终止。SQLite/槽只本机单进程，非多实例全局容量与一致性方案。
