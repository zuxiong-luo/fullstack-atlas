import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "ai-agent-workflows",
  "topic": "ai",
  "title": "Agent 工作流：从状态转移到 LangGraph 审批与恢复",
  "description": "先区分工作流、工具与 Agent，再用真实 LangGraph 和 SQLite 实现审批暂停、重新加载、拒绝与写入后故障恢复。把检查点和副作用幂等分开验证。",
  "scope": "固定 LangGraph 1.2.17 的本地单写入者教学工作流。规划为确定性工单提案，副作用为同库回执记录；不声称实现自主规划、多 Agent、外部工单平台或生产身份认证。",
  "minutes": 55,
  "labMinutes": 30,
  "prerequisites": [
    "理解前三篇的模型输入输出、资料权限与版本",
    "会读 Python 函数；图、检查点与审批机制从概念讲起"
  ],
  "sections": [
    {
      "id": "concepts",
      "title": "工作流、Agent 和工具是三种不同的对象",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "工作流是由代码明确规定步骤、顺序和分支的执行过程。Agent 则让模型在给定目标和约束内参与选择下一步，比如先检索还是先调用工具、结果不足时是否继续。工具是运行时允许执行的一项具体能力。一个 Agent 可以被放进工作流，一个工具也可以完全不依赖模型。"
        },
        {
          "type": "paragraph",
          "text": "本篇先做确定性工作流：生成一个权限工单提案，等待人确认，通过后记录回执，拒绝则结束。为什么先不让模型自由规划？因为我们要单独看清“任务暂停后保存了什么、恢复从哪继续、重复执行有没有副作用”。把这些机制和模型随机决策同时放进第一个实验，会让故障原因难以区分。"
        },
        {
          "type": "paragraph",
          "text": "在岗位要求里，Workflow、Checkpoint、Human-in-the-loop 和 Runtime 经常一起出现。它们不是四个必须分别选购的框架。Workflow 说明执行结构，Checkpoint 保存执行状态，人在回路提供外部决定，Runtime 负责驱动它们并管理工具、预算和恢复。把名词落实到这次工单流程，才知道框架替你做了什么。"
        },
        {
          "type": "paragraph",
          "text": "LangGraph 提供用节点、边和状态组织流程的能力。节点读取当前状态并返回更新，边决定后续节点，checkpointer 保存可恢复的图状态。本例用真正安装的 LangGraph 1.2.17 和 SQLite checkpointer 3.1.2，不拿自写的几行 if 代码冒充框架效果。其默认 invoke API 足够观察本篇机制，不要求先学另一套流式投影接口。"
        }
      ]
    },
    {
      "id": "state",
      "title": "先写状态和不变量，再画执行图",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "状态是执行过程里需要保留的事实集合。本例保存 tenant、ticket、question、proposal、receipt 和 status。tenant 与 ticket 组成可信调用方确定的任务身份；proposal 是待批准的完整操作；receipt 是执行后的结果。status 则告诉调用方当前处在等待、批准、拒绝还是完成。"
        },
        {
          "type": "table",
          "headers": [
            "状态",
            "意味着什么",
            "能否已有回执"
          ],
          "rows": [
            [
              "waiting_approval",
              "提案已形成，需要外部确认",
              "不能因等待本身而创建"
            ],
            [
              "approved",
              "确认值匹配当前提案",
              "执行可能尚未发生"
            ],
            [
              "rejected",
              "用户明确拒绝",
              "不会进入执行节点"
            ],
            [
              "completed",
              "本地回执已提交，图已记录完成",
              "有稳定回执"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "有两个不变量贯穿实验：没有匹配当前提案的批准，不能进入执行；相同任务、相同提案的恢复重放不能增加第二条本地副作用。还有一个必须拒绝的情况：同一任务标识被用来执行不同提案。它不能被“幂等命中”悄悄掩盖。"
        },
        {
          "type": "figure",
          "src": "figures/ai-course/workflow.svg",
          "title": "审批、执行与故障重放",
          "alt": "prepare 进入 approval；批准进入 execute，拒绝直接结束；execute 写入回执后可能发生故障，恢复会重放 execute 并复用幂等回执。",
          "caption": "检查点与业务回执之间存在失败窗口。虚线表示恢复后的重试，不表示外部副作用会被框架自动回滚。 手机端可在图形区域横向滑动查看完整图。"
        },
        {
          "type": "paragraph",
          "text": "状态不等于全部上下文。比如上一章知识库中的所有切片无需复制进这个图。本例只保留当前操作需要的提案和身份。长期记忆、检索索引与当前任务状态有不同生命周期，不应该为方便恢复就塞进一个不断增长的 messages 列表。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "完整实现：节点、审批、检查点和回执",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面是可以直接运行的完整脚本。先顺着主线读：prepare 构造提案；approval 暂停并等待确认；execute 调用 apply_once 记录回执；builder 连接三者，使用 SqliteSaver 编译。暂时把测试故障开关看作“记录回执后立刻抛异常”，下一节再推演为什么要这样做。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson4_workflow.py",
          "code": "\"\"\"Chapter 4: real LangGraph interrupts and durable idempotent local effects.\"\"\"\nimport hashlib\nimport json\nimport sqlite3\nimport tempfile\nfrom contextlib import contextmanager, closing\nfrom typing import TypedDict\nfrom langgraph.checkpoint.sqlite import SqliteSaver\nfrom langgraph.graph import StateGraph, START, END\nfrom langgraph.types import Command, interrupt\n\n\nclass State(TypedDict):\n    tenant: str\n    ticket: str\n    question: str\n    proposal: dict\n    receipt: str\n    status: str\n\n\ndef proposal_digest(proposal):\n    return hashlib.sha256(json.dumps(proposal, sort_keys=True, ensure_ascii=False).encode()).hexdigest()\n\n\ndef apply_once(path, proposal):\n    digest = proposal_digest(proposal)\n    operation = f\"{proposal['tenant']}:{proposal['ticket']}\"\n    with closing(sqlite3.connect(path)) as db, db:\n        db.execute('''CREATE TABLE IF NOT EXISTS effects(\n          operation TEXT PRIMARY KEY, digest TEXT NOT NULL, receipt TEXT NOT NULL)''')\n        receipt = 'receipt-' + digest[:16]\n        db.execute('INSERT INTO effects VALUES(?,?,?) ON CONFLICT(operation) DO NOTHING',\n                   (operation, digest, receipt))\n        old = db.execute('SELECT digest,receipt FROM effects WHERE operation=?', (operation,)).fetchone()\n        if old[0] != digest:\n            raise ValueError('IDEMPOTENCY_CONFLICT')\n        return old[1]\n\n\n@contextmanager\ndef workflow(path, fail_after_effect=False):\n    def prepare(state):\n        return {'proposal': {'tenant': state['tenant'], 'ticket': state['ticket'],\n                             'action': 'create_access_ticket', 'question': state['question']},\n                'status': 'waiting_approval'}\n\n    def approval(state):\n        proposal = state['proposal']\n        digest = proposal_digest(proposal)\n        decision = interrupt({'proposal': proposal, 'proposal_hash': digest})\n        if (type(decision) is not dict or set(decision) != {'approved', 'proposal_hash'}\n                or type(decision['approved']) is not bool or decision['proposal_hash'] != digest):\n            raise ValueError('INVALID_APPROVAL')\n        return {'status': 'approved' if decision['approved'] else 'rejected'}\n\n    def execute(state):\n        receipt = apply_once(path, state['proposal'])\n        if fail_after_effect:\n            raise RuntimeError('SIMULATED_CRASH_AFTER_EFFECT')\n        return {'receipt': receipt, 'status': 'completed'}\n\n    builder = StateGraph(State)\n    builder.add_node('prepare', prepare)\n    builder.add_node('approval', approval)\n    builder.add_node('execute', execute)\n    builder.add_edge(START, 'prepare')\n    builder.add_edge('prepare', 'approval')\n    builder.add_conditional_edges('approval', lambda s: 'execute' if s['status'] == 'approved' else END)\n    builder.add_edge('execute', END)\n    with SqliteSaver.from_conn_string(str(path)) as saver:\n        yield builder.compile(checkpointer=saver)\n\n\ndef config(tenant, ticket):\n    # CLI trusted identity: a network service must derive tenant from authenticated identity.\n    for value in [tenant, ticket]:\n        if not isinstance(value, str) or not value or ':' in value or len(value) > 40:\n            raise ValueError('INVALID_IDENTITY')\n    return {'configurable': {'thread_id': f'{tenant}:{ticket}'}, 'recursion_limit': 10}\n\n\ndef decide(graph, identity, approved, proposal_hash):\n    state = graph.get_state(identity)\n    if not state.values or not state.tasks or not any(t.interrupts for t in state.tasks):\n        raise ValueError('NOT_WAITING_APPROVAL')\n    expected_thread = f\"{state.values['tenant']}:{state.values['ticket']}\"\n    if identity['configurable']['thread_id'] != expected_thread:\n        raise ValueError('IDENTITY_MISMATCH')\n    return graph.invoke(Command(resume={'approved': approved, 'proposal_hash': proposal_hash}), identity)\n\n\nif __name__ == '__main__':\n    with tempfile.TemporaryDirectory() as directory:\n        path = directory + '/workflow.sqlite'\n        identity = config('acme', 'ticket-1')\n        with workflow(path) as graph:\n            first = graph.invoke({'tenant': 'acme', 'ticket': 'ticket-1', 'question': '申请只读权限'}, identity)\n            digest = first['__interrupt__'][0].value['proposal_hash']\n            print('暂停：', first['status'])\n        # New saver/graph instance loads the same SQLite checkpoint.\n        with workflow(path) as graph:\n            final = decide(graph, identity, True, digest)\n            print('恢复：', final['status'], final['receipt'])\n        with closing(sqlite3.connect(path)) as db, db:\n            print('副作用条数：', db.execute('SELECT COUNT(*) FROM effects').fetchone()[0])",
          "language": "python",
          "purpose": "完整 Python 脚本，包含真实框架导入、图构造、持久检查点、审批校验、幂等事务与独立演示入口。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "StateGraph(State) 中的 TypedDict 描述状态结构，方便理解节点接口，但它本身不是外部 HTTP 输入校验器。网络服务仍要在启动图之前验证请求和身份。图编译时绑定的 checkpointer 才负责保存状态；仅仅声明了 State 类型，不会让状态跨进程保留。"
        },
        {
          "type": "paragraph",
          "text": "prepare 在本例中使用确定性规则生成 create_access_ticket 提案。以后可以用第二篇的结构化模型结果替换这一步，但返回的动作类型、参数、租户和预算仍要由应用验证。模型越会规划，执行边界越不能省略。"
        }
      ]
    },
    {
      "id": "interrupt",
      "title": "暂停与恢复：为什么审批节点会从头再执行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第一次 graph.invoke 接收初始状态。prepare 完成后进入 approval，interrupt 把提案及摘要返回给调用方，并让执行停下。调用结果含 __interrupt__，status 已经是 waiting_approval。此时不是线程一直拿着一个用户输入框在等，也没有必要把某个 HTTP 请求保持几小时。"
        },
        {
          "type": "paragraph",
          "text": "调用方保存任务标识，可以稍后读取检查点并展示审批界面。本例随后关闭第一个图和 saver，再创建一个新的图实例，使用相同 SQLite 文件与 thread_id 加载之前状态。decide 确认当前确实存在待处理 interrupt，再通过 Command(resume=...) 提供决定。"
        },
        {
          "type": "paragraph",
          "text": "关键行为是：恢复时，中断所在节点会从开头重新执行。interrupt 之前的代码也可能再运行。本例在它之前只读取 proposal 并计算摘要，没有发送邮件、扣款或创建工单。如果把一次真实写操作放在 interrupt 前面，每次恢复都可能重复写。不要把“暂停在这里”理解成保存了 Python 调用栈和所有局部执行位置。"
        },
        {
          "type": "reference",
          "title": "LangGraph：Interrupts 的恢复与重执行语义",
          "url": "https://docs.langchain.com/oss/python/langgraph/interrupts",
          "note": "本文使用固定安装版本的 invoke + __interrupt__ + Command(resume=...) 路径；实际 API 已在示例中运行。"
        },
        {
          "type": "paragraph",
          "text": "审批也不能只传一个孤立 true。假设界面给用户看的是“创建只读权限申请”，后台提案却已经被改成另一个动作，再把旧的 true 放行就失去了确认对象。本例把完整 proposal 的摘要一起交给审批，并在恢复时逐字比较当前摘要；approved 还必须是真正的 bool，而不是一个内容为 false 的非空字符串。"
        },
        {
          "type": "paragraph",
          "text": "摘要绑定解决的是“批准了哪一份内容”，不是“谁有权批准”。thread_id 是检查点定位键，也不是安全令牌。本机 CLI 的 tenant 由可信调用方提供；改成 HTTP 服务后必须从认证上下文取得租户和用户，检查任务所有权与审批权限，再构造配置。禁止用户任意提交 thread_id 或直接修改图状态。"
        }
      ]
    },
    {
      "id": "side-effects",
      "title": "检查点为何不能单独保证副作用只发生一次",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "考虑四个时刻：执行节点开始、业务回执事务提交、节点返回、图保存完成状态。进程可能在第二与第四之间停止。业务回执已经存在，但图仍认为执行节点没成功。恢复时再次进入 execute，是合理且必要的；若 execute 每次都无条件写入，就会重复产生副作用。"
        },
        {
          "type": "paragraph",
          "text": "apply_once 用 tenant:ticket 作唯一 operation，保存当前 proposal 的摘要与回执。第一次调用插入成功；同任务同内容的重放会冲突但不再新增，然后读出原回执；同任务不同内容则检测到摘要不一致，抛 IDEMPOTENCY_CONFLICT。整个操作在同一 SQLite 事务内完成。"
        },
        {
          "type": "paragraph",
          "text": "这里的“副作用”精确定义为 effects 表中的本地工单回执记录，未调用外部工单平台。也正因为回执与幂等记录是同一个事务对象，本地唯一约束能够落实不重复的承诺。若下一步改成发邮件、调用支付或创建远程工单，对方必须支持幂等键，或者你需要 Outbox、状态核对与补偿；本地先记一条 done 并不能使外部调用恰好一次。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/tests/test_course.py",
          "code": "    def test_crash_after_effect_does_not_duplicate(self):\n        with workflow(self.path,fail_after_effect=True) as graph:\n            first=self.begin(graph)\n            with self.assertRaisesRegex(RuntimeError,'SIMULATED_CRASH'):\n                decide(graph,self.identity,True,first['__interrupt__'][0].value['proposal_hash'])\n        with workflow(self.path) as graph: self.assertEqual(graph.invoke(None,self.identity)['status'],'completed')\n        with closing(sqlite3.connect(self.path)) as db: self.assertEqual(db.execute('SELECT COUNT(*) FROM effects').fetchone()[0],1)",
          "language": "python",
          "purpose": "故意在回执写入后抛异常，再用新图恢复。断言既看 completed，也检查实际副作用表只有一条。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "fail_after_effect 是可控故障注入：第一次恢复批准时写入回执后抛异常，模拟业务提交与图状态完成之间的失败窗口。接下来重新构造没有故障开关的图，invoke(None) 恢复尚未完成的执行。测试用新图实例和持久文件验证了恢复路径，但没有冒充操作系统断电或多副本并发压测。"
        },
        {
          "type": "paragraph",
          "text": "如果在企业系统里运行多个 worker，同一任务还需要认领、并发控制和恢复的拥有者规则。本篇单写入者示例没有解决调度租约、多个审批者竞争和外部事务。原有可靠任务与 Agent Runtime 章节讨论这些能力，不能因换成一个框架就默认它们自动存在。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行审批、拒绝与错误恢复",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/ai-engineering-course\nsource .venv/bin/activate\npython lesson4_workflow.py\npython -m unittest tests.test_course.WorkflowTests -v",
          "language": "bash",
          "purpose": "默认先暂停，再关闭并重建图实例，最后批准并完成。测试覆盖拒绝、内容不匹配与副作用窗口故障。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "正常演示应看到“暂停：waiting_approval”“恢复：completed receipt-…”以及“副作用条数：1”。回执后缀由规定提案的摘要生成，不是随机模型输出，也不代表已经向真实企业账号发起权限修改。"
        },
        {
          "type": "paragraph",
          "text": "拒绝路径将 status 设置为 rejected，直接走 END；测试检查 effects 表甚至尚未创建。内容不匹配路径抛 INVALID_APPROVAL，不进入执行。已完成任务再次 decide 会抛 NOT_WAITING_APPROVAL，避免一个过时审批被重复当成新操作。"
        },
        {
          "type": "paragraph",
          "text": "如果恢复后像丢失状态一样，先检查 SQLite 文件是否仍是同一个，再检查 thread_id 与租户前缀是否变化。若出现锁等待，检查是否在不该共用的线程/进程里复用了连接，或者是否把慢外部网络调用放进本地事务。错误排查应沿保存对象和资源所有权走，不只看最后一个框架堆栈。"
        }
      ]
    },
    {
      "id": "choice",
      "title": "何时再加模型规划、多 Agent 和平台层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "把 prepare 替换成模型后，你会得到一个带模型决策节点的工作流；如果模型还能基于工具结果反复决定下一步，才逐渐形成更开放的 Agent 循环。那时需要最大轮数、工具白名单、预算耗尽的终止状态，以及每一步的可观测轨迹。框架节点之间的边不等于这些业务约束。"
        },
        {
          "type": "paragraph",
          "text": "多 Agent 的价值应来自不同任务确实需要分工、独立上下文或权限，而不是把一次分类拆成三个模型让成本翻倍。先在单条可恢复流程上建立成功/失败样本，只有单条流程难以表达的协作需求出现时，再引入子 Agent、通信协议和汇总评测。"
        },
        {
          "type": "callout",
          "title": "本章的验收答案",
          "text": "现在你能够运行真实框架，说明状态保存在什么地方、审批恢复为什么会重执行，以及幂等为何必须落在业务副作用边界。下一篇把这些任务状态交给浏览器显示，同时区分“连接断开”“用户暂停接收”和“任务真正取消”。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "LangGraph：Interrupts",
      "url": "https://docs.langchain.com/oss/python/langgraph/interrupts"
    },
    {
      "title": "LangGraph：持久化与 Checkpointer / Store",
      "url": "https://docs.langchain.com/oss/python/langgraph/persistence"
    },
    {
      "title": "固定安装版本：LangGraph 1.2.17",
      "url": "https://pypi.org/project/langgraph/1.2.17/"
    },
    {
      "title": "SQLite：UPSERT",
      "url": "https://www.sqlite.org/lang_upsert.html"
    }
  ],
  "tags": [
    "LangGraph",
    "Workflow",
    "Checkpoint",
    "审批",
    "恢复",
    "幂等",
    "Human-in-the-loop"
  ],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Python 3.12.14",
    "tiktoken 0.14.0 / cl100k_base",
    "LangGraph 1.2.17 / SQLite checkpointer 3.1.2"
  ],
  "verifiedAt": "2026-10-26",
  "examples": [
    {
      "label": "完整源码、测试、数据和锁文件 ZIP",
      "path": "ai-engineering-course.zip"
    },
    {
      "label": "安装、运行与能力边界",
      "path": "ai-engineering-course/README.md"
    }
  ]
};
export default article;
