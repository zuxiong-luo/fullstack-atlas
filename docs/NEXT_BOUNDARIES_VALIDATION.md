# Next.js 专题升级与验证

日期2026-10-23。文章ID与原五个section锚点保持；kind由overview改tutorial、status为review，不虚称完成生产系统。

旧稿缺口：8分钟概览，账户页是伪代码，没有锁定版本/工程、真实读写、明确缓存API、可复现失败或图。现已改写为完整账户页专题：先定义Server/Client、SSR/hydration，再展示两种数据策略、账户隔离、模块与发送边界、写入验证和缓存失效。

交付范围：

- `src/data/articles/legacy/next-server-boundaries.ts`：关键文件全部正文展示，完整类型、调用者、数据源、输入错误和刷新链路，无须跳外站补关键代码。
- `examples/next-server-boundaries/`：Next16.4.2、React/DOM19.3.1、Node22.12.0；锁文件、配置、页面/客户端岛、Route Handlers、完整存储/会话/错误/缓存代码、production HTTP测试及README。
- `public/figures/next-server-boundaries/{boundaries,cache-flow}.svg`：可编辑本地图，区分代码与数据边界、缓存复用与失效。

核验：独立production build、typecheck、8类真实HTTP/客户端包集成均已通过；npm生产依赖审计0（时间点结果）。首次HTML与RSC请求、篡改和过期cookie、双用户隔离、公开缓存命中与写后失效、400/401/403/413/415/503、JSON故障恢复均有断言。Data Cache实际运行，不用mock冒充。本文全部项目代码块从真实文件生成，最终整合继续核对一致。

版本依据与完整验证命令、曾发现修正的问题、实际浏览器范围和限制见示例 `VERIFICATION.md`。16.4.2高于官方2026-10-14公告的16.4.1修复线；没有以“最新版”代替版本。

限制：演示账户可公开切换，非生产认证；JSON单进程锁，非数据库事务；不提供多实例/多区域缓存保证；暂未真实手机设备验收；动态Next项目不能直接在GitHub Pages运行。站点只提供文章/图/源码下载，示例ZIP和离线清单由主任务集成。
