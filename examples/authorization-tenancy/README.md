# 服务端授权与多租户隔离

固定 Node.js 22.12.0、pg 8.13.1、PostgreSQL 17.4。无真实账户；令牌仅由测试为虚构用户生成。不存在面向外部的issue接口。

```sh
cd authorization-tenancy
npm ci --ignore-scripts
npm test
# tests 11; pass 11; fail 0
```

默认二进制 `/Library/PostgreSQL/17/bin`，其他安装路径用 `PG_BIN=/your/pg17/bin npm test`。需要普通用户可initdb，不能以root执行。测试检查主版本17，作者实测17.4；不连接用户5432。

## 隔离与生命周期

postgres.mjs创建独立临时PGDATA/0700 socket目录，编号55443，无TCP listener；trust只作用于该新实例，未修改用户数据库或全局pg_hba。先由atlas测试管理员迁移，再由atlas_app受限LOGIN连接执行请求。finally依次关闭HTTP/连接池/实例并删除临时目录。强杀整个测试进程可能跳过finally，必要时只清理此次临时实例，不能按端口乱杀用户服务。

## 代码

- schema.sql：角色/表/虚构数据/RLS/最小列权限。
- service.mjs：输入白名单、同连接事务局部上下文、成员查询、资源授权和带version的实际UPDATE。
- server.mjs：真实HTTP随机端口、随机Bearer测试会话与已知错误收口；未知方法拒绝，响应no-store。
- test.mjs：完整可运行项目入口，含10组HTTP/SQL场景+父测试，共11项；postgres.mjs负责私有实例。

## 权限与预期

red: alice editor、bob viewer、sue admin、erin editor；blue: carol admin。a1为alice私有，a2同租户共享，e1为erin私有，b1为blue私有。

- alice读a1成功；bob只读共享a2，读a1=404，列表只返回a2。
- sue在red能管理本租户，不具有blue权限：选blue=403，在red猜b1=404。
- viewer不能写，editor不能写他人私有文档；body只收body/version，额外tenant/owner/role=422。
- alice版本1写入成功变2；旧版再写409；无权资源不借409泄漏存在。
- 修改成员角色/删除成员记录后，同一个token下一个请求即拒绝；不宣称实时撤销已开始的事务。
- 漏WHERE的SELECT仍受真实RLS限制；跨租户UPDATE0行；改tenant/成员role被列/表权限拒绝42501。
- max=1连接池复用时事务外0行，再用blue仅b1，局部上下文不泄漏。

## 需要理解的边界

RLS上下文GUC由受信中间层设置，不能抵御应用账户任意SQL执行；始终参数化并避免将身份来自客户端字段。生产应用不可用superuser、表owner或BYPASSRLS来冒充受限角色。策略默认permissive，多条宽策略可能OR放大权限；本例按动作分别处理SELECT/UPDATE。

令牌内存表不是生产登录/过期/分布式会话；HTTP测试不提供TLS，部署应接已验收的HTTPS与身份系统。未验证跨服务委托、多节点撤权、连接代理、生产池容量或完整审计。数据库迁移和运行凭据必须分离。集成与复现记录见docs/validation/authorization-tenancy.md。

分片Unicode回归通过真实HTTP写分片，等服务端收到第一片后再发送后续字节；不靠睡眠。split-request.mjs为测试客户端，原始字节先有界收集再一次严格UTF-8解码；非法序列400。
