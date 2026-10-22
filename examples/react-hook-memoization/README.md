# E2：useMemo / useCallback 实际行为对照

真实 React/React DOM **18.3.1**，`createRoot`，无StrictMode。计算组和函数组同时显示，故意错误的依赖已标注，不应复制进业务。

## 运行

Node **22.12.0**、npm **10.9.0**。完整仓库进入 `examples/react-hook-memoization`；ZIP解压后进入 `react-hook-memoization`：

```sh
nvm use
npm ci
npm test
npm run build
npm run dev
```

没有nvm时准备对应Node版本后跳过第一步。TypeScript5.7.2、Vite6.4.5、esbuild0.28.2、jsdom26.1.0固定于lockfile。站内实验室加载相同`App.tsx`。

## 怎样观察

初始query为1，切换按钮在1与6之间变动，它们匹配数量不同。

| 操作 | 正确组 | 故障/对照组 |
| --- | --- | --- |
| 无关更新 | useMemo结果引用保持，正确useCallback保持 | 新options依赖和直接计算返回新对象，inline函数变化 |
| query改6 | 正确筛选与不缓存结果相同 | 空依赖筛选停在1 |
| 点击三个读取按钮 | callback读correct:6；inline读inline:6 | 空依赖函数读stale:1 |
| 换key | Hook重新挂载，引用诊断重新计数 | 故障组暂时捕获6，但下一次query变化仍错误 |

`TASKS`是模块级固定列表；如果真实项目tasks来自变化的props/state，需要把它列入依赖。故障组空依赖会被规范的Hooks lint规则报告，本示例有意保留它们来复现错误。

## 诊断边界

Identity在layout effect比较已提交value引用，再更新专用span；不会在render里写全局调用计数。它只能说明已提交结果身份变化，**不能**统计被放弃的计算、证明节省了多少CPU，或替代Profiler。故意计算负载为60条任务×4000次整数迭代，不代表真实筛选算法成本。

calculate是纯函数，同输入返回内容相同的新结果。去掉正确useMemo直接计算，业务输出仍正确；去掉正确useCallback直接创建函数，点击行为仍正确。优化不得成为正确性的前提。

## 自动验证与源码

测试使用真实React DOM+jsdom+act，覆盖无关更新、query变化、旧闭包、重挂载和纯函数输出。固定源码保存在`source-notes/`，附MIT许可与哈希；所有正文源码记录与快照行段逐字比较。在完整仓库中核对文章TS；ZIP不含文章TS时，只核对随包源码摘录清单。

详细证据和未验证事项见`VERIFICATION.md`。浏览器实际交互、小屏图形与性能测量由集成验收另行记录。
