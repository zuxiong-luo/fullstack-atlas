export function summarizeFrames(intervals:readonly number[]){
 if(!intervals.length||intervals.some(x=>!Number.isFinite(x)||x<=0))throw new RangeError('positive frame samples required');
 const sorted=[...intervals].sort((a,b)=>a-b),rank=(p:number)=>sorted[Math.ceil(sorted.length*p)-1];
 return {samples:sorted.length,p50Ms:rank(.5),p95Ms:rank(.95),maxMs:sorted.at(-1)!,over16_7Ms:sorted.filter(x=>x>16.7).length};
}
export function visibleRange(scrollTop:number,count=2000,height=320,rowHeight=32,overscan=3){
 if(!Number.isFinite(scrollTop)||scrollTop<0||!Number.isSafeInteger(count)||count<1||!Number.isFinite(height)||height<=0||!Number.isFinite(rowHeight)||rowHeight<=0||!Number.isSafeInteger(overscan)||overscan<0)throw new RangeError('bounded list parameters required');
 const first=Math.min(count-1,Math.floor(scrollTop/rowHeight)),start=Math.max(0,first-overscan),end=Math.min(count,Math.ceil((scrollTop+height)/rowHeight)+overscan);
 return {start,end,before:start*rowHeight,after:(count-end)*rowHeight};
}
export function expectedBytes(size:number){
 if(!Number.isSafeInteger(size)||size<1||size>8*1024*1024)throw new RangeError('1..8MiB');
 return {size,first:7,last:19};
}

export function startupMark(value:unknown){
 return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
}
type WorkerEnvironment={createURL:(source:string)=>string;createWorker:(url:string)=>Worker;revokeURL:(url:string)=>void};
export async function withOwnedWorker<T>(source:string,run:(worker:Worker)=>Promise<T>,environment:WorkerEnvironment={
 createURL:source=>URL.createObjectURL(new Blob([source],{type:'text/javascript'})),
 createWorker:url=>new Worker(url),revokeURL:url=>URL.revokeObjectURL(url)
}){
 let url:string|undefined,worker:Worker|undefined;
 try{url=environment.createURL(source);worker=environment.createWorker(url);return await run(worker);}
 finally{try{worker?.terminate();}finally{if(url!==undefined)environment.revokeURL(url);}}
}
