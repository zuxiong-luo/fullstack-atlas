# cross-platform-architecture 核验记录

2026-10-24，作者核验，状态 review。先读既有cross-platform-models、flutter-engineering、electron-trust-boundary，本文不重写渲染/原生进程机制，只主讲领域值、应用状态、端口和异步归属。

## 实际环境与运行

macOS14.5 x64、Node22.12.0、TypeScript5.7.3、React/DOM18.3.1。精确lock，12项小型npm依赖，没有安装移动SDK或Dart运行时。

```sh
npm ci --ignore-scripts --prefix examples/cross-platform-architecture
npm test --prefix examples/cross-platform-architecture
```

干净依赖安装成功，最终 **17/17**，退出码0。npm audit本次0告警不作为逻辑安全保证。编译前sync-browser.mjs合成自足App.tsx；独立内容TypeScript检查通过。

## 用例对应

- DTO正常、未知形状、错误设备/命令ID拒绝。
- load普通路径按loading→ready发布。
- 切A→B、同A重试、取消加载后旧结果均不覆盖。
- 命令成功与重复抑制、无ready或无能力拒绝、切设备后命令晚到不污染。
- 五类受控端口错误映射，未知原始错误不回显。
- dispose幂等、禁止未来工作和晚到异常发布。
- 观察者改快照不会改内部状态。
- 模拟适配器真实计时器取消，pending归零。
- React18静态SSR smoke：能生成视图，不执行Effect。
- 自足App逐字包含同一core与适配器正文，并且唯一import来自React。
- 核心额外防御坏端口设备/命令归属；取消命令保留ready设备并忽略晚到。

核心竞态用受控Promise精确安排resolve/reject；没有依赖实际网络或随机睡眠。800/120/500ms只是Web模拟器顺序，不是设备延迟指标。timeout分类测试为适配器报错映射，不宣称做了真实设备截止测试。

## 内容、源码与图

9块带完整examples路径的代码逐字对应连续原文。正文分段完整展示core.ts，再给出完整demo-adapter、React调用者与生成脚本，关键判断无需外跳。纯核心无React依赖，浏览器单文件是生成的教学入口，不把Dart自动执行TS作为代码复用。

boundaries.svg、states.svg、ownership.svg XML解析通过，尚未实际浏览器渲染；图形放大、390px阅读和实验点击待主代理。

## 官方资料

- [Flutter架构指导](https://docs.flutter.dev/app-architecture/guide)：职责分层是可调整指导，不要求小功能套全套类。
- [Flutter3.41.3 ChangeNotifier固定源码](https://github.com/flutter/flutter/blob/3.41.3/packages/flutter/lib/src/foundation/change_notifier.dart)：核对通知/销毁职责参考，本文未复制其代码、未交付Dart适配。
- [React useEffect](https://react.dev/reference/react/useEffect)：setup/cleanup及开发StrictMode额外周期。
- [React18.3.1固定提交源码](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.new.js)：版本追溯；页面实际锁18.3.1，不把当前19.3文档标记当作运行版本。

RN0.88原生模块文档URL本次无法读取，未据此作新的RN API或原生验收声明。

## 还没验证的部分

SSR不是实际Web交互。本站实验注册由主代理完成，建议ID cross-platform-architecture，mode react，源examples/cross-platform-architecture/App.tsx。尚未实际点击、hydration、手机视口/真机、RN/Flutter/Electron原生适配、硬件权限、后台恢复或性能测量。

signal只是取消请求；核心失效保护发布资格，真实SDK资源完成释放需异步协议。当前模拟只读任务无真实副作用，A:epoch不是持久幂等键。单页面控制器没有共享连接、持久任务队列、自动重连与全局容量管理。下载与离线资源由主代理核验。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
