# Agent02—08 Python实现

固定Python3.12.14；依赖精确见`requirements.lock`（实际安装FastAPI0.161.1、uvicorn0.54.0、httpx0.28.1）。共享契约和样本位于`../shared/v2/`。本目录实现不依赖旧chapter01 Python模块，关键逻辑均可在本目录读取。

## 安装与逐章运行

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m pytest -q
.venv/bin/python evaluate.py
CHAPTER=4 SQLITE_PATH=data/agent.sqlite PORT=8002 .venv/bin/python server.py
```

默认绑定127.0.0.1；默认CHAPTER=8、mock provider，无模型密钥，不自动付费调用。环境样例为`.env.example`，入口通过环境变量读取，不自动加载.env文件。`CHAPTER=2..8`按契约开放能力；版本入口在`shared/chapter-0N.json`，不是每章独立Git tag。

```bash
curl http://127.0.0.1:8002/health
curl -X POST http://127.0.0.1:8002/v2/answers \
  -H 'Authorization: Bearer demo-alice' -H 'Content-Type: application/json' \
  --data '{"question":"offline cache snapshot"}'
curl -X POST http://127.0.0.1:8002/v2/runs \
  -H 'Authorization: Bearer demo-alice' -H 'Content-Type: application/json' \
  --data '{"request_id":"r-one","question":"lease worker recovery"}'
```

第3章后问答正常返回cache-guide引用、selected evidence和当前执行`model_calls=1`。无匹配返回固定无资料回答、空引用、0次模型调用。第4章run完成checkpoint=`done`；相同owner/request_id与相同问题重放不再次检索/调用。不同问题409，其他owner读不到。

`demo-alice`/`demo-bob`是公开回环教学令牌，不是生产认证；HTTP body.owner无效。请勿把密钥或真实敏感记忆用于这个示例。

## 文件与章节职责

- `contracts.py`：共享输入/错误、JS等价trim、code point长度、模型结果和引用校验。
- `tools.py`：唯一lookup_document能力、owner/public授权。
- `mcp_stdio.py`：2025-06-18 tools-only逐行JSON-RPC子集。
- `retrieval.py`：NFKC/lower关键词top3与可替换Retriever。
- `providers.py`：确定mock、有界HTTP适配器和总deadline。
- `store.py`：SQLite事务、lease/epoch、持久证据与显式记忆。
- `service.py`：检索→模型→结果、检查点恢复、准入与调用预算。
- `app.py`：64KiB真实流计数、鉴权、路由门槛与错误返回。
- `evaluate.py`：共享检索样本的JSON回归，非模型质量评测。

默认调用链至多一次模型请求，不实现任意工具规划循环。文档中的指令不会改变白名单或产生shell/URL权限。无真实embedding、后台worker或自动写记忆。

## 恢复与记忆

- queued/retrieved/completed与evidence在SQLite保存。
- BEGIN IMMEDIATE只覆盖短认领事务，模型等待不持有事务。
- lease默认10000ms，epoch每次有效认领递增；写入检查epoch和未过期lease。默认模型timeout3000ms。
- 崩溃后需显式POST`/v2/runs/:id/resume`，无body或JSON null；{}被拒绝。仍有效的lease返回RUN_BUSY，过期后可认领；没有自动后台恢复器。
- 模型失败保留retrieved，释放lease以便重试；外部模型调用仍可能重复，不保证exactly once。
- memory只接受显式POST，按owner/id隔离、列表按id排序、DELETE删行。默认不自动加入问答。它不实现备份抹除、历史checkpoint清理或远程模型数据删除。

## 第8章准入与资源

默认2个执行槽，仅包POST answers/runs/resume实际执行。读取、工具、记忆不占模型槽；completed重放也直接返回。满时503 SERVICE_BUSY，不是无界排队。

默认context_chars上限12000，严格按question与evidence每项id/title/text的Python code point数相加；不含JSON标点，不等于模型token。预算至少允许1次模型调用才执行；这是本次执行的计数，重试可能另发请求，不是跨attempt的美元/租户总账。

总deadline超时返回504并请求取消；**不合作provider任务还未真正结算时，执行槽保持占用**，防止表面超时后无限增加实际调用。正常HTTP适配器协作取消并关闭client/response。Python不能强制终止任意忽略取消的协程；阻塞CPU代码还能阻塞事件循环，生产应有进程隔离和监督退出。

HTTP响应体累计上限1MiB，不跟随重定向；超大/非法envelope/非2xx均为UPSTREAM_ERROR。仅在明确配置MODEL_PROVIDER=http及URL/key/model时启用。适配OpenAI兼容chat/completions格式，本次只与本地fake上游验证，未调用真实付费服务。

## MCP stdio

```bash
MCP_OWNER=alice .venv/bin/python mcp_stdio.py
```

stdin逐行JSON-RPC2.0，先initialize，再tools/list或tools/call；通知无响应。stdout只协议，owner由启动环境固定，schema包含本地$defs。仅声明tools；不实现HTTP传输、OAuth、完整协商、自动工具发现或任意进程执行。

## 测试和容器

测试读取共享11组HTTP案例，不另造一份“类似”数据；还实际启动fake HTTP、MCP子进程、os._exit崩溃子进程和第二恢复进程，测试SQLite并行、旧epoch、模型timeout/格式/引用、章门槛、清理与非协作任务槽保留。

Dockerfile的构建上下文必须为`examples/agent-workshop`，只COPY Python源码/锁文件/共享契约；非root UID10001、/data持久目录。示例命令：

```bash
docker build -f python-v2/Dockerfile -t atlas-agent-python-v2 .
docker run --rm -p 127.0.0.1:8002:8002 -v atlas-agent-data:/data atlas-agent-python-v2
```

**此Docker配置未在当前机器实际构建/运行。** 仅本地Python验证不代表容器、多实例、生产认证、加密备份或全局限流已验收。具体结果见VERIFICATION.md。

Docker构建上下文是agent-workshop；Dockerfile.dockerignore按该Dockerfile排除venv、依赖、运行数据与.env，不依赖子目录.dockerignore。未在本机运行容器构建。
