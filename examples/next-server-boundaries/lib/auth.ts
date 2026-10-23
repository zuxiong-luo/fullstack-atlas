import 'server-only';
import {cookies} from 'next/headers';
import {createHmac,timingSafeEqual} from 'node:crypto';
import type {UserId} from './store';
export class RequestFailure extends Error{constructor(public status:number,message:string){super(message);}}
function sign(value:string){
 const secret=process.env.DEMO_SESSION_SECRET;
 if(!secret||secret.length<32)throw new Error('Set DEMO_SESSION_SECRET to at least 32 characters');
 return createHmac('sha256',secret).update(value).digest('hex');
}
export function createSession(id:UserId){const value=id+'.'+(Date.now()+3600000);return value+'.'+sign(value);}
export async function requireUser():Promise<UserId>{
 const token=(await cookies()).get('demo-session')?.value||'';
 const [id,expires,signature,...extra]=token.split('.');
 if(extra.length||(id!=='alice'&&id!=='bob')||!/^\d+$/.test(expires||'')||!signature||!/^[a-f0-9]{64}$/.test(signature))throw new RequestFailure(401,'请先选择演示账户');
 const expected=Buffer.from(sign(id+'.'+expires),'hex'),actual=Buffer.from(signature,'hex');
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected)||Number(expires)<=Date.now())throw new RequestFailure(401,'会话无效或已过期');
 return id;
}
export function requireSameOrigin(request:Request){
 const expected=process.env.DEMO_APP_ORIGIN||'http://127.0.0.1:4319';
 if(request.headers.get('origin')!==expected)throw new RequestFailure(403,'拒绝跨站写入');
}
