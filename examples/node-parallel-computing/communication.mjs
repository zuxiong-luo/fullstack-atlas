import {endpoint} from './endpoint.mjs';
export async function inspectChannel(mode){
 const transport=endpoint(mode),buffer=new ArrayBuffer(8);new Uint8Array(buffer)[0]=42;
 try{
  const reply=new Promise((resolve,reject)=>{transport.onError(reject);transport.onMessage(resolve);});
  transport.send({type:'buffer',data:buffer},mode==='thread'?[buffer]:[]);
  const senderBytes=buffer.byteLength;return {senderBytes,received:await reply};
 }finally{await transport.stop();}
}
