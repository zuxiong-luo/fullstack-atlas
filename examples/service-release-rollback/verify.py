from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent
HTTP = build_opener(ProxyHandler({}))


def run(arguments, check=True):
    result = subprocess.run(arguments, text=True, capture_output=True, timeout=15)
    if check and result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result


def request(port, path="/", post=False):
    target = Request(f"http://127.0.0.1:{port}{path}", data=b"" if post else None)
    try:
        with HTTP.open(target, timeout=8) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        with error:
            return error.code, json.load(error)


def eventually(predicate, label, seconds=10):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            if predicate():
                return
        except OSError:
            pass
        time.sleep(.03)
    raise AssertionError("not observed: " + label)


def event(process, expected):
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        if not selector.select(5):
            raise AssertionError("backend event missing: " + expected)
        result = json.loads(process.stdout.readline())
        assert result["event"] == expected, result
        return result


def main():
    if sys.platform != "linux":
        raise SystemExit("Linux disposable VM required")
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    children, proxy = [], None
    with tempfile.TemporaryDirectory(prefix="atlas-lab-release-") as temporary:
        work = Path(temporary)
        if any(c.isspace() or c in '{};"' for c in str(work)):
            raise ValueError("unsupported nginx prefix characters")
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            front = reservation.getsockname()[1]
        active = work / "active.conf"
        try:
            print(run(["nginx", "-v"], check=False).stderr, flush=True)

            def backend(name, version, mode="ok", fail=False):
                state = work / name
                state.mkdir()
                (state / "mode.txt").write_text(mode)
                process = subprocess.Popen([sys.executable, "-u", str(ROOT / "backend.py"),
                                            "--version", version, "--state", str(state)],
                                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                           env=os.environ | {"APP_START_FAIL": "1" if fail else "0"})
                children.append(process)
                if fail:
                    assert process.wait(timeout=5) == 42
                    return None, state
                return event(process, "ready")["port"], state

            first, _ = backend("first", "v1")
            template = (ROOT / "nginx.conf.in").read_text()
            def config(port):
                return template.replace("@ROOT@", str(work)).replace("@FRONT@", str(front)).replace("@BACKEND@", str(port))
            previous = config(first)
            active.write_text(previous)
            proxy = subprocess.Popen(["nginx", "-p", str(work), "-c", str(active)],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            eventually(lambda: request(front)[1]["version"] == "v1", "initial proxy v1")
            assert int((work / "nginx.pid").read_text()) == proxy.pid
            backend("startup-failure", "v2", fail=True)
            bad, _ = backend("not-ready", "v2", mode="error")
            assert request(bad, "/health")[0] == 200 and request(bad, "/ready")[0] == 503
            assert request(front)[1]["version"] == "v1"
            print(json.dumps({"case": "preflight_reject", "startup_exit": 42, "alive": 200, "ready": 503,
                              "active_version": "v1"}), flush=True)
            invalid = work / "invalid.conf"
            invalid.write_text(previous + "THIS_IS_NOT_A_DIRECTIVE;\n")
            digest = hashlib.sha256(active.read_bytes()).hexdigest()
            assert run(["nginx", "-t", "-p", str(work), "-c", str(invalid)], check=False).returncode != 0
            assert hashlib.sha256(active.read_bytes()).hexdigest() == digest
            assert request(front)[1]["version"] == "v1"
            second, state = backend("second", "v2")
            assert request(second, "/ready")[0] == 200

            def switch(text):
                prepared = work / "prepared.conf"
                prepared.write_text(text)
                run(["nginx", "-t", "-p", str(work), "-c", str(prepared)])
                prepared.replace(active)
                run(["nginx", "-s", "reload", "-p", str(work), "-c", str(active)])

            with ThreadPoolExecutor(1) as executor:
                held = executor.submit(request, front, "/hold")
                event(children[0], "held")
                switch(config(second))
                eventually(lambda: request(front)[1]["version"] == "v2", "new requests use v2")
                assert request(first, "/release", post=True)[0] == 200
                assert held.result(timeout=5)[1]["version"] == "v1"
            print(json.dumps({"case": "reload_drain", "held_request": "v1", "new_request": "v2",
                              "invalid_config_left_active_unchanged": True}), flush=True)
            (state / "mode.txt").write_text("error")
            assert request(front)[0] == 500 and request(second, "/health")[0] == 200
            switch(previous)
            eventually(lambda: request(front) == (200, {"version": "v1", "ok": True}), "rollback v1")
            print(json.dumps({"case": "postcutover_rollback", "failed_business": 500, "recovered": "v1"}), flush=True)
        finally:
            if proxy is not None and proxy.poll() is None:
                proxy.send_signal(signal.SIGQUIT)
                try:
                    proxy.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    proxy.kill()
                    proxy.wait(timeout=2)
            for process in children:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=2)
                for pipe in [process.stdout, process.stderr]:
                    pipe.close()
            if proxy is not None:
                proxy.stdout.close()
                proxy.stderr.close()
            assert all(process.poll() is not None for process in children)
            assert proxy is None or proxy.poll() is not None
            print(json.dumps({"cleanup": "processes_stopped", "only_own_prefix": work.name}), flush=True)
    with socket.socket() as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        probe.bind(("127.0.0.1", front))  # No private nginx listener remains.
    assert not work.exists()
    print(json.dumps({"cleanup": "complete", "temporary_directory_removed": True}), flush=True)


if __name__ == "__main__":
    main()
