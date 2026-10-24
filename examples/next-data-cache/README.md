# Next.js 数据缓存实验

锁定 Node 22.12.0、Next **16.4.2**、React/React DOM **19.3.1**、TypeScript **5.7.2**。cacheComponents 关闭，显式使用 unstable_cache；不是 use cache 迁移教程。新项目应另外核对固定版本的 Cache Components 路线。

## 安装与生产运行

```sh
cd examples/next-data-cache
nvm use
npm ci
cp .env.example .env.local
# 设置本地 CACHE_ADMIN_TOKEN，至少32字符
npm run build
npm test
npm start
```

ZIP 解压后直接进入目录；非 nvm 用户使用 Node 22.12.0。测试自行注入独立令牌、Origin 和临时数据文件，自动启动/关闭 **4322**。手动服务使用 .env.local；端口已占用则先解决冲突。

## 观察与修改

浏览器打开 http://127.0.0.1:4322 ，页面显示 Data Cache 标记与同次渲染的两个 React cache 标记。在另一个终端中设置与你 .env.local 相同的令牌：

```sh
export CACHE_ADMIN_TOKEN='replace-with-at-least-32-characters'
curl http://127.0.0.1:4322/api/catalog
curl -X POST http://127.0.0.1:4322/api/source \
 -H 'Content-Type: application/json' \
 -H "Authorization: Bearer $CACHE_ADMIN_TOKEN" \
 --data '{"title":"课程目录 v2"}'
curl http://127.0.0.1:4322/api/catalog
curl -X POST http://127.0.0.1:4322/api/invalidate \
 -H "Authorization: Bearer $CACHE_ADMIN_TOKEN"
curl http://127.0.0.1:4322/api/catalog
```

令牌是本地演示值，不得用于公开部署。首次两次 GET 的 readId 相同；写源后仍读 v1；失效后读 v2，revision 增一，readId 改变。重复运行时 revision 继续递增，不要硬编码每次一定是 1/2。

`/api/catalog` 的 HTTP no-store 不会绕过显式 Data Cache。React cache 的同次渲染两个标记相同，新请求换一组。revalidateTag 使用 `{expire:0}`，和 max profile 的后台重新验证不能混为同一可见性承诺。

## 正常及失败验证

`npm test` 使用已有生产构建，**5/5**：显式缓存命中、旧值窗口与标签失效、React cache 范围、无令牌和坏字段拒绝、源损坏在过期后安全503及恢复。readId 只证明是否读取过，不是性能指标。错误详情只留服务端，客户端只见 UNAVAILABLE/requestId。

lib/store.ts 完整实现读源和文件替换；lib/cache.ts 定义缓存；lib/http.ts 控制管理令牌、输入和异常；三个 route.ts 分开暴露读/写/失效，故意让中间窗口可复现。

## 范围和安装说明

macOS 14.5 x64 生产构建与真实 HTTP 已验。同版本依赖采用本地复用节约磁盘；三套独立清单 dry-run 均通过，没有宣称从全新网络下载逐包验收。ZIP 不包含 node_modules、.next、.env.local 或 data 运行状态。

JSON 写入是单写者演示；rename 避免半截文件，但读加一写回不是多进程事务。没有实际等待一小时测 TTL，没有证明跨地区/多实例缓存一致性，也没有测浏览器 Router Cache、手机或托管平台行为。源码离线可读，服务和 npm 依赖须另装。

## 发布前独立复核（2026-10-24）

根代理从交付ZIP解压到新目录，实际执行 npm ci --ignore-scripts、npm run build、npm test，5/5通过，未使用作者node_modules软链接。网站正文及图形已在1280×800与390×844视口检查；这不是Android/iOS真机或托管平台验收。服务端行为由真实HTTP用例验证，未声称浏览器缓存/身份策略全部验收。
