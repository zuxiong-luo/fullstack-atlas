import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
await mkdir('.test', {recursive: true});
await build({entryPoints: ['App.tsx'], bundle: true, format: 'esm', platform: 'node', external: ['react'], outfile: '.test/app.mjs'});
const {default: App, createReadingStore, createQueryCache} = await import('./.test/app.mjs');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
test('immutable store snapshots, structural sharing, subscriptions and no-op', () => {
 const store=createReadingStore(), before=store.getSnapshot(); let calls=0;
 const off=store.subscribe(()=>calls++);
 assert.equal(store.getSnapshot(),before);
 store.dispatch({type:'toggle',id:'missing'}); assert.equal(calls,0);
 store.dispatch({type:'toggle',id:'fiber'});
 const after=store.getSnapshot(); assert.notEqual(after,before); assert.equal(before.books[0].read,false); assert.equal(after.books[0].read,true); assert.equal(after.books[1],before.books[1]); assert.equal(calls,1);
 off();store.dispatch({type:'toggle',id:'fiber'});assert.equal(calls,1);
});
test('cache deduplicates, isolates keys, reuses snapshots and refetches after invalidation', async()=>{
 const cache=createQueryCache(), d=deferred();let calls=0;
 const fetcher=()=>{calls++;return d.promise};
 const first=cache.load('u1',fetcher), second=cache.load('u1',fetcher);
 assert.equal(first,second); await Promise.resolve();assert.equal(calls,1);
 d.resolve('one');await first;
 const snapshot=cache.getSnapshot('u1');assert.equal(snapshot,cache.getSnapshot('u1'));
 assert.equal(await cache.load('u1',()=>{throw Error('must not fetch')}),'one');
 assert.equal(cache.getSnapshot('u2').data,undefined);
 cache.invalidate('u1');assert.equal(cache.getSnapshot('u1').stale,true);
 await cache.load('u1',async()=>'two');assert.equal(cache.getSnapshot('u1').data,'two');
});
test('late response cannot overwrite latest request',async()=>{
 const cache=createQueryCache(), old=deferred(), next=deferred();
 const a=cache.load('k',()=>old.promise,true), b=cache.load('k',()=>next.promise,true);
 next.resolve('new');await b;old.resolve('old');await a;
 assert.equal(cache.getSnapshot('k').data,'new');
});
test('invalidate during fetch prevents obsolete write and permits replacement fetch',async()=>{
 const cache=createQueryCache(), d=deferred(), p=cache.load('k',()=>d.promise);
 cache.invalidate('k');await cache.load('k',async()=>'fresh');d.resolve('stale');await p;
 assert.equal(cache.getSnapshot('k').data,'fresh');
});
test('failure keeps previous data; retry can recover',async()=>{
 const cache=createQueryCache();await cache.load('k',async()=>'initial');
 await assert.rejects(cache.load('k',async()=>{throw Error('offline')},true),/offline/);
 assert.deepEqual(cache.getSnapshot('k'),{status:'error',data:'initial',stale:true,error:'offline'});
 await cache.load('k',async()=>'recovered');assert.equal(cache.getSnapshot('k').data,'recovered');
});
test('optimistic rollback restores only its own version and invalidates older reads',async()=>{
 const cache=createQueryCache();await cache.load('k',async()=>'initial');
 const first=cache.optimistic('k','draft');assert.equal(cache.getSnapshot('k').data,'draft');
 assert.equal(first.rollback(),true);assert.equal(cache.getSnapshot('k').data,'initial');assert.equal(cache.getSnapshot('k').stale,true);
 const old=cache.optimistic('k','older');cache.optimistic('k','newer');assert.equal(old.rollback(),false);assert.equal(cache.getSnapshot('k').data,'newer');
 const d=deferred(), p=cache.load('k',()=>d.promise,true);cache.optimistic('k','latest');d.resolve('server-old');await p;
 assert.equal(cache.getSnapshot('k').data,'latest');
});
test('two store instances do not share updates (request isolation prerequisite)',()=>{
 const a=createReadingStore(), b=createReadingStore();a.dispatch({type:'toggle',id:'fiber'});assert.equal(b.getSnapshot().books[0].read,false);
});
test('React subscribes and the derived count tracks immutable updates',async()=>{
 const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import('react'), {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(React.createElement(App)));
 assert.equal(document.querySelector('[aria-label="已读数"]').textContent,'0');
 const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='切换 fiber');
 await React.act(async()=>button.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
 assert.equal(document.querySelector('[aria-label="已读数"]').textContent,'1');
 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});

test('invalidating or rolling back interrupted reads does not leave phantom loading',async()=>{
 const cache=createQueryCache(), d=deferred(), p=cache.load('k',()=>d.promise);
 cache.invalidate('k');assert.equal(cache.getSnapshot('k').status,'idle');
 d.resolve('ignored');await p;assert.equal(cache.getSnapshot('k').data,undefined);
 const next=deferred(), q=cache.load('k',()=>next.promise);
 const mutation=cache.optimistic('k','draft');assert.equal(mutation.rollback(),true);
 assert.equal(cache.getSnapshot('k').status,'idle');
 next.resolve('also ignored');await q;assert.equal(cache.getSnapshot('k').data,undefined);
});
