import argparse
import asyncio
from functools import partial
import json
from pathlib import Path
from .async_jobs import async_map
from .io_lab import async_echo, blocking_echo, echo_service
from .pools import process_map, thread_map
from .work import cpu_checksum, load_jobs
from chapter04.notes_tool.errors import ImportFailure


def main() -> int:
    parser = argparse.ArgumentParser(description="Bounded note processing; no speed benchmark")
    parser.add_argument("mode", choices=("threads", "processes", "asyncio"))
    parser.add_argument("path", type=Path)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--capacity", type=int, default=2)
    parser.add_argument("--max-notes", type=int, default=128)
    arguments = parser.parse_args()
    try:
        jobs = load_jobs(arguments.path, max_notes=arguments.max_notes)
        options = {"workers": arguments.workers, "capacity": arguments.capacity}
        if arguments.mode == "processes":
            results = process_map(cpu_checksum, jobs, **options)
        else:
            with echo_service() as address:
                if arguments.mode == "threads":
                    results = thread_map(partial(blocking_echo, address), jobs, **options)
                else:
                    results = asyncio.run(async_map(partial(async_echo, address), jobs, **options))
    except ExceptionGroup as errors:
        _, unexpected = errors.split((OSError, ValueError))
        if unexpected is not None:
            raise
        parser.exit(2, f"processing failed: {errors}\n")
    except (OSError, UnicodeError, ValueError, ImportFailure) as error:
        parser.exit(2, f"processing failed: {error}\n")
    print(json.dumps({"mode": arguments.mode, "count": len(results), "results": results},
                     ensure_ascii=False))
    return 0
