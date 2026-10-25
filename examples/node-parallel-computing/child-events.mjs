// Await one IPC message, with explicit exit/error/deadline ownership.
export function firstMessage(child,{timeoutMs=3000}={}){
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);child.off('message',message);child.off('error',error);child.off('exit',exit);};
  const settle=(fn,value)=>{cleanup();fn(value);};
  const message=value=>settle(resolve,value),error=value=>settle(reject,value);
  const exit=(code,signal)=>settle(reject,new Error(`CHILD_EXIT_BEFORE_MESSAGE:${code}:${signal}`));
  const timer=setTimeout(()=>settle(reject,new Error('CHILD_MESSAGE_TIMEOUT')),timeoutMs);
  child.once('message',message);child.once('error',error);child.once('exit',exit);
  if(child.exitCode!==null||child.signalCode!==null)exit(child.exitCode,child.signalCode);
 });
}
export function childExit(child,{timeoutMs=3000,signal='SIGTERM'}={}){
 if(!child.pid||child.exitCode!==null||child.signalCode!==null)return Promise.resolve();
 return new Promise(resolve=>{
  const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
  child.once('exit',()=>{clearTimeout(timer);resolve();});
  if(signal)child.kill(signal);
 });
}
