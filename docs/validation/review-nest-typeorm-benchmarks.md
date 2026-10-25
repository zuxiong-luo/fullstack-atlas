# NestJS / TypeORM 前两篇标杆审校

日期2026-10-25。主代理先读概念与推导，再从独立干净副本复现；未把依赖安装或文件存在当成通过。

## 已复现的行为

macOS14.5、Node24.14.1、TypeScript5.7.2、Nest12.2.0、TypeORM1.1.2、PostgreSQL17.4。每章复制排除node_modules/dist/.test后，重新`npm ci --ignore-scripts --no-audit --no-fund`、`npm test`。

|入口|实际结果|关键证据|
|---|---|---|
|nestjs-request-lifecycle|1/1，通过、无skip|HTTP201/400/403/500/201；非法和故障请求不额外写入，错误消息不泄露，close后停止监听|
|nestjs-modules-di|2/2，通过、无skip|单例身份相同、每请求身份不同、transient按不同消费方、异步初始化、关闭hook；没有exports的依赖注入失败|
|typeorm-foundations|5/5，通过、无skip|真实PG23505/23502、save新建与更新、参数化、1.x默认空值拒绝、{}读/写不同边界、初始化失败|
|typeorm-relations-queries|4/4，通过、无skip|4→1 SELECT；JOIN原始行4/父项3；微秒游标正确[2,3]、Date截断错误[1,2]；numeric文本保真|

TypeORM主审使用私有55484临时实例，与作者端口隔离；实际日志确认实例停止。DATABASE_URL外部模式只允许用户显式指向可销毁实验库，默认运行不连接已有服务。

## 发现与修正

- Nest第一篇成功响应x-trace在tap时取样，不包含之后finalize；正文需区分响应快照和最终观察，不能把它画成所有钩子的完整日志。
- Nest生命周期只解释当前全局注册和本章路径；对象实例化、多个参数Pipe次序、Guard之前的request-scope建立不能混入同一线性承诺。
- Nest第二篇原图把模块导出、请求身份和transient串成单链，容易误读依赖关系；作者已按反馈改成分支，并缩短长标签。最终浏览器图形结果另记。
- 统一源码下载入口为`<id>.zip`与`<id>/README.md`，不以目录链接冒充ZIP。
- TypeORM finally中的清理SQL失败也应继续destroy；作者已用嵌套finally收口。isInitialized=false仅是状态证据，不独立等价于全进程无句柄。
- TypeORM没有把默认空值拒绝扩张为所有API安全：{}读取、空update/delete、低层SQL均分开验证。关系查询次数与生产性能不混称。

正文有概念、作用、结构、关键真实源码、失败路径和运行说明；外部链接用于出处。前四篇可作为继续编写的基线，最终完成仍取决于跨作者审阅、整站资源与页面/离线验收。
