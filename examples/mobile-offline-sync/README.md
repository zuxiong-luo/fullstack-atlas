# 移动端离线数据：协议核心的真实SQLite/HTTP实验

验证环境CPython3.12.14、其链接SQLite3.53.1、macOS14.5。只有Python标准库，requirements.lock明确无第三方依赖；Python与SQLite运行时需另装，不由pip或ZIP安装。

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m unittest -v
```

在仓库根可执行：指定3.12解释器 -m unittest discover -s examples/mobile-offline-sync -v。预期14项全部通过；本机已使用work/expansion/python-web-venv/bin/python真实运行。新venv是否带同一SQLite须通过python -c 'import sqlite3;print(sqlite3.sqlite_version)'核对；其他版本不冒称本轮验过。

Local是真实SQLite本地库，一个已存在的教学笔记n1、一个账户文件；另一个SQLite文件代表远端业务库和幂等回执。http_fixture是真实ThreadingHTTPServer，127.0.0.1随机端口，每测试随机教学Bearer，不用本站口令。测试只建立临时数据目录/端口，结束关闭服务、线程和SQLite文件。

14项覆盖：离线编辑关闭重开；本地事务故障回滚；中文HTTP同步；真实服务停止后连接失败保留队列；远端提交后故意断响应+本地关闭重开+服务重开后同id重放版本仍2；同id改payload冲突；发送后本地又编辑，旧ACK不清新稿，新稿基于已ACK版本再发；两个独立本地库冲突→明确保留本地+新id重放；明确采用远端；重入同步guard；401/非法ACK不清数据；账户文件不匹配/NULL主键/foreign_keys；未发送编辑合并与输入限制。

本地待发输入在下一次编辑时可以合并为新意图，始终使用新op_id。一次已发送快照不可修改后继续用原ID。sync_guard保证同一个Local实例只有一个同步；示例不支持多个进程/多个Local实例同时同步同一文件。UI edit可在网络发送与ACK之间发生，ACK识别旧op并为新稿重设基线和新ID，不覆盖当前body。

冲突时不自动重试；用户可选择采用服务端或用新意图在明确看到的远端version上保留本地，再竞争仍可能409。没有自动合并、CRDT、删除墓碑、全量拉取/游标、多账户切换后台队列、原生存储加密、设备备份/卸载恢复与原生后台任务验收。local文件账户标识只是防误用，不是加密或服务端授权。

依赖和脚本可离线阅读；运行HTTP需要本机解释器。真实SQLite协议核心不等同Flutter/RN真机完成；移动端适配需用各框架存储插件、前后台生命周期和实际设备另验。例子只有n1，容量自然一条待办；推广为多笔记必须加总量、字节、回执保留与迁移策略。

2026-10-25审稿后加入显式ProxyHandler({})，真实测试即使继承故意不可达HTTP_PROXY/no_proxy空也直连成功；HTTPError用上下文关闭。
