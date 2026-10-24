# next-data-cache 核验记录

2026-10-24，review。环境 macOS14.5 x64，Node22.12.0、Next16.4.2、React19.3.1、TS5.7.2，cacheComponents关闭，webpack生产构建。

## 执行

- `npm run build --prefix examples/next-data-cache`：成功，页面及三个端点均动态。
- `npm test --prefix examples/next-data-cache`：**5/5**，真实4322生产服务、隔离临时文件、独立管理令牌。
- 最终HTTP媒体类型正则修订后已重建并全套复跑5/5。
- 三套Next独立锁清单在临时目录 `npm ci --dry-run --ignore-scripts` 通过；实际构建复用同版本依赖，没有把dry-run包装为真实新下载验收。

## 实际行为

- HTTP no-store与显式Data Cache共存，两次API readId相同。
- 顺序修改源revision后仍读旧缓存；expire:0标签失效后下一读得到新revision/new readId，再次命中。
- 页面单次Server Component渲染的两个React cache结果相同；下一请求换一组标记。
- 无管理令牌401、坏字段422，不改变源。
- 先失效再损坏源得到安全503/requestId；恢复源再失效后正确读回。

readId仅识别底层读取，不是性能测量。revalidate=3600未实际等待一小时；max profile和updateTag只做明确边界对比，没有冒充同一实验已验证。

## 核对与边界

7块完整examples源码映射逐字通过；内容TypeScript通过；scopes.svg/invalidation.svg XML通过，尚未浏览器渲染。

已核对官方unstable_cache、revalidateTag、updateTag、缓存关闭Cache Components的模型，以及React cache文档；16.4.2固定文档tag的revalidateTag也已读取。文章明确unstable_cache为本篇受控旧路线，Next16推荐Cache Components/use cache；不混用两套配置。

源写入按单写者顺序演示，临时文件rename不提供跨进程事务/断电持久。本地API令牌不进入客户端，仍无完整账号、审计和限流。未验浏览器Router Cache、手机、托管平台、多地区失效或DB。运行data、私有.env、node_modules、.next不能进ZIP；共享打包器已通知主代理排除data。

## 根代理发布前复核（2026-10-24）

正文图形完成网站1280×800及390×844检查，放大与局部滚动可用；图无正文矛盾、箭头遮挡或文字裁切。安全6/11、Python全前五章33、Next4/5/8真实用例通过；本批六套交付ZIP均解压到新目录，Node实际npm ci（Next另生产build），没有借用作者环境。Next路由另在实际浏览器验证计数2经Link保留、整页a重置0。以上补充作者阶段记录，不替代原文列明的浏览器Cookie策略、原生移动设备、托管平台或分布式边界。冻结站点、离线和发布证据另见批次记录。
