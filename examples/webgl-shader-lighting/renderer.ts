import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';
import {multiply,sphereMesh,lightingModel,normalMatrix,perspective,translation,type Options} from './data.js';
export const vertexShader=`#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProjection;
uniform mat3 uNormal;
out vec3 vWorld;
out vec3 vNormal;
void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=uNormal*aNormal;gl_Position=uViewProjection*world;}`;
export const fragmentShader=`#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
uniform vec3 uLight;
uniform float uShine;
uniform bool uNormalColor;
uniform bool uGamma;
out vec4 outColor;
void main(){
 vec3 n=normalize(vNormal),l=normalize(uLight);
 vec3 view=normalize(vec3(0.0,0.0,3.5)-vWorld);
 vec3 sum=l+view;float sumLength=length(sum);vec3 halfVector=sumLength>0.00001?sum/sumLength:vec3(0.0);
 float lambert=max(dot(n,l),0.0);
 float spec=lambert>0.0?pow(max(dot(n,halfVector),0.0),uShine):0.0;
 vec3 color=vec3(0.8,0.27,0.08)*(0.12+0.75*lambert)+vec3(0.35)*spec;
 if(uNormalColor)color=n*0.5+0.5;
 else if(uGamma)color=pow(max(color,vec3(0.0)),vec3(1.0/2.2));
 outColor=vec4(color,1.0);
}`;
export function createScene(gl:WebGL2RenderingContext,options:Options):Scene{
 lightingModel(options);const scope=new ResourceScope();
 try{const program=makeProgram(gl,scope,vertexShader,fragmentShader),vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v)),buffer=scope.own(gl.createBuffer(),v=>gl.deleteBuffer(v)),indices=scope.own(gl.createBuffer(),v=>gl.deleteBuffer(v)),mesh=sphereMesh();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
  const model=requiredUniform(gl,program,'uModel'),vp=requiredUniform(gl,program,'uViewProjection'),normal=requiredUniform(gl,program,'uNormal'),light=requiredUniform(gl,program,'uLight'),shine=requiredUniform(gl,program,'uShine'),normalColor=requiredUniform(gl,program,'uNormalColor'),gamma=requiredUniform(gl,program,'uGamma');
  return {draw(width,height,time){const m=lightingModel(options,time);const n=options.wrongNormal?new Float32Array([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]):normalMatrix(m);const angle=options.light*Math.PI/180;
   gl.viewport(0,0,width,height);gl.clearColor(.025,.04,.06,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(vao);gl.uniformMatrix4fv(model,false,m);gl.uniformMatrix4fv(vp,false,multiply(perspective(Math.PI/3,width/height,.1,20),translation(0,0,-3.5)));gl.uniformMatrix3fv(normal,false,n);gl.uniform3f(light,Math.sin(angle),.35,Math.cos(angle));gl.uniform1f(shine,options.shine);gl.uniform1i(normalColor,+options.normalColor);gl.uniform1i(gamma,+options.gamma);gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);
  },dispose(){scope.dispose();}};
 }catch(error){scope.dispose();throw error;}
}
