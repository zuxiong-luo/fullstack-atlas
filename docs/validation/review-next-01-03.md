# Next.js 第一批三篇：独立交叉审校

日期2026-10-24。审稿人与作者分离；只读文章、源码与SVG，不直接修改作者文件。

## 复现环境与结果

macOS14.5 x86_64，Node22.12.0；三套实际解析版本均为Next16.4.2 / React19.3.1 / TypeScript5.7.2。

```sh
npm test --prefix examples/next-routing
npm test --prefix examples/next-data-cache
npm test --prefix examples/next-server-writes
```

生产HTTP独立复现4/4、5/5、8/8通过。分别使用4321/4322/4323，测试建立独立临时数据目录、结束停止服务。此次使用作者已构建的生产产物和既有同版本依赖；**不是干净安装、不是独立重建生产包的声明**。构建与锁文件安装证据见作者记录，整站待提交快照仍由主代理检查。

正文完整examples路径的代码映射：routing7、cache7、writes11块，全为对应实际文件连续原文。

## 内容和行为审查

### routing

路由树、共享布局与动态片段定义清楚。params采用await，查对象用hasOwn，notFound范围明确；区分首次HTML和RSC导航，不把HTTP/RSC代替hydration或计数器点击证据。Link关闭预取以收窄观察，普通a对照步骤明确。流式状态码200/404边界未包装成统一404保证。HTTP生产4项复现与承诺一致。

### data cache

固定cacheComponents关闭、unstable_cache路线，并说明Next16推荐迁移。闭包数据路径进入缓存身份；标签不是键。HTTP no-store、Data Cache、React cache和客户端路由缓存分层准确。读readId证明真实执行而非耗时猜测；源修改保留旧值、expire:0后阻塞重取可复现。仅单写者，不伪称rename提供事务。管理令牌不进客户端；损坏源503和恢复实际经过失效边界。

图形发现一处需要修正：scopes.svg左边“真实读取”箭头从底部JSON源指向React cache，而图注与右侧箭头按cache→源解释。作者已改为 M235 255V347，复核通过，统一cache→数据源语义；未修改他文件。

### server writes

会话身份、来源、输入和对象授权分层。主键owner仅由可信会话取得，客户端owner拒绝。owner+key回执和内容摘要明确，单进程门保护先查再写，失败finally释放；没有假装为分布式事务或exactly-once。输入按字节限制/语法/形状区分。Action实际从SSR提取标识并经multipart POST，不是直接import函数；redirect放在catch外，框架跨站拒绝状态和JSON403分开说明。签名演示会话无撤销、密码比较不等于生产存储、本地HTTP非Secure均明确。并发重复、冲突、越权、坏输入、存储损坏恢复及静态包无秘密全部复现。

## 官方资料复核

独立打开固定tag v16.4.2的revalidateTag、unstable_cache、Server/Client Components文档，以及React cache官方文档。expire:0的下一次阻塞重验证、max的SWR、cache请求范围与闭包键说明符合源码/实际测试。

## 限制

此次不声称浏览器导航、hydration、手机真机、Vercel、多实例失效、真实数据库事务和生产容量已验。文件存储不保证断电持久；已有node_modules软链与生产产物不等于全新下载后重建。图形已复核结构标签与代码含义，站点实际渲染/手机视口由主代理独立记录。
