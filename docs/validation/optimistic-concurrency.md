# optimistic-concurrency 作者验证

2026-10-24，状态review，待独立审稿与站点发布验收。

## 环境与命令

macOS14.5、Node22.12.0、pg8.13.1、PostgreSQL17.4；包树由package-lock.json固定。

    npm ci --ignore-scripts --prefix examples/optimistic-concurrency
    npm test --prefix examples/optimistic-concurrency

最终清洁安装13包成功，审计0告警；测试8/8通过，无跳过。所有数据库连接显式指定新建私有Unix socket与编号55446，不监听TCP，不连接用户5432。测试finally关闭池、停止实例、删除临时目录。

四例最初复用了过长的临时目录前缀，data-model/plan首轮因macOS Unix socket路径长度启动失败；改短前缀并在启动失败时附server.log后重跑通过。未把失败命令记为通过，也未改变用户数据库来修复。

## 实际证据

两个连接先读同v1后CAS一胜、最终v2。无条件旧值覆盖确定性丢意图。第一回执占位屏障后，pg_blocking_pids确认第二事务真正等待唯一键；释放后同结果、只扣1。同键异载荷冲突，租户key隔离；提交前异常回滚效果/回执；提交后响应异常同键恢复；不同key争最后1件一胜一失败，库存0/成功回执1。

正文6块源码与对应实际文件连续原文匹配；终端命令不计入映射。不是只用篇数/章节数替代内容验收。

## 图形与依据

mechanism.svg通过XML解析并用QuickLook实际渲染查看。为了防缩略图裁切，仅在临时预览增加画布高度；原SVG保持横向比例。标签无溢出、引用/时间顺序箭头与代码和正文相符。

本批实际浏览PostgreSQL17约束、SET CONSTRAINTS、事务、EXPLAIN、统计、LIMIT/OFFSET、资源配置、READ COMMITTED、INSERT和唯一性检查官方文档；缓存另核对Redis Lua/EXPIRE文档及固定7.0.4 eval.c。文章保留近处代码和出处，不把外链当作实现。

## 尚未验证的范围

只验证本地READ COMMITTED数据库协议。result占位不应在服务正常路径以空提交，任意SQL写坏数据不在保证内；COMMIT通信中断可能结果未知，不能因本地标记/ROLLBACK尝试断言没提交。无外部支付/邮件恰好一次或自动冲突合并。

站点文章浏览器/移动视口、ZIP最终内容、离线包与线上版本由主代理集成验收；作者不以SQL/CPU和桌面SVG图像检查替代这些结果。不改分类聚合，不提交/推送。
