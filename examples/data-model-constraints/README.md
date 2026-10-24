# data-model-constraints

固定Node.js22.12.0、pg8.13.1、PostgreSQL17.4。数据全为教学数据。

    cd data-model-constraints
    npm ci --ignore-scripts
    npm test
    # tests 9; pass 9; fail 0
    # 可设置PG_BIN=/your/pg17/bin后再运行

## 隔离与文件

postgres.mjs默认使用 /Library/PostgreSQL/17/bin，建立短前缀临时PGDATA与0700 Unix socket目录、编号55444，不监听TCP、不连接用户5432。普通用户可initdb；不要以root运行。测试finally关闭池/停止实例/删除目录。强杀整个测试进程会跳过finally，清理时只定位自己的临时数据目录，不能随意按端口杀其他服务。

schema.sql提供完整初始化；test.mjs是可直接运行的复现入口，测试中的受控钩子不是生产API。package-lock.json固定依赖。源码、必要助手、README均应位于下载ZIP，node_modules与运行时数据不打包。

## 验证输入与预期

同租户SKU重复23505，跨租户同SKU允许；NULL/CHECK与NOT NULL区别23502/23514；跨租户拥有者/商品23503；历史价格不随现价改变；延迟外键补齐成功、COMMIT漏补失败；事务错误后25P02直到ROLLBACK；NULLS NOT DISTINCT；状态集合不限制迁移。

## 范围

不含完整订单状态机、支付、跨行汇总维护或权限。金额bigint用字符串观察，未假装任意大金额可无溢出运算。

## 已验证与未验证

2026-10-24 macOS14.5真实运行；具体命令/结果在对应docs/validation记录。无生产容量/高可用/跨地域/托管服务验证。浏览器/手机阅读验收属于站点集成，不由CPU数据库结果替代。离线下载能带走源码，仍需在本机安装PG（缓存篇还需Redis）。
