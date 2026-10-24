import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,rm,readFile,readdir,lstat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const base='http://127.0.0.1:4336';let deployment,child,logs='';
const privateA='runtime-secret-a-never-public',privateB='runtime-secret-b-never-public';
async function stop(){if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(4000)]);if(child.exitCode===null){child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));}}}
async function start(overrides={}){
 logs='';child=spawn(process.execPath,['boot.mjs'],{cwd:deployment,env:{...process.env,DEMO_API_TOKEN:privateA,DEMO_REGION:'local-a',NEXT_PUBLIC_SITE_TITLE:'Runtime-B',...overrides},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>{logs+=d;});child.stderr.on('data',d=>{logs+=d;});child.on('error',e=>{logs+=e.stack;});
 for(let i=0;i<200;i++){if(child.exitCode!==null)throw new Error('boot failed: '+logs);try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await pause(50);}
 throw new Error('standalone not ready: '+logs);
}
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())out.push(...await files(path));else out.push(path);}return out;}
before(async()=>{deployment=await mkdtemp(join(tmpdir(),'atlas-standalone-'));await cp('release',deployment,{recursive:true});await start();});
after(async()=>{await stop();if(deployment)await rm(deployment,{recursive:true,force:true});});
test('traced output is self-contained and includes explicit runtime asset',async()=>{
 const manifest=JSON.parse(await readFile('.next/server/app/api/report/route.js.nft.json','utf8'));
 assert(manifest.files.some(name=>name.endsWith('assets/build-info.json')));
 assert.equal(JSON.parse(await readFile(join(deployment,'assets/build-info.json'),'utf8')).service,'atlas-production');
 for(const path of await files(deployment))if((await lstat(path)).isSymbolicLink()){const {realpath}=await import('node:fs/promises');const target=await realpath(path);assert(!relative(deployment,target).startsWith('..'),'external symlink '+path);}
});
test('same detached artifact serves HTML, Next static bundle and public asset',async()=>{
 const html=await(await fetch(base)).text();assert.match(html,/local-a/);assert.match(html,/Build-A/);assert.doesNotMatch(html,/Runtime-B/);
 const script=html.match(/src="([^\"]*\/_next\/static\/[^\"]+\.js)"/);assert(script);
 assert.equal((await fetch(base+script[1])).status,200);assert.equal(await(await fetch(base+'/health.txt')).text(),'standalone public asset\n');
});
test('private runtime token is absent from all browser JS',async()=>{
 for(const file of await files(join(deployment,'.next/static'))){if(!file.endsWith('.js'))continue;const source=await readFile(file,'utf8');assert(!source.includes(privateA));assert(!source.includes(privateB));assert(!source.includes('DEMO_API_TOKEN'));}
});
test('request ID and structured start/finish logs correlate without logging credentials',async()=>{
 const res=await fetch(base+'/api/report',{headers:{'x-request-id':'known_request_42',authorization:'Bearer do-not-log'}}),body=await res.json();
 for(let i=0;i<100&&!logs.includes('\"id\":\"known_request_42\",\"status\":200');i++)await pause(10);
 assert.equal(res.status,200);assert.equal(res.headers.get('x-request-id'),'known_request_42');assert.equal(body.id,'known_request_42');assert.equal(body.asset,'atlas-production');
 assert.match(logs,/"event":"request.start","id":"known_request_42"/);assert.match(logs,/"event":"request.finish","id":"known_request_42","status":200/);assert.doesNotMatch(logs,/do-not-log|runtime-secret/);
});
test('untrusted invalid request ID is replaced, internal failure is redacted',async()=>{
 const res=await fetch(base+'/api/report?fail=1',{headers:{'x-request-id':'bad id'}}),body=await res.json();assert.equal(res.status,500);assert.equal(body.error,'REPORT_UNAVAILABLE');assert.match(body.id,/^[a-f0-9-]{36}$/);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_INTERNAL_DETAIL|runtime-secret/);
});
test('missing traced asset is a real production failure, restored file recovers',async()=>{
 const file=join(deployment,'assets/build-info.json');await rename(file,file+'.hidden');try{assert.equal((await fetch(base+'/api/report')).status,500);}finally{await rename(file+'.hidden',file);}
 assert.equal((await fetch(base+'/api/report')).status,200);
});
test('one immutable build accepts different private runtime config without changing public build value',async()=>{
 await stop();await start({DEMO_API_TOKEN:privateB,DEMO_REGION:'local-b'});const html=await(await fetch(base)).text();assert.match(html,/local-b/);assert.match(html,/Build-A/);assert.doesNotMatch(html,/Runtime-B|runtime-secret/);
});
test('missing required startup config fails before accepting requests',async()=>{
 await stop();logs='';child=spawn(process.execPath,['boot.mjs'],{cwd:deployment,env:{...process.env,DEMO_API_TOKEN:'',DEMO_REGION:'local-b'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const code=await new Promise(resolve=>child.once('exit',resolve));assert.equal(code,1);assert.match(logs,/boot.rejected/);assert.match(logs,/CONFIG_DEMO_API_TOKEN/);await assert.rejects(fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)}));
});
