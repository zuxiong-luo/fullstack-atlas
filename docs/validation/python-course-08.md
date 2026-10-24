# Python第8章：作者验证

2026-10-24。python-data-access与chapter08独立交付，status review，不追加分类index；第7章仍独立内存接口，无8/9反向依赖。

环境macOS14.5 x86_64，CPython3.12.14，实际sqlite3.sqlite_version=3.53.1，sqlite3.threadsafety=3；HTTP栈与chapter07/requirements.lock相同。这里记录实际链接库，不把所有Python3.12说成默认带3.53.1。

实际`work/expansion/python-web-venv/bin/python -m unittest discover -s examples/python-course -p test_chapter08.py -v`：**12/12通过**，均使用真实TemporaryDirectory文件SQLite。覆盖v1→v2保留数据与幂等迁移、无效DDL与版本登记一起回滚、校验和/未来版本拒绝、第二条真实唯一冲突回滚第一条与重新打开、参数化SQL和外键、Event占用下池超时/活跃close拒绝/归还、未结束事务rollback和坏连接fail closed、两连接实际写锁/恢复、HTTP409/503/跨应用重开、512条预算；另外在两条读取SQL之间让另一连接真正提交标签修改，读取仍见同一旧快照，下一次读取见新值。

真实子进程`python -m chapter08`用新临时文件、127.0.0.1:8018启动。POST/imports实际201/count2/committed true；重复409；GET2条。停止自己Popen后，以同一DB再启动，GET仍2条。运行日志在ignored work/expansion/python8-cli.log，临时DB由TemporaryDirectory清理；未触及现有业务数据库。

实际浏览Python3.12 sqlite3/autocommit官方文档（维护3.12.15）、SQLite事务/foreignkeys/WAL官方页、FastAPI yield说明与固定0.115.8 routing源码。正文显式autocommit=True+SQL BEGIN/COMMIT/ROLLBACK，区别Python.commit空操作；固定FastAPI版本退出时序，不套用当前新scope参数。

正文约3700字符叙述（不含代码）；完整storage/api/__main__与调用，SVG transaction为可编辑源，映射/图形渲染最终检查另回填。同步/imports成功201在响应前提交，明确不同于7章202异步任务；没有冒称耐久异步队列。

连接池2连接不等于SQLite2写者；200ms池获取与100ms数据库busy属于不同预算。check_same_thread=False不等于同一连接可并发任意操作；每lease独占。池不包含全部HTTP等待者/线程数，教学池没有生产重连等完整能力；数据库未测NFS、断电、磁盘故障、备份恢复、多主机、多worker或负载性能。图与站点/手机渲染待另验。

最终内容检查：本章3个带examples路径代码块逐字连续匹配，新增三篇内容tsc无诊断；SVG已以1100px真实渲染人工看过，无文字裁切/覆盖，7章箭头与标注交叉已修复并再看。预览仅ignored work/expansion/python7-9-figures；网站/手机仍未验收。

独立Data审稿发现并真实复现普通SQLite rowid表TEXT PRIMARY KEY接受多NULL：已在未发布初始v1显式增加NOT NULL，12项第8章/全课61项重跑通过；新增实际两次NULL插入均IntegrityError与PRAGMA notnull=1，正常非空仍可写。原历史拒绝测试扩展为真正按旧草稿SQL建文件后再用新SQL迁移，校验和不一致确实MigrationError，不静默吞差异。第9src快照同步，新sdist/wheel已重新构建并由新venv离线安装再验HTTP/重启通过。已有草稿DB按README选择自有新路径或设计追加迁移/表重建，不自动删除保留数据。核对SQLite官方quirks的PRIMARY KEY NULL条目；原初始v1未对外发布，故本轮修正初始迁移，未来已发布迁移仍不可改。
