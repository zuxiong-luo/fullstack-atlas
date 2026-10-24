# next-production

精确版本：Node **22.12.0**，Next **16.4.2**，React/DOM **19.3.1**，TypeScript **5.7.2**。App Router，webpack生产构建，`cacheComponents:false`。package与锁文件独立，无源码外相对引用。

## 安装与生产验证

```sh
cd next-production
npm ci
NEXT_PUBLIC_SITE_TITLE=Build-A NEXT_TELEMETRY_DISABLED=1 npm run build
npm test
DEMO_API_TOKEN=local-demo-token-at-least-16 DEMO_REGION=local-a npm start
# http://127.0.0.1:4336/
```

如果已在仓库examples/next-production中，省略cd。端口固定，占用会报错；Ctrl+C停止手工进程。安装依赖需网络或有效缓存，源码ZIP不包含node_modules、.next或release，离线阅读不代表离线自动拥有Node服务。

## 文件与正常/失败行为

- next.config.ts：standalone、显式assets追踪、Cache Components关闭。
- scripts/stage.mjs：装配standalone+static+public+boot+runtime；release是生成物。
- runtime/config.mjs、boot.mjs：配置与监听前校验；lib/config.ts server-only。
- proxy.ts、app/api/report/route.ts：关联ID和有限字段日志。
- instrumentation.ts：框架未处理服务器错误观察点。
- test/：临时独立部署副本与真实HTTP验证。

1. build先生成standalone，再由stage装配release；手工start从release/boot.mjs启动，固定4336。
2. 首页运行时区域local-a，公开构建标题Build-A；按钮需要真实浏览器hydrate验收。
3. GET /api/report带x-request-id:known_request_42，响应头、JSON与结构化start/finish日志同ID。
4. ?fail=1返回500/REPORT_UNAVAILABLE/ID，不暴露内部错误。缺token启动退出1，不开始监听。
5. 变量只是公开教学占位；token仅示范服务端配置生命周期，不接真实上游，也不构成本例API鉴权。

## 实际证据

2026-10-24，macOS14.5 x64。`npm run build`与 **8/8真实HTTP测试**通过。

npm ci真实独立安装31包，未复用其他示例node_modules符号链接。webpack生产构建、standalone文件追踪与装配通过；测试把release复制到新临时目录再启动，扫描禁止外部符号链接，不能借用源码树运行。

验证追踪清单+asset实际读取、HTML+Next JS+public资源、全部浏览器JS秘密扫描、请求ID与受控错误、缺asset500后恢复、同一构建切换region与私有token而公开标题仍Build-A、缺配置启动拒绝。日志关联测试等待真实标记，不依赖stdout与网络事件恰好同顺序。

正文有12块对应示例文件的连续原文映射；版本源码链接用于注明出处，不替代本地代码。两张SVG经XML与作者Quick Look真实查看；站点/移动视口另记。

## 边界

当前只在macOS14.5 x64/Node22.12验证；没有Linux/Docker、托管多区域、CDN或反代缓冲测试。没有数据库/外部凭据服务或分布式span。health只代表存活，不保证关键asset或外部依赖就绪。构建于另一OS/架构时必须重新验证原生依赖。

公开构建标题的测试期望是Build-A；若自行换构建值，测试应一起改。真实.env不提交；.env.example仅教学占位。

真实浏览器hydrate、错误恢复按钮、手机视口和真手机不由HTTP测试替代；尚未执行时保留待验。测试临时部署/状态目录正常结束会删除，强杀整个测试不保证finally。
