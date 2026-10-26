from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from .models import Note, Notebook


class NoteInput(BaseModel):
    title: str = Field(min_length=1, max_length=100)


def create_app(token="study-token"):
    @asynccontextmanager
    async def lifespan(app):
        app.state.book = Notebook()
        yield
        app.state.book = None

    def check_token(authorization: str | None = Header(default=None)):
        if authorization != "Bearer " + token:
            raise HTTPException(status_code=401, detail="需要正确的学习令牌")

    app = FastAPI(lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/notes", dependencies=[Depends(check_token)])
    async def list_notes(request: Request):
        return request.app.state.book.to_list()

    @app.post("/notes", status_code=201, dependencies=[Depends(check_token)])
    async def add_note(data: NoteInput, request: Request):
        title = data.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="标题不能只有空格")
        book = request.app.state.book
        if len(book) >= 100:
            raise HTTPException(status_code=409, detail="学习笔记本最多保存100条")
        note = Note(title)
        book.add(note)
        return note.to_dict()

    return app
