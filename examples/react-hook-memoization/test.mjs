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
test('unrelated update preserves correct memo identity but not unstable options or direct result',async()=>mounted(async({text,click})=>{
 const stable=text('[data-identity="correct"]'), unstable=Number(text('[data-identity="unstable"]'));await click('unrelated');assert.equal(text('[data-identity="correct"]'),stable);assert.equal(Number(text('[data-identity="unstable"]')),unstable+1);assert.equal(Number(text('[data-identity="uncached"]')),2);
}));
test('query change refreshes correct computation; omitted dependency stays stale',async()=>mounted(async({text,click})=>{
 const old=text('[data-result="stale"]');await click('query');assert.equal(text('[data-result="stale"]'),old);assert.notEqual(text('[data-result="correct"]').split('：')[1],old.split('：')[1]);assert.equal(text('[data-result="correct"]').split('：')[1],text('[data-result="uncached"]').split('：')[1]);
}));
test('useCallback keeps correct dependency and exposes stale empty dependency',async()=>mounted(async({text,click})=>{
 await click('query');await click('callback');assert.equal(text('[data-result="report"]'),'correct:6');await click('stale-callback');assert.equal(text('[data-result="report"]'),'stale:1');await click('inline');assert.equal(text('[data-result="report"]'),'inline:6');
}));
test('changing key resets hook lifetime and captures current input again',async()=>mounted(async({text,click})=>{
 await click('query');await click('remount');assert.equal(text('[data-identity="correct"]'),'1');assert.equal(text('[data-result="correct"]').split('：')[1],text('[data-result="stale"]').split('：')[1]);await click('stale-callback');assert.equal(text('[data-result="report"]'),'stale:6');
}));
test('pure calculation has deterministic data output independent of caching',()=>{const a=exports.calculate(exports.TASKS,'1'),b=exports.calculate(exports.TASKS,'1');assert.deepEqual(a,b);assert.notEqual(a,b);assert.equal(exports.calculate(exports.TASKS,'no match').rows.length,0);});

test('fixed source snapshots and every published excerpt match byte-for-byte', async()=>{
 const {createHash}=await import('node:crypto');
 const hashes=JSON.parse(fs.readFileSync('source-notes/SHA256.json','utf8'));
 for(const [file,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(`source-notes/${file}`)).digest('hex'),hash,file);
 const excerpts=JSON.parse(fs.readFileSync('source-notes/excerpts.json','utf8'));
 for(const x of Object.values(excerpts)){const lines=fs.readFileSync(`source-notes/${x.file}`,'utf8').split(/\r?\n/);assert.equal(x.code,lines.slice(x.start-1,x.end).join('\n'),`${x.file}:${x.start}`);}
 const articlePath='../../src/data/articles/react-hook-memoization.ts';
 if(fs.existsSync(articlePath)){
  const article=fs.readFileSync(articlePath,'utf8');const start=article.indexOf('const excerpts = ')+17;const end=article.indexOf(';\nconst p =',start);assert.deepEqual(JSON.parse(article.slice(start,end)),excerpts);
 }
});
