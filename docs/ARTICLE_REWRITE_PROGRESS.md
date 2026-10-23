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
| operations | offline-first-static-site | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| identity | oauth-login | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| react | react-state-effects | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| data | transactions-locks | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| tasks | reliable-tasks | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| operations | k8s-debugging | 正文与本地测试完成；集群验证受阻 | 5项本地检查；无kubectl/容器/集群，未伪造集群结果 |
| flutter | flutter-engineering | Web版已验证，原生硬件未验 | VM/Chrome各4测试、analyze、Web构建；MethodChannel仅mock |
| react | react-fiber-scheduling | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| react | react-identity-events | 已发布（旧文升级） | 按新规范重写；固定原码比对、配套示例及图形 |
| nextjs | next-server-boundaries | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| nodejs | node-capacity | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| python | python-async-services | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| algorithms | algorithms-invariants | 技术审校通过，整合发布中 | 7测试含1000组差分；二分交互与完整四算法 |
| webgl | webgl-pipeline | 技术审校通过，整合发布中 | 8测试；真实桌面GPU绘制、编译/链接失败与恢复 |
| flutter | cross-platform-models | 正文完成；RN验收受阻 | 7项JS逻辑测试；15个high未解决，无原生工具链 |
| flutter | electron-trust-boundary | 技术审校通过，整合发布中 | 5策略测试与10项真实Electron smoke；macOS14.5 x64 |
| identity | web-security-boundaries | 已发布（专题升级） | 完整正文/示例/图形；实际检查见对应VALIDATION记录 |
| ai | agent-foundations | 正文修订待整合 | 双语言六个核心文件逐字比对；36+16测试通过 |
| ai | agent-tools-mcp | 编写与验证中 | 共享v2契约；双语言代码与正文按章推进 |
| ai | agent-rag | 编写与验证中 | 共享v2契约；双语言代码与正文按章推进 |
| ai | agent-control-loop | 编写与验证中 | 共享v2契约；双语言代码与正文按章推进 |
| ai | agent-context-memory | 编写与验证中 | 共享v2契约；双语言代码与正文按章推进 |
| ai | agent-evaluation | 编写与验证中 | 共享v2契约；双语言代码与正文按章推进 |
| ai | agent-security | 编写与验证中 | 共享v2契约；双语言代码与正文按章推进 |
| ai | agent-production | 编写与验证中 | 共享v2契约；双语言代码与正文按章推进 |
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
