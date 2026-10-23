import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createHmac} from 'node:crypto';
let child,base,folder,file,alice,bob,logs='';
const secret='integration-only-secret-over-32-characters',wait=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,{cookie,body,raw,origin,method='GET',headers={}}={}){
 const response=await fetch(base+path,{method,redirect:'manual',headers:{...(cookie?{cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin??base}:{}),...headers},body:raw??(body?JSON.stringify(body):undefined)});
 return {response,body:await response.text()};
}
const post=(path,body,cookie,extra={})=>request(path,{body,cookie,method:'POST',...extra});
async function login(user){const {response}=await post('/api/session',{user});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);return cookie.split(';')[0];}
before(async()=>{
 await rm('.next/cache',{recursive:true,force:true});
 folder=await mkdtemp(join(tmpdir(),'next-boundary-'));file=join(folder,'state.json');
 const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});base='http://127.0.0.1:'+port;
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',DEMO_SESSION_SECRET:secret,DEMO_DATA_FILE:file,DEMO_APP_ORIGIN:base},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
 const deadline=Date.now()+45000;let ready=false;
 while(Date.now()<deadline){try{if((await fetch(base)).ok){ready=true;break;}}catch{}if(child.exitCode!==null)throw new Error(logs);await wait(150);}
 assert.equal(ready,true,'production server not ready: '+logs);alice=await login('alice');bob=await login('bob');
});
after(async()=>{if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),wait(4000)]);if(child.exitCode===null)child.kill('SIGKILL');}if(folder)await rm(folder,{recursive:true,force:true});});
test('first HTML contains account and client preview; secret DTO fields excluded',async()=>{
 const {response,body}=await request('/account',{cookie:alice});assert.equal(response.status,200);assert.match(body,/Alice的私人笔记/);assert.match(body,/保存自己的笔记/);assert.match(body,/_next\/static/);assert.doesNotMatch(body,/server-alice-token|server-bob-token|internalToken|integration-only-secret/);
});
test('RSC navigation response carries rendered data and client references',async()=>{
 let result=await request('/account',{cookie:bob,headers:{RSC:'1'}});
 // Next 16 的 RSC URL校验可能用307补齐匹配的_rsc参数；保留同源与会话。
 if(result.response.status===307){const location=result.response.headers.get('location');assert.ok(location);const target=new URL(location,base);assert.equal(target.origin,base);assert.equal(target.pathname,'/account');result=await request(target.pathname+target.search,{cookie:bob,headers:{RSC:'1'}});}
 const {response,body}=result;assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/x-component/);assert.match(body,/Bob的私人笔记/);assert.doesNotMatch(body,/Alice的私人笔记|server-bob-token/);
});
test('private reads reject missing, tampered and expired sessions; two users isolated',async()=>{
 assert.equal((await request('/api/account')).response.status,401);assert.equal((await request('/account')).response.status,307);assert.equal((await request('/api/account',{cookie:alice.replace('alice','bob')})).response.status,401);
 const value='alice.'+(Date.now()-1000),sig=createHmac('sha256',secret).update(value).digest('hex');assert.equal((await request('/api/account',{cookie:'demo-session='+value+'.'+sig})).response.status,401);
 const a=await request('/api/account',{cookie:alice}),b=await request('/api/account',{cookie:bob});assert.equal(JSON.parse(a.body).id,'alice');assert.equal(JSON.parse(b.body).id,'bob');assert.match(a.response.headers.get('cache-control'),/no-store/);
});
test('private writes derive owner from session and leave other user unchanged',async()=>{
 assert.equal((await post('/api/note',{note:'新笔记',userId:'bob'},alice)).response.status,400);assert.equal((await post('/api/note',{note:'Alice改过的笔记'},alice)).response.status,200);assert.equal(JSON.parse((await request('/api/account',{cookie:alice})).body).note,'Alice改过的笔记');assert.equal(JSON.parse((await request('/api/account',{cookie:bob})).body).note,'Bob的私人笔记');
});
test('public Data Cache reuses read; tagged immediate expiration exposes next revision',async()=>{
 const first=JSON.parse((await request('/api/catalog')).body),second=JSON.parse((await request('/api/catalog')).body);assert.equal(first.readId,second.readId);assert.equal((await post('/api/catalog',{title:'Bob篡改'},bob)).response.status,403);assert.equal((await post('/api/catalog',{title:'公开课程目录v2'},alice)).response.status,200);
 const fresh=JSON.parse((await request('/api/catalog')).body);assert.equal(fresh.title,'公开课程目录v2');assert.equal(fresh.revision,first.revision+1);assert.notEqual(fresh.readId,first.readId);const html=(await request('/account',{cookie:bob})).body;assert.match(html,/公开课程目录v2/);assert.match(html,/Bob的私人笔记/);
});
test('cross-site and malformed requests return controlled status codes',async()=>{
 assert.equal((await post('/api/note',{note:'x'},alice,{origin:'https://invalid.example'})).response.status,403);assert.equal((await post('/api/note',undefined,alice,{raw:'{'})).response.status,400);assert.equal((await post('/api/note',{note:''},alice)).response.status,400);assert.equal((await post('/api/note',{note:'x'.repeat(2100)},alice)).response.status,413);assert.equal((await post('/api/note',{note:'x'},alice,{headers:{'Content-Type':'text/plain'}})).response.status,415);
});
test('backend corruption becomes safe 503; recovery returns correct response',async()=>{
 const good=await readFile(file,'utf8');await writeFile(file,'{broken');try{const broken=await request('/api/account',{cookie:alice});assert.equal(broken.response.status,503);const data=JSON.parse(broken.body);assert.ok(data.requestId);assert.doesNotMatch(broken.body,/JSON|stack|SyntaxError|state.json/);}finally{await writeFile(file,good);}assert.equal((await request('/api/account',{cookie:alice})).response.status,200);
});
test('client chunks exclude server-only implementation and secrets',async()=>{
 async function files(path){let result=[];for(const entry of await readdir(path,{withFileTypes:true})){const name=join(path,entry.name);if(entry.isDirectory())result.push(...await files(name));else if(name.endsWith('.js'))result.push(name);}return result;}
 const names=await files('.next/static');assert.ok(names.length);for(const name of names)assert.doesNotMatch(await readFile(name,'utf8'),/server-alice-token|server-bob-token|DEMO_SESSION_SECRET|atlasDemoWrites/,name);
});
