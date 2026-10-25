import test from 'node:test';import assert from 'node:assert/strict';
import {ComputePool} from './pool.mjs';import {countPrimes} from './compute.mjs';import {inspectChannel} from './communication.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(pool){for(let i=0;i<200;i++){const s=pool.snapshot();if(s.workers===pool.size&&s.running===0)return;await pause(10);}throw new Error('pool did not recover');}
for(const mode of ['thread','process']){
 test(mode+': bounded running plus queue, exact CPU results and physical isolation',async()=>{
  const pool=new ComputePool({mode,size:1,queue:1});try{
   const a=pool.submit({kind:'count',limit:10}),b=pool.submit({kind:'count',limit:100});assert.deepEqual(pool.snapshot(),{closed:false,workers:1,running:1,queued:1,restarts:0});assert.throws(()=>pool.submit({kind:'count',limit:1000}),/QUEUE_FULL/);
   const [x,y]=await Promise.all([a.result,b.result]);assert.equal(x.count,4);assert.equal(y.count,25);assert.equal(x.pid===process.pid,mode==='thread');assert.equal(x.threadId>0,mode==='thread');
  }finally{await pool.close();}
 });
 test(mode+': queued abort removes pending work without sending it',async()=>{
  const pool=new ComputePool({mode,size:1,queue:1}),controller=new AbortController();try{
   const a=pool.submit({kind:'count',limit:100}),b=pool.submit({kind:'count',limit:1000},{signal:controller.signal});const rejected=assert.rejects(b.result,/USER_CANCELLED/);controller.abort(new Error('USER_CANCELLED'));await rejected;assert.equal(pool.snapshot().queued,0);assert.equal((await a.result).count,25);
  }finally{await pool.close();}
 });
 test(mode+': task error does not crash the worker, process exit does and is replaced',async()=>{
  const pool=new ComputePool({mode,size:1,queue:1});try{
   await assert.rejects(pool.submit({kind:'throw'}).result,/COMPUTE_FAILED/);assert.equal(pool.snapshot().restarts,0);
   await assert.rejects(pool.submit({kind:'crash'}).result,/WORKER_EXIT/);await ready(pool);assert.equal(pool.snapshot().restarts,1);assert.equal((await pool.submit({kind:'count',limit:1000}).result).count,168);
  }finally{await pool.close();}
 });
 test(mode+': cancelling a started CPU job terminates that endpoint before capacity is reused',async()=>{
  const pool=new ComputePool({mode,size:1,queue:1}),controller=new AbortController();try{
   const a=pool.submit({kind:'count',limit:5000000},{signal:controller.signal,timeoutMs:10000});const rejected=assert.rejects(a.result,/RUN_CANCELLED/);await a.started();controller.abort(new Error('RUN_CANCELLED'));await rejected;await ready(pool);assert.equal(pool.snapshot().restarts,1);assert.equal((await pool.submit({kind:'count',limit:10}).result).count,4);
  }finally{await pool.close();}
 });
 test(mode+': deadline and close reject work, close is idempotent and no future admission',async()=>{
  const pool=new ComputePool({mode,size:1,queue:1});
  await assert.rejects(pool.submit({kind:'count',limit:5000000},{timeoutMs:1}).result,/TIMEOUT/);await ready(pool);
  const a=pool.submit({kind:'count',limit:5000000}),b=pool.submit({kind:'count',limit:10});const settled=Promise.allSettled([a.result,b.result]);await pool.close();await pool.close();assert((await settled).every(r=>r.status==='rejected'));assert.throws(()=>pool.submit({kind:'count',limit:10}),/POOL_CLOSED/);assert.equal(pool.snapshot().workers,0);
 });
}
test('thread transfer detaches original ArrayBuffer; process advanced IPC copies it',async()=>{
 const thread=await inspectChannel('thread'),processCopy=await inspectChannel('process');assert.equal(thread.senderBytes,0);assert.equal(processCopy.senderBytes,8);for(const value of [thread,processCopy]){assert.equal(value.received.bytes,8);assert.equal(value.received.first,42);}
});
test('input boundary rejects unsupported sizes before spawning useful work',()=>{
 for(const options of [{size:0},{size:5},{queue:33},{mode:'unknown'},{maxRestarts:-1}])assert.throws(()=>new ComputePool(options),RangeError);
 assert.equal(countPrimes(2),1);assert.equal(countPrimes(20),8);
});

test('job and deadline input fail before admission, restart budget closes rather than looping',async()=>{
 const pool=new ComputePool({size:1,queue:1,maxRestarts:0});try{
  for(const job of [{kind:'unknown'},{kind:'count',limit:0},{kind:'count',limit:NaN},{kind:'count',limit:5000001}])assert.throws(()=>pool.submit(job),RangeError);
  assert.throws(()=>pool.submit({kind:'count',limit:10},{timeoutMs:0}),RangeError);
  const a=pool.submit({kind:'crash'}),b=pool.submit({kind:'count',limit:10});const waiting=assert.rejects(b.result,/RESTART_LIMIT/);await assert.rejects(a.result,/WORKER_EXIT/);await waiting;assert.equal(pool.snapshot().closed,true);
 }finally{await pool.close();}
});
test('spawn arguments remain literal; exec is shell text; fork has independent IPC',async()=>{
 const {processModes}=await import('./process-modes.mjs');const row=await processModes();
 assert.equal(row.literal,row.input);assert.equal(row.fileOutput,row.input);
 if(process.platform!=='win32')assert.equal(row.shellOutput,'helloSHELL_MARK');
 assert.equal(row.bufferError,'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');assert.equal(row.reply.count,8);assert.notEqual(row.reply.pid,row.parentPid);
});
test('cluster workers serve one shared port as separate processes',async()=>{
 const {execFileSync}=await import('node:child_process');const row=JSON.parse(execFileSync(process.execPath,['cluster-demo.mjs'],{cwd:import.meta.dirname,encoding:'utf8',timeout:8000}));
 assert.equal(row.requests,8);assert.equal(new Set(row.ports).size,1);assert.equal(new Set(row.workerPids).size,2);assert.ok(row.servedBy.every(pid=>row.workerPids.includes(pid)));
});
test('fork premature exit and missing reply reject rather than leaving await pending',async()=>{
 const {processModes}=await import('./process-modes.mjs');
 await assert.rejects(processModes({peerMode:'exit'}),/CHILD_EXIT_BEFORE_MESSAGE/);
 await assert.rejects(processModes({peerMode:'silence'}),/CHILD_MESSAGE_TIMEOUT/);
 const {spawn}=await import('node:child_process');const {firstMessage,childExit}=await import('./child-events.mjs');
 const absent=spawn('/atlas-controlled-nonexistent-executable',[],{stdio:'ignore'});await assert.rejects(firstMessage(absent),{code:'ENOENT'});await childExit(absent);
});
test('cluster worker exit before ready is an explicit failure with owned cleanup',async()=>{
 const {execFileSync}=await import('node:child_process');
 assert.throws(()=>execFileSync(process.execPath,['cluster-demo.mjs','--startup-fail'],{cwd:import.meta.dirname,encoding:'utf8',timeout:8000,stdio:['ignore','pipe','pipe']}),error=>error.status===1&&error.stderr.includes('CHILD_EXIT_BEFORE_MESSAGE'));
});
