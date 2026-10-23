# Python 异步工程专题验收记录

2026-10-23；对应文章 `python-async-services`。状态仍为 review。

## 原缺口与本轮交付

原文只有五节概览与一个平方任务代码，要求读者自行补失败/取消实验；缺运行时校验、并发容量实现、错误分类、完整测试与图。

本轮保留原5个节ID、文章ID、研习关联；新增4个递进章节（共9节）。先解释类型边界、协程/Task和作用域，再给出完整输入解析、批次核心和调用入口。`service.py`三段正文按原文件顺序覆盖所有关键代码，出处链接只标注官方依据。正常输入、失败输入、具体字段和结果、容量表、解析检查均在正文。

示例位于 `examples/python-async-services/`：仅Python标准库，没有第三方依赖；`pyproject.toml`声明 >=3.12,<3.15。`lifecycle.svg`为可编辑仓库图，说明输入、固定worker、有界队列、TaskGroup和取消清理。不是网络服务，没有伪造上游或模型性能。

## 实际验证

- 解释器：CPython 3.14.3，macOS。初检未在PATH找到3.12；主代理随后发现内置CPython3.12.14，并用该解释器实际执行同一9项测试全部通过。
- `python3 -m unittest discover -s examples/python-async-services -v`：9项通过。
- `python3 -m compileall -q examples/python-async-services`：通过。
- esbuild 读取文章TypeScript：通过。
- 真实执行CLI成功输入：得到 `[0,1,4,9,16]`，active=0，cleaned=started=5；本次peak_active=2、peak_queue=2。
- 真实执行受控失败：返回upstream；总超时：返回timeout；非法JSON/运行时类型路径由测试覆盖。失败后已启动任务执行finally清理。

9项行为测试：
1. 类型注解本身不实施运行时检查，输入解析器拒绝错误元素。
2. bool整数混淆、零worker/零容量、NaN/Inf、溢出预算、未知字段、超大列表等拒绝。
3. 输出顺序、活跃/队列上界与清理。
4. 空输入和数值0不会被当作缺失结果。
5. 用Event确定兄弟已启动后抛受控错误，检查兄弟清理与无后台任务遗留。
6. 总预算超时取消并清理。
7. 外部取消向调用方传播CancelledError并先清理。
8. input/upstream/timeout错误分类。
9. 1000项输入只创建3worker+1producer的4个后台Task。

## 事实依据

已读取Python3.12官方文档的 typing、asyncio-task、asyncio-queue：类型不由运行时强制、TaskGroup作用域与普通异常处理、CancelledError传播、timeout上下文转换、有界队列put等待。本文没有依赖3.13新增Queue.shutdown或3.14新增TaskGroup参数。

## 尚未完成的环境检查

- CPython3.12.14运行：已由主代理补验，9项全部通过；与3.14.3结果分别记录。
- HTTP接口、真实上游取消、网络容量和生产吞吐：不在本篇交付范围；教学上游只是sleep和平方运算。
- SVG浏览器和手机视觉、下载/离线清单、站点回归与线上发布：主代理统一集成，本代理未宣称已完成。

总预算是协作取消，不保证硬实时返回；finally本身若阻塞会延长退出。结果仍为O(n)，输入限定10000项；固定任务和队列容量不等于全程序O(1)内存。取消不证明远端副作用回滚。

主代理补验命令：内置python3.12.14 -m unittest discover -s examples/python-async-services -v，2026-10-23，9项通过。
