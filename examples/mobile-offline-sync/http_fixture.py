from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import threading
from remote import apply, initialize, Conflict

@contextmanager
def serve(path, token, after_commit=None):
    initialize(path)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def reply(self, status, data):
            raw = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_POST(self):
            if self.path != "/sync":
                self.reply(404, {"error": "NOT_FOUND"})
                return
            if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token):
                self.reply(401, {"error": "AUTH_REQUIRED"})
                return
            try:
                self.connection.settimeout(2)
                size = int(self.headers.get("Content-Length", "0"))
                if not 1 <= size <= 2048:
                    self.reply(413, {"error": "BODY_LIMIT"})
                    return
                payload = json.loads(self.rfile.read(size).decode("utf-8", errors="strict"))
                result = apply(path, payload)
                if after_commit and after_commit():
                    self.close_connection = True  # Controlled lost response after durable commit.
                    return
                self.reply(200, result)
            except Conflict as error:
                self.reply(409, {"error": error.code, "current": error.current})
            except (ValueError, UnicodeError):
                self.reply(422, {"error": "BAD_INPUT"})
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        yield "http://127.0.0.1:" + str(server.server_port)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
        assert not thread.is_alive()
