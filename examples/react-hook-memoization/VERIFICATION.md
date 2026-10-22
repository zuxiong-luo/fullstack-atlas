# E2 核验记录

日期2026-10-22；macOS、Node22.12.0、npm10.9.0。React/React DOM18.3.1、TypeScript5.7.2、Vite6.4.5、esbuild0.28.2、jsdom26.1.0。createRoot，无StrictMode。

实际执行`npm test`：6项通过、0失败，其中4项真实React DOM/jsdom交互，1项纯计算确定性，1项4段源码逐字核验。`npm run build`：TypeScript与生产构建通过。安装审计0漏洞。

| 机制 | 官方v18.3.1 ReactFiberHooks.old.js行 | 验证 |
| --- | --- | --- |
| mountMemo保存值和依赖 | 1904–1913 | 完整函数逐字、初始真实渲染 |
| updateMemo命中/重算 | 1915–1934 | 无关更新保持引用，query变化重算；不缓存输出一致 |
| mount/updateCallback保存函数 | 1881–1902 | 依赖正确读6；空依赖故障读1 |
| 依赖逐项Object.is、开发警告 | 326–371 | 完整函数逐字，options新引用使缓存不命中 |
| key替换重建Hook身份 | 公开key行为及上述mount路径 | 重挂载后诊断归1，故障闭包重新捕获6但后续仍错误 |

`source-notes/SHA256.json`锁住完整源码快照；`excerpts.json`保存正文的固定连续行段。测试对源码逐字比对，在完整仓库中还与文章内嵌记录逐字比对；ZIP不含文章TS时只核对摘录清单。

Identity观察已提交引用，不统计全部calculate尝试。故意重计算仅为确定性工作负载，不能据引用数推导性能收益。jsdom不验证浏览器布局/绘制；小屏图形、实际浏览器操作和站点离线整合待主代理验收。本章不包含生产性能、跨实例共享缓存或React Compiler实验。
