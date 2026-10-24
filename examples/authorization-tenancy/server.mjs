import {createServer} from 'node:http';import {once} from 'node:events';import {randomBytes} from 'node:crypto';
import {HttpError,readDocument,listDocuments,updateDocument} from './service.mjs';
async function input(req,onBodyChunk){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new HttpError(415,'JSON_REQUIRED');
 let bytes=0;const chunks=[];const timer=setTimeout(()=>req.destroy(new Error('body timeout')),1500);
 try{for await(const chunk of req){bytes+=chunk.length;if(bytes>1024)throw new HttpError(413,'BODY_LIMIT');chunks.push(Buffer.from(chunk));onBodyChunk?.(chunk.length);}}
 finally{clearTimeout(timer);}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new HttpError(400,'BAD_JSON');}
}
export async function startServer(pool,{onBodyChunk}={}){
 const sessions=new Map(),audit=[]; // Fictional bounded test principals, not a production login system.
 function issue(user){const token=randomBytes(24).toString('base64url');sessions.set(token,user);return token;}
 function json(res,status,value){if(res.destroyed)return;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));}
 const server=createServer((req,res)=>{
  req.on('error',()=>{});
  void handle(req,res).catch(error=>{
   const status=error instanceof HttpError?error.status:500,code=error instanceof HttpError?error.message:'INTERNAL';
   if(audit.length>=100)audit.shift();audit.push({method:req.method,status,code});
   json(res,status,{error:code});
  });
 });
 server.requestTimeout=3000;server.headersTimeout=3000;
 async function handle(req,res){
  const match=/^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization??''),user=match&&sessions.get(match[1]);
  if(!user)throw new HttpError(401,'AUTH_REQUIRED');
  const url=new URL(req.url,'http://loopback.invalid'),route=/^\/tenants\/([a-z][a-z0-9-]{0,31})\/docs(?:\/([a-z][a-z0-9-]{0,31}))?$/.exec(url.pathname);
  if(!route)throw new HttpError(404,'NOT_FOUND');
  const [,tenant,id]=route;
  if(req.method==='GET'){json(res,200,id?await readDocument(pool,user,tenant,id):await listDocuments(pool,user,tenant));return;}
  if(req.method==='PATCH'&&id){json(res,200,await updateDocument(pool,user,tenant,id,await input(req,onBodyChunk)));return;}
  throw new HttpError(405,'METHOD_NOT_ALLOWED');
 }
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return {base:`http://127.0.0.1:${server.address().port}`,issue,revoke:token=>sessions.delete(token),audit,
  async close(){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});sessions.clear();}};
}
