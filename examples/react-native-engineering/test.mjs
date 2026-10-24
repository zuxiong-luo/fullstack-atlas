import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession, noteId, observeAppState} from './lib/session.mjs';
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
