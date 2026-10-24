import {createServer} from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
class HttpError extends Error{constructor(status,code){super(code);this.status=status;}}
export function corsHeaders(origin,allowedOrigin,credentials=false){
  const headers={'vary':'Origin'};
  if(origin===allowedOrigin){headers['access-control-allow-origin']=allowedOrigin;if(credentials)headers['access-control-allow-credentials']='true';}
  return headers;
}
export function securityHeaders(nonce,apiOrigin){return {
  'content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; connect-src ${apiOrigin}; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'`,
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','cache-control':'no-store',
};}
function json(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(value));}
async function input(req,onBodyChunk){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new HttpError(415,'JSON_REQUIRED');
  let bytes=0;const chunks=[];
  const timer=setTimeout(()=>req.destroy(new Error('body timeout')),1500);
  try{for await(const chunk of req){bytes+=chunk.length;if(bytes>1024)throw new HttpError(413,'BODY_LIMIT');chunks.push(Buffer.from(chunk));onBodyChunk?.(chunk.length);}}
  finally{clearTimeout(timer);}
  try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}
  catch{throw new HttpError(400,'BAD_JSON');}
}
async function listen(server,port){server.listen(port,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;}
async function close(server){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
export async function startLab({apiPort=0,uiPort=0,onBodyChunk}={}){
  let apiOrigin,uiOrigin,sid;
  const metrics={simpleWrites:0,jsonWrites:0,deniedPreflights:0,deniedPosts:0};
  const client=await readFile(new URL('./browser.js',import.meta.url),'utf8');
  const api=createServer((req,res)=>{
    req.on('error',()=>{});
    void handle(req,res).catch(error=>{if(!res.destroyed&&!res.writableEnded)json(res,error instanceof HttpError?error.status:500,{error:error instanceof HttpError?error.message:'INTERNAL'},corsHeaders(req.headers.origin,uiOrigin,true));});
  });
  api.requestTimeout=3000;api.headersTimeout=3000;
  function authenticated(req){if(!sid||!req.headers.cookie?.split(';').map(s=>s.trim()).includes('sid='+sid))throw new HttpError(401,'SESSION_REQUIRED');}
  async function handle(req,res){
    const path=new URL(req.url,apiOrigin).pathname,origin=req.headers.origin,cors=corsHeaders(origin,uiOrigin,true);
    if(req.method==='OPTIONS'){
      if(path==='/json-denied'){metrics.deniedPreflights++;json(res,403,{error:'PREFLIGHT_DENIED'});return;}
      const headers=(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
      if(path!=='/json-write'||origin!==uiOrigin||req.headers['access-control-request-method']!=='POST'||headers.some(h=>!['content-type','x-lab'].includes(h))){json(res,403,{error:'PREFLIGHT_DENIED'});return;}
      res.writeHead(204,{...cors,'access-control-allow-methods':'POST','access-control-allow-headers':'Content-Type, X-Lab','vary':'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'});res.end();return;
    }
    if(req.method==='GET'&&path==='/session'){
      sid=randomBytes(24).toString('base64url');
      json(res,200,{teachingSession:true},{...cors,'set-cookie':[`sid=${sid}; HttpOnly; SameSite=Lax; Path=/`,`display=visible; SameSite=Lax; Path=/`]});return;
    }
    if(req.method==='GET'&&path==='/private'){authenticated(req);json(res,200,{value:'fictional private sample'},cors);return;}
    if(req.method==='GET'&&path==='/metrics'){json(res,200,metrics,cors);return;}
    if(req.method==='GET'&&path==='/no-cors'){json(res,200,{value:'public sample without CORS'});return;}
    if(req.method==='GET'&&path==='/wildcard'){json(res,200,{value:'public wildcard sample'},{'access-control-allow-origin':'*','access-control-allow-credentials':'true'});return;}
    // Deliberately unauthenticated, harmless in-memory counter: CORS cannot protect a write.
    if(req.method==='POST'&&path==='/simple-write'){metrics.simpleWrites++;json(res,200,{applied:true});return;}
    if(req.method==='POST'&&path==='/json-denied'){metrics.deniedPosts++;json(res,200,{applied:true});return;}
    if(req.method==='POST'&&path==='/json-write'){
      if(origin!==uiOrigin)throw new HttpError(403,'ORIGIN_REQUIRED');authenticated(req);
      if(req.headers['x-lab']!=='yes')throw new HttpError(403,'LAB_HEADER_REQUIRED');
      const body=await input(req,onBodyChunk);if(Object.keys(body).join(',')!=='message'||typeof body.message!=='string'||body.message.length>64)throw new HttpError(422,'BAD_INPUT');
      metrics.jsonWrites++;json(res,200,{applied:true},cors);return;
    }
    json(res,404,{error:'NOT_FOUND'},cors);
  }
  const ui=createServer((req,res)=>{
    const nonce=randomBytes(18).toString('base64'),headers=securityHeaders(nonce,apiOrigin);
    if(req.url==='/browser.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(client);return;}
    res.writeHead(200,{'content-type':'text/html; charset=utf-8',...headers});
    if(req.url==='/csp'){
      res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CSP执行探针</title><h1>有nonce的脚本执行，无nonce的脚本被拒绝</h1><pre id="output"></pre><script nonce="${nonce}">window.probe={allowed:true,blockedRan:false,violations:[]};function show(){document.getElementById('output').textContent=JSON.stringify(window.probe,null,2)}document.addEventListener('securitypolicyviolation',e=>{window.probe.violations.push({directive:e.effectiveDirective,blockedURI:e.blockedURI});show()});document.addEventListener('DOMContentLoaded',show);</script><script>window.probe.blockedRan=true;</script>`);return;
    }
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>浏览器策略实验</title><body data-api="${apiOrigin}"><h1>两个不同端口：跨源，但仍是同站</h1><p>只操作本机虚构数据。此HTTP夹具不验证Secure、TLS或跨站SameSite。</p><button id="run">依次执行浏览器策略探针</button><a href="/csp">查看CSP脚本探针</a><pre id="output"></pre><script nonce="${nonce}" src="/browser.js"></script>`);
  });
  try{apiOrigin=await listen(api,apiPort);uiOrigin=await listen(ui,uiPort);}
  catch(error){await Promise.all([close(api),close(ui)]);throw error;}
  return {apiOrigin,uiOrigin,metrics,async close(){await Promise.all([close(api),close(ui)]);}};
}
