# Node.js 执行模型实验

固定环境：Node.js **22.12.0**；macOS 14.5 x64 已验证。无第三方依赖；只访问本例创建的 loopback HTTP 服务和固定本地文件，不请求外网、不写磁盘。

## 文件与命令

- `main.mjs` / `fixture.txt`：async 同步阶段与文件等待。
- `order.cjs` / `order.mjs`：相同代码在两种入口的检查点顺序。
- `io-order.cjs`：在文件读取回调内创建 immediate 与 timer。
- `chunks.mjs`：有总量、块大小边界且可取消的求和器。
- `errors.mjs`：async 错误通过 Promise 传播。
- `test.mjs`：10 项行为验证，包括两个进程退出实验。

仓库内先 `cd examples/node-execution-model`；ZIP 解压后直接进入该目录：

```sh
nvm use 22.12.0
npm ci
npm start
npm test
node order.cjs
node order.mjs
node io-order.cjs
node errors.mjs
```

未使用 nvm 时，先确保 `node --version` 为 v22.12.0。根站点的 Node 环境不会自动切换下载示例的版本。

`npm start` 应输出：

```text
cpu:start
cpu:end:49995000
caller:promise
caller:awaited
file:notes
turn:resumed
```

两个 order 分别输出 `["sync","nextTick","promise","microtask"]` 和 `["sync","promise","microtask","nextTick"]`。io-order 输出 `["io","immediate","timer"]`。errors 输出 `caller continued` 与 `caught SyntaxError`。

## 正常与失败路径

`sumInChunks(10000)` 得到 49995000；超过一百万项或非法块长拒绝。测试在块间取消，得到 AbortError。子进程测试设置外部三秒时限；待定 Promise 和 unref 计时器都不能单独保活进程。

## 范围与限制

顺序结论限定本例入口上下文。没有断言顶层 timer/immediate 必须固定顺序。分块仅让出机会，没有创建 CPU 并行，也没有测量吞吐收益。不同系统或 Node 版本需重新执行；未完成站点、手机和真实生产负载验收。

源码可以通过站点离线包下载；在新电脑执行仍需另行安装 Node。测试仅访问示例内固定文本文件。

## 2026-10-25：从运行时分层到真实 I/O

`node io-trace.mjs` 实际执行 callback `fs.readFile` 与自己的 loopback HTTP。
输出 text/body 都为 notes；顺序 file:submit→file:callback→http:submit→server:request→http:response→http:end。
async_hooks 观察到 FSREQCALLBACK、TCPWRAP、TCPCONNECTWRAP、HTTPCLIENTREQUEST；它不是内核线程/系统调用探针。

`source-fragments/manifest.json` 固定 Node v22.12.0 原文件、连续行号与 SHA256。
摘录逐字来自官方 tag，不改写成模拟实现；MIT 归属在 `THIRD_PARTY_NOTICES.txt`。
macOS 文件工作池路径与数值地址 TCP 就绪通知分别解释；Linux io_uring、Windows、底层 syscall 时间线未在本机验证。

本次 Node 22.12.0 / macOS14.5 x64 **10/10 测试通过**，原8项全部保留；新增资源观察正常结束时关闭自己的socket与server。
