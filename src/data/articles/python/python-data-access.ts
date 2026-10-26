import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-data-access",
  "topic": "python",
  "title": "用 Python 保存数据：从 SQLite 和 SQL 到提交与回滚",
  "description": "先认识表、行和列，再完成建表、插入、查询与关闭。随后把多条写入放在一起，亲自观察重复标题为什么让整批回滚。",
  "minutes": 55,
  "labMinutes": 30,
  "tags": [
    "SQLite 入门",
    "SQL",
    "参数化",
    "提交",
    "回滚",
    "持久化"
  ],
  "scope": "使用真实SQLite学习本地保存与事务。代码每次操作打开并关闭自己的连接，不先引入连接池、迁移历史或数据库框架；本例约定标题唯一。",
  "prerequisites": [
    "理解文件、函数、类、with与异常；若运行HTTP扩展，需要第七篇依赖"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "CPython 3.12.14",
    "FastAPI 0.115.8 / Pydantic 2.10.6 / Uvicorn 0.34.0"
  ],
  "verifiedAt": "2026-10-26",
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
      "title": "Python3.12：sqlite3教程与事务控制",
      "url": "https://docs.python.org/3.12/library/sqlite3.html"
    },
    {
      "title": "SQLite：SELECT",
      "url": "https://www.sqlite.org/lang_select.html"
    },
    {
      "title": "SQLite：事务",
      "url": "https://www.sqlite.org/lang_transaction.html"
    },
    {
      "title": "Python3.12：contextlib.closing",
      "url": "https://docs.python.org/3.12/library/contextlib.html#contextlib.closing"
    }
  ],
  "sections": [
    {
      "id": "persistence",
      "title": "数据库是什么，为什么不继续只用一个JSON文件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据库用约定的结构保存数据，并提供查询和修改方式。SQLite把数据库保存在一个文件里，不必先安装一个独立数据库服务，很适合第一次练习SQL。Python标准库中的sqlite3负责让程序和它交互。"
        },
        {
          "type": "paragraph",
          "text": "JSON文件仍然能用。如果只保存少量简单设置，整个读写很方便；但当你需要按条件查询、避免重复、只改其中几条记录，或让一批写入要么都成功要么都不留下，就开始需要数据库提供的能力。它不是更高级文件格式的称号，而是在帮你完成具体操作。"
        },
        {
          "type": "paragraph",
          "text": "SQL是描述这些数据库操作的语言。Python负责传入值、组织步骤和处理结果，SQL负责告诉数据库要建什么表、插入什么或查哪些行。你不用一口气学完SQL，先从本篇的几种语句开始。"
        }
      ]
    },
    {
      "id": "unit",
      "title": "表、行、列，以及第一条插入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "id",
            "title",
            "done"
          ],
          "rows": [
            [
              "1",
              "学习SQL",
              "0"
            ],
            [
              "2",
              "复习函数",
              "1"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "上面可以看成一张笔记表：每一行是一条记录，每一列是一个字段。id是记录编号，title是标题，done用0或1表示未完成与完成。表名用来区分不同数据集合，不要把Python的列表下标和数据库记录编号混在一起。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/sql_first.py",
          "code": "import sqlite3\n\nconnection = sqlite3.connect(\":memory:\", autocommit=False)\ntry:\n    connection.execute(\"CREATE TABLE notes(id INTEGER PRIMARY KEY, title TEXT NOT NULL)\")\n    connection.execute(\"INSERT INTO notes(title) VALUES(?)\", (\"学习 SQL\",))\n    connection.commit()\n    rows = connection.execute(\"SELECT id, title FROM notes ORDER BY id\").fetchall()\n    print(rows)\nfinally:\n    connection.close()",
          "purpose": "完整第一步：使用内存数据库练习SQL，结束时关闭。真正写到文件的版本在下一段。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "[(1, '学习 SQL')]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "connect建立连接；:memory:表示这一次只在内存中练习，关闭后不保留。CREATE TABLE创建表，INTEGER、TEXT说明列的基本类型，PRIMARY KEY表示这列作为主键，NOT NULL要求标题不能是数据库的NULL。INSERT写入一条，SELECT读取，fetchall把查询结果取回Python。"
        },
        {
          "type": "paragraph",
          "text": "ORDER BY id明确按编号排列，不依赖数据库恰好返回什么顺序。结果里每一行是一个元组，外面是一份列表，正好是第一篇已经认识的数据结构。SQL中的关键词常写大写方便辨认，它们不是Python函数。"
        }
      ]
    },
    {
      "id": "transaction",
      "title": "commit和rollback：一批修改什么时候才算数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "事务把一批数据库操作放在一起处理。提交commit让这批修改生效，回滚rollback撤销这批尚未提交的修改。这里的目标非常具体：一次要添加两条笔记，第二条失败时，不希望第一条悄悄留在库里。"
        },
        {
          "type": "paragraph",
          "text": "本篇明确使用Python3.12的autocommit=False，让连接按该模式维护事务。前面的最小例子显式调用commit。接下来真实文件版会用with connection：正常离开时提交，异常离开时回滚。它是连接对象对with的约定，不是所有with语句都在做同一件事。"
        },
        {
          "type": "figure",
          "src": "figures/python-data-access/transaction.svg",
          "title": "第二条失败时，第一条也没有留下",
          "alt": "原库已有学习SQL；批次尝试学习Python、学习SQL。前一条暂时写入，后一条违反标题唯一约束，回滚后库里仍只有原来的学习SQL。",
          "caption": "事务回滚的是本次尚未提交的批次，不会把以前已经提交的学习SQL删掉，也不自动撤销其他系统的操作。 手机端可以在图形区域横向滑动查看。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "真实文件版本：把连接和SQL放进一个小类",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/storage.py",
          "code": "import sqlite3\nfrom contextlib import closing\n\n\nclass NotesStore:\n    def __init__(self, path):\n        self.path = str(path)\n        with closing(self.connect()) as connection:\n            with connection:\n                connection.execute(\"\"\"CREATE TABLE IF NOT EXISTS beginner_notes(\n                    id INTEGER PRIMARY KEY,\n                    title TEXT NOT NULL UNIQUE,\n                    done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0, 1))\n                )\"\"\")\n\n    def connect(self):\n        return sqlite3.connect(self.path, autocommit=False, timeout=1)\n\n    def add_many(self, titles):\n        with closing(self.connect()) as connection:\n            with connection:\n                for title in titles:\n                    if not isinstance(title, str) or not title.strip():\n                        raise ValueError(\"标题不能为空\")\n                    connection.execute(\n                        \"INSERT INTO beginner_notes(title) VALUES(?)\", (title.strip(),)\n                    )\n\n    def list_notes(self):\n        with closing(self.connect()) as connection:\n            rows = connection.execute(\n                \"SELECT id, title, done FROM beginner_notes ORDER BY id\"\n            ).fetchall()\n        result = []\n        for note_id, title, done in rows:\n            result.append({\"id\": note_id, \"title\": title, \"done\": bool(done)})\n        return result",
          "purpose": "完整NotesStore：建表、批量添加、按顺序读取；每个操作都明确关闭连接。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "NotesStore保存数据库文件路径。初始化时创建beginner_notes表；IF NOT EXISTS表示表已经存在时不再重复创建，因而重新打开不会先清空原记录。和上一段的内存练习是不同数据库，这一版才真的使用文件保存。"
        },
        {
          "type": "paragraph",
          "text": "这一版新增一个明确规则：标题不能重复，因此title列带UNIQUE。这样才有一个容易控制的冲突来练习回滚。真实产品若允许同名笔记，就不应该照抄这个限制；应根据业务编号或其他规则设计唯一性。"
        },
        {
          "type": "paragraph",
          "text": "add_many先逐条检查标题，去空格后插入。读回结果时，把数据库里的0、1转换为Python布尔值，组织成普通字典。这里没有隐藏ORM，显示的就是决定写入、读取和回滚的全部代码。"
        }
      ]
    },
    {
      "id": "parameters",
      "title": "问号占位符：标题作为数据传入，不拼进SQL",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "INSERT中的问号用于放入一个值，真正的标题放在第二个参数元组里。即使只有一个值，也写成(title.strip(),)，那个逗号表示一项元组。数据库把SQL结构和标题值分开处理。"
        },
        {
          "type": "paragraph",
          "text": "例如标题是O'Reilly的笔记，字符串本身含单引号，不需要你手动替SQL删掉它。把用户文字直接用加号拼进SQL，则可能弄坏语句或让文字被当成SQL片段。参数化是应该从第一条插入就养成的习惯。"
        },
        {
          "type": "paragraph",
          "text": "问号用于值，不是任意替换表名和列名的工具。本例固定表与列，只把标题作为参数。需要动态选择字段时，要有另外的受限规则；刚开始不要为了“通用”就给接口增加任意SQL输入。"
        }
      ]
    },
    {
      "id": "lease",
      "title": "打开连接和结束事务，是两件事",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "with connection正常提交、出错回滚，但不自动关闭这个连接。外层closing(self.connect())才在结束时调用close。这是为什么代码看起来有两层with：一层收好连接，另一层决定这批数据库修改提交还是回滚。"
        },
        {
          "type": "paragraph",
          "text": "读取时也使用closing。先fetchall把当前需要的行取回，再关闭连接，把普通Python数据交给后面代码。不要把依赖已关闭连接的游标丢给调用方，让它过一会儿才取值。"
        },
        {
          "type": "paragraph",
          "text": "本例每次操作建立一个短连接，结构容易看清。连接池是以后为了管理有限复用连接而引入的工具，先学会这里的创建、使用、提交或回滚、关闭，再读原来的连接池工程，才能知道它在复用什么。timeout=1是SQLite遇到锁时的等待设置，不是每条查询都保证一秒完成。"
        }
      ]
    },
    {
      "id": "migration",
      "title": "表结构以后变化时，再学习迁移",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "CREATE TABLE IF NOT EXISTS不会帮旧表自动加上新列。如果后来要增加分类字段，需要明确修改表结构，并考虑已有记录怎么办。这类按版本推进结构变化的操作称为迁移。"
        },
        {
          "type": "paragraph",
          "text": "当前入门实验只创建这一版表，没有实现完整迁移管理。课程原有chapter08保留了更完整的迁移与连接池代码，可以在熟悉本篇以后选读；它使用不同的进阶项目结构，不要把两份练习数据库混在一起运行。"
        }
      ]
    },
    {
      "id": "http",
      "title": "把它接到第七篇接口上：重启后还可以读到",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/storage_api.py",
          "code": "import sqlite3\nfrom contextlib import asynccontextmanager\nfrom fastapi import FastAPI, Depends, Header, HTTPException, Request\nfrom .api import NoteInput\nfrom .storage import NotesStore\n\n\ndef create_storage_app(path, token=\"study-token\"):\n    @asynccontextmanager\n    async def lifespan(app):\n        app.state.store = NotesStore(path)\n        yield\n        app.state.store = None\n\n    def check_token(authorization: str | None = Header(default=None)):\n        if authorization != \"Bearer \" + token:\n            raise HTTPException(status_code=401, detail=\"需要正确的学习令牌\")\n\n    app = FastAPI(lifespan=lifespan)\n\n    @app.get(\"/health\")\n    def health():\n        return {\"ok\": True}\n\n    @app.get(\"/notes\", dependencies=[Depends(check_token)])\n    def list_notes(request: Request):\n        return request.app.state.store.list_notes()\n\n    @app.post(\"/notes\", status_code=201, dependencies=[Depends(check_token)])\n    def add_note(data: NoteInput, request: Request):\n        title = data.title.strip()\n        if not title:\n            raise HTTPException(status_code=400, detail=\"标题不能只有空格\")\n        try:\n            request.app.state.store.add_many([title])\n        except sqlite3.IntegrityError:\n            raise HTTPException(status_code=409, detail=\"标题已经存在\") from None\n        return {\"title\": title, \"saved\": True}\n\n    return app",
          "purpose": "完整文件版API。结构沿用上一篇，笔记读取和创建改为调用NotesStore；相同标题返回409。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这里的数据库调用是同步的，所以读取和写入路由使用普通def，由FastAPI按普通同步路由方式安排执行。每次仓库操作在自己的调用里建立和关闭连接，不把一条SQLite连接随意交给其他线程继续使用。"
        },
        {
          "type": "paragraph",
          "text": "响应比第七篇多了数据库编号；同名标题从内存版可重复变成数据库版409，都是这一阶段明确增加的规则。创建响应在add_many正常退出并完成提交后才返回，不会刚执行第一条SQL就提前说整次保存成功。"
        }
      ]
    },
    {
      "id": "run",
      "title": "先在临时目录看回滚，再选自己的文件保存",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 sql_first.py\npython3 storage_demo.py",
          "language": "bash",
          "purpose": "两个脚本都自行处理练习数据。storage_demo创建临时数据库，用完自动删除，方便重复验证。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "标题重复，整批没有保存\n[{'id': 1, 'title': '学习 SQL', 'done': False}]\n2",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "默认先提交“学习SQL”，然后尝试一次加入“学习Python”和重复的“学习SQL”。第二条触发唯一约束，整个批次回滚，所以重新打开文件后仍只有原来那条。最后加入带单引号的标题，数量变为2，说明它被正常当数据保存。"
        },
        {
          "type": "code",
          "code": "python database_api_demo.py notes-practice.db\n# 另一个终端：\ncurl -s -X POST http://127.0.0.1:4192/notes \\\n  -H \"Authorization: Bearer study-token\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"title\":\"保存到数据库\"}'\ncurl -s -H \"Authorization: Bearer study-token\" http://127.0.0.1:4192/notes",
          "language": "bash",
          "purpose": "选一个自己专门用于练习的新数据库路径。正常停止并用同一路径重新启动后，GET仍应包含该记录。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "重复提交相同标题得到409，不应增加一条记录。若换了工作目录却仍使用相对路径，可能连接到另一份文件；先检查实际路径，再判断是不是“数据库丢数据”。"
        }
      ]
    },
    {
      "id": "evidence",
      "title": "练习和定位：确认回滚的确没有留下半批",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "练习一：先保存SQL，再批量保存Python、SQL，最后查询。只有SQL，说明回滚生效；如果Python也留下了，检查是否在循环内部每写一条就提交。练习二：把第二条换成空标题，Python代码抛ValueError，同一批已插入的第一条也应该回滚。"
        },
        {
          "type": "paragraph",
          "text": "练习三：程序停止后重新打开相同文件，再读取。文件持久化与某个对象还在内存里是不同证据。本篇用真实SQLite文件测试这些路径，没有把“一次函数没有返回结果”冒充数据库事务。"
        },
        {
          "type": "paragraph",
          "text": "下一篇把已经能运行的小项目整理好：为它选择独立环境、记录依赖、运行测试，并从别的目录安装使用。这样你学到的不是只能在当前编辑器里临时跑通的几段代码。"
        }
      ]
    }
  ]
};
export default article;
