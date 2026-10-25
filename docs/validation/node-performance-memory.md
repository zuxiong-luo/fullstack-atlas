# Node 性能与内存：2026-10-25 增补验收

Node22.12.0/macOS14.5 x64，原ID/锚点/6项测试保留。新增四分支导读、真实CPU采样栈、连接/活跃资源和池饱和实验；不读写用户进程，不作生产改善声明。

```sh
npm ci --ignore-scripts --prefix examples/node-performance-memory
npm test --prefix examples/node-performance-memory
node examples/node-performance-memory/cpu-profile.mjs
node examples/node-performance-memory/io-diagnostics.mjs
node examples/node-performance-memory/pool-probe.mjs
```

**10/10通过**。原同checksum/实际让出/取消/最近秩/独立HTTP服务/目标边界/三份快照全部通过；快照AtlasNote0→128→0，引用链实检，GC本次4项。新增profile、延迟上游和单线程原生池队列3项。

## 一次实际窗口（不是性能承诺）

- Inspector请求间隔1000us，有限合成重建250ms，窗口250.004922ms/207样本；热点profileCPU→rebuildIndex183，进一步mixRecord14。不能把样本数当函数调用次数，不能用主isolate profile概括进程全部native/Worker线程。
- 自有上游延迟120ms；客户端136.996151ms、processCPU18.996ms、ELU0.134739、循环p99 18.776063ms、自有server连接1；资源包含TCPServerWrap和TCPSocketWrap。CPU/请求/循环的定义和窗口分开解释。
- 两全新进程分别UV_THREADPOOL_SIZE1/4，先提交2×250000轮PBKDF2再读自身package.json。池1：file628.59742ms、order crypto0/crypto1/file；池4：file2.47808ms、order file/crypto1/crypto0。只证明该平台共享池排队，不给生产池大小建议，不锁定多线程顺序或快多少。

测试只检查输入、实际采样栈与工作结果、顺序约束、连接存在和正常收尾，不设CPU/ELU/延迟上限。没有根据并行编译/机器负载变动断言变慢或变快。

## 图形与边界

diagnostic.svg实际CUA完整渲染；四条分支概念/下一步齐全，正文与代码一致。所有完整关键文件逐字内联；原GC/快照/有界闭环负载保留。快照与profile可选文件不入ZIP，测试临时快照删除。

未验证Linux/Windows、容器配额、远程网络、真实生产负载或DevTools手工剖析；getActiveResourcesInfo为本版本实验性接口，只报告类型，不是连接或泄漏计数。自有socket/timer/histogram/session与子进程均清理。站点手机/下载/离线由主集成确认。

## 2026-10-25 同行只读审稿后的定向修正

Nest作者指出旧io-diagnostics把无期限connection等待与可能失败的request分开，连接前失败可悬空。已改连接/响应同预算并行等待，finally abort剩余等待与移除自己的listener，等待真实request close。真实故障仅作用于自有监听：关闭后连接得到ECONNREFUSED；接收后不返回得到AbortError/cause IO_BUDGET_EXCEEDED。两条均断言listening=false、ownedTimers=0、requestDestroyed=true、自己connectionObservers=0。
首轮清理断言曾错误假设HTTP Server只有一条内部connection监听，实际剩余计数1；已改检查自己函数身份，不以总数推断泄漏。最后完整测试10/10通过，不把首轮断言失败列作成功。该组测试外层8秒是保护，内部实际请求2秒绝对预算；不以机器速度排名。同行未冒称执行这两条，作者实际复跑，主最终从刷新ZIP独立验收。
