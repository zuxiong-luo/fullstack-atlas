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

export function normalMatrix(model:Mat4):Float32Array{
 if(model.length!==16)throw new RangeError('模型矩阵必须16项');
 const a=model[0],b=model[4],c=model[8],d=model[1],e=model[5],f=model[9],g=model[2],h=model[6],i=model[10];
 const A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,det=a*A+b*B+c*C;
 if(!Array.from(model).every(Number.isFinite)||Math.abs(det)<1e-8)throw new RangeError('法线矩阵需要非奇异模型变换');
 // Cofactor matrix / det is transpose(inverse(M)); column-major upload.
 return new Float32Array([A,c*h-b*i,b*f-c*e,B,a*i-c*g,c*d-a*f,C,b*g-a*h,a*e-b*d].map(x=>x/det));
}
export function transform3(m:Float32Array,p:readonly number[]){return [0,1,2].map(row=>m[row]*p[0]+m[3+row]*p[1]+m[6+row]*p[2]);}
export function unit(v:readonly number[]){const n=Math.hypot(...v);if(!Number.isFinite(n)||n<1e-8)throw new RangeError('方向向量不可为零');return v.map(x=>x/n);}
export function diffuse(normal:readonly number[],light:readonly number[]){const n=unit(normal),l=unit(light);return Math.max(0,n.reduce((s,x,i)=>s+x*l[i],0));}
export function sphereMesh(rows=16,columns=24){
 if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<3||rows>64||columns<3||columns>64)throw new RangeError('球面分段3..64');const data:number[]=[],indices:number[]=[];
 for(let y=0;y<=rows;y++){const phi=y/rows*Math.PI;for(let x=0;x<=columns;x++){const theta=x/columns*Math.PI*2,p=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];data.push(...p,...p);}}
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;if(y!==0)indices.push(a,b,a+1);if(y!==rows-1)indices.push(a+1,b,b+1);}
 return {vertices:new Float32Array(data),indices:new Uint16Array(indices)};
}
export type Options={angle:number;scaleX:number;light:number;shine:number;wrongNormal:boolean;normalColor:boolean;gamma:boolean;animate:boolean};
export const defaults:Options={angle:25,scaleX:1.6,light:35,shine:32,wrongNormal:false,normalColor:false,gamma:true,animate:false};
export function lightingModel(options:Options,time=0){
 if(![options.angle,options.scaleX,options.light,options.shine,time].every(Number.isFinite)||options.scaleX<=0||options.scaleX>2||options.shine<1||options.shine>128)throw new RangeError('光照参数或缩放无效');
 const s=new Float32Array([options.scaleX,0,0,0,0,.7,0,0,0,0,1,0,0,0,0,1]);return multiply(rotationY((options.angle+(options.animate?time*.015:0))*Math.PI/180),s);
}

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
    <h1>法线、材质与逐像素光照</h1>
    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>
<label>模型Y角度 {options.angle}°<input type="range" min="-80" max="80" value={options.angle} onChange={e=>change({angle:+e.target.value})}/></label>
<label>X缩放 {options.scaleX}<input type="range" min=".3" max="2" step=".1" value={options.scaleX} onChange={e=>change({scaleX:+e.target.value})}/></label>
<label>光源方向 {options.light}°<input type="range" min="-150" max="150" value={options.light} onChange={e=>change({light:+e.target.value})}/></label>
<label>高光指数 {options.shine}<input type="range" min="1" max="128" value={options.shine} onChange={e=>change({shine:+e.target.value})}/></label>
<label><input type="checkbox" checked={options.wrongNormal} onChange={e=>change({wrongNormal:e.target.checked})}/>错误对照：把模型矩阵直接用于法线</label>
<label><input type="checkbox" checked={options.normalColor} onChange={e=>change({normalColor:e.target.checked})}/>查看世界法线颜色</label>
<label><input type="checkbox" checked={options.gamma} onChange={e=>change({gamma:e.target.checked})}/>显示近似gamma 2.2（非完整sRGB/PBR）</label>
<label><input type="checkbox" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续旋转</label>
    </fieldset>
    <canvas ref={canvasRef} aria-label="WebGL2交互场景" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>
    <p role="status">{status}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取像素与当前证据</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>
    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>
  </main>;
}
