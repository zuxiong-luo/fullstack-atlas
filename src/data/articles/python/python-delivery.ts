import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "python-delivery",
  "topic": "python",
  "title": "Python 工程交付：配置、日志、测试、打包与性能分析",
  "description": "把笔记服务变成可安装分发包，从干净venv离线装wheel并离开源码启动，再验证配置失败、结构化请求日志和有明确口径的本机测量。",
  "minutes": 70,
  "labMinutes": 55,
  "tags": [
    "Python",
    "工程交付",
    "wheel",
    "配置",
    "结构化日志",
    "cProfile",
    "tracemalloc"
  ],
  "scope": "笔记项目第9阶段：独立src包、固定依赖、干净安装/真实HTTP/重启持久化；单机loopback实验、串行负载与存储函数分析，不发布生产容量或跨环境提速结论。",
  "prerequisites": [
    "第7章HTTP边界与第8章SQLite事务/连接池",
    "能使用venv和shell；本章提供完整构建与验收脚本"
  ],
  "kind": "series",
  "status": 'complete',
  "versions": [
    "CPython3.12.14 / SQLite3.53.1 / macOS14.5 x86_64实际运行",
    "FastAPI0.115.8栈与完整requirements.lock",
    "build1.2.2.post1 / setuptools75.8.0 / wheel0.45.1；完整build.lock"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "Python课程完整源码ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "第9章安装、交付与测量",
      "path": "python-course/chapter09/README.md"
    }
  ],
  "references": [
    {
      "title": "PyPA：构建Python项目与分发",
      "url": "https://packaging.python.org/en/latest/tutorials/packaging-projects/"
    },
    {
      "title": "setuptools：src布局与包发现",
      "url": "https://setuptools.pypa.io/en/latest/userguide/package_discovery.html#src-layout"
    },
    {
      "title": "Python3.12：logging",
      "url": "https://docs.python.org/3.12/library/logging.html"
    },
    {
      "title": "Python3.12：cProfile与pstats",
      "url": "https://docs.python.org/3.12/library/profile.html"
    },
    {
      "title": "Python3.12：tracemalloc",
      "url": "https://docs.python.org/3.12/library/tracemalloc.html"
    }
  ],
  "sections": [
    {
      "id": "artifact",
      "title": "工程交付的对象是可安装产物，以及可解释的运行条件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "工程交付把源码、依赖、配置和启动方式组织成另一个环境能够安装并运行的产物。代码在作者目录里能启动，只证明这一份工作树与当前环境碰巧齐全；全局包、PYTHONPATH、相对文件和未声明资源都可能让这个结果无法搬走。wheel是安装用的分发包，sdist是供重新构建的源分发，它们都不是把整个开发目录原样压缩。"
        },
        {
          "type": "paragraph",
          "text": "前一章已经验证SQLite事务和连接归还，本章保留那套同步持久化HTTP语义，增加配置、结构化日志、安装入口和性能观察。第7章202后台任务仍是独立阶段，没有声称它们现在也变成耐久任务。交付目标很具体：在一个干净venv中装wheel，离开源码目录，用已安装命令真实创建笔记、停止、重启并查回，再解释每条日志与测量数字覆盖什么。"
        },
        {
          "type": "paragraph",
          "text": "固定CPython3.12.14、SQLite3.53.1及前章HTTP栈；构建使用build1.2.2.post1、setuptools75.8.0、wheel0.45.1，运行与构建各有完整锁文件。PyPA和setuptools官方文档是当前维护页，实际安装版本另列，不伪装成它们也固定在当前页面版本。本文没有发布包到公共索引或改系统服务，所有运行仍在本机loopback。"
        },
        {
          "type": "figure",
          "src": "figures/python-delivery/release.svg",
          "title": "从源码到安装，再到三个不同的观察范围",
          "alt": "src快照经固定工具构建sdist与wheel，干净venv无源码运行；服务日志、客户端HTTP计时与独立存储profile分别形成证据。",
          "caption": "交付与观测职责示意，不表示耗时；不把不同负载结果互相当作优化对照。"
        }
      ]
    },
    {
      "id": "snapshot",
      "title": "从逐章目录到src包：让安装闭包真正闭合",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "分发名atlas-notes-course用于安装元数据，导入名atlas_notes用于Python模块，atlas-notes是命令行入口，三者可以不同。src布局让仓库根目录不直接成为导入包；测试仍须证明安装路径，因为把src手动加入sys.path也能掩盖缺包。本章的普通源码测试明确这么做，而干净安装验收另启进程、清除PYTHONPATH、换cwd，两层证据没有混用。"
        },
        {
          "type": "code",
          "language": "toml",
          "filename": "examples/python-course/chapter09/pyproject.toml",
          "kind": "excerpt",
          "purpose": "完整构建后端、运行依赖、Python版本与console script元数据。",
          "code": "[build-system]\nrequires = [\"setuptools==75.8.0\", \"wheel==0.45.1\"]\nbuild-backend = \"setuptools.build_meta\"\n\n[project]\nname = \"atlas-notes-course\"\nversion = \"0.1.0\"\ndescription = \"Local notes HTTP service for the Fullstack Atlas Python course\"\nreadme = \"README.md\"\nrequires-python = \">=3.12,<3.13\"\ndependencies = [\n  \"fastapi==0.115.8\", \"pydantic==2.10.6\", \"starlette==0.45.3\",\n  \"uvicorn==0.34.0\", \"httpx==0.28.1\"\n]\n\n[project.scripts]\natlas-notes = \"atlas_notes.cli:main\"\n\n[tool.setuptools.packages.find]\nwhere = [\"src\"]\n"
        },
        {
          "type": "paragraph",
          "text": "课程需要保留逐章历史，又不能让安装后的服务继续import chapter07或chapter08。因此生成器从前章提取完整领域、输入、数据库和API模块，只修改包内导入、服务标题与旧环境入口，生成独立src快照。新增配置/日志/CLI直接属于这个快照；--check逐字比较生成物，防止前章修复以后产物仍悄悄保留旧版本。它是一种教学版本组织选择，不要求真实团队都复制源码。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter09/sync_package.py",
          "kind": "excerpt",
          "purpose": "完整快照生成与一致性检查；源分发已经带完整src，不再读取课程前章。",
          "code": "\"\"\"Create an installable snapshot, without imports from the course checkout.\"\"\"\nimport argparse\nfrom pathlib import Path\n\nHERE = Path(__file__).resolve().parent\nCOURSE = HERE.parent\n\n\ndef expected() -> dict[str, str]:\n    domain = (COURSE / \"chapter04/notes_tool/domain.py\").read_text()\n    errors = (COURSE / \"chapter04/notes_tool/errors.py\").read_text()\n    jobs = (COURSE / \"chapter07/jobs.py\").read_text()\n    errors += \"\\n\\n\" + jobs[jobs.index(\"class Conflict\"):jobs.index(\"class MemoryNotes\")]\n    models = (COURSE / \"chapter07/models.py\").read_text().replace(\n        \"from chapter04.notes_tool.domain import Note\", \"from .domain import Note\")\n    storage = (COURSE / \"chapter08/storage.py\").read_text().replace(\n        \"from chapter04.notes_tool.domain import Note\", \"from .domain import Note\").replace(\n        \"from chapter07.jobs import Busy, Conflict\", \"from .errors import Busy, Conflict\")\n    api = (COURSE / \"chapter08/api.py\").read_text().replace(\n        \"from chapter07.api import Settings\", \"from .config import AuthSettings as Settings\").replace(\n        \"from chapter07.body_limit\", \"from .body_limit\").replace(\n        \"from chapter07.models\", \"from .models\").replace(\n        'title=\"Atlas Notes chapter 8\"', 'title=\"Atlas Notes installed service\"')\n    api = api.split(\"\\n\\ndef build_app\", 1)[0] + \"\\n\"\n    return {\"domain.py\": domain, \"errors.py\": errors, \"models.py\": models,\n            \"body_limit.py\": (COURSE / \"chapter07/body_limit.py\").read_text(),\n            \"storage.py\": storage, \"api.py\": api}\n\n\ndef main() -> None:\n    parser = argparse.ArgumentParser()\n    parser.add_argument(\"--check\", action=\"store_true\")\n    options = parser.parse_args()\n    for name, body in expected().items():\n        target = HERE / \"src/atlas_notes\" / name\n        if options.check:\n            if not target.exists() or target.read_text() != body:\n                raise SystemExit(\"package snapshot differs: \" + name)\n        else:\n            target.write_text(body)\n    print(\"installable source snapshot matches\" if options.check else \"installable source snapshot generated\")\n\n\nif __name__ == \"__main__\":\n    main()\n"
        },
        {
          "type": "code",
          "language": "text",
          "filename": "examples/python-course/chapter09/MANIFEST.in",
          "kind": "excerpt",
          "purpose": "明确将复现锁与安装验收器带入sdist。",
          "code": "include requirements.lock\ninclude build.lock\ninclude verify_install.py\n"
        },
        {
          "type": "paragraph",
          "text": "pyproject声明直接依赖，requirements.lock固定本次解析出的完整运行图，build.lock固定构建前后端与其依赖。锁住版本不等于保证任意平台都有二进制wheel；本次wheelhouse按实际平台下载，换Linux要重新取对应的pydantic-core轮子。打包不携带venv、node_modules、缓存和已构建build目录，也不把本机下载缓存冒充可跨平台的离线镜像。"
        }
      ]
    },
    {
      "id": "config",
      "title": "配置先验证，再创建数据库与监听socket",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "配置是环境提供给程序的输入边界，和HTTP正文一样需要类型与约束。ATLAS_DB必须绝对路径，避免工作目录变化时无意创建另一个数据库；端口、池大小有范围，未知ATLAS_键直接拒绝，减少拼写错误被静默忽略。token单独藏在repr之外，错误消息只说明字段条件，不回显用户给的秘密值。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter09/src/atlas_notes/config.py",
          "kind": "excerpt",
          "purpose": "完整环境配置解析；从字符串形成受约束的不可变配置。",
          "code": "from collections.abc import Mapping\nfrom dataclasses import dataclass, field\nfrom pathlib import Path\nimport re\n\n\n@dataclass(frozen=True)\nclass AuthSettings:\n    token: str = field(repr=False)\n\n    def __post_init__(self) -> None:\n        if not re.fullmatch(r\"[A-Za-z0-9_-]{16,128}\", self.token):\n            raise ValueError(\"ATLAS_TOKEN must be 16..128 ASCII token characters\")\n\n\n@dataclass(frozen=True)\nclass Config:\n    database: Path\n    auth: AuthSettings\n    port: int = 8019\n    pool_size: int = 2\n\n    @classmethod\n    def from_env(cls, values: Mapping[str, str]) -> \"Config\":\n        known = {\"ATLAS_DB\", \"ATLAS_TOKEN\", \"ATLAS_PORT\", \"ATLAS_POOL_SIZE\"}\n        if any(key.startswith(\"ATLAS_\") and key not in known for key in values):\n            raise ValueError(\"unknown ATLAS_ configuration key\")\n        raw_path = values.get(\"ATLAS_DB\", \"\")\n        if not raw_path or not Path(raw_path).is_absolute():\n            raise ValueError(\"ATLAS_DB must be an absolute local file path\")\n\n        def integer(key: str, default: int, lower: int, upper: int) -> int:\n            value = values.get(key, str(default))\n            if not value.isascii() or not value.isdecimal() or not lower <= int(value) <= upper:\n                raise ValueError(f\"{key} outside {lower}..{upper}\")\n            return int(value)\n\n        return cls(Path(raw_path), AuthSettings(values.get(\"ATLAS_TOKEN\", \"\")),\n                   integer(\"ATLAS_PORT\", 8019, 0, 65535),\n                   integer(\"ATLAS_POOL_SIZE\", 2, 1, 4))\n"
        },
        {
          "type": "paragraph",
          "text": "配置错误以JSON输出并退出2，尚未创建应用或绑定socket。端口0只供测试由内核选空闲端口，默认8019始终绑定127.0.0.1；没有偷偷把演示服务暴露到公网。环境变量也不是秘密保险箱，仍可能被拥有相应权限的进程或平台读取；本例只是避免在程序输出中扩散它，不提供秘密分发系统。"
        }
      ]
    },
    {
      "id": "logs",
      "title": "结构化日志把一次请求连起来，不把输入全部复制出去",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "日志是运行时事件记录。结构化意味着每条事件有稳定字段，便于按request_id关联、按status聚合，而不是事后从一大段文本猜含义。每次HTTP请求由服务生成UUID并放入X-Request-ID，记录方法、匹配到的路由模板、状态和耗时；不记录Authorization、query、原始路径或正文，避免把token和笔记标题顺手写进日志。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter09/src/atlas_notes/observability.py",
          "kind": "excerpt",
          "purpose": "完整JSON formatter与ASGI请求观察器，包装整个应用以观察错误响应。",
          "code": "import json\nimport logging\nimport time\nfrom uuid import uuid4\nfrom starlette.types import ASGIApp, Receive, Scope, Send\n\nLOGGER = logging.getLogger(\"atlas.notes\")\n\n\nclass JsonFormatter(logging.Formatter):\n    def format(self, record: logging.LogRecord) -> str:\n        return json.dumps({\"level\": record.levelname, **getattr(record, \"atlas\", {})},\n                          ensure_ascii=False, separators=(\",\", \":\"))\n\n\ndef configure_logging() -> None:\n    handler = logging.StreamHandler()\n    handler.setFormatter(JsonFormatter())\n    LOGGER.handlers[:] = [handler]\n    LOGGER.setLevel(logging.INFO)\n    LOGGER.propagate = False\n\n\ndef event(name: str, **fields: object) -> None:\n    LOGGER.info(name, extra={\"atlas\": {\"event\": name, **fields}})\n\n\nclass RequestLog:\n    def __init__(self, app: ASGIApp) -> None:\n        self.app = app\n\n    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:\n        if scope[\"type\"] != \"http\":\n            await self.app(scope, receive, send)\n            return\n        request_id, started, status = uuid4().hex, time.perf_counter(), 500\n\n        async def observed(message: dict) -> None:\n            nonlocal status\n            if message[\"type\"] == \"http.response.start\":\n                status = message[\"status\"]\n                message = dict(message, headers=[*message.get(\"headers\", []),\n                                                (b\"x-request-id\", request_id.encode())])\n            await send(message)\n\n        try:\n            await self.app(scope, receive, observed)\n        finally:\n            route = getattr(scope.get(\"route\"), \"path\", \"unmatched\")\n            event(\"request\", request_id=request_id, method=scope[\"method\"], route=route,\n                  status=status, elapsed_ms=round((time.perf_counter() - started) * 1000, 3))\n            # Deliberately exclude headers, token, query string, raw path and body.\n"
        },
        {
          "type": "paragraph",
          "text": "记录路由模板而不是具体路径，既避免某些ID进入日志，也让同一路由能聚合。没有匹配到路由时写unmatched；不会把攻击者构造的超长路径当成一个高基数字段。JSON编码让换行和引号作为字符串转义，一条事件仍是一行。日志策略应明确允许哪些字段，而不只是在输出以后搜索一次password字样。"
        },
        {
          "type": "paragraph",
          "text": "elapsed_ms在应用外层从调用开始算到响应应用结束，包含依赖、路由和发送路径，不等于纯数据库耗时，也不代表客户端已收到最后一个字节。默认关闭Uvicorn access log以减少重复记录，但第三方启动错误仍可能打印自己的文本；“本应用事件为JSON”不能扩张成全部依赖输出都受同一格式约束。"
        }
      ]
    },
    {
      "id": "entry",
      "title": "入口拥有socket，lifespan仍拥有连接池",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter09/src/atlas_notes/cli.py",
          "kind": "excerpt",
          "purpose": "完整安装命令入口：配置、关联日志、真实socket、Uvicorn与退出清理。",
          "code": "import json\nimport os\nimport platform\nimport socket\nimport sqlite3\nimport sys\nimport uvicorn\nfrom . import __version__\nfrom .api import create_app\nfrom .config import Config\nfrom .observability import RequestLog, configure_logging, event\n\n\ndef main() -> int:\n    try:\n        config = Config.from_env(os.environ)\n    except ValueError as error:\n        print(json.dumps({\"event\": \"configuration_error\", \"detail\": str(error)}), file=sys.stderr)\n        return 2\n    configure_logging()\n    app = RequestLog(create_app(config.database, config.auth, pool_size=config.pool_size))\n    listener = socket.socket()\n    try:\n        listener.bind((\"127.0.0.1\", config.port))\n        port = listener.getsockname()[1]\n        event(\"listener_bound\", host=\"127.0.0.1\", port=port, version=__version__,\n              python=platform.python_version(), sqlite=sqlite3.sqlite_version,\n              pool_size=config.pool_size)\n        # Bound is not ready: clients must still observe /health after lifespan.\n        server = uvicorn.Server(uvicorn.Config(app, log_level=\"warning\", access_log=False,\n                                              timeout_graceful_shutdown=5))\n        try:\n            server.run(sockets=[listener])\n        except KeyboardInterrupt:\n            pass\n        if not server.started:\n            return 3\n    finally:\n        listener.close()\n        event(\"server_closed\")\n    return 0\n"
        },
        {
          "type": "paragraph",
          "text": "listener_bound只说明socket已经bind，迁移可能仍未完成；验收必须真正请求/health，不靠看见一行启动日志就宣布ready。应用启动失败时Server.started仍为False，命令返回3。正常Ctrl+C后Uvicorn完成在途处理与lifespan，池关闭，入口再关闭监听socket并记录server_closed。SIGKILL或断电不能保证finally，但内核会回收进程句柄；没有因此证明业务任务都完成了。"
        },
        {
          "type": "paragraph",
          "text": "构建前先--check，然后用固定构建环境生成sdist和wheel。本次实际从sdist再构建wheel，并把wheel装进全新venv；没有用editable install把源目录链接进安装环境。发行版本、包版本和依赖声明也需要保持一致，不能只看文件名中有0.1.0就认为内容一定来自预期源码。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在examples/python-course目录运行；所有HTTP请求只到本机。",
          "code": "python3.12 -m venv .venv-web\n.venv-web/bin/python -m pip install -r chapter07/requirements.lock -r chapter09/build.lock\n.venv-web/bin/python chapter09/sync_package.py --check\n.venv-web/bin/python -m build --no-isolation chapter09 --outdir \"$PWD/.release\""
        }
      ]
    },
    {
      "id": "clean",
      "title": "干净安装验收要离开源码，也要证明失败和关闭",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "安装验收器先创建独立venv，从本机wheelhouse用--no-index安装完整锁与产物，再运行pip check。它清除PYTHONPATH、切到临时cwd，检查atlas_notes.__file__来自新venv，并确认导入模块没有chapter前缀。这样，测试通过不能靠作者目录里的文件或全局包补缺。下载wheelhouse本身需要网络，离线的是随后安装阶段，二者也要分清。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter09/verify_install.py",
          "kind": "excerpt",
          "purpose": "完整干净安装与真实HTTP验收：普通请求、失败、重启持久化、日志与关闭均在脚本里执行。",
          "code": "\"\"\"Install a wheel offline into a fresh venv and run outside the source checkout.\"\"\"\nimport argparse\nimport json\nimport os\nfrom pathlib import Path\nimport signal\nimport subprocess\nimport sys\nimport tempfile\nimport time\n\nimport httpx\n\nHERE = Path(__file__).resolve().parent\nTOKEN = \"local-demo-token-2026\"\n\n\ndef command(arguments: list[str], *, cwd: Path, env: dict[str, str], timeout: int = 60) -> str:\n    result = subprocess.run(arguments, cwd=cwd, env=env, text=True,\n                            capture_output=True, timeout=timeout)\n    if result.returncode:\n        raise RuntimeError(f\"command failed: {arguments[0]} ({result.returncode})\\n\"\n                           + result.stdout + result.stderr)\n    return result.stdout\n\n\ndef verify(wheel: Path, wheelhouse: Path) -> dict[str, object]:\n    if not wheel.is_file() or not wheelhouse.is_dir():\n        raise ValueError(\"wheel and wheelhouse must exist\")\n    with tempfile.TemporaryDirectory(prefix=\"atlas-installed-\") as temporary:\n        work = Path(temporary)\n        environment = {key: value for key, value in os.environ.items()\n                       if key != \"PYTHONPATH\" and not key.startswith(\"ATLAS_\")}\n        environment[\"PYTHONNOUSERSITE\"] = \"1\"\n        venv = work / \"venv\"\n        command([sys.executable, \"-m\", \"venv\", str(venv)], cwd=work, env=environment)\n        python, executable = venv / \"bin/python\", venv / \"bin/atlas-notes\"\n        command([str(python), \"-m\", \"pip\", \"install\", \"--disable-pip-version-check\",\n                 \"--no-index\", \"--find-links\", str(wheelhouse), \"-r\", str(HERE / \"requirements.lock\"),\n                 str(wheel)], cwd=work, env=environment)\n        command([str(python), \"-m\", \"pip\", \"check\"], cwd=work, env=environment)\n        imported = json.loads(command([str(python), \"-c\",\n            \"import atlas_notes,atlas_notes.api,importlib.metadata,json,sys; print(json.dumps({'file':atlas_notes.__file__,\"\n            \"'version':atlas_notes.__version__,'metadata':importlib.metadata.version('atlas-notes-course'),'course_imports':[n for n in sys.modules if n.startswith('chapter')]}))\"],\n            cwd=work, env=environment))\n        assert (str(venv) in imported[\"file\"] and not imported[\"course_imports\"]\n                and imported[\"version\"] == imported[\"metadata\"] == \"0.1.0\"), imported\n        bad = subprocess.run([str(executable)], cwd=work, env=environment | {\n            \"ATLAS_TOKEN\": \"do-not-echo-this!\", \"ATLAS_DB\": \"relative\"}, text=True,\n            capture_output=True, timeout=5)\n        assert bad.returncode == 2 and \"do-not-echo-this!\" not in bad.stdout + bad.stderr\n        environment |= {\"ATLAS_TOKEN\": TOKEN, \"ATLAS_DB\": str(work / \"data/notes.sqlite3\"), \"ATLAS_PORT\": \"0\"}\n        benchmark = None\n        for first in (True, False):\n            log_path = work / (\"first.jsonl\" if first else \"reopen.jsonl\")\n            with log_path.open(\"w\") as log:\n                entry = [str(executable)] if first else [str(python), \"-m\", \"atlas_notes\"]\n                process = subprocess.Popen(entry, cwd=work, env=environment,\n                                           stdout=log, stderr=log)\n                try:\n                    deadline = time.monotonic() + 8\n                    port = None\n                    while port is None:\n                        for line in log_path.read_text().splitlines():\n                            try:\n                                event = json.loads(line)\n                            except ValueError:\n                                continue\n                            if event.get(\"event\") == \"listener_bound\":\n                                port = event[\"port\"]\n                        if process.poll() is not None or time.monotonic() > deadline:\n                            raise AssertionError(\"installed listener did not bind: \" + log_path.read_text())\n                        if port is None:\n                            time.sleep(.02)\n                    base = f\"http://127.0.0.1:{port}\"\n                    with httpx.Client(base_url=base, timeout=.3, trust_env=False) as client:\n                        while True:\n                            try:\n                                if client.get(\"/health\").json() == {\"ready\": True}:\n                                    break\n                            except (httpx.HTTPError, ValueError):\n                                pass\n                            if time.monotonic() > deadline:\n                                raise AssertionError(\"installed HTTP health not observed\")\n                            time.sleep(.02)\n                        headers = {\"Authorization\": \"Bearer \" + TOKEN}\n                        if first:\n                            note = {\"id\": \"n1\", \"title\": \"private-title-never-log\", \"tags\": [\"python\"]}\n                            created = client.post(\"/notes\", json=note, headers=headers)\n                            assert created.status_code == 201 and created.headers[\"x-request-id\"]\n                            assert client.post(\"/imports\", json={\"notes\": [note | {\"id\": \"n2\"}]},\n                                               headers=headers).status_code == 201\n                            assert client.post(\"/notes\", json=note, headers=headers).status_code == 409\n                            assert client.post(\"/notes\", json=note | {\"id\": \"n3\", \"title\": 123},\n                                               headers=headers).status_code == 422\n                            assert client.get(\"/notes\").status_code == 401\n                            benchmark = json.loads(command([str(python), \"-m\", \"atlas_notes.measure\",\n                                                            \"--url\", base, \"--samples\", \"32\"],\n                                                           cwd=work, env=environment))\n                        assert len(client.get(\"/notes\", headers=headers).json()[\"notes\"]) == 2\n                finally:\n                    if process.poll() is None:\n                        process.send_signal(signal.SIGINT)\n                    try:\n                        process.wait(timeout=8)\n                    except subprocess.TimeoutExpired:\n                        process.kill()\n                        process.wait(timeout=2)\n                        raise AssertionError(\"installed service failed graceful shutdown\")\n            assert process.returncode == 0, (process.returncode, log_path.read_text())\n            text = log_path.read_text()\n            assert TOKEN not in text and \"private-title-never-log\" not in text\n            events = [json.loads(line) for line in text.splitlines()]\n            assert any(event.get(\"event\") == \"server_closed\" for event in events)\n            assert all(\"request_id\" in event for event in events if event.get(\"event\") == \"request\")\n        profile_path = work / \"storage.prof\"\n        profile = json.loads(command([str(python), \"-m\", \"atlas_notes.profile_storage\", \"--output\", str(profile_path)],\n                                     cwd=work, env=environment))\n        assert profile_path.stat().st_size > 0\n        profile_top = command([str(python), \"-c\", \"import pstats,sys; pstats.Stats(sys.argv[1]).sort_stats('cumulative').print_stats(8)\",\n                               str(profile_path)], cwd=work, env=environment)\n        assert \"snapshot\" in profile_top\n        return {\"installed_version\": imported[\"version\"], \"source_checkout_imports\": [],\n                \"fresh_venv_offline_install\": True, \"real_http\": [201, 409, 422, 401],\n                \"reopened_notes\": 2, \"clean_shutdowns\": 2, \"secret_free_logs\": True,\n                \"http_benchmark\": benchmark, \"storage_profile\": profile}\n\n\ndef main() -> None:\n    parser = argparse.ArgumentParser()\n    parser.add_argument(\"--wheel\", type=Path, required=True)\n    parser.add_argument(\"--wheelhouse\", type=Path, required=True)\n    options = parser.parse_args()\n    print(json.dumps(verify(options.wheel.resolve(), options.wheelhouse.resolve()), ensure_ascii=False))\n\n\nif __name__ == \"__main__\":\n    main()\n"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在examples/python-course目录运行；所有HTTP请求只到本机。",
          "code": "mkdir -p .wheelhouse\n.venv-web/bin/python -m pip download --only-binary=:all: -r chapter09/requirements.lock -d .wheelhouse\n.venv-web/bin/python chapter09/verify_install.py \\\n  --wheel .release/atlas_notes_course-0.1.0-py3-none-any.whl --wheelhouse .wheelhouse"
        },
        {
          "type": "paragraph",
          "text": "本次实际得到201创建、409重复、422字段错误、401缺认证；导入后GET两条，正常停止并以同一DB重启仍为两条，两次进程退出均为0，日志有request_id与server_closed且没有token或标题。配置故障另测退出2且不回显值。临时环境与数据库在finally之后删除，强制清理只针对验证器自己Popen的进程，不枚举或停止其他服务。"
        },
        {
          "type": "paragraph",
          "text": "普通课程测试则覆盖61项：原前五章33项保持独立标准库可跑，第7章8项、第8章12项、第9章8项。全发现需要先安装Web锁；第六章仍在独立python-async-services目录，有自己的标准库测试，不为凑编号移动它。这些检查覆盖不同边界，安装成功并不自动证明数据库事务正确，反过来事务测试通过也不证明wheel带齐模块。"
        }
      ]
    },
    {
      "id": "measure",
      "title": "先定义延迟的起点终点，再给出百分位与完成率",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "性能分析先回答测什么。下面的HTTP负载只有一个客户端、并发1、固定2条笔记，连续GET/notes；每次计时包含HTTP请求、响应收取和JSON解码。先预热5次并排除，再取32个样本，p50/p95用排序后的nearest-rank；完成率是32除以这一轮总秒数。它不是服务器饱和吞吐，也不包含公网、TLS或多人并发。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter09/src/atlas_notes/measure.py",
          "kind": "excerpt",
          "purpose": "完整本机串行HTTP测量器；限制loopback目标，不默认请求外部主机。",
          "code": "import argparse\nimport json\nimport math\nimport os\nimport platform\nimport time\nfrom urllib.parse import urlsplit\nimport httpx\n\n\ndef benchmark(url: str, token: str, samples: int = 32, warmup: int = 5) -> dict[str, object]:\n    parsed = urlsplit(url)\n    if parsed.scheme != \"http\" or parsed.hostname != \"127.0.0.1\" or parsed.path not in (\"\", \"/\"):\n        raise ValueError(\"benchmark only accepts an http://127.0.0.1:port base URL\")\n    if parsed.username or parsed.password or parsed.query or parsed.fragment:\n        raise ValueError(\"base URL must not contain credentials, query or fragment\")\n    if type(samples) is not int or not 1 <= samples <= 1000 or not 0 <= warmup <= 20:\n        raise ValueError(\"invalid benchmark sample counts\")\n    timings = []\n    with httpx.Client(base_url=url, timeout=2, trust_env=False,\n                      headers={\"Authorization\": \"Bearer \" + token}) as client:\n        def request() -> int:\n            response = client.get(\"/notes\")\n            response.raise_for_status()\n            return len(response.json()[\"notes\"])\n        for _ in range(warmup):\n            request()\n        started = time.perf_counter()\n        counts = []\n        for _ in range(samples):\n            before = time.perf_counter()\n            counts.append(request())\n            timings.append((time.perf_counter() - before) * 1000)\n        elapsed = time.perf_counter() - started\n    ordered = sorted(timings)\n    percentile = lambda fraction: ordered[max(0, math.ceil(fraction * samples) - 1)]\n    return {\"python\": platform.python_version(), \"workload\": \"serial GET /notes including JSON decode\",\n            \"concurrency\": 1, \"samples\": samples, \"warmup_excluded\": warmup,\n            \"note_counts\": sorted(set(counts)), \"elapsed_s\": round(elapsed, 6),\n            \"p50_ms\": round(percentile(.5), 3), \"p95_ms\": round(percentile(.95), 3),\n            \"requests_per_s\": round(samples / elapsed, 2)}\n\n\ndef main() -> None:\n    parser = argparse.ArgumentParser()\n    parser.add_argument(\"--url\", default=\"http://127.0.0.1:8019\")\n    parser.add_argument(\"--samples\", type=int, default=32)\n    options = parser.parse_args()\n    print(json.dumps(benchmark(options.url, os.environ.get(\"ATLAS_TOKEN\", \"\"), options.samples)))\n\n\nif __name__ == \"__main__\":\n    main()\n"
        },
        {
          "type": "table",
          "headers": [
            "实际这一轮口径",
            "结果",
            "能说明什么"
          ],
          "rows": [
            [
              "macOS14.5 x86_64，CPython3.12.14，2条笔记，32请求/并发1",
              "p50 2.093ms；p95 2.392ms",
              "该次本机客户端端到端样本"
            ],
            [
              "总计时0.068677秒，预热5次不计",
              "465.95 requests/s",
              "该串行负载的完成率，非容量上限"
            ],
            [
              "CPU信息由sysctl报告",
              "Intel Core i7-9750H @2.60GHz",
              "环境信息，不保证固定调频或独占硬件"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这些数值来自第一次完整干净安装验收，不是多次挑最好一次。后台负载、调频、日志与数据库缓存都会影响结果，32个样本也不足以推导稳定长尾。若要比较两种实现，需固定输入、并发、预热、重复轮次和统计办法，同时检查错误率；不能拿这一轮低延迟给另一台机器承诺相同结果，更不能凭提高并发后的完成率就断言单请求变快。"
        }
      ]
    },
    {
      "id": "profile",
      "title": "函数分析与内存追踪用来定位，不当作无开销基准",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "cProfile统计函数调用次数与时间，pstats可按cumulative看调用链累计耗时，或按tottime看函数自身消耗。它会增加观测开销，Python与C函数的开销分布也不同，因此适合找下一步要检查的位置，不适合直接把分析器内的秒数当作公平性能排名。HTTP客户端分析更不能自动指出另一个服务进程里哪条SQL最慢。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter09/src/atlas_notes/profile_storage.py",
          "kind": "excerpt",
          "purpose": "完整独立存储分析：128条×2标签、预热5次、20次snapshot并写实际profile文件。",
          "code": "import argparse\nimport cProfile\nimport json\nfrom pathlib import Path\nimport platform\nimport sqlite3\nimport tempfile\nimport time\nimport tracemalloc\nfrom .domain import Note\nfrom .storage import ConnectionPool, NotesRepository, migrate\n\n\ndef profile(output: Path) -> dict[str, object]:\n    with tempfile.TemporaryDirectory(prefix=\"atlas-notes-profile-\") as folder:\n        path = Path(folder) / \"notes.sqlite3\"\n        migrate(path)\n        pool = ConnectionPool(path, 1)\n        try:\n            with pool.borrow() as connection:\n                repository = NotesRepository(connection)\n                for start in range(0, 128, 32):\n                    repository.add_batch(tuple(Note(f\"n{i}\", f\"note {i}\", (\"python\", \"profile\"))\n                                               for i in range(start, start + 32)))\n                for _ in range(5):\n                    repository.snapshot()\n                profiler = cProfile.Profile()\n                tracemalloc.start()\n                try:\n                    started = time.perf_counter()\n                    profiler.enable()\n                    for _ in range(20):\n                        assert len(repository.snapshot()) == 128\n                    profiler.disable()\n                    elapsed = time.perf_counter() - started\n                    current, peak = tracemalloc.get_traced_memory()\n                finally:\n                    profiler.disable()\n                    tracemalloc.stop()\n                profiler.dump_stats(output)\n        finally:\n            pool.close()\n    return {\"python\": platform.python_version(), \"sqlite\": sqlite3.sqlite_version,\n            \"workload\": \"20 repository snapshots, 128 notes x 2 tags, warmup 5 excluded\",\n            \"profiled_elapsed_s\": round(elapsed, 6), \"traced_current_bytes\": current,\n            \"traced_peak_bytes\": peak, \"includes_profiler_overhead\": True,\n            \"memory_scope\": \"Python allocations in this process; excludes SQLite native pages and RSS\"}\n\n\ndef main() -> None:\n    parser = argparse.ArgumentParser()\n    parser.add_argument(\"--output\", type=Path, required=True)\n    options = parser.parse_args()\n    print(json.dumps(profile(options.output)))\n\n\nif __name__ == \"__main__\":\n    main()\n"
        },
        {
          "type": "paragraph",
          "text": "为了给函数分析一条明确路径，我们另建临时数据库，放128条笔记，每条2标签；预热5次后记录20次snapshot。第一轮实测带分析器耗时0.072231秒，tracemalloc当前32467字节、峰值78138字节。它们属于另一份负载，不能和前面的2条笔记HTTP延迟相减或互比，也不能把这里的小峰值包装成整个HTTP服务只占几十KB。"
        },
        {
          "type": "paragraph",
          "text": "tracemalloc只追踪启动之后的Python分配。数据库原生页、解释器先前对象、socket内核缓冲和进程RSS不都在这个数字里；current代表当前仍跟踪的分配，peak代表本次跟踪区间峰值。要调查泄漏，应在同样操作多轮后比较快照与仍存活对象，而不是看到一次峰值就宣布内存泄漏或没有泄漏。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在examples/python-course目录运行；所有HTTP请求只到本机。",
          "code": "ATLAS_TOKEN=local-demo-token-2026 python -m atlas_notes.measure --samples 32\npython -m atlas_notes.profile_storage --output /absolute/path/to/storage.prof\npython -m pstats /absolute/path/to/storage.prof\n# pstats内：sort cumulative；stats 15；quit"
        },
        {
          "type": "paragraph",
          "text": "作者实际生成并用pstats打开profile文件，确认snapshot调用存在；测试不只断言输出有一个prof后缀。分析结果若显示大部分时间在SQLite抓取，可进一步看查询计划与返回行数；若在对象组装，可检视重复分配。只有提出可验证的改动并重新测同一负载，才谈得上优化收益，本章没有虚构一个改前改后的倍数。"
        }
      ]
    },
    {
      "id": "limits",
      "title": "交付完成后，仍要知道证据停止在哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "当前产物能从干净环境安装、真实启动、按配置失败、留下受控日志、重启查回笔记，并执行口径明确的本机观察。正文关键路径与下载文件逐字对应，src快照校验把前章实现和最终分发连起来。它把“作者电脑里能跑”推进为一次可复现安装证据，但没有覆盖所有操作系统、真实手机、生产权限或长期可用性。"
        },
        {
          "type": "paragraph",
          "text": "完整服务依旧是单机loopback、共享Bearer、SQLite与同步有限批次接口。公网TLS、用户隔离、备份恢复、迁移发布编排、耐久异步任务和多实例容量都要另行设计。读完这条笔记项目后，下一步应围绕实际需求补其中一个边界，并用相同方法留下输入、状态、失败窗口与验收命令，避免用“工程化”三个字替代可运行的交付。"
        }
      ]
    }
  ]
};
export default article;
