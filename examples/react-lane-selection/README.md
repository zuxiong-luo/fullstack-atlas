# React 18.3.1 Lane 选择实验

这是根状态选择器的**教学子集**，不是 React 调度器，也不是性能基准。它接收六类 Lane 的状态快照，显示选中集合、决策步骤、回调类别和 render 路径。它不读写 React 内部 root。

## 运行

环境：Node **22.12.0**，npm **10.9.0**；React / React DOM **18.3.1**、TypeScript **5.7.2**、Vite **6.4.5**、esbuild **0.28.2** 固定在 package / lockfile 中。

完整仓库中先进入 `examples/react-lane-selection`。下载 ZIP 时解压后进入 `react-lane-selection`。在该目录运行：

```sh
nvm use
npm ci
npm test
npm run build
npm run dev
```

不用 nvm 时，手动准备对应 Node 版本后跳过第一条。打开 Vite 在终端打印的本机地址。站内实验室加载同一份 `App.tsx`，只依赖 React，无需浏览器安装 Node 依赖。

## 先手算，再点开关

| 预设 | 预期所选集合 | 核心分支 |
| --- | --- | --- |
| 初始：输入和列表 | Sync | 最高类别 |
| 全部挂起也不选 Idle | 空 | 仍有非 idle，暂不进入 idle 分支 |
| Default 不打断 Transition | A | WIP 保留特例，要求 WIP 未挂起 |
| 连续事件带上 Default | Continuous + Default | 连续类别打断 A，然后合入 pending Default |
| 纠缠扩展候选 | A + B | 初选 B，预建立关系带回 A |
| WIP 提前返回 | A | 提前返回发生在纠缠扩展之前 |
| 过期改变 render 路径 | A | mask 仍是 64，改走同步 render |

选择“全部挂起也不选 Idle”后，勾 A 的 pinged，结果变为 A；去掉 A 的 pending，才只剩 Idle。选择“过期改变 render 路径”后，去掉 expired，集合不变但路径改变。默认并发允许让出不保证实际发生让出。

## 文件怎样对应

- `App.tsx`：六个 Lane 的位值、纯函数 `select`、预设和交互界面。只有 React 外部 import，可直接用于站内实验室。
- `main.tsx` / `index.html`：独立页面入口。
- `test.mjs`：确定性案例、位运算、执行路径、固定源码选择分支对照、SSR 初始结构。
- `source-notes/ReactFiberLane.old.js`：来自官方 `v18.3.1` tag 的完整原文件快照，保留版权声明。
- `source-notes/LICENSE.react`：React MIT 许可。
- `source-notes/SHA256.txt`：快照哈希，避免测试源悄悄被修改。
- `VERIFICATION.md`：实际执行结果、源码证据表和未验证边界。

## 对照测试证明什么

测试使用 Node `vm` 执行两段固定原函数体：`getHighestPriorityLanes` 与 `getNextLanes`。仅去掉 Flow 函数签名；提供文件中的位值及必要辅助运算，固定 `allowConcurrentByDefault=false`。

每个教学 Lane 枚举四种可用性：不存在、pending未挂起、挂起未ping、挂起且ping。6个Lane得到4096个快照，再组合8个WIP候选及2种纠缠开关，共65536次比较（部分WIP候选重复）。这验证本文声明的子集在选择结果上对应原函数，而不是只用手写期望检查手写代码。

对照没有模拟 Fiber、更新入队、Lane 分配、commit、Suspense UI、Hydration、Retry、Offscreen、过期时间推进。纠缠只提供预先建立的 A/B 对称关系，不实现完整传递维护。快照编辑器不是事件模拟器，某些组合未必来自真实组件生命周期。原文件测试只针对选择函数；执行路径说明由固定源码与独立断言核验，没有运行 React 内部 render 过程。

`App.tsx` 的 `select` 没有计时或抢占；编辑 expired 是直接编辑状态，不是等待真实5000ms。不要把界面结果当作应用性能结论。手机表格横向滚动，图形由站点文章单独提供。

## 参考

- [固定 Lane 源码](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js)
- [固定根工作循环](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js)
- [固定事件优先级映射](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactEventPriorities.old.js)
- [固定 feature flags](https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js)
