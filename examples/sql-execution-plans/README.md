# sql-execution-plans

固定Node.js22.12.0、pg8.13.1、PostgreSQL17.4。数据全为教学数据。

    cd sql-execution-plans
    npm ci --ignore-scripts
    npm test
    # tests 6; pass 6; fail 0
    # 可设置PG_BIN=/your/pg17/bin后再运行

## 隔离与文件

postgres.mjs默认使用 /Library/PostgreSQL/17/bin，建立短前缀临时PGDATA与0700 Unix socket目录、编号55445，不监听TCP、不连接用户5432。普通用户可initdb；不要以root运行。测试finally关闭池/停止实例/删除目录。强杀整个测试进程会跳过finally，清理时只定位自己的临时数据目录，不能随意按端口杀其他服务。

schema.sql提供完整初始化；test.mjs是可直接运行的复现入口，测试中的受控钩子不是生产API。package-lock.json固定依赖。源码、必要助手、README均应位于下载ZIP，node_modules与运行时数据不打包。

## 验证输入与预期

60000订单/1000客户。Seq Scan+Sort→Index Only同结果；JOIN/聚合与独立计算一致；work_mem64kB真实Disk外排；OFFSET索引输出10020 vs keyset20且同页；旧统计估1/实30000，ANALYZE后接近实际（抽样数字不固定）。

## 范围

EXPLAIN ANALYZE真正执行；只用教学SELECT。cost非毫秒，Actual Rows要结合loops，BUFFERS非直接冷盘指标。计划与并行可变化；不强关SeqScan，不发布速度倍数。

plan.mjs采集EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)，测试console输出关键节点摘要。排序测试只SET LOCAL，不改全局；stats测试只关闭新建events表autovacuum以制造旧统计，不建议照搬生产设置。

## 已验证与未验证

2026-10-24 macOS14.5真实运行；具体命令/结果在对应docs/validation记录。无生产容量/高可用/跨地域/托管服务验证。浏览器/手机阅读验收属于站点集成，不由CPU数据库结果替代。离线下载能带走源码，仍需在本机安装PG（缓存篇还需Redis）。
