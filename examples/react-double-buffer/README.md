# C2 双缓冲教学模型

这是由 React 展示的教学模型，不是读取/插桩 React Fiber 的工具。F1/F2 是模型对象身份。模型从已挂载任务开始，省略 HostRoot 初始化、调度、Hook更新队列、Context读取、异常/Suspense和真实宿主提交。

```bash
cd examples/react-double-buffer
npm ci
npm test
npm run build
npm run dev
```

Node.js22、React/ReactDOM18.3.1、TypeScript5.7.2、Vite6.4.5、esbuild0.28.2，依赖由package-lock.json固定。

1. 准备B：F1仍current，work是F2，visible仍任务A。
2. 完成：work处理输入，visible仍任务A；提交：current变F2、visible变B。
3. 准备C：work是原F1，不是第三个对象；完成并提交后current又变F1。
4. 准备错误标题并完成，再放弃：current和visible不变。重新准备时复用工作节点并重置临时信息。

flags位值4/1是模型自定，不是React常量。child/queue的引用相等与dependencies外壳不同，只描述准备阶段，不声明真实React整轮都如此。源码核验见VERIFICATION.md。

2026-10-22，macOS x86_64，Node22.12.0：生成lock后执行npm ci --ignore-scripts、npm test（3/3）、npm run build均通过，安装audit0。测试证明教学模型的对象/引用和状态规则，不能证明真实React中断次数、对象数量、绘制或性能。浏览器呈现由站点整合另行验收。
