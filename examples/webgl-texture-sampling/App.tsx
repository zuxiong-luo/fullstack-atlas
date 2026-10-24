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

export const textureWidth=3,textureHeight=5;
export function checkerPixels(){
  const result=new Uint8Array(textureWidth*textureHeight*4);
  for(let y=0;y<textureHeight;y++)for(let x=0;x<textureWidth;x++){
    const i=(y*textureWidth+x)*4,bright=(x+y)%2===0;
    result.set(bright?[255,230,90,210]:[40,150,220,100],i);
  }return result;
}
export function mipDimensions(width:number,height:number){
  if(![width,height].every(v=>Number.isInteger(v)&&v>0&&v<=16384))throw new RangeError('尺寸无效');
  const levels:Array<[number,number]>=[];
  for(;;){levels.push([width,height]);if(width===1&&height===1)return levels;width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));}
}
export function unpackBytes(width:number,height:number,components:number,alignment:number){
  if(![width,height,components].every(v=>Number.isInteger(v)&&v>0)||components>4||![1,2,4,8].includes(alignment))throw new RangeError('上传布局无效');
  const row=width*components,stride=Math.ceil(row/alignment)*alignment;
  return {row,stride,required:stride*(height-1)+row};
}
export function overOpaque(src:readonly[number,number,number,number],dst:readonly[number,number,number]){
  return dst.map((v,i)=>src[i]*src[3]+v*(1-src[3]));
}
export const quad=new Float32Array([
  -1,-1,0,0, 1,-1,1,0, 1,1,1,1,
  -1,-1,0,0, 1,1,1,1, -1,1,0,1,
]);
export type Options={filter:'nearest'|'linear'|'mipmap';repeat:boolean;uvScale:number;blend:boolean;reverse:boolean;opacity:number;animate:boolean};
export const defaults:Options={filter:'nearest',repeat:true,uvScale:3,blend:true,reverse:false,opacity:.75,animate:false};

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
    <h1>纹理、过滤与透明混合</h1>
    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>
<label>过滤<select value={options.filter} onChange={e=>change({filter:e.target.value as Options['filter']})}><option value="nearest">NEAREST</option><option value="linear">LINEAR</option><option value="mipmap">LINEAR_MIPMAP_LINEAR</option></select></label>
<label>UV倍率 {options.uvScale}<input type="range" min="1" max="128" value={options.uvScale} onChange={e=>change({uvScale:+e.target.value})}/></label>
<label>不透明度 {options.opacity}<input type="range" min="0.1" max="1" step="0.05" value={options.opacity} onChange={e=>change({opacity:+e.target.value})}/></label>
<label><input type="checkbox" checked={options.repeat} onChange={e=>change({repeat:e.target.checked})}/>REPEAT（关闭为CLAMP_TO_EDGE）</label>
<label><input type="checkbox" checked={options.blend} onChange={e=>change({blend:e.target.checked})}/>透明混合</label>
<label><input type="checkbox" checked={options.reverse} onChange={e=>change({reverse:e.target.checked})}/>交换绘制顺序</label>
<p>程序生成3×5 RGBA纹理；mipmap为3×5 → 1×2 → 1×1。高UV倍率用于观察缩小过滤。</p>
    </fieldset>
    <canvas ref={canvasRef} aria-label="WebGL2交互场景" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>
    <p role="status">{status}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取中心像素</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>
    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>
  </main>;
}
