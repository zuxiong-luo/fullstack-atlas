"""Read-only Linux /proc snapshot for the PID named by this lab's readiness file."""
import json
from pathlib import Path
import sys


def inspect(state: Path) -> dict:
    if sys.platform != "linux":
        raise RuntimeError("Linux /proc required")
    ready = json.loads((state / "ready.json").read_text())
    pid = int(ready["pid"])
    process = Path("/proc") / str(pid)
    status = {}
    for line in (process / "status").read_text().splitlines():
        key, _, value = line.partition(":")
        if key in {"Name", "State", "Pid", "Tgid", "PPid", "Threads"}:
            status[key] = value.strip()
    descriptors = {}
    for path in (process / "fd").iterdir():
        try:
            descriptors[path.name] = str(path.readlink())
        except FileNotFoundError:
            descriptors[path.name] = "vanished during snapshot"
    return {"pid": pid, "status": status,
            "task_ids": sorted(int(path.name) for path in (process / "task").iterdir()),
            "fds": descriptors, "cgroup": (process / "cgroup").read_text().strip()}


if __name__ == "__main__":
    if sys.platform != "linux":
        print("SKIP: Linux /proc required", file=sys.stderr)
        raise SystemExit(77)
    print(json.dumps(inspect(Path(sys.argv[1])), ensure_ascii=False))
