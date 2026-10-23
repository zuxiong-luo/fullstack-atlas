import 'server-only';
import {randomUUID} from 'node:crypto';
import {RequestFailure} from './auth';
export async function textInput(request:Request,key:string){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new RequestFailure(415,'需要 JSON');
 const raw=await request.text();if(raw.length>2048)throw new RequestFailure(413,'请求过大');
 let body:unknown;try{body=JSON.parse(raw);}catch{throw new RequestFailure(400,'JSON 格式错误');}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!==key))throw new RequestFailure(400,'字段不符合接口约定');
 const value=(body as Record<string,unknown>)[key];
 if(typeof value!=='string'||value.trim().length<1||value.trim().length>80)throw new RequestFailure(400,'请输入 1～80 字符');
 return value.trim();
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
export async function handle(work:()=>Promise<unknown>){
 try{return json(await work());}catch(error){
  if(error instanceof RequestFailure)return json({error:error.message},error.status);
  const requestId=randomUUID();console.error('[next-boundary-error]',{requestId,error});
  return json({error:'服务暂时不可用',requestId},503);
 }
}
