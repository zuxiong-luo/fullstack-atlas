# 权限与多租户作者验证

日期2026-10-24。源状态review，待独立审稿与发布验收。

## 实际环境/命令

macOS14.5、Node.js22.12.0、pg8.13.1（完整依赖树锁定）、PostgreSQL17.4，二进制 `/Library/PostgreSQL/17/bin`。

```sh
npm ci --ignore-scripts --prefix examples/authorization-tenancy
npm test --prefix examples/authorization-tenancy
npx tsc --noEmit
```

清洁安装13个依赖包成功、审计0告警；真实HTTP+PG测试11/11（10组场景+父测试）通过；站点TypeScript通过。PostgreSQL版本实际查询确认17，二进制输出17.4。

postgres.mjs创建自己的PGDATA和0700 Unix socket目录，编号55443，无TCP监听，trust仅该临时实例；运行账户真实连接为atlas_app LOGIN/NOSUPERUSER/NOBYPASSRLS，迁移管理员单独连接。没有连接用户5432、改系统数据库或复用他人角色。完成关闭HTTP/池、停止实例并删除目录，55443未留TCP监听。

## 机制与失败路径

- 伪造/缺少Bearer=401，非成员/跨租户=403，客户端role/user提示不提升权限。
- owner与shared读成功；同租户私人对象404；bob列表只a2。
- red管理员sue只见a1/a2/e1，不能访问blue/b1，blue管理员carol正常。
- viewer写403，editor改别人私人对象404，body夹带tenant/role422。
- owner版本1写成功→2，陈旧版本409；无权对象不借409暴露存在。
- 成员降权/删除后同token下一个请求拒绝，不伪称撤销在途事务。
- 应用角色故意遗漏WHERE的SELECT受真实RLS过滤；foreign UPDATE0行；改tenant/成员role被42501拒绝。
- max=1池复用red→事务外0行→blue仅b1，局部GUC清理确认。
- token撤销、无效JSON400与超限413，不把令牌放进有界错误观察日志。

正文7块源码连续映射全部匹配。关键服务逻辑、完整RLS SQL和HTTP入口都在正文，不用外链替代实现。

## 图形与官方依据

mechanism.svg经XML检查与QuickLook实际渲染查看，标签/箭头无溢出，权限矩阵与请求顺序和代码一致。临时方形画布只服务预览，不修改原图。

核对PostgreSQL17 row security/CREATE POLICY关于USING/WITH CHECK、默认拒绝、owner/superuser/BYPASSRLS例外及permissive组合；node-postgres参数化与同一连接事务；OWASP默认拒绝/逐请求验证/资源关系。相关官方链接在文章，不把当前文档中未运行的API当固定版本证据。

## 实际边界

GUC由可信中间层设置，不抵御应用账户任意SQL执行；始终参数化，账户不授tenant/owner修改。受控HTTP使用显式Bearer，不声称Cookie CSRF方案已同样覆盖。内存测试令牌表不是生产身份提供商/过期系统。未验证多进程、连接池代理、生产撤权传播、TLS部署或完整审计合规。ZIP/线上/文章手机视口留给主代理集成验收，不提前标完成。

## 独立审稿修复：UTF-8网络分片

审稿人真实复现逐块字符串解码会损坏合法多字节内容。作者已改为1024字节上限内收集Buffer，结束后TextDecoder fatal一次解码。新增真实loopback分片回归使用服务端首片观察屏障，不靠60ms等待；合法中文原样成功/保存，非法UTF-8返回400。两篇最新测试分别10/10与11/11，源码映射分别6/7；依赖无变化，不重复安装冒称新依赖验收。
