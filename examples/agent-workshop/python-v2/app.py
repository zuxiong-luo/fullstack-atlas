"""FastAPI HTTP boundary; all backend state remains outside GitHub Pages."""
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI,Request
from fastapi.responses import Response
from contracts import ServiceError,fail,strict_json,identifier,question_body,run_body,memory_body
from service import Service
from store import Store,public_run
from tools import execute_tool
from providers import provider_from_env
MAX_REQUEST_BYTES=64*1024
def send(body,status=200):return Response(json.dumps(body,ensure_ascii=True),status_code=status,media_type='application/json')
async def read_body(request):
    data=bytearray()
    async for chunk in request.stream():
        if len(data)+len(chunk)>MAX_REQUEST_BYTES:fail(413,'PAYLOAD_TOO_LARGE')
        data.extend(chunk)
    if not data:return None
    if request.headers.get('content-type','').split(';',1)[0].strip().lower()!='application/json':fail(400,'INVALID_REQUEST')
    try:return strict_json(data)
    except (ValueError,TypeError,UnicodeError):fail(400,'INVALID_REQUEST')
def create_app(service=None):
    selected=service or Service(chapter=int(os.getenv('CHAPTER','8')),store=Store(os.getenv('SQLITE_PATH','data/agent.sqlite')),provider=provider_from_env(),timeout_ms=int(os.getenv('MODEL_TIMEOUT_MS','3000')),lease_ms=int(os.getenv('LEASE_MS','10000')),max_concurrent=int(os.getenv('MAX_CONCURRENT','2')),max_context_chars=int(os.getenv('MAX_CONTEXT_CHARS','12000')),max_model_calls=int(os.getenv('MAX_MODEL_CALLS','1')))
    @asynccontextmanager
    async def lifespan(app):
        yield
        await selected.close()
    app=FastAPI(title='Agent workshop chapters 02-08',docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)
    app.state.service=selected
    @app.api_route('/{path:path}',methods=['GET','POST','DELETE','PUT','PATCH','OPTIONS','HEAD'])
    async def endpoint(path,request:Request):
        try:
            method=request.method;url='/'+path
            if url=='/health' and method=='GET':return send({'status':'ok','chapter':selected.chapter})
            owner={'Bearer demo-alice':'alice','Bearer demo-bob':'bob'}.get(request.headers.get('authorization'))
            if not owner:fail(401,'UNAUTHORIZED')
            body=await read_body(request) if method=='POST' else None
            if url=='/v2/tools' and method=='POST' and selected.chapter>=2:return send({'ok':True,'result':execute_tool(owner,body)})
            if url=='/v2/answers' and method=='POST' and selected.chapter>=3:return send({'ok':True,'result':await selected.answer(owner,question_body(body)['question'])})
            if url=='/v2/runs' and method=='POST' and selected.chapter>=4:
                incoming=run_body(body);return send({'ok':True,'run':await selected.run(owner,incoming['request_id'],incoming['question'])})
            parts=url.split('/')
            if len(parts)==4 and parts[1:3]==['v2','runs'] and method=='GET' and selected.chapter>=4:
                run=selected.store.get(owner,identifier(parts[3]))
                if not run:fail(404,'RUN_NOT_FOUND')
                return send({'ok':True,'run':public_run(run)})
            if len(parts)==5 and parts[1:3]==['v2','runs'] and parts[4]=='resume' and method=='POST' and selected.chapter>=4:
                if body is not None:fail(400,'INVALID_REQUEST')
                return send({'ok':True,'run':await selected.run(owner,identifier(parts[3]))})
            if url=='/v2/memory' and selected.chapter>=5:
                if method=='GET':return send({'ok':True,'result':selected.store.memory(owner)})
                if method=='POST':
                    incoming=memory_body(body);return send({'ok':True,'result':selected.store.put_memory(owner,incoming['id'],incoming['text'])})
            if len(parts)==4 and parts[1:3]==['v2','memory'] and method=='DELETE' and selected.chapter>=5:
                selected.store.delete_memory(owner,identifier(parts[3]));return send({'ok':True,'deleted':True})
            fail(404,'ROUTE_NOT_FOUND')
        except ServiceError as error:return send({'ok':False,'error':{'code':error.code,'message':error.message}},error.status)
        except Exception:return send({'ok':False,'error':{'code':'INTERNAL_ERROR','message':'INTERNAL_ERROR'}},500)
    return app
