import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';
const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {createRoot}=await import('react-dom/client');await mkdir('.test',{recursive:true});await build({entryPoints:['App.tsx'],bundle:true,format:'esm',platform:'node',external:['react'],outfile:'.test/app.mjs'});const {default:App,score}=await import('./.test/app.mjs');
test('CPU function is deterministic with observable inputs',()=>{assert.equal(score(1,4000),score(1,4000));assert.notEqual(score(1,4000),score(2,4000))});
for(const mode of ['普通更新','Transition','减少工作量','同步计算反例'])test(`${mode}: controlled input and final list converge`,async()=>{const root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(App)));try{
 const selects=[...document.querySelectorAll('select')];await React.act(async()=>{selects[0].value='200';selects[0].dispatchEvent(new window.Event('change',{bubbles:true}));selects[1].value='4000';selects[1].dispatchEvent(new window.Event('change',{bubbles:true}))});
 const button=[...document.querySelectorAll('button')].find(b=>b.textContent===mode);await React.act(async()=>button.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
 const input=document.querySelector('input');await React.act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'abc');input.dispatchEvent(new window.Event('input',{bubbles:true}))});
 assert.equal(input.value,'abc');assert.match(document.querySelector('[role="status"]').textContent,/列表参数：abc/);assert.match(document.querySelector('[role="status"]').textContent,/已提交/);
 const rowText=[...document.querySelectorAll('[data-result-row]')];assert.equal(rowText.length,mode==='减少工作量'?40:200);assert.ok(rowText.every(n=>n.textContent.includes('abc')));
}finally{await React.act(async()=>root.unmount())}});
