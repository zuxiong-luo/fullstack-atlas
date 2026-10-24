from contextlib import redirect_stderr
import io
import json
import logging
from pathlib import Path
import pstats
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

# Source tests are explicit; verify_install.py separately proves installed closure.
sys.path.insert(0, str(Path(__file__).parent / "chapter09/src"))
from fastapi.testclient import TestClient
from atlas_notes.api import create_app
from atlas_notes.cli import main
from atlas_notes.config import AuthSettings, Config
from atlas_notes.measure import benchmark
from atlas_notes.observability import JsonFormatter, LOGGER, RequestLog
from atlas_notes.profile_storage import profile

TOKEN = "local-demo-token-2026"


class ConfigTests(unittest.TestCase):
    def test_typed_config_and_secret_repr(self):
        values = {"ATLAS_DB": "/tmp/atlas-demo-notes.sqlite3", "ATLAS_TOKEN": TOKEN,
                  "ATLAS_PORT": "0", "ATLAS_POOL_SIZE": "4"}
        config = Config.from_env(values)
        self.assertEqual((config.port, config.pool_size), (0, 4))
        self.assertNotIn(TOKEN, repr(config))
        self.assertNotIn(TOKEN, repr(config.auth))

    def test_invalid_config_fails_without_values(self):
        valid = {"ATLAS_DB": "/tmp/atlas-demo-notes.sqlite3", "ATLAS_TOKEN": TOKEN}
        for patch_values in [{"ATLAS_DB": "relative.sqlite3"}, {"ATLAS_TOKEN": "secret!"},
                             {"ATLAS_PORT": "65536"}, {"ATLAS_PORT": " 80"},
                             {"ATLAS_POOL_SIZE": "0"}, {"ATLAS_TOKNE": "typo"}]:
            with self.assertRaises(ValueError):
                Config.from_env(valid | patch_values)
        with self.assertRaises(ValueError):
            Config.from_env({})

    def test_cli_configuration_exit_has_no_secret(self):
        output = io.StringIO()
        with patch.dict("os.environ", {"ATLAS_DB": "relative", "ATLAS_TOKEN": TOKEN}, clear=True), redirect_stderr(output):
            self.assertEqual(main(), 2)
        self.assertEqual(json.loads(output.getvalue())["event"], "configuration_error")
        self.assertNotIn(TOKEN, output.getvalue())


class ObservabilityTests(unittest.TestCase):
    def test_request_correlation_template_and_redaction(self):
        output = io.StringIO()
        handler = logging.StreamHandler(output)
        handler.setFormatter(JsonFormatter())
        previous, level, propagate = LOGGER.handlers[:], LOGGER.level, LOGGER.propagate
        LOGGER.handlers[:] = [handler]
        LOGGER.setLevel(logging.INFO)
        LOGGER.propagate = False
        try:
            with tempfile.TemporaryDirectory(prefix="atlas-log-test-") as folder:
                base_app = create_app(Path(folder) / "notes.sqlite3", AuthSettings(TOKEN))
                @base_app.get("/explode")
                def explode():
                    raise RuntimeError("private-exception-never-log")
                app = RequestLog(base_app)
                with TestClient(app, raise_server_exceptions=False) as client:
                    note = {"id": "n1", "title": "private title", "tags": []}
                    created = client.post("/notes?private=query-secret", json=note,
                                          headers={"Authorization": "Bearer " + TOKEN})
                    self.assertEqual(created.status_code, 201)
                    request_id = created.headers["x-request-id"]
                    rejected = client.get("/not-a-route-secret", headers={"Authorization": "Bearer " + TOKEN})
                    self.assertEqual(rejected.status_code, 404)
                    self.assertEqual(client.post("/notes", content=b"x" * 32769).status_code, 413)
                    failed = client.get("/explode")
                    self.assertEqual(failed.status_code, 500)
                    self.assertIn("x-request-id", failed.headers)
            text = output.getvalue()
            events = [json.loads(line) for line in text.splitlines()]
            self.assertEqual([e["status"] for e in events], [201, 404, 413, 500])
            self.assertEqual(events[0]["request_id"], request_id)
            self.assertEqual(events[0]["route"], "/notes")
            self.assertEqual(events[1]["route"], "unmatched")
            self.assertTrue(all(e["elapsed_ms"] >= 0 for e in events))
            for secret in [TOKEN, "query-secret", "private title", "not-a-route-secret", "private-exception-never-log"]:
                self.assertNotIn(secret, text)
        finally:
            LOGGER.handlers[:], LOGGER.level, LOGGER.propagate = previous, level, propagate

    def test_formatter_is_valid_json_for_control_characters(self):
        record = logging.LogRecord("test", logging.INFO, "", 0, "unused", (), None)
        record.atlas = {"event": "test", "value": "line\n\"quoted\""}
        formatted = JsonFormatter().format(record)
        self.assertEqual(len(formatted.splitlines()), 1)
        self.assertEqual(json.loads(formatted)["value"], record.atlas["value"])


class DeliveryTests(unittest.TestCase):
    def test_generated_installable_snapshot_matches_previous_stages(self):
        script = Path(__file__).parent / "chapter09/sync_package.py"
        result = subprocess.run([sys.executable, str(script), "--check"],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("snapshot matches", result.stdout)

    def test_real_profile_has_samples_and_limited_memory_claim(self):
        with tempfile.TemporaryDirectory(prefix="atlas-prof-test-") as folder:
            output = Path(folder) / "storage.prof"
            result = profile(output)
            stats = pstats.Stats(str(output))
            self.assertTrue(any(key[2] == "snapshot" for key in stats.stats))
            self.assertGreater(result["traced_peak_bytes"], 0)
            self.assertGreaterEqual(result["traced_peak_bytes"], result["traced_current_bytes"])
            self.assertTrue(result["includes_profiler_overhead"])
            self.assertIn("excludes SQLite", result["memory_scope"])

    def test_benchmark_rejects_nonlocal_or_credentialed_targets(self):
        for url in ["https://127.0.0.1:8019", "http://example.com", "http://user:pass@127.0.0.1",
                    "http://127.0.0.1/notes", "http://127.0.0.1?token=secret"]:
            with self.assertRaises(ValueError):
                benchmark(url, TOKEN)
        for samples in [0, 1001, True]:
            with self.assertRaises(ValueError):
                benchmark("http://127.0.0.1:8019", TOKEN, samples=samples)


if __name__ == "__main__":
    unittest.main(verbosity=2)
