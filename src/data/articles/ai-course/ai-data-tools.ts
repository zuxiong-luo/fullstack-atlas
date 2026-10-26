import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "ai-data-tools",
  "topic": "ai",
  "title": "数据 Agent：查询计划、租户权限与受限执行",
  "description": "先分清自然语言理解与数据库执行，再把不可信查询计划编译成固定参数化 SQL。用真实 SQLite 验证租户隔离、字段白名单、只读限制和执行预算。",
  "scope": "实现工单读取工具的可信执行边界，不运行模型生成的任意 SQL。输入为结构化计划；未接入真实自然语言规划器，不声称通用 Text-to-SQL、生产数据库沙箱或完整认证已完成。",
  "minutes": 50,
  "labMinutes": 30,
  "prerequisites": [
    "理解第二篇结构化输出、第三篇租户过滤和第四篇工具执行边界",
    "会写 SELECT、WHERE 和 LIMIT；不要求掌握 SQL 解析器"
  ],
  "sections": [
    {
      "id": "definition",
      "title": "数据 Agent 在做什么，为什么先讲执行边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数据 Agent 把用户的数据问题转换成一系列可执行的数据操作，再组织结果。它可能先理解指标、选数据源，再生成查询计划、执行查询、检查结果，最后给出文字或图表。Text-to-SQL 是其中一种实现：把自然语言转换成 SQL。它不是全部数据 Agent，也不能把“生成了一段 SELECT”直接当作任务成功。"
        },
        {
          "type": "paragraph",
          "text": "数据任务里至少有两种正确性。第一种是理解正确：用户说“未关闭的权限工单”，你有没有理解错状态、时间或权限口径？第二种是执行正确：即使计划来自不可信模型，执行器会不会读到别人的数据、运行写操作、扫到没有预算的大表？模型评测与数据库保护分别负责它们，不能互相替代。"
        },
        {
          "type": "paragraph",
          "text": "本篇收窄到第二种：给定一个结构化工单查询计划，可信代码在当前身份范围内执行，拒绝计划之外的能力。用户自然语言到计划的模型接口留作扩展，不用硬编码几个关键词冒充通用 NL2SQL。你可以先用已知计划验证边界，再把一个真实规划器接进来，分别评测语义与执行。"
        },
        {
          "type": "paragraph",
          "text": "贯穿输入是：acme 的用户想看当前未关闭工单。教学数据中，acme 有一条 open 和一条 closed；另一个租户 other 也有一条 open。正确结果只能包含 acme 的 open。若把三个工单都查出来，再请模型“只回答当前租户”，隔离已经失败了。"
        }
      ]
    },
    {
      "id": "plan",
      "title": "有限查询计划比任意 SQL 少了哪些自由度",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "计划是模型或调用方提出的操作描述。本篇只允许两个字段：status 取 open 或 closed，limit 取 1～20 的整数。表名、列名、排序方式和 tenant 条件全部由可信代码决定。计划里没有 sql，也没有 tenant。功能确实有限，但正因为有限，允许做什么才可以被完整检查。"
        },
        {
          "type": "table",
          "headers": [
            "由谁决定",
            "允许的对象",
            "不交给模型的内容"
          ],
          "rows": [
            [
              "可信身份层",
              "当前 tenant、是否允许读取工单",
              "不能靠模型自报管理员身份"
            ],
            [
              "计划提议方",
              "status、limit",
              "不指定表、列、租户或 SQL 片段"
            ],
            [
              "执行器",
              "固定 SQL、绑定参数、资源预算",
              "不执行计划里的额外命令"
            ],
            [
              "数据库连接",
              "只读和 VM 步数预算",
              "不代表完整进程隔离"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这种设计适合边界明确的业务查询，例如“按状态列出自己的工单”“按允许的维度汇总订单”。如果产品需要任意关联、临时指标和复杂分析，有限计划很快不够用，需要扩展类型系统、语义层、查询语法和评测。不要把本例的安全性直接推广到一个允许用户自由拼 SQL 的分析平台。"
        },
        {
          "type": "figure",
          "src": "figures/ai-course/data.svg",
          "title": "不可信计划经过可信执行边界",
          "alt": "身份与权限来自服务端；模型式计划仅提交 status 和 limit；校验后编译成参数化固定 SQL，数据库连接只读并限制执行工作量。",
          "caption": "tenant 从身份层进入参数列表，不经过模型改写。计划中出现 sql、tenant 或越界字段会在数据库执行前被拒绝。 手机端可在图形区域横向滑动查看完整图。"
        },
        {
          "type": "paragraph",
          "text": "“不给模型自由 SQL”也不是一个适用于所有系统的口号，而是本篇选择的能力模型：我们愿意牺牲查询表达力，换取可以逐项验证的操作集合。真正需要更多表达力时，应逐步增加有类型、有权限、有预算的操作，而不是突然放开一个 raw_sql 后门。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "完整工具：身份、校验、编译、查询与资源关闭",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面脚本包括样本数据库、可信 Principal、计划编译器和执行函数。Principal 是本地调用方传入的身份对象，尚不是一个登录系统；它使用 frozen dataclass 防止意外原地修改，但不会因此变成不可伪造的安全凭证。接入 HTTP 时必须由认证结果构造它。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson6_data.py",
          "code": "\"\"\"Chapter 6: compile a finite query plan; never execute model SQL.\"\"\"\nimport json\nimport sqlite3\nfrom dataclasses import dataclass\nfrom contextlib import closing\n\n\n@dataclass(frozen=True)\nclass Principal:\n    tenant: str\n    can_read_tickets: bool\n\n\ndef setup(db):\n    db.executescript('''CREATE TABLE tickets(id TEXT PRIMARY KEY,tenant TEXT,status TEXT,subject TEXT);\n      INSERT INTO tickets VALUES('a-1','acme','open','申请只读权限');\n      INSERT INTO tickets VALUES('a-2','acme','closed','发票问题');\n      INSERT INTO tickets VALUES('b-1','other','open','其他租户的工单');''')\n\n\ndef compile_plan(principal, plan):\n    if not principal.can_read_tickets or not principal.tenant:\n        raise PermissionError('TOOL_FORBIDDEN')\n    if type(plan) is not dict or set(plan) != {'status', 'limit'}:\n        raise ValueError('INVALID_PLAN_FIELDS')\n    if type(plan['status']) is not str or plan['status'] not in {'open', 'closed'}:\n        raise ValueError('INVALID_STATUS')\n    if type(plan['limit']) is not int or not 1 <= plan['limit'] <= 20:\n        raise ValueError('INVALID_LIMIT')\n    # Identifiers and tenant predicate belong to trusted code, not the model output.\n    return ('SELECT id,status,subject FROM tickets WHERE tenant=? AND status=? ORDER BY id LIMIT ?',\n            (principal.tenant, plan['status'], plan['limit']))\n\n\ndef query(db, principal, plan):\n    sql, params = compile_plan(principal, plan)\n    db.execute('PRAGMA query_only=ON')\n    remaining_callbacks = 500\n    def budget():\n        nonlocal remaining_callbacks\n        remaining_callbacks -= 1\n        return 1 if remaining_callbacks <= 0 else 0\n    db.set_progress_handler(budget, 100)\n    try:\n        return [dict(zip(['id', 'status', 'subject'], row)) for row in db.execute(sql, params)]\n    finally:\n        db.set_progress_handler(None, 0)\n\n\nif __name__ == '__main__':\n    with closing(sqlite3.connect(':memory:')) as db:\n        setup(db)\n        print(json.dumps(query(db, Principal('acme', True), {'status': 'open', 'limit': 5}), ensure_ascii=False))\n        for plan in [{'sql': 'DROP TABLE tickets'}, {'status': \"open\\' OR 1=1 --\", 'limit': 5},\n                     {'status': 'open', 'limit': True}, {'status': 'open', 'limit': 1000}]:\n            try:\n                query(db, Principal('acme', True), plan)\n            except ValueError as error:\n                print('拒绝：', error)",
          "language": "python",
          "purpose": "完整可运行模块：固定查询、严格限额、参数绑定、只读和 VM 预算；末尾包含正常与拒绝示例。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "compile_plan 最先检查 can_read_tickets 与非空租户，随后要求字段集合恰好是 status、limit。只检查“包含所需字段”还不够，因为多出来的 tenant 或 sql 可能被后续某段代码误用。对小型契约，显式拒绝未知字段比默默忽略更容易排查。"
        },
        {
          "type": "paragraph",
          "text": "接着检查枚举与整数范围。注意 type(limit) is int 而不是 isinstance(limit,int)：Python 的 bool 是 int 的子类，True 会通过后一种检查，却不是这个接口愿意接受的查询数量。输入类型是服务契约的一部分，不能因为底层数据库碰巧能把 True 当 1，就把它算作合法业务输入。"
        },
        {
          "type": "paragraph",
          "text": "最后返回一条固定 SQL 和参数元组。带入 Principal(acme,true) 与计划 {status:open,limit:5}，SQL 本身不出现 acme，参数按顺序为 acme、open、5。当前身份给出的 tenant 无论长得多像 SQL，都只作为一个值绑定。应用没有把它格式化进 WHERE 字符串。"
        }
      ]
    },
    {
      "id": "sql-boundary",
      "title": "参数化解决值的边界，不解决全部查询权限",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "参数占位符把 SQL 结构与数据值分开。字符串 open' OR 1=1 -- 在本例会先被枚举检查拒绝；即使未来允许用户搜索自由文本，也应该把它作为占位符参数，不能把它当 SQL 代码拼接。过滤关键字或删除引号不是可依赖的通用注入防线。"
        },
        {
          "type": "paragraph",
          "text": "反过来，参数化并不自动决定用户能看什么。SELECT 全库然后把 tenant 放进另一个无关参数，仍然没有隔离。这里的隔离来自可信代码固定的 WHERE tenant=?，并且只有一个由 Principal 提供的 tenant 值。要审查的是整个查询结构与身份来源，不只是有没有问号。"
        },
        {
          "type": "paragraph",
          "text": "SQL 标识符通常不能像值一样绑定。表名、列名或 ORDER BY 方向如果需要动态变化，要在应用白名单中选择固定片段。本例直接固定三列、固定 tickets 表和 id 排序，避免为入门示例引入一个不完整的 SQL 解析器。"
        },
        {
          "type": "reference",
          "title": "Python sqlite3：参数占位符",
          "url": "https://docs.python.org/3.12/library/sqlite3.html#how-to-use-placeholders-to-bind-values-in-sql-queries",
          "note": "本例所有外部值使用占位符；SQL 结构属于可信代码。数据库产品与驱动不同，占位符语法也可能不同。"
        },
        {
          "type": "paragraph",
          "text": "为什么只返回 id、status、subject，而不 SELECT *？这是输出最小化：执行工具只暴露当前任务所需字段，后续表里即使增加内部备注或敏感列，也不会自动出现在模型上下文里。列白名单和行权限是两条独立约束，都应该被测试。"
        }
      ]
    },
    {
      "id": "resources",
      "title": "只读、行数上限和执行预算分别保护什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "PRAGMA query_only=ON 阻止这个连接执行常见数据修改，作为固定查询之外的一层纵深限制。它不是文件系统只读权限、独立进程或数据库账号隔离。拥有连接对象的可信代码仍然可以修改设置，因此不能把连接直接暴露给不可信插件，再靠一句 query_only 许诺沙箱。"
        },
        {
          "type": "paragraph",
          "text": "LIMIT 20 限制返回行数，却不保证数据库只读取二十行。没有合适索引时，数据库可能先扫描大量记录或进行排序，最后才返回二十条。这也是为什么“只允许 SELECT 并加 LIMIT”不能直接解决任意模型 SQL 的资源风险。"
        },
        {
          "type": "paragraph",
          "text": "本例额外注册 SQLite progress handler：每执行约 100 条虚拟机指令回调一次，最多允许 500 次回调，再返回非零中断执行。它限制的是一类 VM 工作量，大约五万指令，不是五百毫秒，也不是五万行。实际时间仍受 SQLite 版本、数据、存储和计划影响。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/tests/test_course.py",
          "code": "    def test_vm_budget_aborts_and_cleans_handler(self):\n        self.db.executemany('INSERT INTO tickets VALUES(?,?,?,?)', [(f'z{i}', 'other', 'closed', 'load') for i in range(20000)])\n        with self.assertRaisesRegex(sqlite3.OperationalError, 'interrupted'):\n            query(self.db, Principal('no-matches', True), {'status':'open','limit':5})\n        self.assertEqual(self.db.execute('SELECT 1').fetchone()[0], 1)",
          "language": "python",
          "purpose": "实际构造大量不匹配记录，验证查询被 VM 预算打断；随后 SELECT 1 成功，证明 handler 已在 finally 中清理。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "最后的 finally 关闭 progress handler，外层 closing 关闭连接。Python sqlite3 的连接上下文管理器负责提交/回滚，不负责自动关闭连接，因此代码显式使用 closing。若把连接放入池中，清理临时限制与状态更加重要，否则下一个无关请求可能继承上一条查询的预算回调。"
        },
        {
          "type": "paragraph",
          "text": "更复杂的生产查询可以使用只读数据库角色、只读副本、statement timeout、资源组、行列级权限和独立执行服务。不同数据库的能力与语义不同；本章 SQLite 的 PRAGMA 与 progress handler 不能原封不动当作 PostgreSQL 的安全方案。"
        }
      ]
    },
    {
      "id": "tests",
      "title": "成功、越权、注入和资源耗尽怎样分别验证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/ai-engineering-course\nsource .venv/bin/activate\npython lesson6_data.py\npython -m unittest tests.test_course.DataTests -v",
          "language": "bash",
          "purpose": "使用真实 SQLite 执行固定 SQL。测试包括权限拒绝、额外字段、类型边界、租户隔离、只读与 VM 工作量限制。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "默认运行先打印一行 a-1，这是 acme 的 open 工单。接下来的四个输入分别尝试提交 raw SQL、把状态变成注入片段、把 limit 设成 True，以及把 limit 设成 1000，都应该被拒绝。拒绝发生在 compile_plan，数据库不会按这些计划执行。"
        },
        {
          "type": "paragraph",
          "text": "测试还创建 Principal(acme,false)，确保即使计划完全合法也不能读取。另一个测试在查询后尝试 DELETE，验证只读连接设置实际生效；预算测试构造两万条不匹配记录，让固定查询走到资源上限并被中断。这些断言证明的是给定执行器与样本的行为，没有证明一个真实模型能够稳定理解各种业务问题。"
        },
        {
          "type": "table",
          "headers": [
            "要评测的能力",
            "合适样本",
            "不能替代它的指标"
          ],
          "rows": [
            [
              "自然语言计划正确",
              "问题及人工确认的 status / limit",
              "SQL 没报错"
            ],
            [
              "授权与隔离",
              "不同租户、无权限、越权字段",
              "计划 JSON 合法"
            ],
            [
              "执行资源",
              "足够大的数据和不利过滤条件",
              "返回不足二十行"
            ],
            [
              "回答忠实",
              "结果集与最终文字逐条对照",
              "引用了一个存在的工单 ID"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "接入模型规划器后，应记录问题 ID、计划版本、验证结果、执行耗时、扫描或预算情况与错误类别，避免全量记录敏感工单正文。若模型经常输出不支持的查询，应先决定要扩展能力还是明确拒答；不要为了让成功率好看，就在校验失败后回退为任意 SQL。"
        }
      ]
    },
    {
      "id": "production",
      "title": "从受限工具走向真实数据产品，还缺什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "完整数据 Agent 还要理解指标口径、时间范围、数据新鲜度和结果解释。比如用户说“上周未关闭”，究竟按创建时间、关闭时间还是截至某一时刻的状态统计？这类语义必须由产品定义、Schema 说明与评测样本回答，不能指望 SQL 语法验证猜出来。"
        },
        {
          "type": "paragraph",
          "text": "如果允许聚合，要考虑小样本是否暴露个人信息、不同条件反复查询是否能推断敏感数据，以及租户之间共享缓存是否错误。若允许写入，还要增加具体操作授权、审批内容绑定、幂等键、审计与恢复。第四篇的审批机制可以复用思路，但每个写工具仍需要自己的不变量。"
        },
        {
          "type": "paragraph",
          "text": "至此，六篇形成一条可以拆开验证的链：第一篇管理送入模型的上下文，第二篇接回可校验结果，第三篇建立可追溯资料，第四篇组织可恢复步骤，第五篇把过程交给浏览器，第六篇守住数据执行边界。它们是同一领域的独立教学模块，不是已经集成为一个生产平台的宣称。"
        },
        {
          "type": "callout",
          "title": "继续阅读原八章",
          "text": "原 Agent 工程系列继续主讲工具与 MCP、检索评测、运行时、记忆、安全和交付。你现在可以带着可运行的具体边界去读它们，再按自己的业务选一个端到端作品，避免把下载了六个示例等同于完成线上 Agent 产品。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Python 3.12：sqlite3 参数与资源管理",
      "url": "https://docs.python.org/3.12/library/sqlite3.html"
    },
    {
      "title": "SQLite：query_only 语义",
      "url": "https://www.sqlite.org/pragma.html#pragma_query_only"
    },
    {
      "title": "SQLite：进度回调与取消执行",
      "url": "https://www.sqlite.org/c3ref/progress_handler.html"
    },
    {
      "title": "Python：bool 与整数类型关系",
      "url": "https://docs.python.org/3.12/library/stdtypes.html#boolean-type-bool"
    }
  ],
  "tags": [
    "数据 Agent",
    "Text-to-SQL",
    "查询计划",
    "参数化 SQL",
    "多租户",
    "只读",
    "执行预算"
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
