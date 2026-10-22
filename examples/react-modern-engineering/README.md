# React 18 SSR 与 hydration 实验

这不是 Next.js 或 RSC 项目。它用 Node.js HTTP 服务与 React 18.3.1 展示一份请求快照怎样生成 HTML，再让浏览器接管交互。

## 环境与启动

已验证 Node.js 22.12.0（项目要求 Node 22）、React / React DOM 18.3.1、esbuild 0.28.2、jsdom 26.1.0。依赖版本由 package-lock.json 固定，无外部接口、账户或密钥。

```sh
cd examples/react-modern-engineering
npm ci
npm test
npm start
```

浏览器打开 http://127.0.0.1:4307 。固定监听 4307；端口被占用时会报错，不自动换端口。Ctrl+C 关闭。修改源文件后执行 `npm run build`，重启服务器并刷新浏览器。

## 文件与数据

- `App.jsx`：服务端与浏览器共用的组件，初始 count=0。
- `server.mjs`：每请求独立 data，SSR、安全 JSON、HTTP 错误、诊断记录。
- `client.jsx`：读取 data 后 hydrateRoot；mismatch 参数故意制造不同快照。
- `build.mjs`：浏览器开发构建和服务器组件编译；不用于性能测量。
- `test.mjs`：真实 React DOM / jsdom 与 HTTP 行为测试。

标题来自可选 title 参数（截断到 200 个 UTF-16 代码单元），请求编号由服务器生成。服务器只将这几个展示字段发给浏览器，没有认证信息。普通链接会触发完整页面请求，不是 SPA 导航。

## 按顺序观察

1. `/`：原始响应包含标题和计数 0；点击变为 1；重新请求页面变为 0、请求编号改变。
2. `/?mismatch=1`：服务器 0，浏览器故意改为 99。开发控制台报 hydration 恢复，恢复后点击变为 100。不要保留这个演示分支到生产项目。
3. `/?fail=1`：状态 500 与不依赖 React 的文字回退，详细错误只进入服务日志。
4. `/?title=%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E`：作为文本展示，不能创建新的可执行脚本。
5. `/missing`：404。

运行 `npm test` 应得到 tests 4 / pass 4 / fail 0。测试不依赖计时阈值，不把 jsdom 耗时视为性能证据。

## 边界

没有实现账户、真实数据库、客户端路由、流式 Suspense 数据源、RSC、Next.js、TLS 或生产运维。服务只监听本机，所有响应 no-store；开发 bundle 未压缩。CSP 是本实验响应策略，不是通用生产策略，新增内联脚本、流式SSR等必须重新设计并实际浏览器验证。jsdom 不能验证实际 CSP、布局、浏览器加载与移动网络行为。详见 VERIFICATION.md。
