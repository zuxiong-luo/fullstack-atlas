# sql-execution-plans 作者验证

2026-10-24，状态review，待独立审稿与站点发布验收。

## 环境与命令

macOS14.5、Node22.12.0、pg8.13.1、PostgreSQL17.4；包树由package-lock.json固定。

    npm ci --ignore-scripts --prefix examples/sql-execution-plans
    npm test --prefix examples/sql-execution-plans

最终清洁安装13包成功，审计0告警；测试6/6通过，无跳过。所有数据库连接显式指定新建私有Unix socket与编号55445，不监听TCP，不连接用户5432。测试finally关闭池、停止实例、删除临时目录。

四例最初复用了过长的临时目录前缀，data-model/plan首轮因macOS Unix socket路径长度启动失败；改短前缀并在启动失败时附server.log后重跑通过。未把失败命令记为通过，也未改变用户数据库来修复。

## 实际证据

60000订单/1000客户。客户500：Seq Scan actual30/removed59970+Sort→Index Only actual20；Hash Join实际60000，聚合2组，与参照总额一致；work_mem64kB实际external merge/Disk（本机Gather Merge下Sort actual30000 loops2）；OFFSET actual10020 vs keyset20，同页结果相等；queued旧估1/实30000，首次ANALYZE估30009，最终清洁复现29963，抽样差异符合预期。

正文7块源码与对应实际文件连续原文匹配；终端命令不计入映射。不是只用篇数/章节数替代内容验收。

## 图形与依据

mechanism.svg通过XML解析并用QuickLook实际渲染查看。为了防缩略图裁切，仅在临时预览增加画布高度；原SVG保持横向比例。标签无溢出、引用/时间顺序箭头与代码和正文相符。

本批实际浏览PostgreSQL17约束、SET CONSTRAINTS、事务、EXPLAIN、统计、LIMIT/OFFSET、资源配置、READ COMMITTED、INSERT和唯一性检查官方文档；缓存另核对Redis Lua/EXPIRE文档及固定7.0.4 eval.c。文章保留近处代码和出处，不把外链当作实现。

## 尚未验证的范围

计划/cost/抽样估算/并行细节依环境变化；测试保护相同结果、目标访问工作与真实Disk机制。不把duration输出当吞吐、速度倍数或冷磁盘结果。只执行教学SELECT的EXPLAIN ANALYZE；未生产压测/远程存储验收。

站点文章浏览器/移动视口、ZIP最终内容、离线包与线上版本由主代理集成验收；作者不以SQL/CPU和桌面SVG图像检查替代这些结果。不改分类聚合，不提交/推送。
