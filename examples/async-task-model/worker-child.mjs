import pg from 'pg';import {randomUUID} from 'node:crypto';import {claim,execute} from './jobs.mjs';
const pool=new pg.Pool({...JSON.parse(process.env.ATLAS_DB_CONFIG),max:1}),db=await pool.connect(),workerId=randomUUID();
try{
 const job=await claim(db,workerId);
 if(!job)process.send?.({stage:'empty'});
 else{
  process.send?.({stage:'claimed',id:job.id,workerId});
  if(process.env.ATLAS_HOLD==='yes')await new Promise(resolve=>process.once('message',message=>{if(message==='finish')resolve();}));
  const status=await execute(db,job,workerId);process.send?.({stage:'finished',id:job.id,status});
 }
}finally{db.release();await pool.end();process.disconnect?.();}
