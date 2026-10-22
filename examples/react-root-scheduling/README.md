# D3 · 根回调安排模型

固定 React / React DOM 18.3.1、Node 22.12.0、TypeScript 5.7.2、Vite 6.4.5、esbuild 0.28.2。模型接收**已经选定的最高 Lane**，不模拟 Lane 分配/选择、Fiber 工作循环或真实 Scheduler。

从仓库根目录：

```sh
cd examples/react-root-scheduling
nvm use
npm ci
npm test
npm run build
npm run dev
```

不用 nvm 时先准备对应 Node，跳过 `nvm use`。ZIP 解压后进入该示例目录即可。安装依赖需要网络。开发服务器只绑定回环地址；打开终端打印地址。`App.tsx` 仅 import React，可直接在本站实验室运行。

## 逐步观察

顺序：Transition → Transition → Default → Sync → Sync → 无工作。

1. 创建 Normal #1，callbackPriority=64。
2. 同 Lane 复用 #1。
3. Lane 改为16，取消 #1，创建 Normal #2；同为Normal不代表根优先级相同。
4. 取消 #2；Sync 内部队列加一，登记 flush 微任务，callbackNode=null、callbackPriority=1。
5. Sync优先级相同，复用；内部队列不重复加一。
6. 根字段清空；已经登记的Sync队列项和微任务仍存在，模型没有执行它们。

界面清楚展示两个队列计数是累计登记，不是实时执行。模型不运行定时器，不读取React内部对象，不提供性能数据。真实入口会再次检查根状态；不要把这里的无工作按钮当作从真实React删除待处理更新。

## 文件

- `App.tsx`：纯 `ensure` 函数、根状态、模型UI。
- `test.mjs`：反例以及固定原函数对照。
- `source-notes/`：v18.3.1原文件、MIT许可、SHA256，供逐行核验。
- `main.tsx`：createRoot入口，无StrictMode；页面运行React用于显示模型，不代表模型就是框架内部实现。

## 对照测试边界

从原始 WorkLoop 文件取 `ensureRootIsScheduled`，仅移除Flow签名；固定createRoot、非act、支持微任务。Lane选择直接返回输入，Scheduler/宿主为记录替身，安排的函数不执行。

枚举6种Lane（0、1、4、16、64、128）的4步序列，共1296条、5184步。比较根优先级、句柄、取消记录、Sync入队数与微任务登记。它证明声明条件下的安排决策，不证明调度耗时、真实渲染、Suspense、错误恢复、WIP或过期选择。

把复用条件错改为Scheduler类别相同，会漏掉Default替换Transition；只看node非null，会让Sync重复入队。这是两条主要失败反例。

实际结果与逐项源码证据见 `VERIFICATION.md`。源码快照保留许可证；本例不是可用于生产的调度器。
