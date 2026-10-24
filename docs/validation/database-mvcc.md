# database-mvcc：交付与验证记录

状态：待独立审稿、待站点浏览器验收；保持 `review`。

## 交付

正文 `src/data/articles/data/database-mvcc.ts`；示例 `examples/database-mvcc/`；下载 `database-mvcc/README.md`；图形 `public/figures/database-mvcc/snapshot-lifetime.svg`。

范围：版本/快照层次、RC与RR快照生命周期、自身写可见、40001、写偏斜对照、长快照与VACUUM回收。不会把PG行为套成所有数据库同名级别的实现。

## 实跑

2026-10-23～24，本机macOS14.5 x86_64、PG17.4、Node22.12.0。

```sh
npm test --prefix examples/database-mvcc
npm run check --prefix examples/database-mvcc
```

7子场景，Node合计8 pass / 0 fail；4块正文源码映射是实际文件连续原文。

- RC首次10→写者提交20→原事务第二次20。
- RR首次10→写者提交20→原事务第二次10；新事务20。
- 自身写99可读、回滚后20。
- RR旧写者在别人提交21后更新，40001，最后21。
- 两医生先读2后分别下班：RR最后0；Serializable第二笔40001，最后1。
- 长RR快照保持5000条old；写者更新new后VACUUM VERBOSE实际报告 `5000 are dead but not yet removable`，读者仍看见5000条old；释放后再VACUUM，`0 are dead but not yet removable`，新连接5000条new。

同步依据：psql真实echo屏障，独立写连接返回，VERBOSE stderr原文断言。不是靠sleep预估交错。模板数据仅versions表关闭autovacuum方便控制，不建议生产关闭。

每次临时PGDATA、私有socket、端口55441；不连接5432；finally清理。交付检查端口无监听。不把机器/会话暂停后的测试duration当成SQL性能。

## 图形

Quick Look真实渲染、完整视口人工查看；修正再次读取标签框宽度。检查RC/ RR时间线、旧/新版本及释放快照后可清理关系。Quick Look方形缩略图裁切问题通过/tmp方形包装查看；正式SVG仍1120×610。未声称完成站点/手机浏览器检查。

## 资料

PostgreSQL17官方 `mvcc-intro.html`、`transaction-iso.html`、`ddl-system-columns.html`、`routine-vacuuming.html`、`sql-vacuum.html`、`mvcc-serialization-failure-handling.html`、`monitoring-stats.html`。系统列不简化成数字大小判断；不把xmax非零等同记录已删。

## 限制

未验证复制槽、热备反馈、备库/故障切换、准备事务、冻结调优、生产膨胀治理。普通VACUUM未承诺文件缩小。浏览器、资源ZIP与离线清单等待整合验收，文章不提前标complete。
