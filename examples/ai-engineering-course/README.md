# AI 应用与 Agent：Python 实作

Python 3.12.14；tiktoken 0.14.0、LangGraph 1.2.17、SQLite checkpointer 3.1.2。完整依赖固定在 requirements.lock。默认流程不连接真实模型，不需要密钥。

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
python lesson1_context.py
python lesson2_prompt.py
python lesson3_ingestion.py
python lesson4_workflow.py
python lesson6_data.py
python -m unittest discover -s tests -v
```

初次调用 tiktoken 的 cl100k_base 编码可能下载编码表，需要联网。依赖和编码表不包含在网站离线包中；安装、缓存完成后，上述默认实验可离线运行。第五章 Node/React 在独立下载 ai-engineering-stream 中。

## 顺序与输出

1. `lesson1_context.py`：文本计数与完整轮次裁剪。默认输出 estimated_input_tokens=80、dropped_turns=0，随后拒绝超大必需输入 CONTEXT_TOO_LARGE。编码与每消息 12 token 预留是本地教学策略，不能当供应商实际计费或模型窗口保证。
2. `lesson2_prompt.py`：固定回复回放，5 个用例中 4 个通过，故意保留一个“JSON 合法但分类错”的样本。这个 4/5 是回放断言结果，不是模型准确率。测试还启动真实回环 HTTP 假上游验证适配。
3. `lesson3_ingestion.py`：acme 的权限问题召回自己的 access 文档，unknown=[]；更新后旧引用报 STALE_OR_FORBIDDEN_CITATION。纯文本与自定义词法评分，不是向量检索或完整 RAG 回答引擎。
4. `lesson4_workflow.py`：真实 LangGraph，waiting_approval → 新图实例加载 SQLite → completed，副作用条数 1。测试覆盖拒绝、审批内容不匹配、持久恢复、写副作用后故障以及重放幂等。副作用是 SQLite 中的教学工单回执记录；没有创建外部工单。
6. `lesson6_data.py`：只返回 acme 的 a-1；拒绝任意 SQL、注入字符串、布尔 limit 和超大 limit。只读连接设置不是进程级沙箱；此示例没有 HTTP 身份认证和自然语言模型规划器。

每个脚本可独立运行，tests/test_course.py 按章节分测试类。临时 SQLite 文件均在 TemporaryDirectory 中自动回收；知识库默认内存库。

## 可选真实模型：仅第二章

只在读者主动加 `--live` 时发出一次真实请求，可能产生费用。供应商、账号及所选模型必须支持 Responses API 的 text.format JSON Schema。这里不推荐一个所谓“最新”模型；将 OPENAI_MODEL 设为你有权限使用且已核验的模型 ID，尽量固定快照，并记录该 ID。

```sh
# 先在服务端 shell 安全设置 OPENAI_API_KEY、OPENAI_MODEL，不把密钥写入源码或前端
python lesson2_prompt.py --live
```

适配固定 https://api.openai.com/v1/responses，拒绝 HTTP 重定向，最多读取 1MiB，I/O 超时 10 秒，不自动重试。它是一个小型同步适配器，10 秒是 I/O 等待限制，不承诺端到端硬截止时间或失败请求不计费。真实调用未验证，模型语义质量、费用、用量和延迟均无实测数据。

## 安全与能力边界

- tenant/Principal 来自本地可信调用方，尚无网络身份认证。接入服务时必须由认证结果构造，禁止接受模型或请求体自行声明租户。
- RAG 演示只覆盖租户级权限，未覆盖部门/用户 ACL、OCR、PDF、embedding、rerank、向量库。
- LangGraph CLI 为单写入者开发示例。thread_id 只是状态定位键，不能代替授权；不要对用户暴露任意 thread_id 或 graph.update_state。
- 幂等记录与本地副作用在同一个 SQLite 事务中；接外部系统时仍需对端幂等键、Outbox 或业务核对。
- 数据章只实现固定工单读取，查询计划不能表达任意 SQL。真实 Text-to-SQL 需要额外的数据语义、受限语法、隔离、资源预算和评测。
