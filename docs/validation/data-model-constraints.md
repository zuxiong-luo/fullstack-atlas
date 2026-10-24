# data-model-constraints 作者验证

2026-10-24，状态review，待独立审稿与站点发布验收。

## 环境与命令

macOS14.5、Node22.12.0、pg8.13.1、PostgreSQL17.4；包树由package-lock.json固定。

    npm ci --ignore-scripts --prefix examples/data-model-constraints
    npm test --prefix examples/data-model-constraints

最终清洁安装13包成功，审计0告警；测试9/9通过，无跳过。所有数据库连接显式指定新建私有Unix socket与编号55444，不监听TCP，不连接用户5432。测试finally关闭池、停止实例、删除临时目录。

四例最初复用了过长的临时目录前缀，data-model/plan首轮因macOS Unix socket路径长度启动失败；改短前缀并在启动失败时附server.log后重跑通过。未把失败命令记为通过，也未改变用户数据库来修复。

## 实际证据

CHECK(NULL)通过但NOT NULL拒绝23502；负库存23514；同租户重复SKU23505；复合拥有者/商品外键23503。历史总额2000不随现价1500变化；延期外键补父成功，漏补COMMIT23503；失败事务25P02直到ROLLBACK。NULLS NOT DISTINCT实际拒重复NULL，合法状态集合仍允许不合业务的转换。

正文4块源码与对应实际文件连续原文匹配；终端命令不计入映射。不是只用篇数/章节数替代内容验收。

## 图形与依据

mechanism.svg通过XML解析并用QuickLook实际渲染查看。为了防缩略图裁切，仅在临时预览增加画布高度；原SVG保持横向比例。标签无溢出、引用/时间顺序箭头与代码和正文相符。

本批实际浏览PostgreSQL17约束、SET CONSTRAINTS、事务、EXPLAIN、统计、LIMIT/OFFSET、资源配置、READ COMMITTED、INSERT和唯一性检查官方文档；缓存另核对Redis Lua/EXPIRE文档及固定7.0.4 eval.c。文章保留近处代码和出处，不把外链当作实现。

## 尚未验证的范围

不是完整订单状态机、跨行汇总维护、支付或授权实现；整数货币仍有范围/币种/舍入边界。CHECK与外键只兑现表达式本身，不把关系存在误称权限成立。

站点文章浏览器/移动视口、ZIP最终内容、离线包与线上版本由主代理集成验收；作者不以SQL/CPU和桌面SVG图像检查替代这些结果。不改分类聚合，不提交/推送。
