# PostgreSQL 17：MVCC、快照与旧版本清理

文章 `database-mvcc` 的真实双会话实验；无 npm 第三方依赖，无付费服务或现有数据库凭据。

## 运行

已验证：macOS 14.5 x86_64、Node.js 22.12.0、PostgreSQL 17.4。需要完整服务端安装。

```sh
cd examples/database-mvcc
nvm use
npm ci
PG_BIN=/Library/PostgreSQL/17/bin npm test
npm run check
```

`PG_BIN` 可改为其他 PostgreSQL 17 的 bin 目录；其他操作系统尚未实跑。每次创建独立临时 PGDATA，私有 socket，监听 **127.0.0.1:55441**，不连接现有5432，不读取密码。三个数据库实验必须顺序执行。端口占用启动失败；不接管已有实例。finally停止自己启动的服务、清理目录；强制杀进程/断电不保证执行finally。trust仅用于本机教学。

## 文件与同步方式

`schema.sql` 建账户和5000条版本实验数据；`test.mjs` 是完整验收；`harness.mjs` 管理隔离实例和长期psql会话。每个 session 是一条连接，`wait()` 等待实际 `\echo` 屏障；独立 `sql()` 返回表示写者语句已执行完成。不会用“睡一会儿大概就更新了”证明交错。

轮询存在期限，期限内必须实际观察到条件；它是故障保护，机器睡眠/进程暂停可能使测试超时。整套测试计时不代表SQL性能。

`verify-article.mjs` 核对正文映射源码是本项目连续原文；在独立 ZIP 找不到仓库文章时明确跳过，不伪报已核验正文。

## 验收输入与预期

7 个子场景全部通过，含父测试 **8 tests / 8 pass**：

- 初始余额10；读者先SELECT；写者独立提交20。RC原事务第二次SELECT是20，RR是10；结束后新连接都是20。
- RR事务自己的写99可被自己读取，ROLLBACK后回到已提交20。
- RR持有旧快照，写者提交21；旧读者更新同一行返回40001，最终仍21。
- 两位医生都在岗；双会话先读总人数2再分别下班。RR成功提交两笔、剩0人；Serializable按同样交错让一笔40001、剩1人。
- RR长快照先读5000条old，写者全部改new。VACUUM VERBOSE报告5000条旧版本尚不可移除；读者仍看见old。释放读者后再次VACUUM，不可移除旧版本数0，新连接可见5000条new。

最后一项仅为控制实验在 versions 表关闭 autovacuum，不建议生产关闭。测试明确检查 VERBOSE 的 stderr，未把 `n_dead_tup` 估计或文件大小当作精确版本证据。

## 范围

验证普通堆表可见性、隔离失败、写偏斜和清理边界。未验证复制槽、物理备库、热备反馈、故障转移、冻结参数调优。普通VACUUM空间复用不等于文件立即缩小；本项目不做VACUUM FULL。

参考：[隔离](https://www.postgresql.org/docs/17/transaction-iso.html)、[VACUUM](https://www.postgresql.org/docs/17/routine-vacuuming.html)、[系统列](https://www.postgresql.org/docs/17/ddl-system-columns.html)。
