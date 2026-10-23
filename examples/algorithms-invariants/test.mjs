import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';
await mkdir('.test',{recursive:true});await build({entryPoints:['App.tsx'],bundle:true,platform:'node',format:'esm',external:['react'],outfile:'.test/app.mjs'});
const {lowerBound,linearLowerBound,validateSorted,traceLowerBound,longestUnique,bfs,minCoins}=await import('./.test/app.mjs');
test('lower bound empty, single, duplicates and both extremes',()=>{
 for(const [a,t,result]of[[[],3,0],[[1],0,0],[[1],2,1],[[1,2,2,4],2,1],[[1,2,2,4],9,4]])assert.equal(lowerBound(a,t),result);
});
test('precondition rejects nonfinite and unsorted input',()=>{
 assert.throws(()=>validateSorted([2,1],2),/有序/);assert.throws(()=>validateSorted([NaN],2),/有限/);assert.throws(()=>validateSorted([],Infinity),/有限/);
});
test('seeded differential comparison and interval invariants at every trace step',()=>{
 let seed=7;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<1000;trial++){
  const a=Array.from({length:rand()%30},()=>rand()%20-10).sort((a,b)=>a-b),t=rand()%30-15;
  assert.equal(lowerBound(a,t),linearLowerBound(a,t));const steps=traceLowerBound(a,t);
  for(let i=0;i<steps.length;i++){
   const {lo,hi,mid}=steps[i];assert.ok(lo>=0&&lo<=hi&&hi<=a.length);assert.ok(a.slice(0,lo).every(x=>x<t));assert.ok(a.slice(hi).every(x=>x>=t));
   if(mid!==null){assert.ok(lo<=mid&&mid<hi);assert.ok(steps[i+1].hi-steps[i+1].lo<hi-lo);}else assert.equal(lo,lowerBound(a,t));
  }
 }
});
test('window handles abba without moving left back; Unicode uses code points',()=>{
 assert.equal(longestUnique('abba'),2);assert.equal(longestUnique(''),0);assert.equal(longestUnique('😀a😀'),2);assert.equal(longestUnique('aaaa'),1);
});
test('BFS duplicates/self-loop/cycle/unreachable; parent path explains distance',()=>{
 const graph=new Map([['A',['A','B','B','C']],['B',['A','D']],['C',['D']],['D',[]],['X',[]]]);
 const result=bfs(graph,'A');assert.deepEqual(result.order,['A','B','C','D']);assert.equal(result.distance.get('D'),2);assert.equal(result.distance.has('X'),false);assert.equal(result.parent.get('D'),'B');
});
test('BFS validates reached graph boundary',()=>{assert.throws(()=>bfs(new Map(),'A'),/起点/);assert.throws(()=>bfs(new Map([['A',['B']]]),'A'),/邻接/);});
test('DP includes greedy counterexample, unreachable and invalid domains',()=>{
 assert.equal(minCoins([1,3,4],6),2);assert.equal(minCoins([2],3),-1);assert.equal(minCoins([],0),0);assert.throws(()=>minCoins([0],3));assert.throws(()=>minCoins([1],-1));
});
