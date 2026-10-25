# nestjs-validation-authorization 验证记录

日期2026-10-25。文章状态review，等待主代理最终验收。

## 固定环境

macOS14.5（x86_64），Node24.14.1，Nest12.2.0，TS5.7.2，RxJS7.8.2。PG17.4（/Library/PostgreSQL/17/bin），@nestjs/typeorm12.0.2，TypeORM1.1.2，pg8.23.1。只用自有临时PGDATA与55482。

## 命令和真实结果

`npm install --ignore-scripts --no-audit --no-fund`写锁文件。`npm test`先tsc再测试。

3/3夹具安全单测 + 1/1真实PG/HTTP集成测试，全部通过，无跳过。

集成测试含15条拒绝用例逐条快照无变化；缺失/无效/原型键令牌401且不进业务；只读写403；跨租户/同租户其他owner404；类型/额外字段/版本上限400；版本冲突409；省略body保留、null清空；bob可访问自己资源。

夹具3项是自制假命令工具，对启动超时后拥有postmaster状态、状态未知、停止失败的所有权清理策略作断言；与真实PG测试分开报告。初版250ms的假工具命令预算在本机冷启动Node前就超时，改1200ms后能覆盖目标分支；不是PG性能数据。

## 正文、图形与独立性

关键代码从本章文件逐字放进正文，完整项目与锁文件自足；正文不要求外跳才能理解关键判断。SVG源在public/figures/同ID文件，主代理已查看完整图；手机文章/下载/离线由主代理最终核验。既有文章/锚点未改。

## 限制

未验证生产负载、Fastify、真实身份系统、TLS、多副本编排或真实外部业务API。
