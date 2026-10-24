import {spawnServer} from './harness.mjs';import {runLoad} from './load.mjs';
const app=await spawnServer();try{for(const mode of ['sync','chunked'])console.log(JSON.stringify(await runLoad(app.base,{mode})));}finally{await app.close();}
