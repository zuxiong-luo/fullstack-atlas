"""Create an installable snapshot, without imports from the course checkout."""
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
COURSE = HERE.parent


def expected() -> dict[str, str]:
    domain = (COURSE / "chapter04/notes_tool/domain.py").read_text()
    errors = (COURSE / "chapter04/notes_tool/errors.py").read_text()
    jobs = (COURSE / "chapter07/jobs.py").read_text()
    errors += "\n\n" + jobs[jobs.index("class Conflict"):jobs.index("class MemoryNotes")]
    models = (COURSE / "chapter07/models.py").read_text().replace(
        "from chapter04.notes_tool.domain import Note", "from .domain import Note")
    storage = (COURSE / "chapter08/storage.py").read_text().replace(
        "from chapter04.notes_tool.domain import Note", "from .domain import Note").replace(
        "from chapter07.jobs import Busy, Conflict", "from .errors import Busy, Conflict")
    api = (COURSE / "chapter08/api.py").read_text().replace(
        "from chapter07.api import Settings", "from .config import AuthSettings as Settings").replace(
        "from chapter07.body_limit", "from .body_limit").replace(
        "from chapter07.models", "from .models").replace(
        'title="Atlas Notes chapter 8"', 'title="Atlas Notes installed service"')
    api = api.split("\n\ndef build_app", 1)[0] + "\n"
    return {"domain.py": domain, "errors.py": errors, "models.py": models,
            "body_limit.py": (COURSE / "chapter07/body_limit.py").read_text(),
            "storage.py": storage, "api.py": api}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    options = parser.parse_args()
    for name, body in expected().items():
        target = HERE / "src/atlas_notes" / name
        if options.check:
            if not target.exists() or target.read_text() != body:
                raise SystemExit("package snapshot differs: " + name)
        else:
            target.write_text(body)
    print("installable source snapshot matches" if options.check else "installable source snapshot generated")


if __name__ == "__main__":
    main()
