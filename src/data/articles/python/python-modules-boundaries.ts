import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-modules-boundaries",
  "topic": "python",
  "title": "Python 文件与模块：读写、JSON、异常和 import",
  "description": "先把笔记写进文件，再学读取、错误处理、JSON 和拆分模块。用已经学过的 Note 与 Notebook 组成一个能保存和恢复的小程序。",
  "minutes": 55,
  "tags": [
    "Python 模块",
    "文件",
    "JSON",
    "异常",
    "包",
    "类型注解"
  ],
  "scope": "从小文件和普通模块开始，不先讲复杂包架构或异常分层。示例先在临时目录练习；保存到固定路径时需要明确工作目录和覆盖行为。",
  "prerequisites": [
    "已学前三篇，能看懂函数、列表、字典、类及对象方法"
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
      "title": "Python3.12：模块与包",
      "url": "https://docs.python.org/3.12/tutorial/modules.html"
    },
    {
      "title": "Python3.12：文件与JSON",
      "url": "https://docs.python.org/3.12/tutorial/inputoutput.html"
    },
    {
      "title": "Python3.12：异常处理",
      "url": "https://docs.python.org/3.12/tutorial/errors.html"
    },
    {
      "title": "Python3.12：pathlib",
      "url": "https://docs.python.org/3.12/library/pathlib.html"
    }
  ],
  "sections": [
    {
      "id": "boundary",
      "title": "程序结束后还想保留数据，就需要文件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "前面的 book 只在当前程序运行时存在。退出程序，再运行一遍，之前在内存里添加的笔记不会自己回来。文件能把数据保存下来，下次运行再读取；模块则帮助我们把越来越多的代码分到不同 .py 文件。先从一次写入和读取开始，不急着设计多层工程。"
        },
        {
          "type": "paragraph",
          "text": "本篇先保存普通文字，再保存包含多条笔记的 JSON。最后把 Note、Notebook 和文件操作拆开，看看 import 怎样把它们连起来。你会用到前面已经学过的列表、字典、函数和类；新出现的工具会在使用前解释。"
        }
      ]
    },
    {
      "id": "imports",
      "title": "import：使用已有文件里定义的功能",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "模块通常是一个 Python 文件，里面可以定义函数、类和变量。import math 把 Python 自带的数学模块引入当前文件，随后用 math.sqrt 调用它提供的平方根函数。模块名让你看得出这个功能从哪里来。"
        },
        {
          "type": "code",
          "code": "import math\nprint(math.sqrt(9))",
          "language": "python",
          "purpose": "把这段代码单独保存为 demo.py，再运行 python3 demo.py。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "3.0",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "也可以写 from math import sqrt，随后直接调用 sqrt(9)。两种写法不是两套数学算法，只是把名字放到当前代码中的方式不同。Python 自带的模块叫标准库，不需要先 pip install；以后用到 FastAPI 这样的第三方包时，才需要另外安装。"
        },
        {
          "type": "paragraph",
          "text": "不要把自己的练习文件命名成 json.py 或 math.py，免得和你打算导入的标准库重名。初学阶段把模块都放在明确的练习目录，比先去修改全局导入路径更容易排查。"
        }
      ]
    },
    {
      "id": "ownership",
      "title": "open 和 with：打开文件，用完后关好",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "with open(\"notes_demo.txt\", \"w\", encoding=\"utf-8\") as file:\n    file.write(\"学习 Python\\n复习函数\")\n\nwith open(\"notes_demo.txt\", encoding=\"utf-8\") as file:\n    text = file.read()\n\nprint(text)",
          "language": "python",
          "purpose": "在专门的新练习目录里运行。w 会创建文件，也会覆盖同名文件原有内容。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "学习 Python\n复习函数",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "open 打开文件，\"w\" 表示写入，默认的 \"r\" 表示读取。encoding=\"utf-8\" 指定文字编码，读写双方保持一致，中文才容易正确恢复。file.write 写入文字，file.read 读出文字；换行用字符串中的 \\n 表示。"
        },
        {
          "type": "paragraph",
          "text": "with 后面的缩进范围里可以使用 file；离开这个范围时，文件会被关闭，即使中途发生错误也会执行相应的关闭。这里可以把 with 理解成“在这一段里使用这个资源，结束时做好收尾”。暂时不用先学如何自定义上下文管理器。"
        },
        {
          "type": "paragraph",
          "text": "\"notes_demo.txt\" 是相对路径，相对于启动命令时所在的工作目录，不一定相对于 .py 文件所在目录。找不到文件时先看你在哪个目录运行。想表示更明确的路径，可以使用 pathlib.Path；配套示例用 Path(folder) / \"notes.json\" 表示某个文件夹里的文件，/ 在这里是组合路径，不是做除法。"
        }
      ]
    },
    {
      "id": "errors",
      "title": "错误处理：先看发生了什么，再决定怎样提示",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "try:\n    number = int(\"十二\")\nexcept ValueError:\n    print(\"请输入阿拉伯数字，例如12\")",
          "language": "python",
          "purpose": "把这段代码单独保存为 demo.py，再运行 python3 demo.py。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "请输入阿拉伯数字，例如12",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "try 中写可能失败的操作；只有发生匹配的错误，才进入 except。这里 int 不能把“十二”转换为整数，抛出的 ValueError 被接住，于是程序能给出一条具体提示。不要把所有错误都吞掉后继续输出“成功”，否则你自己也不知道数据有没有处理完。"
        },
        {
          "type": "paragraph",
          "text": "文件不存在通常会得到 FileNotFoundError；JSON 格式损坏会得到 JSONDecodeError，它属于 ValueError。也可以主动 raise ValueError(\"标题不能为空\") 表达当前输入不符合要求。下一段读取笔记时会这样检查：不是把类型名变得高深，而是让错误发生在能够说明原因的位置。"
        }
      ]
    },
    {
      "id": "json",
      "title": "JSON：把列表和字典保存成通用文本",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "JSON 是一种文本格式，常用来保存或传输简单数据。Python 字典不是直接写进文件的一种神奇内存对象；json.dump 会把列表、字典等转成 JSON 文本，json.load 则从文件读 JSON 并恢复为 Python 的基本数据。"
        },
        {
          "type": "code",
          "code": "import json\n\ntext = json.dumps({\"title\": \"学习文件\", \"done\": False}, ensure_ascii=False)\nprint(text)\nrestored = json.loads(text)\nprint(restored[\"done\"])",
          "language": "python",
          "purpose": "把这段代码单独保存为 demo.py，再运行 python3 demo.py。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "{\"title\": \"学习文件\", \"done\": false}\nFalse",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "dumps/loads 处理字符串，dump/load 配合已打开的文件对象。JSON 里布尔值写成 false，Python 里是 False；JSON 的 null 对应 Python 的 None。ensure_ascii=False 让中文按可读文字输出，不是改变笔记本身的内容。"
        },
        {
          "type": "paragraph",
          "text": "JSON 能解析，不代表内容就是我们要的笔记列表。比如 {} 是合法 JSON，但不能按多条笔记遍历；{\"title\":1,\"done\":\"false\"} 也不是当前程序需要的数据。前三篇已经认识了这些类型，现在才有条件逐项检查并给出清楚的错误。"
        }
      ]
    },
    {
      "id": "package",
      "title": "把代码拆成一个小包，完整读写逻辑在这里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "beginner/\n  learning_notes/\n    __init__.py\n    models.py\n    files.py\n  files_demo.py",
          "language": "text",
          "purpose": "这是目录结构，不是 Python 代码。models.py 放第三篇的 Note 和 Notebook；files.py 放下面的读写函数。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带有 __init__.py 的 learning_notes 是本例的一个包，可以把相关模块组织在一起。files.py 里的 from .models import Note, Notebook 表示从同一个包里的 models 模块取这两个类；前面的点表示包内的相对位置，不是文件系统的父目录。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/files.py",
          "code": "import json\nfrom .models import Note, Notebook\n\n\ndef save_book(book, path):\n    with open(path, \"w\", encoding=\"utf-8\") as target:\n        json.dump(book.to_list(), target, ensure_ascii=False, indent=2)\n\n\ndef load_book(path):\n    with open(path, encoding=\"utf-8\") as source:\n        rows = json.load(source)\n    if not isinstance(rows, list):\n        raise ValueError(\"文件最外层应该是列表\")\n    book = Notebook()\n    for row in rows:\n        if not isinstance(row, dict) or set(row) != {\"title\", \"done\"}:\n            raise ValueError(\"每条笔记需要 title 和 done\")\n        if not isinstance(row[\"title\"], str) or not row[\"title\"].strip():\n            raise ValueError(\"标题不能为空\")\n        if not isinstance(row[\"done\"], bool):\n            raise ValueError(\"done 应该是布尔值\")\n        note = Note(row[\"title\"].strip())\n        if row[\"done\"]:\n            note.finish()\n        book.add(note)\n    return book",
          "purpose": "完整文件读写模块。book.to_list 来自第三篇；读取时逐条检查标题和完成状态，再创建 Note。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "save_book 打开目标文件，将普通列表写成 JSON。load_book 先读回基本数据，确认最外层是列表，然后逐条确认字段和类型；创建 Note 后，根据 done 决定是否调用 finish，最后把它加入 Notebook。这里只使用之前认识的 if、for 和类，没有隐藏一个新的转换框架。"
        },
        {
          "type": "paragraph",
          "text": "其中 set(row) 取得字典的键，和 {\"title\",\"done\"} 比较，要求这一版文件恰好包含这两个字段。isinstance 检查某个值是不是指定类型。检查后才调用 strip，能避免把数字当标题时，得到一个难以理解的“没有 strip 属性”错误。"
        },
        {
          "type": "figure",
          "src": "/figures/python-modules-boundaries/modules.svg",
          "title": "两个模块和一个运行入口怎样配合",
          "alt": "files_demo 导入 models 中的类和 files 中的读写函数；files 模块也从同包 models 导入类。",
          "caption": "运行入口负责演示流程，模型文件保存类定义，文件模块负责读写。箭头只表示导入和调用，不是必须照搬的多层架构。 手机端可以在图形区域横向滑动查看。"
        }
      ]
    },
    {
      "id": "types",
      "title": "类型注解：说明你希望传入和返回什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/files_demo.py",
          "code": "def count_notes(book: Notebook) -> int:\n    return len(book)",
          "purpose": "这一段只是说明参数应为 Notebook、结果应为 int；真正的函数仍只做一件事。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "book: Notebook 是参数注解，-> int 是返回值注解。它们给编辑器和检查工具提供线索，不会自动帮你转换数据，也不会让 Python 在每次调用时强制检查。你依然可以先写不带注解的普通函数，等代码开始跨文件配合时，再用注解让接口更容易读。"
        },
        {
          "type": "paragraph",
          "text": "后面服务示例中的 str | None 表示值可以是字符串，也可以是 None；list[str] 表示预期是字符串列表。这些是类型说明，不是新建列表或处理分支的代码。要限制实际数据，仍靠刚才那样的明确检查，或使用专门做校验的库。"
        }
      ]
    },
    {
      "id": "cli",
      "title": "运行入口：为什么示例末尾有 __main__ 判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/files_demo.py",
          "code": "from pathlib import Path\nfrom tempfile import TemporaryDirectory\nfrom learning_notes.models import Note, Notebook\nfrom learning_notes.files import save_book, load_book\n\n\ndef count_notes(book: Notebook) -> int:\n    return len(book)\n\n\nif __name__ == \"__main__\":\n    book = Notebook()\n    book.add(Note(\"把笔记保存到文件\"))\n    with TemporaryDirectory() as folder:\n        path = Path(folder) / \"notes.json\"\n        save_book(book, path)\n        restored = load_book(path)\n        print(restored.to_list())\n        print(count_notes(restored))\n        path.write_text(\"这不是 JSON\", encoding=\"utf-8\")\n        try:\n            load_book(path)\n        except ValueError:\n            print(\"读取失败：请检查文件内容\")",
          "purpose": "完整演示入口。TemporaryDirectory 是标准库工具，离开 with 时会删除这次临时练习目录；不会覆盖你的固定笔记文件。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "直接运行 python3 files_demo.py 时，Python 把该文件的 __name__ 设为 \"__main__\"，于是进入演示部分；被其他文件 import 时，这部分不执行。这样别人能复用 count_notes，而不会仅仅导入它就突然写文件或打印一整屏演示结果。"
        },
        {
          "type": "paragraph",
          "text": "演示新建一本笔记本，写入临时文件，再读取验证，之后故意把文件改成坏内容，观察异常提示。本例结束后临时文件会被清理；如果真的要长期保存，选择自己的固定路径交给 save_book，而不是使用 TemporaryDirectory。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "运行和练习：从能读回，到知道哪里失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 files_demo.py",
          "language": "bash",
          "purpose": "没有第三方依赖，示例自己创建和清理临时目录。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "[{'title': '把笔记保存到文件', 'done': False}]\n1\n读取失败：请检查文件内容",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "练习一：把临时文件内容换成 {}，应该报“文件最外层应该是列表”。练习二：保持列表，但把 done 改成字符串 \"false\"，应该报“done 应该是布尔值”。两个输入都可能是合法 JSON，但不是这个笔记本接受的格式。"
        },
        {
          "type": "paragraph",
          "text": "练习三：把模块拆到目录后，仍从 beginner 目录运行 files_demo.py。若报 attempted relative import with no known parent package，不要直接执行 learning_notes/files.py；它是供包内使用的模块，应由演示入口导入。"
        },
        {
          "type": "paragraph",
          "text": "下一篇开始处理多个独立任务。到这里，文件、函数、类和模块已经能够组成一个完整的小程序；并发不是绕开这些基础，而是在清楚每个函数做什么以后，决定哪些操作可以一起等待。"
        }
      ]
    }
  ]
};
export default article;
