# 第7章：从笔记工具到有界HTTP服务

CPython3.12.14；FastAPI0.115.8、Pydantic2.10.6、Starlette0.45.3、Uvicorn0.34.0、HTTPX0.28.1。完整解析依赖固定在requirements.lock，版本是本示例的复现基线，不称当前最新版。

在python-course目录运行（离线ZIP展开后也一样）：

```sh
python3.12 -m venv .venv-web
.venv-web/bin/python -m pip install -r chapter07/requirements.lock
.venv-web/bin/python -m unittest -v test_chapter07
ATLAS_TOKEN=local-demo-token-2026 .venv-web/bin/python -m chapter07
```

只绑定127.0.0.1:8017，单Uvicorn worker；这个公开demo token只供本地实验，请勿用于真实部署。Ctrl+C触发lifespan关闭。无需第8/9章、外部数据库或公司服务。Note复用第4章；第5章的固定worker/有界queue与第6章python-async-services的超时/取消/清理机制在此组合为服务寿命内的导入队列，第6章仍是独立目录，本章不跨目录导入它。

另一终端运行：

```sh
curl --noproxy '*' -sS http://127.0.0.1:8017/health
curl --noproxy '*' -sS -X POST http://127.0.0.1:8017/imports \
  -H 'Authorization: Bearer local-demo-token-2026' -H 'Content-Type: application/json' \
  --data-binary @chapter07/fixtures/import.json
# 把响应id填入下面路径；202仅表示已接收，不代表提交完成：
curl --noproxy '*' -sS http://127.0.0.1:8017/imports/REPLACE_WITH_ID \
  -H 'Authorization: Bearer local-demo-token-2026'
curl --noproxy '*' -sS http://127.0.0.1:8017/notes -H 'Authorization: Bearer local-demo-token-2026'
# 失败：无token ->401；title数字 ->422；已有id ->409：
curl --noproxy '*' -sS -X POST http://127.0.0.1:8017/notes \
  -H 'Authorization: Bearer local-demo-token-2026' -H 'Content-Type: application/json' \
  --data '{"id":"n3","title":123,"tags":[]}'
```

初次导入预期queued/running→succeeded,count2，GET notes两个输入笔记；再次提交相同批次会被接收，但任务最终failed且笔记仍2条。单笔POST /notes重复id同步409。内存版本重启全部清空，202后HTTP断开不撤销已接收任务。队列和notes只在当前进程有效，多Uvicorn worker会分裂内存状态。

边界：请求原始字节最多32768（ASGI读入分块后检查，不能代表传输层/全服务器峰值内存）；JSON批次1..32，单笔id32/title200/tags8×32字符；HTTP验证拒绝隐式数字转字符串、多余字段、未规范化标签。每个worker最多持有1批，等待queue最多capacity批，另有限额的并发请求/服务器配置不在这个队列保证中。内存notes最多512；任务记录最多64，满时淘汰最早终态，旧id可404。

关闭先拒绝submit，再取消固定workers，运行中的prepare按finally清理，等待批次标cancelled并task_done。asyncio timeout要求协作让出，不能强制打断CPU循环或阻塞库。默认prepare只是返回已经验证的Note，无实际外部I/O，不用async修饰宣称提速。容量/取消测试用Event确认worker占用，绝不靠sleep猜并发。

本机macOS14.5/CPython3.12.14：8/8测试通过，包括真实loopback Uvicorn TCP+HTTP、401/201/409、严格422/413、任务原子失败、队列容量、超时/取消/关闭和终态淘汰。HTTPX真实本地调用trust_env=False，避免环境代理把loopback带离本机。TestClient须用with启动/停止lifespan，ASGI测试不替代真实socket测试。

文件：models.py为边界模型；body_limit.py在JSON解码前限字节；jobs.py拥有内存Note和队列；api.py构建依赖/路由/lifespan；__main__.py为真实python -m入口。共享Bearer只是本机单一权限演示，没有用户隔离、密码流程、JWT、HTTPS、公网防护或耐久任务承诺。
