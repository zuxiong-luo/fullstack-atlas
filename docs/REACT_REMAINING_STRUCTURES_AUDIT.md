# React 结构专题补充审校

核验日期：2026-10-23。依据 ARTICLE_WRITING_GUIDE.md，尤其第13、14节。此记录覆盖三个已有文章，不替代全站发布验收。

| 文章 | 原先不满足新标准之处 | 本轮修订 |
| --- | --- | --- |
| react-fiber-structure | 字段/创建入口有引用但缺正文实现；身份实验缺 Row、控制状态和操作上下文；删除分支只有出处；普通更新描述与字段关系较松 | 元素创建与 Hook 真实类型置入正文；加入 F1/F2 输入分支带读；展示 deleteChild/deleteRemainingChildren；完整 App.tsx 与关键身份反例、解析检查；保留14个节ID |
| react-double-buffer | 虽已有较多源码，模型的创建、完成、放弃关键实现仍需下载；开头先讲编辑场景；多处连续否定遮住普通轮换 | 定义 current/work-in-progress 与根入口；逐字段表推演第二轮；完整模型核心及三轮调用直接展示；bailout 带入 A→B 输入和兄弟重建；保留8个节ID |
| react-work-loop-commit | 故障开场，工作循环和提交依据几乎全为链接；Effect 只有零散片段，缺可阅读完整组件 | 先定义计算/提交/绘制；连续原码展示 performUnitOfWork、complete 普通分支与尾部、同步/并发循环、提交顺序、布局清理、passive 同步刷新；完整 App 与0→1推演；保留9个节ID |

## 核验结果

- 阅读并核对原文、实际示例与已有 SVG 替代说明；图形源文件未修改。结构图对应普通树关系，提交图未把 paint 固定放在 passive 前后。
- 本轮正文31个带文件名/行号的源码范围，用 esbuild 读取文章后与 `public/sources/react-v18.3.1/` 中对应范围逐字比较（忽略片段首尾空白），全部一致。片段明确标记连续范围和省略的异常路径；不是独立可执行源码。
- 从官方 `raw.githubusercontent.com/facebook/react/v18.3.1/` 重新获取 ReactFiber、ReactFiberWorkLoop、ReactChildFiber、ReactFiberHooks、ReactFiberCommitWork，与仓库副本逐字相同。版权及MIT归属在新增片段注明，站内完整许可保持不变。
- 实际运行 Node.js 22环境下三个已有项目的 `npm test` 与 `npm run build`：structure 4项测试、double-buffer 3项、work-loop 1项，全部通过，三个 TypeScript/Vite 构建通过。本轮未改变示例行为。
- structure测试验证稳定ID、下标、父级key、不同函数类型；double-buffer测试验证分配/轮换/引用/放弃；work-loop测试验证真实React DOM的稳定ref、更新、替换、清理关系。
- 完整 App.tsx 与模型核心直接从对应示例提取；读者遮住实验室、下载与外站链接仍能阅读关键输入、处理、输出和反例。

## 边界与待集成检查

状态仍为 review。jsdom 不绘制；模型没有插桩真实React Fiber；测试不证明调度中断或性能收益。未新增或伪造浏览器测量。

本代理未执行整站路由、评论、离线下载、手机视觉及线上发布验收；这些由主代理集成检查。尚需另一位审稿人检查正文叙述与具体代码的对应关系。
