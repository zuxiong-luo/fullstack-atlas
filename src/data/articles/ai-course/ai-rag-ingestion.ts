import type {Article} from '../../articleTypes';
const article:Article = {
  "id": "ai-rag-ingestion",
  "topic": "ai",
  "title": "RAG 数据工程：解析、分块、版本与可追溯引用",
  "description": "从纯文本到可定位切片，走通知识入库、租户过滤、词法召回、版本替换和引用失效。先建立可检查的数据链，再讨论向量检索该加在哪里。",
  "scope": "实现 SQLite 纯文本知识库和自定义词法检索，不包含 PDF/OCR、真实 embedding、向量库、reranker 或模型生成。以可追溯引用为主线解释生产 RAG 的基础数据边界。",
  "minutes": 55,
  "labMinutes": 30,
  "prerequisites": [
    "读过前两篇，理解输入预算与输出校验",
    "会读基础 SQL；事务与切片规则在正文说明"
  ],
  "sections": [
    {
      "id": "definition",
      "title": "RAG 是先取证据，再根据证据生成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "RAG 是 Retrieval-Augmented Generation，也就是检索增强生成。应用先从外部资料里找到与问题有关、且当前用户有权访问的内容，再把这些证据交给模型生成回答。资料并没有因此进入模型参数；下一次回答是否使用同一版本的资料，仍取决于应用的检索和上下文构造。"
        },
        {
          "type": "paragraph",
          "text": "一条 RAG 链通常有两段。离线或后台处理负责接收资料、解析、切分、建立索引和管理版本；在线处理负责识别身份、检索、排序、组织上下文、生成与校验引用。两段之间通过稳定的文档和切片标识连接。只展示“问题→向量库→模型”的三格图，很容易把真正影响正确性的版本和权限丢掉。"
        },
        {
          "type": "paragraph",
          "text": "本篇先实现第一段与在线召回的最小基础。我们只处理 UTF-8 纯文本，把“解析”收窄为读取文本并统一 CRLF 换行；然后按明确字符窗口切片，保存来源与偏移，执行权限内词法检索，最后验证引用是否仍指向当前版本。生成部分沿用第二篇的输入输出边界，不在这里用一段假回答掩盖数据链路。"
        },
        {
          "type": "paragraph",
          "text": "为什么从这样的小范围开始？因为你需要能够回答：“这段证据到底来自哪个文件、哪个版本、哪一段文字？”如果这个问题没答案，后面换上更大的 embedding 模型，也不会自动补回丢失的来源。先把来源做可靠，再用评测判断召回模型是否值得升级。"
        },
        {
          "type": "figure",
          "src": "figures/ai-course/ingestion.svg",
          "title": "知识写入与读取的两条链",
          "alt": "写入链把来源和文本规范化后切片，在一个事务中替换当前版本；读取链先按租户筛选，再检索和验证引用。",
          "caption": "上方版本更新与下方引用验证共享版本标识。旧切片被替换后，旧引用不会自动指向新内容。 手机端可在图形区域横向滑动查看完整图。"
        }
      ]
    },
    {
      "id": "records",
      "title": "文档、切片和引用分别保存什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "文档是一个逻辑资料对象，比如 acme 租户的 access 说明。切片是文档某个版本的一段连续文字。引用是回答指向证据的稳定标识。本例使用 tenant+doc 定位当前文档，再用内容、来源、切片策略共同生成版本摘要，切片 ID 包含文档 ID、版本、起止位置。"
        },
        {
          "type": "table",
          "headers": [
            "字段",
            "例子或意义",
            "为什么要留"
          ],
          "rows": [
            [
              "tenant",
              "acme",
              "在进入上下文前限制可见集合"
            ],
            [
              "doc / source",
              "access / help/access.txt",
              "逻辑身份与人能读懂的来源分开"
            ],
            [
              "version",
              "SHA-256 摘要",
              "区分内容或预处理规则变化"
            ],
            [
              "start / end",
              "0 / 48",
              "按规范化后的 Python 字符索引定位，左闭右开"
            ],
            [
              "text",
              "原文本[start:end]",
              "让引用内容可以逐字核对"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "source 在本例是导入流程提供的可信来源标签，不是任意抓取的网络地址；后端不会按这个字符串下载网页。它可以显示在引用里，但不能直接当作“已验证的网址”。接入文件系统或对象存储时，还需要来源权限、文件校验和稳定定位规则。"
        },
        {
          "type": "paragraph",
          "text": "版本里不只有文本。把切片大小从 48 改成 80，即使原文不变，切片边界和 ID 也变了；把来源从旧手册改成新手册，引用归属也变了。因此我们把规范化文本、source、窗口大小、重叠大小和策略版本一起计算摘要。这是本项目的版本策略，不是所有 RAG 系统必须使用的格式。"
        },
        {
          "type": "paragraph",
          "text": "偏移的计量单位也不能含糊。Python 字符串切片按 Unicode 码位索引，UTF-8 文件按字节存储，JavaScript 字符串下标按 UTF-16 码元。含 emoji 的文档里，三个数字可能不同。本例由 Python 保存和解释偏移，同时保存原切片 text；前端不能拿 start/end 直接截 UTF-8 字节或 JS 字符串。"
        }
      ]
    },
    {
      "id": "chunking",
      "title": "切分的作用、重叠的代价与一个有意保留的反例",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "切分把长文档变成可以检索和放进上下文的小单元。单元过大，一次命中会带入很多无关内容；过小，条件与结论可能被拆开。比如“审批通过后，管理员才可以调整权限”，如果只留下后半句，模型就可能忽略审批前提。窗口大小不是越小越好。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson3_ingestion.py",
          "code": "def chunks(text: str, size=48, overlap=8):\n    if type(size) is not int or type(overlap) is not int or not 0 <= overlap < size:\n        raise ValueError('INVALID_CHUNK_WINDOW')\n    for start in range(0, len(text), size - overlap):\n        end = min(start + size, len(text))\n        yield start, end, text[start:end]\n        if end == len(text):\n            break",
          "language": "python",
          "purpose": "完整字符窗口切分器；size 和 overlap 的单位是字符，不是 Token。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "先带入一个能手算的输入：“一二三四五六七八九十”，size=6，overlap=2。第一片是 [0,6)，内容“一二三四五六”；第二片从 6-2=4 开始，到 10 结束，内容“五六七八九十”。两片共享“五六”，帮助边界附近的内容一起被找到。"
        },
        {
          "type": "paragraph",
          "text": "这不是对语义完整性的保证。默认权限资料的第一片会在“管理员”附近截断，程序仍然正确遵守了字符窗口规则，却没有保证句子完整。重叠让第二片保留“审批通过后”的条件，仍可能在另一篇长文里不够。这个反例提醒你：算法正确与检索单元适合业务，是不同判断。"
        },
        {
          "type": "paragraph",
          "text": "生产资料往往先按标题、段落或结构切开，再对超长部分做窗口处理，并保存上级标题。PDF 还可能出现双栏错序、页眉重复、表格单元格断裂和 OCR 错字。先抽取一个坏样本核对解析文本，再讨论 chunk size，通常比直接调向量库参数更有效。本篇明确没有交付这些格式的解析器。"
        },
        {
          "type": "paragraph",
          "text": "重叠也有成本：同样的事实会占用更多索引空间，并在召回结果里重复出现。命中后可以合并相邻范围或去重，再按第一篇的 Token 预算装入上下文；合并后仍要保留来源映射。不要用“拼成一个字符串”换掉原来能够定位的切片身份。"
        }
      ]
    },
    {
      "id": "ingest",
      "title": "写入：在同一事务里替换一个文档版本",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面是 Knowledge 类的初始化和写入关键代码。documents 保存当前文档，chunks 保存当前版本的切片。类名及 self.db 是同一个对象的上下文；这些都是项目节选，不把一个缩进方法冒充可单独启动的程序。完整脚本可直接运行。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson3_ingestion.py",
          "code": "    def __init__(self, path=':memory:'):\n        self.db = sqlite3.connect(path)\n        self.db.row_factory = sqlite3.Row\n        self.db.executescript('''\n        CREATE TABLE IF NOT EXISTS documents(\n          tenant TEXT, doc TEXT, version TEXT, source TEXT, text TEXT,\n          PRIMARY KEY(tenant, doc));\n        CREATE TABLE IF NOT EXISTS chunks(\n          tenant TEXT, doc TEXT, version TEXT, id TEXT, start INTEGER, end INTEGER, text TEXT,\n          PRIMARY KEY(tenant, id));\n        ''')\n\n    def close(self):\n        self.db.close()\n\n    def ingest(self, tenant, doc, source, text, size=48, overlap=8):\n        if not re.fullmatch(r'[a-z0-9-]{1,40}', tenant) or not re.fullmatch(r'[a-z0-9-]{1,40}', doc):\n            raise ValueError('INVALID_ID')\n        if not isinstance(text, str) or not text.strip() or len(text) > 100_000:\n            raise ValueError('INVALID_DOCUMENT')\n        if not isinstance(source, str) or not 1 <= len(source) <= 200:\n            raise ValueError('INVALID_SOURCE')\n        canonical = text.replace('\\r\\n', '\\n')\n        # Version includes preprocessing policy, not only original bytes.\n        version = hashlib.sha256(json.dumps([canonical, source, size, overlap, 'char-window-v1'], ensure_ascii=False).encode()).hexdigest()\n        parts = [(start, end, part) for start, end, part in chunks(canonical, size, overlap)]\n        rows = [(tenant, doc, version, f'{doc}:{version}:{start}:{end}', start, end, part)\n                for start, end, part in parts]\n        with self.db:\n            self.db.execute('DELETE FROM chunks WHERE tenant=? AND doc=?', (tenant, doc))\n            self.db.execute('INSERT OR REPLACE INTO documents VALUES(?,?,?,?,?)',\n                            (tenant, doc, version, source, canonical))\n            self.db.executemany('INSERT INTO chunks VALUES(?,?,?,?,?,?,?)', rows)\n        return {'version': version, 'chunk_count': len(rows)}",
          "language": "python",
          "purpose": "Knowledge 的建表、关闭和入库方法；相邻完整代码保留事务、版本与 ID 检查。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "ingest 先检查租户和文档 ID 的格式、来源长度、非空文本与字符上限，然后规范化换行，生成版本与全部切片。切片全部准备好以后才进入事务。这样，切片参数非法或准备过程出错时，还没有删除旧版本。"
        },
        {
          "type": "paragraph",
          "text": "事务中的顺序是删掉本租户、本 doc 的旧切片，替换文档元数据，再批量插入新切片。with self.db 正常退出时一起提交；抛异常时一起回滚。这里承诺的是这一个 SQLite 数据库内的原子替换，不能推广成“数据库与外部向量库同时更新也天然原子”。"
        },
        {
          "type": "paragraph",
          "text": "带入更新过程：acme/access 已有版本 v1，管理员提交新文本得到 v2。事务提交前，读者仍应看到旧的已提交集合；提交后，只查到当前新切片。另一个租户也可以有 doc=access，因为删除条件中同时包含 tenant，不会因同名资料被删掉。"
        },
        {
          "type": "paragraph",
          "text": "重复导入同一文本和同一策略得到相同 version 与 ID，先删后重建的结果数量也不增加。它是入库结果幂等，不等于没有任何写入成本。大规模增量更新更适合分阶段创建新索引、验证后切换活动版本，并异步回收旧版本。此时要额外处理切换失败和回滚窗口。"
        }
      ]
    },
    {
      "id": "retrieve",
      "title": "检索：先决定能看什么，再决定哪些最相关",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "检索器只对 WHERE tenant=? 返回的切片评分。权限过滤放在评分之前，是为了让未授权文本根本不进入候选集合和模型上下文。先对全库取 top3，再在最后删掉别的租户，既可能让本该返回的授权内容被挤掉，也容易在日志或缓存中泄露越权候选。"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson3_ingestion.py",
          "code": "def terms(text):\n    words = re.findall(r'[a-z0-9_]+', text.casefold())\n    for run in re.findall(r'[\\u4e00-\\u9fff]+', text):\n        words.extend(run[i:i + 2] for i in range(len(run) - 1))\n        if len(run) == 1:\n            words.append(run)\n    return set(words)",
          "language": "python",
          "purpose": "词法特征提取：英文词与中文二元片段，不是语义向量。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson3_ingestion.py",
          "code": "    def search(self, tenant, query, limit=3):\n        if not isinstance(query, str) or not 1 <= len(query.strip()) <= 1000 or type(limit) is not int or not 1 <= limit <= 10:\n            raise ValueError('INVALID_QUERY')\n        # Filter before scoring. Demo supports tenant-level access only.\n        rows = [dict(r) for r in self.db.execute('SELECT * FROM chunks WHERE tenant=?', (tenant,))]\n        query_terms = terms(query)\n        document_terms = [terms(row['text']) for row in rows]\n        ranked = []\n        for row, tokens in zip(rows, document_terms):\n            score = sum(math.log(1 + len(rows) / (1 + sum(t in bag for bag in document_terms)))\n                        for t in query_terms & tokens)\n            if score > 0:\n                ranked.append({**row, 'score': round(score, 6)})\n        return sorted(ranked, key=lambda r: (-r['score'], r['id']))[:limit]",
          "language": "python",
          "purpose": "Knowledge.search 完整方法，先查询当前租户，再以自定义词法评分排序。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "terms 对英文数字取词，对连续中文取相邻两个字，例如“账号权限”得到“账号”“号权”“权限”。查询与切片有交集才计分；越少切片包含的词，贡献相对越高。公式是 log(1+N/(1+df)) 的交集求和：N 是当前租户的切片总数，df 是包含该片段的切片数。本文自行定义这个评分，不称它为 BM25，也不把它当向量距离。"
        },
        {
          "type": "paragraph",
          "text": "这个基线很适合观察失败：“账号没有权限”与资料共享大量字面片段，能命中；“无法查看项目”可能表达同义诉求，但词面重合不够，就会漏检。向量检索通过 embedding 表达语义相关性，混合检索组合词法与向量候选，reranker 对候选重新判断；它们分别解决不同阶段的问题，不是把一个 score 字段改个名字。"
        },
        {
          "type": "paragraph",
          "text": "若要接入向量库，需要给每个切片写入相同的 tenant、doc、version、id 和来源，并确保检索侧真正支持所需权限过滤。候选融合不能直接相加两种不同尺度的分数，可以用基于排名的融合或经过校准的策略；最终仍要用业务样本检验。本文没有生成真实 embedding，因此没有“向量召回率提高多少”的结论。"
        },
        {
          "type": "paragraph",
          "text": "本例评分器会遍历当前租户所有切片，计算中还有重复统计，不适合大数据集。它服务于“看清为什么命中”的教学目标。升级到倒排索引或搜索服务时，保留相同的权限与引用契约，再替换检索内部实现，才能独立比较效果和成本。"
        }
      ]
    },
    {
      "id": "citation",
      "title": "引用校验：ID 存在之后还要确认什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "examples/ai-engineering-course/lesson3_ingestion.py",
          "code": "    def citation(self, tenant, chunk_id):\n        row = self.db.execute('''SELECT c.*, d.source FROM chunks c JOIN documents d\n          ON c.tenant=d.tenant AND c.doc=d.doc AND c.version=d.version\n          WHERE c.tenant=? AND c.id=?''', (tenant, chunk_id)).fetchone()\n        if row is None:\n            raise ValueError('STALE_OR_FORBIDDEN_CITATION')\n        return dict(row)",
          "language": "python",
          "purpose": "引用必须属于当前租户且匹配当前文档版本。返回来源与切片文字供调用方展示。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "citation 同时匹配 tenant、切片 ID 和当前 documents.version。只要旧版本已被替换，旧 ID 就找不到，返回 STALE_OR_FORBIDDEN_CITATION。对外把过期与未授权合并成一个错误，是为了避免调用方凭错误信息枚举资料；内部日志可以在不泄露正文的前提下记录诊断原因。"
        },
        {
          "type": "paragraph",
          "text": "为什么不把旧引用自动映射到同一位置的新切片？因为更新可能改掉结论、删除段落，甚至让 start/end 指向完全不同的文字。旧答案引用 v1，就不能在更新后显示 v2 的证据而不说明变化。需要保留历史答案可审计性时，应保存不可变版本快照及访问策略，而不是在后台静默换证据。"
        },
        {
          "type": "paragraph",
          "text": "即便当前 ID 合法，也只证明证据存在且位于允许集合。模型仍可能拿“审批后才能调整权限”的原文，写出“不用审批即可调整”。这需要生成后事实一致性检查或人工/自动语义评测。引用存在率不能冒充答案正确率，和第二篇“JSON 合法不等于分类正确”是同一条判断方法。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "按一个正常输入和两个失败输入验证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/ai-engineering-course\nsource .venv/bin/activate\npython lesson3_ingestion.py\npython -m unittest tests.test_course.IngestionTests -v",
          "language": "bash",
          "purpose": "加载三个纯文本样本。检查当前租户命中、未知问题空召回以及版本更新后的旧引用拒绝。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "若只下载 ZIP，先解压，再进入 ai-engineering-course 目录执行 README 中的命令；下面以整个仓库作为当前目录展示命令。"
        },
        {
          "type": "paragraph",
          "text": "正常输入“账号没有权限”应在 acme 内命中 access 的切片，不返回 other/private。输入“火星天气”得到空列表；调用方此时应补问或明确没有证据，不应为了让模型继续回答，退化为检索其他租户或取消权限过滤。"
        },
        {
          "type": "paragraph",
          "text": "第三步先保存一个旧 chunk_id，再更新 acme/access，随后使用旧 ID 查引用，应抛 STALE_OR_FORBIDDEN_CITATION。测试还比较同一内容不同切片策略得到的 version，并验证重复导入不增加切片数量。这些断言直接检查数据承诺，不靠一次看起来不错的模型回答验收。"
        },
        {
          "type": "paragraph",
          "text": "排查时可以按阶段记录：原文件与规范化文本摘要、切片数量与范围、可见候选数、命中的 ID/分数、进入模型的证据和最终引用。敏感正文不要默认全量打进日志。先定位丢失发生在解析、权限、召回还是生成，再决定改哪个环节。"
        },
        {
          "type": "callout",
          "title": "接下来怎么学",
          "text": "你已经交付一个能够解释来源、版本、权限和失效的知识底座。可以继续读原有《Agent：RAG》学习检索与生成评测，再读下一篇把查资料、等待人确认和执行组织成可恢复工作流。不是所有问题都需要循环 Agent；先让步骤和状态可观察。"
        }
      ]
    }
  ],
  "questionIds": [],
  "references": [
    {
      "title": "Python 3.12：SQLite 事务与参数绑定",
      "url": "https://docs.python.org/3.12/library/sqlite3.html"
    },
    {
      "title": "Python 3.12：字符串与 Unicode",
      "url": "https://docs.python.org/3.12/library/stdtypes.html#text-sequence-type-str"
    },
    {
      "title": "SQLite：事务",
      "url": "https://www.sqlite.org/lang_transaction.html"
    },
    {
      "title": "LangChain：检索的组成与两阶段 RAG",
      "url": "https://docs.langchain.com/oss/python/langchain/retrieval"
    }
  ],
  "tags": [
    "RAG",
    "文档入库",
    "分块",
    "引用",
    "版本",
    "权限过滤",
    "词法检索"
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
