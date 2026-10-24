# 并发协调：真实配额、租约与 fencing

固定环境：Node.js22.12.0、PostgreSQL17.4、pg8.13.1、Redis server/cli7.0.4。依赖锁定于package-lock.json，数据库工具需本机另装。

```sh
npm ci
npm test
```

PG_BIN 默认 /Library/PostgreSQL/17/bin，可覆盖；REDIS_SERVER/REDIS_CLI可指定可执行路径。PG只用新建临时PGDATA、0700私有Unix socket55449，不监听TCP；Redis只绑定127.0.0.1:56383，使用自己的临时AOF数据。绝不访问用户5432/6379；端口冲突先停止实验查明，不能改接用户实例。

预期 tests9/pass9（含父测试）：

- 正确owner+token才能续期/释放。
- 六个独立连接竞争，同资源仅一租约胜者。
- 轮询真实数据库时钟确认到期，B接替；旧A不能续/删B资格，但可覆盖无保护资源。
- B的新token先被资源接受，旧A的条件写被拒；同B token再次写仍成功，因此不是幂等去重。
- token超过MAX_SAFE_INTEGER仍保留字符串9007199254740993，不转Number。
- 十次真实Redis Lua配额调用仅三次允许，计数保持3；不同主体独立。
- 真实Redis键到期后窗口重新允许3次，不按sleep猜过期。
- 停掉自有Redis时配额拒绝，恢复后成功；非法配置/超bigint token拒绝。

coordination.mjs 包含原子Lua配额、PG租约签发/续期/释放、资源条件写。发行编号必须在同一权威资格转移操作中完成；不能先Redis抢租约再独立补领PG序号。fenced_resources用同库表演示资源端原子判断，实际外部资源也必须支持拒旧条件；应用自查不能替代。

期限在DB clock_timestamp上判定，权威时钟跳变会影响接替；Redis窗口依赖其真实过期。测试轮询仅等待实际状态，不以墙钟耗时推导性能。资源只拒绝比其已接受最大代次更旧的写；更高代次尚未到达资源之前，旧token仍可能写入。同token不是一次性标识，token不是授权秘密，禁止公共调用者伪造更大编号。

未验证Redis Cluster、主从切换、数据库恢复后编号单调性、网络分区、外部支付/文件服务、Linux部署和生产性能。实际部署必须禁止序列回退/循环，并设计权威失效/脑裂与持久化策略。依赖故障本例fail closed；不能悄悄fail open后仍称全局限流。
