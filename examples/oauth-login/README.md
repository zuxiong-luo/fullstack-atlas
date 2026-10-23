# 本地 OAuth 授权码与 PKCE 教学模拟

Node.js 22.12.0 实际验证；无第三方依赖，npm ci仅检查锁文件。只监听127.0.0.1，不能部署到公网。

```sh
cd examples/oauth-login
npm ci
npm test
npm start
```

另开终端运行 `npm run smoke`，或浏览器打开 http://127.0.0.1:4311/login 。授权服务器4310、客户端4311；成功后显示固定模拟用户，访问 `/me` 复用轮换后的HttpOnly会话。

这不是完整 OAuth/OIDC 提供商：授权端点跳过真实登录和同意，固定 subject=demo-user-1；资源端点的profile是教学私有契约。没有ID Token、签名、JWKS、nonce验证或真实第三方账号接入。不能将它用于真实认证。

协议核心 `protocol.mjs`：state与浏览器事务绑定、S256 PKCE、精确回调、code一次性/60秒、事务120秒、模拟token/会话300秒、会话轮换和退出。有限内存Map最多1000记录，旧记录不持久化、不自动回收；重启清空。这个容量上限仅保护教学进程，生产应设计到期清理/存储和速率限制。

服务适配 `server.mjs`：两个loopback HTTP端点，后端只调用固定issuer地址，2秒请求预算，token留在服务端Map。真实部署必须HTTPS并设置Secure Cookie；本例HTTP故意省略Secure。Cookie不以端口隔离：两个端口同一主机，issuer请求可能携带该主机Cookie，不能把端口当独立信任域示范。

`npm test` 10项：RFC7636向量、正常流程和会话轮换、state失败先于兑换、丢失浏览器会话、redirect/PKCE方法、verifier与code重用、过期、提供商拒绝、缺code/错误token、Unicode错误状态。`npm run smoke`要先启动服务器，验证真实本地HTTP跳转、Cookie轮换、/me和重放拒绝；它手工携带Cookie，不证明浏览器SameSite政策。
