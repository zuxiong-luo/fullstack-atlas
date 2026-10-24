import {isMainThread,parentPort,threadId} from 'node:worker_threads';
import {validateJob,countPrimes} from './compute.mjs';
const send=value=>isMainThread?process.send?.(value):parentPort.postMessage(value);
const receive=handler=>isMainThread?process.on('message',handler):parentPort.on('message',handler);
receive(message=>{
 if(message?.type==='buffer'){
  const data=new Uint8Array(message.data);send({type:'buffer',bytes:data.byteLength,first:data[0],pid:process.pid,threadId});return;
 }
 if(message?.type!=='run'||typeof message.id!=='string')return;
 const {id}=message;send({type:'started',id});
 try{
  const job=validateJob(message.job);
  if(job.kind==='crash')process.exit(23);
  if(job.kind==='throw')throw new Error('intentional demonstration');
  send({type:'result',id,ok:true,result:{count:countPrimes(job.limit),pid:process.pid,threadId}});
 }catch{send({type:'result',id,ok:false,error:'COMPUTE_FAILED'});}
});
