import React from 'react';

export class ResourceScope {
  private cleanups:Array<()=>void>=[];
  private disposed=false;
  own<T>(value:T|null,drop:(value:T)=>void):T {
    if(value===null)throw new Error('GPU资源分配失败');
    if(this.disposed){drop(value);throw new Error('资源作用域已经关闭');}
    this.cleanups.push(()=>drop(value));return value;
  }
  dispose(){if(this.disposed)return;this.disposed=true;for(const drop of this.cleanups.reverse())drop();this.cleanups=[];}
}
export function makeProgram(gl:WebGL2RenderingContext,scope:ResourceScope,vertex:string,fragment:string){
  const compile=(type:number,source:string)=>{
    const shader=scope.own(gl.createShader(type),s=>gl.deleteShader(s));
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'着色器编译失败');
    return shader;
  };
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  const program=scope.own(gl.createProgram(),p=>gl.deleteProgram(p));
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'程序链接失败');
  return program;
}
export function requiredUniform(gl:WebGL2RenderingContext,program:WebGLProgram,name:string){
  const location=gl.getUniformLocation(program,name);
  if(location===null)throw new Error('未找到活动uniform: '+name);return location;
}
export function frameSize(width:number,height:number,dpr:number){
  if(![width,height,dpr].every(Number.isFinite)||width<=0||height<=0||dpr<=0)throw new RangeError('画布尺寸无效');
  const ratio=Math.min(dpr,2);return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))] as const;
}
export type Scene={draw:(width:number,height:number,time:number)=>void;dispose:()=>void};

// Retire a scene while its context is lost, before restoration changes generation.
export class SceneSlot {
  current:Scene|undefined;
  clear(){const previous=this.current;this.current=undefined;previous?.dispose();}
}

export type Options={count:number;batch:boolean;animate:boolean};
export const defaults:Options={count:1000,batch:true,animate:true};
export function offsetsFor(count:number){
 if(!Number.isInteger(count)||count<1||count>5000)throw new RangeError('instance count 1..5000');
 const side=Math.ceil(Math.sqrt(count)),spacing=1.8/side,offsets=new Float32Array(count*2);
 for(let i=0;i<count;i++){offsets[i*2]=-.9+spacing*(i%side+.5);offsets[i*2+1]=-.9+spacing*(Math.floor(i/side)+.5);}return {offsets,size:spacing*.65};
}
export class Samples{
 private values:number[]=[];
 constructor(private capacity=60){if(!Number.isInteger(capacity)||capacity<1||capacity>1000)throw new RangeError('sample capacity 1..1000');}
 push(value:number){if(!Number.isFinite(value)||value<0)throw new RangeError('finite nonnegative measurement required');this.values.push(value);if(this.values.length>this.capacity)this.values.shift();}
 clear(){this.values=[];}
 summary(){if(!this.values.length)return {count:0,p50:null,p95:null};const s=[...this.values].sort((a,b)=>a-b),at=(p:number)=>s[Math.max(0,Math.ceil(p*s.length)-1)];return {count:s.length,p50:at(.5),p95:at(.95)};}
}

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

export default function App(){
  const canvasRef=React.useRef<HTMLCanvasElement>(null);
  const control=React.useRef<{probe:()=>void;lose:()=>void;restore:()=>void}|null>(null);
  const [options,setOptions]=React.useState<Options>(defaults);
  const [epoch,setEpoch]=React.useState(0),[lost,setLost]=React.useState(false);
  const [status,setStatus]=React.useState('等待WebGL2初始化'),[evidence,setEvidence]=React.useState('尚未读取真实像素');
  const change=(patch:Partial<Options>)=>setOptions(old=>({...old,...patch}));
  React.useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});
    if(!gl){setStatus('此浏览器或设备无法创建WebGL2；CPU测试不能代替GPU运行');return;}
    const scenes=new SceneSlot();
    let raf=0,dead=false;
    const extension=gl.getExtension('WEBGL_lose_context');
    const drawFrame=(time=performance.now())=>{
      if(dead||gl.isContextLost()||!scenes.current)return;
      const rect=canvas.getBoundingClientRect(),[width,height]=frameSize(Math.max(1,rect.width),Math.max(1,rect.height),window.devicePixelRatio||1);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      try{scenes.current.draw(width,height,time);}catch(error){cancelAnimationFrame(raf);setStatus(error instanceof Error?error.message:'绘制失败');throw error;}
    };
    const loop=(time:number)=>{try{drawFrame(time);if(!dead&&!gl.isContextLost())raf=requestAnimationFrame(loop);}catch{/* Stop this scene's loop; controls can rebuild it. */}};
    const onLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);scenes.clear();setLost(true);setStatus('WebGL上下文已丢失，旧GPU资源不能继续使用');};
    const onRestored=()=>{setLost(false);setEpoch(value=>value+1);};
    canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
    const onResize=()=>{try{drawFrame();}catch{/* Error is already visible. */}};
    window.addEventListener('resize',onResize);
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(onResize);observer?.observe(canvas);
    try {
      gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      scenes.current=createScene(gl,options);drawFrame();setStatus('WebGL2场景已建立；请读取像素与错误码核验当前设备');
      if(options.animate)raf=requestAnimationFrame(loop);
    }catch(error){setStatus(error instanceof Error?error.message:'初始化失败');}
    control.current={probe(){
      if(!scenes.current||gl.isContextLost()){setEvidence('当前没有可读的场景');return;}
      try{drawFrame();}catch{setEvidence('当前绘制失败，请先修复参数');return;}const rgba=new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      setEvidence(JSON.stringify({rgba:[...rgba],glError:gl.getError(),version:gl.getParameter(gl.VERSION),metrics:(scenes.current as Scene&{evidence?:()=>unknown}).evidence?.(),size:[canvas.width,canvas.height]}));
    },lose(){if(extension)extension.loseContext();else setEvidence('此环境没有WEBGL_lose_context扩展');},restore(){if(extension)extension.restoreContext();}};
    return ()=>{dead=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',onResize);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);control.current=null;scenes.clear();};
  },[options,epoch]);
  return <main style={{fontFamily:'system-ui',padding:16,maxWidth:840,margin:'auto',color:'#16352b'}}>
    <h1>提交批次、异步计时与资源生命周期</h1>
    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>
<label>三角形数 {options.count}<input type="range" min="100" max="5000" step="100" value={options.count} onChange={e=>change({count:+e.target.value})}/></label>
<label><input type="checkbox" checked={options.batch} onChange={e=>change({batch:e.target.checked})}/>实例化批次（取消则每三角形一次draw）</label>
<label><input type="checkbox" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续提交并旋转（关闭后手动读证据）</label>
    </fieldset>
    <canvas ref={canvasRef} aria-label="WebGL2交互场景" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>
    <p role="status">{status}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取像素与当前证据</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>
    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。计时不包含像素/错误读取；此按钮另行执行同步探针。GPU扩展不可用明确显示unsupported，不用CPU耗时冒充GPU时间。页面卸载会取消RAF并释放本例创建的资源。</p>
  </main>;
}
