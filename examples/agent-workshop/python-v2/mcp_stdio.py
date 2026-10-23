"""Local MCP 2025-06-18 tools-only stdio subset; protocol stdout, logs stderr."""
import json
import math
import os
import sys
from contracts import ServiceError,read_shared,strict_json
from tools import execute_tool

def run():
    owner=os.getenv('MCP_OWNER','alice')
    if owner not in {'alice','bob'}:raise ValueError('MCP_OWNER must be alice or bob')
    initialized=False
    def reply(id,result):print(json.dumps({'jsonrpc':'2.0','id':id,'result':result},ensure_ascii=True),flush=True)
    def error(id,code,message):print(json.dumps({'jsonrpc':'2.0','id':id,'error':{'code':code,'message':message}}),flush=True)
    while True:
        # Bound the protocol frame, and drain oversized lines without retaining them.
        line=sys.stdin.buffer.readline(64*1024+2)
        if not line:break
        if len(line.rstrip(b'\r\n'))>64*1024:
            while line and not line.endswith(b'\n'):line=sys.stdin.buffer.readline(64*1024+2)
            error(None,-32600,'Request too large');continue
        try:request=strict_json(line)
        except (ValueError,UnicodeError):error(None,-32700,'Parse error');continue
        if not isinstance(request,dict) or request.get('jsonrpc')!='2.0' or not isinstance(request.get('method'),str):error(request.get('id') if isinstance(request,dict) else None,-32600,'Invalid Request');continue
        method=request['method']
        if 'id' not in request:
            continue
        id=request['id'];params=request.get('params')
        if id is not None and (type(id) not in (int,float,str) or (type(id) is float and not math.isfinite(id))):
            error(None,-32600,'Invalid Request');continue
        if method=='initialize':
            if not isinstance(params,dict):error(id,-32602,'Invalid params');continue
            initialized=True;reply(id,{'protocolVersion':'2025-06-18','capabilities':{'tools':{'listChanged':False}},'serverInfo':{'name':'atlas-local-tools-subset','version':'2.0.0'}});continue
        if not initialized:error(id,-32002,'Not initialized');continue
        if method=='tools/list':
            schema=read_shared('schema.json');reply(id,{'tools':[{'name':'lookup_document','description':'Read a public or owner document by ID','inputSchema':{**schema['$defs']['lookupArguments'],'$defs':{'id':schema['$defs']['id']}}}]});continue
        if method=='tools/call':
            if not isinstance(params,dict) or not isinstance(params.get('name'),str) or not isinstance(params.get('arguments'),dict):error(id,-32602,'Invalid params');continue
            try:reply(id,{'content':[{'type':'text','text':json.dumps(execute_tool(owner,params),ensure_ascii=True)}],'isError':False})
            except ServiceError as exc:
                if exc.code=='INVALID_REQUEST':error(id,-32602,'Invalid params')
                else:reply(id,{'content':[{'type':'text','text':json.dumps({'error':{'code':exc.code}})}],'isError':True})
            continue
        error(id,-32601,'Method not found')
if __name__=='__main__':run()
