# node-http-lifecycle 核验记录

作者核验 2026-10-23；最终内容与测试复核 2026-10-24。元数据保留首次日期，状态 review。

## 环境及真实执行

macOS 14.5 x64、Node.js v22.12.0，仅内置模块。测试通过真实 node:http loopback 连接，端口 0，不依赖另一个已经启动的服务。

- `npm ci --ignore-scripts --prefix examples/node-http-lifecycle` 成功。
- `npm test --prefix examples/node-http-lifecycle`：**7/7** 通过。
- 所有测试设五秒保护，客户端请求设三秒保护；after 调用有期限的 close，未留下监听服务。

## 覆盖

| 场景 | 实际断言 |
| --- | --- |
| 正常与连续输入 | 200、整理后 title、completed=2 |
| 失败分类 | 400 坏 JSON、422 缺失/额外字段、415 类型、413 UTF-8 字节超限；随后正常请求仍成功 |
| 应用预算 | 30ms 预算取消 1000ms 合作式等待，408，active=0，timedOut=1 |
| 客户端取消 | 先占满容量，第二次 503；销毁连接后 cancelled=1、active=0，下一次 200 |
| 正常排空 | 已接纳 30ms 工作在 500ms 宽限内 200，close 幂等且停止监听 |
| 强制期限 | 长工作遇 20ms 关闭期限，连接错误或 503，随后 active=0 |
| 不完整上传 | 声明 100 字节只发一个左花括号；预算后 408，active=0 |

测试毫秒是故障安排，不是服务性能指标。首次应用计时从 request 回调开始，不把头部接收时间或网络交付算进已证明预算。completed 只表示应用调用成功响应；active 是工作数，不是所有连接数。

## 关键范围核对

- 请求读取按字节边到边检查，超限停止保留正文并在关闭连接前给结构化错误。
- 取消经过 AbortSignal 进入 timers/promises；不用 Promise.race 假冒资源取消。
- finally 统一移除监听、清 timer 和归还名额。
- 先 server.close 再按期 closeAllConnections；HTTP/1.1 范围，无升级连接。
- 5 块完整 examples 源路径代码均为文件连续原文，三段 server.mjs 覆盖整个文件；关键帮助函数和调用方同页展示。

## 来源及待验收

核对 [Node 22.12.0 HTTP](https://nodejs.org/download/release/v22.12.0/docs/api/http.html)、[closeAllConnections](https://nodejs.org/download/release/v22.12.0/docs/api/http.html#servercloseallconnections)、[timers 取消](https://nodejs.org/download/release/v22.12.0/docs/api/timers.html#cancelling-timers)、[AbortController](https://nodejs.org/download/release/v22.12.0/docs/api/globals.html#class-abortcontroller)。

lifecycle.svg XML 解析通过；独立内容 TypeScript 检查通过。未进行人工 SIGTERM/Ctrl+C、站点图形渲染和手机检查；应用工厂 close 行为已实测，信号入口仅源码核对。未实现或验证数据库、鉴权、持久化幂等、TLS、代理、WebSocket/HTTP2、跨实例总限流、生产压力和真实移动设备。JS 计时器不保证抢占同步阻塞，最终硬退出需要外部监督。下载及离线整合由主代理完成。

## 主代理独立补验（2026-10-24）

以子进程实际运行 `node main.mjs`，等待监听提示后，通过 127.0.0.1:4313 发出合法 POST，断言 200 和规范化标题；随后只向该测试子进程发送 SIGTERM。实际观察 `draining:SIGTERM`、最终 `completed=1`，进程正常退出（code=0、signal=null），监听随进程释放。外部十秒保护未触发。该补验覆盖真实信号入口；不替代尚未执行的真实终端 Ctrl+C、手机和浏览器验收，也不新增生产负载承诺。
