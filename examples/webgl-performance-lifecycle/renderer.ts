import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';
import {offsetsFor,Samples,type Options} from './data.js';
export const vertexShader=`#version 300 es
layout(location=0) in vec2 aPosition;
layout(location=1) in vec2 aOffset;
uniform bool uBatch;
uniform vec2 uOffset;
uniform float uSize;
uniform float uAngle;
out vec3 vColor;
void main(){vec2 offset=uBatch?aOffset:uOffset;float c=cos(uAngle),s=sin(uAngle);vec2 p=mat2(c,s,-s,c)*aPosition*uSize+offset;gl_Position=vec4(p,0.0,1.0);vColor=vec3(aPosition*0.5+0.5,0.7);}`;
export const fragmentShader=`#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main(){outColor=vec4(vColor,1.0);}`;
type TimerExtension={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};
export class GpuTimer{
 private pending:WebGLQuery[]=[];private active:WebGLQuery|undefined;private dead=false;
 readonly samples=new Samples();readonly extension:TimerExtension|null;state='unsupported';
 constructor(private gl:WebGL2RenderingContext){this.extension=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;if(this.extension)this.state='waiting';}
 begin(){if(this.dead||!this.extension||this.active||this.pending.length>=4)return false;const q=this.gl.createQuery();if(!q)return false;this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,q);this.active=q;return true;}
 end(){if(!this.active||!this.extension)return;this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=undefined;}
 poll(){if(this.dead||!this.extension)return;
  if(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)){for(const q of this.pending)this.gl.deleteQuery(q);this.pending=[];this.samples.clear();this.state='disjoint: discarded pending measurements';return;}
  while(this.pending.length&&this.gl.getQueryParameter(this.pending[0],this.gl.QUERY_RESULT_AVAILABLE)){const q=this.pending.shift()!,ns=this.gl.getQueryParameter(q,this.gl.QUERY_RESULT);this.gl.deleteQuery(q);if(Number.isFinite(ns)&&ns>=0){this.samples.push(ns/1e6);this.state='valid milliseconds';}}
 }
 snapshot(){return {state:this.state,pending:this.pending.length,gpuMs:this.samples.summary()};}
 dispose(){if(this.dead)return;this.dead=true;if(this.active&&this.extension){this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.gl.deleteQuery(this.active);this.active=undefined;}for(const q of this.pending)this.gl.deleteQuery(q);this.pending=[];}
}
export type PerformanceScene=Scene&{evidence:()=>unknown};
export function createScene(gl:WebGL2RenderingContext,options:Options):PerformanceScene{
 const {offsets,size}=offsetsFor(options.count),scope=new ResourceScope(),cpu=new Samples();let timer:GpuTimer|undefined;
 try{const program=makeProgram(gl,scope,vertexShader,fragmentShader),single=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),batch=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),shape=scope.own(gl.createBuffer(),x=>gl.deleteBuffer(x)),instances=scope.own(gl.createBuffer(),x=>gl.deleteBuffer(x));
  for(const vao of [single,batch]){gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,shape);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.45,.5,-.45,0,.55]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);}
  gl.bindVertexArray(single);gl.disableVertexAttribArray(1);gl.vertexAttrib2f(1,0,0);
  gl.bindVertexArray(batch);gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,offsets,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,8,0);gl.vertexAttribDivisor(1,1);
  const useBatch=requiredUniform(gl,program,'uBatch'),offset=requiredUniform(gl,program,'uOffset'),scale=requiredUniform(gl,program,'uSize'),angle=requiredUniform(gl,program,'uAngle');timer=new GpuTimer(gl);
  return {draw(width,height,time){timer!.poll();gl.viewport(0,0,width,height);gl.clearColor(.025,.04,.06,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(options.batch?batch:single);gl.uniform1i(useBatch,+options.batch);gl.uniform1f(scale,size);gl.uniform1f(angle,options.animate?time*.0004:0);
   // Do not insert readPixels/getError/finish into either measured section.
   timer!.begin();const started=performance.now();
   try{if(options.batch)gl.drawArraysInstanced(gl.TRIANGLES,0,3,options.count);else for(let i=0;i<options.count;i++){gl.uniform2f(offset,offsets[i*2],offsets[i*2+1]);gl.drawArrays(gl.TRIANGLES,0,3);}}
   finally{cpu.push(performance.now()-started);timer!.end();}
  },evidence(){timer!.poll();return {mode:options.batch?'instanced':'individual',triangles:options.count,drawCalls:options.batch?1:options.count,cpuSubmissionMs:cpu.summary(),...timer!.snapshot(),estimatedBufferBytes:24+offsets.byteLength,note:'buffer bytes exclude driver/VAO/program/framebuffer overhead; timings are current device samples, not a speedup guarantee'};},dispose(){timer?.dispose();scope.dispose();}};
 }catch(error){timer?.dispose();scope.dispose();throw error;}
}
