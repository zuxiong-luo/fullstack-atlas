import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
const dom=new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window=dom.window;globalThis.document=dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=await import('react');const {createRoot}=await import('react-dom/client');
await mkdir('.test',{recursive:true});
await build({entryPoints:['App.tsx'],bundle:true,format:'esm',platform:'node',external:['react'],outfile:'.test/app.mjs'});
const {default:App}=await import('./.test/app.mjs');
async function fixture(run){const root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(App)));const click=async name=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===name);assert.ok(b);await React.act(async()=>b.dispatchEvent(new window.MouseEvent('click',{bubbles:true})))};try{await run(click)}finally{await React.act(async()=>root.unmount())}}
const count=id=>Number(document.querySelector(`[data-row="${id}"] output`).textContent);
test('stable business IDs keep A state when siblings reorder',async()=>fixture(async click=>{await click('给 A 加一');await click('交换 A / B');assert.equal(count('A'),1);assert.equal(count('B'),0)}));
test('index keys attach prior position state to the new business item',async()=>fixture(async click=>{await click('切换 key 策略');await click('给 A 加一');await click('交换 A / B');assert.equal(count('A'),0);assert.equal(count('B'),1)}));
test('changing parent key resets descendants even with stable child IDs',async()=>fixture(async click=>{await click('给 A 加一');await click('更换父级 key');assert.equal(count('A'),0)}));
test('different component functions reset state despite identical host markup',async()=>fixture(async click=>{await click('给 A 加一');await click('更换组件类型');assert.equal(count('A'),0)}));
