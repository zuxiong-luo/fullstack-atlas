import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "python-fastapi",
  "topic": "python",
  "title": "第一个 Python 接口：从 HTTP 请求到 FastAPI 返回结果",
  "description": "先运行一个返回问候的接口，再把笔记本接成可读写的服务，逐步认识路由、请求体、状态码和简单请求头检查。",
  "minutes": 55,
  "labMinutes": 30,
  "tags": [
    "FastAPI 入门",
    "HTTP",
    "路由",
    "请求体",
    "状态码",
    "依赖"
  ],
  "scope": "本地入门服务，笔记暂存在内存，最多100条；固定学习令牌只演示检查逻辑，不是生产账号系统。先教会请求和响应，不从后台任务框架开篇。",
  "prerequisites": [
    "理解函数、字典、类、模块与异常；第六篇已介绍async/await",
    "使用Python3.12和随包锁文件安装依赖"
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
      "title": "FastAPI：第一个接口",
      "url": "https://fastapi.tiangolo.com/tutorial/first-steps/"
    },
    {
      "title": "FastAPI：请求体",
      "url": "https://fastapi.tiangolo.com/tutorial/body/"
    },
    {
      "title": "FastAPI：依赖",
      "url": "https://fastapi.tiangolo.com/tutorial/dependencies/"
    },
    {
      "title": "FastAPI：普通def与async def的处理方式",
      "url": "https://fastapi.tiangolo.com/async/"
    },
    {
      "title": "FastAPI0.115.8源码",
      "url": "https://github.com/fastapi/fastapi/tree/0.115.8"
    }
  ],
  "sections": [
    {
      "id": "boundary",
      "title": "HTTP 接口：别人怎样调用你的程序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "前面一直在终端里调用函数。如果浏览器或另一个程序想使用你的笔记本，就需要一种约定好的通信方式。HTTP 接口接收请求，再返回响应：请求说明要访问哪个地址、做什么、带什么数据；响应说明结果或失败原因。"
        },
        {
          "type": "paragraph",
          "text": "地址里的127.0.0.1表示当前电脑，4191是本例监听的端口，/notes是路径。GET常用于读取，POST常用于提交新数据。先把这几个部分看清，后面的框架代码就有了对应的事情，而不只是一组新的装饰器。"
        },
        {
          "type": "paragraph",
          "text": "FastAPI 是帮助你编写HTTP接口的Python框架，Uvicorn负责启动能够监听请求的服务。它们不是Python内置模块，需要安装。本系列固定版本，并用一个项目专用的虚拟环境，避免和其他项目混用库。第九篇会进一步解释环境与依赖。"
        },
        {
          "type": "code",
          "code": "cd examples/python-course/beginner\npython3 -m venv .venv\nsource .venv/bin/activate\npython -m pip install -r requirements.lock\npython hello_api.py",
          "language": "bash",
          "purpose": "Windows激活位置为 .venv\\Scripts\\activate；确认选择Python3.12。本例只监听本机4191端口。",
          "kind": "runnable"
        }
      ]
    },
    {
      "id": "contract",
      "title": "先看一个只有十几行的服务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/hello_api.py",
          "code": "from fastapi import FastAPI\nimport uvicorn\n\napp = FastAPI()\n\n\n@app.get(\"/\")\ndef hello():\n    return {\"message\": \"你好，Python\"}\n\n\nif __name__ == \"__main__\":\n    uvicorn.run(app, host=\"127.0.0.1\", port=4191)",
          "purpose": "完整第一步：只注册GET /，返回一个字典。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "app = FastAPI() 创建应用对象。@app.get(\"/\") 写在函数前面，表示把下面的hello登记为GET /的处理函数。这种@写法叫装饰器，这里先理解它替你完成了路由登记；定义函数时不会立即处理请求，真正请求到来时才由框架调用。"
        },
        {
          "type": "paragraph",
          "text": "打开浏览器访问 http://127.0.0.1:4191/，应看到JSON数据。我们返回的是Python字典，FastAPI替它生成HTTP响应，并把数据编码为JSON。这里没有HTML页面，浏览器显示一段数据也是正常结果。"
        },
        {
          "type": "code",
          "code": "{\"message\":\"你好，Python\"}",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "服务会持续运行等待后续请求，不会像前面print一次就退出。想停下来，在运行它的终端按Ctrl+C。开始下一段完整笔记服务前，先停止这个问候服务，避免同一端口已被占用；本例不会自动换成另一个端口。"
        }
      ]
    },
    {
      "id": "body",
      "title": "请求体：用户怎样交一条新笔记",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "提交标题时，客户端可以发送JSON，例如 {\"title\":\"学习接口\"}。FastAPI结合Pydantic模型描述这个输入应该是什么形状。下面的NoteInput表示必须有一个字符串title，并且长度在1到100之间。"
        },
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/api.py",
          "code": "class NoteInput(BaseModel):\n    title: str = Field(min_length=1, max_length=100)",
          "purpose": "NoteInput继承BaseModel。Field提供长度要求，框架在处理请求时执行相应校验。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "class NoteInput(BaseModel) 使用了类的继承：我们描述字段，库提供读取和检查输入的功能。这与普通Python类型注解本身不做校验并不矛盾，是Pydantic这个库主动使用了类型说明。把 title 写成整数、漏掉字段或传入超长文字，应该得到明确错误，而不是直接创建一个坏笔记。"
        },
        {
          "type": "paragraph",
          "text": "只有空格的标题仍是非空字符串，所以路由里还会strip，再检查是否为空。格式长度与我们的实际内容要求是两层检查；先给出这个小例子，你就能看清为什么不能只写“用了类型注解，所以输入肯定正确”。"
        }
      ]
    },
    {
      "id": "jobs",
      "title": "完整笔记服务：读取和创建各走一个函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/python-course/beginner/learning_notes/api.py",
          "code": "from contextlib import asynccontextmanager\nfrom fastapi import FastAPI, Depends, Header, HTTPException, Request\nfrom pydantic import BaseModel, Field\nfrom .models import Note, Notebook\n\n\nclass NoteInput(BaseModel):\n    title: str = Field(min_length=1, max_length=100)\n\n\ndef create_app(token=\"study-token\"):\n    @asynccontextmanager\n    async def lifespan(app):\n        app.state.book = Notebook()\n        yield\n        app.state.book = None\n\n    def check_token(authorization: str | None = Header(default=None)):\n        if authorization != \"Bearer \" + token:\n            raise HTTPException(status_code=401, detail=\"需要正确的学习令牌\")\n\n    app = FastAPI(lifespan=lifespan)\n\n    @app.get(\"/health\")\n    def health():\n        return {\"ok\": True}\n\n    @app.get(\"/notes\", dependencies=[Depends(check_token)])\n    async def list_notes(request: Request):\n        return request.app.state.book.to_list()\n\n    @app.post(\"/notes\", status_code=201, dependencies=[Depends(check_token)])\n    async def add_note(data: NoteInput, request: Request):\n        title = data.title.strip()\n        if not title:\n            raise HTTPException(status_code=400, detail=\"标题不能只有空格\")\n        book = request.app.state.book\n        if len(book) >= 100:\n            raise HTTPException(status_code=409, detail=\"学习笔记本最多保存100条\")\n        note = Note(title)\n        book.add(note)\n        return note.to_dict()\n\n    return app",
          "purpose": "完整服务模块。下面会依次解释路由、状态码、检查函数以及启动和关闭。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "GET /notes调用笔记本的to_list，返回当前列表。POST /notes接收NoteInput，把标题去空格，创建第三篇的Note，再加入Notebook；status_code=201说明这次创建成功。两个函数仍然是普通的Python逻辑，只是由HTTP请求来触发。"
        },
        {
          "type": "paragraph",
          "text": "request.app.state.book 是这一个应用保存的小笔记本。这里的读写路由用async def，但内部只有很短的内存操作，没有等待外部数据库。这个写法不代表任意慢同步函数也能随便放进去；下一篇使用同步SQLite调用时，会改用普通def路由，让框架按相应方式处理。"
        },
        {
          "type": "paragraph",
          "text": "在这个单进程示例里，创建路由没有在“检查长度”和“追加笔记”之间await，达到100条后返回409。它不是一个多副本共用的全局配额，也不是对HTTP请求体读取内存的硬限制。初学时先知道这一版保存在哪里，再逐步扩展。"
        }
      ]
    },
    {
      "id": "dependencies",
      "title": "依赖：把共同的检查交给框架先调用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "读和写都需要同样的请求头检查。若每个路由复制一份，以后很容易只改了一处。Depends(check_token)把这个函数交给框架，在进入相应路由前调用；没有括号是传函数，不是在定义路由时就执行它。"
        },
        {
          "type": "paragraph",
          "text": "Header(default=None)告诉FastAPI从请求头取得authorization，没给时用None；str | None是第四篇介绍的类型说明。check_token检查内容，不正确就抛HTTPException；这个异常会被框架转成相应的HTTP错误响应。"
        },
        {
          "type": "paragraph",
          "text": "这里先把“依赖注入”读成很具体的一句话：路由所需的准备或检查，由框架按声明安排调用。能看懂这一次检查在哪里执行，已经比先背依赖系统的所有作用域更有用。"
        }
      ]
    },
    {
      "id": "auth",
      "title": "学习令牌只用来观察检查成功和失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例接受Authorization: Bearer study-token。study-token公开写在示例里，只为了让你复现请求头检查；它不是可直接部署的用户账号、密码或安全令牌系统。服务只绑定本机，没有实现注册、角色、租户或令牌轮换。"
        },
        {
          "type": "code",
          "code": "curl -i http://127.0.0.1:4191/notes\ncurl -i -H \"Authorization: Bearer study-token\" http://127.0.0.1:4191/notes",
          "language": "bash",
          "purpose": "第一条缺少学习令牌，应返回401；第二条是刚启动后的读取，应返回200和空列表。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "浏览器地址栏只方便发普通GET，不会自动替你加这个请求头。因此直接打开/notes看到401，在这一段是预期结果；/health不需要学习令牌，可以用来确认服务在运行。先不要把401误诊为Python没有成功启动。"
        }
      ]
    },
    {
      "id": "lifecycle",
      "title": "启动和关闭：一本笔记本什么时候存在",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "lifespan里的yield前创建Notebook，应用开始服务后使用它；应用正常关闭时再继续执行yield后面的收尾。@asynccontextmanager是标准库提供的工具，在这里把前后两部分交给框架管理。刚学时先理解“开始前准备，结束后收好”的动作，再看具体工具名。"
        },
        {
          "type": "figure",
          "src": "figures/python-fastapi/lifetime.svg",
          "title": "一条请求怎样经过检查并返回笔记",
          "alt": "启动时建立内存笔记本；请求先检查请求头和输入，再进入读取或创建函数；关闭后当前内存笔记本不再保留。",
          "caption": "图中的201表示本次内存创建成功，不表示数据已经保存到硬盘。重启丢失是当前实现的已知行为，下一篇用数据库解决。 手机端可以在图形区域横向滑动查看。"
        },
        {
          "type": "paragraph",
          "text": "重新启动服务会得到一本空笔记本。不同进程也各自有不同的内存列表，不会因为它们运行了同一份代码，就自动共享数据。现在先用单进程学习；等数据真的保存到数据库后，再学习多进程部署。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行完整服务，按三次请求确认发生了什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "python api_demo.py",
          "language": "bash",
          "purpose": "在已安装依赖的beginner目录运行，先停掉占用4191的hello_api.py。另开一个终端执行下面的curl。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "curl -i -X POST http://127.0.0.1:4191/notes \\\n  -H \"Authorization: Bearer study-token\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"title\":\"  学习接口  \"}'\ncurl -s -H \"Authorization: Bearer study-token\" http://127.0.0.1:4191/notes",
          "language": "bash",
          "purpose": "创建应为201，标题被去掉两端空格；随后读取应包含同一条。",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "{\"title\":\"学习接口\",\"done\":false}\n[{\"title\":\"学习接口\",\"done\":false}]",
          "language": "text",
          "purpose": "程序输出，供你和终端结果逐行对照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第三次把POST正文改成 {}，应得到422；改成 {\"title\":\" \"}，应得到我们主动指定的400。200表示读取成功，201表示创建成功，401表示本例缺少正确令牌，400和422则分别来自这里的内容检查与框架输入检查。状态码要结合当前接口定义理解，不只是背数字。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "练习和检查：服务能返回，也要能说清结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "练习一：不带令牌创建笔记，随后带正确令牌读取，数量不应增加。练习二：正常创建一条，再停掉并重启服务，列表会变空；这是内存数据与文件持久化的区别，不是浏览器自动清除了你的数据。"
        },
        {
          "type": "paragraph",
          "text": "练习三：为GET /health增加一个说明字段，再重新启动服务确认变化。你已经能读一个请求对应到哪个函数、函数从哪里拿数据、结果怎样返回。下一篇不再把数据只放在内存里，而是先认识SQLite的表和最基本SQL。"
        },
        {
          "type": "paragraph",
          "text": "这套示例在本机运行，本站GitHub Pages只展示文章和下载源码，没有替你启动Python后端。若网站上的文章能打开，而本机4191连接不上，先检查api_demo.py是否仍在终端运行。"
        }
      ]
    }
  ]
};
export default article;
