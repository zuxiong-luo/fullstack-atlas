import 'server-only';
import {Failure} from './errors';
export function parseNote(value:unknown):{title:string;key:string}{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['title','key'].includes(key)))throw new Failure(422,'BAD_NOTE');
 const {title,key}=value as Record<string,unknown>;
 if(typeof title!=='string'||!title.trim()||title.length>80||typeof key!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(key))throw new Failure(422,'BAD_NOTE');
 return {title:title.trim(),key};
}
export async function readJson(request:Request):Promise<unknown>{
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))throw new Failure(415,'JSON_REQUIRED');
 const reader=request.body?.getReader();if(!reader)throw new Failure(400,'BODY_REQUIRED');
 let bytes=0;const chunks:Uint8Array[]=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();throw new Failure(413,'BODY_TOO_LARGE');}chunks.push(value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Failure(400,'BAD_JSON');}
}
