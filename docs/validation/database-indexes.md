# database-indexes：交付与验证记录

状态：待独立内容审校、待站点浏览器验收；文章保持 `review`。

## 交付

- 正文：`src/data/articles/data/database-indexes.ts`
- 示例：`examples/database-indexes/`，下载路径 `database-indexes/README.md`
- SVG：`public/figures/database-indexes/btree-access.svg`
- 范围：PG17普通堆表、B-tree有序访问、联合键、覆盖/可见性、成本与反例。

## 实际执行

2026-10-23首次运行，2026-10-24交付整理；macOS14.5 x86_64 / Node22.12.0 / PostgreSQL17.4。主代理随后独立复现索引实验通过。

```sh
npm test --prefix examples/database-indexes
npm run check --prefix examples/database-indexes
```

结果：5个子场景通过；Node含父测试6 pass / 0 fail。4处正文源码映射逐字匹配对应真实文件。后续增加或移动正文代码块时必须重跑check。

- 索引前本机真实计划：Limit → Gather Merge → Sort → Seq Scan。
- 新建索引后结果逐行等于原结果，无Sort，orders_recent为Index Only Scan、20行、Heap Fetches=0。
- 更新金额后堆访问>0；初次本机40。VACUUM后0；仅断言必要条件，不把40作普适常数。
- 无前导租户条件的paid记录66666条，查询合法，本机广范围计划Seq Scan；不强制所有平台同计划。
- 表达式条件建对应表达式索引后出现在计划中。

每套测试独立initdb、私有PGDATA/socket、127.0.0.1:55441，不接触5432。finally停止实例并删除临时目录。验证结束 `lsof -nP -iTCP:55441 -sTCP:LISTEN` 无输出，端口已释放。

整套测试含initdb、进程创建、清理；机器曾出现会话暂停。**不记录或推导性能提升。**

## 图形检查

用macOS Quick Look真实渲染后人工查看。Quick Look对横向SVG缩略图会按方形裁切，因此在/tmp创建只扩展视口高度的方形审查包装后查看完整图；仓库保留原1120×620 SVG，不改变内容。箭头端点、标签、可见性分支检查通过；这是图形渲染检查，不是站点浏览器/手机验收。

## 来源核对

核对PostgreSQL17官方：`indexes-types.html`、`indexes-multicolumn.html`、`indexes-ordering.html`、`indexes-index-only-scans.html`、`using-explain.html`、`sql-createindex.html`。文中引用为出处，关键SQL与验证在正文。

## 尚未验证

站点最终路由/高亮/离线下载由主代理整合后验收；手机真机、Linux、Windows、冷缓存、生产负载、并发在线建索引未验证。未将本机成本或时间写作通用事实。
