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

export type Mat4=Float32Array;
export function multiply(a:Mat4,b:Mat4):Mat4 {
  const out=new Float32Array(16);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)
    for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];
  return out;
}
export function translation(x:number,y:number,z:number):Mat4 {
  return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
}
export function rotationY(radians:number):Mat4 {
  const c=Math.cos(radians),s=Math.sin(radians);
  return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);
}
export function perspective(fovy:number,aspect:number,near:number,far:number):Mat4 {
  if(![fovy,aspect,near,far].every(Number.isFinite)||fovy<=0||fovy>=Math.PI||aspect<=0||near<=0||far<=near)throw new RangeError('透视参数无效');
  const f=1/Math.tan(fovy/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
export function orthographic(left:number,right:number,bottom:number,top:number,near:number,far:number):Mat4 {
  if(![left,right,bottom,top,near,far].every(Number.isFinite)||left>=right||bottom>=top||near<=0||near>=far)throw new RangeError('正交参数无效');
  return new Float32Array([2/(right-left),0,0,0,0,2/(top-bottom),0,0,0,0,-2/(far-near),0,-(right+left)/(right-left),-(top+bottom)/(top-bottom),-(far+near)/(far-near),1]);
}
export function clipPoint(matrix:Mat4,point:readonly[number,number,number]) {
  const vector=[...point,1];return [0,1,2,3].map(row=>vector.reduce((sum,value,k)=>sum+matrix[k*4+row]*value,0));
}
export function toNdc(clip:readonly number[]){
  if(clip.length!==4||!clip.every(Number.isFinite)||Math.abs(clip[3])<1e-8)throw new RangeError('不能进行透视除法');
  return clip.slice(0,3).map(v=>v/clip[3]);
}
export const vertices=new Float32Array([
  -.9,-.7,.25, 1,.18,.12, .9,-.7,.25, 1,.18,.12, 0,.9,.25, 1,.18,.12,
  -.8,.7,-.25, .12,.4,1, .8,.7,-.25, .12,.4,1, 0,-.9,-.25, .12,.4,1,
]);
export type Options={angle:number;camera:number;projection:'perspective'|'orthographic';depth:boolean;animate:boolean};
export const defaults:Options={angle:0,camera:3,projection:'perspective',depth:true,animate:false};

export const vertexShader=`#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aColor;
uniform mat4 uMvp;
out vec3 vColor;
void main(){gl_Position=uMvp*vec4(aPosition,1.0);vColor=aColor;}`;
export const fragmentShader=`#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main(){outColor=vec4(vColor,1.0);}`;
export function createScene(gl:WebGL2RenderingContext,options:Options):Scene {
  const scope=new ResourceScope();
  try {
    const program=makeProgram(gl,scope,vertexShader,fragmentShader);
    const vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v));
    const buffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    const mvp=requiredUniform(gl,program,'uMvp');
    return {draw(width,height,time){
      const aspect=width/height;
      const projection=options.projection==='perspective'?perspective(Math.PI/3,aspect,.1,10):orthographic(-1.3*aspect,1.3*aspect,-1.3,1.3,.1,10);
      const model=rotationY((options.angle+(options.animate?time*.025:0))*Math.PI/180);
      const view=translation(0,0,-options.camera);
      gl.viewport(0,0,width,height);gl.clearColor(.035,.06,.09,1);gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      options.depth?gl.enable(gl.DEPTH_TEST):gl.disable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);
      gl.useProgram(program);gl.bindVertexArray(vao);gl.uniformMatrix4fv(mvp,false,multiply(projection,multiply(view,model)));
      gl.drawArrays(gl.TRIANGLES,0,6);
    },dispose(){scope.dispose();}};
  }catch(error){scope.dispose();throw error;}
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
      scenes.current.draw(width,height,time);
    };
    const loop=(time:number)=>{drawFrame(time);if(!dead&&!gl.isContextLost())raf=requestAnimationFrame(loop);};
    const onLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);scenes.clear();setLost(true);setStatus('WebGL上下文已丢失，旧GPU资源不能继续使用');};
    const onRestored=()=>{setLost(false);setEpoch(value=>value+1);};
    canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
    const onResize=()=>drawFrame();
    window.addEventListener('resize',onResize);
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(onResize);observer?.observe(canvas);
    try {
      gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      scenes.current=createScene(gl,options);drawFrame();setStatus('WebGL2场景已建立；请读取像素与错误码核验当前设备');
      if(options.animate)raf=requestAnimationFrame(loop);
    }catch(error){setStatus(error instanceof Error?error.message:'初始化失败');}
    control.current={probe(){
      if(!scenes.current||gl.isContextLost()){setEvidence('当前没有可读的场景');return;}
      drawFrame();const rgba=new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      setEvidence(JSON.stringify({rgba:[...rgba],glError:gl.getError(),version:gl.getParameter(gl.VERSION),size:[canvas.width,canvas.height]}));
    },lose(){if(extension)extension.loseContext();else setEvidence('此环境没有WEBGL_lose_context扩展');},restore(){if(extension)extension.restoreContext();}};
    return ()=>{dead=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',onResize);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);control.current=null;scenes.clear();};
  },[options,epoch]);
  return <main style={{fontFamily:'system-ui',padding:16,maxWidth:840,margin:'auto',color:'#16352b'}}>
    <h1>三维变换与深度</h1>
    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>
<label>Y轴角度 {options.angle}°<input type="range" min="-80" max="80" value={options.angle} onChange={e=>change({angle:+e.target.value})}/></label>
<label>相机Z {options.camera}<input type="range" min="2.2" max="5" step="0.1" value={options.camera} onChange={e=>change({camera:+e.target.value})}/></label>
<label>投影<select value={options.projection} onChange={e=>change({projection:e.target.value as Options['projection']})}><option value="perspective">透视</option><option value="orthographic">正交</option></select></label>
<label><input type="checkbox" checked={options.depth} onChange={e=>change({depth:e.target.checked})}/>深度测试</label>
<label><input type="checkbox" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续旋转</label>
    </fieldset>
    <canvas ref={canvasRef} aria-label="WebGL2交互场景" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>
    <p role="status">{status}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取中心像素</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>
    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>
  </main>;
}
