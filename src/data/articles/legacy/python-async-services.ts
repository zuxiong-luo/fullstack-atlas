import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "python-async-services",
  "topic": "python",
  "title": "Python 异步工程：从类型边界到有界并发与取消清理",
  "description": "先建立协程、任务和作用域的概念，再实现完整JSON校验、有界队列、固定worker、TaskGroup和总超时，用正常、失败和取消测试解释资源生命周期。",
  "minutes": 45,
  "tags": [
    "Python",
    "asyncio",
    "TaskGroup",
    "类型",
    "并发"
  ],
  "scope": "本地JSON批次实验，教学上游为可取消的asyncio.sleep和平方计算；不是HTTP服务或真实模型调用。讲解输入边界、协程任务、有界并发、作用域失败和超时清理；不宣称真实网络吞吐；标准库行为已在CPython3.12.14和3.14.3验证。",
  "prerequisites": [
    "理解Python函数、异常、list与dict",
    "理解await表示等待完成；本文会补足协程与Task的区别"
  ],
  "sections": [
    {
      "id": "s11-324665",
      "title": "先认识工程边界：类型说明与运行时校验各做什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "类型边界，是外部数据被转换为内部可信结构的位置。Python 的类型注解向编辑器和检查工具描述预期，却不会替你验证 JSON。asyncio 则是在事件循环中协调等待和任务生命周期的工具；它负责执行安排，输入仍需单独检查。本文把两件事接起来，做一个可复现的小批次处理器。"
        },
        {
          "type": "paragraph",
          "text": "输入 {\"values\":[0,1,2,3,4]}，输出每项平方，顺序不变。可以设置两个worker并行等待教学上游；一项受控失败就让整个批次失败；超过总预算就取消剩余工作。先成功、再失败、最后讨论容量上界。你将看到完整关键代码，而不仅是一句“加一个TaskGroup”。"
        },
        {
          "type": "paragraph",
          "text": "示例使用3.12已有的asyncio.TaskGroup与asyncio.timeout，已分别在CPython3.12.14和3.14.3运行同一套9项测试。代码仅用标准库，模块元数据要求>=3.12,<3.15，没有第三方依赖。后文提供独立复跑命令；测试只证明本地实验声明的行为。"
        },
        {
          "type": "code",
          "code": "from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Request:\n    values: tuple[int, ...]\n\nbad = Request((\"wrong\",))\nprint(bad.values)  # ('wrong',)，运行时不会因注解自动抛错",
          "filename": "type_boundary.py",
          "purpose": "可独立运行的反例；静态检查器可以报错，但普通Python解释器仍会构造对象。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "因此我们先检查外部object，再返回Request。下面是完整输入层，包含异常类型、所有默认值和实际校验。特别留意type(v) is int：Python中bool是int的子类，若只用isinstance(v,int)，JSON的true也会通过。这不是本批次想接受的业务数值。"
        },
        {
          "type": "code",
          "code": "\"\"\"Python 3.12-compatible, deterministic local asyncio experiment; no network.\"\"\"\nfrom __future__ import annotations\nimport asyncio\nfrom dataclasses import dataclass\nimport json\nimport math\nimport sys\nfrom typing import Any\n\n\nclass InputError(ValueError):\n    pass\n\n\nclass UpstreamError(RuntimeError):\n    pass\n\n\nclass BatchFailed(RuntimeError):\n    pass\n\n\n@dataclass(frozen=True)\nclass Request:\n    values: tuple[int, ...]\n    workers: int = 2\n    queue_size: int = 2\n    timeout: float = 1.0\n    delay: float = 0.01\n    fail_on: int | None = None\n\n\ndef parse_request(raw: object) -> Request:\n    if not isinstance(raw, dict):\n        raise InputError(\"request must be an object\")\n    allowed = {\"values\", \"workers\", \"queue_size\", \"timeout\", \"delay\", \"fail_on\"}\n    if set(raw) - allowed:\n        raise InputError(\"unknown field\")\n    values = raw.get(\"values\")\n    if not isinstance(values, list) or len(values) > 10_000:\n        raise InputError(\"values must be a list of at most 10000 integers\")\n    if any(type(v) is not int or abs(v) > 1_000_000 for v in values):\n        raise InputError(\"each value must be an integer in [-1000000,1000000]\")\n    def integer(name: str, default: int, maximum: int) -> int:\n        value = raw.get(name, default)\n        if type(value) is not int or not 1 <= value <= maximum:\n            raise InputError(f\"{name} outside valid integer range\")\n        return value\n    def number(name: str, default: float, minimum: float, maximum: float) -> float:\n        value = raw.get(name, default)\n        if type(value) not in (int, float):\n            raise InputError(f\"{name} must be numeric\")\n        try:\n            parsed = float(value)\n        except OverflowError as error:\n            raise InputError(f\"{name} outside valid finite range\") from error\n        if not math.isfinite(parsed) or not minimum <= parsed <= maximum:\n            raise InputError(f\"{name} outside valid finite range\")\n        return parsed\n    fail_on = raw.get(\"fail_on\")\n    if fail_on is not None and type(fail_on) is not int:\n        raise InputError(\"fail_on must be an integer or null\")\n    return Request(tuple(values), integer(\"workers\", 2, 16),\n                   integer(\"queue_size\", 2, 64),\n                   number(\"timeout\", 1.0, 0.001, 30.0),\n                   number(\"delay\", 0.01, 0.0, 5.0), fail_on)",
          "filename": "service.py · 输入层",
          "purpose": "配套文件第一段，含全部输入类型与parse_request。与后面两段按顺序合并就是完整service.py。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "例如 values=[3,1,2]、workers=2，返回Request(values=(3,1,2), workers=2,...)。values=[true]、workers=0、delay=NaN或未知字段都会在创建任务之前抛InputError。最大10000项与数值范围是本实验的产品约束；它们让结果内存和运算规模有可解释的上界。不要把tuple和frozen=True误当输入校验器，负责判断的是parse_request里的代码。"
        },
        {
          "type": "reference",
          "title": "Python 3.12：类型注解不由运行时强制执行",
          "url": "https://docs.python.org/3.12/library/typing.html"
        }
      ]
    },
    {
      "id": "s15-398808",
      "title": "协程、Task 与事件循环：并发发生在等待之间",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "调用async def函数得到协程对象，它描述尚待执行的异步过程。await可以等待另一个协程；Task则把协程交给事件循环安排，让多个任务在各自等待时轮流推进。在普通单线程事件循环里，同一时刻仍是一个任务执行Python代码。多个I/O等待可以重叠，CPU代码不会因此自动分到不同核心。"
        },
        {
          "type": "code",
          "code": "import asyncio\n\nasync def square(value: int) -> int:\n    await asyncio.sleep(0.01)\n    return value * value\n\nasync def main():\n    async with asyncio.TaskGroup() as group:\n        a = group.create_task(square(2))\n        b = group.create_task(square(3))\n    print(a.result(), b.result())\n\nasyncio.run(main())  # 4 9",
          "filename": "task_basics.py",
          "purpose": "完整独立实验。sleep代表可让出的等待；没有网络请求，输出不代表上游性能。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "这段先创建a和b两个任务，退出TaskGroup作用域时等待它们结束。a在sleep处等待时，事件循环可以运行b。若改成连续await square(2)、await square(3)，后一个只有等前一个返回才开始；语法都有await，任务重叠却不同。"
        },
        {
          "type": "paragraph",
          "text": "实际工程中，异步HTTP/数据库客户端可以在网络等待期间让出，但一个标为async的函数中调用time.sleep或同步SDK仍会占着执行线程。阻塞I/O可以评估asyncio.to_thread，CPU密集工作要结合解释器与扩展考虑进程池。尤其不要把协程数、线程数和CPU并行度当作同一个指标。"
        },
        {
          "type": "reference",
          "title": "Python 3.12：协程、任务与创建Task",
          "url": "https://docs.python.org/3.12/library/asyncio-task.html#creating-tasks"
        }
      ]
    },
    {
      "id": "s12-316434",
      "title": "把一次批次圈进作用域：完整处理核心",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TaskGroup管理的是一组相关任务的生存范围：退出作用域前等待子任务；某个子任务以普通异常失败时，取消其他任务并收集失败。本文选择“全批共同成功”的业务语义，所以某项上游错误后不会把已得到的部分结果当成功返回。若你的业务允许逐项独立失败，应当设计每项Result协议，单独捕获已知错误；那是另一种契约。"
        },
        {
          "type": "figure",
          "src": "figures/python-async-services/lifecycle.svg",
          "title": "生产者、有限队列、固定worker都属于本批作用域",
          "alt": "JSON经过校验，一个生产者把带索引数据放入有界队列，两个worker处理；总超时或任务失败取消作用域内剩余工作并等finally完成，结果要么共同成功要么返回分类错误。",
          "caption": "教学结构图。图中的容量2和worker2是默认配置；图不表示CPU并行，也不表示真实外部服务已被取消。"
        },
        {
          "type": "paragraph",
          "text": "读取下面核心时，先找三处所有权：run_batch拥有队列与结果数组；produce是唯一输入提供者；固定数量consume各自取出一项并等待upstream。结果按原index放回，所以完成先后可以不同，输出顺序仍与输入一致。所有后台任务都通过同一个TaskGroup创建。"
        },
        {
          "type": "code",
          "code": "@dataclass\nclass Metrics:\n    active: int = 0\n    peak_active: int = 0\n    peak_queue: int = 0\n    started: int = 0\n    finished: int = 0\n    cleaned: int = 0\n    cancelled: int = 0\n\n\nasync def upstream(value: int, request: Request, metrics: Metrics) -> int:\n    metrics.active += 1\n    metrics.started += 1\n    metrics.peak_active = max(metrics.peak_active, metrics.active)\n    try:\n        await asyncio.sleep(request.delay)\n        if value == request.fail_on:\n            raise UpstreamError(f\"controlled failure for {value}\")\n        metrics.finished += 1\n        return value * value\n    except asyncio.CancelledError:\n        metrics.cancelled += 1\n        raise\n    finally:\n        metrics.active -= 1\n        metrics.cleaned += 1\n\n\nasync def run_batch(request: Request, metrics: Metrics | None = None) -> list[int]:\n    # Trust boundary: use parse_request for JSON. Request is an internal type.\n    metrics = metrics if metrics is not None else Metrics()\n    queue: asyncio.Queue[tuple[int, int] | None] = asyncio.Queue(request.queue_size)\n    results: list[int | None] = [None] * len(request.values)\n\n    async def produce() -> None:\n        for index, value in enumerate(request.values):\n            await queue.put((index, value))\n            metrics.peak_queue = max(metrics.peak_queue, queue.qsize())\n        for _ in range(request.workers):\n            await queue.put(None)\n            metrics.peak_queue = max(metrics.peak_queue, queue.qsize())\n\n    async def consume() -> None:\n        while True:\n            item = await queue.get()\n            try:\n                if item is None:\n                    return\n                index, value = item\n                results[index] = await upstream(value, request, metrics)\n            finally:\n                queue.task_done()\n\n    async with asyncio.timeout(request.timeout):\n        try:\n            async with asyncio.TaskGroup() as group:\n                group.create_task(produce(), name=\"batch-producer\")\n                for index in range(request.workers):\n                    group.create_task(consume(), name=f\"batch-worker-{index}\")\n        except* UpstreamError as errors:\n            raise BatchFailed(f\"upstream batch failed: {len(errors.exceptions)} error(s)\") from errors\n    if any(value is None for value in results):\n        raise RuntimeError(\"incomplete results after a successful task group\")\n    return [value for value in results if value is not None]",
          "filename": "service.py · 批次核心",
          "purpose": "配套文件第二段，含Metrics、完整上游模拟与run_batch。没有省略取消、哨兵、finally或错误处理。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "代入values=(3,1,2)、workers=2、queue_size=1：produce放入(0,3)，队列满时等待；worker取走以后生产者才能继续。两个worker分别处理不同项，await sleep让出；返回9后写results[0]，返回1后写results[1]，最后结果为[9,1,4]。末尾放两个None，每个worker取一个便结束。None是结束标记，所以输入数据用(index,value)元组，不会把业务数字0误当结束。"
        },
        {
          "type": "paragraph",
          "text": "queue.task_done在finally中与每次get配对，包括取到哨兵和处理抛异常的情况。本文没有用queue.join来判断失败批次完成，而是让TaskGroup统一等待；失败时队列可能还有未处理项，但不会被当成成功结果返回。成功退出后仍检查results中有没有None，用于发现实现错误。"
        }
      ]
    },
    {
      "id": "s16-495396",
      "title": "限制并发，也限制等待中的任务对象",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Semaphore约束进入临界区的数量，却不约束已经创建了多少Task。一次create_task一百万项，再让每项等待同一个信号量，仍然创建了一百万个任务及其闭包。本文用固定worker解决这个层次：后台Task始终只有1个生产者加workers个消费者，值的数量只改变工作次数。"
        },
        {
          "type": "paragraph",
          "text": "Queue(maxsize=queue_size)提供另一层边界：待处理元素最多这么多；满时生产者在put等待，直到消费者腾出位置。这种上游被下游速度约束的行为叫背压。它既约束队列存储，也让生产过程有暂停点；但不是整个程序内存的通用保证。"
        },
        {
          "type": "table",
          "headers": [
            "资源",
            "本文的上界或生命周期",
            "还要注意"
          ],
          "rows": [
            [
              "后台Task",
              "workers+1，默认3个",
              "run_batch调用者本身另算"
            ],
            [
              "队列中待处理项",
              "queue_size，默认2个",
              "还有worker手中正在处理的项"
            ],
            [
              "上游同时活跃",
              "最多workers，默认2个",
              "每个worker只await一个upstream"
            ],
            [
              "输入与结果",
              "随n增长，O(n)，n<=10000",
              "本文收完整JSON，未实现真正流式输入"
            ],
            [
              "总预算",
              "timeout覆盖排队与处理",
              "取消清理也需要时间，不是硬实时截止"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "测试使用一个受Event控制的上游：让3个worker停在等待位置，输入1000项，然后检查名字以batch-开头的Task恰好4个。放行后再断言1000个结果完成。这样验证的是任务数量的实际行为，不是把workers变量打印一次就称作限制有效。峰值队列和活跃数也分别断言<=配置值。"
        },
        {
          "type": "reference",
          "title": "Python 3.12：有界Queue与put等待",
          "url": "https://docs.python.org/3.12/library/asyncio-queue.html"
        }
      ]
    },
    {
      "id": "failure-cleanup",
      "title": "失败与取消：结果还没返回，清理已经完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在让输入中的1受控失败。upstream先经过sleep，再抛UpstreamError。TaskGroup发现普通异常后取消仍在工作的兄弟任务；后者在可取消的等待点收到CancelledError，在except中记录取消，再重新抛出，finally减少active并增加cleaned。TaskGroup等这些退出处理完成后才把异常带出作用域。"
        },
        {
          "type": "paragraph",
          "text": "except* UpstreamError处理的是异常组内对应类型的失败。一次批次可能不止一个worker失败，所以这里用批次错误BatchFailed表达“共同成功未满足”，而不是随意取第一条异常当全部真相。未知编程错误没有被广泛except Exception吞掉，仍向调用者暴露以便定位。KeyboardInterrupt、SystemExit等系统级异常也不应当成业务上游错误。"
        },
        {
          "type": "paragraph",
          "text": "测试不靠“等10ms大概就失败了”猜取消：一个worker用Event确认兄弟已经进入等待后才抛错，另一worker在finally记录清理。run_batch抛出BatchFailed后，测试断言清理已执行并且没有batch-任务遗留。真实上游应在finally关闭响应流、释放连接或归还资源；仅写一个cancel日志不能替代实际释放。"
        },
        {
          "type": "paragraph",
          "text": "外部调用者取消run_batch时，我们保留CancelledError向上传播。它表达调用生命周期结束，不能转换成“成功空列表”或“上游报错”。尤其不要捕获BaseException再忽略；取消若被吞掉，TaskGroup和timeout依赖的协议可能失效。"
        },
        {
          "type": "reference",
          "title": "Python 3.12：Task取消与TaskGroup异常规则",
          "url": "https://docs.python.org/3.12/library/asyncio-task.html#task-groups"
        }
      ]
    },
    {
      "id": "timeout-boundary",
      "title": "总超时与错误分类：完整调用边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "timeout放在TaskGroup外层，所以预算包括生产者等待、队列等待和上游处理。预算耗尽会取消当前作用域中的任务，TaskGroup继续等待子任务清理，然后timeout上下文在外层把自己的取消转成TimeoutError。调用者应在该上下文之外捕获它；我们把这层放在handle中。"
        },
        {
          "type": "code",
          "code": "async def handle(raw: object) -> dict[str, Any]:\n    metrics = Metrics()\n    try:\n        request = parse_request(raw)\n        values = await run_batch(request, metrics)\n        return {\"ok\": True, \"values\": values, \"metrics\": vars(metrics)}\n    except InputError as error:\n        return {\"ok\": False, \"error\": \"input\", \"detail\": str(error)}\n    except TimeoutError:\n        return {\"ok\": False, \"error\": \"timeout\", \"metrics\": vars(metrics)}\n    except BatchFailed as error:\n        return {\"ok\": False, \"error\": \"upstream\", \"detail\": str(error), \"metrics\": vars(metrics)}\n    # External cancellation deliberately propagates to the caller.\n\n\ndef main() -> None:\n    try:\n        raw = json.load(sys.stdin)\n    except (json.JSONDecodeError, ValueError):\n        print(json.dumps({\"ok\": False, \"error\": \"input\", \"detail\": \"invalid JSON\"}))\n        return\n    print(json.dumps(asyncio.run(handle(raw)), ensure_ascii=False))\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "service.py · 处理入口与CLI",
          "purpose": "配套文件第三段；与前两段合并为完整文件。JSON损坏、业务输入错、批次上游错、总超时分别处理。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "输入错误在创建后台任务前返回error=input；上游受控错误返回error=upstream；总预算耗尽返回error=timeout。只有共同成功才返回values。metrics在清理后读取，因此返回时active应为0，cleaned与started一致。started和cancelled的精确数量受任务先后影响，不把某次输出数量写成全局保证。"
        },
        {
          "type": "paragraph",
          "text": "这里的超时是协作式预算，不是可以在任何Python指令中间强行终止的秒表。如果上游是一个同步死循环，事件循环没有机会投递取消；若真实HTTP请求已让远端扣款，本地取消也不等于退款。写操作需要幂等键、状态查询和重试策略，不能把任务管理工具当分布式回滚。"
        },
        {
          "type": "reference",
          "title": "Python 3.12：asyncio.timeout转换与捕获边界",
          "url": "https://docs.python.org/3.12/library/asyncio-task.html#timeouts"
        }
      ]
    },
    {
      "id": "s7-167119",
      "title": "运行、输入与预期输出：把证据留在这里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-async-services\npython3 --version\npython3 -m venv .venv\n.venv/bin/python -m unittest -v\nprintf '%s' '{\"values\":[0,1,2,3,4],\"workers\":2,\"queue_size\":2}' | .venv/bin/python service.py",
          "filename": "终端",
          "purpose": "独立示例，无需安装第三方包；使用Python3.12时可把第一条python3替换为python3.12。后续都使用同一虚拟环境。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "{\"ok\":true,\"values\":[0,1,4,9,16],\"metrics\":{\"active\":0,\"peak_active\":2,\"peak_queue\":2,\"started\":5,\"finished\":5,\"cleaned\":5,\"cancelled\":0}}",
          "filename": "成功示例输出",
          "purpose": "本次CPython3.14.3实际一次输出；peak值是观测值，验收条件是<=配置，不保证所有运行恰好等于2。",
          "language": "json",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "printf '%s' '{\"values\":[1,2,3],\"fail_on\":1}' | .venv/bin/python service.py\nprintf '%s' '{\"values\":[1,2],\"delay\":1,\"timeout\":0.01}' | .venv/bin/python service.py\nprintf '%s' '{\"values\":[true]}' | .venv/bin/python service.py",
          "filename": "终端 · 三种失败",
          "purpose": "依次期待error=upstream、timeout、input。前两者返回时active=0，已经启动的处理完成finally。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本次实际运行9项unittest全部通过：注解不校验的反例、非法输入及非有限预算、顺序和容量、空输入与零结果、兄弟失败取消、总超时清理、外部取消传播、错误分类、固定后台任务数。没有安装HTTP客户端、没有调用真实服务，所以这些证据证明本地生命周期和边界规则，不是网络吞吐或模型效果。"
        },
        {
          "type": "paragraph",
          "text": "若成功输出不对，先查解释器版本和运行文件，再核对values顺序与输入类型；若超时后active不归零，检查上游是否有finally和可取消等待；若内存随输入暴涨，先看是否提前create_task全部项、是否累积输入和结果。不同问题对应不同边界，不需要从“async写错了”一个结论开始猜。"
        }
      ]
    },
    {
      "id": "check-understanding",
      "title": "最后用三个判断检查你的模型",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "判断",
            "解析"
          ],
          "rows": [
            [
              "async函数里只写同步循环，会不会因为函数名async就同时执行？",
              "不会。调用先产生协程；执行后同步代码仍占着事件循环线程，直到返回或到达能让出的等待。"
            ],
            [
              "有队列容量2，整个程序是否只保存2项数据？",
              "不是。输入tuple和结果数组都有n项，worker还有正在处理的数据；队列只约束等待区，本例明确限制n<=10000。"
            ],
            [
              "timeout返回以后，远端写入是否已经撤销？",
              "不能这样推断。这里仅验证本地任务清理；远端已发生的副作用需要幂等协议和状态确认。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这份实现适合解释一个有限批次怎样拥有自己的任务、预算和结果。若改成长期服务，还要补请求体大小、连接池、独立请求配额、停止接收与优雅停机；若改成百万项流水线，还要把输入读取和结果写出也流式化。先把这次操作的边界闭合，再扩展规模，比先把并发数调大更能得到可解释的系统。"
        }
      ]
    }
  ],
  "questionIds": [
    "python-async-services-cancel",
    "python-async-services-semaphore"
  ],
  "references": [
    {
      "title": "Python3.12 asyncio任务与取消",
      "url": "https://docs.python.org/3.12/library/asyncio-task.html"
    },
    {
      "title": "Python3.12有界队列",
      "url": "https://docs.python.org/3.12/library/asyncio-queue.html"
    },
    {
      "title": "Python3.12类型注解",
      "url": "https://docs.python.org/3.12/library/typing.html"
    }
  ],
  "status": "review",
  "kind": "tutorial",
  "labMinutes": 30,
  "versions": [
    "目标兼容 CPython 3.12",
    "实际验证 CPython 3.12.14 / 3.14.3（macOS）",
    "仅使用标准库，无第三方依赖"
  ],
  "verifiedAt": "2026-10-23",
  "examples": [
    {
      "label": "完整标准库实验与测试",
      "path": "python-async-services.zip"
    },
    {
      "label": "运行与边界说明",
      "path": "python-async-services/README.md"
    }
  ]
};
export default article;
