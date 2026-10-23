import asyncio,json
from contextlib import asynccontextmanager
import httpx,pytest
from app import create_app
from contracts import read_shared,parse_answer,trim,ServiceError
from service import Service
from providers import MockProvider
from evaluate import evaluate
AUTH={'Authorization':'Bearer demo-alice'}
def run(coroutine):return asyncio.run(coroutine)
@asynccontextmanager
async def client(service=None,**options):
    service=service or Service(**options)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service)),base_url='http://test') as session:yield session,service
    finally:await service.close()
def dotted(body,path):
    for key in path.split('.'):body=body[key]
    return body
@pytest.mark.parametrize('case',read_shared('http-cases.json'),ids=lambda case:case['id'])
def test_shared_http_contract(case):
    async def check():
        async with client(chapter=case['chapter']) as (http,service):
            for step in case['steps']:
                headers={'Authorization':'Bearer '+step['token']} if 'token' in step else {}
                kwargs={'headers':headers}
                if 'body' in step:kwargs['json']=step['body']
                response=await http.request(step['method'],step['path'],**kwargs)
                assert response.status_code==step['status'],response.text
                body=response.json()
                if 'code' in step:assert body['error']['code']==step['code']
                for path,expected in step.get('expect',{}).items():assert dotted(body,path)==expected
    run(check())
@pytest.mark.parametrize('chapter,paths',[(2,['/v2/answers','/v2/runs','/v2/memory']),(3,['/v2/runs','/v2/memory']),(4,['/v2/memory'])])
def test_chapter_routes_not_opened_early(chapter,paths):
    async def check():
        async with client(chapter=chapter) as (http,_):
            assert (await http.get('/health')).json()=={'status':'ok','chapter':chapter}
            for path in paths:assert (await http.post(path,json={},headers=AUTH)).json()['error']['code']=='ROUTE_NOT_FOUND'
    run(check())
def test_request_limits_json_and_identity_are_server_owned():
    async def check():
        async with client() as (http,_):
            for body in ['{','NaN','[]','null']:
                result=await http.post('/v2/answers',content=body,headers={**AUTH,'Content-Type':'application/json'});assert result.status_code==400
            assert (await http.post('/v2/answers',content=b'x'*65537,headers={**AUTH,'Content-Type':'application/json'})).status_code==413
            assert (await http.post('/v2/answers',json={'question':'cache'},headers={'Authorization':'Bearer stolen'})).status_code==401
            assert (await http.post('/v2/answers',json={'question':'cache','owner':'bob'},headers=AUTH)).status_code==400
            assert (await http.get('/docs',headers=AUTH)).status_code==404
    run(check())
def test_unicode_codepoint_limits_trim_and_context_metrics():
    async def check():
        async with client(max_context_chars=10000) as (http,_):
            question='😀'*1995+'cache';response=await http.post('/v2/answers',json={'question':question},headers=AUTH);assert response.status_code==200
            value=response.json()['result'];assert value['metrics']['context_chars']==len(question)+sum(len(d[k]) for d in value['evidence'] for k in ('id','title','text'))
            assert (await http.post('/v2/answers',json={'question':'😀'*2001},headers=AUTH)).status_code==400
            result=await http.post('/v2/tools',json={'name':'\u0085lookup_document','arguments':{'document_id':'cache-guide'}},headers=AUTH);assert result.status_code==403
    run(check())
    assert trim('\ufeffok\ufeff')=='ok';assert trim('\u0085ok\u0085')=='\u0085ok\u0085'
@pytest.mark.parametrize('raw,code',[('not-json','MODEL_FORMAT_ERROR'),('{"answer":1,"citations":[]}','MODEL_SCHEMA_ERROR'),('{"answer":"ok","citations":["cache-guide","cache-guide"]}','MODEL_SCHEMA_ERROR'),('{"answer":"ok","citations":["bob-note"]}','UNSUPPORTED_CITATION')])
def test_model_output_validation(raw,code):
    with pytest.raises(ServiceError) as caught:parse_answer(raw,[{'id':'cache-guide'}])
    assert caught.value.code==code

def test_evaluation_uses_shared_cases_and_rejects_empty_score():
    report=run(evaluate());assert report['mean_recall_at_3']==1;assert report['no_hit_pass'];assert report['model_calls']==0
    for invalid in [[],[{'id':'x','owner':'alice','question':'cache','expected':[]}]]:
        with pytest.raises(ValueError):run(evaluate(invalid))

def test_context_and_model_budget_only_activate_in_chapter8():
    async def check():
        for chapter in [7,8]:
            async with client(chapter=chapter,max_context_chars=1,max_model_calls=0) as (http,_):
                response=await http.post('/v2/answers',json={'question':'cache'},headers=AUTH)
                assert response.status_code==(200 if chapter==7 else 400)
        async with client(max_model_calls=0) as (http,_):
            result=await http.post('/v2/answers',json={'question':'cache'},headers=AUTH);assert result.json()['error']['code']=='MODEL_BUDGET_EXCEEDED'
            assert (await http.post('/v2/answers',json={'question':'banana'},headers=AUTH)).status_code==200
    run(check())

def test_timeout_keeps_slot_until_uncooperative_provider_settles_but_not_reads():
    async def check():
        gate=asyncio.Event();entered=asyncio.Event()
        class Provider:
            async def generate(self,input):
                entered.set()
                try:await asyncio.shield(gate.wait())
                except asyncio.CancelledError:await gate.wait()
                return json.dumps({'answer':'late','citations':['cache-guide']})
        async with client(provider=Provider(),max_concurrent=1,timeout_ms=10) as (http,service):
            first=await http.post('/v2/answers',json={'question':'cache'},headers=AUTH);assert first.status_code==504;assert service.active==1
            blocked=await http.post('/v2/answers',json={'question':'cache'},headers=AUTH);assert blocked.status_code==503
            assert (await http.get('/v2/memory',headers=AUTH)).status_code==200
            assert (await http.post('/v2/tools',json={'name':'lookup_document','arguments':{'document_id':'cache-guide'}},headers=AUTH)).status_code==200
            gate.set()
            for _ in range(20):
                if service.active==0:break
                await asyncio.sleep(.001)
            assert service.active==0
    run(check())

def test_memory_is_explicit_owner_scoped_sorted_and_not_automatically_prompted():
    async def check():
        captured=[]
        class Provider:
            async def generate(self,input):captured.append(input);return json.dumps({'answer':'ok','citations':[]})
        async with client(provider=Provider()) as (http,_):
            for id in ['z','a']:assert (await http.post('/v2/memory',json={'id':id,'text':'private memory'},headers=AUTH)).status_code==200
            assert [x['id'] for x in (await http.get('/v2/memory',headers=AUTH)).json()['result']]==['a','z']
            await http.post('/v2/answers',json={'question':'cache'},headers=AUTH)
            assert 'private memory' not in json.dumps(captured)
    run(check())

def test_recall_at3_excludes_target_at_four_and_cli_json_is_real():
    class Retrieval:
        async def search(self,owner,question):return [{'id':id} for id in ['a','b','c','target']]
    cases=[{'id':'positive','owner':'alice','question':'q','expected':['target']},{'id':'negative','owner':'alice','question':'none','expected':[]}]
    report=run(evaluate(cases,Retrieval()));assert report['cases'][0]['recall_at_3']==0;assert report['cases'][0]['selected']==['a','b','c']

def test_model_proposals_cannot_expand_server_tool_allowlist():
    from tools import execute_tool
    proposals=[({'name':'shell','arguments':{'command':'echo never'}},'TOOL_FORBIDDEN'),({'name':'http_fetch','arguments':{'url':'https://example.test/private'}},'TOOL_FORBIDDEN'),({'name':'lookup_document','arguments':{'document_id':'bob-note'}},'DOCUMENT_FORBIDDEN')]
    for proposal,expected in proposals:
        with pytest.raises(ServiceError) as error:execute_tool('alice',proposal)
        assert error.value.code==expected
    # This model output is not an accepted structured answer, so no tool is run.
    with pytest.raises(ServiceError,match='MODEL_SCHEMA_ERROR'):parse_answer(json.dumps(proposals[0][0]),[])

def test_utf8_bom_utf16_and_lone_surrogates_rejected_but_emoji_works():
    async def check():
        async with client() as (http,_):
            for raw in [b'{"question":"\xff"}',b'\xef\xbb\xbf{"question":"cache"}','{"question":"cache"}'.encode('utf-16'),b'{"question":"\\ud800"}',b'{"question":"\\udfff"}']:
                response=await http.post('/v2/answers',content=raw,headers={**AUTH,'Content-Type':'application/json'})
                assert response.status_code==400,response.text;assert response.json()['error']['code']=='INVALID_REQUEST'
            assert (await http.post('/v2/answers',json={'question':'cache😀'},headers=AUTH)).status_code==200
            assert (await http.post('/v2/memory',json={'id':'emoji','text':'😀'},headers=AUTH)).status_code==200
    run(check())
    for value in ['\ud800','\udfff']:
        for body in [{'answer':value,'citations':[]},{'answer':'ok','citations':[value]}]:
            with pytest.raises(ServiceError,match='MODEL_SCHEMA_ERROR'):parse_answer(json.dumps(body),[])
    assert parse_answer('{"answer":"\\ud83d\\ude00","citations":[]}',[])['answer']=='😀'
