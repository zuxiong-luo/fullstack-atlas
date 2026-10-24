# optimistic-concurrency

固定Node.js22.12.0、pg8.13.1、PostgreSQL17.4。数据全为教学数据。

    cd optimistic-concurrency
    npm ci --ignore-scripts
    npm test
    # tests 8; pass 8; fail 0
    # 可设置PG_BIN=/your/pg17/bin后再运行

## 隔离与文件

postgres.mjs默认使用 /Library/PostgreSQL/17/bin，建立短前缀临时PGDATA与0700 Unix socket目录、编号55446，不监听TCP、不连接用户5432。普通用户可initdb；不要以root运行。测试finally关闭池/停止实例/删除目录。强杀整个测试进程会跳过finally，清理时只定位自己的临时数据目录，不能随意按端口杀其他服务。

schema.sql提供完整初始化；test.mjs是可直接运行的复现入口，测试中的受控钩子不是生产API。package-lock.json固定依赖。源码、必要助手、README均应位于下载ZIP，node_modules与运行时数据不打包。

## 验证输入与预期

两客户端同读v1，CAS恰好一胜；确定性无条件替换丢意图；唯一回执冲突用pg_blocking_pids实际等待作屏障；同键同载荷重放，同键异载荷冲突，租户内键范围；提交前效果/回执一起回滚；提交后丢响应同键恢复；不同键争最后1件只一胜。

## 范围

READ COMMITTED与同事务协议；result占位不允许由服务代码以空提交，任意SQL写坏回执不在保证内。COMMIT断链也可能结果未知，不以本地标记当完整网络判定。无外部系统恰好一次/自动合并冲突。

service.mjs含完整CAS与reserve。调用方传入已连接db，函数自行BEGIN/COMMIT/ROLLBACK，同一次预留不能被pool.query拆到多个连接。afterClaim/afterEffect/afterCommit只控制测试失败窗口；业务身份和授权应先在受信服务边界完成。

## 已验证与未验证

2026-10-24 macOS14.5真实运行；具体命令/结果在对应docs/validation记录。无生产容量/高可用/跨地域/托管服务验证。浏览器/手机阅读验收属于站点集成，不由CPU数据库结果替代。离线下载能带走源码，仍需在本机安装PG（缓存篇还需Redis）。
