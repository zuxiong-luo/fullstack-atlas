import {createInterface} from 'node:readline';import {executeTool} from './tools.js';import {ServiceError,object,readShared} from './contracts.js';
const owner=process.env.MCP_OWNER??'alice';if(!['alice','bob'].includes(owner))throw new Error('MCP_OWNER must be alice or bob');
const reply=(id:unknown,result:unknown)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');
const error=(id:unknown,code:number,message:string)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}})+'\n');
let initialized=false;
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of input){
 if(Buffer.byteLength(line)>64*1024){error(null,-32600,'Request too large');continue}
 let request:any;try{request=JSON.parse(line)}catch{error(null,-32700,'Parse error');continue}
 if(!object(request)||request.jsonrpc!=='2.0'||typeof request.method!=='string'){error(object(request)?request.id??null:null,-32600,'Invalid Request');continue}
 const notification=!Object.hasOwn(request,'id');
 if(notification)continue
 const id=request.id;
 if(id!==null&&typeof id!=='string'&&!(typeof id==='number'&&Number.isFinite(id))){error(null,-32600,'Invalid Request ID');continue}
 if(request.method==='initialize'){
  if(!object(request.params)){error(id,-32602,'Invalid params');continue}
  initialized=true;reply(id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'atlas-local-tools-subset',version:'2.0.0'}});continue;
 }
 if(!initialized){error(id,-32002,'Not initialized');continue}
 if(request.method==='tools/list'){reply(id,{tools:[{name:'lookup_document',description:'Read a public or owner document by ID',inputSchema:{...readShared('schema.json').$defs.lookupArguments,$defs:{id:readShared('schema.json').$defs.id}}}]});continue}
 if(request.method==='tools/call'){
  if(!object(request.params)||typeof request.params.name!=='string'||!object(request.params.arguments)){error(id,-32602,'Invalid params');continue}
  try{reply(id,{content:[{type:'text',text:JSON.stringify(executeTool(owner,request.params))}],isError:false})}
  catch(err){if(err instanceof ServiceError&&err.code==='INVALID_REQUEST')error(id,-32602,'Invalid params');else reply(id,{content:[{type:'text',text:JSON.stringify({error:{code:err instanceof ServiceError?err.code:'INTERNAL_ERROR'}})}],isError:true})}continue;
 }
 error(id,-32601,'Method not found');
}
