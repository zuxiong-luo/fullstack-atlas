# NestJS 第 3～6 章交叉审稿记录

日期：2026-10-25。审稿角色：TypeORM 子系列作者，受主代理指派进行只读交叉审阅。最终结论：本次检查范围内未发现未解决的核心机制阻塞；是否发布仍以主代理对待提交快照、独立 ZIP、浏览器和离线资源的最终验收为准。

## 实际检查范围

逐篇阅读以下正文及对应项目中的实体、控制器/服务、配置、关键执行路径和验收脚本：

- `nestjs-typeorm-integration`：DataSource/Repository 注册、事务 manager、笔记与审计、初始化失败、HTTP 输入及关闭。
- `nestjs-validation-authorization`：运行时 DTO、身份 Guard、租户/所有者过滤、条件版本更新、输出投影、拒绝路径无副作用。
- `nestjs-reliability`：RxJS/Promise 反例、fetch 预算和请求断开、数据库阶段取消边界、持久任务、幂等、租约令牌及失败恢复。
- `nestjs-testing-delivery`：配置、结构化日志、存活/就绪、真实子进程信号、协作取消和不可取消 SQL 的硬截止。

使用只读脚本对这四篇文章中以 `examples/` 开头的代码文件标识逐一检查：**17 个正文代码块均为对应实际文件中的逐字子串，0 差异**。部分代码块展示完整文件；检查没有把节选要求错误地解释成必须展示整个脚手架。最终再次核对时，第三章已同步其最后一次 ValidationPipe 与测试更新。

本审稿人未修改 Nest 运行源或正文；建议经消息反馈给原作者，由原作者修正并复测。主代理收到反馈与关闭结论。

## 发现、修正与最终事实

### 第三章：DTO 声明与运行时校验

中间快照中，`NoteInput` 已有 class-validator 装饰器，但 `createApp` 尚未安装全局 ValidationPipe。装饰器声明不能单独证明 HTTP 输入受到运行时校验，因此提出必须明确边界或安装并验证。

最终源码已在 `createApp` 调用 `useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}))`。测试先发送数字 title，断言 HTTP 400，notes 与 audits 都为 0；相应实现与测试已放入正文。作者记录最终真实 PG/HTTP **2/2 通过**。本审稿人核对了断言与源码，没有独立执行该项目，不能把作者执行结果写成本人的复跑结果。

固定 tenant-a/alice 与故障夹具 failAudit 已被明确限定为自有 loopback 教学入口。第三章 `read → version+1` 只证明业务修改与审计共同提交，正文明确未交付并发冲突保护；第四章才将版本写入 UPDATE 条件。没有把普通事务或自动加版本值描述为 CAS。

### 第三、四章：事务归属与 PATCH 字段边界

笔记与审计的事务内写入使用回调提供的 manager；注入的普通 Repository 未被混入事务写入。第四章 UPDATE 的条件显式包含 id、tenantId、ownerId、expectedVersion，affected 必须等于 1；拒绝后不会增加审计。

中间实现中，未传 body 时将预读取的 `visible.body` 再写回 UPDATE。建议直接省略该字段，使“未出现即不修改”落实到 SQL 意图，避免将预读快照复制回数据库。

最终采用 `...(input.body === undefined ? {} : {body:input.body})`；测试分别验证未传 body 保留原文本、显式 null 清空。正文解释 `IsOptional` 在本接口允许 null 的约定。expectedVersion 的整数上限也保证加 1 后仍处于 PostgreSQL integer 范围。

身份守卫先判缺失/无效身份和写权限；真实资源查询同时限制租户与所有者。读到了跨租户、同租户跨所有者、伪造身份字段、陈旧版本等拒绝路径及无写入状态对照。普通错误输出没有暴露数据库约束细节。Date 输出只承诺毫秒视图，numeric 保留字符串，没有声称提供微秒游标。

### 第五章：超时、取消与持久恢复的责任边界

核对完整实现、失败脚本与最终正文后，以下边界一致：

- RxJS timeout 结束结果等待，不会取消普通 Promise 已启动的副作用；测试等待原 Promise 完成后确认计数变化。
- fetch 的请求与响应体读取共享合并后的 AbortSignal；控制器监听客户端断开并在 finally 移除本次监听器，服务 active 也在 finally 收口。
- phase 明确区分上游与数据库。只有上游阶段发生 abort 才被映射为上游取消 504，不将恰好同时发生的数据库错误伪装成网络取消。
- 独立 PostgreSQL advisory-lock 屏障让应用确实进入数据库等待后，才断开客户端并等待预算到期；释放锁后笔记与审计仍能提交。正文清楚说明未实现 pg CancelRequest，信号检查点无法撤销之后的 SQL 或已经完成的 COMMIT。
- 幂等范围是 tenantId/ownerId/key，数据库唯一约束仲裁并发，输入指纹不匹配返回冲突。持久 jobs 与应用内 Map 分开。
- 租约到期允许其他 worker 重领，并不自动使未被替换的 token 在某个绝对时刻失效；最终事务重新锁行检查 status/token，防止已经被替换的旧 owner 提交。
- 第三次领取后消失的任务由后续 claim 回收为 failed，避免仅过滤 attempts<3 而永久停在 running。普通失败与第三次崩溃恢复都有明确测试。
- runOnce 的 Promise 有明确持有人；没有把内存 setInterval 宣称为生产可靠队列，也没有声称实现外部副作用 exactly-once。

这些是本审稿人对代码、断言与说明的对应核查。作者记录四组真实测试通过；本审稿人未独立复跑，未额外证明宿主机断电、数据库复制故障或真实外部服务行为。

### 第六章：日志、健康状态与硬退出

发现中间 `Runtime.log` 会把每条历史事件追加到全局 events 数组，而验收实际读取的是子进程 stdout；建议移除这种无界保留。最终仅输出结构化 JSON，active Set 只持有在途 AbortController 并于 finally 删除。正文已同步，日志白名单不包含 Authorization、任意请求头或数据库 URL。

存活检查不访问 PG，就绪检查实际 SELECT 1 并检查 draining；脚本包含停止/重启同一私有 PG 后 live/ready 的差异与恢复。关闭通过真实 SIGTERM 发送给编译后 main.js 子进程，普通受控等待可以协作取消，已进入驱动的 SQL 不会因为 AbortSignal 自动停止。

最终额外实现与验证了硬截止分支：独立连接持有 notes 的 ACCESS EXCLUSIVE 锁，监控确认应用 INSERT 在等待，再发 SIGTERM。该场景将驱动 query budget 配成 5000ms，避免默认较短驱动超时先于硬截止结束工作；硬截止调用 `process.exit(1)`，而不只是设置 exitCode。测试检查 shutdown_forced、非零退出、连接关闭，以及释放锁后不存在新增 blocked_sql 笔记。

正文没有把强制退出归类为优雅关闭成功，也没有把这个尚未提交的锁等待实验推广成“任意断线都能判断 COMMIT 结果”。实际编排摘流、Windows 信号、生产负载等仍列为未验证。

### 私有 PostgreSQL 夹具的异常清理

发现中间 start 仅靠成功后设置的 started 标志判断是否需要停止；若 pg_ctl 启动超时但子进程已经产生，可能漏停且删除仍运行的数据目录。建议按本次自有 PGDATA 查询真实状态，无法确认或停止失败时保留目录。

最终夹具检查自有目录的 pg_ctl status；启动失败/超时后仍能进入清理。状态未知或停止失败时报告并保留私有目录，不盲目删除；不会借用或停止已占用的 55482 服务，也不触碰 5432。作者另有假工具生命周期单测，与真实 SQL 测试分开记录。本审稿人只读核对了这套实现及记录，未独立执行假工具或真实 Nest 夹具。

## 验收边界与交接

本次审校完成的是正文推导、源码调用、断言、结果口径和失败边界的一致性检查。它没有替代以下验收：

- 从最终发布 ZIP 干净安装、构建和独立运行全部 Node/PG/HTTP/信号用例；由主代理执行。
- 页面路由、手机视口、复制、高亮、图形放大、下载和离线包；由主代理检查。
- 生产身份、TLS/密钥、多副本任务运维、编排平台或真实容量验证；本文未执行，也未据作者本地测试推定完成。

主代理应以最终冻结快照与真实 ZIP 结果更新文章完成状态；本记录不提前宣称线上发布或生产验收完成。
