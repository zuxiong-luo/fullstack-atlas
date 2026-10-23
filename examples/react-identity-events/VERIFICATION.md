# 验证记录

2026-10-23，macOS / Node22.12.0 / React18.3.1 / jsdom26.1.0。

- 从锁文件npm ci成功。
- npm test：8项通过，覆盖草稿身份/DOM复用、Portal捕获冒泡、背景判断、表单、订阅更新及Escape焦点恢复。
- npm run build：TypeScript检查和Vite构建通过。
- 文章正文中的关键函数与App.tsx对应；入口/依赖不伪称是独立脚本。

限制：不据此声称真实浏览器性能/绘制顺序或完整安全、无障碍验收。
