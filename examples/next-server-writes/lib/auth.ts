import 'server-only';
import { cookies,headers } from 'next/headers';
import { createHmac,createHash,timingSafeEqual } from 'node:crypto';
import { Failure } from './errors';
export type User='alice'|'bob';
function secret(){const value=process.env.DEMO_SESSION_SECRET;if(!value||value.length<32)throw new Error('set a 32+ character secret');return value;}
function signature(value:string){return createHmac('sha256',secret()).update(value).digest('hex');}
export function issueSession(user:User){const value=user+'.'+(Date.now()+3600000);return value+'.'+signature(value);}
export async function requireUser():Promise<User>{
 const token=(await cookies()).get('atlas-session')?.value??'';
 const [user,expires,sig,...extra]=token.split('.');
 if(extra.length||(user!=='alice'&&user!=='bob')||!/^\d+$/.test(expires??'')||!/^[a-f0-9]{64}$/.test(sig??''))throw new Failure(401,'AUTH_REQUIRED');
 if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(user+'.'+expires),'hex'))||Number(expires)<=Date.now())throw new Failure(401,'AUTH_REQUIRED');
 return user;
}
export async function requireSameOrigin(){
 const expected=process.env.DEMO_APP_ORIGIN;if(!expected)throw new Error('set DEMO_APP_ORIGIN');
 if((await headers()).get('origin')!==expected)throw new Failure(403,'CROSS_SITE');
}
export function checkPassword(user:unknown,password:unknown):User{
 if((user!=='alice'&&user!=='bob')||typeof password!=='string')throw new Failure(401,'BAD_CREDENTIALS');
 const expected=process.env[user==='alice'?'DEMO_ALICE_PASSWORD':'DEMO_BOB_PASSWORD'];
 if(!expected||expected.length<12)throw new Error('set demo passwords');
 const hash=(x:string)=>createHash('sha256').update(x).digest();
 if(!timingSafeEqual(hash(password),hash(expected)))throw new Failure(401,'BAD_CREDENTIALS');
 return user;
}
