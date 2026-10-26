import asyncio
import unittest
from service import BatchFailed, InputError, Metrics, Request, handle, parse_request, run_batch


class Parsing(unittest.TestCase):
    def test_annotation_does_not_validate(self):
        # Python permits this construction; the parser is our runtime boundary.
        bad = Request(("wrong",))
        self.assertEqual(bad.values, ("wrong",))
        with self.assertRaises(InputError):
            parse_request({"values": ["wrong"]})

    def test_invalid_values_and_budgets(self):
        invalid = [None, [], {"values": [True]}, {"values": [1], "workers": 0},
                   {"values": [], "workers": True}, {"values": [], "queue_size": 0},
                   {"values": [], "timeout": float("nan")},
                   {"values": [], "delay": float("inf")},
                   {"values": [], "timeout": 10**1000},
                   {"values": [], "surprise": 1}, {"values": [0]*10001}]
        for raw in invalid:
            with self.subTest(raw=repr(raw)[:80]), self.assertRaises(InputError):
                parse_request(raw)


class Concurrency(unittest.IsolatedAsyncioTestCase):
    async def test_order_bounds_and_cleanup(self):
        metrics = Metrics()
        values = await run_batch(parse_request({"values": [3, 1, 2, 0], "workers": 2, "queue_size": 1}), metrics)
        self.assertEqual(values, [9, 1, 4, 0])
        self.assertLessEqual(metrics.peak_active, 2)
        self.assertLessEqual(metrics.peak_queue, 1)
        self.assertEqual(metrics.active, 0)
        self.assertEqual(metrics.cleaned, metrics.started)
        self.assertEqual(metrics.finished, 4)

    async def test_empty_input_and_zero_result(self):
        self.assertEqual(await run_batch(parse_request({"values": []})), [])
        self.assertEqual(await run_batch(parse_request({"values": [0]})), [0])

    async def test_taskgroup_failure_cancels_sibling(self):
        from unittest.mock import patch
        active = asyncio.Event()
        cleaned = []
        async def controlled(value, request, metrics):
            if value == 1:
                await active.wait()
                raise __import__('service').UpstreamError("controlled")
            active.set()
            try:
                await asyncio.Event().wait()
            finally:
                cleaned.append(value)
        with patch('service.upstream', controlled):
            with self.assertRaises(BatchFailed):
                await run_batch(parse_request({"values": [1, 2], "workers": 2}))
        self.assertEqual(cleaned, [2])
        self.assertFalse(any(t.get_name().startswith('batch-') for t in asyncio.all_tasks()))

    async def test_total_timeout_cleans_started_jobs(self):
        metrics = Metrics()
        with self.assertRaises(TimeoutError):
            await run_batch(parse_request({"values": [1, 2, 3], "timeout": 0.01, "delay": 1.0}), metrics)
        self.assertGreater(metrics.started, 0)
        self.assertEqual(metrics.active, 0)
        self.assertEqual(metrics.cleaned, metrics.started)
        self.assertGreater(metrics.cancelled, 0)
        self.assertFalse(any(t.get_name().startswith('batch-') for t in asyncio.all_tasks()))

    async def test_external_cancel_propagates_after_cleanup(self):
        metrics = Metrics()
        task = asyncio.create_task(run_batch(parse_request({"values": [1, 2, 3], "delay": 1}), metrics))
        for _ in range(100):
            if metrics.started:
                break
            await asyncio.sleep(0)
        self.assertGreater(metrics.started, 0)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(metrics.active, 0)
        self.assertEqual(metrics.cleaned, metrics.started)

    async def test_error_classification(self):
        self.assertEqual((await handle({"values": [True]}))["error"], "input")
        self.assertEqual((await handle({"values": [1], "fail_on": 1}))["error"], "upstream")
        self.assertEqual((await handle({"values": [1], "delay": 1, "timeout": 0.01}))["error"], "timeout")

    async def test_fixed_number_of_background_tasks(self):
        from unittest.mock import patch
        entered = asyncio.Event()
        release = asyncio.Event()
        async def controlled(value, request, metrics):
            entered.set()
            await release.wait()
            return value*value
        # Check task count, not throughput; separate tests exercise short deadlines.
        with patch('service.upstream', controlled):
            task = asyncio.create_task(run_batch(parse_request({"values": list(range(1000)), "workers": 3, "queue_size": 2, "timeout": 10})))
            await entered.wait()
            batch_tasks = [t for t in asyncio.all_tasks() if t.get_name().startswith('batch-')]
            self.assertEqual(len(batch_tasks), 4)
            release.set()
            self.assertEqual(len(await task), 1000)


if __name__ == '__main__':
    unittest.main()
