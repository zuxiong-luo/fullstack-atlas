# Agent 第一章：TypeScript 版本

你给服务一段问题和一组资料，服务向模型请求 JSON，再检查结果能不能进入业务。这里先把调用边界做扎实：**HTTP 成功、JSON 合法、引用确实存在，是三个不同的判断**。引用存在依然不能证明答案受资料支持。

本目录对应 `../shared/chapter-01.json` 的 `chapter-01-v1`。共享接口见 `../shared/CONTRACT.md`，约束说明见 `../shared/schema.json`。这一章没有工具执行、向量检索、数据库或自动重试；默认模型是确定性模拟器。

## 从空环境运行

需要 Node.js **22.12.0**（`.nvmrc`），npm **10.9.0**。Fastify **5.12.7**、TypeScript **5.7.2** 和 tsx **4.20.6** 均固定版本，间接依赖在 `package-lock.json` 中。

从仓库根目录执行：

```sh
cd examples/agent-workshop/typescript
nvm use
npm ci
npm run build
npm test
npm start
```

没有 nvm 时，安装对应 Node 22 环境后跳过 `nvm use`。启动提示应为 `Agent chapter 01 listening on http://127.0.0.1:3001`。另开一个终端，进入同一目录：

```sh
curl -sS http://127.0.0.1:3001/health
curl -sS http://127.0.0.1:3001/v1/answers \
  -H 'Content-Type: application/json' \
  --data-binary @../shared/request.json
```

健康检查返回 `{"status":"ok"}`。默认问题返回：

```json
{"ok":true,"result":{"answer":"示例回答：请查看所附资料。","citations":["guide"]}}
```

这句回答是写死的测试输出，不是生成质量证据。你可以修改问题内容，发现返回仍一样；模拟器的用途是让两套语言实现可靠地重复边界用例。

## 看一次失败

按 Ctrl+C 停服务，再启动一个故意给出不存在引用的模拟模型：

```sh
MOCK_SCENARIO=unsupported_citation npm start
```

重新运行同一条 curl，用 `-i` 可看到 HTTP 502 和 `UNSUPPORTED_CITATION`。服务已经拿到合法 JSON，但不能把未知来源交给业务。

| 服务端 MOCK_SCENARIO | 预期状态 / code | 故障位置 |
| --- | --- | --- |
| success | 200 | 通过已定义的校验 |
| invalid_json | 502 MODEL_FORMAT_ERROR | 不能解析为 JSON |
| invalid_schema | 502 MODEL_SCHEMA_ERROR | JSON 字段或类型不满足约定 |
| unsupported_citation | 502 UNSUPPORTED_CITATION | 引用 ID 不在本次资料集合中 |
| timeout | 504 UPSTREAM_TIMEOUT | 超过总调用期限，默认 3000 ms |
| upstream_error | 502 UPSTREAM_ERROR | 模拟上游不可用 |

客户端不能在 JSON 中选择场景或提供商，加入 `scenario` 会得到 400。恢复正常时直接 `npm start`，不要保留故障环境变量。

## 顺着文件读实现

- `src/contracts.ts`：手动校验外部 `unknown`，拒绝多余字段和隐式类型转换。对 question/text/answer 去掉首尾空白，再按 Unicode code point 计数；资料 ID 唯一性和引用归属是业务校验，光靠字段 Schema 不够。
- `src/providers.ts`：统一 `Provider(input, signal): Promise<string>`。模拟器和 HTTP 提供商都返回原始模型文本；不知道 Fastify 的 reply，也不自己定义成功响应。
- `src/app.ts`：`buildApp({provider, timeoutMs})` 允许测试注入提供商。先校验输入，再建立 deadline，调用提供商，最后校验结果。HTTP 上游的超时不仅结束等待，也会触发 `AbortController` 中止请求和响应流。
- `src/server.ts`：只负责配置和监听本地端口；用 `PORT=3002 npm start` 改端口。
- `test/service.test.ts`：读取两种语言共用的 `../shared/cases.json`，另外启动本地假 HTTP 上游，验证线上的协议形状。

为何不用框架默认的字段转换？本例要把 `123` 和 `"123"` 明确分开，让两种语言接收同样的输入。`schema.json` 是可阅读的共同契约；实现中写出归一化和业务检查，契约用例验证可观察结果。新增字段时需要同时更新共享契约、两套实现和用例。

## 切换真实 HTTP 适配器

只有你主动设置 `MODEL_PROVIDER=http` 才会联网调用。所有配置必须放在服务端终端或部署系统的环境变量中，不能写进浏览器代码、公开文章或提交到 Git。

```sh
export MODEL_PROVIDER=http
export MODEL_API_URL='https://your-provider.example/v1/chat/completions'
export MODEL_NAME='your-model-name'
export MODEL_TIMEOUT_MS=3000
# 按你的终端密钥管理方式设置 MODEL_API_KEY，不把真实值复制进仓库。
npm start
```

`MODEL_API_KEY` 必须存在且非空。示例 URL 是占位地址，请换成你的服务。适配器发出 `messages` + `response_format: {type: "json_object"}`，读取 `choices[0].message.content`。这是一种 Chat Completions HTTP 约定，不代表任意模型服务都兼容。若提供商不接受 `response_format`，需要按照它的接口明确修改适配器并增加协议测试。

HTTP URL 禁止内嵌用户名密码，不跟随重定向。默认 3 秒是**连接、响应头和读完整个响应体的共同期限**，可以设置为 50～60000 ms。请求体上限 256 KiB；上游响应按实际读取字节计数，上限 1 MiB，超过后关闭流并返回 `UPSTREAM_ERROR`。不依赖 Content-Length，因此也覆盖分块传输。没有自动重试，避免把失败的非确定性调用直接复制成额外费用。

`Promise.race` 不能强制停止一个忽略 signal 的自定义函数。内置 HTTP 和 mock 适配器会配合取消；以后接入新的 SDK 时，要检查取消是否真正传到网络层。中止本地请求也不能保证远端已经停止计算或计费。未提供全局并发限制、鉴权、限流或客户端断开联动，服务仅绑定 localhost，不应直接作为公网服务部署。

## 实际验证与限制

2026-10-21，在 macOS、Node 22.12.0、npm 10.9.0 上运行 `npm ci`、`npm run build`、`npm test`。测试结果和本地 HTTP smoke 记录见 `VERIFICATION.md`。

测试不需要密钥：10 个共享契约用例检查状态码和结果/错误类别；额外覆盖 Unicode 长度、额外字段、坏 JSON、请求大小、上游封装、响应大小、HTTP 错误、重定向及超时后的连接关闭。没有运行真实模型，没有测量答案质量、费用或生产性能。

参考实现依据：[Fastify Server / bodyLimit](https://fastify.dev/docs/latest/Reference/Server/#bodylimit)、[Fastify Testing](https://fastify.dev/docs/latest/Guides/Testing/)、[Node 22 AbortController](https://nodejs.org/docs/latest-v22.x/api/globals.html#class-abortcontroller)。具体可复现依赖以 lockfile 为准。
