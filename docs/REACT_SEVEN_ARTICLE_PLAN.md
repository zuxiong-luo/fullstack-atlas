# React 七篇系列

2026-10-22：七篇正文均已具备可阅读内容。第1篇、第4篇已获得读者认可；其余五篇完成内容、示例与交叉审校，保留审阅稿标识供读者反馈。不是所有React内部机制的穷尽说明。

| 顺序 | 文章 ID | 内容 | 代码与验证 |
| --- | --- | --- | --- |
| 1 | react-foundations | 组件、数据流与页面更新 | examples/react-foundations，前批标杆 |
| 2 | react-hooks-interactions | Hook、快照、闭包、Effect、异步请求 | 独立项目5项真实React测试 |
| 3 | react-state-management | 状态归属、Store、稳定快照、查询缓存 | 独立项目9项测试 |
| 4 | react-fiber-reconciliation | Fiber结构、双缓冲、队列、协调、工作循环与提交 | 独立项目5项测试，前批标杆 |
| 5 | react-concurrency | Lane、根回调、Scheduler、让出、重放、异步边界 | 独立项目5项测试；Lane/根回调/队列模型复用且复跑 |
| 6 | react-performance | 测量、范围、memo、Hook缓存、窗口化、反例 | 独立项目8项测试 |
| 7 | react-modern-engineering | CSR/SSR/SSG、hydration、请求隔离、框架边界 | 独立Node服务4项测试，真实浏览器检查 |

## 阅读和兼容

遵循 ARTICLE_WRITING_GUIDE：概念→原因→作用→结构与过程→案例→验证。公开列表先展示七篇，旧专题链接、评论与实验保留，旧文章可以作为补充阅读。没有批量删除或重定向，研习题ID不变。旧 A～G 导航已移除，保留每篇自身章节目录。

## 核验边界

React内部源码固定v18.3.1 old reconciler，内嵌源码逐行比对。客户端实验锁React18.3.1、Node22。五篇新示例合计31项测试；不把测试耗时当性能证据。调度模型不是私有根调试器；固定行高窗口不是完整生产列表；查询缓存没有完整并发mutation协议；SSR工程未实现RSC/Next.js或流式数据源。各文明确范围、运行命令、失败案例与后续扩展。

桌面实际打开七幅新图形，390px宽检查五篇无页面横向溢出；四个浏览器实验验证了关键交互，SSR服务验证点击和不匹配恢复。构建离线清单包含所有新增图形和源码下载包；本批没有再次执行浏览器全离线下载流程，不声称外部文档可离线访问。
