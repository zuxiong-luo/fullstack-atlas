async function within<T>(operation:Promise<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('离线服务启动超时')),15000)})])}
 finally{clearTimeout(timer)}
}
/** Read/clear an installed snapshot without requiring a script fetch. */
export async function offlineRegistration(container:Pick<ServiceWorkerContainer,'getRegistration'|'register'>,base:string,refresh:boolean):Promise<ServiceWorkerRegistration>{
 const scope=new URL('.',base);
 if(!refresh){const existing=await within(container.getRegistration(scope.href));if(existing?.scope===scope.href)return existing}
 return within(container.register(new URL('sw.js',base).href,{scope:scope.pathname,updateViaCache:'none'}));
}
/** DOWNLOAD explicitly refreshes the worker as well as the content snapshot. */
export async function offlineWorker(registration:ServiceWorkerRegistration,refresh:boolean):Promise<ServiceWorker>{
 if(refresh)await within(registration.update()); // Deadline stops this caller waiting; it cannot cancel a browser update.
 const worker=refresh
  ? registration.installing||registration.waiting||registration.active
  : registration.active||registration.installing||registration.waiting;
 if(!worker)throw new Error('离线服务启动失败');
 if(worker.state==='activated')return worker;
 await new Promise<void>((resolve,reject)=>{
  const finish=(error?:Error)=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);error?reject(error):resolve()};
  const changed=()=>{if(worker.state==='activated')finish();else if(worker.state==='redundant')finish(new Error('离线服务安装失败'))};
  const timer=setTimeout(()=>finish(new Error('离线服务启动超时')),15000);
  worker.addEventListener('statechange',changed);
  changed(); // The state may have changed before the listener was attached.
 });
 return worker;
}
