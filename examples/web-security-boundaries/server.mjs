import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {APP_ORIGIN, Rejected, htmlText, authorizeWrite, fetchDocument} from './security.mjs';
const sessions=new Map(), docs=new Map([['a',{id:'a',owner:'alice',text:'Alice document'}],['b',{id:'b',owner:'bob',text:'Bob document'}]]);
const harmless='<img src="x" onerror="document.body.dataset.demo=\'executed\'">';
async function readJson(req) {
 let text='';for await (const chunk of req) {text+=chunk;if(Buffer.byteLength(text)>2048)throw new Rejected('body_too_large');}
 try{return JSON.parse(text);}catch{throw new Rejected('invalid_json');}
}
function json(res,status,data,headers={}) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
function session(req) {const sid=/(?:^|;\s*)lab_sid=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie??'')?.[1];return sessions.get(sid);}
// Transport is a deterministic local stub, and never sends an outbound network request.
async function localTransport(url, options) {
 if(options.redirect!=='error')throw new Error('redirect policy lost');
 return {status:200,body:(async function*(){yield Buffer.from('Local controlled document sample');})()};
}
http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,APP_ORIGIN);
  if(req.method==='GET' && url.pathname==='/demo-session') {
   const user=url.searchParams.get('user');if(!['alice','bob'].includes(user))throw new Rejected('unknown_demo_user');
   if(sessions.size>=1000)throw new Rejected('demo_capacity');
   const sid=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');sessions.set(sid,{user,csrf});
   json(res,200,{demo:true,user,csrf},{'Set-Cookie':`lab_sid=${sid}; HttpOnly; SameSite=Lax; Path=/`});
  } else if(req.method==='GET' && ['/safe-preview','/unsafe-preview'].includes(url.pathname)) {
   const text=url.searchParams.get('text')??harmless;if(text.length>1000)throw new Rejected('input_too_large');
   const safe=url.pathname==='/safe-preview';
   // Unsafe route is deliberately vulnerable, local-only and contains no real data.
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',...(safe?{'Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'"}:{})});
   res.end(`<html><body><h1>LOCAL ${safe?'SAFE':'UNSAFE'} PREVIEW</h1><p>${safe?htmlText(text):text}</p><p>Check body data-demo in devtools. Harmless marker only.</p></body></html>`);
  } else if(req.method==='POST' && url.pathname==='/write') {
   const body=await readJson(req);if(!body || typeof body!=='object' || typeof body.id!=='string' || typeof body.text!=='string' || body.text.length>1000)throw new Rejected('invalid_input');
   const target=docs.get(body.id);authorizeWrite({method:req.method,origin:req.headers.origin,csrf:req.headers['x-csrf-token']},session(req),target);
   target.text=body.text;json(res,200,{id:target.id,text:target.text});
  } else if(req.method==='POST' && url.pathname==='/import') {
   const body=await readJson(req);if(!body || typeof body!=='object')throw new Rejected('invalid_input');
   const target=docs.get(body.id);authorizeWrite({method:req.method,origin:req.headers.origin,csrf:req.headers['x-csrf-token']},session(req),target);
   const text=await fetchDocument(body.documentId,localTransport);target.text=text;json(res,200,{id:target.id,text});
  } else json(res,404,{demo:true,help:['GET /safe-preview','GET /unsafe-preview','GET /demo-session?user=alice','POST /write','POST /import']});
 } catch(error) {json(res,error instanceof Rejected?403:500,{error:error instanceof Rejected?error.code:'internal'});}
}).listen(4312,'127.0.0.1',()=>console.log('LOCAL SECURITY LAB ONLY: http://127.0.0.1:4312 ; no real auth or outbound fetch.'));
