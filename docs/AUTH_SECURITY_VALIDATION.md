# 身份与Web安全专题验证

2026-10-23。依据 ARTICLE_WRITING_GUIDE.md 1—14节；状态仍为review，不把教学实验描述为生产认证。

## 原缺口及修订

- oauth-login原5节概览只有文字流程：缺运行实现、具体拒绝路径、state/PKCE/code生命周期证据。现保留所有原节ID，扩展9节：定义授权/认证/会话，协议时序图，完整protocol.mjs分为参数/Issuer/Client三段，server.mjs完整正文，具体输入/状态/输出，OIDC验证范围、运行与反例。关键实现不依赖外部链接或下载补齐。
- web-security-boundaries原5节概览只有检查清单，核心代码为文字流程。现保留原ID，扩展7节：围绕Alice文档a/Bob文档b完整推演，HTML编码、Origin/CSRF、owner授权、固定documentId出站分别落实代码；security.mjs与server.mjs完整正文；受控无害XSS预览和修复、边界图、正常与拒绝测试。

## 固定环境与实现范围

Node.js22.12.0，macOS。两个示例均只用Node标准库，package-lock.json锁定项目元数据，没有第三方运行依赖。

- OAuth在127.0.0.1:4310/4311；固定模拟用户已认证同意。不是完整提供商，不签发ID Token，没有OIDC签名/JWKS/issuer/audience/nonce实现，不声称完成真实第三方接入。文中将OIDC作为职责导读并列出真实接入验证要求。
- Web安全只监听127.0.0.1:4312；身份为固定demo会话，导入transport为本地异步流桩，无真实网络抓取或外部扫描。SSRF交付明确收窄为受控目录，不提供任意URL安全抓取器。

## 实际运行结果

### OAuth

- npm ci --ignore-scripts通过；node --check server.mjs通过。
- npm test：10项通过。含RFC7636附录B测试向量、正常交换与会话轮换、错误state在兑换前失败、丢失浏览器事务、精确redirect与S256方法、错误verifier/一次性code、code和事务过期、授权拒绝、缺code/错误token响应、Unicode state比较边界。
- 启动真实HTTP适配后执行npm run smoke：/login302 → /authorize302 → /callback200 → /me200；旧回调重放400；Set-Cookie中的会话ID实际轮换；返回固定demo-user-1。脚本在示例内可复现。
- smoke是Node手工传Cookie，不能当浏览器SameSite隔离证据。两个端口同一主机，Cookie不按端口隔离；正文与README明确该限制。

### Web安全

- npm ci --ignore-scripts与node --check通过。
- npm test：11项通过。HTML上下文编码、本人正常、无会话、Origin/token/方法独立拒绝、他人/不存在资源、URL形输入拒绝、固定目标与no-redirect参数、拒绝前不调用transport、302拒绝、流大小/关闭、有条件协作transport超时signal。
- 真实HTTP smoke：Alice写a=200、写b=403、错误Origin=403；safe预览含&lt;img而不含img元素字符串，并带CSP。服务端先检查授权再赋值。
- XSS自动测试验收编码和HTTP响应，未驱动真实浏览器执行事件；unsafe默认样本仅设置body数据标记，不读凭证、不出站。SSRF测试只传受控字符串和本地transport，不接触内网服务。

### 内容与资源

两篇TypeScript通过esbuild读取；图形SVG XML解析通过，包含title/desc与文字解释；关键正文代码从示例文件直接读取写入。React/Python前序文件未因本批任务覆盖。

## 官方资料核对

RFC7636（S256和向量）、RFC9700（回调/PKCE安全建议）、OIDC Core ID Token Validation；OWASP XSS、CSRF、Authorization、SSRF Prevention。正文就近给出处，来源不承担补齐关键代码。

## 尚需主代理集成

浏览器实际视图/安全标记对照、手机视觉、文章路由/搜索、示例ZIP与离线清单、线上发布由主代理统一检查。未声称已完成这部分。

## 保留边界

本地HTTP故意不设Secure Cookie；真实系统必须TLS并按环境配置。Map容量1000且不持久化/自动回收，非生产会话存储。OAuth不实现真实用户认证、client secret/多issuer/撤销；安全实验不实现通用DNS/IP/代理防护。Origin不是非浏览器身份凭据，CSRF不替代对象授权，CSP不替代文本输出修复，token解码不建立OIDC信任。
