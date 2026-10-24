import asyncio
from collections.abc import Awaitable, Callable, Iterable
from typing import TypeVar
from .pools import check_capacity

T = TypeVar("T")
R = TypeVar("R")


async def async_map(function: Callable[[T], Awaitable[R]], items: Iterable[T], *,
                    workers: int = 2, capacity: int = 2) -> list[R]:
    check_capacity(workers, capacity)
    queue: asyncio.Queue[tuple[int, T] | None] = asyncio.Queue(maxsize=capacity)
    results: dict[int, R] = {}

    async def produce() -> None:
        for index, item in enumerate(items):
            await queue.put((index, item))
        for _ in range(workers):
            await queue.put(None)

    async def consume() -> None:
        while True:
            entry = await queue.get()
            try:
                if entry is None:
                    return
                index, item = entry
                results[index] = await function(item)
            finally:
                queue.task_done()

    async with asyncio.TaskGroup() as group:
        group.create_task(produce(), name="notes-producer")
        for index in range(workers):
            group.create_task(consume(), name=f"notes-consumer-{index}")
    return [results[index] for index in sorted(results)]
