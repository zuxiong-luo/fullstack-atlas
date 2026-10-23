import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildApp} from '../src/app.js';import {readShared,ServiceError,cp} from '../src/contracts.js';
import {KeywordRetriever} from '../src/retrieval.js';import {mockProvider,type Provider} from '../src/providers.js';
const auth={authorization:'Bearer demo-alice'};
const pick=(data:any,path:string)=>path.split('.').reduce((value,key)=>value?.[key],data);
for(const fixture of readShared('http-cases.json'))test('shared HTTP '+fixture.id,async()=>{
 const {app}=buildApp({chapter:fixture.chapter});
 try{for(const step of fixture.steps){const response=await app.inject({method:step.method,url:step.path,headers:step.token?{authorization:`Bearer ${step.token}`}:{},...(Object.hasOwn(step,'body')?{payload:step.body}:{})});assert.equal(response.statusCode,step.status,response.body);const body=response.json();if(step.code)assert.equal(body.error.code,step.code);for(const [path,value] of Object.entries(step.expect??{}))assert.deepEqual(pick(body,path),value)}}finally{await app.close()}
});
test('chapter gates and public health',async()=>{
 for(const chapter of [2,3,4,5,6,7,8]){
  const {app}=buildApp({chapter});try{assert.deepEqual((await app.inject('/health')).json(),{status:'ok',chapter});
  for(const [minimum,method,path,body]of [[3,'POST','/v2/answers',{question:'cache'}],[4,'POST','/v2/runs',{request_id:'run',question:'cache'}],[5,'GET','/v2/memory',undefined]] as const){const response=await app.inject({method,url:path,headers:auth,payload:body});assert.equal(response.statusCode,chapter<minimum?404:200,response.body);if(chapter<minimum)assert.equal(response.json().error.code,'ROUTE_NOT_FOUND')}}finally{await app.close()}
 }
});
test('strict JSON, code-point trimming and 64KiB ingress bound',async()=>{
 const {app}=buildApp({chapter:8});try{
  assert.equal((await app.inject({method:'POST',url:'/v2/answers',headers:{...auth,'content-type':'application/json'},payload:'{bad'})).json().error.code,'INVALID_REQUEST');
  assert.equal((await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'😀'.repeat(2000)}})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'😀'.repeat(2001)}})).statusCode,400);
  const tooLarge=await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'x'.repeat(70000)}});assert.equal(tooLarge.statusCode,413);assert.equal(tooLarge.json().error.code,'PAYLOAD_TOO_LARGE');
 }finally{await app.close()}
});
test('retrieval shared evaluations exact IDs and owner isolation',async()=>{
 const retriever=new KeywordRetriever();for(const row of readShared('retrieval-cases.json')){const ids=(await retriever.search(row.owner,row.question)).map(d=>d.id);assert.deepEqual(ids,row.expected)}
 assert.deepEqual((await retriever.search('alice','ｃａｃｈｅ')).map(d=>d.id),['cache-guide']);
 const ids=(await retriever.search('alice','bob monday plan lease worker')).map(d=>d.id);assert.ok(!ids.includes('bob-note'));
});
test('format, schema, unknown and duplicate citations are rejected',async()=>{
 for(const [raw,expected]of [['bad','MODEL_FORMAT_ERROR'],[JSON.stringify({answer:'a',citations:['missing']}),'UNSUPPORTED_CITATION'],[JSON.stringify({answer:'a',citations:['cache-guide','cache-guide']}),'MODEL_SCHEMA_ERROR'],[JSON.stringify({answer:'a',citations:['cache-guide'],tool_calls:[{name:'shell'}]}),'MODEL_SCHEMA_ERROR']]){
  const {app}=buildApp({provider:async()=>raw});try{const r=await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});assert.equal(r.statusCode,502);assert.equal(r.json().error.code,expected)}finally{await app.close()}
 }
});
test('memory is explicit, sorted, owner-scoped, deleted and absent from retrieval',async()=>{
 const {app}=buildApp();try{
  for(const id of ['z','a'])await app.inject({method:'POST',url:'/v2/memory',headers:auth,payload:{id,text:'secret banana'}});
  assert.deepEqual((await app.inject({url:'/v2/memory',headers:auth})).json().result.map((x:any)=>x.id),['a','z']);
  const answer=(await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'secret banana'}})).json();assert.deepEqual(answer.result.evidence,[]);
  await app.inject({method:'DELETE',url:'/v2/memory/a',headers:auth});assert.deepEqual((await app.inject({url:'/v2/memory',headers:auth})).json().result.map((x:any)=>x.id),['z']);
 }finally{await app.close()}
});
test('context uses codepoints in question/id/title/text; call budget skips no-hit',async()=>{
 let calls=0;const evidence=[{id:'d',title:'标',text:'😀😀'}];const provider:Provider=async()=>{calls++;return JSON.stringify({answer:'ok',citations:['d']})};
 const a=buildApp({maxContextChars:6,retriever:{search:async()=>evidence},provider});
 try{const yes=await a.app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'ok'}});assert.equal(yes.statusCode,200);assert.equal(yes.json().result.metrics.context_chars,6);
 const no=await a.app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'ok!'}});assert.equal(no.statusCode,400);assert.equal(no.json().error.code,'CONTEXT_TOO_LARGE');assert.equal(calls,1)}finally{await a.app.close()}
 const b=buildApp({maxModelCalls:0});try{const no=await b.app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});assert.equal(no.json().error.code,'MODEL_BUDGET_EXCEEDED');const empty=await b.app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'banana'}});assert.equal(empty.statusCode,200);assert.equal(empty.json().result.metrics.model_calls,0)}finally{await b.app.close()}
});
test('chapter8 admission bounds active provider; reads and tools remain available',async()=>{
 let unblock!:(value:string)=>void;const waiting=new Promise<string>(resolve=>unblock=resolve);let entered!:(v?:unknown)=>void;const started=new Promise(resolve=>entered=resolve);
 const {app}=buildApp({maxConcurrent:1,provider:async()=>{entered();return waiting}});
 try{
  const first=app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});await started;
  const busy=await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});assert.equal(busy.statusCode,503);assert.equal(busy.json().error.code,'SERVICE_BUSY');
  assert.equal((await app.inject({url:'/v2/memory',headers:auth})).statusCode,200);assert.equal((await app.inject({method:'POST',url:'/v2/tools',headers:auth,payload:{name:'lookup_document',arguments:{document_id:'cache-guide'}}})).statusCode,200);
  unblock(JSON.stringify({answer:'ok',citations:['cache-guide']}));assert.equal((await first).statusCode,200);
 }finally{unblock('{}');await app.close()}
});
test('uncooperative timed-out provider retains admission until actually settled',async()=>{
 let release!:(value:string)=>void;const work=new Promise<string>(resolve=>release=resolve);
 const {app}=buildApp({maxConcurrent:1,timeoutMs:10,provider:async()=>work});
 try{const timeout=await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});assert.equal(timeout.statusCode,504);
 const busy=await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});assert.equal(busy.statusCode,503);
 release(JSON.stringify({answer:'ok',citations:['cache-guide']}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}})).statusCode,200);
 }finally{release('{}');await app.close()}
});
test('chapters2..7 do not apply chapter8 budgets',async()=>{
 const {app}=buildApp({chapter:3,maxContextChars:1,maxModelCalls:0,maxConcurrent:1});try{assert.equal((await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}})).statusCode,200)}finally{await app.close()}
});
test('JSON ingress rejects malformed UTF8 and non-JSON media types without replacement decoding',async()=>{
 const {app}=buildApp();try{
  const payload=Buffer.concat([Buffer.from('{"question":"'),Buffer.from([0xc3,0x28]),Buffer.from('"}')]);
  const invalid=await app.inject({method:'POST',url:'/v2/answers',headers:{...auth,'content-type':'application/json'},payload});assert.equal(invalid.statusCode,400);assert.equal(invalid.json().error.code,'INVALID_REQUEST');
  const text=await app.inject({method:'POST',url:'/v2/answers',headers:{...auth,'content-type':'text/plain'},payload:'{"question":"cache"}'});assert.equal(text.statusCode,400);
 }finally{await app.close()}
});
test('lone surrogate input/answers/citations are rejected while valid emoji survives',async()=>{
 const request=buildApp();try{
  for(const question of ['\ud800','\udc00']){const response=await request.app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question}});assert.equal(response.statusCode,400);assert.equal(response.json().error.code,'INVALID_REQUEST')}
  assert.equal((await request.app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'😀'}})).statusCode,200);
 }finally{await request.app.close()}
 for(const result of [{answer:'\ud800',citations:['cache-guide']},{answer:'ok',citations:['\udc00']}]){
  const {app}=buildApp({provider:async()=>JSON.stringify(result)});try{const response=await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});assert.equal(response.statusCode,502);assert.equal(response.json().error.code,'MODEL_SCHEMA_ERROR')}finally{await app.close()}
 }
});
test('JSON UTF8 BOM and UTF16 bodies are rejected consistently',async()=>{
 const {app}=buildApp();try{
  for(const payload of [Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{"question":"cache"}')]),Buffer.from('{"question":"cache"}','utf16le')]){const response=await app.inject({method:'POST',url:'/v2/answers',headers:{...auth,'content-type':'application/json'},payload});assert.equal(response.statusCode,400)}
 }finally{await app.close()}
});
