import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';
import {targetSize,targetBytes,triangle,type Options} from './data.js';
export const vertexShader=`#version 300 es
layout(location=0) in vec2 aPosition;
layout(location=1) in vec3 aColor;
uniform float uAngle;
out vec3 vColor;
void main(){float c=cos(uAngle),s=sin(uAngle);gl_Position=vec4(mat2(c,s,-s,c)*aPosition,0.0,1.0);vColor=aColor;}`;
export const fragmentShader=`#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main(){outColor=vec4(vColor,1.0);}`;
export const postVertex=`#version 300 es
out vec2 vUv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
export const postFragment=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform int uMode;
out vec4 outColor;
void main(){
 vec3 c=texture(uSource,vUv).rgb;
 if(uMode==1)c=vec3(dot(c,vec3(0.2126,0.7152,0.0722)));
 if(uMode==2){vec2 texel=1.0/vec2(textureSize(uSource,0));vec3 sum=vec3(0.0);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)sum+=texture(uSource,vUv+vec2(float(x),float(y))*texel).rgb;c=clamp(c*9.0-sum,0.0,1.0);}
 outColor=vec4(c,1.0);
}`;
export type Target={texture:WebGLTexture;framebuffer:WebGLFramebuffer;width:number;height:number;bytes:number;dispose:()=>void};
export function createTarget(gl:WebGL2RenderingContext,width:number,height:number,incomplete=false):Target{
 const bytes=targetBytes(width,height),scope=new ResourceScope();
 try{const texture=scope.own(gl.createTexture(),x=>gl.deleteTexture(x)),framebuffer=scope.own(gl.createFramebuffer(),x=>gl.deleteFramebuffer(x)),depth=scope.own(gl.createRenderbuffer(),x=>gl.deleteRenderbuffer(x));
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
  if(!incomplete){gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);}
  const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(status!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Framebuffer不完整: 0x'+status.toString(16));
  return {texture,framebuffer,width,height,bytes,dispose(){scope.dispose();}};
 }catch(error){scope.dispose();throw error;}finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);}
}
export function createScene(gl:WebGL2RenderingContext,options:Options):Scene{
 targetSize(1,1,options.scale,1);if(!Number.isInteger(options.mode)||options.mode<0||options.mode>2||!Number.isFinite(options.angle))throw new RangeError('后处理参数无效');
 const scope=new ResourceScope();let target:Target|undefined;
 try{const first=makeProgram(gl,scope,vertexShader,fragmentShader),post=makeProgram(gl,scope,postVertex,postFragment),geometry=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),screen=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),buffer=scope.own(gl.createBuffer(),x=>gl.deleteBuffer(x));gl.bindVertexArray(geometry);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,triangle,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,20,8);
  const angle=requiredUniform(gl,first,'uAngle'),source=requiredUniform(gl,post,'uSource'),mode=requiredUniform(gl,post,'uMode'),maxSize=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  return {draw(width,height,time){const [w,h]=targetSize(width,height,options.scale,maxSize);if(!target||target.width!==w||target.height!==h){const next=createTarget(gl,w,h,options.incomplete);target?.dispose();target=next;}
   // Pass 1 writes the attachment. Pass 2 first binds a different framebuffer.
   gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.clearColor(.03,.08,.16,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(first);gl.bindVertexArray(geometry);gl.uniform1f(angle,(options.angle+(options.animate?time*.025:0))*Math.PI/180);gl.drawArrays(gl.TRIANGLES,0,3);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.useProgram(post);gl.bindVertexArray(screen);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.uniform1i(source,0);gl.uniform1i(mode,options.mode);gl.drawArrays(gl.TRIANGLES,0,3);
  },dispose(){target?.dispose();target=undefined;scope.dispose();}};
 }catch(error){target?.dispose();scope.dispose();throw error;}
}
