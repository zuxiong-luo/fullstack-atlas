# distributed-coordination 验证记录

日期2026-10-24。作者自验，状态待独立审校。正文约4467个段落字符，5块实际源码连续摘录。

## 实际环境/命令

macOS14.5，Node22.12.0，PG17.4，pg8.13.1，redis-server/redis-cli7.0.4。

```sh
npm ci --prefix examples/distributed-coordination --ignore-scripts --no-fund
npm test --prefix examples/distributed-coordination
npx tsc -b --pretty false
```

清洁npm ci安装13依赖，audit0。实际9/9通过（含父测试），tsc退出0。首版8/8后增加六连接租约竞争，正式9/9。真实500ms窗口，不用sleep模拟时间或凭运行时长推导性能。

## 真实行为

- 自建PG临时数据目录，55449私有Unix socket、不监听TCP；自建Redis临时AOF127.0.0.1:56383。未访问5432/6379。
- 活租约排斥另一持有者；错误owner续期false/错误token释放false，正确者true。
- 六个独立连接调用同resource acquire，恰一返回租约。
- 真实DB查询clock_timestamp>=expires_at后B接替，B.token>A.token；A续期/释放false。无fencing资源仍被A stale覆盖。
- 资源先接受B，新token保存；旧A写返回false，值保持B new；同B token再次写成功B again，因此不是幂等。
- 序列setval后申请得到精确字符串9007199254740993，超过MAX_SAFE_INTEGER但未转Number。
- 十个真实Redis EVAL并发调用，恰三allowed，计数3；不同subject独立。
- 500ms窗口前三允许第四拒绝，轮询真实EXISTS直到0后另三允许，计数3。
- 停掉自有Redis，配额调用拒绝；启动后新主体成功；非法键、limit0、超PG bigint输入拒绝。
- 所有PG/Redis进程及临时目录finally清理，无55449/56383残留。

## 核对范围

官方PG17行锁、序列语义；Redis Lua/EVAL与PTTL官方说明；Redis7.0.4 t_string.c固定版本；Mike Burrows的Chubby原论文§2.1/§2.4，实际读取PDF sequencer说明。正文是本仓库教学实现，不冒充Chubby源码/共识协议。

schema、配额Lua/函数、acquire、renew/release、fencedWrite共5块连续原文映射通过。图XML解析通过，QuickLook实际渲染人工检查，时间顺序、拒绝位置、最大已接受token说明对应代码。未做真实浏览器和手机视口，待根统一验收。

## 明确限制

配额仅单Redis权威，故障fail closed；窗口边界允许两批，非滑动窗口。Lua原子执行不意味着遇错自动回滚。租约期限依赖DB权威时钟；单PG权威内签发token，不把先Redis租约后独立序列拼成原子协议。sequence回退/恢复旧备份/脑裂/切换持久化未验。fencing只拒绝低于资源已接受最大值的代次；同token可重复写，token不是权限秘密。本地同库资源表代表资源端条件写，不证明外部支付/文件服务、RedisCluster、网络分区、Linux生产部署。ZIP/离线/全站浏览器由主代理另验。
