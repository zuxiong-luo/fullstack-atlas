import inspector from 'node:inspector';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
function mixRecord(value){let sum=value;for(let i=0;i<2000;i++)sum=(Math.imul(sum^i,2654435761)>>>0);return sum;}
function rebuildIndex(deadline){let checksum=0;while(performance.now()<deadline)checksum^=mixRecord(checksum+1);return checksum;}
export async function profileCPU(output){
 const session=new inspector.Session();session.connect();
 const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,result)=>error?reject(error):resolve(result)));
 try{
  await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('Profiler.start');
  const start=performance.now();const checksum=rebuildIndex(start+250);const elapsedMs=performance.now()-start;
  const {profile}=await post('Profiler.stop');if(output)await writeFile(output,JSON.stringify(profile));
  const nodes=new Map(profile.nodes.map(node=>[node.id,node]));const parents=new Map();for(const node of profile.nodes)for(const child of node.children??[])parents.set(child,node.id);
  const counts=new Map();for(const sample of profile.samples??[])counts.set(sample,(counts.get(sample)??0)+1);
  const hot=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,samples])=>{
   const stack=[];for(let cursor=id;cursor!==undefined;cursor=parents.get(cursor))stack.unshift(nodes.get(cursor).callFrame.functionName||'(anonymous)');
   return {samples,stack};
  });return {node:process.version,windowMs:elapsedMs,intervalUs:1000,totalSamples:profile.samples?.length??0,checksum,hot};
 }finally{session.disconnect();}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)console.log(JSON.stringify(await profileCPU(process.argv[2])));
