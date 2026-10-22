# Chapter 01 / TypeScript 核验记录

核验日期：2026-10-21。环境：本机 macOS、Node 22.12.0、npm 10.9.0。依赖固定 Fastify 5.12.7、TypeScript 5.7.2、tsx 4.20.6。

| 实际命令 / 操作 | 结果 |
| --- | --- |
| npm ci --ignore-scripts | lockfile 重建依赖成功；安装审计 0 漏洞 |
| npm run build | tsc 通过 |
| npm test | 16 项通过，0 失败（含共享 cases.json 的全部 10 项） |
| npm start + curl /health | 200，`{"status":"ok"}` |
| curl POST /v1/answers，使用 shared/request.json | 200，固定回答、引用 `["guide"]` |

本地假 HTTP 上游验证了真实 fetch 的消息格式、响应解封装、503、坏 JSON/坏 envelope、超过 1 MiB 的响应、重定向拒绝和慢响应体。超时测试不仅检查 504，还观察假上游 response 的 close 事件，确认传输被关闭。测试假服务的监听地址始终是 127.0.0.1，没有调用外部模型。

跨语言审查发现并修复了 JS 正则 `$` 接受行末换行的边界、URL fragment 和配置校验差异；Python 作者已对齐 ECMAScript trim 字符集、JSON 常量处理和 Content-Type。当前手动规则与共享 schema 的主要约束对应；唯一资料 ID 与引用归属由业务层执行。

限制：未运行真实模型；没有性能/费用/语义正确率结论。当前测试覆盖教学契约，不等于全部 HTTP 畸形输入或安全审计。自定义 Provider 必须遵守 signal；无法强制取消忽略信号的任意 Promise，也不能承诺远端停止计费。没有并发限流、持久化、身份鉴别或客户端断开联动。
