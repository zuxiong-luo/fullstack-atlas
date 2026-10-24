import {checkPassword,issueSession,requireSameOrigin} from '../../../lib/auth';
import {readJson} from '../../../lib/input';
import {handle} from '../../../lib/http';
import {Failure} from '../../../lib/errors';
export async function POST(request:Request){
 let token='';const result=await handle(async()=>{
  await requireSameOrigin();const input=await readJson(request);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['user','password'].includes(key)))throw new Failure(422,'BAD_LOGIN');
  const {user,password}=input as Record<string,unknown>;const owner=checkPassword(user,password);token=issueSession(owner);return {user:owner};
 });
 if(result.status===200){result.headers.set('Set-Cookie',`atlas-session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);}
 return result;
}
