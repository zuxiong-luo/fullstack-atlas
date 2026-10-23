import {mkdirSync} from 'node:fs';import {dirname} from 'node:path';
import {buildApp} from './app.js';import {Store} from './store.js';import {providerFromEnv} from './providers.js';
const chapter=Number(process.env.CHAPTER??8),port=Number(process.env.PORT??4340),path=process.env.DATABASE_PATH??'data/workshop.sqlite';
mkdirSync(dirname(path),{recursive:true});
const {app}=buildApp({chapter,store:new Store(path),provider:providerFromEnv(),timeoutMs:Number(process.env.MODEL_TIMEOUT_MS??3000),maxConcurrent:Number(process.env.MAX_CONCURRENT??2),maxContextChars:Number(process.env.MAX_CONTEXT_CHARS??12000),maxModelCalls:Number(process.env.MAX_MODEL_CALLS??1)});
await app.listen({host:'127.0.0.1',port});
console.error(JSON.stringify({event:'listening',chapter,host:'127.0.0.1',port}));
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0))});
