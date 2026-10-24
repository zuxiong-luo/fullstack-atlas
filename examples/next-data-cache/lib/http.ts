import 'server-only';
import { randomUUID,timingSafeEqual,createHash } from 'node:crypto';
export class Failure extends Error{constructor(public status:number,public code:string){super(code);}}
export function requireAdmin(request:Request){
 const expected=process.env.CACHE_ADMIN_TOKEN;
 if(!expected||expected.length<32)throw new Error('set CACHE_ADMIN_TOKEN');
 const supplied=request.headers.get('authorization')??'';
 const hash=(x:string)=>createHash('sha256').update(x).digest();
 if(!timingSafeEqual(hash(supplied),hash('Bearer '+expected)))throw new Failure(401,'AUTH_REQUIRED');
}
export async function jsonInput(request:Request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))throw new Failure(415,'JSON_REQUIRED');
 const reader=request.body?.getReader();if(!reader)throw new Failure(400,'BODY_REQUIRED');
 let bytes=0;const chunks:Uint8Array[]=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();throw new Failure(413,'BODY_TOO_LARGE');}chunks.push(value);}}
 finally{reader.releaseLock();}
 let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Failure(400,'BAD_JSON');}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||typeof (value as {title?:unknown}).title!=='string')throw new Failure(422,'BAD_CATALOG');
 const title=(value as {title:string}).title.trim();if(!title||title.length>80)throw new Failure(422,'BAD_CATALOG');return title;
}
export async function handle(work:()=>Promise<unknown>){
 try{return Response.json(await work(),{headers:{'Cache-Control':'no-store'}});}
 catch(error){if(error instanceof Failure)return Response.json({error:error.code},{status:error.status,headers:{'Cache-Control':'no-store'}});
 const requestId=randomUUID();console.error('catalog failed',{requestId,error});return Response.json({error:'UNAVAILABLE',requestId},{status:503,headers:{'Cache-Control':'no-store'}});}
}
