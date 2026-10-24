import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';
const server=createServer(async(req,res)=>{const path=req.url==='/'?'index.html':req.url==='/dist/app.js'?'dist/app.js':null;if(!path){res.writeHead(404);res.end();return;}try{const data=await readFile(new URL(path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(500);res.end('build first');}});
server.listen(4353,'127.0.0.1',()=>console.log('http://127.0.0.1:4353'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
