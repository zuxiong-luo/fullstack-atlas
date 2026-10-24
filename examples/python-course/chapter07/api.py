import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass
import os
import secrets
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .body_limit import BodyLimit
from .jobs import Busy, Conflict, ImportJobs, MemoryNotes
from .models import ImportInput, NoteInput


@dataclass(frozen=True)
class Settings:
    token: str
    workers: int = 2
    capacity: int = 2

    def __post_init__(self) -> None:
        if not isinstance(self.token, str) or not 16 <= len(self.token) <= 128:
            raise ValueError("token must contain 16..128 characters")
        if type(self.workers) is not int or not 1 <= self.workers <= 4:
            raise ValueError("workers outside 1..4")
        if type(self.capacity) is not int or not 1 <= self.capacity <= 16:
            raise ValueError("capacity outside 1..16")


def create_app(settings: Settings) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store = MemoryNotes()
        jobs = ImportJobs(store, workers=settings.workers, capacity=settings.capacity)
        app.state.store, app.state.jobs = store, jobs
        async with asyncio.TaskGroup() as group:
            jobs.start(group)
            try:
                yield
            finally:
                await jobs.close()

    app = FastAPI(title="Atlas Notes chapter 7", lifespan=lifespan)
    app.add_middleware(BodyLimit, limit=32768)
    bearer = HTTPBearer(auto_error=False)

    async def authenticated(credentials: Annotated[HTTPAuthorizationCredentials | None,
                                                   Depends(bearer)]) -> None:
        if credentials is None or not secrets.compare_digest(
                credentials.credentials.encode(), settings.token.encode()):
            raise HTTPException(401, "invalid bearer token", headers={"WWW-Authenticate": "Bearer"})

    async def store(request: Request) -> MemoryNotes:
        return request.app.state.store

    async def jobs(request: Request) -> ImportJobs:
        return request.app.state.jobs

    @app.get("/health")
    async def health(request: Request):
        return {"ready": request.app.state.jobs.accepting}

    @app.get("/notes", dependencies=[Depends(authenticated)])
    async def list_notes(repository: Annotated[MemoryNotes, Depends(store)]):
        return {"notes": repository.snapshot()}

    @app.post("/notes", status_code=201, dependencies=[Depends(authenticated)])
    async def add_note(note: NoteInput, repository: Annotated[MemoryNotes, Depends(store)]):
        try:
            repository.add_batch((note.domain(),))
        except Conflict as error:
            raise HTTPException(409, str(error)) from error
        except Busy as error:
            raise HTTPException(429, str(error)) from error
        return note.model_dump()

    @app.post("/imports", status_code=202, dependencies=[Depends(authenticated)])
    async def submit_import(body: ImportInput, service: Annotated[ImportJobs, Depends(jobs)]):
        try:
            job = service.submit(tuple(note.domain() for note in body.notes))
        except Busy as error:
            raise HTTPException(429, str(error), headers={"Retry-After": "1"}) from error
        return job.snapshot()

    @app.get("/imports/{job_id}", dependencies=[Depends(authenticated)])
    async def import_status(job_id: str, service: Annotated[ImportJobs, Depends(jobs)]):
        job = service.jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "job not found or evicted")
        return job.snapshot()

    return app


def build_app() -> FastAPI:
    return create_app(Settings(token=os.environ.get("ATLAS_TOKEN", "")))
