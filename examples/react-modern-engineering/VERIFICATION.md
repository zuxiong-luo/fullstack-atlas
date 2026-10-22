# 实际验证记录

核验日期：2026-10-22。环境：macOS、Node.js v22.12.0，依赖固定在 package-lock.json。

执行命令：`npm install` 生成锁文件后，再按读者路径执行 `npm ci` 与 `npm test`（内含 `npm run build`）。两次测试均通过；仓库 `npx tsc --noEmit` 也通过。初次安装审计：0 vulnerabilities；这不是安全审计结论。

## 自动行为检查

`node --test test.mjs`：4 tests / 4 pass / 0 fail。

1. 相同快照：React DOM hydrateRoot 后按钮保持原节点；真实 click 令 0 变为 1；无 onRecoverableError。
2. 文本不匹配：服务端 0、客户端 99；onRecoverableError 收到错误，根内按钮节点替换；click 令 99 变为 100。此结论仅对应本例无 Suspense 边界的文本不匹配。
3. HTML 上下文：受控 `</script><script>…` 标题不能增加脚本元素或执行注入；application/json 解析结果与原字符串一致，标题为文本。
4. HTTP：并发 Alice/Bob 请求返回各自标题及不同 request ID；200/no-store；模拟失败返回 500，响应不泄漏内部错误；错误日志包含 phase；不存在路径 404；客户端 bundle 200。

## 资料核对

- https://react.dev/reference/react-dom/client/hydrateRoot ：首轮一致性、recoverable error；页面属于当前文档，代码只采用 React 18 实际支持并经过实验的 API。
- https://react.dev/reference/react-dom/server/renderToPipeableStream ：shell 就绪/错误/发送后状态边界。正文是机制说明，项目未实现流式数据源。
- https://react.dev/reference/rsc/server-components ：RSC 与 SSR 不同职责、框架集成版本边界。项目未实现 RSC。

## 未声明验证的部分

本记录不声称真实浏览器 CSP、真实网络分块、移动性能、生产流量或 Next.js/RSC 兼容测试通过。图为可编辑 SVG 示意，不是性能图。页面呈现由主任务集成后单独检查。

主任务追加：内置浏览器访问真实4307服务，点击计数从0到1；不匹配入口恢复显示99。文章390px布局、SSR示意图放大渲染已检查。
