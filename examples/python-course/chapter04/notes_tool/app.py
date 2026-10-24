from collections.abc import Iterable
from pathlib import Path
from .codec import iter_records
from .domain import Notebook
from .errors import ImportFailure, NoteError


def build_notebook(lines: Iterable[str], *, max_chars: int = 4096) -> Notebook:
    book = Notebook()
    for line_number, note in iter_records(lines, max_chars=max_chars):
        try:
            book.add(note)
        except NoteError as error:
            raise ImportFailure(line_number, str(error)) from error
    return book


def read_notebook(path: Path, *, max_chars: int = 4096) -> Notebook:
    with path.open(encoding="utf-8") as source:
        return build_notebook(source, max_chars=max_chars)
