import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const result = await build({entryPoints:['App.tsx'],bundle:true,write:false,platform:'node',format:'esm',external:['react']});
fs.writeFileSync('.test-module.mjs',result.outputFiles[0].text);
const {default:App,...exports}=await import('./.test-module.mjs'); fs.unlinkSync('.test-module.mjs');
async function mounted(run){
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(App)));
 const text=selector=>document.querySelector(selector)?.textContent;
 const click=async name=>{await act(async()=>document.querySelector(`[data-action="${name}"]`).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 try{await run({text,click});}finally{await act(async()=>root.unmount());dom.window.close();}
}
test('stable props skip memo panel; new object and plain component still commit',async()=>mounted(async({text,click})=>{
 const panel=text('[data-count="panel"]'),object=Number(text('[data-count="object"]')),plain=Number(text('[data-count="plain"]'));
 await click('parent'); assert.equal(text('[data-count="panel"]'),panel);assert.equal(Number(text('[data-count="object"]')),object+1);assert.equal(Number(text('[data-count="plain"]')),plain+1);
}));
test('child state work passes through a memo parent without executing its diagnostic child',async()=>mounted(async({text,click})=>{
 const panel=text('[data-count="panel"]');await click('leaf');assert.equal(text('[data-value="leaf"]'),'1');assert.equal(text('[data-count="panel"]'),panel);
}));
test('own state and consumed context update despite stable props',async()=>mounted(async({text,click})=>{
 const n=Number(text('[data-count="panel"]'));await click('panel');assert.equal(text('[data-value="panel"]'),'1');assert.equal(Number(text('[data-count="panel"]')),n+1);await click('theme');assert.equal(text('[data-value="theme"]'),'主题：dark');assert.equal(Number(text('[data-count="panel"]')),n+2);
}));
test('comparator that ignores callbacks retains stale behavior',async()=>mounted(async({text,click})=>{
 await click('parent');await click('unsafe');assert.equal(text('[data-value="report"]'),'unsafe:0');await click('safe');assert.equal(text('[data-value="report"]'),'safe:1');
}));

test('fixed source snapshots and every published excerpt match byte-for-byte', async()=>{
 const {createHash}=await import('node:crypto');
 const hashes=JSON.parse(fs.readFileSync('source-notes/SHA256.json','utf8'));
 for(const [file,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(`source-notes/${file}`)).digest('hex'),hash,file);
 const excerpts=JSON.parse(fs.readFileSync('source-notes/excerpts.json','utf8'));
 for(const x of Object.values(excerpts)){const lines=fs.readFileSync(`source-notes/${x.file}`,'utf8').split(/\r?\n/);assert.equal(x.code,lines.slice(x.start-1,x.end).join('\n'),`${x.file}:${x.start}`);}
 const articlePath='../../src/data/articles/react-bailout-memo.ts';
 if(fs.existsSync(articlePath)){
  const article=fs.readFileSync(articlePath,'utf8');const start=article.indexOf('const excerpts = ')+17;const end=article.indexOf(';\nconst p =',start);assert.deepEqual(JSON.parse(article.slice(start,end)),excerpts);
 }
});
