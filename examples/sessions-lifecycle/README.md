# Session / Cookie / JWT：真实HTTPS生命周期

对应 `sessions-lifecycle`。这是隔离学习工程，**不会改动网站当前鉴权**，也不是可直接公网部署的账号系统。

## 环境与运行

已验证macOS14.5 x86_64、Node22.12.0（内嵌OpenSSL3.0.15+quic）、OpenSSL CLI3.6.1。没有npm第三方依赖。

```sh
cd examples/sessions-lifecycle
nvm use
npm ci
openssl version
npm test
npm start
npm run check
```

`OPENSSL_BIN`可指定CLI绝对路径。本套默认只生成一天有效证书；证书辅助也包含上一篇的过期分支，完整证书生成测试在https-tls。其他OS未实跑。

所有请求是真实HTTPS，服务 `listen(0,'127.0.0.1')`，客户端只对这次连接信任临时教学CA。不改系统或浏览器信任库，不占站点4173，不接入公网服务。

## 教学账户与输入

alice / `classroom-only-42`，bob / `classroom-only-43`。这是公开教学夹具，绝不能替换为真实个人口令后提交仓库。口令在启动时用随机盐scrypt派生；会话不会存口令。

alice拥有1号笔记，bob拥有2号笔记。主要路由：

| 路由 | 契约 |
| --- | --- |
| POST /login | JSON `{user,password}`，正确Origin；新Cookie及CSRF |
| GET /me | 查有效会话，返回user与CSRF |
| POST /refresh | Cookie、正确Origin和CSRF；换ID与CSRF，保留原绝对截止 |
| POST /logout | 删除服务端记录并清Cookie；旧ID再用401 |
| GET /notes/1、/notes/2 | 会话加所有权检查；另一用户对象404 |
| POST /jwt/login | 同样教学凭据，返回30秒Access Token |
| GET /jwt/me | Bearer JWT验MAC与声明，再返回用户 |
| POST /jwt/logout | 正确Origin及Bearer；jti撤销后再用401 |

`origin`由服务端实际端口构造；非浏览器调用缺Origin也拒绝，是本例选择。/refresh只用于不透明Session，不是JWT Refresh Token实现。

## 生命周期与时间

正常默认空闲60秒、绝对300秒。有效认证活动滑动空闲截止但不延长绝对期限；轮换删除旧ID，保持绝对截止。Session ID与CSRF各用32字节随机值，Map用ID摘要作键，过期清理且最多1000会话。

测试注入now以控制服务器时间：空闲10秒/绝对25秒，精确验证边界，**网络仍真实HTTPS**。Node客户端手工附Cookie，并不执行浏览器SameSite、Secure或前缀策略；测试只检查响应头文本和服务端行为。

JWT固定HS256、typ、iss、aud、允许用户、iat/exp类型与30秒寿命、jti。base64url是编码，不是加密；HS256是HMAC，知道验证秘密也能签发。验MAC后还验声明，不能decode后信任身份。本例只实现Access Token，没有JWT Refresh Token服务。退出靠jti撤销表，重新引入服务端状态。

## 验证结果

9个HTTPS子场景 + 1个独立JWT策略测试，含父测试 **11 pass / 0 fail**：

- 防会话固定、随机ID/标志、no-store、本人200/他人404；
- 无CSRF/错Origin403、刷新后旧ID401、新CSRF改变、伪造ID401；
- 同一旧ID同时刷新，只一个200另一个401；
- 空闲到期401，活动和刷新滑动短期但绝对截止仍401；
- 退出清Cookie且旧副本401；
- 超过1024字节413；坏口令401、缺Origin403；
- JWT HTTPS签发/使用/退出/重放与到期；
- 改payload不重签、none算法、未知crit头、错误iss/aud/时间、不同key、已撤销及过期拒绝。

`npm start`仅打印 `login 200 / own note 200 / other user note 404 / logout 200 / old cookie 401`，不打印Cookie、JWT、CSRF或私钥。

## 文件与边界

`sessions.mjs`为完整会话与Cookie；`jwt.mjs`为固定策略教学JWT；`server.mjs`为输入/凭据/Origin/CSRF/授权路由；`client.mjs`为真实HTTPS调用方；`test.mjs`为正常与失败断言；证书辅助在临时目录生成/清理。verify脚本核对正文连续源码，独立ZIP无仓库文章时明确跳过。

Map及JWT密钥仅在本进程，重启会话和旧JWT失效；单次轮换原子性只在本进程同步操作范围内。未实现共享存储、跨实例撤销、持久化密钥轮换、MFA、注册/找回密码、攻击限速、审计、生产容量或不确定提交后的业务幂等。JWT撤销表只是教学内存状态，不保证流量下的生产容量。

HttpOnly/CSRF不能修复同源XSS；Authorization Bearer与Cookie自动附带的CSRF前提不同。生产优先使用成熟会话/JWT组件，保持本文针对算法/声明/撤销的等价验收，不复制一份手写密码协议到公网。

资料：[Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)、[CSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF)、[RFC7519](https://www.rfc-editor.org/rfc/rfc7519.html)、[RFC8725](https://www.rfc-editor.org/rfc/rfc8725.html)。
