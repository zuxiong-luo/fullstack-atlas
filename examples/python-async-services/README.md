# Python 类型边界与结构化并发实验

目标兼容 CPython 3.12；实际验证 CPython 3.12.14 与3.14.3（macOS），没有第三方运行或测试依赖。`pyproject.toml` 声明支持范围；解释器由使用者管理，未伪造3.12锁文件。

```sh
cd examples/python-async-services
python3 --version
python3 -m venv .venv
.venv/bin/python -m unittest -v
printf '%s' '{"values":[0,1,2,3,4],"workers":2,"queue_size":2}' | .venv/bin/python service.py
```

成功 `ok=true`，`values=[0,1,4,9,16]`，`active=0`，`cleaned=started=5`，`peak_active<=2`，`peak_queue<=2`。

受控上游失败：

```sh
printf '%s' '{"values":[1,2,3],"fail_on":1}' | .venv/bin/python service.py
```

返回 `error=upstream`，没有部分成功结果，`active=0`。started/finished/cancelled数目取决于执行顺序，不要求固定。

超时：

```sh
printf '%s' '{"values":[1,2],"delay":1,"timeout":0.01}' | .venv/bin/python service.py
```

返回 `error=timeout`，已启动任务完成finally清理。`values=[true]`返回 `error=input`。外部取消以CancelledError传播，不伪装为上游错误。

实验没有HTTP监听，不是生产服务；upstream用asyncio.sleep模拟可取消等待和平方结果，不发网络请求，不测远端服务性能。结果数组仍为O(n)；输入最多10000项。固定worker+有界队列约束的是任务和队列，不是整个输入/结果内存。时间预算是协作取消，不能抢占阻塞同步代码，也不撤销远端操作。

`test_service.py` 使用 unittest.IsolatedAsyncioTestCase，测试9项；成功/边界/总超时/外部取消/兄弟任务失败后的清理/固定后台任务数量有行为断言。`TaskGroup` 用于一次批次共同成功的语义；如需逐项独立返回，应另设计结果协议，不应吞掉所有异常。
