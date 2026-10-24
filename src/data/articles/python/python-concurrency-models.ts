import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "python-concurrency-models",
  "topic": "python",
  "title": "Python 并发选择：线程、进程、asyncio 与 GIL",
  "description": "为笔记处理选择执行模型：用有界线程窗口调用阻塞I/O、spawn进程执行纯Python计算、固定async worker消费有界队列，并验证失败与清理。",
  "minutes": 58,
  "tags": [
    "Python",
    "线程",
    "进程",
    "asyncio",
    "GIL",
    "有界并发"
  ],
  "scope": "CPython3.12.14标准GIL构建，个人笔记工具第5阶段；本地真实TCP I/O与纯Python计算，按行为验证并发/容量/取消，不做性能排名，不实现生产任务服务。",
  "prerequisites": [
    "理解第4章包边界、类型、异常与with资源管理",
    "理解生成器与Note模型；无需先学Web或后续异步框架"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython3.12.14（实际运行，标准GIL构建）",
    "Python3.12官方文档（页面维护版3.12.15）",
    "可选free-threaded构建以Python3.13官方说明为版本边界，未实测"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 45,
  "questionIds": [],
  "examples": [
    {
      "label": "Python课程源码ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "本章三种模型运行与限制",
      "path": "python-course/chapter05/README.md"
    }
  ],
  "references": [
    {
      "title": "Python3.12：线程与GIL",
      "url": "https://docs.python.org/3.12/library/threading.html"
    },
    {
      "title": "Python3.12：Executor、Future与关闭",
      "url": "https://docs.python.org/3.12/library/concurrent.futures.html"
    },
    {
      "title": "Python3.12：进程启动与可序列化要求",
      "url": "https://docs.python.org/3.12/library/multiprocessing.html#contexts-and-start-methods"
    },
    {
      "title": "Python3.12：asyncio任务、取消与TaskGroup",
      "url": "https://docs.python.org/3.12/library/asyncio-task.html"
    },
    {
      "title": "Python3.12：有界Queue",
      "url": "https://docs.python.org/3.12/library/asyncio-queue.html"
    },
    {
      "title": "Python3.12：Streams资源关闭",
      "url": "https://docs.python.org/3.12/library/asyncio-stream.html"
    },
    {
      "title": "Python3.13：可选free-threaded构建说明",
      "url": "https://docs.python.org/3.13/howto/free-threading-python.html"
    }
  ],
  "sections": [
    {
      "id": "models",
      "title": "并发是安排多个进展，选择要先看工作在等什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "并发表示多个任务在重叠的生命周期内取得进展；并行表示某一时刻确实有多个执行单元同时计算。线程、进程和asyncio都能组织并发，但共享状态、切换方式和隔离成本不同。选择它们之前，先拆清楚工作：时间主要花在等待外部I/O，还是持续执行CPU计算？任务之间能否共享对象，失败时需要结束哪些资源？"
        },
        {
          "type": "paragraph",
          "text": "这一章沿用笔记输入，不另造大型服务。导入校验后，对每条笔记做两类任务：I/O路径把id与标题发给本机回显端点并确认完整响应；CPU路径执行固定轮数的纯Python整数校验和。前者分别用阻塞socket加线程、asyncio Streams，后者用spawn进程。它们是不同工作负载，结果不能拿来当三种模型的耗时排名。"
        },
        {
          "type": "paragraph",
          "text": "实际环境固定为CPython3.12.14标准GIL构建与标准库，核对3.12官方文档当前维护版3.12.15。I/O夹具只绑定127.0.0.1的临时端口，不联系外部网站；CPU结果确定，不使用“睡一会儿”制造提速数字。目标是交付能解释容量、失败和清理的执行路径，为下一章更完整的异步工程铺路。"
        },
        {
          "type": "code",
          "language": "jsonl",
          "filename": "examples/python-course/fixtures/notes.jsonl",
          "kind": "excerpt",
          "purpose": "完整输入仍是同一组笔记，所有模式先校验字段与唯一性，再处理这些记录。",
          "code": "{\"id\":\"n1\",\"title\":\"  Python 对象  \",\"tags\":[\"Python\",\" Basics \",\"python\"]}\n{\"id\":\"n2\",\"title\":\"生成器与迭代\",\"tags\":[\"Python\",\"iterator\"]}\n{\"id\":\"n3\",\"title\":\"HTTP 请求\",\"tags\":[\"web\"]}\n"
        }
      ]
    },
    {
      "id": "gil",
      "title": "GIL约束哪一层，为什么不等于不能并发",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "GIL是CPython运行时保护解释器内部状态的一把全局解释器锁。对本章的标准3.12构建，同一解释器内通常只有一个线程在执行Python代码；阻塞I/O会在适当位置释放它，某些原生扩展也会释放它。因此多个线程仍能在不同I/O等待之间重叠进展，纯Python紧循环则通常不能靠多线程获得多核执行收益。GIL也不替应用保护“读取余额、判断、再写回”这种复合业务不变量。"
        },
        {
          "type": "paragraph",
          "text": "进程各有自己的解释器和内存，可以绕开同一解释器的GIL限制，但要付出启动、序列化与进程间传输成本。asyncio则主要在一个事件循环线程里推进协程；它在可挂起的await位置让出控制。如果把纯Python校验和直接放进async函数，并且中间没有让出，事件循环仍会被占住。async关键字改变调用模型，不会把CPU循环自动搬到别的核。"
        },
        {
          "type": "paragraph",
          "text": "这不是对所有“Python版本”的永久结论。CPython3.13引入了可选的free-threaded构建，是否可无GIL运行要看具体构建、运行配置和扩展支持。本章不使用那种构建，也不把3.12的线程限制无条件套过去。反过来，升级大版本同样不自动代表当前进程的GIL已关闭，必须按所用版本的官方检测方式核对。"
        },
        {
          "type": "reference",
          "title": "官方依据：3.12线程与GIL",
          "url": "https://docs.python.org/3.12/library/threading.html"
        },
        {
          "type": "reference",
          "title": "版本边界：3.13可选free-threaded构建",
          "url": "https://docs.python.org/3.13/howto/free-threading-python.html"
        }
      ]
    },
    {
      "id": "jobs",
      "title": "先约束任务输入，再谈执行器的数量",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter05/work.py",
          "kind": "excerpt",
          "purpose": "完整工作负载：借用第4章转换层；限定记录数、校验唯一性，明确TCP负载与纯Python计算。",
          "code": "from pathlib import Path\nfrom chapter04.notes_tool.codec import iter_records\nfrom chapter04.notes_tool.domain import Note\nfrom chapter04.notes_tool.errors import ImportFailure\n\n\ndef load_jobs(path: Path, *, max_notes: int = 128) -> tuple[Note, ...]:\n    if type(max_notes) is not int or not 1 <= max_notes <= 128:\n        raise ValueError(\"max_notes must be an integer in 1..128\")\n    notes: list[Note] = []\n    seen: set[str] = set()\n    with path.open(encoding=\"utf-8\") as source:\n        for line_number, note in iter_records(source):\n            if len(notes) == max_notes:\n                raise ImportFailure(line_number, f\"exceeds {max_notes} notes\")\n            if note.id in seen:\n                raise ImportFailure(line_number, \"duplicate id: \" + note.id)\n            seen.add(note.id)\n            notes.append(note)\n    return tuple(notes)\n\n\ndef payload(note: Note) -> bytes:\n    # Escaped JSON keeps the line protocol independent of title newlines.\n    import json\n    return json.dumps({\"id\": note.id, \"title\": note.title}, ensure_ascii=True).encode(\"ascii\")\n\n\ndef cpu_checksum(note: Note, rounds: int = 2000) -> dict[str, object]:\n    if type(rounds) is not int or not 1 <= rounds <= 10000:\n        raise ValueError(\"rounds must be an integer in 1..10000\")\n    value = 0\n    data = payload(note)\n    for _ in range(rounds):\n        for byte in data:\n            value = (value * 131 + byte) % 1000000007\n    return {\"id\": note.id, \"checksum\": value}\n"
        },
        {
          "type": "paragraph",
          "text": "load_jobs最多接收128条笔记，边读边检查数量与唯一性，完成后才启动处理阶段。max_notes可以调小，不能大于128；非法布尔值也被拒绝。这使CLI保留的输入和结果都有明确数量上限。单条输入仍沿用第4章4096字符检查，那发生在完整文本行读入后，并不是底层读取内存硬上限，所以这里仍不是公开上传服务。"
        },
        {
          "type": "paragraph",
          "text": "payload用ensure_ascii=True生成单行ASCII JSON，标题里的换行会被转义，不会破坏逐行TCP帧。cpu_checksum每轮对这些字节做整数乘加取模，2000轮是固定教学工作量，不是密码学摘要或安全校验算法。函数定义在模块顶层，参数是可序列化的Note，结果是普通字典，适合交给spawn子进程重建调用。"
        }
      ]
    },
    {
      "id": "window",
      "title": "线程与进程先共用一条有界提交路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter05/pools.py",
          "kind": "excerpt",
          "purpose": "完整线程/进程执行器和窗口算法。capacity限制已提交但未收集的future，包括运行中的任务；结果按输入索引还原顺序。",
          "code": "from collections.abc import Callable, Iterable\nfrom concurrent.futures import FIRST_COMPLETED, Executor, Future, wait\nfrom concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor\nimport multiprocessing\nfrom typing import TypeVar\n\nT = TypeVar(\"T\")\nR = TypeVar(\"R\")\n\n\ndef check_capacity(workers: int, capacity: int) -> None:\n    if type(workers) is not int or not 1 <= workers <= 8:\n        raise ValueError(\"workers must be an integer in 1..8\")\n    if type(capacity) is not int or not 1 <= capacity <= 32:\n        raise ValueError(\"capacity must be an integer in 1..32\")\n\n\ndef windowed(executor: Executor, function: Callable[[T], R], items: Iterable[T],\n             *, capacity: int) -> list[R]:\n    # capacity bounds submitted, not-yet-collected futures, including running ones.\n    iterator = enumerate(items)\n    pending: dict[Future[R], int] = {}\n    results: dict[int, R] = {}\n    exhausted = False\n    try:\n        while pending or not exhausted:\n            while len(pending) < capacity and not exhausted:\n                try:\n                    index, item = next(iterator)\n                except StopIteration:\n                    exhausted = True\n                else:\n                    pending[executor.submit(function, item)] = index\n            if pending:\n                completed, _ = wait(pending, return_when=FIRST_COMPLETED)\n                for future in completed:\n                    index = pending.pop(future)\n                    results[index] = future.result()\n        return [results[index] for index in sorted(results)]\n    finally:\n        for future in pending:\n            future.cancel()\n\n\ndef thread_map(function: Callable[[T], R], items: Iterable[T], *, workers: int = 2,\n               capacity: int = 2) -> list[R]:\n    check_capacity(workers, capacity)\n    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix=\"notes-worker\") as executor:\n        return windowed(executor, function, items, capacity=capacity)\n\n\ndef process_map(function: Callable[[T], R], items: Iterable[T], *, workers: int = 2,\n                capacity: int = 2) -> list[R]:\n    check_capacity(workers, capacity)\n    context = multiprocessing.get_context(\"spawn\")\n    with ProcessPoolExecutor(max_workers=workers, mp_context=context) as executor:\n        return windowed(executor, function, items, capacity=capacity)\n"
        },
        {
          "type": "paragraph",
          "text": "Future是一次已提交计算的结果句柄，它可能尚未开始、正在运行、成功或失败。submit马上交回句柄，result在完成后返回结果或重新抛出工作函数的异常。线程池的max_workers限制执行线程，不代表任意数量submit都没有代价；3.12的Executor.map还会立即收集输入。我们因此自己维护pending窗口，而不一口气为全部输入建立future。"
        },
        {
          "type": "paragraph",
          "text": "带入capacity=2：先提交n1和n2，pending有两个成员；等至少一个完成后取result、移出pending，再补n3。每次补入前都检查窗口长度，所以未收集future始终不超过2。完成顺序可能颠倒，结果字典用原始索引保存，最终按索引排序，输出仍是n1、n2、n3。容量小于workers时，并发程度自然受更小窗口约束，不是线程越多就一定忙得起来。"
        },
        {
          "type": "paragraph",
          "text": "如果future.result失败，finally尝试取消其余pending，外层with等待执行器结束并回收线程或进程。cancel只能阻止尚未开始的工作，不能强制终止已经运行的任意函数；with退出也可能等待正在执行的工作完成。因此CPU轮数和I/O等待都另有限制，这不是一个具有硬终止期限的任务沙箱。通用映射函数仍聚合全部结果，CLI的128条输入上限与窗口容量承担不同层次的边界。"
        },
        {
          "type": "reference",
          "title": "官方依据：Future、map收集与shutdown/cancel语义",
          "url": "https://docs.python.org/3.12/library/concurrent.futures.html"
        }
      ]
    },
    {
      "id": "spawn",
      "title": "spawn重新启动解释器，入口必须能被安全导入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter05/__main__.py",
          "kind": "excerpt",
          "purpose": "完整-m入口：导入只建立定义，主入口保护后才创建执行器。",
          "code": "from .cli import main\n\nif __name__ == \"__main__\":\n    raise SystemExit(main())\n"
        },
        {
          "type": "paragraph",
          "text": "process_map明确选择multiprocessing.get_context(\"spawn\")，不依赖操作系统的默认启动方式。spawn启动新的解释器，工作函数与参数必须能被子进程找到并序列化；局部lambda、打开的文件对象或依赖父进程临时全局状态的函数，都不适合作为这里的直接参数。子进程收到的是重建的数据，不是与父进程共享同一个可变Notebook。"
        },
        {
          "type": "paragraph",
          "text": "如果在模块顶层创建进程池，子解释器导入模块时又可能尝试创建更多进程。把实际运行放到if __name__ == \"__main__\"保护后，子进程可以安全导入定义，主进程才开始调度。测试使用两个进程共享的Barrier代理，让两项工作都到达屏障才能继续，得到两个不同PID且均不同于父进程；这证明独立子进程确实参与，没有用总耗时猜测。它没有测量CPU核心上的实际重叠比例或生产加速比。"
        },
        {
          "type": "reference",
          "title": "官方依据：spawn与安全导入主模块",
          "url": "https://docs.python.org/3.12/library/multiprocessing.html#the-spawn-and-forkserver-start-methods"
        }
      ]
    },
    {
      "id": "io",
      "title": "同一真实I/O：阻塞调用交线程，可等待调用交事件循环",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter05/io_lab.py",
          "kind": "excerpt",
          "purpose": "完整本地回显夹具与两种客户端：端口、帧容量、超时、socket与StreamWriter清理均在此。",
          "code": "import asyncio\nfrom contextlib import contextmanager\nimport socket\nimport socketserver\nimport threading\nfrom collections.abc import Iterator\nfrom chapter04.notes_tool.domain import Note\nfrom .work import payload\n\nMAX_FRAME = 65536  # Byte capacity for each request/response, including its newline.\nAddress = tuple[str, int]\n\n\nclass EchoHandler(socketserver.StreamRequestHandler):\n    def handle(self) -> None:\n        self.request.settimeout(3)\n        data = self.rfile.readline(MAX_FRAME + 1)\n        if len(data) > MAX_FRAME or not data.endswith(b\"\\n\"):\n            return\n        self.wfile.write(data)\n\n\nclass EchoServer(socketserver.ThreadingTCPServer):\n    block_on_close = True\n    daemon_threads = False\n\n\n@contextmanager\ndef echo_service() -> Iterator[Address]:\n    # Port zero allocates a fresh loopback port; no external endpoint is contacted.\n    server = EchoServer((\"127.0.0.1\", 0), EchoHandler)\n    thread = threading.Thread(target=server.serve_forever, name=\"notes-echo\")\n    thread.start()\n    try:\n        yield server.server_address\n    finally:\n        server.shutdown()\n        server.server_close()\n        thread.join()\n\n\ndef blocking_echo(address: Address, note: Note) -> dict[str, object]:\n    data = payload(note) + b\"\\n\"\n    if len(data) > MAX_FRAME:\n        raise ValueError(\"request exceeds frame capacity\")\n    with socket.create_connection(address, timeout=3) as connection:\n        connection.sendall(data)\n        with connection.makefile(\"rb\") as source:\n            received = source.readline(MAX_FRAME + 1)\n    if received != data:\n        raise ValueError(\"incomplete echo response\")\n    return {\"id\": note.id, \"bytes\": len(received) - 1}\n\n\nasync def async_echo(address: Address, note: Note) -> dict[str, object]:\n    data = payload(note) + b\"\\n\"\n    if len(data) > MAX_FRAME:\n        raise ValueError(\"request exceeds frame capacity\")\n    async with asyncio.timeout(3):\n        reader, writer = await asyncio.open_connection(*address, limit=MAX_FRAME + 1)\n        try:\n            writer.write(data)\n            await writer.drain()\n            received = await reader.readline()\n            if received != data:\n                raise ValueError(\"incomplete echo response\")\n            return {\"id\": note.id, \"bytes\": len(received) - 1}\n        finally:\n            writer.close()\n            await writer.wait_closed()\n"
        },
        {
          "type": "paragraph",
          "text": "echo_service是受控的本地依赖：构造服务时绑定临时端口，用后台服务线程处理连接，退出时shutdown、server_close并join。它不是面向公网的通用服务器。线程客户端在with socket范围内sendall并读取完整一行；socket的3秒超时限制阻塞操作，响应不完全就失败，退出时文件包装与socket都关闭。"
        },
        {
          "type": "paragraph",
          "text": "async_echo用open_connection建立可等待的连接，writer.drain等待写缓冲达到可继续条件，reader.readline等待响应。等待期间，事件循环可以推进其他已就绪的协程；如果某个await的对象已经就绪，也可能直接继续，所以不能把每一个await都理解成必然切换。finally关闭writer并等待关闭完成，让正常、异常与取消路径共用清理。"
        },
        {
          "type": "paragraph",
          "text": "请求和响应帧限制为65536字节，包含行尾换行；它与输入记录的Unicode字符校验不是同一种单位。asyncio.timeout(3)给整个异步请求设置取消式超时；阻塞socket的timeout是单个阻塞操作的等待限制，两者不能冒充完全相同的端到端期限。它们都不是停止任意Python计算的硬抢占机制。"
        },
        {
          "type": "reference",
          "title": "官方依据：StreamReader、StreamWriter与关闭连接",
          "url": "https://docs.python.org/3.12/library/asyncio-stream.html"
        }
      ]
    },
    {
      "id": "async",
      "title": "固定worker消费有界队列，失败由任务组收口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter05/async_jobs.py",
          "kind": "excerpt",
          "purpose": "完整有界异步映射：一个生产者、固定workers个消费者、Queue容量和TaskGroup生命周期。",
          "code": "import asyncio\nfrom collections.abc import Awaitable, Callable, Iterable\nfrom typing import TypeVar\nfrom .pools import check_capacity\n\nT = TypeVar(\"T\")\nR = TypeVar(\"R\")\n\n\nasync def async_map(function: Callable[[T], Awaitable[R]], items: Iterable[T], *,\n                    workers: int = 2, capacity: int = 2) -> list[R]:\n    check_capacity(workers, capacity)\n    queue: asyncio.Queue[tuple[int, T] | None] = asyncio.Queue(maxsize=capacity)\n    results: dict[int, R] = {}\n\n    async def produce() -> None:\n        for index, item in enumerate(items):\n            await queue.put((index, item))\n        for _ in range(workers):\n            await queue.put(None)\n\n    async def consume() -> None:\n        while True:\n            entry = await queue.get()\n            try:\n                if entry is None:\n                    return\n                index, item = entry\n                results[index] = await function(item)\n            finally:\n                queue.task_done()\n\n    async with asyncio.TaskGroup() as group:\n        group.create_task(produce(), name=\"notes-producer\")\n        for index in range(workers):\n            group.create_task(consume(), name=f\"notes-consumer-{index}\")\n    return [results[index] for index in sorted(results)]\n"
        },
        {
          "type": "figure",
          "src": "/figures/python-concurrency-models/capacity.svg",
          "title": "两种容量含义与三种执行模型",
          "alt": "线程/进程窗口限制运行及排队future总量；asyncio生产者向有界队列put，固定worker取任务，队列满则生产者等待；进程拥有独立解释器，async任务共享事件循环。",
          "caption": "容量结构示意，不是性能图。线程/进程capacity包含运行中，asyncio capacity只包含排队项，两者不可直接比较为相同总在途数。"
        },
        {
          "type": "paragraph",
          "text": "直接为每条笔记create_task，再给工作函数套信号量，只限制了同时进入工作区的数量，任务对象本身仍可能很多。这里始终只创建一个生产者和固定数量消费者。Queue(maxsize=capacity)满时，生产者await put暂停，直到某个消费者get腾出位置，这才把接纳压力传回上游。None是结束标记，每个消费者各拿一个；输入类型本身不会是None。"
        },
        {
          "type": "paragraph",
          "text": "asyncio的capacity只限制队列内等待项。总在途还包括workers个正在处理的项，以及生产者在一次put前已经取出的至多一项；输出结果又另行保留。因此workers=2、capacity=1时，不能声称整个程序只持有一项任务。测试通过两个工作协程进入Event门闩后暂不放行，观察源迭代最多推进4项，而不是运行几毫秒后猜队列“应该没有太多”。"
        },
        {
          "type": "paragraph",
          "text": "TaskGroup把生产者与消费者放进同一生命周期。某个消费者抛常规异常，任务组取消其他成员并等待退出，最后抛ExceptionGroup；外层取消则沿协作取消路径传播。consume的finally为已经get的项调用task_done，工作函数自己的finally释放资源。失败时队列里可以还有未消费条目，这个局部队列被整体放弃，代码没有再queue.join，否则可能等待那些已无消费者的条目。"
        },
        {
          "type": "paragraph",
          "text": "取消通常在可挂起的await处注入CancelledError；不要把它吞掉后继续装作成功。CPU紧循环不会因为写在TaskGroup里就自动响应取消，阻塞socket也不能直接放在事件循环线程执行。这个入门实现先把模型和边界讲清，下一章会把请求预算、服务生命周期和更多异常组合继续展开。"
        },
        {
          "type": "reference",
          "title": "官方依据：有界Queue与put等待",
          "url": "https://docs.python.org/3.12/library/asyncio-queue.html"
        },
        {
          "type": "reference",
          "title": "官方依据：TaskGroup与取消",
          "url": "https://docs.python.org/3.12/library/asyncio-task.html#task-groups"
        }
      ]
    },
    {
      "id": "cli",
      "title": "把选择落实为可运行入口与明确的失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter05/cli.py",
          "kind": "excerpt",
          "purpose": "完整命令入口：参数、受控I/O依赖、三种分支、结果和已知异常组处理。",
          "code": "import argparse\nimport asyncio\nfrom functools import partial\nimport json\nfrom pathlib import Path\nfrom .async_jobs import async_map\nfrom .io_lab import async_echo, blocking_echo, echo_service\nfrom .pools import process_map, thread_map\nfrom .work import cpu_checksum, load_jobs\nfrom chapter04.notes_tool.errors import ImportFailure\n\n\ndef main() -> int:\n    parser = argparse.ArgumentParser(description=\"Bounded note processing; no speed benchmark\")\n    parser.add_argument(\"mode\", choices=(\"threads\", \"processes\", \"asyncio\"))\n    parser.add_argument(\"path\", type=Path)\n    parser.add_argument(\"--workers\", type=int, default=2)\n    parser.add_argument(\"--capacity\", type=int, default=2)\n    parser.add_argument(\"--max-notes\", type=int, default=128)\n    arguments = parser.parse_args()\n    try:\n        jobs = load_jobs(arguments.path, max_notes=arguments.max_notes)\n        options = {\"workers\": arguments.workers, \"capacity\": arguments.capacity}\n        if arguments.mode == \"processes\":\n            results = process_map(cpu_checksum, jobs, **options)\n        else:\n            with echo_service() as address:\n                if arguments.mode == \"threads\":\n                    results = thread_map(partial(blocking_echo, address), jobs, **options)\n                else:\n                    results = asyncio.run(async_map(partial(async_echo, address), jobs, **options))\n    except ExceptionGroup as errors:\n        _, unexpected = errors.split((OSError, ValueError))\n        if unexpected is not None:\n            raise\n        parser.exit(2, f\"processing failed: {errors}\\n\")\n    except (OSError, UnicodeError, ValueError, ImportFailure) as error:\n        parser.exit(2, f\"processing failed: {error}\\n\")\n    print(json.dumps({\"mode\": arguments.mode, \"count\": len(results), \"results\": results},\n                     ensure_ascii=False))\n    return 0\n"
        },
        {
          "type": "paragraph",
          "text": "processes分支把纯Python校验和交进程；threads和asyncio分支都在同一个本地回显依赖上做I/O。线程调度的是普通阻塞函数，asyncio调度返回可等待结果的函数。CLI仅在全部工作成功后打印JSON，坏输入在启动处理前失败。已知OSError或ValueError组可以转成退出2，若异常组中含未知程序错误则继续抛出，保留第4章“不吞程序缺陷”的边界。"
        },
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "purpose": "从仓库根目录进入课程目录，使用CPython3.12；无需第三方安装或外部端口配置。",
          "code": "cd examples/python-course\npython3 -m chapter05 threads fixtures/notes.jsonl\npython3 -m chapter05 asyncio fixtures/notes.jsonl\npython3 -m chapter05 processes fixtures/notes.jsonl\npython3 -m unittest -v test_chapter05\npython3 -m chapter05 threads fixtures/notes.jsonl --max-notes 1"
        },
        {
          "type": "paragraph",
          "text": "线程与asyncio正常返回count=3，results依次是n1/44字节、n2/61字节、n3/42字节；数字来自ASCII转义后的id/title JSON，不是原始中文字符数。进程分支校验和依次为340859824、285734593、375736074，与串行调用同一函数结果一致。最后一条容量失败返回2、stdout为空，stderr含exceeds 1 notes。把文件换成bad.jsonl则报告line 2。"
        }
      ]
    },
    {
      "id": "evidence",
      "title": "证据回答重叠、隔离与清理，计时不替代这些判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第5章10项独立测试使用Thread Barrier证明两个工作线程同时到达受控点，并在放行前验证只提交两项；使用spawn Manager Barrier证明两个不同子进程实际参与，并在结束后检查无新增活动子进程。async Event证明固定工作协程重叠、排队容量受控；失败和外部取消后，没有残留命名任务。真实Streams取消实验让本地服务先确认收到请求，再取消客户端，服务观察到EOF，证明连接确实关闭。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/test_chapter05.py",
          "kind": "excerpt",
          "purpose": "项目测试原文：顶层可导入的进程探针，与下面unittest一起证明两个PID到达同一屏障，不比较耗时。",
          "code": "def process_probe(value, barrier):\n    barrier.wait(timeout=5)\n    return os.getpid(), value * 2\n\n\n"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/test_chapter05.py",
          "kind": "excerpt",
          "purpose": "项目unittest方法连续原文；在ConcurrencyChoices类和文件现有imports上下文中运行，包含进程正常与失败后的回收断言。",
          "code": "    def test_spawn_processes_are_distinct_and_joined(self):\n        before = {child.pid for child in multiprocessing.active_children()}\n        context = multiprocessing.get_context(\"spawn\")\n        with context.Manager() as manager:\n            barrier = manager.Barrier(2)\n            result = process_map(partial(process_probe, barrier=barrier), [1, 2])\n            self.assertEqual(len({pid for pid, _ in result}), 2)\n            self.assertNotIn(os.getpid(), {pid for pid, _ in result})\n            self.assertEqual([value for _, value in result], [2, 4])\n        self.assertEqual({child.pid for child in multiprocessing.active_children()}, before)\n        with self.assertRaisesRegex(ValueError, \"worker rejected\"):\n            process_map(process_failure, [1, 2])\n        self.assertEqual({child.pid for child in multiprocessing.active_children()}, before)\n\n"
        },
        {
          "type": "paragraph",
          "text": "CPython3.12.14上新增10项与前面23项共33项通过，包括三种真实-m子进程、正常结果、输入坏行与容量失败、线程/进程工作失败、循环与socket清理。测试里的5秒门闩期限用于避免错误实现挂住，并不是性能指标；本章没有报告提速倍数、吞吐或尾延迟，也没有验证free-threaded构建、Windows/Linux和生产网络。"
        },
        {
          "type": "table",
          "headers": [
            "工作与约束",
            "本章选择",
            "仍需支付的代价"
          ],
          "rows": [
            [
              "已有阻塞I/O API，少量并发",
              "有界线程窗口",
              "共享状态需要同步；正在运行线程不能靠Future.cancel强停"
            ],
            [
              "纯Python CPU计算，需要独立解释器",
              "spawn进程窗口",
              "启动/序列化/传输与进程内存；任务要能安全导入"
            ],
            [
              "可等待I/O API，需要大量受控等待",
              "固定async worker + 有界Queue",
              "代码必须合作让出并处理取消；阻塞函数会占住循环"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "回到开头，选择的依据是工作在哪里等待、状态由谁拥有、失败怎样收口，以及容量限制放在哪层。线程不是因为有GIL就没有用途，asyncio也不是因为语法新就适合CPU循环；进程的独立性则不是免费共享内存。这一版给出可运行选择和可观测边界，下一篇既有异步工程提供独立的有界并发与取消实验；后续服务章节再把这些机制整合进笔记工程。本章不要求你先会后续框架。"
        }
      ]
    }
  ]
};
export default article;
