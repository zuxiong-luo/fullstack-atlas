import {NextResponse} from 'next/server';
import {createSession,RequestFailure,requireSameOrigin} from '@/lib/auth';
import {handle,textInput} from '@/lib/http';
export async function POST(request:Request){
 let user:'alice'|'bob'|undefined;
 const result=await handle(async()=>{
  requireSameOrigin(request);const id=await textInput(request,'user');
  if(id!=='alice'&&id!=='bob')throw new RequestFailure(400,'未知演示账户');
  user=id;return {ok:true,token:createSession(id)};
 });
 if(!user||!result.ok)return result;
 const data=await result.json();
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set('demo-session',data.token,{
  httpOnly:true,sameSite:'lax',secure:process.env.DEMO_SECURE_COOKIE==='1',path:'/',maxAge:3600,
 });
 return response;
}
