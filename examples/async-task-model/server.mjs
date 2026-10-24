import {createServer} from 'node:http';import {once} from 'node:events';import {createHash,timingSafeEqual} from 'node:crypto';
import {accept,JobError} from './jobs.mjs';
async function input(req){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new JobError('BAD_INPUT');
 const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>1024)throw new JobError('BODY_LIMIT');chunks.push(part);}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new JobError('BAD_INPUT');}
}
export async function startServer(pool,token,hooks={}){
 const digest=value=>createHash('sha256').update(value).digest(),expected=digest('Bearer '+token);let active=0;
 const send=(res,status,value)=>{if(!res.destroyed){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));}};
 const server=createServer((req,res)=>{
  req.on('error',()=>{});
  if(active>=16){req.resume();send(res,429,{error:'REQUEST_CAPACITY'});return;}active++;
  void handle(req,res).catch(error=>{
   const code=error instanceof JobError?error.code:'INTERNAL';
   const status={AUTH_REQUIRED:401,BAD_INPUT:422,BAD_KEY:422,BODY_LIMIT:413,KEY_CONFLICT:409,QUEUE_FULL:429,NOT_FOUND:404}[code]??500;
   send(res,status,{error:code});
  }).finally(()=>active--);
 });
 server.requestTimeout=4000;server.headersTimeout=4000;
 async function handle(req,res){
  if(req.url==='/health'&&req.method==='GET'){send(res,200,{ready:true});return;}
  if(!timingSafeEqual(digest(req.headers.authorization??''),expected))throw new JobError('AUTH_REQUIRED');
  if(req.method==='POST'&&req.url==='/jobs'){
   const payload=await input(req),db=await pool.connect();
   try{const job=await accept(db,req.headers['idempotency-key'],payload,hooks);send(res,['succeeded','failed'].includes(job.status)?200:202,job);}finally{db.release();}return;
  }
  if(req.method==='GET'&&/^\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(req.url)){
   const {rows}=await pool.query('SELECT id,status,result,error_code FROM jobs WHERE id=$1',[req.url.slice(6)]);
   if(!rows.length)throw new JobError('NOT_FOUND');send(res,200,rows[0]);return;
  }
  throw new JobError('NOT_FOUND');
 }
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return {base:'http://127.0.0.1:'+server.address().port,async close(){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}};
}
