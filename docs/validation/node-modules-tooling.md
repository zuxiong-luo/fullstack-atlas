# node-modules-tooling 核验记录

作者核验 2026-10-23；最终补充模块实例实验及复核 2026-10-24。元数据首次日期保留，状态 review。

## 环境与命令

macOS 14.5 x64、Node.js v22.12.0、TypeScript 5.7.3、@types/node 22.10.5。package-lock.json 锁定三项开发依赖（含间接依赖），无第三方运行依赖。

- `npm ci --ignore-scripts --prefix examples/node-modules-tooling` 成功。
- `npm test --prefix examples/node-modules-tooling`：构建成功，**7/7** 通过。
- `npm start --prefix examples/node-modules-tooling`：输出 `{"title":"Learn Node","tags":["node"]}`。
- 本次 npm audit 报告 0 告警，不作为应用安全保证。

## 已验证行为

- 运行时输入拒绝 null、数组、缺字段、空标题、数字标签、稀疏标签和超长标题；输出数组与原输入分离。
- 编译 JS 保留 .js 说明符，擦除类型导入与注解，真正由 Node 执行。
- 缺后缀运行时报 ERR_MODULE_NOT_FOUND；对应源码编译错误 TS2835。
- 根包 self-reference 正常，私有 deep import 报 ERR_PACKAGE_PATH_NOT_EXPORTED。
- ESM 消费本地 CJS 默认导出，返回 bridged。
- 静态已知错误 tags:[3] 编译报 TS2322；反例文件不进入常规构建。
- 相同 ESM URL 共享状态，不同 query 得到独立模块实例。

初次清洁安装后的编译反例子进程三秒保护在机器并行负载下触发过 ETIMEDOUT，未得到期望诊断。已把模块示例子进程保护调整为十五秒，并重新执行全套测试 7/7；未修改类型规则或把失败隐藏为通过。

主代理独立复现也遇到一次子进程超时：期间会话出现约二十五分钟暂停，单项记录约1506秒，不能用它测量编译性能。再次执行同一 `npm test`，构建及7/7行为测试全部通过（总测试约2.7秒）；保留失败经过，不把暂停后的计时解释为代码耗时。

## 官方核对

- [Node 22.12.0 ESM](https://nodejs.org/download/release/v22.12.0/docs/api/esm.html)：相对后缀、URL 缓存标识及 CJS 互操作。
- [Node 22.12.0 packages](https://nodejs.org/download/release/v22.12.0/docs/api/packages.html)：type、exports 与 self-reference。
- [TypeScript 模块参考](https://www.typescriptlang.org/docs/handbook/modules/reference.html)、[模块理论](https://www.typescriptlang.org/docs/handbook/modules/theory.html)：编译器与运行宿主分层、NodeNext。
- [TS 5.7 说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html)：版本依据；固定 5.7.3 的行为由实际编译确认。

## 呈现与限制

7 块完整 examples 路径源码逐字对应连续原文。pipeline.svg XML 解析通过；独立内容 TypeScript 检查通过。尚未实际浏览器渲染、手机检查、Windows 路径测试、双格式 npm 发布、复杂循环依赖或真实消费者发布验证。dist 与 node_modules 不应进入 ZIP；干净解压后先 npm ci 再构建。站点整合与下载清单由主代理验收。
