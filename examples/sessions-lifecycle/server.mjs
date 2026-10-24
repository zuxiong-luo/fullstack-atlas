import { createServer } from 'node:https';
import { once } from 'node:events';
import { randomBytes,scrypt,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Sessions,readCookie,sessionCookie,clearCookie } from './sessions.mjs';
import { createTokens } from './jwt.mjs';
import { temporaryCertificates } from './certificates.mjs';
const derive=promisify(scrypt);
const credentials={alice:'classroom-only-42',bob:'classroom-only-43'};
const notes=new Map([['1',{owner:'alice',title:'Alice private note'}],['2',{owner:'bob',title:'Bob private note'}]]);
class HttpError extends Error { constructor(status,code){super(code);this.status=status;} }
async function input(req) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new HttpError(415,'JSON_REQUIRED');
  const text=await new Promise((resolve,reject)=>{
    let bytes=0;const chunks=[];
    const cleanup=()=>{clearTimeout(timer);req.off('data',data);req.off('end',end);req.off('error',fail);req.off('close',closed);};
    const fail=error=>{cleanup();reject(error);req.resume();};
    const data=chunk=>{bytes+=chunk.length;if(bytes>1024)fail(new HttpError(413,'BODY_LIMIT'));else chunks.push(chunk);};
    const end=()=>{cleanup();resolve(Buffer.concat(chunks).toString('utf8'));};
    const closed=()=>{if(!req.complete)fail(new HttpError(400,'INCOMPLETE_BODY'));};
    const timer=setTimeout(()=>fail(new HttpError(408,'BODY_TIMEOUT')),1500);
    req.on('data',data);req.once('end',end);req.once('error',fail);req.once('close',closed);
  });
  try {const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}
  catch {throw new HttpError(400,'BAD_JSON');}
}
function json(res,status,value,cookie) {
  if(res.destroyed||res.writableEnded)return;
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','connection':'close',...(cookie?{'set-cookie':cookie}:{})});
  res.end(JSON.stringify(value));
}
export async function startApp({now=Date.now,idleMs=60000,absoluteMs=300000}={}) {
  const certificates=await temporaryCertificates();
  const sessions=new Sessions({now,idleMs,absoluteMs});
  const tokens=createTokens({now});
  const users=new Map();
  for(const [user,password] of Object.entries(credentials)) {
    const salt=randomBytes(16);users.set(user,{salt,hash:await derive(password,salt,32)});
  }
  const dummy=users.get('alice');
  async function login(value) {
    if(Object.keys(value).sort().join(',')!=='password,user'||typeof value.user!=='string'||typeof value.password!=='string'||value.user.length>40||value.password.length>100)throw new HttpError(422,'BAD_CREDENTIAL_INPUT');
    const stored=users.get(value.user)??dummy;
    const hash=await derive(value.password,stored.salt,32);
    if(!timingSafeEqual(hash,stored.hash)||!users.has(value.user))throw new HttpError(401,'BAD_CREDENTIALS');
    return value.user;
  }
  const server=createServer({key:certificates.key,cert:certificates.cert,minVersion:'TLSv1.3'},(req,res)=>{
    req.on('error',()=>{});
    void handle(req,res).catch(error=>json(res,error instanceof HttpError?error.status:500,{error:error instanceof HttpError?error.message:'INTERNAL'}));
  });
  server.headersTimeout=5000;server.requestTimeout=5000;
  let origin;
  function current(req) {
    const id=readCookie(req.headers.cookie),session=sessions.get(id,{touch:true});
    if(!session)throw new HttpError(401,'SESSION_REQUIRED');
    return {id,session};
  }
  function csrf(req,session) {
    if(!sessions.matchesCsrf(session,req.headers['x-csrf-token']))throw new HttpError(403,'CSRF_REQUIRED');
  }
  function bearer(req) {
    const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization??'');
    try { if(!match)throw 0;return {token:match[1],claims:tokens.verify(match[1])}; }
    catch { throw new HttpError(401,'JWT_REQUIRED'); }
  }
  async function handle(req,res) {
    if(req.method==='POST'&&req.headers.origin!==origin)throw new HttpError(403,'ORIGIN_REQUIRED');
    if(req.method==='POST'&&(req.url==='/login'||req.url==='/jwt/login')) {
      const user=await login(await input(req));
      if(res.destroyed)return;
      if(req.url==='/jwt/login'){json(res,200,{accessToken:tokens.issue(user),expiresIn:30});return;}
      sessions.remove(readCookie(req.headers.cookie));
      const fresh=sessions.create(user);
      json(res,200,{user,csrfToken:fresh.csrf},sessionCookie(fresh,now()));return;
    }
    if(req.method==='GET'&&req.url==='/me') {
      const {session}=current(req);json(res,200,{user:session.user,csrfToken:session.csrf});return;
    }
    if(req.method==='POST'&&req.url==='/refresh') {
      const {id,session}=current(req);csrf(req,session);
      const fresh=sessions.rotate(id);
      json(res,200,{user:fresh.user,csrfToken:fresh.csrf},sessionCookie(fresh,now()));return;
    }
    if(req.method==='POST'&&req.url==='/logout') {
      const {id,session}=current(req);csrf(req,session);sessions.remove(id);
      json(res,200,{loggedOut:true},clearCookie);return;
    }
    if(req.method==='GET'&&/^\/notes\/[12]$/.test(req.url)) {
      const {session}=current(req),note=notes.get(req.url.slice(-1));
      if(note.owner!==session.user)throw new HttpError(404,'NOTE_NOT_FOUND');
      json(res,200,{title:note.title});return;
    }
    if(req.method==='GET'&&req.url==='/jwt/me') {json(res,200,{user:bearer(req).claims.sub});return;}
    if(req.method==='POST'&&req.url==='/jwt/logout') {tokens.revoke(bearer(req).token);json(res,200,{loggedOut:true});return;}
    throw new HttpError(404,'NOT_FOUND');
  }
  try { server.listen(0,'127.0.0.1');await once(server,'listening');origin=`https://localhost:${server.address().port}`; }
  catch(error) {await certificates.dispose();throw error;}
  return {
    port:server.address().port,origin,ca:certificates.ca,
    async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await certificates.dispose();},
  };
}
