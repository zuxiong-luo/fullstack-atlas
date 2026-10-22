# Hooks 与交互：阅读清单

React / React DOM 18.3.1，TypeScript 5.7.2，Vite 6.4.5，Node.js 22。依赖锁定在 package-lock.json。无账号、密钥、网络服务或数据库要求。

## 运行

```sh
cd examples/react-hooks-interactions
npm ci
npm test
npm run build
npm run dev -- --port 4192 --strictPort
```

打开终端显示的地址。4192 只是此独立项目的显式端口，不改变主站 4173。

## 文件

- `App.tsx`：单文件完整交互、纯 reducer、可取消模拟 transport、自定义请求 Hook。
- `main.tsx`：createRoot 入口，默认不包裹 StrictMode。
- `test.mjs`：真实 React DOM/jsdom 测试；其中一个用例显式打开开发 StrictMode。
- `index.html`、`tsconfig.json`、`package*.json`：可独立安装运行的脚手架。

## 观察步骤

1. 从刷新后的计数 0 点击“替换三次”，得到 1；再点击“函数更新三次”，得到 4。
2. 在某一计数值点击“保存快照”，继续更新后点击“读取旧闭包”，仍然显示保存那一轮的值。
3. 标记 Hooks 已读，已读数量从 0 到 1。重置后回到 0。数量是派生计算，未保存第二份状态。
4. 先点击“查询 slow”，在 600ms 内点击“查询 fast”，最终建议属于 fast。
5. 点击“模拟失败”进入 error；清空查询回到 idle，不保留旧结果或错误。
6. “聚焦输入”使用 DOM ref，不通过 ref 保存用于显示的关键词。

slow 等待 600ms，其他查询等待 40ms，error 拒绝。这是教学模拟时延，不能用于性能结论。

## 为什么测试不用固定 sleep

测试注入手动 resolve/reject 的 loader，明确控制新旧响应顺序。这个 loader 故意忽略 AbortSignal，证明即使上游未取消，旧回调也会因 active=false 被拒绝。StrictMode 用例检查第一轮清理、第二轮接纳、卸载取消。

## 边界

无真实 HTTP 联调，无请求缓存/重试/跨组件去重，无持久化。真实 HTTP adapter 应验证 response.ok 和响应结构；文章提供节选，但 /api/suggestions 不由本项目实现。jsdom 测试不能证明浏览器绘制时机与网络性能。见 VERIFICATION.md。
