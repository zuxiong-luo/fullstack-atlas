# Agent 第一章 · Python 服务

本章实现一个能拒绝坏输入和坏结果的模型调用边界，标记为 `chapter-01-v1`。没有工具调用、检索、持久化或自动重试；SQLite 留给后续章节。接口与 `../shared/CONTRACT.md` 对齐。

## 环境与运行

Python **3.12**、FastAPI 0.115.12、Pydantic 2.11.7、HTTPX 0.28.1、Uvicorn 0.34.3。完整传递依赖锁定在 `requirements.lock`。从仓库根目录运行：

```sh
cd examples/agent-workshop/python
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
python -m pytest -q
python -m uvicorn app:create_app --factory --host 127.0.0.1 --port 8000
```

如果 Python 3.12 的可执行文件名称不同，替换成实际路径。依赖安装需要联网；默认 mock 和全部测试不需要模型密钥。另开终端：

```sh
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/v1/answers \
  -H 'Content-Type: application/json' \
  -d '{"question":"怎么读取配置？","documents":[{"id":"guide","text":"配置从环境变量读取。"}]}'
```

预期响应分别是 `{"status":"ok"}` 和：

```json
{"ok":true,"result":{"answer":"示例回答：请查看所附资料。","citations":["guide"]}}
```

这是固定模拟回答，不能据此判断模型质量。模拟器用来验证程序分支。

## 从哪里读代码

- `models.py`：严格类型、长度、额外字段和唯一性校验，不自动把数字转成字符串。
- `providers.py`：配置、模拟模型与 HTTP 适配器；适配器返回原始文本，不决定业务结果是否可信。
- `app.py`：限制请求大小 → 校验输入 → 带截止时间调用模型 → JSON 解析 → 结构校验 → 引用集合检查。
- `tests/test_service.py`：加载双语言共用用例，并启动本地 HTTP 假上游验证真实网络适配路径。

引用检查能拒绝不存在的资料 ID，但不能证明回答被资料支持。模型引用了正确 ID 却编造结论，本章仍可能放行。后续要补引用片段、评测和复核。

## 失败怎么复现

停止服务，换模拟场景重启，再发相同 curl（加 `-i` 可以看状态码）：

```sh
MOCK_SCENARIO=unsupported_citation python -m uvicorn app:create_app --factory --host 127.0.0.1 --port 8000
```

| 场景或条件 | HTTP | 错误码 |
| --- | --- | --- |
| 空问题、重复 ID、多余字段、非法 JSON | 400 | INVALID_REQUEST |
| 请求超过 256 KiB | 413 | PAYLOAD_TOO_LARGE |
| invalid_json | 502 | MODEL_FORMAT_ERROR |
| invalid_schema | 502 | MODEL_SCHEMA_ERROR |
| unsupported_citation | 502 | UNSUPPORTED_CITATION |
| timeout | 504 | UPSTREAM_TIMEOUT |
| upstream_error | 502 | UPSTREAM_ERROR |

场景来自服务端 `MOCK_SCENARIO`，请求体不能改变它。`MODEL_TIMEOUT_MS` 默认 3000，允许 50～60000。模拟超时实际等待预算结束，测试用 50ms。未知配置会让服务启动失败。

## 可选真实 HTTP 模型

没有执行真实付费调用。适配器要求供应商支持 Chat Completions 格式：POST 请求有 `model`、`messages`、`response_format: {type: "json_object"}`，文本在 `choices[0].message.content`。这不是所有供应商共同支持的接口；不支持时需要更换适配器。

只在服务端配置环境变量：

```sh
export MODEL_PROVIDER=http
export MODEL_API_URL='https://your-provider.example/v1/chat/completions'
export MODEL_NAME='your-model-name'
# 用终端的密钥管理方式设置 MODEL_API_KEY；不要提交到仓库。
export MODEL_TIMEOUT_MS=3000
python -m uvicorn app:create_app --factory --host 127.0.0.1 --port 8000
```

域名和模型名是占位符。密钥不能放进 GitHub Pages 或浏览器代码。HTTP 仅用于本地假上游，真实远端应使用 HTTPS。适配器不跟随重定向，禁用环境代理，避免不知情地经代理发送密钥。

每次调用创建并关闭 AsyncClient，让资源所有权清楚；高并发服务应改为生命周期内复用连接池并正确关闭。总截止时间包住整个调用，取消时流式响应和客户端上下文关闭连接，但不能保证远端模型停止计算或不计费。注入的 provider 必须协作式取消；同步死循环不能被 asyncio 抢占。

响应限制为 1 MiB 解压后字节，不向客户端泄漏上游正文、密钥或堆栈。请求累计实际收到的字节，不只信任 Content-Length。本例没有慢速上传防护、认证、限流或全局并发控制，默认绑定回环地址，不宜原样公开部署。

## 验证和资料

具体环境与实际结果见 `VERIFICATION.md`。测试是协议行为证据，不是模型质量或性能结论。

- [HTTPX 异步客户端和流式响应关闭](https://www.python-httpx.org/async/)
- [FastAPI 错误响应](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- [Pydantic 严格模式](https://docs.pydantic.dev/latest/concepts/strict_mode/)
