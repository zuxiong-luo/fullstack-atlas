# Next.js 服务端、客户端与缓存边界

固定环境：Node 22.12.0、Next.js 16.4.2、React / React DOM 19.3.1、TypeScript 5.7.2。使用 Node runtime、App Router、webpack 生产构建，未开启 Cache Components。与站点的 React 18 实验分开安装。

## 运行

```bash
nvm use
npm ci
cp .env.example .env.local
npm run build
npm test
npm start
```

没有 nvm 时准备对应 Node 后略去第一步。依赖安装需要网络；运行不访问第三方服务。浏览器打开 **http://127.0.0.1:4319**。开发模式用 `npm run dev`，但验证缓存请以生产 build/start 为准。

`.env.local` 的 `DEMO_SESSION_SECRET` 至少32字符；示例值只用于本地。`DEMO_APP_ORIGIN` 是服务器信任的写请求Origin，默认与上述地址相同。若改域名/端口，必须同步修改。真实HTTPS部署设置 `DEMO_SECURE_COOKIE=1`，换随机密钥并实现真实登录。

默认存储在 `data/state.json`，初次读取创建。可用服务器环境变量 `DEMO_DATA_FILE` 指向另一文件；数据源身份也进入缓存keyParts，避免不同数据源共用缓存。环境变量不向客户端发送。

## 初始输入和正常结果

1. 首页点“使用 Alice”，账户页显示Alice私人笔记、公开目录与编辑表单。
2. 修改自己的笔记保存；“当前私人笔记”随 `router.refresh()` 更新。
3. 修改公开目录名称保存；目录revision加一、readId改变。Bob能看到同一公开目录。
4. 点击首页，再“使用 Bob”；Bob显示自己的笔记，没有公开目录编辑按钮。切换账号采用完整导航，销毁上一账号草稿。
5. 两次GET `/api/catalog` 在有效缓存内应返回同一readId；写后标签立即过期，下次读应得到新readId。readId是源读取证据，不是耗时指标。

导航Link关闭prefetch，便于观察Network。首次访问关注Document/JS，站内Link关注RSC响应；内部请求头与 `_rsc` 参数不是业务API。

## 边界与失败

- 无会话访问账户API是401；页面重定向首页。
- cookie篡改或过期被拒绝。
- Bob直接POST公开目录仍为403；隐藏按钮不承担权限校验。
- 私人笔记ID来自已验证会话；body附加userId会被400拒绝。
- 缺少或不匹配Origin是403；坏JSON/空值400，媒体类型415，超过教学字符限制413。
- `request.text()`先读取完整body，字符检查不构成生产入口的字节/流量限制。
- 备份后临时损坏JSON可复现503，返回requestId、终端有细节；恢复文件后可继续读取。不要对真实数据做破坏实验。
- 8类集成测试使用临时数据，自动恢复故障并退出子进程。测试会清理本示例 `.next/cache`，不要与同目录运行中的服务并行执行。

## 文件职责

- `lib/auth.ts`：本地演示会话HMAC与过期验证、可信Origin。
- `lib/store.ts`：单进程串行JSON修改、DTO投影。
- `lib/catalog.ts`：公开Data Cache，tag与60秒时间策略。
- `lib/http.ts`：输入契约、no-store响应、错误分类。
- `app/account/page.tsx`：服务器读取、必要props投影。
- `app/components/Editor.tsx`：浏览器状态、POST、错误提示与refresh。
- `app/api/**`：请求/写入边界；公开目录立即tag失效。
- `test/integration.mjs`：真实production服务HTTP与客户端包验证。

## 适用边界

演示账号切换器对所有本地访客公开，不是真实登录；签名只防cookie篡改。JSON方案只适用于单Node进程、可写磁盘、小数据量，不提供多实例事务或幂等提交。写入与缓存失效之间没有分布式事务。Next运行服务不能部署为仅有静态文件的GitHub Pages；本站只发布文章、图与源码下载。

缓存/API行为核对官方文档，实际验证和限制见 `VERIFICATION.md`。
