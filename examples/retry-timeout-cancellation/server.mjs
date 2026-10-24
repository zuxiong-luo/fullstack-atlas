import {createServer} from 'node:http';
import {once} from 'node:events';
export async function startServer() {
  const counts=new Map(),receipts=new Map();let effects=0,active=0;
  let notify;const started=new Promise(resolve=>{notify=resolve;});
  const sockets=new Set();
  const server=createServer((req,res)=>{
    const key=req.url;const count=(counts.get(key)??0)+1;counts.set(key,count);
    res.setHeader('connection','close');res.setHeader('content-type','application/json');
    if(key==='/slow') {
      active++;let complete=false;
      const finish=()=>{if(!complete){complete=true;active--;}};
      const timer=setTimeout(()=>{finish();res.end('{"ok":true}');},2000);
      res.once('close',()=>{clearTimeout(timer);finish();});notify();return;
    }
    if(key==='/flaky'&&count<3||key==='/always') {res.writeHead(503,{'retry-after':'0'});res.end('{"error":"BUSY"}');return;}
    if(key==='/too-late'){res.writeHead(429,{'retry-after':'10'});res.end('{}');return;}
    if(key==='/bad'){res.writeHead(400);res.end('{}');return;}
    if(key==='/large'){res.end('x'.repeat(5000));return;}
    if(key==='/safe'||key==='/unsafe') {
      const chunks=[];let bytes=0;
      req.on('data',x=>{bytes+=x.length;if(bytes>1024)req.destroy();else chunks.push(x);});
      req.on('end',()=>{
        const value=Buffer.concat(chunks).toString('utf8'),id=req.headers['idempotency-key'];
        if(key==='/safe'&&(!id||!/^[a-z0-9-]{8,80}$/.test(id))){res.writeHead(422);res.end('{}');return;}
        if(key==='/safe'&&receipts.has(id)) {
          const old=receipts.get(id);if(old.input!==value){res.writeHead(409);res.end('{}');return;}
          res.end(JSON.stringify(old.result));return;
        }
        effects++;const result={effect:effects};if(key==='/safe')receipts.set(id,{input:value,result});
        if(count===1){res.destroy();return;} // Commit happened; response was lost.
        res.end(JSON.stringify(result));
      });return;
    }
    res.end('{"ok":true}');
  });
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return {base:`http://127.0.0.1:${server.address().port}`,counts,started,
    get effects(){return effects;},get active(){return active;},
    async close(){for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));},
  };
}
