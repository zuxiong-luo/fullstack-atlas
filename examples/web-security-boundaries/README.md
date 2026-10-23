# Web 安全本地受控实验

Node.js22.12.0实际验证，无第三方依赖。服务只监听127.0.0.1:4312，不使用真实账号、密钥或外部网络。

```sh
cd examples/web-security-boundaries
npm ci
npm test
npm start
```

另开终端 `npm run smoke`。测试HTTP写入本人文档200、其他人文档403、错误Origin403，safe HTML响应转义。

- `/demo-session?user=alice`：固定模拟用户，设置HttpOnly/SameSite=Lax Cookie并返回CSRF token；不是生产登录。
- `/safe-preview`：将默认无害img事件样本作为文本编码，另加CSP。
- `/unsafe-preview`：故意不转义，默认样本只设置body的data-demo=executed。可在浏览器控制台观察document.body.dataset.demo。没有真实Cookie数据可窃取，不要把该服务对外开放。
- `POST /write`：JSON `{id:"a",text:"..."}`，需要demo会话、Origin=http://127.0.0.1:4312、X-CSRF-Token和本人资源。
- `POST /import`：JSON `{id:"a",documentId:"guide"}`，先授权，再通过固定documentId找配置URL；transport是本地桩，不发送真实HTTP。

`security.mjs`是完整边界实现，`server.mjs`提供实际适配。SSRF方案刻意收窄到受控文档目录，不支持任意URL；不会声称实现了DNS/IP/代理/重绑定的通用安全抓取器。固定目标使用保留域名example.invalid，测试桩返回本地样本；redirect:error、响应状态/大小和超时参数都有实现或断言，真实DNS和网络出口未验证。

11项自动测试与smoke均只在自建受控环境执行。XSS自动测试验证编码结果/响应头，没有驱动真实浏览器执行事件；手动浏览器观察需单独记录。输入/权限失败在教学HTTP统一返回403，真实服务应依错误语义划分400/401/403/404/413等。仅内存Map/静态文档，不代表完整生产安全方案。
