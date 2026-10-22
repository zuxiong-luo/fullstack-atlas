# 工作循环与提交：事实核验记录

核验日期：2026-10-22。固定 facebook/react 的 v18.3.1 tag，未将 .new 分支或当前官网新版行为套到 React 18。本文没有复制源码片段；正文代码来自本例，结构图为教学简化。

| 事实 | 官方固定源码 | 实验能验证什么 / 不能验证什么 |
|---|---|---|
| 开源配置选择 old reconciler | [ReactFeatureFlags.js L74](https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js#L74) | 版本依赖固定18.3.1；运行测试不证明打包开关本身 |
| 同步循环不询问 shouldYield，并发循环在单元之间询问 | [workLoopSync L1736](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1736)、[workLoopConcurrent L1824](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1824) | 本实验不制造或统计中断，结论来自固定源码 |
| concurrent 入口仍会按条件选择同步 render | [performConcurrentWorkOnRoot L824](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L824) | 不由函数名字推断每次更新切片 |
| begin 返回下一节点；complete 可沿父级连续处理 | [performUnitOfWork L1831 / completeUnitOfWork L1859](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1831) | 图省略HostRoot/文本/bailout等；无冒充真实实现的教学调度器 |
| render可以创建未接入宿主树的实例，完成阶段汇集标记 | [createInstance L1010](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCompleteWork.old.js#L1010)、[bubbleProperties L642](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCompleteWork.old.js#L642) | 不声称render阶段绝不创建DOM对象 |
| 提交入口先刷新已有passive工作 | [commitRootImpl L1985](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1985) | 日志归属要结合捕获值，不仅看相邻位置 |
| mutation后切换current，然后layout | [L2150-L2178](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2150) | 测试layout setup读取新DOM；不能证明已paint |
| 函数组件mutation先遍历孩子，再清理layout Effect | [commitMutationEffectsOnFiber L2083](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L2083) | cleanup捕获旧value；读取DOM可能已更新，不能当作before-mutation通用快照 |
| ref绑定由专门提交路径处理 | [commitAttachRef L1232](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L1232) | 测试稳定ref在数值更新时不重绑，换key时解绑再绑定；不推广为任意树全序 |
| passive刷新先unmount工作再mount工作 | [flushPassiveEffectsImpl L2408](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2408) | act验证同Effect旧cleanup先于新setup；act不模拟真实paint |
| SyncLane且非LegacyRoot时会同步刷新passive | [commitRootImpl L2292](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2292) | 不声称useEffect总在paint后；rAF同样不是完成paint的证据 |

## 已运行

macOS x86_64，Node.js 22.12.0。`npm install --ignore-scripts` 生成锁文件，`npm test` 1/1场景通过，包含DOM更新、稳定ref、cleanup/setup、换key、卸载断言；`npm run build`（tsc与vite）通过。锁文件安装复验由 `npm ci --ignore-scripts && npm test && npm run build` 执行。

## 未由这些测试覆盖

真实浏览器paint、丢帧、并发中断、StrictMode额外开发检查、所有树形结构/Portal/错误边界的生命周期全序；手机图形阅读需整合后视觉检查。40ms忙等待只用于制造反例，未发布性能测量结论。

工具链复验：2026-10-22 将 Vite 固定为 6.4.5、esbuild 固定为 0.28.2，React 保持 18.3.1。更新锁文件后执行 npm ci --ignore-scripts、npm test、npm run build，全部通过；安装审计报告 0 vulnerabilities。更新阶段额外断言四种 cleanup/setup 均存在，且布局 cleanup 实际读到“数值 1”，避免缺失日志的 indexOf=-1 导致假通过。
