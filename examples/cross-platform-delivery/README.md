# 跨平台交付：固定Android代表链，验证工件、升级与JS栈

与RN工程篇同一笔记主题，但本目录独立运行，不导入另一示例。Node24.14.1、Expo58.0.19/RN0.88.0/React+DOM19.3.0、FileSystem58.0.11/Application58.1.2、template58.0.28、metro-symbolicate0.87.1，完整package-lock。代表平台仅Android API36 x86_64模拟器；其他平台交付机制在正文比较，没有冒称iOS/Web/桌面本篇原生构建。

```sh
npm ci --ignore-scripts --no-fund
npm test
npm run check
npm run export:android
```

本机mac实际依赖安装460包、配置与6项纯JS/hash回归通过；原生APK/升级/符号化待真实CI。hash CPU样例只是有限字节契约，不声称是有效APK。没有实体手机、生产签名密钥或商店上传。

## 独立真实Android CI入口

预装依赖同RN工程：Linux一次性VM、Node24.14.1/JDK17/Python3/GNUtimeout/adb，SDK包精确`platforms;android-37.0`、`build-tools;37.0.0`、`ndk;27.1.12297006`、`cmake;3.30.5`；运行专用API36 x86_64模拟器。编译API37.0与target36/运行36分开。脚本不修改用户宿主SDK，不调整compileSdk绕过库要求。

```sh
CI=true ATLAS_LAB_EMULATOR_SERIAL=emulator-5554 \
ATLAS_LAB_ARTIFACT_DIR="$RUNNER_TEMP/atlas-delivery-artifacts" \
bash examples/cross-platform-delivery/verify-android.sh
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
