import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-functions-iteration",
  "topic": "python",
  "title": "Python 函数：从 def、参数和 return 开始",
  "description": "先写一个计算学习时长的函数，再学参数、返回值、局部变量和默认值。用小笔记程序组合起来，闭包和生成器放在最后选读。",
  "minutes": 50,
  "tags": [
    "Python 函数",
    "参数",
    "return",
    "作用域",
    "迭代",
    "生成器"
  ],
  "scope": "第二篇以普通函数为主，不要求先懂文件、JSON、框架或处理管道。最后的闭包和生成器为选读，不影响学习下一篇普通类。",
  "prerequisites": [
    "读过第一篇，能看懂变量、字符串、列表、字典、if和for"
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
      "title": "Python3.12：定义函数、参数与默认值",
      "url": "https://docs.python.org/3.12/tutorial/controlflow.html#defining-functions"
    },
    {
      "title": "Python3.12：作用域与名称",
      "url": "https://docs.python.org/3.12/tutorial/classes.html#python-scopes-and-namespaces"
    },
    {
      "title": "Python3.12：迭代器与生成器",
      "url": "https://docs.python.org/3.12/tutorial/classes.html#generators"
    }
  ],
  "sections": [
    {
      "id": "functions-as-parts",
      "title": "函数是什么：给一段操作起名字",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "函数是可以反复调用的一段代码。比如你有多个地方都要计算“原来学了多少分钟，再增加多少分钟”，每次复制一段加法很容易改漏。把这段操作定义成 add_minutes，以后只要提供不同数字，就能重复使用它。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def add_minutes(current, extra):\n    total = current + extra\n    return total",
          "purpose": "先看函数定义，下一段给出调用。定义时函数体不会立刻运行。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "print(add_minutes(20, 10))",
          "language": "python",
          "purpose": "和上一段函数定义放在同一个文件里，写在定义之后。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "30",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "def 表示定义函数，后面是你起的函数名。括号里的 current、extra 是参数，表示调用时需要提供的数据；冒号后的缩进部分是函数体。add_minutes(20, 10) 才是一次调用，它把20交给 current，把10交给 extra，计算出30，再通过 return 交回调用处。"
        },
        {
          "type": "figure",
          "src": "/figures/python-functions-iteration/flow.svg",
          "title": "一次函数调用怎样返回结果",
          "alt": "调用 add_minutes(20,10)，参数 current 和 extra 分别得到20和10，函数计算 total=30，再把结果返回调用处。",
          "caption": "看清调用发生前的输入，以及 return 之后的结果。函数名、参数名和实际传入的值不是同一种东西。 手机端可以在图形区域横向滑动查看。"
        }
      ]
    },
    {
      "id": "parameters",
      "title": "参数：按位置传，或者写清名字",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "调用中的20、10叫实参，函数定义里的 current、extra 叫形参。先记住它们的对应关系，不必为了两个名字停下来背定义。你可以按位置写 add_minutes(20,10)，也可以按名字写 add_minutes(current=20,extra=10)。写名字时先后次序可以不同，但名字必须和定义对应。"
        },
        {
          "type": "code",
          "code": "print(add_minutes(current=20, extra=10))\nprint(add_minutes(extra=5, current=20))",
          "language": "python",
          "purpose": "接在 add_minutes 定义后运行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "30\n25",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "少给一个必需参数会得到 TypeError；拼成 extrra 也不是一个新参数，而是写错名字。括号可以留给没有参数的函数，但是否允许空着由定义决定。不要把 print(add_minutes) 和 print(add_minutes(20,10)) 混在一起：前者显示函数这个对象，后者先调用，再显示计算结果。"
        }
      ]
    },
    {
      "id": "return-values",
      "title": "return 和 print 分别做什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "print 把内容显示到终端，return 把结果交给调用处，二者的用途不同。只打印结果的函数不一定能让其他计算继续使用这个结果。如果函数执行到最后没有 return，就会返回 None。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def show_title(title):\n    print(title)",
          "purpose": "show_title 只负责显示，没有显式返回值。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "value = show_title(\"学习函数\")\nprint(value)",
          "language": "python",
          "purpose": "和 show_title 定义放在同一个文件里。第一行函数内部打印标题，第二次打印才显示返回值。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "学习函数\nNone",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "回到 add_minutes，它返回数字，所以可以把结果保存到 total_minutes，也能继续传给另一个函数。return 一旦执行，这次函数调用就结束，后面同一条执行路径的语句不会继续跑。初学时先让一个函数做好一件事，返回一个明确结果，比把计算和所有打印都搅在一起更容易检查。"
        }
      ]
    },
    {
      "id": "scope",
      "title": "局部变量：函数里面的名字有自己的范围",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "add_minutes 里的 total 是局部变量，通常只在这次函数调用中使用。调用者即使也有名叫 total 的变量，也不是函数里自动共享的同一个名字。你可以通过 return 把值交出来，再由调用者决定用什么名字保存。"
        },
        {
          "type": "code",
          "code": "total = 100\nanswer = add_minutes(20, 10)\nprint(total)\nprint(answer)",
          "language": "python",
          "purpose": "接在函数定义后运行；函数内的局部 total 不会把外面的 total 改成30。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "100\n30",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这不等于传给函数的数据都会被复制。给函数一个列表，它如果调用 append 修改这个列表，调用方也会看到变化，和第一篇的 alias 例子相同。名字的范围与数据是否被修改是两个问题：前者决定在哪能找到名字，后者决定那个对象的内容有没有变化。"
        }
      ]
    },
    {
      "id": "normalize",
      "title": "从小函数组合出一条笔记",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def clean_title(title):\n    return title.strip()\n\n\ndef make_note(title, done=False):\n    return {\"title\": clean_title(title), \"done\": done}",
          "purpose": "clean_title 返回清理后的标题；make_note 使用它，再组成字典。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "note = make_note(\"  学习函数  \")\nprint(note)\nprint(make_note(\"复习变量\", done=True))",
          "language": "python",
          "purpose": "将两个定义和这段调用放在同一个文件中。done 没有传入时采用默认值 False。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{'title': '学习函数', 'done': False}\n{'title': '复习变量', 'done': True}",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "make_note 的参数 done=False 表示调用者没提供 done 时，使用 False。它不是给所有传入值强行改成 False；显式传 True 仍会保存 True。函数内部先调用 clean_title，得到去空格后的字符串，再返回一个新的字典。读程序时可以顺着这个过程一层层看，不需要先给它取“数据管道”的名字。"
        }
      ]
    },
    {
      "id": "defaults",
      "title": "默认参数里为什么不直接写一个空列表",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "默认参数很方便，但列表有一个需要亲自看结果的细节。函数定义时创建的默认列表会被后续调用继续使用，并不是每次调用都自动新建。下面故意给出一段不符合“每次要新列表”想法的写法。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def bad_labels(label, labels=[]):\n    labels.append(label)\n    return labels",
          "purpose": "反例：默认列表会保留上一次调用的修改。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "print(bad_labels(\"python\"))\nprint(bad_labels(\"web\"))",
          "language": "python",
          "purpose": "在一个刚运行的文件里，接到 bad_labels 定义之后调用。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['python']\n['python', 'web']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果你的意思是“没传列表时，每次新建一个”，可以用 None 作为默认值，再在函数体里创建。这个例子也再次用到第一篇的 None：它表示调用者没有提供一份具体列表。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def add_label(label, labels=None):\n    if labels is None:\n        labels = []\n    labels.append(label)\n    return labels",
          "purpose": "修正：只在没有传入列表时创建一个新的列表。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "print(add_label(\"python\"))\nprint(add_label(\"web\"))",
          "language": "python",
          "purpose": "接在修正版函数定义后运行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['python']\n['web']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "若调用者明确传了一个已有列表，add_label 仍会修改它，这是当前函数写下的行为。如果想返回新列表又不改原来的，应在函数里复制后再追加。先说清函数是否会修改输入，调用时就不容易被意外影响。"
        }
      ]
    },
    {
      "id": "pipeline",
      "title": "把函数和循环放在一起，完成一个小任务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def unfinished_titles(notes):\n    result = []\n    for note in notes:\n        if not note[\"done\"]:\n            result.append(note[\"title\"])\n    return result",
          "purpose": "逐条检查 done，把未完成笔记的标题装进结果列表，最后一次性返回。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "notes = [\n    make_note(\"  学习函数  \"),\n    make_note(\"复习变量\", done=True),\n]\nprint(unfinished_titles(notes))",
          "language": "python",
          "purpose": "接在前面 make_note、clean_title 和 unfinished_titles 的定义之后。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['学习函数']",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带着两条输入看：result 最初是空列表，第一条没完成，追加“学习函数”；第二条已完成，跳过；for 结束后 return result。不要把最后的 return 放进循环，否则看完第一条就会离开函数，后面的笔记根本没有检查。"
        },
        {
          "type": "paragraph",
          "text": "这就是当前阶段需要掌握的组合：小函数各自返回结果，普通循环处理多份数据。只有当你真的遇到重复规则、按需读取或传入不同处理方式时，才需要后面更灵活的写法，不必现在把每个 for 都改成多层函数。"
        }
      ]
    },
    {
      "id": "cli",
      "title": "先运行完整练习，再决定要不要读选读部分",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 functions_demo.py",
          "language": "bash",
          "purpose": "仅下载ZIP时进入 python-course/beginner。这个文件演示本篇函数；不读取外部数据，也不要求先安装第三方库。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "文件先打印30，接着是未完成标题列表、两个相互独立的标签列表，再演示后面的函数传递与生成器。你可以只复制前面的小函数练习，不必一次背完整文件。下载文件末尾的 if __name__ == \"__main__\" 用来区分直接运行和被别处导入，第四篇会解释；当前先把函数定义和调用写进自己的 demo.py 就能完成主线。"
        }
      ]
    },
    {
      "id": "lazy",
      "title": "选读：for 之外，还有逐次取值的生成器",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "普通函数通常运行到 return 才把结果交出来。有时你希望一次只给一个值，下次需要时再继续，这时可以使用 yield。包含 yield 的函数会产生生成器；它记住当前执行到哪里，next 向它要下一个值。这个功能不会创建新线程，也不是 async。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def count_to(limit):\n    number = 1\n    while number <= limit:\n        yield number\n        number = number + 1",
          "purpose": "最小生成器：每次 yield 一个数字，然后在下一次请求时继续。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "numbers = count_to(3)\nprint(next(numbers))\nprint(list(numbers))\nprint(list(numbers))",
          "language": "python",
          "purpose": "接在 count_to 定义之后，观察同一个生成器被逐步用完。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "1\n[2, 3]\n[]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一次 next 取到1，生成器停在 yield；list 继续取剩下的2、3直到结束；再取已经耗尽的同一个生成器，只得到空列表。创建 count_to(3) 本身并不会立刻跑完函数体。你可以先把它当作一种逐次给值的方法，文件逐行读取会在下一篇之后再用。"
        }
      ]
    },
    {
      "id": "closure",
      "title": "选读：把一个函数交给另一个函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "函数可以像其他对象一样交给变量、作为参数或作为返回结果。传 clean_title 表示传函数本身；传 clean_title(\" 标题 \") 表示先调用它，再传入返回的字符串。两种写法看起来只差括号，交出去的东西完全不同。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/functions_demo.py",
          "code": "def format_title(title, transform):\n    return transform(title)\n\n\ndef make_prefix(prefix):\n    def attach(title):\n        return prefix + title\n    return attach",
          "purpose": "format_title 接收一个负责转换标题的函数；make_prefix 返回带有特定前缀的新函数。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "print(format_title(\"  标题  \", clean_title))\nadd_prefix = make_prefix(\"笔记：\")\nprint(add_prefix(\"函数\"))",
          "language": "python",
          "purpose": "接在相关函数定义后。此段不影响前面的创建与筛选笔记主线。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "标题\n笔记：函数",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "make_prefix 里面的 attach 使用外层的 prefix。make_prefix 结束后，返回的函数仍能使用那份外层名字，这种现象叫闭包。这里保存的是可以访问的外层绑定，不是给所有外部数据自动做一份深拷贝。先看懂这个十来行的小例子就够了，不需要现在设计复杂函数工厂。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "练习与解析：一个参数、一个返回值和一个循环",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "练习一：把 add_minutes 的 return 删除，会怎样？函数仍能计算 total，但调用方收到 None；print(add_minutes(20,10)) 会显示 None。这能检查你是否区分了“函数里面算过”与“调用方拿到了结果”。"
        },
        {
          "type": "paragraph",
          "text": "练习二：写一个只返回已完成标题的函数。参考 unfinished_titles，唯一需要改变的筛选条件是 if note[\"done\"]，不是复制一套新的笔记数据。练习三：在循环内遇到未完成项时先 append，再继续检查下一项，最后才 return；用三条输入验证没有提前结束。"
        },
        {
          "type": "paragraph",
          "text": "当你能自己写出这三个函数，已经可以进入类与对象。闭包和生成器以后遇到时再回来读也没关系。下一篇会把标题、完成状态和相关操作放进一个 Note 类，重点仍然是一行行看数据怎样变化，不从复杂的 dataclass 校验开始。"
        }
      ]
    }
  ]
};
export default article;
