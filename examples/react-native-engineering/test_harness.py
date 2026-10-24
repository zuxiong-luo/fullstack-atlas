"""Safe POSIX process/HTTP cleanup regressions; no SDK or adb is invoked."""
import importlib.util
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parent

def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/(name+'.py'))
    module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

build = load('build_android')
runtime = load('verify_emulator')

@unittest.skipUnless(sys.platform in ('linux','darwin'), 'POSIX owned process groups')
class CleanupTests(unittest.TestCase):
    def assert_gone(self, pid):
        result = subprocess.run(['ps','-o','stat=','-p',str(pid)],capture_output=True,text=True,timeout=3)
        self.assertTrue(result.returncode != 0 or result.stdout.strip().startswith('Z'), result.stdout)

    def wait_pid(self, path, owner):
        deadline = time.monotonic()+5
        while not path.exists() and time.monotonic()<deadline:
            if owner.poll() is not None:self.fail('runner exited before child started')
            time.sleep(.01)
        self.assertTrue(path.exists())
        return int(path.read_text())

    def test_deadline_kills_and_reaps_owned_ignoring_child(self):
        with tempfile.TemporaryDirectory(prefix='atlas-lab-cleanup-test-') as directory:
            pidfile = Path(directory)/'owned.pid'
            child = "import os,signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);pathlib.Path(%r).write_text(str(os.getpid()));time.sleep(60)" % str(pidfile)
            with self.assertRaises(subprocess.TimeoutExpired):
                build.run([sys.executable,'-c',child],ROOT,seconds=.3)
            self.assert_gone(int(pidfile.read_text()))

    def test_outer_term_reaps_command_group_before_python_exits(self):
        with tempfile.TemporaryDirectory(prefix='atlas-lab-interrupt-test-') as directory:
            pidfile = Path(directory)/'owned.pid'
            child = "import os,signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);pathlib.Path(%r).write_text(str(os.getpid()));time.sleep(60)" % str(pidfile)
            wrapper = "import importlib.util,signal;spec=importlib.util.spec_from_file_location('build',%r);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);signal.signal(signal.SIGTERM,lambda *_:(_ for _ in ()).throw(KeyboardInterrupt()));m.run(%r,%r,seconds=60)" % (str(ROOT/'build_android.py'),[sys.executable,'-c',child],str(ROOT))
            owner = subprocess.Popen([sys.executable,'-c',wrapper],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            try:
                pid = self.wait_pid(pidfile,owner)
                owner.send_signal(signal.SIGTERM)
                owner.communicate(timeout=12)
                self.assertNotEqual(owner.returncode,0)
                self.assert_gone(pid)
            finally:
                if owner.poll() is None:owner.kill();owner.communicate(timeout=3)

    def test_close_joins_partial_http_request(self):
        class QuietFixture(runtime.Fixture):
            def handle_error(self,*_):pass
        server = QuietFixture(('127.0.0.1',0),runtime.Handler)
        accept = threading.Thread(target=server.serve_forever);accept.start()
        client = socket.create_connection(server.server_address,timeout=2)
        try:
            client.sendall(b'POST /events HTTP/1.0\r\nContent-Length: 10\r\n\r\nx')
            deadline=time.monotonic()+2
            def workers_now():return list(server._threads) if isinstance(server._threads,list) else []
            while not workers_now() and time.monotonic()<deadline:time.sleep(.01)
            workers=workers_now()
            self.assertTrue(workers)
            server.shutdown();server.server_close();accept.join(timeout=3)
            self.assertFalse(accept.is_alive())
            self.assertTrue(all(not worker.is_alive() for worker in workers))
        finally:
            client.close();server.shutdown();server.server_close();accept.join(timeout=3)

if __name__ == '__main__':unittest.main()
