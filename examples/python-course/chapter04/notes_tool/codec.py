from collections.abc import Iterable, Iterator
import json
from .domain import Note
from .errors import ImportFailure, NoteError


def parse_note(raw: object) -> Note:
    if not isinstance(raw, dict) or set(raw) != {"id", "title", "tags"}:
        raise NoteError("note requires exactly id, title, tags")
    if any(not isinstance(raw[key], str) for key in ("id", "title")):
        raise NoteError("id and title must be strings")
    if not isinstance(raw["tags"], list):
        raise NoteError("tags must be a list")
    tags: list[str] = []
    for tag in raw["tags"]:
        if not isinstance(tag, str) or not tag.strip():
            raise NoteError("tag must be a non-empty string")
        normalized = tag.strip().lower()
        if normalized not in tags:
            tags.append(normalized)
    return Note(raw["id"].strip(), raw["title"].strip(), tuple(tags))


def iter_records(lines: Iterable[str], *, max_chars: int = 4096) -> Iterator[tuple[int, Note]]:
    if type(max_chars) is not int or max_chars < 1:
        raise ValueError("max_chars must be a positive integer")
    for line_number, line in enumerate(lines, start=1):
        if len(line) > max_chars:
            raise ImportFailure(line_number, f"exceeds {max_chars} characters")
        if not line.strip():
            continue
        try:
            raw: object = json.loads(line)
            note = parse_note(raw)
        except (json.JSONDecodeError, NoteError) as error:
            raise ImportFailure(line_number, str(error)) from error
        yield line_number, note
