# 全站升级：服务、协议、数据与离线批次

2026-10-23。本批9篇：Node、Python、Next、OAuth、Web安全、事务、可靠任务、离线、Kubernetes。每篇保留既有文章ID、原节ID与研习关联；章节可增加，评论topic不变。

## 实际证据

- Node10项、Python9项（3.14.3与主代理补跑3.12.14均通过）、Next8项、OAuth10项+HTTP smoke、Web安全11项+HTTP smoke、数据库/任务各6场景（Node含顶层各7项）、离线7项、K8s5项本地检查。准确环境与限制分别见对应专题VALIDATION/示例VERIFICATION。
- Next生产构建与真实Data Cache/Route Handler/账户隔离/错误路径通过，框架版本固定；不用React18源码解释React19的框架运行行为。
- 主站30项测试和生产构建通过；public prose检查兼容有序内容块，不再假定旧paragraphs数组承载正文。
- 主代理浏览器抽查Node文章、目录、代码配色、背压与生命周期SVG；图形资源实际加载。其他图已静态核验，未将抽样视图等同全部移动设备验收。
- 独立发布快照中的9个ZIP及离线manifest均检查存在。Next下载包含.env.example但不含.env.local/.next/node_modules/data；数据库ZIP包含schema.sql。新增Dockerfile、SQL、Dart、YAML等源码格式白名单，仍排除环境、缓存及构建输出。

## 尚未完成

Kubernetes没有kubectl、容器运行时或实验集群，故只发布完整待验证演练与明确标记的本地检查；集群部分不计完成验收。未运行生产TLS/代理、多实例、真实OAuth提供商、付费模型或真实业务压测。浏览器配额/多标签离线升级仍有专用验证缺口。

本批页面均保持审阅稿状态，正文直接给关键代码，出处只是追溯。后续算法、WebGL、跨端与Agent继续按计划推进。
