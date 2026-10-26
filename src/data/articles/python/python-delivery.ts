import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-delivery",
  "topic": "python",
  "title": "把 Python 项目运行起来：虚拟环境、依赖、测试与打包",
  "description": "先理解解释器和依赖分别放在哪里，再为小笔记本建立独立环境，运行测试，最后安装成从任意目录都能调用的命令。",
  "minutes": 55,
  "labMinutes": 30,
  "tags": [
    "venv",
    "pip",
    "日志",
    "unittest",
    "打包",
    "Python 项目"
  ],
  "scope": "承接前八篇，不再引入新的业务功能。先把已有程序稳定地安装和运行；日志、配置、测试与打包都对应一个具体操作。",
  "prerequisites": [
    "已运行前八篇的文件版笔记接口",
    "会在终端切换目录，知道 Python 文件、包和数据库文件的区别"
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
      "title": "Python3.12：venv",
      "url": "https://docs.python.org/3.12/library/venv.html"
    },
    {
      "title": "Python3.12：argparse",
      "url": "https://docs.python.org/3.12/library/argparse.html"
    },
    {
      "title": "Python3.12：unittest",
      "url": "https://docs.python.org/3.12/library/unittest.html"
    },
    {
      "title": "Python Packaging User Guide：打包项目",
      "url": "https://packaging.python.org/en/latest/tutorials/packaging-projects/"
    }
  ],
  "sections": [
    {
      "id": "artifact",
      "title": "先分清：源码、运行环境和自己的数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "到这里，你已经会写函数、类，能把笔记保存到文件，还能用 HTTP 接口操作它。最后一篇不急着再加功能，先解决一个很常见的问题：昨天能运行，今天换个终端或换个目录，为什么却找不到模块了？"
        },
        {
          "type": "paragraph",
          "text": "先分清三样东西。源码是你写的 .py 文件；运行环境包括 Python 解释器和安装的库；自己的数据是 notes.db 这样的文件。安装库不会自动把笔记存好，复制源码也不代表另一台电脑已经装好 FastAPI。下面分别管理它们。"
        },
        {
          "type": "figure",
          "src": "figures/python-delivery/release.svg",
          "title": "程序、环境与数据各放在哪里",
          "alt": "源码提供 learning_notes 包；独立虚拟环境安装解释器对应的依赖和命令；数据库由 --db 或 NOTES_DB 指向，不跟着重新安装而自动搬家。",
          "caption": "先检查自己运行的是哪个解释器、用的是哪一份依赖、连接的是哪一个数据库文件。 手机端可以在图形区域横向滑动查看。"
        }
      ]
    },
    {
      "id": "snapshot",
      "title": "虚拟环境：给这个练习单独准备一套库",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "venv 是 Python 自带的环境工具，可以为这个项目建立独立目录。激活后，终端中的 python 和 python -m pip 会优先使用其中的解释器与安装位置。它不是虚拟机，不会为程序隔离整个操作系统，也不用把 .venv 提交到仓库。"
        },
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 --version\npython3 -m venv .venv\nsource .venv/bin/activate\npython --version\npython -m pip install -r requirements.lock",
          "language": "bash",
          "purpose": "选择 Python 3.12 建立环境。Windows PowerShell 的激活命令为 .venv\\Scripts\\Activate.ps1；本次实际验证环境是 macOS。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "第一至六篇只使用标准库，不安装这些 Web 依赖也能练习。第七篇开始才需要 requirements.lock 中固定的 FastAPI 等库。这里的锁文件列出了此次验证的版本，便于重现课程；升级版本以后仍要重新运行测试，不是改一个数字就保证所有行为相同。"
        },
        {
          "type": "code",
          "code": "python -c \"import sys; print(sys.executable)\"\npython -m pip --version",
          "language": "bash",
          "purpose": "两行路径都应该指向刚创建的 .venv。用 python -m pip，可以明确让这个解释器负责安装库。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "遇到 ModuleNotFoundError，先检查有没有激活正确环境，再检查这个环境是否安装所需库。不要在不知道用哪个 Python 的情况下，连续尝试 pip、pip3、sudo pip；那容易把库装到另一个位置。离开环境可输入 deactivate，项目文件并不会被删除。"
        }
      ]
    },
    {
      "id": "entry",
      "title": "命令行入口：先不安装，直接运行包",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第四篇解释过 python -m 会按模块运行。我们的包有 __main__.py，因此在 beginner 目录下执行 python -m learning_notes，就会进入下面这个文件。参数解析帮你区分 add、list、serve 三种操作，而不是在源码里反复修改测试标题。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/__main__.py",
          "code": "import argparse\nimport json\nimport logging\nimport os\nimport sqlite3\nimport sys\nfrom .storage import NotesStore\n\n\ndef main():\n    parser = argparse.ArgumentParser(description=\"一个小型学习笔记本\")\n    parser.add_argument(\"action\", choices=[\"add\", \"list\", \"serve\"])\n    parser.add_argument(\"--title\")\n    parser.add_argument(\"--db\", default=os.environ.get(\"NOTES_DB\", \"notes.db\"))\n    args = parser.parse_args()\n    if args.action == \"add\" and not args.title:\n        parser.error(\"add 需要 --title\")\n    logging.basicConfig(level=logging.INFO, format=\"%(levelname)s %(message)s\")\n    try:\n        if args.action == \"serve\":\n            import uvicorn\n            from .storage_api import create_storage_app\n            uvicorn.run(create_storage_app(args.db), host=\"127.0.0.1\", port=4192)\n            return 0\n        store = NotesStore(args.db)\n        if args.action == \"add\":\n            store.add_many([args.title])\n            logging.info(\"已保存1条笔记\")\n        print(json.dumps(store.list_notes(), ensure_ascii=False))\n        return 0\n    except (ValueError, sqlite3.Error) as error:\n        print(\"操作失败：\", error, file=sys.stderr)\n        return 2\n\n\nif __name__ == \"__main__\":\n    raise SystemExit(main())",
          "purpose": "完整命令行入口。argparse 读取参数；main 的返回数字交给 SystemExit，表示进程退出状态。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "python -m learning_notes add --db practice.db --title \"学习打包\"\npython -m learning_notes list --db practice.db",
          "language": "bash",
          "purpose": "选择一份新的练习数据库。两次命令都显式指向同一路径；重复添加相同标题会触发上一章的唯一约束。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "[{\"id\": 1, \"title\": \"学习打包\", \"done\": false}]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一次添加还会看到一行 INFO 日志；两次命令的标准输出都是上面的 JSON。注意 Python 字典打印 True、False，JSON 则使用 true、false，这不是前后矛盾。--help 会列出参数；省略 action 或添加时没给 --title，会由 argparse 提示用法并返回非零状态。"
        }
      ]
    },
    {
      "id": "config",
      "title": "配置：不改代码，也能选择数据库位置",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "os.environ.get(\"NOTES_DB\", \"notes.db\") 读取环境变量，没有设置时用 notes.db。--db 的默认值来自这里；只要显式传入 --db，就使用命令中给出的路径。文件路径是配置，不需要为了换一份练习数据就修改 NotesStore 的源码。"
        },
        {
          "type": "code",
          "code": "NOTES_DB=/tmp/my-python-notes.db python -m learning_notes list\npython -m learning_notes list --db ./another-practice.db",
          "language": "bash",
          "purpose": "这是 macOS / Linux 终端中的临时环境变量写法。第一行只影响这一条命令；第二行显式指定另一份文件。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "相对路径根据当前工作目录解释。换个目录运行 notes.db，可能是另一份文件，并不表示原文件被程序清空。准备长期使用时，选一个明确的位置；数据库的复制、备份和删除需要你另外管理。这里没有把示例 token 设计成可用于公网的账号体系，服务仍只监听本机。"
        }
      ]
    },
    {
      "id": "logs",
      "title": "日志和返回值：给人看进度，给程序读数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "命令用 print 输出 JSON，适合人阅读，也可以交给其他工具继续处理；logging.info 记录“已保存1条笔记”，默认送到标准错误流。这样将标准输出保存到文件时，不会把 INFO 行一起混进 JSON。日志级别描述事件种类，不等于所有异常都应该忽略。"
        },
        {
          "type": "paragraph",
          "text": "本例的日志不记录标题正文，避免为了定位“保存了几条”就额外输出用户内容。操作失败时把错误送到标准错误流并返回2，命令行调用者可以用退出状态发现失败。日志里出现“已保存”是在事务正常完成之后；若提交失败，不能先记一行成功再继续吞掉错误。"
        },
        {
          "type": "code",
          "code": "python -m learning_notes list --db practice.db > result.json\ncat result.json",
          "language": "bash",
          "purpose": "这里只展示 macOS / Linux 终端的输出重定向。result.json 应是纯 JSON；数据文件 practice.db 与导出的 result.json 用途不同。",
          "kind": "runnable"
        }
      ]
    },
    {
      "id": "clean",
      "title": "测试：先检查实际结果，再判断程序是否正确",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "测试就是把预期写下来，让程序帮你重复检查。unittest 是 Python 自带的测试工具。先不用学习复杂的测试框架：调用一个函数，把结果和预期比较，就能保护我们已经讲过的规则。"
        },
        {
          "type": "code",
          "code": "import unittest\nfrom functions_demo import add_minutes\n\nclass MinutesTest(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add_minutes(20, 10), 30)\n\nif __name__ == \"__main__\":\n    unittest.main()",
          "language": "python",
          "purpose": "在 beginner 目录中新建 test_minutes.py，运行 python test_minutes.py。它依赖同目录的 functions_demo.py；不是单独复制到空目录就有那个模块。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "继承 TestCase 的测试方法以 test 开头；assertEqual 比较实际值和预期。把预期故意改成31，测试应该失败，这样你才知道自己确实运行了这条检查。修正回30后再运行。不要为了显示绿色，就把断言改成程序当前碰巧输出的结果。"
        },
        {
          "type": "code",
          "code": "python -m unittest discover -s tests -v",
          "language": "bash",
          "purpose": "运行随示例提供的全部测试。它们检查数值与输出、实例是否共享列表、取消清理、真实 SQLite 回滚和本机 HTTP 请求，不需要调用外部模型或服务。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本篇随包的测试在 CPython 3.12.14 下实际通过22项。HTTP测试使用已安装的 FastAPI 栈；其中一项启动真实本机端口，其他接口行为也用 TestClient 检查。进程例子通过真实脚本启动，避免只在编辑器交互窗口里看起来可行。每项测试的环境限制仍在验证记录里说明。"
        }
      ]
    },
    {
      "id": "measure",
      "title": "安装自己的包：从另一个目录也能调用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "前面一直在 beginner 目录运行，是因为 Python 能找到当前目录下的 learning_notes。安装以后，环境就知道这个包在哪里。pyproject.toml 记录包名、Python 版本要求、依赖以及要生成的命令。先理解它的用途，不必第一天记住每一项打包配置。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/pyproject.toml",
          "code": "[build-system]\nrequires = [\"setuptools==75.8.0\", \"wheel==0.45.1\"]\nbuild-backend = \"setuptools.build_meta\"\n\n[project]\nname = \"atlas-notes-beginner\"\nversion = \"0.1.0\"\nrequires-python = \">=3.12,<3.13\"\ndependencies = [\"fastapi==0.115.8\", \"pydantic==2.10.6\", \"uvicorn==0.34.0\"]\n\n[project.scripts]\nlearning-notes = \"learning_notes.__main__:main\"\n\n[tool.setuptools.packages.find]\nwhere = [\".\"]\ninclude = [\"learning_notes*\"]",
          "purpose": "项目配置：learning-notes 命令对应 learning_notes.__main__ 中的 main。",
          "language": "toml",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "python -m pip install --no-deps .\ncd /tmp\nlearning-notes list --db /tmp/installed-notes-practice.db",
          "language": "bash",
          "purpose": "先按锁文件装好依赖，再安装本地包，所以这里使用 --no-deps。保持虚拟环境已激活；Windows 改用自己可写的临时目录。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "如果这个新文件还没有笔记，输出应是 []。重要的是这时已经不在源码目录：成功运行来自安装进环境的包。后续改源码，并不一定自动改变已安装的副本，需要重新安装。开发时也有可编辑安装，但先学会普通安装，能更清楚地区分源码与安装结果。"
        },
        {
          "type": "paragraph",
          "text": "需要交给别人安装时，可以生成 wheel，即 Python 的一种安装包格式。build.lock 锁定构建工具，构建不是运行笔记服务的必要前置。下面在源码目录执行；如果刚切换到 /tmp，先回到 beginner。"
        },
        {
          "type": "code",
          "code": "python -m pip install -r build.lock\npython -m build --no-isolation --wheel",
          "language": "bash",
          "purpose": "生成 dist/ 中的 .whl。--no-isolation 在这里表示使用刚按 build.lock 安装的构建工具。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "验收不只看是否出现 .whl 文件，还要在另一个干净环境安装它，离开源码目录运行命令，检查保存与读回都正常。本文的验证记录包含这一步。这里只打包 learning_notes 包，不把所有教学脚本和测试塞进已安装模块；完整课程 ZIP 仍保留这些辅助文件。"
        }
      ]
    },
    {
      "id": "profile",
      "title": "先让结果正确，再考虑哪里慢",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "性能分析可以等你有一个明确的慢操作以后再做。先确认输入规模、预期结果和测量范围，再选择工具。例如“读100条笔记”与“启动整个解释器后读1条”，测到的是不同事情；不能把进程启动时间解释成每次数据库查询都慢。"
        },
        {
          "type": "paragraph",
          "text": "课程保留原 chapter09 的进阶性能与交付示例供后续选读。当前这一轮没有为了让入门教程看起来完整，就发布一个没有实际生产负载支撑的吞吐量数字。你已经有函数、线程、异步和数据库这些基础，之后再研究瓶颈和优化，才知道改动的到底是哪一段。"
        }
      ]
    },
    {
      "id": "limits",
      "title": "完成这九篇以后，你已经能做什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "你可以从最基本的数字和字符串开始，使用容器保存多条笔记；把重复步骤写成函数；把数据和操作组合成类；将代码拆成模块，并保存到JSON或SQLite；理解线程、进程和异步各在等待什么；最后运行一个有校验、失败响应和测试的小接口。这个顺序比先背一串工程术语更重要。"
        },
        {
          "type": "paragraph",
          "text": "本系列不是生产系统模板。示例使用本机服务、固定演示口令、小数据集和单机SQLite；没有实现公网账号管理、分布式并发或完整运维体系。Windows、移动端、容器和不同 Python 版本需要分别复验。原有进阶工程仍保留，但你现在可以选择带着具体问题去读它。"
        },
        {
          "type": "paragraph",
          "text": "最后一个练习：在新的虚拟环境安装课程包，换一个工作目录，用明确的数据库路径添加、查询，再故意添加同名标题，检查成功与失败的退出状态。能解释每一步运行的是谁、文件在哪里、为什么失败，就真正走完了这条入门路线。"
        }
      ]
    }
  ]
};
export default article;
