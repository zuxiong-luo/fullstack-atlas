# transactional-outbox：作者验证

2026-10-24，review；待独立审稿与站点验收。macOS14.5 x86_64，Node22.12.0，PG17.4，Redis server/cli7.0.4。

## 文件

`src/data/articles/tasks/transactional-outbox.ts`；`examples/transactional-outbox/`；`public/figures/transactional-outbox/windows.svg`；下载 `transactional-outbox/README.md`。

## 真实执行

```sh
npm test --prefix examples/transactional-outbox
npm run check --prefix examples/transactional-outbox
```

6子场景，Node含父测试7 pass / 0 fail；4块正文连续源码schema/relay/consumer/发布故障测试逐字匹配。

- 订单+意图同事务故意1/0，共同回滚为0；正常提交后订单1/待发1、Redis0。
- 发布者收到XADD成功后对自己SIGKILL。测试断言子进程信号，轮询数据库实际会话消失。Redis1/PG待发1；恢复relay后Redis2/已发1，再次无工作。
- 消费者本库SQL已提交后SIGKILL，余额10/PEL1；确认旧进程已死后重领duplicate，另一传输同业务也duplicate。余额10/inbox1/PEL0。
- 同事务消费后故意1/0，回执及效果都回滚。
- 同event改内容99报冲突，余额不变。
- 未提交记录不可读；提交后被另一行锁占用时SKIP LOCKED跳过，释放后成功发布。

故障后没有用sleep猜测；节点进程结果、echo屏障、系统视图和实际表/PEL共同证明。测试MIN-IDLE=0仅用于已确认死去的消费者。

PG只新建55442私有PGDATA/socket，Redis只新建56381私有AOF目录，均127.0.0.1，不连5432/6379。只杀自己relay/consumer，不杀broker/数据库/用户进程。结束停止自建服务并清理。生产与消费为同一教学PG实例的不同表和独立事务，不伪称跨两台库；Redis从未进入SQL原子边界。

金额上限、ID格式已与publisher/consumer一致后复跑全部通过。SQL插值只限严格约束的夹具，生产须绑定参数。

## 图形与来源

windows.svg经Quick Look真实完整渲染，检查两处故障位置、两份本库事务、不同Stream ID/相同event_id和最终10/1/0。逻辑示意，不冒充抓包或手机验收。

核对PG17 SELECT锁定/SKIP LOCKED、INSERT ON CONFLICT，Redis7.0.4固定命令与配置，AWS官方Outbox模式。一手来源用于追溯，正文给出关键完整代码。

## 限制

未验证DB/broker断电、复制多数确认、故障转移、跨机分区、RabbitMQ/Kafka、外部邮件/支付副作用或生产容量。中继持锁跨发布不是高吞吐方案；回执清理、CDC/租约、持续调度和死信未实现；不声称全链路exactly-once。正常AOF机制不能替代故障持久验收。站点、手机视口、ZIP和离线清单待主代理。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
