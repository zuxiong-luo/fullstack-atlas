# React Native应用工程验证记录

2026-10-25，当前status=complete。文章约4177字说明性正文、7块真实路径源码、1张可编辑SVG。文章不要求另一示例已启动；离线源包目标react-native-engineering.zip，README路径react-native-engineering/README.md。类别index由根维护。

## 固定环境与官方核对

作者本机macOS14.5 x86_64，Node24.14.1、CPython3.12.14。没有本机Android SDK、模拟器或实体手机操作。锁Expo58.0.19/RN0.88.0/React+DOM19.3.0、router58.0.26、FileSystem58.0.11、Location58.0.19与template58.0.28。verify-config核对全部直接依赖、传递锁与已安装Expo官方bundledNativeModules；没有忽略peer冲突。Metro maxWorkers=2限制编译工作进程。

独立查阅：[Expo58 SDK](https://docs.expo.dev/versions/v58.0.0/)、[Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/)、[FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)、[Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/)，AppState核对已锁RN0.88源码与其[固定版本源码](https://github.com/facebook/react-native/blob/v0.88.0/packages/react-native/Libraries/AppState/AppState.js)。RN0.88部分网页文档工具不可达，未假称已读；初始化currentState及change/Android blur、focus区别按锁源码说明。

原生链锁compileAPI37.0/target36、buildtools37.0.0、NDK27.1.12297006、CMake3.30.5、AGP9.2.1、Gradle9.4.1、JDK17；运行代表API36 x86_64模拟器。依据[AGP9.2兼容表](https://developer.android.com/build/releases/agp-9-2-0-release-notes)。Google[repository2-3.xml](https://dl.google.com/android/repository/repository2-3.xml)实际channel0给出platforms;android-37.0/37.1/37.2，没有platforms;android-37。首轮fc117bf/run40140415954安装阶段失败，改精确安装包名和目录预检，不改compileSdk、不做symlink。

## 已执行的本机检查

在examples/react-native-engineering目录，使用Node24.14.1：

```sh
npm ci --ignore-scripts --no-fund
npm test
npm run check
npm run export:android
```

实际安装512包；最新纯JS **12/12**、配置0、Android Metro导出0，1172模块10.470s，2.6MB Hermes .hbc及metadata。初次ReactDOM自动19.3.1与React19.3.0冲突、gesture3.4超Expo~3.3，已明确锁DOM19.3.0/gesture3.3.0，npm ls depth0无peer问题。私有临时副本以本地固定模板tar实际prebuild成功；生成manifest/package/version1与Debug签名配置符合预期，未运行Gradle/SDK。私有副本已清理。

12项覆盖：有限ID、正常/错误、失焦abort、忽略取消的晚成功/晚失败、新代独立signal、恢复、订阅后AppState快照、native pending→pause→late→resume重试、busy/错误恢复、两调用独有目录交错清理、dispose→直接resume可见idle。Node作者另从独立干净临时副本npm ci、12/12/check/Android导出复现通过，不借用作者node_modules。

额外无SDK安全测试：

```sh
python3 -m unittest discover -s examples/react-native-engineering -p 'test_harness.py' -v
```

CPython3.12.14实际 **3/3**（约13.7s）。内部deadline及外部TERM均真实启动忽略TERM的自有子进程，确认自有group终止且直接child已reap；部分HTTP POST确认server_close等待请求线程。Data独立各项复跑通过，并额外验证正常leader退出后的后台group成员也被清理。报告docs/validation/review-cross-platform-native-harness.md。

两篇正文单独strict tsc退出0；完整路径代码7/7为真实文件连续原文，SVG XML有效。lifetime.svg实际QuickLook渲染并人工查看，文字/箭头/边界清楚，预览仅存ignored work/expansion，public只SVG。没有冒称站内浏览器/390手机视口或实体机验收。

## 首轮隔离构建与当时待验边界（历史）

根提供公开CI API及job结果：

- [run40140744999/job121011784053](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40140744999/job/121011784053)，head **396dafa22e96a42e216a02ceda649b389ba960fc**，Ubuntu24.04 runner、Node24.14.1/JDK17.0.20.1，SDK37.0/工具安装success，actual x86_64 release build与模板Debug签名检查 **success**。时间2026-10-24T22:57:50Z～23:10:43Z，即Asia/Shanghai10-25。这是较早快照的构建证据，不是最新源码或模拟器结果。
- 最新运行源码冻结清单work/expansion/native-runtime-frozen-2026-10-25.json，清单SHA256 **9428a74307152e04bb9b63422d98f1a20df6ca544d503b41ad234f22947892b2**。关键build_android.py a4667c48c90705b2fee8a238712ce311eff035a803c9b66bc1359d0df864d169；verify_emulator.py 4cbf8518f8dcc85d06458c90278627a2f7aac5a80eb8b36f94d20ccc1833c164。源码自冻结后逐SHA核对未变。
- 根已推最终含模拟器提交 **9280ec30b31ecc08568e515ff10631dc06262db8**，[run40142096678](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40142096678)，本记录写入时尚未返回运行结果。不得提前标通过。

最新待执行的是：真实APK安装、路由blur释放旧gate→n2 ready、原生UI JSON层级+截图、HOME background/pause/active恢复、真实native File往返/缺文件拒绝、系统定位弹窗拒绝、不读取位置，最后卸载自己的新装假包/删own XML/关闭夹具线程。guard要求LinuxCI、明确emulator serial、qemu1、x86_64，已有同包名拒绝。HTTP gate在CONDITION里AUTO_RELEASE避免清理中新gate竞态；连接3秒、gate12秒、ADB/事件均有截止。

独立审稿抓到pm path未安装返回1误判、旧GNUtimeout wrapper遗留child、daemon请求线程未join、初始AppState及能力resume UI窗口等，均修复并有对应本机安全回归。原生UI层级与PNG工具已补，真正Android执行仍待上述CI。SIGKILL/主机故障或主动逃离自有session的恶意子进程不在用户态清理保证内。

npm audit重新按最终锁取报告，**6high、0critical**，完整audit-report.json随示例。node-forge签名校验、Zod及Expo CLI/模板上游链保留真实告警，不作不兼容major override。没有生产签名、商店、实体手机/iOS、真实位置、native崩溃或性能收益结论。

最终独立全文审稿纠正两处文档歧义：RN不再把离线同步专题称为前篇；两例README和正文CI终端统一从示例根执行 `bash ./verify-android.sh`，ZIP不要求不存在的examples前缀。仅文档修改，冻结runtime SHA不变。

## 2026-10-25 最终冻结源码完整模拟器验收：通过

当前状态 **complete**。上面的“尚未返回/待执行”属于首轮历史，本节为最终结果；RN的9280运行源码未发生诊断增量，与原冻结清单逐SHA相同。

- [run40142096678/job121016561255](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40142096678/job/121016561255)，提交 **9280ec30b31ecc08568e515ff10631dc06262db8**，Success，run17m52s、job14m。根通过no-cache+唯一status_check公开页读取，保存work/expansion/native-rn-public-fresh.html/.txt；Node另独立fresh公开页确认，保存work/expansion/native-final-rn-public-independent.json。不是API原始step JSON，稍后API可作补充；先前web缓存In progress属于观察缓存，不是运行失败。
- 实际 **API36/x86_64/emulator-5554/physical_device=false**。native_navigation_and_late_result：old=discarded/current=n2/native_ui_hierarchy=true；UIAutomator精确Text和PNG采集断言通过，作者未另人工查看CI截图。
- native_appstate：background_paused=true/resume_loaded=true。证明真实HOME/Activity恢复路径；不覆盖Android通知抽屉blur/focus全部交互失焦。
- actual_native_files：status=ok、roundTrip=true、missingRejected=true、accepted=true，原生成功与缺文件分支均真实执行。
- actual_android_permission_denied：status=denied、granted=false、canAskAgain=true、accepted=false，location_read=false。该accepted=false准确反映授权期间资格变化后丢弃旧UI结果；此次证据是系统拒绝返回及代际丢弃，不能宣称旧页面最终显示denied。没有位置读取。
- cleanup：own fake app uninstalled, fixture threads stopped；仅自己新建假包、own XML及HTTP夹具。

JS12/12、安全清理3/3、独立干净安装与导出、源码映射7/7、图与类型检查证据仍有效。无实体手机/iOS/生产签名/商店/native crash/性能收益，audit6high仍保留。
