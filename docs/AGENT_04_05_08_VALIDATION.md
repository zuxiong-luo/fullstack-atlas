# Agent 04 / 05 / 08 重写与核验

2026-10-23。正文与示例均为本站教学实现；默认 mock，不把模拟答案当成模型质量证据。本记录覆盖本轮分工的三篇正文、三幅 SVG 和冻结双语言代码的对应关系。文章保持 `review`，最终页面/离线包与发布由主任务统一验收。

## 逐篇原缺口与本次修改

| 文章 | 原缺口 | 这次具体交付 |
| --- | --- | --- |
| `agent-control-loop` | 短文描述状态机、多 Agent 和检查点，但缺持久化调用链；泛化状态图含未实现审批/发布；没有可重现恢复 | 先定义逻辑任务/attempt/checkpoint/lease/epoch，沿 `r-one` 的 queued→retrieved→completed 推导字段变化；完整两语言 contracts/retrieval/providers/store/service/app；正常 HTTP 输入和完整 mock 结果；有效租约、旧 epoch、失败窗口、进程退出恢复与解析 |
| `agent-context-memory` | 泛讲记忆、压缩与向量，缺用户管理 API、owner 来源和删除范围；未区分保存与提示词生效 | 明确 request context / run evidence / 显式 memory 三类；展示完整两语言 contracts/store/app/service/retrieval；Alice 写/改/读/删与 Bob 失败；说明默认不注入问答，memory.text 实际上限 2000 码点；不承诺摘要、向量、自动写入或物理抹除 |
| `agent-production` | 部署/成本建议缺真实准入实现，超时和资源结算混用；没有当前项目预算口径与容器限制 | 完整两语言 service/providers/contracts/app/server/store 和实际 Dockerfile；普通执行、非合作取消后的槽保留、context 176=22+154、175/176 边界、零预算分支；逐项说明本机/单进程与容器未实跑 |

代码与出处分别处理：关键代码直接位于正文，不要求前往其他文章、实验室或外站补全；`filename` 相对 `examples/agent-workshop/`。项目 ZIP/README 用于安装完整目录，SQLite/asyncio/Node 官方链接用于追溯语义。

## 原有标识保持

脚本读取 `git show HEAD:<article>` 与新对象比较：三篇 article ID 未变；每篇原有 5 个 section ID 全部保留（共 15 个）；每篇 2 个 questionIds 保持原数组与顺序（共 6 个）。新增内部节不替换原锚点。

- 04：8 节、12 个完整模块源码块。
- 05：7 节、10 个完整模块源码块。
- 08：8 节、14 个完整模块/容器源码块。

这些数量仅记录核对覆盖面，不作为内容质量指标。逐块用 `block.code === file.read_text()` 检查全部 36 块；没有裁掉导入、条件更新、异常或清理分支。源码采用最终严格 UTF-8/BOM/孤立 surrogate 修订版本。

主任务修正过的 `examples.path`（`agent-workshop.zip`、`agent-workshop/python-v2/README.md`、`agent-workshop/typescript-v2/README.md`）在最终改稿中保持，不重新添加 `examples/` 前缀。

## 图形检查

- `public/figures/agent-control-loop/checkpoints.svg`：实际 queued/retrieved/completed 和 checkpoint=done；claim 只改 epoch/lease；显式恢复分支与完成路径分开，未从 completed 画回检索。
- `public/figures/agent-context-memory/boundaries.svg`：分别展示三种保存路径；去掉跨框箭头，避免暗示 memory 自动进入模型。替代文本和图注同步。
- `public/figures/agent-production/capacity.svg`：单槽示意 A→504 但仍占槽→B=503→原任务结算→C 可进入；标明默认容量 2，图中 1 是可控测试配置；无虚构耗时轴。

三个 SVG 实际用 `sharp` 栅格化并查看 PNG，确认中文字、箭头与标签完整，未见截断/重叠；另一作者也独立栅格查看通过。源文件仍可编辑。站点宽屏/手机与离线包的最终实际浏览器检查由主任务集成执行，本分工没有把单独栅格化冒充页面验收。

## 已执行与实际结果

本轮文章收尾实际执行：

```sh
npx tsc -b
npx vitest run src/lib/exampleProse.test.ts src/lib/articles.test.tsx src/lib/articleBlocks.test.tsx src/lib/expanded.test.tsx
```

最终 TypeScript 编译通过；4 文件共 13 测试通过，包含双语言正文源码同步、文章路由/身份及有序块渲染回归。首次运行发现并报告另一篇 Agent06 缺 tags；由其负责人/主任务补齐后，上述最终重跑通过。没有越界修改 Agent06。

在 Python-v2 目录实际执行正文的上下文计数命令，输出：

```json
{"selected":["cache-guide"],"context_chars":176}
```

问题 `offline cache snapshot` 长 22 码点，已选文档 id/title/text 共 154，相加为 176。此数只代表自定义上下文指标，不含系统消息、JSON 标点，不等于 token 或费用。

冻结实现的已执行记录（本分工实现阶段运行，父级随后独立重跑）：

- Python 3.12.14 / SQLite 3.53.1：36 测试通过；`pip check` 无冲突。
- Node.js 22.12.0 / SQLite 3.47.0：TypeScript 作者记录 33 测试与 build 通过。Node 22.12 内置 SQLite 使用 `--experimental-sqlite`，npm scripts 已含开关。
- 两端直接读取共享 11 组 HTTP 用例；还有真实本机 fake HTTP 上游、真实 MCP stdio 子进程、SQLite 两连接竞争和真实退出/新进程恢复。
- 崩溃 fixture 在 retrieved 提交后 `os._exit(27)` / `process.exit(27)`，恢复进程用过期测试时钟，不假称等待真实 10 秒。恢复检索器会抛错，成功证明复用持久证据。
- 非合作 provider 取消后继续等待，504 时槽仍被保留，后续 503，原始工作真正结算后释放；一般 HTTP adapter 协作取消并清理资源。
- 父级另用 `shared/v2/verify-http-parity.py` 启动双端真实回环服务器，最终报告 99 个逐章 HTTP 步骤通过；本记录区分该网络对照与 TestClient/inject 回归。

官方语义复核：SQLite `lang_transaction.html`（单写事务、BEGIN IMMEDIATE 与忙等待）；`pragma.html#pragma_secure_delete`（逻辑删除不同于完整擦除）；Python 3.12 `asyncio-task.html`（取消请求与等待语义）；Node v22.12.0 `sqlite.html`（版本化 API 与实验边界）。主要正确性证据仍是本文冻结源码与实际测试，而非引用首页。

## 保留的实际限制

- 没有真实付费模型调用，不发布模型质量、性能收益或美元成本。
- 默认是固定检索→生成流程；无任意工具规划循环、自动后台 worker、多 Agent 协调或自动续租。
- completed 重放不新调用模型；retrieved 恢复仍可能重复远端模型调用，不承诺跨系统 exactly-once。
- 记忆只显式 CRUD；不自动用于生成、不自动摘要或向量化。删除只影响当前逻辑行，不清理检查点、WAL、备份或远端副本。
- 执行槽每进程计数，不是多副本全局限流；context_chars 不是 token，总调用预算不是跨 attempt 的账单。
- 忽略取消的 provider 可以长期占槽，同步 CPU 阻塞仍能阻塞事件循环。没有强制杀死任意同进程代码的能力。
- demo 令牌仅本机教学身份；无生产认证/TLS、加密备份、数据库迁移或多主机运维验收。
- Dockerfile 只提供配置，未构建/运行容器；TS 当前监听容器内部 loopback，未声称端口映射后可在主机访问。
- 本分工没有启动留下运行中的服务，没有提交；主任务统一构建、离线打包、浏览器验收和发布。
