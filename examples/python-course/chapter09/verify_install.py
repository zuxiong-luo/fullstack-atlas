"""Install a wheel offline into a fresh venv and run outside the source checkout."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

import httpx

HERE = Path(__file__).resolve().parent
TOKEN = "local-demo-token-2026"


def command(arguments: list[str], *, cwd: Path, env: dict[str, str], timeout: int = 60) -> str:
    result = subprocess.run(arguments, cwd=cwd, env=env, text=True,
                            capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"command failed: {arguments[0]} ({result.returncode})\n"
                           + result.stdout + result.stderr)
    return result.stdout


def verify(wheel: Path, wheelhouse: Path) -> dict[str, object]:
    if not wheel.is_file() or not wheelhouse.is_dir():
        raise ValueError("wheel and wheelhouse must exist")
    with tempfile.TemporaryDirectory(prefix="atlas-installed-") as temporary:
        work = Path(temporary)
        environment = {key: value for key, value in os.environ.items()
                       if key != "PYTHONPATH" and not key.startswith("ATLAS_")}
        environment["PYTHONNOUSERSITE"] = "1"
        venv = work / "venv"
        command([sys.executable, "-m", "venv", str(venv)], cwd=work, env=environment)
        python, executable = venv / "bin/python", venv / "bin/atlas-notes"
        command([str(python), "-m", "pip", "install", "--disable-pip-version-check",
                 "--no-index", "--find-links", str(wheelhouse), "-r", str(HERE / "requirements.lock"),
                 str(wheel)], cwd=work, env=environment)
        command([str(python), "-m", "pip", "check"], cwd=work, env=environment)
        imported = json.loads(command([str(python), "-c",
            "import atlas_notes,atlas_notes.api,importlib.metadata,json,sys; print(json.dumps({'file':atlas_notes.__file__,"
            "'version':atlas_notes.__version__,'metadata':importlib.metadata.version('atlas-notes-course'),'course_imports':[n for n in sys.modules if n.startswith('chapter')]}))"],
            cwd=work, env=environment))
        assert (str(venv) in imported["file"] and not imported["course_imports"]
                and imported["version"] == imported["metadata"] == "0.1.0"), imported
        bad = subprocess.run([str(executable)], cwd=work, env=environment | {
            "ATLAS_TOKEN": "do-not-echo-this!", "ATLAS_DB": "relative"}, text=True,
            capture_output=True, timeout=5)
        assert bad.returncode == 2 and "do-not-echo-this!" not in bad.stdout + bad.stderr
        environment |= {"ATLAS_TOKEN": TOKEN, "ATLAS_DB": str(work / "data/notes.sqlite3"), "ATLAS_PORT": "0"}
        benchmark = None
        for first in (True, False):
            log_path = work / ("first.jsonl" if first else "reopen.jsonl")
            with log_path.open("w") as log:
                entry = [str(executable)] if first else [str(python), "-m", "atlas_notes"]
                process = subprocess.Popen(entry, cwd=work, env=environment,
                                           stdout=log, stderr=log)
                try:
                    deadline = time.monotonic() + 8
                    port = None
                    while port is None:
                        for line in log_path.read_text().splitlines():
                            try:
                                event = json.loads(line)
                            except ValueError:
                                continue
                            if event.get("event") == "listener_bound":
                                port = event["port"]
                        if process.poll() is not None or time.monotonic() > deadline:
                            raise AssertionError("installed listener did not bind: " + log_path.read_text())
                        if port is None:
                            time.sleep(.02)
                    base = f"http://127.0.0.1:{port}"
                    with httpx.Client(base_url=base, timeout=.3, trust_env=False) as client:
                        while True:
                            try:
                                if client.get("/health").json() == {"ready": True}:
                                    break
                            except (httpx.HTTPError, ValueError):
                                pass
                            if time.monotonic() > deadline:
                                raise AssertionError("installed HTTP health not observed")
                            time.sleep(.02)
                        headers = {"Authorization": "Bearer " + TOKEN}
                        if first:
                            note = {"id": "n1", "title": "private-title-never-log", "tags": ["python"]}
                            created = client.post("/notes", json=note, headers=headers)
                            assert created.status_code == 201 and created.headers["x-request-id"]
                            assert client.post("/imports", json={"notes": [note | {"id": "n2"}]},
                                               headers=headers).status_code == 201
                            assert client.post("/notes", json=note, headers=headers).status_code == 409
                            assert client.post("/notes", json=note | {"id": "n3", "title": 123},
                                               headers=headers).status_code == 422
                            assert client.get("/notes").status_code == 401
                            benchmark = json.loads(command([str(python), "-m", "atlas_notes.measure",
                                                            "--url", base, "--samples", "32"],
                                                           cwd=work, env=environment))
                        assert len(client.get("/notes", headers=headers).json()["notes"]) == 2
                finally:
                    if process.poll() is None:
                        process.send_signal(signal.SIGINT)
                    try:
                        process.wait(timeout=8)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=2)
                        raise AssertionError("installed service failed graceful shutdown")
            assert process.returncode == 0, (process.returncode, log_path.read_text())
            text = log_path.read_text()
            assert TOKEN not in text and "private-title-never-log" not in text
            events = [json.loads(line) for line in text.splitlines()]
            assert any(event.get("event") == "server_closed" for event in events)
            assert all("request_id" in event for event in events if event.get("event") == "request")
        profile_path = work / "storage.prof"
        profile = json.loads(command([str(python), "-m", "atlas_notes.profile_storage", "--output", str(profile_path)],
                                     cwd=work, env=environment))
        assert profile_path.stat().st_size > 0
        profile_top = command([str(python), "-c", "import pstats,sys; pstats.Stats(sys.argv[1]).sort_stats('cumulative').print_stats(8)",
                               str(profile_path)], cwd=work, env=environment)
        assert "snapshot" in profile_top
        return {"installed_version": imported["version"], "source_checkout_imports": [],
                "fresh_venv_offline_install": True, "real_http": [201, 409, 422, 401],
                "reopened_notes": 2, "clean_shutdowns": 2, "secret_free_logs": True,
                "http_benchmark": benchmark, "storage_profile": profile}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wheel", type=Path, required=True)
    parser.add_argument("--wheelhouse", type=Path, required=True)
    options = parser.parse_args()
    print(json.dumps(verify(options.wheel.resolve(), options.wheelhouse.resolve()), ensure_ascii=False))


if __name__ == "__main__":
    main()
