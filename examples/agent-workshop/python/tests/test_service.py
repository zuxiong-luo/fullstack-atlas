import asyncio
import json
import threading
import time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app import create_app
from providers import HTTPProvider, MockProvider, Settings

CASES = json.loads((Path(__file__).parents[2] / 'shared/cases.json').read_text())
REQUEST = {'question': '问题', 'documents': [{'id': 'a', 'text': '正文'}]}

@pytest.mark.parametrize('case', CASES, ids=lambda case: case['name'])
def test_shared_contract(case):
    with TestClient(create_app(MockProvider(case['scenario']), Settings(timeout_ms=50))) as client:
        response = client.post('/v1/answers', json=case['request'])
    assert response.status_code == case['status']
    body = response.json()
    assert body['ok'] is (case['status'] == 200)
    if 'code' in case:
        assert body['error']['code'] == case['code']
    else:
        assert body['result']['citations'] == case['citations']

@pytest.mark.parametrize('body', [b'{broken', b'null', b'[]', b'{"question":42,"documents":[]}', b'\xff'])
def test_malformed_input(body):
    response = TestClient(create_app()).post('/v1/answers', content=body, headers={'Content-Type':'application/json'})
    assert response.status_code == 400
    assert response.json()['error']['code'] == 'INVALID_REQUEST'

def test_body_limit():
    response = TestClient(create_app()).post('/v1/answers', content=b'x' * (256 * 1024 + 1), headers={'Content-Type':'application/json'})
    assert response.status_code == 413
    assert response.json()['error']['code'] == 'PAYLOAD_TOO_LARGE'

def test_trim_and_health():
    class Capture:
        async def generate(self, request):
            assert request.question == '问题'
            assert request.documents[0].text == '正文'
            return '{"answer":"答复","citations":["a"]}'
    client = TestClient(create_app(Capture()))
    assert client.get('/health').json() == {'status': 'ok'}
    assert client.post('/v1/answers', json={'question':'  问题  ', 'documents':[{'id':'a','text':' 正文 '}]}).status_code == 200

@pytest.mark.parametrize('raw', ['{"answer":"","citations":["a"]}', '{"answer":"ok","citations":["a","a"]}', '{"answer":"ok","citations":["a"],"extra":true}', '{"answer":"ok","citations":[1]}'])
def test_model_schema(raw):
    class Fixed:
        async def generate(self, request): return raw
    response = TestClient(create_app(Fixed())).post('/v1/answers', json=REQUEST)
    assert response.json()['error']['code'] == 'MODEL_SCHEMA_ERROR'

def test_timeout_cancels_provider():
    class Slow:
        cancelled = False
        async def generate(self, request):
            try: await asyncio.sleep(10)
            finally: self.cancelled = True
    provider = Slow()
    response = TestClient(create_app(provider, Settings(timeout_ms=50))).post('/v1/answers', json=REQUEST)
    assert response.status_code == 504
    assert provider.cancelled

@contextmanager
def upstream(mode):
    received = []
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def do_POST(self):
            received.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
            if mode == 'timeout': time.sleep(0.2)
            data = json.dumps({'choices':[{'message':{'content':json.dumps({'answer':'答复','citations':['a']})}}]}).encode()
            if mode == 'envelope': data = b'{"choices":[]}'
            if mode == 'large': data = b'x' * (1024 * 1024 + 1)
            self.send_response(503 if mode == 'non2xx' else 200)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            try: self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError): pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try: yield f'http://127.0.0.1:{server.server_port}/v1/chat/completions', received
    finally:
        server.shutdown()
        server.server_close()
        worker.join()

@pytest.mark.parametrize('mode,status,code', [('success',200,None), ('envelope',502,'UPSTREAM_ERROR'), ('non2xx',502,'UPSTREAM_ERROR'), ('timeout',504,'UPSTREAM_TIMEOUT'), ('large',502,'UPSTREAM_ERROR')])
def test_real_http_adapter_against_local_server(mode, status, code):
    with upstream(mode) as (url, received):
        settings = Settings(provider='http', api_url=url, api_key='local-test-only', model='fake', timeout_ms=100 if mode == 'timeout' else 1000)
        response = TestClient(create_app(HTTPProvider(settings), settings)).post('/v1/answers', json=REQUEST)
        assert response.status_code == status
        if code: assert response.json()['error']['code'] == code
        else: assert response.json()['result']['citations'] == ['a']
        assert received[0]['response_format'] == {'type':'json_object'}
        assert json.loads(received[0]['messages'][1]['content']) == REQUEST
        assert 'local-test-only' not in response.text

@pytest.mark.parametrize('kwargs', [{'provider':'nope'}, {'scenario':'nope'}, {'timeout_ms':0}, {'provider':'http','api_url':'file:///etc/passwd','api_key':'x','model':'y'}, {'provider':'http','api_url':'http://user:pw@localhost','api_key':'x','model':'y'}])
def test_bad_configuration(kwargs):
    with pytest.raises(ValueError): Settings(**kwargs)


def test_nonstandard_json_constant_is_format_error():
    class Fixed:
        async def generate(self, request): return '{"answer":NaN,"citations":["a"]}'
    response = TestClient(create_app(Fixed())).post('/v1/answers', json=REQUEST)
    assert response.json()['error']['code'] == 'MODEL_FORMAT_ERROR'


def test_unicode_lengths_and_trailing_newline_id():
    client = TestClient(create_app())
    good = {'question': '😀' * 2000, 'documents': [{'id':'a', 'text':'正文'}]}
    assert client.post('/v1/answers', json=good).status_code == 200
    good['question'] += '😀'
    assert client.post('/v1/answers', json=good).status_code == 400
    assert client.post('/v1/answers', json={'question':'问题','documents':[{'id':'a\n','text':'正文'}]}).status_code == 400


def test_ecmascript_whitespace_normalization():
    from models import AnswerRequest
    request = AnswerRequest.model_validate({'question':'\ufeff问题\ufeff','documents':[{'id':'a','text':'\u0085正文\u0085'}]})
    assert request.question == '问题'
    assert request.documents[0].text == '\u0085正文\u0085'


def test_non_json_content_type():
    response = TestClient(create_app()).post('/v1/answers', content=json.dumps(REQUEST), headers={'Content-Type':'text/plain'})
    assert response.status_code == 400
    assert response.json()['error']['code'] == 'INVALID_REQUEST'
