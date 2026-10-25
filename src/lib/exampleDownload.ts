/** Fetch through the page/Service Worker before handing bytes to a browser download. */
export async function exampleArchive(url:string,fetcher:typeof fetch=fetch):Promise<Blob>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error('下载准备超时，请检查网络后重试。'));controller.abort()},60000)});
 try{return await Promise.race([(async()=>{
  const response=await fetcher(url,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error(`示例下载失败（HTTP ${response.status}）`);
  const bytes=await response.arrayBuffer(),header=new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
  // This rejects a cached HTML shell, not a replacement for a ZIP/CRC integrity check.
  if(header.length!==4||header[0]!==0x50||header[1]!==0x4b||header[2]!==3||header[3]!==4)throw new Error('下载内容不是源码 ZIP，请联网更新离线包后重试。');
  return new Blob([bytes],{type:'application/zip'});
 })(),deadline])}finally{clearTimeout(timer);controller.abort()}
}
export function saveExampleArchive(blob:Blob,filename:string):void{
 const url=URL.createObjectURL(blob);let link:HTMLAnchorElement|undefined;
 try{link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click()}
 finally{link?.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
