# 全站扩充最终集成记录

日期2026-10-25，主代理。最终已发布100篇；以下保留各轮快照和发现问题的过程，最终结论与线上字节见 expansion-100-release.md。

## 目录与兼容性

独立审计直接从历史a6768cf提取起点40篇：40条稳定ID、367原章节锚点、66条article→研习关联均保留，60道研习题的既有引用数组不变。最终目录的12分类目标分别为6/18/8/6/8/8/6/6/9/10/7/8，合计100；新增60，React18与Agent8本轮不扩写。审计见expansion-final-catalog-review.md。

Python九章按语言、函数迭代、对象、模块边界、并发选择、既有异步工程、FastAPI、数据访问、工程交付递进。AST独立审计未发现前序章节导入尚未讲解的后章运行代码；第六章沿用独立目录。第7～9章全课61项与第6章9项的范围分别记录，不把旧17/33阶段记录误称全部课程验收。

## 最后两篇的本机与下载验收

RN与交付篇分别经另一作者完成全文、7+9个实际源码连续节选、两张SVG、锁文件、README和失败链审校。另由不同作者独立复现并修正包不存在返回码、超时子进程组、HTTP线程收口及UI证据缺口。新native runtime清单SHA256为9428a74307152e04bb9b63422d98f1a20df6ca544d503b41ad234f22947892b2；对应真实CI提交9280ec30b31ecc08568e515ff10631dc06262db8。后续正文与根诊断注释另有收尾；唯一交付诊断工具增量f387及其已验来源见下文，App/依赖/构建输入没有暗改。

主代理从100篇审阅快照的两个真实ZIP重新解压，逐文件SHA核对冻结实现、锁文件、test_harness.py；独立Node24.14.1执行RN12/12、交付6/6，CPython3.12.14安全清理回归各3/3通过，无skip。没有在Mac安装SDK，也没有把这些安全子进程测试称为Android运行。另一作者已从各自全新副本实际npm ci、check及Metro/Hermes导出。

## 站内实际浏览

审阅快照树a445a01a265eb65e74342731e78788dea231a685：38/38回归通过；构建、217下载入口、136图形引用、349正文源码映射、86ZIP资源验证通过。既有大chunk警告保留，不声称本轮优化了首屏体积。

实际浏览器390×844：RN和交付正文宽/scrollWidth均390，代码高亮token分别1981/2014，下载链接指向正确slug ZIP与README；复制profile代码出现“已复制”。两图在手机放大容器310px、内容1000px，局部横向滚动；1280×900桌面实际看过完整箭头/标签，图形另有纵向滚动，不将整图压成不可读小字。目录真实显示100篇，跨平台8篇与Python9篇顺序均与curricula一致。

旧98离线缓存升级后保存1306资源、19.2MB，再完整刷新能读两篇新正文，未把旧98缓存中“文章不存在”当新路由失效。最终发布快照仍需再次更新离线包、停止源服务后完整刷新验收，结果续填。

## 真实Android与发布

真实构建与模拟器结果见下文；线上最终版本见 expansion-100-release.md。旧 build-only 记录不扩大成设备验收。

## 环境限制

本轮隔离Linux已真实验证systemd、Docker cgroup/OOM、nginx worker排空/回滚和单节点kind1.35.8；不外推多节点生产集群。WebGL已在浏览器实际编译、绘制、读像素和上下文恢复，不外推未知物理GPU/驱动矩阵。Android代表环境为API36 x86_64模拟器，不等于实体Android手机或iOS。Expo两套锁各保留6 high上游依赖告警，非生产认证；不包含生产签名、商店、OTA、native tombstone/dSYM验收。真实付费模型仍未调用。

## 两条原生链的最终事实

RN来源9280ec30b31ecc08568e515ff10631dc06262db8，run40142096678/job121016561255：13/13步骤success，无核心skip。实际API36 x86_64模拟器确认n1晚到丢弃、n2原生UI ready、真实后台暂停/返回前台重载、原生文件往返/缺失文件拒绝、系统定位权限弹窗点击拒绝（不读取位置）、自有应用卸载与夹具线程关闭。权限返回accepted=false表示当时资格已失效，不能冒称旧页面UI显示denied。

交付APK/map来自9280的run40142096668，该轮模拟器exit1，首错被旧注释裁断，不能证明与后轮同错。5f53573/run40143515607明确首等delivery_rendered超时、EVENTS=[]，未进入升级/符号化。根因没有证据，不按静态缺依赖推测归因。a834681f97a86f61182eada83d21e1cde48dea39/run40144174318/job121021896614复用同轮保留APK/map，通过差异断言确保App/依赖/构建源与9280相同，仅诊断工具f387b8fe另SHA校验；15/15核心步骤success。实际原生UI v1→v2、同证书升级保留假笔记、正确map定位controlledFailure、错release map拒绝、降级明确INSTALL_FAILED_VERSION_DOWNGRADE且重启仍v2/旧数据、自有清理均通过。不是build-only成功。

原生REST jobs/check/annotations由独立审稿人在限流重置后一次取回，保存work/expansion/native-final-*，与公开结果相符。公开网页同URL曾返回缓存旧In progress，根通过no-cache的唯一检查请求及另一作者复核纠正，没有无谓修改已经通过的RN源码。最终运行源逐文件摘要随仓库native-runtime-final-hashes.json保留；不把3天保留期的APK工件当永久分发链接。

## 离线资源修复的增量

真实离线ZIP导航曾返回首页HTML，修复为实际资源URL优先、仅应用入口/index.html导航补shell。旧实现用同一9条示例契约：原7过、新2失败；修后9/9。独立VM另确认二进制字节与响应头不变、缺失下载/独立HTML不伪装首页。文章、本站脚本与独立示例同步。

内容快照更新不能代替Worker脚本更新。DOWNLOAD显式register(updateViaCache:none)并update/等待新Worker；STATUS/CLEAR先复用精确scope已有注册。注册、更新、激活分别有15秒调用期限，不能取消浏览器底层update；监听器/定时器独立复核收口。实际HTTP观测到更新sw.js 200/304后，源停curl7，README开始返回文本而非首页。Python临时HTTP夹具未加charset造成文本解码差异，正式Vite最终快照另验，不因此修改源文本。

工具downloadMedia在源停时等待超时，不能据此断言浏览器普通点击下载失败，在线该工具可取得ZIP。当前文章下载采用页面fetch命中Worker，再把原字节Blob交给浏览器，拒绝HTML伪ZIP；fetch/响应体共用60秒期限并发出Abort，临时链接移除/对象URL60秒后回收。该头检查不替代完整ZIP内容验收。文章切换按ID重新创建下载状态，不把旧错误带到新文章；UI不假报用户已保存。最终真实Chrome离线文件与源码字节比对续填。

## 真实离线文件落盘

Chrome完整缓存1306资源后停止源4329，curl明确连接拒绝exit7；完整刷新文章后，通过普通可见链接点击实际保存Downloads/cross-platform-delivery (1).zip。文件79084字节，SHA256 4af0ced01a01fca43e018998d03fe38d0aed609c215e6120521c9761b17f35d9，与52项候选构建的ZIP逐字节一致；25条目、CRC检查无错误。这个结果来自真实落盘文件，不来自ZIP头的教学快速检查。工具downloadMedia离线等待超时是工具观测限制，不能用它取代正常点击与文件核验。

下载准备随后增加覆盖fetch与响应体的60秒总预算，以及失败时Abort释放；新增never-fetch、头到达后body悬挂与真实HTTP503持续body关闭三条检查，完整回归55/55。真实503测试自建loopback随机端口，失败后观察响应连接close并清理自有server，没有操作用户其他服务。组件按文章ID隔离pending/error，DOM构建/append/click异常路径均移除临时anchor并定时回收URL。最终55项发布快照构建及离线文件复验另见发布记录。

## 最终55项快照的离线复验

冻结源码树790b12918483c1113d745d64070efb865b64ff12，站点55/55通过、构建通过。离线清单1306资源、20198367字节。Chrome更新缓存后停止4329源服务，curl连接拒绝exit7，完整刷新仍可阅读RN工程。普通下载链接实际保存react-native-engineering.zip，87898字节、SHA256 c568ed9ef027a7050b7c1a1380d548de26b678ce92022aae5f7b239ebb20fb3d，与该冻结构建逐字节相等，24条目CRC无错误。

在同一断网状态切换离屏与后处理实验、点击运行并实际读取像素，得到rgba [84,93,130,255]、glError=0、WebGL2 Chromium、画布1216×912。此结果证明当前浏览器离线资源链可用，不外推实体GPU矩阵。发布与最终线上资源核对见 expansion-100-release.md。
