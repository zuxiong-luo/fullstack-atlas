# Node.js 有边界的流式导出

固定 Node **22.12.0**。只使用内置模块；`package-lock.json` 中无第三方依赖。

```sh
nvm use
npm ci
npm test
npm run check
npm start
```

固定监听 `127.0.0.1:4310`，已占用时启动报错，不自动换端口。按 Ctrl+C 有限退出。测试使用随机本地端口，避免与开发服务冲突。

## 文件

- `capacity.mjs`：单进程无队列的导出并发准入，释放幂等。
- `rows.mjs`：可取消的生成器，字节模式 Readable、固定行块；模拟数据，非真实数据库。
- `server.mjs`：GET 参数校验、CSV pipeline、2 个在途名额、1000ms 总预算、错误分类与退出。
- `event-loop.mjs`：async 同步片段/微任务/setImmediate 顺序实验。
- `backpressure.mjs`：同一行源接慢 Writable，验证生产者不无限超前。
- `test.mjs`：真实 HTTP 和流行为测试；在完整仓库中同时验证正文代码与文件相同。

## 正常流程

另开终端：

```sh
curl -i 'http://127.0.0.1:4310/health'
curl -f 'http://127.0.0.1:4310/export?rows=3&delay=0' -o /tmp/tasks.csv
wc -l /tmp/tasks.csv
```

导出为 200，`text/csv`，文件含表头共 4 行。数据行 `id,` 后为 1024 个 x。正常 `completed` 增加、`active` 回到 0。`rssBytes` 和 `eventLoopDelayMs` 与运行条件有关，不是固定期望数字。

`rows` 为 1–10000 整数，默认 100。`delay` 为 0–50 的模拟逐行等待毫秒数，默认 1。重复参数、未知参数、非整数或越界值 400。仅 GET，其他方法 405。

## 过载、取消、超时、源错误

- 并发数上限 2，第三个在途导出立即 503、`EXPORT_BUSY`、`Retry-After: 1`。无业务等待队列。自动测试在上限 1 条件下稳定验证此行为。
- 健康检查不占导出名额，但不保证在主线程阻塞时及时响应。
- 中断下载后源停止生成，名额释放。

```sh
curl --max-time 0.1 'http://127.0.0.1:4310/export?rows=1000&delay=20' -o /tmp/interrupted.csv
curl 'http://127.0.0.1:4310/health'
```

第一条以超时退出是本反例预期。1000ms 服务端预算和客户端 0.1s 预算不同。要检查服务端超时，可取消 `--max-time`，长导出会在服务端预算到期后中断；`timedOut` 增加。

停止原服务后开启故障模式：

```sh
EXPORT_FAULTS=1 npm start
# 第二个终端：
curl -v 'http://127.0.0.1:4310/export?rows=5&delay=10&failAt=3' -o /tmp/failed.csv
```

`failAt=3` 在第三条数据生成前抛错。CSV头已发送，响应体中断；不能把已经发送的200改成500，也不向CSV追加JSON。默认不启用故障注入，正常模式指定正数 `failAt` 返回400。

## 独立实验

```sh
node event-loop.mjs
node backpressure.mjs
```

顺序实验输出 `calculate start`、`calculate end:49995000`、`caller received promise`、`after await`、`immediate callback`、`after setImmediate`。背压实验最终 produced 与 consumed 都为30，本机一次 maxAhead=2，测试只要求不超过3。maxAhead为行数差，不是耗时或内存。

## 证据与限制

2026-10-23，macOS/Node22.12.0：10项测试通过，语法检查通过，两个独立实验运行通过。独立下载包没有站点正文，第10项明确skip；完整仓库中执行10项。源实现没有隐藏脚手架依赖，正文完整展示业务文件。

不是生产容量基准：没有真实数据库、TLS、代理、认证、Worker线程池或互联网部署。只监听loopback。测试毫秒等待只为控制交错，不用于宣称吞吐、p99或内存收益。`highWaterMark` 不是全进程内存硬上限。数据库接入须使用驱动自身的游标/取消能力。
