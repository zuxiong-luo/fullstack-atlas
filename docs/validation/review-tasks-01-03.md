# 任务系统第1～3篇独立审校

2026-10-24，独立审稿者：expansion_node。只读正文、源码和图形，问题由原作者修改。复核范围：message-delivery、retry-timeout-cancellation、transactional-outbox。当前发现的正文结果分类问题已修正，范围内未发现剩余发布阻塞。

## 真实复现

macOS14.5 x64；Node.js22.12.0；Redis server/cli7.0.4；PostgreSQL17.4（`/Library/PostgreSQL/17/bin`）。先确认55442和56381没有监听。Redis消息与Outbox顺序运行，未同时争用56381，不接触用户5432/6379。

```sh
npm test --prefix examples/message-delivery
npm run check --prefix examples/message-delivery
npm test --prefix examples/retry-timeout-cancellation
npm run check --prefix examples/retry-timeout-cancellation
npm test --prefix examples/transactional-outbox
npm run check --prefix examples/transactional-outbox
```

- 消息：6个真实Redis子场景，Node含父测试 **7/7**。读后退出留下PEL；先ACK漏做；效果后崩溃导致朴素计数20；Lua回执版本正常AOF停启后重领仍10；内容冲突保留pending；完成顺序可反转。
- HTTP：1纯决策+9真实loopback子场景，Node含父测试 **11/11**。503有限恢复、400单次、Retry-After超预算停止、真实预算/父取消/退避取消、丢响应POST、稳定键回执、409内容冲突与4096字节上限。
- Outbox：6个真实PG+Redis子场景，Node含父测试 **7/7**。订单和意图共同回滚；XADD后中继SIGKILL；数据库提交后消费者SIGKILL；Inbox与业务效果共同回滚；同ID不同内容拒绝；未提交不可见与行锁SKIP LOCKED。
- 三份源码核验分别 **3/3/4块**，正文是对应真实文件的连续原文。运行后55442和56381均不再监听。

不是模拟Redis或PostgreSQL。测试只杀自建relay/consumer，不杀broker/DB或用户进程；真实故障证据来自子进程信号、数据库会话回收、表状态和PEL，而非固定sleep猜测。

## 机制与原子边界

1. Stream ID是传输身份，event/event_id是业务去重身份；XACK移出组PEL，不删除流记录。`>`不替其他消费者恢复旧pending。XAUTOCLAIM是所有权转移，不保证旧Worker已停止；零阈值仅用于确认原进程退出的受控测试。
2. Lua回执与计数位于同一Hash，以最后一次HSET共同写入；脚本不提供任意失败自动回滚。正文明确小整数精度与外部邮件/支付不在原子范围。AOF只正常停启，未宣称断电和复制故障证明。
3. 重试先看业务重放契约；GET/HEAD仍依赖上游遵守HTTP语义。总预算包含读体和等待，父取消保留reason；计时器合作式，不是抢占式硬期限。服务端Map回执是进程内演示，未称持久化协议。
4. Outbox中orders+outbox是一份本地事务，inbox+wallet是另一份。Redis发布/确认没有加入SQL事务。持锁跨broker发布的连接与锁成本、重复发布、事件顺序和回执保留限制均明确。
5. Inbox唯一约束后比较内容，缺钱包抛错回滚回执；SQL拼接只用于严格约束的可信夹具，生产应绑定参数。没有把单库钱包证明扩大为外部副作用或全链路exactly-once。

## 已发现并修正的问题

原retry正文把无契约POST的未知传输结果概括为RESULT_UNKNOWN，范围过宽。代码优先返回TOTAL_BUDGET或父取消reason，而请求仍可能已经提交。

独立补充真实HTTP探测：先warm fetch；无契约POST到达上游即effects++，延迟3秒返回；客户端budgetMs=1000、attemptMs=2000。实际观察：`{"code":"TOTAL_BUDGET","message":"TOTAL_BUDGET","effects":1}`。第一次100ms试验在fetch真正发出前就耗尽，effects=0，因此未把它当作“已提交”证据；改用明确到达的1000ms样本才得出结果。

作者已修正文与README：RESULT_UNKNOWN限于父未取消、预算尚未耗尽的网络/单次超时分支；TOTAL_BUDGET和用户取消只是停止原因，请求可能已发后仍须另记业务结果未知、查询同意图，不能换新键重复写。独立复读确认与代码分支一致。代码没有变化，原11项和源码映射仍有效。

## 图形与版本依据

阅读SVG源码、标题/说明，并逐张查看作者Quick Look完整渲染预览：`/tmp/atlas-data-figure-review/{message-delivery,retry-timeout-cancellation,transactional-outbox}-square.svg.png`。检查流记录/PEL/ACK、预算回环与两份本地事务，标签无明显溢出，箭头及故障位置与代码相符。这是像素复读，不是站点或手机浏览器验收。

核对一手资料：

- [Redis7.0.4 XREADGROUP](https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xreadgroup.json)、[XAUTOCLAIM](https://raw.githubusercontent.com/redis/redis/7.0.4/src/commands/xautoclaim.json)：没有把较新CLAIM选项写进7.0.4实验，7.0返回增加被清理ID列表。
- [Redis Lua执行说明](https://redis.io/docs/latest/develop/programmability/eval-intro/)：原子执行与脚本成本；正文没有承诺错误回滚。
- [RFC9110](https://www.rfc-editor.org/rfc/rfc9110.html)：幂等含义与Retry-After；[Node22.12 AbortController](https://nodejs.org/download/release/v22.12.0/docs/api/globals.html#class-abortcontroller)：组合取消与reason。
- [PG17 SELECT](https://www.postgresql.org/docs/17/sql-select.html)、[INSERT](https://www.postgresql.org/docs/17/sql-insert.html)：SKIP LOCKED与唯一冲突边界。
- [AWS官方Outbox说明](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)：本地业务/意图与重复消费边界。

## 尚未覆盖

未重复声称Linux、真机、跨机网络分区、broker/DB断电、复制切换、生产负载或外部支付验证；本轮复现是本机真实隔离服务与教学子进程崩溃。站点路由、手机视口、下载ZIP和离线包由主代理整合验收。
