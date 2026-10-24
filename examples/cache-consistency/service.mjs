import {randomUUID} from 'node:crypto';import {redis} from './redis.mjs';
const part=/^[a-z0-9-]{1,40}$/;
export function cacheKey(tenant,id){if(typeof tenant!=='string'||typeof id!=='string'||!part.test(tenant)||!part.test(id))throw new RangeError('bad identity');return `cache:{${tenant}:${id}}`;}
export async function databaseRead(db,tenant,id){
 const {rows}=await db.query('SELECT tenant_id,id,body,version FROM items WHERE tenant_id=$1 AND id=$2',[tenant,id]);
 if(rows.length!==1)throw new Error('NOT_FOUND');return rows[0];
}
export async function naiveRead(db,tenant,id,afterLoad=()=>{}){
 const key=cacheKey(tenant,id),old=await redis('HGET',key,'value');if(old)return JSON.parse(old);
 const item=await databaseRead(db,tenant,id);await afterLoad(item);
 await redis('HSET',key,'value',JSON.stringify(item));return item;
}
const prepareLua=`
 local generation=redis.call('HGET',KEYS[1],'generation')
 if not generation then
  generation=ARGV[1];redis.call('HDEL',KEYS[1],'value');redis.call('HSET',KEYS[1],'generation',generation);redis.call('EXPIRE',KEYS[1],60)
 end
 return {generation,redis.call('HGET',KEYS[1],'value') or false}
`;
const publishLua=`
 if redis.call('HGET',KEYS[1],'generation')~=ARGV[1] then return 0 end
 redis.call('HSET',KEYS[1],'value',ARGV[2]);redis.call('EXPIRE',KEYS[1],60);return 1
`;
export async function invalidate(tenant,id){
 return redis('EVAL',`redis.call('HSET',KEYS[1],'generation',ARGV[1]);redis.call('HDEL',KEYS[1],'value');redis.call('EXPIRE',KEYS[1],60);return ARGV[1]`,1,cacheKey(tenant,id),randomUUID());
}
function decode(text,tenant,id){
 try{const value=JSON.parse(text);if(value.tenant_id===tenant&&value.id===id&&typeof value.body==='string'&&Number.isSafeInteger(value.version)&&value.version>0)return value;}catch{}
 return null;
}
export async function readThrough(db,tenant,id,hooks={}){
 const key=cacheKey(tenant,id);
 for(let attempt=0;attempt<2;attempt++){
  let generation,cached;
  try{[generation,cached]=await redis('EVAL',prepareLua,1,key,randomUUID());}
  catch{return {source:'database',item:await databaseRead(db,tenant,id),stored:false};}
  const hit=cached&&decode(cached,tenant,id);if(hit)return {source:'cache',item:hit,stored:true};
  const item=await databaseRead(db,tenant,id);await hooks.afterLoad?.(item,attempt);
  try{if(await redis('EVAL',publishLua,1,key,generation,JSON.stringify(item)))return {source:'database',item,stored:true};}
  catch{return {source:'database',item,stored:false};}
 }
 return {source:'database',item:await databaseRead(db,tenant,id),stored:false};
}
export async function updateDatabase(db,tenant,id,body,hooks={}){
 cacheKey(tenant,id);if(typeof body!=='string'||body.length>200)throw new RangeError('bad body');
 await db.query('BEGIN');
 try{
  const {rows}=await db.query('UPDATE items SET body=$1,version=version+1 WHERE tenant_id=$2 AND id=$3 RETURNING version',[body,tenant,id]);
  if(!rows.length)throw new Error('NOT_FOUND');
  const event=await db.query('INSERT INTO invalidations(tenant_id,item_id,version) VALUES($1,$2,$3) RETURNING event_id',[tenant,id,rows[0].version]);
  await hooks.beforeCommit?.();await db.query('COMMIT');return event.rows[0].event_id;
 }catch(error){await db.query('ROLLBACK');throw error;}
}
export async function drain(db,hooks={}){
 const {rows}=await db.query('SELECT * FROM invalidations WHERE applied=false ORDER BY event_id');
 for(const event of rows){
  await invalidate(event.tenant_id,event.item_id);
  await hooks.afterInvalidate?.(event);
  await db.query('UPDATE invalidations SET applied=true WHERE event_id=$1',[event.event_id]);
 }
 return rows.length;
}
