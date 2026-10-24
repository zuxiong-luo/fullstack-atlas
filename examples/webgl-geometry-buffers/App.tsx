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

export const mesh=new Float32Array([
  -.24,-.3, 1,.25,.1, .24,-.3, .1,.85,.35,
  .24,.3, .1,.4,1, -.24,.3, .9,.7,.1,
]);
export const indices=new Uint16Array([0,1,2,0,2,3]);
export const offsets=new Float32Array([-.65,0, 0,0, .65,0]);
export function validateMesh(data:Float32Array,elements:Uint16Array,instances:number,instanceData:Float32Array){
  const strideBytes=20,vertexCount=data.byteLength/strideBytes;
  if(!Number.isInteger(vertexCount)||vertexCount===0)throw new RangeError('顶点记录必须完整');
  if(!Number.isInteger(instances)||instances<1||instances>3||instanceData.length<instances*2)throw new RangeError('实例记录不足');
  if(elements.length===0||elements.length%3!==0)throw new RangeError('三角形索引不完整');
  for(const index of elements)if(index>=vertexCount)throw new RangeError('索引超过顶点记录数');
  return {strideBytes,vertexCount,indexCount:elements.length,instanceCount:instances};
}
export function attributeByteEnd(vertexIndex:number,stride:number,offset:number,components:number){
  if(![vertexIndex,stride,offset,components].every(Number.isInteger)||vertexIndex<0||stride<=0||offset<0||components<1||components>4||offset+components*4>stride)throw new RangeError('属性布局无效');
  return vertexIndex*stride+offset+components*4;
}
export type Options={instances:number;invalid:boolean;animate:boolean};
export const defaults:Options={instances:3,invalid:false,animate:false};

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
    <h1>顶点、索引与实例化</h1>
    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>
<label>实例数 {options.instances}<input type="range" min="1" max="3" value={options.instances} onChange={e=>change({instances:+e.target.value})}/></label>
<label><input type="checkbox" checked={options.invalid} onChange={e=>change({invalid:e.target.checked})}/>构造越界索引（CPU拒绝）</label>
<label><input type="checkbox" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续旋转</label>
<p>顶点4条 × 20字节；索引6个 × 2字节；实例偏移每条8字节。NDC单位，未做像素等比例校正。</p>
    </fieldset>
    <canvas ref={canvasRef} aria-label="WebGL2交互场景" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>
    <p role="status">{status}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取中心像素</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>
    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>
  </main>;
}
