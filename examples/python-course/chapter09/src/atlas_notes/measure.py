import argparse
import json
import math
import os
import platform
import time
from urllib.parse import urlsplit
import httpx


def benchmark(url: str, token: str, samples: int = 32, warmup: int = 5) -> dict[str, object]:
    parsed = urlsplit(url)
    if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or parsed.path not in ("", "/"):
        raise ValueError("benchmark only accepts an http://127.0.0.1:port base URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("base URL must not contain credentials, query or fragment")
    if type(samples) is not int or not 1 <= samples <= 1000 or not 0 <= warmup <= 20:
        raise ValueError("invalid benchmark sample counts")
    timings = []
    with httpx.Client(base_url=url, timeout=2, trust_env=False,
                      headers={"Authorization": "Bearer " + token}) as client:
        def request() -> int:
            response = client.get("/notes")
            response.raise_for_status()
            return len(response.json()["notes"])
        for _ in range(warmup):
            request()
        started = time.perf_counter()
        counts = []
        for _ in range(samples):
            before = time.perf_counter()
            counts.append(request())
            timings.append((time.perf_counter() - before) * 1000)
        elapsed = time.perf_counter() - started
    ordered = sorted(timings)
    percentile = lambda fraction: ordered[max(0, math.ceil(fraction * samples) - 1)]
    return {"python": platform.python_version(), "workload": "serial GET /notes including JSON decode",
            "concurrency": 1, "samples": samples, "warmup_excluded": warmup,
            "note_counts": sorted(set(counts)), "elapsed_s": round(elapsed, 6),
            "p50_ms": round(percentile(.5), 3), "p95_ms": round(percentile(.95), 3),
            "requests_per_s": round(samples / elapsed, 2)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8019")
    parser.add_argument("--samples", type=int, default=32)
    options = parser.parse_args()
    print(json.dumps(benchmark(options.url, os.environ.get("ATLAS_TOKEN", ""), options.samples)))


if __name__ == "__main__":
    main()
