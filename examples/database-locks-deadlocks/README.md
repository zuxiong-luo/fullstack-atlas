# PostgreSQL 17：真实等待、死锁和完整事务恢复

文章 `database-locks-deadlocks` 的独立实验。账户1和2初始均为100；A转10给2，B转20给1。成功各执行一次后余额为110、90，总额200。

## 环境与命令

已验证：macOS 14.5 x86_64 / PostgreSQL 17.4 / Node.js 22.12.0。需要 initdb、pg_ctl、psql 完整服务端安装，无 npm 第三方依赖。

```sh
cd examples/database-locks-deadlocks
nvm use
npm ci
PG_BIN=/Library/PostgreSQL/17/bin npm test
npm run check
```

harness只创建并连接本次临时PGDATA，私有socket，监听 **127.0.0.1:55441**。不读取密码，不连接5432。三套数据库实验必须顺序执行；占用端口时失败，不接管其他服务。结束及普通异常时finally终止自己创建的会话、停止实例并删除临时目录；强制杀进程/断电不保证finally。trust只用于本机教学。其他操作系统未实跑。

## 文件

- `schema.sql`：accounts、CHECK、move_funds完整函数。函数校验不同账户和正金额，升序锁定双方，检查两账户存在，再借贷。
- `test.mjs`：并发交错、真实观察、恢复与错误断言。
- `harness.mjs`：隔离实例和psql会话；VERBOSITY=verbose保留SQLSTATE。
- `verify-article.mjs`：仓库内核对正文真实代码节选；ZIP缺文章时明确跳过。

`transfer()` 中仅对可信整数夹具使用SQL插值以避免引入驱动。生产必须用驱动绑定参数，并验证金额、租户归属、币种和账户状态，不可拼接外部HTTP参数。

## 预期结果

7个子场景，含父测试 **8 tests / 8 pass**：

1. UPDATE未提交时，独立普通SELECT读到100；FOR UPDATE等待。确认pg_blocking_pids非空后才提交持有者，等待者获得90。
2. 已锁行NOWAIT报55P03；SKIP LOCKED只返回另一行2。
3. 读事务的AccessShare使AccessExclusive请求等待；结束读事务后请求取得表锁。
4. A持有1、B持有2，再相互请求。确认两条等待边都出现；数据库让恰好一个事务40P01。失败连接退出回滚，成功事务提交，只重放受害者的完整事务，余额110/90。
5. 双方从一开始都按id升序锁定，两笔转账均完成。
6. 缺失转出账户报22023，防止只加钱不扣款。
7. 余额不足触发23514，全部回滚，不按死锁策略重试。

`deadlock_timeout='2s'` 只为让测试有窗口观察两条边，不是生产建议，不是等待上限。受害者是谁不能预先假定。程序轮询数据库明确状态，有界等待不是靠固定sleep猜并发发生。

## 恢复边界

对数据库明确中止的40P01/40001，可从BEGIN起重新读取、判断并写入；本例最多3次，教学退避10/20ms。测试真实复现死锁，并在确认受害者回滚后重放整笔失败操作；不以本项目证明生产重试预算适宜。

COMMIT已成功但网络响应丢失属于不确定结果，不能无条件重放。本示例没有持久化业务幂等键，不解决外部支付、跨库转账、故障切换或“恰好一次”。无吞吐/尾延迟基准。

参考：[显式锁](https://www.postgresql.org/docs/17/explicit-locking.html)、[pg_locks](https://www.postgresql.org/docs/17/view-pg-locks.html)、[重试规则](https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html)。
