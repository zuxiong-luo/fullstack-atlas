import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "python-functions-iteration",
  "topic": "python",
  "title": "Python 函数与迭代：参数、作用域、闭包和生成器",
  "description": "把笔记导入改成按需推进的JSONL管道，理解参数绑定、闭包、迭代协议、延迟异常和流式部分输出。",
  "minutes": 44,
  "tags": [
    "Python",
    "函数",
    "闭包",
    "生成器",
    "JSONL"
  ],
  "scope": "个人笔记导入工具第2阶段；CPython 3.12、标准库，本地同步迭代，不展开异步生成器或生产上传服务。",
  "prerequisites": [
    "已读Python语言基础，理解列表、字典、函数及异常",
    "会从终端运行第一章导入脚本"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython 3.12.14（实际运行）",
    "Python 3.12系列官方文档（页面维护版3.12.15）"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 30,
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
      "title": "Python3.12：函数参数及默认值",
      "url": "https://docs.python.org/3.12/tutorial/controlflow.html#more-on-defining-functions"
    },
    {
      "title": "Python3.12：作用域、迭代器与生成器",
      "url": "https://docs.python.org/3.12/tutorial/classes.html"
    },
    {
      "title": "Python3.12：生成器迭代器方法",
      "url": "https://docs.python.org/3.12/reference/expressions.html#generator-iterator-methods"
    },
    {
      "title": "Python3.12：文件读取",
      "url": "https://docs.python.org/3.12/tutorial/inputoutput.html#reading-and-writing-files"
    }
  ],
  "sections": [
    {
      "id": "functions-as-parts",
      "title": "函数与迭代：把计算规则和推进时机分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "函数把一组操作封装成可以调用的对象；迭代则约定怎样逐个取得值。这两件事结合起来，就能让读取、校验和筛选各自负责一段处理，并在下游需要下一项时才继续运行。生成器是实现这种按需迭代的一种方式，函数体中的 yield 会交出一个值，同时保存暂停位置。它不需要新线程，也不会自动让同步代码并行。"
        },
        {
          "type": "paragraph",
          "text": "上一章把整个 JSON 数组读入，再一次性得到结果。这次仍然导入 id、title、tags 三个字段，但文件改成 JSONL：每个非空行是一条完整 JSON 对象。这样一条记录的解析不需要等待整个数组结束。目标也变得更具体：只输出含指定标签的笔记，并在所有已消费记录中检查 ID 唯一性。"
        },
        {
          "type": "paragraph",
          "text": "这一章会交付 chapter02/import_notes.py。你会知道为什么创建生成器时不读文件、为什么错误可能到下一次 next 才出现，以及为什么流式导入失败时 stdout 里可能已经有数据。适用环境是标准库与 CPython 3.12，本次实际运行3.12.14；所核对的3.12官方文档目前显示3.12.15。我们先处理同步命令行，不把生成器等同于网络流控或异步任务。"
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
      "id": "parameters",
      "title": "参数决定调用契约，默认值有自己的生命周期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "函数定义中的参数是局部名字；调用时提供的实参对象按位置或名字与它们绑定。iter_notes(lines, *, max_chars=4096) 的星号表示后面的参数只能按名字传入：iter_notes(source, max_chars=1000) 可读，iter_notes(source, 1000) 则抛 TypeError。文件源与字符限制含义不同，用关键字表达限制可以减少位置写错的机会。"
        },
        {
          "type": "paragraph",
          "text": "默认值在执行函数定义时求值一次，每次缺省调用都会使用那个对象。因此把 bucket=[] 写进定义，再在函数里 append，第二次调用会接着看到第一次留下的内容。想每次新建容器，可以用 None 作缺省标记，并在函数体里创建列表。本项目的4096是不可变整数，不存在跨调用累积列表的问题；select_unique 的 seen 则放在函数体内，每个生成器实例都有自己的状态。"
        },
        {
          "type": "paragraph",
          "text": "类型注解与参数形式也不能代替数据验证。max_chars 检查使用 type(...) is int，同时排除 True；因为 bool 是 int 的子类，只用 isinstance(True, int) 会接受它。这个选择是本项目对配置值的严格约定，不是要求所有 Python API 都拒绝整数子类。生成器还有一个时机细节：参数绑定在调用时完成，但函数体内检查要等首次推进才执行。"
        },
        {
          "type": "reference",
          "title": "Python3.12参数与默认值",
          "url": "https://docs.python.org/3.12/tutorial/controlflow.html#more-on-defining-functions",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "normalize",
      "title": "先保留可信数据的形状，再改变读取方式",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter02/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续开头：导入和完整标准化函数。本文依次展示整个入口文件，非关键脚手架未省略。",
          "code": "\"\"\"Stage 2: stream JSONL; leave ownership of the open file to the caller.\"\"\"\nimport json\nimport sys\n\n\ndef normalize_note(raw):\n    if not isinstance(raw, dict) or set(raw) != {\"id\", \"title\", \"tags\"}:\n        raise ValueError(\"note requires exactly id, title, tags\")\n    if any(not isinstance(raw[key], str) or not raw[key].strip()\n           for key in (\"id\", \"title\")):\n        raise ValueError(\"id and title must be non-empty strings\")\n    tags = raw[\"tags\"]\n    if not isinstance(tags, list):\n        raise ValueError(\"tags must be a list\")\n    result = []\n    for tag in tags:\n        if not isinstance(tag, str) or not tag.strip():\n            raise ValueError(\"tag must be a non-empty string\")\n        normalized = tag.strip().lower()\n        if normalized not in result:\n            result.append(normalized)\n    return {\"id\": raw[\"id\"].strip(), \"title\": raw[\"title\"].strip(), \"tags\": result}\n\n\n"
        },
        {
          "type": "paragraph",
          "text": "文件中的第一条输入是 n1、带两端空格的标题“Python 对象”，以及 Python、 Basics 、python 三个标签。normalize_note 先检查键集合，之后才访问 id 和 title；两个字段必须是非空字符串，tags 必须是列表。标签依次去空格、转小写和保序去重，结果为 python、basics。输出仍是新字典，上一章“清理不修改原输入”的约定继续成立。"
        },
        {
          "type": "paragraph",
          "text": "any 接受一个可迭代对象，找到首个真值就停止。这里用生成器表达式逐个检查 id 和 title，短路的 or 保证数字不会被调用 strip。你不必为了使用生成器表达式就把一切压成一行；标签清理仍保留循环，因为类型错误、规范化和去重是三个需要分别看清的判断。"
        }
      ]
    },
    {
      "id": "lazy",
      "title": "迭代协议：next 推进，yield 保存现场",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter02/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续中段：行号、校验、异常链与yield。只负责产出记录，不打开或关闭文件。",
          "code": "def iter_notes(lines, *, max_chars=4096):\n    if type(max_chars) is not int or max_chars < 1:\n        raise ValueError(\"max_chars must be a positive integer\")\n    for line_number, line in enumerate(lines, start=1):\n        if len(line) > max_chars:\n            raise ValueError(f\"line {line_number}: exceeds {max_chars} characters\")\n        if not line.strip():\n            continue\n        try:\n            note = normalize_note(json.loads(line))\n        except ValueError as error:\n            raise ValueError(f\"line {line_number}: {error}\") from error\n        yield note\n\n\n"
        },
        {
          "type": "paragraph",
          "text": "可迭代对象能交出迭代器；迭代器记住当前进度，next 请求下一项，结束时抛 StopIteration。for 把这套过程包起来，所以你通常不用亲自捕获结束信号。列表可以多次各取一个新迭代器；生成器对象本身就是一个迭代器，消费到尾后再遍历不会从头重来。想重读文件，需要重新打开或明确移动文件位置，再新建处理链。"
        },
        {
          "type": "paragraph",
          "text": "调用 iter_notes(source) 时，得到的是生成器对象，循环尚未执行。第一次 next 才检查 max_chars 并读取首行；解析成功后 yield note 交回控制权，局部变量 line_number 和暂停位置保留着。第二次 next 从 yield 后面继续，读取下一行。若下一行格式有错，这一次推进才抛异常；未处理异常离开生成器后，它已结束，再推进只会报告迭代结束。"
        },
        {
          "type": "paragraph",
          "text": "enumerate 从1开始给物理行编号。空行跳过，但仍占行号，报错位置因此对应编辑器里的真实行。json.loads 抛出的 JSONDecodeError 属于 ValueError，业务校验也使用 ValueError；包装后统一带 line 2 这样的上下文。raise ... from error 保留原始异常链，既给使用者定位，也让调试者能追踪真正的解析原因。"
        },
        {
          "type": "paragraph",
          "text": "这里的 len(line)>max_chars 发生在完整文本行已经被迭代器读入之后，计算的是 Unicode 字符数，并包括行尾换行。它是记录校验，不是读取字节数或峰值内存的硬上限。一个没有换行的巨大输入仍可能先占用大量内存；要对不可信上传做硬限制，应在更靠近字节读取的边界实施有界读取，本章没有实现那个服务边界。"
        },
        {
          "type": "reference",
          "title": "Python3.12迭代器与生成器",
          "url": "https://docs.python.org/3.12/tutorial/classes.html#iterators",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "closure",
      "title": "闭包保存筛选规则，管道仍然检查所有身份",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter02/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续中段：闭包工厂和唯一性筛选。",
          "code": "def make_selector(required_tag):\n    normalized_tag = required_tag.strip().lower()\n    if not normalized_tag:\n        raise ValueError(\"required_tag must not be empty\")\n\n    def matches(note):\n        return normalized_tag in note[\"tags\"]\n\n    return matches\n\n\ndef select_unique(notes, predicate):\n    seen = set()\n    for note in notes:\n        if note[\"id\"] in seen:\n            raise ValueError(\"duplicate id: \" + note[\"id\"])\n        seen.add(note[\"id\"])\n        if predicate(note):\n            yield note\n\n\n"
        },
        {
          "type": "paragraph",
          "text": "函数也是对象，可以作为参数传入，或者作为返回值交出去。make_selector 先把命令行标签“ PYTHON ”清理成 python，再返回 matches 函数。后者读取外层函数的 normalized_tag，这个外层绑定随着返回函数继续存在，构成闭包。它保存的是可访问的绑定，不是自动为每个外层对象做一份深拷贝。此处绑定的是清理后的字符串，工厂返回后没有再修改它。"
        },
        {
          "type": "paragraph",
          "text": "作用域决定名字从哪里找。matches 的 note 是局部参数，normalized_tag 来自外层函数；json 则来自模块。若在内层给同名变量赋值，通常会建立局部绑定，而不是自动改外层；确实要重新绑定外层名字才考虑 nonlocal。本例不需要改变规则，保持闭包只读能让每次筛选更容易预测。"
        },
        {
          "type": "paragraph",
          "text": "循环生成 lambda 时要格外小心。测试里 callbacks = [lambda: index for index in range(3)] 最后得到三个2，因为调用发生在循环结束后，函数访问的是同一个已变成2的绑定。lambda index=index: index 利用定义时求值的默认参数保存本轮对象，结果才是0、1、2。默认参数在前一节是共享可变值的风险，在这里却可以有意保存不可变数值；关键在求值时间和对象能否被修改。"
        },
        {
          "type": "paragraph",
          "text": "select_unique 接受上游记录和 predicate。每次先查 seen，再加入身份，最后决定是否 yield。顺序很重要：即使筛选条件对所有记录都返回 False，输入中两个规范化后相同的 ID 仍然报错。如果先筛掉不匹配项再查重，业务契约就变成“仅输出记录唯一”，那是另一种语义。本工具选择更严格的“已消费输入唯一”。若下游提前停止消费，未读取的尾部自然尚未验证。"
        },
        {
          "type": "reference",
          "title": "Python3.12作用域与名字",
          "url": "https://docs.python.org/3.12/tutorial/classes.html#python-scopes-and-namespaces",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "pipeline",
      "title": "从消费者向上游推进：一条输入经过哪些步骤",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "/figures/python-functions-iteration/flow.svg",
          "title": "一次next怎样穿过导入管道",
          "alt": "消费者请求下一项，select_unique向iter_notes取值，iter_notes从文件读取并校验；匹配记录返回消费者，失败传播并结束。",
          "caption": "同步调用关系与数据流示意。请求方向和产出方向分别标注；处理并未在三个线程中同时运行。"
        },
        {
          "type": "paragraph",
          "text": "假设消费者要下一条 Python 笔记。select_unique 向 iter_notes 请求一条，后者从文件得到 n1 并标准化；seen 最初为空，加入 n1，matches 返回 True，于是 n1 一层层交到消费者。下次请求得到 n2，也会产出。再下次读到 n3，seen 加入 n3，但标签 web 不匹配；这次内部循环继续取值直到遇到匹配项或文件结束。因此一次 next 不一定只读一行。"
        },
        {
          "type": "paragraph",
          "text": "管道省掉的是“先保存所有记录再筛选”的结果列表，不是所有状态。seen 随唯一 ID 数量增长，占 O(u) 空间；每条记录还有标签处理和当前行占用。下游若调用 list(selected)，又会把选中结果全部收集。比较内存时要把数据源、状态、单条大小和消费者一起算，不能只看到 yield 就声称总内存恒定。"
        }
      ]
    },
    {
      "id": "cli",
      "title": "资源的拥有者要覆盖真正发生的消费",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter02/import_notes.py",
          "kind": "excerpt",
          "purpose": "项目原文连续结尾：闭包建立、文件拥有权、流式输出与退出码。与前面三段拼接即完整文件。",
          "code": "def main():\n    if len(sys.argv) != 3:\n        print(\"usage: python import_notes.py notes.jsonl required-tag\", file=sys.stderr)\n        return 2\n    try:\n        matches = make_selector(sys.argv[2])\n        with open(sys.argv[1], encoding=\"utf-8\") as source:\n            selected = select_unique(iter_notes(source), matches)\n            for note in selected:\n                print(json.dumps(note, ensure_ascii=False))\n    except (OSError, UnicodeError, ValueError) as error:\n        print(\"stream failed: \" + str(error), file=sys.stderr)\n        return 2\n    return 0\n\n\nif __name__ == \"__main__\":\n    sys.exit(main())\n"
        },
        {
          "type": "paragraph",
          "text": "CLI 在 with 内创建并消费整条处理链，文件在最后一次读取之前保持打开。若把 selected 返回给 with 外的代码，生成器虽然还在，但文件已经关闭，随后推进会失败。懒计算把读取时间推迟了，资源生命周期也必须覆盖那个更晚的时间点。当前函数只借用 lines，不负责关闭它；打开文件的 main 保持所有权，职责因此清楚。"
        },
        {
          "type": "paragraph",
          "text": "try 必须包含 for 的实际消费。只包住 selected = ... 捕获不到后续坏行，因为那时生成器还没读取内容。make_selector 是普通函数，所以空标签在建立筛选器时立即失败；iter_notes 里的参数值检查则要推进才执行。两种看起来相似的函数调用，执行时机因 yield 而不同。"
        },
        {
          "type": "paragraph",
          "text": "每产出一条就 print 一行 JSON，适合下游逐条处理，也改变了第一章的失败承诺。bad.jsonl 第一行有效、第二行损坏时，stdout 已经写出 n1，随后 stderr 出现 stream failed: line 2，退出码为2。stdout 已写出的内容不会撤回。重定向生成的文件因此不能单凭“非空”判断成功，脚本还必须检查退出码；需要整批交付时，可先写临时文件并在成功后替换目标，但那属于额外的交付策略。"
        },
        {
          "type": "reference",
          "title": "Python3.12读取文件",
          "url": "https://docs.python.org/3.12/tutorial/inputoutput.html#reading-and-writing-files",
          "note": "语言规则出处；本文项目代码与输入输出独立提供。本次实测CPython3.12.14，所核对3.12文档页面维护版为3.12.15。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行、反例与下一次设计选择",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "purpose": "从仓库根目录执行；python3须为3.12.x。最后一条预期失败，请观察退出码和两个输出流。",
          "code": "cd examples/python-course\npython3 chapter02/import_notes.py fixtures/notes.jsonl python\npython3 -m unittest -v test_course.Iteration test_course.CLI\npython3 chapter02/import_notes.py fixtures/bad.jsonl python"
        },
        {
          "type": "paragraph",
          "text": "正常命令应输出两行，分别是 n1/Python 对象/python、basics 和 n2/生成器与迭代/python、iterator，不再包 count 和 notes 数组。第三条笔记没有输出。失败命令先输出 n1，再报告第二行错误；完整测试会通过子进程分别断言 stdout、stderr 和返回码，避免把终端混在一起的显示误认为程序只输出了一种内容。"
        },
        {
          "type": "paragraph",
          "text": "Iteration 的五项测试覆盖延迟执行、异常后耗尽、空行、字符限制、标签闭包、未匹配记录也查重、默认值和关键字参数。课程总计17项 unittest 已在 CPython3.12.14 通过。若结果不同，先检查输入是否真的是每行一个 JSON 对象、工作目录和解释器，再查是否在调试时已经 next 过同一生成器；打印 list(stream) 本身也会消费它。"
        },
        {
          "type": "paragraph",
          "text": "留下两个能独立回答的检查：创建 iter_notes([], max_chars=0) 会立刻报错吗？不会，参数形式有效，值检查到首次推进才执行。对同一条生成器做两次 list 为什么第二次为空？第一次已经取得所有值，第二次拿到的是同一个耗尽进度。它们分别验证执行时间和迭代器身份，不靠背术语判断。"
        },
        {
          "type": "paragraph",
          "text": "这一版适合按条消费并能处理部分失败的工具。若调用者需要反复遍历笔记、按身份管理成员，或者希望完成校验后再统一输出，就需要另外的结构。下一章把记录建模为不可变 Note，把成员关系交给可变 Notebook；读取仍可逐行进行，但最终保留整个集合，并明确付出相应内存成本。"
        }
      ]
    }
  ]
};
export default article;
