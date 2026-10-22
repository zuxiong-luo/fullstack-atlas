import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "python-async-services",
  "topic": "python",
  "title": "Python 工程基础：类型边界、asyncio 与结构化并发",
  "description": "为 AI 服务建立可靠的 Python 基础，避免把 async 当成自动加速器。",
  "minutes": 8,
  "tags": [
    "Python",
    "asyncio",
    "TaskGroup",
    "类型",
    "并发"
  ],
  "scope": "示例要求 Python 3.11+ 的 TaskGroup 与 timeout；本站浏览器实验室不提供 Python 运行环境。",
  "prerequisites": [
    "函数、异常与容器",
    "HTTP 请求概念"
  ],
  "sections": [
    {
      "id": "s11-324665",
      "title": "先建立可维护的运行边界",
      "paragraphs": [
        "一个可维护的服务需要固定 Python 与依赖版本、隔离环境、配置入口和可重复测试。类型注解帮助编辑器与静态检查，但 JSON 输入不会因为标了类型就自动符合它；运行时仍应解析与验证。",
        "把领域对象与第三方 SDK 返回值分开，避免整个业务到处依赖动态字典字段。对配置缺失、输入错误、上游超时分别抛出可识别错误，日志中不要带原始密钥或整段私人对话。"
      ]
    },
    {
      "id": "s15-398808",
      "title": "协程只有在让出执行时才并发推进",
      "paragraphs": [
        "调用 async def 函数得到协程对象，任务需要被 await 或被调度。协程中的同步 HTTP 客户端、time.sleep 或大量 CPU 循环仍会阻塞事件循环。asyncio.sleep 是可让出的等待，而不是给当前线程强行暂停。",
        "I/O 密集工作可以使用异步库，阻塞 I/O 可谨慎通过 asyncio.to_thread 适配。纯 Python CPU 密集工作是否受 GIL 影响取决于解释器构建与扩展；对常规带 GIL 的 CPython，线程不是通用 CPU 并行方案，可评估进程池。"
      ]
    },
    {
      "id": "s12-316434",
      "title": "生命周期比同时启动更重要",
      "paragraphs": [
        "TaskGroup 将一组相关任务纳入同一作用域，子任务失败时会取消剩余任务并在退出时收集异常。它适合“这些任务共同构成一次操作”的情况；若业务要求每项独立成功，需要明确捕获每项异常并返回结果对象。",
        "取消是协作式信号。清理放在 finally 或上下文管理器里，不要随意吞掉 CancelledError。对整个请求设超时，同时对连接和单项操作设合理预算，防止一个慢依赖拖住全部资源。"
      ],
      "code": "# Python 3.11+；本地运行，无网络依赖\nimport asyncio\n\nasync def job(i, semaphore):\n    async with semaphore:\n        await asyncio.sleep(0.01)\n        return i * i\n\nasync def main():\n    semaphore = asyncio.Semaphore(2)\n    async with asyncio.timeout(2):\n        async with asyncio.TaskGroup() as group:\n            tasks = [group.create_task(job(i, semaphore)) for i in range(5)]\n        print([task.result() for task in tasks])\n\nasyncio.run(main())  # [0, 1, 4, 9, 16]",
      "language": "python"
    },
    {
      "id": "s16-495396",
      "title": "限制请求数量，也限制任务对象数量",
      "paragraphs": [
        "Semaphore 限制进入临界区的任务数量，但一次创建一百万个 task 仍会消耗大量内存。超大输入可以用有界队列和固定数量消费者，不断读取、处理、写出。",
        "异步服务里的数据库连接池、模型请求额度和内存预算会相互限制。请求超时应取消本轮无用工作，但远端写操作是否发生仍需查询和幂等机制确认，不能把本地取消等同于远端回滚。"
      ]
    },
    {
      "id": "s7-167119",
      "title": "练习与判断标准",
      "paragraphs": [
        "先运行示例，再让某个 job 抛出异常，观察 TaskGroup 的异常和取消。然后把 asyncio.sleep 替换为同步等待，对比其他任务是否还能及时推进。测试时断言结果和取消行为，不要只断言函数被调用。",
        "自测：有 Semaphore 为什么内存还高？答案要同时考虑已创建任务、输入集合、结果累计和连接缓冲。只有临界区并发受到限制，其余生命周期并未因此变成流式。"
      ]
    }
  ],
  "questionIds": [
    "python-async-services-cancel",
    "python-async-services-semaphore"
  ],
  "references": [
    {
      "title": "Python：协程与任务",
      "url": "https://docs.python.org/3/library/asyncio-task.html"
    },
    {
      "title": "Python：类型注解",
      "url": "https://docs.python.org/3/library/typing.html"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
