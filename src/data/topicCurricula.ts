import {agentChapters,aiCourseChapters} from './series';

/** Approved reading order. Planned chapters are metadata, never public article placeholders. */
export type CurriculumChapter = {
  id: string;
  title: string;
  outcome: string;
  phase: 0 | 1 | 2 | 3;
  example: string;
};
export type TopicCurriculum = {
  topic: string;
  prerequisites: string[];
  chapters: CurriculumChapter[];
};
const chapter = (id:string,title:string,outcome:string,phase:0|1|2|3,example=id):CurriculumChapter => ({id,title,outcome,phase,example});
export const topicCurricula:TopicCurriculum[] = [
  {topic:'ai',prerequisites:['已有 Web / 后端编程经验','先读应用入门，再进入原八章工程系列；实作篇可按需阅读'],chapters:[
    ...aiCourseChapters.map(c=>chapter(c.id,c.stage,c.outcome,3,c.id==='ai-streaming-delivery'?'ai-engineering-stream':'ai-engineering-course')),
    ...agentChapters.map(c=>chapter(c.id,c.stage,c.outcome,0,'agent-workshop'))
  ]},
  {topic:'identity',prerequisites:['HTTP 请求与响应','JavaScript 与浏览器基础'],chapters:[
    chapter('https-tls','HTTPS 与 TLS：从证书信任到加密通信','验证证书、主机名与握手边界，定位信任失败。',1),
    chapter('sessions-lifecycle','登录态与会话：Cookie、Session、JWT，以及续期和退出','实现会话建立、轮换、到期与撤销，解释令牌取舍。',1),
    chapter('oauth-login','OAuth 授权码与 PKCE：从浏览器事务到本站会话','验证授权事务与本站会话之间的边界。',0),
    chapter('browser-security-policies','浏览器安全策略：同源、CORS、CSP 与 Cookie 属性','受控复现跨域与脚本限制，区分读取许可和服务端授权。',2),
    chapter('web-security-boundaries','Web 安全的四条边界：XSS、CSRF、对象授权与受控出站','沿信任边界复现并修复攻击路径。',0),
    chapter('authorization-tenancy','权限与多租户：从 RBAC 到资源所有权和服务端授权','阻止越权与跨租户读写，验证拒绝默认行为。',2),
  ]},
  {topic:'data',prerequisites:['SQL 基础','事务与并发的基本概念'],chapters:[
    chapter('data-model-constraints','数据模型与约束：把业务规则落实到数据库','用键、检查约束和关系表达业务不变量。',2),
    chapter('database-indexes','数据库索引：B-tree、联合索引与访问路径','从访问路径推导索引选择，并读取真实执行计划。',1),
    chapter('sql-execution-plans','SQL 与执行计划：JOIN、排序、聚合和分页怎样变慢','解释实际行数与估算偏差，验证查询改写。',2),
    chapter('transactions-locks','库存事务与行锁：从条件扣减到隔离级别的实际边界','通过并发连接验证库存不变量和事务失败。',0),
    chapter('database-mvcc','MVCC 与并发可见性：快照、版本和旧数据清理','推演快照可见性、隔离级别与旧版本回收。',1),
    chapter('database-locks-deadlocks','数据库锁与死锁：锁范围、等待关系和重试','构造可控等待与死锁，设计完整事务重试。',1),
    chapter('optimistic-concurrency','乐观并发控制：版本号、条件更新、唯一约束与幂等写入','验证冲突检测、并发唯一性与幂等写入边界。',2),
    chapter('cache-consistency','数据库与缓存一致性：失效、并发回填和更新顺序','复现过期回填与双写失败，明确一致性承诺。',2),
    chapter('flash-sale','秒杀后端：从库存行锁到 Redis Lua 与有界异步下单','解释原子检查与容量保护，用真实PG/Redis验证预占、消费和恢复。',3),
    chapter('typeorm-foundations','TypeORM 基础：Entity、DataSource、Repository 与 SQL','从实际 SQL 理解实体映射、持久化和查询边界。',3),
    chapter('typeorm-relations-queries','关系与查询：JOIN、QueryBuilder、分页和 N+1','用真实查询日志验证关联加载、计数和精度保真的游标。',3),
    chapter('typeorm-transactions-concurrency','事务与并发：事务 manager、QueryRunner、锁与幂等','控制两个连接的执行顺序，验证回滚、冲突和连接归属。',3),
    chapter('typeorm-migrations-performance','迁移与性能：Schema 演进、索引、批处理与观测','验证空库与旧库演进、失败后的真实状态及执行计划。',3),
  ]},
  {topic:'tasks',prerequisites:['HTTP 服务','数据库事务'],chapters:[
    chapter('async-task-model','异步任务模型：请求、队列、Worker 与持久化边界','确定任务接受、持久化和完成的不同承诺。',2),
    chapter('message-delivery','消息投递与消费：ACK、重复、顺序和幂等','复现重投与重复副作用，验证消费确认时机。',1),
    chapter('retry-timeout-cancellation','重试、超时与取消：退避、预算和失败收敛','实现有界重试与取消传播，避免超时后继续放大工作。',1),
    chapter('reliable-tasks','可靠异步任务：用持久化状态、租约和幂等走完崩溃恢复','在进程崩溃后恢复未完成任务。',0),
    chapter('transactional-outbox','Outbox 与跨系统一致性：数据库提交后怎样可靠发出消息','复现提交与发布之间的失败窗口，实现幂等中继。',1),
    chapter('distributed-coordination','并发与分布式协调：限流、租约、锁和 fencing','解释租约到期后的旧持有者问题，验证 fencing。',2),
  ]},
  {topic:'operations',prerequisites:['命令行基础','HTTP 与进程概念'],chapters:[
    chapter('linux-services','Linux 服务基础：进程、线程、信号与服务管理','沿进程和信号生命周期启动、停止并定位服务。',1),
    chapter('linux-performance','Linux 性能排查：CPU、内存、磁盘与 I/O','用观测区分计算、内存压力与存储等待。',2),
    chapter('network-troubleshooting','网络故障排查：沿 DNS、TCP、TLS 和 HTTP 定位问题','根据实际输出逐层排除网络故障。',1),
    chapter('docker-engineering','Docker 工程：镜像构建、容器隔离、数据卷与资源限制','构建可复现镜像，验证持久化和资源边界。',2),
    chapter('service-release-rollback','服务发布与回滚：反向代理、健康检查和配置变更','验证发布流量切换、失败退出与回滚。',2),
    chapter('kubernetes-foundations','Kubernetes 基础：工作负载、服务发现、探针与滚动更新','跟踪 Pod、Service 与控制器的责任，验证更新失败。',2),
    chapter('k8s-debugging','从一个 502 出发：沿链路排查 Kubernetes 服务','用证据沿入口、服务和端点收敛故障。',0),
    chapter('offline-first-static-site','让网站断网后也能打开：从构建清单到完整离线快照','理解浏览器交付分支中的缓存、更新与离线一致性。',0),
  ]},
  {topic:'flutter',prerequisites:['至少一种界面框架','异步与状态基础'],chapters:[
    chapter('cross-platform-models','React Native 与 Flutter：渲染、事件和设备通信模型','区分两种框架的执行、渲染和平台调用边界。',0),
    chapter('flutter-engineering','Flutter 设备页面：状态所有权、订阅与平台边界','实现有生命周期约束的设备页面。',0),
    chapter('cross-platform-architecture','跨平台架构：领域逻辑、状态与平台适配接口','用适配接口隔离设备能力，验证状态与取消。',1),
    chapter('react-native-engineering','React Native 应用工程：导航、生命周期与原生能力','处理屏幕生命周期、权限和原生调用失败。',2),
    chapter('mobile-offline-sync','移动端离线数据：本地存储、操作队列与同步冲突','实现可重放操作与明确的冲突策略。',2),
    chapter('electron-trust-boundary','Electron 权限边界：从进程隔离到安全报表导出','验证不可信渲染进程与主进程的权限分隔。',0),
    chapter('cross-platform-performance','跨平台性能：启动、滚动、内存和通信成本','在指定平台上记录可复现测量，定位关键路径。',2),
    chapter('cross-platform-delivery','跨平台交付：构建、签名、配置、升级与崩溃定位','区分各平台交付链并验证可用的构建环境。',2),
  ]},
  {topic:'nextjs',prerequisites:['React 组件与状态','HTTP 基础'],chapters:[
    chapter('next-routing','Next.js 请求与路由：App Router、布局和客户端导航','对照首次请求和客户端导航跟踪路由树。',1),
    chapter('next-server-boundaries','Next.js 服务端与客户端边界：用账户页走通渲染、写入与缓存','解释组件运行位置与服务端数据边界。',0),
    chapter('next-data-cache','Next.js 数据与缓存：缓存对象、作用域和失效','在锁定版本下验证缓存命中和失效。',1),
    chapter('next-server-writes','Server Actions 与 Route Handlers：表单、验证、鉴权和幂等','验证服务端写入的身份、输入和重复提交。',1),
    chapter('next-streaming-errors','流式渲染与错误恢复：Suspense、loading 与 error','观察流式输出，验证异常边界和重试。',2),
    chapter('next-production','Next.js 生产工程：构建产物、环境配置、部署与请求追踪','以生产构建验证配置、启动和请求日志。',2),
  ]},
  {topic:'nodejs',prerequisites:['JavaScript 函数与 Promise'],chapters:[
    chapter('node-execution-model','Node.js 执行模型：进程、事件循环与异步 I/O','区分 JS 执行、事件循环、系统 I/O 与线程池。',1),
    chapter('node-modules-tooling','Node.js 模块与工程：ESM、CommonJS 和 TypeScript 构建','解释模块解析、格式边界与编译后的运行行为。',1),
    chapter('node-http-lifecycle','Node.js HTTP 服务：请求边界、错误处理与优雅关闭','实现有输入边界、取消和关闭预算的 HTTP 服务。',1),
    chapter('node-capacity','Node.js：事件循环、流背压与有边界的导出服务','验证背压、断开连接与容量约束。',0),
    chapter('node-parallel-computing','Node.js 并行计算：Worker、进程池与通信边界','通过有界 Worker 池隔离 CPU 工作并处理任务失败。',2),
    chapter('node-performance-memory','Node.js 性能与内存：延迟、堆快照、GC 和压测','定义测量口径，区分延迟、吞吐和存活对象。',2),
  ]},
  {topic:'nestjs',prerequisites:['Node.js 执行模型与 HTTP 服务','TypeScript 基础；数据库章节另需 SQL 与事务'],chapters:[
    chapter('nestjs-request-lifecycle','NestJS 基础与请求流程：从启动到响应','跟踪真实 HTTP 请求的正常、校验、拒绝和异常路径。',3),
    chapter('nestjs-modules-di','模块与依赖注入：Provider、作用域和生命周期','解释模块可见性与实例归属，验证初始化和资源关闭。',3),
    chapter('nestjs-typeorm-integration','NestJS 与 TypeORM：数据访问边界和事务服务','用事务专属 manager 完成笔记与审计的原子写入。',3),
    chapter('nestjs-validation-authorization','输入、身份与权限：让 API 在服务端守住边界','拒绝非法输入与跨租户访问，并验证没有写入副作用。',3),
    chapter('nestjs-reliability','可靠交互：超时、取消、后台任务与幂等入口','传播请求预算，区分取消、幂等和持久任务的承诺。',3),
    chapter('nestjs-testing-delivery','测试与交付：配置、健康检查、日志和优雅关闭','通过真实 E2E、依赖失效和 SIGTERM 验证交付边界。',3),
  ]},
  {topic:'python',prerequisites:['不要求 Python 或其他语言经验','按变量、函数、类的顺序读；后续篇建立在前篇练习上'],chapters:[
    chapter('python-language-foundations','Python 入门：从变量、数据类型到判断和循环','能独立运行小程序，读取和修改常见类型，用判断循环处理笔记。',1,'python-course'),
    chapter('python-functions-iteration','Python 函数：从 def、参数和 return 开始','会定义和调用函数，解释参数、返回值与局部变量。',1,'python-course'),
    chapter('python-object-model','Python 类与对象：从一条笔记认识 self 和方法','会创建实例，说明self、属性、方法与笔记本组合。',1,'python-course'),
    chapter('python-modules-boundaries','Python 文件与模块：读写、JSON、异常和 import','会导入模块、读写文件、处理异常，并组织一个小包。',1,'python-course'),
    chapter('python-concurrency-models','Python 并发入门：先看顺序执行，再认识线程和进程','会区分顺序、线程和进程，收集结果并发现任务错误。',1,'python-course'),
    chapter('python-async-services','Python 异步入门：一步步理解 async、await 和任务','从一个await开始，理解任务、等待、超时和取消清理。',0,'python-course'),
    chapter('python-fastapi','第一个 Python 接口：从 HTTP 请求到 FastAPI 返回结果','会读取HTTP请求、校验标题，返回正常和错误响应。',2,'python-course'),
    chapter('python-data-access','用 Python 保存数据：从 SQLite 和 SQL 到提交与回滚','用SQL保存笔记，证明提交、回滚与重新打开文件的结果。',2,'python-course'),
    chapter('python-delivery','把 Python 项目运行起来：虚拟环境、依赖、测试与打包','会创建环境、安装依赖、运行测试，并在源码外调用已安装包。',2,'python-course'),
  ]},
  {topic:'algorithms',prerequisites:['JavaScript / TypeScript 数组与函数'],chapters:[
    chapter('algorithms-invariants','算法怎样推导：二分边界、窗口、BFS 与动态规划','用不变量和反例建立算法推导方法。',0),
    chapter('linear-data-structures','线性结构：数组、链表、栈与队列的操作代价','按操作序列比较结构和摊还成本。',1),
    chapter('hash-lru','哈希与缓存结构：冲突、负载、查找与 LRU','实现哈希表和 LRU，验证碰撞与淘汰。',1),
    chapter('sorting-binary-search','排序与二分：有序性、分治和边界不变量','从区间定义推导排序与二分的正确性。',1),
    chapter('sliding-monotonic','滑动窗口与单调结构：怎样减少重复扫描','证明窗口和单调队列的删除条件。',2),
    chapter('trees-heaps-recursion','树、堆与递归：结构关系、遍历和优先级','实现遍历与堆操作，解释递归深度限制。',2),
    chapter('graph-traversal-dependencies','图的遍历与依赖：BFS、DFS 和拓扑排序','处理重复访问、环和依赖顺序。',2),
    chapter('shortest-paths','最短路径与优先队列：从 BFS 到 Dijkstra','根据边权前提选择算法，验证松弛和过期条目。',2),
    chapter('search-dynamic-programming','搜索与动态规划：回溯、记忆化和状态转移','从搜索树推导状态和复用条件。',2),
    chapter('greedy-intervals','贪心与区间问题：怎样证明局部选择成立','使用交换论证证明选择，给出错误策略反例。',2),
  ]},
  {topic:'webgl',prerequisites:['JavaScript','基础向量与矩阵概念'],chapters:[
    chapter('webgl-pipeline','WebGL 从顶点到像素：完整三角形、矩阵与资源生命周期','完成绘制链路并释放图形资源。',0),
    chapter('webgl-3d-transforms','从二维到三维：模型、视图、投影与深度','解释坐标变换和深度测试，用参数控制画面。',1),
    chapter('webgl-geometry-buffers','几何与 GPU 数据：属性、索引缓冲和实例化','验证顶点布局、索引范围和实例化数据。',1),
    chapter('webgl-texture-sampling','纹理与采样：UV、过滤、mipmap 和透明混合','通过实际纹理解释采样与混合次序。',1),
    chapter('webgl-shader-lighting','Shader 与光照：法线、材质和逐像素计算','验证法线变换和简化光照模型。',2),
    chapter('webgl-framebuffer-postprocess','离屏渲染与后处理：Framebuffer、纹理与多 Pass','完成离屏目标和后处理，检查附件完整性。',2),
    chapter('webgl-performance-lifecycle','渲染性能与生命周期：批次、计时、内存和上下文恢复','区分 CPU/GPU 测量，处理丢失与重建。',2),
  ]},
];

/** Only sort a selected topic; the all-topics view retains its existing ordering. */
export function curriculumRank(topic:string,id:string):number {
  const index=topicCurricula.find(c=>c.topic===topic)?.chapters.findIndex(c=>c.id===id) ?? -1;
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}
