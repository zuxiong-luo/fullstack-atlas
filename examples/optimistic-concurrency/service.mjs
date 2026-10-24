export class Conflict extends Error{constructor(code){super(code);this.code=code;}}
export async function saveDocument(db,{id,expectedVersion,body}){
 if(typeof id!=='string'||!Number.isSafeInteger(expectedVersion)||expectedVersion<1||typeof body!=='string'||body.length>200)throw new RangeError('invalid document update');
 const {rows}=await db.query('UPDATE documents SET body=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING id,body,version',[body,id,expectedVersion]);
 if(rows.length!==1)throw new Conflict('STALE_OR_MISSING');return rows[0];
}
const key=/^[a-z0-9-]{1,40}$/;
export async function reserve(db,{tenant,requestId,productId,quantity},hooks={}){
 if(typeof tenant!=='string'||typeof requestId!=='string'||typeof productId!=='string'||!key.test(tenant)||!key.test(requestId)||!key.test(productId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100)throw new RangeError('invalid reservation');
 const payload={productId,quantity};let committed=false;
 await db.query('BEGIN');
 try{
  const claimed=await db.query('INSERT INTO receipts(tenant_id,request_id,payload) VALUES($1,$2,$3) ON CONFLICT (tenant_id,request_id) DO NOTHING RETURNING request_id',[tenant,requestId,payload]);
  if(!claimed.rowCount){
   const receipt=await db.query('SELECT payload=$3::jsonb AS same,result FROM receipts WHERE tenant_id=$1 AND request_id=$2',[tenant,requestId,payload]);
   if(!receipt.rowCount||!receipt.rows[0].same)throw new Conflict('IDEMPOTENCY_CONFLICT');
   if(!receipt.rows[0].result)throw new Conflict('INCOMPLETE_RECEIPT');
   await db.query('COMMIT');committed=true;return {replayed:true,result:receipt.rows[0].result};
  }
  await hooks.afterClaim?.(); // Controlled fault/barrier for the teaching test, not a remote callback.
  const changed=await db.query('UPDATE inventory SET stock=stock-$1 WHERE tenant_id=$2 AND product_id=$3 AND stock>=$1 RETURNING stock',[quantity,tenant,productId]);
  if(!changed.rowCount)throw new Conflict('INSUFFICIENT_OR_MISSING');
  await hooks.afterEffect?.();
  const result={productId,quantity,remaining:changed.rows[0].stock};
  await db.query('UPDATE receipts SET result=$1 WHERE tenant_id=$2 AND request_id=$3',[result,tenant,requestId]);
  await db.query('COMMIT');committed=true;
  await hooks.afterCommit?.();
  return {replayed:false,result};
 }catch(error){if(!committed)await db.query('ROLLBACK');throw error;}
}
