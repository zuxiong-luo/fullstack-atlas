import asyncio,json,os,subprocess,sys,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import httpx,pytest
from app import create_app
from contracts import ServiceError
from providers import HTTPConfig,HTTPProvider
from service import Service
AUTH={'Authorization':'Bearer demo-alice'}

def test_real_http_adapter_wire_redirect_bounds_timeout_cleanup_and_validation():
    seen=[];redirected=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_POST(self):
            body=json.loads(self.rfile.read(int(self.headers.get('content-length','0'))));seen.append(body)
            assert self.headers['Authorization']=='Bearer local-test-key';assert body['model']=='local-model';assert body['messages'][0]['role']=='system';assert json.loads(body['messages'][1]['content'])['question']=='cache'
            if self.path=='/redirect-target':redirected.append(True)
            if self.path=='/redirect':self.send_response(302);self.send_header('Location','/redirect-target');self.end_headers();return
            if self.path=='/status':self.send_response(503);self.end_headers();return
            if self.path=='/slow':
                self.send_response(200);self.end_headers()
                try:
                    for _ in range(20):self.wfile.write(b'x');self.wfile.flush();time.sleep(.02)
                except (BrokenPipeError,ConnectionResetError):pass
                return
            if self.path=='/utf8':content=b'{"choices":[{"message":{"content":"\xff"}}]}'
            elif self.path=='/bom':content=b'\xef\xbb\xbf{}'
            elif self.path=='/large':content='x'*(1024*1024+1)
            elif self.path=='/envelope':content='{bad'
            else:
                raw='{bad' if self.path=='/model-json' else json.dumps({'answer':1,'citations':[]}) if self.path=='/schema' else json.dumps({'answer':'x','citations':['bob-note']}) if self.path=='/citation' else json.dumps({'answer':'HTTP local success','citations':['cache-guide']})
                content=json.dumps({'choices':[{'message':{'content':raw}}]})
            payload=content if isinstance(content,bytes) else content.encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers()
            try:self.wfile.write(payload)
            except (BrokenPipeError,ConnectionResetError):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True;thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    async def check():
        paths=[('/ok',200,None),('/redirect',502,'UPSTREAM_ERROR'),('/status',502,'UPSTREAM_ERROR'),('/large',502,'UPSTREAM_ERROR'),('/envelope',502,'UPSTREAM_ERROR'),('/utf8',502,'UPSTREAM_ERROR'),('/bom',502,'UPSTREAM_ERROR'),('/model-json',502,'MODEL_FORMAT_ERROR'),('/schema',502,'MODEL_SCHEMA_ERROR'),('/citation',502,'UNSUPPORTED_CITATION'),('/slow',504,'UPSTREAM_TIMEOUT')]
        for path,status,code in paths:
            service=Service(provider=HTTPProvider(HTTPConfig(f'http://127.0.0.1:{server.server_port}{path}','local-test-key','local-model')),timeout_ms=30 if path=='/slow' else 2000,max_concurrent=1)
            try:
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service)),base_url='http://test') as http:
                    result=await http.post('/v2/answers',json={'question':'cache'},headers=AUTH)
                    assert result.status_code==status,result.text
                    if code:assert result.json()['error']['code']==code
                    else:assert result.json()['result']['answer']=='HTTP local success'
                for _ in range(100):
                    if not service.background:break
                    await asyncio.sleep(.002)
                assert not service.background;assert service.active==0
            finally:await service.close()
    try:asyncio.run(check());assert seen;assert not redirected
    finally:server.shutdown();server.server_close();thread.join(timeout=2)

def test_http_config_rejects_unsafe_or_missing_server_configuration():
    for url in ['file:///private','http://user:pass@localhost','http://localhost/#key','not-a-url']:
        with pytest.raises(ValueError):HTTPConfig(url,'key','model')
    with pytest.raises(ValueError):HTTPConfig('http://127.0.0.1','','model')
    assert 'secret-key' not in repr(HTTPConfig('http://127.0.0.1','secret-key','model'))

def test_actual_mcp_stdio_process_protocol_schema_authorization_and_notifications():
    messages=[
      {'jsonrpc':'2.0','method':'notifications/initialized'},
      {'jsonrpc':'2.0','id':0,'method':'tools/list'},
      {'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'test','version':'1'}}},
      {'jsonrpc':'2.0','method':'notifications/initialized'},
      {'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},
      {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'lookup_document','arguments':{'document_id':'cache-guide'}}},
      {'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'shell','arguments':{'command':'never'}}},
      {'jsonrpc':'2.0','id':5,'method':'tools/call','params':{'name':'lookup_document','arguments':{'document_id':'bob-note'}}},
      {'jsonrpc':'2.0','id':6,'method':'unknown','params':{}},
      {'jsonrpc':'2.0','id':7,'method':'tools/call','params':{'name':'lookup_document','arguments':{'document_id':'../x'}}},
      {'jsonrpc':'2.0','id':{},'method':'tools/list'},
    ]
    child=subprocess.run([sys.executable,'mcp_stdio.py'],input='\n'.join(json.dumps(m) for m in messages)+'\n',text=True,capture_output=True,env={**os.environ,'MCP_OWNER':'alice'},timeout=10)
    assert child.returncode==0,child.stderr;rows=[json.loads(line) for line in child.stdout.splitlines()];assert len(rows)==9
    assert rows[0]['error']['code']==-32002;assert rows[1]['result']['protocolVersion']=='2025-06-18';assert rows[2]['result']['tools'][0]['inputSchema']['$defs']['id']
    assert json.loads(rows[3]['result']['content'][0]['text'])['id']=='cache-guide'
    for index,code in [(4,'TOOL_FORBIDDEN'),(5,'DOCUMENT_FORBIDDEN')]:assert rows[index]['result']['isError'];assert json.loads(rows[index]['result']['content'][0]['text'])['error']['code']==code
    assert rows[6]['error']['code']==-32601;assert rows[7]['error']['code']==-32602;assert rows[8]['error']['code']==-32600

def test_mcp_oversized_line_is_drained_and_next_message_can_initialize():
    wire='x'*66000+'\n'+json.dumps({'jsonrpc':'2.0','id':1,'method':'initialize','params':{}})+'\n'
    result=subprocess.run([sys.executable,'mcp_stdio.py'],input=wire,text=True,capture_output=True,timeout=10)
    rows=[json.loads(line) for line in result.stdout.splitlines()];assert rows[0]['error']['code']==-32600;assert rows[1]['result']['protocolVersion']=='2025-06-18'
