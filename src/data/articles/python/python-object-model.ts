import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "python-object-model",
  "topic": "python",
  "title": "Python 对象模型：类、dataclass、特殊方法与组合",
  "description": "把笔记字典收拢为不可变Note，用Notebook管理身份与成员关系，推导实例状态、值相等、哈希和可重复迭代。",
  "minutes": 46,
  "tags": [
    "Python",
    "dataclass",
    "对象模型",
    "组合",
    "特殊方法"
  ],
  "scope": "个人笔记导入工具第3阶段；CPython3.12，标准库实现Note与Notebook，不展开继承体系、描述符或数据库事务。",
  "prerequisites": [
    "理解名字绑定、字典、函数以及JSON输入校验",
    "已读第2章的迭代器、生成器与资源生命周期"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython 3.12.14（实际运行）",
    "Python 3.12系列官方文档（页面维护版3.12.15）"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 35,
  "questionIds": [],
  "examples": [
    {
      "label": "三阶段完整源码ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "运行与边界说明",
      "path": "python-course/README.md"
    }
  ],
  "references": [
    {
      "title": "Python3.12：类、实例变量与方法",
      "url": "https://docs.python.org/3.12/tutorial/classes.html"
    },
    {
      "title": "Python3.12：dataclass生成方法、frozen与哈希",
      "url": "https://docs.python.org/3.12/library/dataclasses.html"
    },
    {
      "title": "Python3.12：对象与特殊方法",
      "url": "https://docs.python.org/3.12/reference/datamodel.html"
    },
    {
      "title": "Python3.12：字典的插入顺序",
      "url": "https://docs.python.org/3.12/library/stdtypes.html#mapping-types-dict"
    }
  ],
  "sections": [
    {
      "id": "model",
      "title": "类为对象定义行为，领域对象承接业务规则",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "类是创建某种对象的定义：它描述实例有哪些行为，以及怎样建立状态。实例是依据这个类得到的具体对象，各自拥有身份。对象模型则约定属性访问、方法调用、相等比较和迭代这些操作如何发生。在 Python 里，类本身也是对象；这一章先用它组织业务值和容器，不急着进入元类或多重继承。"
        },
        {
          "type": "paragraph",
          "text": "前两章已经能够清理笔记。若内部一直传字典，每个调用者都要记住 title 必须去空格、tags 必须去重等规则，随手写一个字典又可能绕过它们。本章定义 Note，让“合法笔记”拥有明确的构造入口；再定义 Notebook，集中处理成员身份和重复添加。字段仍然是 id、title、tags，不靠增加业务复杂度掩盖语言概念。"
        },
        {
          "type": "paragraph",
          "text": "同一份 JSONL 将逐行转成 Note，再装入 Notebook。与第二章逐条打印相比，这一版会保留全部笔记，所有记录成功后才输出一份 JSON。你会独立解释为什么两个 Note 值相等却不是同一实例、为什么每本 Notebook 都需要自己的字典，以及如何让 len(book) 和 for note in book 工作。示例实际运行于CPython3.12.14；已核对的3.12官方文档页面目前维护到3.12.15。"
        },
        {
          "type": "code",
          "language": "jsonl",
          "filename": "examples/python-course/fixtures/notes.jsonl",
          "kind": "excerpt",
          "purpose": "完整原始输入；三个阶段沿用相同业务数据，第1章为数组，第2/3章每行一条对象。",
          "code": "{\"id\":\"n1\",\"title\":\"  Python 对象  \",\"tags\":[\"Python\",\" Basics \",\"python\"]}\n{\"id\":\"n2\",\"title\":\"生成器与迭代\",\"tags\":[\"Python\",\"iterator\"]}\n{\"id\":\"n3\",\"title\":\"HTTP 请求\",\"tags\":[\"web\"]}\n"
        }
      ]
    },
    {
      "id": "instances",
      "title": "先区分实例、属性和方法，再使用dataclass",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "普通类通常用 __init__ 建立实例状态。Notebook() 创建实例后会调用初始化方法，self 表示当前实例；book.add(note) 访问类中定义的函数并形成绑定方法，调用时当前 book 作为第一个参数传入。可以用 Notebook.add(book, note) 理解这个关系，但正常业务调用用前一种形式更清楚。self 是约定名称，不是具有魔法作用的关键字。"
        },
        {
          "type": "paragraph",
          "text": "类属性由类提供，实例属性属于各个对象。self._notes = {} 在每次初始化时创建新字典，所以两本 Notebook 可以独立添加笔记。如果把 _notes = {} 放在类体里，再让所有实例往它写数据，就会共享同一个可变字典，出现“给第一本加笔记，第二本也多了一条”的结果。名字绑定与对象共享的规则没有因换成类而消失。"
        },
        {
          "type": "paragraph",
          "text": "Note 则更像一个值：我们关心字段内容，而不是它在容器里的增删行为。dataclass 是标准库的类装饰器，它根据字段声明生成初始化、可读表示和比较等常见方法，省掉重复样板。它不会自动证明字段符合类型，也不会把业务含义猜出来；校验、规范化、身份唯一性仍要安排到合适的位置。"
        },
        {
          "type": "reference",
          "title": "Python3.12实例与类变量",
          "url": "https://docs.python.org/3.12/tutorial/classes.html#class-and-instance-variables",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "note",
      "title": "完整Note：字段注解、构造约束与不可变值",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter03/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续开头：标准库导入、完整Note类和业务方法。",
          "code": "\"\"\"Stage 3: immutable note values composed into a mutable notebook.\"\"\"\nfrom dataclasses import dataclass\nimport json\nimport sys\n\n\n@dataclass(frozen=True)\nclass Note:\n    id: str\n    title: str\n    tags: tuple[str, ...] = ()\n\n    def __post_init__(self):\n        for name in (\"id\", \"title\"):\n            value = getattr(self, name)\n            if not isinstance(value, str) or not value.strip() or value != value.strip():\n                raise ValueError(f\"{name} must be a trimmed non-empty string\")\n        if type(self.tags) is not tuple:\n            raise ValueError(\"tags must be a tuple\")\n        if any(not isinstance(tag, str) or not tag or tag != tag.strip().lower()\n               for tag in self.tags):\n            raise ValueError(\"tags must contain normalized non-empty strings\")\n        if len(set(self.tags)) != len(self.tags):\n            raise ValueError(\"tags must not contain duplicates\")\n\n    def has_tag(self, tag):\n        return tag.strip().lower() in self.tags\n\n    def to_dict(self):\n        return {\"id\": self.id, \"title\": self.title, \"tags\": list(self.tags)}\n\n\n"
        },
        {
          "type": "paragraph",
          "text": "id: str 和 tags: tuple[str, ...] 声明预期类型；省略号在这里是 Python 类型写法，表示任意长度的字符串元组，并非省略实现。生成的初始化方法接收三个字段，随后调用 __post_init__。即使直接写 Note(1, \"Title\", ())，它也会在这里得到 ValueError；只有注解而没有这些检查，数字并不会自动被拒绝。"
        },
        {
          "type": "paragraph",
          "text": "构造函数要求值已经规范化，而不是悄悄修改输入：id 和 title 是去除两端空白的非空字符串，tags 必须恰为 tuple，成员为去空格后的小写非空字符串且不重复。这样 Note(\" n1 \", \"Title\", ()) 直接失败，外部脏数据的清理统一交给后面的 parse_note。读取文件的宽松输入与内部的严格表示分开，调用者便能依赖实例约束。"
        },
        {
          "type": "paragraph",
          "text": "frozen=True 生成的赋值限制会让 note.title = \"new\" 抛 FrozenInstanceError。它约束普通属性赋值，并不递归冻结字段引用到的其他对象；如果字段中放了列表，列表内部仍可改变。本例还要求标签是字符串组成的元组，id、title 也都是字符串，所以正常构造的整个业务值没有可变的嵌套列表。这里讨论正常 API 使用，不把 frozen 宣称为防止恶意反射修改的安全沙箱。"
        },
        {
          "type": "paragraph",
          "text": "has_tag 把调用者的查询字符串去空格并转小写，再检查标签成员。to_dict 则回到外部 JSON 需要的形状：每次创建新字典和标签列表。调用者修改这份列表，不会改掉 Note 内部元组。查询方法假设参数是字符串，错误类型仍可能得到 AttributeError；这是内部 API 的前提，外部入口的字段验证不能因此省略。"
        },
        {
          "type": "reference",
          "title": "Python3.12 dataclass规则",
          "url": "https://docs.python.org/3.12/library/dataclasses.html",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "equality",
      "title": "值相等、对象身份和业务身份分别回答什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "两个分别构造的 Note(\"n1\", \"Title\", (\"python\",)) 内容相同，生成的 __eq__ 按同类实例的字段值比较，因此 a == b 为真；a is b 为假，因为它们是两个对象。业务身份又是另一层：Notebook 只拿 id 判断是否重复。若 b 的标题改成 Other，它和 a 不再值相等，但仍因同一个 n1 身份不能同时加入一本 Notebook。"
        },
        {
          "type": "paragraph",
          "text": "集合和字典键需要哈希。规则要求相等对象的哈希一致，哈希相同却不必相等，后续仍需要相等比较来确认。在本例的默认 eq=True 与 frozen=True 组合下，dataclass 生成 __hash__；所有字段又可哈希，所以 {a, b} 只留下一个值。不要把 hash 当成永久存储 ID，也不要记录某次运行的具体哈希数字作为正确性标准。"
        },
        {
          "type": "paragraph",
          "text": "若让参与比较的字段在加入集合后改变，查找依赖的哈希就可能失效。这是可变值不适合作集合键的重要原因。冻结字段绑定与使用不可变成员一起维持此处的语义；单独加 unsafe_hash 只是强制生成方法，不会自动让可变对象安全。本工具没有使用它，也没有让 Notebook 本身按成员值参与哈希。"
        },
        {
          "type": "reference",
          "title": "Python3.12比较与哈希",
          "url": "https://docs.python.org/3.12/reference/datamodel.html#object.__hash__",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "parse",
      "title": "外部JSON到内部Note：清理一次，约束再次确认",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter03/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续中段：完整边界转换；没有省略决定校验结论的辅助函数。",
          "code": "def parse_note(raw):\n    if not isinstance(raw, dict) or set(raw) != {\"id\", \"title\", \"tags\"}:\n        raise ValueError(\"note requires exactly id, title, tags\")\n    if any(not isinstance(raw[key], str) for key in (\"id\", \"title\")):\n        raise ValueError(\"id and title must be strings\")\n    if not isinstance(raw[\"tags\"], list):\n        raise ValueError(\"tags must be a list\")\n    tags = []\n    for tag in raw[\"tags\"]:\n        if not isinstance(tag, str) or not tag.strip():\n            raise ValueError(\"tag must be a non-empty string\")\n        normalized = tag.strip().lower()\n        if normalized not in tags:\n            tags.append(normalized)\n    return Note(raw[\"id\"].strip(), raw[\"title\"].strip(), tuple(tags))\n\n\n"
        },
        {
          "type": "paragraph",
          "text": "把首条输入带进去：JSON 解码后是字典，id 为 n1，title 为“  Python 对象  ”，tags 是 [\"Python\", \" Basics \", \"python\"]。parse_note 检查结构后，逐项得到 python、basics，并丢掉第二次出现的 python；再创建 tuple(tags)，清理标题，调用 Note。__post_init__ 再次确认内部约束，最后得到 tags=(\"python\", \"basics\") 的有效实例。"
        },
        {
          "type": "paragraph",
          "text": "两次检查承担不同职责。parse_note 认识外部格式，允许大写、两端空白和重复标签并规范化；Note 保护内部值的构造，即使未来有别的入口直接创建实例，也不能绕过约束。小程序里会多几行相似条件，但换来的是实例语义不依赖“每个调用者都记得先清理”。若业务允许保留原始大小写，应同时调整外部转换和实例约束，而不是只改其中一处。"
        },
        {
          "type": "paragraph",
          "text": "这一版仍拒绝未知字段，空标签会失败，空标签数组则合法。lower 是本工具对标签的规则，并不等同于完整 Unicode 标准化。输入字典转为领域值后，内部不再到处用 note[\"title\"] 访问未验证字段；若仍需要原始文本做审计，可以另存输入记录，别把“合法值”和“未经清理的证据”混到同一对象里。"
        }
      ]
    },
    {
      "id": "composition",
      "title": "Notebook组合Note：成员关系可以变，值可以共享",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter03/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续中段：Notebook的完整实现，含新增成员与两种协议方法。",
          "code": "class Notebook:\n    def __init__(self):\n        self._notes = {}\n\n    def add(self, note):\n        if not isinstance(note, Note):\n            raise TypeError(\"notebook accepts Note instances\")\n        if note.id in self._notes:\n            raise ValueError(\"duplicate id: \" + note.id)\n        self._notes[note.id] = note\n\n    def __len__(self):\n        return len(self._notes)\n\n    def __iter__(self):\n        return iter(self._notes.values())\n\n    def tagged(self, tag):\n        return tuple(note for note in self if note.has_tag(tag))\n\n\n"
        },
        {
          "type": "figure",
          "src": "/figures/python-object-model/flow.svg",
          "title": "容器拥有成员关系，Note提供稳定值",
          "alt": "两个Notebook分别拥有不同字典；第一本包含n1和n2，两本可共同引用同一个不可变Note。JSONL通过解析产生Note，再添加到Notebook。",
          "caption": "引用关系示意。字典是各实例独立的可变状态；Note可以共享引用，图中不表示复制或真实内存地址。"
        },
        {
          "type": "paragraph",
          "text": "Notebook 内部字典把笔记 ID 映射到 Note。add 先要求 Note 实例，再检查键是否存在，最后写入。n1 初次加入时字典从空变成 {n1: note}；再次加入相同 ID，无论标题是否相同，都在赋值前失败，所以旧成员不会被静默覆盖。前导单下划线表达内部实现约定，并没有禁止外部代码访问 _notes；调用者需要遵守接口契约。"
        },
        {
          "type": "paragraph",
          "text": "这叫组合：Notebook 持有 Note，而不是继承 Note。一本笔记本不是一条笔记，也不是承诺支持任意 dict 操作的字典子类。组合让对外操作保持窄小，只开放 add、长度、遍历和标签查询。将来替换内部索引结构时，调用者依赖的是这些行为，业务校验不会散落到每个字典赋值位置。"
        },
        {
          "type": "paragraph",
          "text": "Note 可以被两本 Notebook 引用，两个容器的成员关系仍独立；从第一本加入或查询不会自动影响另一本。不可变值减少了共享内容被原地改写的问题。Notebook 本身仍可变，也没有实现线程安全；本章在单线程顺序运行，不能因为成员值冻结就把容器当成并发安全的数据结构。"
        }
      ]
    },
    {
      "id": "protocols",
      "title": "特殊方法连接语言协议，查询结果明确所有权",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "__len__ 让 len(book) 转发到内部字典长度。__iter__ 每次返回一个新的 values 迭代器，for 因而能够依次得到 Note，并且第二次遍历可以从头开始。和上一章耗尽后不能重用的生成器对象相比，Notebook 是可以反复获取迭代器的可迭代容器；每一个具体迭代器仍有自己的进度。字典按插入顺序迭代，所以本例输出保持输入的笔记顺序。"
        },
        {
          "type": "paragraph",
          "text": "不要在遍历期间改变 Notebook 的成员数量。__iter__ 返回内部字典视图上的迭代器，添加成员可能触发 RuntimeError；这个接口没有承诺快照隔离。若业务需要边遍历边修改，可以先显式收集 tuple(book) 作为一份成员快照，再处理，但快照也有内存和时间代价。特殊方法是对协议行为的实现，不会自动解决所有并发与修改问题。"
        },
        {
          "type": "paragraph",
          "text": "tagged 返回匹配 Note 组成的 tuple，查询时扫描成员并立即形成结果。以两条 Python 标签和一条 web 标签的样本为例，book.tagged(\" PYTHON \") 得到前两条 Note 的引用。调用者不能向结果 append，稍后向 book 添加成员也不会改变已有结果元组；其中的 Note 仍与书中共享，是稳定值，不是递归深拷贝。若查询频繁而集合很大，可以增加标签索引，但索引更新也必须跟随 add 一起维护。"
        },
        {
          "type": "reference",
          "title": "Python3.12容器协议",
          "url": "https://docs.python.org/3.12/reference/datamodel.html#emulating-container-types",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "assemble",
      "title": "先组装再返回：明确失败能阻止什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter03/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续结尾：导入组装、完整CLI与退出码。与上面三段组成全部可运行文件。",
          "code": "def import_notebook(lines):\n    book = Notebook()\n    for line_number, line in enumerate(lines, start=1):\n        if len(line) > 4096:\n            raise ValueError(f\"line {line_number}: exceeds 4096 characters\")\n        if not line.strip():\n            continue\n        try:\n            book.add(parse_note(json.loads(line)))\n        except ValueError as error:\n            raise ValueError(f\"line {line_number}: {error}\") from error\n    return book\n\n\ndef main():\n    if len(sys.argv) != 2:\n        print(\"usage: python import_notes.py notes.jsonl\", file=sys.stderr)\n        return 2\n    try:\n        with open(sys.argv[1], encoding=\"utf-8\") as source:\n            book = import_notebook(source)\n    except (OSError, UnicodeError, ValueError) as error:\n        print(\"model import failed: \" + str(error), file=sys.stderr)\n        return 2\n    print(json.dumps({\"count\": len(book), \"notes\": [note.to_dict() for note in book]},\n                     ensure_ascii=False))\n    return 0\n\n\nif __name__ == \"__main__\":\n    sys.exit(main())\n"
        },
        {
          "type": "paragraph",
          "text": "import_notebook 创建局部 Notebook，逐行解析后添加。首行成功时局部对象已经包含 n1；第二行损坏会被包装成带行号的 ValueError，函数不会走到 return book。CLI 的打印在导入成功之后，因此这次没有成功 JSON 写到 stdout。与第二章的部分输出相比，改变来自“积累结果再输出”的位置，而不只是用了类。"
        },
        {
          "type": "paragraph",
          "text": "这个性质只保证失败前不向调用者返回部分 Notebook、CLI 不打印部分成功结果。它不是数据库事务，也不撤销函数中已经执行的外部写入。若以后在 add 里发送请求或写数据库，即使函数没返回，那些副作用仍可能存在。真正的事务边界和恢复需要后续数据访问章节另行实现。"
        },
        {
          "type": "paragraph",
          "text": "文件用 with 管理，导入循环在关闭前完成。4096仍是完整文本行已读入之后的字符数校验，包含换行，不是字节读取硬限制。虽然逐行解析避免保存整个原始 JSON 数组，这里仍保留全部 Note、字典索引，输出时还构造列表与 JSON 字符串，整体空间随笔记数和内容增长。对于需要全部成员的容器，这是明确付出的代价。"
        }
      ]
    },
    {
      "id": "run",
      "title": "亲自验证：值与身份、容器与失败都要检查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "purpose": "从仓库根目录执行，python3须为3.12.x；第三条会以2退出且stdout为空。",
          "code": "cd examples/python-course\npython3 chapter03/import_notes.py fixtures/notes.jsonl\npython3 -m unittest -v test_course.Objects test_course.CLI\npython3 chapter03/import_notes.py fixtures/bad.jsonl"
        },
        {
          "type": "paragraph",
          "text": "正常结果是一份 count 为3、notes 按 n1、n2、n3 排列的 JSON，标签恢复为 JSON 数组。坏文件的 stderr 含 model import failed: line 2，退出码2，stdout 为空。不要只看屏幕最后一行；子进程测试会分别检查两个输出流，这才验证了第三章相对第二章真正改变的交付行为。"
        },
        {
          "type": "paragraph",
          "text": "Objects 四项测试构造内容相同的两个 Note，断言相等但非同一实例、集合去重和冻结赋值失败；还覆盖非法字段、实例容器互不共享、重复添加、类型拒绝、重复遍历和坏行导入。加上前两章与 CLI，共17项在 CPython3.12.14通过。本章没有性能基准；页面与图形已检查桌面和手机视口，但没有原生手机验证。"
        },
        {
          "type": "paragraph",
          "text": "可以在脑中做一次反例：若两条 Note 的 id 相同但 title 不同，它们能一起放进 Python set 吗？可以，字段不同导致值不相等；但不能一起 add 到 Notebook，因为后者用 id 唯一性作为业务契约。再问：返回 tuple 是否意味着深拷贝？不意味着，tuple 固定的是成员引用集合，本例之所以能安全共享内容，还依靠 Note 字段的不可变约束。"
        },
        {
          "type": "paragraph",
          "text": "到这里，语言基础、按需迭代与对象建模已经围绕同一个导入工具连起来：知道何时计算，知道状态归谁，知道失败前输出了什么。下一章要把三个独立教学脚本中重复的解析规则收拢成包，同时明确类型、异常和资源边界。当前保留独立脚本，是为了让每个阶段可以单独复现，并非建议长期复制三份业务规则。"
        }
      ]
    }
  ]
};
export default article;
