"""Stage 3: immutable note values composed into a mutable notebook."""
from dataclasses import dataclass
import json
import sys


@dataclass(frozen=True)
class Note:
    id: str
    title: str
    tags: tuple[str, ...] = ()

    def __post_init__(self):
        for name in ("id", "title"):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                raise ValueError(f"{name} must be a trimmed non-empty string")
        if type(self.tags) is not tuple:
            raise ValueError("tags must be a tuple")
        if any(not isinstance(tag, str) or not tag or tag != tag.strip().lower()
               for tag in self.tags):
            raise ValueError("tags must contain normalized non-empty strings")
        if len(set(self.tags)) != len(self.tags):
            raise ValueError("tags must not contain duplicates")

    def has_tag(self, tag):
        return tag.strip().lower() in self.tags

    def to_dict(self):
        return {"id": self.id, "title": self.title, "tags": list(self.tags)}


def parse_note(raw):
    if not isinstance(raw, dict) or set(raw) != {"id", "title", "tags"}:
        raise ValueError("note requires exactly id, title, tags")
    if any(not isinstance(raw[key], str) for key in ("id", "title")):
        raise ValueError("id and title must be strings")
    if not isinstance(raw["tags"], list):
        raise ValueError("tags must be a list")
    tags = []
    for tag in raw["tags"]:
        if not isinstance(tag, str) or not tag.strip():
            raise ValueError("tag must be a non-empty string")
        normalized = tag.strip().lower()
        if normalized not in tags:
            tags.append(normalized)
    return Note(raw["id"].strip(), raw["title"].strip(), tuple(tags))


class Notebook:
    def __init__(self):
        self._notes = {}

    def add(self, note):
        if not isinstance(note, Note):
            raise TypeError("notebook accepts Note instances")
        if note.id in self._notes:
            raise ValueError("duplicate id: " + note.id)
        self._notes[note.id] = note

    def __len__(self):
        return len(self._notes)

    def __iter__(self):
        return iter(self._notes.values())

    def tagged(self, tag):
        return tuple(note for note in self if note.has_tag(tag))


def import_notebook(lines):
    book = Notebook()
    for line_number, line in enumerate(lines, start=1):
        if len(line) > 4096:
            raise ValueError(f"line {line_number}: exceeds 4096 characters")
        if not line.strip():
            continue
        try:
            book.add(parse_note(json.loads(line)))
        except ValueError as error:
            raise ValueError(f"line {line_number}: {error}") from error
    return book


def main():
    if len(sys.argv) != 2:
        print("usage: python import_notes.py notes.jsonl", file=sys.stderr)
        return 2
    try:
        with open(sys.argv[1], encoding="utf-8") as source:
            book = import_notebook(source)
    except (OSError, UnicodeError, ValueError) as error:
        print("model import failed: " + str(error), file=sys.stderr)
        return 2
    print(json.dumps({"count": len(book), "notes": [note.to_dict() for note in book]},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
