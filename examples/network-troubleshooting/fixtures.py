"""Local UDP DNS subset + real TCP/TLS1.3/HTTP; no public DNS or host changes."""
import argparse
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import signal
import socket
import socketserver
import ssl
import struct
import subprocess
import threading
from dns_wire import read_question


class DnsHandler(socketserver.BaseRequestHandler):
    def handle(self):
        packet, connection = self.request
        try:
            name, query = read_question(packet)
        except (ValueError, UnicodeError):
            return
        if name == "timeout.atlas.test":
            return  # A deliberate no-response fixture, not an upstream DNS outage.
        known = name == "atlas.test"
        flags = 0x8500 if known else 0x8503  # QR + AA + mirrored RD, no recursive service.
        header = struct.pack("!HHHHHH", struct.unpack("!H", packet[:2])[0], flags, 1, int(known), 0, 0)
        answer = (struct.pack("!HHHIH", 0xC00C, 1, 1, 60, 4) + socket.inet_aton("127.0.0.1")) if known else b""
        connection.sendto(header + query + answer, self.client_address)


@contextmanager
def fixture(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o700)
    certificate, key = directory / "cert.pem", directory / "key.pem"
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256",
                    "-keyout", str(key), "-out", str(certificate), "-days", "1",
                    "-subj", "/CN=atlas.test", "-addext", "subjectAltName=DNS:atlas.test",
                    "-addext", "basicConstraints=critical,CA:TRUE"],
                   check=True, capture_output=True, timeout=15)
    key.chmod(0o600)
    release = threading.Event()
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = context.maximum_version = ssl.TLSVersion.TLSv1_3
    context.load_cert_chain(certificate, key)

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self):
            if self.path == "/slow":
                release.wait(timeout=2)
            status = {"/ok": 200, "/slow": 200, "/unavailable": 503}.get(self.path, 404)
            body = json.dumps({"status": status, "path": self.path}).encode()
            try:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except OSError:
                pass  # Client timeout/close is an expected fault in this fixture.

        def log_message(self, *args):
            pass

    class Server(ThreadingHTTPServer):
        daemon_threads = False
        block_on_close = True

        def get_request(self):
            plain, address = super().get_request()
            plain.settimeout(1)
            try:
                return context.wrap_socket(plain, server_side=True), address
            except OSError:
                plain.close()
                raise

    servers, threads = [], []
    refusal = socket.socket()
    try:
        refusal.bind(("127.0.0.1", 0))
        refused_port = refusal.getsockname()[1]
        refusal.close()  # Release the reserved port: probe a genuinely unbound endpoint.
        dns = socketserver.UDPServer(("127.0.0.1", 0), DnsHandler)
        servers.append(dns)
        tls = Server(("127.0.0.1", 0), Handler)
        servers.append(tls)
        for server in servers:
            thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05},
                                      name="atlas-lab-network")
            thread.start()
            threads.append(thread)
        yield {"dns_port": dns.server_address[1], "tls_port": tls.server_port,
               "refused_port": refused_port, "cafile": str(certificate),
               "release": release}
    finally:
        release.set()
        for server in servers:
            server.shutdown()
            server.server_close()
        for thread in threads:
            thread.join(timeout=3)
            if thread.is_alive():
                raise RuntimeError("fixture thread did not stop")
        refusal.close()
        certificate.unlink(missing_ok=True)
        key.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", type=Path, required=True)
    arguments = parser.parse_args()
    stopped = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stopped.set())
    signal.signal(signal.SIGINT, lambda *_: stopped.set())
    try:
        with fixture(arguments.state) as information:
            manifest = {key: value for key, value in information.items() if key != "release"}
            (arguments.state / "manifest.json").write_text(json.dumps(manifest))
            print(json.dumps({"event": "ready", **manifest}), flush=True)
            stopped.wait(timeout=60)
    finally:
        (arguments.state / "manifest.json").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
