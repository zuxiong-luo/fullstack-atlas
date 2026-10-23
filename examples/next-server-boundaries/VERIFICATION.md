# 验证记录

日期：2026-10-23。环境：用户本机macOS、Node v22.12.0；Next.js16.4.2、React/DOM19.3.1、TypeScript5.7.2，npm锁定依赖。

## 版本依据

- npm官方registry的稳定latest为Next16.4.2、React19.3.1；Next engines `>=20.9.0`，React peer允许19.x，本机Node满足。
- 官方2026-10-14安全更新说明修订线是16.4.1 / 15.5.28；示例使用更高的16.4.2稳定补丁。
- `npm install`：成功；安装时报告0 vulnerabilities。
- `npm audit --omit=dev --json`：已执行，当前生产依赖报告总数0。它是此时registry数据库的检查，不能证明永远没有漏洞。

官方依据：

- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://nextjs.org/docs/app/api-reference/functions/unstable_cache
- https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- https://nextjs.org/docs/app/api-reference/functions/updateTag
- https://nextjs.org/docs/app/api-reference/functions/revalidatePath

## 实际命令

```bash
npm run build
npm run typecheck
npm test
npm audit --omit=dev --json
```

生产build与类型检查已通过。build产物中 `/` 为静态，`/account`、四个API为按请求执行的动态路由。没有外部字体或网络数据源。

`npm test` 启动真实 `next start`，使用随机localhost端口、独立临时JSON、可信Origin和签名密钥，不mock Next Data Cache。8项全部通过：

1. 初次HTML已有账户内容和客户端组件预览，HTML无内部token。
2. RSC响应携带Bob内容，响应类型text/x-component，不含Alice私有内容。
3. 缺失/篡改/过期会话被拒绝，双账号API数据分离，响应no-store。
4. 私有写入ID来自会话，额外owner字段被拒绝，写Alice不影响Bob。
5. 两次公开读取readId一致；Bob写403；Alice写后revision+1、readId改变，Bob新页面可读同一公开更新。
6. 跨源、坏JSON、空值、过长、媒体类型错误有明确状态码。
7. 临时损坏存储得到无内部细节的503+requestId；恢复后200。
8. 递归检查生产浏览器JS，无演示内部token、签名环境变量名和存储锁实现。

## 验证中发现并修正的问题

- 直接用 `new URL(request.url).origin` 比较Origin时，Next构造的内部主机可能与127.0.0.1公开源不同，使正常写请求403。现改用固定服务器环境 `DEMO_APP_ORIGIN`；不借Host头扩大可信源。
- Next16 RSC请求可能通过同源307补齐匹配的 `_rsc` 参数。集成保留会话与RSC请求头，验证重定向仍指向同源/account，再读取Payload；没有把307误认为没有登录。
- 测试数据文件与本地默认文件是不同数据源。现把 `DEMO_DATA_FILE` 身份加入keyParts，避免函数闭包变化却误命中同一共享缓存。
- 明确 `outputFileTracingRoot` 为示例工作目录，避免在嵌套仓库中误识别上层lockfile。

## 图形与浏览器

两个SVG已通过真实SVG光栅渲染检查，中文、箭头和标签可读；图示无耗时数据。浏览器已通过首页Alice按钮进入账户页，修改私人笔记并保存，真实可见文本随refresh更新。最终的公共写入、双账号切换与错误提示仍以集成记录和主任务的浏览器整体验收为准，不把HTTP通过说成所有移动端UI通过。

## 仍有的限制

- 未做真实生产身份认证；演示账号切换任何本地用户都能操作。
- 文件Promise锁只覆盖一个Node进程。没有多实例、一致性事务、缓存失效持久重试、业务幂等和生产限流。
- 测试未证明CDN、多区域或服务器重启后的分布式缓存一致性。
- 未采集性能数据或承诺时延；readId只证明本例源读取复用。
- 未在真实手机设备验收；所有专有UI能力按主任务最终记录说明。
