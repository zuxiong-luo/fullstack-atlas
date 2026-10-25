# NestJS、TypeORM 与 Node.js 增补发布验收

日期：2026-10-25。起点 ae0526e。批准范围为新增NestJS六篇、TypeORM四篇，并扩写既有Node三篇；不重做首页、字号、个人名片、导航样式或鉴权。

## 交付范围与内容检查

候选版本共110篇、13个公开分类。新增NestJS工程分类六篇；TypeORM四篇归入数据与并发，该分类现12篇；Node分类仍六篇，三篇扩写保留原ID。`pre-nest-supplement-identities.json`冻结原100篇ID、主题、章节锚点及研习关联，兼容测试检查未丢失。原文章评论仍由稳定ID生成。

新内容按概念、作用、结构、机制、失败与验证递进；正文保留理解结论所需的真实源码，外链作出处。Nest六章沿租户笔记服务递进，每章独立安装运行；TypeORM四章先使用普通TypeScript程序，不依赖Nest。Node补齐原生绑定/libuv/OS边界、线程进程与cluster、CPU采样/外部I/O/线程池排队。

同行审稿记录见 `review-nest-typeorm-cross.md`、`review-nestjs-03-06.md`、`review-node-cross.md`、`review-node-supplement.md`。同行只读审稿与作者实跑、主代理独立复现分别记录，不互相替代。

审校中修正了：Nest DTO遗漏运行时ValidationPipe、对象原型名称误作令牌、PG事务后的取消归因、最终一次租约崩溃遗留、任务公开投影泄露内部字段；Node连接前失败的等待悬空；迁移图未反映非事务DDL失败残留；PG启动/停止失败时私有目录清理所有权。修复后重新执行对应真实用例。

## 下载包独立执行

主代理从构建后的13个ZIP分别解压到仓库之外的系统临时目录，避免借用站点node_modules。每包执行 `npm ci --ignore-scripts --no-audit --no-fund` 和 `npm test`，均退出0。新服务Node24.14.1、Nest12.2.0、@nestjs/typeorm12.0.2、TypeORM1.1.2、pg8.23.1、TypeScript5.7.2、PostgreSQL17.4；旧Node三篇保持22.12.0。各锁文件完整随包。

|项目|主代理独立结果|关键范围|
|---|---|---|
|nestjs-request-lifecycle|1/1|真实HTTP成功、Guard、Pipe和异常顺序|
|nestjs-modules-di|3/3|可见性失败、作用域、异步初始化/关闭、forwardRef|
|nestjs-typeorm-integration|3项安全前置+2项PG|笔记/审计同事务、回滚、DTO非法输入无写入|
|nestjs-validation-authorization|3项安全前置+1项PG|15类拒绝条件、跨租户/owner、CAS、输出投影|
|nestjs-reliability|3项安全前置+4项网络/PG|超时/断开、取消后仍提交、幂等、重启/租约/耗尽|
|nestjs-testing-delivery|3项安全前置+完整E2E脚本|PG失效live200/ready503/恢复、SIGTERM短请求完成/长请求503/exit0、SQL阻塞触发硬退出exit1|
|typeorm-foundations|5/5|NULL/default、空条件、SQL参数、CRUD、约束|
|typeorm-relations-queries|4/4|N+1、JOIN/计数/分页、微秒游标、金额精度|
|typeorm-transactions-concurrency|5/5|连接归属反例、实际CAS SQL、受控锁竞争、幂等|
|typeorm-migrations-performance|5/5|真实CLI生成/运行/回退、非事务失败残留、索引计划、批处理/池|
|node-execution-model|10/10|文件/网络真实I/O、CJS/ESM顺序、固定版本源码|
|node-parallel-computing|17/17|有界池、取消/崩溃替换、子进程/cluster失败和退出|
|node-performance-memory|10/10|CPU栈、堆保留链、ELU/延迟、线程池、连接失败/预算收尾|

另从TypeORM基础ZIP独立执行共享PG清理测试3/3，覆盖启动失败且停止成功/停止失败/状态未知。隔离PG只监听loopback，Nest55482、主代理TypeORM55484，未使用用户5432或环境DATABASE_URL。主机为macOS14.5 x64；这些结果不代表Linux生产验证。

`nest-typeorm-node-executed-archives.json`记录实际执行包的逐文件SHA256及命令退出码；构建后所有13包通过CRC并与被执行源文件逐个匹配。Node固定v22.12.0源码摘录保留来源、摘要与第三方许可。

## 全站与浏览器

- 全站57/57测试、TypeScript及生产构建通过。资源检查237个下载引用、149个图形引用、400个正文源码映射、96个ZIP均通过。
- 本地桌面检查110篇目录、Nest六篇顺序、TypeORM四篇搜索及13篇路由、目录与下载链接。
- 实际390×844浏览器视口逐篇检查13篇，页面scrollWidth均390，无整页横向溢出；长代码及图形在局部滚动。代码复制出现“已复制”，图形放大对话框可阅读。记录见 `nest-typeorm-node-mobile.json`。这是响应式浏览器验证，不是Android/iOS真机验收。
- 新SVG实际渲染审校，修正DI分支与非事务迁移失败状态；Node C++代码真实生成106个高亮token，不再作为纯文本单色显示。
- 登录前离线页要求登录，登录后保存1455个资源（21469053字节，页面约20.5MB）。停止自有4343服务器，curl明确连接拒绝，再完整刷新新增Nest可靠交互及TypeORM迁移文章仍显示完整正文；直接打开新增缓存的Node `.cc`源码得到真实代码，没有回退到HTML。发现Markdown缺省编码后，为仓库UTF-8说明补响应charset及回归测试，更新worker/缓存、再次停止服务器并刷新README，中文正常显示。
- 离线清单包含新增正文、SVG、源码和全部ZIP；ZIP源码另已独立执行核验。内置浏览器的离线下载自动化未返回本地文件路径，因此未把该接口超时当作“实测离线ZIP落盘成功”。外部评论、引用网站和模型服务仍需联网，服务端项目依赖需另外安装。

构建主资源：`assets/index-BC1Ybvgz.js`，SHA256 `575e2f70d25502e1974b0ee341e4475906ce29ff7be58b21181dcb11d54ad873`。首次断服测试离线版本 `3f69f3abeb7962f3`；待提交快照重建版本 `39fdc7bef5707743`（21468669字节）；线上ZIP重新打包时间可能令版本号变化，核对实际源码字节、资源条数及字节数，不假定版本字符串必然相同。现有大chunk提示保留，未在内容任务中声称解决加载性能。

## 发布状态

实现提交 `1d6725dc932a7fd6d98bf8e89706b9e66ece627f` 已推送main。

- [Pages工作流40153713483](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40153713483)成功；[示例工作流40153713575](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40153713575)成功。
- 实际线上主资源 `assets/index-BC1Ybvgz.js`，SHA256与上列待提交构建一致。
- 线上SW SHA256 `77fd61cbae142bdedfc2107a8a2ce7f5c49eed1d5d11a96b01f13e2620583c0a`，与修复UTF-8的脚本逐字节一致。
- 线上离线清单版本 `74ee18ffe85ee73d`，1455文件、21468669字节。13个线上ZIP目录集合及每个条目的字节，均与实际独立执行的源码匹配；不是仅检查HTTP200或文件存在。机器核对记录见 `nest-typeorm-node-online.json`。
- 线上浏览器最后读取在内置浏览器和Chrome接口均超时；未因此伪称已做线上人工点击验收。站点路由、图形、手机视口、复制、登录及断服刷新为先前本地真实浏览器验证；线上核对证据为实际发布资源、正文所在bundle、离线脚本和下载源码。

文档收尾提交只更新进度与证据，不修改应用、示例或离线服务。本地4173保持固定端口；4342/4343仅本次图形与断服验证使用。

## 限制

新Nest/TypeORM使用真实本地PG、HTTP、进程信号，但未验证MySQL、Fastify adapter、Linux容器/生产容量、真实身份平台或分布式外部exactly-once。演示令牌不是生产鉴权；查询/批处理样本不是容量或收益承诺。Node采样与延迟输出只代表注明窗口。此前原生手机、K8s集群、Docker运行、真实GPU及付费模型等未验范围继续保留，不由此次通过推定完成。
