# Node 三篇增补：作者收口与交叉检查

日期：2026-10-25。按既有 ID 扩写，不新增 Node 文章。本文区分作者实跑与主代理后续独立验收，不把作者自检冒称独立同行审核。

## 已核验

|文章|当前测试|保留既有|新增证据|
|---|---:|---:|---|
|node-execution-model|10/10|8项与8锚点|V8/绑定/libuv/OS；真实文件和HTTP资源；ENOENT；固定11段原源码|
|node-parallel-computing|17/17|13项与8锚点|spawn/execFile/exec/fork；输出上限；cluster；IPC退出/错误/超时与回收|
|node-performance-memory|10/10|6项与8锚点|CPU采样调用栈；延迟上游/活动资源/连接；两进程池饱和对照|

Node v22.12.0/npm10.9.0/macOS14.5 x64。三个无第三方依赖项目分别npm ci并实际测试。没有把耗时/ELU上限/稳定采样数写成测试契约；CPU工作与HTTP只触及自己创建的受限loopback资源。

三篇内容独立严格TypeScript检查通过。原article.id、questionIds、章节ID集合相对HEAD保持；正文对应本地文件分别17/9/10块逐字一致。官方v22.12.0 raw源码重新读取，11段按原文件行号完整逐字匹配，并检查清单SHA256；THIRD_PARTY_NOTICES包含Node/libuv MIT归属。

## 修正过的问题

主代理审阅首版进程样例时指出：等message不能忽略提前exit，kill之后也不能留下悬空Promise。已加入明确的exit/error/deadline单次结算、listener收口，实际peer早退/无回复/cluster未就绪退出通过。自检再补没有创建PID的spawn失败退出收口，真实ENOENT路径通过。最后仅该IPC测试定向复跑通过；全套17项通过基于同样正常逻辑，主代理将从最终下载副本独立重跑全部。

libuv Unix fs原文件存在Linux io_uring尝试路径，正文没有省略后宣称跨平台必走工作池。本文的工作池实测明确限定macOS；async_hooks只观察Node请求资源，不证明特定内核线程或系统调用时间线。

## 图形

三张新增可编辑SVG：layers.svg、owners.svg、diagnostic.svg；通过CUA内置浏览器在1280×720实际完整渲染逐张查看，箭头、标签、层次与正文一致。Quick Look宽图缩略图裁切，因此改用浏览器，不把裁切图当合格结果。原图保留。

共享CPP语言高亮和`.c`/`.cc`下载白名单由主代理补齐；本文未越权修改共享渲染器。站点移动视口、下载ZIP、全文搜索、离线和最终发布由主代理独立验收。

## 保留限制

未测Windows/Linux的本文新增进程/工作池场景；未采内核trace、生产CPU/内存或真实业务数据；未手工操作DevTools。Worker非权限隔离、内存队列不持久、取消不自动撤销外部副作用。CPU/profile和上游/池的毫秒值只是指定输入一次观测，不是优化收益报告。

后续Nest作者只读交叉审发现I/O连接前失败等待，已修正并真实补拒绝/绝对预算双故障；最终性能10/10。审稿范围和证据见review-node-cross.md与node-performance-memory.md，不将只读审稿冒称同行复跑。
