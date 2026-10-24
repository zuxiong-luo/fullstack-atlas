import json
from pathlib import Path
import selectors
import subprocess
import sys
import unittest
from observe import delta, snapshot


@unittest.skipUnless(sys.platform == "linux", "Linux /proc integration required")
class ObservedWorkloads(unittest.TestCase):
    def setUp(self):
        self.child = subprocess.Popen([sys.executable, "-u", str(Path(__file__).with_name("worker.py"))],
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                      text=True, bufsize=1)
        self.selector = selectors.DefaultSelector()
        self.addCleanup(self.cleanup_child)
        self.selector.register(self.child.stdout, selectors.EVENT_READ)
        self.assertEqual(self.read()["pid"], self.child.pid)

    def read(self):
        if not self.selector.select(10):
            self.fail("child stage acknowledgement not observed within 10s")
        line = self.child.stdout.readline()
        if not line:
            self.fail("child exited: " + self.child.stderr.read())
        return json.loads(line)

    def command(self, operation):
        self.child.stdin.write(json.dumps({"operation": operation}) + "\n")
        self.child.stdin.flush()
        return self.read()

    def cleanup_child(self):
        try:
            if self.child.poll() is None:
                self.command("quit")
                self.child.wait(timeout=3)
            self.assertEqual(self.child.returncode, 0)
        finally:
            if self.child.poll() is None:
                self.child.kill()
                self.child.wait(timeout=2)
            self.selector.close()
            for pipe in [self.child.stdin, self.child.stdout, self.child.stderr]:
                pipe.close()

    def test_cpu_ticks_are_interval_work_not_instantaneous_load(self):
        before = snapshot(self.child.pid)
        result = self.command("cpu")
        change = delta(before, snapshot(self.child.pid))
        self.assertGreater(result["cpu_s"], .01)
        self.assertGreater(change["cpu_seconds"], 0)
        self.assertGreater(change["one_core_percent"], 0)
        print(json.dumps({"case": "cpu", "worker": result, "observed": change}), flush=True)

    def test_resident_allocation_is_held_then_released_without_claiming_rss_reset(self):
        before = snapshot(self.child.pid)
        result = self.command("allocate")
        held = snapshot(self.child.pid)
        self.assertEqual(result["held_bytes"], 32 * 1024 * 1024)
        self.assertGreater(held["rss_bytes"] - before["rss_bytes"], 16 * 1024 * 1024)
        self.assertEqual(self.command("release")["held_bytes"], 0)
        after = snapshot(self.child.pid)
        self.assertGreaterEqual(after["peak_rss_bytes"], before["peak_rss_bytes"])
        print(json.dumps({"case": "memory", "before": before["rss_bytes"], "held": held["rss_bytes"],
                          "released": after["rss_bytes"], "peak": after["peak_rss_bytes"]}), flush=True)

    def test_logical_io_does_not_imply_the_same_physical_disk_reads(self):
        before = snapshot(self.child.pid)
        result = self.command("io")
        change = delta(before, snapshot(self.child.pid))
        self.assertEqual(result["logical_bytes"], 4 * 1024 * 1024)
        self.assertGreaterEqual(change["io_delta"]["rchar"], result["logical_bytes"])
        self.assertGreaterEqual(change["io_delta"]["wchar"], result["logical_bytes"])
        # read_bytes may stay zero because the same data is still in page cache.
        self.assertGreaterEqual(change["io_delta"]["read_bytes"], 0)
        print(json.dumps({"case": "cached_io", "worker": result, "observed": change}), flush=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
