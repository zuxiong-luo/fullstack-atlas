# Python 第4～5章独立交叉审校

2026-10-24，macOS14.5 x64，CPython **3.12.14**标准GIL构建。

## 执行和读取

完整读取模块边界与并发选择两篇正文、chapter04/notes_tool、chapter05的work/pools/async_jobs/io_lab/cli以及测试；所有带examples路径代码逐字匹配连续原文。运行课程根：

```sh
/path/to/python3.12 -m unittest discover -v
```

结果 **33/33**，含先前17项、模块6项和并发10项。真实-m子进程、spawn进程、loopback TCP与Streams关闭均参与，没有把睡眠时间当作并行证明。

## 审校结论

**未发现阻断性问题。** 模块搜索与相对导入、__main__入口、__all__边界、注解不替代校验、异常原因链和程序错误不吞掉都与实现一致。with拥有/借用语义、生成器延迟执行和完整行字符校验边界准确。

并发篇区分标准3.12 GIL、I/O释放、纯Python CPU、spawn成本及可选free-threaded构建，不发布未经测量加速比。future窗口是已提交未收集数量，结果仍聚合；async容量是队列等待项，另加workers和生产者手中至多一项。消费者失败取消同组成员且TaskGroup等待生命周期结束，没有失败后错误queue.join造成无消费者等待。

Executor cancel不强停运行函数、with会等运行工作、阻塞socket单操作超时与async总预算不同均明确。loopback资源在finally关闭，Streams真实取消测试观察到EOF。输入最多128条与单行完整读入后4096字符的限制分开，没有声称无限文件恒定内存。

## 官方核对与内部前提

核对Python3.12 concurrent.futures、asyncio TaskGroup、threading/GIL、模块教程。官方当前页面维护3.12.15与实际3.12.14分开记载。代码中的内部windowed假定capacity已由thread_map/process_map调用前校验；当前CLI及所有公开包装路径满足该前提，不把直接绕过包装调用内部辅助函数作为已支持入口。

已向原作者报告通过结论。没有改他文件。未验free-threaded、其他OS、生产网络、静态类型检查、手机或图形浏览器渲染；这些限制不因33项通过而消除。
