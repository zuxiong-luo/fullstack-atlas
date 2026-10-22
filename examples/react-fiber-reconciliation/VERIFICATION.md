# 核验记录

日期：2026-10-22。环境：macOS，Node.js 22.12.0，React / React DOM 18.3.1，jsdom 26.1.0。

- 从锁文件 npm ci 安装成功。
- npm test：5/5 通过，覆盖普通更新、稳定 key 重排、插入删除、下标 key 反例与父级 key 重建。
- npm run build：TypeScript 检查与 Vite 构建通过。
- 断言包括 DOM 对象是否复用、实际计数、ref 事件与 Effect 清理/建立关系。

这些测试不能证明 paint 时机、并发中断时机或性能收益。列表 Placement 的解释以 React 18.3.1 固定源码为证据，不由 jsdom 反推内部标记。其他 React 版本需要重新核验。未覆盖 SSR、hydration、Suspense 恢复和完整调度算法。
