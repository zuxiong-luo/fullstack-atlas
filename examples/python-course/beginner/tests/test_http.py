from fastapi.testclient import TestClient
from pathlib import Path
import tempfile
import unittest
from learning_notes.api import create_app
from learning_notes.storage_api import create_storage_app

HEADERS = {'Authorization': 'Bearer study-token'}

class MemoryApiTests(unittest.TestCase):
    def test_create_list_and_validation(self):
        with TestClient(create_app()) as client:
            self.assertEqual(client.get('/health').json(), {'ok': True})
            self.assertEqual(client.get('/notes').status_code, 401)
            response = client.post('/notes', headers=HEADERS, json={'title':'  API  '})
            self.assertEqual(response.status_code, 201); self.assertEqual(response.json(), {'title':'API','done':False})
            self.assertEqual(len(client.get('/notes', headers=HEADERS).json()), 1)
            self.assertEqual(client.post('/notes',headers=HEADERS,json={}).status_code, 422)
            self.assertEqual(client.post('/notes',headers=HEADERS,json={'title':' '}).status_code,400)
        with TestClient(create_app()) as another:
            self.assertEqual(another.get('/notes', headers=HEADERS).json(), [])

    def test_small_notebook_limit(self):
        with TestClient(create_app()) as client:
            for n in range(100): self.assertEqual(client.post('/notes',headers=HEADERS,json={'title':str(n)}).status_code,201)
            self.assertEqual(client.post('/notes',headers=HEADERS,json={'title':'extra'}).status_code,409)

class PersistentApiTests(unittest.TestCase):
    def test_database_survives_new_application_and_duplicate_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'notes.db'
            with TestClient(create_storage_app(path)) as client:
                self.assertEqual(client.post('/notes',headers=HEADERS,json={'title':'SQL'}).status_code,201)
                self.assertEqual(client.post('/notes',headers=HEADERS,json={'title':'SQL'}).status_code,409)
            with TestClient(create_storage_app(path)) as another:
                self.assertEqual(another.get('/notes').status_code,401)
                self.assertEqual(another.get('/notes',headers=HEADERS).json()[0]['title'],'SQL')

class LoopbackTests(unittest.TestCase):
    def test_real_http_requests_and_shutdown(self):
        import socket
        import threading
        import time
        import httpx
        import uvicorn
        listener = socket.socket()
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
        config = uvicorn.Config(create_app(), log_level='error', lifespan='on')
        server = uvicorn.Server(config)
        thread = threading.Thread(target=lambda: server.run(sockets=[listener]), daemon=True)
        thread.start()
        try:
            with httpx.Client(base_url=f'http://127.0.0.1:{port}',trust_env=False,timeout=1) as client:
                for attempt in range(100):
                    if server.started: break
                    time.sleep(0.01)
                self.assertTrue(server.started)
                self.assertEqual(client.get('/health').status_code,200)
                self.assertEqual(client.get('/notes').status_code,401)
                self.assertEqual(client.post('/notes',headers=HEADERS,json={'title':'真实HTTP'}).status_code,201)
                self.assertEqual(client.get('/notes',headers=HEADERS).json()[0]['title'],'真实HTTP')
        finally:
            server.should_exit=True
            thread.join(5)
            listener.close()
        self.assertFalse(thread.is_alive())

if __name__ == '__main__': unittest.main()
