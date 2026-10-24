import asyncio
from functools import partial
import json
import multiprocessing
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import unittest

from chapter04.notes_tool.domain import Note
from chapter04.notes_tool.errors import ImportFailure
from chapter05.async_jobs import async_map
from chapter05.io_lab import async_echo, blocking_echo, echo_service
from chapter05.pools import process_map, thread_map
from chapter05.work import cpu_checksum, load_jobs

ROOT = Path(__file__).resolve().parent


def process_probe(value, barrier):
    barrier.wait(timeout=5)
    return os.getpid(), value * 2


def process_failure(value):
    raise ValueError("worker rejected record")


class ConcurrencyChoices(unittest.TestCase):
    def test_input_capacity_and_duplicate_validation(self):
        self.assertEqual(len(load_jobs(ROOT / "fixtures/notes.jsonl")), 3)
        with self.assertRaisesRegex(ImportFailure, "exceeds 1 notes"):
            load_jobs(ROOT / "fixtures/notes.jsonl", max_notes=1)
        with self.assertRaisesRegex(ImportFailure, "duplicate"):
            load_jobs(ROOT / "fixtures/duplicate.jsonl")
        with self.assertRaises(ValueError):
            load_jobs(ROOT / "fixtures/notes.jsonl", max_notes=True)

    def test_threads_overlap_and_submission_window(self):
        entered = threading.Barrier(3)
        release = threading.Event()
        lock = threading.Lock()
        pulled, identities, output, errors = [], set(), [], []

        def items():
            for value in range(8):
                pulled.append(value)
                yield value

        def work(value):
            with lock:
                identities.add(threading.get_ident())
            if value < 2:
                entered.wait(timeout=5)
                if not release.wait(timeout=5):
                    raise RuntimeError("test gate was not released")
            return value * 2

        def invoke():
            try:
                output.extend(thread_map(work, items(), workers=2, capacity=2))
            except BaseException as error:
                errors.append(error)

        caller = threading.Thread(target=invoke)
        caller.start()
        try:
            entered.wait(timeout=5)
            self.assertEqual(pulled, [0, 1])
            self.assertEqual(len(identities), 2)
        finally:
            release.set()
            caller.join(timeout=5)
        self.assertFalse(caller.is_alive())
        self.assertEqual(errors, [])
        self.assertEqual(output, list(range(0, 16, 2)))
        self.assertFalse(any(t.name.startswith("notes-worker") for t in threading.enumerate()))

    def test_thread_failure_and_invalid_capacity_cleanup(self):
        with self.assertRaisesRegex(ValueError, "worker rejected"):
            thread_map(process_failure, range(4), capacity=2)
        self.assertFalse(any(t.name.startswith("notes-worker") for t in threading.enumerate()))
        for options in ({"workers": 0}, {"workers": True}, {"capacity": 0}, {"capacity": 33}):
            with self.assertRaises(ValueError):
                thread_map(abs, [-1], **options)

    def test_spawn_processes_are_distinct_and_joined(self):
        before = {child.pid for child in multiprocessing.active_children()}
        context = multiprocessing.get_context("spawn")
        with context.Manager() as manager:
            barrier = manager.Barrier(2)
            result = process_map(partial(process_probe, barrier=barrier), [1, 2])
            self.assertEqual(len({pid for pid, _ in result}), 2)
            self.assertNotIn(os.getpid(), {pid for pid, _ in result})
            self.assertEqual([value for _, value in result], [2, 4])
        self.assertEqual({child.pid for child in multiprocessing.active_children()}, before)
        with self.assertRaisesRegex(ValueError, "worker rejected"):
            process_map(process_failure, [1, 2])
        self.assertEqual({child.pid for child in multiprocessing.active_children()}, before)

    def test_real_loopback_io_equivalence_and_socket_cleanup(self):
        jobs = load_jobs(ROOT / "fixtures/notes.jsonl")
        with echo_service() as address:
            threaded = thread_map(partial(blocking_echo, address), jobs)
            asynchronous = asyncio.run(async_map(partial(async_echo, address), jobs))
            self.assertEqual(threaded, asynchronous)
            self.assertEqual([row["id"] for row in threaded], ["n1", "n2", "n3"])
        with self.assertRaises(OSError):
            socket.create_connection(address, timeout=1)
        self.assertFalse(any(t.name == "notes-echo" for t in threading.enumerate()))

    def test_real_module_cli_all_models_and_failures(self):
        jobs = load_jobs(ROOT / "fixtures/notes.jsonl")
        for mode in ("threads", "processes", "asyncio"):
            result = subprocess.run([sys.executable, "-m", "chapter05", mode, "fixtures/notes.jsonl"],
                                    cwd=ROOT, capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stderr)
            body = json.loads(result.stdout)
            self.assertEqual(body["count"], 3)
            if mode == "processes":
                self.assertEqual(body["results"], [cpu_checksum(note) for note in jobs])
            bad = subprocess.run([sys.executable, "-m", "chapter05", mode, "fixtures/bad.jsonl"],
                                 cwd=ROOT, capture_output=True, text=True, timeout=20)
            self.assertEqual(bad.returncode, 2)
            self.assertEqual(bad.stdout, "")
            self.assertIn("line 2", bad.stderr)
        limited = subprocess.run([sys.executable, "-m", "chapter05", "threads", "fixtures/notes.jsonl", "--max-notes", "1"],
                                 cwd=ROOT, capture_output=True, text=True, timeout=20)
        self.assertEqual(limited.returncode, 2)
        self.assertEqual(limited.stdout, "")


class AsyncChoices(unittest.IsolatedAsyncioTestCase):
    async def test_bounded_queue_overlap_and_order(self):
        started = asyncio.Event()
        release = asyncio.Event()
        active, peak, pulled = 0, 0, []

        def items():
            for value in range(10):
                pulled.append(value)
                yield value

        async def work(value):
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            if active == 2:
                started.set()
            try:
                await release.wait()
                return value * 2
            finally:
                active -= 1

        task = asyncio.create_task(async_map(work, items(), workers=2, capacity=1))
        try:
            await asyncio.wait_for(started.wait(), timeout=5)
            self.assertEqual(peak, 2)
            # Two active + one queued + at most one item held by the producer.
            self.assertLessEqual(len(pulled), 4)
        finally:
            release.set()
        self.assertEqual(await asyncio.wait_for(task, timeout=5), list(range(0, 20, 2)))
        self.assertEqual(active, 0)

    async def test_failure_cancels_sibling_and_drains_task_lifetime(self):
        both_started = asyncio.Event()
        cleaned = set()

        async def work(value):
            try:
                if value == 1:
                    both_started.set()
                    await asyncio.Event().wait()
                await both_started.wait()
                raise ValueError("bad note task")
            finally:
                cleaned.add(value)

        with self.assertRaises(ExceptionGroup) as group:
            await asyncio.wait_for(async_map(work, range(6), workers=2, capacity=1), timeout=5)
        self.assertTrue(any(isinstance(error, ValueError) for error in group.exception.exceptions))
        self.assertTrue({0, 1}.issubset(cleaned))
        self.assertFalse(any(task.get_name().startswith("notes-") for task in asyncio.all_tasks()
                             if task is not asyncio.current_task()))

    async def test_real_stream_cancellation_closes_connection(self):
        accepted = asyncio.Event()
        disconnected = asyncio.Event()
        handlers = set()

        async def hold_response(reader, writer):
            task = asyncio.current_task()
            handlers.add(task)
            try:
                await reader.readline()
                accepted.set()
                await reader.read()
                disconnected.set()
            finally:
                writer.close()
                await writer.wait_closed()
                handlers.remove(task)

        server = await asyncio.start_server(hold_response, "127.0.0.1", 0)
        address = server.sockets[0].getsockname()
        try:
            client = asyncio.create_task(async_echo(address, Note("n1", "Title")))
            await asyncio.wait_for(accepted.wait(), timeout=5)
            client.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await client
            await asyncio.wait_for(disconnected.wait(), timeout=5)
            if handlers:
                await asyncio.gather(*handlers)
        finally:
            server.close()
            await server.wait_closed()

    async def test_outer_cancellation_and_invalid_configuration(self):
        entered = asyncio.Event()
        cleaned = asyncio.Event()

        async def work(value):
            entered.set()
            try:
                await asyncio.Event().wait()
            finally:
                cleaned.set()

        task = asyncio.create_task(async_map(work, range(5), workers=1, capacity=1))
        await asyncio.wait_for(entered.wait(), timeout=5)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(cleaned.is_set())
        with self.assertRaises(ValueError):
            await async_map(work, [], capacity=0)


if __name__ == "__main__":
    unittest.main()
