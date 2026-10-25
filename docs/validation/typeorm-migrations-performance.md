# TypeORM 迁移与观测审校记录

状态：待主代理审校。2026-10-25，Node24.14.1 / PG17.4 / TypeORM1.1.2 / pg8.23.1 / TS5.7.2，macOS14.5 x86_64。

实际 `PG_PORT=55485 PATH=/Users/luozuxiong/.nvm/versions/node/v24.14.1/bin:$PATH npm test --prefix examples/typeorm-migrations-performance`：5 tests / 5 pass / 0 skip。CLI实际通过node_modules/typeorm/cli.js执行，不用mock。最初扩展EntitySchema类型漏reviewedAt编译失败，补扩展泛型后通过，strict未关闭。

1. 空库CLI migration:generate Initial、migration:run；种子数据后ADD_REVIEW_COLUMN=1生成Review、run新增reviewedAt；填值后revert删列，kept笔记仍在、原审核值随列丢失、history剩1。生成器还生成amount默认值0.00→'0.00'正规化，正文如实说明需要审阅。
2. transaction=false + migrationsTransactionMode=each，CREATE INDEX CONCURRENTLY实际完成后SELECT1/0触发22012。to_regclass证实索引留下、partial_history=0。显式down删除并确认NULL。没有把历史未记录误写为DDL全部回滚。
3. 20002笔记，同一tenant-a/bob查询加索引前后deepEqual且一条rare-bob。真实EXPLAIN ANALYZE/BUFFERS JSON：前Seq Scan+Sort，过滤20001，shared hit217；后notes_owner_id_idx Index Scan，shared hit3。本次缓存/分布特定，不承诺提速倍数。未禁用seqscan强制选择。
4. 250行按100/100/50三批写，另一个故意异常事务不留下batch-rollback。12个短查询观测4个backend PID，符合pool max4；不是生产容量证明。

所有DDL只在私有临时PGDATA/固定本篇schema，无5432访问；可外部DATABASE_URL仅用于明确可丢弃库。生成迁移临时目录finally删除，池和自有PG进程均收口。图形实际Quick Look渲染并检查，网站桌面/手机由主代理验收。MySQLDDL、生产锁窗口、备份恢复、跨版本灰度未验证。

## 失败清理修正与最终复跑

四份 `scripts/run-tests.mjs` 已逐字统一：pg_ctl start报错/超时后仍检查本次自有PGDATA；若发现运行则尝试停止，确认不运行后才删除。停止失败或状态未知时保留私有目录并报告路径，退出失败，不盲删运行实例。基础项目额外 `node --test scripts/test-runner-cleanup.mjs` 3/3，覆盖启动失败但启动已产生副作用、停止失败、状态不明；这是假工具生命周期单测，不当作真实SQL证据。

使用修正后的运行器，PG_PORT=55485顺序实际重跑四项目：基础5/5、关系4/4、事务5/5、迁移5/5，共19个Node test（含各父测试），0跳过；所有临时真实PG进程正常停止。基础与关系另经主代理干净副本5/4实跑通过；页面发布状态由主代理统一更新。
