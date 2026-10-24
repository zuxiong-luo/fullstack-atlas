import {fork} from 'node:child_process';
export async function until(predicate,label){const deadline=Date.now()+7000;while(Date.now()<deadline){const value=await predicate();if(value)return value;await new Promise(r=>setTimeout(r,10));}throw new Error('not observed: '+label);}
export function child(file,config,extra={}){
 const process=fork(new URL(file,import.meta.url),[],{env:{...globalThis.process.env,ATLAS_DB_CONFIG:JSON.stringify(config),...extra},silent:true});
 const messages=[];let exited=false,error='',failure,exitStatus;
 process.on('message',message=>messages.push(message));process.stderr.on('data',chunk=>error+=chunk);process.stdout.resume();
 process.once('exit',(code,signal)=>{exited=true;exitStatus={code,signal};});process.once('error',x=>failure=x);
 return {process,messages,
  wait(stage){return until(()=>{const found=messages.find(x=>x.stage===stage);if(found)return found;if(failure)throw failure;if(exited)throw new Error('child exited before '+stage+': '+error);},stage);},
  async join(){await until(()=>exited,'normal child exit');if(exitStatus.code!==0)throw new Error('worker failed: '+JSON.stringify(exitStatus)+' '+error);},
  async stop(signal='SIGTERM'){if(!exited)process.kill(signal);await until(()=>exited,'owned child exit');},
 };
}
