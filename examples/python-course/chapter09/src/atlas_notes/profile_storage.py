import argparse
import cProfile
import json
from pathlib import Path
import platform
import sqlite3
import tempfile
import time
import tracemalloc
from .domain import Note
from .storage import ConnectionPool, NotesRepository, migrate


def profile(output: Path) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="atlas-notes-profile-") as folder:
        path = Path(folder) / "notes.sqlite3"
        migrate(path)
        pool = ConnectionPool(path, 1)
        try:
            with pool.borrow() as connection:
                repository = NotesRepository(connection)
                for start in range(0, 128, 32):
                    repository.add_batch(tuple(Note(f"n{i}", f"note {i}", ("python", "profile"))
                                               for i in range(start, start + 32)))
                for _ in range(5):
                    repository.snapshot()
                profiler = cProfile.Profile()
                tracemalloc.start()
                try:
                    started = time.perf_counter()
                    profiler.enable()
                    for _ in range(20):
                        assert len(repository.snapshot()) == 128
                    profiler.disable()
                    elapsed = time.perf_counter() - started
                    current, peak = tracemalloc.get_traced_memory()
                finally:
                    profiler.disable()
                    tracemalloc.stop()
                profiler.dump_stats(output)
        finally:
            pool.close()
    return {"python": platform.python_version(), "sqlite": sqlite3.sqlite_version,
            "workload": "20 repository snapshots, 128 notes x 2 tags, warmup 5 excluded",
            "profiled_elapsed_s": round(elapsed, 6), "traced_current_bytes": current,
            "traced_peak_bytes": peak, "includes_profiler_overhead": True,
            "memory_scope": "Python allocations in this process; excludes SQLite native pages and RSS"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    print(json.dumps(profile(options.output)))


if __name__ == "__main__":
    main()
