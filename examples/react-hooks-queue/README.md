# Hooks 更新队列：从 1 到 2，再到 22

React / React DOM **18.3.1**、TypeScript 5.7.2、Node.js 22；npm 使用 `package-lock.json` 安装。

```sh
cd examples/react-hooks-queue
npm ci
npm test
npm run build
npm run dev
```

打开终端的本机地址。开发服务只监听 127.0.0.1，不用于公网部署。

`App.tsx` 同时包含真实 React 实验与教学队列模型，仅 import React，能进入本站实验室；`main.tsx` 使用 createRoot，无 StrictMode。教学模型导出 append/entries/rebase，测试只针对模型，不能冒充 React 源码测试。

## 操作与预期

每组真实实验先点击“重置为 1”，等 pending 结束：

1. 值更新加一三次：2。
2. 函数更新加一三次：4。
3. 延后加十、紧急乘二：最终 22。中间的 2 不保证被浏览器绘制；控制台布局 Effect 观察点不是 render 次数。
4. 相同值更新：可能没有可见变化。没有新日志不能证明组件未执行；eager bailout 条件需看固定源码。

模型第一次“下一轮”：state=2，baseState=1，保留 +10/lane2 和 ×2/lane0。第二次：state=22，baseState=22，队列空。模型和真实实验独立重置。

## 模型边界

1/2 是教学优先级位，0 表示重放时不可跳过。模型用环验证入队顺序，然后用数组表现保留队列；没有实现 interleaved 生命周期、真实 Lane 选择、eager state、Fiber、异常恢复或调度器。禁止把模型 trace 当作 React 内部观测。

把重放起点错误换成显示值会得到错误结果；删掉 NoLane 副本则得到 11。测试包括首次跳过前已有操作与重复跳过，避免只验证一个示范答案。

实际核验见 `VERIFICATION.md`。浏览器操作与 SVG 可读性需站点整合验收；没有性能结论。首次安装 npm 依赖需要联网，缓存网页不等于缓存本机依赖环境。
