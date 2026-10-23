# Node.js 专题重写与验收

日期：2026-10-23。文章 ID `node-capacity`；保留原5个章节 ID、两个研习题关联。状态 `review`，主代理负责站点/移动端/离线与线上整合。

## 原缺口

原文约8分钟概览，只有概念段落和gzip片段，没有完整HTTP入口、真实取消/故障路径、并发实现和可运行测试；标题承诺的背压与容量无法由读者复现。

## 已交付

- `examples/node-capacity/`，固定Node22.12.0、ESM、无第三方依赖，提供package-lock与.nvmrc。
- 完整HTTP CSV服务：先校验输入；无业务等待队列的单进程并发准入；字节流pipeline；取消/超时/源错误分类；释放幂等；有限退出；健康快照。
- 可取消模拟行源，不称真实数据库。声明单进程范围、信号合作性质、响应头已发后的失败语义，以及线程池/数据库/生产压测未实现范围。
- 正文完整展示capacity.mjs、rows.mjs、server.mjs三个业务文件，server按连续1–58、59–91、92–127行分段；原文件代码逐字核对。
- 两个独立实验：event-loop.mjs、backpressure.mjs，正文都完整展示，数据与日志真实运行。
- 仓库原生可编辑SVG：`public/figures/node-capacity/lifecycle.svg`与`backpressure.svg`，有title/desc/替代文本/图注。

## 实际检查

本机macOS，`node --version`输出v22.12.0。2026-10-23实际执行：

| 检查 | 结果 |
| --- | --- |
| `npm install --package-lock-only --ignore-scripts` | 成功，0第三方包 |
| `npm ci` | 干净安装成功，无第三方依赖 |
| `npm test` | 10通过，0失败，0跳过（完整仓库） |
| `npm run check` | 通过，业务文件和测试语法检查 |
| `node event-loop.mjs` | 先同步计算完成、后调用方拿Promise；微任务后才进入setImmediate；sum49995000 |
| `node backpressure.mjs` | 一次实际结果 produced30/consumed30/maxAhead2；测试容忍上限3，不宣称所有环境必为2 |

测试包括：租约幂等、实际HTTP输出完整字节、非法输入先拒绝、饱和503而health仍200、客户端断开停止生成且可恢复、软总预算终止响应、源故障终止200响应体且可恢复、慢Writable的背压、有限退出、正文连续代码与项目文件相同。

第10项为站点正文/示例一致性检查。ZIP单独运行不包含文章TS时明确skip此项，其他9项仍执行。

## 仍需最终整合确认

- 全站`npm run build`已通过（既有大chunk提示）；下载ZIP与离线包纳入交由主代理：`scripts/example-assets.mjs`需将node-capacity加入ZIP白名单。
- 两图已做静态XML检查，最终页面实际渲染/手机可读性需主代理确认。
- 未压测真实数据库、TLS、代理、慢网和多进程部署，没有性能比例或生产容量结论。
- 延迟测试仅用于制造交错；1000ms计时器和AbortSignal都是合作式机制，不能抢占同步CPU循环。
- Source错误分类曾发现“pipeline销毁响应→close取消→错误误记cancelled”风险，现已通过源error先记录并优先分类，实际故障测试验证failed计数。
