import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-concurrency-models",
  "topic": "python",
  "title": "Python 并发入门：先看顺序执行，再认识线程和进程",
  "description": "把多个任务先顺序执行，再交给线程池和进程池。看懂任务、结果和错误以后，才解释并发、并行及 GIL。",
  "minutes": 45,
  "tags": [
    "Python 并发",
    "线程",
    "进程",
    "线程池",
    "GIL"
  ],
  "scope": "使用少量固定任务学习执行方式。等待由 sleep 模拟，没有网络性能或吞吐排名；不实现大规模任务调度器。",
  "prerequisites": [
    "已经掌握普通函数、列表、import、with和基本异常处理"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython 3.12.14"
  ],
  "verifiedAt": "2026-10-26",
  "labMinutes": 30,
  "questionIds": [],
  "examples": [
    {
      "label": "Python 课程与新入门示例 ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "从这里开始：九篇顺序、文件与命令",
      "path": "python-course/beginner/README.md"
    }
  ],
  "references": [
    {
      "title": "Python3.12：线程池、进程池与Future",
      "url": "https://docs.python.org/3.12/library/concurrent.futures.html"
    },
    {
      "title": "Python3.12：进程启动与安全导入入口",
      "url": "https://docs.python.org/3.12/library/multiprocessing.html#safe-importing-of-main-module"
    },
    {
      "title": "Python3.12：线程与GIL说明",
      "url": "https://docs.python.org/3.12/library/threading.html"
    }
  ],
  "sections": [
    {
      "id": "models",
      "title": "先分清：顺序、并发、并行分别在说什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "顺序执行是做完第一件事，再做第二件事。并发是在一段时间里推进多件事，例如一件事等待时，先推进另一件事；并行是同一时刻真的有多份计算在不同执行资源上运行。它们不是三个从低级到高级的等级，而是不同的组织方式。"
        },
        {
          "type": "paragraph",
          "text": "如果一个任务只是计算数字，能否同时计算很重要；如果它大部分时间在等外部响应，能否把等待重叠起来更重要。先看函数到底在做计算还是等待，再选工具，比先背“Python用线程还是进程”更有用。"
        },
        {
          "type": "figure",
          "src": "/figures/python-concurrency-models/capacity.svg",
          "title": "同样三件事，可以怎样安排",
          "alt": "上方顺序一次只处理一项；下方两个工作位置同时推进，第三项等前一个位置空出再执行。",
          "caption": "这是执行安排的示意图，不是性能实测。每项的等待时间由示例人为设置，不能据图推出生产环境提速比例。 手机端可以在图形区域横向滑动查看。"
        }
      ]
    },
    {
      "id": "jobs",
      "title": "这里的一次任务，就是一次普通函数调用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import time\nimport multiprocessing\nfrom concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor",
          "language": "python",
          "purpose": "本篇例子需要这三条标准库导入。把它们放在同一个练习文件顶部，后面的函数就能使用 time、线程池和进程池。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "time提供这里的sleep；concurrent.futures提供线程池与进程池；multiprocessing用于选择进程启动方式。它们都是标准库，不需要pip安装。先准备好这些名字，再看任务函数。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/concurrency_demo.py",
          "code": "def read_title(number):\n    if number < 0:\n        raise ValueError(\"编号不能为负数\")\n    time.sleep(0.01)  # 模拟等待；本例没有访问网络\n    return f\"笔记{number}\"\n\n\ndef square(number):\n    return number * number",
          "purpose": "read_title 模拟等待后返回标题；square 做一个小计算。两个函数先按普通函数理解。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "read_title(1) 在等待0.01秒后返回“笔记1”，并没有访问真实网络。time.sleep 让当前执行它的线程等待。square(3) 返回9，用来演示进程怎样接收输入并返回结果。我们不拿这样小的计算测试哪个方案更快，因为创建进程的成本可能比计算本身还大。"
        },
        {
          "type": "code",
          "code": "result = []\nfor number in [1, 2, 3]:\n    result.append(read_title(number))\nprint(result)",
          "language": "python",
          "purpose": "接在 read_title 定义之后。这是完全顺序的写法，结果返回后才开始下一次调用。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['笔记1', '笔记2', '笔记3']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这个顺序版本也是重要的对照。改成并发以后，任务实际开始和结束顺序可以变化，但如果业务仍要求结果按原输入排列，就需要检查最终返回顺序，而不是只看终端里好像打印得更快。"
        }
      ]
    },
    {
      "id": "window",
      "title": "线程池：给几个工作线程分配任务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/concurrency_demo.py",
          "code": "def threaded_titles(numbers):\n    with ThreadPoolExecutor(max_workers=2) as pool:\n        return list(pool.map(read_title, numbers))",
          "purpose": "完整线程池函数。ThreadPoolExecutor 负责管理工作线程，map 把每个输入交给 read_title。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "线程是在同一个进程中推进工作的执行单位。这里 max_workers=2，表示最多两个工作线程执行这些调用；三条输入中剩下的一条等有线程空出再处理。with 结束前，线程池会按这里的正常使用方式等待任务结束并收好资源。"
        },
        {
          "type": "paragraph",
          "text": "pool.map(read_title,numbers) 表示对每个数字调用 read_title。函数名不带括号，是把这项操作交给线程池；不是先调用一次，再把字符串结果交出去。list 把结果取出来组成列表。这个基本写法只适合当前少量数据，max_workers 本身不限制你提交多少个任务对象。"
        }
      ]
    },
    {
      "id": "io",
      "title": "返回顺序与实际完成顺序，要分开理解",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "print(threaded_titles([3, 1, 2]))",
          "language": "python",
          "purpose": "接在前面函数定义及文件顶部导入之后。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['笔记3', '笔记1', '笔记2']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "map 的结果按输入顺序提供，所以输入是3、1、2，结果也是对应的顺序。这不说明任务一定按3、1、2结束。若改用其他接收方式，例如按完成先后取结果，需要另外保留编号，才能放回原位置。当前先会用一种清楚的返回规则，不急着把所有 Future API 都学完。"
        },
        {
          "type": "paragraph",
          "text": "线程共享同一进程里的对象。当前 read_title 不去修改全局列表，而是返回自己的结果，由调用方统一收集，比较容易理解。若多个线程要改同一个可变对象，就要考虑谁先改、修改能否交错，以及是否需要锁；“这次没出错”不能说明任何共享修改都安全。"
        }
      ]
    },
    {
      "id": "spawn",
      "title": "进程池：用独立的 Python 进程做计算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/concurrency_demo.py",
          "code": "def process_squares(numbers):\n    context = multiprocessing.get_context(\"spawn\")\n    with ProcessPoolExecutor(max_workers=2, mp_context=context) as pool:\n        return list(pool.map(square, numbers))",
          "purpose": "完整进程池函数。spawn 启动新的解释器进程，square 是文件顶层定义的普通函数。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "print(process_squares([1, 2, 3]))",
          "language": "python",
          "purpose": "放入完整脚本的 __main__ 入口中运行；不要把这一行放在每次导入都会执行的位置。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "[1, 4, 9]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "不同进程有自己的内存和解释器，不能把父进程的普通列表当成大家都能直接修改的共享列表。输入、任务信息和结果需要经过进程之间的传递；因此进程的创建和通信有成本，不适合为了三次简单加法就默认使用。"
        },
        {
          "type": "paragraph",
          "text": "本例把 square 定义在文件顶层，并使用第四篇介绍的 __main__ 运行开关。spawn 启动新进程时会重新导入相关代码；没有这个开关，导入时又启动进程池，就可能反复创建子进程。初学者请从保存好的 .py 文件运行完整示例，不要先在交互窗口里零散试进程池。"
        }
      ]
    },
    {
      "id": "gil",
      "title": "现在再认识 GIL，不把它当一句万能结论",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "在本篇使用的常规 CPython3.12里，同一个进程通常同一时刻只有一个线程执行 Python 字节码，这与 GIL 有关。因此，把主要由 Python 代码组成的重计算拆给几个线程，通常不能简单地让多个核心一起计算；独立进程则各自执行。"
        },
        {
          "type": "paragraph",
          "text": "这不等于线程没用。等待 I/O 时，或者某些底层库执行并释放相关限制时，其他线程仍有推进机会。你需要看实际工作种类和所用库，而不是只看到“有GIL”就否定全部多线程，也不要把本篇结论不加区分地套到其他Python实现或构建。"
        },
        {
          "type": "table",
          "headers": [
            "现在遇到的工作",
            "可以先考虑",
            "本篇例子"
          ],
          "rows": [
            [
              "少量很快的计算",
              "顺序执行",
              "普通for即可"
            ],
            [
              "多个主要在等待的同步调用",
              "少量线程",
              "threaded_titles"
            ],
            [
              "独立且较重的Python计算",
              "评估进程",
              "process_squares演示传递方式"
            ],
            [
              "本来就提供async接口的等待",
              "下一篇asyncio",
              "不是把所有函数加async就能变快"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "最终仍要测自己的任务。本篇没有真实网络、没有大数据，也不发布耗时排名；它先帮你弄清选择背后的原因和程序怎样运行。"
        }
      ]
    },
    {
      "id": "async",
      "title": "失败发生在线程里，调用方怎样知道",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "with ThreadPoolExecutor(max_workers=2) as pool:\n    future = pool.submit(read_title, -1)\n    try:\n        future.result()\n    except ValueError as error:\n        print(\"任务失败：\", error)",
          "language": "python",
          "purpose": "本例完整文件已经包含所需导入和 read_title。submit 返回代表将来结果的 Future，result 取结果或带出错误。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "任务失败： 编号不能为负数",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "submit 先返回 Future，工作线程随后执行函数；result 会等待并取到结果。如果函数抛异常，result 会把异常带到调用方。这和“另一个线程失败了，主程序就自动知道全部细节”不同，调用方仍然需要检查结果。"
        },
        {
          "type": "paragraph",
          "text": "给等待设置超时，通常只表示不再继续等这个结果，并不代表能强制杀掉已经运行的线程。下一篇会学协作式取消，先知道这个区别，避免将“界面不等了”误当成“工作已经停止”。"
        }
      ]
    },
    {
      "id": "cli",
      "title": "运行完整示例，先观察结果是否一致",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 concurrency_demo.py",
          "language": "bash",
          "purpose": "必须从真实文件运行，默认使用两个线程或两个进程，没有第三方依赖。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "顺序： ['笔记1', '笔记2', '笔记3']\n线程： ['笔记1', '笔记2', '笔记3']\n进程： [1, 4, 9]\n任务失败： 编号不能为负数",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "三个正常结果和一个受控错误都应出现。若进程启动报错，先检查是否直接运行文件、是否保留 __main__ 判断、任务函数是否仍在文件顶层。不要第一步就修改机器上的全局进程启动设置。"
        }
      ]
    },
    {
      "id": "evidence",
      "title": "练习：先知道要保持什么，再改执行方式",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "练习一：把输入改为 [3,1,2]，线程 map 的返回值应保持这个输入对应的顺序。练习二：把 max_workers 改为1，结果内容仍然相同，只是允许同时推进的工作位置变少。不要仅凭一次打印看不出差别就认定线程池没有生效。"
        },
        {
          "type": "paragraph",
          "text": "练习三：为 square 加一个参数检查，给负数抛 ValueError，再从主进程读取结果，观察错误怎样回来。你已经学会函数、异常和模块，进程没有让这些基本规则消失，只是改变了任务执行的位置。"
        },
        {
          "type": "paragraph",
          "text": "到这里，线程和进程已经有了具体用途。下一篇认识第三种方式：在一个事件循环里，让多个可等待操作交替推进。我们仍然先从一个等待和两条任务开始，不一上来就写工作队列。"
        }
      ]
    }
  ]
};
export default article;
