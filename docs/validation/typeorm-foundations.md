# TypeORM 基础标杆审校记录

状态：待主代理交叉审校，不提前宣称线上完成。核验 2026-10-25。

环境：macOS 14.5 x86_64、Node.js 24.14.1、PostgreSQL 17.4（/Library/PostgreSQL/17/bin）、TypeORM 1.1.2、pg 8.23.1、TypeScript 5.7.2、reflect-metadata 0.2.2；精确依赖 package-lock.json。

实际命令 `PATH=/Users/luozuxiong/.nvm/versions/node/v24.14.1/bin:$PATH npm test --prefix examples/typeorm-foundations`：5 tests / 5 pass / 0 skipped。最初编译发现删除readonly options类型失败，改为局部可选配置视图再编译；不将失败轮次算成通过。最终新增save无主键插入后再删除与findOneBy({})断言，已重跑5/5。

证据：save新建得到ID；insert返回identifiers；已有ID save更新；update affected=1/0；delete恢复四行；真实PG23505、23502；无显式空值配置默认undefined/null抛错；findBy({})四行、findOneBy({})有行；update/delete空条件拒绝；QueryBuilder未套用同一高层策略；参数化值包含引号；不可达端口初始化拒绝，isInitialized=false。

`isInitialized=false`是状态证据，不单独证明所有socket永远无泄漏；外层隔离PG停止和Node子进程正常退出是本次资源收敛的额外观察。清理采用DROP schema的try/finally再destroy，DROP失败也会执行destroy。默认私有端口55483，PGDATA随机临时目录，仅监听127.0.0.1且有独立socket目录；不触5432。显式DATABASE_URL模式只用于可销毁实验库。

正文src/model.ts、src/lab.test.ts均从实际文件逐字嵌入。EntitySchema完整模型与固定tenant-a/tenant-b/alice/bob不依赖Nest。官方空值文档明确为1.x，旧0.3默认忽略不适用；npm安装包EntityManager.js约400~422和OrmUtils.js约505~558实查默认throw与空写正规化，不声称不存在的GitHub tag可访问。

SVG保留编辑源，macOS Quick Look实际渲染到1200宽PNG并人工看图；网页桌面/手机渲染由主代理验收。不涉及MySQL、生产容量、断线提交结果、真实身份平台。

## 失败清理修正与最终复跑

四份 `scripts/run-tests.mjs` 已逐字统一：pg_ctl start报错/超时后仍检查本次自有PGDATA；若发现运行则尝试停止，确认不运行后才删除。停止失败或状态未知时保留私有目录并报告路径，退出失败，不盲删运行实例。基础项目额外 `node --test scripts/test-runner-cleanup.mjs` 3/3，覆盖启动失败但启动已产生副作用、停止失败、状态不明；这是假工具生命周期单测，不当作真实SQL证据。

使用修正后的运行器，PG_PORT=55485顺序实际重跑四项目：基础5/5、关系4/4、事务5/5、迁移5/5，共19个Node test（含各父测试），0跳过；所有临时真实PG进程正常停止。基础与关系另经主代理干净副本5/4实跑通过；页面发布状态由主代理统一更新。

基础CRUD最后补验字段更新边界：先写body='keep-me'，update({body:undefined,title:...})后仍为keep-me，随后body:null确实清空为NULL。与where空值正规化是两套路径，正文明确区分。补断言后同命令真实5/5通过，正文源块逐字同步。
