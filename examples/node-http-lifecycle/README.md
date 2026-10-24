# Node.js HTTP 请求生命周期

固定 Node.js **22.12.0**，无第三方依赖。macOS 14.5 x64 上执行真实 loopback HTTP 测试。接口是笔记确认演示，**不写数据库、不鉴权**。

## 安装与运行

仓库先 `cd examples/node-http-lifecycle`；ZIP 解压后直接进入目录：

```sh
nvm use
npm ci
npm test
npm start
```

非 nvm 用户使用安装好的 Node 22.12.0。main.mjs 监听 **127.0.0.1:4313**，与站点 4173 无关；端口占用先关闭占用该示例的进程，不自动漂移端口。

```sh
curl -i -X POST http://127.0.0.1:4313/notes \
  -H 'Content-Type: application/json' \
  --data '{"title":"  note  ","delayMs":0}'
```

得到 200 与 `{"title":"note"}`。Ctrl+C 进入 draining 并打印最终统计；SIGTERM 走相同入口。

## 输入与失败

- 只处理精确 `POST /notes`，其他入口 404。
- JSON 媒体类型，其他类型 415。
- 请求体默认最多 1024 **字节**，越限 413。
- 语法无效 400；标题为空、超 80 个 UTF-16 代码单元、delayMs 不是 0..2000 安全整数、额外字段均 422。
- 默认 4 个在途应用工作，满额 503，无业务等待队列。
- 从 request 处理开始预算 1000ms，超时 408 REQUEST_BUDGET。
- 客户端提前断开取消等待并释放名额；内部 CLIENT_LEFT/499 不代表向断开的连接发出响应。
- 退出先停止接入并排空，默认 500ms 后取消长工作并强制关闭 HTTP/1.1 连接。

```sh
curl -i -X POST http://127.0.0.1:4313/notes -H 'Content-Type: application/json' --data '{'
curl -i -X POST http://127.0.0.1:4313/notes -H 'Content-Type: application/json' --data '{"title":"slow","delayMs":1500}'
```

分别得到 400 BAD_JSON 与 408 REQUEST_BUDGET。delayMs 只是故障复现参数。

## 验证与生命周期

`npm test` 的 7 项测试涵盖正常请求、错误分类及字节限制、预算取消、断开释放容量、短任务排空、长任务强制关闭、正文未发完时的预算。测试使用端口 0 分配空闲端口，不需要另起服务；每项五秒保护，测试结束总会调用有期限的 close。

server.mjs 包含 readBody、parseInput、createApp 与统一 finally；main.mjs 只负责监听及信号。配置不支持任意非正数。completed 表示应用调用成功响应，不代表持久化或客户端已读；active 不等于 TCP 连接数。

## 限制

信号只取消合作式等待，不能抢占同步 CPU。预算和关闭时限也需要事件循环取得机会。未实现数据库取消、幂等写入、TLS、代理、WebSocket、HTTP/2、跨进程总限流和生产压测。Connection: close 是教学选择。真实终端、站点页面与手机人工验收另行记录。

下载 ZIP 不含 Node 运行时；站点离线阅读不能在浏览器里启动该服务。
