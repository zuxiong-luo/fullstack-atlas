"""Python 3.12-compatible, deterministic local asyncio experiment; no network."""
from __future__ import annotations
import asyncio
from dataclasses import dataclass
import json
import math
import sys
from typing import Any


class InputError(ValueError):
    pass


class UpstreamError(RuntimeError):
    pass


class BatchFailed(RuntimeError):
    pass


@dataclass(frozen=True)
class Request:
    values: tuple[int, ...]
    workers: int = 2
    queue_size: int = 2
    timeout: float = 1.0
    delay: float = 0.01
    fail_on: int | None = None


def parse_request(raw: object) -> Request:
    if not isinstance(raw, dict):
        raise InputError("request must be an object")
    allowed = {"values", "workers", "queue_size", "timeout", "delay", "fail_on"}
    if set(raw) - allowed:
        raise InputError("unknown field")
    values = raw.get("values")
    if not isinstance(values, list) or len(values) > 10_000:
        raise InputError("values must be a list of at most 10000 integers")
    if any(type(v) is not int or abs(v) > 1_000_000 for v in values):
        raise InputError("each value must be an integer in [-1000000,1000000]")
    def integer(name: str, default: int, maximum: int) -> int:
        value = raw.get(name, default)
        if type(value) is not int or not 1 <= value <= maximum:
            raise InputError(f"{name} outside valid integer range")
        return value
    def number(name: str, default: float, minimum: float, maximum: float) -> float:
        value = raw.get(name, default)
        if type(value) not in (int, float):
            raise InputError(f"{name} must be numeric")
        try:
            parsed = float(value)
        except OverflowError as error:
            raise InputError(f"{name} outside valid finite range") from error
        if not math.isfinite(parsed) or not minimum <= parsed <= maximum:
            raise InputError(f"{name} outside valid finite range")
        return parsed
    fail_on = raw.get("fail_on")
    if fail_on is not None and type(fail_on) is not int:
        raise InputError("fail_on must be an integer or null")
    return Request(tuple(values), integer("workers", 2, 16),
                   integer("queue_size", 2, 64),
                   number("timeout", 1.0, 0.001, 30.0),
                   number("delay", 0.01, 0.0, 5.0), fail_on)


@dataclass
class Metrics:
    active: int = 0
    peak_active: int = 0
    peak_queue: int = 0
    started: int = 0
    finished: int = 0
    cleaned: int = 0
    cancelled: int = 0


async def upstream(value: int, request: Request, metrics: Metrics) -> int:
    metrics.active += 1
    metrics.started += 1
    metrics.peak_active = max(metrics.peak_active, metrics.active)
    try:
        await asyncio.sleep(request.delay)
        if value == request.fail_on:
            raise UpstreamError(f"controlled failure for {value}")
        metrics.finished += 1
        return value * value
    except asyncio.CancelledError:
        metrics.cancelled += 1
        raise
    finally:
        metrics.active -= 1
        metrics.cleaned += 1


async def run_batch(request: Request, metrics: Metrics | None = None) -> list[int]:
    # Trust boundary: use parse_request for JSON. Request is an internal type.
    metrics = metrics if metrics is not None else Metrics()
    queue: asyncio.Queue[tuple[int, int] | None] = asyncio.Queue(request.queue_size)
    results: list[int | None] = [None] * len(request.values)

    async def produce() -> None:
        for index, value in enumerate(request.values):
            await queue.put((index, value))
            metrics.peak_queue = max(metrics.peak_queue, queue.qsize())
        for _ in range(request.workers):
            await queue.put(None)
            metrics.peak_queue = max(metrics.peak_queue, queue.qsize())

    async def consume() -> None:
        while True:
            item = await queue.get()
            try:
                if item is None:
                    return
                index, value = item
                results[index] = await upstream(value, request, metrics)
            finally:
                queue.task_done()

    async with asyncio.timeout(request.timeout):
        try:
            async with asyncio.TaskGroup() as group:
                group.create_task(produce(), name="batch-producer")
                for index in range(request.workers):
                    group.create_task(consume(), name=f"batch-worker-{index}")
        except* UpstreamError as errors:
            raise BatchFailed(f"upstream batch failed: {len(errors.exceptions)} error(s)") from errors
    if any(value is None for value in results):
        raise RuntimeError("incomplete results after a successful task group")
    return [value for value in results if value is not None]


async def handle(raw: object) -> dict[str, Any]:
    metrics = Metrics()
    try:
        request = parse_request(raw)
        values = await run_batch(request, metrics)
        return {"ok": True, "values": values, "metrics": vars(metrics)}
    except InputError as error:
        return {"ok": False, "error": "input", "detail": str(error)}
    except TimeoutError:
        return {"ok": False, "error": "timeout", "metrics": vars(metrics)}
    except BatchFailed as error:
        return {"ok": False, "error": "upstream", "detail": str(error), "metrics": vars(metrics)}
    # External cancellation deliberately propagates to the caller.


def main() -> None:
    try:
        raw = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        print(json.dumps({"ok": False, "error": "input", "detail": "invalid JSON"}))
        return
    print(json.dumps(asyncio.run(handle(raw)), ensure_ascii=False))


if __name__ == "__main__":
    main()
