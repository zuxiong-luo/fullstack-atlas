import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "python-modules-boundaries",
  "topic": "python",
  "title": "Python 模块与边界：包、类型、异常和资源管理",
  "description": "把笔记工具收拢为可通过python -m运行的包，用类型表达输入输出、异常链表达失败来源，并把文件所有权覆盖到实际消费。",
  "minutes": 45,
  "tags": [
    "Python",
    "模块",
    "类型注解",
    "异常",
    "资源管理"
  ],
  "scope": "个人笔记导入第4阶段；CPython3.12.14与标准库，本地包与CLI。交付模块边界和资源测试，不展开构建发布、类型检查器配置或框架依赖注入。",
  "prerequisites": [
    "理解前三章Note/Notebook、生成器推进与JSONL",
    "会从examples/python-course运行命令"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython3.12.14（实际运行）",
    "Python3.12官方文档（页面维护版3.12.15）"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 35,
  "questionIds": [],
  "examples": [
    {
      "label": "Python课程源码ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "本章运行与失败说明",
      "path": "python-course/chapter04/README.md"
    }
  ],
  "references": [
    {
      "title": "Python3.12：模块与包",
      "url": "https://docs.python.org/3.12/tutorial/modules.html"
    },
    {
      "title": "Python3.12：类型注解",
      "url": "https://docs.python.org/3.12/library/typing.html"
    },
    {
      "title": "Python3.12：异常与异常链",
      "url": "https://docs.python.org/3.12/tutorial/errors.html"
    },
    {
      "title": "Python3.12：with语句",
      "url": "https://docs.python.org/3.12/reference/compound_stmts.html#the-with-statement"
    }
  ],
  "sections": [
    {
      "id": "boundary",
      "title": "模块不是把文件切碎，而是给依赖确定方向",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "模块是可以导入的Python代码单元，常见形式是一个.py文件；包把相关模块组织在一个名字空间里。本章使用带__init__.py的普通包，便于给学习阶段定义清楚的公共入口。模块的职责不仅是“文件放哪里”，还包括谁能调用谁、哪些状态在导入时建立，以及失败由哪一层解释。"
        },
        {
          "type": "paragraph",
          "text": "前三章分别保留完整脚本，是为了按阶段独立复现。到了第四章，如果CLI、JSON解析、Note构造都继续放在同一个文件，别的程序想复用导入逻辑时，就容易一起带入命令行参数和输出行为。我们现在把语言对象与外部环境分开：领域层只管合法笔记，转换层认识JSONL，应用层组装并拥有文件，CLI负责把结果交给终端。"
        },
        {
          "type": "paragraph",
          "text": "本章仍使用三条笔记的JSONL输入，成功得到count=3的整批结果，坏行则不输出成功JSON。新增成果是chapter04/notes_tool包和6项独立测试，不改前三章入口。实际验证CPython3.12.14，无第三方依赖；核对的是3.12官方文档，当前页面显示维护版3.12.15。这里不安装框架，也不声称已经完成静态类型检查或发行到包仓库。"
        }
      ]
    },
    {
      "id": "imports",
      "title": "包的入口：导入可复用，运行才读取文件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "/figures/python-modules-boundaries/modules.svg",
          "title": "导入工具的依赖方向与资源边界",
          "alt": "CLI调用应用层，应用层在with中打开文件并消费转换层；转换层构造领域Note，错误由专门模块提供，包导入不启动CLI。",
          "caption": "教学结构图，实线表示调用或依赖。文件拥有权由read_notebook承担，build_notebook只借用输入迭代对象。"
        },
        {
          "type": "paragraph",
          "text": "从examples/python-course执行python -m chapter04.notes_tool时，解释器先按模块搜索路径找到包，再执行它的__main__.py。相对导入from .cli import main中的点指当前包，不是当前终端目录。这也是我们提供-m入口的原因：如果直接执行notes_tool/cli.py，那个文件没有相同的包上下文，相对导入会失败。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter04/notes_tool/__main__.py",
          "kind": "excerpt",
          "purpose": "完整模块运行入口。只有作为主模块执行才调用main，普通导入不读文件。",
          "code": "from .cli import main\n\nif __name__ == \"__main__\":\n    raise SystemExit(main())\n"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter04/notes_tool/__init__.py",
          "kind": "excerpt",
          "purpose": "完整公共API；导出函数、领域类型和预期错误，导入本包没有运行CLI。",
          "code": "\"\"\"Small public API; importing this package does not read files or start a CLI.\"\"\"\nfrom .app import build_notebook, read_notebook\nfrom .domain import Note, Notebook\nfrom .errors import ImportFailure, NoteError\n\n__all__ = [\"Note\", \"Notebook\", \"NoteError\", \"ImportFailure\", \"build_notebook\", \"read_notebook\"]\n"
        },
        {
          "type": "paragraph",
          "text": "__init__.py通过明确的名字导出稳定入口，不让调用者到处依赖内部文件安排。__all__主要约束星号导入，并不把未列出的模块变成无法访问的私有代码。模块第一次导入会执行顶层语句，之后通常从sys.modules复用同名模块；所以顶层只放定义和轻量导入，不打开数据文件、不创建线程，也不打印结果。"
        },
        {
          "type": "paragraph",
          "text": "搜索路径受运行方式与环境影响。从课程目录运行，chapter04能作为顶层包被找到；换到任意目录直接敲同一命令未必成功。不要靠修改sys.path掩盖这一前提，也别把自己的文件命名为json.py或typing.py，意外遮住标准库后会出现难懂的导入错误。正式安装与分发会在工程交付章节处理。"
        },
        {
          "type": "reference",
          "title": "官方依据：模块、包和模块搜索路径",
          "url": "https://docs.python.org/3.12/tutorial/modules.html"
        }
      ]
    },
    {
      "id": "types",
      "title": "类型表达调用约定，外部数据仍要检查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "类型注解告诉读者和工具“这里希望收到什么、交回什么”。object表示还不知道具体形状的Python对象；Iterable[str]表示能逐个提供字符串，不要求必须是列表；Iterator[tuple[int, Note]]表示逐个产出行号与领域笔记。Path表达文件路径对象。选择较小的接口能让测试用StringIO或列表调用同一逻辑，也避免把处理函数绑死到某一种文件对象。"
        },
        {
          "type": "paragraph",
          "text": "注解不自动执行运行时检查。写下id: str不会阻止调用者传入数字，json.loads的结果也不会因为赋给raw: object就变得可信。外部边界必须先验证字典键、字段类型和内容，再构造Note；领域对象仍检查自己的不变量。本章沿用不可变Note与可变Notebook的组合，这些规则没有因拆包而消失。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter04/notes_tool/domain.py",
          "kind": "excerpt",
          "purpose": "完整领域层：字段注解与运行时校验并列，Notebook拥有独立字典；此层不导入Path、sys或JSON。",
          "code": "from collections.abc import Iterator\nfrom dataclasses import dataclass\nfrom .errors import NoteError\n\n\n@dataclass(frozen=True)\nclass Note:\n    id: str\n    title: str\n    tags: tuple[str, ...] = ()\n\n    def __post_init__(self) -> None:\n        for name in (\"id\", \"title\"):\n            value = getattr(self, name)\n            if not isinstance(value, str) or not value.strip() or value != value.strip():\n                raise NoteError(f\"{name} must be a trimmed non-empty string\")\n        if type(self.tags) is not tuple:\n            raise NoteError(\"tags must be a tuple\")\n        if any(not isinstance(tag, str) or not tag or tag != tag.strip().lower()\n               for tag in self.tags):\n            raise NoteError(\"tags must contain normalized non-empty strings\")\n        if len(set(self.tags)) != len(self.tags):\n            raise NoteError(\"tags must not contain duplicates\")\n\n    def to_dict(self) -> dict[str, object]:\n        return {\"id\": self.id, \"title\": self.title, \"tags\": list(self.tags)}\n\n\nclass Notebook:\n    def __init__(self) -> None:\n        self._notes: dict[str, Note] = {}\n\n    def add(self, note: Note) -> None:\n        if not isinstance(note, Note):\n            raise TypeError(\"notebook accepts Note instances\")\n        if note.id in self._notes:\n            raise NoteError(\"duplicate id: \" + note.id)\n        self._notes[note.id] = note\n\n    def __len__(self) -> int:\n        return len(self._notes)\n\n    def __iter__(self) -> Iterator[Note]:\n        return iter(self._notes.values())\n"
        },
        {
          "type": "paragraph",
          "text": "to_dict的dict[str, object]没有假装每个值都是字符串：tags的导出值是列表。Notebook.__iter__返回Iterator[Note]，让调用者知道遍历得到对象而不是字典键。类型能检查的精度仍有限，比如一个字符串是否已去空格、ID是否唯一，不能仅靠str这一个标注表达；这类业务约束保留在代码里。我们实际运行的是unittest，未把“写了注解”说成“静态检查已经通过”。"
        },
        {
          "type": "reference",
          "title": "官方依据：类型注解不会由运行时自动强制执行",
          "url": "https://docs.python.org/3.12/library/typing.html"
        }
      ]
    },
    {
      "id": "errors",
      "title": "失败也有层次：合法性、输入位置与终端消息",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter04/notes_tool/errors.py",
          "kind": "excerpt",
          "purpose": "完整预期错误定义。ImportFailure保存物理行号，NoteError描述领域规则失败。",
          "code": "\"\"\"Expected domain and input failures; programming errors stay visible.\"\"\"\n\n\nclass NoteError(ValueError):\n    \"\"\"A value or notebook operation violates the note contract.\"\"\"\n\n\nclass ImportFailure(ValueError):\n    def __init__(self, line_number: int, detail: str) -> None:\n        self.line_number = line_number\n        super().__init__(f\"line {line_number}: {detail}\")\n"
        },
        {
          "type": "paragraph",
          "text": "NoteError说明值或成员操作违反笔记规则；ImportFailure说明一次外部输入在某行无法转成有效笔记。它们都继承ValueError，但调用者可以按更具体的类型区分。给自定义异常起名字，是为了表达稳定的失败契约，而不是为了让每个函数多捕获一次。底层不知道终端怎么排版，CLI也不需要重新分析每一条校验字符串。"
        },
        {
          "type": "paragraph",
          "text": "异常沿调用栈传播，直到某层能够补充信息或决定处理方式。JSON解析知道语法坏了，转换层知道它来自第几行，CLI知道它来自哪个文件。raise ImportFailure(...) from error保留直接原因，调试时能看到原JSONDecodeError或NoteError；只用一个新字符串替换掉所有错误，会失去这条路径。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter04/notes_tool/codec.py",
          "kind": "excerpt",
          "purpose": "完整转换层：从object验证并构造Note，按物理行号包装预期输入失败；不打开或关闭输入。",
          "code": "from collections.abc import Iterable, Iterator\nimport json\nfrom .domain import Note\nfrom .errors import ImportFailure, NoteError\n\n\ndef parse_note(raw: object) -> Note:\n    if not isinstance(raw, dict) or set(raw) != {\"id\", \"title\", \"tags\"}:\n        raise NoteError(\"note requires exactly id, title, tags\")\n    if any(not isinstance(raw[key], str) for key in (\"id\", \"title\")):\n        raise NoteError(\"id and title must be strings\")\n    if not isinstance(raw[\"tags\"], list):\n        raise NoteError(\"tags must be a list\")\n    tags: list[str] = []\n    for tag in raw[\"tags\"]:\n        if not isinstance(tag, str) or not tag.strip():\n            raise NoteError(\"tag must be a non-empty string\")\n        normalized = tag.strip().lower()\n        if normalized not in tags:\n            tags.append(normalized)\n    return Note(raw[\"id\"].strip(), raw[\"title\"].strip(), tuple(tags))\n\n\ndef iter_records(lines: Iterable[str], *, max_chars: int = 4096) -> Iterator[tuple[int, Note]]:\n    if type(max_chars) is not int or max_chars < 1:\n        raise ValueError(\"max_chars must be a positive integer\")\n    for line_number, line in enumerate(lines, start=1):\n        if len(line) > max_chars:\n            raise ImportFailure(line_number, f\"exceeds {max_chars} characters\")\n        if not line.strip():\n            continue\n        try:\n            raw: object = json.loads(line)\n            note = parse_note(raw)\n        except (json.JSONDecodeError, NoteError) as error:\n            raise ImportFailure(line_number, str(error)) from error\n        yield line_number, note\n"
        },
        {
          "type": "paragraph",
          "text": "拿bad.jsonl推演：首行产生(1, Note)，第二行json.loads失败，except只捕获JSONDecodeError或NoteError，再附上line 2。未知的TypeError、NameError仍会向外暴露，避免把程序缺陷伪装成用户输入问题。空行不产生Note，却仍占行号。长度超过4096会直接得到ImportFailure；这里仍是完整行读入后的字符数校验，包含换行，不是底层字节读取上限。"
        },
        {
          "type": "paragraph",
          "text": "iter_records含yield，因此调用时先得到迭代器，max_chars值检查仍在首次推进才执行。参数只能按关键字传入是调用绑定规则，非法值则是函数体内规则，两种错误时机不同。返回行号与Note的二元组，是为了让应用层发现重复身份时仍能定位输入行，而不是给Note本身塞进只属于文件格式的行号字段。"
        },
        {
          "type": "reference",
          "title": "官方依据：异常传播、选择性捕获和异常链",
          "url": "https://docs.python.org/3.12/tutorial/errors.html#exception-chaining"
        }
      ]
    },
    {
      "id": "ownership",
      "title": "with覆盖真正的消费，拥有与借用分别说清",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter04/notes_tool/app.py",
          "kind": "excerpt",
          "purpose": "完整应用层：build_notebook借用lines；read_notebook拥有打开的文件并在with内完成消费。",
          "code": "from collections.abc import Iterable\nfrom pathlib import Path\nfrom .codec import iter_records\nfrom .domain import Notebook\nfrom .errors import ImportFailure, NoteError\n\n\ndef build_notebook(lines: Iterable[str], *, max_chars: int = 4096) -> Notebook:\n    book = Notebook()\n    for line_number, note in iter_records(lines, max_chars=max_chars):\n        try:\n            book.add(note)\n        except NoteError as error:\n            raise ImportFailure(line_number, str(error)) from error\n    return book\n\n\ndef read_notebook(path: Path, *, max_chars: int = 4096) -> Notebook:\n    with path.open(encoding=\"utf-8\") as source:\n        return build_notebook(source, max_chars=max_chars)\n"
        },
        {
          "type": "paragraph",
          "text": "build_notebook接收已有的可迭代输入，不承诺关闭它；这让上层可以把列表、StringIO或打开的文件交进来。read_notebook负责把路径变成资源，所以也负责关闭。return build_notebook(...)先把调用完整求值，得到Notebook后才离开with；它交回的是已组装结果，不是仍依赖文件读取的懒迭代器。"
        },
        {
          "type": "paragraph",
          "text": "with通过上下文管理协议进入与退出资源范围。正常返回、块内异常、循环提前离开，都能触发退出；对文件对象，这意味着关闭文件。它不等于吞掉异常，也不保证强制杀进程或断电时还能运行清理。若某个上下文管理器主动把异常压住，语义还要看它自己的__exit__，不能把“用了with”当成所有对象都统一回滚的承诺。"
        },
        {
          "type": "paragraph",
          "text": "坏行发生时，已创建的局部Notebook不会返回，文件仍在退出时关闭；调用者传入的借用流则保持打开，由调用者决定下一步。独立测试既验证成功与失败后拥有的StringIO已关闭，也验证build_notebook没有越权关闭借用流。这样验证的是可观察的资源协议，而不是只检查源代码里有没有with这个单词。"
        },
        {
          "type": "paragraph",
          "text": "重复ID由Notebook.add判断，应用层捕获NoteError并补行号。例如第一行n1、第二行空白、第三行仍n1，得到line 3，而不是line 2。整批返回没有外部写入回滚能力，内存仍随全部Note与索引增长；文件生命周期正确，不等于已经解决大文件容量问题。"
        },
        {
          "type": "reference",
          "title": "官方依据：with语句与退出协议",
          "url": "https://docs.python.org/3.12/reference/compound_stmts.html#the-with-statement"
        }
      ]
    },
    {
      "id": "cli",
      "title": "CLI是适配层：把对象转成输出，把已知失败转成退出码",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter04/notes_tool/cli.py",
          "kind": "excerpt",
          "purpose": "完整CLI，包含实际参数、路径调用、失败输出和成功JSON。",
          "code": "from collections.abc import Sequence\nimport json\nfrom pathlib import Path\nimport sys\nfrom .app import read_notebook\nfrom .errors import ImportFailure\n\n\ndef main(argv: Sequence[str] | None = None) -> int:\n    arguments = list(sys.argv[1:] if argv is None else argv)\n    if len(arguments) != 1:\n        print(\"usage: python -m chapter04.notes_tool notes.jsonl\", file=sys.stderr)\n        return 2\n    path = Path(arguments[0])\n    try:\n        book = read_notebook(path)\n    except (OSError, UnicodeError, ImportFailure) as error:\n        print(f\"import failed: {path}: {error}\", file=sys.stderr)\n        return 2\n    print(json.dumps({\"count\": len(book), \"notes\": [note.to_dict() for note in book]},\n                     ensure_ascii=False))\n    return 0\n"
        },
        {
          "type": "paragraph",
          "text": "main允许传入argv，终端默认读取sys.argv[1:]，测试则可直接提供参数序列。参数数量不对写usage并返回2；文件不存在、编码错误或ImportFailure写stderr并返回2；成功才把Notebook转成JSON写stdout。JSON序列化放在导入完成后，所以坏输入没有部分成功JSON。"
        },
        {
          "type": "paragraph",
          "text": "这里没有except Exception包住一切。测试故意让read_notebook抛一个TypeError，确认它仍然向调用者传播；这能避免未来重构中的程序错误被静默归入“导入失败”。异常分类由责任决定：能预期、能向用户解释的环境与输入错误才适配，程序本身不满足内部契约时，应保留调试证据。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "从模块调用验证，再走一次反例",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "purpose": "从仓库根目录进入课程目录，使用3.12解释器；最后一条预期退出2。",
          "code": "cd examples/python-course\npython3 -m chapter04.notes_tool fixtures/notes.jsonl\npython3 -m unittest -v test_chapter04\npython3 -m chapter04.notes_tool fixtures/bad.jsonl"
        },
        {
          "type": "paragraph",
          "text": "正常输出与第三章一致：count为3，n1标题为Python 对象，标签为python、basics；第二、三条顺序不变。失败命令stderr含文件路径和line 2，stdout为空。再把输入换成duplicate.jsonl，能看到带行号的重复身份错误。如果ModuleNotFoundError先发生，先检查是否处于课程目录以及包名有没有拼错，不要先修改数据校验函数。"
        },
        {
          "type": "paragraph",
          "text": "6项独立测试覆盖真实-m子进程、普通导入无输出、注解不替代校验、异常原因链、重复身份物理行号、拥有/借用资源、程序错误不被吞掉及字符限制。CPython3.12.14实际通过；前三章17项保留不动并一起回归。这里没有浏览器或手机呈现验收，也没有运行mypy之类第三方检查器，文章状态保持review。"
        },
        {
          "type": "paragraph",
          "text": "检查理解时可以问：为什么不能在with里创建iter_records后直接返回它？因为创建尚未读取，真正推进会发生在文件关闭之后。另一个问题：为什么领域Note没有line_number？因为一条笔记可能来自文件、HTTP或数据库，物理行号属于适配器上下文。把这两点答清，就能判断资源和数据的边界是否安排正确。"
        },
        {
          "type": "paragraph",
          "text": "现在包可以被终端和其他Python代码复用，失败有位置与原因，资源有明确拥有者。下一章保留这些边界，给导入后的笔记增加受控处理任务：I/O适配器交给线程或asyncio，纯Python计算交给进程，同时限制在途任务。拆包让并发部分不必重新实现数据合法性，但不会自动替我们管理容量和取消。"
        }
      ]
    }
  ]
};
export default article;
