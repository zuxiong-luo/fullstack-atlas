# react-identity-events

React/React DOM 18.3.1；Node.js 22（本次22.12.0）；TypeScript5.7.2，依赖锁定在package-lock.json。无需接口或密钥。

```sh
npm ci
npm test
npm run build
npm run dev
```

浏览器打开Vite报告的地址。本站文章另有独立草稿的实验入口。

App.tsx是全部关键实现，main.tsx只负责createRoot挂载；默认没有StrictMode，以免开发检查混入首次行为推演。

验证范围：草稿身份/DOM复用、Portal捕获冒泡、背景判断、表单、订阅更新及Escape焦点恢复。完整操作和预期结果见站内同ID文章；传输/事件均有明确的教学前提。

诊断只用于理解，不是性能统计。jsdom不提供真实网络、布局、绘制或读屏环境。
