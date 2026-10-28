import json
import os
from pathlib import Path
import queue
import socket
import subprocess
import threading
import time
import unittest
import httpx
import uvicorn
from main import create_app

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "shared/quotes.json").read_text())


class RealHttpTests(unittest.TestCase):
    def test_python_and_nestjs_over_real_http(self):
        dist = ROOT / "dist/nest-comparison.js"
        self.assertTrue(dist.exists(), "先在python-node-course运行npm ci和npm run build")
        node = os.environ.get("NODE_BINARY", "node")
        proc = subprocess.Popen([node, str(dist)], cwd=ROOT, env={**os.environ, "PORT": "0"}, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        startup = queue.Queue()
        threading.Thread(target=lambda: startup.put(proc.stdout.readline()), daemon=True).start()
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        python_port = sock.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(create_app(), lifespan="on", log_level="error"))
        thread = threading.Thread(target=lambda: server.run(sockets=[sock]), daemon=True)
        thread.start()
        try:
            info = json.loads(startup.get(timeout=15))
            self.assertEqual(info["event"], "listening")
            for _ in range(300):
                if server.started: break
                time.sleep(0.01)
            self.assertTrue(server.started)
            with httpx.Client(trust_env=False, timeout=3) as client:
                for case in CASES:
                    raw = case.get("raw", json.dumps(case.get("body")))
                    results = []
                    for name, port in [("fastapi", python_port), ("nestjs", info["port"])]:
                        response = client.post(f"http://127.0.0.1:{port}/api/quotes", content=raw, headers={"Content-Type": "application/json"})
                        expected_status = case.get("nestjsStatus", case["status"]) if name == "nestjs" else case["status"]
                        self.assertEqual(response.status_code, expected_status, (case["name"], name))
                        expected = case.get("nestjsExpected", case.get("expected")) if name == "nestjs" else case.get("expected")
                        if expected is not None: self.assertEqual(response.json(), expected)
                        results.append(response.status_code)
                    print(f"{case['name']}: FastAPI={results[0]} NestJS={results[1]}")
        finally:
            server.should_exit = True
            thread.join(5)
            sock.close()
            proc.terminate()
            try: proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill(); proc.wait(timeout=3)
            proc.stdout.close(); proc.stderr.close()
        self.assertFalse(thread.is_alive())
        self.assertIsNotNone(proc.returncode)


if __name__ == "__main__":
    unittest.main()
