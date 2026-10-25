import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession, noteId, observeAppState, createCapabilitySession, ownedDirectoryName, withOwnedDirectory} from './lib/session.mjs';
const deferred = () => {let resolve, reject;const promise = new Promise((a,b) => {resolve=a;reject=b;});return {promise,resolve,reject};};
test('teaching IDs are business values, never filesystem paths', () => {
  for (const id of ['n1','n2']) assert.equal(noteId(id),id);
  for (const id of [null,undefined,['n1'],'../n1','unknown']) assert.throws(() => noteId(id),RangeError);
});
test('eligible session loads and publishes a matching note', async () => {
  const seen=[];const session=createSession(async id=>({id,title:'fake'}),s=>seen.push(s));
  assert.equal(await session.start('n1'),'published');
  assert.deepEqual(seen.map(s=>s.status),['loading','ready']);
  assert.equal(seen[1].note.id,'n1');session.dispose();
});
test('load failure has an explicit UI result', async () => {
  const seen=[];const session=createSession(async()=>{throw new Error('native failure');},s=>seen.push(s));
  assert.equal(await session.start('n1'),'failed');
  assert.deepEqual(seen.at(-1),{status:'error',id:'n1',code:'load-failed'});session.dispose();
});
test('focus departure aborts its request and ignores a late successful response', async () => {
  const work=deferred(),seen=[];let signal;
  const session=createSession((_id,s)=>{signal=s;return work.promise;},s=>seen.push(s));
  const completion=session.start('n1');await Promise.resolve();session.pause();
  assert.equal(signal.aborted,true);work.resolve({id:'n1'});
  assert.equal(await completion,'discarded');assert.deepEqual(seen.map(s=>s.status),['loading','paused']);
});
test('new generation keeps its signal and state when the old capability ignores cancellation', async () => {
  const first=deferred(),second=deferred(),seen=[],signals=[];
  const session=createSession((id,signal)=>{signals.push(signal);return id==='n1'?first.promise:second.promise;},s=>seen.push(s));
  const old=session.start('n1'),fresh=session.start('n2');await Promise.resolve();
  assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false);
  second.resolve({id:'n2'});assert.equal(await fresh,'published');first.resolve({id:'n1'});
  assert.equal(await old,'discarded');assert.equal(seen.at(-1).id,'n2');session.dispose();
});
test('dispose also discards late failures without publishing to an unmounted owner', async () => {
  const work=deferred(),seen=[];const session=createSession(()=>work.promise,s=>seen.push(s));
  const completion=session.start('n1');await Promise.resolve();session.dispose();work.reject(new Error('late'));
  assert.equal(await completion,'discarded');assert.deepEqual(seen.map(s=>s.status),['loading']);
});
test('a later eligible generation can recover after an error', async () => {
  const seen=[];let calls=0;const session=createSession(async id=>{if(calls++===0)throw new Error('first');return {id};},s=>seen.push(s));
  assert.equal(await session.start('n1'),'failed');assert.equal(await session.start('n1'),'published');
  assert.equal(seen.at(-1).status,'ready');session.dispose();
});

test('AppState subscription rereads an initial snapshot that changed before the effect', () => {
  const source={currentState:null,addEventListener(type,listener){assert.equal(type,'change');this.listener=listener;this.currentState='active';return {remove:()=>{this.removed=true;}};}};
  const values=[];const close=observeAppState(source,value=>values.push(value));
  assert.deepEqual(values,['active']);source.listener('background');assert.deepEqual(values,['active','background']);
  close();assert.equal(source.removed,true);
});

test('pending native result retires on pause and restored screen can invoke again',async()=>{
 const first=deferred(),seen=[],observed=[];const session=createCapabilitySession(x=>seen.push(x),(event,fields)=>observed.push({event,...fields}));
 session.setEligible(true);const old=session.run('files',()=>first.promise);await Promise.resolve();
 session.setEligible(false);assert.equal(seen.at(-1).status,'idle');first.resolve({status:'ok',old:true});
 assert.equal(await old,'discarded');assert.equal(seen.at(-1).status,'idle');
 session.setEligible(true);assert.equal(await session.run('files',async()=>({status:'ok',fresh:true})),'published');
 assert.equal(seen.at(-1).fresh,true);assert.equal(observed.find(x=>x.old)?.accepted,false);session.dispose();
});
test('current native capability rejects overlapping button work and recovers from errors',async()=>{
 const work=deferred(),seen=[];const session=createCapabilitySession(x=>seen.push(x));session.setEligible(true);
 const pending=session.run('files',()=>work.promise);assert.equal(await session.run('files',async()=>({status:'ok'})),'busy');
 work.reject(new Error('controlled native error'));assert.equal(await pending,'published');assert.equal(seen.at(-1).status,'error');
 assert.equal(await session.run('files',async()=>({status:'ok'})),'published');session.dispose();
});
test('two non-cancellable invocations own different directories and retire only their resource',async()=>{
 const first=deferred(),second=deferred(),directories=[];
 const create=()=>{const directory={name:ownedDirectoryName(()=>100),exists:true,delete(){this.exists=false;}};directories.push(directory);return directory;};
 const a=withOwnedDirectory(create,()=>first.promise),b=withOwnedDirectory(create,()=>second.promise);
 assert.notEqual(directories[0].name,directories[1].name);first.resolve();await a;
 assert.equal(directories[0].exists,false);assert.equal(directories[1].exists,true);second.resolve();await b;
 assert.equal(directories[1].exists,false);
});

test('dispose then direct resume resets the visible capability state before retry', async () => {
  const seen = [];let finish;
  const session = createCapabilitySession(value => seen.push(value));
  session.setEligible(true);
  const old = session.run('files', () => new Promise(resolve => {finish = resolve;}));
  await Promise.resolve();
  session.dispose();
  assert.equal(seen.at(-1).status, 'running'); // Disposing an unmounted view is silent.
  session.setEligible(true);
  assert.equal(seen.at(-1).status, 'idle');
  assert.equal(await session.run('files', async () => ({status:'ok',newCall:true})), 'published');
  finish({status:'ok',oldCall:true});
  assert.equal(await old, 'discarded');
  assert.equal(seen.at(-1).newCall, true);
});
