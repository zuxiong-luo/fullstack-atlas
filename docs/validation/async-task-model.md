# async-task-model 验证记录

日期：2026-10-24。作者自验，状态待独立审校。正文约4462个段落字符，5块关键代码均为真实文件连续原文；未修改共享聚合/index。

## 实际环境和执行

macOS14.5；Node v22.12.0；postgres (PostgreSQL)17.4；pg8.13.1锁文件。

```sh
npm ci --prefix examples/async-task-model --ignore-scripts --no-fund
npm test --prefix examples/async-task-model
npx tsc -b --pretty false
```

清洁npm ci安装13依赖、audit0；实际测试9/9（含父测试），tsc退出0。开发首轮8/8，后增加真实SKIP LOCKED双连接检查后9/9，不以父测试凑业务场景数。

## 行为证据

- 实际fork API/Worker两个独立Node进程，HTTP随机loopback端口，私有PG55448 Unix socket，PG无TCP监听，不连5432。
- 202当时queued/resultnull，未认证401、非法输入422、相同key不同输入409。
- Worker进入claimed IPC屏障后，停止API；允许Worker执行并等待正常退出0，重新API读取succeeded/HELLO。
- API在提交前IPC屏障后真实SIGKILL，fetch失败、查库无任务；提交后202前SIGKILL，fetch失败但任务已存在；同key返回原id，count1。
- Worker领取后SIGKILL，running持久保留；确认自有子进程已经退出后才手工重排指定id/worker，替代Worker完成。没有自动心跳/重领实现。
- modefail先202后failed/PROCESSING_FAILED。
- 一真实连接行锁阻塞唯一queued行，另一连接SKIP LOCKED不领取；回滚后能领取。
- 10个并发请求，8个202/2个429，活跃任务行数8。
- finally清理只属于夹具的进程/池/临时PGDATA；55448无残留。测试是状态断言，不以总时长证明性能。

## 正文/图/出处

schema、accept、claim、execute、提交故障测试5块连续映射通过；下载路径无examples前缀。SVG XML解析通过；QuickLook实际渲染并人工查看，文字/箭头无明显溢出，图中的提交前后故障及running边界与代码一致。为避免QuickLook裁切，临时副本扩画布，原SVG未变。没有做文章浏览器或手机视口验收，待主代理。

核对RFC9110 §15.3.3；PG17 SELECT SKIP LOCKED和事务级advisory locks；Node22.12官方child_process.fork。实际引用均在正文附近及references。

## 限制

单教学身份、随机fixture凭证，不证明多租户授权。无FIFO、自动崩溃恢复、取消、终态归档或外部副作用一次性。COMMIT通信失败仍可结果未知，本地布尔值不能证明未提交。只测自有本机进程，不证明Linux守护部署、K8s、主从切换、生产吞吐。离线资料含源代码，服务运行依赖要另装。ZIP/全站离线/路由/手机/发布由主代理统一验收，作者未提前宣称通过。

独立审稿后修正终态回放HTTP语义：queued/running保持202，succeeded/failed返回200，新增在现有真实HTTP场景中对两种终态回放断言。总测试仍9/9，不把成功取回任务等同业务成功。
