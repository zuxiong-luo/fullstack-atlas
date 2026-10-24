# 浏览器策略：发送、读取、执行与服务端效果

Node.js 22.12.0，无第三方依赖。只使用虚构数据与loopback，不修改系统信任/浏览器设置。本例HTTP两端口同站跨源，不能验证HTTPS Secure和真实跨站SameSite。

```sh
cd browser-security-policies
npm ci --ignore-scripts
npm test
# tests 10; pass 10; fail 0
npm start
# Browser UI http://127.0.0.1:4352
# API http://127.0.0.1:4351
```

固定端口被占时直接失败，不悄悄切换。Ctrl-C/SIGTERM关闭两个服务。测试使用系统分配的随机端口并自动清理。

## 真实浏览器步骤

打开UI，点击“依次执行浏览器策略探针”，查看JSON结果：

1. /no-cors: readable=false。公开 /wildcard 省略凭据可读，credentials:include 不可读。
2. /session 建立单个当前教学sid；display可见，sid为HttpOnly应不可见（httpOnlyHidden=true、visibleCookie=true）。Cookie按host匹配不按端口隔离。
3. /private 默认跨源fetch不带凭据401；include后200。
4. 简单POST返回读取错误，但服务器simpleWriteDelta=1。
5. JSON拒绝预检后deniedPreflights增加，deniedPosts保持0。
6. 允许预检+include+正确头部的实际JSON写入成功，jsonWrites增加。

再打开 http://127.0.0.1:4352/csp，输出应allowed=true、blockedRan=false，并记录script-src-elem对inline的策略违反。

多次点击计数累加，请看增量。当前sid在/session替换，只有一个虚构主体，不是多人登录系统。页面输出是实际浏览器执行，不将Node头部断言当浏览器验收。

## 文件与边界

- server.mjs：两个HTTP服务器、有限CORS允许表、nonce CSP、教学Cookie、独立服务端写入检查与计数。
- browser.js：真实fetch探针与可见Cookie对照，只写textContent。
- main.mjs：固定4351/4352入口。
- test.mjs：真实HTTP10项（含父测试），检查响应头、凭据、预检/实际401、效果与nonce；不冒充CORS/CSP执行引擎。

简单写入端点故意无保护，仅加内存计数；不可用于业务副作用。JSON写入Origin/头部检查是受控演示，不代替完整CSRF、XSS或对象授权。HttpOnly不阻止已执行的同源恶意脚本代发请求。CSP3引用2026-09-16工作草案，实验使用已普遍实现的nonce/基本指令，不声称全部草案特性。

离线下载可保存正文/图/源码；静态GitHub Pages不能启动这些Node服务。生产还需HTTPS、Secure与跨站Cookie目标浏览器检查、代理/CDN缓存策略、权限和日志验收。本机测试结果见docs/validation/browser-security-policies.md，浏览器结果另记实际版本与范围。

分片Unicode回归通过真实HTTP写分片，等服务端收到第一片后再发送后续字节；不靠睡眠。split-request.mjs为测试客户端，原始字节先有界收集再一次严格UTF-8解码；非法序列400。
