import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "python-fastapi",
  "topic": "python",
  "title": "FastAPI 服务：请求校验、依赖注入、鉴权与生命周期",
  "description": "把笔记工具接到HTTP边界，用严格请求模型、共享Bearer与lifespan管理有界导入任务，验证成功、失败、容量、关闭和真实本机请求。",
  "minutes": 62,
  "labMinutes": 45,
  "tags": [
    "Python",
    "FastAPI",
    "Pydantic",
    "HTTP",
    "依赖注入",
    "生命周期"
  ],
  "scope": "笔记项目第7阶段：CPython3.12.14与固定FastAPI0.115.8栈；单进程内存HTTP服务、有限任务队列与协作取消，不承诺持久化、用户隔离或生产鉴权。",
  "prerequisites": [
    "第4章Note/包边界、第5章asyncio队列；第6章独立异步工程中的超时与取消",
    "能解释HTTP请求/响应；不需要第8章数据库或第9章交付"
  ],
  "kind": "series",
  "status": 'complete',
  "versions": [
    "CPython3.12.14实测；3.12官方文档维护版3.12.15",
    "FastAPI0.115.8 / Pydantic2.10.6 / Starlette0.45.3",
    "Uvicorn0.34.0 / HTTPX0.28.1；全部传递依赖见requirements.lock"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "Python课程完整源码ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "第7章安装、请求与边界",
      "path": "python-course/chapter07/README.md"
    }
  ],
  "references": [
    {
      "title": "FastAPI0.115.8：请求处理与依赖解析源码",
      "url": "https://github.com/fastapi/fastapi/blob/0.115.8/fastapi/routing.py"
    },
    {
      "title": "FastAPI：lifespan资源寿命",
      "url": "https://fastapi.tiangolo.com/advanced/events/"
    },
    {
      "title": "FastAPI：依赖注入",
      "url": "https://fastapi.tiangolo.com/tutorial/dependencies/"
    },
    {
      "title": "Pydantic2.10：strict mode",
      "url": "https://docs.pydantic.dev/2.10/concepts/strict_mode/"
    },
    {
      "title": "Python3.12：有界Queue",
      "url": "https://docs.python.org/3.12/library/asyncio-queue.html"
    }
  ],
  "sections": [
    {
      "id": "boundary",
      "title": "HTTP服务是一层协议边界，业务对象不必跟着请求寿命重建",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "HTTP服务接收请求，解释方法、路径、头和正文，再把应用结果转换成响应。FastAPI是建立在ASGI协议之上的Python Web框架：它帮助声明路由、校验请求和组合依赖；Uvicorn这样的ASGI服务器负责连接、HTTP解析与调度。两者不是同一层，能调用一个路由函数，也不等于已经验证了真实TCP请求。"
        },
        {
          "type": "paragraph",
          "text": "前五章已经把文本导入拆成Note、包边界和有界执行模型；第六章保留原有python-async-services，进一步验证超时、异常分组、取消与finally。现在把这些机制组合为笔记HTTP服务：单笔创建与列表同步给出结果，批量导入返回任务ID，后台按有限容量处理。第七章可独立启动，不依赖后两章，也不跨目录导入第六章的演示脚本。"
        },
        {
          "type": "paragraph",
          "text": "本章固定CPython3.12.14、FastAPI0.115.8、Pydantic2.10.6、Starlette0.45.3与Uvicorn0.34.0，完整传递依赖另有锁文件。官方教程是当前维护页，版本行为另追到固定tag；不把这套复现基线叫作最新版。先用内存让请求与任务寿命可见，持久化和部署仍是后续要解决的问题。"
        }
      ]
    },
    {
      "id": "contract",
      "title": "先写请求契约：Python注解什么时候真正变成校验",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "类型注解本身不拦住错误输入。Pydantic模型在框架解析JSON时执行运行时验证，才把外部未知数据变成可使用的对象。这里strict=True拒绝title为数字时偷偷转成字符串，extra=forbid拒绝拼错或多余字段；长度与批次数量约束限制合法对象的规模。模型创建以后，仍通过domain方法转换为第4章冻结Note，避免把HTTP模型和领域对象当成同一个职责。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter07/models.py",
          "kind": "excerpt",
          "purpose": "完整HTTP输入契约；字段与集合验证先于Note构造。",
          "code": "from typing import Annotated\nfrom pydantic import BaseModel, ConfigDict, Field, field_validator\nfrom chapter04.notes_tool.domain import Note\n\nTag = Annotated[str, Field(min_length=1, max_length=32)]\n\n\nclass NoteInput(BaseModel):\n    model_config = ConfigDict(strict=True, extra=\"forbid\", frozen=True)\n    id: str = Field(pattern=r\"^[a-z][a-z0-9_-]{0,31}$\")\n    title: str = Field(min_length=1, max_length=200)\n    tags: list[Tag] = Field(default_factory=list, max_length=8)\n\n    @field_validator(\"title\")\n    @classmethod\n    def trimmed_title(cls, value: str) -> str:\n        if not value.strip() or value != value.strip():\n            raise ValueError(\"title must be trimmed and non-empty\")\n        return value\n\n    @field_validator(\"tags\")\n    @classmethod\n    def normalized_tags(cls, values: list[str]) -> list[str]:\n        if any(not tag.strip() or tag != tag.strip().lower() for tag in values):\n            raise ValueError(\"tags must be normalized lower-case strings\")\n        if len(set(values)) != len(values):\n            raise ValueError(\"duplicate tags\")\n        return values\n\n    def domain(self) -> Note:\n        return Note(self.id, self.title, tuple(self.tags))\n\n\nclass ImportInput(BaseModel):\n    model_config = ConfigDict(strict=True, extra=\"forbid\")\n    notes: list[NoteInput] = Field(min_length=1, max_length=32)\n\n    @field_validator(\"notes\")\n    @classmethod\n    def unique_ids(cls, values: list[NoteInput]) -> list[NoteInput]:\n        if len({note.id for note in values}) != len(values):\n            raise ValueError(\"duplicate note id in batch\")\n        return values\n"
        },
        {
          "type": "paragraph",
          "text": "边界比命令行导入更窄：id只允许小写开头的短标识，标题必须已经去掉首尾空白，标签必须小写且不重复。前几章导入器会规范化脏数据；本章HTTP契约选择明确拒绝，避免不同客户端以为服务器保留了原始形式。JSON没有tuple类型，所以接收list，转换领域对象时再变成tuple。这是接口选择，不是strict模式能替你决定的产品语义。"
        },
        {
          "type": "code",
          "language": "json",
          "filename": "examples/python-course/chapter07/fixtures/import.json",
          "kind": "excerpt",
          "purpose": "正常输入沿用笔记项目，两条记录均符合已声明的HTTP契约。",
          "code": "{\"notes\":[{\"id\":\"n1\",\"title\":\"Python 对象\",\"tags\":[\"python\",\"basics\"]},{\"id\":\"n2\",\"title\":\"生成器与迭代\",\"tags\":[\"python\",\"iterator\"]}]}\n"
        },
        {
          "type": "paragraph",
          "text": "校验失败返回422，含字段位置与错误说明；重复业务ID则是409或已接收任务的failed，它们不是同一种失败。前者还没形成合法请求对象，后者是合法对象与当前业务状态冲突。数据库尚未出现时也应把这两层分开，不能把所有异常都包装成输入错误。"
        }
      ]
    },
    {
      "id": "body",
      "title": "字段上限与请求字节上限约束不同的资源",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "只有notes最多32条，还不能阻止客户端先发一份巨大JSON：框架通常要先读取正文、解码，再运行模型验证。下面的纯ASGI中间件在JSON解码之前累计原始字节，超过32768直接413；没有依赖Content-Length，因为分块请求也需要检查。它保留受限正文，再向下游重放一次，不让业务路由重复读取网络。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter07/body_limit.py",
          "kind": "excerpt",
          "purpose": "完整正文边界；累计字节在模型验证之前，disconnect则不继续处理。",
          "code": "from starlette.responses import JSONResponse\nfrom starlette.types import ASGIApp, Receive, Scope, Send\n\n\nclass BodyLimit:\n    \"\"\"Bound buffered request bytes before JSON decoding; not a server-wide quota.\"\"\"\n    def __init__(self, app: ASGIApp, limit: int = 32768) -> None:\n        self.app, self.limit = app, limit\n\n    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:\n        if scope[\"type\"] != \"http\":\n            await self.app(scope, receive, send)\n            return\n        body = bytearray()\n        while True:\n            message = await receive()\n            if message[\"type\"] == \"http.disconnect\":\n                return\n            chunk = message.get(\"body\", b\"\")\n            if len(body) + len(chunk) > self.limit:\n                await JSONResponse({\"detail\": \"body exceeds byte limit\"}, 413)(scope, receive, send)\n                return\n            body.extend(chunk)\n            if not message.get(\"more_body\", False):\n                break\n        delivered = False\n\n        async def replay() -> dict:\n            nonlocal delivered\n            if delivered:\n                return await receive()\n            delivered = True\n            return {\"type\": \"http.request\", \"body\": bytes(body), \"more_body\": False}\n\n        await self.app(scope, replay, send)\n"
        },
        {
          "type": "paragraph",
          "text": "这不是整个服务器的硬内存上限。每次receive交出的分块已由服务器分配，网络缓冲、并发请求、解码后的字符串与对象仍各占空间；一个32768字节限制不能推出进程永远只用这么多内存。本例也没有请求读取总时限或全局连接配额。公网服务还需要服务器/代理层的容量与超时策略，本章只精确交付这一层约束。"
        }
      ]
    },
    {
      "id": "jobs",
      "title": "任务队列把接收成功与处理完成拆成两个时刻",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "202表示服务器接受了任务，不表示笔记已经提交。我们为每批生成ID，状态从queued到running，再到succeeded、failed或cancelled；客户端按ID查询。队列最多保存capacity批，固定workers各持有至多一批，每批又最多32条。因此等待区与执行区都能算清楚，不会为每个请求无限create_task。请求断开后，已接收任务仍由服务寿命拥有。"
        },
        {
          "type": "figure",
          "src": "figures/python-fastapi/lifetime.svg",
          "title": "请求、已接收任务和服务各有寿命",
          "alt": "请求先经字节限制、模型与鉴权进入有界队列，固定worker组装整批后提交内存；lifespan关闭拒绝新任务并取消执行、清空等待。",
          "caption": "职责与容量示意，不表示耗时；202不能替代任务终态。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter07/jobs.py",
          "kind": "excerpt",
          "purpose": "完整内存仓库与任务所有者；队列、状态迁移、批次提交、超时与关闭都可在本文件追到。",
          "code": "import asyncio\nfrom collections.abc import Awaitable, Callable\nfrom dataclasses import dataclass\nfrom uuid import uuid4\nfrom chapter04.notes_tool.domain import Note\n\n\nclass Conflict(Exception):\n    pass\n\n\nclass Busy(Exception):\n    pass\n\n\nclass MemoryNotes:\n    \"\"\"Event-loop-owned store: no await occurs between checking and updating.\"\"\"\n    def __init__(self, capacity: int = 512) -> None:\n        self.capacity = capacity\n        self.notes: dict[str, Note] = {}\n\n    def add_batch(self, notes: tuple[Note, ...]) -> None:\n        ids = [note.id for note in notes]\n        if len(ids) != len(set(ids)) or any(key in self.notes for key in ids):\n            raise Conflict(\"note id already exists\")\n        if len(self.notes) + len(notes) > self.capacity:\n            raise Busy(\"note capacity reached\")\n        self.notes.update((note.id, note) for note in notes)\n\n    def snapshot(self) -> list[dict[str, object]]:\n        return [note.to_dict() for note in self.notes.values()]\n\n\n@dataclass\nclass Job:\n    id: str\n    state: str = \"queued\"\n    count: int = 0\n    error: str | None = None\n\n    def snapshot(self) -> dict[str, object]:\n        return vars(self).copy()\n\n\nasync def unchanged(note: Note) -> Note:\n    # Validation is small CPU work. async alone neither parallelizes nor yields.\n    return note\n\n\nclass ImportJobs:\n    def __init__(self, store: MemoryNotes, *, workers: int = 2, capacity: int = 2,\n                 retention: int = 64, timeout: float = 2.0,\n                 prepare: Callable[[Note], Awaitable[Note]] = unchanged) -> None:\n        if (any(type(value) is not int for value in (workers, capacity, retention))\n                or not 1 <= workers <= 4 or not 1 <= capacity <= 16\n                or not workers + capacity <= retention <= 256):\n            raise ValueError(\"invalid job capacities\")\n        if not 0 < timeout <= 10:\n            raise ValueError(\"invalid job timeout\")\n        self.store, self.workers, self.retention = store, workers, retention\n        self.timeout, self.prepare = timeout, prepare\n        self.queue: asyncio.Queue[tuple[Job, tuple[Note, ...]]] = asyncio.Queue(capacity)\n        self.jobs: dict[str, Job] = {}\n        self.tasks: list[asyncio.Task[None]] = []\n        self.accepting = False\n\n    def start(self, group: asyncio.TaskGroup) -> None:\n        if self.tasks:\n            raise RuntimeError(\"jobs already started\")\n        self.accepting = True\n        self.tasks = [group.create_task(self.consume(), name=f\"notes-import-{i}\")\n                      for i in range(self.workers)]\n\n    def submit(self, notes: tuple[Note, ...]) -> Job:\n        if not self.accepting or self.queue.full():\n            raise Busy(\"import queue unavailable\")\n        if not 1 <= len(notes) <= 32:\n            raise ValueError(\"batch must contain 1..32 notes\")\n        if len(self.jobs) >= self.retention:\n            oldest = next((key for key, job in self.jobs.items()\n                           if job.state in {\"succeeded\", \"failed\", \"cancelled\"}), None)\n            if oldest is None:\n                raise Busy(\"job retention capacity reached\")\n            del self.jobs[oldest]\n        job = Job(uuid4().hex)\n        self.queue.put_nowait((job, notes))\n        self.jobs[job.id] = job\n        return job\n\n    async def consume(self) -> None:\n        while True:\n            job, notes = await self.queue.get()\n            try:\n                job.state = \"running\"\n                async with asyncio.timeout(self.timeout):\n                    prepared = tuple([await self.prepare(note) for note in notes])\n                    self.store.add_batch(prepared)\n                job.state, job.count = \"succeeded\", len(prepared)\n            except asyncio.CancelledError:\n                job.state, job.error = \"cancelled\", \"service shutdown\"\n                raise\n            except (Conflict, Busy) as error:\n                job.state, job.error = \"failed\", str(error)\n            except TimeoutError:\n                job.state, job.error = \"failed\", \"import timeout\"\n            except Exception:\n                job.state, job.error = \"failed\", \"import processing failed\"\n            finally:\n                self.queue.task_done()\n\n    async def close(self) -> None:\n        self.accepting = False\n        for task in self.tasks:\n            task.cancel()\n        await asyncio.gather(*self.tasks, return_exceptions=True)\n        while not self.queue.empty():\n            job, _ = self.queue.get_nowait()\n            job.state, job.error = \"cancelled\", \"service shutdown before execution\"\n            self.queue.task_done()\n        await self.queue.join()\n"
        },
        {
          "type": "paragraph",
          "text": "批次先把每条prepare结果组装完，再一次检查ID冲突和notes容量，最后update。单事件循环中这段检查到写入之间没有await，所以其他协程不会插入半批修改；第二条准备失败时，第一条也不会提前发布。这是当前进程内的执行约定，不是耐久数据库事务，更不覆盖多进程。直接从其他线程修改store也会破坏这个前提。"
        },
        {
          "type": "paragraph",
          "text": "默认prepare只是返回已经验证的Note，没有外部I/O，也没有真正的挂起点。给它加async不会自动让出或并行；我们保留可等待接口，是为了让下一种真实I/O处理能接入同一寿命。超时只在协作让出时生效，不能强行切断Python死循环。测试用Event把prepare明确停在await，观察running、queued与第三批拒绝，才有资格证明容量。"
        },
        {
          "type": "paragraph",
          "text": "结果记录也需要上限。当前最多保留64个任务；满时淘汰最早的终态记录，因此旧ID可能404。仍在queued/running的记录不被淘汰。notes最多512条，达到容量后失败；这些预算与队列容量是三种不同集合，不能只给queue设置maxsize就宣称所有内存都已有界。"
        }
      ]
    },
    {
      "id": "dependencies",
      "title": "依赖负责取得当前资源，lifespan负责拥有它",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "依赖注入让路由声明“我需要仓库或任务服务”，由Depends从当前Request.app.state取得，不把全局变量埋进每个函数。它是一种调用与组合机制，不会自动创建数据库事务，也不保证对象每次都是新的。本例仓库和worker属于同一个应用lifespan，所有请求借用；每次启动创建一套，停止时统一收口。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter07/api.py",
          "kind": "excerpt",
          "purpose": "完整应用工厂，包含lifespan、依赖、共享Bearer与全部HTTP路由。",
          "code": "import asyncio\nfrom contextlib import asynccontextmanager\nfrom dataclasses import dataclass\nimport os\nimport secrets\nfrom typing import Annotated\nfrom fastapi import Depends, FastAPI, HTTPException, Request\nfrom fastapi.security import HTTPAuthorizationCredentials, HTTPBearer\nfrom .body_limit import BodyLimit\nfrom .jobs import Busy, Conflict, ImportJobs, MemoryNotes\nfrom .models import ImportInput, NoteInput\n\n\n@dataclass(frozen=True)\nclass Settings:\n    token: str\n    workers: int = 2\n    capacity: int = 2\n\n    def __post_init__(self) -> None:\n        if not isinstance(self.token, str) or not 16 <= len(self.token) <= 128:\n            raise ValueError(\"token must contain 16..128 characters\")\n        if type(self.workers) is not int or not 1 <= self.workers <= 4:\n            raise ValueError(\"workers outside 1..4\")\n        if type(self.capacity) is not int or not 1 <= self.capacity <= 16:\n            raise ValueError(\"capacity outside 1..16\")\n\n\ndef create_app(settings: Settings) -> FastAPI:\n    @asynccontextmanager\n    async def lifespan(app: FastAPI):\n        store = MemoryNotes()\n        jobs = ImportJobs(store, workers=settings.workers, capacity=settings.capacity)\n        app.state.store, app.state.jobs = store, jobs\n        async with asyncio.TaskGroup() as group:\n            jobs.start(group)\n            try:\n                yield\n            finally:\n                await jobs.close()\n\n    app = FastAPI(title=\"Atlas Notes chapter 7\", lifespan=lifespan)\n    app.add_middleware(BodyLimit, limit=32768)\n    bearer = HTTPBearer(auto_error=False)\n\n    async def authenticated(credentials: Annotated[HTTPAuthorizationCredentials | None,\n                                                   Depends(bearer)]) -> None:\n        if credentials is None or not secrets.compare_digest(\n                credentials.credentials.encode(), settings.token.encode()):\n            raise HTTPException(401, \"invalid bearer token\", headers={\"WWW-Authenticate\": \"Bearer\"})\n\n    async def store(request: Request) -> MemoryNotes:\n        return request.app.state.store\n\n    async def jobs(request: Request) -> ImportJobs:\n        return request.app.state.jobs\n\n    @app.get(\"/health\")\n    async def health(request: Request):\n        return {\"ready\": request.app.state.jobs.accepting}\n\n    @app.get(\"/notes\", dependencies=[Depends(authenticated)])\n    async def list_notes(repository: Annotated[MemoryNotes, Depends(store)]):\n        return {\"notes\": repository.snapshot()}\n\n    @app.post(\"/notes\", status_code=201, dependencies=[Depends(authenticated)])\n    async def add_note(note: NoteInput, repository: Annotated[MemoryNotes, Depends(store)]):\n        try:\n            repository.add_batch((note.domain(),))\n        except Conflict as error:\n            raise HTTPException(409, str(error)) from error\n        except Busy as error:\n            raise HTTPException(429, str(error)) from error\n        return note.model_dump()\n\n    @app.post(\"/imports\", status_code=202, dependencies=[Depends(authenticated)])\n    async def submit_import(body: ImportInput, service: Annotated[ImportJobs, Depends(jobs)]):\n        try:\n            job = service.submit(tuple(note.domain() for note in body.notes))\n        except Busy as error:\n            raise HTTPException(429, str(error), headers={\"Retry-After\": \"1\"}) from error\n        return job.snapshot()\n\n    @app.get(\"/imports/{job_id}\", dependencies=[Depends(authenticated)])\n    async def import_status(job_id: str, service: Annotated[ImportJobs, Depends(jobs)]):\n        job = service.jobs.get(job_id)\n        if job is None:\n            raise HTTPException(404, \"job not found or evicted\")\n        return job.snapshot()\n\n    return app\n\n\ndef build_app() -> FastAPI:\n    return create_app(Settings(token=os.environ.get(\"ATLAS_TOKEN\", \"\")))\n"
        },
        {
          "type": "paragraph",
          "text": "asynccontextmanager里yield之前是启动，yield之后的finally是停止。TaskGroup拥有固定worker；close先把accepting设为False，再cancel并等待worker，运行批次在CancelledError路径标cancelled并重新抛出，等待批次则逐一标取消和task_done，最后join确保计数归零。这里的关闭策略是取消未完成工作，而非承诺把所有接收任务耗时无限地跑完。"
        },
        {
          "type": "paragraph",
          "text": "取消必须继续传播，不能捕获后伪造成功。prepare自己的finally应释放借用资源；任务服务不会替未知库关闭它私有的连接。如果某段代码阻塞事件循环，协作取消也无法及时推进。正常关停的测试能证明当前实现无遗留worker，不能覆盖断电、SIGKILL或进程崩溃；内存任务也不会自动恢复。"
        }
      ]
    },
    {
      "id": "auth",
      "title": "共享Bearer演示认证入口，不能替代用户权限模型",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "HTTPBearer解析Authorization方案和凭据，本例用compare_digest比较配置中的共享token；缺失或不匹配返回401并附WWW-Authenticate。所有写笔记、读笔记和查任务接口都使用同一依赖。健康入口公开，便于观察启动是否完成。它没有用户账号、角色、笔记归属，也不是一套OAuth授权服务器或JWT验证实现。"
        },
        {
          "type": "paragraph",
          "text": "token从环境配置传给工厂，长度不合法时启动直接失败，不静默启用默认口令。README里的公开字符串只供本机loopback实验，代码不记录它。请求体仍可能先被框架读取和校验，不能因为写了Depends就断言未经认证请求绝不会消耗JSON解析资源；前面的字节限制因此仍有意义。真正跨机器传输还需要TLS与独立的权限设计。"
        }
      ]
    },
    {
      "id": "run",
      "title": "从真实入口启动，再分别观察接收、完成与失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter07/__main__.py",
          "kind": "excerpt",
          "purpose": "完整python -m入口；单worker保证当前内存状态只有一份。",
          "code": "import uvicorn\n\nif __name__ == \"__main__\":\n    uvicorn.run(\"chapter07.api:build_app\", factory=True, host=\"127.0.0.1\", port=8017,\n                workers=1, timeout_graceful_shutdown=5)\n"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在examples/python-course目录运行；所有HTTP请求只到本机。",
          "code": "python3.12 -m venv .venv-web\n.venv-web/bin/python -m pip install -r chapter07/requirements.lock\n.venv-web/bin/python -m unittest -v test_chapter07\nATLAS_TOKEN=local-demo-token-2026 .venv-web/bin/python -m chapter07"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在examples/python-course目录运行；所有HTTP请求只到本机。",
          "code": "curl --noproxy '*' -sS -X POST http://127.0.0.1:8017/imports \\\n  -H 'Authorization: Bearer local-demo-token-2026' -H 'Content-Type: application/json' \\\n  --data-binary @chapter07/fixtures/import.json\n# 记录响应id，再GET /imports/<id>；不是把202当完成。\ncurl --noproxy '*' -sS http://127.0.0.1:8017/notes -H 'Authorization: Bearer local-demo-token-2026'"
        },
        {
          "type": "paragraph",
          "text": "正常输入的终态应为succeeded、count2，列表含n1与n2。再次导入同一批，HTTP仍可202，但终态failed且笔记保持2条；这是处理时发现业务冲突。单笔POST相同ID直接409，title传123则422，无token访问列表401。排查时先记录HTTP状态与任务ID，再看任务终态，避免把一次成功提交误读成成功处理。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "测试分层：协议内调用、真实socket和可观察的关闭",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本机CPython3.12.14实际通过8项unittest。TestClient以with启动lifespan，覆盖201/401/409、422/413、导入成功和整批失败；异步测试用Event确认运行批次与等待批次，再验证429对应的Busy边界、超时清理、终态淘汰和关闭后不可submit。准备第二条失败时仓库仍为空，证明未发布半成品。"
        },
        {
          "type": "paragraph",
          "text": "另有真实loopback Uvicorn测试：内核分配端口，HTTPX真正连接、等待健康响应，再创建并读取笔记，停止后join服务线程。HTTPX设trust_env=False，避免本机环境代理把127.0.0.1请求带走；这曾在实际调试中表现为代理502，不能误判成应用路由失败。协议内测试与真实TCP证据各有作用，前者不会证明服务器绑定和关闭正确。"
        },
        {
          "type": "paragraph",
          "text": "当前没有耐久任务、跨worker共享、HTTPS或生产负载结论。开启多个Uvicorn worker会创建多份内存，任务ID可能在另一个进程查不到；重启后笔记与任务都丢失。下一章引入数据库并明确事务和连接借用边界，才能把“这次进程里看见了两条”推进到“重新打开数据库仍能查到同一次提交”。"
        }
      ]
    }
  ]
};
export default article;
