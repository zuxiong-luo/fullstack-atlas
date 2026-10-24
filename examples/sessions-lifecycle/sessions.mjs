import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';
const random=()=>randomBytes(32).toString('base64url');
const digest=value=>createHash('sha256').update(value).digest('hex');
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export class Sessions {
  constructor({now=Date.now,idleMs=60000,absoluteMs=300000,maxSessions=1000}={}) {
    this.now=now;this.idleMs=idleMs;this.absoluteMs=absoluteMs;this.maxSessions=maxSessions;
    this.records=new Map();
  }
  prune() {
    const now=this.now();
    for(const [key,record] of this.records) {
      if(now>=record.idleUntil||now>=record.absoluteUntil)this.records.delete(key);
    }
  }
  create(user,{absoluteUntil=this.now()+this.absoluteMs}={}) {
    this.prune();
    if(this.records.size>=this.maxSessions)throw new Error('SESSION_CAPACITY');
    const id=random(),csrf=random(),now=this.now();
    const record={user,csrf,absoluteUntil,idleUntil:Math.min(now+this.idleMs,absoluteUntil)};
    this.records.set(digest(id),record);
    return {id,...record};
  }
  get(id,{touch=false}={}) {
    if(!validId(id))return null;
    const record=this.records.get(digest(id));
    if(!record)return null;
    if(this.now()>=record.idleUntil||this.now()>=record.absoluteUntil) {
      this.records.delete(digest(id));return null;
    }
    if(touch)record.idleUntil=Math.min(this.now()+this.idleMs,record.absoluteUntil);
    return record;
  }
  rotate(id) {
    const record=this.get(id);
    if(!record)return null;
    this.remove(id);
    return this.create(record.user,{absoluteUntil:record.absoluteUntil});
  }
  remove(id) { if(validId(id))this.records.delete(digest(id)); }
  matchesCsrf(record,token) {
    if(!validId(token))return false;
    return timingSafeEqual(Buffer.from(record.csrf),Buffer.from(token));
  }
}
export const cookieName='__Host-atlas_sid';
export function readCookie(header='') {
  const values=header.split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));
  return values.length===1?values[0].slice(cookieName.length+1):undefined;
}
export function sessionCookie(session,now) {
  const seconds=Math.max(0,Math.ceil((session.absoluteUntil-now)/1000));
  return `${cookieName}=${session.id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}
export const clearCookie=`${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
