from contextlib import asynccontextmanager
from pathlib import Path
import os
import secrets
from typing import Annotated
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .storage import Busy, Conflict, ConnectionPool, NotesRepository, migrate
from .config import AuthSettings as Settings
from .body_limit import BodyLimit
from .models import ImportInput, NoteInput


def create_app(path: Path, settings: Settings, *, pool_size: int = 2) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Startup precedes serving; bounded local migration is synchronous here.
        migrate(path)
        pool = ConnectionPool(path, pool_size)
        app.state.pool = pool
        try:
            yield
        finally:
            pool.close()

    app = FastAPI(title="Atlas Notes installed service", lifespan=lifespan)
    app.add_middleware(BodyLimit, limit=32768)
    bearer = HTTPBearer(auto_error=False)

    async def authenticated(credentials: Annotated[HTTPAuthorizationCredentials | None,
                                                   Depends(bearer)]):
        if credentials is None or not secrets.compare_digest(
                credentials.credentials.encode(), settings.token.encode()):
            raise HTTPException(401, "invalid bearer token", headers={"WWW-Authenticate": "Bearer"})

    def repository(request: Request):
        try:
            with request.app.state.pool.borrow() as connection:
                yield NotesRepository(connection)
        except Busy as error:
            raise HTTPException(503, str(error), headers={"Retry-After": "1"}) from error
        except Conflict as error:
            raise HTTPException(409, str(error)) from error

    @app.get("/health")
    def health():
        return {"ready": True}

    @app.get("/notes", dependencies=[Depends(authenticated)])
    def list_notes(notes: Annotated[NotesRepository, Depends(repository)]):
        return {"notes": notes.snapshot()}

    @app.post("/notes", status_code=201, dependencies=[Depends(authenticated)])
    def add_note(note: NoteInput, notes: Annotated[NotesRepository, Depends(repository)]):
        notes.add_batch((note.domain(),))
        return note.model_dump()

    @app.post("/imports", status_code=201, dependencies=[Depends(authenticated)])
    def import_notes(body: ImportInput, notes: Annotated[NotesRepository, Depends(repository)]):
        notes.add_batch(tuple(note.domain() for note in body.notes))
        return {"count": len(body.notes), "committed": True}

    return app

