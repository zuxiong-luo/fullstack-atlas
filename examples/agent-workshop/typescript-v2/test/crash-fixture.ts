import {Store} from '../src/store.js';import {Service} from '../src/service.js';
const path=process.argv[2],mode=process.argv[3],store=new Store(path,()=>Date.now()+(mode==='resume'?15000:0));
const service=new Service({store,afterRetrieved:mode==='crash'?()=>process.exit(27):undefined,retriever:mode==='resume'?{search:async()=>{throw new Error('retrieval must not run after checkpoint')}}:undefined});
try{const result=await service.run('alice','crash-run',mode==='crash'?'lease worker recovery':undefined);console.log(JSON.stringify(result))}finally{store.close()}
