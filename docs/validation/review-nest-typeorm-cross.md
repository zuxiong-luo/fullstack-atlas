# Nest / TypeORM 前四篇：Node 作者只读交叉审稿

2026-10-25。审阅者未改动Nest/TypeORM作者文件，没有重新执行作者所有数据库用例；实际1/2/5/4用例的独立复跑证据来自主代理`review-nest-typeorm-benchmarks.md`，本记录不重复冒领。

已逐段读四篇正文，以及Nest两章app/test/main/missing、TypeORM两章model/lab.test/运行器与锁定package。对照Nest官方Injection scopes/Request lifecycle页面，并检查安装包TypeORM1.1.2配置/实现和真实断言。官方文档会更新，精确版本结论以锁文件、该版实现和已执行用例为边界。

## 内容与代码一致性

- Nest第一章有概念、三职责、bootstrap到注册监听，再介绍请求阶段与四种结果；固定演示token/内存存储的边界明确。Guard失败未进入Interceptor，Pipe/Handler错误可见；成功x-trace是tap快照，不冒充finalize之后的追踪。
- Nest第二章区分模块文件import与容器imports/exports、token与scope；singleton以应用容器为边界、request scope传播、transient按消费者身份，代码和HTTP断言一致。生命周期不误用于request-scoped逐请求清理；循环依赖没有伪称做过成功实验。
- TypeORM基础有真实PG约束、save/insert/update返回语义、参数化值与标识符白名单、空对象/undefined/null高层与QueryBuilder分层。不是把TypeScript类型当数据库约束，destroy嵌套finally收口已修正。
- 关系篇复合外键跨租户失败、1+3 SELECT与JOIN一条、raw4/parent3、take父项与limit行区别都和测试一致；Date微秒截断示例正确表现为重复[1,2]，精确游标为[2,3]，不把id排序键当作恢复精度。numeric文本与Number失真按精度定义。
- 四篇关键实现均在正文；出处引用不承担补齐运行代码的责任。测试/示意/生产边界分开，没有速度收益编造。

## 非阻塞编辑建议（已反馈主代理）

TypeORM关系篇ownership段“每条列表查询仍应tenant WHERE”，而实验为了比较三位Owner有意跨租户查全量。建议就地说明“本章内部数据库实验故意跨租户观察结构，不是对外列表接口；外部接口仍必须从可信上下文过滤租户”。这不改变N+1=4或复合外键的证据，只消除读者对实验是否承担鉴权的误会。正文已经声明未完成认证，未发现阻塞性安全或机制错误。

## 范围

本轮不把源码静态阅读替代真实E2E/PG验证；页面移动视口、图形、下载与离线仍由主集成验收。TypeORM GitHub猜测的1.1.2无前缀tag URL未成功打开，因此未作为文章引用或正确性证据；使用已安装锁定包和主已执行结果，避免给不存在的源码位置背书。
