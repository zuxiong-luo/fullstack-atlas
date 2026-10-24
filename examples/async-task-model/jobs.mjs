import {randomUUID} from 'node:crypto';
export class JobError extends Error{constructor(code){super(code);this.code=code;}}
export function validate(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).sort().join(',')!=='mode,text'||
    !['upper','fail'].includes(payload.mode)||typeof payload.text!=='string'||payload.text.length>80)throw new JobError('BAD_INPUT');
 return {mode:payload.mode,text:payload.text};
}
export async function accept(db,requestKey,payload,hooks={}){
 if(typeof requestKey!=='string'||!/^[a-z0-9-]{1,64}$/.test(requestKey))throw new JobError('BAD_KEY');
 const input=validate(payload);let committed=false;
 await db.query('BEGIN');
 try{
  // One bounded teaching queue; serialize admission/counting in this database.
  await db.query('SELECT pg_advisory_xact_lock(55448)');
  const existing=await db.query('SELECT id,payload=$2::jsonb AS same,status FROM jobs WHERE request_key=$1',[requestKey,input]);
  if(existing.rowCount){if(!existing.rows[0].same)throw new JobError('KEY_CONFLICT');await db.query('COMMIT');committed=true;return {id:existing.rows[0].id,status:existing.rows[0].status,replayed:true};}
  const active=(await db.query("SELECT count(*)::int n FROM jobs WHERE status IN('queued','running')")).rows[0].n;
  if(active>=8)throw new JobError('QUEUE_FULL');
  const id=randomUUID();
  await db.query("INSERT INTO jobs(id,request_key,payload,status) VALUES($1,$2,$3,'queued')",[id,requestKey,input]);
  await hooks.beforeCommit?.();await db.query('COMMIT');committed=true;
  await hooks.afterCommit?.();return {id,status:'queued',replayed:false};
 }catch(error){if(!committed)await db.query('ROLLBACK');throw error;}
}
export async function claim(db,workerId){
 await db.query('BEGIN');
 try{
  const {rows}=await db.query("SELECT id,payload FROM jobs WHERE status='queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1");
  if(!rows.length){await db.query('COMMIT');return null;}
  await db.query("UPDATE jobs SET status='running',worker_id=$1 WHERE id=$2",[workerId,rows[0].id]);
  await db.query('COMMIT');return rows[0];
 }catch(error){await db.query('ROLLBACK');throw error;}
}
export async function execute(db,job,workerId){
 let result=null,error=null;
 try{const input=validate(job.payload);if(input.mode==='fail')throw new Error('controlled processing failure');result=input.text.toUpperCase();}
 catch{error='PROCESSING_FAILED';}
 const status=error?'failed':'succeeded';
 const changed=await db.query("UPDATE jobs SET status=$1,result=$2,error_code=$3 WHERE id=$4 AND worker_id=$5 AND status='running' RETURNING id",[status,result,error,job.id,workerId]);
 if(changed.rowCount!==1)throw new JobError('OWNERSHIP_LOST');return status;
}
