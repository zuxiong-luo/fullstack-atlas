# node-parallel-computing 作者验证

2026-10-24。status review，待独立审稿/站点验收。环境macOS14.5 x64 / Node.js22.12.0，无第三方npm依赖。

## 实跑命令与结果

```sh
npm ci --ignore-scripts
npm test
```

**13/13通过**。实际安装清洁无依赖项目，不依赖他项目node_modules。

真实thread与process各有正常、队列限容、排队取消、普通异常、退出替换、started后取消、期限和关闭测试。另验线程ArrayBuffer转移使发送端byteLength0，进程advanced IPC复制保持8；无效输入和重启预算关闭。

正常质数结果10/100/1000为4/25/168。thread同PID、不同threadId；process不同PID、threadId0。PID来自当前运行，不需要等于文档某个数。测试没有用耗时证明加速，没有把事件循环模型当作真实Worker。

另实际运行node demo.mjs并成功退出。不是模拟线程、IPC、网络或堆快照，没有按耗时推导生产能力。

## 源码、图形与参考

正文采用完整关键文件连续原文。两张SVG有效XML，并在940方形外框用Quick Look真实渲染逐张查看；检查文字、方向、数量与代码关系，无明显溢出。页面与手机局部滚动待根集成。

核对Node22.12官方固定文档worker_threads、child_process、perf_hooks、v8/process。代码为本站教学实现，不是运行时源码复制。

## 限制

- size1..4、queue0..32、timeout1..10000ms，任务limit2..5000000；队列在内存，主进程死则丢，不是持久消息系统。
- throw/crash只为故障教学，不能把它们做成公网执行接口。固定模块可信，不提供权限沙箱。
- Worker resourceLimits不等于总RSS硬限额；CPU隔离不自动回滚外部数据库、邮件或支付。
- 取消运行任务会终止整个执行者，等待exit才替换；close是中止，不是drain。
- 进程示例只在本机OS验证；没有Linux/容器CPU配额/生产吞吐结论。

运行demo最后应两个池都running0/queued0，随后finally关闭。测试正常退出证明本次未留下挂住测试的Worker/子进程；OS强杀整个主测试不保证finally。

最终静态复核：6/6正文源码连续匹配，独立内容类型检查通过。
