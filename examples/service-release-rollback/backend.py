import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import signal
import threading

STOP, RELEASE = threading.Event(), threading.Event()


class LimitedServer(ThreadingHTTPServer):
    permits = threading.BoundedSemaphore(4)

    def process_request(self, request, address):
        if not self.permits.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.permits.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.permits.release()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", choices=["v1", "v2"], required=True)
    parser.add_argument("--state", type=Path, required=True)
    options = parser.parse_args()
    if os.environ.get("APP_START_FAIL") == "1":
        raise SystemExit(42)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(2)

        def log_message(self, *arguments):
            pass

        def respond(self, status, **fields):
            body = json.dumps({"version": options.version, **fields}).encode()
            self.send_response(status)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Content-Type", "application/json")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            ready = (options.state / "mode.txt").read_text().strip() == "ok"
            if self.path == "/health":
                self.respond(200, alive=True)
            elif self.path == "/ready":
                self.respond(200 if ready else 503, ready=ready)
            elif self.path == "/hold":
                print(json.dumps({"event": "held", "version": options.version}), flush=True)
                released = RELEASE.wait(5)
                self.respond(200 if released else 503, released=released)
            elif self.path == "/":
                self.respond(200 if ready else 500, ok=ready)
            else:
                self.respond(404, error="not found")

        def do_POST(self):
            if self.path == "/release" and self.headers.get("Content-Length", "0") == "0":
                RELEASE.set()
                self.respond(200, released=True)
            else:
                self.respond(400, error="unsupported control request")

    def stop(number, frame):
        STOP.set()
        RELEASE.set()

    for number in (signal.SIGINT, signal.SIGTERM):
        signal.signal(number, stop)
    with LimitedServer(("127.0.0.1", 0), Handler) as server:
        server.timeout = .1
        print(json.dumps({"event": "ready", "port": server.server_port, "version": options.version}), flush=True)
        while not STOP.is_set():
            server.handle_request()
    print(json.dumps({"event": "stopped", "version": options.version}), flush=True)


if __name__ == "__main__":
    main()
