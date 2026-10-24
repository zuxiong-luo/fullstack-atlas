export function validateJob(job){
 if(!job||typeof job!=='object'||!['count','throw','crash'].includes(job.kind))throw new RangeError('BAD_JOB');
 if(job.kind==='count'&&(!Number.isInteger(job.limit)||job.limit<2||job.limit>5000000))throw new RangeError('BAD_LIMIT');
 return {kind:job.kind,...(job.kind==='count'?{limit:job.limit}:{})};
}
export function countPrimes(limit){
 let count=0;for(let n=2;n<=limit;n++){let prime=true;for(let d=2;d*d<=n;d++)if(n%d===0){prime=false;break;}if(prime)count++;}return count;
}
