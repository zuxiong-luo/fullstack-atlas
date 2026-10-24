# 第8章：把笔记提交到真实SQLite文件

依赖第4章Note与第7章HTTP模型；无需第9章。CPython3.12.14，实际链接SQLite3.53.1、sqlite3.threadsafety=3。Python3.12新增autocommit参数；本实现显式autocommit=True，使用SQL BEGIN/COMMIT/ROLLBACK，不依赖未来默认值。其余HTTP栈与chapter07/requirements.lock相同。

在课程根目录：

```sh
.venv-web/bin/python -m pip install -r chapter07/requirements.lock
.venv-web/bin/python -m unittest -v test_chapter08
# 只使用新建、自己拥有的目录，不指向已有数据库：
mkdir -p .local-notes
ATLAS_DB="$PWD/.local-notes/notes.sqlite3" ATLAS_TOKEN=local-demo-token-2026 .venv-web/bin/python -m chapter08
```

只监听127.0.0.1:8018，Ctrl+C停止并关闭池。另一终端：

```sh
curl --noproxy '*' -sS -X POST http://127.0.0.1:8018/imports \
  -H 'Authorization: Bearer local-demo-token-2026' -H 'Content-Type: application/json' \
  --data-binary @chapter07/fixtures/import.json
curl --noproxy '*' -sS http://127.0.0.1:8018/notes -H 'Authorization: Bearer local-demo-token-2026'
```

本章/imports是**同步提交接口**：成功HTTP201 `{"count":2,"committed":true}`，已在响应前COMMIT；再次导入409且无部分写入。第7章/imports是202/任务状态，语义不同，不能将两个独立阶段当成兼容的线上升级。第7章异步任务记录并未因此变成耐久任务；生产耐久任务还需存储任务状态/恢复策略。

停止再用同一ATLAS_DB启动，GET仍应有2条。池2连接只是资源复用和同时借用上限，SQLite仍只有一个写事务；BEGIN IMMEDIATE占写位，连接busy等待100ms，池获取等待200ms，超时HTTP503+Retry-After1。FastAPI同步def路由和yield依赖在框架线程池里执行阻塞SQLite，不能在async def中直接照搬SQL。check_same_thread=False仅允许跨线程调用，我们用独占lease避免同一连接并发访问，不等于驱动替业务保证事务。

迁移：v1 notes表；v2 note_tags外键表及title索引。schema_migrations记录连续版本/SQL校验和；启动迁移先持写事务，DDL与history一起提交；失败整体回滚，旧checksum变更、断档或未来版本拒绝启动。旧迁移不可编辑，新增变更应加版本。migrate(path,target=1)只供测试前一版本。每个新连接都显式foreign_keys=ON；WAL文件与-shm只在本机目录使用，不承诺网络文件系统或跨主机支持。

池借用返回会ROLLBACK未结束事务，坏连接使池fail closed，不静默重用。close有活跃lease时拒绝；正常服务关闭须先结束在途请求。pool有限不代表HTTP等待者总数也仅2，框架线程池/请求并发仍需额外预算。本教学池没有生产池的检测、重连、跨进程或遥测策略。

实际12/12测试：v1→v2保留数据/重复迁移、坏DDL回滚、校验和/未来版本拒绝、真实第二条冲突回滚第一条/重新打开持久化、参数化SQL与外键、Event屏障池饱和/关闭/归还、未完成事务回滚和坏句柄拒用、两真实连接写锁与恢复、HTTP409/503/跨应用重开、512条预算。临时数据库均TemporaryDirectory，测试后删除；没有外部PostgreSQL或云数据库。

使用独立用户目录和本机实验token。没有备份恢复/断电耐久、NFS、生产迁移调度、分布式事务或多worker压测证据。客户端超时/断开不自动证明COMMIT没有发生；需要可靠重试时另设计幂等键。

审稿前草稿的v1现已显式声明id TEXT NOT NULL PRIMARY KEY：SQLite普通rowid表的TEXT PRIMARY KEY本身仍可能允许多个NULL，不能套用其他数据库的直觉。该初始迁移尚未发布，修正后checksum改变；已有早期草稿DB会明确拒绝启动，不吞校验差异。只作实验且无保留数据时，停止服务并选择自己新建的另一个空路径；有真实保留数据时应设计追加迁移/表重建与NULL数据处置，不能自动删文件或伪造历史。
