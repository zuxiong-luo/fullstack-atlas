import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';
import {mesh,indices,offsets,validateMesh,type Options} from './data.js';
export const vertexShader=`#version 300 es
layout(location=0) in vec2 aPosition;
layout(location=1) in vec3 aColor;
layout(location=2) in vec2 aOffset;
uniform float uAngle;
out vec3 vColor;
void main(){
  float c=cos(uAngle),s=sin(uAngle);
  vec2 p=mat2(c,s,-s,c)*aPosition+aOffset;
  gl_Position=vec4(p,0.0,1.0);vColor=aColor;
}`;
export const fragmentShader=`#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main(){outColor=vec4(vColor,1.0);}`;
export function createScene(gl:WebGL2RenderingContext,options:Options):Scene {
  const elements=options.invalid?new Uint16Array([0,1,4]):indices;
  const counts=validateMesh(mesh,elements,options.instances,offsets);
  const scope=new ResourceScope();
  try {
    const program=makeProgram(gl,scope,vertexShader,fragmentShader);
    const vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v));
    const vertexBuffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));
    const indexBuffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));
    const instanceBuffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,20,8);
    gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,offsets,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,8,0);gl.vertexAttribDivisor(2,1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,elements,gl.STATIC_DRAW);
    const angle=requiredUniform(gl,program,'uAngle');
    return {draw(width,height,time){
      gl.viewport(0,0,width,height);gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(vao);
      gl.uniform1f(angle,options.animate?time*.0005:0);
      gl.drawElementsInstanced(gl.TRIANGLES,counts.indexCount,gl.UNSIGNED_SHORT,0,counts.instanceCount);
    },dispose(){scope.dispose();}};
  }catch(error){scope.dispose();throw error;}
}
