import test from 'node:test';import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {syncWork,chunkedWork} from './work.mjs';import {summarize,runLoad} from './load.mjs';import {spawnServer} from './harness.mjs';
const execute=promisify(execFile);
test('split computation preserves checksum and yields a real event-loop turn',async()=>{
 let observed=false;setImmediate(()=>{observed=true;});const expected=syncWork(100000);assert.equal(observed,false);const actual=await chunkedWork(100000);assert.equal(actual,expected);assert.equal(observed,true);
});
test('bounded input and cooperative cancellation reject without fake result',async()=>{
 for(const n of [0,-1,NaN,Infinity,2000001]){assert.throws(()=>syncWork(n),RangeError);await assert.rejects(chunkedWork(n),RangeError);}
 const controller=new AbortController();controller.abort(new Error('STOP'));await assert.rejects(chunkedWork(100000,controller.signal),/STOP/);
});
test('percentiles use nearest rank and throughput counts the measured window',()=>{
 const result=summarize([40,10,20,30],2000,3);assert.deepEqual(result.latencyMs,{p50:20,p95:40,max:40});assert.equal(result.completedRps,2);assert.equal(result.successRps,1.5);assert.equal(result.errors,1);
});
test('separate server process provides bounded real HTTP results and metrics',async()=>{
 const app=await spawnServer();try{
  for(const mode of ['sync','chunked']){const result=await runLoad(app.base,{mode,requests:12,concurrency:2,iterations:100000});assert.equal(result.attempts,12);assert.equal(result.successes,12);assert.equal(result.server.completed,12);assert.equal(result.server.active,0);assert(result.server.maxActive<=4);assert(result.elapsedMs>0);assert(result.server.memoryBytes.rss>0);assert(result.server.eventLoopUtilization>=0&&result.server.eventLoopUtilization<=1);}
 }finally{await app.close();}
});
test('HTTP and load-generator boundaries reject malformed and unintended network targets',async()=>{
 const app=await spawnServer();try{assert.equal((await fetch(app.base+'/work?n=2000001')).status,400);assert.equal((await fetch(app.base+'/absent')).status,404);await assert.rejects(runLoad('https://example.com'),/LOOPBACK_ONLY/);await assert.rejects(runLoad(app.base,{concurrency:9}),RangeError);}finally{await app.close();}
});
test('actual heap snapshots distinguish retained objects from cleared references, not RSS promises',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'atlas-heap-review-'));try{
  const {stdout}=await execute(process.execPath,['--expose-gc','snapshot.mjs',directory],{cwd:import.meta.dirname,timeout:20000,maxBuffer:1024*1024});const result=JSON.parse(stdout);
  assert(result.retained.atlasNoteCount>=result.baseline.atlasNoteCount+128);assert(result.released.atlasNoteCount<=result.retained.atlasNoteCount-128);assert(result.gcEvents.length>0);assert.equal(result.retained.ownership.globalHolder,true);assert.equal(result.retained.ownership.noteElements,128);assert.equal(result.released.ownership.noteElements,0);
  for(const stage of ['baseline','retained','released'])assert(result[stage].memoryBytes.heapUsed>0);
  console.log(JSON.stringify({heapEvidence:{baseline:result.baseline.atlasNoteCount,retained:result.retained.atlasNoteCount,released:result.released.atlasNoteCount},gcEvents:result.gcEvents.length}));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('CPU inspector captures finite workload and reconstructs its call stack',async()=>{
 const {profileCPU}=await import('./cpu-profile.mjs');const row=await profileCPU();
 assert.ok(row.totalSamples>0);assert.ok(row.hot.some(item=>item.stack.includes('profileCPU')&&item.stack.includes('rebuildIndex')));assert.ok(row.windowMs>=250);
});
test('slow local upstream exposes its connection and preserves a responsive event loop',async()=>{
 const {diagnoseIO}=await import('./io-diagnostics.mjs');const row=await diagnoseIO();
 assert.equal(row.body,'upstream');assert.equal(row.connectionsDuring,1);assert.ok(row.resourcesDuring.includes('TCPServerWrap'));assert.ok(row.elapsedMs>=100);
 // No CPU / latency speed threshold: machine scheduling is not a correctness contract.
});
test('one libuv worker queues fs behind two submitted PBKDF2 jobs',async()=>{
 const {execFileSync}=await import('node:child_process');
 const row=JSON.parse(execFileSync(process.execPath,['pool-probe.mjs','--child'],{cwd:import.meta.dirname,env:{...process.env,UV_THREADPOOL_SIZE:'1'},encoding:'utf8',timeout:10000}));
 assert.deepEqual(row.order,['crypto:0','crypto:1','file']);
});
test('connection failure and total budget close owned accept observers and request',{timeout:8000},async()=>{
 const {diagnoseIO}=await import('./io-diagnostics.mjs');
 await assert.rejects(diagnoseIO({failBeforeConnect:true}),error=>{
  assert.equal(error.code,'ECONNREFUSED');
  assert.deepEqual(error.cleanup,{listening:false,ownedTimers:0,requestDestroyed:true,connectionObservers:0});
  return true;
 });
 await assert.rejects(diagnoseIO({stallResponse:true}),error=>{
  assert.equal(error.name,'AbortError');assert.equal(error.cause.message,'IO_BUDGET_EXCEEDED');
  assert.deepEqual(error.cleanup,{listening:false,ownedTimers:0,requestDestroyed:true,connectionObservers:0});return true;
 });
});
