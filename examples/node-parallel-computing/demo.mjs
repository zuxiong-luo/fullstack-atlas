import {ComputePool} from './pool.mjs';
import {inspectChannel} from './communication.mjs';
for(const mode of ['thread','process']){
 const pool=new ComputePool({mode,size:2,queue:2});
 try{const jobs=[10,100,1000].map(limit=>pool.submit({kind:'count',limit}).result);console.log(JSON.stringify({mode,results:await Promise.all(jobs),snapshot:pool.snapshot(),channel:await inspectChannel(mode)}));}
 finally{await pool.close();}
}
