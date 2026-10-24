import { request } from 'node:https';
export function send(app,path,{method='GET',cookie,csrf,bearer,origin=app.origin,body}={}) {
  return new Promise((resolve,reject)=>{
    const text=body===undefined?'':JSON.stringify(body);
    const req=request({hostname:'127.0.0.1',port:app.port,servername:'localhost',ca:app.ca,agent:false,
      path,method,rejectUnauthorized:true,
      headers:{...(origin===null?{}:{origin}),'content-type':'application/json',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(bearer?{authorization:'Bearer '+bearer}:{}),...(body===undefined?{}:{'content-length':Buffer.byteLength(text)})},
    },res=>{
      let data='';res.setEncoding('utf8');res.on('data',chunk=>{data+=chunk;});res.once('error',reject);
      res.once('end',()=>resolve({status:res.statusCode,body:JSON.parse(data),cookie:res.headers['set-cookie']?.[0],cache:res.headers['cache-control']}));
    });
    req.setTimeout(4000,()=>req.destroy(new Error('TEST_TIMEOUT')));req.once('error',reject);req.end(text);
  });
}
export const cookiePair=response=>response.cookie.split(';')[0];
