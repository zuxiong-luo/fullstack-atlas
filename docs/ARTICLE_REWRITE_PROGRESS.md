# 文章重写进度

2026-10-22 · 按 ARTICLE_WRITING_GUIDE.md 验收，不用字数或小节数代替质量。

当前阶段：两篇标杆及React源码专题已完成本地反馈迭代；用户已授权按新规划开始重写。已完成React优先补缺批的技术验收，按通过验收的内容提交、推送、检查线上版本。**原25篇全量重写与React27章规划均未整体完成。**

状态定义：待重写 / 编写中 / 待审校 / 已完成。“待审校”也包括本次标杆的读者反馈；已完成须包含内容、代码、图形、站点、离线与适用环境验收。

| 批次 | 文章ID | 状态 | 示例 / 图形 / 核验记录 |
|---|---|---|---|
| 标杆批 | agent-foundations | 待审校（标杆反馈） | examples/agent-workshop 双语言及shared；public/figures/agent-foundations 两图；BENCHMARK_VALIDATION.md |
| 标杆批 | react-fiber-scheduling | 待审校（标杆反馈） | examples/react-fiber-scheduling；public/figures/react-fiber-scheduling 两图；BENCHMARK_VALIDATION.md |
| 第一批 | next-server-boundaries | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第一批 | node-capacity | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第一批 | python-async-services | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第一批 | react-identity-events | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第一批 | react-state-effects | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第二批 | k8s-debugging | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第二批 | oauth-login | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第二批 | offline-first-static-site | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第二批 | reliable-tasks | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第二批 | transactions-locks | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第二批 | web-security-boundaries | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第三批 | algorithms-invariants | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第三批 | cross-platform-models | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第三批 | electron-trust-boundary | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第三批 | flutter-engineering | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第三批 | webgl-pipeline | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第四批 | agent-context-memory | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第四批 | agent-control-loop | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第四批 | agent-evaluation | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第四批 | agent-production | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第四批 | agent-rag | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第四批 | agent-security | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |
| 第四批 | agent-tools-mcp | 待重写 | 尚未建立完整验证示例；公开页面保留并标注概览 |

## 继续实施时的约束

- 内容模型和目录：`src/data/articleTypes.ts`、`src/data/articles.ts`。新文章使用独立文件；未迁移正文位于 `src/data/articles/legacy/`，经适配器渲染。每次替换保留文章ID、questionIds和评论topic。
- 主代理负责共享渲染器、目录聚合、工作流；子代理仅编辑分配的文章、示例和图形。交叉审校后再整合。
- 示例ID入口 `#lab/example/react-scheduling`；草稿key为 `example:react-scheduling`，不覆盖react模式草稿。
- 构建时将白名单源码复制到 `public/downloads/` 并打包ZIP，进入离线清单；不包含依赖目录、虚拟环境或密钥文件。Python/Node项目依赖不属于离线浏览器执行资源。
- Agent共享契约先行。chapter-01-v1当前是显式清单标记；发布时记录Git提交/tag，后续章节不能覆盖旧章可复现入口。
- Flutter/RN/Electron/K8s的设备/系统验证待对应批次执行；缺少环境必须记录阻塞，不把源码完成当作环境验证。
- 不批量改写研习题。本批保留全部研习、评论、学习记录的关联。

## 新增 React 源码专题（2026-10-22）

用户追加四篇独立源码专题，原25篇重写清单保持不变。本站现有33篇；新增文章完成编写与技术交叉审校，与优先补缺批一同发布。历史本地验证见对应记录。

| 文章ID | 状态 | 示例及图形 |
|---|---|---|
| react-fiber-structure | 待审校（读者反馈） | examples/react-fiber-structure；public/figures/react-fiber-structure |
| react-hooks-queue | 待审校（读者反馈） | examples/react-hooks-queue；public/figures/react-hooks-queue |
| react-lane-selection | 待审校（读者反馈） | examples/react-lane-selection；public/figures/react-lane-selection |
| react-work-loop-commit | 待审校（读者反馈） | examples/react-work-loop-commit；public/figures/react-work-loop-commit |

每个示例附VERIFICATION.md，统一记录见REACT_SOURCE_SERIES_VALIDATION.md。

## React 专栏重写 · 第一批（2026-10-22）

按REACT_SERIES_PLAN.md优先补缺，四篇均先保持review，不把整套27章标记完成。

| 章 | 稳定ID | 当前状态 | 覆盖目标 |
|---|---|---|---|
| C2 | react-double-buffer | 已完成（技术验收，页面保留审阅稿标识） | 初次建立、后续复用、字段变化、提交切换与未完成工作 |
| D3 | react-root-scheduling | 已完成（技术验收，页面保留审阅稿标识） | 更新到根、callback复用取消、Sync队列与Scheduler入口 |
| E1 | react-bailout-memo | 已完成（技术验收，页面保留审阅稿标识） | props/state/Context/lanes/childLanes与子树继续工作 |
| E2 | react-hook-memoization | 已完成（技术验收，页面保留审阅稿标识） | Hook记忆化、依赖、生命周期、旧闭包与成本 |

共享交付：按A～G组织现有正文阅读入口；源码快照同步脚本保持固定tag并校验已存文件hash；正常构建不联网下载源码。

本批统一验收记录：`REACT_BATCH_01_VALIDATION.md`。页面保留review便于读者反馈，不表示整个系列已完成。

## 七篇系列标杆（2026-10-22）

最新目录采用REACT_SEVEN_ARTICLE_PLAN.md。本次仅交付react-foundations第一篇本地审阅稿：12个递进小节、三张本地图、完整阅读清单实验；七项示例测试与28项主站测试通过，浏览器及390px阅读已检查。暂不批量合并或重定向旧专题，待读者确认表达与深度。实验记录见examples/react-foundations/VERIFICATION.md。
