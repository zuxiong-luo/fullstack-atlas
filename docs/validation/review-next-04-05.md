# Next第4～5篇独立复审

2026-10-24，非原作者审稿。范围为next-streaming-errors、next-production两篇完整正文/配套模块/测试/README与四张SVG。实际复现全部通过，修正生产篇两处文字边界；剩余浏览器hydrate/retry与移动视口由根代理单列验收，不用HTTP取代。

## 实际独立复现

macOS14.5 x64、Node22.12.0、已安装Next16.4.2/React19.3.1/TS5.7.2；本轮复用各示例现有精确依赖，未重新宣称npm ci。

- next-streaming-errors：`npm run build && npm test && npm run typecheck`实际通过，webpack生产构建；**4/4真实HTTP**。本轮顺序证据：REGION_PENDING已到、REPORT_READY未到，才发独立release；原响应随后完成，data事件2→5，status200。该次事件计数不当协议保证；内部失败隐藏、digest、同段新HTTP成功、100ms受控期限、ID/Origin/忙碌规则通过。
- next-production：`NEXT_PUBLIC_SITE_TITLE=Build-A NEXT_TELEMETRY_DISABLED=1 npm run build && npm test && npm run typecheck`实际通过；standalone装配后复制至独立临时目录启动，**8/8真实HTTP**。追踪asset与实际文件读取、无外部符号链接、HTML/实际JS/public、全部浏览器JS秘密扫描、请求ID与日志关联、受控错误、缺asset500后恢复、同一构建region切换而公开Build-A不变、缺token在监听前退出1均通过。
- 两篇独立内容tsc无诊断。带examples路径的正文代码原文映射**8+12=20/20**。测试正常收尾后以本机bind再确认4335/4336均已释放。

## 正文与机制核对

流式篇清楚区分共享layout、loading约定、page内局部Suspense与同段error覆盖范围；异步readReport确实在局部边界内。受控门最多32个ID、未释放不能覆盖、Promise释放与期限不是性能模拟；globalThis仅当前进程，没有冒称跨实例状态。文稿说明流已发头后不能改HTTP200、HTML/RSC/字节与可见DOM/hydrate分别验证，切页也不等于上游自动取消。版本锁定16.4.2的retry/refresh与reset差别准确，本轮另外查看实际安装error-boundary.js确认retry在transition中refresh后reset。

生产篇装配遗漏static/public与动态asset的失败推导明确；outputFileTracingIncludes只包含非秘密固定文件。启动配置在导入server.js前校验；动态私有值与NEXT_PUBLIC构建固化条件说清楚，server-only不被包装成自动防泄漏。proxy只约束关联ID，正文明确客户端提供的合法ID可冲突且不能授权；业务catch与instrumentation未捕获错误覆盖区分准确，health只存活不代表关键asset就绪。独立部署副本不借用源码树，测试未在切region间重新build。

## 本轮修正

生产篇原句“token与region…值不通过props或JSON返回”与page及/api/report的公开region冲突。已改为：token不返回，region作为非秘密配置刻意显示首页并返回报告JSON。没有改运行实现或测试。

另将“监听端口固定4336”改为“默认4336，可用PORT覆盖”，与boot的`process.env.PORT ||= '4336'`一致。两处修改后内容类型/20块映射再通过。

## 官方资料与图形

实际浏览Next16.4.2 error-boundary源码、文件追踪插件固定tag，另看当前官方output/error文档（当前维护16.4.3，不冒称固定tag页面）；结合已安装16.4.2行为核对retry与standalone。正文自带固定tag文档链接，当前官网版本变化不被混进实测版本。

四张SVG XML与1100px Quick Look真实渲染逐张人工检查：boundaries/wire、artifact/trace；标签、控制/数据方向和边界与正文源码一致，无文字裁切/覆盖。预览只在ignored work/expansion/next-independent，不进入public。

本审稿者没有运行浏览器hydrate、点击retry、生产计数按钮、移动视口或真实手机，也没验证代理缓冲、Linux/Docker、多区域/CDN。4/8通过证明当前生产HTTP链路；恢复新请求并不冒称实际按钮交互通过。无未解决的静态/HTTP阻断项，status review等根浏览器/发布验收。
