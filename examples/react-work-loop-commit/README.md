# React 18.3.1 工作循环与提交观测

`App.tsx` 与本站实验室共用，只有 React 导入。独立入口 `main.tsx` 使用 createRoot，没有 StrictMode。

```bash
cd examples/react-work-loop-commit
npm ci
npm test
npm run build
npm run dev
```

固定 Node.js 22、React / React DOM 18.3.1、TypeScript 5.7.2、jsdom 26.0.0；完整依赖见 package-lock.json。开发服务器仅绑定本机。

首次挂载：render attempt → ref attach → layout setup → passive setup。更新数值后检查旧 cleanup 与新 setup，确认稳定 ref 未重新绑定。替换 key 时出现 ref detach / attach，卸载时观察 cleanup。这个关系适用于本例结构，不是所有树形结构的全局全序承诺。

布局Effect阻塞选项是有界40ms忙等待反例，不能用于生产。render 中 console 日志也是诊断副作用，不应成为业务实现方式。rAF 日志不是已绘制的证明。

自动测试用 act / jsdom 验证真实 React 对 DOM、ref 与 Effect 的处理；act 主动刷新工作，jsdom 不绘制，因此测试不能证明中断、浏览器绘制顺序、INP 或性能。浏览器 Performance 采样与图形可读性须在页面整合时单独验收。

核验日期 2026-10-22，macOS x86_64，Node.js 22.12.0。已运行依赖安装、生命周期自动测试（1个场景包含挂载/更新/key替换/卸载）、TypeScript 检查和 Vite 生产构建，均通过。逐条源码证据见 VERIFICATION.md。

工具链复验：2026-10-22 将 Vite 固定为 6.4.5、esbuild 固定为 0.28.2，React 保持 18.3.1。更新锁文件后执行 npm ci --ignore-scripts、npm test、npm run build，全部通过；安装审计报告 0 vulnerabilities。更新阶段额外断言四种 cleanup/setup 均存在，且布局 cleanup 实际读到“数值 1”，避免缺失日志的 indexOf=-1 导致假通过。
