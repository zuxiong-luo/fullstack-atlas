# cache-consistency 作者验证

2026-10-24，状态review，待独立审稿与站点发布验收。

## 环境与命令

macOS14.5、Node22.12.0、pg8.13.1、PostgreSQL17.4；包树由package-lock.json固定。

    npm ci --ignore-scripts --prefix examples/cache-consistency
    npm test --prefix examples/cache-consistency

最终清洁安装13包成功，审计0告警；测试7/7通过，无跳过。所有数据库连接显式指定新建私有Unix socket与编号55447，不监听TCP，不连接用户5432。测试finally关闭池、停止实例、删除临时目录。

四例最初复用了过长的临时目录前缀，data-model/plan首轮因macOS Unix socket路径长度启动失败；改短前缀并在启动失败时附server.log后重跑通过。未把失败命令记为通过，也未改变用户数据库来修复。

## 实际证据

真实PG+Redis7.0.4。屏障确定R读v1→W提交v2并DEL→R旧回填，观察缓存v1/DBv2；加代际后旧发布拒绝并重读v2。真实停止自建Redis56382，DB+pending仍提交、查询转库stored=false，恢复重放成功；失效后未标记的故障可重放且每次新代际；DEL模拟整键丢失并拒旧发布；DB+Outbox回滚，错误租户缓存当miss。

正文7块源码与对应实际文件连续原文匹配；终端命令不计入映射。不是只用篇数/章节数替代内容验收。

## 图形与依据

mechanism.svg通过XML解析并用QuickLook实际渲染查看。为了防缩略图裁切，仅在临时预览增加画布高度；原SVG保持横向比例。标签无溢出、引用/时间顺序箭头与代码和正文相符。

本批实际浏览PostgreSQL17约束、SET CONSTRAINTS、事务、EXPLAIN、统计、LIMIT/OFFSET、资源配置、READ COMMITTED、INSERT和唯一性检查官方文档；缓存另核对Redis Lua/EXPIRE文档及固定7.0.4 eval.c。文章保留近处代码和出处，不把外链当作实现。

## 尚未验证的范围

Redis采用自己的127.0.0.1:56382与临时AOF目录，不连接用户6379；真实stop/start是本机单实例故障，不是复制/集群切换测试。TTL60只是配置，本次DEL模拟整键丢失，不声称完成真实TTL计时验证。随机代际非持久单调fencing；DB提交到失效有旧读窗口；Lua不提供SQL式失败回滚；缓存故障容量与多worker调度未验。

站点文章浏览器/移动视口、ZIP最终内容、离线包与线上版本由主代理集成验收；作者不以SQL/CPU和桌面SVG图像检查替代这些结果。不改分类聚合，不提交/推送。
