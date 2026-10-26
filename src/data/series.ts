export const agentChapters=[
{id:'agent-foundations',stage:'理解模型',outcome:'定义输入输出协议，识别格式正确与业务正确的区别。'},
{id:'agent-tools-mcp',stage:'连接能力',outcome:'实现有边界的只读工具，解释 MCP 与授权的关系。'},
{id:'agent-rag',stage:'建立证据',outcome:'定位检索或生成失败，验证引用与文档权限。'},
{id:'agent-control-loop',stage:'可靠执行',outcome:'设计状态、预算、审批与崩溃恢复。'},
{id:'agent-context-memory',stage:'管理上下文',outcome:'维护有来源、可修正、可删除的长期记忆。'},
{id:'agent-evaluation',stage:'证明效果',outcome:'建立用例集、评分标准、轨迹与发布门槛。'},
{id:'agent-security',stage:'限制风险',outcome:'验证提示注入下的工具权限与隔离策略。'},
{id:'agent-production',stage:'完成交付',outcome:'以成功率、任务成本和延迟运营服务。'},
];

/** Supplementary sequence; the original eight chapter identities remain stable. */
export const aiCourseChapters=[
{id:'ai-model-context',stage:'应用入门',outcome:'认识模型、Token 和上下文，运行有完整轮次边界的预算构造器。'},
{id:'ai-prompt-contracts',stage:'输出与评测',outcome:'版本化 Prompt，区分协议、结构和业务错误，用固定样本运行回归。'},
{id:'ai-rag-ingestion',stage:'知识入库',outcome:'保存来源和版本，验证权限内检索、更新与旧引用失效。'},
{id:'ai-agent-workflows',stage:'框架与恢复',outcome:'用真实 LangGraph 和 SQLite 运行审批、拒绝和幂等故障恢复。'},
{id:'ai-streaming-delivery',stage:'全栈交互',outcome:'启动 Node/React 流式页面，验证事件续接、取消与资源边界。'},
{id:'ai-data-tools',stage:'数据工具',outcome:'将受限计划编译为固定 SQL，验证租户、只读和执行预算。'},
];

/** Beginner Python sequence: the original article identities are preserved. */
export const pythonChapters=[
{id:'python-language-foundations',stage:'变量与数据类型',outcome:'能独立运行小程序，读取和修改常见类型，用判断循环处理笔记。'},
{id:'python-functions-iteration',stage:'函数',outcome:'会定义和调用函数，解释参数、返回值与局部变量。'},
{id:'python-object-model',stage:'类与对象',outcome:'会创建实例，说明self、属性、方法与笔记本组合。'},
{id:'python-modules-boundaries',stage:'文件与模块',outcome:'会导入模块、读写文件、处理异常，并组织一个小包。'},
{id:'python-concurrency-models',stage:'线程与进程',outcome:'会区分顺序、线程和进程，收集结果并发现任务错误。'},
{id:'python-async-services',stage:'异步等待',outcome:'从一个await开始，理解任务、等待、超时和取消清理。'},
{id:'python-fastapi',stage:'第一个HTTP接口',outcome:'会读取HTTP请求、校验标题，返回正常和错误响应。'},
{id:'python-data-access',stage:'SQLite保存数据',outcome:'用SQL保存笔记，证明提交、回滚与重新打开文件的结果。'},
{id:'python-delivery',stage:'环境与安装',outcome:'会创建环境、安装依赖、运行测试，并在源码外调用已安装包。'},
];
