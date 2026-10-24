# Python第5章：并发模型与有界处理验证

2026-10-24，文章`python-concurrency-models`状态review。新增独立chapter05、10项分章测试、README、容量SVG与工作树入口；不改前三章正文/源码/测试或既有异步第6章。

## 固定环境与一手资料

实测：macOS14.5 x86_64、CPython**3.12.14标准GIL构建**、标准库，无第三方服务。实际浏览核对Python3.12官方threading、concurrent.futures、multiprocessing、asyncio-task、asyncio-queue、asyncio-stream；页面维护版3.12.15与本地解释器分开。另读3.13官方free-threading说明，明确可选构建的版本边界，未假称在该构建运行。

- https://docs.python.org/3.12/library/threading.html
- https://docs.python.org/3.12/library/concurrent.futures.html
- https://docs.python.org/3.12/library/multiprocessing.html#contexts-and-start-methods
- https://docs.python.org/3.12/library/asyncio-task.html
- https://docs.python.org/3.12/library/asyncio-queue.html
- https://docs.python.org/3.12/library/asyncio-stream.html
- https://docs.python.org/3.13/howto/free-threading-python.html

## 实际执行

在examples/python-course，解释器为 `/Users/luozuxiong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`：

```sh
python3 -m chapter05 threads fixtures/notes.jsonl
python3 -m chapter05 asyncio fixtures/notes.jsonl
python3 -m chapter05 processes fixtures/notes.jsonl
python3 -m unittest -v test_course test_chapter04 test_chapter05
```

说明：命令中的python3实际替换为上述3.12.14绝对路径。CLI测试还用sys.executable创建真实-m子进程；没有用本机默认解释器混测。

结果：**33/33通过**，其中既有17项+第4章6项+第5章10项。线程与asyncio对同一loopback端点确认完整响应，结果n1/n2/n3的bytes为44/61/42；进程纯Python校验和为340859824/285734593/375736074，与串行同函数一致。两种负载不同，不作模式间性能排名。

证据：

- Thread Barrier/Event让两个工作线程均到达门闩再验证窗口只推进两项；放行后结果保持顺序，工作线程退出。
- spawn Manager Barrier证明两个不同于父进程且互不相同的PID实际参与。正常与异常之后active_children恢复到调用前集合，未依赖默认fork语义。
- async Event证明固定两个worker重叠；capacity=1时源迭代最多推进4项（2处理中+1排队+生产者至多1）。常规失败取消同组消费者，外部取消仍传播CancelledError，命名任务不残留。
- 真实Streams取消先由服务确认收到请求，再取消客户端；服务观察EOF并关闭。回显夹具退出后无法重连，服务线程已join。
- 所有模式真实CLI坏行退出2且stdout空；记录数量上限拒绝。线程/进程工作失败、非法并发配置、重复ID和输入校验都有断言。

5秒门闩期限是故障保护，不用sleep或总耗时宣称并发成立。PID仅证明进程独立性，不冒称已经测得多核利用率或提速。

## 正文与图形

约4350字符叙述（不含代码），完整展示work/pools/io_lab/async_jobs/cli/主入口关键文件，并展示进程屏障测试原文与完整JSONL输入。9个带真实filename代码块均逐字作为对应文件连续子串验证通过；6个主模块块为完整文件。定向`tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --skipLibCheck src/data/articles/python/index.ts`无诊断。前三章工作树相对主代理暂存快照无差异。

capacity.svg XML可解析，经Quick Look生成1100px图并view_image人工查看，三种执行模型、两种容量含义、回压与清理箭头可读。验收PNG保留ignored work/expansion/python05，不加入public发布。

## 容量与生命周期限制

CLI接收最多128条合法记录，输出也受此数量限制。线程/进程capacity包含运行及等待的未收集future；async Queue容量仅排队项，另有worker与生产者当前项。通用映射函数聚合结果，不宣称无限输入恒定内存。输入4096仍是完整行读入后字符校验；TCP帧65536是含换行的字节容量。

Future.cancel不能强停已运行线程/进程，执行器with会等它们结束；CPU轮数、I/O超时另行限定。线程socket是阻塞操作超时，asyncio.timeout是异步请求取消期限，语义不能混为同一个硬截止点。TaskGroup失败可能留下未消费局部队列，本实现整体放弃队列，不在失败后join；资源清理由工作函数finally与执行器/服务上下文承担。

未做：free-threaded构建、Windows/Linux、浏览器/手机、ZIP/离线交付、生产吞吐/尾延迟、外部故障注入、任意任务强制终止。第一批发布继续使用主代理冻结的前三章快照；第4/5章等待独立审校后才纳入对应发布。

## 根代理发布前复核（2026-10-24）

正文图形完成网站1280×800及390×844检查，放大与局部滚动可用；图无正文矛盾、箭头遮挡或文字裁切。安全6/11、Python全前五章33、Next4/5/8真实用例通过；本批六套交付ZIP均解压到新目录，Node实际npm ci（Next另生产build），没有借用作者环境。Next路由另在实际浏览器验证计数2经Link保留、整页a重置0。以上补充作者阶段记录，不替代原文列明的浏览器Cookie策略、原生移动设备、托管平台或分布式边界。冻结站点、离线和发布证据另见批次记录。
