# Agent06评测章节与交叉审校记录

2026-10-23。文章ID `agent-evaluation`，保留原5个章节ID与两条研习关联，status review，源码入口仍为agent-workshop.zip。按写作规范13/14原地展示关键代码，不让链接承担补实现的责任。

## 实际评测对象与数据

- `shared/v2/documents.json`：6份固定文档。
- `shared/v2/retrieval-cases.json`：6条教学fixture，5正例+1无命中。不是独立隐藏数据集，也不是模型质量数据。
- `shared/v2/http-cases.json`：11组、20请求步骤，检查协议字段/权限/状态；测试provider默认确定mock。
- 两语言eval直接调用KeywordRetriever，完全不调用provider：model_calls=0。

正文完整内嵌10份实际文件：文档、检索fixture、两语言contracts/retrieval/evaluate、TS评测器测试、HTTPfixture。Python作者与TS作者冻结后重新读取；原地代码已逐文件比对。图在`public/figures/agent-evaluation/layers.svg`，XML/title/desc有效；主代理统一做页面与手机实际呈现验收。

## 本次实际执行

环境Node22.12.0、Python3.12.14；项目依赖固定Fastify5.12.7 / FastAPI0.161.1。

1. TS `npm run eval --silent`与Python `.venv/bin/python evaluate.py`分别运行，解析JSON逐字段一致（数值1与1.0按JSON数值比较）。6例结果分别lease/cache/ready/private/none/injection；正例均Recall@3=1，mean=1，无命中正确，model_calls=0，not_model_quality=true。正文展示真实TS完整JSON。
2. TS独立评测器3项测试通过：空/无正/无无命中数据不能假通过、共享报告、目标第4名不能算Recall@3。
3. TS协议相关子集13项通过：11组shared HTTP、1检索/身份隔离、1格式/引用校验。
4. Python协议/评测子集13项通过（13 deselected）：11组shared HTTP、共享报告/坏数据检查、第4名排除。命令`.venv/bin/python -m pytest -q tests/test_app.py -k "shared_http_contract or evaluation or recall_at3"`。
5. 两端在进程内实际构建对应chapter服务，执行11组20步，抽取status、error.code和fixture expect指定字段，20/20相同。TS使用Fastify inject，Python ASGI测试传输；不是公网TCP/TLS/代理性能测试，也不要求message本地化文本逐字一样。父代理另做真实服务器parity。
6. TS工程 `npm run build`实际通过；站点构建与离线整合交主代理。

## 主动反例与发现修复

- 空检索器：mean=0、no_hit_pass=true、passed=false、model_calls=0；实际示例进程退出码1，正文同时给执行代码与真实输出。
- 附加irrelevant：每个正例保留所需ID并多放无关证据，none仍空，mean=1/no_hit_pass=true，现有Recall门槛仍通过。此反例说明Recall不是precision或语义正确性，不是默认基线表现。
- 审查发现空数据可产生NaN且误通过，已由两端作者补非空、正例/无命中都存在的校验。
- 审查发现可注入Retriever返回第4项也计进名为Recall@3的指标，已由作者在评测层再截3并加回归测试，正常6例报告不变。
- Python输出trim与JS的Unicode差异已提醒作者，冻结contracts现在使用共享trim规则；没有越权修改源码/契约。

## Agent01只读复核

`agent-foundations`正文中的Python models/app/providers与TS contracts/app/providers六个完整文件，以及shared/request.json，都与当前文件逐字一致。关键类型、调用者、超时/解析/引用校验、适配器自足；未发现阻断问题。第一章仍明确缺认证/全局预算，并说明引用ID存在不能证明论断正确。没有因新增v2改变第一章契约。

## 最终Unicode同步与交叉审校

两端作者完成最终UTF8/孤立surrogate修订后，重新从冻结文件读取contracts.ts与contracts.py，替换本文两个完整代码块；其余评测代码未变。再次运行两端eval，六例JSON报告与原记录一致。亲自补跑TS ingress/Unicode/评测选择子集5项通过，Python Unicode/UTF8/评测/第4名子集4项通过（23 deselected）；合法emoji保留、非法UTF8/BOM/UTF16与孤立surrogate均按明确边界处理。作者最终完整套件报告TS33项、Python36项；此项标明作者结果，不混同上面的亲自子集。

只读复核Agent02/03/07时，发现并反馈：02缺Python evidence_of定义；02/07的HTTP身份到调用链未原地完整展示；07缺检索授权到provider的连续代码；MCP以npm run启动会把npm banner混入stdout。作者已分别补完整公共层、双语言app、07检索器与Service链，并改为npm run --silent mcp。重新阅读修订后，关键实现自足；身份由服务器映射、权限过滤发生在外发前、引用成员校验不等于语义支撑、mock不能证明真实模型抗注入，这些解释与实际代码一致，未发现新的阻断机制问题。

## 限制

本章是检索回归与协议验收，不是模型语义质量实验。没有付费调用、模型准确率、真实token/费用或延迟分位数；重复跑确定关键词样本不产生独立模型trial。生产Trace平台、隐藏测试集、人评/模型judge一致性与真实网络部署未交付。CLI异常当前统一INVALID_EVALUATION_DATA，换远程目标后仍应细化运行错误分类。

文章保持review；权限/引用/状态硬门槛不能被检索均值抵消。未验证部分必须继续保留，不可将本次mean=1称为知识助手100%准确。
