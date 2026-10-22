# Fiber结构专题 · 核验记录

2026-10-22。React / React DOM 18.3.1；Node22.12.0，macOS x86_64。源码固定tag，不使用main分支或React19行为推导。

| 结论 | 固定源码依据 | 能证明什么 / 限制 |
|---|---|---|
| Fiber有身份、树连接、状态和工作字段 | ReactFiber.old.js L118-L157 | 字段存在与初始含义；不保证每个Fiber都有DOM |
| alternate按需创建并可复用 | ReactFiber.old.js L249-L330 | 不是每次递归深拷贝，不是挂载起每个节点都有两份 |
| child/state/queue初始引用沿用，dependencies单独克隆 | 同文件L306-L324 | 描述createWorkInProgress起始处理；后续协调会继续改变结构 |
| Hook链与每个状态Hook的queue不同 | ReactFiberHooks.old.js L132-L194 | 函数组件Fiber.updateQueue还有Effect等信息，不等于state queue |
| 同父级协调需结合key与兼容类型 | ReactChildFiber.old.js L1137-L1219 | 限普通函数组件；lazy、Fragment、热更新另有分支 |
| 未显式key时数组位置参与匹配 | ReactChildFiber.old.js L307-L325、L632-L665 | 不意味着全站相同key都可复用 |

源码统一前缀：https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/

实际执行 `npm test`：4/4通过，真实react-dom + jsdom + act；覆盖稳定ID重排、下标key错位、父级key重置和函数组件类型替换。TypeScript与生产构建通过。工具链固定Vite6.4.5/esbuild0.28.2，安装后已重新验证。干净npm ci结果见根docs/REACT_SOURCE_SERIES_VALIDATION.md。

另一位作者已只读交叉核验文章、源码范围与测试并再次运行4项测试。审查后修正Hook定义引用范围、flags说明和结构图省略main节点的声明。

jsdom测试不测绘制、布局或调度；不读取私有Fiber字段。结构图明确是简图，不是完整运行时树导出。浏览器与图形验收结果见根验证记录。

## 2026-10-22 正文源码补充

正文新增reconcileSingleElement、updateSlot、updateElement、useFiber原函数及输入路径讲解。源文件重新从v18.3.1官方raw下载，四段正文与源文件逐字比对（仅统一外层缩进）通过；原版权许可及SHA256置于source-notes。此轮不修改运行示例逻辑。
