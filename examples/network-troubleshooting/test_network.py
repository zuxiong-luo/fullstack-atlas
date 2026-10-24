import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from diagnose import probe
from fixtures import fixture

ROOT = Path(__file__).resolve().parent


class LayeredNetwork(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix="atlas-lab-network-")
        cls.context = fixture(Path(cls.directory.name))
        cls.lab = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)
        cls.directory.cleanup()

    def check(self, **changes):
        options = {"dns": ("127.0.0.1", self.lab["dns_port"]), "name": "atlas.test",
                   "port": self.lab["tls_port"], "cafile": Path(self.lab["cafile"])}
        options.update(changes)
        return probe(**options)

    def recovered(self):
        result = self.check()
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["checks"]["tls"]["version"], "TLSv1.3")
        return result

    def test_success(self):
        result = self.recovered()
        self.assertEqual(result["checks"]["dns"]["address"], "127.0.0.1")
        self.assertEqual(result["checks"]["http"]["status"], 200)
        print(json.dumps({"case": "success", "layers": list(result["checks"])}))

    def test_dns_nxdomain_and_recovery(self):
        result = self.check(name="missing.atlas.test")
        self.assertEqual(result["failed_layer"], "dns")
        self.assertEqual(result["detail"], "NXDOMAIN")
        self.assertEqual(result["checks"], {})
        self.recovered()
        print(json.dumps({"case": "dns_nxdomain", "failed_layer": "dns", "recovered": True}))

    def test_dns_no_response_and_recovery(self):
        result = self.check(name="timeout.atlas.test", timeout=0.1)
        self.assertEqual(result["failed_layer"], "dns")
        self.assertEqual(result["error_type"], "TimeoutError")
        self.recovered()
        print(json.dumps({"case": "dns_no_response", "failed_layer": "dns", "recovered": True}))

    def test_tcp_refusal_and_recovery(self):
        result = self.check(port=self.lab["refused_port"])
        self.assertEqual(result["failed_layer"], "tcp")
        self.assertEqual(result["error_type"], "ConnectionRefusedError")
        self.assertEqual(list(result["checks"]), ["dns"])
        self.recovered()
        print(json.dumps({"case": "tcp_refusal", "failed_layer": "tcp", "recovered": True}))

    def test_tls_unknown_ca_and_recovery(self):
        result = self.check(cafile=None)
        self.assertEqual(result["failed_layer"], "tls")
        self.assertEqual(result["error_type"], "SSLCertVerificationError")
        self.recovered()
        print(json.dumps({"case": "untrusted_ca", "failed_layer": "tls", "recovered": True}))

    def test_tls_hostname_and_recovery(self):
        result = self.check(server_name="wrong.atlas.test")
        self.assertEqual(result["failed_layer"], "tls")
        self.assertEqual(result["error_type"], "SSLCertVerificationError")
        self.recovered()
        print(json.dumps({"case": "hostname_mismatch", "failed_layer": "tls", "recovered": True}))

    def test_http_status_and_recovery(self):
        for path, status in (("/missing", 404), ("/unavailable", 503)):
            result = self.check(path=path)
            self.assertEqual(result["failed_layer"], "http")
            self.assertEqual(result["checks"]["http"]["status"], status)
        self.recovered()
        print(json.dumps({"case": "http_404_503", "failed_layer": "http", "recovered": True}))

    def test_http_timeout_after_tls_and_recovery(self):
        result = self.check(path="/slow", timeout=0.1)
        self.assertEqual(result["failed_layer"], "http")
        self.assertEqual(result["error_type"], "TimeoutError")
        self.assertIn("tls", result["checks"])
        self.lab["release"].set()
        self.recovered()
        print(json.dumps({"case": "http_read_timeout", "failed_layer": "http", "recovered": True}))

    def test_real_cli_success_and_fault(self):
        command = [sys.executable, str(ROOT / "diagnose.py"), "--dns-port", str(self.lab["dns_port"]),
                   "--port", str(self.lab["tls_port"]), "--cafile", self.lab["cafile"]]
        success = subprocess.run(command, capture_output=True, text=True, timeout=5)
        self.assertEqual(success.returncode, 0, success.stderr)
        self.assertTrue(json.loads(success.stdout)["ok"])
        failure = subprocess.run(command + ["--path", "/unavailable"], capture_output=True, text=True, timeout=5)
        self.assertEqual(failure.returncode, 2)
        self.assertEqual(json.loads(failure.stdout)["failed_layer"], "http")

    def test_fixture_cleanup(self):
        with tempfile.TemporaryDirectory(prefix="atlas-lab-cleanup-") as directory:
            with fixture(Path(directory)) as lab:
                address = ("127.0.0.1", lab["tls_port"])
            self.assertFalse((Path(directory) / "key.pem").exists())
            self.assertFalse((Path(directory) / "cert.pem").exists())
            with self.assertRaises(OSError):
                socket.create_connection(address, timeout=0.3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
