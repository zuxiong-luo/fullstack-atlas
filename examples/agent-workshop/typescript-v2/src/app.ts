import Fastify from 'fastify';
import {Service,type Options} from './service.js';
import {ServiceError,fail,id,memoryBody,questionBody,runBody} from './contracts.js';
import {executeTool} from './tools.js';
import {publicRun} from './store.js';
export function buildApp(options:Options={}){
 const service=new Service(options),app=Fastify({bodyLimit:64*1024,logger:false});
 app.removeAllContentTypeParsers();
 app.addContentTypeParser('application/json',{parseAs:'buffer'},(_request,body,done)=>{
  try{const bytes=body as Buffer;done(null,bytes.length?JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)):undefined)}
  catch{done(new ServiceError(400,'INVALID_REQUEST'),undefined)}
 });
 app.decorateRequest('owner','');
 const owner=(request:unknown)=>(request as {owner:string}).owner;
 app.addHook('onRequest',async request=>{
  if(request.routeOptions.url==='/health')return;
  const identity=new Map([['Bearer demo-alice','alice'],['Bearer demo-bob','bob']]).get(request.headers.authorization??'');
  if(!identity)fail(401,'UNAUTHORIZED');(request as unknown as {owner:string}).owner=identity!;
 });
 app.setErrorHandler((error,_request,reply)=>{
  const err=error as Error&{code?:string;statusCode?:number};
  const known=error instanceof ServiceError?error:err.code==='FST_ERR_CTP_BODY_TOO_LARGE'?new ServiceError(413,'PAYLOAD_TOO_LARGE'):err.statusCode===400||err.code?.startsWith('FST_ERR_CTP')?new ServiceError(400,'INVALID_REQUEST'):new ServiceError(500,'INTERNAL_ERROR');
  reply.code(known.status).send({ok:false,error:{code:known.code,message:known.message}});
 });
 app.setNotFoundHandler((_req,reply)=>reply.code(404).send({ok:false,error:{code:'ROUTE_NOT_FOUND',message:'ROUTE_NOT_FOUND'}}));
 app.get('/health',async()=>({status:'ok',chapter:service.chapter}));
 if(service.chapter>=2)app.post('/v2/tools',async request=>({ok:true,result:executeTool(owner(request),request.body)}));
 if(service.chapter>=3)app.post('/v2/answers',async request=>({ok:true,result:await service.answer(owner(request),questionBody(request.body).question)}));
 if(service.chapter>=4){
  app.post('/v2/runs',async request=>{const body=runBody(request.body);return{ok:true,run:await service.run(owner(request),body.request_id,body.question)}});
  app.get('/v2/runs/:id',async request=>{const run=service.store.get(owner(request),id((request.params as {id:string}).id));if(!run)fail(404,'RUN_NOT_FOUND');return{ok:true,run:publicRun(run!)}});
  app.post('/v2/runs/:id/resume',async request=>{if(request.body!==undefined&&request.body!==null)fail(400,'INVALID_REQUEST');return{ok:true,run:await service.run(owner(request),id((request.params as {id:string}).id))}});
 }
 if(service.chapter>=5){
  app.post('/v2/memory',async request=>{const body=memoryBody(request.body);return{ok:true,result:service.store.putMemory(owner(request),body.id,body.text)}});
  app.get('/v2/memory',async request=>({ok:true,result:service.store.memory(owner(request))}));
  app.delete('/v2/memory/:id',async request=>{service.store.deleteMemory(owner(request),id((request.params as {id:string}).id));return{ok:true,deleted:true}});
 }
 app.addHook('onClose',async()=>service.store.close());
 return{app,service};
}
