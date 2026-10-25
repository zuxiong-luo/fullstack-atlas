# 全站专题扩充执行与进度清单

本文件记录40→100篇扩充的历史验收：新增60篇已全部分批发布，当时全站100篇，12分类均达到确认目标。最后实现提交62ba1a0，线上及环境范围见 `docs/validation/expansion-100-release.md`。

批准范围：新增60篇；阶段一28篇，全站68篇且各分类至少4篇；阶段二32篇，全站100篇。React18篇、Agent8篇保留，本轮仅修必要一致性问题。

后续NestJS、TypeORM与Node.js增补进度见 [增补执行清单](NESTJS_TYPEORM_NODE_PROGRESS.md)，不改写本轮历史统计。

## 编辑与验收约定

遵循 ARTICLE_WRITING_GUIDE.md。先概念、作用、结构，再机制、正常及失败路径、验证和取舍。关键代码在正文，来源链接只用于追溯。每篇独立文件，示例及SVG在仓库。读者面向有开发经验的全栈开发者。

状态：待编写、编写中、待审校、验证受阻、已完成。已有表示本轮不新增，不表示重新验证全部历史环境。完成必须同时有正文、示例复现、交叉审校、实际图形浏览、站点回归与线上核对记录；只写文件不能标完成。未验手机原生、Linux/K8s、GPU、真实模型均单列，不能把模拟当实测。

## 并行边界与发布

最多三名作者；各自独占分配的分类正文、示例、图形和核验记录。主代理独占共享内容类型、目录、实验注册、清单、回归与发布。每篇由另一名作者交叉复核，主代理最终验收。逐批只发布通过验收的内容，记录提交与线上版本；不碰无关首页、名片、鉴权、导航样式。

阶段一：批一数据库3、Python1–3、Node3（9篇）；批二Python4–5、安全2、Next3（7篇）；批三异步3、运维2、跨平台1（6篇）；批四算法3、WebGL3（6篇）。阶段二：服务数据12、应用工程11、算法图形9，分轮最多三名作者。

数据库以PostgreSQL17为主；私有实例、专用端口、测试数据，与本机用户数据库隔离。MySQL差异必须注明。Python以CPython3.12为基线，阶段成果独立可追踪；第6章保留既有异步实验，随后用笔记导入服务整合。Node.js使用22基线，各框架在批次开始锁定确切版本并核对官方资料。

## 完整目录与知识归属

原始结构数据见 src/data/topicCurricula.ts。阶段0表示既有文章；未上线章节只是任务元数据，不产生空白文章或失效路由。每篇以前面已交付相关概念为前置，不依赖尚未交付的后章代码。

### 身份认证与安全

前置：HTTP 请求与响应；JavaScript 与浏览器基础。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 1|HTTPS 与 TLS：从证书信任到加密通信<br>`https-tls`|验证证书、主机名与握手边界，定位信任失败。|`examples/https-tls/`|已完成|
|2 / 1|登录态与会话：Cookie、Session、JWT，以及续期和退出<br>`sessions-lifecycle`|实现会话建立、轮换、到期与撤销，解释令牌取舍。|`examples/sessions-lifecycle/`|已完成|
|3 / 既有|OAuth 授权码与 PKCE：从浏览器事务到本站会话<br>`oauth-login`|验证授权事务与本站会话之间的边界。|`examples/oauth-login/`|已有|
|4 / 2|浏览器安全策略：同源、CORS、CSP 与 Cookie 属性<br>`browser-security-policies`|受控复现跨域与脚本限制，区分读取许可和服务端授权。|`examples/browser-security-policies/`|已完成|
|5 / 既有|Web 安全的四条边界：XSS、CSRF、对象授权与受控出站<br>`web-security-boundaries`|沿信任边界复现并修复攻击路径。|`examples/web-security-boundaries/`|已有|
|6 / 2|权限与多租户：从 RBAC 到资源所有权和服务端授权<br>`authorization-tenancy`|阻止越权与跨租户读写，验证拒绝默认行为。|`examples/authorization-tenancy/`|已完成|

### 数据与并发

前置：SQL 基础；事务与并发的基本概念。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 2|数据模型与约束：把业务规则落实到数据库<br>`data-model-constraints`|用键、检查约束和关系表达业务不变量。|`examples/data-model-constraints/`|已完成|
|2 / 1|数据库索引：B-tree、联合索引与访问路径<br>`database-indexes`|从访问路径推导索引选择，并读取真实执行计划。|`examples/database-indexes/`|已完成|
|3 / 2|SQL 与执行计划：JOIN、排序、聚合和分页怎样变慢<br>`sql-execution-plans`|解释实际行数与估算偏差，验证查询改写。|`examples/sql-execution-plans/`|已完成|
|4 / 既有|库存事务与行锁：从条件扣减到隔离级别的实际边界<br>`transactions-locks`|通过并发连接验证库存不变量和事务失败。|`examples/transactions-locks/`|已有|
|5 / 1|MVCC 与并发可见性：快照、版本和旧数据清理<br>`database-mvcc`|推演快照可见性、隔离级别与旧版本回收。|`examples/database-mvcc/`|已完成|
|6 / 1|数据库锁与死锁：锁范围、等待关系和重试<br>`database-locks-deadlocks`|构造可控等待与死锁，设计完整事务重试。|`examples/database-locks-deadlocks/`|已完成|
|7 / 2|乐观并发控制：版本号、条件更新、唯一约束与幂等写入<br>`optimistic-concurrency`|验证冲突检测、并发唯一性与幂等写入边界。|`examples/optimistic-concurrency/`|已完成|
|8 / 2|数据库与缓存一致性：失效、并发回填和更新顺序<br>`cache-consistency`|复现过期回填与双写失败，明确一致性承诺。|`examples/cache-consistency/`|已完成|

### 可靠的异步系统

前置：HTTP 服务；数据库事务。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 2|异步任务模型：请求、队列、Worker 与持久化边界<br>`async-task-model`|确定任务接受、持久化和完成的不同承诺。|`examples/async-task-model/`|已完成|
|2 / 1|消息投递与消费：ACK、重复、顺序和幂等<br>`message-delivery`|复现重投与重复副作用，验证消费确认时机。|`examples/message-delivery/`|已完成|
|3 / 1|重试、超时与取消：退避、预算和失败收敛<br>`retry-timeout-cancellation`|实现有界重试与取消传播，避免超时后继续放大工作。|`examples/retry-timeout-cancellation/`|已完成|
|4 / 既有|可靠异步任务：用持久化状态、租约和幂等走完崩溃恢复<br>`reliable-tasks`|在进程崩溃后恢复未完成任务。|`examples/reliable-tasks/`|已有|
|5 / 1|Outbox 与跨系统一致性：数据库提交后怎样可靠发出消息<br>`transactional-outbox`|复现提交与发布之间的失败窗口，实现幂等中继。|`examples/transactional-outbox/`|已完成|
|6 / 2|并发与分布式协调：限流、租约、锁和 fencing<br>`distributed-coordination`|解释租约到期后的旧持有者问题，验证 fencing。|`examples/distributed-coordination/`|已完成|

### 部署与故障排查

前置：命令行基础；HTTP 与进程概念。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 1|Linux 服务基础：进程、线程、信号与服务管理<br>`linux-services`|沿进程和信号生命周期启动、停止并定位服务。|`examples/linux-services/`|已完成|
|2 / 2|Linux 性能排查：CPU、内存、磁盘与 I/O<br>`linux-performance`|用观测区分计算、内存压力与存储等待。|`examples/linux-performance/`|已完成|
|3 / 1|网络故障排查：沿 DNS、TCP、TLS 和 HTTP 定位问题<br>`network-troubleshooting`|根据实际输出逐层排除网络故障。|`examples/network-troubleshooting/`|已完成|
|4 / 2|Docker 工程：镜像构建、容器隔离、数据卷与资源限制<br>`docker-engineering`|构建可复现镜像，验证持久化和资源边界。|`examples/docker-engineering/`|已完成|
|5 / 2|服务发布与回滚：反向代理、健康检查和配置变更<br>`service-release-rollback`|验证发布流量切换、失败退出与回滚。|`examples/service-release-rollback/`|已完成|
|6 / 2|Kubernetes 基础：工作负载、服务发现、探针与滚动更新<br>`kubernetes-foundations`|跟踪 Pod、Service 与控制器的责任，验证更新失败。|`examples/kubernetes-foundations/`|已完成|
|7 / 既有|从一个 502 出发：沿链路排查 Kubernetes 服务<br>`k8s-debugging`|用证据沿入口、服务和端点收敛故障。|`examples/k8s-debugging/`|已有|
|8 / 既有|让网站断网后也能打开：从构建清单到完整离线快照<br>`offline-first-static-site`|理解浏览器交付分支中的缓存、更新与离线一致性。|`examples/offline-first-static-site/`|已有|

### 跨平台工程

前置：至少一种界面框架；异步与状态基础。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 既有|React Native 与 Flutter：渲染、事件和设备通信模型<br>`cross-platform-models`|区分两种框架的执行、渲染和平台调用边界。|`examples/cross-platform-models/`|已有|
|2 / 既有|Flutter 设备页面：状态所有权、订阅与平台边界<br>`flutter-engineering`|实现有生命周期约束的设备页面。|`examples/flutter-engineering/`|已有|
|3 / 1|跨平台架构：领域逻辑、状态与平台适配接口<br>`cross-platform-architecture`|用适配接口隔离设备能力，验证状态与取消。|`examples/cross-platform-architecture/`|已完成|
|4 / 2|React Native 应用工程：导航、生命周期与原生能力<br>`react-native-engineering`|处理屏幕生命周期、权限和原生调用失败。|`examples/react-native-engineering/`|已完成|
|5 / 2|移动端离线数据：本地存储、操作队列与同步冲突<br>`mobile-offline-sync`|实现可重放操作与明确的冲突策略。|`examples/mobile-offline-sync/`|已完成|
|6 / 既有|Electron 权限边界：从进程隔离到安全报表导出<br>`electron-trust-boundary`|验证不可信渲染进程与主进程的权限分隔。|`examples/electron-trust-boundary/`|已有|
|7 / 2|跨平台性能：启动、滚动、内存和通信成本<br>`cross-platform-performance`|在指定平台上记录可复现测量，定位关键路径。|`examples/cross-platform-performance/`|已完成|
|8 / 2|跨平台交付：构建、签名、配置、升级与崩溃定位<br>`cross-platform-delivery`|区分各平台交付链并验证可用的构建环境。|`examples/cross-platform-delivery/`|已完成|

### Next.js 全栈

前置：React 组件与状态；HTTP 基础。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 1|Next.js 请求与路由：App Router、布局和客户端导航<br>`next-routing`|对照首次请求和客户端导航跟踪路由树。|`examples/next-routing/`|已完成|
|2 / 既有|Next.js 服务端与客户端边界：用账户页走通渲染、写入与缓存<br>`next-server-boundaries`|解释组件运行位置与服务端数据边界。|`examples/next-server-boundaries/`|已有|
|3 / 1|Next.js 数据与缓存：缓存对象、作用域和失效<br>`next-data-cache`|在锁定版本下验证缓存命中和失效。|`examples/next-data-cache/`|已完成|
|4 / 1|Server Actions 与 Route Handlers：表单、验证、鉴权和幂等<br>`next-server-writes`|验证服务端写入的身份、输入和重复提交。|`examples/next-server-writes/`|已完成|
|5 / 2|流式渲染与错误恢复：Suspense、loading 与 error<br>`next-streaming-errors`|观察流式输出，验证异常边界和重试。|`examples/next-streaming-errors/`|已完成|
|6 / 2|Next.js 生产工程：构建产物、环境配置、部署与请求追踪<br>`next-production`|以生产构建验证配置、启动和请求日志。|`examples/next-production/`|已完成|

### Node.js 工程

前置：JavaScript 函数与 Promise。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 1|Node.js 执行模型：进程、事件循环与异步 I/O<br>`node-execution-model`|区分 JS 执行、事件循环、系统 I/O 与线程池。|`examples/node-execution-model/`|已完成|
|2 / 1|Node.js 模块与工程：ESM、CommonJS 和 TypeScript 构建<br>`node-modules-tooling`|解释模块解析、格式边界与编译后的运行行为。|`examples/node-modules-tooling/`|已完成|
|3 / 1|Node.js HTTP 服务：请求边界、错误处理与优雅关闭<br>`node-http-lifecycle`|实现有输入边界、取消和关闭预算的 HTTP 服务。|`examples/node-http-lifecycle/`|已完成|
|4 / 既有|Node.js：事件循环、流背压与有边界的导出服务<br>`node-capacity`|验证背压、断开连接与容量约束。|`examples/node-capacity/`|已有|
|5 / 2|Node.js 并行计算：Worker、进程池与通信边界<br>`node-parallel-computing`|通过有界 Worker 池隔离 CPU 工作并处理任务失败。|`examples/node-parallel-computing/`|已完成|
|6 / 2|Node.js 性能与内存：延迟、堆快照、GC 和压测<br>`node-performance-memory`|定义测量口径，区分延迟、吞吐和存活对象。|`examples/node-performance-memory/`|已完成|

### Python 工程

前置：已有 JavaScript / TypeScript 开发经验。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 1|Python 入门：语法、对象、容器、控制流与函数<br>`python-language-foundations`|从输入文本生成可验证的笔记导入结果。|`examples/python-course/`|已完成|
|2 / 1|Python 函数与迭代：参数、作用域、闭包和生成器<br>`python-functions-iteration`|把导入流程拆成可组合、按需消费的处理步骤。|`examples/python-course/`|已完成|
|3 / 1|Python 对象模型：类、dataclass、特殊方法与组合<br>`python-object-model`|建立领域对象并明确可变性、相等性和组合关系。|`examples/python-course/`|已完成|
|4 / 1|Python 模块与边界：包、类型、异常和资源管理<br>`python-modules-boundaries`|把导入工具组织成有边界且正确释放资源的包。|`examples/python-course/`|已完成|
|5 / 1|Python 并发选择：线程、进程、asyncio 与 GIL<br>`python-concurrency-models`|按 I/O、CPU 和隔离需求选择并发方式。|`examples/python-course/`|已完成|
|6 / 既有|Python 异步工程：从类型边界到有界并发与取消清理<br>`python-async-services`|限制异步任务和队列，并验证取消清理。|`examples/python-async-services/`|已有|
|7 / 2|FastAPI 服务：请求校验、依赖注入、鉴权与生命周期<br>`python-fastapi`|为笔记和导入任务提供可测试的 HTTP 接口。|`examples/python-course/`|已完成|
|8 / 2|Python 数据访问：事务、连接池、迁移与集成测试<br>`python-data-access`|验证数据持久化、事务失败和连接生命周期。|`examples/python-course/`|已完成|
|9 / 2|Python 工程交付：配置、日志、测试、打包与性能分析<br>`python-delivery`|从干净环境安装、启动和观测完整服务。|`examples/python-course/`|已完成|

### 算法与数据结构

前置：JavaScript / TypeScript 数组与函数。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 既有|算法怎样推导：二分边界、窗口、BFS 与动态规划<br>`algorithms-invariants`|用不变量和反例建立算法推导方法。|`examples/algorithms-invariants/`|已有|
|2 / 1|线性结构：数组、链表、栈与队列的操作代价<br>`linear-data-structures`|按操作序列比较结构和摊还成本。|`examples/linear-data-structures/`|已完成|
|3 / 1|哈希与缓存结构：冲突、负载、查找与 LRU<br>`hash-lru`|实现哈希表和 LRU，验证碰撞与淘汰。|`examples/hash-lru/`|已完成|
|4 / 1|排序与二分：有序性、分治和边界不变量<br>`sorting-binary-search`|从区间定义推导排序与二分的正确性。|`examples/sorting-binary-search/`|已完成|
|5 / 2|滑动窗口与单调结构：怎样减少重复扫描<br>`sliding-monotonic`|证明窗口和单调队列的删除条件。|`examples/sliding-monotonic/`|已完成|
|6 / 2|树、堆与递归：结构关系、遍历和优先级<br>`trees-heaps-recursion`|实现遍历与堆操作，解释递归深度限制。|`examples/trees-heaps-recursion/`|已完成|
|7 / 2|图的遍历与依赖：BFS、DFS 和拓扑排序<br>`graph-traversal-dependencies`|处理重复访问、环和依赖顺序。|`examples/graph-traversal-dependencies/`|已完成|
|8 / 2|最短路径与优先队列：从 BFS 到 Dijkstra<br>`shortest-paths`|根据边权前提选择算法，验证松弛和过期条目。|`examples/shortest-paths/`|已完成|
|9 / 2|搜索与动态规划：回溯、记忆化和状态转移<br>`search-dynamic-programming`|从搜索树推导状态和复用条件。|`examples/search-dynamic-programming/`|已完成|
|10 / 2|贪心与区间问题：怎样证明局部选择成立<br>`greedy-intervals`|使用交换论证证明选择，给出错误策略反例。|`examples/greedy-intervals/`|已完成|

### WebGL 与图形

前置：JavaScript；基础向量与矩阵概念。

|顺序 / 阶段|文章 / 稳定ID|读完能做什么|示例目录|状态|
|---|---|---|---|---|
|1 / 既有|WebGL 从顶点到像素：完整三角形、矩阵与资源生命周期<br>`webgl-pipeline`|完成绘制链路并释放图形资源。|`examples/webgl-pipeline/`|已有|
|2 / 1|从二维到三维：模型、视图、投影与深度<br>`webgl-3d-transforms`|解释坐标变换和深度测试，用参数控制画面。|`examples/webgl-3d-transforms/`|已完成|
|3 / 1|几何与 GPU 数据：属性、索引缓冲和实例化<br>`webgl-geometry-buffers`|验证顶点布局、索引范围和实例化数据。|`examples/webgl-geometry-buffers/`|已完成|
|4 / 1|纹理与采样：UV、过滤、mipmap 和透明混合<br>`webgl-texture-sampling`|通过实际纹理解释采样与混合次序。|`examples/webgl-texture-sampling/`|已完成|
|5 / 2|Shader 与光照：法线、材质和逐像素计算<br>`webgl-shader-lighting`|验证法线变换和简化光照模型。|`examples/webgl-shader-lighting/`|已完成|
|6 / 2|离屏渲染与后处理：Framebuffer、纹理与多 Pass<br>`webgl-framebuffer-postprocess`|完成离屏目标和后处理，检查附件完整性。|`examples/webgl-framebuffer-postprocess/`|已完成|
|7 / 2|渲染性能与生命周期：批次、计时、内存和上下文恢复<br>`webgl-performance-lifecycle`|区分 CPU/GPU 测量，处理丢失与重建。|`examples/webgl-performance-lifecycle/`|已完成|

## 验证与发布记录

- 2026-10-23：目录落盘；工作树起点 a6768cf。第一批9篇开始。待审校，不宣称正文或发布已完成。
- 每批记录：官方资料与确切版本、测试环境和命令结果、失败案例、独立审稿、桌面/手机视口、ZIP与离线清单、回归、提交和线上资源版本。
- 起点环境限制：当时无本机Docker/K8s，Android/iOS原生未验。后续已在隔离Ubuntu和Android API36 x86_64模拟器验证，详见最终发布记录；实体手机、iOS、物理GPU矩阵及真实付费模型仍未验。RN上游依赖告警保留。

- 2026-10-24：Node三篇已独立交叉审稿与真实示例复现；桌面/390手机视口图形、高亮、复制、SIGTERM入口通过。数据三篇作者交稿，主代理独立复现6/8/8通过，独立作者审稿待补。Python前三章示例17项已由两人复现，正文由接续作者补齐。批二安全2篇、Next3篇开始；未推送未宣称上线。

## 已发布批次

2026-10-24：第一批9篇已完成，站点49篇。提交 `43b0e7a029709dd343a0b0a0ebf5f62e15751d04`，线上、ZIP、离线与CI证据见 `docs/validation/expansion-batch-01-release.md`。后续草稿不计入已发布数量。
2026-10-24：第二批7篇已完成，站点56篇。实现提交 `4e663f7`，依赖软链接清理提交 `ea021a67e36c07c4df6860cf1c112d5c5c88cbc1`；证据见 `docs/validation/expansion-batch-02-release.md`。

第一阶段28篇已随404486d及此前批次发布，线上68篇和12套新增ZIP核验通过，详见docs/validation/expansion-stage-01-release.md。第二阶段草稿逐篇进入审校，不提前以文件落盘计完成。

第二阶段27篇已随8507e7b发布，线上95篇/25套新或更新ZIP核验通过，详见expansion-stage-02-95-release.md。剩余WebGL3和跨平台RN/交付2仍未计完成。

WebGL后三篇已随f3494f2发布，线上98篇/三个新增ZIP核验通过，详见expansion-stage-02-98-release.md。只剩RN工程/跨平台交付两篇尚未验收完成。

2026-10-25：最终两篇随62ba1a0207f424b362e2893692ee2e843795ca53发布，新增60篇全部完成，全站100篇。Pages run40146674941成功；线上主资源与55项已验快照逐字节相同，1306离线资源、四个新增或更新ZIP逐文件核对通过。本地4173已同步。原生模拟器、实际离线落盘与未验环境见 expansion-100-release.md。上述98篇及待审状态保留为历史批次事实。
