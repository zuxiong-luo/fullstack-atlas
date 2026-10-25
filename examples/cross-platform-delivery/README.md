# 跨平台交付：固定Android代表链，验证工件、升级与JS栈

与RN工程篇同一笔记主题，但本目录独立运行，不导入另一示例。Node24.14.1、Expo58.0.19/RN0.88.0/React+DOM19.3.0、FileSystem58.0.11/Application58.1.2、template58.0.28、metro-symbolicate0.87.1，完整package-lock。代表平台仅Android API36 x86_64模拟器；其他平台交付机制在正文比较，没有冒称iOS/Web/桌面本篇原生构建。

以下终端均在本示例根目录执行：仓库使用者先 `cd examples/cross-platform-delivery`；ZIP读者解压后进入 `cross-platform-delivery`，不需要再拼 `examples/` 前缀。

```sh
npm ci --ignore-scripts --no-fund
npm test
npm run check
npm run export:android
```

本机mac实际依赖安装460包、配置与6项纯JS/hash回归通过；最新源码Metro/Hermes及map导出638模块实际通过；旧快照b35dee2/run40140950248双APK/map/Debug证书构建通过，a834681/run40144174318在API36 x86_64模拟器完成安装、原生UI、同证书升级/旧数据、JS符号化、错map与拒绝降级、清理的完整验收。hash CPU样例只是有限字节契约，不声称是有效APK。没有实体手机、生产签名密钥或商店上传。

## 独立真实Android CI入口

预装依赖同RN工程：Linux一次性VM、Node24.14.1/JDK17/Python3/GNUtimeout/adb，SDK包精确`platforms;android-37.0`、`build-tools;37.0.0`、`ndk;27.1.12297006`、`cmake;3.30.5`；运行专用API36 x86_64模拟器。编译API37.0与target36/运行36分开。脚本不修改用户宿主SDK，不调整compileSdk绕过库要求。

```sh
CI=true ATLAS_LAB_EMULATOR_SERIAL=emulator-5554 \
ATLAS_LAB_ARTIFACT_DIR="$RUNNER_TEMP/atlas-delivery-artifacts" \
bash ./verify-android.sh
```

artifact目录必须新或空。只编译可以加`ATLAS_LAB_BUILD_ONLY=1`；已有同轮工件可先npm ci，再单独verify_emulator.py。双构建内层3900s，根job至少75min留有限依赖/模拟器/清理预算，第一次网络下载可能较长。两个版本共享同一次私有Gradle home缓存，结束删除私有原生工程与Gradle home，只把指定工件目录留给调用方。

build_android.py先故意写不匹配profile，要求真实配置检查非0；再分别构建lab-v1/nativeCode1/version1.0.0和lab-v2/nativeCode2/version1.1.0，schema仍1。使用模板公用Android Debug证书签release配置，让JS/Hermes内嵌而非依赖Metro，绝不是生产签名。apksigner核验两证书相同且为Debug，APK和组合source map分别SHA256，记录release ID/ABI/version。源代码不得放密钥/服务端token；profile只接收有限公开配置。

verify_emulator.py先确认CI+emulator serial+qemu1+x86_64且没有同包名应用，随后仅操作自己新装com.atlaslab.delivery：

1. 安装v1，原生Application.nativeBuildVersion=1，创建document内schema1假笔记。
2. 同证书v2 `install -r`升级，nativeCode2/name1.1.0，真实读回v1假文档且不重建。升级兼容性仅在这个未变schema上证明，不代表任意迁移安全。
3. v2捕获controlledFailure的JS Error，保存stack/release；该错误被捕获，应用仍运行，不冒称真实native进程崩溃。使用对应Hermes组合map+Metro符号化到lib/controlled-error.js/controlledFailure；错release元数据拒绝，并校验APK/map字节hash。这是防误配，不是恶意攻击者可改全部元数据时的真实性证明。
4. 不带降级许可重新安装v1，必须真实INSTALL_FAILED_VERSION_DOWNGRADE；重新启动仍nativeCode2/旧假数据，不把任意安装失败算作成功。
5. finally只卸载自己的假包、停4355 HTTP夹具/线程；保留明确artifact文件用于追溯，SIGKILL/主机故障不保证finally。

运行记录在build-report.json/runtime-events.json/caught-error.json/symbolicated.txt，源map可能含源码，公开存储策略需另定；本例全是假数据/公开配置。没有EAS更新服务、OTA回滚、生产密钥轮换、Android native tombstone、iOS dSYM或Windows符号实测。当前npm audit6high与RN工程一样如实保留，不用不兼容override遮掉上游告警，不能标生产审计通过。

## 清理回归与证据边界（2026-10-25）

```sh
# 无SDK/ADB操作；CPython3.12.14在本机POSIX实际3/3，独立审稿也各3/3
python3 -m unittest discover -s . -p 'test_harness.py' -v
```

构建器每个命令拥有独立进程组；内部超时或外部TERM时TERM→有限5秒→KILL并reap，不再嵌套GNUtimeout使包装器退出而子进程存活。3项回归实际运行忽略TERM的自有子进程、外部TERM和部分POST线程收口，不冒称Android测试。HTTP夹具关闭会等待非daemon请求线程；RN在锁内允许新旧gate完成，避免清理时新增gate再等12秒。SIGKILL、主机故障、主动逃离进程组的恶意子进程不在保证内。

模拟器脚本另读取原生UI层级精确匹配状态JSON并保存PNG；报告useEffect事件本身只证明React提交逻辑，不能取代层级/图片。a834681实际完成本篇代表模拟器的原生运行断言；它复用9280 APK/map，不把旧build-only成功单独扩展为设备结论。test_harness.py与源码均包含在下载工程；二进制、map、dist和node_modules不进离线源码ZIP。

## 原生失败历史与诊断增量

9280的实际模拟器步骤失败；复用相同APK并显式安装符号化依赖的5f53573/run40143515607/job121019972780取得精确首错：v1启动后等待delivery_rendered超时，EVENTS=[]。尚未走到原生UI断言、升级或source-map符号化，不能将其归因缺Metro。

随后只增强verify_emulator.py诊断，不改App、依赖锁或构建输入，原9280 APK可复用。增量SHA256为f387b8feb7437092bf2b96825fb5553304d44e0db474f4d6e3f6f090f0e87db4；新增APK内公共URL/标记探针、am start结果、失败PID/Activity/JS与crash日志、UI文字/PNG及模拟器到loopback夹具的HTTP探针。工具stdout保留紧凑摘要，完整startup-diagnostics.json/startup-failure.png由CI工件保留。诊断探针事件不等于应用事件，原runtime-events先保存；后续a834681的实际诊断重跑已成功，详见下节；旧失败原因仍未确定。

## 最终代表环境完整验收（2026-10-25）

[a834681/run40144174318/job121021896614](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40144174318/job/121021896614)实际成功，API36/x86_64/emulator-5554，公开web检查/分段输出由独立审稿人保存并复读，非REST原始JSON。复用9280保留的APK/map；校验App/依赖/构建输入不变，仅verify_emulator.py为上面的f387诊断增量。

真实断言包括：v1原生版本1/假文档初建，v2同证书升级后原生版本2/created=false/同一v1文档；v1/v2原生UI层级与PNG采集；v2受控JS栈经对应Hermes组合map回到controlledFailure与/lib/controlled-error.js:3，错release map拒绝；不带-d降级v1真实拒绝，重启仍v2/旧假数据；最后卸载own假包、关闭fixture。APK bundle内报告URL和DELIVERY标记字节探针为true，am start Status ok。

此前9280模拟器失败的首错未完整保留，5f明确为EVENTS=[]；两轮失败原因仍未知；同APK本轮成功不证明某个猜测根因，更不能归因Metro。该结果是Android模拟器代表链，不是实体手机、iOS、生产签名、商店、OTA或native进程崩溃验收。依赖audit6high仍保留。
