import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from uuid import uuid4
from chapter04.notes_tool.domain import Note


class Conflict(Exception):
    pass


class Busy(Exception):
    pass


class MemoryNotes:
    """Event-loop-owned store: no await occurs between checking and updating."""
    def __init__(self, capacity: int = 512) -> None:
        self.capacity = capacity
        self.notes: dict[str, Note] = {}

    def add_batch(self, notes: tuple[Note, ...]) -> None:
        ids = [note.id for note in notes]
        if len(ids) != len(set(ids)) or any(key in self.notes for key in ids):
            raise Conflict("note id already exists")
        if len(self.notes) + len(notes) > self.capacity:
            raise Busy("note capacity reached")
        self.notes.update((note.id, note) for note in notes)

    def snapshot(self) -> list[dict[str, object]]:
        return [note.to_dict() for note in self.notes.values()]


@dataclass
class Job:
    id: str
    state: str = "queued"
    count: int = 0
    error: str | None = None

    def snapshot(self) -> dict[str, object]:
        return vars(self).copy()


async def unchanged(note: Note) -> Note:
    # Validation is small CPU work. async alone neither parallelizes nor yields.
    return note


class ImportJobs:
    def __init__(self, store: MemoryNotes, *, workers: int = 2, capacity: int = 2,
                 retention: int = 64, timeout: float = 2.0,
                 prepare: Callable[[Note], Awaitable[Note]] = unchanged) -> None:
        if (any(type(value) is not int for value in (workers, capacity, retention))
                or not 1 <= workers <= 4 or not 1 <= capacity <= 16
                or not workers + capacity <= retention <= 256):
            raise ValueError("invalid job capacities")
        if not 0 < timeout <= 10:
            raise ValueError("invalid job timeout")
        self.store, self.workers, self.retention = store, workers, retention
        self.timeout, self.prepare = timeout, prepare
        self.queue: asyncio.Queue[tuple[Job, tuple[Note, ...]]] = asyncio.Queue(capacity)
        self.jobs: dict[str, Job] = {}
        self.tasks: list[asyncio.Task[None]] = []
        self.accepting = False

    def start(self, group: asyncio.TaskGroup) -> None:
        if self.tasks:
            raise RuntimeError("jobs already started")
        self.accepting = True
        self.tasks = [group.create_task(self.consume(), name=f"notes-import-{i}")
                      for i in range(self.workers)]

    def submit(self, notes: tuple[Note, ...]) -> Job:
        if not self.accepting or self.queue.full():
            raise Busy("import queue unavailable")
        if not 1 <= len(notes) <= 32:
            raise ValueError("batch must contain 1..32 notes")
        if len(self.jobs) >= self.retention:
            oldest = next((key for key, job in self.jobs.items()
                           if job.state in {"succeeded", "failed", "cancelled"}), None)
            if oldest is None:
                raise Busy("job retention capacity reached")
            del self.jobs[oldest]
        job = Job(uuid4().hex)
        self.queue.put_nowait((job, notes))
        self.jobs[job.id] = job
        return job

    async def consume(self) -> None:
        while True:
            job, notes = await self.queue.get()
            try:
                job.state = "running"
                async with asyncio.timeout(self.timeout):
                    prepared = tuple([await self.prepare(note) for note in notes])
                    self.store.add_batch(prepared)
                job.state, job.count = "succeeded", len(prepared)
            except asyncio.CancelledError:
                job.state, job.error = "cancelled", "service shutdown"
                raise
            except (Conflict, Busy) as error:
                job.state, job.error = "failed", str(error)
            except TimeoutError:
                job.state, job.error = "failed", "import timeout"
            except Exception:
                job.state, job.error = "failed", "import processing failed"
            finally:
                self.queue.task_done()

    async def close(self) -> None:
        self.accepting = False
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        while not self.queue.empty():
            job, _ = self.queue.get_nowait()
            job.state, job.error = "cancelled", "service shutdown before execution"
            self.queue.task_done()
        await self.queue.join()
