# 全站文章升级进度

更新时间：2026-10-23。当前40篇文章，React18篇与其他22篇。执行计划见FULL_SITE_ARTICLE_UPGRADE_PLAN.md，验收依据ARTICLE_WRITING_GUIDE.md。

“技术审校通过”指声明范围内的代码、证据与自动检查；页面继续保留审阅稿标识，尚未验证的专用环境另列。历史记录见REACT_BATCH_01_VALIDATION.md等，不再以旧25篇/27章计划作为当前完成数。

| 专题 | 文章ID | 当前阶段 | 交付与验证 |
| --- | --- | --- | --- |
| react | react-foundations | 已发布（新七篇） | 2026-10-23正文自足修订，配套源码及示例 |
| react | react-hooks-interactions | 已发布（新七篇） | 2026-10-23正文自足修订，配套源码及示例 |
| react | react-state-management | 已发布（新七篇） | 2026-10-23正文自足修订，配套源码及示例 |
| react | react-fiber-reconciliation | 已发布（新七篇） | 2026-10-23正文自足修订，配套源码及示例 |
| react | react-concurrency | 已发布（新七篇） | 2026-10-23正文自足修订，配套源码及示例 |
| react | react-performance | 已发布（新七篇） | 2026-10-23正文自足修订，配套源码及示例 |
| react | react-modern-engineering | 已发布（新七篇） | 2026-10-23正文自足修订，配套源码及示例 |
| operations | offline-first-static-site | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| identity | oauth-login | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| react | react-state-effects | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| data | transactions-locks | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| tasks | reliable-tasks | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| operations | k8s-debugging | 正文与本地测试完成；集群验证受阻 | 5项本地检查；无kubectl/容器/集群，未伪造集群结果 |
| flutter | flutter-engineering | 编写与验证中 | 独立示例与图形，设备验证单独记录 |
| react | react-fiber-scheduling | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-identity-events | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| nextjs | next-server-boundaries | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| nodejs | node-capacity | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| python | python-async-services | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| algorithms | algorithms-invariants | 编写与验证中 | 独立示例与图形，设备验证单独记录 |
| webgl | webgl-pipeline | 编写与验证中 | 独立示例与图形，设备验证单独记录 |
| flutter | cross-platform-models | 编写与验证中 | 独立示例与图形，设备验证单独记录 |
| flutter | electron-trust-boundary | 编写与验证中 | 独立示例与图形，设备验证单独记录 |
| identity | web-security-boundaries | 技术审校通过，整合发布中 | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| ai | agent-foundations | 待复核 | 已有双语言基准；需按新规范审查正文自足性 |
| ai | agent-tools-mcp | 待重写 | 既有内容保留访问；按全站计划依次交付 |
| ai | agent-rag | 待重写 | 既有内容保留访问；按全站计划依次交付 |
| ai | agent-control-loop | 待重写 | 既有内容保留访问；按全站计划依次交付 |
| ai | agent-context-memory | 待重写 | 既有内容保留访问；按全站计划依次交付 |
| ai | agent-evaluation | 待重写 | 既有内容保留访问；按全站计划依次交付 |
| ai | agent-security | 待重写 | 既有内容保留访问；按全站计划依次交付 |
| ai | agent-production | 待重写 | 既有内容保留访问；按全站计划依次交付 |
| react | react-fiber-structure | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-hooks-queue | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-lane-selection | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-work-loop-commit | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-double-buffer | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-root-scheduling | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-bailout-memo | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-hook-memoization | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |

## 状态约束

- 每批只发布验收通过的文件，不夹带独立界面修改。
- 正常构建不联网下载React原码；固定快照与行段逐字核对。
- 服务端依赖不属于浏览器离线运行包，正文/图/浏览器实验进入离线清单。
- Agent按章节契约顺序推进，Python/TypeScript共用输入输出与错误约定。
- Flutter/RN/Electron/K8s缺少设备或运行环境时明确保留未验证项；不以静态检查代替运行验收。
