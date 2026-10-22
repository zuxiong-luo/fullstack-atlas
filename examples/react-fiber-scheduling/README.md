# 输入框与列表调度实验

对应 `react-fiber-scheduling` 文章。同一份 `App.tsx` 既可以进入本站 React 实验室，也可以独立运行。它只导入 React，不需要接口、密钥或外部数据。

## 环境与命令

固定 React / React DOM 18.3.1、TypeScript 5.7.2，Node.js 22，npm 按 package-lock.json 安装。

```bash
cd examples/react-fiber-scheduling
npm ci
npm test
npm run build
npm run dev
```

打开终端打印的地址。生产构建可以用 `npx vite preview --host 127.0.0.1` 预览。开发服务仅绑定回环地址；示例沿用站点 Vite 6.0.5 工具链，不用于对公网提供开发服务器。

- `App.tsx`：完整实验及 CPU 工作函数。
- `main.tsx`：createRoot 入口，没有 StrictMode。
- `test.mjs`：计算确定性、初始界面行数和入口的检查，不证明调度效果。

## 怎么观察

默认 800 行，每行 16000 次确定性整数迭代。每个模式先等待稳定，清空输入，再连续输入 abcdef。

1. 普通更新：输入和列表都作为普通更新处理。
2. Transition：输入保持紧急，列表放进 transition；memo 子树允许紧急渲染跳过 props 未变化的列表。
3. 减少工作量：仅渲染前 40 行。改变了显示规模，不能把收益归因于调度。
4. 同步计算反例：transition 回调里同步调用 score。回调立即执行，长循环仍然阻塞事件处理。

停止输入后，输入和列表参数应一致，pending 最终结束。设备快时可能看不见中间态，适度增大参数或使用 CPU 节流。默认不制造网络请求，因此 pending 不是接口请求状态。

控制台的“输入提交代理指标”从事件处理函数开始计时，到该输入的布局 Effect 执行结束附近。它不包含事件在队列里的等待，也不代表绘制完成，**不是 INP**。在 Performance 中分别看事件、React 工作、布局和绘制。每个模式保留至少五组相同输入的记录，并写下设备、浏览器、构建模式、节流档位、输入规模；这里没有发布性能提升数值。

## 已执行验证（2026-10-21）

macOS x86_64，Node.js 22.12.0：`npm install --ignore-scripts` 生成锁文件，`npm test` 2/2 通过，`npm run build` 通过。随后已重新执行 `npm ci`，再次运行上述测试和构建，均通过。测试使用服务端静态输出检查初始界面，会看到 React 的 useLayoutEffect SSR 提示：该实验实际只在客户端挂载，测试不验证布局 Effect。

浏览器交互、手机显示和 Performance 采样不由这两个自动测试覆盖，必须在站点整合时单独验收。没有采集的性能数据不作为实验结论。SVG 图是顺序/结构示意，不是测量结果。
