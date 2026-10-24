"""A controlled child: each acknowledged stage stays alive for /proc sampling."""
import gc
import json
import os
from pathlib import Path
import sys
import tempfile
import time


def reply(**fields):
    print(json.dumps(fields), flush=True)


def main():
    held = None
    with tempfile.TemporaryDirectory(prefix="atlas-lab-perf-worker-") as folder:
        reply(event="ready", pid=os.getpid())
        for line in sys.stdin:
            if len(line) > 128:
                raise ValueError("control record too long")
            operation = json.loads(line)["operation"]
            started, cpu = time.perf_counter(), time.process_time()
            if operation == "cpu":
                checksum = 0
                for value in range(5_000_000):
                    checksum = (checksum + value * value) & 0xFFFFFFFF
                extra = {"checksum": checksum}
            elif operation == "allocate":
                held = bytearray(32 * 1024 * 1024)
                for offset in range(0, len(held), 4096):
                    held[offset] = 1
                extra = {"held_bytes": len(held)}
            elif operation == "release":
                held = None
                gc.collect()
                extra = {"held_bytes": 0}
            elif operation == "io":
                path = Path(folder) / "payload.bin"
                data = b"x" * (1024 * 1024)
                with path.open("wb") as output:
                    for _ in range(4):
                        output.write(data)
                    output.flush()
                    os.fsync(output.fileno())
                with path.open("rb") as source:
                    count = sum(len(chunk) for chunk in iter(lambda: source.read(65536), b""))
                path.unlink()
                extra = {"logical_bytes": count}
            elif operation == "quit":
                reply(event="stopped", pid=os.getpid())
                return
            else:
                raise ValueError("unknown operation")
            reply(event=operation, wall_s=time.perf_counter() - started,
                  cpu_s=time.process_time() - cpu, **extra)


if __name__ == "__main__":
    main()
