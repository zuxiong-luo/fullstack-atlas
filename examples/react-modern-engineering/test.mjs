import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
import {hydrateRoot} from 'react-dom/client';
import {createServer, documentFor} from './server.mjs';
import {App} from './dist/App.mjs';
const data = {title:'SSR snapshot', count:0, requestId:'test-1'};
async function hydration(input, expectedErrors) {
  const dom = new JSDOM(documentFor(data), {url:'http://localhost'});
  globalThis.window=dom.window; globalThis.document=dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const before=document.querySelector('button'); const errors=[];
  const originalError=console.error; console.error=()=>{};
  let root;
  try {
    await act(async () => {root=hydrateRoot(document.getElementById('root'),React.createElement(App,{data:input}),{onRecoverableError:e=>errors.push(e.message)});});
    assert.equal(errors.length > 0, expectedErrors);
    assert.equal(document.querySelector('button')===before,!expectedErrors);
    await act(async()=>{document.querySelector('button').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));});
    assert.equal(document.querySelector('button').textContent,`计数 ${input.count+1}`);
  } finally {if(root) await act(async()=>root.unmount()); console.error=originalError; dom.window.close(); delete globalThis.window; delete globalThis.document;}
}
test('matching snapshot retains DOM and attaches working interaction',()=>hydration(data,false));
test('text mismatch reports recovery and replaces this root',()=>hydration({...data,count:99},true));
test('untrusted title cannot close the JSON script element',()=>{
  const title='</script><script>globalThis.pwned=1</script>\u2028';
  const dom=new JSDOM(documentFor({...data,title}),{runScripts:'dangerously'});
  assert.equal(dom.window.pwned,undefined);
  assert.equal(dom.window.document.querySelectorAll('script').length,2);
  assert.equal(JSON.parse(dom.window.document.getElementById('initial-data').textContent).title,title);
  assert.equal(dom.window.document.querySelector('h1').textContent,title); dom.window.close();
});
test('HTTP request isolation, failure status, private cache policy and assets',async()=>{
  const logs=[]; const server=createServer({log:x=>logs.push(JSON.parse(x))});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const [a,b]=await Promise.all([fetch(base+'/?title=Alice'),fetch(base+'/?title=Bob')]);
    assert.equal(a.status,200); assert.equal(a.headers.get('cache-control'),'no-store');
    assert.notEqual(a.headers.get('x-request-id'),b.headers.get('x-request-id'));
    const [ah,bh]=await Promise.all([a.text(),b.text()]);
    assert.match(ah,/<h1>Alice<\/h1>/); assert.doesNotMatch(ah,/<h1>Bob<\/h1>/); assert.match(bh,/<h1>Bob<\/h1>/);
    const fail=await fetch(base+'/?fail=1'); assert.equal(fail.status,500); assert.doesNotMatch(await fail.text(),/simulated loader/);
    assert.ok(logs.some(x=>x.phase==='render-or-load'));
    assert.equal((await fetch(base+'/missing')).status,404);
    assert.equal((await fetch(base+'/client.js')).status,200);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
