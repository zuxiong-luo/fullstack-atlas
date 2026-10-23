import http from 'node:http';
export function createApp({ready=true}={}){
 return http.createServer((req,res)=>{
  if(req.url==='/ready'){res.writeHead(ready?200:503);res.end(ready?'ready':'not ready');return;}
  if(req.url==='/health'){res.end('alive');return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'atlas-debug',path:req.url}));
 });
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 const server=createApp({ready:process.env.READY!=='false'});
 server.listen(Number(process.env.PORT||8080),'0.0.0.0');
 process.on('SIGTERM',()=>server.close());
}
