
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import App from './dist/App.js';
import {ResourceScope,SceneSlot,frameSize,makeProgram} from './dist/gl-utils.js';
import {createScene,vertexShader,fragmentShader} from './dist/renderer.js';
import {defaults} from './dist/data.js';
function fakeGL({compileFailAt=0,linkFail=false,missingUniform=false}={}){
  let id=0,compiled=0;const live=new Set(),calls=[];
  const constants=['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','ELEMENT_ARRAY_BUFFER','STATIC_DRAW','FLOAT','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','DEPTH_TEST','LESS','TRIANGLES','UNSIGNED_SHORT','BLEND','TEXTURE0','TEXTURE_2D','UNPACK_ALIGNMENT','RGBA8','RGBA','UNSIGNED_BYTE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','NEAREST','LINEAR','LINEAR_MIPMAP_LINEAR','REPEAT','CLAMP_TO_EDGE','TEXTURE_WRAP_S','TEXTURE_WRAP_T','SRC_ALPHA','ONE_MINUS_SRC_ALPHA','ONE'];
  const gl=Object.fromEntries(constants.map((key,i)=>[key,2**(i%24)]));
  for(const kind of ['Shader','Program','Buffer','VertexArray','Texture']){
    gl['create'+kind]=()=>{const handle={kind,id:++id};live.add(handle);return handle;};
    gl['delete'+kind]=handle=>{assert(live.delete(handle),'resource deleted once');calls.push(['delete'+kind,handle.id]);};
  }
  gl.compileShader=()=>{compiled++;};gl.getShaderParameter=()=>compiled!==compileFailAt;
  gl.getShaderInfoLog=()=> 'expected compile failure';gl.getProgramParameter=()=>!linkFail;gl.getProgramInfoLog=()=> 'expected link failure';
  gl.getUniformLocation=(_p,name)=>missingUniform?null:{name};
  for(const name of ['shaderSource','attachShader','linkProgram','bindVertexArray','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','viewport','clearColor','clearDepth','clear','enable','disable','depthFunc','useProgram','uniformMatrix4fv','uniform1f','drawArrays','drawElementsInstanced','activeTexture','bindTexture','pixelStorei','texImage2D','generateMipmap','texParameteri','blendFuncSeparate','uniform1i','uniform2f','uniform3fv'])gl[name]=(...args)=>calls.push([name,...args]);
  return {gl,live,calls};
}
test('scope releases in reverse order and only once',()=>{
  const scope=new ResourceScope(),seen=[];scope.own('buffer',v=>seen.push(v));scope.own('vao',v=>seen.push(v));scope.dispose();scope.dispose();assert.deepEqual(seen,['vao','buffer']);
  assert.throws(()=>scope.own(null,()=>{}),/分配/);assert.throws(()=>scope.own('late',v=>seen.push(v)),/关闭/);assert.equal(seen.at(-1),'late');
});
test('device pixel size is bounded and invalid sizes fail',()=>{
  assert.deepEqual(frameSize(200,100,3),[400,200]);assert.deepEqual(frameSize(.1,.1,1),[1,1]);
  for(const size of [[0,10,1],[10,10,NaN],[10,-1,1]])assert.throws(()=>frameSize(...size),RangeError);
});
test('shader compile and program link failures release allocated resources',()=>{
  for(const config of [{compileFailAt:1},{compileFailAt:2},{linkFail:true}]){
    const {gl,live}=fakeGL(config),scope=new ResourceScope();assert.throws(()=>makeProgram(gl,scope,vertexShader,fragmentShader),/expected/);scope.dispose();assert.equal(live.size,0);
  }
});
test('scene creation error also disposes its scope',()=>{
  const {gl,live}=fakeGL({missingUniform:true});assert.throws(()=>createScene(gl,defaults),/uniform/);assert.equal(live.size,0);
});
test('normal scene issues draw commands then releases every owned GPU handle',()=>{
  const {gl,live,calls}=fakeGL(),scene=createScene(gl,defaults);scene.draw(640,480,0);
  assert(calls.some(c=>c[0].startsWith('draw')));assert(live.size>0);scene.dispose();scene.dispose();assert.equal(live.size,0);
});
test('GLSL dialect is explicit and app renders controls without touching a GPU in SSR',()=>{
  assert(vertexShader.startsWith('#version 300 es\n'));assert(fragmentShader.startsWith('#version 300 es\n'));
  const html=renderToStaticMarkup(React.createElement(App));assert.match(html,/WebGL2/);assert.match(html,/读取中心像素/);
});
test('self-contained App contains exact module bodies with one React import',async()=>{
  const app=await readFile(new URL('App.tsx',import.meta.url),'utf8');
  assert.equal((app.match(/^import /gm)||[]).length,1);assert(app.startsWith("import React from 'react';"));
  for(const name of ['gl-utils.ts','data.ts','renderer.ts']){const body=(await readFile(new URL(name,import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'');assert(app.includes(body),name);}
  assert(app.includes(await readFile(new URL('view.tsx.txt',import.meta.url),'utf8')));
});

import {textureWidth,textureHeight,checkerPixels,mipDimensions,unpackBytes,overOpaque} from './dist/data.js';
test('procedural NPOT RGBA texture has exact sample bytes and distinct alpha',()=>{
 const bytes=checkerPixels();assert.equal(textureWidth,3);assert.equal(textureHeight,5);assert.equal(bytes.length,60);assert.deepEqual([...bytes.slice(0,8)],[255,230,90,210,40,150,220,100]);
});
test('mipmap chain floors each dimension with a minimum of one',()=>{
 assert.deepEqual(mipDimensions(3,5),[[3,5],[1,2],[1,1]]);assert.deepEqual(mipDimensions(1,1),[[1,1]]);assert.throws(()=>mipDimensions(0,5),RangeError);
});
test('unpack alignment includes row padding but not padding after last row',()=>{
 assert.deepEqual(unpackBytes(3,5,3,4),{row:9,stride:12,required:57});assert.equal(unpackBytes(3,5,3,1).required,45);assert.equal(unpackBytes(3,5,4,4).required,60);assert.throws(()=>unpackBytes(3,5,4,3),RangeError);
});
test('straight alpha over opaque RGB depends on painter order',()=>{
 const bg=[0,0,0],red=[1,0,0,.5],blue=[0,0,1,.5];
 assert.deepEqual(overOpaque(red,overOpaque(blue,bg)),[.5,0,.25]);assert.deepEqual(overOpaque(blue,overOpaque(red,bg)),[.25,0,.5]);
});
test('mipmap sampler, unit zero and alpha factors are configured explicitly',()=>{
 const {gl,calls}=fakeGL(),scene=createScene(gl,{...defaults,filter:'mipmap'});scene.draw(640,480,0);
 assert(calls.some(c=>c[0]==='pixelStorei'&&c[1]===gl.UNPACK_ALIGNMENT&&c[2]===1));
 assert(calls.some(c=>c[0]==='texParameteri'&&c[2]===gl.TEXTURE_MIN_FILTER&&c[3]===gl.LINEAR_MIPMAP_LINEAR));
 assert(calls.some(c=>c[0]==='generateMipmap'));assert(calls.some(c=>c[0]==='uniform1i'&&c[1].name==='uTexture'&&c[2]===0));
 assert(calls.some(c=>c[0]==='blendFuncSeparate'&&c[1]===gl.SRC_ALPHA&&c[3]===gl.ONE));assert.equal(calls.filter(c=>c[0]==='drawArrays').length,2);scene.dispose();
});

// Model context generation explicitly: loss invalidates all old handles; deleting
// one after restoration is an error. This is an API-boundary test, not a GPU.
function generationGL(){
  const fixture=fakeGL();let generation=1,lost=false,invalidDeletes=0;
  const generations=new WeakMap();
  for(const kind of ['Shader','Program','Buffer','VertexArray','Texture']){
    const create=fixture.gl['create'+kind],drop=fixture.gl['delete'+kind];
    fixture.gl['create'+kind]=()=>{const handle=create();generations.set(handle,generation);return handle;};
    fixture.gl['delete'+kind]=handle=>{
      if(lost)return; // WebGL calls while lost do not delete a new generation.
      if(generations.get(handle)!==generation){invalidDeletes++;return;}
      drop(handle);
    };
  }
  return {...fixture,lose(){lost=true;fixture.live.clear();},restore(){lost=false;generation++;},
          invalidDeletes:()=>invalidDeletes};
}
test('lost scene is retired before restoration and later cleanup never deletes stale handles',()=>{
  // Negative control reproduces the former lifecycle ordering at the API boundary.
  const former=generationGL(),stale=createScene(former.gl,defaults);
  former.lose();former.restore();stale.dispose();assert(former.invalidDeletes()>0);
  const current=generationGL(),slot=new SceneSlot();
  slot.current=createScene(current.gl,defaults);current.lose();slot.clear();
  assert.equal(slot.current,undefined);current.restore();slot.clear();
  assert.equal(current.invalidDeletes(),0);
  slot.current=createScene(current.gl,defaults);slot.current.draw(640,480,0);
  assert(current.live.size>0);slot.clear();slot.clear();
  assert.equal(current.live.size,0);assert.equal(current.invalidDeletes(),0);
});
