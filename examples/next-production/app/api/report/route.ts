import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runtimeConfig} from '@/lib/config';
export const runtime='nodejs';
export async function GET(request:Request){
 const id=request.headers.get('x-request-id')??'missing',started=performance.now();
 console.log(JSON.stringify({event:'request.start',id,route:'/api/report',method:'GET'}));
 try{
  const {region}=runtimeConfig();
  const asset=JSON.parse(await readFile(join(process.cwd(),'assets','build-info.json'),'utf8'));
  if(new URL(request.url).searchParams.get('fail')==='1')throw new Error('PRIVATE_INTERNAL_DETAIL');
  const body={ok:true,id,region,asset:asset.service};
  console.log(JSON.stringify({event:'request.finish',id,status:200,durationMs:Number((performance.now()-started).toFixed(3))}));
  return Response.json(body,{headers:{'cache-control':'no-store','x-request-id':id}});
 }catch{
  console.error(JSON.stringify({event:'request.finish',id,status:500,code:'REPORT_UNAVAILABLE',durationMs:Number((performance.now()-started).toFixed(3))}));
  return Response.json({ok:false,id,error:'REPORT_UNAVAILABLE'},{status:500,headers:{'cache-control':'no-store','x-request-id':id}});
 }
}
