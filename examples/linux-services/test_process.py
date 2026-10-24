import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.request import urlopen

APP = Path(__file__).with_name("service.py")


def wait_ready(process, state):
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise AssertionError(f"service exited: {process.returncode}")
        try:
            value = json.loads((state / "ready.json").read_text())
            if value["pid"] == process.pid:
                return value
        except (OSError, ValueError):
            pass
        threading.Event().wait(0.02)
    raise AssertionError("readiness not observed")


@unittest.skipUnless(sys.platform == "linux", "requires Linux /proc and signals")
class LinuxProcess(unittest.TestCase):
    def launch(self, state, **environment):
        child = subprocess.Popen([sys.executable, str(APP), "--state", str(state)],
                                 env={**os.environ, **environment}, stdout=subprocess.DEVNULL)
        self.addCleanup(self.reap, child)
        return child

    @staticmethod
    def reap(child):
        if child.poll() is None:
            child.kill()
        child.wait(timeout=5)

    def test_proc_threads_and_graceful_term(self):
        with tempfile.TemporaryDirectory(prefix="atlas-lab-process-") as directory:
            state = Path(directory)
            child = self.launch(state)
            ready = wait_ready(child, state)
            tasks = {int(path.name) for path in Path(f"/proc/{child.pid}/task").iterdir()}
            self.assertIn(child.pid, tasks)
            self.assertIn(ready["worker_tid"], tasks)
            self.assertNotEqual(child.pid, ready["worker_tid"])
            for tid in tasks:
                status = Path(f"/proc/{child.pid}/task/{tid}/status").read_text()
                self.assertIn(f"Tgid:\t{child.pid}\n", status)
            with urlopen(f"http://127.0.0.1:{ready['port']}/health", timeout=1) as response:
                self.assertEqual(json.load(response)["pid"], child.pid)
            snapshot = subprocess.run([sys.executable, str(APP.with_name("inspect.py")), str(state)],
                                      capture_output=True, text=True, timeout=3)
            self.assertEqual(snapshot.returncode, 0, snapshot.stderr)
            self.assertEqual(json.loads(snapshot.stdout)["pid"], child.pid)
            descriptor_count = len(list(Path(f"/proc/{child.pid}/fd").iterdir()))
            self.assertGreaterEqual(descriptor_count, 3)
            child.send_signal(signal.SIGTERM)
            self.assertEqual(child.wait(timeout=5), 0)
            self.assertFalse((state / "ready.json").exists())
            self.assertEqual(json.loads((state / "stopped.json").read_text())["signals"], ["SIGTERM"])
            print(json.dumps({"case": "proc_and_term", "task_count": len(tasks), "fd_count": descriptor_count, "graceful": True}))

    def test_kill_bypasses_cleanup_then_restart_recovers(self):
        with tempfile.TemporaryDirectory(prefix="atlas-lab-kill-") as directory:
            state = Path(directory)
            child = self.launch(state)
            wait_ready(child, state)
            child.kill()
            self.assertEqual(child.wait(timeout=5), -signal.SIGKILL)
            self.assertFalse((state / "stopped.json").exists())
            self.assertTrue((state / "ready.json").exists())
            replacement = self.launch(state)
            ready = wait_ready(replacement, state)
            self.assertEqual(ready["pid"], replacement.pid)
            replacement.terminate()
            self.assertEqual(replacement.wait(timeout=5), 0)
            print(json.dumps({"case": "kill_and_recover", "stale_ready_after_kill": True, "recovered": True}))

    def test_explicit_start_failure(self):
        with tempfile.TemporaryDirectory(prefix="atlas-lab-fail-") as directory:
            state = Path(directory)
            child = self.launch(state, ATLAS_LAB_START_FAIL="1")
            self.assertEqual(child.wait(timeout=5), 42)
            self.assertFalse((state / "ready.json").exists())
            print(json.dumps({"case": "start_failure", "exit_code": 42}))


if __name__ == "__main__":
    unittest.main(verbosity=2)
