import {Worker} from 'node:worker_threads';
import {fork} from 'node:child_process';
const file=new URL('./worker.mjs',import.meta.url);
export function endpoint(mode){
 const target=mode==='thread'?new Worker(file,{resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8,stackSizeMb:4}}):fork(file,[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc']});
 let exited=false,stopping;const done=new Promise(resolve=>target.once('exit',()=>{exited=true;resolve();}));
 return {onMessage:fn=>target.on('message',fn),onError:fn=>target.on('error',fn),onExit:fn=>target.once('exit',fn),
  send(value,transfers=[]){if(mode==='thread')target.postMessage(value,transfers);else target.send(value);},
  stop(){
   if(stopping)return stopping;
   stopping=(async()=>{if(exited)return;if(mode==='thread'){await target.terminate();return;}
    target.kill('SIGTERM');const timer=setTimeout(()=>{if(!exited)target.kill('SIGKILL');},1000);
    try{await done;}finally{clearTimeout(timer);}
   })();return stopping;
  },get pid(){return mode==='process'?target.pid:process.pid;},
 };
}
