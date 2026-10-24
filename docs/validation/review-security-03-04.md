# 浏览器策略与多租户授权独立审校

2026-10-24。只读原作者文章、README、服务、测试、SQL、夹具与 SVG；问题交原作者修复。

## 独立复现

macOS 14.5 x64、Node 22.12.0，PostgreSQL 二进制为本机 17.4。分别实际执行 `npm test --prefix examples/browser-security-policies` 与 `npm test --prefix examples/authorization-tenancy`。最初 9/10 项通过；下述修复后独立重跑为 **10/11 项全部通过**。后者真实创建私有 PGDATA/0700 Unix socket 实例，管理员迁移与 NOSUPERUSER/NOBYPASSRLS 的 atlas_app 分开；finally 关闭 HTTP/池/实例，没有连接用户默认 5432。

完整核对正文需要的代码，当前 **6/7 块连续原文映射**均与 examples 实际文件一致。两张 SVG 结构、方向与正文职责相符；本次没有自行重做浏览器/手机像素验收。

## 找到并关闭的 Unicode 分片错误

初版两处 HTTP input 通过 `text += chunk` 隐式逐块 Buffer→UTF-8 解码；合法多字节字符被网络分片切开时会变成替换字符。审稿者用真实 node:http 请求将 `x`×63+`你` 的有效 JSON 在“你”的首字节后切开，原本合法的 64 UTF-16 单位 message 得到 422。授权服务相同写法还有保存错误正文的风险。

已反馈原作者并确认修复：先按原始字节有界收集 Buffer，最多 1024 字节，完成后一次 fatal TextDecoder 解码；无效 UTF-8 返回 400。新增的 HTTP 回归通过仅供测试的服务端 chunk 观察钩子确认首片到达后才发送余下字节，不靠睡眠假定切片。独立重跑确认浏览器示例合法中文 200、授权示例保存并读回“你好”一致，以及两者非法 UTF-8 400。正文解释、连续源码与新测试数量均已同步。

## 机制复核

实际查阅 WHATWG HTML 源/站点、Fetch CORS 协议、CSP3 2026-09-16 工作草案、Node 22.12 Stream、PostgreSQL 17 Row Security 与 OWASP Authorization。

- CORS 是浏览器读取共享许可，不是后端认证。无凭据预检 204、实际请求 401、简单 POST 生效但响应不可读分别测试；精确源与凭据星号限制没有混淆。nonce 每 HTML 响应随机，CSP 不替代注入防护；HttpOnly 不禁止浏览器带 Cookie 发请求。
- 两个 loopback 端口是同站跨源，不声称 HTTPS Secure、真正跨站 SameSite 或第三方 Cookie 隐私策略已验证。Node 只验证头与服务端效果；根代理实际浏览器观察另见作者验证记录，本审稿不冒称自己点击过该页面。
- 服务端主体来自受控令牌映射，租户角色每请求查询，资源关系与版本进入实际 UPDATE。默认拒绝、列表过滤、私有对象 404、授权冲突 409、租户管理员不等于全局管理员均有真实失败路径。
- RLS USING/WITH CHECK、列授权、owner/BYPASSRLS 例外与 permissive OR 组合描述正确。同一连接内 BEGIN/set_config(...,true)/COMMIT 或 ROLLBACK，单连接池复用后上下文不泄漏；自定义 GUC 不是不可伪造数据库身份，已明确不能抵抗任意 SQL 执行。
- 撤权保证后续请求，不宣称撤销已开始事务；随机内存测试令牌不是完整生产登录/JWT 过期服务。HTTP bearer 与 Cookie CSRF 范围分开。

结论：修复后，**在声明的范围内未发现剩余阻断性正确性或源码问题**。未验证多实例撤权、连接代理、生产审计/负载、目标浏览器兼容性、手机原生环境或公网 TLS；下载、离线及线上版本由根代理另验。
