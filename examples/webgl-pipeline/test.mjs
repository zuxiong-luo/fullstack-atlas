import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';
await mkdir('.test',{recursive:true});await build({entryPoints:['App.tsx'],bundle:true,platform:'node',format:'esm',external:['react'],outfile:'.test/app.mjs'});
const {matrixFor,transformPoint,compile,makeProgram,DATA}=await import('./.test/app.mjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('identity, translation and column-major multiplication',()=>{
 const m=matrixFor({angle:0,scale:1,tx:0,ty:0},1);assert.deepEqual(transformPoint(m,0.3,0.4).map(x=>Math.round(x*10)/10),[0.3,0.4,1]);
 const p=transformPoint(matrixFor({angle:0,scale:1,tx:0.5,ty:-0.2},1),0,0);close(p[0],0.5);close(p[1],-0.2);
});
test('rotation then translation differs from translating then rotation',()=>{
 const p=transformPoint(matrixFor({angle:90,scale:1,tx:0.5,ty:0},1),1,0);close(p[0],0.5);close(p[1],1);
});
test('aspect correction keeps horizontal pixel scale consistent',()=>{
 const p=transformPoint(matrixFor({angle:0,scale:1,tx:0,ty:0},2),1,1);close(p[0],0.5);close(p[1],1);
});
test('degenerate scale and invalid matrix domain',()=>{
 const p=transformPoint(matrixFor({angle:0,scale:0,tx:0.2,ty:0.3},1),99,99);close(p[0],0.2);close(p[1],0.3);
 assert.throws(()=>matrixFor({angle:NaN,scale:1,tx:0,ty:0},1));assert.throws(()=>matrixFor({angle:0,scale:1,tx:0,ty:0},0));
});
test('interleaved triangle buffer is 3 vertices × 5 float components',()=>assert.equal(DATA.length,15));
function fake({compileOK=true,linkOK=true}={}){
 let id=0;const deletedShaders=[],deletedPrograms=[];
 return {VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,deletedShaders,deletedPrograms,
 createShader:()=>({id:++id}),shaderSource(){},compileShader(){},getShaderParameter:()=>compileOK,getShaderInfoLog:()=> 'controlled compile log',deleteShader:s=>deletedShaders.push(s.id),
 createProgram:()=>({id:++id}),attachShader(){},linkProgram(){},getProgramParameter:()=>linkOK,getProgramInfoLog:()=> 'controlled link log',deleteProgram:p=>deletedPrograms.push(p.id)};
}
test('failed shader compilation deletes the failed object and exposes diagnostic',()=>{
 const gl=fake({compileOK:false});assert.throws(()=>compile(gl,1,'bad'),/controlled compile log/);assert.equal(gl.deletedShaders.length,1);
});
test('failed linking deletes program plus both compiled shaders',()=>{
 const gl=fake({linkOK:false});assert.throws(()=>makeProgram(gl,'v','f'),/controlled link log/);assert.equal(gl.deletedPrograms.length,1);assert.equal(gl.deletedShaders.length,2);
});
test('successful linking retains program and releases shader references',()=>{
 const gl=fake();assert.ok(makeProgram(gl,'v','f'));assert.equal(gl.deletedPrograms.length,0);assert.equal(gl.deletedShaders.length,2);
});
