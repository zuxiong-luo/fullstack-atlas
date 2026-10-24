export class HttpError extends Error{constructor(status,code){super(code);this.status=status;}}
const key=/^[a-z][a-z0-9-]{0,31}$/;
export function validateWrite(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='body,version'||
    typeof value.body!=='string'||value.body.length>200||!Number.isSafeInteger(value.version)||value.version<1)throw new HttpError(422,'BAD_INPUT');
 return {body:value.body,version:value.version};
}
export async function inTenant(pool,user,tenant,action){
 if(!key.test(user)||!key.test(tenant))throw new HttpError(400,'BAD_ID');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  // Values come from a verified server-side session and a separately checked membership.
  await db.query("SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)",[user,tenant]);
  const {rows}=await db.query('SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2',[tenant,user]);
  if(rows.length!==1||!['viewer','editor','admin'].includes(rows[0].role))throw new HttpError(403,'TENANT_FORBIDDEN');
  const result=await action(db,rows[0].role);await db.query('COMMIT');return result;
 }catch(error){await db.query('ROLLBACK');throw error;}
 finally{db.release();}
}
export async function readDocument(pool,user,tenant,id){
 if(!key.test(id))throw new HttpError(400,'BAD_ID');
 return inTenant(pool,user,tenant,async(db,role)=>{
  const {rows}=await db.query(`SELECT id,tenant_id,owner_id,visibility,body,version FROM documents
    WHERE id=$1 AND tenant_id=$2 AND (owner_id=$3 OR visibility='shared' OR $4='admin')`,[id,tenant,user,role]);
  if(rows.length!==1)throw new HttpError(404,'DOCUMENT_NOT_FOUND');return rows[0];
 });
}
export async function listDocuments(pool,user,tenant){
 return inTenant(pool,user,tenant,async(db,role)=>(await db.query(`SELECT id,body,version FROM documents
  WHERE tenant_id=$1 AND (owner_id=$2 OR visibility='shared' OR $3='admin') ORDER BY id`,[tenant,user,role])).rows);
}
export async function updateDocument(pool,user,tenant,id,value){
 if(!key.test(id))throw new HttpError(400,'BAD_ID');const write=validateWrite(value);
 return inTenant(pool,user,tenant,async(db,role)=>{
  if(!['editor','admin'].includes(role))throw new HttpError(403,'WRITE_FORBIDDEN');
  const {rows}=await db.query(`UPDATE documents SET body=$1,version=version+1
   WHERE id=$2 AND tenant_id=$3 AND version=$4 AND (owner_id=$5 OR $6='admin')
   RETURNING id,body,version`,[write.body,id,tenant,write.version,user,role]);
  if(rows.length===1)return rows[0];
  // Only disclose a conflict to someone who is still authorized to write this exact resource.
  const visible=await db.query(`SELECT 1 FROM documents WHERE id=$1 AND tenant_id=$2 AND (owner_id=$3 OR $4='admin')`,[id,tenant,user,role]);
  if(!visible.rowCount)throw new HttpError(404,'DOCUMENT_NOT_FOUND');throw new HttpError(409,'VERSION_CONFLICT');
 });
}
