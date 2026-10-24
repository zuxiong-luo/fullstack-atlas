"""Linux disposable-VM integration: own units/user only; every command is bounded."""
import json
import os
from pathlib import Path
import pwd
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
import uuid

ROOT = Path(__file__).resolve().parent
SUDO = ["sudo", "-n"]


def run(arguments, *, check=True, timeout=15):
    result = subprocess.run(arguments, capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"{arguments!r}: {result.returncode}\n{result.stdout}\n{result.stderr}")
    return result


def eventually(predicate, label, seconds=12):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(0.05)  # Poll an observed state; never infer readiness from elapsed sleep.
    raise AssertionError("not observed: " + label)


def main():
    if sys.platform != "linux" or not Path("/run/systemd/system").is_dir():
        raise SystemExit("Linux booted with systemd is required")
    if Path("/proc/1/comm").read_text().strip() != "systemd":
        raise SystemExit("PID 1 must be systemd in the disposable VM")
    if os.geteuid() == 0:
        raise SystemExit("Run as the CI user with passwordless sudo, not as root")
    run(SUDO + ["true"])
    prefix = "atlas-lab-" + uuid.uuid4().hex[:10]
    work = Path(tempfile.mkdtemp(prefix=prefix + "-", dir="/var/tmp"))
    work.chmod(0o755)
    user_created = False
    uid = None
    installed = []
    managers = []

    def interrupted(number, frame):
        raise KeyboardInterrupt(f"signal {number}")

    signal.signal(signal.SIGTERM, interrupted)
    try:
        run(SUDO + ["useradd", "--create-home", "--shell", "/usr/sbin/nologin", prefix])
        user_created = True
        account = pwd.getpwnam(prefix)
        uid = account.pw_uid
        app = work / "service.py"
        shutil.copyfile(ROOT / "service.py", app)
        app.chmod(0o644)
        run(SUDO + ["systemctl", "start", f"user@{uid}.service"])
        eventually(lambda: Path(f"/run/user/{uid}/bus").exists(), "isolated user bus")
        user_ctl = SUDO + ["runuser", "-u", prefix, "--", "env",
                           f"XDG_RUNTIME_DIR=/run/user/{uid}",
                           f"DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/{uid}/bus",
                           "systemctl", "--user"]
        system_ctl = SUDO + ["systemctl"]
        managers = [user_ctl, system_ctl]
        for scope, ctl in (("user", user_ctl), ("system", system_ctl)):
            unit = f"{prefix}-{scope}.service"
            state = work / scope
            state.mkdir(mode=0o755)
            run(SUDO + ["chown", f"{uid}:{account.pw_gid}", str(state)])
            text = (ROOT / f"atlas-lab-{scope}.service.in").read_text()
            replacements = {"USER": prefix, "ROOT": str(work), "STATE": str(state),
                            "PYTHON": sys.executable, "APP": str(app)}
            for key, value in replacements.items():
                if any(character in value for character in ('"', "\n", "\\")):
                    raise ValueError("unsupported unit path character")
                text = text.replace(f"@{key}@", value)
            prepared = work / unit
            prepared.write_text(text)
            destination = (Path(account.pw_dir) / ".config/systemd/user" / unit
                           if scope == "user" else Path("/run/systemd/system") / unit)
            run(SUDO + ["install", "-d", "-m", "755", str(destination.parent)])
            run(SUDO + ["install", "-m", "644", str(prepared), str(destination)])
            installed.append((scope, ctl, unit, destination))
            run(ctl + ["daemon-reload"])
            run(ctl + ["start", unit])

            def healthy():
                try:
                    info = json.loads((state / "ready.json").read_text())
                    main_pid = int(run(ctl + ["show", unit, "-p", "MainPID", "--value"]).stdout)
                    if main_pid != info["pid"]:
                        return False
                    with urlopen(f"http://127.0.0.1:{info['port']}/health", timeout=1) as response:
                        return json.load(response)["pid"] == main_pid
                except (OSError, ValueError):
                    return False

            eventually(healthy, scope + " HTTP health and MainPID")
            control_group = run(ctl + ["show", unit, "-p", "ControlGroup", "--value"]).stdout.strip()
            assert control_group.startswith("/"), control_group
            pid = int(run(ctl + ["show", unit, "-p", "MainPID", "--value"]).stdout)
            assert control_group in Path(f"/proc/{pid}/cgroup").read_text()
            run(ctl + ["stop", unit])
            stopped = json.loads((state / "stopped.json").read_text())
            assert stopped["signals"] == ["SIGTERM"], stopped
            assert run(ctl + ["is-active", unit], check=False).returncode != 0
            print(json.dumps({"scope": scope, "phase": "graceful_stop", "signal": "SIGTERM",
                              "control_group": control_group}), flush=True)
            # Break only this instance's environment, then observe actual restart exhaustion.
            environment_file = work / f"{scope}.env"
            environment_file.write_text("ATLAS_LAB_START_FAIL=1\n")
            run(SUDO + ["install", "-o", str(uid), "-g", str(account.pw_gid), "-m", "644",
                        str(environment_file), str(state / "service.env")])
            run(ctl + ["start", unit], check=False)
            eventually(lambda: run(ctl + ["is-failed", unit], check=False).returncode == 0,
                       scope + " failed after bounded restarts")
            status = run(ctl + ["show", unit, "-p", "ExecMainStatus", "--value"]).stdout.strip()
            restarts = int(run(ctl + ["show", unit, "-p", "NRestarts", "--value"]).stdout)
            assert status == "42" and restarts >= 1, (status, restarts)
            print(json.dumps({"scope": scope, "phase": "fault", "state": "failed",
                              "exit_status": status, "restarts": restarts}), flush=True)
            environment_file.write_text("ATLAS_LAB_START_FAIL=0\n")
            run(SUDO + ["install", "-o", str(uid), "-g", str(account.pw_gid), "-m", "644",
                        str(environment_file), str(state / "service.env")])
            run(ctl + ["reset-failed", unit])
            run(ctl + ["start", unit])
            eventually(healthy, scope + " recovery")
            run(ctl + ["stop", unit])
            journal = (SUDO + ["journalctl", f"_SYSTEMD_USER_UNIT={unit}", "-n", "12", "--no-pager"]
                       if scope == "user" else SUDO + ["journalctl", "-u", unit, "-n", "12", "--no-pager"])
            print(run(journal).stdout, flush=True)
            print(json.dumps({"scope": scope, "phase": "recovery", "healthy": True}), flush=True)
    finally:
        for scope, ctl, unit, destination in reversed(installed):
            run(ctl + ["stop", unit], check=False)
            run(ctl + ["reset-failed", unit], check=False)
            run(SUDO + ["rm", "-f", "--", str(destination)], check=False)
            run(ctl + ["daemon-reload"], check=False)
        if uid is not None:
            run(SUDO + ["systemctl", "stop", f"user@{uid}.service",
                        f"user-runtime-dir@{uid}.service"], check=False)
        if user_created:
            run(SUDO + ["userdel", "--remove", prefix], check=False)
        assert work.parent == Path("/var/tmp") and work.name.startswith(prefix + "-")
        run(SUDO + ["rm", "-rf", "--", str(work)])
        for scope, ctl, unit, destination in installed:
            assert not destination.exists(), destination
        if user_created:
            try:
                pwd.getpwnam(prefix)
            except KeyError:
                pass
            else:
                raise AssertionError("temporary user still exists: " + prefix)
        print(json.dumps({"cleanup": "complete", "prefix": prefix}), flush=True)


if __name__ == "__main__":
    main()
