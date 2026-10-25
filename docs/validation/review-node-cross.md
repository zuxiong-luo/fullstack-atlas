# Node 三篇：Nest 作者的只读交叉审稿记录

2026-10-25。本文由Node作者记录来自Nest作者的审稿消息，经主代理转交要求保存。明确这是对当前三篇正文和配套代码的只读评审，不表示Nest作者亲自重跑全部测试、浏览器或清洁ZIP。

## 审稿结论与发现

Nest作者认为当前定义、固定源码链、Worker/进程池、性能四诊断分支与真实证据总体通过，未发现概念阻塞。具体发现：node-performance-memory/io-diagnostics.mjs启动request之后，若socket尚未进入server，就单独等待无deadline的connection事件；该等待不与request拒绝联动，连接前失败可能悬挂，也可能留下未处理拒绝。

## 作者修正与验证

- 接受连接与responseBody以Promise.all同时监听，用同一AbortController绝对2秒预算，不依赖socket已经连接后才起计时。
- 请求失败进入finally后abort另一条等待，明确移除自己注册的connection/abort监听，销毁自有socket、清理timer、histogram，等待真实request close；服务只在自己listen状态时关闭。
- 原监听总数断言误把Node HTTP内部监听当成自己的残留，已改按自己函数身份核验，不以猜测的基线减法伪造清理证据。
- 真实连接前拒绝：只关闭自己随机端口的listener再发请求，得到ECONNREFUSED。
- 真实无响应：自有server接收请求但不返回，得到AbortError/cause IO_BUDGET_EXCEEDED。
- 两条都断言server停止监听、自己的timer0、requestDestroyed、自己的connection观察器0。作者最终完整性能套件10/10；正文代码块、README与validation同步。

其余两篇运行源不改动。源码ZIP需由主代理刷新性能项目后独立复跑；不能继续使用修复前ZIP的9项记录作为最终证据。站点手机/离线仍由主统一验收。
