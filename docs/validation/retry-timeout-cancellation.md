# retry-timeout-cancellation：作者验证

2026-10-24，review。macOS14.5 x86_64 / Node22.12.0；真实loopback HTTP临时端口，无第三方npm依赖。

## 文件

`src/data/articles/tasks/retry-timeout-cancellation.ts`；`examples/retry-timeout-cancellation/`；`public/figures/retry-timeout-cancellation/budget.svg`；下载 `retry-timeout-cancellation/README.md`。

## 命令与结果

```sh
npm test --prefix examples/retry-timeout-cancellation
npm run check --prefix examples/retry-timeout-cancellation
```

最终9个HTTP子场景+1个纯决策，含父测试11 pass / 0 fail；3块正文源码映射client/server/test逐字一致。

- 503两次后第三次200；400一次；持续503最多3次。
- Retry-After10秒、总预算100ms：一次后TOTAL_BUDGET，不提前重试。
- 总预算触发真实传输取消，本合作式上游active归零；允许终止分类为总预算/次数耗尽，不用毫秒总时长作性能论断。
- 父取消前观察active>0；取消后没有下一次尝试，active0。
- 退避中注入微任务父取消，保留BACKOFF_CANCELLED原原因，调用只增一次；不是快进网络时间。
- unsafe POST在服务端效果提交后丢响应，客户端不重发，RESULT_UNKNOWN/效果1。
- 明确postReplayContract+稳定键+服务端回执，丢响应重发返回原结果，效果只增1；同键换内容409只发一次。
- 5000字节响应超4096限制，非重试错误。

纯决策固定remaining/wallNow/random；网络预算始终真实performance.now+timer。每次timer finally清理，response reader有边界并释放，服务销毁自己的连接。手工内存回执仅覆盖本进程窗口，不冒充持久化幂等。

## 图和资料

budget.svg实际Quick Look渲染完整审查，检查父取消、剩余预算、Retry-After与循环方向；图为逻辑，不画虚构耗时。不是手机或站点验收。

浏览RFC9110幂等与Retry-After、Node22.12 globals/AbortSignal.any、timers promises、HTTP。代码不假设超时等于回滚或任意POST加头即可重放。

## 限制

未测真实数据库取消、代理、多层重试放大、全局重试额度/熔断、连接池、Linux/真机、生产性能。内存回执重启丢失，GET安全仍依赖上游遵守语义。页面、离线包与ZIP等待主代理。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
