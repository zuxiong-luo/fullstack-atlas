# cache-consistency

固定Node.js22.12.0、pg8.13.1、PostgreSQL17.4。数据全为教学数据。

    cd cache-consistency
    npm ci --ignore-scripts
    npm test
    # tests 7; pass 7; fail 0
    # 可设置PG_BIN=/your/pg17/bin后再运行

## 隔离与文件

postgres.mjs默认使用 /Library/PostgreSQL/17/bin，建立短前缀临时PGDATA与0700 Unix socket目录、编号55447，不监听TCP、不连接用户5432。普通用户可initdb；不要以root运行。测试finally关闭池/停止实例/删除目录。强杀整个测试进程会跳过finally，清理时只定位自己的临时数据目录，不能随意按端口杀其他服务。

schema.sql提供完整初始化；test.mjs是可直接运行的复现入口，测试中的受控钩子不是生产API。package-lock.json固定依赖。源码、必要助手、README均应位于下载ZIP，node_modules与运行时数据不打包。

## 验证输入与预期

屏障确定性复现DBv2/缓存v1；代际改变拒旧填后重读v2；真实停止自建Redis56382，DB/Outbox仍提交，读取转库，恢复重放；失效后未标记崩溃重复安全；整键丢失换新代际拒绝旧读者；事务回滚和错误租户缓存当未命中。

## 范围

不是线性一致缓存；DB提交到失效有窗口。随机代际不是单调持久fencing。Lua原子非SQL回滚。TTL60不被宣称严格陈旧上界，DEL只模拟整键丢失。未做真实TTL计时、集群/复制/生产降级容量验收。

另需redis-server/redis-cli 7.0.4。redis.mjs只启动自己的127.0.0.1:56382临时实例，AOF文件在临时目录，不碰用户6379。REDIS_SERVER/REDIS_CLI可覆盖二进制路径。测试真实停止/重启Redis，不能和其他同例实例并行共用56382。PG编号55447与其他例分开。

service.mjs含naive反例、代际prepare/publish/invalidate、有限readThrough、DB更新+持久失效与中继。无Web UI；全部通过真实PG/Redis命令与受控屏障验证，不用随机竞态或休眠猜工作已完成。单实例中继允许重复失效，无完整任务调度平台。

## 已验证与未验证

2026-10-24 macOS14.5真实运行；具体命令/结果在对应docs/validation记录。无生产容量/高可用/跨地域/托管服务验证。浏览器/手机阅读验收属于站点集成，不由CPU数据库结果替代。离线下载能带走源码，仍需在本机安装PG（缓存篇还需Redis）。

本例只更新已存在记录，未实现数据库删除、负缓存或关联列表缓存失效；这些要另定义行为。
