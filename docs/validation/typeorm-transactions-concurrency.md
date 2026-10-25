# TypeORM 事务并发审校记录

状态：待主代理审校。2026-10-25，macOS14.5 x86_64、Node24.14.1、TypeORM1.1.2、pg8.23.1、TS5.7.2、PostgreSQL17.4。独立锁文件、无Nest依赖。

实际 `PG_PORT=55485 PATH=/Users/luozuxiong/.nvm/versions/node/v24.14.1/bin:$PATH npm test --prefix examples/typeorm-transactions-concurrency`：5 tests / 5 pass / 0 skip。

- 全局Repository与事务manager的pg_backend_pid不同；故意回滚后id1 body=NULL，id2全局写escaped留下；两个都用manager时均回滚。
- 两个调用先读version=1，再同时执行SQL条件更新，affected排序[0,1]、最终version2。实际日志 `UPDATE ... SET "title"=$1,"version"="version"+1 WHERE "id"=$2 AND "tenantId"=$3 AND "version"=$4`；不是仅检查内存版本。
- 两QueryRunner申请同一Note的pessimistic_write，通过第三连接pg_blocking_pids明确观察pid2被pid1阻塞，再提交first；second随后读到after-lock。没有sleep猜测调度顺序。
- 唯一幂等键tenant/key的INSERT冲突同样观测阻塞，再提交first；second零返回行，读取同hash/noteId。只有一条idempotent-note；异请求体hash拒绝。固定hash是夹具，不冒充密码摘要实现。
- QueryRunner finally回滚仍活跃事务并release，第二runner在第一关闭异常时仍关闭；释放后query拒绝；schema DROP失败仍destroy池。

首轮正则错误地假定生成SQL不含列引号，日志条件检查失败；实际条件更新行为已正确。修正为检查真实WHERE列与绑定参数，重跑全部通过。

正文model/test从实际文件同步；图形Quick Look实际渲染并看图。未复现断网提交未知，仅清楚解释边界；未覆盖MySQL/其他隔离级别/全部锁模式/生产吞吐。网页手机渲染交主代理验收。

## 失败清理修正与最终复跑

四份 `scripts/run-tests.mjs` 已逐字统一：pg_ctl start报错/超时后仍检查本次自有PGDATA；若发现运行则尝试停止，确认不运行后才删除。停止失败或状态未知时保留私有目录并报告路径，退出失败，不盲删运行实例。基础项目额外 `node --test scripts/test-runner-cleanup.mjs` 3/3，覆盖启动失败但启动已产生副作用、停止失败、状态不明；这是假工具生命周期单测，不当作真实SQL证据。

使用修正后的运行器，PG_PORT=55485顺序实际重跑四项目：基础5/5、关系4/4、事务5/5、迁移5/5，共19个Node test（含各父测试），0跳过；所有临时真实PG进程正常停止。基础与关系另经主代理干净副本5/4实跑通过；页面发布状态由主代理统一更新。
