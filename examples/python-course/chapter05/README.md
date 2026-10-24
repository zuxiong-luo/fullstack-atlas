# 第5章：线程、spawn进程与asyncio的有界选择

环境：CPython **3.12.14标准GIL构建**，macOS14.5 x86_64，标准库，无需第三方安装或外部服务。3.12官方文档页面维护版3.12.15与实测分开；3.13可选free-threaded构建仅作为版本边界说明，未实测。前三章和既有异步第6章未修改。

从仓库根目录进入`examples/python-course`，下载包进入`python-course`，然后运行：

```sh
python3 --version
python3 -m chapter05 threads fixtures/notes.jsonl
python3 -m chapter05 asyncio fixtures/notes.jsonl
python3 -m chapter05 processes fixtures/notes.jsonl
python3 -m unittest -v test_chapter05
python3 -m unittest -v test_course test_chapter04 test_chapter05
```

三个模式不是同一性能基准：threads/asyncio访问本机临时TCP回显端点；processes运行纯Python整数校验和。它们用于验证模型、边界和清理，没有提速、吞吐或尾延迟结论。

## 文件与输入输出

- `work.py`：复用第4章Note解析，最多接收128条记录；准备单行ASCII JSON负载和确定性CPU函数。
- `pools.py`：线程与spawn进程共用有界future窗口，按输入顺序返回结果。
- `async_jobs.py`：一个生产者、固定worker数、有界Queue与TaskGroup。
- `io_lab.py`：临时loopback回显夹具、阻塞与可等待客户端、帧容量和连接关闭。
- `cli.py` / `__main__.py`：真实`python -m chapter05`入口。没有模块顶层创建进程，适配spawn安全导入。
- `test_chapter05.py`在课程根目录，包含10项独立测试。

输入仍为`fixtures/notes.jsonl`三条笔记，重复ID、字段错误和坏JSON都失败；先完成有限输入校验，再启动任务。threads与asyncio成功输出：

```json
{"mode":"threads","count":3,"results":[{"id":"n1","bytes":44},{"id":"n2","bytes":61},{"id":"n3","bytes":42}]}
```

asyncio只将mode改成`asyncio`，其余结果相同。bytes是传输的ASCII转义JSON字节数，不是原文中文字符数。processes输出：

```json
{"mode":"processes","count":3,"results":[{"id":"n1","checksum":340859824},{"id":"n2","checksum":285734593},{"id":"n3","checksum":375736074}]}
```

校验和不是密码学摘要。默认2000轮用于演示纯Python计算；结果与串行同函数相等，不证明比串行快。

## 失败与容量

```sh
python3 -m chapter05 threads fixtures/notes.jsonl --max-notes 1
# 退出2，stdout空，stderr含exceeds 1 notes
python3 -m chapter05 asyncio fixtures/bad.jsonl
# 退出2，stdout空，stderr含line 2
python3 -m chapter05 processes fixtures/notes.jsonl --capacity 0
# 退出2，stdout空，容量配置被拒绝
```

- `--workers`为1..8；`--capacity`为1..32；`--max-notes`为1..128。CLI聚合输入/结果有记录数量上限，通用映射函数接收无限输入时结果仍会增长，不是恒定内存算法。
- 线程/进程capacity包括运行中的和等待中的“已提交但未收集future”。asyncio capacity仅是排队项，另外还有workers个处理中和生产者至多持有1项。
- 上游文件4096限制仍是完整行读入后的Unicode字符校验，包含换行，不是底层字节读取硬限制。TCP请求/响应限制65536字节，包含帧末换行。
- 线程socket的3秒是阻塞操作等待限制；asyncio.timeout(3)是异步请求的取消式期限。它们不具有完全相同的端到端超时语义，也不是硬抢占任意代码。
- future失败后取消尚未开始的工作，并在执行器退出时等待运行项结束。Future.cancel不会强停已运行线程/进程。CPU轮数有界，I/O有超时；未交付任意任务的硬终止沙箱。
- async TaskGroup中一项失败会取消同组任务并等待清理；队列未消费项随局部队列放弃，不在失败后调用queue.join等待永远不会处理的条目。

## 验证证据与限制

10项独立测试通过；连同前三章17项与第四章6项，共33项。Thread Barrier/Event证明两个线程进入受控点并验证提交窗口；spawn Manager Barrier证明两独立进程参与，结束后无新增活动子进程。async Event检查重叠与队列回压、组失败/外部取消后无命名任务残留。真实Streams取消先确认服务收到请求再取消，服务观察EOF；回显服务退出后端口无法重连，服务线程已join。

测试没有用sleep宣称并发成立；门闩等待期限仅用于失败保护。此处进程PID证明独立性，未测量物理核心利用率或加速比。loopback服务是可信本机教学夹具，非生产公网服务。未做Windows/Linux、free-threaded构建、生产吞吐、任意任务强制停止或浏览器/手机视觉验收。

参考：[线程与GIL](https://docs.python.org/3.12/library/threading.html)、[Future](https://docs.python.org/3.12/library/concurrent.futures.html)、[spawn](https://docs.python.org/3.12/library/multiprocessing.html#contexts-and-start-methods)、[TaskGroup与取消](https://docs.python.org/3.12/library/asyncio-task.html)、[Queue](https://docs.python.org/3.12/library/asyncio-queue.html)、[Streams](https://docs.python.org/3.12/library/asyncio-stream.html)、[3.13可选free-threaded说明](https://docs.python.org/3.13/howto/free-threading-python.html)。
