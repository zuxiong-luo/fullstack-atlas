import { pbkdf2 } from 'node:crypto';
import { readFile } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export async function poolProbe(){
 const start=performance.now(),order=[];
 const jobs=Array.from({length:2},(_,i)=>new Promise((resolve,reject)=>pbkdf2('fixture','salt',250000,32,'sha256',(error)=>{order.push('crypto:'+i);error?reject(error):resolve();})));
 const file=new Promise((resolve,reject)=>readFile(new URL('./package.json',import.meta.url),(error)=>{order.push('file');error?reject(error):resolve(performance.now()-start);}));
 const fileMs=await file;await Promise.all(jobs);return {poolSize:process.env.UV_THREADPOOL_SIZE,fileMs,totalMs:performance.now()-start,order};
}
if(process.argv.includes('--child'))console.log(JSON.stringify(await poolProbe()));
else if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 for(const size of ['1','4'])console.log(execFileSync(process.execPath,[import.meta.filename,'--child'],{env:{...process.env,UV_THREADPOOL_SIZE:size},encoding:'utf8',timeout:10000}).trim());
}
