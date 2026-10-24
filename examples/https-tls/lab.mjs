import { createServer, request } from 'node:https';
import { once } from 'node:events';
import { checkServerIdentity } from 'node:tls';
import { temporaryCertificates } from './certificates.mjs';
export async function startLab(options={}) {
  const certificates=await temporaryCertificates(options);
  const server=createServer({
    key:certificates.key,cert:certificates.cert,
    minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ecdhCurve:'X25519',
  },(req,res)=>{
    res.writeHead(200,{'content-type':'application/json','connection':'close'});
    res.end(JSON.stringify({ok:true,protocol:req.socket.getProtocol()}));
  });
  server.on('tlsClientError',()=>{}); // Expected negative-handshake tests are observed by clients.
  try { server.listen(0,'127.0.0.1');await once(server,'listening'); }
  catch(error) { await certificates.dispose();throw error; }
  const port=server.address().port;
  return {
    port,ca:certificates.ca,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      await certificates.dispose();
    },
  };
}
export function get({port,ca,servername='localhost',maxVersion='TLSv1.3'}) {
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path:'/',method:'GET',
      servername,ca,agent:false,minVersion:maxVersion==='TLSv1.2'?'TLSv1.2':'TLSv1.3',maxVersion,
      rejectUnauthorized:true,checkServerIdentity,
    },res=>{
      const socket=res.socket;
      const certificate=socket.getPeerCertificate();
      const details={authorized:socket.authorized,protocol:socket.getProtocol(),
        cipher:socket.getCipher().standardName,ephemeral:socket.getEphemeralKeyInfo(),san:certificate.subjectaltname};
      let body='';res.setEncoding('utf8');
      res.on('data',chunk=>{body+=chunk;});
      res.once('error',reject);
      res.once('end',()=>resolve({...details,status:res.statusCode,body:JSON.parse(body)}));
    });
    req.setTimeout(3000,()=>req.destroy(new Error('CLIENT_TIMEOUT')));
    req.once('error',reject);req.end();
  });
}
