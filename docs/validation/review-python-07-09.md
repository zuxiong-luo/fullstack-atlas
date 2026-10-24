# Python第7～9章独立审校

2026-10-24。审稿人未编写这三章，只读审校作者文件；唯一修复由作者完成。结论：发现的SQLite NULL主键问题已修并独立复测，当前无剩余阻塞。

## 实际环境与复现

使用已锁定的构建/测试venv（不是本次重新创建整个课程venv）：CPython3.12.14标准GIL、SQLite3.53.1、FastAPI0.115.8、Pydantic2.10.6、Starlette0.45.3、Uvicorn0.34.0、HTTPX0.28.1。运行/构建锁与pyproject逐项核对。安装验收则由下面验证器真正另建全新venv。

    work/expansion/python-web-venv/bin/python -m unittest discover -s examples/python-course -p 'test_*.py' -v
    work/expansion/python-web-venv/bin/python examples/python-course/chapter09/sync_package.py --check

首轮60/60通过；修正后再次全量61/61通过（前五章33，第7章8，第8章12，第9章8）。第6章是独立项目，本审稿没有重复它先前9项结果来冒充本次执行。

## 实际发现与关闭：SQLite TEXT PRIMARY KEY不自动非空

审稿人按原chapter08 MIGRATIONS在真实SQLite3.53.1内存库建表，连续写入notes(NULL,'a')、notes(NULL,'b')都成功。普通rowid表TEXT PRIMARY KEY并不自动NOT NULL，会允许多个NULL并使snapshot输出非法领域ID。

作者改为id TEXT NOT NULL PRIMARY KEY，增加两次真实NULL拒绝与PRAGMA table_info的notnull=1断言；还以旧草稿SQL实际建立文件，再确认新迁移校验和明确拒绝该旧历史。第9章生成快照同步，正文/README说明这是未发布初始迁移修正；已有草稿数据应换自己创建的新实验路径或设计追加迁移，不能吞校验和差异/自动删除用户库。

审稿人再次独立按最新MIGRATIONS建库，两次NULL均得到IntegrityError；61项全课程通过。问题关闭，不仅依赖作者称已修。

## 请求、任务、事务与池审校

完整阅读7章models/body_limit/jobs/api、8章storage/api、9章config/observability/cli/measure/profile/sync/verify_install与三新增测试文件。

- 第7章原始字节32768与模型32批次/512笔记/64终态记录是不同预算；等待队列不含固定运行workers。默认async prepare没有真正让出，超时取消依赖合作式等待。TaskGroup/lifespan拥有worker，关闭取消后排空并join。202是接收，不是提交成功；进程内内存不是耐久队列。
- 第8章autocommit=True后实际用SQL BEGIN/COMMIT/ROLLBACK，不误用Python.commit。写锁100ms与池借用200ms分开；check_same_thread=False不意味着连接可并发复用，lease独占。归还先回滚，坏句柄fail closed，活跃lease不允许close。两次读取共用真实读事务快照。
- 迁移在写事务内验证连续版本和SHA256，DDL/历史一起回滚；校验和检测改写，不是恶意篡改签名。真实第二条唯一冲突回滚第一条，重开仍无半批数据。
- 第9章src产物无chapter导入，生成器check避免漂移；配置失败退出2不回显秘密；服务自行生成request_id，只记路由模板而非query/正文/原路径。listener_bound不代表健康启动。
- 串行HTTP采样与128条存储profile是不同负载；current/peak只指跟踪区间的Python分配，非RSS/SQLite所有内存，不以新一轮数字改写作者首轮基线。

三篇6+3+9=18块源码映射逐项匹配。三SVG源码与实现关系一致，独立用QuickLook实际渲染查看，未见标签裁切或箭头矛盾。预览临时增加画布高度防裁切，不修改仓库图形；不是手机浏览器验收。

## 独立sdist → 新wheel → 新venv实测

取作者修复后sdist：work/expansion/python-release/atlas_notes_course-0.1.0.tar.gz。用tarfile data过滤安全解包至审稿人新TemporaryDirectory，确认含requirements.lock/build.lock/verify_install.py/pyproject/MANIFEST与最新NOT NULL源码。

在解包目录用锁定build工具执行独立wheel构建，不复用作者旧wheel。随后调用sdist中携带的verify_install.py，以已有当前平台wheelhouse作离线依赖来源；验证器真正创建新venv、--no-index安装新wheel与锁、pip check、清除PYTHONPATH/用户site并切换临时cwd。

实际结果：
- installed_version与metadata=0.1.0，导入来自新venv，source_checkout_imports为空。
- 真实HTTP201/409/422/401，创建/导入后2条；两个入口console和python -m均启动。
- SIGINT正常退出0共2次，以相同DB重开仍2条。
- 日志有request_id/server_closed，无教学token或私有标题。
- 真实profile文件打开含snapshot。

独立结果保存在ignored work/expansion/review-python-07-09-install.json；临时构建目录/venv/DB/进程由工具清理。本次HTTP样本p50=2.712ms/p95=3.811ms，与作者首轮不同是正常环境差异，未拿它推导优化收益或饱和容量。

## 官方核对与限制

实际重开Python3.12 sqlite3/autocommit、TaskGroup与tracemalloc维护文档，SQLite PRIMARY KEY/WAL文档，FastAPI lifespan与固定0.115.8 routing源码，PyPA打包教程。维护页3.12.15与运行3.12.14区别清楚。

未验证Windows/Linux安装、跨平台wheelhouse、TLS、多租户、持久异步任务、断电/磁盘故障、NFS、多worker生产池或容量。没有执行文章手机页面/线上包最终验收；这些由主代理发布记录另列。
