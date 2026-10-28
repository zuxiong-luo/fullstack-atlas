# Python：从Node.js迁移的配套实验

当前交付第9篇 `09-fastapi-overview`，其他13篇尚未编写。本目录替代旧入门项目作为新版示例入口；旧项目保留历史，不在这里混用其代码和数据库。

## 实际版本

- CPython3.12.14；Node22.12.0、TypeScript5.7.2。
- FastAPI0.162.0、Starlette1.10.0、Pydantic2.14.1、Uvicorn0.54.0。
- NestJS10.4.22、class-validator0.14.1、class-transformer0.5.1。
- 完整Python版本在requirements.lock；完整Node依赖在package-lock.json。
- FastAPI的TestClient使用HTTPX2 2.16.0；真实HTTP对照客户端使用HTTPX0.28.1。两者分开锁定，避免Starlette1.10的旧客户端弃用路径。

本机验证环境为macOS14.5 x86_64。Linux、Windows与容器的验证范围见VERIFICATION.md，不根据本机成功推断所有环境。

## 两端共同业务

POST `/api/quotes` 输入 `seconds` 和可省略的 `quality`。时长1～120，画质standard或hd，默认standard；示例报价分别每秒2/4积分。HD超过60秒返回409。没有数据库、账号、真实积分扣除或模型调用。

- `{"seconds":30}` → 200，`{"seconds":30,"quality":"standard","credits":60}`。
- `{"seconds":"30"}` → 422，两端具体校验错误格式不同。
- `{"seconds":61,"quality":"hd"}` → 409，`detail.code=HD_LIMIT`。
- 内部结果含internal_rule，两端公开响应均不包含该字段。
- 原始JSON `{"seconds":30.0}` 是刻意保留的差异：Python严格整数校验422，Node的Number/IsInt接受后200。不能先解析再重序列化，否则可能把比较输入改成30。

完整14组输入在shared/quotes.json，raw字段保存必须维持的原始请求体。两端采用相同业务规则，但不声称全部类型语义天然一致。

## 安装与运行

从仓库根目录 `cd examples/python-node-course`。下载python-node-course.zip后，解压进入python-node-course。

```bash
python3.12 --version
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
node --version
npm ci --ignore-scripts
npm run build
```

选择Python3.12与Node22.12.0。Windows PowerShell可用 `py -3.12 -m venv .venv` 和 `.venv\Scripts\Activate.ps1`，这只是操作说明，未作为本次Windows验证。

第一个极小应用：

```bash
cd 09-fastapi-overview
python -m uvicorn minimal:app --host 127.0.0.1 --port 4194
```

另开终端 `curl -s http://127.0.0.1:4194/health`，应得 `{"ok":true}`。按Ctrl+C停止。完整FastAPI应用：

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 4195
```

另一个终端，从python-node-course目录运行Nest对照：

```bash
npm run start:nest
```

Nest默认监听127.0.0.1:4196。三套演示端口明确固定，端口占用时应处理冲突，不自动换端口；自动测试另选临时空闲端口。

```bash
curl -i -X POST http://127.0.0.1:4195/api/quotes \
  -H 'Content-Type: application/json' \
  -d '{"seconds":30,"quality":"standard"}'
```

成功返回60积分及X-Demo-Framework: fastapi。相同请求改4196可对照Nest。`/docs`与`/openapi.json`属于FastAPI示例；本篇Nest对照没有安装Swagger模块。

## 验证

```bash
# python-node-course目录
npm test
cd 09-fastapi-overview
../.venv/bin/python -m unittest -v
```

Node测试构建后在真实端口执行14组用例。Python7项应用检查加1项真实HTTP双端检查，共8项；后者自动启动Uvicorn与Nest，对同14组输入逐端发请求，正常退出并清理服务。Node需要在PATH中，也可通过NODE_BINARY指定绝对路径。

附加小语法实验：

```bash
python annotation-demo.py
python decorator-plain.py
cd ..
node dist/annotation-demo.js
```

预期依次为str；`{'ok': True}`和True；string。代码故意说明类型提示/断言不是运行时数据校验，不作为推荐绕过静态检查的写法。

## 文件职责与边界

schemas.py：输入输出；service.py：纯报价逻辑和领域异常；api.py：路由、依赖获取、业务错误映射；main.py：装配、lifespan和中间件。nest-comparison.ts给出相同业务的真实Nest入口，便于对照熟悉的Controller/Provider/Module和ValidationPipe。

没有在未实现的地方写“已支持持久任务”。本例服务仅监听本机，依赖锁定为了复现实验，不代表依赖完成了生产安全审核；实际安装告警记录在VERIFICATION.md。

站点离线包包含文章、图形和源码下载，不包含Python/Node解释器或已经安装的依赖。FastAPI `/docs`默认需要外部Swagger UI资源，断网展示需另行自托管；`/openapi.json`由本地应用生成。
