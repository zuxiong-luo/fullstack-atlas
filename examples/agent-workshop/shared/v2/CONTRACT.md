# Agent02—08双语言统一契约 v2

原chapter01保持原目录与/v1/answers不改。后续实现分别放python-v2/、typescript-v2/；同一最终源码按chapter=2..8开启功能，每章用shared/chapter-0N.json定位命令、测试与本次交付提交。不得声称每章是独立Git tag，除非真的创建。代码/契约共享但每章有明确功能门槛；测试必须验证尚未开放路由不生效。

## 共同输入与身份

独立本地演示令牌 `Bearer demo-alice`=>alice、`Bearer demo-bob`=>bob。身份由服务器映射，不接受body.owner。只供回环教学，不是生产认证。/health公开=>{"status":"ok","chapter":N}。其余鉴权失败401 UNAUTHORIZED。body必须JSON对象、无未知字段、字符串trim、Unicode code point计数；拒绝JSON转义后的未配对UTF-16代理项（合法emoji代理对可用），请求字段返回400 INVALID_REQUEST，模型answer返回502 MODEL_SCHEMA_ERROR；请求上限64KiB，超出413 PAYLOAD_TOO_LARGE；字段/JSON无效400 INVALID_REQUEST。默认无模型密钥，无付费调用。

## Chapter02工具与协议

POST /v2/tools：{name:"lookup_document",arguments:{document_id:string}}。document_id限定^[A-Za-z0-9_-]{1,64}$。唯一工具lookup_document；未知工具403 TOOL_FORBIDDEN；参数不符400 INVALID_REQUEST。只能读取public或当前owner文档，否则403 DOCUMENT_FORBIDDEN（不存在与无权统一）。200 {ok:true,result:{id,title,text}}。文档全部来自documents.json，不接收URL/path/shell。业务能力由服务器白名单控制，与文档/模型说什么无关。

本地MCP stdio子集：MCP2025-06-18，逐行JSON-RPC2.0，initialize、notifications/initialized、tools/list、tools/call；工具同一校验/授权逻辑，身份由启动环境固定。只声明tools能力，日志到stderr，stdout仅协议。文档须明确子集不覆盖HTTP传输、OAuth或完整会话协商。普通未知method -32601，参数 -32602；工具执行错误作为isError工具结果，不能执行任意命令。通知不发送response。

## Chapter03检索和引用

POST /v2/answers：{question:string 1..2000}；最多返回top3非零匹配文档，仅public或owner文档。确定关键词基线：NFKC+lower question，计算每个文档keywords中被question包含的项数；分数降序、id升序打破平局。不是向量相似度；提供可替换Retriever接口，不生成随机embedding。

模型provider接口：输入question与选中evidence，输出{answer,citations}；本地mock可返回第一条证据原文及其id；无命中=>answer="没有找到可引用的资料。",citations=[]。200 {ok:true,result:{answer,citations,evidence:[{id,title,text}],metrics:{retrieved:number,model_calls:number}}}。引用必须唯一、都来自选中证据，未知引用502 UNSUPPORTED_CITATION；格式/Schema错误502 MODEL_FORMAT_ERROR/MODEL_SCHEMA_ERROR。答案正确性不由引用ID存在保证；文章必须强调。

真实HTTP provider由服务器环境配置，仅在显式MODEL_PROVIDER=http时使用；复用/适配chapter01已验证的有界HTTP与错误分类，不能在客户端存密钥。不自动进行付费调用，真实调用未验证需明说。文档文本永远作为不可信数据，不变成工具授权。

## Chapter04持久化执行

POST /v2/runs：{request_id:ID,question:string}；SQLite按(owner,request_id)唯一。状态至少queued/retrieved/completed；checkpoint保存选中的证据，重启resume不重复检索。响应200 {ok:true,run:{request_id,status,answer,citations,checkpoint}}；首次与重放同结果。相同键不同问题409 IDEMPOTENCY_CONFLICT。

GET /v2/runs/:id：只读当前owner，跨用户/不存在404 RUN_NOT_FOUND。POST /v2/runs/:id/resume：从当前持久检查点恢复。恢复是显式调用；不声称有生产后台调度。

至少有BEGIN IMMEDIATE等本地原子认领与fencing epoch。模型调用不持有长数据库事务。进程在retrieved后实际退出再重启的测试；过期认领重试仍需epoch检查防止旧执行者提交。外部模型调用可能重试，不承诺exactly once。测试可以注入clock/故障钩子，不能给HTTP用户任意故障开关。

## Chapter05记忆

POST /v2/memory：{id:ID,text:string1..2000}；GET /v2/memory；DELETE /v2/memory/:id。按owner+id隔离。只存用户显式写入的内容，不自动把完整轨迹当长期记忆。返回{ok:true,result:...}，删除返回{ok:true,deleted:true}；不存在/别人的404 MEMORY_NOT_FOUND。删除影响后续读取，不声称已备份或已经发送给模型的数据会远程抹除。记忆默认不自动加入问答，若加入须更新契约并对两端一致验证。

## Chapter06评测

读取retrieval-cases.json运行同一基线，报告每例选中IDs、Recall@3和无命中行为；这是检索回归而非模型语义质量。回归门槛基于明确数据。双语言提供JSON格式CLI报告；模拟provider结果不当真实模型评测。校验引用错误与失败路径，不仅检查文字长度。

## Chapter07权限与提示注入

对injection-demo进行受控问答，不能因此新增工具或访问bob-note。测试模型提出shell/任意URL/越权文档时白名单拒绝；不把prompt文本当安全边界。请求日志不含授权token、API key或完整private文本。持久化目录/数据库只服务本地，不暴露给GitHub Pages。

## Chapter08容量、预算与部署

增加每次进程有限并发准入（默认2，满时503 SERVICE_BUSY），单次模型超时、上下文总长度限制（默认12000 code points；超限400 CONTEXT_TOO_LARGE），最大模型调用次数预算（默认1）。默认关键词基线只调用1次模型，无命中可0次。幂等重放不得再次调用模型。

提供启动与关闭、Dockerfile/环境样例（无密钥）、health与实际资源限制说明。仅本地验证不能冒充容器/多实例部署验证。成本只输出model_calls/context_chars等真实计数，不能把字符数称token或美元费用。持久化记忆/检查点的备份/加密/权限与生产auth明确另列。

## 各章共同要求

文章正文展示决定正确性的完整代码，双语言接口/样本/错误一致；每章版本标记可追踪。每章有正常、失败与恢复测试，不复制模拟数据冒充真实模型效果。保留旧chapter01案例及测试。

## 两端补充输出约定（实现前统一）

错误统一{ok:false,error:{code,message}}，message可本地化，不得含秘密/原始模型输出。有效占用中的相同run=>409 RUN_BUSY，旧epoch提交=>409 STALE_RUN，尚未开放的chapter路由=>404 ROUTE_NOT_FOUND，调用预算不足=>400 MODEL_BUDGET_EXCEEDED。默认lease10000ms，默认模型timeout3000ms；允许测试注入时钟/短lease，不用真实等待到期。memory GET的result为按id升序排列的{id,text}数组；memory POST返回result:{id,text}。run.status completed时checkpoint="done"，尚在retrieved检查点时checkpoint="retrieved"；没有答案时answer=null、citations=[]。Node22使用node:sqlite需要实验flag，应在运行脚本与说明中明确。

Chapter08的context_chars严格按question加上选中evidence中id/title/text的Unicode code point数之和计数，不含JSON语法字符。准入槽只包POST /v2/answers、POST /v2/runs及resume的实际执行，读取/工具/记忆不占模型执行槽。chapter02—07不开启第08章context/call/concurrency门槛，所有章节的真实HTTP模型超时仍启用。
