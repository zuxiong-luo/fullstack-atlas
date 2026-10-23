# Flutter设备生命周期教学页面

固定 **Flutter 3.41.3**（framework revision `48c32af034`）、**Dart 3.11.1**。锁文件为`pubspec.lock`，未升级本机SDK。主机macOS14.5，Chrome156可用；Android SDK缺失，未做Android/iOS真机或原生构建。

```sh
flutter --version
flutter pub get --enforce-lockfile
flutter test
flutter test --platform chrome
flutter analyze
flutter build web
flutter run -d chrome --web-port 4312
```

## 文件与行为

- `lib/device_controller.dart`：Reading、TelemetrySource、FirmwarePort、ChannelFirmware与UnsupportedFirmware、DeviceController。代数和设备归属、序号检查、取消/失效、权限与能力错误。
- `lib/main.dart`：完整DemoSource和页面。没有BLE、gRPC或真实机器人数据；由按钮发一条模拟消息。
- `test/device_test.dart`：4项测试，包含受控晚到Future、订阅取消、乱序/错误设备、dispose、平台消息契约与Widget交互。
- `web/`：标准Flutter Web启动脚手架；无品牌图标依赖。

初始设备A、connecting、电量未知。点击发送模拟遥测后connected并显示电量。切B后清空A数据。固件按钮在Web选择`UnsupportedFirmware`，立即明确表示不支持，不把未注册的平台消息当作已有能力；原生侧使用MethodChannel适配器，插件未实现时应报告能力缺失。

`ChannelFirmware`只是平台通道契约，未交付Android/iOS插件、系统权限申请、真机协议或自动重连。测试用mock验证通道方法/入参/返回与错误分类，不代表真实设备能力通过。

## 已验证与限制

2026-10-23：Flutter VM测试4/4、Chrome测试4/4、analyze无问题、Web生产构建通过（最终修订后另在总核验文确认）。Widget中的能力缺失使用明确适配器或MissingPluginException mock，不靠不存在的原生通道消息等候结束。

没有移动端设备或模拟器验收，没有性能、帧率、GPU或后台蓝牙结论。Flutter Web首次运行可能需要浏览器引擎资源；本文站点的离线包缓存源码，不把整个Flutter SDK与其依赖打包为离线运行环境。真实插件接入还需权限拒绝、前后台、断线、重复命令与协议幂等验证。
