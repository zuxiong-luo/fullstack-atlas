# 验证记录

日期：2026-10-22。环境：macOS x86_64，Node.js 22.12.0；React / React DOM 18.3.1；jsdom 26.1.0；TypeScript 5.7.2；Vite 6.4.5。

实际执行：从新建示例目录运行 `npm ci`（65 packages，审计 0 漏洞），随后 `npm test` 和 `npm run build`。

## 已验证

5 项测试全部通过，使用真实 React DOM createRoot 与 React.act：

1. 三次替换只 +1，三次函数更新 +3；保存的闭包保留旧渲染值。
2. reducer 不修改旧记录，保留未变化记录引用；页面派生已读数量随操作更新。
3. 即使上游忽略取消，旧 slow 在新 fast 之后返回也不能覆盖新结果。
4. 当前失败进入 error；清空进入 idle；过期拒绝不能污染新状态。
5. 开发 StrictMode 的额外 setup/cleanup 取消第一轮，只有第二轮可回写；卸载取消最后一轮。

TypeScript 无错误；Vite 生产构建成功（26 modules）。测试完成时无遗留请求或计时器。

## 事实核验

对照 React 官方 useEffect、useRef、useReducer、Rules of Hooks、State as a Snapshot、Queueing a Series of State Updates、Reusing Logic with Custom Hooks 及 React 18 发布说明。当前文档可能展示新版本，本章未使用 useEffectEvent/use/Actions 等新接口；版本相关行为由锁定 18.3.1 的实验验证。

## 未验证或不作承诺

- 没有真实 HTTP 后端、跨域/断网联调、生产缓存与写入幂等验证。
- jsdom 不测浏览器 paint、帧率、布局或移动端输入法。
- SVG 为可编辑时序示意，不含性能测量；站点注册后的桌面/手机呈现由集成验收执行。
- 不把 npm 审计当作长期安全保证；这里只记录本次安装结果。

站内浏览器实验已实际编译运行并操作核心按钮；文章390px布局及配套SVG已检查。此检查不替代性能测量。
