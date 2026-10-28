/** Explicitly retired on the author's request, 2026-10-28. Git retains the old manuscripts. */
export const retiredPythonArticleIds: readonly string[] = [
  'python-language-foundations', 'python-functions-iteration', 'python-object-model',
  'python-modules-boundaries', 'python-concurrency-models', 'python-async-services',
  'python-fastapi', 'python-data-access', 'python-delivery',
];
export const isRetiredPythonArticle = (id:string) => retiredPythonArticleIds.includes(id);
export const pythonRewritePlanUrl = 'https://github.com/zuxiong-luo/fullstack-atlas/blob/main/docs/PYTHON_NODE_REWRITE_PLAN.md';

/** A plan only: these entries must not be registered as published articles or searchable prose. */
export const pythonCoursePlan = [
  {id:'python-node-syntax', title:'从 JavaScript 到 Python：常用语法、容器与容易带错的习惯', outcome:'对照解构、切片、真值、相等比较与可变引用，读懂日常Python代码。', stage:'语言差异'},
  {id:'python-node-functions', title:'Python 函数与参数：默认值、关键字参数、解包和装饰器', outcome:'用JS/TS对照解释 /、*、*args、**kwargs、默认值求值时机与函数包装。', stage:'语言差异'},
  {id:'python-node-iteration', title:'Python 的迭代写法：推导式、生成器、迭代器与惰性求值', outcome:'与Array方法、Iterable及Generator对照，判断何时执行、何时耗尽。', stage:'语言差异'},
  {id:'python-node-classes', title:'Python 类的实际写法：self、绑定方法、属性、继承与 dataclass', outcome:'从JS的this与原型经验出发，掌握Python特有的类语法和行为差异。', stage:'语言差异'},
  {id:'python-node-packages', title:'模块、包与环境：从 npm、ESM 到 import、venv 和 pyproject', outcome:'区分导入路径、安装分发、解释器环境与依赖锁定。', stage:'运行与工程'},
  {id:'python-node-types-resources', title:'类型、异常与资源：从 TypeScript 和 try/finally 到 Python', outcome:'区分类型提示与校验，解释raise、异常链、with和资源释放。', stage:'运行与工程'},
  {id:'python-node-asyncio', title:'从 Promise 到 asyncio：协程、Task、并发、取消和超时', outcome:'比较调用即启动的Promise流程与协程调度，验证失败和取消传播。', stage:'运行与工程'},
  {id:'python-node-concurrency', title:'Python 与 Node.js 的并发选择：事件循环、线程、进程与 GIL', outcome:'按等待和计算选择执行方式，验证阻塞、并发上限与进程隔离。', stage:'运行与工程'},
  {id:'python-fastapi-overview', title:'FastAPI 做什么：定位、能力边界，以及它和 NestJS 的差异', outcome:'认清FastAPI、Starlette、Pydantic与Uvicorn的职责，走通一次请求。', stage:'FastAPI 服务'},
  {id:'python-fastapi-contracts', title:'FastAPI 的请求与响应：路由、参数、Pydantic、校验和 OpenAPI', outcome:'对照Controller、DTO与Pipe，处理参数来源、响应模型和校验错误。', stage:'FastAPI 服务'},
  {id:'python-fastapi-dependencies', title:'FastAPI 怎样组织服务：APIRouter、Depends、中间件与生命周期', outcome:'比较Nest模块/Provider/Guard与FastAPI机制，验证依赖缓存及资源收尾。', stage:'FastAPI 服务'},
  {id:'python-fastapi-postgres', title:'FastAPI 接入 PostgreSQL：SQLAlchemy、事务、连接池与迁移', outcome:'从TypeORM经验迁移，解释Session归属、事务结束与连接归还。', stage:'FastAPI 服务'},
  {id:'python-fastapi-ai-jobs', title:'FastAPI 处理 AI 请求：流式响应、外部调用、后台任务与队列', outcome:'区分进程内后台任务与可靠队列，处理断连、取消及重复任务。', stage:'FastAPI 服务'},
  {id:'python-fastapi-delivery', title:'FastAPI 的测试与部署：依赖替换、多进程、日志和优雅关闭', outcome:'通过HTTP测试和进程实验验证隔离、关闭及部署边界。', stage:'FastAPI 服务'},
] as const;
