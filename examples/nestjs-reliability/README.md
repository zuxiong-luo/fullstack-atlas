# nestjs-reliability

本章租户笔记服务的独立阶段入口。虚构数据tenant-a/alice、tenant-a/bob、tenant-b/bob；演示固定令牌不具备签发/过期/撤销能力，不是生产认证。

## 环境与安装

Node.js **24.14.1**，NestJS **12.2.0**，TypeScript **5.7.2**，RxJS **7.8.2**。 PostgreSQL **17.4**，TypeORM **1.1.2**，@nestjs/typeorm **12.0.2**，pg **8.23.1**。

```sh
npm ci --ignore-scripts
npm test
npm run build
npm start
```

每个ZIP包含自己的源文件、package-lock和测试，不依赖相邻章。HTTP服务打印随机loopback端口；网站的固定4173端口不受影响。Ctrl-C关闭自己的演示。

PG_BIN默认`/Library/PostgreSQL/17/bin`；其他环境把PG_BIN设成PG17.4二进制目录。initdb不能由root运行。测试和start创建临时私有PGDATA，拒绝占用的55482，只绑定127.0.0.1。不会访问、关闭或改写用户5432数据库。演示退出会删除自有数据，不适合作为生产持久化启动器。

start先确认构建已存在。app本身要求DATABASE_URL指向启动器创建的atlas/127.0.0.1:55482/postgres；不要把真实业务URL填入本项目。`synchronize:false`；schema.sql只用于这份自有空库，生产演进应审查迁移。

正常finally按自有PGDATA查询状态再停止和删除。启动超时后仍运行也会回收；状态未知或停止失败则保留目录并报错，不删除可能运行中的数据库。`NEST_PG_COMMAND_MS`默认20000ms、范围100..20000，只用于夹具命令预算；安全单测用自制假工具测试超时/状态未知/停止失败，不把假工具结果当SQL证明。

## 手动输入

Bearer alice-demo POST /notes/from-upstream {"title":"preview"}；POST /jobs带Idempotency-Key: key-one和同样DTO。任务公开只返回id/status/resultId；内部DurableJobs.runOnce持有任务Promise，HTTP不自动启动隐藏worker。

## 实测结果

2026-10-25，macOS14.5，Node24.14.1，PG17.4。`npm test`成功：**3/3夹具安全单测 + 4/4真实网络/PG契约测试**。

普通Promise在RxJS超时后仍执行；真实上游预算及客户端断开导致连接close且无DB写；PG advisory barrier证明事务进入后取消仍提交；同键并发一份job，重启恢复/旧token拒绝/毒任务3次failed/第3次领取崩溃过期回收。

## 范围与限制

只验证Express适配器、当前锁定版本、自有loopback环境；没有生产流量、真实身份平台、真实密钥、TLS、编排滚动发布或任意外部系统exactly-once证据。网页和离线包包含源码，服务端项目依赖仍需在本地安装。

取消预算仅传给上游fetch；事务入口后的取消不能撤销PG提交。waitOnDatabaseLock是仅供测试的屏障配置；旧token在另一个owner替换后失效，租约过期本身只使任务可重领。worker只在同一PG事务内产生业务副作用，不声称外部API exactly-once。
