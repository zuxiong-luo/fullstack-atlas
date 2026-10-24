# 安全两篇独立交叉审校

2026-10-24。审稿者为Node/Next/跨平台作者；只读原作者文件。

## 范围与真实复现

完整读取https-tls、sessions-lifecycle正文及对应证书、TLS客户端/服务、会话、JWT、HTTP路由、README、核验器，并检查SVG结构与文字。macOS14.5 x64、Node22.12.0、OpenSSL CLI3.6.1：

- examples/https-tls：npm test **6/6**（含父测试），npm run check通过，3块连续源码映射。
- examples/sessions-lifecycle：npm test **11/11**（含父测试），npm run check通过，5块连续源码映射。

TLS为真实loopback握手，不是只测函数。成功authorized/TLSv1.3/X25519/SAN与200，失败分别为未知签发路径、名称不符、过期、无共同协议。会话通过真实HTTPS验证随机ID、CSRF/Origin、过期与绝对上限、单次轮换、旧副本撤销和资源归属；JWT验完整性/固定算法/声明/到期/jti撤销，而不只是decode。

## 机制复核

核对Node22.12 TLS API、RFC8446、RFC9525、RFC8725及OWASP Session Management。普通证书TLS1.3中证书认证、CertificateVerify、临时X25519与AEAD分工清楚；没有错误复制RSA交换模型，没有关闭证书验证、修改系统信任或把逻辑示意写成抓包。

Cookie载体、Session状态与JWT格式区分清楚；JWT HS256明确为共享秘密HMAC，撤销表重新引入服务端状态。JWT没有Refresh Token；/refresh只轮换不透明Session。SameSite/HttpOnly不等于CSRF/XSS总防护，Node手工Cookie客户端不冒充浏览器策略验收。内存Map、重启失效、跨实例撤销和密码容量范围均有明示。

结论：**未发现阻断性正确性或源码一致性问题**。SVG结构与文字和流程相符；本次没有自己重新做像素渲染或手机验收，不把XML检查当视觉通过。

## 已发作者与主代理的非阻塞提醒

- current()在后续CSRF/资源授权判断之前touch空闲截止；有效cookie的同源拒绝请求也可能延长idle。正文称“认证请求”基本与代码一致，但这是可进一步说清的活动政策，不应扩写成只有最终成功业务才touch。
- 隔离夹具closeAllConnections后server.close建立在客户端已结束的范围内；扩展为长期接入服务时建议先close停止接入，再force，避免新连接窗口。现有loopback测试与其声明不因此失效。

未修改作者实现。仍不覆盖公网CA部署、吊销/CT、真实浏览器Cookie发送、原生手机、共享存储、生产登录防刷、跨实例撤销和性能。
