import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "python-language-foundations",
  "topic": "python",
  "title": "Python 入门：语法、对象、容器、控制流与函数",
  "description": "从名字与对象的关系建立语言模型，使用列表、字典、集合和函数写出可验证的笔记导入命令；把语法、业务校验和失败输出放在同一条数据流里。",
  "minutes": 42,
  "tags": [
    "Python",
    "语言基础",
    "对象",
    "容器",
    "CLI"
  ],
  "scope": "Python 阶梯教程前3章，个人笔记导入工具；CPython 3.12.14、标准库、命令行本地实验。从名字与对象的关系建立语言模型，使用列表、字典、集合和函数写出可验证的笔记导入命令；把语法、业务校验和失败输出放在同一条数据流里。",
  "prerequisites": [
    "会使用终端，理解任意一门语言的变量、判断和函数；不要求写过Python"
  ],
  "sections": [
    {
      "id": "language-model",
      "title": "Python 是什么：先把运行方式和语言模型分清",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Python 是一门通用编程语言。本系列使用 CPython，也就是 Python 的一种具体实现；“Python 怎么表达程序”和“CPython 怎么执行程序”是相关但不同的层次。你会在数据脚本、Web 服务和自动化工具里遇到它。这一章先建立语言基础，再用同一套规则处理真实输入，不从框架安装开始。"
        },
        {
          "type": "paragraph",
          "text": "对写过 JavaScript 或 TypeScript 的读者，最值得先调整的是两个习惯：缩进承担语法职责，名字绑定到对象。Python 也有动态类型，但不意味着程序可以随意把所有输入转成字符串。类型是否合适、空值是否允许、重复记录怎么处理，仍然要由程序明确规定。"
        },
        {
          "type": "paragraph",
          "text": "我们要做一个个人知识笔记导入工具。第一章读取一个 JSON 数组，清理标题和标签，拒绝不合法的数据以及重复身份，最后输出一份 JSON。第二章改成逐行读取和筛选，第三章再把内部字典收拢为领域对象。每个阶段保留独立入口，你不用先理解后面的类和异步才能运行这一章。"
        },
        {
          "type": "paragraph",
          "text": "示例实际运行于 CPython 3.12.14，只依赖标准库。正文引用的是 3.12 系列文档，官方页面当前维护版为 3.12.15；这里没有把文档标题当作实测解释器版本。全文不讨论 Web 框架、数据库或性能调优，先把一个小程序的数据和失败路径写清楚。"
        },
        {
          "type": "code",
          "language": "json",
          "filename": "examples/python-course/fixtures/notes.json",
          "kind": "excerpt",
          "purpose": "完整原始输入；三个阶段沿用相同业务数据，第1章为数组，第2/3章每行一条对象。",
          "code": "[\n  {\"id\":\"n1\",\"title\":\"  Python 对象  \",\"tags\":[\"Python\",\" Basics \",\"python\"]},\n  {\"id\":\"n2\",\"title\":\"生成器与迭代\",\"tags\":[\"Python\",\"iterator\"]},\n  {\"id\":\"n3\",\"title\":\"HTTP 请求\",\"tags\":[\"web\"]}\n]\n"
        }
      ]
    },
    {
      "id": "syntax",
      "title": "先会读一段 Python：缩进、表达式和返回值",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "def normalize_title(value):\n    if not isinstance(value, str):\n        raise ValueError(\"title must be a string\")\n    title = value.strip()\n    if not title:\n        raise ValueError(\"title must not be empty\")\n    return title\n\nprint(normalize_title(\"  Python 对象  \"))\n# Python 对象",
          "purpose": "独立小实验；正常输入返回清理后的字符串，改成42会抛ValueError。",
          "kind": "runnable",
          "language": "python"
        },
        {
          "type": "paragraph",
          "text": "def 定义函数，冒号开始一个代码块，后面一致的缩进表示哪些语句属于它。一般使用四个空格，不要把编辑器的 Tab 显示宽度误当作语法规则。函数不会因为被定义就立刻执行；最后的调用才把参数交给函数。return 把对象交回调用处，执行到函数结尾却没有 return 时返回 None。"
        },
        {
          "type": "paragraph",
          "text": "isinstance(value, str) 是运行时类型检查。先检查再调用 strip，是为了让数字输入得到可解释的错误，而不是突然在方法查找时失败。strip 返回去掉两端空白后的新字符串；字符串不可变，原字符串的内容没有被原地改写。raise 表示此处无法产生有效结果，调用者必须处理失败或让异常继续传播。"
        },
        {
          "type": "paragraph",
          "text": "if not title 使用真假判断。空字符串为假，包含字符的字符串为真。要留意 Python 中空列表、空字典和数值零也是假；如果业务允许零，就不要用 if not value 代替“字段缺失”检查。JSON 的 null 被解析为 None，判断是否为这个单例时用 is None。布尔写作 True、False，不能照抄 JavaScript 的小写。"
        },
        {
          "type": "table",
          "headers": [
            "表达式",
            "结果或行为",
            "容易带错的习惯"
          ],
          "rows": [
            [
              "7 / 2",
              "3.5",
              "/不是整数除法"
            ],
            [
              "7 // 2",
              "3",
              "向下取整；-7 // 2是-4"
            ],
            [
              "\"x\" * 3",
              "\"xxx\"",
              "乘法也可重复序列"
            ],
            [
              "len([1, 2])",
              "2",
              "长度用函数，不是.length"
            ],
            [
              "items.append(3)",
              "修改原列表，返回None",
              "不要写items = items.append(3)"
            ]
          ]
        },
        {
          "type": "reference",
          "title": "Python3.12控制流",
          "url": "https://docs.python.org/3.12/tutorial/controlflow.html",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "objects",
      "title": "名字绑定对象：重新赋值和修改内容是两件事",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "tags = [\"python\"]\nalias = tags\ntags.append(\"web\")\nprint(alias)          # ['python', 'web']\nprint(alias is tags)  # True\ntags = [\"other\"]\nprint(alias)          # ['python', 'web']\nprint(alias is tags)  # False",
          "purpose": "完整小实验；分别观察原地修改和重新绑定。",
          "kind": "runnable",
          "language": "python"
        },
        {
          "type": "paragraph",
          "text": "第一次赋值创建列表，并把名字 tags 绑定到它。alias = tags 没有复制列表，只让另一个名字指向同一个对象。append 修改那个对象，因此两条访问路径都能看到新增标签。随后 tags = [\"other\"] 创建另一个列表，再移动 tags 的绑定；alias 仍然指向旧列表。"
        },
        {
          "type": "figure",
          "src": "/figures/python-language-foundations/flow.svg",
          "title": "名字、对象与容器的数据流",
          "alt": "上方展示tags与alias共同指向一个列表；下方展示JSON数组经过校验得到新笔记列表。",
          "caption": "图中的箭头是引用或数据流示意，不代表CPython实际内存地址。先看两个名字共享对象，再看导入函数为什么创建新的标签列表。"
        },
        {
          "type": "paragraph",
          "text": "== 比较值，is 比较是否为同一个对象。两个内容相同的列表可以 == 为真、is 为假。不要根据一次整数或字符串实验中 is 的结果猜测语言规则，因为实现可能复用部分对象。对于普通业务值用 ==，对于 None 用 is None。这里讨论的是可观察的语言语义，不需要先背引用计数的实现细节。"
        },
        {
          "type": "paragraph",
          "text": "函数参数也遵循名字绑定：传入列表时，形参和调用者的名字可以关联同一个列表，函数内 append 会对外可见；给形参重新赋值则只改本次调用的局部绑定。我们因此让 normalize_note 构造新的输出容器，避免清理标签时顺手改掉调用者提供的原始记录。"
        },
        {
          "type": "reference",
          "title": "Python3.12名字与对象",
          "url": "https://docs.python.org/3.12/tutorial/classes.html#a-word-about-names-and-objects",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "containers",
      "title": "容器承担不同职责：保留顺序、按键取值、检查唯一性",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "列表 list 保存有顺序的一组对象，适合输出笔记和标签；字典 dict 把键映射到值，适合一条笔记的字段；集合 set 适合成员判断和唯一性记录。元组 tuple 也有顺序，但不提供列表那样的增删操作，第三章会用它表达笔记的标签值。容器选型跟你要做的操作有关，不是哪个写起来更短。"
        },
        {
          "type": "paragraph",
          "text": "本章输入每条记录必须恰好包含 id、title、tags 三个键。字典访问 raw[\"id\"] 表示这个键必须存在，缺失时抛 KeyError。我们先比较 set(raw) 和预期键集合，再访问字段，因此缺失和多余字段走同一条清晰的校验路径。这是教学契约；以后需要兼容可扩展字段时，可以重新定义规则，而不是把此处的严格策略当成普遍标准。"
        },
        {
          "type": "paragraph",
          "text": "标签既要去重又要保留首次出现的顺序，所以使用列表保存结果，并用成员判断跳过已有标签。例如 [\"Python\", \" Basics \", \"python\"] 先清理成 python、basics、python，再得到 [\"python\", \"basics\"]。这里 lower 只是本工具的标签规范化政策，不是完整的 Unicode 文本归一化或跨语言搜索方案。"
        },
        {
          "type": "paragraph",
          "text": "用列表成员判断时，每次可能扫描已有标签；单条笔记有 k 个不同标签，最坏会累计到二次比较。小规模个人标签足够直观。若标签非常多，可以额外维护 set 提升成员判断的平均效率，同时继续用 list 保留顺序。全批次的笔记 ID 则直接用 seen 集合，因为这里只需要知道是否见过，不需要输出集合顺序。"
        },
        {
          "type": "reference",
          "title": "Python3.12容器",
          "url": "https://docs.python.org/3.12/tutorial/datastructures.html",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "normalize",
      "title": "完整导入逻辑：先判断结构，再产生可信结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "\"\"\"Stage 1: eager import with lists, dicts, functions and explicit validation.\"\"\"\nimport json\nimport sys\n\n\ndef normalize_note(raw):\n    if not isinstance(raw, dict):\n        raise ValueError(\"note must be an object\")\n    if set(raw) != {\"id\", \"title\", \"tags\"}:\n        raise ValueError(\"note requires exactly id, title, tags\")\n    note_id = raw[\"id\"]\n    title = raw[\"title\"]\n    tags = raw[\"tags\"]\n    if not isinstance(note_id, str) or not note_id.strip():\n        raise ValueError(\"id must be a non-empty string\")\n    if not isinstance(title, str) or not title.strip():\n        raise ValueError(\"title must be a non-empty string\")\n    if not isinstance(tags, list):\n        raise ValueError(\"tags must be a list\")\n    clean_tags = []\n    for tag in tags:\n        if not isinstance(tag, str) or not tag.strip():\n            raise ValueError(\"tag must be a non-empty string\")\n        clean = tag.strip().lower()\n        if clean not in clean_tags:\n            clean_tags.append(clean)\n    return {\"id\": note_id.strip(), \"title\": title.strip(), \"tags\": clean_tags}\n\n\ndef import_notes(raw_notes):\n    if not isinstance(raw_notes, list):\n        raise ValueError(\"input must be a JSON array\")\n    notes = []\n    seen = set()\n    for raw in raw_notes:\n        note = normalize_note(raw)\n        if note[\"id\"] in seen:\n            raise ValueError(\"duplicate id: \" + note[\"id\"])\n        seen.add(note[\"id\"])\n        notes.append(note)\n    return notes\n\n\n",
          "purpose": "项目原文：全部校验和批次导入函数；后面的CLI代码接在本段后即可组成完整文件。",
          "kind": "excerpt",
          "language": "python",
          "filename": "examples/python-course/chapter01/import_notes.py"
        },
        {
          "type": "paragraph",
          "text": "把第一条样本代进去看：note_id 是 n1，title 去除两端空格后为“Python 对象”；clean_tags 从空列表开始，依次加入 python、basics，第三个 python 因已存在而跳过。函数最后返回一个新字典，原输入里的空格和大写仍保留。这让我们可以在测试里同时检查“输出正确”和“输入没有被修改”。"
        },
        {
          "type": "paragraph",
          "text": "import_notes 先要求顶层是列表，再逐个调用 normalize_note。只有清理成功后才检查 ID；因此 \" n1 \" 和 \"n1\" 被认为是同一个身份。发现重复就抛错，不偷偷覆盖前一项。seen 与 notes 的职责分开：前者回答“是否出现过”，后者决定成功时输出什么以及顺序。"
        },
        {
          "type": "paragraph",
          "text": "本章的 for raw in raw_notes 依次取得元素，和遍历索引不同。continue 会跳过本轮剩余语句，break 会结束当前循环；示例的标签去重用 if 表达就够了，不需要每一种语法都塞进去。先选能清楚表达规则的控制流，再考虑推导式之类的简写。"
        },
        {
          "type": "paragraph",
          "text": "错误策略是整批失败。虽然循环中已经创建过一部分 notes，它们只是函数内的临时结果；异常阻止函数返回，CLI 也尚未输出成功数据。它不是数据库事务，也没有回滚外部写入的能力。这个性质来自“处理完成后才输出”，下一章一旦逐条打印就会发生变化。"
        }
      ]
    },
    {
      "id": "cli",
      "title": "把函数接到命令行：数据走stdout，失败走stderr",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "def main():\n    if len(sys.argv) != 2:\n        print(\"usage: python import_notes.py notes.json\", file=sys.stderr)\n        return 2\n    try:\n        with open(sys.argv[1], encoding=\"utf-8\") as source:\n            notes = import_notes(json.load(source))\n    except (OSError, UnicodeError, ValueError) as error:\n        print(\"import failed: \" + str(error), file=sys.stderr)\n        return 2\n    print(json.dumps({\"count\": len(notes), \"notes\": notes}, ensure_ascii=False))\n    return 0\n\n\nif __name__ == \"__main__\":\n    sys.exit(main())\n",
          "purpose": "项目原文：与上一段合并即完整入口。sys.exit把main的整数返回值交给操作系统。",
          "kind": "excerpt",
          "language": "python",
          "filename": "examples/python-course/chapter01/import_notes.py"
        },
        {
          "type": "paragraph",
          "text": "import json 引入标准库解析器，import sys 用来读取命令行参数、写错误输出并设置退出码。这一章只使用模块，不展开包搜索规则。sys.argv[0] 是脚本位置，sys.argv[1] 才是数据文件；先检查参数个数，可以让漏参数变成帮助提示，而不是索引越界。"
        },
        {
          "type": "paragraph",
          "text": "with open(..., encoding=\"utf-8\") 打开文本文件，并在离开代码块时关闭它，包括块内抛异常的情况。json.load 把文件中的 JSON 解成 Python 对象；数组变 list、对象变 dict，字符串仍是 str。最后 json.dumps 把清理后的对象变回 JSON 字符串，ensure_ascii=False 让终端直接看到中文。"
        },
        {
          "type": "paragraph",
          "text": "try 内包括读文件、解析和业务检查；这里只处理可预期的文件错误、编码错误和非法数据，输出到 stderr 并返回2。成功结果写 stdout 并返回0，便于终端脚本区分。没有捕获所有 Exception：如果程序代码里出现意外的属性错误，我们更希望它暴露出来，而不是被伪装成用户输错内容。"
        },
        {
          "type": "reference",
          "title": "Python3.12文件与JSON",
          "url": "https://docs.python.org/3.12/tutorial/inputoutput.html",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "run",
      "title": "自己运行：先验证成功，再破坏一条输入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course\npython3 --version\npython3 chapter01/import_notes.py fixtures/notes.json\npython3 -m unittest -v test_course.Foundations test_course.CLI",
          "purpose": "从仓库根目录开始；先确认python3为3.12.x，本次记录实际使用3.12.14。无第三方安装步骤。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "code",
          "code": "{\"count\":3,\"notes\":[{\"id\":\"n1\",\"title\":\"Python 对象\",\"tags\":[\"python\",\"basics\"]},{\"id\":\"n2\",\"title\":\"生成器与迭代\",\"tags\":[\"python\",\"iterator\"]},{\"id\":\"n3\",\"title\":\"HTTP 请求\",\"tags\":[\"web\"]}]}",
          "purpose": "成功结果；空格排版可能不同，字段和值应一致。",
          "kind": "excerpt",
          "language": "json"
        },
        {
          "type": "paragraph",
          "text": "把第一条 tags 改成字符串 \"python\"，会得到 import failed: tags must be a list，退出码为2，stdout 没有成功 JSON。再把第二条 id 改成 \" n1 \"，会得到 duplicate id: n1。两个失败分别验证数据形状和规范化后的身份判断，不是只证明某条正常样本恰好能运行。"
        },
        {
          "type": "paragraph",
          "text": "测试还覆盖空数组、顶层类型错误、未知字段、空白标题、非法标签及共享引用行为。CLI 测试作为子进程读取真实 stdout、stderr 和退出码。本阶段 Foundations 五项、CLI 三项；课程目前总共十七项测试通过。测试没有检查“恰好写了几节”，而是检查可观察的业务行为。"
        },
        {
          "type": "paragraph",
          "text": "如果运行结果不同，先检查解释器版本和工作目录，然后确认输入文件是 JSON 数组而不是逐行 JSON。SyntaxError 往往先查冒号、缩进和引号；ValueError 看具体字段；找不到文件则检查相对路径。不要一看到异常就先换库，我们这里没有第三方库可供排查。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "这一版的边界：会运行，也要知道它什么时候不合适",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第一版会把整个 JSON 数组读进内存，再构造一份清理后的列表和 ID 集合。它适合小规模本地文件，不能因为代码短就声称可以处理任意大的导入。外部输入的大小限制、流式读取和持久化将在后续逐步引入；本章也没有把不可信文件作为生产服务直接开放上传。"
        },
        {
          "type": "paragraph",
          "text": "有一个小检查：如果 alias = notes，之后执行 notes = []，alias 会变空吗？不会，因为只是重新绑定 notes；若执行 notes.clear()，共享的原列表才会被清空。再问：为什么“先清理 ID 再去重”？因为唯一性的判断应使用业务认可的规范值，否则两个带空格差异的输入会绕过同一身份规则。"
        },
        {
          "type": "paragraph",
          "text": "你现在已经能够用 Python 解释名字与对象、选择三种容器、写验证函数并给命令行定义成功和失败。下一章不增加业务字段，而是改变处理方式：让笔记逐条进入计算，认识生成器什么时候执行、为什么只能消费一次，以及流式处理后哪些承诺必须重新讨论。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Python3.12：控制流与函数",
      "url": "https://docs.python.org/3.12/tutorial/controlflow.html"
    },
    {
      "title": "Python3.12：数据结构",
      "url": "https://docs.python.org/3.12/tutorial/datastructures.html"
    },
    {
      "title": "Python3.12：名字与对象",
      "url": "https://docs.python.org/3.12/tutorial/classes.html#a-word-about-names-and-objects"
    },
    {
      "title": "Python3.12：文本文件与JSON",
      "url": "https://docs.python.org/3.12/tutorial/inputoutput.html"
    }
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython 3.12.14（实际运行）",
    "Python 3.12 系列官方文档（页面维护版 3.12.15）"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 25,
  "examples": [
    {
      "label": "三阶段完整源码ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "Python课程：阶段源码、数据与运行说明",
      "path": "python-course/README.md"
    }
  ]
};
export default article;
