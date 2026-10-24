import {setImmediate as yieldTurn} from 'node:timers/promises';
export function validateIterations(n){if(!Number.isInteger(n)||n<1||n>2000000)throw new RangeError('ITERATION_LIMIT');return n;}
function block(value,start,end){for(let i=start;i<end;i++)value=(Math.imul(value^i,1664525)+1013904223)>>>0;return value;}
export function syncWork(n){validateIterations(n);return block(0,0,n);}
export async function chunkedWork(n,signal){
 validateIterations(n);let value=0;
 for(let start=0;start<n;start+=4096){signal?.throwIfAborted();value=block(value,start,Math.min(n,start+4096));if(start+4096<n)await yieldTurn();}
 return value;
}
