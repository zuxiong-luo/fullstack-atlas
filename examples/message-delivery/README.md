# Redis Streams：投递、PEL、ACK与业务幂等

对应 `message-delivery`。所有命令仅连接新建的私有Redis **127.0.0.1:56381**，不连接用户6379。不要与Outbox项目同时运行。

## 环境与执行

已验证macOS14.5 x86_64 / Node22.12.0 / redis-server和redis-cli **7.0.4**。无npm第三方依赖。

```sh
cd examples/message-delivery
nvm use
npm ci
redis-server --version
redis-cli --version
npm test
npm run check
```

可用REDIS_SERVER/REDIS_CLI指定对应可执行文件；端口固定隔离，不允许指向现有实例。版本检查锁定7.0.4，不把最新Redis新增的CLAIM等选项带入旧版实验。其他OS/Redis版本未实跑。

## 文件

`redis.mjs`创建私有临时Redis/AOF，封装真实CLI，并实现完整原子apply；`worker.mjs`为一次消费的真实子进程；`test.mjs`控制退出与恢复；verify脚本核对正文源码连续原文，独立ZIP无文章时明确跳过。

CLI7 `--json` 的XREADGROUP返回按流名分组对象，辅助同时能读取数组格式；INFO即使--json也返回文本，单独处理。不是用虚构Redis内存替身。

## 输入与预期

Stream=events、group=workers；业务event=order-42、amount=10。Stream ID是传输记录身份，event是业务去重身份。6个子场景，含父测试 **7 pass / 0 fail**：

1. Worker读后以23退出；PEL1。另一个消费者的 `>` 不取得旧pending；XAUTOCLAIM取得同一ID，完成后XACK返回1，重复XACK0，PEL0而XLEN仍1。
2. 先ACK再退出，效果没做：PEL0、重领空、无计数，原流仍1。这是漏做窗口。
3. 先朴素INCRBY再退出，重领再次INCRBY，最终20。这是重复效果窗口。
4. 原子回执版本效果后退出；正常重启AOF实例，重领返回duplicate；同业务另一个Stream ID仍duplicate，最终10，PEL0。
5. 同event换amount99冲突，保留pending且计数不变。
6. 两消费者各领一条，先完成second再first，完成顺序可以反转；本例加法最后3。

min-idle-time=0仅因已等待原进程确实退出。生产阈值不能无视仍活跃的慢Worker。没有用sleep猜消息已经读取；进程退出码和Redis状态提供证据。

## 原子边界与持久化

回执与计数都在同一个Redis Hash，Lua先校验，再以一条HSET写回执/结果。Lua不提供任意错误后的自动回滚。本例只是小整数计数，不用于超大数值金融账本；外部邮件、支付、其他数据库不在同一原子边界。

Redis用临时目录、AOF、appendfsync always。启动先确认自己进程的Ready日志，再发命令；端口占用会失败，不会连接已有服务后FLUSHDB。结束只停止自己子进程并删除私有目录。强杀整个测试/断电不保证finally，需人工检查残留。

只验证正常停启AOF恢复，不证明断电持久/复制故障转移。未验证RabbitMQ、Kafka、Redis集群、死信队列、Linux/原生设备或生产性能。PEL冲突保留供排查，不无限重试。

参考：[Redis7 XREADGROUP](https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xreadgroup.json)、[Redis7 XAUTOCLAIM](https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xautoclaim.json)、[XACK](https://redis.io/docs/latest/commands/xack/)。
