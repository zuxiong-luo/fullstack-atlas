# 秒杀后端：库存、原子预占与有界消费实验

这是文章配套的**可运行服务逻辑与受控实验**，不是生产商城。没有HTTP登录、真实支付、网关限流、长期worker守护或复制集部署。所有用户和活动均为虚构数据。

## 环境与运行

实际验证：macOS14.5 x64、Node.js22.12.0、PostgreSQL17.4、Redis7.0.4、pg8.13.1、node-redis4.7.0。精确npm依赖及传递依赖见package-lock.json。

```sh
npm ci --ignore-scripts
npm test
# tests 12; pass 12; fail 0
```

需要本机已有PostgreSQL17.4与Redis7.0.4二进制；PostgreSQL不能用root运行。PG_BIN默认`/Library/PostgreSQL/17/bin`，其他位置显式设置：

```sh
PG_BIN=/your/postgresql17/bin npm test
# Redis不在PATH时：
REDIS_SERVER=/your/redis-server npm test
```

夹具创建临时目录及私有PG Unix socket，端口标识55486、不监听TCP；Redis只监听自有127.0.0.1:56390。56390被占用时启动失败，不连接或关闭已有服务。不读取DATABASE_URL，不碰用户5432或6379，不执行FLUSHALL。测试结束停止自己的进程并清理；如果不能确认退出，保留目录并报错。Redis采用本地AOF/appendfsync always，只验证进程重启，不声称模拟断电或HA。

## 文件与阅读顺序

- schema.sql：数量不变量、活动用户唯一约束、请求结果、库存释放Outbox。
- lua.mjs：类型/参数检查后预占名额、登记用户和XADD；释放事件去重。
- service.mjs：Redis EVAL适配、事务连接所有权、订单/库存、支付/关闭及释放中继。
- worker.mjs：有界批次、有限并发、提交后ACK、pending重领及扫描游标。
- fixtures.mjs：仅供测试的临时PG/Redis生命周期和命令预算。
- test.mjs：11个子场景及父测试，共12项。

接口`admit(redis,sale,user)`接收已认证用户，返回RESERVED/EXISTING/SOLD_OUT/BUSY。RESERVED只表示预占和Stream事件已经执行，不代表订单已创建。`consume`处理新事件，`reclaim`恢复pending；成功结果在attempts中按预占UUID记录，真正的订单在orders中。

示例的redis参数提供`command(...args)`，夹具通过node-redis.sendCommand发送；生产应替换为自有连接、鉴权、总预算和可观测性管理。不要把HTTP请求体中的userId直接传入信任边界。

## 实际验证内容

1. 错误GET/DECR：初始1，两个GET先完成，最终-1。
2. Lua最后一件：16个不同用户只有1个新预占；重复返回原ID，事件仍1条。
3. 筛选与消费：20人5件，生成5个事件与5单；屏障实检默认并发峰值2。
4. 数据库锁：pg_blocking_pids确认B等待A，A提交后B更新0行。
5. 回滚与唯一性：受控提交前异常整体回滚；同请求/同用户重复只扣一次；同ID换身份拒绝。
6. Redis/DB偏差：Redis发出资格但DB库存0，记录SOLD_OUT，不生成订单。
7. 历史容量：上限1时第二人BUSY，不扣名额也不登记用户。
8. 提交后未ACK：故意抛错、真正停止/重启Redis，重领pending后仍只有1单，pending归零。
9. 支付和关闭：竞争待支付状态，恰好一个成功；重复操作不再移动库存。
10. 释放中继：Redis已加回但DB未标记，重放不多加；原用户不能再次参与，新用户可以。
11. Lua边界：错类型在写前拒绝；刻意运行时错误证明此前DECR不自动回滚。

测试使用Promise屏障、数据库阻塞状态和明确已结束的处理器，不靠随机sleep判断竞态。20人5件不是压测，不能推出吞吐、QPS或生产池大小。

## 固定业务与未交付边界

单活动、每人一件、一人一张订单（关闭后本人不重买）、无补货退款。支付函数仅模拟已核实的支付消息；CLOSED收到成功通知不复活库存，真实支付需验签、金额/商户校验、关单、对账和退款。过期通过测试修改expires_at触发，未实现持久超时调度器。

每批最多32个事件，一次调用并发默认2、最多8；多个调用和多个进程合计并发需要部署统一限制。XAUTOCLAIM不会停止旧worker；idleMs=0仅用于已确认旧处理结束的测试。未交付自动长期循环、毒消息退避/死信或多副本全局限流。

XLEN上限128限制**保留历史总量**，不是ready长度；ACK不删历史，多轮取消后可能有库存但拒绝新任务，需要生产保留/清理策略。绝不能通过删除未完成事件伪装解决积压。

Lua不是SQL回滚事务。类型校验不能覆盖OOM等写入阶段失败；Redis复制丢失、库存键或去重键丢失后的重建需停止准入、核对权威数据并区分活动代际，不能直接重设库存再重放旧释放事件。本例不承诺这些生产故障已恢复。
