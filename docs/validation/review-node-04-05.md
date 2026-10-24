# Node第4～5篇独立交叉审稿

2026-10-24；审稿人非作者。范围：node-parallel-computing、node-performance-memory两篇全文、正文6/7块实际源码、两个完整工程/README/锁文件/测试/记录、4张SVG。没有修改作者文件。

## 独立复现

Node22.12.0/macOS14.5，沿用作者已有依赖状态（两例无第三方npm依赖）；未冒称本轮重新npm ci。

- npm test --prefix examples/node-parallel-computing：13/13。
- npm test --prefix examples/node-performance-memory：6/6。
- node examples/node-parallel-computing/demo.mjs：质数4/25/168；thread同PID/threadId非零，process不同PID/threadId0；两池最终running0/queued0；线程transfer senderBytes0、进程advanced IPC senderBytes8，接收8/42。
- node examples/node-performance-memory/benchmark.mjs：独立服务真实loopback HTTP，两模式各20成功、0错；sync窗口约40.22ms/p95约6.02ms，chunked约75.20ms/p95约8.43ms，仅此次原始短闭环观察，不据此排名/宣传加速。服务maxActive分别1/2；ELU/CPU与内存实际采集。
- 测试真实新子进程--expose-gc生成三快照并解析，AtlasNote 0→128→0、持有数组边128→0，本轮观察GC4条。临时快照删除；未在DevTools手工点Retainers，不把解析已知链当全进程无泄漏证明。

## 逻辑与边界

池审查准入容量、任务id、settled、timer/listener清理、deadline排队+执行范围、普通异常与进程退出差异、排队取消/started后终止/exit后替换、重启预算与重复close。固定可信模块不是权限沙箱；主进程崩溃不持久化，取消不回滚外部副作用。正文与代码相符。

性能审查checksum等价/真实setImmediate让出、闭环模型与协调遗漏、最近秩分位数含失败及错误另报、请求/服务窗口差异、ELU≠全机CPU、直方图无样本null、GC按startTime过滤/最多保留128、external含arrayBuffers、RSS不作活对象断言。快照同步暂停/格式/容量边界明确。

连续源映射6/7一致，终端命令块不当源文件核验。4张XML有效，实际QuickLook渲染人工查看，身份/取消与退出时间线/测量窗口/128对象链均对应实现，无明显文字箭头溢出。没有代替根的站点浏览器/手机验收。

重新查阅Node22.12固定官方worker_threads、child_process、perf_hooks、v8及process.memoryUsage资料，与隔离/transfer/指标描述一致。未发现剩余阻塞项。Linux/容器配额/生产吞吐及真实用户进程诊断仍未验，不据本机短窗口补签。
