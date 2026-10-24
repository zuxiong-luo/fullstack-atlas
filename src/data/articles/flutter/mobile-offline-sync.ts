import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "mobile-offline-sync",
  "topic": "flutter",
  "title": "移动端离线数据：本地存储、操作队列与同步冲突",
  "description": "用真实SQLite和HTTP实现离线修改、操作重放、旧ACK防护与双设备版本冲突；明确持久化协议核心与移动端适配的边界。",
  "minutes": 40,
  "labMinutes": 30,
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "CPython 3.12.14",
    "SQLite 3.53.1",
    "Python标准库，无第三方依赖"
  ],
  "verifiedAt": "2026-10-25",
  "tags": [
    "跨平台",
    "离线同步",
    "SQLite",
    "冲突"
  ],
  "scope": "一个已存在笔记、单账号文件、单在途同步核心。实际SQLite/HTTP验证，不冒称Flutter/RN插件或Android/iOS后台真机验收。",
  "prerequisites": [
    "理解请求与响应、状态更新",
    "能阅读一门语言的函数与事务；核心代码不依赖已安装移动框架"
  ],
  "sections": [
    {
      "id": "concept",
      "title": "1. 离线数据是什么：本地可用，与远端一致是两项工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "离线数据能力，是网络暂不可用时，应用仍能读取已经保存的内容，并记录用户的新操作。它的核心不是“把接口返回值缓存一下”，而是要明确本地和远端分别保存什么、用户目前看到哪一份，以及两边重新连上之后怎样解释冲突。只读文章缓存和允许编辑的离线笔记，在问题规模上有明显差别。"
        },
        {
          "type": "paragraph",
          "text": "本文处理后一种：一份已经同步过的笔记，用户可以离线修改，之后再发到远端。界面应区分“已保存在本机”“等待同步”“发生冲突”“已确认同步”，不能把本地写入成功直接画成所有设备都更新。我们用真实 SQLite 文件保存本地数据，通过真实 loopback HTTP 访问另一份 SQLite 业务库，验证协议核心。"
        },
        {
          "type": "paragraph",
          "text": "选择 Python 标准库是为了把事务、重放与冲突完整跑起来，不把手机插件安装和协议推导混为一件事。这并不是一份已经在 Flutter 或 RN 真机完成的存储适配器。将核心迁移到移动框架时，仍需要绑定插件事务、账号隔离、系统后台限制和实际设备验证；本篇先把跨平台可共享的规则讲清楚。"
        }
      ]
    },
    {
      "id": "structure",
      "title": "2. 结构：可见数据、待发意图与远端回执分开存",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本地 notes 保存当前用户看见的正文、已确认的远端版本 server_version 和本地编辑代次 edit_revision。pending 保存下一份要交付的输入：op_id、正文、基于哪个远端版本，以及冲突时看到的远端副本。远端另存 notes 与 receipts，后者把一次操作身份和其结果绑定，便于响应丢失后找回同一次结果。"
        },
        {
          "type": "code",
          "language": "sql",
          "code": "PRAGMA foreign_keys=ON;\nCREATE TABLE IF NOT EXISTS metadata(account TEXT NOT NULL PRIMARY KEY);\nCREATE TABLE IF NOT EXISTS notes(\n id TEXT NOT NULL PRIMARY KEY,body TEXT NOT NULL,\n server_version INTEGER NOT NULL CHECK(server_version>=1),\n edit_revision INTEGER NOT NULL CHECK(edit_revision>=0)\n);\nCREATE TABLE IF NOT EXISTS pending(\n op_id TEXT NOT NULL PRIMARY KEY,note_id TEXT NOT NULL UNIQUE REFERENCES notes(id),\n body TEXT NOT NULL,base_version INTEGER NOT NULL CHECK(base_version>=1),\n edit_revision INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('queued','conflict')),\n remote_body TEXT,remote_version INTEGER,\n CHECK((status='queued' AND remote_body IS NULL AND remote_version IS NULL)\n OR(status='conflict' AND remote_body IS NOT NULL AND remote_version IS NOT NULL))\n);",
          "filename": "examples/mobile-offline-sync/schema.sql",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这三个编号回答不同问题。note_id 指向业务对象；edit_revision 区分本机新旧编辑；op_id 指向一份不可随意改写的交付意图。远端 version 则是并发修改的比较基线。把所有编号简化成“这条笔记的 ID”，既没法判断旧响应，也没法解释同一个对象为什么可以发生多次合法更新。"
        },
        {
          "type": "figure",
          "src": "figures/mobile-offline-sync/mechanism.svg",
          "title": "本地事务与远端事务之间，由操作身份连接",
          "alt": "编辑时一起提交notes和pending；远端一起提交正文与回执。网络响应可能丢失，只有本地确认匹配操作后才清除该待发项。",
          "caption": "编辑时一起提交notes和pending；远端一起提交正文与回执。网络响应可能丢失，只有本地确认匹配操作后才清除该待发项。"
        }
      ]
    },
    {
      "id": "local-transaction",
      "title": "3. 本地先成功：可见修改与待发操作必须一起提交",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "假如先改本地正文，随后再写 pending，恰好在两句之间退出，用户会看见新内容，系统却永远不知道需要上传。反过来先写队列再改正文，也可能发送一个界面没有保存过的意图。正确边界是同一个本地事务：要么两者都提交，要么两者都不留下。"
        },
        {
          "type": "code",
          "language": "python",
          "code": "@contextmanager\ndef transaction(db):\n    db.execute(\"BEGIN IMMEDIATE\")\n    try:\n        yield\n        db.execute(\"COMMIT\")\n    except BaseException:\n        db.execute(\"ROLLBACK\")\n        raise",
          "filename": "examples/mobile-offline-sync/local.py",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "python",
          "code": "def edit(self, body, fail_after_note=False):\n        valid_body(body)\n        with transaction(self.db):\n            note = self.note()\n            revision = note[\"edit_revision\"] + 1\n            self.db.execute(\"UPDATE notes SET body=?,edit_revision=? WHERE id='n1'\", (body, revision))\n            if fail_after_note:\n                raise RuntimeError(\"LOCAL_CRASH_POINT\")\n            self.db.execute(\"DELETE FROM pending WHERE note_id='n1'\")\n            self.db.execute(\"INSERT INTO pending VALUES(?,?,?,?,?,'queued',NULL,NULL)\",\n                            (str(uuid.uuid4()), \"n1\", body, note[\"server_version\"], revision))",
          "filename": "examples/mobile-offline-sync/local.py",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "BEGIN IMMEDIATE 在这里提前申请 SQLite 写事务；同一库只能同时有一个写者，不能把它当成允许任意多线程并发写的引擎。transaction 包装器在失败时明确回滚整组操作，避免误以为每种约束错误都会自动回滚之前的语句。演示故障点放在 notes 更新之后、pending 之前，断言正文回到 hello 且没有队列项。"
        },
        {
          "type": "paragraph",
          "text": "编辑尚未发出的内容，可以用新的 op_id 合并掉旧待发意图，这样不会把逐字输入变成几十次上传。但已经发出的快照必须保持不可变。示例只有教学笔记 n1，一个账户文件中最多一条 pending；推广到多对象时需要增加总项数、总字节、磁盘和保留期限制，不应把单条演示当成无限容量队列。"
        },
        {
          "type": "reference",
          "title": "SQLite：事务、BEGIN IMMEDIATE 与单写者",
          "url": "https://www.sqlite.org/lang_transaction.html"
        },
        {
          "type": "reference",
          "title": "SQLite：ON CONFLICT 与回滚范围",
          "url": "https://www.sqlite.org/lang_conflict.html"
        }
      ]
    },
    {
      "id": "sync-loop",
      "title": "4. 同步过程：网络失败保留待办，确认以后才清除",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "同步器从数据库读出一份待发快照，转换成明确的请求字段，调用远端。如果连接失败，状态保持 queued；如果得到成功响应，先校验对象、操作身份、正文和版本，再进入本地确认事务。HTTP 成功但 JSON 缺字段，不能被当作“已经同步”；错误回包不应该清空用户还没确认的修改。"
        },
        {
          "type": "code",
          "language": "python",
          "code": "import json\nfrom urllib.request import Request, build_opener, ProxyHandler\nfrom urllib.error import HTTPError, URLError\nfrom http.client import HTTPException\nfrom urllib.parse import urlsplit\nfrom local import wire\n\ndef sync_one(local, base, token, before_ack=None):\n    if not local.sync_guard.acquire(blocking=False):\n        raise ValueError(\"SYNC_BUSY\")\n    try:\n        return _sync_one(local, base, token, before_ack)\n    finally:\n        local.sync_guard.release()\n\ndef _sync_one(local, base, token, before_ack=None):\n    url = urlsplit(base)\n    if url.scheme != \"http\" or url.hostname != \"127.0.0.1\":\n        raise ValueError(\"LOOPBACK_ONLY\")\n    sent = local.next()\n    if not sent:\n        return \"idle\"\n    if sent[\"status\"] == \"conflict\":\n        return \"conflict\"\n    request = Request(base + \"/sync\", data=json.dumps(wire(sent)).encode(),\n                      headers={\"Authorization\": \"Bearer \" + token, \"Content-Type\": \"application/json\"})\n    try:\n        with build_opener(ProxyHandler({})).open(request, timeout=2) as response:\n            raw = response.read(4097)\n            if len(raw) > 4096:\n                raise ValueError(\"RESPONSE_LIMIT\")\n            result = json.loads(raw)\n    except HTTPError as error:\n        with error:\n            raw = error.read(4097)\n        if len(raw) > 4096:\n            raise ValueError(\"RESPONSE_LIMIT\")\n        result = json.loads(raw)\n        if error.code == 409 and result.get(\"error\") == \"VERSION_CONFLICT\":\n            local.conflict(sent, result[\"current\"])\n            return \"conflict\"\n        raise ValueError(\"SYNC_REJECTED_\" + str(error.code)) from error\n    except (URLError, OSError, HTTPException):\n        return \"offline\"\n    if before_ack:\n        before_ack()\n    local.ack(sent, result)\n    return \"synced\"",
          "filename": "examples/mobile-offline-sync/sync.py",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "同一个 Local 实例用非阻塞 guard 保证只有一份在途同步，重复的联网事件不能同时启动第二条循环。这个约束也说明示例的运行范围：不支持多个进程、多个 Local 实例共同同步同一文件。移动应用应把同步器作为账号级单一服务，而不是每个页面恢复时都随手新建一个无限重试循环。"
        },
        {
          "type": "paragraph",
          "text": "网络状态提示只能决定是否值得尝试，不能代替一次请求的成功与否。系统显示已联网，目标服务器也可能不可达；应用进入后台后，定时器还可能暂停。这个实现由调用方显式触发一次同步，错误后保留数据，避免在最小核心里暗藏无限重试。后续调度应有退避、总预算和生命周期取消，但取消等待也不意味着远端写入没有完成。"
        }
      ]
    },
    {
      "id": "remote-transaction",
      "title": "5. 远端如何防止重放重复生效",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "远端首先按 op_id 查回执。找到且输入相同，就返回原结果；找到但输入不同，明确报 KEY_CONFLICT。没有回执才检查 expected_version，并用带版本条件的 UPDATE 改正文。新正文和成功回执放在同一 SQLite 事务中，只有提交后才进入发送响应阶段，不能先写正文再在另一个事务里补回执。"
        },
        {
          "type": "code",
          "language": "python",
          "code": "def apply(path, payload):\n    if (not isinstance(payload, dict) or set(payload) != {\"op_id\", \"id\", \"body\", \"expected_version\"}\n        or payload[\"id\"] != \"n1\" or not isinstance(payload[\"op_id\"], str)\n        or len(payload[\"op_id\"]) != 36 or type(payload[\"expected_version\"]) is not int or payload[\"expected_version\"] < 1):\n        raise ValueError(\"BAD_INPUT\")\n    valid_body(payload[\"body\"])\n    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)\n    db = sqlite3.connect(path, isolation_level=None)\n    db.row_factory = sqlite3.Row\n    try:\n        with transaction(db):\n            receipt = db.execute(\"SELECT payload,result FROM receipts WHERE op_id=?\", (payload[\"op_id\"],)).fetchone()\n            if receipt:\n                if receipt[\"payload\"] != encoded:\n                    raise Conflict(\"KEY_CONFLICT\")\n                return json.loads(receipt[\"result\"])\n            current = dict(db.execute(\"SELECT * FROM notes WHERE id=?\", (payload[\"id\"],)).fetchone())\n            if current[\"version\"] != payload[\"expected_version\"]:\n                raise Conflict(\"VERSION_CONFLICT\", current)\n            changed = db.execute(\"UPDATE notes SET body=?,version=version+1 WHERE id=? AND version=?\",\n                                 (payload[\"body\"], payload[\"id\"], payload[\"expected_version\"]))\n            if changed.rowcount != 1:\n                raise Conflict(\"VERSION_CONFLICT\", current)\n            result = {\"op_id\": payload[\"op_id\"], \"id\": payload[\"id\"], \"body\": payload[\"body\"], \"version\": current[\"version\"] + 1}\n            db.execute(\"INSERT INTO receipts VALUES(?,?,?)\", (payload[\"op_id\"], encoded, json.dumps(result)))\n            return result\n    finally:\n        db.close()",
          "filename": "examples/mobile-offline-sync/remote.py",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这不是网络层的 exactly-once。请求可以发送多次，远端可以多次查回执；我们保护的是这份固定意图在本库中的版本递增只发生一次。若操作还要调用邮件或支付服务，本地 receipts 不能让外部系统自动加入事务，需要继续使用对方幂等契约或 Outbox 等方案。"
        },
        {
          "type": "paragraph",
          "text": "回执必须保存多久也属于协议。客户端离线几个月后还可能带旧 op_id 重放，服务端若早就删掉回执，又正好缺乏其他业务去重约束，不能继续承诺相同恢复行为。示例为方便验证一直保留成功回执，没有实现生产归档和过期窗口。op_id 只是身份，不是权限；真正服务仍须根据登录账号检查笔记归属。"
        }
      ]
    },
    {
      "id": "lost-response",
      "title": "6. 复现最重要的故障：远端已保存，本机却没收到",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "测试先在本地写入 once，通过 HTTP 发送。远端真实提交后，夹具关闭连接而不返回响应；同步器观察到 offline，pending 仍保留。此时查远端已经是正文 once、版本 2。这正是“请求失败，所以我再新建一次操作”容易出错的位置：失败的是客户端观察，不一定是远端业务。"
        },
        {
          "type": "paragraph",
          "text": "随后关闭并重开本地 SQLite，停止并重开教学 HTTP 服务，再带原 op_id 重放。远端读到原回执，返回同一个版本 2，本地才清除 pending。测试检查两次请求没有把版本递增到 3。它验证的是实际文件重开和真实断响应，不是把 fetch 替换成总返回成功的 mock；没有额外声称做过操作系统断电或手机进程回收。"
        },
        {
          "type": "paragraph",
          "text": "故障注入 after_commit 只存在于测试 HTTP 夹具，不能把一个“提交后故意断连接”的接口公开给用户。正常应用也不应显示底层异常堆栈。本地 UI 应保留明确的待同步提示，并在恢复后继续使用已保存的同一份意图。"
        }
      ]
    },
    {
      "id": "late-ack",
      "title": "7. 旧确认到达时，不能擦掉用户的新编辑",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "还有一种不需要断网就能出现的竞态：同步器已经发出 first，用户在响应回来之前又改成 second。若成功响应后直接把 dirty=false、清空该笔记所有队列，就会丢掉 second 的上传机会。确认必须对准发送快照的 op_id，而不是看到同一 note_id 就宣布干净。"
        },
        {
          "type": "code",
          "language": "python",
          "code": "def ack(self, sent, result):\n        if (not isinstance(result, dict) or result.get(\"id\") != sent[\"note_id\"]\n            or result.get(\"op_id\") != sent[\"op_id\"] or result.get(\"body\") != sent[\"body\"]\n            or type(result.get(\"version\")) is not int or result[\"version\"] <= sent[\"base_version\"]):\n            raise ValueError(\"BAD_ACK\")\n        with transaction(self.db):\n            pending = self.next()\n            self.db.execute(\"UPDATE notes SET server_version=MAX(server_version,?) WHERE id=?\",\n                            (result[\"version\"], sent[\"note_id\"]))\n            if pending and pending[\"op_id\"] == sent[\"op_id\"]:\n                self.db.execute(\"DELETE FROM pending WHERE op_id=?\", (sent[\"op_id\"],))\n            elif pending:\n                # A later local edit was never sent: rebase that intent using a fresh immutable ID.\n                self.db.execute(\"UPDATE pending SET op_id=?,base_version=?,status='queued',remote_body=NULL,remote_version=NULL WHERE op_id=?\",\n                                (str(uuid.uuid4()), result[\"version\"], pending[\"op_id\"]))",
          "filename": "examples/mobile-offline-sync/local.py",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果当前 pending 还是发出的那项，就删除它。若它已被更新的本地编辑替换，保留当前正文，把新意图基线设为刚确认的远端版本，并再生成一个新 op_id。之所以又换 ID，是因为 expected_version 已经变化；不能让同一个身份先代表基线 1 的输入，后来又悄悄代表基线 2。"
        },
        {
          "type": "paragraph",
          "text": "测试在读取远端响应和应用 ACK 之间执行一次真实本地 edit。第一次确认后，用户仍看见 second，pending 的基线变成 2；再次同步，远端得到 second 和版本 3。这一处理依赖单在途同步约束：被改写的新待发项尚未由另一条同步器发出。如果需要多在途请求，就要给每份不可变操作更完整的因果关系和状态，不可直接复用这里的简化模型。"
        }
      ]
    },
    {
      "id": "conflicts",
      "title": "8. 两台设备修改：先保留双方，再让用户决策",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "两份独立本地库都从版本 1 开始。设备 B 先同步，远端变成版本 2；设备 A 仍带 expected_version=1，收到 VERSION_CONFLICT 与远端副本。此时不能无条件覆盖，也不能偷偷把本地编辑替换成远端正文。我们将 pending 置为 conflict，同时保留本地可见正文和 remote_body/remote_version。"
        },
        {
          "type": "code",
          "language": "python",
          "code": "def conflict(self, sent, remote):\n        if (not isinstance(remote, dict) or remote.get(\"id\") != sent[\"note_id\"]\n            or not isinstance(remote.get(\"body\"), str) or len(remote[\"body\"]) > 120\n            or type(remote.get(\"version\")) is not int or remote[\"version\"] < 1):\n            raise ValueError(\"BAD_CONFLICT\")\n        with transaction(self.db):\n            self.db.execute(\"UPDATE pending SET status='conflict',remote_body=?,remote_version=? WHERE note_id=?\",\n                            (remote[\"body\"], remote[\"version\"], sent[\"note_id\"]))\n\n    def resolve(self, keep_local):\n        with transaction(self.db):\n            row = self.next()\n            if not row or row[\"status\"] != \"conflict\":\n                raise ValueError(\"NO_CONFLICT\")\n            if keep_local:\n                self.db.execute(\"UPDATE notes SET server_version=? WHERE id=?\", (row[\"remote_version\"], row[\"note_id\"]))\n                self.db.execute(\"UPDATE pending SET op_id=?,base_version=?,status='queued',remote_body=NULL,remote_version=NULL WHERE op_id=?\",\n                                (str(uuid.uuid4()), row[\"remote_version\"], row[\"op_id\"]))\n            else:\n                self.db.execute(\"UPDATE notes SET body=?,server_version=? WHERE id=?\", (row[\"remote_body\"], row[\"remote_version\"], row[\"note_id\"]))\n                self.db.execute(\"DELETE FROM pending WHERE op_id=?\", (row[\"op_id\"],))",
          "filename": "examples/mobile-offline-sync/local.py",
          "purpose": "下载工程的连续原文；依赖本目录中的类型、导入与适配代码，项目节选。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "采用服务端意味着明确放弃当前本地稿，写入远端副本并移除待办。保留本地则意味着用户已经看到远端版本，愿意以它为基线重新提交自己的正文，因此创建新 op_id。它仍是一次新的条件写，期间如果第三方又修改，可能再次冲突。选择保留本地不等于获得一张永久越过并发校验的通行证。"
        },
        {
          "type": "paragraph",
          "text": "这与自动合并不同。文本字段可以展示差异供用户编辑，结构化表单可以对互不相交字段做三方合并，协作文本还可能选择 CRDT；这些都需要定义额外语义。本文没有把“最后写入获胜”伪装成无损合并，也没有使用客户端时间戳判断谁更正确。删除、恢复和墓碑同样要独立设计，否则一台长期离线设备可能重新上传已经删除的记录。"
        }
      ]
    },
    {
      "id": "platform-boundaries",
      "title": "9. 账号、线程与手机生命周期需要怎样接入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本地库带一个账户标识，打开时发现不匹配就拒绝，防止把上一个账号的离线队列误发给下一个账号。这个标识不是加密，也不是服务端授权。真实设备还要决定数据库目录、加密密钥、备份策略和登出处理：允许用户导出未同步草稿，还是在明确确认后删除，不能在界面切账号时保留一个仍用旧身份运行的后台同步器。"
        },
        {
          "type": "paragraph",
          "text": "Flutter 或 RN 的 UI 不应在渲染函数里执行 SQLite 和网络循环。用仓储接口暴露读快照、编辑事务和同步状态，再由平台适配器负责实际数据库连接与生命周期回调。应用进入后台可以停止新请求，已经提交的远端写依旧需要之后恢复；系统后台任务和推送唤醒也不保证总能按时执行。"
        },
        {
          "type": "paragraph",
          "text": "本例只有一个已存在的对象，并不提供全量拉取、分页游标、增量订阅和多端自动发现修改。它验证“我这次离线修改怎样安全提交”，还没解决“所有服务端变化怎样完整拉回来”。在产品里应分开为推送与拉取设计恢复点，避免一条成功上传就被解释成整个账号已经全局一致。"
        },
        {
          "type": "reference",
          "title": "Flutter：离线优先架构指引",
          "url": "https://docs.flutter.dev/app-architecture/design-patterns/offline-first"
        }
      ]
    },
    {
      "id": "verify",
      "title": "10. 运行与证据：先验证协议，再扩展平台适配",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下载后使用 CPython 3.12 建立虚拟环境，安装空的 requirements.lock，再执行 python -m unittest -v。此项目没有第三方依赖，锁文件明确解释运行时需另装；客户端显式禁用继承代理，HTTPError响应也及时关闭。请同时核对实际链接的 SQLite 版本。默认所有库都建在测试临时目录，HTTP 只绑定 127.0.0.1 随机端口，不访问任何用户数据库或公网服务。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24 已在 CPython 3.12.14、SQLite 3.53.1、macOS 14.5 实跑 14 项，包括中文同步、断网保留、提交后断响应重放、旧 ACK 与新稿、两个本地库冲突及两种决策、账号文件隔离、NULL 主键拒绝和同步重入。开发时曾把账户不匹配分支放在关闭连接后的事务回滚里，导致异常被覆盖；已改为先完整退出事务再关闭连接，并由回归测试确认。"
        },
        {
          "type": "paragraph",
          "text": "这些测试不代替 Android/iOS 真机、Flutter/RN 插件、原生加密存储、后台任务和系统断电验证。正文中的核心代码可以直接在下载项目阅读并复现，不需要跳转仓库才能理解协议；图形和依赖资源进入站点离线资料后，也只是可读源码，不意味着浏览器能够执行 Python 服务。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "SQLite：事务、BEGIN IMMEDIATE 与单写者",
      "url": "https://www.sqlite.org/lang_transaction.html"
    },
    {
      "title": "SQLite：ON CONFLICT 与回滚范围",
      "url": "https://www.sqlite.org/lang_conflict.html"
    },
    {
      "title": "SQLite：逐连接启用外键",
      "url": "https://www.sqlite.org/foreignkeys.html"
    },
    {
      "title": "Python3.12：sqlite3事务控制",
      "url": "https://docs.python.org/3.12/library/sqlite3.html#transaction-control"
    },
    {
      "title": "Flutter：离线优先架构指引",
      "url": "https://docs.flutter.dev/app-architecture/design-patterns/offline-first"
    }
  ],
  "examples": [
    {
      "label": "下载完整实验",
      "path": "mobile-offline-sync.zip"
    },
    {
      "label": "安装、运行与验收范围",
      "path": "mobile-offline-sync/README.md"
    }
  ]
};
export default article;
