# Node.js ESM / CommonJS / TypeScript 工程

固定：Node.js **22.12.0**，TypeScript **5.7.3**，`@types/node` **22.10.5**。无第三方运行依赖；编译器、声明及其依赖由 package-lock.json 锁定。macOS 14.5 x64 已实际构建与执行。

## 文件布局

```text
src/notes.ts           领域类型与运行时输入校验
src/main.ts            CLI，输入 unknown 后经 parseNote
legacy.cjs             旧 CommonJS 模块
bridge.mjs             ESM 消费 CJS default
counter.mjs            ESM URL 与共享状态实验
failures/extension.ts  故意缺后缀的编译反例，不在正常构建里
failures/type.ts       故意类型错误的编译反例
package.json           type、exports 与精确依赖
package-lock.json      可复现安装
```

仓库内 `cd examples/node-modules-tooling`；ZIP 解压后进入该目录：

```sh
nvm use
npm ci
npm test
npm start
node dist/main.js '{"title":"  notes  ","tags":["node"]}'
node bridge.mjs
```

没有 nvm 时使用已安装的 Node 22.12.0。`npm test` 先构建，再执行 7 项测试；编译失败反例是**预期行为**，测试应通过。编译子进程设十五秒保护，避免慢机器把编译器启动误判成编译诊断。

正常 CLI 输出 `{"title":"notes","tags":["node"]}`；bridge 输出 `bridged`。

## 主动复现失败

```sh
node dist/main.js '{"title":"","tags":[]}'
node --input-type=module -e "await import('./dist/notes')"
node --input-type=module -e "await import('node-modules-tooling/dist/notes.js')"
```

分别预期 TypeError、ERR_MODULE_NOT_FOUND、ERR_PACKAGE_PATH_NOT_EXPORTED，均以非零状态退出。根包入口 `node-modules-tooling` 则可以导入。

测试还覆盖类型擦除、产物后缀、输入校验与数组隔离、静态 TS2835/TS2322 失败、相同 ESM URL 复用及查询变化产生独立实例。

## 清理与边界

`dist/` 是生成结果，不打包到示例 ZIP。干净复现应在新解压目录执行 npm ci 和测试；重建失败不会自动删除旧 dist。只有 `src/` 进入常规 tsc 构建，failures 由测试单独无输出编译。

这是单包 CLI，不是双格式发布库；未验证所有 npm 包互操作、自定义 loader、循环依赖、Windows 路径或生产发布。TypeScript 不会为 HTTP 输入自动校验，也不会为旧运行时补齐 API。Node 安装与 npm 依赖需要另行取得，站点离线包不包含 node_modules。
