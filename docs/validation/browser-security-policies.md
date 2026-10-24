# 浏览器安全策略作者/集成验证

日期2026-10-24。源状态review，等待独立内容审校。

## 环境与Node真实检查

macOS14.5、Node.js22.12.0，无第三方依赖。执行：

```sh
npm ci --ignore-scripts --prefix examples/browser-security-policies
npm test --prefix examples/browser-security-policies
npx tsc --noEmit
```

清洁安装成功（零第三方包）、10/10测试通过（纯函数1+HTTP场景7+父测试1+分片场景1）、站点TypeScript通过。测试使用随机端口，实际检查预检204/实际无身份401、白名单拒绝、无CORS的直接客户端读取、简单写入生效、JSON边界/大小拒绝和nonce每响应变化。不把Node当作CORS/CSP执行引擎。

正文6块代码为真实文件连续原文，映射全部匹配。

## 主代理独立真实浏览器观察

作者启动 `npm start --prefix examples/browser-security-policies`，固定UI4352/API4351。主代理使用Codex内置Chromium浏览器于2026-10-24实际访问并点击UI探针，向作者回报如下结果。工具未公开确切发行版，发行版号未核验，不自行猜测：

- /no-cors读取TypeError；公开星号200；credentials include+星号TypeError。
- documentCookie=display=visible，httpOnlyHidden=true、visibleCookie=true。
- 默认跨源fetch/private401，显式include/private200。
- 简单POST读取失败，但simpleWriteDelta=1。
- 最终simpleWrites=1、jsonWrites=1、deniedPreflights=1、deniedPosts=0。
- /csp实际allowed=true、blockedRan=false，violations包含script-src-elem / inline。
- 还观察到style-src-elem / inline，可能与浏览器/工具注入样式有关；不把事件总数=1作为标准，不声称该额外事件来自业务页面。

这才是本批浏览器执法证据，和Node检查分开。收到结果后作者关闭自己session18698，检查4351/4352无监听。未改浏览器安全设置或系统证书信任。

## 图形与资料

mechanism.svg经XML解析、QuickLook实际渲染查看；标签无溢出，简单POST“先产生效果、后被挡读取”、预检与实际授权的阶段匹配代码。临时预览只增加画布高度防裁切，未改变原SVG。

已实际浏览WHATWG HTML源/站点、Fetch CORS协议、W3C CSP3及2026-09-16快照、MDN CORS/CSP/Set-Cookie/Referrer-Policy。规范是算法与浏览器行为依据，工作草案不泛称最终标准。

## 明确限制

HTTP loopback两个不同端口同站跨源；不证明HTTPS Secure、真实跨站SameSite、第三方Cookie隐私限制或不同浏览器兼容性。教学sid是一个可替换的虚构会话，不是多人登录服务。无保护simple-write仅内存计数，不可照搬业务副作用。

离线包可下载正文/图/源码，不能替静态Pages启动Node服务。ZIP完整性、线上版本和手机文章页由主代理发布验收记录，不由本地HTTP结果代替。

## 独立审稿修复：UTF-8网络分片

审稿人真实复现逐块字符串解码会损坏合法多字节内容。作者已改为1024字节上限内收集Buffer，结束后TextDecoder fatal一次解码。新增真实loopback分片回归使用服务端首片观察屏障，不靠60ms等待；合法中文原样成功/保存，非法UTF-8返回400。两篇最新测试分别10/10与11/11，源码映射分别6/7；依赖无变化，不重复安装冒称新依赖验收。
