import {createServer} from 'node:http';
import {once} from 'node:events';
import {syncWork,chunkedWork,validateIterations} from './work.mjs';
import {metrics} from './metrics.mjs';
export async function startServer(){
 const measure=metrics(),sockets=new Set();let active=0,maxActive=0,completed=0,rejected=0;
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');res.setHeader('content-type','application/json');res.setHeader('connection','close');
  const reply=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
  if(url.pathname==='/reset'){if(active){reply(409,{error:'BUSY'});return;}measure.reset();maxActive=0;completed=0;rejected=0;reply(200,{ok:true});return;}
  if(url.pathname==='/metrics'){reply(200,{...measure.snapshot(),active,maxActive,completed,rejected});return;}
  if(url.pathname!=='/work'){reply(404,{error:'NOT_FOUND'});return;}
  const mode=url.searchParams.get('mode')??'sync',n=Number(url.searchParams.get('n'));
  try{validateIterations(n);if(!['sync','chunked'].includes(mode))throw new Error('BAD_MODE');}catch{reply(400,{error:'BAD_INPUT'});return;}
  if(active>=4){rejected++;reply(429,{error:'CAPACITY'});return;}
  active++;maxActive=Math.max(maxActive,active);const controller=new AbortController();
  res.once('close',()=>{if(!res.writableEnded)controller.abort(new Error('CLIENT_GONE'));});
  try{const checksum=mode==='sync'?syncWork(n):await chunkedWork(n,controller.signal);completed++;if(!res.destroyed)reply(200,{checksum});}
  catch{if(!res.destroyed)reply(499,{error:'CANCELLED'});}
  finally{active--;}
 });
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});server.listen(0,'127.0.0.1');await once(server,'listening');
 return {base:`http://127.0.0.1:${server.address().port}`,async close(){measure.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv.includes('--child')){
 const app=await startServer();process.send?.({base:app.base});process.on('message',async message=>{if(message==='close'){await app.close();process.disconnect();}});
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
