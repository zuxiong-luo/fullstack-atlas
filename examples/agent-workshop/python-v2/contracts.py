"""Shared v2 contract: strict shape, Unicode code point lengths, explicit errors."""
import json
import re
from pathlib import Path
SHARED=Path(__file__).resolve().parent.parent/'shared'/'v2'
def read_shared(name):
    return json.loads((SHARED/name).read_text(encoding='utf-8'))
DOCUMENTS=read_shared('documents.json')
class ServiceError(Exception):
    def __init__(self,status,code,message=None):
        self.status,self.code,self.message=status,code,message or code
        super().__init__(code)
def fail(status,code):
    raise ServiceError(status,code)
def strict_json(raw):
    def bad(value): raise ValueError('Invalid JSON constant')
    if isinstance(raw,(bytes,bytearray)):raw=raw.decode('utf-8')
    return json.loads(raw,parse_constant=bad)
def exact(value,keys):
    if not isinstance(value,dict) or set(value)!=set(keys):fail(400,'INVALID_REQUEST')
    return value
def trim(value):return value.strip('\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')
def well_formed(value):return all(not 0xD800<=ord(char)<=0xDFFF for char in value)
def text(value,maximum=2000):
    if not isinstance(value,str) or not well_formed(value):fail(400,'INVALID_REQUEST')
    value=trim(value)
    if not 1<=len(value)<=maximum:fail(400,'INVALID_REQUEST')
    return value
def identifier(value):
    value=text(value,64)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',value):fail(400,'INVALID_REQUEST')
    return value
def question_body(raw):return {'question':text(exact(raw,['question'])['question'])}
def run_body(raw):
    body=exact(raw,['request_id','question']);return {'request_id':identifier(body['request_id']),'question':text(body['question'])}
def memory_body(raw):
    body=exact(raw,['id','text']);return {'id':identifier(body['id']),'text':text(body['text'])}
def evidence_of(documents):return [{k:d[k] for k in ('id','title','text')} for d in documents]
def parse_answer(raw,evidence):
    try:value=strict_json(raw)
    except (ValueError,TypeError,UnicodeError):fail(502,'MODEL_FORMAT_ERROR')
    if not isinstance(value,dict) or set(value)!={'answer','citations'}:fail(502,'MODEL_SCHEMA_ERROR')
    answer=value['answer'];citations=value['citations']
    if not isinstance(answer,str) or not well_formed(answer) or not 1<=len(trim(answer))<=4000 or not isinstance(citations,list) or any(not isinstance(x,str) or not well_formed(x) or not x for x in citations) or len(set(citations))!=len(citations):fail(502,'MODEL_SCHEMA_ERROR')
    if not set(citations)<={d['id'] for d in evidence}:fail(502,'UNSUPPORTED_CITATION')
    return {'answer':trim(answer),'citations':citations}
