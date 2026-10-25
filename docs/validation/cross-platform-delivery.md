# 跨平台交付验证记录

2026-10-25，status=complete。约4036字说明性正文、9块真实路径完整源码、1张编辑SVG。独立工程cross-platform-delivery.zip，README为cross-platform-delivery/README.md；无其他示例导入、无类别index修改。

## 固定环境与来源

本机macOS14.5 x86_64、Node24.14.1/CPython3.12.14；无本机SDK/设备操作。Expo58.0.19、RN0.88.0、React+DOM19.3.0、FileSystem58.0.11、Application58.1.2、template58.0.28、metro-symbolicate0.87.1，完整package-lock。官方Expo bundled预期与直接依赖一致，verify-config实际通过。

代表链Android x86_64：compileAPI37.0、target36、runAPI36分别解释；buildtools37.0.0、NDK27.1.12297006、CMake3.30.5、JDK17/AGP9.2.1/Gradle9.4.1。官方核对：[Expo58 Application](https://docs.expo.dev/versions/v58.0.0/sdk/application/)、[FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)、[Android版本与降级](https://developer.android.com/studio/publish/versioning)、[Android签名](https://developer.android.com/studio/publish/app-signing)、[Expo构建说明](https://docs.expo.dev/deploy/build-project/)、[AGP9.2](https://developer.android.com/build/releases/agp-9-2-0-release-notes)。[RN官方发布调试页](https://reactnative.dev/docs/debugging-release-builds)用于Hermes符号化概念参考，网站0.88固定页不可达，不伪称已读固定网页；实际构建实现锁RN0.88.0。

## 本机实际命令

```sh
# 在examples/cross-platform-delivery，使用Node24.14.1
npm ci --ignore-scripts --no-fund
npm test
npm run check
npm run export:android
# 仓库根，无SDK/ADB操作
python3 -m unittest discover -s examples/cross-platform-delivery -p 'test_harness.py' -v
```

安装459包/audit460；纯JS **6/6**（profile身份、版本、未知/secret字段、schema渠道与有限字节hash/map误配）、配置0；最新Android导出 **0**，638模块15.143s，约1.3MB Hermes .hbc、3.9MB .hbc.map及metadata。这是JS资源/源map导出，不是APK安装或原生符号化。CPUhash夹具不是有效APK，未用它冒称签名/升级通过。

安全回归 **3/3**（约13.7s），Data另独立3/3并验证正常leader后台member清理。真实自有进程忽略TERM、内部deadline和外部TERM后被group终止并reap；部分HTTP POST在shutdown/server_close后request线程均join。未调用SDK/ADB。review-cross-platform-native-harness.md有独立发现、失败复现和修后证据。test_harness.py进入下载源码。

两篇单独strict tsc0；源码映射9/9连续原文，图XML有效。artifacts.svg已实际QuickLook渲染并人工查看，图不以v2 JS Error冒称native crash。预览只在ignored work/expansion，public仅可编辑SVG。站内桌面/手机视口和真实运行待根最终验收，作者未假称完成。

## 首轮隔离构建与当时待完成运行（历史）

根提供公开CI API，作者读到job completed/success及步骤：

- [run40140950248/job121012385910](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40140950248/job/121012385910)，head **b35dee2f2522c3434dc401fee5ffac458b814551**，Ubuntu24.04 runner，Node24.14.1/JDK17，精确SDK依赖成功。**两个实际release APK、Hermes组合source map、public Debug证书核验步骤success**。2026-10-24T23:00:47Z～23:12:47Z，即Asia/Shanghai10-25。这是较早快照build-only，不是安装/升级/UI/符号化完成。
- 冻结清单work/expansion/native-runtime-frozen-2026-10-25.json，清单SHA256 **9428a74307152e04bb9b63422d98f1a20df6ca544d503b41ad234f22947892b2**。本例build_android.py **2e23f403a51e8dbe3c32e2a3ebd851423a92c948f06ddec3503de2ad8ae7d25d**；verify_emulator.py **4232781006a2c0168bf567dacfc21d307b8e9b826401bcc70ccda9734800bee6**；所有冻结执行源逐SHA核对未变。
- 根最终含模拟器提交 **9280ec30b31ecc08568e515ff10631dc06262db8**，[run40142096668/job121015782374](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40142096668/job/121015782374)，写入时构建进行中；最终原生运行结果待返回，不先写通过。

待完整断言：v1安装nativeCode1/createdtrue，原生UI层级与PNG；同证书v2 install-r后nativeCode2/name1.1.0、createdfalse且读回v1文档，原生UI层级与PNG；实际v2捕获JS Error stack与对应map经Metro回到controlledFailure/controlled-error.js，先用v1元数据必须MAP_RELEASE_MISMATCH；不带-d降级v1必须INSTALL_FAILED_VERSION_DOWNGRADE，再启动仍v2/旧笔记；最后只卸载新建com.atlaslab.delivery、删own XML、停HTTP并join所有线程。

build_android.py在私有副本先实际错误profile拒绝，然后两个正确profile构建；只模板公开Android Debug证书，不生成生产密钥。APK/map分别hash防意外混放，但报告全可被恶意修改时不提供真实性担保。unknown schema不覆盖旧数据；两版schema均1，不能称任意迁移安全。捕获的JS Error不导致native进程退出，没有native tombstone/dSYM、商店、OTA、iOS、其他ABI或实体手机实测。

内部命令自有session，TERM→有限5秒→KILL/reap；SIGKILL/主机故障/恶意逃离session不保证finally。HTTP连接3秒、事件64条、body16384字节，native UI/事件/ADB有限等待。server_close等待非daemon请求线程，不只停accept循环。脚本先LinuxCI/qemu/ABI守卫、拒已有同包名。指定artifact输出是调用方明确保留，不进源码ZIP。

最终锁重新npm audit为 **6high/0critical**，完整audit-report.json随工程；node-forge/Zod/Expo CLI与模板上游链仍待上游修复，不使用major override假装审计通过，不能生产发布。

最终独立全文审稿后，README和正文终端明确从示例根执行 `bash ./verify-android.sh`，清理测试用 `python3 -m unittest discover -s . -p test_harness.py -v`；ZIP解压根无需examples前缀。仅文档修改，冻结runtime SHA不变。

## 2026-10-25 原生首启失败：启动诊断增量

9280/run40142096668构建成功，但Real API36 emulator步骤exit1。复用同一APK的5f53573/[run40143515607/job121019972780](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40143515607/job/121019972780)在显式npm ci之后仍失败，精确Pythontrace为verify_emulator.py:103 `first=wait('delivery_rendered','lab-v1')` → :40 `AssertionError: delivery event missing: []`。EVENTS为空，尚未到UI/升级/符号化；不能把缺Metro当当前原因。Node完整公开5段注释存work/expansion/native-recheck-5f53573-public-annotations.json，系统尾日志对本包/ReactNativeJS/AndroidRuntime均0命中，不能从普通系统warning确定App崩溃。

为下一轮复用APK，仅增强verify_emulator.py独立诊断，SHA256 **f387b8feb7437092bf2b96825fb5553304d44e0db474f4d6e3f6f090f0e87db4**。APK输入App/依赖/配置/构建以及全部RN源码仍与原冻结清单逐字节一致；此harness新SHA单列，不宣称它仍是原runtime SHA。新诊断保存PID/Activity、JS/crash/本包pid日志、UI全文/PNG、公共report URL与标记字节探针，失败时用emulator toybox nc到自有HTTP夹具辅助隔离通路。保存原EVENTS后才进行诊断探针，探针不伪造delivery_rendered。stdout只印紧凑摘要防14k尾部系统日志淹没首错；完整小文件进artifact。

新工具AST通过；现有无SDK安全回归3/3（14.093秒），没有运行本机SDK/设备。首启原因尚未确定，需真实模拟器新诊断，不提前修App或宣布通过。原始冻结SHA是首轮历史证据，本段为后续harness-only增量。

## 2026-10-25 最终代表环境完整验收：通过

最新状态为 **complete**；前面的“待返回/待执行/原因尚未确定”段落保留为当时的诊断历史，完整运行已由本节关闭。旧首启失败的原因仍未确定，不能写成Metro或其他未经证明因素导致。

- [a834681/run40144174318/job121021896614](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40144174318/job/121021896614)，提交 **a834681f97a86f61182eada83d21e1cde48dea39**，delivery-runtime **success**，2m48s。Node独立读取公开GitHub检查/分段注释并保存work/expansion/native-recheck-a834681-public-web.json；它是公开HTML解析证据，不伪称REST原始jobs JSON或本机运行。
- **API36/x86_64/emulator-5554/非实体设备**。复用9280原APK/map，App、锁、构建输入与原冻结快照一致，harness为已核对的 **f387b8feb7437092bf2b96825fb5553304d44e0db474f4d6e3f6f090f0e87db4**。不是换App源码后才成功。
- bundle探针实际读到assets/index.android.bundle，1306868字节，公共report URL与ATLAS_DELIVERY_LAB字节均true；am start实际Status ok/COLD。此字节探针是辅助观察，不把HBC未命中当任意包的绝对证明。
- v1安装nativeCode1/createdtrue，v2同Debug证书install-r后nativeCode2/name1.1.0/createdfalse，假文档仍来自v1；真实UIAutomator精确状态和PNG采集断言通过。没有把HTTP自报事件单独冒称像素证明；作者未另人工看CI截图。
- 对应v2 Hermes组合map真实符号化：controlledFailure位于 **/lib/controlled-error.js:3**，capture位于 **/App.jsx:11**；错release map拒绝。打印出的ATLAS_CONTROLLED_JS_FAILURE是被捕获教学JS Error的符号化结果，应用仍运行，native_process_crash=false。
- signed_upgrade_and_js_symbolication输出data_retained/native_version2/same_debug_certificate/native_ui_hierarchy/wrong_release_map_rejected全为真；降级v1返回INSTALL_FAILED_VERSION_DOWNGRADE，重启仍2且fake_data_unchanged=true；cleanup own fake app uninstalled and local fixture stopped。

9280及5f53573两轮失败保留（9280首错未完整保留，5f明确为EVENTS=[]），因果尚未证明。a834本轮同App/同APK/map通过关闭的是“代表链是否可实际运行”的验收，不关闭旧间歇失败根因调查，也不声称每次CI启动无波动。无实体手机/iOS/生产签名/商店/OTA/native crash/其他ABI结论，audit6high仍未消失。
