# 第9篇 FastAPI 总览：实际验证记录

2026-10-28。新版只有第9篇已实现；本记录不覆盖其他13篇的未来代码。

## 固定环境与依赖

本地macOS14.5 x86_64，CPython3.12.14、Node22.12.0、TypeScript5.7.2。FastAPI0.162.0、Starlette1.10.0、Pydantic2.14.1、Uvicorn0.54.0，NestJS10.4.22。详见requirements.lock与package-lock.json。HTTPX0.28.1用于真实HTTP客户端，HTTPX2 2.16.0用于Starlette TestClient。

最初安装NestJS10.3.9，随后改为同一10.x系列的10.4.22并重跑对照。最初TestClient使用HTTPX兼容路径有弃用提示，按Starlette提示加入并锁定HTTPX2后重跑，不忽略提示冒充验证。Node22与Python3.12分别独立选择，不用系统默认Python3.14代替记录中的解释器。

## 已运行命令与结果

从python-node-course目录：

```bash
npm ci --ignore-scripts
npm test
.venv/bin/python -m unittest discover -s 09-fastapi-overview -v
```

- Node：1项真实HTTP测试，覆盖shared/quotes.json全部14组输入，通过。
- Python：7项应用测试+1项真实双端HTTP测试，共8项通过。
- 双端测试真实启动Uvicorn及Nest，使用临时空闲端口，14组输入各发送到两端，共28次报价请求；结束后检查服务线程/子进程退出。
- 标准默认值、HD、上限返回200；HD业务限制409；字符串、布尔值、小数、缺字段、越界、额外字段和非法画质422。
- raw请求体`{"seconds":30.0}`：FastAPI422、NestJS200，是预期保留的解析/类型差异，不是测试漏掉的失败。
- 成功输出不包含内部字段；错误输出不混入正常模型。损坏的服务返回值产生500。
- 两个应用实例各自创建服务；应用关闭后清理引用。普通类型注解不执行数据校验。
- 非法body不会调用正常业务方法，但普通无body依赖可以先执行；测试分别验证，不使用错误的固定线性流程描述。
- OpenAPI包含已声明的模型、200与422；代码中的业务409没有自动进入文档，正文明确说明需要显式responses声明。

额外运行annotation-demo.py、decorator-plain.py与编译后的annotation-demo.js，分别检查str、字典与True、string输出。

## 版本与边界

Nest对照用10.x，与作者现有技术栈接近；没有将当前官网后续主版本的所有功能描述为此示例能力。安装时npm审计报告7项依赖告警（4 moderate、3 high），记录原状，未自动使用force升级或声称依赖已完成安全审核。本例仅本机教学、无账号及写入业务，不作为生产部署模板。

未实测Windows、容器、生产负载、真实模型或模型费用。Swagger UI默认外部资源不包含在网站离线包中；TestClient返回/docs的200只验证响应，不证明交互页面资源已离线缓存。本站离线阅读只覆盖文章/图形/源码，服务端依赖需另行安装。

Linux CI配置另行执行同一套锁依赖、Node测试和Python真实HTTP测试；发布前本机记录不提前宣称CI或Linux已经通过。
