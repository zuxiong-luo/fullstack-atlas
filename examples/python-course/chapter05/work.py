from pathlib import Path
from chapter04.notes_tool.codec import iter_records
from chapter04.notes_tool.domain import Note
from chapter04.notes_tool.errors import ImportFailure


def load_jobs(path: Path, *, max_notes: int = 128) -> tuple[Note, ...]:
    if type(max_notes) is not int or not 1 <= max_notes <= 128:
        raise ValueError("max_notes must be an integer in 1..128")
    notes: list[Note] = []
    seen: set[str] = set()
    with path.open(encoding="utf-8") as source:
        for line_number, note in iter_records(source):
            if len(notes) == max_notes:
                raise ImportFailure(line_number, f"exceeds {max_notes} notes")
            if note.id in seen:
                raise ImportFailure(line_number, "duplicate id: " + note.id)
            seen.add(note.id)
            notes.append(note)
    return tuple(notes)


def payload(note: Note) -> bytes:
    # Escaped JSON keeps the line protocol independent of title newlines.
    import json
    return json.dumps({"id": note.id, "title": note.title}, ensure_ascii=True).encode("ascii")


def cpu_checksum(note: Note, rounds: int = 2000) -> dict[str, object]:
    if type(rounds) is not int or not 1 <= rounds <= 10000:
        raise ValueError("rounds must be an integer in 1..10000")
    value = 0
    data = payload(note)
    for _ in range(rounds):
        for byte in data:
            value = (value * 131 + byte) % 1000000007
    return {"id": note.id, "checksum": value}
