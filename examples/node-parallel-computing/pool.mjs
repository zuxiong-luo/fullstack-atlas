import {randomUUID} from 'node:crypto';
import {endpoint} from './endpoint.mjs';
import {validateJob} from './compute.mjs';
export class PoolError extends Error{constructor(code){super(code);this.code=code;}}
export class ComputePool{
 #slots=new Set();#queue=[];#closed=false;#closing;#restarts=0;#startedWaiters=new Map();
 constructor({mode='thread',size=2,queue=4,maxRestarts=8}={}){
  if(!['thread','process'].includes(mode)||!Number.isInteger(size)||size<1||size>4||!Number.isInteger(queue)||queue<0||queue>32||!Number.isInteger(maxRestarts)||maxRestarts<0||maxRestarts>32)throw new RangeError('BAD_POOL_OPTIONS');
  this.mode=mode;this.size=size;this.queueCapacity=queue;this.maxRestarts=maxRestarts;
  for(let i=0;i<size;i++)this.#spawn();
 }
 #spawn(){
  if(this.#closed)return;const transport=endpoint(this.mode),slot={transport,task:null,stopping:false};this.#slots.add(slot);
  transport.onMessage(message=>this.#message(slot,message));
  transport.onError(()=>this.#stopSlot(slot,new PoolError('WORKER_ERROR')));
  transport.onExit(()=>{
   this.#slots.delete(slot);if(slot.task)this.#finish(slot.task,new PoolError('WORKER_EXIT'));
   if(!this.#closed){if(this.#restarts++<this.maxRestarts){this.#spawn();this.#pump();}else void this.close(new PoolError('RESTART_LIMIT'));}
  });this.#pump();
 }
 #finish(task,error,result){
  if(task.settled)return;task.settled=true;clearTimeout(task.timer);task.signal?.removeEventListener('abort',task.abort);
  const waiter=this.#startedWaiters.get(task.id);if(waiter){waiter.reject(error??new PoolError('NO_START_OBSERVED'));this.#startedWaiters.delete(task.id);}
  error?task.reject(error):task.resolve(result);
 }
 #stopSlot(slot,error){
  if(slot.stopping)return;slot.stopping=true;if(slot.task)this.#finish(slot.task,error);void slot.transport.stop();
 }
 #cancel(task,error){
  if(task.settled)return;const at=this.#queue.indexOf(task);
  if(at>=0){this.#queue.splice(at,1);this.#finish(task,error);return;}
  const slot=[...this.#slots].find(slot=>slot.task===task);if(slot)this.#stopSlot(slot,error);
 }
 #pump(){
  if(this.#closed)return;
  for(const slot of this.#slots){
   if(slot.stopping||slot.task)continue;
   while(this.#queue.length){const task=this.#queue.shift();if(task.settled)continue;
    if(performance.now()>=task.deadline){this.#finish(task,new PoolError('TIMEOUT'));continue;}
    slot.task=task;try{slot.transport.send({type:'run',id:task.id,job:task.job});}catch{this.#stopSlot(slot,new PoolError('SEND_FAILED'));}break;
   }
  }
 }
 #message(slot,message){
  const task=slot.task;if(slot.stopping||!task||task.settled)return;
  if(message?.id!==task.id||!['started','result'].includes(message.type)){this.#stopSlot(slot,new PoolError('PROTOCOL'));return;}
  if(message.type==='started'){
   task.started=true;const waiter=this.#startedWaiters.get(task.id);if(waiter){waiter.resolve();this.#startedWaiters.delete(task.id);}return;
  }
  if(performance.now()>=task.deadline){this.#stopSlot(slot,new PoolError('TIMEOUT'));return;}
  if(typeof message.ok!=='boolean'||message.ok&&(!Number.isInteger(message.result?.count)||message.result.count<0||message.result.count>task.job.limit||!Number.isInteger(message.result?.pid)||message.result.pid<1||!Number.isInteger(message.result?.threadId)||message.result.threadId<0)){this.#stopSlot(slot,new PoolError('PROTOCOL'));return;}
  slot.task=null;this.#finish(task,message.ok?null:new PoolError('COMPUTE_FAILED'),message.result);this.#pump();
 }
 submit(input,{timeoutMs=5000,signal}={}){
  const job=validateJob(input);if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new RangeError('BAD_TIMEOUT');
  signal?.throwIfAborted();if(this.#closed)throw new PoolError('POOL_CLOSED');
  const available=[...this.#slots].filter(s=>!s.task&&!s.stopping).length;
  if(this.#queue.length>=this.queueCapacity+available)throw new PoolError('QUEUE_FULL');
  let resolve,reject;const result=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const task={id:randomUUID(),job,resolve,reject,signal,settled:false,started:false,deadline:performance.now()+timeoutMs,timer:null,abort:null};
  task.abort=()=>this.#cancel(task,signal.reason);signal?.addEventListener('abort',task.abort,{once:true});
  task.timer=setTimeout(()=>this.#cancel(task,new PoolError('TIMEOUT')),timeoutMs);this.#queue.push(task);this.#pump();
  return {id:task.id,result,started:()=>task.started?Promise.resolve():task.settled?Promise.reject(new PoolError('ALREADY_SETTLED')):new Promise((resolve,reject)=>{const old=this.#startedWaiters.get(task.id);if(old){reject(new PoolError('START_WAITER_EXISTS'));return;}this.#startedWaiters.set(task.id,{resolve,reject});})};
 }
 snapshot(){return {closed:this.#closed,workers:this.#slots.size,running:[...this.#slots].filter(s=>s.task).length,queued:this.#queue.length,restarts:this.#restarts};}
 close(reason=new PoolError('POOL_CLOSED')){
  if(this.#closing)return this.#closing;this.#closed=true;
  for(const task of this.#queue.splice(0))this.#finish(task,reason);
  for(const slot of this.#slots){slot.stopping=true;if(slot.task)this.#finish(slot.task,reason);}
  this.#closing=Promise.all([...this.#slots].map(slot=>slot.transport.stop())).then(()=>{});return this.#closing;
 }
}
