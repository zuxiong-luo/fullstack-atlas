# node-execution-model 核验记录

作者核验：2026-10-23；增补异步错误用例及最终复核：2026-10-24。文章元数据保留首次核验日期 2026-10-23，状态 review。

## 运行环境与结果

- macOS 14.5 x64，Node.js v22.12.0，npm 锁文件，无第三方依赖。
- `npm ci --ignore-scripts --prefix examples/node-execution-model` 成功。
- `npm test --prefix examples/node-execution-model`：**8/8** 通过。
- `node examples/node-execution-model/main.mjs` 输出 cpu:start、cpu:end:49995000、caller:promise、caller:awaited、file:notes、turn:resumed。
- 未测量耗时收益或吞吐量；测试 duration 只作为测试运行信息。

## 用例和正文对应

1. async 内同步循环在调用者拿到 Promise 前完成。
2. CJS/ESM 顶层顺序分别为 sync,nextTick,promise,microtask 与 sync,promise,microtask,nextTick。
3. 文件读取回调内注册的 immediate 先于该次新建 timer；没有测试或宣称顶层绝对次序。
4. pending Promise 单独不保活；unref timer 单独不保活，均真实子进程退出，外部三秒时限。
5. 分块结果与输入限额，块间 AbortSignal 取消。
6. async 抛错通过 Promise 拒绝传播，await 捕获；实际子进程输出 caller continued / caught SyntaxError。

## 来源核对

- [Node 22.12.0 process.nextTick](https://nodejs.org/download/release/v22.12.0/docs/api/process.html#processnexttickcallback-args)：CJS/ESM 上下文与检查点。
- [Node 官方事件循环](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)：阶段、I/O 回调和版本差异。
- [Node 官方阻塞说明](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)：事件循环及工作池的职责区别。
- [Node 22.12.0 timers](https://nodejs.org/download/release/v22.12.0/docs/api/timers.html)：unref 与可取消 promises 计时器。

## 源码、图形与限制

5 块带完整 examples 路径的正文代码均逐字检查为对应源文件连续原文。runtime.svg 已按审稿意见补充注册/回调、交付/就绪、排队/完成方向；checkpoints.svg 用并列面板表达不同入口，去掉误导性的顺序箭头。两图 XML 解析通过。

文章与索引的独立 TypeScript 检查通过。尚未做站点实际渲染、桌面/手机人工浏览器与 SVG 放大检查，不能把 XML 有效当作视觉验收。无 Windows/Linux、多版本 Node、Worker 池、原生手机或生产负载测试。发布与离线资源整合由主代理执行。
