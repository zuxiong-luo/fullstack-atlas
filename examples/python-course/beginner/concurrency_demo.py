from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import multiprocessing
import time


def read_title(number):
    if number < 0:
        raise ValueError("编号不能为负数")
    time.sleep(0.01)  # 模拟等待；本例没有访问网络
    return f"笔记{number}"


def square(number):
    return number * number


def threaded_titles(numbers):
    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(read_title, numbers))


def process_squares(numbers):
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=2, mp_context=context) as pool:
        return list(pool.map(square, numbers))


if __name__ == "__main__":
    print("顺序：", [read_title(n) for n in [1, 2, 3]])
    print("线程：", threaded_titles([1, 2, 3]))
    print("进程：", process_squares([1, 2, 3]))
    with ThreadPoolExecutor(max_workers=2) as pool:
        future = pool.submit(read_title, -1)
        try:
            future.result()
        except ValueError as error:
            print("任务失败：", error)
