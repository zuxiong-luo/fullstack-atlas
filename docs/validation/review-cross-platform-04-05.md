# React Native与跨平台交付：独立审校记录

2026-10-25，审稿者expansion_node。已完整读取react-native-engineering与cross-platform-delivery最终正文、示例、README、锁、图形和验证记录。**正文/源码/本机复现审校通过；后续独立公开证据已确认两条API36 x86_64代表模拟器链成功，见文末补验。**前面的待返回文字保留为当时历史；实体设备与其他平台边界保持明确。未修改作者运行源码、共享索引或CI。

## 独立实际结果

环境macOS14.5 x64、Node24.14.1、CPython3.12.14。两套临时副本独立安装依赖，没有复用作者node_modules、没有安装本机SDK或操作设备。

| 检查 | RN工程 | 跨平台交付 |
|---|---|---|
| clean npm ci --ignore-scripts --no-fund |512包，audit6high|459包，audit6high|
| npm test |12/12，无skip|6/6，无skip|
| npm run check |0，精确锁与Expo bundled一致|0，原生版本/profile一致|
| 独立Android JS/Hermes导出 |0，2.6MB.hbc+metadata|0，638模块，1.3MB.hbc+3.9MB.map|
| CPython无SDK test_harness.py |3/3，13.762s|3/3，13.763s|
| 正文完整路径连续原文 |7/7|9/9|
| 已交付SVG均引用且实际渲染 |1/1|1/1|
| 独立strict tsc内容检查 |0|0|

命令在各示例根执行：npm ci --ignore-scripts --no-fund、npm test、npm run check、node node_modules/expo/bin/cli export --platform android --output-dir dist --max-workers 1；交付篇另加--source-maps。清理测试使用CPython3.12.14执行python -m unittest discover -s . -p test_harness.py -v，真实运行忽略TERM的自有进程、外部TERM与半个POST线程收口，不是接口模拟。

临时证据在macOS临时目录atlas-rn-independent-tl6ff0es与atlas-rn-independent-57t_kvjj，保留源码SHA、step日志和小型导出；重复node_modules已删除，释放约700MB。冻结后复比运行源码与锁均未变化，变化仅为最终README/audit记录；这些文档已重新完整读取。没有把旧快照代码冒充最终运行源。

## 机制与代码自足性

RN正文先区分导航屏幕、AppState与原生调用三种寿命，再引入focus+active资格、代际发布与尽力abort。白名单业务ID不直接成为系统路径；当前代成功和失败都检查归属，原生能力不可取消与副作用不可回滚明确。全文展示完整session、Provider、详情、原生端口及依赖，理解关键逻辑不要求跳站看代码。

能力会话暂停会发布idle，dispose不向卸载UI发布；重新取得资格也重置可见idle。旧操作晚到仍丢弃，新代可重试，busy防止同一有效代重入。原生File每调用拥有独有cache子目录，拒同名创建，finally只删本次资源；没有用UI代际冒充本机资源隔离。只请求定位授权，不读取真实坐标；Android通知抽屉blur/focus没有被夸大为AppState.change覆盖。

交付正文把versionCode/versionName/releaseId/schema分开。真正读取native身份，开发容器不算独立包；同证书替换安装和未变schema的数据保留分别验证。两版都schema1，因此没有声称任意迁移安全；降级负例要求明确INSTALL_FAILED_VERSION_DOWNGRADE，不接受任意非0错误。

APK/map分别SHA256并绑定有限release记录；错release元数据提前拒绝，再用锁定Metro工具符号化。报告可同时被篡改时hash不提供独立真实性；捕获JS Error并不导致native进程崩溃，未宣称tombstone/dSYM或OTA回滚已验。release变体仍用模板公用Debug证书，不是生产或商店签名。

## 预审发现与闭环

- 初始AppState可能在render到effect之间由null变active、无后续事件；改为先订阅再读快照，独立回归通过。
- 退休原生能力时只丢弃结果会留下running UI；最终能力会话处理pause→idle→resume，以及dispose后直接resume可见状态。12项中含pending、晚到、重试与错误恢复受控回归，审稿者复跑通过。
- 独有目录交错完成只清自己，不能因旧finally删除下一代文件；同clock两调用回归实际通过。
- 最终README明确仓库cd examples/<id>或进入ZIP解压目录，统一bash ./verify-android.sh及unittest -s .；源码ZIP不依赖不存在的examples/前缀。RN错误“前篇”阅读顺序已改专题名称。
- Data另独立审校修复pm path未安装返回1、timeout包装器遗留child与请求线程关闭。此审稿已读最终run/session/Fixture实现，并实际复跑两套3/3；不借用Data额外观测冒充自己运行过。

## 来源与图形

独立核对Expo v58 Router/FileSystem/Location/Application、环境变量、Android版本/签名、AGP9.2兼容表，及RN0.88已锁AppState与Router实现。RN0.88文档页不可达，不当成已读；GitHub v0.88.0 AppState固定源码本次实际可读。AGP9.2官方表支持37.0、Gradle9.4.1、JDK17，与锁环境一致。

- https://docs.expo.dev/versions/v58.0.0/sdk/router/
- https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/
- https://docs.expo.dev/versions/v58.0.0/sdk/location/
- https://docs.expo.dev/versions/v58.0.0/sdk/application/
- https://github.com/react/react-native/blob/v0.88.0/packages/react-native/Libraries/AppState/AppState.js
- https://developer.android.com/build/releases/agp-9-2-0-release-notes
- https://developer.android.com/studio/publish/versioning
- https://developer.android.com/studio/publish/app-signing
- https://docs.expo.dev/guides/environment-variables/

lifetime.svg与artifacts.svg经XML解析、1100方形外框QuickLook实际渲染并逐张查看，文字无溢出、状态/所有权/构建与数据箭头和代码一致。临时PNG在/tmp/atlas-rn-delivery-review-render，未把桌面矢量图检查说成移动原生UI验收。

## 原生CI证据与剩余范围

已从GitHub公共job API独立确认旧快照两job completed/success及全部核心步骤success：

- RN head396dafa22e96a42e216a02ceda649b389ba960fc，[run40140744999/job121011784053](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40140744999/job/121011784053)：固定工具安装与实际x86_64 release/模板Debug签名检查success。
- Delivery headb35dee2f2522c3434dc401fee5ffac458b814551，[run40140950248/job121012385910](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40140950248/job/121012385910)：实际双APK、Hermes组合map与Debug证书核心步骤success。

未冒称匿名读过完整stdout或本机重跑native构建。两commit只是对应快照工具链证据，不能替代最新9280ec30b31ecc08568e515ff10631dc06262db8的模拟器结果。根代理负责待返回的实际安装、路由/UI层级与PNG、前后台、文件与权限系统弹窗、同证书升级/数据保留/错误栈符号化/降级拒绝及清理；本记录写入时不提前标通过。

两锁仍各audit6high，不做不兼容major override遮盖上游告警。实体Android手机、iOS/其他ABI/商店/生产签名/真实位置/native进程崩溃/OTA/跨设备性能没有验收。JS/Hermes导出、native构建、模拟器、实体机是四层证据，本文保持区分；文章继续review，最终站点/390px/离线ZIP由根代理另验。

## 最终代表模拟器补验：2026-10-25

独立读取公开GitHub运行摘要及实际断言注释；这里是公开HTML解析证据，不冒称REST原始jobs/check JSON，也不冒称在本机启动Android。重复打开相同URL曾得到缓存的In progress，随后使用新的status_check查询独立确认真实完成结果，未把浏览器加载状态当作CI事实。

- RN冻结9280，[run40142096678/job121016561255](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40142096678/job/121016561255)：Success，run17m52s/job14m。API36/x86_64/emulator-5554，physical_device=false；实际路由晚到结果丢弃、current=n2、原生UI层级，AppState后台暂停与恢复加载，原生文件roundTrip/missingRejected，真实Android权限拒绝且location_read=false，以及自建包卸载/夹具线程关闭均通过。独立摘要保存在work/expansion/native-final-rn-public-independent.json。
- Delivery，[a834681/run40144174318/job121021896614](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40144174318/job/121021896614)：Success，job2m48s。只复用9280保留APK/map，workflow先断言App、锁、构建输入不变，仅允许verify_emulator.py诊断增量，再核SHA256 f387b8feb7437092bf2b96825fb5553304d44e0db474f4d6e3f6f090f0e87db4。API36/x86_64实际安装/启动、原生UI层级、同证书v2升级保留数据、真实捕获JS栈符号化、错release map拒绝、拒绝降级仍v2/数据不变及清理均通过。受控ATLAS_CONTROLLED_JS_FAILURE是已捕获JS Error，不是原生进程崩溃。公开完整解析结果保存在work/expansion/native-recheck-a834681-public-web.json。

Delivery历史9280模拟器步骤exit1，旧注释截断没有保留完整Python首错；5f53573重跑才拿到精确首次delivery_rendered等待超时、EVENTS=[]。不能把这两个历史失败都写成已经证实的同一个首错；也不能把本轮同APK成功归因于Metro或未经证实的环境原因。显式安装符号化依赖修复独立的工作流依赖缺口，但5f53573仍在符号化之前失败，因此它不能解释首次事件为空。

上述成功关闭的是两个单一代表模拟器链的可运行性验收，未证明CI每次启动无波动。实体Android、iOS、生产签名/商店/OTA、真实位置读取、native进程崩溃仍无验收；依赖audit6high仍保留。站内、390px、离线及ZIP最终检查由根代理独立完成，不借用模拟器结果替代。

已再次只读复核作者最终回填的两篇正文/README/验证记录：Delivery明确只有5f53573保留精确EVENTS=[]首错，9280首错未完整保留；RN明确权限事件accepted=false，系统拒绝返回可以记录但未归属旧UI，因此没有声称旧页面最终显示denied。正文结论与公开运行断言一致，当前未发现剩余内容阻塞。两篇complete只适用于已声明范围，不代表依赖安全审计或所有原生平台完成。

00:01:43 UTC配额重置后，另独立读取并保存三job的REST jobs、check-run与annotations原始JSON，未反复轮询：work/expansion/native-final-rn-job-121016561255-final.json（RN13/13步骤全部success）、native-final-delivery-recheck-a834681-job-121021896614-final.json（Delivery重跑15/15步骤全部success），以及相同前缀的check-<job-id>.json和check-<job-id>-annotations.json。SDK/构建/实际模拟器/工件上传，以及重跑的源差异/hash核验、下载原APK与npm ci均为实际success，无核心步骤跳过；真实断言与前述公开HTML一致。历史native-final-delivery-job-121015782374-final.json保留原9280失败：真实emulator失败，setup-node收尾步骤skipped，其余构建核心成功；截断的旧注释仍不足以识别Python首错。证据收集已完成，不再请求CI重跑或状态轮询。
