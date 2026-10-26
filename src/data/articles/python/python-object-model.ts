import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-object-model",
  "topic": "python",
  "title": "Python 类与对象：从一条笔记认识 self 和方法",
  "description": "先手写一个最普通的 Note 类，弄清实例、属性、方法和 __init__，再组合成笔记本。继承、特殊方法与 dataclass 在基础之后分步选读。",
  "minutes": 55,
  "tags": [
    "Python 类",
    "对象",
    "self",
    "方法",
    "组合",
    "dataclass"
  ],
  "scope": "第三篇以普通类的实际使用为主，不先引入冻结对象、复杂运行时校验或元类。继承和 dataclass 为选读；后续章节使用这里的 Note 和 Notebook。",
  "prerequisites": [
    "理解第一篇的字典和列表，以及第二篇的普通函数、参数和return"
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
      "title": "Python3.12：类与实例",
      "url": "https://docs.python.org/3.12/tutorial/classes.html"
    },
    {
      "title": "Python3.12：dataclasses",
      "url": "https://docs.python.org/3.12/library/dataclasses.html"
    },
    {
      "title": "Python3.12：特殊方法的基本约定",
      "url": "https://docs.python.org/3.12/reference/datamodel.html#special-method-names"
    }
  ],
  "sections": [
    {
      "id": "model",
      "title": "为什么已经有字典和函数，还要学类",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "类把某种数据及其相关操作组织在一起。前两篇用字典保存笔记，再用函数处理它；如果一条笔记经常需要“标记完成”“生成说明”，可以定义 Note 类，让每条笔记既保存自己的标题和状态，也知道这些操作怎样执行。"
        },
        {
          "type": "paragraph",
          "text": "先别把类理解成必须套上的架构。只需要处理一次的几个数字，用函数和列表就足够；当你确实要表示多份有相同结构和操作的数据时，类才开始有用。我们先用一个普通笔记例子学会它，再解释其他写法。"
        }
      ]
    },
    {
      "id": "instances",
      "title": "类、实例、属性和方法，分别指什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/models.py",
          "code": "class Note:\n    def __init__(self, title):\n        self.title = title\n        self.done = False\n\n    def finish(self):\n        self.done = True\n\n    def describe(self):\n        if self.done:\n            return self.title + \"：已完成\"\n        return self.title + \"：未完成\"\n\n    def to_dict(self):\n        return {\"title\": self.title, \"done\": self.done}",
          "purpose": "完整普通 Note 类。先关注 __init__、title、done 与 finish，随后逐步说明 describe 和 to_dict。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "first = Note(\"学习类\")\nsecond = Note(\"复习函数\")\nprint(first.title)\nprint(first.done)\nfirst.finish()\nprint(first.describe())\nprint(second.describe())",
          "language": "python",
          "purpose": "接在上面的类定义之后，放在同一个文件中运行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "学习类\nFalse\n学习类：已完成\n复习函数：未完成",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Note 是类，first、second 是两个实例，也就是根据这个定义创建出的两个具体对象。first.title 是第一个对象的标题属性，first.finish() 是调用它的方法。属性用来保存数据；方法是写在类里的函数，通常用来读取或修改当前实例的数据。"
        },
        {
          "type": "paragraph",
          "text": "和字典对照着看：过去是 note[\"title\"]，现在是 first.title；过去在外面写函数改字典，现在可以写 first.finish()。这并不意味着字典过时了。字典仍适合临时数据和外部 JSON，类则让某一种数据的操作集中在一起。"
        }
      ]
    },
    {
      "id": "note",
      "title": "self 和 __init__：从第一次调用看清楚",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "执行 Note(\"学习类\") 时，Python 得到一个新实例，并调用 __init__ 为它设置初始属性。self 指向当前那个实例，title 接收你传入的“学习类”；self.title = title 把标题放到这个实例上，self.done = False 设置初始状态。__init__ 用于初始化，不需要返回这个实例，也不要在里面 return 一个其他值。"
        },
        {
          "type": "paragraph",
          "text": "self 不是魔法关键字，而是约定俗成的参数名。通过 first.finish() 调用方法时，Python 会把 first 自动作为第一个参数交给 finish，于是 self.done = True 改的是 first 的状态。调用 second.finish() 则会修改 second。初学时固定使用 self 这个名字，更容易和其他代码保持一致。"
        },
        {
          "type": "figure",
          "src": "/figures/python-object-model/flow.svg",
          "title": "同一个类创建两份各自独立的笔记",
          "alt": "Note 类创建 first 和 second 两个实例，各自有 title 和 done；first.finish 只将 first.done 改为 True。",
          "caption": "不要把类当成只有一份数据的容器。实例有各自的属性，而 self 随当前方法调用指向其中一个实例。 手机端可以在图形区域横向滑动查看。"
        },
        {
          "type": "paragraph",
          "text": "describe 先根据当前 done 选择一段文字，再 return 给调用者。因为它返回字符串，外面用 print 才显示出来。to_dict 则把当前属性整理成普通字典，后面保存 JSON 和返回 HTTP 结果会用到它。两者都使用了上一篇已经认识的 return，没有新的一套返回规则。"
        }
      ]
    },
    {
      "id": "parse",
      "title": "把已有字典变成实例，并不是自动强制转换类型",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "raw = {\"title\": \"学习类\", \"done\": True}\nnote = Note(raw[\"title\"])\nif raw[\"done\"]:\n    note.finish()\nprint(note.to_dict())",
          "language": "python",
          "purpose": "接在 Note 定义之后运行：显式创建实例，再根据字典状态调用方法。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{'title': '学习类', 'done': True}",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Python 不会因为你写了 Note，就自动检查标题必须是字符串。当前构造函数按教学输入直接保存 title；如果传了数字，再在 describe 里把它和文字相加，就可能报 TypeError。需要检查外部输入时，应另外写检查代码。第四篇读取文件时会做这件事，不把复杂校验提前塞进你刚学的第一种类。"
        },
        {
          "type": "paragraph",
          "text": "字典和实例之间的转换，也不是把变量名改一下就完成了。上面先取得 title，创建 Note，再根据 done 决定是否完成。你可以顺着这些普通语句看到每一步，之后读框架自动转换数据时，才知道它大致替你做了什么。"
        }
      ]
    },
    {
      "id": "composition",
      "title": "组合：一个笔记本包含多条笔记",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一条笔记有自己的状态，一个笔记本则保存多条笔记。Notebook 不需要成为 Note 的子类：它是“包含笔记”，不是“某一种笔记”。这种把对象放到另一个对象里使用的方式叫组合。先看普通的保存和读取，再补特殊方法。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/models.py",
          "code": "class Notebook:\n    def __init__(self):\n        self.notes = []\n\n    def add(self, note):\n        self.notes.append(note)\n\n    def titles(self):\n        result = []\n        for note in self.notes:\n            result.append(note.title)\n        return result\n\n    def to_list(self):\n        result = []\n        for note in self.notes:\n            result.append(note.to_dict())\n        return result",
          "purpose": "Notebook 保存自己的列表；这里先展示初始化、添加与读取方法。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "book = Notebook()\nbook.add(Note(\"变量\"))\nbook.add(Note(\"函数\"))\nprint(book.titles())\nprint(book.to_list())",
          "language": "python",
          "purpose": "接在 Note 和 Notebook 两个类定义后运行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "['变量', '函数']\n[{'title': '变量', 'done': False}, {'title': '函数', 'done': False}]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "self.notes = [] 在每次初始化时创建一份新列表。因此两次 Notebook() 不会共享同一个 notes。把 notes = [] 直接写在 class Notebook 的类体里，则会创建类属性；若实例一直使用那份可变列表，不同笔记本可能混在一起。这不是类不能保存列表，而是列表应该在什么时候创建的问题。"
        },
        {
          "type": "paragraph",
          "text": "add 保存的是传入的 Note 对象，没有自动深拷贝。book.add(first) 后，再调用 first.finish()，通过笔记本读取这个对象也能看到完成状态。你已经在第一篇学过“赋值不复制列表”，这里是同样的关系，只是数据变成了我们自己定义的对象。"
        }
      ]
    },
    {
      "id": "protocols",
      "title": "选读：为什么 len(book) 和 for note in book 能工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "以双下划线开头和结尾的一些方法，让对象能参与 Python 已经提供的操作。__len__ 支持 len(book)，__iter__ 支持 for note in book。这些名字有特定约定，不是把普通方法随便加上两条下划线就会获得新功能。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/models.py",
          "code": "    def __len__(self):\n        return len(self.notes)\n\n    def __iter__(self):\n        return iter(self.notes)",
          "purpose": "两个方法属于前面同一个 Notebook 类，分别把长度和遍历交给内部列表。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "print(len(book))\nfor note in book:\n    print(note.title)",
          "language": "python",
          "purpose": "接在已创建并加入两条笔记的 book 后运行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "2\n变量\n函数",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "__iter__ 每次提供一个新的列表迭代器，所以你可以再次执行 for note in book，从头取到这些笔记。和上一篇那个用完后不能重读的生成器对象相比，区别在于：Notebook 能重新给出一个迭代器。刚开始你也可以继续写 for note in book.notes，理解普通属性和循环后再回来学协议方法。"
        }
      ]
    },
    {
      "id": "inheritance",
      "title": "选读：继承表示“它也是一种笔记”",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果要给笔记增加一个标签，同时仍然使用原来的完成状态和说明，可以定义 TaggedNote(Note)。括号中的 Note 表示父类。子类能够使用父类已有的方法，也能定义自己的同名方法来改变行为。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/models.py",
          "code": "class TaggedNote(Note):\n    def __init__(self, title, tag):\n        super().__init__(title)\n        self.tag = tag\n\n    def describe(self):\n        return super().describe() + \" [\" + self.tag + \"]\"",
          "purpose": "一个最小子类：先使用父类初始化，再增加标签；describe 基于父类结果补充文字。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "note = TaggedNote(\"学习类\", \"python\")\nnote.finish()\nprint(note.describe())",
          "language": "python",
          "purpose": "接在 Note 和 TaggedNote 定义之后运行。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "学习类：已完成 [python]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "super().__init__(title) 调用这里对应的父类初始化逻辑，让 title、done 先正常建立。子类的 describe 覆盖了父类方法；其中 super().describe() 取得父类的说明，再添加标签。这个例子只有一条简单继承关系，不需要为了学会它先研究多重继承。"
        },
        {
          "type": "paragraph",
          "text": "需要“包含多个对象”时优先想组合，需要“仍是一种父类对象，保留并调整行为”时才考虑继承。它们是两种表达关系的工具，不是越多层越专业。"
        }
      ]
    },
    {
      "id": "equality",
      "title": "选读：值相同和同一个对象，是两个问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "a is b 问的是两个名字是否指向同一个对象；a == b 问的是这个类型怎样定义“值相等”。我们的普通 Note 没有重写相等比较，两次分别创建的 Note(\"类\") 默认不会仅因标题相同就比较相等。给对象规定按字段比较的行为，需要另外实现，或使用下一节的 dataclass。"
        },
        {
          "type": "paragraph",
          "text": "因此不能笼统背成“对象用==都会比较字段”，也不能说“标题一样一定是同一条笔记”。当以后需要业务编号时，“是不是同一条业务记录”还会有单独规则。当前先把 Python 的对象身份和字段值区别开。"
        }
      ]
    },
    {
      "id": "dataclass",
      "title": "选读：先理解普通类，再认识 dataclass",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "dataclass 可以替你补上一些重复的方法，例如根据字段生成初始化、展示与相等比较。下面 title: str 里的冒号说明字段预期类型，done: bool = False 还给出了默认值；它们不是在这里给某个实例重新赋值。类型说明不会自动验证传入数据，第四篇会继续讲。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/dataclass_demo.py",
          "code": "from dataclasses import dataclass, field\n\n\n@dataclass\nclass SimpleNote:\n    title: str\n    done: bool = False\n    labels: list[str] = field(default_factory=list)",
          "purpose": "@dataclass 生成常见方法；labels 使用每个实例各自的新列表。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "first = SimpleNote(\"学习类\")\nsecond = SimpleNote(\"学习类\")\nprint(first)\nprint(first == second)\nprint(first is second)\nfirst.labels.append(\"python\")\nprint(second.labels)",
          "language": "python",
          "purpose": "接在类定义后；两份实例各自拥有标签列表。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "SimpleNote(title='学习类', done=False, labels=[])\nTrue\nFalse\n[]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "@dataclass 写在类定义前，表示让这个工具处理下面的类。first 和 second 按字段比较相等，所以 == 为True，但它们仍是分别创建的两个对象，is 为False。field(default_factory=list) 表示每创建一个实例就调用 list 得到新列表，不是让所有实例共享一个默认列表。"
        },
        {
          "type": "paragraph",
          "text": "普通 Note 的 finish、describe 并不会因为换成 dataclass 就自动出现，需要的业务方法仍由你定义。刚学类时先手写普通版本，有助于看清哪些是你写的逻辑，哪些是工具帮你生成的部分；不用为了节省几行代码跳过 self 和初始化。"
        }
      ]
    },
    {
      "id": "assemble",
      "title": "把今天的几种关系串起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Note 描述一种笔记，Notebook 保存多个 Note，add 把已有实例加入列表，finish 修改某一个实例。把这四句话对应到代码，你已经可以解释小笔记本的结构，不需要再给它加一个“领域聚合”的标签。"
        },
        {
          "type": "paragraph",
          "text": "下一篇要把笔记放进文件。文件里保存的是普通 JSON 数据，读取后仍需显式恢复为 Note；不能认为程序退出后，内存里的类和实例会自行保留下来。to_dict 与 to_list 就是在为这个非常具体的需求准备普通数据。"
        }
      ]
    },
    {
      "id": "run",
      "title": "练习、命令和这一篇的重点",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 learning_notes/models.py\npython3 dataclass_demo.py",
          "language": "bash",
          "purpose": "第一条运行普通类示例；第二条是选读的 dataclass 对照。无需安装第三方依赖。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "练习一：创建两条笔记，只完成第一条，打印两条 describe。第二条应保持未完成，否则检查你是否错误地改了类属性或共享了本不该共享的状态。练习二：创建两本 Notebook，只向第一本添加笔记，另一本长度应为0。"
        },
        {
          "type": "paragraph",
          "text": "练习三：给普通 Note 增加 rename(self,new_title)，在方法里写 self.title = new_title，再打印 describe 检查结果。如果能自己完成，不依赖复制整个示例，说明你已经理解当前实例、参数、属性和方法的联系。继承与 dataclass 可以分次回来读，不影响先进入文件和模块。"
        }
      ]
    }
  ]
};
export default article;
