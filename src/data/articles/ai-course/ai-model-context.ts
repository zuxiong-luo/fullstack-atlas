import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "ai-model-context",
  "topic": "ai",
  "title": "LLM 应用入门：模型、Token、上下文和一次请求",
  "description": "先认识模型在应用里的位置，再用真实 tokenizer 实现上下文预算和完整轮次裁剪。把模型、应用、Agent、RAG 和训练各自负责什么讲清楚。",
  "scope": "面向已有 Web 开发经验的 AI 入门读者。交付本地上下文构造器，解释文本生成及输入预算；不实现模型训练，不把本地 Token 估算当计费依据，不声称测试过真实模型效果。",
  "minutes": 45,
  "labMinutes": 30,
  "prerequisites": [
    "会写基本 Python 函数、列表和字典",
    "理解浏览器向后端发送 HTTP 请求；不要求机器学习基础"
  ],
  "sections": [
    {
      "id": "what",
      "title": "先认识模型：它在应用里负责哪一部分",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "大语言模型，通常简称 LLM，是根据已有上下文生成后续内容的模型。对应用开发者来说，你给它任务说明、用户输入和必要资料，它返回文字、结构化数据，或者一次工具调用建议。它并不会因为生成了“工单已创建”这句话，就真的进入你的数据库插入一条记录。把生成结果接到真实业务上，是应用的工作。"
        },
        {
          "type": "paragraph",
          "text": "先把它放回熟悉的 Web 系统里。浏览器接收用户问题，后端识别身份、取得允许访问的数据，构造请求，调用模型，再校验结果并返回页面。模型是这条链上的一个有能力但可能出错的依赖，类似一个具有特殊输入输出方式的上游服务。鉴权、数据库事务、超时和资源回收仍然需要你来设计。"
        },
        {
          "type": "paragraph",
          "text": "从原理上说，文本会先编码成 Token ID；模型在上下文条件下计算接下来内容的概率分布，再按照解码策略逐步产生输出。你现在不必先推导 Transformer 的全部矩阵运算，但要记住这件事的工程后果：输出不是查表所得的确定事实，流畅与正确之间也没有等号。同一个任务需要格式校验、业务验证，以及在具体样本上的效果评估。"
        },
        {
          "type": "paragraph",
          "text": "训练改变模型参数，推理使用已经训练好的参数处理输入。本系列做的是应用推理链路。把企业帮助文档放进请求，并没有重新训练模型；下一次是否还知道这些文档，取决于应用是否再次提供资料或调用了相应的存储能力。先分清这一层，后面讨论 RAG 和记忆时就不会把它们误当成“模型学会了”。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "负责什么",
            "本系列里的例子"
          ],
          "rows": [
            [
              "模型",
              "根据上下文提出输出或行动建议",
              "将用户问题分类，生成说明"
            ],
            [
              "AI 应用",
              "组织身份、数据、模型调用和交付",
              "内部知识与工单助手"
            ],
            [
              "工作流",
              "由代码预先规定步骤及分支",
              "分类后查资料，必要时等待审批"
            ],
            [
              "Agent",
              "在约束内让模型参与选择下一步行动",
              "根据工具结果继续决定是否检索或结束"
            ],
            [
              "RAG",
              "在生成前取得相关外部资料",
              "取出当前租户的权限申请说明"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这几个对象可以组合。一个客服应用可以只有固定工作流，也可以在其中放入一个 Agent。需要什么就交付什么：如果问题只是“把工单分到三个队列”，先实现分类服务往往更清楚。不要为了叫 Agent，就让模型自己决定每个普通 if 分支。"
        }
      ]
    },
    {
      "id": "request",
      "title": "一次请求怎样经过浏览器、后端和模型",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "我们用内部知识助手贯穿后面的章节。用户输入“权限不足怎么办”，目标是提供申请说明，必要时生成待审批工单。此时应用已经知道当前租户是 acme；模型不负责猜租户，也不能通过生成另一个 tenant 值改变当前身份。"
        },
        {
          "type": "figure",
          "src": "figures/ai-course/context.svg",
          "title": "一次生成请求的职责边界",
          "alt": "浏览器把问题交给后端；后端构造上下文、检查预算后调用模型；模型结果经过校验才返回页面。",
          "caption": "箭头表示数据流，不表示模型能够直接越过后端操作工单。身份留在可信服务端，资料和用户文字作为输入数据。 手机端可在图形区域横向滑动查看完整图。"
        },
        {
          "type": "paragraph",
          "text": "后端准备的上下文通常包括四类内容：应用规则、当前问题、必要的历史轮次，以及本次需要的外部资料。规则解释任务和边界，问题说明用户诉求，历史用于理解指代，资料提供可引用的事实。它们都占输入空间，但权威性并不相同：文档中出现“忽略原有指令”不应该变成服务端允许越权的理由。"
        },
        {
          "type": "paragraph",
          "text": "模型返回后，应用先区分上游调用失败、正常拒绝、不完整输出和可消费的结果。只有可消费结果才继续做字段与业务校验。如果结果建议创建工单，下一步是检查工具权限和用户确认，而不是把建议文字当作已经完成的业务状态。第二章会把这一层落实为具体代码。"
        },
        {
          "type": "paragraph",
          "text": "浏览器也不应该持有模型服务密钥。本站部署在 GitHub Pages，能够展示文章和下载代码，却没有替你运行本例的 Python 服务。实验在本机运行；真实模型接入只放在服务端适配层，由读者主动配置。这是代码运行位置的区别，与网页内容是否公开无关。"
        }
      ]
    },
    {
      "id": "tokens",
      "title": "Token 是编码单位，不是字数，也不是一次文字片段",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Token 是模型使用的编码单位。某些英文词可以对应一个 Token，也有词会拆成多个；中文、空格、标点、代码和不同语言都会影响切分。把“一个汉字就是一个 Token”写死，或者直接用字符串 length 计算账单，都会在真实输入上产生偏差。"
        },
        {
          "type": "paragraph",
          "text": "下面使用 tiktoken 0.14.0 的 cl100k_base 编码。选择它是为了让本地实验可重复，不代表任意供应商、任意新模型都使用这个编码。encoding_for_model 可以帮助按已知模型选择编码，但仍要核对实际模型资料。服务端返回的 usage 才是对应请求的官方用量信息，本地计数用于提前检查和解释变化。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson1_context.py",
          "code": "def text_tokens(text: str) -> int:\n    return len(ENCODING.encode(text, disallowed_special=()))\n\n\n@dataclass(frozen=True)\nclass Turn:\n    question: str\n    answer: str",
          "language": "python",
          "purpose": "真实编码器和不可变对话轮次；disallowed_special=() 把用户文字按普通文本处理。",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "tiktoken 官方实现与 BPE 说明",
          "url": "https://github.com/openai/tiktoken",
          "note": "编码表、算法和模型映射来自 tokenizer；本文的上下文选择策略是教学应用自行定义的。"
        },
        {
          "type": "paragraph",
          "text": "这里的 disallowed_special=() 是 tokenizer 接口约定，表示不把用户输入中长得像特殊标记的字符串当成需拒绝的特殊 Token。它不是提示注入防护，也不会赋予用户文本更高的消息角色。分词与授权属于不同层。"
        },
        {
          "type": "paragraph",
          "text": "另外，服务端流式返回的一段文本不一定对应一个 Token。网络分块、供应商事件和模型解码各有边界。第五章的 delta 事件是演示文本片段，不能通过事件数倒推模型用量。这种区分在计算首个内容事件的延迟和 Token 成本时尤其有用。"
        }
      ]
    },
    {
      "id": "budget",
      "title": "上下文窗口为什么需要预算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "上下文窗口限定一次模型推理可以处理的上下文规模。输入、输出以及不同模型可能使用的内部推理预算如何共享限制，需要看具体接口和模型。应用应该把这些限制作为服务端配置，而不是让用户提交一个自称合法的窗口大小。"
        },
        {
          "type": "paragraph",
          "text": "先用一个纯教学预算说明算法：假定应用允许本次输入最多 160 个本地估算 Token。必要输入是规则和当前问题；历史是可裁剪内容。如果必要输入本身就超过 160，应该拒绝、缩小任务或换一种资料处理方式，而不是偷偷把问题末尾切掉。被切掉的那一部分可能正好含有否定条件或关键约束。"
        },
        {
          "type": "paragraph",
          "text": "例子为每条消息额外预留 12 个 Token。这是为了显式展示“消息封装也需要空间”而选择的本地余量，不是对真实 API 封装开销的测量。模型供应商改变格式后，本地余量可能不够。投入实际服务前，需要用真实 usage 记录校准策略，并保留上游拒绝的处理路径。"
        },
        {
          "type": "table",
          "headers": [
            "输入成分",
            "本例策略",
            "为什么"
          ],
          "rows": [
            [
              "应用规则",
              "必须保留",
              "决定当前任务与输出边界"
            ],
            [
              "当前问题",
              "必须保留",
              "不能悄悄改变用户正在问什么"
            ],
            [
              "历史对话",
              "保留最新的连续完整轮次",
              "避免孤立回答或丢失最近指代"
            ],
            [
              "超出预算的必要输入",
              "直接拒绝",
              "把任务大小问题显式交还调用方"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "完整轮次是一个用户问题和对应回答。本例不加入工具消息，因此轮次结构足够简单。以后加入工具时，工具调用及其结果要作为一个不可随意拆散的组处理。不能只留下 tool result，却把说明它来自哪一次调用的信息丢掉。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "实现：先放必要输入，再选择完整历史",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面给出构造器的完整关键实现。它并不发送网络请求；输入是规则、历史、当前问题和输入预算，输出是准备发送的 messages、估算量与被丢弃的轮次数。上一节已经认识了 Turn 和 text_tokens，这里继续使用它们。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson1_context.py",
          "code": "def build_context(instruction: str, turns: list[Turn], question: str,\n                  input_budget: int, overhead_per_message: int = 12) -> dict:\n    \"\"\"Local admission policy. Overhead is a teaching reserve, not API billing.\"\"\"\n    if type(input_budget) is not int or input_budget < 1:\n        raise ValueError('INVALID_BUDGET')\n    if type(overhead_per_message) is not int or overhead_per_message < 0:\n        raise ValueError('INVALID_OVERHEAD')\n    if not instruction.strip() or not question.strip():\n        raise ValueError('EMPTY_INPUT')\n    if len(instruction) + len(question) + sum(len(t.question) + len(t.answer) for t in turns) > 200_000:\n        raise ValueError('INPUT_TOO_LARGE')\n    def message(role, content):\n        return {'role': role, 'content': content}\n    base = [message('developer', instruction), message('user', question)]\n    def cost(messages):\n        return sum(text_tokens(m['content']) + overhead_per_message for m in messages)\n    if cost(base) > input_budget:\n        raise ValueError('CONTEXT_TOO_LARGE')\n    chosen = []\n    # Keep the newest contiguous suffix: never retain an answer without its question.\n    for turn in reversed(turns):\n        pair = [message('user', turn.question), message('assistant', turn.answer)]\n        candidate = [base[0], *pair, *chosen, base[1]]\n        if cost(candidate) > input_budget:\n            break\n        chosen = pair + chosen\n    result = [base[0], *chosen, base[1]]\n    return {'messages': result, 'estimated_input_tokens': cost(result),\n            'dropped_turns': len(turns) - len(chosen) // 2,\n            'encoding': ENCODING.name}",
          "language": "python",
          "purpose": "完整上下文选择算法；cost 是本地策略，reversed 从最近轮次往前选择。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "按执行顺序看：首先验证预算、空输入和总字符上限，避免对无限长文本做分词。然后构造规则与当前问题的基础列表。如果它已经超预算，立刻抛 CONTEXT_TOO_LARGE；这条路径不会试图删除应用规则来让请求勉强发出去。"
        },
        {
          "type": "paragraph",
          "text": "之后从最后一轮开始，每次把用户问题和回答一起插入当前问题之前。能放下就接纳这一轮，再尝试更早的一轮；放不下就停止。这里使用 break 而不是 continue，因为本例明确要保留最新的连续后缀。跳过最近一轮再捡一条很早、很短的历史，会改变它的连贯性承诺。"
        },
        {
          "type": "paragraph",
          "text": "例如历史是“很长的旧轮次”和“较短的新轮次”，预算只够新轮次时，结果仍然是规则→新问题→新回答→当前问题。不会出现只有“新回答”的消息。dropped_turns 为 1，只表示本次没有发送旧轮次，不代表数据库里的历史记录被删除。"
        },
        {
          "type": "paragraph",
          "text": "算法的代价也要看清：候选消息会被反复计数，历史很长时存在重复工作。教学规模下更容易核验；实际服务可以缓存每条消息的计数、按轮次累加，再对最终请求做一次完整检查。优化前后都要维持“必要输入不静默截断、轮次不拆开”这两个不变量。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行一次，再故意制造放不下的请求",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/ai-engineering-course\npython3.12 -m venv .venv\nsource .venv/bin/activate\npython -m pip install -r requirements.lock\npython lesson1_context.py\npython -m unittest discover -s tests -p test_course.py -v",
          "language": "bash",
          "purpose": "首次安装与编码表准备需要联网。默认运行不会调用模型；所有章节可从本目录逐个启动。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "在记录的 Python 3.12.14、tiktoken 0.14.0 环境里，默认示例输出 estimated_input_tokens=80、dropped_turns=0、encoding=cl100k_base。这里的 80 来自规定输入、规定编码和每消息 12 的本地余量，不是任何模型供应商的账单。接着故意把必要问题扩大，第二次输出 CONTEXT_TOO_LARGE。"
        },
        {
          "type": "paragraph",
          "text": "测试进一步构造两轮历史，把预算设置为“恰好能放下最近完整轮次”。断言不仅看有没有报错，还比较最终 messages 是否等于只传入最近轮次时的结果。这样可以发现历史裁剪把回答单独留下、或者顺序颠倒的错误。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/tests/test_course.py",
          "code": "    def test_keeps_complete_newest_turn(self):\n        turns = [Turn('旧问题' * 20, '旧回答' * 20), Turn('新问题', '新回答')]\n        recent = build_context('规则', turns[1:], '当前问题', 10000)\n        limited = build_context('规则', turns, '当前问题', recent['estimated_input_tokens'])\n        self.assertEqual(limited['messages'], recent['messages'])\n        self.assertEqual(limited['dropped_turns'], 1)",
          "language": "python",
          "purpose": "从实际测试提取：恰好够放下最新轮次时，旧轮次被丢弃，最新一问一答保持完整。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果首次运行卡在获取编码表，先检查网络和本地 tokenizer 缓存；这不是模型服务超时。如果报 ModuleNotFoundError，确认使用的是本目录 .venv 的 Python。不要因为系统还装着 Python 3.14，就把实验环境和本文记录的 3.12 混为一谈。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "理解检查：上下文、记忆和知识库怎样接起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在可以回答几个常见问题。把全部历史一直附在请求后，能够省掉数据库吗？不能。它只是在本次输入里重发已有内容，既受窗口限制，也没有解决持久化、删除和租户隔离。把历史总结成一段话能解决吗？能缩短输入，但摘要可能丢条件，仍需来源和修正机制。"
        },
        {
          "type": "paragraph",
          "text": "RAG 提供的是本次任务相关资料，长期记忆保存的是经授权保留的信息；它们最终都可能作为上下文进入模型，却有不同的写入、检索和失效规则。先明确保存对象和生命周期，再讨论“上下文工程”，会比在 Prompt 里堆一串术语更容易设计。"
        },
        {
          "type": "callout",
          "title": "本章完成了什么",
          "text": "你已经能把模型放回 Web 请求链路，说明 Token 与字数的区别，并运行一个有明确裁剪承诺的上下文构造器。它没有让模型更聪明，而是把“这次到底送了什么”变成可以检查的对象。"
        },
        {
          "type": "paragraph",
          "text": "下一篇把结果接回来：为什么“返回 JSON”仍会失败，Prompt 如何版本化，又怎样用固定样本分开协议错误和业务错误。学完前两篇，再读原有《Agent 第一章》里的双语言服务，里面的适配层、校验和超时就有了清楚的位置。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "OpenAI：Prompt 与上下文概念",
      "url": "https://developers.openai.com/api/docs/guides/prompt-engineering"
    },
    {
      "title": "tiktoken：编码与实现",
      "url": "https://github.com/openai/tiktoken"
    },
    {
      "title": "Python 3.12 dataclass",
      "url": "https://docs.python.org/3.12/library/dataclasses.html"
    }
  ],
  "tags": [
    "LLM 入门",
    "Token",
    "上下文",
    "推理",
    "预算",
    "Python"
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
