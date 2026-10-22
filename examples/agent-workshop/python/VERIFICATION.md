# Chapter 01 Python 核验记录

核验日期：2026-10-21。环境：Darwin x86_64，Python 3.12.14；独立新建 `.venv`，未使用全局站点包。完整实际依赖版本见 `requirements.lock`。

执行结果：

```text
python -m pytest -q
36 passed, 1 warning in 3.58s

python -m pip check
No broken requirements found.

python -m compileall -q app.py models.py providers.py
退出码 0
```

36 个检查包含共享 `cases.json` 的 10 个 HTTP 契约场景、非法 JSON/编码/类型、请求大小限制、归一化、重复引用、额外输出字段、超时取消、配置失败、Unicode 长度与换行 ID，以及真实本地 HTTP 假上游的成功、非 2xx、坏 envelope、超时和超大响应。

额外启动 Uvicorn 绑定 `127.0.0.1:18461`，通过 HTTP 读取 `/health` 并提交 `../shared/request.json`，实际输出：

```text
HTTP smoke: {"status":"ok"} 200 {"ok":true,"result":{"answer":"示例回答：请查看所附资料。","citations":["guide"]}}
```

本地假上游测试走真实 socket 和 HTTPX，未调用任何付费或外部模型。没有测量真实模型质量、吞吐量或费用。

一条 warning 来自 Starlette TestClient 使用 AnyIO 已弃用别名 `anyio.abc.BlockingPortal`。本组测试通过；它提醒后续升级测试依赖时需要检查适配，不影响本次协议结果。

资源边界：模型调用可取消且有总截止时间，但不等于远端停止计费；同步阻塞 provider 不可被 asyncio 抢占。没有慢速客户端上传限时、并发上限、身份认证、持久化、重试或真实模型质量评测，不能原样作为公开生产服务。
