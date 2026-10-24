import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';
import {quad,checkerPixels,textureWidth,textureHeight,type Options} from './data.js';
export const vertexShader=`#version 300 es
layout(location=0) in vec2 aPosition;
layout(location=1) in vec2 aUv;
uniform vec2 uOffset;
uniform float uUvScale;
out vec2 vUv;
void main(){gl_Position=vec4(aPosition*0.65+uOffset,0.0,1.0);vUv=aUv*uUvScale;}`;
export const fragmentShader=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform vec3 uTint;
uniform float uOpacity;
out vec4 outColor;
void main(){vec4 sampleColor=texture(uTexture,vUv);outColor=vec4(sampleColor.rgb*uTint,sampleColor.a*uOpacity);}`;
export function createScene(gl:WebGL2RenderingContext,options:Options):Scene {
  const scope=new ResourceScope();
  try {
    const program=makeProgram(gl,scope,vertexShader,fragmentShader);
    const vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v));
    const buffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));
    const texture=scope.own(gl.createTexture(),t=>gl.deleteTexture(t));
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,textureWidth,textureHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,checkerPixels());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,options.filter==='nearest'?gl.NEAREST:options.filter==='linear'?gl.LINEAR:gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,options.filter==='nearest'?gl.NEAREST:gl.LINEAR);
    const wrap=options.repeat?gl.REPEAT:gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
    const sampler=requiredUniform(gl,program,'uTexture'),offset=requiredUniform(gl,program,'uOffset');
    const scale=requiredUniform(gl,program,'uUvScale'),tint=requiredUniform(gl,program,'uTint'),opacity=requiredUniform(gl,program,'uOpacity');
    return {draw(width,height,_time){
      gl.viewport(0,0,width,height);gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);options.blend?gl.enable(gl.BLEND):gl.disable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.uniform1i(sampler,0);gl.uniform1f(scale,options.uvScale);gl.uniform1f(opacity,options.opacity);
      const layers=[{x:-.18,y:-.12,t:[1,.45,.35]},{x:.18,y:.12,t:[.35,.65,1]}];
      for(const layer of options.reverse?[...layers].reverse():layers){gl.uniform2f(offset,layer.x,layer.y);gl.uniform3fv(tint,layer.t);gl.drawArrays(gl.TRIANGLES,0,6);}
    },dispose(){scope.dispose();}};
  }catch(error){scope.dispose();throw error;}
}
