# App Router 请求与导航

固定版本：Node.js **22.12.0**、Next.js **16.4.2**、React / React DOM **19.3.1**、TypeScript **5.7.2**。运行时依赖与开发依赖均由 package-lock.json 固定。cacheComponents 关闭，使用生产 webpack 构建。

## 安装与运行

仓库先进入 `examples/next-routing`；独立 ZIP 解压后进入同名目录：

```sh
nvm use
npm ci
npm run build
npm test
npm start
```

非 nvm 用户使用 Node 22.12.0。测试会启动并关闭 **4321** 端口，先等测试结束再 npm start。地址：http://127.0.0.1:4321/notes/n1 。端口占用时报错，不自动漂移。

## 代码结构

- app/layout.tsx：根文档。
- app/notes/layout.tsx：共享布局与导航。
- app/notes/Counter.tsx：独立客户端计数器。
- app/notes/[id]/page.tsx：await params、connection 请求时渲染、数据选择。
- 同目录 not-found.tsx：缺失资源展示。
- app/api/ping/route.ts：独立 JSON 端点。
- lib/notes.ts：两条受控笔记数据。

## 可观察结果

首访 n1，HTML 已有“理解路由树”、共享布局和初始计数。RSC 请求 n2，得到 text/x-component 与“理解客户端导航”。unknown 显示“该笔记不存在”；流式情况下响应可能已送出 200，不能只凭状态码判定展示。

手动浏览器步骤：

1. n1 页面把布局计数点到 2。
2. 点击 Link “第二篇”，应保留 2，正文切成 n2。
3. 点击普通 a “整页打开第二篇”，新文档计数回 0。
4. 刷新、返回和手机点击分别检查，不把它们等同于前一步。

Link 在本例关闭 prefetch，便于区分点击与提前请求。RSC 的 `_rsc` 参数由框架管理，测试辅助函数只做固定版本协议观察，不提供业务用路由客户端。

## 已验与限制

macOS 14.5 x64 已完成生产构建和 **4/4** 真实 HTTP/RSC 测试。构建按一个 worker 控制本地资源。作者执行时复用已有同版本 node_modules，未把依赖放进 ZIP；独立临时清单 `npm ci --dry-run --ignore-scripts` 通过，但不是一次全新下载后的全环境验收。

HTTP 测试没有运行 hydration 或点击，不能替代上述计数器状态保留检查。人工页面、手机、真实移动设备和托管平台尚未验收；无性能收益结论。离线包能保存源码，浏览器不能直接启动该 Node 服务，Node 和 npm 依赖需另行安装。

## 发布前独立复核（2026-10-24）

根代理从交付ZIP解压到新目录，实际执行 npm ci --ignore-scripts、npm run build、npm test，4/4通过，未使用作者node_modules软链接。网站正文及图形已在1280×800与390×844视口检查；这不是Android/iOS真机或托管平台验收。生产浏览器实际点击计数至2，Link切换n2仍2，普通a整页导航回0。
