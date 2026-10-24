# HTTP重试、总预算与取消

文章 `retry-timeout-cancellation` 的真实loopback HTTP实验。已验证macOS14.5 x86_64、Node22.12.0；无npm第三方依赖、Redis或外部服务。

```sh
cd examples/retry-timeout-cancellation
nvm use
npm ci
npm test
npm run check
```

服务器listen(0)，不会占用站点4173。仅在本机创建教学请求，无公网访问和付费调用。

## 实现

- `client.mjs`：requestWithRetry、Retry-After、纯退避决策、响应上限和取消清理。
- `server.mjs`：真实503/429/400、慢请求、丢响应和回执契约。
- `test.mjs`：纯决策与真实网络验收。
- verify脚本：正文源码连续原文核验；ZIP无文章时明确跳过。

默认最多3尝试、总预算800ms、单次200ms、响应最多4096字节。次数1..5、总预算1..10000ms有输入范围。固定10/20/40/80/100ms教学退避上限；随机打散并尊重Retry-After下界，不能等则结束。没有生产调优收益声明。

GET/HEAD按契约允许重试；POST必须显式 `postReplayContract:true` **且服务端确实实现对应回执**，再提供稳定idempotencyKey。仅放一个请求头不创造幂等。无契约POST最多发送一次。在父信号未取消且总预算未耗尽的网络故障/单次超时分支返回RESULT_UNKNOWN；总预算耗尽优先返回TOTAL_BUDGET，父取消保留原reason。这些是客户端终止原因，不是服务器效果分类：请求可能已发送后，TOTAL_BUDGET和用户取消也可能伴随已经提交的效果，上层须另记业务结果未知并查询同一意图，不能据错误名自动再写。

时间：网络预算用真实performance.now和计时器。仅纯delayFor/retryAfter测试传入固定remaining/wallNow/random，不快进网络时间。父取消在网络及退避阶段都保留原reason，无下一轮请求。

## 预期

9个真实HTTP子场景 + 1个纯决策测试，含父测试 **11 pass / 0 fail**：

1. 503两次后第三次200。
2. 400只发一次；持续503最多3次。
3. Retry-After10秒而预算100ms，停止，不缩短要求硬重试。
4. 总预算取消慢请求，合作式上游active归零。
5. 父取消停止尝试，active归零。
6. 退避时取消，BACKOFF_CANCELLED原因保留，上游调用只增一次。
7. POST已生效但响应丢失，无契约只发一次/RESULT_UNKNOWN，效果1。
8. 服务端回执+稳定键重放丢响应，2次得到原结果/效果只增1；换内容409且不重试。
9. 5000字节响应触发4096限制，不重试。

计时器不是抢占式硬实时；测试不拿总duration当延迟性能结论。传输取消不证明上游已回滚。

## 限制

safe回执仅在同一进程Map，重启会丢，不是生产持久化幂等。未验证数据库取消、HTTP代理、多级重试/熔断、连接池/全局限流或生产负载。错误分类对当前Node fetch，升级库需重测。结束销毁自己socket、停止服务，客户端timer/reader清理；系统强杀不保证finally。

参考：[RFC9110](https://www.rfc-editor.org/rfc/rfc9110.html)、[Node22 AbortController](https://nodejs.org/download/release/v22.12.0/docs/api/globals.html#class-abortcontroller)、[可取消定时等待](https://nodejs.org/download/release/v22.12.0/docs/api/timers.html#timers-promises-api)。
