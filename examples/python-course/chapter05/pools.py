from collections.abc import Callable, Iterable
from concurrent.futures import FIRST_COMPLETED, Executor, Future, wait
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import multiprocessing
from typing import TypeVar

T = TypeVar("T")
R = TypeVar("R")


def check_capacity(workers: int, capacity: int) -> None:
    if type(workers) is not int or not 1 <= workers <= 8:
        raise ValueError("workers must be an integer in 1..8")
    if type(capacity) is not int or not 1 <= capacity <= 32:
        raise ValueError("capacity must be an integer in 1..32")


def windowed(executor: Executor, function: Callable[[T], R], items: Iterable[T],
             *, capacity: int) -> list[R]:
    # capacity bounds submitted, not-yet-collected futures, including running ones.
    iterator = enumerate(items)
    pending: dict[Future[R], int] = {}
    results: dict[int, R] = {}
    exhausted = False
    try:
        while pending or not exhausted:
            while len(pending) < capacity and not exhausted:
                try:
                    index, item = next(iterator)
                except StopIteration:
                    exhausted = True
                else:
                    pending[executor.submit(function, item)] = index
            if pending:
                completed, _ = wait(pending, return_when=FIRST_COMPLETED)
                for future in completed:
                    index = pending.pop(future)
                    results[index] = future.result()
        return [results[index] for index in sorted(results)]
    finally:
        for future in pending:
            future.cancel()


def thread_map(function: Callable[[T], R], items: Iterable[T], *, workers: int = 2,
               capacity: int = 2) -> list[R]:
    check_capacity(workers, capacity)
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="notes-worker") as executor:
        return windowed(executor, function, items, capacity=capacity)


def process_map(function: Callable[[T], R], items: Iterable[T], *, workers: int = 2,
                capacity: int = 2) -> list[R]:
    check_capacity(workers, capacity)
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=workers, mp_context=context) as executor:
        return windowed(executor, function, items, capacity=capacity)
