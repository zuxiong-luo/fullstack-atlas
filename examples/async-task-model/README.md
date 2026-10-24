# 异步任务模型：真实进程与持久化边界

固定环境：Node.js 22.12.0、PostgreSQL 17.4、pg 8.13.1。Node 依赖在 package-lock.json；另需 PostgreSQL 17 本机工具，不包含数据库发行包。

```sh
npm ci
npm test
```

默认 PG_BIN=/Library/PostgreSQL/17/bin；其他安装位置可在运行前设置 PG_BIN。夹具新建临时 PGDATA/0700 Unix socket，仅使用55448，不监听TCP，不连接用户5432。HTTP监听127.0.0.1随机端口。示例只运行自动化实验；api-child/worker-child 是父夹具管理的入口，不能脱离其私有配置独自启动。

预期 TAP tests 9 / pass 9（含父测试）：

1. 202返回queued，不代表计算完成；未认证401，坏输入422，同key不同输入409。
2. Worker领取后API退出；Worker继续自然退出；重开API可读succeeded/HELLO。
3. 提交前IPC屏障后SIGKILL：fetch失败，任务没有提交。
4. 提交后、202前屏障后SIGKILL：fetch失败，但同key能找回原id，表中仅一条。
5. Worker领取后SIGKILL：running保留；仅在确认本地自有子进程退出后演示人工重排。
6. mode=fail接受后最终failed/PROCESSING_FAILED。
7. 真实两连接：一条锁住行，另一条SKIP LOCKED不领取；解锁后可领取完成。
8. 10个并发意图只接受8个，另2个429。

jobs.mjs 是接受/领取/完成逻辑；schema.sql 定义持久状态；server.mjs 是真实HTTP；api-child.mjs/worker-child.mjs 是独立进程；processes.mjs 根据IPC/真实退出设置屏障，tests不靠sleep猜阶段。所有finally只清理自己创建的进程和数据。

边界：单共享教学身份/单队列，随机教学token，不使用本站口令；无租户授权、FIFO、自动心跳重领、取消和归档。active<=8不是历史行数上限。计算只有纯字符串变换；不证明邮件/付款等外部副作用一次性。COMMIT通信失败可能结果未知，应通过同业务key恢复。Linux部署、集群切换和生产容量未验；GitHub Pages不会执行这些服务，离线包只带源码，依赖须另装。

独立审稿后修正终态回放HTTP语义：queued/running保持202，succeeded/failed返回200，新增在现有真实HTTP场景中对两种终态回放断言。总测试仍9/9，不把成功取回任务等同业务成功。
