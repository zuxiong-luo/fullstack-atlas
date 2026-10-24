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

export type Options={scale:number;mode:number;angle:number;incomplete:boolean;animate:boolean};
export const defaults:Options={scale:.5,mode:0,angle:0,incomplete:false,animate:false};
export function targetSize(width:number,height:number,scale:number,maxSize:number){
 if(![width,height,scale,maxSize].every(Number.isFinite)||width<1||height<1||scale<.25||scale>1||maxSize<1)throw new RangeError('离屏尺寸参数无效');
 return [Math.max(1,Math.min(Math.floor(maxSize),2048,Math.round(width*scale))),Math.max(1,Math.min(Math.floor(maxSize),2048,Math.round(height*scale)))] as const;
}
export function targetBytes(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048)throw new RangeError('尺寸需为1..2048整数');return width*height*(4+2);}
export function gray(rgb:readonly number[]){if(rgb.length!==3||!rgb.every(Number.isFinite))throw new RangeError('RGB需要三个有限值');return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export const triangle=new Float32Array([-.85,-.75,1,.15,.05,.85,-.75,.05,.85,.15,0,.9,.1,.2,1]);

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
    <h1>离屏目标与双Pass后处理</h1>
    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>
<label>离屏分辨率<input type="range" min=".25" max="1" step=".25" value={options.scale} onChange={e=>change({scale:+e.target.value})}/> {options.scale}倍</label>
<label>后处理<select value={options.mode} onChange={e=>change({mode:+e.target.value})}><option value="0">原色</option><option value="1">灰度</option><option value="2">3×3拉普拉斯边缘</option></select></label>
<label>三角形角度 {options.angle}°<input type="range" min="-90" max="90" value={options.angle} onChange={e=>change({angle:+e.target.value})}/></label>
<label><input type="checkbox" checked={options.incomplete} onChange={e=>change({incomplete:e.target.checked})}/>受控失败：不连接Framebuffer附件</label>
<label><input type="checkbox" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续旋转</label>
    </fieldset>
    <canvas ref={canvasRef} aria-label="WebGL2交互场景" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>
    <p role="status">{status}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取像素与当前证据</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>
    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>
  </main>;
}
