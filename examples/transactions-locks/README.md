# transactions-locks：独立PostgreSQL教学环境

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

场景与预期：

1. 两会话先读1再各设0，最终库存0但订单2，暴露错误不变量。
2. 条件扣减竞争：A持有行写锁；实际系统视图确认B等待Lock后，A提交，B报告INSUFFICIENT_STOCK，库存0订单1。
3. purchase后执行1/0，事务失败，库存回1、订单归零。
4. 同键同sku返回duplicate且只扣一次，同键不同sku冲突。
5. Repeatable Read写偏斜：两医生都从值班退出，最终0。
6. 同交错Serializable一方序列化失败，最终仍1人；应用需重试整个决策事务。

不包括真实支付、outbox、生产连接池、复制/故障转移或吞吐基准。幂等键全局唯一、业务输入仅sku，真实系统需加入用户/租户、数量、金额等全部语义。
