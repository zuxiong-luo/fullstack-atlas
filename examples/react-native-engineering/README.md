# React Native应用工程：Android代表平台的生命周期与原生边界

锁Node24.14.1、Expo58.0.19、React/ReactDOM19.3.0、RN0.88.0；router58.0.26/fs58.0.11/location58.0.19，完整package-lock。所有直接原生依赖按expo官方npm tarball内bundledNativeModules.json一致核对，模板expo-template-bare-minimum58.0.28也固定，prebuild使用已安装模板的本地tar而非滚动latest。只假笔记n1/n2，授权实验不读取任何真实位置。

```sh
npm ci --ignore-scripts --no-fund
npm test
npm run check
npm run export:android
```

作者本机macOS14.5实际安装512包、8/8纯JS测试、配置/锁/官方bundled核对、Android预生成工程和Metro/Hermes导出通过。预生成与JS/Hermes导出不等于APK编译、原生运行或手机验收。Android真实CI仍在运行，当前review。

## 独立Linux/Android CI

CI预装Node24.14.1、JDK17、Python3、GNUtimeout、本机Android SDK的`platforms;android-37.0`、`build-tools;37.0.0`、`ndk;27.1.12297006`、`cmake;3.30.5`、adb。编译API37.0、target36与运行API36 x86_64是三项不同条件，不能混称Android37真机。AGP9.2.1/Gradle9.4.1由锁RN/模板控制；不要手改compileSdk或作SDK目录symlink。第一次Google/Maven/npm下载需要网络。脚本不安装或修改用户本机SDK。

```sh
# 一次性Linux runner：先只编译，artifact目录必须新建或空
CI=true ATLAS_LAB_BUILD_ONLY=1 \
ATLAS_LAB_ARTIFACT_DIR="$RUNNER_TEMP/atlas-rn-artifacts" \
bash examples/react-native-engineering/verify-android.sh

# 完整运行：在同样一次性VM启动专用API36 x86_64模拟器后，去掉BUILD_ONLY
CI=true ATLAS_LAB_EMULATOR_SERIAL=emulator-5554 \
ATLAS_LAB_ARTIFACT_DIR="$RUNNER_TEMP/atlas-rn-runtime-artifacts" \
bash examples/react-native-engineering/verify-android.sh
```

完整脚本自己先构建，两个命令各需不同空目录；如果已有同轮APK可单独设置CI/serial/artifact后运行verify_emulator.py。APK是release优化配置+模板公用Android Debug证书，用于独立捆绑JS而不用Metro服务，绝不是生产签名或可上架工件。不创建密钥账户、不上传商店。只构建x86_64代表ABI。

构建在atlas-lab-*私有临时目录复制项目、安装锁依赖、检查配置、打包本地模板/prebuild、Gradle assembleRelease/apksigner验证，并保留APK/SHA256报告到指定artifact目录；临时原生工程与专用Gradle home清理。build阶段内层2100s（Gradle1500s）有限，CI job至少45min给依赖/启动/清理余量。只改私有生成manifest允许自己的本机HTTP夹具，交付源码不接受任意服务器URL。

运行脚本拒绝非Linux/非CI、未明确serial、非emulator-*、qemu!=1、非x86_64或已有同包名应用，绝不对实体手机执行安装/权限命令。loopback4354自有有界HTTP夹具与ADB均有超时；只有假的com.atlaslab.rnengineering：

- 真正文件路由进入n1，HTTP gate确认已收到请求；离开后立即使代际失效并abort，再释放旧响应，当前n2真正React提交，旧n1不回写。
- HOME引发真实AppState.change background→paused；回到Activity后active并重新加载。只覆盖change前后台+路由focus，不覆盖Android通知抽屉blur/focus等所有交互失焦。
- 原生File在每次调用拥有的cache子目录写/读假笔记，真实缺文件拒绝，finally只删该子目录；原生调用不一定可取消，UI用代际丢弃过期结果。
- 系统定位授权弹窗通过uiautomator找到拒绝按钮，返回denied；没有真实位置读取。权限拒绝是正常分支，后续设置页恢复不在本次自动化范围。
- finally只force-stop/uninstall自己的新装假数据包，删自己的XML dump，放行gate并关闭HTTP线程；SIGKILL/机器故障不能保证finally。APK、报告是调用者明确保留的实验工件，根离线ZIP不包含生成二进制。

## 当前验证与已见失败

首轮Android CI fc117bf/run40140415954停在安装SDK，Google仓库不存在`platforms;android-37`；不是APK编译失败。随后独立读取Google repository2-3.xml确认channel0精确包名37.0/37.1/37.2，脚本与CI仅修安装/预检名37.0，编译约束未改。真正APK/模拟器结果等待根回填，不借用JS测试冒称原生通过。没有实体手机/iOS原生包/商店验收。

npm audit当前6high，audit-report.json保留实际报告；根因包括node-forge签名校验和Zod受限集合内存告警及Expo CLI/模板上游链。Zod3与forge上游当前没有本锁内直接修复，不用升级至不兼容major或降老Expo来清报告。实验不执行Expo证书签名服务或接收任意不可信schema输入，但依赖审计仍未通过，不称生产可用。最初ReactDOM自动选19.3.1与React19.3.0冲突、gesture3.4超出Expo~3.3，已明确锁19.3.0/3.3.0并重新核对。
