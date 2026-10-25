# TypeORM 关系查询标杆审校记录

状态：待主代理交叉审校。核验 2026-10-25。环境及依赖同基础篇，独立锁文件、独立入口、随机PGDATA。

实际命令 `PATH=/Users/luozuxiong/.nvm/versions/node/v24.14.1/bin:$PATH npm test --prefix examples/typeorm-relations-queries`：4 tests / 4 pass / 0 skipped。

真实SQL日志reset在初始化/seed之后。三个Owner逐个加载笔记得到1+3=4条SELECT；不分页leftJoinAndSelect().getMany()一条SELECT，三父项；getRawMany四行。take(1).getManyAndCount返回一个父项、alice两条笔记、总父项3。limit(2)原始JOIN仅含alice一人，未把SQL行数包装成父数量。

精确游标2026-01-01T00:00:00.123456Z，Date截断为2026-01-01T00:00:00.123Z。升序(createdAt,id)比较，精确下一页[2,3]，截断下一页[1,2]。numeric字符串9007199254740993.10保留，Number转换后的toFixed文本不等。tenant-b/alice不存在复合外键23503真实拒绝。

这些是语义与查询数证据，不是性能基准；不声称JOIN固定更快、不声称所有eager/lazy组合均已验证。模型显式关闭隐式加载，正文解释各自边界。SVG已Quick Look实际渲染并人工检查，网页手机验收交主代理。清理finally嵌套保证destroy；不触用户数据库。

## 失败清理修正与最终复跑

四份 `scripts/run-tests.mjs` 已逐字统一：pg_ctl start报错/超时后仍检查本次自有PGDATA；若发现运行则尝试停止，确认不运行后才删除。停止失败或状态未知时保留私有目录并报告路径，退出失败，不盲删运行实例。基础项目额外 `node --test scripts/test-runner-cleanup.mjs` 3/3，覆盖启动失败但启动已产生副作用、停止失败、状态不明；这是假工具生命周期单测，不当作真实SQL证据。

使用修正后的运行器，PG_PORT=55485顺序实际重跑四项目：基础5/5、关系4/4、事务5/5、迁移5/5，共19个Node test（含各父测试），0跳过；所有临时真实PG进程正常停止。基础与关系另经主代理干净副本5/4实跑通过；页面发布状态由主代理统一更新。
