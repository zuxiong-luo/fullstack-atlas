import {performance} from 'node:perf_hooks';
export function summarize(latencies,elapsedMs,successes){
 if(!latencies.length||!Number.isFinite(elapsedMs)||elapsedMs<=0)throw new RangeError('EMPTY_WINDOW');
 const sorted=[...latencies].sort((a,b)=>a-b),percentile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
 return {attempts:sorted.length,successes,errors:sorted.length-successes,elapsedMs,completedRps:sorted.length/(elapsedMs/1000),successRps:successes/(elapsedMs/1000),latencyMs:{p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1)}};
}
export async function runLoad(base,{requests=20,concurrency=2,mode='sync',iterations=500000}={}){
 const url=new URL(base);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('LOOPBACK_ONLY');
 if(!Number.isInteger(requests)||requests<1||requests>100||!Number.isInteger(concurrency)||concurrency<1||concurrency>8||!['sync','chunked'].includes(mode)||!Number.isInteger(iterations)||iterations<1||iterations>2000000)throw new RangeError('BOUNDED_LOAD_REQUIRED');
 await(await fetch(base+`/work?mode=${mode}&n=${iterations}`)).text();
 const reset=await fetch(base+'/reset');if(!reset.ok)throw new Error('RESET_BUSY');await reset.text();
 let cursor=0,successes=0,transportErrors=0;const latencies=[],started=performance.now();
 await Promise.all(Array.from({length:concurrency},async()=>{
  while(cursor<requests){cursor++;const begin=performance.now();try{const response=await fetch(base+`/work?mode=${mode}&n=${iterations}`,{signal:AbortSignal.timeout(10000)});await response.text();if(response.ok)successes++;}catch{transportErrors++;}finally{latencies.push(performance.now()-begin);}}
 }));
 const summary=summarize(latencies,performance.now()-started,successes),server=await(await fetch(base+'/metrics')).json();
 return {model:'closed-loop',concurrency,mode,iterations,...summary,transportErrors,server};
}
