import asyncio
import json
from pathlib import Path
import socket
import threading
import time
import unittest

import httpx
from fastapi.testclient import TestClient
import uvicorn
from chapter04.notes_tool.domain import Note
from chapter07.api import Settings, create_app
from chapter07.jobs import Busy, ImportJobs, MemoryNotes

TOKEN = "local-demo-token-2026"
HEADERS = {"Authorization": "Bearer " + TOKEN}
NOTE = {"id": "n1", "title": "Python 对象", "tags": ["python"]}


class HttpBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(Settings(TOKEN))
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.assertTrue(all(task.done() for task in self.app.state.jobs.tasks))
        self.assertEqual(self.app.state.jobs.queue.qsize(), 0)

    def test_auth_create_read_and_conflict(self):
        self.assertEqual(self.client.get("/health").json(), {"ready": True})
        denied = self.client.get("/notes")
        self.assertEqual(denied.status_code, 401)
        self.assertEqual(denied.headers["www-authenticate"], "Bearer")
        self.assertEqual(self.client.get("/notes", headers={"Authorization": "Bearer wrong"}).status_code, 401)
        self.assertEqual(self.client.post("/notes", json=NOTE, headers=HEADERS).status_code, 201)
        self.assertEqual(self.client.get("/notes", headers=HEADERS).json()["notes"], [NOTE])
        self.assertEqual(self.client.post("/notes", json=NOTE, headers=HEADERS).status_code, 409)

    def test_strict_validation_and_byte_limit(self):
        for patch in [{"title": 123}, {"title": " padded "}, {"extra": True},
                      {"tags": ["Python"]}, {"tags": ["x", "x"]}, {"id": "../bad"}]:
            self.assertEqual(self.client.post("/notes", json=NOTE | patch, headers=HEADERS).status_code, 422)
        for body in [{"notes": []}, {"notes": [NOTE, NOTE]}, {"notes": [NOTE] * 33}]:
            self.assertEqual(self.client.post("/imports", json=body, headers=HEADERS).status_code, 422)
        self.assertEqual(self.client.post("/notes", content=b"x" * 32769, headers=HEADERS).status_code, 413)
        self.assertEqual(self.client.get("/notes", headers=HEADERS).json(), {"notes": []})

    def test_unavailable_queue_maps_to_429_and_recovers(self):
        self.app.state.jobs.accepting = False
        response = self.client.post("/imports", json={"notes": [NOTE]}, headers=HEADERS)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["retry-after"], "1")
        self.app.state.jobs.accepting = True
        response = self.client.post("/imports", json={"notes": [NOTE]}, headers=HEADERS)
        self.assertEqual(response.status_code, 202)

    def test_import_success_and_atomic_conflict(self):
        body = json.loads((Path(__file__).parent / "chapter07/fixtures/import.json").read_text())
        response = self.client.post("/imports", json=body, headers=HEADERS)
        self.assertEqual(response.status_code, 202)
        job_id = response.json()["id"]
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            status = self.client.get("/imports/" + job_id, headers=HEADERS).json()
            if status["state"] == "succeeded":
                break
        self.assertEqual(status["state"], "succeeded")
        self.assertEqual(status["count"], 2)
        duplicate = {"notes": [{"id": "n3", "title": "new", "tags": []}, body["notes"][0]]}
        job_id = self.client.post("/imports", json=duplicate, headers=HEADERS).json()["id"]
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            status = self.client.get("/imports/" + job_id, headers=HEADERS).json()
            if status["state"] == "failed":
                break
        self.assertEqual(status["state"], "failed")
        self.assertEqual(len(self.client.get("/notes", headers=HEADERS).json()["notes"]), 2)
        self.assertEqual(self.client.get("/imports/missing", headers=HEADERS).status_code, 404)


class CapacityTests(unittest.IsolatedAsyncioTestCase):
    async def test_running_queued_rejection_and_shutdown_are_observed(self):
        entered, release, cleaned = asyncio.Event(), asyncio.Event(), asyncio.Event()

        async def prepare(note):
            entered.set()
            try:
                await release.wait()
                return note
            finally:
                cleaned.set()

        store = MemoryNotes()
        jobs = ImportJobs(store, workers=1, capacity=1, prepare=prepare)
        async with asyncio.TaskGroup() as group:
            jobs.start(group)
            running = jobs.submit((Note("a", "running"),))
            await asyncio.wait_for(entered.wait(), 1)
            queued = jobs.submit((Note("b", "queued"),))
            with self.assertRaises(Busy):
                jobs.submit((Note("c", "rejected"),))
            self.assertEqual((running.state, queued.state, jobs.queue.qsize()), ("running", "queued", 1))
            await jobs.close()
        self.assertTrue(cleaned.is_set())
        self.assertEqual([running.state, queued.state], ["cancelled", "cancelled"])
        self.assertEqual(store.snapshot(), [])
        self.assertTrue(all(task.done() for task in jobs.tasks))
        with self.assertRaises(Busy):
            jobs.submit((Note("d", "closed"),))

    async def test_prepare_failure_does_not_publish_partial_batch(self):
        async def fail_second(note):
            if note.id == "b":
                raise RuntimeError("private error")
            return note
        store = MemoryNotes()
        jobs = ImportJobs(store, prepare=fail_second)
        async with asyncio.TaskGroup() as group:
            jobs.start(group)
            job = jobs.submit((Note("a", "ok"), Note("b", "failure")))
            await asyncio.wait_for(jobs.queue.join(), 1)
            await jobs.close()
        self.assertEqual(job.state, "failed")
        self.assertNotIn("private", job.error)
        self.assertEqual(store.snapshot(), [])

    async def test_timeout_cleans_operation_and_retention_evicts_terminal_only(self):
        cleaned = asyncio.Event()
        async def blocked(note):
            try:
                await asyncio.Event().wait()
            finally:
                cleaned.set()
        jobs = ImportJobs(MemoryNotes(), workers=1, capacity=1, retention=2,
                          timeout=.01, prepare=blocked)
        async with asyncio.TaskGroup() as group:
            jobs.start(group)
            first = jobs.submit((Note("a", "timeout"),))
            await asyncio.wait_for(jobs.queue.join(), 1)
            self.assertEqual(first.error, "import timeout")
            self.assertTrue(cleaned.is_set())
            for key in ("b", "c"):
                jobs.submit((Note(key, "next"),))
                await asyncio.wait_for(jobs.queue.join(), 1)
            self.assertEqual(len(jobs.jobs), 2)
            self.assertNotIn(first.id, jobs.jobs)
            await jobs.close()


class RealSocketTests(unittest.TestCase):
    def test_uvicorn_real_tcp_auth_request_and_shutdown(self):
        listener = socket.socket()
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(create_app(Settings(TOKEN)), log_level="error",
                                              timeout_graceful_shutdown=2))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]})
        thread.start()
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=.2, trust_env=False) as client:
                deadline = time.monotonic() + 3
                while True:
                    try:
                        if client.get("/health").json() == {"ready": True}:
                            break
                    except (httpx.HTTPError, ValueError):
                        pass
                    if time.monotonic() >= deadline:
                        self.fail("HTTP health not observed")
                    time.sleep(.01)  # Poll a real response, not an assumed startup duration.
                self.assertEqual(client.post("/notes", json=NOTE, headers=HEADERS).status_code, 201)
                self.assertEqual(client.get("/notes", headers=HEADERS).json()["notes"], [NOTE])
        finally:
            server.should_exit = True
            thread.join(5)
            listener.close()
        self.assertFalse(thread.is_alive())


if __name__ == "__main__":
    unittest.main(verbosity=2)
