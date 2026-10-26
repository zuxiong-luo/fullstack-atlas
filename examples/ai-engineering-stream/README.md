# 流式 AI 交互：Node.js + React

固定环境：Node.js 22.12.0、React / ReactDOM 18.3.1、esbuild 0.25.12。依赖由 package-lock.json 锁定。生产构建，不启动开发代理。

```sh
npm ci
npm test
npm run build
npm start
```

打开 http://127.0.0.1:4190 。端口固定，被占用时启动报错，不自动漂移。默认使用确定性文本生成器，每 400ms 发一个文本片段，总共 5 段；这个间隔是观察交互的人工设置，不是模型性能数据。

## 操作

1. 点开始，POST /runs 创建一个任务，GET /runs/:id/events 订阅事件。
2. 运行中点暂停接收：仅断开 EventSource，后台继续。点继续接收会带 after=最后事件 ID 重放缺失片段。
3. 取消任务：POST /runs/:id/cancel，服务端 AbortController 停止本地生成器，并发送 cancelled 终态。取消已经完成的任务不撤销结果。
4. 一次完整输出 7 个事件：started、5 个 delta、completed。每个任务 ID 独立从 1 递增；文本片段不是 tokenizer 的 token。

HTTP 实验：

```sh
curl -s -H 'Content-Type: application/json' -d '{"question":"账号没有权限怎么办？"}' http://127.0.0.1:4190/runs
# 把返回的 id 替换到下面路径
curl -N http://127.0.0.1:4190/runs/任务ID/events
curl -N -H 'Last-Event-ID: 2' http://127.0.0.1:4190/runs/任务ID/events
```

测试使用真实回环 HTTP 和 SSE，验证事件顺序、游标续接、取消后没有 delta、容量拒绝、Origin 与输入边界、前端去重/缺口检测和 JSON 换行编码。

## 容量与交付边界

最多 4 个同时生成的任务、16 个保留任务，每个任务最多 4 个订阅连接。终态任务创建 10 分钟后可在下次创建时清理；任务注册表达到 16 个且尚不能清理时返回 429。HTTP 输入最多 8KiB；问题最多 2000 个 JS 字符。事件数组只包含固定 7 条演示事件。真实模型必须增加累计字节/事件上限和运行预算，不能直接套用固定演示生成器的容量结论。

每个连接最长订阅 25 秒，每 10 秒有心跳；慢消费者会等待 drain，断开后取消订阅等待。断开订阅不取消任务。EventSource 自动重连使用 Last-Event-ID，手动新建连接使用 after；服务端优先 Last-Event-ID。客户端收到终态主动 close。

事件只存于内存，服务重启后无法恢复，未知/过期 ID 返回 404。生产中需要持久事件日志、身份与任务所有权校验、共享存储、限流和代理配置；Origin 检查不等于认证。原生 EventSource 不能设置任意 Authorization 请求头，正式站点可用同源会话 Cookie 或自行实现 fetch 流式读取；不要把长期凭证放 URL。

本例为可信本机开发服务，只绑定 127.0.0.1。未接入真实模型、付费供应商、生产代理或集群，未进行高并发与手机真机验证。网站 GitHub Pages 仅提供文章和源码下载，不运行本服务。
