# NestJS、TypeORM 与 Node.js 内容增补方案

日期：2026-10-25。此文件是支线交付的增补目录，尚未修改主仓库分类、内容聚合、进度清单或线上页面，也不表示文章已经完成。供主任务统一接入，避免并行编辑共享文件。

## 分类归属与学习顺序

新增公开分类 **NestJS 工程**，建议稳定topic ID为`nestjs`。其主线是组织、运行并交付一个服务，内容不能只介绍装饰器语法。

**TypeORM 主归属数据与并发**，通过TypeORM标签形成四篇连续子系列。TypeORM是一套数据访问工具，不要求依赖NestJS；先在普通TypeScript程序里理解它生成哪些SQL、怎样拥有连接和事务，再进入Nest集成，更容易分清框架注入与数据库机制。

NestJS专栏中的数据库集成章负责模块注册、Repository注入、事务服务边界与生命周期；实体关系、查询和事务的完整推导由TypeORM四篇主讲，相关概念就地简短回顾，关键集成代码仍在Nest正文内展示，不强迫读者外跳补齐代码。

推荐顺序：Node执行模型与HTTP → SQL/约束/索引/事务 → TypeORM前两篇 → Nest前两篇 → TypeORM事务与迁移 → Nest数据库集成与安全 → 服务测试交付。两条系列各自提供能够独立运行的阶段入口。

## NestJS 工程：六篇阶梯专题

贯穿项目：租户笔记服务。逐章增加笔记API、模块边界、数据存储、身份与权限、集成测试和关闭流程。固定同一套虚构租户和用户，不能把框架示例假称生产身份平台。

|顺序|文章题目 / 建议ID|必须讲清楚的内容|可验证交付|
|---|---|---|---|
|1|NestJS 基础与请求流程：从启动到响应 / `nestjs-request-lifecycle`|框架与Node/Express/Fastify职责；bootstrap、Controller/Service/Module；Middleware、Guard、Interceptor、Pipe、Filter的参与位置和异常路径|一个真实HTTP服务；正常输入、校验失败、Guard拒绝、处理器异常各自的执行记录；请求时序图|
|2|模块与依赖注入：Provider、作用域和生命周期 / `nestjs-modules-di`|容器与token；模块可见性、imports/exports；useClass/useValue/useFactory；singleton/request/transient；动态配置、循环依赖及释放资源|可复现的注入失败、不同请求实例身份、异步初始化和应用关闭；依赖结构图|
|3|NestJS 与 TypeORM：数据访问边界和事务服务 / `nestjs-typeorm-integration`|连接/DataSource与实体注册；Repository注入；业务服务到事务的边界；事务专属manager；初始化失败与关闭；测试替身不能替代真实数据库|笔记创建/修改与审计同事务；受控异常回滚；真实PG集成；连接所有权图|
|4|输入、身份与权限：让 API 在服务端守住边界 / `nestjs-validation-authorization`|DTO只是类型还是运行时校验；转换与白名单策略；Guard鉴权；资源/租户授权；输出序列化与错误映射；缺失身份和缺失资源的处理|非法字段、未登录、跨租户、越权读写；每个拒绝路径确认无副作用；信任边界图|
|5|可靠交互：超时、取消、后台任务与幂等入口 / `nestjs-reliability`|请求预算如何传播；什么时候取消底层工作；Interceptor/RxJS超时不等于外部副作用被撤销；重复提交；后台任务的持久化与所有权|真实上游延迟/断开、明确的取消与清理；同键重发不重复写入；不把内存定时任务称为可靠队列|
|6|测试与交付：配置、健康检查、日志和优雅关闭 / `nestjs-testing-delivery`|单元/集成/E2E分别证明什么；配置校验；结构化日志与请求ID；存活/就绪；SIGTERM、停止接收与在途预算；迁移发布顺序|从干净环境安装构建、真实E2E、依赖失效时不就绪、关闭中请求收敛；不使用真实业务密钥|

认证、安全、Outbox和Node关闭已有专题可作基础，但本系列必须展示Nest实际调用和验证，不仅提供链接。

## TypeORM：数据与并发下的四篇子系列

贯穿同一笔记/租户数据模型，PostgreSQL作为明确验证产品；MySQL差异另行标注。先写普通TypeScript入口，不先依赖Nest注入，保证库本身可以独立理解。

|顺序|文章题目 / 建议ID|必须讲清楚的内容|可验证交付|
|---|---|---|---|
|1|TypeORM 基础：Entity、DataSource、Repository 与 SQL / `typeorm-foundations`|ORM做什么、不代替什么；初始化/销毁；列映射、主键、NULL/default；Repository与EntityManager；save/insert/update的选择和返回值；参数化SQL|完整增删改查，实际SQL与结果对照；唯一/非空错误；初始化失败清理；不把TS类型当数据库约束|
|2|关系与查询：JOIN、QueryBuilder、分页和 N+1 / `typeorm-relations-queries`|关系所有方与外键；加载策略及实际查询数量；eager/lazy边界；JOIN结果；选择字段；count/分页的语义；稳定排序与精度保真|真实PG查询日志，N+1对照，关联重复行/计数验证；微秒游标不因Date转换漏行；执行计划不以SQL数量替代|
|3|事务与并发：事务 manager、QueryRunner、锁与幂等 / `typeorm-transactions-concurrency`|事务的连接归属；回调manager与全局Repository不能混用；QueryRunner释放；隔离级别和产品差异；条件更新、版本检查与锁；回滚和提交结果未知|两个真实连接控制竞争；事务内外Repository混用的失败反例；同键并发与完整回滚；乐观检查必须核对实际生成SQL|
|4|迁移与性能：Schema 演进、索引、批处理与观测 / `typeorm-migrations-performance`|开发便利与生产迁移边界；synchronize不能替代经审查的演进流程；generate/run/revert；非事务DDL；索引和EXPLAIN；批处理/查询预算；连接池生命周期|空库和已有数据分别迁移；故意失败后的真实状态；生成SQL审阅；索引前后相同结果与实际计划；不声称revert能恢复所有被删除数据|

关键陷阱必须单独验证：undefined/null过滤策略、危险空条件、关系加载引入的查询、事务内调用全局Repository、锁API与实际数据库行为、日期/金额精度、开发实体与生产迁移配置。

## Node.js：三篇按现有ID扩写，不重复创建

主仓库当前已有以下三篇，后两篇状态为review。保留其ID、评论和研习关联；标题调整及源码扩写由主任务统一处理。

|用户希望补充的方向|现有文章 / ID|本轮扩写要求|
|---|---|---|
|原理|Node.js 执行模型：进程、事件循环与异步 I/O / `node-execution-model`|补齐V8执行环境、Node原生绑定、libuv与OS的协作链；跟踪一条文件读取和一条网络请求，区分等待、底层执行和JS回调；事件循环、nextTick与微任务固定版本；必要源码直接在正文，不能只画一张总图|
|线程和进程|Node.js 并行计算：Worker、进程池与通信边界 / `node-parallel-computing`|先把主线程、libuv线程池、Worker、OS进程逐个定义；比较worker_threads和child_process的内存/崩溃/退出/通信；补spawn、exec、fork适用条件与安全边界；说明cluster承担的服务分发职责；保留有界池、取消、崩溃替换的完整实现，不堆API清单|
|性能问题|Node.js 性能与内存：延迟、堆快照、GC 和压测 / `node-performance-memory`|围绕CPU高、循环阻塞、内存持续增长、外部I/O慢四类问题组织排查；现有ELU/延迟/GC/堆快照继续保留；补CPU profile调用栈、事件循环延迟与请求延迟的区分、句柄/连接/线程池饱和定位；每个结论有输入、窗口、输出和下一步验证|

这些方向已经进入原100篇目标，扩写不增加文章数。本增补方案新增NestJS六篇、TypeORM四篇，共十篇；若整体采用，目标从100变为110篇。本文不擅自改动主任务的100篇验收统计。

## 版本与交付约定

- 编写前核对Nest core/platform adapter、@nestjs/typeorm、TypeORM、Node、TypeScript与pg的准确版本和peer依赖，保留锁文件。不能把不同大版本的文档/API混在同一实现里，也不因官网更新就默认升级既有工程。
- 不把旧Connection/getConnection风格和DataSource风格无说明混写；事务、锁、迁移、where空值策略全部对目标版本真实验证。
- Nest与TypeORM普通入口建议共享schema/fixtures与HTTP契约，但各章有独立可运行入口，不能要求先完成尚未讲解的后章。
- 沿用写作规范：概念→作用→结构→机制→正常与失败→验证；关键代码、必要图形、版本/环境、结果/限制齐全。前两篇标杆通过后再批量推进。
- 主任务接入时统一修改topics类型与筛选、topicCurricula、文章聚合/搜索、下载与离线清单。不要在没有正文时发布空文章；计划章节只留元数据。
- 并行作者独占`src/data/articles/nestjs/`或TypeORM独立目录及对应examples/figures，主代理独占共享文件。当前支线只交付本计划，不占用作者路径。

## 一手资料

- [NestJS 文档：框架结构与核心能力](https://docs.nestjs.com/)
- [NestJS 数据访问概览与框架无关的集成边界](https://docs.nestjs.com/techniques/database)
- [TypeORM DataSource](https://typeorm.io/docs/data-source/data-source/)
- TypeORM官方文档中的实体、关系、查询、事务、迁移章节：实际写作时跟随其当时可用目录并锁版本，不能把文档路径存在等同于示例已核验。

资料核对日期2026-10-25。本文件是目录与验收设计，不声称已有Nest/TypeORM运行结果。
