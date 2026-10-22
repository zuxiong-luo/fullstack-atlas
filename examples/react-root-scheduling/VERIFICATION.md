# D3 根回调安排核验记录

2026-10-22；Darwin x86_64、Node.js 22.12.0。React/React DOM 18.3.1、TypeScript 5.7.2、Vite 6.4.5、esbuild 0.28.2，依赖锁定。

## 已执行

新示例目录 `npm ci --ignore-scripts` 成功；`npm test` 4/4通过，其中固定原函数对照包含1296条序列、5184步；`npm run build`（tsc + Vite）通过。依赖安装审计为0 vulnerabilities。

正文片段直接从 source-notes 原始文件按1基行号切出，未更改其中语句。SHA256.json保存下载原文件哈希；LICENSE保留React MIT许可。来源均为 `https://raw.githubusercontent.com/facebook/react/v18.3.1/`，未把网页工具归一化行号用于GitHub锚点。

## 主张、证据和覆盖深度

| 主张 | v18.3.1原文件/位置 | 本批证据及限制 |
|---|---|---|
| dispatch普通路径先入队获取根，再安排，随后纠缠 | Hooks.old.js 2309–2314 | 正文真实片段+输入/返回值推导；模型不模拟Hook队列 |
| 源Fiber lanes与祖先childLanes分别传播 | ConcurrentUpdates.old.js 142–183 | 正文片段及结构图；未运行私有Fiber读写实验 |
| markRootUpdated与ensure调用属于根安排 | WorkLoop.old.js 528–650 | 片段及普通分支解释；排除render-phase与Legacy刷新 |
| 无候选清理；同最高Lane复用；act例外 | WorkLoop.old.js 691–750 | 原函数对照；act被固定为关闭 |
| Sync入内部队列，microtask刷新，句柄null | WorkLoop.old.js 754–792；SyncTaskQueue.old.js 23–33 | 测试登记次数及null句柄复用；不执行微任务 |
| 非Sync事件优先级映射与根字段更新 | WorkLoop.old.js 794–819 | 原函数体对照；Scheduler用记录替身 |
| 取消任务不是删除更新或中断JS | Scheduler.js 406–419 | 真实callback置空片段；模型用cancelled标志记录，不模拟堆 |
| 并发入口passive后检查回调身份，重选Lane决定render路径 | WorkLoop.old.js 840–878 | 正文逐段推导；模型未执行render |
| Sync入口无Sync工作时重新安排返回 | WorkLoop.old.js 1233–1242 | 正文片段；模型计数是累计登记而非真实队列执行 |
| 退出前ensure，同句柄才返回continuation | WorkLoop.old.js 953–959 | 真实片段；模型不实现continuation消费 |

## 对照测试如何限定证据

测试提取完整ensureRootIsScheduled原函数体，只移除Flow签名。固定__DEV__=false、root.tag=createRoot对应分支、supportsMicrotasks=true；getNextLanes返回给定最高Lane，markStarved不推进时间，Scheduler/宿主记录调用不运行。比较callbackPriority、callbackNode、任务取消记录、Sync与微任务累计登记。

六个输入0/1/4/16/64/128组成四步序列；它不是穷举完整React根状态。0表示没有选中工作，而非一定没有pending。Default按钮代表选择器已选Default；不否定WIP Transition可能保留的D2分支。

## 尚待整合

文章渲染、源码展开、SVG桌面/手机阅读、实验室加载和草稿隔离、离线资源覆盖由主站整合验收。本记录不以构建成功代替这些结果。没有性能、浏览器绘制时序或生产可用性结论；文章保留review。

## 交叉审校

另一名作者逐字核对15处正文原始节选并复跑4项模型测试，未发现必要事实修正。根据图示建议补充“以下仅在需要重排时继续”，避免把复用后return画成继续入队。
