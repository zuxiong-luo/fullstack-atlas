from collections.abc import Iterator
from dataclasses import dataclass
from .errors import NoteError


@dataclass(frozen=True)
class Note:
    id: str
    title: str
    tags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for name in ("id", "title"):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise NoteError(f"{name} must be a trimmed non-empty string")
        if type(self.tags) is not tuple:
            raise NoteError("tags must be a tuple")
        if any(not isinstance(tag, str) or not tag or tag != tag.strip().lower()
               for tag in self.tags):
            raise NoteError("tags must contain normalized non-empty strings")
        if len(set(self.tags)) != len(self.tags):
            raise NoteError("tags must not contain duplicates")

    def to_dict(self) -> dict[str, object]:
        return {"id": self.id, "title": self.title, "tags": list(self.tags)}


class Notebook:
    def __init__(self) -> None:
        self._notes: dict[str, Note] = {}

    def add(self, note: Note) -> None:
        if not isinstance(note, Note):
            raise TypeError("notebook accepts Note instances")
        if note.id in self._notes:
            raise NoteError("duplicate id: " + note.id)
        self._notes[note.id] = note

    def __len__(self) -> int:
        return len(self._notes)

    def __iter__(self) -> Iterator[Note]:
        return iter(self._notes.values())
