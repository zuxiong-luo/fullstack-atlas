# RN / Flutter模型比较：RN侧设备页

**验收未完成。** 逻辑测试通过，RN原生构建/视图/权限未执行；当前稳定兼容依赖组合仍有15个high审计告警，不能当作已安全验收的生产模板。

## 固定版本与依据

2026-10-23核对[Expo SDK58官方发布](https://expo.dev/changelog/sdk-58)与官方npm包`expo@58.0.17`内的`bundledNativeModules.json`：

- Expo58.0.17
- React Native0.88.0
- React19.3.0
- 本机已安装Node24.14.1，满足该SDK的engine。原Node22.12.0低于22.13.0分支下限，不能继续用它运行此工程。

详见`COMPATIBILITY.json`、`package.json`、`package-lock.json`和`.nvmrc`。没有为了降低audit数字选择不兼容overrides或降到旧SDK。

## 已执行的逻辑验证

不依赖RN安装即可运行：

```sh
nvm use
node --test test.mjs
npm run check
```

7项纯JS测试：正常/旧序号/设备切换、晚到结果、销毁后结果、权限拒绝、能力缺失、其他错误、重复点击抑制。`verify-config.mjs`静态比较官方固定版本、lock与配置；它不是`expo-doctor`或原生构建。App.js/index.js/native-port.js已用站点现有Babel进行JSX/JS语法解析，不等同Metro bundle或原生链接验证。

`session.mjs`仅拥有一个页面会话，模拟源每设备一个监听；不声称已实现BLE/gRPC、可靠重连或共享订阅服务。`native-port.js`缺少AtlasDevice原生模块时返回unsupported；没有真实设备固件实现。

## 在补齐兼容环境与依赖修复后运行页面

```sh
npm ci
npm start -- --localhost
```

本次未运行这两条原生开发流程。需要兼容SDK58的客户端/开发构建。官方发布说明提示SDK58的商店Expo Go可能仍在后续发布中；不要假设手机现有客户端兼容。当前机器Android SDK缺失，Xcode15.4不满足此SDK的原生工具要求。没有安装巨大SDK/模拟器，也没有扫码或真机渲染记录。

标准Expo Go不包含自定义AtlasDevice模块，所以不应期待真实固件版本。安装真实原生模块后还需要构建、平台权限与设备验证。配置中Android权限声明不代表授权；没有实现iOS蓝牙权限流程。

## 审计受阻

复现：在Node24.14.1执行`npm audit --json`。完整本次结果在`audit-report.json`，metadata为15个high、0critical。

根问题与路径：

- `expo@58.0.17 → @expo/cli@58.1.14 → @expo/metro-config/metro → metro-file-map@0.87.1 → micromatch@4.0.8 → braces@3.0.3`，[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)。
- `expo@58.0.17 → @expo/cli@58.1.14 → node-forge@1.4.0`，以及`@expo/code-signing-certificates@0.0.7 → node-forge@1.4.0`，[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)。

2026-10-23再次查询npm的latest：braces仍3.0.3，node-forge仍1.4.0，没有可兼容采用的已修订版。image-size和postcss旧告警在升级稳定组合后已不再是此锁的根告警；不能继续引用旧23项结果。

锁文件审计不是原生运行验证；逻辑测试通过也不会消除这些告警。暂不建议将本工程开发服务器暴露到公网；修订包可用后重建兼容锁、重跑逻辑/配置/打包/设备验收。
