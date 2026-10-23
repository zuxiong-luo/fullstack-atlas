import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {Store} from '../src/store.js';import {Service} from '../src/service.js';
const temp=()=>mkdtempSync(join(tmpdir(),'atlas-v2-'));
test('two actual SQLite connections claim atomically, fence old epoch, persist restart',()=>{
 const dir=temp(),path=join(dir,'state.sqlite');let now=1000;const a=new Store(path,()=>now),b=new Store(path,()=>now);
 try{a.ensure('alice','r','cache');const first=a.claim('alice','r',100);assert.throws(()=>b.claim('alice','r',100),/RUN_BUSY/);
 a.retrieved(first,[{id:'cache-guide',title:'t',text:'x'}]);now=1200;const second=b.claim('alice','r',100);assert.equal(second.epoch,first.epoch+1);
 assert.throws(()=>a.complete(first,{answer:'stale',citations:[]}),/STALE_RUN/);b.complete(second,{answer:'fresh',citations:['cache-guide']});a.release(first);assert.equal(a.get('alice','r')?.answer,'fresh');
 assert.throws(()=>a.ensure('alice','r','changed'),/IDEMPOTENCY_CONFLICT/);a.ensure('alice','other','cache'); // Conflict rollback released the transaction lock.
 }finally{a.close();b.close()}
 const reopened=new Store(path);try{assert.equal(reopened.get('alice','r')?.status,'completed');assert.equal(reopened.get('alice','r')?.answer,'fresh')}finally{reopened.close();rmSync(dir,{recursive:true,force:true})}
});
test('actual subprocess exits after retrieved then a second process resumes persisted evidence',()=>{
 const dir=temp(),path=join(dir,'crash.sqlite');
 try{const run=(mode:string)=>spawnSync(process.execPath,['--experimental-sqlite','--import','tsx','test/crash-fixture.ts',path,mode],{encoding:'utf8',cwd:process.cwd()});
 const crash=run('crash');assert.equal(crash.status,27,crash.stderr);const inspect=new Store(path);assert.equal(inspect.get('alice','crash-run')?.checkpoint,'retrieved');inspect.close();
 const resumed=run('resume');assert.equal(resumed.status,0,resumed.stderr);const result=JSON.parse(resumed.stdout.trim());assert.equal(result.status,'completed');assert.equal(result.checkpoint,'done');assert.deepEqual(result.citations,['lease-guide']);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('failed model preserves retrieved checkpoint; retry/replay never repeats retrieval and successful replay has no model call',async()=>{
 const store=new Store();let retrievals=0,calls=0;let fail=true;
 const service=new Service({store,retriever:{search:async()=>{retrievals++;return[{id:'cache-guide',title:'t',text:'x'}]}},provider:async()=>{calls++;if(fail)throw new Error('controlled');return JSON.stringify({answer:'ok',citations:['cache-guide']})}});
 try{await assert.rejects(service.run('alice','r','cache'),/UPSTREAM_ERROR/);assert.equal(store.get('alice','r')?.checkpoint,'retrieved');fail=false;const answer=await service.run('alice','r');assert.equal(answer.status,'completed');await service.run('alice','r','cache');assert.equal(retrievals,1);assert.equal(calls,2)}finally{store.close()}
});
test('concurrent service attempts same key: one in-flight claim, one RUN_BUSY',async()=>{
 const store=new Store();let release!:(value:string)=>void,entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),work=new Promise<string>(resolve=>release=resolve);
 const service=new Service({store,provider:async()=>{entered();return work}});
 try{const first=service.run('alice','r','cache');await started;await assert.rejects(service.run('alice','r','cache'),/RUN_BUSY/);release(JSON.stringify({answer:'ok',citations:['cache-guide']}));assert.equal((await first).status,'completed')}finally{release('{}');store.close()}
});
