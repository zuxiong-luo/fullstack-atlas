# React 旧专题审校：memo / Hook 记忆化

核验日期：2026-10-23。范围仅为 `react-bailout-memo`、`react-hook-memoization`。对照 `ARTICLE_WRITING_GUIDE.md` 全部要求，重点为第 13、14 节。两篇保留原文章 ID、所有既有章节 ID、题目关联与实验入口，状态保持 `review`，不以一次编辑宣称最终完成全部视觉验收。

## 原缺口与本次改动

| 文章 | 原缺口 | 本次实质改动 |
| --- | --- | --- |
| React.memo / bailout | 从父更新故障开场，概念后置；关键按钮和诊断需打开实验；错误按钮片段使用未定义 Button/report；分支分散，读者难以独立推演 | 开篇定义 API 与内部路径、作用与成本；正文完整内嵌 App（含 Context、Leaf、两种比较器、CommitCount 及所有调用者）；删除不自足片段；新增四种操作对照、Lane 交集具体值、三项带解析理解检查 |
| useMemo / useCallback | 从优化故障开场；TASKS、calculate、Board、回调与 Identity 的关键实现分散在下载项目；Hook 变化缺统一追踪 | 先定义记忆化对象/位置/用途，再进入挂载和更新；正文完整内嵌业务文件（仅格式化换行）；给出真实匹配 ID 与数量；按同一槽位列出依赖、分支与保存值；补齐回调保存与调用的时间差、三项带解析检查 |

新增正文没有改写现有示例逻辑。普通路径先讲，旧闭包、动态依赖、Context、重挂载及性能限制随后展开。出处仍在附近，外链仅承担核对；遮住外链仍可从完整代码推导父更新、Leaf 更新、query 变化与错误回调。

## 验证

实际执行环境为本机 macOS / Node 22.12.0。各示例依赖以原 package-lock 为准。

- `examples/react-bailout-memo`: `npm test` **5/5**；`npm run build` 通过。覆盖稳定 props、普通/新对象输入、后代更新、自身 state、Context、错误比较函数的旧闭包，以及全部固定源码摘录逐字匹配。
- `examples/react-hook-memoization`: `npm test` **6/6**；`npm run build` 通过。覆盖依赖命中、依赖变化、空依赖故障、回调闭包、换 key、纯计算确定性及源码摘录逐字匹配。
- 上述源码测试对整个固定快照 SHA256、行段提取清单与文章内 `excerpts` 逐字核对；原始源码、行号和 MIT 归属保留。
- 重新联网获取官方v18.3.1的四个完整源文件，与本地快照逐字一致；全站`npm run build`通过（既有大chunk提示）。
- 正文 App 代码仅使用 Prettier 3.6.2 格式化换行，未改变项目源文件或业务行为。

## 限制与交接

测试运行于真实 react-dom/createRoot + jsdom，不能验证浏览器绘制、手机图形可读性、被放弃 render 的总次数或生产性能收益。CommitCount 与 Identity 的语义已经在正文紧邻代码解释。没有新增虚构耗时、提速比例或生产数据。

既有两张 SVG 的路径与语义未更改；站点整合需主代理确认两页桌面/移动视图、目录锚点、评论、离线包与源码高亮。全站构建与线上发布记录由主代理汇总。两篇目前仍为审阅稿。
