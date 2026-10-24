from collections.abc import Sequence
import json
from pathlib import Path
import sys
from .app import read_notebook
from .errors import ImportFailure


def main(argv: Sequence[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    if len(arguments) != 1:
        print("usage: python -m chapter04.notes_tool notes.jsonl", file=sys.stderr)
        return 2
    path = Path(arguments[0])
    try:
        book = read_notebook(path)
    except (OSError, UnicodeError, ImportFailure) as error:
        print(f"import failed: {path}: {error}", file=sys.stderr)
        return 2
    print(json.dumps({"count": len(book), "notes": [note.to_dict() for note in book]},
                     ensure_ascii=False))
    return 0
