# Flutter与RN专题验证记录

2026-10-23。两篇重写保留旧文章ID、旧章节ID与研习关联，状态review。正文先概念/执行与渲染模型，再给完整业务代码、消息/回调推演、错误与解析检查；两张SVG为可编辑仓库文件。

## Flutter

环境：Flutter3.41.3/revision48c32af034、Dart3.11.1，macOS14.5，Chrome156。`flutter devices`仅macOS与Chrome；Android SDK缺失，Xcode15.4/CocoaPods旧，未安装工具链。

已实际完成：pub get、VM测试4/4、Chrome测试4/4、analyze无问题、Web构建通过。页面与控制器完整实现，订阅取消/新代数、错误设备/乱序消息、晚到固件结果、dispose失效、通道成功/权限拒绝/能力缺失以及Widget交互均有测试。

无原生插件与硬件。Web显式使用UnsupportedFirmware，不依赖未知平台消息回调是否响应；MethodChannel单独用mock检查契约。Flutter Web不等于Android/iOS渲染、权限或真实蓝牙测试。没有性能结论。

## RN

最初SDK54/RN0.81.5的23项high没有被接受为已验收，已改为当前官方稳定组合：Expo58.0.17、RN0.88.0、React19.3.0。从官方Expo npm tarball内bundledNativeModules.json核对；官方发布https://expo.dev/changelog/sdk-58，固定信息写在COMPATIBILITY.json。

现有Node24.14.1满足engine，单独固定该工程；站点Node22不变。实际7项纯JS测试通过，JSX/JS语法解析通过，package/lock/静态app配置一致。没有运行npm ci下载完整依赖、Expo Metro启动、原生打包、设备或系统权限。不能把Node测试写成RN渲染已验证。

重建锁并实际npm audit：仍15个high，audit-report.json保留。两个实际根告警：braces3.0.3（GHSA-vfj7-8cjw-p6xm，Metro/file-map→micromatch）、node-forge1.4.0（GHSA-86w9-cpqp-85rv，ExpoCLI/签名证书）。2026-10-23npm latest仍分别为3.0.3/1.4.0。没有用不兼容overrides或降级遮掉，保持依赖审计未通过，RN示例未完成验收。

SDK58的原生工具要求超过现有Xcode15.4，Android SDK也缺失；未安装大型工具链。标准Expo客户端没有自定义AtlasDevice模块，返回unsupported是设计边界，不是硬件实现。

## 最终整合

- 主代理统一检查页面图示、手机代码排版、下载/离线包与路由。
- Flutter build/.dart_tool及RN node_modules不应提交；源项目需要pubspec.lock、web脚手架与RN固定lock。
- 图形与正文的“执行、布局、挂载、栅格化”按职责说明，不暗示严格一线程一阶段或性能排名。
- 原生/硬件/依赖审计受阻必须在发布说明继续保留，不能把review改为complete。
