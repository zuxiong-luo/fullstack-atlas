# 迁移与性能：Schema 演进、索引与批处理

独立 TypeScript 入口，不需要 NestJS。固定 Node.js 24.14.1、TypeORM 1.1.2、pg 8.23.1、reflect-metadata 0.2.2、TypeScript 5.7.2；验证 PostgreSQL 17.4。

## 安装和运行

先安装 PostgreSQL 17 服务端工具（不是只安装 psql）。不要使用 root 运行 initdb。

```sh
node --version
npm ci
PG_BIN=/Library/PostgreSQL/17/bin npm test
# Linux 示例：PG_BIN=/usr/lib/postgresql/17/bin npm test
# 端口已占用时：PG_PORT=55484 PG_BIN=/your/postgres/bin npm test
```

`npm test` 先编译，再创建随机临时 PGDATA，仅监听 127.0.0.1，默认私有端口 55483。它只管理自己创建的数据库进程，finally 查询自有PGDATA状态并停止进程，确认停止后才删除自己的目录，不碰5432。若停止失败或状态不明，保留私有目录并报错，避免删除仍在运行实例的数据。测试总上限 90 秒，PostgreSQL 工具单步上限 30 秒。遇到端口冲突会失败，不能借用未知服务。

如显式提供 `DATABASE_URL`，脚本不启动或关闭数据库；必须指向你专门创建的可销毁实验库。测试会 DROP 本篇固定前缀 schema，禁止指向业务库。默认不需要外部连接或密钥。

```sh
DATABASE_URL=postgres://127.0.0.1:55484/typeorm_content npm test
```

## 文件与输出

`src/model.ts` 定义 Owner/Note EntitySchema、DataSource 和固定 tenant-a/tenant-b、alice/bob 数据。`src/lab.test.ts` 是完整调用、断言和资源释放过程；`scripts/run-tests.mjs` 只管理隔离数据库与 Node 测试进程。EntitySchema 是 TypeORM 正式映射 API，不是教学伪 ORM。它避免为了数据库实验引入装饰器编译差异。

预期 5/5 通过（包含父测试）。CLI真实生成空库Initial及带数据Review迁移，run后增加reviewedAt，revert删除列但保留原笔记，历史剩1条。故意非事务并发索引DDL后除零22012：索引实际存在而迁移历史0，显式删除恢复。20002行上同一bob查询前后结果相同且含1条rare-bob，计划从Seq Scan/Sort转为命名索引访问；250行按100/100/50批写，失败事务0行、池backend PID数不超过4。

## 边界与清理

测试使用 synchronize 只创建临时 schema；生产不能照抄。测试不证明 MySQL、生产容量、网络断线后的提交结果或真实多租户认证。金额保留 numeric 文本，真实用户身份必须在服务端另外鉴权。依赖锁文件随项目提供，不包含 node_modules。离线 ZIP 可保存源码；首次 npm ci 仍需网络或预备 npm 缓存。
