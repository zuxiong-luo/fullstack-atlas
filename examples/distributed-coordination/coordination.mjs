import {redis} from './redis.mjs';
function key(value){if(typeof value!=='string'||!(/^[a-z0-9-]{1,48}$/).test(value))throw new TypeError('bounded resource key required');return value;}
function ttl(value){if(!Number.isSafeInteger(value)||value<30||value>10000)throw new RangeError('lease TTL 30..10000 ms required');return value;}
export async function acquire(db,resource,holder,ttlMs){
 key(resource);ttl(ttlMs);await db.query('BEGIN');
 try{
  await db.query("INSERT INTO leases VALUES ($1,NULL,0,'-infinity') ON CONFLICT DO NOTHING",[resource]);
  const {rows}=await db.query("UPDATE leases SET holder=$1,token=nextval('fencing_tokens'),expires_at=clock_timestamp()+($2::int*interval '1 millisecond') WHERE resource=$3 AND expires_at<=clock_timestamp() RETURNING resource,holder,token,expires_at",[holder,ttlMs,resource]);
  await db.query('COMMIT');return rows[0]??null;
 }catch(error){await db.query('ROLLBACK');throw error;}
}
export async function renew(db,lease,ttlMs){
 ttl(ttlMs);const {rowCount}=await db.query("UPDATE leases SET expires_at=clock_timestamp()+($1::int*interval '1 millisecond') WHERE resource=$2 AND holder=$3 AND token=$4 AND expires_at>clock_timestamp()",[ttlMs,lease.resource,lease.holder,lease.token]);return rowCount===1;
}
export async function release(db,lease){
 const {rowCount}=await db.query("UPDATE leases SET holder=NULL,expires_at='-infinity' WHERE resource=$1 AND holder=$2 AND token=$3",[lease.resource,lease.holder,lease.token]);return rowCount===1;
}
export async function fencedWrite(db,resource,token,value){
 key(resource);
 if(typeof token!=='string'||!(/^[1-9][0-9]{0,18}$/).test(token)||BigInt(token)>9223372036854775807n)throw new RangeError('positive PostgreSQL bigint token string required');
 if(typeof value!=='string'||value.length>64)throw new TypeError('bounded value required');
 const {rowCount}=await db.query('UPDATE fenced_resources SET value=$1,last_token=$2 WHERE id=$3 AND last_token<=$2::bigint',[value,token,resource]);return rowCount===1;
}

const quotaLua=`
local count=tonumber(redis.call('GET',KEYS[1]) or '0')
if count>=tonumber(ARGV[1]) then return {0,count,math.max(0,redis.call('PTTL',KEYS[1]))} end
if count==0 then redis.call('SET',KEYS[1],1,'PX',ARGV[2]);count=1
else count=redis.call('INCR',KEYS[1]) end
return {1,count,redis.call('PTTL',KEYS[1])}
`;
export async function takeQuota(subject,{limit=3,windowMs=10000}={}){
 key(subject);
 if(!Number.isSafeInteger(limit)||limit<1||limit>10||!Number.isSafeInteger(windowMs)||windowMs<50||windowMs>60000)throw new RangeError('bounded fixed window configuration required');
 const [allowed,count,remainingMs]=await redis('EVAL',quotaLua,1,'quota:{'+subject+'}',limit,windowMs);
 return {allowed:allowed===1,count,remainingMs};
}
