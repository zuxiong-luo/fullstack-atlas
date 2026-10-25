import { createServer, get } from 'node:http';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
const countConnections=server=>new Promise((resolve,reject)=>server.getConnections((error,count)=>error?reject(error):resolve(count)));
export async function diagnoseIO({failBeforeConnect=false,stallResponse=false}={}){
 if(typeof failBeforeConnect!=='boolean'||typeof stallResponse!=='boolean')throw new TypeError('BOOLEAN_FAULT_MODE_REQUIRED');
 const sockets=new Set(),timers=new Set();const resourcesBefore=process.getActiveResourcesInfo();
 const upstream=createServer((_req,res)=>{if(stallResponse)return;const timer=setTimeout(()=>{timers.delete(timer);res.end('upstream');},120);timers.add(timer);});
 upstream.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 const histogram=monitorEventLoopDelay({resolution:10});histogram.enable();
 const controller=new AbortController();let deadline,request,requestClosed,removeAcceptedObserver=()=>{},acceptedConnectionHandler,failed;
 try{
  await new Promise((resolve,reject)=>{upstream.once('error',reject);upstream.listen(0,'127.0.0.1',resolve);});
  const port=upstream.address().port;
  // Controlled fault: close only our own listener before connecting to its port.
  if(failBeforeConnect)await new Promise(resolve=>upstream.close(resolve));
  await new Promise(resolve=>setTimeout(resolve,20));
  const cpu=process.cpuUsage(),elu=performance.eventLoopUtilization(),started=performance.now();
  deadline=setTimeout(()=>controller.abort(new Error('IO_BUDGET_EXCEEDED')),2000);
  const accepted=new Promise((resolve,reject)=>{
   const cleanup=()=>{upstream.off('connection',connected);controller.signal.removeEventListener('abort',aborted);};
   const connected=()=>{cleanup();countConnections(upstream).then(count=>resolve({count,resources:process.getActiveResourcesInfo()}),reject);};
   const aborted=()=>{cleanup();reject(controller.signal.reason);};
   removeAcceptedObserver=cleanup;acceptedConnectionHandler=connected;upstream.once('connection',connected);controller.signal.addEventListener('abort',aborted,{once:true});
  });
  const responseBody=new Promise((resolve,reject)=>{
   request=get({host:'127.0.0.1',port,agent:false,signal:controller.signal},response=>{
    let body='';response.on('data',part=>body+=part);response.once('end',()=>resolve(body));response.once('error',reject);
   });
   requestClosed=new Promise(resolve=>request.once('close',resolve));request.once('error',reject);
  });
  // Both rejection handlers are installed together: a failed request never leaves
  // a separate, unbounded server-accept wait or an unhandled rejected Promise.
  const [body,connection]=await Promise.all([responseBody,accepted]);
  const elapsedMs=performance.now()-started,cpuUs=process.cpuUsage(cpu),loop=performance.eventLoopUtilization(elu);
  return {body,elapsedMs,cpuMs:(cpuUs.user+cpuUs.system)/1000,elu:loop.utilization,loopP99Ms:histogram.percentile(99)/1e6,connectionsDuring:connection.count,resourcesBefore,resourcesDuring:connection.resources};
 }catch(error){failed=error;throw error;}
 finally{
  clearTimeout(deadline);controller.abort(new Error('IO_CLEANUP'));removeAcceptedObserver();histogram.disable();
  for(const timer of timers)clearTimeout(timer);timers.clear();for(const socket of sockets)socket.destroy();
  if(requestClosed)await requestClosed;
  if(upstream.listening)await new Promise(resolve=>upstream.close(resolve));
  if(failed)failed.cleanup={listening:upstream.listening,ownedTimers:timers.size,requestDestroyed:request?.destroyed??true,connectionObservers:upstream.listeners('connection').filter(listener=>listener===acceptedConnectionHandler).length};
 }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)console.log(JSON.stringify(await diagnoseIO()));
