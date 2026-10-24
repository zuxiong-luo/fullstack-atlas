import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "python-data-access",
  "topic": "python",
  "title": "Python 数据访问：事务、连接池、迁移与集成测试",
  "description": "把内存笔记换成真实SQLite文件，明确事务提交、连接独占借用、有限等待与迁移历史，用冲突和写锁复现失败恢复。",
  "minutes": 65,
  "labMinutes": 50,
  "tags": [
    "Python",
    "SQLite",
    "事务",
    "连接池",
    "迁移",
    "集成测试"
  ],
  "scope": "笔记项目第8阶段，CPython3.12.14实际SQLite3.53.1；单主机本地文件、同步数据库访问与有限教学连接池。不承诺耐久任务、生产迁移编排、跨主机或故障耐久测试。",
  "prerequisites": [
    "第4章Note/资源边界、第7章HTTP模型与依赖",
    "理解SQL基本表/查询；不需要第9章打包"
  ],
  "kind": "series",
  "status": 'complete',
  "versions": [
    "CPython3.12.14 / 实际SQLite3.53.1 / sqlite3.threadsafety=3",
    "Python3.12文档维护版3.12.15；显式autocommit=True",
    "FastAPI0.115.8及chapter07/requirements.lock完整依赖"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "Python课程完整源码ZIP",
      "path": "python-course.zip"
    },
    {
      "label": "第8章启动、事务与限制",
      "path": "python-course/chapter08/README.md"
    }
  ],
  "references": [
    {
      "title": "Python3.12：sqlite3与事务控制",
      "url": "https://docs.python.org/3.12/library/sqlite3.html"
    },
    {
      "title": "SQLite：显式事务与单写者",
      "url": "https://www.sqlite.org/lang_transaction.html"
    },
    {
      "title": "SQLite：每个连接启用外键",
      "url": "https://www.sqlite.org/foreignkeys.html"
    },
    {
      "title": "SQLite：WAL并发与本机文件限制",
      "url": "https://www.sqlite.org/wal.html"
    },
    {
      "title": "FastAPI0.115.8：依赖退出栈与响应边界",
      "url": "https://github.com/fastapi/fastapi/blob/0.115.8/fastapi/routing.py"
    },
    {
      "title": "SQLite官方：普通表的PRIMARY KEY可能包含NULL",
      "url": "https://www.sqlite.org/quirks.html#primary_keys_can_sometimes_contain_nulls"
    }
  ],
  "sections": [
    {
      "id": "persistence",
      "title": "持久化把状态放到进程外，事务再定义哪一组变化一起成立",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据访问层把领域操作转换成数据库读写，管理参数、事务和连接。数据库连接是应用与数据库引擎交互的会话或句柄，不等于每次请求本身；事务则是一组被一起提交或回滚的操作。把笔记写到文件，只回答了数据存在哪里，尚未回答第二条失败时第一条该不该保留，也没有回答两个请求是否正在共用同一条连接。"
        },
        {
          "type": "paragraph",
          "text": "上一章内存仓库保证同一事件循环里先检查再update，重启后所有状态仍会消失。本章继续同一笔记模型与HTTP字段，换成真实SQLite文件，并用实际第二条唯一键冲突验证整批回滚。SQLite库在应用进程内工作，不需另起数据库服务器；它仍有真实SQL、锁、事务和文件提交机制，不能因为没有远程端口就把它当成一个普通字典。"
        },
        {
          "type": "paragraph",
          "text": "实际环境为CPython3.12.14链接SQLite3.53.1、threadsafety=3，HTTP依赖沿用上一章锁文件。Python3.12官方页当前维护到3.12.15，SQLite官网文档会持续更新，所以运行版本单独记录；本章没有把所有Python3.12安装都说成附带同一个SQLite版本。实验只用自己创建的本机临时目录，不连接公司或云端数据库。"
        }
      ]
    },
    {
      "id": "unit",
      "title": "一条业务提交为什么需要多条SQL",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "我们把笔记主体与标签拆成notes、note_tags两表。notes.id是主键；每个标签带note_id外键、位置和文本，位置保留原始顺序，唯一约束拒绝重复标签。添加一批笔记时，会先写主体再写标签；若其中任何一条失败，整批都应撤销。否则客户端看见“导入失败”，数据库却可能留下一半笔记或缺标签的记录。"
        },
        {
          "type": "paragraph",
          "text": "约束放在数据库里，是为了让所有写入路径都遵守基本不变量。HTTP模型能更早给出友好错误，却不能替代唯一键和外键；另一个脚本也可能写这个文件。每个连接都显式设置PRAGMA foreign_keys=ON，不能只在迁移连接上开一次就假定池里的其他连接也受约束。实验实际插入不存在的note_id并观察IntegrityError。"
        },
        {
          "type": "paragraph",
          "text": "SQLite还有一条容易带入错误直觉的规则：普通rowid表里，TEXT PRIMARY KEY不自动等于NOT NULL，甚至可能出现多条NULL主键。我们因此显式写id TEXT NOT NULL PRIMARY KEY；真实测试分别尝试两次NULL插入，都必须被数据库拒绝。这个修正发生在初始迁移发布前，校验和随之改变；已有早期草稿文件会拒绝启动，而非静默接受差异。实验数据可改用自己新建的空路径，需要保留的数据则应另设计追加迁移/表重建与NULL处置，不自动删除或改写历史。"
        },
        {
          "type": "reference",
          "title": "SQLite官方：PRIMARY KEY的NULL历史边界",
          "url": "https://www.sqlite.org/quirks.html#primary_keys_can_sometimes_contain_nulls",
          "note": "本例普通rowid表使用显式NOT NULL，不依赖TEXT PRIMARY KEY隐含非空。"
        },
        {
          "type": "paragraph",
          "text": "SQL值始终通过问号参数传递。标题即使包含引号和看起来像DROP TABLE的文本，也只是标题，不会拼成新语句。参数化不能代替动态表名、列名的白名单，因为这些是SQL结构；本例只有占位符数量由内部已限额ID集合生成，所有用户ID与正文仍走绑定值。"
        }
      ]
    },
    {
      "id": "transaction",
      "title": "显式BEGIN、COMMIT、ROLLBACK，避免把Python默认值当作协议",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Python3.12新增Connection.autocommit。我们明确autocommit=True，关闭Python层的隐式事务安排，再用SQL BEGIN IMMEDIATE开启写事务；成功执行SQL COMMIT，失败则SQL ROLLBACK。此设置下不能只调用connection.commit期待它替显式事务完成提交，它在autocommit=True时没有相同作用。把控制方式写全，比依赖不同版本的默认isolation行为更容易核对。"
        },
        {
          "type": "paragraph",
          "text": "BEGIN IMMEDIATE尝试取得写事务资格，再检查总条数和依次插入。同一文件同时只有一个写事务；第二个连接可能在100ms等待后得到BUSY，被转成服务暂不可用。这个选择让失败尽早发生，也避免先读数量后升级写锁时多一层竞争。连接池设成4不会把SQLite变成4个写者，池容量与数据库锁是两层限制。"
        },
        {
          "type": "figure",
          "src": "figures/python-data-access/transaction.svg",
          "title": "同一批次的两条插入怎样一起回滚",
          "alt": "连接A先BEGIN IMMEDIATE，写新n1后写已存在n2而冲突，ROLLBACK撤销n1；连接B等待写锁，有期限失败后可在A结束后重新尝试。",
          "caption": "顺序与锁关系示意，不是耗时图；失败响应不等于所有客户端断开都已回滚。"
        },
        {
          "type": "paragraph",
          "text": "WAL让读者和写者在合适条件下并存，但不消除单写者规则，也不是把每次写入都异步丢到后台。它会产生-wal与-shm辅助文件，需要同一主机共享内存与本机文件系统语义；不能把示例目录直接挪到跨主机NFS就宣称行为相同。我们没有测量吞吐收益，也没有做断电或磁盘故障耐久验证。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "完整数据层：从迁移历史到连接归还",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter08/storage.py",
          "kind": "excerpt",
          "purpose": "完整SQLite连接、事务、版本迁移、教学池和笔记仓库；失败路径与资源归还都保留。",
          "code": "from collections.abc import Iterator\nfrom contextlib import closing, contextmanager\nimport hashlib\nfrom pathlib import Path\nimport sqlite3\nimport threading\nimport time\nfrom chapter04.notes_tool.domain import Note\nfrom chapter07.jobs import Busy, Conflict\n\nMIGRATIONS = (\n    (\"CREATE TABLE notes(id TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL \"\n     \"CHECK(length(title) BETWEEN 1 AND 200))\",),\n    (\"CREATE TABLE note_tags(note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, \"\n     \"position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 7), \"\n     \"tag TEXT NOT NULL CHECK(length(tag) BETWEEN 1 AND 32), \"\n     \"PRIMARY KEY(note_id,position), UNIQUE(note_id,tag))\",\n     \"CREATE INDEX notes_title_index ON notes(title)\"),\n)\n\n\nclass MigrationError(RuntimeError):\n    pass\n\n\ndef connect(path: Path) -> sqlite3.Connection:\n    connection = sqlite3.connect(path, autocommit=True, check_same_thread=False, timeout=.1)\n    connection.execute(\"PRAGMA foreign_keys=ON\").close()\n    return connection\n\n\n@contextmanager\ndef transaction(connection: sqlite3.Connection) -> Iterator[sqlite3.Connection]:\n    # autocommit=True disables Python's implicit transactions. SQL owns this one.\n    connection.execute(\"BEGIN IMMEDIATE\").close()\n    try:\n        yield connection\n        connection.execute(\"COMMIT\").close()\n    except BaseException:\n        if connection.in_transaction:\n            connection.execute(\"ROLLBACK\").close()\n        raise\n\n\ndef migrate(path: Path, target: int = len(MIGRATIONS)) -> None:\n    if type(target) is not int or not 1 <= target <= len(MIGRATIONS):\n        raise ValueError(\"unsupported migration target\")\n    path.parent.mkdir(parents=True, exist_ok=True)\n    with closing(connect(path)) as connection:\n        connection.execute(\"PRAGMA journal_mode=WAL\").close()\n        with transaction(connection):\n            connection.execute(\"CREATE TABLE IF NOT EXISTS schema_migrations(\"\n                               \"version INTEGER PRIMARY KEY, checksum TEXT NOT NULL)\").close()\n            with closing(connection.execute(\"SELECT version,checksum FROM schema_migrations ORDER BY version\")) as cursor:\n                history = cursor.fetchall()\n            expected = [(i, hashlib.sha256(\"\\n\".join(sql).encode()).hexdigest())\n                        for i, sql in enumerate(MIGRATIONS, 1)]\n            if len(history) > target or history != expected[:len(history)]:\n                raise MigrationError(\"migration history is newer, changed or discontinuous\")\n            for version, checksum in expected[len(history):target]:\n                for statement in MIGRATIONS[version - 1]:\n                    connection.execute(statement).close()\n                connection.execute(\"INSERT INTO schema_migrations VALUES(?,?)\", (version, checksum)).close()\n\n\nclass ConnectionPool:\n    \"\"\"Teaching pool: exclusive leases, finite wait, rollback on return, fail closed.\"\"\"\n    def __init__(self, path: Path, size: int = 2) -> None:\n        if type(size) is not int or not 1 <= size <= 4:\n            raise ValueError(\"pool size outside 1..4\")\n        self.condition = threading.Condition()\n        self.available: list[sqlite3.Connection] = []\n        self.leased: set[sqlite3.Connection] = set()\n        self.closed = self.broken = False\n        try:\n            for _ in range(size):\n                self.available.append(connect(path))\n        except BaseException:\n            self.close()\n            raise\n\n    @contextmanager\n    def borrow(self, wait: float = .2) -> Iterator[sqlite3.Connection]:\n        if not 0 < wait <= 2:\n            raise ValueError(\"pool wait outside (0,2]\")\n        deadline = time.monotonic() + wait\n        with self.condition:\n            while True:\n                if self.closed or self.broken:\n                    raise Busy(\"database pool unavailable\")\n                if self.available:\n                    connection = self.available.pop()\n                    self.leased.add(connection)\n                    break\n                remaining = deadline - time.monotonic()\n                if remaining <= 0:\n                    raise Busy(\"database pool acquisition timeout\")\n                self.condition.wait(remaining)\n        reusable = True\n        try:\n            yield connection\n        finally:\n            try:\n                if connection.in_transaction:\n                    connection.execute(\"ROLLBACK\").close()\n            except sqlite3.Error:\n                reusable = False\n                raise\n            finally:\n                with self.condition:\n                    self.leased.remove(connection)\n                    if reusable:\n                        self.available.append(connection)\n                    else:\n                        connection.close()\n                        self.broken = True\n                    self.condition.notify_all()\n\n    def close(self) -> None:\n        with self.condition:\n            if self.leased:\n                raise Busy(\"cannot close a pool with active leases\")\n            self.closed = True\n            for connection in self.available:\n                connection.close()\n            self.available.clear()\n            self.condition.notify_all()\n\n\nclass NotesRepository:\n    def __init__(self, connection: sqlite3.Connection) -> None:\n        self.connection = connection\n\n    def add_batch(self, notes: tuple[Note, ...]) -> None:\n        if not 1 <= len(notes) <= 32:\n            raise ValueError(\"batch must contain 1..32 notes\")\n        try:\n            with transaction(self.connection):\n                with closing(self.connection.execute(\"SELECT count(*) FROM notes\")) as cursor:\n                    count = cursor.fetchone()[0]\n                if count + len(notes) > 512:\n                    raise Busy(\"note capacity reached\")\n                for note in notes:\n                    self.connection.execute(\"INSERT INTO notes(id,title) VALUES(?,?)\",\n                                            (note.id, note.title)).close()\n                    self.connection.executemany(\"INSERT INTO note_tags VALUES(?,?,?)\",\n                                                [(note.id, i, tag) for i, tag in enumerate(note.tags)]).close()\n        except sqlite3.IntegrityError as error:\n            raise Conflict(\"note id or note constraint conflict\") from error\n        except sqlite3.OperationalError as error:\n            if error.sqlite_errorcode in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):\n                raise Busy(\"database writer busy\") from error\n            raise\n\n    def snapshot(self) -> list[dict[str, object]]:\n        # One read transaction gives the two queries the same database snapshot.\n        self.connection.execute(\"BEGIN\").close()\n        try:\n            with closing(self.connection.execute(\"SELECT id,title FROM notes ORDER BY id LIMIT 513\")) as cursor:\n                rows = cursor.fetchall()\n            if len(rows) > 512:\n                raise Busy(\"stored notes exceed service capacity\")\n            result = {key: {\"id\": key, \"title\": title, \"tags\": []} for key, title in rows}\n            if result:\n                marks = \",\".join(\"?\" for _ in result)\n                with closing(self.connection.execute(\"SELECT note_id,tag FROM note_tags WHERE note_id IN (\"\n                                                     + marks + \") ORDER BY note_id,position\", tuple(result))) as cursor:\n                    for key, tag in cursor:\n                        result[key][\"tags\"].append(tag)\n            self.connection.execute(\"COMMIT\").close()\n            return list(result.values())\n        except BaseException:\n            if self.connection.in_transaction:\n                self.connection.execute(\"ROLLBACK\").close()\n            raise\n"
        },
        {
          "type": "paragraph",
          "text": "add_batch在事务内检查512条总预算，再逐条插入。测试先提交n2，然后提交[n1,n2]：n1确实执行过INSERT，第二条才撞唯一键，随后ROLLBACK把n1撤销。重新打开文件仍只有原n2，证据比“函数没有返回半成品”更强。数据库约束导致的IntegrityError被转成业务Conflict，底层原因保留为cause；写锁BUSY与LOCKED只转成有限重试类Busy，其他SQL错误不一概伪装为容量不足。"
        },
        {
          "type": "paragraph",
          "text": "读取也有一致性要求。列表先查notes，再查这批ID的标签；若两次查询各自随意读取，另一个写者可能插在中间，让主体与标签来自不同状态。因此snapshot用一个显式读事务包住两次查询，读取完毕关闭cursor并COMMIT。只取最多513条主体，超过512直接拒绝异常规模；标签位置约束又把每笔限制为8个，避免先把整个外部数据库无界fetchall再检查。"
        }
      ]
    },
    {
      "id": "lease",
      "title": "连接池提供有限复用，独占借用才保护一条会话的状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "池启动时预建2个连接，每次borrow只交给一个调用者；用Condition等待有连接归还，200ms到期就拒绝。多个请求可以等待，但等待者数量并不因此只有2，HTTP并发和框架线程池还需要额外预算。这里不承诺一份手写教学池已经具备生产池的健康检查、重连与跨进程管理能力。"
        },
        {
          "type": "paragraph",
          "text": "SQLite连接在启动线程创建，FastAPI同步路由可能换线程使用，因此显式check_same_thread=False。这个开关只移除同线程检查，不自动协调事务；同一连接在本实现中仍必须由一个lease独占。没有把一条全局连接同时交给多个请求，也没有在async def里直接执行阻塞SQLite。同步def与yield依赖由框架线程池推进，事件循环继续处理可等待工作。"
        },
        {
          "type": "paragraph",
          "text": "归还前若in_transaction仍为真，池先ROLLBACK，避免下一个借用者继承未提交修改。若连接已被误关或回滚失败，它被关闭并使池fail closed，后续借用明确失败，不静默重复使用坏句柄。close发现仍有活跃lease时也拒绝，所以服务正常停止应先等在途请求结束，再进入lifespan清池。连接所有权在池，路由只是借用，不能自己close。"
        }
      ]
    },
    {
      "id": "migration",
      "title": "迁移不只是CREATE IF NOT EXISTS，还要能识别历史",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "迁移记录数据库已经执行过哪些结构变化。v1建立notes，v2增加note_tags与标题索引；schema_migrations按连续版本保存每组SQL的SHA256。启动时先持有写事务，核对历史是否是当前版本前缀，再执行缺少的版本。DDL和历史记录一起COMMIT，失败一起ROLLBACK；这样不会出现表建到一半却已经登记升级成功。"
        },
        {
          "type": "paragraph",
          "text": "校验和用于发现旧迁移被改写，不是恶意数据库的数字签名。已发布版本应保持不变，新的变化追加新版本；历史断档、校验和变化或比代码更新的版本会拒绝启动，不能靠CREATE IF NOT EXISTS假装兼容。迁移需要维护窗口、备份和多实例调度策略，本例只处理单机小表的启动迁移，不把它直接推广到大型线上DDL。"
        },
        {
          "type": "paragraph",
          "text": "集成测试先运行target=1并写数据，再升级到v2，确认笔记仍在且标签为空；重复启动没有重复历史。另一测试让v2先CREATE一张临时表，再执行故意无效SQL，确认该表和版本登记都没有留下，然后恢复正确迁移继续升级。测试确实通过SQLite执行DDL，没有用mock返回一个“迁移失败”就算验证了数据库回滚。"
        }
      ]
    },
    {
      "id": "http",
      "title": "让HTTP响应对应已经结束的事务",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter08/api.py",
          "kind": "excerpt",
          "purpose": "完整持久化HTTP工厂；同步路由与yield借用边界，503与409保留明确含义。",
          "code": "from contextlib import asynccontextmanager\nfrom pathlib import Path\nimport os\nimport secrets\nfrom typing import Annotated\nfrom fastapi import Depends, FastAPI, HTTPException, Request\nfrom fastapi.security import HTTPAuthorizationCredentials, HTTPBearer\nfrom .storage import Busy, Conflict, ConnectionPool, NotesRepository, migrate\nfrom chapter07.api import Settings\nfrom chapter07.body_limit import BodyLimit\nfrom chapter07.models import ImportInput, NoteInput\n\n\ndef create_app(path: Path, settings: Settings, *, pool_size: int = 2) -> FastAPI:\n    @asynccontextmanager\n    async def lifespan(app: FastAPI):\n        # Startup precedes serving; bounded local migration is synchronous here.\n        migrate(path)\n        pool = ConnectionPool(path, pool_size)\n        app.state.pool = pool\n        try:\n            yield\n        finally:\n            pool.close()\n\n    app = FastAPI(title=\"Atlas Notes chapter 8\", lifespan=lifespan)\n    app.add_middleware(BodyLimit, limit=32768)\n    bearer = HTTPBearer(auto_error=False)\n\n    async def authenticated(credentials: Annotated[HTTPAuthorizationCredentials | None,\n                                                   Depends(bearer)]):\n        if credentials is None or not secrets.compare_digest(\n                credentials.credentials.encode(), settings.token.encode()):\n            raise HTTPException(401, \"invalid bearer token\", headers={\"WWW-Authenticate\": \"Bearer\"})\n\n    def repository(request: Request):\n        try:\n            with request.app.state.pool.borrow() as connection:\n                yield NotesRepository(connection)\n        except Busy as error:\n            raise HTTPException(503, str(error), headers={\"Retry-After\": \"1\"}) from error\n        except Conflict as error:\n            raise HTTPException(409, str(error)) from error\n\n    @app.get(\"/health\")\n    def health():\n        return {\"ready\": True}\n\n    @app.get(\"/notes\", dependencies=[Depends(authenticated)])\n    def list_notes(notes: Annotated[NotesRepository, Depends(repository)]):\n        return {\"notes\": notes.snapshot()}\n\n    @app.post(\"/notes\", status_code=201, dependencies=[Depends(authenticated)])\n    def add_note(note: NoteInput, notes: Annotated[NotesRepository, Depends(repository)]):\n        notes.add_batch((note.domain(),))\n        return note.model_dump()\n\n    @app.post(\"/imports\", status_code=201, dependencies=[Depends(authenticated)])\n    def import_notes(body: ImportInput, notes: Annotated[NotesRepository, Depends(repository)]):\n        notes.add_batch(tuple(note.domain() for note in body.notes))\n        return {\"count\": len(body.notes), \"committed\": True}\n\n    return app\n\n\ndef build_app() -> FastAPI:\n    raw = os.environ.get(\"ATLAS_DB\", \"\")\n    if not raw:\n        raise ValueError(\"ATLAS_DB is required\")\n    return create_app(Path(raw), Settings(os.environ.get(\"ATLAS_TOKEN\", \"\")))\n"
        },
        {
          "type": "paragraph",
          "text": "依赖在yield前借连接，路由用NotesRepository完成事务，退出依赖时归还连接。Busy映射503并带Retry-After，唯一冲突映射409。这里固定FastAPI0.115.8并核对该tag的请求退出栈；新版依赖scope或流式响应的退出时序可能不同，不能把当前教程最新参数直接抄进旧依赖栈。我们不把数据库句柄交给响应外的后台任务。"
        },
        {
          "type": "paragraph",
          "text": "为了把事务完成与响应关联清楚，本章/imports改为有限批次同步提交，成功201并返回committed=true。上一章202的异步任务接口仍在chapter07独立目录，没有被偷偷改成同一个线上协议；如果要持久化异步任务，还必须保存任务状态、接收与执行恢复关系。本章并未实现耐久任务队列。"
        },
        {
          "type": "paragraph",
          "text": "客户端连接断开或等待超时，也不能反推数据库没有提交。COMMIT可能已经完成，响应尚未到达客户端；同步线程里的SQL也不会因为协程取消自动消失。可靠重试需要另外设计幂等键、结果查询与冲突策略，不能直接循环重发POST。我们用第二条冲突证明服务主动回滚，不把这个证据扩张成所有故障都会回滚。"
        }
      ]
    },
    {
      "id": "run",
      "title": "打开、提交、停止、重新打开：完整复现持久化",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/python-course/chapter08/__main__.py",
          "kind": "excerpt",
          "purpose": "真实python -m入口，单worker与本机端口8018。",
          "code": "import uvicorn\n\nif __name__ == \"__main__\":\n    uvicorn.run(\"chapter08.api:build_app\", factory=True, host=\"127.0.0.1\", port=8018,\n                workers=1, timeout_graceful_shutdown=5)\n"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在examples/python-course目录运行；所有HTTP请求只到本机。",
          "code": ".venv-web/bin/python -m pip install -r chapter07/requirements.lock\n.venv-web/bin/python -m unittest -v test_chapter08\nmkdir -p .local-notes\nATLAS_DB=\"$PWD/.local-notes/notes.sqlite3\" ATLAS_TOKEN=local-demo-token-2026 .venv-web/bin/python -m chapter08"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "在examples/python-course目录运行；所有HTTP请求只到本机。",
          "code": "curl --noproxy '*' -sS -X POST http://127.0.0.1:8018/imports \\\n  -H 'Authorization: Bearer local-demo-token-2026' -H 'Content-Type: application/json' \\\n  --data-binary @chapter07/fixtures/import.json\ncurl --noproxy '*' -sS http://127.0.0.1:8018/notes -H 'Authorization: Bearer local-demo-token-2026'"
        },
        {
          "type": "paragraph",
          "text": "新目录首次提交应得到count2与committed=true，列表含两条笔记；重复提交409，不增加数据。停止进程后用同一ATLAS_DB再启动，列表仍应相同。不要指向自己已有业务数据库试验，也不要为了“清干净”删除一个不属于本次实验的路径。测试全部使用TemporaryDirectory；手动目录由读者明确创建和保管。"
        }
      ]
    },
    {
      "id": "evidence",
      "title": "失败结果分别指向连接预算、写锁与业务约束",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本机12项测试全部通过：真实文件升级与重复迁移、坏DDL回滚、历史拒绝、第二条冲突回滚与重开、参数化和外键、池饱和/关闭/归还、未结束事务清理与坏连接、两真实连接写锁/恢复、两次读取间并发提交仍保持同一快照、HTTP409/503及跨应用重开、512条预算。Event屏障证明第一个lease仍被持有，第二个才超时；没有用睡眠推断占用。"
        },
        {
          "type": "table",
          "headers": [
            "观察",
            "优先区分",
            "下一步"
          ],
          "rows": [
            [
              "503 pool acquisition timeout",
              "没有空闲lease",
              "检查在途请求与归还，不先增加SQLite写者"
            ],
            [
              "503 database writer busy",
              "取得连接但没得到写事务",
              "缩短写事务，确认没有长事务占写锁"
            ],
            [
              "409 constraint conflict",
              "数据违反业务/表约束",
              "核对输入ID与异常cause，确认整批未提交"
            ],
            [
              "启动migration history错误",
              "代码与文件历史不兼容",
              "核对版本与备份，不直接删历史表"
            ],
            [
              "重新启动数据消失",
              "路径/目录可能变了",
              "核对ATLAS_DB绝对路径，区分内存章与持久化章"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "现在我们能把一次HTTP导入追到具体文件事务和连接归还，但尚未证明安装后的程序能离开源码目录启动，也没有结构化请求日志或性能采样。下一章会把这套明确的边界放进可安装分发包，从干净环境运行并记录请求与测量口径；数据库行为仍以本章实际事务测试为基础。"
        }
      ]
    }
  ]
};
export default article;
