import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {spawnSync} from 'node:child_process';
import {buildApp} from '../src/app.js';import {httpProvider} from '../src/providers.js';
const auth={authorization:'Bearer demo-alice'};
test('real local HTTP provider adapter: bounded envelopes, redirect rejection, timeout and structured model errors',async()=>{
 let redirected=0,sawRequest=false;
 const server=http.createServer(async(req,res)=>{
  let data='';for await(const chunk of req)data+=chunk;
  if(req.url==='/redirect-target'){redirected++;res.end('{}');return}
  const parsed=JSON.parse(data);assert.equal(req.headers.authorization,'Bearer local-test-key');assert.equal(parsed.model,'local-test-model');assert.equal(parsed.messages[0].role,'system');sawRequest=true;
  if(req.url==='/redirect'){res.writeHead(302,{Location:'/redirect-target'});res.end();return}
  if(req.url==='/status'){res.writeHead(503);res.end('{}');return}
  if(req.url==='/slow'){const timer=setTimeout(()=>res.end('{}'),200);res.on('close',()=>clearTimeout(timer));return}
  if(req.url==='/large'){res.end('x'.repeat(1024*1024+1));return}
  if(req.url==='/envelope'){res.end('{bad');return}
  if(req.url==='/invalid-utf8'){const envelope=JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'INVALID_BYTE',citations:['cache-guide']})}}]});const index=envelope.indexOf('INVALID_BYTE');res.end(Buffer.concat([Buffer.from(envelope.slice(0,index)),Buffer.from([0xc3,0x28]),Buffer.from(envelope.slice(index+'INVALID_BYTE'.length))]));return}
  if(req.url==='/bom'){res.end(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{}')]));return}
  if(req.url==='/utf16'){res.end(Buffer.from('{}','utf16le'));return}
  const content=req.url==='/model-json'?'{bad':req.url==='/model-schema'?JSON.stringify({answer:1,citations:[]}):req.url==='/citation'?JSON.stringify({answer:'x',citations:['bob-note']}):JSON.stringify({answer:'local HTTP result',citations:['cache-guide']});
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content}}]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;
 try{
  for(const [path,status,code]of [['/ok',200,null],['/redirect',502,'UPSTREAM_ERROR'],['/status',502,'UPSTREAM_ERROR'],['/large',502,'UPSTREAM_ERROR'],['/envelope',502,'UPSTREAM_ERROR'],['/invalid-utf8',502,'UPSTREAM_ERROR'],['/bom',502,'UPSTREAM_ERROR'],['/utf16',502,'UPSTREAM_ERROR'],['/model-json',502,'MODEL_FORMAT_ERROR'],['/model-schema',502,'MODEL_SCHEMA_ERROR'],['/citation',502,'UNSUPPORTED_CITATION'],['/slow',504,'UPSTREAM_TIMEOUT']] as const){
   const {app}=buildApp({provider:httpProvider({url:`http://127.0.0.1:${port}${path}`,key:'local-test-key',model:'local-test-model'}),timeoutMs:path==='/slow'?20:1000});
   try{const response=await app.inject({method:'POST',url:'/v2/answers',headers:auth,payload:{question:'cache'}});assert.equal(response.statusCode,status,response.body);if(code)assert.equal(response.json().error.code,code);else assert.equal(response.json().result.answer,'local HTTP result')}finally{await app.close()}
  }
  assert.equal(redirected,0);assert.equal(sawRequest,true);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
test('HTTP adapter rejects invalid environment endpoints and missing configuration',()=>{
 for(const url of ['file:///private','http://user:pass@127.0.0.1','http://127.0.0.1/#token'])assert.throws(()=>httpProvider({url,key:'k',model:'m'}));
 assert.throws(()=>httpProvider({url:'http://127.0.0.1',key:'',model:'m'}));
});
test('actual MCP stdio process: notifications stay silent, tools share permission checks',()=>{
 const messages=[
  {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}},
  {jsonrpc:'2.0',method:'notifications/initialized'},
  {jsonrpc:'2.0',id:2,method:'tools/list',params:{}},
  {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'lookup_document',arguments:{document_id:'cache-guide'}}},
  {jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'shell',arguments:{command:'never'}}},
  {jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'lookup_document',arguments:{document_id:'bob-note'}}},
  {jsonrpc:'2.0',id:6,method:'unknown',params:{}},
  {jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'lookup_document',arguments:{document_id:'../bad'}}},
 ];
 const child=spawnSync(process.execPath,['--import','tsx','src/mcp.ts'],{cwd:process.cwd(),env:{...process.env,MCP_OWNER:'alice'},input:messages.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);const lines=child.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(lines.length,7);
 assert.equal(lines[0].result.protocolVersion,'2025-06-18');assert.ok(lines[1].result.tools[0].inputSchema.$defs.id);
 assert.equal(JSON.parse(lines[2].result.content[0].text).id,'cache-guide');assert.equal(lines[3].result.isError,true);assert.equal(JSON.parse(lines[3].result.content[0].text).error.code,'TOOL_FORBIDDEN');
 assert.equal(JSON.parse(lines[4].result.content[0].text).error.code,'DOCUMENT_FORBIDDEN');assert.equal(lines[5].error.code,-32601);assert.equal(lines[6].error.code,-32602);
});
