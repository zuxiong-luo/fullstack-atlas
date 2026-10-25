# 全站扩充最终目录与保留性独立审计

2026-10-25，审稿人 expansion_data。只读核对目录、文章身份、章节锚点、研习关联和Python课程依赖；没有重跑已验的数据库、移动端、GPU等环境，没有改聚合、全局进度表或共享代码。结论：当前98篇聚合及另外两篇已落盘审阅稿构成批准的100篇目录，原有身份与关联保留；**最后两篇仍待真正原生验收与最终聚合，不在本记录宣称100篇已完成或上线。**

## 1. 数量与分类核对

直接加载src/data/articles.ts的实际聚合、src/data/topicCurricula.ts以及两份尚未聚合的独立文章模块，不按文件名数量估算。

| 分类 | 当前聚合 | 最终目录（含待验两篇） |
|---|---:|---:|
|身份认证与安全|6|6|
|React 核心原理|18|18|
|数据与并发|8|8|
|可靠的异步系统|6|6|
|部署与故障排查|8|8|
|跨平台工程|6|8|
|Next.js 全栈|6|6|
|Node.js 工程|6|6|
|Python 工程|9|9|
|算法与数据结构|10|10|
|WebGL 与图形|7|7|
|AI / Agent 工程|8|8|
|合计|98|100|

最终100个ID互不重复，与74章规划加原React/Agent26篇的完整集合逐项相等：无缺失、无意外增加；12个分类均与批准目标精确相符，均达到至少四篇。当前差额仅为跨平台分类的 react-native-engineering、cross-platform-delivery；两篇正文文件确已存在，当前状态均review，分别7节、8节，未因落盘提前加进已发布数量。

topicCurricula有**10个扩充分类、74个章节**：phase0既有14、phase1新增28、phase2新增32。React18与Agent8沿用各自现有目录，未重复塞进topicCurricula；74+18+8=100。因此不是curricula漏了26篇。所有规划ID唯一，学习目标和前置知识已有数据；现有文章均属于其批准分类，十个扩充分类的实际筛选阅读顺序与curricula中已存在章节的顺序一致。原React18与Agent8保留，不以本次目录核对替代重新审查这些历史正文的所有运行环境。

## 2. 从真实历史快照核对保留性

起点为进度表记载的 `a6768cfac1017dff3044662d456051d35da3adb5`。使用git archive把该提交的src/data提取到独立work目录，分别加载历史与当前TypeScript模块，避免只相信后来生成的基线文件。

实际核对结果：

- 起点**40篇文章ID全部存在**，分类未改变，没有用新ID替代旧文章。
- 起点**367个章节id全部保留**；允许另加章节，未要求新增后章节数量相等。渲染仍使用section-加原id，原章节锚点命名规则未换。
- 原40篇的**66条article→question关联**逐篇、按原数组比对一致；60道原研习题ID仍全部存在，题目自身的related关联数组也逐项不变，当前文章引用均能解析到真实题目。
- docs/validation/article-identities-baseline.json与从起点提交实际取得的40篇id/topic/sectionIds/questionIds完全一致，不是拿当前新增目录反向生成后自证兼容。
- 评论仍以article/加稳定文章id作为specific term；Comments.tsx与起点无diff。未改成标题映射，不会仅因正文标题润色而换讨论入口。
- 学习记录src/lib/storage.ts与起点无diff：KEY仍fullstack-atlas:v1，version1与按题id保存records的协议不变。Agent八章数据src/data/series.ts也无diff，既有前后章身份仍保留。

这些是静态身份和协议保留证据，不声称重新读取了用户每个浏览器的本地存储，亦不替代线上评论服务可用性检查。

## 3. Python九章的阅读与实现依赖

目录实际顺序如下；第六章保留既有独立文章/示例，不存在“缺少chapter06文件夹所以少一章”的情况。

|顺序|稳定ID|实现入口与依赖边界|
|---|---|---|
|1|python-language-foundations|python-course/chapter01，数组导入脚本独立运行，只用标准库|
|2|python-functions-iteration|chapter02，前置第1章；JSONL与生成器独立入口|
|3|python-object-model|chapter03，前置迭代与输入校验；Note/Notebook独立阶段|
|4|python-modules-boundaries|chapter04，收拢前三章领域、转换、异常和CLI边界|
|5|python-concurrency-models|chapter05，复用第4章Note/codec/errors，解释线程、进程和asyncio选择|
|6|python-async-services|原独立examples/python-async-services；标准库TaskGroup、timeout、取消与finally，不导入未讲HTTP/数据库|
|7|python-fastapi|chapter07，复用第4章Note，组合第5/6章概念；运行不要求第8/9章代码|
|8|python-data-access|chapter08，复用第4/7章对象与HTTP边界，加入SQLite；不依赖第9章打包|
|9|python-delivery|chapter09，基于第7/8章语义形成独立src安装快照、配置/锁/构建/安装验收|

独立AST扫描当前阶段运行文件中的chapterNN导入：第1～4章无跨章运行依赖，第5章只回引4，第7章只回引4，第8章只回引4和7，第9章运行快照使用自身包命名空间；**未发现向后续尚未讲解章节的运行导入**。第6章独立标准库示例的README、文章范围和入口与目录一致。

前五章标准库课程、独立第6章、第7章锁依赖以及第9章运行/构建锁之间界限清楚。已有独立验证记录的33项、独立第6章9项、安装后全课程61项各有不同范围，本审计未重复运行，也不将它们相加伪称新的验收数量。

## 4. 全局状态与本次发现的陈旧说明

全局进度表对topicCurricula的**74章均有且仅有一条状态行**，没有规划ID遗漏。阶段一28篇及阶段二已发布30篇共58个新增章节标已完成，既有14行标已有；最后两个新增章节当前标待审校。React18与Agent8在范围说明中明确保留，不是本轮新增60篇进度行的遗漏。

审计开始发现两处不一致，已向负责作者报告并复读修正版本：

1. RN工程与交付两行仍为“待编写”，与文件落盘、runtime冻结不符；主代理已改“待审校”。没有提前改成已完成。
2. Python课程根README前文仍说FastAPI/数据访问/交付尚未实现，后部标题仍说尚待审稿；课程作者已只修文案，补当前1～5、独立6、7～9全景与依赖，并保留17/33历史阶段范围和61/独立9事实。未改源码。

已发布批次的49→56→68→95→98数字与增量9/7/12/27/3一致；进度表最后一条明确只余RN工程和交付未验收，没有把旧95篇阶段中的“还余5篇”当当前状态。98篇发布证据见expansion-stage-02-98-release.md；本审计没有再次请求线上资源或复测环境。

## 5. 仍需主代理收口的条件

最后两篇的原生CI来源提交由主代理指定为 `9280ec30b31ecc08568e515ff10631dc06262db8`，真实模拟器仍在运行。本记录只确认目录与待验状态，不能据此宣称APK、模拟器UI/权限/生命周期、双版本升级保留数据或真实source-map符号化已通过。

两篇真正通过后，主代理再聚合、更新全局状态、执行最终待提交快照的回归/构建与站点、下载、离线、线上版本验收；若环境仍受阻，继续保持准确状态，不用文件存在替代完成。此前Android/iOS实体设备、生产签名/商店、真实付费模型等限制继续按各批记录列出。

本次机器可读审计快照：work/expansion/catalog-final-review.json；历史只读提取：work/expansion/catalog-baseline-a6768cf。该快照记录审计时98篇状态，后续聚合到100需以新发布记录为准。
