# Lane 选择专题核验

核验日期：2026-10-22。实际环境：macOS、Node 22.12.0、npm 10.9.0；React / React DOM 18.3.1、TypeScript 5.7.2、Vite 6.4.5、esbuild 0.28.2。

## 实际执行

| 命令 | 结果 |
| --- | --- |
| npm ci --ignore-scripts | 依赖从lockfile重建成功，安装审计0漏洞 |
| npm test | 6项通过、0失败；其中1项包含65536次源码子集结果对照 |
| npm run build | TypeScript通过；Vite生产构建成功 |

构建和SSR结构测试不代表完成浏览器交互、手机排版或SVG视觉验收。此处没有性能采样，没有实际毫秒数、帧率或收益结论。根站点整合时需确认7个预设、复选框结果、图形与小屏横向滚动。

## 事实证据表

以下行号按下载的raw文件实际行号核对，均固定官方 `facebook/react` 的 `v18.3.1` tag。

| 主张 | 固定源码与位置 | 实验/检查 |
| --- | --- | --- |
| Lane为位集合，Transition按组取当前候选 | ReactFiberLane.old.js:30–185 | 位运算测试、A/B候选 |
| 非idle存在时不进入idle；先unblocked后pinged | ReactFiberLane.old.js:187–228 | 全挂起、pinged D与未挂起A反例 |
| 未挂起WIP的比较与Default例外 | ReactFiberLane.old.js:230–254 | A进行中、D/C候选对照 |
| 连续事件合Default在WIP比较之后 | ReactFiberLane.old.js:256–267 | C+D案例 |
| 纠缠扩展在提前return之后，关系预建立 | ReactFiberLane.old.js:269–306、666–700 | WIP提前返回与纠缠扩展两个案例 |
| suspended/pinged/root状态清理 | ReactFiberLane.old.js:574–664 | 文本核对；模型不模拟生命周期 |
| expired不在getNextLanes优先分支中 | ReactFiberLane.old.js:187–306 | 改expired，结果mask相同 |
| 过期时间按类别处理、挂起清空时间 | ReactFiberLane.old.js:327–431、605–620 | 源码核对；模型不推进时钟 |
| 已选集合expired影响render路径 | ReactFiberWorkLoop.old.js:866–878 | expired前后路径字符串断言 |
| Sync走内部队列，其他经事件优先级映射Scheduler | ReactFiberWorkLoop.old.js:717–821；ReactEventPriorities.old.js:70–82 | 源码核对及界面说明 |
| 工作循环在单位间检查shouldYield | ReactFiberWorkLoop.old.js:1824–1829 | 源码核对；不声称固定5ms切片 |
| 本文固定稳定默认flags | shared/ReactFeatureFlags.js:57、152 | disableSchedulerTimeoutInWorkLoop=false、allowConcurrentByDefault=false |

源码链接前缀：`https://github.com/facebook/react/blob/v18.3.1/packages/`，Lane / WorkLoop / EventPriorities 位于 `react-reconciler/src/`。

## 原函数对照边界

保存的 `source-notes/ReactFiberLane.old.js` 是完整源文件快照，SHA-256记录于旁边文件；同时附 React MIT LICENSE。测试**没有导入完整React内部运行时**：仅抽出两个选择函数，移除Flow签名，在Node vm中提供所需常量与辅助函数。常量取自快照；`getHighestPriorityLane = lanes & -lanes`、`pickArbitraryLaneIndex = 31 - Math.clz32(lanes)` 对应原辅助逻辑。功能flag固定false，因短路不读取并发默认mode位。

测试范围是6个Lane的4种可用性状态（4096快照），8个WIP候选、2种已建立的A/B纠缠配置，共65536次比较（含重复WIP）。只对选择结果比较；不验证完整31Lane分支、传递纠缠维护、Lane分配、渲染更新队列、Suspense状态机、实际Scheduler行为。模型中的expired/didTimeout直接编辑，不声称真实经过过期时间或宿主任务超时。

交互模型只约束基本集合包含关系，快照不保证来自某段真实应用事件。禁止据此宣称React生产性能、调度公平性或“所有更新都能被及时抢占”。
