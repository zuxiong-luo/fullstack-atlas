import 'server-only';
import {randomUUID} from 'node:crypto';
import {Failure} from './errors';
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
export async function handle(work:()=>Promise<unknown>){
 try{return json(await work());}catch(error){
  if(error instanceof Failure)return json({error:error.code},error.status);
  const requestId=randomUUID();console.error('write unavailable',{requestId,error});return json({error:'UNAVAILABLE',requestId},503);
 }
}
