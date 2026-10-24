# 数据库后续四篇独立交叉审校

2026-10-24。只读审校 data-model-constraints、sql-execution-plans、optimistic-concurrency、cache-consistency 的完整正文、关键源码、测试、隔离夹具、README 与 SVG，不修改作者文件。

## 真实复现与连续源码

macOS 14.5 x64、Node 22.12.0、pg 8.13.1、PostgreSQL 17.4、Redis/redis-cli 7.0.4。分别在四个示例目录实际执行 `npm test`：**9/9、6/6、8/8、7/7 全部通过**，没有跳过。PG 分别建立新的私有 socket/PGDATA 55444～55447，不监听 TCP，不连接用户 5432；缓存篇只启动自己的 Redis 56382、临时 AOF 目录，测试真实停止/重启并 finally 清理。

正文关键代码与实际文件逐块核对：**4/7/6/7 块均为连续原文**。SVG 解析与结构、箭头、标签及正文关系复核一致；本次未自行重新做像素渲染、手机或站点下载验收。

## 约束与事实模型

核对 PostgreSQL 17 Constraints/SET CONSTRAINTS：CHECK 允许未知结果，与 NOT NULL 不同；普通 UNIQUE 的 NULL 与 NULLS NOT DISTINCT 已真实比较；复合外键表达租户内关系，不冒充调用者授权。历史成交价与当前价格区分，bigint 通过字符串观察；跨行总额不偷塞普通 CHECK。延迟外键只改检查时间，COMMIT 漏父行失败，普通事务错误后 25P02 与 ROLLBACK 经过实际断言。status 集合不承诺状态转换协议。

## 执行计划

独立观察到 Seq Scan 输出 30/过滤 59970 加 Sort，匹配索引后 Index Only 输出 20；相同结果得到验证。真实 Hash Join 输出 60000、聚合 2 组；64kB work_mem 的 Sort 为 external merge/Disk，本机 Gather Merge 子 Sort 平均 30000、loops 2。OFFSET 下层输出 10020，而同页 keyset 输出 20。

旧统计估 1/实 30000，本次 ANALYZE 后估 **30035**；与作者先前 30009/29963 不同，符合抽样变化，文章已明确不能把精确估数当版本常数。cost、Actual Rows/loops、BUFFERS/OS 缓存与节点内存预算没有混为速度倍数或全实例上限。EXPLAIN ANALYZE 真执行、副作用与 keyset 的稳定排序/并发快照边界清楚。

## 乐观并发与幂等回执

核对 PostgreSQL 17 READ COMMITTED、INSERT/唯一仲裁。两连接先读同版后 CAS 恰一胜；无条件替换丢意图反例确定成立。重复回执用真实 pg_blocking_pids 确认等待后再释放屏障，效果、载荷与回执同事务；同键不同意图冲突，租户键隔离、提交前回滚和提交后同键恢复有独立测试。不同键争最后库存也一胜，不把幂等混同资源条件。

正文明确调用者应传同一已借连接；乐观不等于底层无锁。committed 只是本地已知状态，COMMIT 断链仍可能结果未知；SQL 回滚不能撤销外部支付/邮件，不宣称跨系统恰好一次。result 空占位仅事务中可见，任意 SQL 写坏数据不在协议保证内。

## 缓存一致性

核对 Redis Lua 官方文档与 PG 事务前提。屏障真正复现旧读 v1→写库 v2/DEL→旧回填 v1；随机代际 prepare/publish/invalidate 在 Redis 内原子检查，旧资格被拒后有限重读，不无限追赶写者。真实停 Redis 后数据库值与 pending 保留、读取降级 stored=false，恢复重放；失效后未标记可重复，新 UUID 防重用资格；DEL 只是整键丢失实验，不冒称测了实际 TTL 到期。

正文准确收窄为“已应用失效后拒旧代际发布”，保留 DB 提交到应用失效窗口；随机令牌不是持久单调 fencing，Lua 原子不是 SQL 回滚或跨库事务。缓存租户值校验、未知故障降级与容量未验范围均写明。没有把 TTL60 宣传为严格陈旧上界，也不称本机 Redis 重启等同集群容灾。

结论：**未发现阻断性机制、源码或复现问题**。未验证生产容量、跨地域/集群故障、缓存降级流量、完整订单状态机或权限、外部效果恰好一次；站点/ZIP/离线/手机由根代理另验。
