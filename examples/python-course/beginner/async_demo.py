import asyncio


async def read_title(number, delay=0):
    if number < 0:
        raise ValueError("编号不能为负数")
    await asyncio.sleep(delay)  # 模拟等待，不是网络请求
    return f"笔记{number}"


async def compare_orders():
    events = []

    async def step(name):
        events.append(name + "开始")
        await asyncio.sleep(0)
        events.append(name + "结束")

    await step("A")
    await step("B")
    sequential = events.copy()
    events.clear()
    await asyncio.gather(step("A"), step("B"))
    return sequential, events


async def read_in_batches(numbers, batch_size=2):
    if type(batch_size) is not int or batch_size < 1:
        raise ValueError("每批数量必须是正整数")
    result = []
    for start in range(0, len(numbers), batch_size):
        batch = numbers[start:start + batch_size]
        waiting = []
        for number in batch:
            waiting.append(read_title(number))
        values = await asyncio.gather(*waiting)
        result.extend(values)
    return result


async def cancellable(events):
    try:
        events.append("开始")
        await asyncio.sleep(1)
        events.append("完成")
    finally:
        events.append("清理")


async def cancel_example():
    events = []
    task = asyncio.create_task(cancellable(events))
    await asyncio.sleep(0)  # 让任务进入等待
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        events.append("已取消")
    return events


async def timeout_example():
    events = []
    try:
        async with asyncio.timeout(0.01):
            await cancellable(events)
    except TimeoutError:
        events.append("超时")
    return events


async def all_or_fail(numbers):
    async with asyncio.TaskGroup() as group:
        tasks = []
        for number in numbers:
            tasks.append(group.create_task(read_title(number)))
    return [task.result() for task in tasks]


async def main():
    print(await read_title(1))
    sequential, concurrent = await compare_orders()
    print("顺序：", sequential)
    print("一起等：", concurrent)
    print(await read_in_batches([1, 2, 3]))
    print("取消：", await cancel_example())
    print("超时：", await timeout_example())
    print("任务组：", await all_or_fail([1, 2]))


if __name__ == "__main__":
    asyncio.run(main())
