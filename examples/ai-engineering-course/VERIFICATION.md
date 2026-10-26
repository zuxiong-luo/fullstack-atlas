# 核验 2026-10-26

macOS / Python 3.12.14 x86_64 / SQLite 3.53.1。依赖固定在 requirements.lock。

`python -m unittest discover -s tests -v`：30 项通过。所有默认章节入口实际运行；第二章固定回复为 4/5，表示评分脚本识别到故意保留的错误，不代表模型效果。

通过真实回环 HTTP 假上游验证网络适配；通过真实 LangGraph、SQLite 验证审批、恢复、幂等、事务回滚与执行预算。下载 ZIP 在独立目录、新建 venv 安装后复现。

未执行 --live，不产生真实模型质量或费用证据；没有向量检索、OCR、外部写工具、生产认证、多副本或系统断电验收。详见随包 README。
