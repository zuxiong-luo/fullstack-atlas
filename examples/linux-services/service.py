"""Small loopback service with explicit thread and signal lifecycle."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import signal
import threading


def write_json(path: Path, value: object) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value), encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", type=Path, required=True)
    arguments = parser.parse_args()
    state = arguments.state
    state.mkdir(parents=True, exist_ok=True)
    for name in ("ready.json", "stopped.json"):
        (state / name).unlink(missing_ok=True)
    if os.environ.get("ATLAS_LAB_START_FAIL") == "1":
        print(json.dumps({"event": "start_failed", "exit_code": 42}), flush=True)
        return 42
    stopping = threading.Event()
    received = []

    def request_stop(number, frame):
        received.append(signal.Signals(number).name)
        stopping.set()

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps({"pid": os.getpid(), "status": "ok"}).encode()
            self.send_response(200 if self.path == "/health" else 404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    class Server(HTTPServer):
        def get_request(self):
            connection, address = super().get_request()
            connection.settimeout(1)
            return connection, address

    with Server(("127.0.0.1", 0), Handler) as server:
        server.timeout = 0.2
        worker = threading.Thread(target=stopping.wait, name="atlas-lab-worker")
        worker.start()
        try:
            information = {"pid": os.getpid(), "port": server.server_port,
                           "worker_tid": worker.native_id}
            write_json(state / "ready.json", information)
            print(json.dumps({"event": "ready", **information}), flush=True)
            while not stopping.is_set():
                server.handle_request()
        finally:
            stopping.set()
            worker.join(timeout=2)
            if worker.is_alive():
                raise RuntimeError("worker did not stop")
            (state / "ready.json").unlink(missing_ok=True)
            write_json(state / "stopped.json", {"pid": os.getpid(), "signals": received})
            print(json.dumps({"event": "stopped", "signals": received}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
