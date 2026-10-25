import cluster from 'node:cluster';
import { createServer, get } from 'node:http';
import {firstMessage,childExit} from './child-events.mjs';
if(cluster.isPrimary){
  cluster.schedulingPolicy=cluster.SCHED_RR;
  const workers=[];
  try {
    for(let i=0;i<2;i++)workers.push(cluster.fork({ATLAS_CLUSTER_FAIL:process.argv.includes('--startup-fail')?'1':'0'}));
    const ready=await Promise.all(workers.map(worker=>firstMessage(worker.process).then(message=>message)));
    const replies=[];
    for(let i=0;i<8;i++)replies.push(await new Promise((resolve,reject)=>{
      const request=get({host:'127.0.0.1',port:ready[0].port,agent:false},response=>{let data='';response.on('data',part=>data+=part);response.once('end',()=>resolve(JSON.parse(data)));});
      request.setTimeout(1000,()=>request.destroy(new Error('TIMEOUT')));request.once('error',reject);
    }));
    console.log(JSON.stringify({workerPids:ready.map(row=>row.pid),ports:ready.map(row=>row.port),servedBy:[...new Set(replies.map(row=>row.pid))],requests:replies.length}));
  } catch(error){console.error(error.message);process.exitCode=1;}
  finally {for(const worker of workers)if(worker.isConnected())worker.send('close');await Promise.all(workers.map(worker=>childExit(worker.process,{signal:null})));}
}else{
  if(process.env.ATLAS_CLUSTER_FAIL==='1'){process.exit(7);}
  const server=createServer((_req,res)=>res.end(JSON.stringify({pid:process.pid})));
  server.listen(0,'127.0.0.1',()=>process.send({pid:process.pid,port:server.address().port}));
  process.once('message',()=>server.close(()=>process.disconnect()));
}
