# E1 核验记录

日期2026-10-22；macOS、Node22.12.0、npm10.9.0。React/React DOM18.3.1，TypeScript5.7.2，Vite6.4.5，esbuild0.28.2，jsdom26.1.0。客户端createRoot，无StrictMode。

实际执行 `npm test`：5项通过、0失败。4项使用真实React DOM/jsdom，1项验证源码哈希及9段逐字摘录。`npm run build`：TypeScript与生产构建通过。安装审计0漏洞。

| 机制 | 固定官方v18.3.1源码行 | 验证 |
| --- | --- | --- |
| 普通props引用与早退 | ReactFiberBeginWork.old.js3722–3767 | 原段逐字校验、普通组件对照 |
| 默认浅比较 | shared/shallowEqual.js18–52 | 原段逐字校验、新对象props真实测试 |
| SimpleMemo相等后检查工作与回退 | BeginWork607–668、3470–3489 | state及props稳定真实测试 |
| 父跳过而子树继续 | BeginWork3365–3404 | Leaf更新，Panel诊断保持 |
| Context消费者与祖先工作 | ReactFiberNewContext.old.js274–286、156–187 | 消费Context主题更新真实测试 |
| 自定义compare | BeginWork541–564 | 忽略函数prop产生unsafe:0，默认组safe:1 |
| 组件执行后仍可bailout | BeginWork1047–1059 | 源码推导；未把全部路径调用次数写成实测 |

源码根路径 `packages/react-reconciler/src/`，shallowEqual位于`packages/shared/`；稳定默认`enableLazyContextPropagation=false`。保留Flow类型、注释和会改变结论的分支，裁剪范围在正文purpose标明。快照版权MIT见LICENSE.react。

测试未读取私有Fiber。CommitCount是提交后诊断节点，不证明全部render尝试或耗时。jsdom不提供真实布局/绘制；浏览器小屏图形、按钮及站点离线包整合需主代理另外记录。本记录不声称这些UI验收已经完成，不含任何性能收益数字。
