# 跨平台架构：设备任务与状态归属

Node **22.12.0**、TypeScript **5.7.3**、React / React DOM **18.3.1**。这是纯 TypeScript 核心和 Web 教学视图，不是 RN/Flutter/Electron 原生设备集成。

## 运行和文件

```sh
cd examples/cross-platform-architecture
nvm use
npm ci
npm test
```

独立 ZIP 解压后进入同名目录。没有 nvm 时使用 Node22.12.0。只安装小型 JS 依赖，不下载移动 SDK。

- core.ts：领域值、端口、DTO校验、状态与控制器，**不依赖 React**。
- demo-adapter.ts：本地计时器模拟器，不连接硬件。
- view.tsx.txt：视图源片段，由构建合成到 App.tsx。
- sync-browser.mjs：将同一核心和适配器合成进浏览器单文件。
- App.tsx：已生成的自足 React18 沙箱入口，只 import React。
- test.mjs：17项行为与源码一致性测试。

`npm test` 先同步 App.tsx、编译到 dist，再运行 Node 测试。修改核心后必须同步；测试逐字核对浏览器入口包含同一核心/模拟器正文，避免两份教学实现漂移。

## Web 实验

在站点文章的“运行设备切换与取消实验”入口打开，或把完整 App.tsx 放入本站 React 实验室。独立目录不提供 npm start 静态服务器：tsc 产物包含 bare React import，不能当成无需构建器的普通 script 直接打开。

1. 选择 A，等待 ready，点击模拟只读巡检得到成功。
2. 选择 readonly，巡检拒绝；选择 denied，显示受控权限错误。
3. **先取消勾选**“新操作遵守取消”，重新选择 A 后迅速选 B。B先完成；A晚到仍显示B。
4. 重勾选只影响后续新操作。取消加载回idle；取消巡检保留ready并清命令结果。

A等待800ms、其他设备120ms、巡检500ms，只安排教学顺序，**不是硬件延迟数据**。

## 已验收

macOS14.5 x64、上述固定版本，17/17 Node测试通过：DTO/归属、加载与状态、设备切换、同ID重试、取消加载、命令/重复抑制、能力拒绝、命令晚到、错误映射、销毁、快照隔离、模拟计时器释放、React静态SSR、合成源码一致、错误端口结果、取消命令保留设备。

受控Promise决定完成顺序；未用随机网络或睡眠碰运气。计时器测试实际检查pending归零。SSR不执行Effect，不能替代浏览器点击/ hydration 验证。

## 契约边界

- ready表示取得当前设备快照，不证明硬件连通。
- abort请求适配器停止，epoch/deviceId/closed保证旧结果不发布。忽略abort的适配器仍会工作到结束，不能宣称资源已释放。
- dispose同步失效，不等待真实SDK异步close；真实资源所有者须另定义完成协议。
- A:epoch只在页面会话中关联结果，不是持久幂等键。只有模拟只读巡检，没有真实控制副作用。
- 未实现自动重连、后台常驻、共享连接、无限量任务保护或多页面订阅中心。
- Flutter/Dart不能自动执行TS，需要实现等价契约并独立测试；本篇没有未经验证的Dart翻译。

实际浏览器/手机视口与原生设备验收另行记录。不含蓝牙/串口/平台插件、真实权限验证或性能比较。离线包可保存源码，Node、React依赖和未来原生环境需另行取得。
