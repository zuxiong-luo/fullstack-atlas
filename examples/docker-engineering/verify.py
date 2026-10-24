import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener
from uuid import uuid4

ROOT = Path(__file__).resolve().parent
HTTP = build_opener(ProxyHandler({}))


def docker(*arguments, check=True, timeout=30):
    result = subprocess.run(["docker", *arguments], capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"docker {arguments[0]}: {result.returncode}\n{result.stdout}\n{result.stderr}")
    return result


def inspect(name):
    return json.loads(docker("inspect", name).stdout)[0]


def eventually(function, label, seconds=15):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            result = function()
            if result:
                return result
        except (OSError, ValueError, HTTPError):
            pass
        time.sleep(.05)
    raise AssertionError("not observed: " + label)


def request(port, path="/health", *, post=False):
    target = Request(f"http://127.0.0.1:{port}{path}", data=b"" if post else None)
    with HTTP.open(target, timeout=1) as response:
        return response.status, json.load(response)


def main():
    if sys.platform != "linux":
        raise SystemExit("Linux disposable VM required")
    endpoint = docker("context", "inspect", "--format", "{{.Endpoints.docker.Host}}").stdout.strip()
    if os.environ.get("DOCKER_HOST") or not endpoint.startswith("unix://"):
        raise SystemExit("local Unix-socket Docker context required")
    prefix = "atlas-lab-docker-" + uuid4().hex[:10]
    image, volume = prefix + ":fixture", prefix + "-data"
    names = [prefix + suffix for suffix in ("-first", "-second", "-fail", "-oom")]
    for name in names:
        if docker("inspect", name, check=False).returncode == 0:
            raise RuntimeError("refuse existing lab name")
    if docker("volume", "inspect", volume, check=False).returncode == 0:
        raise RuntimeError("refuse existing lab volume")
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        print(docker("version").stdout, flush=True)
        docker("build", "--label", "atlas.lab=" + prefix, "--tag", image, str(ROOT), timeout=180)
        print(json.dumps({"image_id": inspect(image)["Id"], "base": (ROOT / "Dockerfile").read_text().splitlines()[0]}), flush=True)
        docker("volume", "create", "--label", "atlas.lab=" + prefix, volume)

        def start(name, version):
            docker("run", "--detach", "--name", name, "--label", "atlas.lab=" + prefix,
                   "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=8m", "--cap-drop", "ALL",
                   "--security-opt", "no-new-privileges", "--memory", "128m", "--memory-swap", "128m",
                   "--cpus", "0.5", "--pids-limit", "32", "--mount", f"type=volume,source={volume},target=/data",
                   "--publish", "127.0.0.1::8080", "--env", "APP_VERSION=" + version, image)
            info = inspect(name)
            port = int(info["NetworkSettings"]["Ports"]["8080/tcp"][0]["HostPort"])
            eventually(lambda: request(port)[1]["version"] == version, version + " HTTP health")
            return port

        port = start(names[0], "v1")
        first = inspect(names[0])
        config = first["HostConfig"]
        assert config["ReadonlyRootfs"] and config["Memory"] == 128 * 1024 * 1024
        assert config["NanoCpus"] == 500_000_000 and config["PidsLimit"] == 32
        assert first["Config"]["User"] == "10001:10001"
        limits = json.loads(docker("exec", names[0], "python", "-c",
            "from pathlib import Path;import json;root=Path('/sys/fs/cgroup');"
            "print(json.dumps({k:(root/k).read_text().strip() for k in ['cpu.max','memory.max','pids.max']}))").stdout)
        quota, period = map(int, limits["cpu.max"].split())
        assert quota / period == .5 and limits["memory.max"] == str(128 * 1024 * 1024)
        assert limits["pids.max"] == "32"
        print(json.dumps({"case": "actual_cgroup_v2_limits", **limits}), flush=True)
        assert request(port)[1]["pid"] == 1 and request(port)[1]["uid"] == 10001
        host_namespace = os.readlink("/proc/self/ns/pid")
        container_namespace = docker("exec", names[0], "python", "-c", "import os;print(os.readlink('/proc/self/ns/pid'))").stdout.strip()
        assert host_namespace != container_namespace
        assert request(port, "/counter", post=True) == (201, {"value": 1, "version": "v1"})
        docker("stop", "--time", "3", names[0])
        assert inspect(names[0])["State"]["ExitCode"] == 0
        port = start(names[1], "v2")
        assert request(port, "/counter")[1] == {"value": 1, "version": "v2"}
        stopped = json.loads(docker("exec", names[1], "python", "-c",
                             "from pathlib import Path;print(Path('/data/stopped-v1.json').read_text())").stdout)
        assert stopped["signals"] == ["SIGTERM"]
        print(json.dumps({"case": "isolation_persistence_signal", "persistent_value": 1,
                          "uid": 10001, "pid_in_container": 1, "different_pid_namespace": True}), flush=True)
        docker("run", "--detach", "--name", names[2], "--env", "APP_START_FAIL=1", image)
        assert docker("wait", names[2]).stdout.strip() == "42"
        docker("run", "--detach", "--name", names[3], "--memory", "64m", "--memory-swap", "64m",
               "--pids-limit", "16", "--cpus", "0.5", image, "python", "-u", "/app/oom_fixture.py")
        waited = docker("wait", names[3], timeout=30).stdout.strip()
        logs = docker("logs", names[3], check=False)
        state = inspect(names[3])["State"]
        print(json.dumps({"case": "oom_diagnostic", "wait_exit": waited, "state": state,
                          "stdout": logs.stdout, "stderr": logs.stderr}), flush=True)
        events = [json.loads(line) for line in logs.stdout.splitlines() if line.startswith("{")]
        after = next(event for event in events if event["event"] == "oom_after")
        assert after["allocator_exit"] == -9 and after["oom_kill_delta"] >= 1
        assert after["cgroup"]["memory.max"] == str(64 * 1024 * 1024)
        assert after["cgroup"]["memory.swap.max"] == "0"
        eventually(lambda: inspect(names[3])["State"]["OOMKilled"] is True,
                   "Docker cgroup OOM event reflected in state", seconds=5)
        assert waited == "137" and inspect(names[3])["State"]["ExitCode"] == 137
        print(json.dumps({"case": "bounded_failures", "startup_exit": 42, "oom_killed": True,
                          "allocator_sigkill": True, "cgroup_oom_kill_delta": after["oom_kill_delta"],
                          "fixture_exit": 137}), flush=True)
    finally:
        failures = []
        for name in names:
            try:
                docker("rm", "--force", name, check=False)
            except (OSError, subprocess.TimeoutExpired) as error:
                failures.append(str(error))
        for arguments in [("volume", "rm", volume), ("image", "rm", image)]:
            try:
                docker(*arguments, check=False)
            except (OSError, subprocess.TimeoutExpired) as error:
                failures.append(str(error))
        for arguments in [("inspect", n) for n in names] + [("volume", "inspect", volume), ("image", "inspect", image)]:
            if docker(*arguments, check=False).returncode == 0:
                failures.append("resource remains: " + arguments[-1])
        if failures:
            raise RuntimeError("cleanup incomplete: " + "; ".join(failures))
        print(json.dumps({"cleanup": "complete", "prefix": prefix}), flush=True)


if __name__ == "__main__":
    main()
