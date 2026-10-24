# PostgreSQL Outbox + Redis Streams：真实崩溃窗口

对应文章 `transactional-outbox`。实际macOS14.5 x86_64 / Node22.12.0 / PostgreSQL17.4 / Redis server/cli7.0.4。无npm第三方依赖。

```sh
cd examples/transactional-outbox
nvm use
npm ci
redis-server --version
redis-cli --version
PG_BIN=/Library/PostgreSQL/17/bin npm test
npm run check
```

需要PostgreSQL完整服务端initdb/pg_ctl/psql。PG_BIN可指定17版本bin目录；REDIS_SERVER/REDIS_CLI可指定7.0.4执行文件。其他OS未实跑。

## 隔离边界

只创建私有PGDATA/socket，PG监听 **127.0.0.1:55442**；Redis临时AOF实例监听 **127.0.0.1:56381**。不连接5432/6379，不读取用户凭据。不得与message-delivery并行使用56381；端口占用启动失败，不接管其他服务。

发布与消费为同一临时PG实例的不同逻辑表和独立事务；没有假装测试跨两台PG或分布式事务。Redis始终不在SQL事务里。只杀本测试创建的relay/consumer子进程，绝不杀数据库或用户服务。

## 文件与运行规则

- `schema.sql`：orders+outbox共同提交；inbox+wallet共同提交，amount=1..999999。
- `relay.mjs`：行锁领取→XADD→published_at；`--once --crash-after-publish`在确认XADD后SIGKILL自己。仅由测试在私有实例启动，不应手工对现有库运行。
- `consumer.mjs`：consume_event本库事务→XACK；`--once --crash-after-commit`在确认数据库提交后SIGKILL自己。
- `postgres.mjs`、`redis.mjs`：独立服务及真实CLI，不是数据库模拟器。
- `test.mjs`：故障控制与状态证据；verify脚本核对正文连续源码。

事件order-42-created、amount10。Stream ID每次XADD可不同，业务event_id必须保持相同。SQL插值仅限代码已严格约束的可信夹具，生产驱动绑定参数。

## 预期：6子场景 / Node含父测试7 pass

1. place_order后同事务故意1/0，订单与outbox都0；正常提交后订单1/待发1而Redis仍0。
2. 发布者XADD后SIGKILL；观察pg_stat_activity中该会话确已消失，Redis1/待发1。恢复发布后Redis2/已发1，再跑无工作。
3. 消费者本库提交后SIGKILL，wallet10/PEL1。确认进程已死后XAUTOCLAIM零阈值重领，回执duplicate；另一条同事件传输也duplicate。最终wallet10/inbox1/PEL0。
4. consume_event后同事务1/0，效果和inbox一起回滚。
5. 同event_id改金额99拒绝，不重复或覆盖原余额。
6. 未提交outbox不可读；提交但被另一会话行锁占用时跳过，释放才发布。

读取屏障、子进程SIGKILL结果、数据库连接回收、PEL和表状态是证据，不靠固定sleep猜故障发生。零重领阈值只在确认旧消费者已死时使用。

## 清理与限制

结束后停止自己的Redis和PG，清理私有数据/AOF目录。强杀整个测试或断电不保证finally；正常测试未杀broker/数据库，未验证它们断电持久。

中继发布期间持有行锁，生产需预算连接、锁和broker等待；SKIP LOCKED不保证全局顺序。Redis单节点AOF always不等于复制多数确认。若确认后broker最终丢数据，需要额外对账/重放协议。

无HTTP下单幂等接口、持续守护调度、死信产品、生产监控或自动回执清理。Inbox只保护本数据库效果，不能自动保护邮件/支付。没有RabbitMQ/Kafka、集群、跨机分区或exactly-once保证。

参考：[Outbox模式](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)、[PG17锁定查询](https://www.postgresql.org/docs/17/sql-select.html)、[PG17唯一冲突](https://www.postgresql.org/docs/17/sql-insert.html)。
