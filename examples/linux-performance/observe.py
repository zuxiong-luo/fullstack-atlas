"""Read only this caller-selected PID; do not tune the host or send signals."""
import json
import os
from pathlib import Path
import sys
import time


def snapshot(pid: int) -> dict[str, object]:
    if sys.platform != "linux":
        raise RuntimeError("Linux /proc required")
    root = Path("/proc") / str(pid)
    stat = (root / "stat").read_text()
    fields = stat[stat.rfind(")") + 2:].split()  # comm may contain spaces/parentheses.
    status = {}
    for line in (root / "status").read_text().splitlines():
        key, _, value = line.partition(":")
        if key in {"VmRSS", "VmHWM", "Threads"}:
            status[key] = int(value.split()[0])
    counters = {key: int(value) for line in (root / "io").read_text().splitlines()
                for key, value in [line.split(":", 1)]}
    ticks = os.sysconf("SC_CLK_TCK")
    return {"pid": pid, "start_ticks": int(fields[19]), "sample_monotonic_s": time.monotonic(),
            "cpu_seconds": (int(fields[11]) + int(fields[12])) / ticks,
            "clock_ticks_per_s": ticks, "rss_bytes": status["VmRSS"] * 1024,
            "peak_rss_bytes": status["VmHWM"] * 1024, "threads": status["Threads"], "io": counters}


def delta(before: dict, after: dict) -> dict[str, object]:
    if before["pid"] != after["pid"] or before["start_ticks"] != after["start_ticks"]:
        raise ValueError("different process identity or reused PID")
    elapsed = after["sample_monotonic_s"] - before["sample_monotonic_s"]
    if elapsed <= 0:
        raise ValueError("non-positive observation interval")
    cpu = after["cpu_seconds"] - before["cpu_seconds"]
    return {"interval_s": elapsed, "cpu_seconds": cpu, "one_core_percent": cpu / elapsed * 100,
            "rss_change_bytes": after["rss_bytes"] - before["rss_bytes"],
            "io_delta": {key: after["io"][key] - value for key, value in before["io"].items()}}


if __name__ == "__main__":
    print(json.dumps(snapshot(int(sys.argv[1]))))
