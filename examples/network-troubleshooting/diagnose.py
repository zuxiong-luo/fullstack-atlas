"""Layered probe: a simulated DNS peer, then real OS TCP, TLS and HTTP."""
import argparse
import http.client
import json
from pathlib import Path
import socket
import ssl
from dns_wire import query_a


def probe(*, dns: tuple[str, int], name: str, port: int, cafile: Path | None,
          server_name: str = "atlas.test", path: str = "/ok", timeout: float = 1) -> dict:
    checks = {}
    layer = "dns"
    try:
        if not 0 < timeout <= 5:
            raise ValueError("timeout must be in (0,5]")
        address = query_a(dns, name, timeout=timeout)
        checks["dns"] = {"address": address, "source": "local UDP A/IN fixture"}
        layer = "tcp"
        with socket.create_connection((address, port), timeout=timeout) as plain:
            checks["tcp"] = {"connected": True}
            layer = "tls"
            context = ssl.create_default_context(cafile=cafile)
            context.minimum_version = ssl.TLSVersion.TLSv1_3
            context.maximum_version = ssl.TLSVersion.TLSv1_3
            with context.wrap_socket(plain, server_hostname=server_name) as secured:
                checks["tls"] = {"version": secured.version(), "hostname_verified": True}
                layer = "http"
                if not path.startswith("/") or any(c in path + server_name for c in "\r\n"):
                    raise ValueError("invalid HTTP path or host")
                request = f"GET {path} HTTP/1.1\r\nHost: {server_name}:{port}\r\nConnection: close\r\n\r\n"
                secured.sendall(request.encode("ascii"))
                with http.client.HTTPResponse(secured) as response:
                    response.begin()
                    body = response.read(4097)
                    if len(body) > 4096:
                        raise ValueError("HTTP body exceeds 4096 bytes")
                    checks["http"] = {"status": response.status, "body": body.decode("utf-8")}
                    success = 200 <= response.status < 300
                    return {"ok": success, "failed_layer": None if success else "http", "checks": checks}
    except (OSError, ValueError, http.client.HTTPException) as error:
        return {"ok": False, "failed_layer": layer, "error_type": type(error).__name__,
                "detail": str(error), "checks": checks}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dns-port", type=int, required=True)
    parser.add_argument("--name", default="atlas.test")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--cafile", type=Path)
    parser.add_argument("--server-name", default="atlas.test")
    parser.add_argument("--path", default="/ok")
    parser.add_argument("--timeout", type=float, default=1)
    arguments = parser.parse_args()
    result = probe(dns=("127.0.0.1", arguments.dns_port), name=arguments.name,
                   port=arguments.port, cafile=arguments.cafile, server_name=arguments.server_name,
                   path=arguments.path, timeout=arguments.timeout)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
