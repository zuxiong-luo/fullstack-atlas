import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Header, HTTPException, Request
from .api import NoteInput
from .storage import NotesStore


def create_storage_app(path, token="study-token"):
    @asynccontextmanager
    async def lifespan(app):
        app.state.store = NotesStore(path)
        yield
        app.state.store = None

    def check_token(authorization: str | None = Header(default=None)):
        if authorization != "Bearer " + token:
            raise HTTPException(status_code=401, detail="需要正确的学习令牌")

    app = FastAPI(lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/notes", dependencies=[Depends(check_token)])
    def list_notes(request: Request):
        return request.app.state.store.list_notes()

    @app.post("/notes", status_code=201, dependencies=[Depends(check_token)])
    def add_note(data: NoteInput, request: Request):
        title = data.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="标题不能只有空格")
        try:
            request.app.state.store.add_many([title])
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="标题已经存在") from None
        return {"title": title, "saved": True}

    return app
