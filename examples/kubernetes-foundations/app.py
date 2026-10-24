"""Finite local container fixture; never use this HTTPServer as a public server."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import signal
import threading

DATA = Path("/data")
VERSION = os.environ.get("APP_VERSION", "v1")
STOP = threading.Event()
SIGNALS = []


def counter() -> int:
    path = DATA / "counter.json"
    return json.loads(path.read_text())["value"] if path.exists() else 0


def atomic(path: Path, value: object) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value))
    temporary.replace(path)


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(2)

    def log_message(self, *arguments):
        pass

    def response(self, status: int, value: object):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/health"):
            healthy = not (DATA / "unhealthy-once").exists()
            self.response(200 if healthy else 503, {"version": VERSION, "pid": os.getpid(), "uid": os.getuid()})
        elif self.path == "/ready":
            ready = os.environ.get("APP_READY", "1") == "1" and not (DATA / "unhealthy-once").exists()
            self.response(200 if ready else 503, {"ready": ready, "version": VERSION})
        elif self.path == "/counter":
            self.response(200, {"value": counter(), "version": VERSION})
        else:
            self.response(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/counter" or self.headers.get("Content-Length", "0") != "0":
            self.response(400, {"error": "only empty POST /counter is supported"})
            return
        value = counter() + 1
        atomic(DATA / "counter.json", {"value": value})
        self.response(201, {"value": value, "version": VERSION})


def main():
    if os.environ.get("APP_START_FAIL") == "1":
        raise SystemExit(42)
    if VERSION not in {"v1", "v2"}:
        raise ValueError("unsupported APP_VERSION")
    DATA.mkdir(exist_ok=True)
    # One-shot probe failure fixture: a container restart consumes this marker.
    (DATA / "unhealthy-once").unlink(missing_ok=True)

    def request_stop(number, frame):
        SIGNALS.append(signal.Signals(number).name)
        STOP.set()

    for number in (signal.SIGINT, signal.SIGTERM):
        signal.signal(number, request_stop)
    with HTTPServer(("0.0.0.0", 8080), Handler) as server:
        server.timeout = .1
        print(json.dumps({"event": "ready", "version": VERSION, "pid": os.getpid()}), flush=True)
        try:
            while not STOP.is_set():
                server.handle_request()
        finally:
            atomic(DATA / ("stopped-" + VERSION + ".json"), {"signals": SIGNALS, "pid": os.getpid()})


if __name__ == "__main__":
    main()
