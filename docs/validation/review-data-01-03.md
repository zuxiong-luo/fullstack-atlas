# 数据库第1～3篇：Python作者独立交叉审校

审稿日期：2026-10-24。角色：Python专题作者。只读数据库作者的文章、示例与SVG；仅新增本审校记录，未修改数据库文章/代码/图形。结论：**本次范围未发现阻断性问题，三套真实实验独立复现通过**；手机与站点集成仍由统一发布验收负责。

## 实际阅读与事实核对

完整阅读三篇：`src/data/articles/data/database-indexes.ts`、`database-mvcc.ts`、`database-locks-deadlocks.ts`；对应目录下README、schema.sql、test.mjs、harness.mjs、verify-article.mjs、版本/包文件；以及三张正文引用SVG源文件。

按文章自己的输入、事件交错、状态变化、断言和失败路径检查概念递进，而不只按标题或节数验收。另实际浏览PostgreSQL17官方文档：

- [多列B-tree](https://www.postgresql.org/docs/17/indexes-multicolumn.html)：前导等值/首个非等值范围，后列条件与缺前导键的扫描边界。
- [Index-Only Scan](https://www.postgresql.org/docs/17/indexes-index-only-scans.html)：覆盖列与快照可见性、可见性映射的分别作用。
- [事务隔离](https://www.postgresql.org/docs/17/transaction-iso.html)：RC/RR快照、自身写入、SSI与40001。
- [显式锁](https://www.postgresql.org/docs/17/explicit-locking.html)：表/行模式、等待、死锁与统一顺序。
- [VACUUM](https://www.postgresql.org/docs/17/routine-vacuuming.html)、[系统列](https://www.postgresql.org/docs/17/ddl-system-columns.html)：版本回收、空间复用与xmin/xmax/ctid边界。
- [pg_locks](https://www.postgresql.org/docs/17/view-pg-locks.html)、[事务重试](https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html)：行锁观察限制与重做完整决定。

## 独立执行

实际环境：macOS14.5 x86_64，`node --version`为**v22.12.0**，`/Library/PostgreSQL/17/bin/psql --version`为**17.4**。无第三方npm依赖。先确认上一个实例测试结束，才启动下一套；三套均创建自己的临时PGDATA，只用独占的127.0.0.1:55441，未触碰5432。

按下列目录顺序，在各自目录执行相同命令：

```sh
PG_BIN=/Library/PostgreSQL/17/bin node --test test.mjs
npm run check
```

| 顺序/目录 | 真实node:test结果 | 独立观察 |
| --- | --- | --- |
| 1 `examples/database-indexes` | **6 tests / 6 pass / 0 fail** | 原计划Limit/Gather Merge/Sort/Seq Scan；联合索引后Index Only Scan返回20行、Heap Fetches0；更新后40；再VACUUM回0；广范围paid查询Seq Scan；表达式索引被选择 |
| 2 `examples/database-mvcc` | **8 tests / 8 pass / 0 fail** | RC读取10→20，RR读取10→10，新连接20；自身写99回滚；RR旧写40001；RR写偏斜剩0/SSI剩1；持有旧快照5000个旧版本不可清理，释放后0 |
| 3 `examples/database-locks-deadlocks` | **8 tests / 8 pass / 0 fail** | 普通SELECT读旧值100，FOR UPDATE确实Lock/transactionid等待；NOWAIT55P03/SKIP LOCKED只返回2；表锁等待；观察双等待边后恰一40P01；只重放失败事务后110/90；升序锁定、22023缺账户、23514余额约束均通过 |

三套 `npm run check` 退出0，语法检查通过，各自报告**4个文章真实源码节选匹配**，共12块。核对的是连续原文，不把正文另写SQL教学片段误作项目原文证据。最后定向TypeScript检查：

```sh
./node_modules/.bin/tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --skipLibCheck src/data/articles/data/index.ts
```

结果无诊断。最后 `lsof -nP -iTCP:55441 -sTCP:LISTEN` 无输出（退出1表示无匹配监听者），实验端口已释放。未以测试总耗时推导SQL性能。

## 推导、代码与边界的一致性

### B-tree访问路径

从堆表/独立索引定义进入联合键顺序，再以租户42、paid、日期下界和最近20条解释为什么等值前缀加有序后缀可省排序。完整输入、建表、查询、候选索引与真实计划解析在正文可见。INCLUDE作为负载列、Index Only Scan仍可能有Heap Fetches、缺租户不代表语法上禁止用索引、表达式与普通键不同，都有解释或反例。20万确定性样本和本机40次堆获取没有冒充一般性能公式。未混用InnoDB聚簇主键。

### 快照与清理

版本存在和版本可见分开说明，避免把快照当全表复制。RR首次非事务控制语句而非BEGIN时建立的关键前提明确；psql屏障确保先读后写后再读。自身写可见、旧写40001、跨行写偏斜与SSI拒绝连接成一条推理链，未把RR说成可自动保护所有业务不变量。VACUUM实验检查真实VERBOSE而不是用文件大小或统计估算冒充精确旧版本数；释放快照后可复用空间不等于文件立即缩小，复制槽等额外边界也已注明。

### 等待、死锁与恢复

区分普通MVCC读、锁定读、表级锁，代码先实际观察阻塞再让持有者提交。死锁测试先各持一行，再建立并观察双边，不靠固定sleep宣称死锁成立。deadlock_timeout被准确解释为检测时机相关参数，而非最大等待时间。受害者不预先指定，退出连接回滚后只重放失败整笔事务，金额最后110/90、总额200。升序锁集合之外的外键/触发器风险、缺账户、业务CHECK拒绝、可信整数插值与生产绑定参数、不确定COMMIT响应需要幂等协议均已写清，未声称交付银行支付或恰好一次。

## 图形检查

复读三张SVG的结构、标签、箭头和正文alt/caption，机制一致。为独立人工查看，在ignored的 `work/expansion/data-review/` 生成Quick Look预览并逐张查看。原SVG的固定width/height触发Quick Look正方形缩略图裁边，因此只在work副本移除根width/height、保留原viewBox及所有几何内容后重渲染；作者源文件未变。完整预览中三图文字/箭头可读，树区间、RC/RR事件顺序、等待环与统一顺序关系正确。

非阻断编辑建议：等待图上方“A等B释放账户2”与弧线较近，可后续微调标签垂直间距。此建议不影响机制理解或测试正确性。没有把Quick Look原始裁边误报成浏览器SVG缺陷。

## 本次未验收

没有执行浏览器/手机视口、站点下载/离线打开或ZIP内独立运行验收；未重做生产压测、成本参数矩阵、操作系统迁移、异常断电、真实资金/HTTP服务。当前结论只覆盖已读三篇、固定版本实验、真实源码映射和图形机制一致性，保留review状态与作者声明的生产边界。
