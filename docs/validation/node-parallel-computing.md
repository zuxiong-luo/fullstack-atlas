# Node 并行计算：2026-10-25 增补验收

保留ID/原章节/原13项池行为测试；新增主线程/libuv池/Worker/进程定义、spawn/execFile/exec/fork、cluster实际工程。Node22.12.0/macOS14.5 x64/无第三方依赖。

```sh
npm ci --ignore-scripts --prefix examples/node-parallel-computing
npm test --prefix examples/node-parallel-computing
node examples/node-parallel-computing/process-modes.mjs
node examples/node-parallel-computing/cluster-demo.mjs
```

**17/17通过**：原13项真实thread/process准入、队列、运行取消、期限、关闭、崩溃替换、所有权转移、重启预算完整通过，新增4项含多条IPC故障路径。

实测固定字符串 `hello; printf SHELL_MARK` 经spawn/execFile原样输出；exec固定POSIX命令输出helloSHELL_MARK；maxBuffer64读取4096字节产生ERR_CHILD_PROCESS_STDIO_MAXBUFFER；fork收到7回8并返回不同PID。

cluster实际两个worker进程/共享随机端口/8次新连接，本轮由两个PID响应；不把8次当公平分配或吞吐依据。explicit SCHED_RR仅在本机OS核验。

主审发现首版IPC等待在子进程提前exit时可能悬空，已用child-events的exit/error/deadline单次结算与listener清理修正。实际新增peer exit、silence超时与cluster ready前exit；silence固定教学模式主动保活，父进程finally终止并等exit。第一次silent测试返回正常exit而非timeout，原因是单次message监听移除后IPC不再保活；已修正故障夹具保活，最终17/17通过。此记录保留真实修复过程，不把首轮失败当成功。

owners.svg使用CUA实际完整渲染，明确同进程两isolate共享libuv池和进程B独立地址空间。正文关键文件全部内联，与真实文件逐字比较；原有完整有界池未删减。

限制：Worker非安全沙箱、resourceLimits非总RSS硬上限、原生崩溃可能影响同进程；任务取消不回滚副作用；内存队列不持久；无Windows/Linux/容器生产CPU配额或加速收益结论。站点手机/下载/离线由主最终验收。
