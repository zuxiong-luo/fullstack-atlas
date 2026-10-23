import React, {useEffect, useRef, useState} from 'react';
export type Params={angle:number;scale:number;tx:number;ty:number};
// Column-major mat3, column vectors: P * T * R * S.
export function matrixFor(p:Params,aspect:number):Float32Array {
  if(![p.angle,p.scale,p.tx,p.ty].every(Number.isFinite)||!Number.isFinite(aspect)||aspect<=0||p.scale<0)throw new Error('矩阵参数必须有限，aspect>0，scale>=0');
  const rad=p.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),k=p.scale;
  return new Float32Array([c*k/aspect,s*k,0,-s*k/aspect,c*k,0,p.tx/aspect,p.ty,1]);
}
export function transformPoint(m:Float32Array,x:number,y:number):[number,number,number] {
  return [m[0]*x+m[3]*y+m[6],m[1]*x+m[4]*y+m[7],m[2]*x+m[5]*y+m[8]];
}
export const VERTEX=`attribute vec2 a_position;
attribute vec3 a_color;
uniform mat3 u_matrix;
varying vec3 v_color;
void main() {
  vec3 p = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
  v_color = a_color;
}`;
export const FRAGMENT=`precision mediump float;
varying vec3 v_color;
void main() { gl_FragColor = vec4(v_color, 1.0); }`;
export function compile(gl:WebGLRenderingContext,type:number,source:string):WebGLShader {
  const shader=gl.createShader(type);if(!shader)throw new Error('无法分配shader');
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
    const log=gl.getShaderInfoLog(shader)||'无编译日志';gl.deleteShader(shader);throw new Error('Shader编译失败：'+log);
  }
  return shader;
}
export function makeProgram(gl:WebGLRenderingContext,vertex:string,fragment:string):WebGLProgram {
  let vs:WebGLShader|null=null,fs:WebGLShader|null=null,program:WebGLProgram|null=null;
  try {
    vs=compile(gl,gl.VERTEX_SHADER,vertex);fs=compile(gl,gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram();if(!program)throw new Error('无法分配program');
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Program链接失败：'+(gl.getProgramInfoLog(program)||'无链接日志'));
    return program;
  }catch(error){if(program)gl.deleteProgram(program);throw error;}
  finally {if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
}
export const DATA=new Float32Array([
  -0.6,-0.45, 1,0.2,0.2,
   0.6,-0.45, 0.2,1,0.3,
   0.0, 0.65, 0.3,0.4,1
]);
type Renderer={draw:(params:Params)=>void;dispose:()=>void};
export default function App() {
  const canvas=useRef<HTMLCanvasElement|null>(null),renderer=useRef<Renderer|null>(null);
  const [angle,setAngle]=useState(0),[scale,setScale]=useState(0.8),[tx,setTx]=useState(0),[ty,setTy]=useState(0);
  const [mode,setMode]=useState('valid'),[revision,setRevision]=useState(0),[status,setStatus]=useState('等待WebGL初始化');
  const current=useRef<Params>({angle,scale,tx,ty});
  useEffect(()=>{current.current={angle,scale,tx,ty};renderer.current?.draw(current.current)},[angle,scale,tx,ty]);
  useEffect(()=>{
    const element=canvas.current!;
    const gl=element.getContext('webgl',{antialias:true});
    if(!gl){setStatus('浏览器未提供WebGL1上下文；未绘制。请检查设备/浏览器设置。');return;}
    let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null,observer:ResizeObserver|null=null;
    const onLost=(event:Event)=>{event.preventDefault();renderer.current=null;setStatus('WebGL上下文丢失，等待恢复；旧资源已失效。');};
    const onRestored=()=>setRevision(n=>n+1);
    element.addEventListener('webglcontextlost',onLost);element.addEventListener('webglcontextrestored',onRestored);
    try {
      const vertex=mode==='compile-error'?VERTEX+'\nBROKEN_TOKEN':VERTEX;
      const fragment=mode==='link-error'?'precision mediump float; varying vec2 v_color; void main(){gl_FragColor=vec4(v_color,0.0,1.0);}':FRAGMENT;
      program=makeProgram(gl,vertex,fragment);gl.useProgram(program);
      buffer=gl.createBuffer();if(!buffer)throw new Error('无法分配buffer');
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,DATA,gl.STATIC_DRAW);
      const position=gl.getAttribLocation(program,'a_position'),color=gl.getAttribLocation(program,'a_color'),matrix=gl.getUniformLocation(program,'u_matrix');
      if(position<0||color<0||matrix===null)throw new Error('attribute/uniform未激活，检查shader与名称');
      const stride=5*Float32Array.BYTES_PER_ELEMENT;
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,stride,0);
      gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,stride,2*Float32Array.BYTES_PER_ELEMENT);
      const draw=(params:Params)=>{
        if(gl.isContextLost())return;
        const rect=element.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
        const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
        if(element.width!==width||element.height!==height){element.width=width;element.height=height;}
        gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
        gl.clearColor(0.06,0.12,0.10,1);gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniformMatrix3fv(matrix,false,matrixFor(params,width/height));
        gl.drawArrays(gl.TRIANGLES,0,3);
        const error=gl.getError();
        setStatus(`WebGL1：compile/link OK；drawArrays vertices=3；gl.getError()=${error===gl.NO_ERROR?'NO_ERROR':'ERROR'} (0x${error.toString(16)})；buffer=${width}×${height}`);
      };
      renderer.current={draw,dispose:()=>{gl.bindBuffer(gl.ARRAY_BUFFER,null);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}};
      observer=new ResizeObserver(()=>draw(current.current));observer.observe(element);draw(current.current);
    }catch(error){setStatus(String(error));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
    return ()=>{
      observer?.disconnect();element.removeEventListener('webglcontextlost',onLost);element.removeEventListener('webglcontextrestored',onRestored);
      renderer.current?.dispose();renderer.current=null;
    };
  },[mode,revision]);
  const controls:[string,number,(v:number)=>void,number,number,number][]=[['角度°',angle,setAngle,-180,180,1],['缩放',scale,setScale,0,1.5,0.05],['平移X',tx,setTx,-1.5,1.5,0.05],['平移Y',ty,setTy,-1.5,1.5,0.05]];
  return <main style={{padding:20,fontFamily:'system-ui',maxWidth:920,margin:'auto',lineHeight:1.7}}>
    <h2>WebGL1：完整三角形与矩阵变换</h2><p>顶点位置+颜色 → shader编译/链接 → attribute → uniform mat3 → drawArrays。无外部图形库。</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:16}}>{controls.map(([name,value,set,min,max,step])=><label key={name}>{name} {value.toFixed(2)}<br/><input aria-label={name} type="range" min={min} max={max} step={step} value={value} onChange={e=>set(Number(e.target.value))}/></label>)}</div>
    <label>验证模式 <select aria-label="验证模式" value={mode} onChange={e=>setMode(e.target.value)}><option value="valid">正常绘制</option><option value="compile-error">故意shader编译错误</option><option value="link-error">故意varying链接错误</option></select></label>{' '}<button onClick={()=>{setAngle(0);setScale(0.8);setTx(0);setTy(0);setMode('valid');setRevision(n=>n+1)}}>重建/重置</button>
    <p role="status">{status}</p>
    <canvas ref={canvas} width={640} height={320} style={{display:'block',width:'100%',height:320,maxWidth:'100%',border:'1px solid #4d7660'}}/>
    <p>矩阵为P·T·R·S，列向量右侧先作用；P按画布宽高比修正横向比例。缩放0时三角形退化没有面积，移出裁剪范围也可能不可见，这些都可能仍是NO_ERROR。</p>
    <p>诊断状态只能证明API路径与错误码；实际GPU画面需浏览器检查。JS测试仅核对矩阵与资源失败清理，不冒充真实着色器编译。</p>
  </main>;
}
