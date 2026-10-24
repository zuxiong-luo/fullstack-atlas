# database-locks-deadlocks：交付与验证记录

状态：待独立审稿、待站点浏览器验收，文章 `review`。

## 交付

正文 `src/data/articles/data/database-locks-deadlocks.ts`；示例 `examples/database-locks-deadlocks/`；下载 `database-locks-deadlocks/README.md`；图形 `public/figures/database-locks-deadlocks/wait-graph.svg`。

## 实际验证

2026-10-24，本机macOS14.5 x86_64、PG17.4、Node22.12.0。

```sh
npm test --prefix examples/database-locks-deadlocks
npm run check --prefix examples/database-locks-deadlocks
```

7子场景，含父测试8 pass / 0 fail。4块正文映射源码连续逐字一致。

- A更新但未提交，普通读返回100；B锁定读阻塞。观察 `wait_event_type=Lock`、本机 `wait_event=transactionid`、pg_blocking_pids非空后，才结束A；B获得90。
- NOWAIT 55P03；SKIP LOCKED只返回2。
- AccessShare读事务阻塞AccessExclusive请求；实际观测后释放，独占表锁获得。
- 逆序转账：先分别持有一行，再实际观测双方blocking边。检测器中止恰好一笔40P01；总额200；只重放已明确回滚的受害事务，余额110/90。
- 统一按id升序锁定，两个反向转账都完成。
- 缺转出账户22023，无凭空加钱。
- 不足余额CHECK 23514，不被当死锁重试，无部分写入。

死锁测试的deadlock_timeout=2s只是提供观察窗口；不是生产推荐，不是锁等待上限。轮询条件明确、有界。自动重试代码支持40P01/40001最多3次；本次真实死锁先在测试中明确辨别受害者、确认事务回滚，再整笔重放。未用无限重试掩盖死锁。

私有PGDATA/socket、固定55441，结束finally清理。最后lsof无监听。机器/会话发生暂停，Node总duration因此不适合引用；不发布性能结果。

## 图形与正文检查

等待环两箭头方向、持有行、先后顺序和最终资金一致；Quick Look完整渲染人工查看。原生横向缩略图裁切，使用/tmp方形视口包装检查完整图；正式文件保留1120×620。没有将此当作站点手机验收。

正文展示初始化、观察SQL、受控死锁关键路径、完整move_funds与重试函数，并说明参数绑定/可信整数插值差异。ROW_COUNT检查防止不存在转出账户时单边加钱。普通MVCC读/锁定读/表锁分开说明。

## 来源

核对PostgreSQL17 `explicit-locking.html`、`view-pg-locks.html`、`functions-info.html`、`monitoring-stats.html`、`mvcc-serialization-failure-handling.html`。

## 限制

未测试外部支付、跨库事务、网络COMMIT响应丢失后的幂等、生产连接池、主从切换、全部外键/触发器锁路径；未宣称统一顺序消除一切死锁。站点浏览器、下载及离线包等待主代理整合。
