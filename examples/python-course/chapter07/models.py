from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, field_validator
from chapter04.notes_tool.domain import Note

Tag = Annotated[str, Field(min_length=1, max_length=32)]


class NoteInput(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)
    id: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,31}$")
    title: str = Field(min_length=1, max_length=200)
    tags: list[Tag] = Field(default_factory=list, max_length=8)

    @field_validator("title")
    @classmethod
    def trimmed_title(cls, value: str) -> str:
        if not value.strip() or value != value.strip():
            raise ValueError("title must be trimmed and non-empty")
        return value

    @field_validator("tags")
    @classmethod
    def normalized_tags(cls, values: list[str]) -> list[str]:
        if any(not tag.strip() or tag != tag.strip().lower() for tag in values):
            raise ValueError("tags must be normalized lower-case strings")
        if len(set(values)) != len(values):
            raise ValueError("duplicate tags")
        return values

    def domain(self) -> Note:
        return Note(self.id, self.title, tuple(self.tags))


class ImportInput(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    notes: list[NoteInput] = Field(min_length=1, max_length=32)

    @field_validator("notes")
    @classmethod
    def unique_ids(cls, values: list[NoteInput]) -> list[NoteInput]:
        if len({note.id for note in values}) != len(values):
            raise ValueError("duplicate note id in batch")
        return values
