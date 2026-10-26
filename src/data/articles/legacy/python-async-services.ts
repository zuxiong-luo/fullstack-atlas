import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-async-services",
  "topic": "python",
  "title": "Python 异步入门：一步步理解 async、await 和任务",
  "description": "从一个等待示例开始，看清协程怎样运行，再一起等待两项任务，最后练习超时、取消和分批处理。",
  "minutes": 55,
  "tags": [
    "asyncio",
    "async",
    "await",
    "Task",
    "超时",
    "取消"
  ],
  "scope": "本篇是 asyncio 的入门实验，sleep 只模拟等待，不调用网络。先认识基本执行方式，TaskGroup作为后面的选读；原有队列处理器仍可下载作进阶练习。",
  "prerequisites": [
    "理解普通函数、return、列表、异常与import",
    "读过上一篇，知道等待与计算、并发与并行的区别"
  ],
  "sections": [
    {
      "id": "s11-324665",
      "title": "async 和 await：先从一个会等待的函数开始",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "async 用来定义一种可以等待异步操作的函数，await 表示等待某个可等待操作完成。它们适合协调许多等待，例如等待网络响应；不会把普通计算自动分配给更多CPU。先不创建任务组，只运行下面这个最小文件。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/async_first.py",
          "code": "import asyncio\n\n\nasync def say_hello():\n    print(\"开始等待\")\n    await asyncio.sleep(0.01)\n    print(\"你好，Python\")\n\n\nif __name__ == \"__main__\":\n    asyncio.run(say_hello())",
          "purpose": "完整第一步：导入asyncio，定义异步函数，通过asyncio.run启动。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "开始等待\n你好，Python",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "async def say_hello 和前面的 def 形状接近，只是多了 async。await asyncio.sleep(0.01) 模拟一次可以被异步等待的操作；它没有真的访问网络。等待结束后，才打印“你好，Python”。asyncio.run 为这个入口建立并运行事件循环，结束后收好相应资源。"
        },
        {
          "type": "paragraph",
          "text": "调用 say_hello() 得到的是一个协程对象，不会像普通函数一样立即把函数体完整跑完。这里把它交给 asyncio.run 才开始驱动它。不要一开始就只写 say_hello() 然后疑惑为什么没有输出，也不要在普通 def 里面随意写 await。"
        }
      ]
    },
    {
      "id": "s15-398808",
      "title": "协程、任务和事件循环，用一次实际执行来区分",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "协程描述一段可以暂停再继续的执行过程；Task 是交给事件循环安排运行的任务；事件循环则负责在可运行的任务之间安排推进。先有一个具体问题：A在等待时，能不能先让B开始？如果你只是 await A 后再 await B，仍然要等A结束才开始B。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/async_demo.py",
          "code": "async def compare_orders():\n    events = []\n\n    async def step(name):\n        events.append(name + \"开始\")\n        await asyncio.sleep(0)\n        events.append(name + \"结束\")\n\n    await step(\"A\")\n    await step(\"B\")\n    sequential = events.copy()\n    events.clear()\n    await asyncio.gather(step(\"A\"), step(\"B\"))\n    return sequential, events",
          "purpose": "compare_orders 在同一个小例子里对照顺序等待与一起等待。step记录开始和结束，sleep(0)主动给其他任务推进的机会。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一次先 await step(\"A\")，所以顺序是A开始、A结束、B开始、B结束。第二次 gather 同时组织两个协程，A遇到等待时B也能开始，本例得到A开始、B开始、A结束、B结束。这里的事件记录帮助你看清先后，不需要拿一组不稳定的毫秒数猜测。"
        },
        {
          "type": "figure",
          "src": "figures/python-async-services/lifecycle.svg",
          "title": "一个事件循环怎样推进两个等待任务",
          "alt": "A开始后遇到等待，让B开始；A、B分别在等待完成后继续。普通计算仍在当前执行线程上推进。",
          "caption": "这张图表示本例可等待步骤的交错，不表示两个CPU在并行计算。await只有在等待对象尚未完成等情况下才有让出执行的机会。 手机端可以在图形区域横向滑动查看。"
        }
      ]
    },
    {
      "id": "s12-316434",
      "title": "一起等待多个结果，和显式创建任务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/async_demo.py",
          "code": "async def read_title(number, delay=0):\n    if number < 0:\n        raise ValueError(\"编号不能为负数\")\n    await asyncio.sleep(delay)  # 模拟等待，不是网络请求\n    return f\"笔记{number}\"",
          "purpose": "read_title 是一个可等待的函数，完成后仍通过return交回普通字符串。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import asyncio\n\nasync def main():\n    values = await asyncio.gather(read_title(1), read_title(2))\n    print(values)\n\nasyncio.run(main())",
          "language": "python",
          "purpose": "read_title 定义放在这段代码之前；本段演示调用关系。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['笔记1', '笔记2']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "gather 的返回列表按传入顺序排列，并不要求实际完成顺序也相同。若想先启动一个任务、稍后再等它，可以用 task = asyncio.create_task(read_title(1))，然后在需要结果的位置 await task。保存这个task，后面才能等待、检查或请求取消它。"
        },
        {
          "type": "paragraph",
          "text": "如果调用的是会阻塞线程的普通函数，给外面加一个 async 包装并不会改变内部行为。比如异步函数里直接 time.sleep(1)，会让当前事件循环线程也等住。已经提供async接口的操作用await；同步的慢I/O要考虑线程等方式，不要见到函数就批量加async。"
        }
      ]
    },
    {
      "id": "s16-495396",
      "title": "任务很多时，先用最直观的分批方式",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "初学阶段可以先把五项工作每两项分一批。当前批次全部得到结果，再启动下一批。这样不需要马上学习工作队列，也能避免把所有输入一次性创建成任务。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/async_demo.py",
          "code": "async def read_in_batches(numbers, batch_size=2):\n    if type(batch_size) is not int or batch_size < 1:\n        raise ValueError(\"每批数量必须是正整数\")\n    result = []\n    for start in range(0, len(numbers), batch_size):\n        batch = numbers[start:start + batch_size]\n        waiting = []\n        for number in batch:\n            waiting.append(read_title(number))\n        values = await asyncio.gather(*waiting)\n        result.extend(values)\n    return result",
          "purpose": "完整分批实现。先切出一小批，建立待等待的协程列表，再等待并收集结果。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "start 从0、2、4推进，切片每次最多取batch_size项。waiting 中存的是当前批次的协程；gather(*waiting) 的星号把列表里的各项作为多个参数传入，例如列表有两项时，效果类似 gather(first,second)。这不是把一个列表直接当作协程等待。"
        },
        {
          "type": "paragraph",
          "text": "结果列表仍保存了全部返回值，所以这不是无限数据的低内存方案。并且快的一项可能要等同批次较慢的一项，才开始下一批。这是简单分批的取舍；以后确实需要让空出的工作位置立刻接新任务时，再学习原有进阶示例里的固定worker和队列。信号量只限制同时进入某段工作的人数，本身不会减少已经创建的任务数量。"
        }
      ]
    },
    {
      "id": "failure-cleanup",
      "title": "取消：提出停止请求，再等待任务收尾",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/async_demo.py",
          "code": "async def cancellable(events):\n    try:\n        events.append(\"开始\")\n        await asyncio.sleep(1)\n        events.append(\"完成\")\n    finally:\n        events.append(\"清理\")\n\n\nasync def cancel_example():\n    events = []\n    task = asyncio.create_task(cancellable(events))\n    await asyncio.sleep(0)  # 让任务进入等待\n    task.cancel()\n    try:\n        await task\n    except asyncio.CancelledError:\n        events.append(\"已取消\")\n    return events",
          "purpose": "cancellable 用finally记录收尾；cancel_example启动任务后请求取消，再等待它退出。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "task.cancel() 是请求取消，不是把Python代码瞬间从任何位置强制切断。在这里任务正等着 asyncio.sleep，会收到 CancelledError；finally 仍执行，所以记录先有“开始”，接着“清理”。调用方 await task，并专门接住 CancelledError，再记录“已取消”。"
        },
        {
          "type": "code",
          "code": "['开始', '清理', '已取消']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "finally 用来放不论正常还是失败都需要执行的收尾。真正处理网络连接或临时资源时，收尾动作要放到适当位置。不要捕获取消后只打印一句话就假装成功，调用方需要知道任务没有正常完成。也不要认为本地取消能自动撤销已经完成的外部写入。"
        }
      ]
    },
    {
      "id": "timeout-boundary",
      "title": "超时：给这一次等待设一个期限",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/async_demo.py",
          "code": "async def timeout_example():\n    events = []\n    try:\n        async with asyncio.timeout(0.01):\n            await cancellable(events)\n    except TimeoutError:\n        events.append(\"超时\")\n    return events",
          "purpose": "timeout包住需要受限的一段异步等待；超时以后，在外层处理TimeoutError。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['开始', '清理', '超时']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这次操作只允许0.01秒，而 cancellable 在等1秒，所以会走超时路径。先发生任务取消与finally清理，再由timeout在外层表现为TimeoutError。把catch写在外层，才是在处理这个超时作用域带出的结果。"
        },
        {
          "type": "paragraph",
          "text": "它仍依赖任务在可取消等待点配合。如果内部用一段很长的同步循环占着线程，事件循环没有机会及时处理超时，就不能指望到点强制抢占。这里也没有真实HTTP，因此示例证明的是本地等待、超时与清理关系，不是远端请求停止计费。"
        }
      ]
    },
    {
      "id": "task-group",
      "title": "选读：一组任务要共同成功时，认识TaskGroup",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/async_demo.py",
          "code": "async def all_or_fail(numbers):\n    async with asyncio.TaskGroup() as group:\n        tasks = []\n        for number in numbers:\n            tasks.append(group.create_task(read_title(number)))\n    return [task.result() for task in tasks]",
          "purpose": "TaskGroup把这些任务放在同一范围，正常退出后再取各自结果。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "async with TaskGroup 表示在这一段范围里管理相关任务。某项以普通异常失败时，它会取消尚未结束的兄弟任务，等待它们收尾，再把一组错误带出。已经完成的操作不会因此自动回滚。gather默认会把一个普通异常传给调用方，但不会因此自动取消所有其他任务，不能把两者的失败行为混为一谈。"
        },
        {
          "type": "paragraph",
          "text": "如果输入含-1，read_title会抛ValueError，TaskGroup带出的通常是ExceptionGroup。需要处理其中某类异常时可用except*。这是处理“一组错误中符合某种类型的部分”的语法，不等同于普通except；刚开始可以先完成正常路径，再回来运行这个反例。"
        },
        {
          "type": "code",
          "code": "async def try_group():\n    try:\n        await all_or_fail([1, -1])\n    except* ValueError:\n        print(\"任务组里有无效编号\")\n\nasyncio.run(try_group())",
          "language": "python",
          "purpose": "接在all_or_fail、read_title定义和asyncio导入之后。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "任务组里有无效编号",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "s7-167119",
      "title": "把每一步运行出来，不先背API列表",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 async_first.py\npython3 async_demo.py",
          "language": "bash",
          "purpose": "第一个文件只演示一个等待；第二个文件逐项运行顺序对照、结果、分批、取消、超时和任务组。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "笔记1\n顺序： ['A开始', 'A结束', 'B开始', 'B结束']\n一起等： ['A开始', 'B开始', 'A结束', 'B结束']\n['笔记1', '笔记2', '笔记3']\n取消： ['开始', '清理', '已取消']\n超时： ['开始', '清理', '超时']\n任务组： ['笔记1', '笔记2']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第二个文件的“顺序”与“一起等”是本次规定代码和默认执行安排下的观察值。真实网络的完成顺序会变化，要检查的是程序承诺的结果顺序、出错时是否通知和资源是否收好，而不是要求所有程序都打印同样的调度轨迹。"
        }
      ]
    },
    {
      "id": "check-understanding",
      "title": "练习与下一篇：先确认基本模型已经清楚",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "练习一：只调用read_title(1)，没有run、await或创建Task，为什么拿不到“笔记1”？因为你得到的是尚未由这些方式驱动的协程。练习二：把batch_size改为1，结果仍应是同样三个标题，只是每批只有一项。"
        },
        {
          "type": "paragraph",
          "text": "练习三：在cancellable的finally里多记录一项，分别运行取消与超时；两条路径都应经过这个位置。理解了这个现象，再去设计真正的连接关闭和任务清理，才不会只写一句“保证资源释放”。"
        },
        {
          "type": "paragraph",
          "text": "下一篇会用FastAPI把笔记本开放成一个本地HTTP服务。它会用到函数、类、模块和这里的异步入口，不过我们仍然先解释一次请求和一次返回，不从依赖注入与后台任务的名词清单开始。原有队列处理器单独保留为进阶下载，想先学接口可以暂时不读。"
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
      "title": "Python3.12：协程、Task、超时与取消",
      "url": "https://docs.python.org/3.12/library/asyncio-task.html"
    },
    {
      "title": "Python3.12：asyncio入门",
      "url": "https://docs.python.org/3.12/library/asyncio.html"
    },
    {
      "title": "Python3.12：异常分组与except*",
      "url": "https://docs.python.org/3.12/tutorial/errors.html#raising-and-handling-multiple-unrelated-exceptions"
    }
  ],
  "status": "complete",
  "kind": "series",
  "labMinutes": 30,
  "versions": [
    "CPython 3.12.14"
  ],
  "verifiedAt": "2026-10-26",
  "examples": [
    {
      "label": "Python 课程与新入门示例 ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "从这里开始：九篇顺序、文件与命令",
      "path": "python-course/beginner/README.md"
    },
    {
      "label": "选读：原有批次处理器与取消测试",
      "path": "python-async-services.zip"
    }
  ]
};
export default article;
