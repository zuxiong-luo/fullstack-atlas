# reliable-tasks：独立PostgreSQL教学环境

环境：Node.js **22.12.0**、PostgreSQL **17.4**。无npm第三方依赖。

```sh
nvm use
npm ci
npm test
npm run check
```

默认程序目录 `/Library/PostgreSQL/17/bin`，其他安装位置用 `PG_BIN=/实际路径 npm test`。测试驱动直接调用initdb/pg_ctl/psql，实际SQL由PostgreSQL执行。

## 数据隔离与生命周期

每次在操作系统临时目录创建全新的PGDATA和私有socket目录，用户atlas，端口固定 **55439**，仅监听127.0.0.1。现有5432完全不访问，不读取或修改现有数据库密码、表或配置。55439已占用则启动失败，不接管其他实例。两个专题共用这个演示端口，必须依次执行。

使用trust认证仅为本机隔离教学；不是公网部署建议。`finally`关闭自己启动的实例并删除自己的临时目录。不要用sudo运行，也不要把已有数据目录传给此测试。若操作系统强杀了测试驱动，可根据打印/进程信息定位atlas-pg-lab临时实例，仅清理该实例，不能对未知PGDATA执行删除。

## 实际结果与代码

`schema.sql`为完整业务代码，`harness.mjs`是隔离实例和多psql连接辅助，`test.mjs`包含完整场景。文章中也完整展示这些文件，避免读者跳出页面补关键实现。

2026-10-23，本机macOS、Node22.12.0、PostgreSQL17.4实际测试6个场景全部通过；Node测试报告把外层容器也计入，共7通过、0失败。没有用SQLite或内存Map代替PG行锁。首次initdb耗时与机器有关，测试总时长不能当SQL性能。

`worker.mjs`是实际子进程：认领后写attempt专属文件，再调用complete_job。故障开关`--crash-after-file`在文件写完而PG未完成时退出23。文件由测试创建的临时artifact目录承接，结尾清理。

场景与预期：

1. 两连接并发认领，SKIP LOCKED使第二连接返回空。
2. 当前租约可续；到期的旧owner不能续/完成；新token2接管，token1返回stale。
3. 同代次同结果重复完成返回duplicate，改结果conflict，effects只有1行。
4. 完成函数后故意除零，发布/记账/任务状态共同回滚。
5. 尝试额度用尽且最后一次崩溃，reap_exhausted将它置failed。
6. 真Worker写1-1.txt后崩溃；真正停止再启动PGDATA确认running仍在；将lease_until设为数据库过去时间作确定性故障注入；新进程产出1-2.txt并完成。磁盘上两份文件都存在，本库effects只有1行。

`effects`只是同库记账式教学记录，不是真实扣费。artifacts表是同库接受token检查的发布点，磁盘文件没有自动加入PG事务。旧文件需要对账清理；外部API不支持幂等/条件版本时，不能据本实验承诺端到端exactly once。没有实现生产调度器、自动续租循环、外部支付或对象存储。
