import {request} from 'node:http';
export function splitRequest(url,{method,headers,body,cut,firstObserved}){
 return new Promise((resolve,reject)=>{
  const req=request(url,{method,headers:{...headers,'Content-Length':String(body.length)}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.once('error',reject);
   res.once('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString('utf8')}));
  });
  req.once('error',reject);req.setTimeout(2500,()=>req.destroy(new Error('split HTTP timeout')));
  req.write(body.subarray(0,cut));
  Promise.resolve(firstObserved).then(()=>req.end(body.subarray(cut)),error=>req.destroy(error));
 });
}
