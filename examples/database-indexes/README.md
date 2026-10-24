# PostgreSQL 17：联合 B-tree 与访问路径

这是文章 `database-indexes` 的可复现项目。无 npm 第三方依赖，不需要现有数据库账户。

## 环境与运行

已验证：macOS 14.5 x86_64、Node.js 22.12.0、PostgreSQL 17.4。需要 PostgreSQL 17 的 `initdb`、`pg_ctl`、`psql`，不要仅安装客户端。

```sh
cd examples/database-indexes
nvm use
npm ci
PG_BIN=/Library/PostgreSQL/17/bin npm test
npm run check
```

Linux 等其他安装目录可以用 `PG_BIN=/path/to/postgresql17/bin`，但尚未在 Linux 实跑本项目。Windows 原生执行未验证。

测试在临时目录建立私有 PGDATA、私有 socket，监听 **127.0.0.1:55441**。只连接自己的临时实例，不读取现有数据库密码，不接触 5432。端口已占用会启动失败，不能与另外两篇数据库实验同时运行。`finally` 停止本实例并删除自己的临时目录；强制杀进程或系统断电不在这一清理保证内。trust 认证只用于本机隔离教学，不可照搬为部署设置。

## 文件与数据

- `schema.sql`：20 万条确定性订单，100 个租户，两种状态，日期随序号递增。
- `test.mjs`：执行真正的 EXPLAIN JSON，比较查询结果、计划结构和堆访问。
- `harness.mjs`：创建、检查版本、连接与销毁独立实例。
- `verify-article.mjs`：在仓库内逐字核对文章中映射的真实源码节选；独立 ZIP 无文章源文件时明确跳过。
- `.nvmrc`、`package.json`、`package-lock.json`：固定 Node 及可重复安装，无外部服务密钥。

仅为了可控观察，实验 orders 表关闭 autovacuum；生产不要复制这一设置。

## 预期结果

5 个子场景全部通过，Node 报告包含父测试共 **6 tests / 6 pass**：

1. 原查询只有主键可用时，存在 Seq Scan 和 Sort；本机还有 Gather Merge，但不要求所有机器并行度相同。
2. `(tenant_id,status,created_at DESC,id DESC) INCLUDE(amount_cents)` 使原查询结果保持一致，走 orders_recent，省去独立 Sort；VACUUM 后 Heap Fetches=0。
3. 更新金额后 Index Only Scan 仍可能回堆；测试要求 Heap Fetches>0，再次 VACUUM 后为0。本机初次运行观察到40，不把它作为所有环境的固定值。
4. 缺少 tenant 条件仍可查询 paid 的66666条记录。示例广范围查询本机选择 Seq Scan；不将某一个计划写成数据库语义保证。
5. `tenant_id+1=43` 与普通键不同；对应表达式索引建立后出现在计划中。

本项目不修改 planner 开关强行使用索引。没有冷缓存、持续负载或并发压测，不把测试时长当性能结论；机器休眠也会影响整套计时。

## 结果不同时先查什么

确认 PG 为17、数据全量生成、ANALYZE执行成功、查询和索引定义一致。成本参数/数据分布能改变计划；Index Only Scan 的 Heap Fetches 还受可见性映射与更新影响。不要把所有偏差都叫“索引失效”。

参考：[PostgreSQL 17 多列索引](https://www.postgresql.org/docs/17/indexes-multicolumn.html)、[Index-Only Scan](https://www.postgresql.org/docs/17/indexes-index-only-scans.html)、[EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)。
