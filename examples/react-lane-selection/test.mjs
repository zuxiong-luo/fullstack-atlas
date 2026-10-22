import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
const built = await build({ entryPoints: ['App.tsx'], bundle: true, write: false, platform: 'node', format: 'esm', external: ['react'] });
// Test module resolves React relative to this project, not an in-memory URL.
fs.writeFileSync('.test-module.mjs', built.outputFiles[0].text);
const module = await import('./.test-module.mjs'); fs.unlinkSync('.test-module.mjs');
const { select, highest, PRESETS, LANES } = module;
const source = fs.readFileSync('source-notes/ReactFiberLane.old.js', 'utf8');
const expectedHash = fs.readFileSync('source-notes/SHA256.txt', 'utf8').trim().split(' ')[0];
assert.equal(createHash('sha256').update(source).digest('hex'), expectedHash);
// This adapter evaluates two UNMODIFIED function bodies from the pinned source.
// Only Flow signatures are removed. Dependencies use the same constants/formulas.
const priorityBody = source.slice(source.indexOf('function getHighestPriorityLanes('), source.indexOf('export function getNextLanes(')).replace('function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes', 'function getHighestPriorityLanes(lanes)');
const nextBody = source.slice(source.indexOf('export function getNextLanes('), source.indexOf('export function getMostRecentEventTime(')).replace('export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes', 'function getNextLanes(root, wipLanes)');
const constants = [...source.matchAll(/(?:export )?const (\w+): (?:Lane|Lanes) =[^\n]*?(0b[01]+);/g)].map(m => `const ${m[1]} = ${m[2]};`).join('\n');
const original = vm.runInNewContext(`(()=>{${constants}\nconst allowConcurrentByDefault=false,ConcurrentUpdatesByDefaultMode=1,NoMode=0; const getHighestPriorityLane=lanes=>lanes & -lanes; const pickArbitraryLaneIndex=lanes=>31-Math.clz32(lanes); ${priorityBody}\n${nextBody}\nreturn getNextLanes;})()`);
function expected(s) {
  const pair = s.pending & (64 | 128); const entanglements = Array(31).fill(0);
  if (s.entangle) { entanglements[6] = pair; entanglements[7] = pair; }
  return original({ pendingLanes:s.pending, suspendedLanes:s.suspended, pingedLanes:s.pinged, entangledLanes:s.entangle?pair:0, entanglements, current:{mode:0} }, s.wip);
}
test('known cases follow the source selection branches', () => {
  const wanted = [1,0,64,4|16,64|128,64,64];
  PRESETS.forEach((p,i) => { assert.equal(select(p.snapshot).selected, wanted[i], p.name); assert.equal(expected(p.snapshot), wanted[i]); });
});
test('bit-set operations choose the lowest set bit, not the smallest decimal whole mask', () => {
  assert.equal(highest(1|128),1); assert.equal(highest(16|64),16); assert.equal(highest(0),0);
});
test('available non-idle work wins before pinged higher-priority work', () => {
  const s={pending:16|64,suspended:16,pinged:16,wip:0,expired:0,entangle:false,didTimeout:false};
  assert.equal(select(s).selected,64); assert.equal(expected(s),64);
});
test('expiration changes execution policy, not selection mask', () => {
  const s=PRESETS[6].snapshot;
  assert.equal(select(s).selected,select({...s,expired:0}).selected);
  assert.match(select(s).route,/同步 render/); assert.match(select({...s,expired:0}).route,/并发 render/);
  assert.match(select({...s,expired:0,didTimeout:true}).route,/同步 render/);
});
test('exhaustive 4^6 root availability snapshots match pinned source with selected WIP variants', () => {
  for(let encoded=0;encoded<4096;encoded++) {
    let n=encoded,pending=0,suspended=0,pinged=0;
    for(const lane of LANES){const state=n%4;n=Math.floor(n/4);if(state)pending|=lane.bit;if(state>=2)suspended|=lane.bit;if(state===3)pinged|=lane.bit;}
    for(const wip of [0,...LANES.map(l=>l.bit & pending),pending]) for(const entangle of [false,true]) {
      const s={pending,suspended,pinged,wip,expired:0,entangle,didTimeout:false};
      assert.equal(select(s).selected,expected(s),JSON.stringify(s));
    }
  }
});
test('server render exposes controls and result without browser-only globals', () => {
  const html=renderToStaticMarkup(React.createElement(module.default));
  assert.match(html,/Lane 选择/); assert.match(html,/Transition A pending/); assert.match(html,/aria-live="polite"/);
});
