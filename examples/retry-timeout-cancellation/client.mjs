import {setTimeout as pause} from 'node:timers/promises';
export class RetryError extends Error {constructor(code){super(code);this.code=code;}}
export function retryAfter(value,wallNow=Date.now()) {
  if(value===null)return 0;
  if(/^\d+$/.test(value))return Math.min(Number(value)*1000,86400000);
  const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-wallNow):0;
}
export function delayFor({attempt,remaining,retryAfterMs=0,random=Math.random}) {
  const ceiling=Math.min(100,10*2**(attempt-1));
  const delay=Math.max(Math.floor(random()*ceiling),retryAfterMs);
  if(delay>=remaining)throw new RetryError('TOTAL_BUDGET');
  return delay;
}
async function bodyText(response) {
  const reader=response.body?.getReader();if(!reader)return '';
  let bytes=0;const chunks=[];
  try {
    while(true) {
      const {value,done}=await reader.read();if(done)break;
      bytes+=value.byteLength;if(bytes>4096){await reader.cancel();throw new RetryError('RESPONSE_LIMIT');}
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {reader.releaseLock();}
}
export async function requestWithRetry({url,method='GET',body,idempotencyKey,
  postReplayContract=false,attempts=3,budgetMs=800,attemptMs=200,signal,random=Math.random,onAttempt=()=>{}}) {
  if(!Number.isSafeInteger(attempts)||attempts<1||attempts>5||
     !Number.isSafeInteger(budgetMs)||budgetMs<1||budgetMs>10000||
     !Number.isSafeInteger(attemptMs)||attemptMs<1)throw new RangeError('bounded retry options required');
  const replayable=['GET','HEAD'].includes(method)||method==='POST'&&postReplayContract===true&&typeof idempotencyKey==='string'&&/^[a-z0-9-]{8,80}$/.test(idempotencyKey);
  // POST retry is permitted ONLY for the accompanying server's persistent-in-process receipt contract.
  const limit=replayable?attempts:1;
  const deadline=performance.now()+budgetMs;
  for(let attempt=1;attempt<=limit;attempt++) {
    signal?.throwIfAborted();
    const remaining=deadline-performance.now();if(remaining<=0)throw new RetryError('TOTAL_BUDGET');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new RetryError('ATTEMPT_TIMEOUT')),Math.max(1,Math.ceil(Math.min(attemptMs,remaining))));
    const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    let nextDelay=0;
    try {
      onAttempt(attempt);
      const response=await fetch(url,{method,redirect:'error',signal:combined,
        headers:{'content-type':'application/json',...(idempotencyKey?{'idempotency-key':idempotencyKey}:{})},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),
      });
      const text=await bodyText(response);
      if(deadline-performance.now()<=0)throw new RetryError('TOTAL_BUDGET');
      if(![429,503].includes(response.status))return {status:response.status,text,attempts:attempt};
      if(attempt===limit)throw new RetryError('ATTEMPTS_EXHAUSTED');
      nextDelay=retryAfter(response.headers.get('retry-after'));
    } catch(error) {
      signal?.throwIfAborted();
      if(deadline-performance.now()<=0)throw new RetryError('TOTAL_BUDGET');
      const transient=controller.signal.aborted||error instanceof TypeError&&error.message==='fetch failed';
      if(!transient)throw error;
      if(attempt===limit)throw new RetryError(!replayable&&method==='POST'?'RESULT_UNKNOWN':'ATTEMPTS_EXHAUSTED');
    } finally {clearTimeout(timer);}
    const delay=delayFor({attempt,remaining:deadline-performance.now(),retryAfterMs:nextDelay,random});
    try {await pause(delay,undefined,{signal});}
    catch(error){signal?.throwIfAborted();throw error;}
  }
}
