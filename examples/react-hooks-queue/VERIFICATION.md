# react-hooks-queue 核验记录

日期 2026-10-22。环境 Darwin x86_64、Node.js 22.12.0。React/React DOM 18.3.1、TypeScript 5.7.2、Vite 6.4.5、esbuild 0.28.2，依赖由 package-lock.json 固定。

## 已执行

- `npm ci --ignore-scripts`：从锁文件安装（只在示例目录）。
- `npm test`：6 项模型测试通过，涵盖环形尾指针顺序、跳过再重放、首跳过之前已有更新、空队列与全量处理、替换值/函数操作、重复跳过。
- `npm run build`：TypeScript 与 Vite 构建通过。
- `npm audit --audit-level=moderate`：0 vulnerabilities。新示例工具链已修正旧版本的开发服务器审计问题；没有修改主站或其它示例。

这些测试检查教学模型，不宣称验证 React 内部实现或浏览器绘制。文章的 `status` 保持 review；桌面/手机图形、实验室真实按钮操作、离线资源清单待主站整合验收。

## 关键主张 → 固定源码 → 验证边界

| 主张 | React v18.3.1 源码 | 本地证据与限制 |
| --- | --- | --- |
| Hook 链与 Update 环不是同一条链 | ReactFiberHooks.old.js 的 Hook/Update 类型、mountWorkInProgressHook、updateWorkInProgressHook（约124–154、635–715行） | 结构图只画关系，不模拟整个 Fiber |
| useState 的函数 action 与值 action 行为不同 | 同文件 basicStateReducer（724–728） | 模型替换值/函数测试；真实按钮最终值待浏览器验收 |
| 普通并发入队先到 interleaved，之后接到 pending | ReactFiberConcurrentUpdates.old.js 的 enqueueConcurrentHookUpdate、finishQueueingConcurrentUpdates（44–111） | 模型刻意不实现并发登记/转移；不可当源码替代 |
| pending 接在 baseQueue 后面 | ReactFiberHooks.old.js updateReducer（778–809） | 模型只演示环形插入，重放用数组提高可读性 |
| 首次跳过前的状态成为 baseState；后续已执行更新保留 NoLane 副本 | 同文件 updateReducer（806–887） | 六项模型测试包含 1→2→22、首跳过前已有操作与重复跳过；不验证根的 Lane 选择 |
| eager bailout 有 current/alternate lanes 和 reducer 前提，相等仍入队但不安排普通根调度 | 同文件 dispatchSetState（2233–2318）及 ConcurrentUpdates 的 eagerly-bailout 函数（92–111） | 真实按钮不能证明组件执行次数；条件结论来自固定源码 |
| useReducer 的 dispatch 不包含上述 useState eager 分支 | ReactFiberHooks.old.js dispatchReducerAction（2194–2231） | 比较源码，不外推到其它版本 |

源码链接：

- https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js
- https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberConcurrentUpdates.old.js

实际读取固定 tag 原始源码核对以上函数。文章近旁引用带行号；函数名用于在代码浏览界面再次定位。

## 实验设计边界

App 的上半部分是 React 18.3.1 的状态 API，下半部分是我们自己写的教学模型。两者没有读取或注入彼此的内部队列。模型不包含 eager state、interleaved 生命周期、Scheduler、异常恢复或 transition 纠缠。禁止拿 trace 当真实 React 调用轨迹。

真实跨优先级更新最终应为 22，中间 2 不保证被浏览器单独绘制。布局 Effect 日志不是 render 次数，也不代表 paint 完成。未测量任何性能收益。

行号已通过下载 raw.githubusercontent.com 固定 tag 源文本并逐行计数核对；未使用网页搜索工具的归一化行号作为 GitHub 锚点。
