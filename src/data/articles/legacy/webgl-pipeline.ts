import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "webgl-pipeline",
  "topic": "webgl",
  "title": "WebGL 从顶点到像素：完整三角形、矩阵与资源生命周期",
  "description": "先建立流水线和坐标概念，再完整实现shader编译链接、交错顶点缓冲、attribute和uniform矩阵，支持交互变换与故意错误诊断。",
  "minutes": 50,
  "tags": [
    "WebGL",
    "GPU",
    "Shader",
    "矩阵",
    "渲染"
  ],
  "scope": "单三角形2D仿射变换：完整WebGL1程序、buffer/attribute/uniform、编译链接错误、DPR与资源清理。不实现透视相机、纹理、深度/透明场景或Three.js；桌面内置浏览器已验证正常绘制、两种错误与恢复/旋转；手机与上下文恢复未验证。Node矩阵/mock测试不作为GPU证据。",
  "prerequisites": [
    "JavaScript与React Effect基本用法",
    "理解二维点；本文会说明矩阵存储和乘法约定"
  ],
  "sections": [
    {
      "id": "s19-335562",
      "title": "WebGL是什么：JavaScript提交状态，着色程序处理数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "WebGL是浏览器中面向图形流水线的接口。JavaScript准备数据和绘制状态，发送绘制命令；顶点着色器处理顶点，图元装配与光栅化产生片元，片元着色器给出片元颜色等输出，后续测试/混合决定写入结果。它提供的是可编程图形管线，不是把任意JavaScript循环自动搬到GPU执行的开关。"
        },
        {
          "type": "paragraph",
          "text": "本文的目标很具体：画一个三个角颜色不同的三角形，改变角度、缩放与平移，观察矩阵怎样影响最终位置；再故意制造编译错误和链接错误，能从状态日志定位。我们交付完整App.tsx，关键路径不再停在“成功清屏”。没有纹理、相机或场景库，便于把第一条绘制链看清楚。"
        },
        {
          "type": "table",
          "headers": [
            "数据或阶段",
            "这一层做什么",
            "本例内容"
          ],
          "rows": [
            [
              "CPU数据",
              "准备顶点与状态",
              "3个顶点，每个位置2浮点+颜色3浮点"
            ],
            [
              "vertex shader",
              "计算每顶点裁剪位置，输出varying",
              "mat3变换二维坐标，颜色传下去"
            ],
            [
              "光栅化/插值",
              "按三角形覆盖产生片元并插值",
              "角点颜色在内部连续变化"
            ],
            [
              "fragment shader",
              "计算片元输出",
              "把插值颜色写gl_FragColor"
            ],
            [
              "drawing buffer",
              "承接绘制结果",
              "viewport对应实际缓冲像素尺寸"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "片元不是“最终一个屏幕像素”的永恒同义词。覆盖、多重采样、深度/模板测试、混合等都可能影响最终结果；本例保留简单默认状态，不据此推导复杂透明场景性能。版本采用WebGL1和GLSL ES1.00语法，规范核对固定1.0.3，不把latest编辑草案当不变版本。"
        },
        {
          "type": "reference",
          "title": "规范出处：WebGL1.0.3",
          "url": "https://registry.khronos.org/webgl/specs/1.0.3/"
        }
      ]
    },
    {
      "id": "s9-274087",
      "title": "先说清坐标与矩阵：同一个点怎样进入裁剪范围",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "三个局部顶点是(-0.6,-0.45)、(0.6,-0.45)、(0,0.65)。它们先处于我们自己约定的模型坐标。顶点shader把二维点扩成(x,y,1)，乘mat3后取xy，写成gl_Position=(x,y,0,1)。这里最后w固定为1，所以透视除法不改变x/y；可见范围需要满足裁剪条件。不是所有WebGL场景都把w固定为1，本篇只研究二维仿射变换。"
        },
        {
          "type": "figure",
          "src": "figures/webgl-pipeline/coordinates.svg",
          "title": "从模型坐标、矩阵到viewport",
          "alt": "局部三角形经过P*T*R*S得到裁剪坐标，本例w=1所以NDC的xy相同，viewport再映射到实际绘图缓冲像素；同时示意每顶点5浮点的交错布局。",
          "caption": "结构与变换图为示意，不是GPU实测截图。位置单位、NDC与缓冲像素各自标明。"
        },
        {
          "type": "paragraph",
          "text": "我们使用列向量，矩阵为P·T·R·S：先缩放S，再旋转R，再平移T，最后P按画布宽高比修正横向比例。右侧先执行很重要：点(1,0)先旋转90°变成(0,1)，再平移x=0.5得到(0.5,1)；若先平移再旋转，则是(0,1.5)。两种轨迹不同，不能随便调换矩阵顺序。"
        },
        {
          "type": "code",
          "code": "import React, {useEffect, useRef, useState} from 'react';\nexport type Params={angle:number;scale:number;tx:number;ty:number};\n// Column-major mat3, column vectors: P * T * R * S.\nexport function matrixFor(p:Params,aspect:number):Float32Array {\n  if(![p.angle,p.scale,p.tx,p.ty].every(Number.isFinite)||!Number.isFinite(aspect)||aspect<=0||p.scale<0)throw new Error('矩阵参数必须有限，aspect>0，scale>=0');\n  const rad=p.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),k=p.scale;\n  return new Float32Array([c*k/aspect,s*k,0,-s*k/aspect,c*k,0,p.tx/aspect,p.ty,1]);\n}\nexport function transformPoint(m:Float32Array,x:number,y:number):[number,number,number] {\n  return [m[0]*x+m[3]*y+m[6],m[1]*x+m[4]*y+m[7],m[2]*x+m[5]*y+m[8]];\n}",
          "filename": "App.tsx · 参数与数学",
          "purpose": "完整mat3构造、参数校验和CPU点变换辅助。列主序存储：每连续3项是一列。",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入angle=0、scale=1、tx=0、ty=0、aspect=2，矩阵把x除以2、y保持不变。640×320画布中，NDC水平方向一个单位占320像素，纵向一个单位占160像素，先把x减半即可让同样模型长度对应同样像素长度。平移x也在P作用下修正，所以这里tx是P之前的模型/场景坐标单位，不是CSS像素。"
        },
        {
          "type": "paragraph",
          "text": "WebGL的uniformMatrix3fv要求transpose=false；Float32Array按列主序提供。矩阵最后一行是[0,0,1]，x/y变换中的平移存在第三列。CPU辅助transformPoint与shader使用相同约定，后文测试对照恒等、平移、旋转和宽高比。它验证数学，不会执行GPU shader。"
        },
        {
          "type": "reference",
          "title": "API约定出处：uniformMatrix[234]fv",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniformMatrix"
        }
      ]
    },
    {
      "id": "shader-program",
      "title": "着色器和程序：编译成功与链接成功是两道检查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export const VERTEX=`attribute vec2 a_position;\nattribute vec3 a_color;\nuniform mat3 u_matrix;\nvarying vec3 v_color;\nvoid main() {\n  vec3 p = u_matrix * vec3(a_position, 1.0);\n  gl_Position = vec4(p.xy, 0.0, 1.0);\n  v_color = a_color;\n}`;\nexport const FRAGMENT=`precision mediump float;\nvarying vec3 v_color;\nvoid main() { gl_FragColor = vec4(v_color, 1.0); }`;",
          "filename": "App.tsx · GLSL源代码",
          "purpose": "完整vertex与fragment源字符串，WebGL1语法。顶点a_color经varying插值，片元使用mediump float。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "a_position、a_color是每个顶点各不相同的输入；u_matrix是本次绘制共享的参数；v_color把顶点结果传到片元阶段并插值。uniform和attribute由谁变化不同，所以变换滑块只需更新矩阵，不需要每次重传三份顶点数据。片元颜色并非只会落在三个角：内部片元获得插值后的颜色。"
        },
        {
          "type": "code",
          "code": "export function compile(gl:WebGLRenderingContext,type:number,source:string):WebGLShader {\n  const shader=gl.createShader(type);if(!shader)throw new Error('无法分配shader');\n  gl.shaderSource(shader,source);gl.compileShader(shader);\n  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {\n    const log=gl.getShaderInfoLog(shader)||'无编译日志';gl.deleteShader(shader);throw new Error('Shader编译失败：'+log);\n  }\n  return shader;\n}\nexport function makeProgram(gl:WebGLRenderingContext,vertex:string,fragment:string):WebGLProgram {\n  let vs:WebGLShader|null=null,fs:WebGLShader|null=null,program:WebGLProgram|null=null;\n  try {\n    vs=compile(gl,gl.VERTEX_SHADER,vertex);fs=compile(gl,gl.FRAGMENT_SHADER,fragment);\n    program=gl.createProgram();if(!program)throw new Error('无法分配program');\n    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);\n    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Program链接失败：'+(gl.getProgramInfoLog(program)||'无链接日志'));\n    return program;\n  }catch(error){if(program)gl.deleteProgram(program);throw error;}\n  finally {if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}\n}",
          "filename": "App.tsx · 编译与链接",
          "purpose": "完整compile和makeProgram，含对象分配失败、编译日志、链接日志及失败清理；不是省略错误处理的成功示例。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "compile先创建shader、提交源代码并编译，随后读取COMPILE_STATUS；失败时取info log并删除这个失败对象。makeProgram分别编译两段，再attach并link，读取LINK_STATUS；失败会删除program，finally也标记删除两个shader。链接成功后保留program作为绘制资源，shader的删除标记不会让已链接程序突然失效；实际回收还要等不再被program引用。"
        },
        {
          "type": "paragraph",
          "text": "为什么不能只看编译？两个shader各自语法合法，但跨阶段varying类型不匹配，链接仍会失败。本例故意错误模式把片元v_color改成vec2并实际使用，而顶点仍输出vec3；这应在真实浏览器链接阶段产生诊断。编译错误模式则在顶点源末尾加入BROKEN_TOKEN。两类错误分别回答“单段程序能否编译”和“两段接口是否兼容”。"
        }
      ]
    },
    {
      "id": "buffer-layout",
      "title": "buffer与attribute：告诉GPU怎样从字节找到一个顶点",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export const DATA=new Float32Array([\n  -0.6,-0.45, 1,0.2,0.2,\n   0.6,-0.45, 0.2,1,0.3,\n   0.0, 0.65, 0.3,0.4,1\n]);\ntype Renderer={draw:(params:Params)=>void;dispose:()=>void};",
          "filename": "App.tsx · 顶点缓冲数据",
          "purpose": "完整3顶点交错Float32Array；Renderer类型在此定义，供后面的组件使用。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "每个顶点5个float：x、y、r、g、b。一个float32占4字节，所以stride=20字节；position从偏移0读2项，color从偏移8读3项。vertexAttribPointer里的stride/offset单位是字节，不能填成5和2后指望按float计数。bufferData上传一次，两个attribute从同一缓冲按不同位置读取。"
        },
        {
          "type": "paragraph",
          "text": "以下组件把这些语句接到真实上下文：bindBuffer指定当前ARRAY_BUFFER，bufferData上传DATA，再分别getAttribLocation、enableVertexAttribArray、vertexAttribPointer。pointer调用捕获当时绑定的缓冲与读取格式，所以仅有一份Float32Array并不会自动进入shader。最后drawArrays(TRIANGLES,0,3)中的3是顶点数，不是float个数，也不是字节数。"
        },
        {
          "type": "reference",
          "title": "属性读取格式出处：vertexAttribPointer",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer"
        }
      ]
    },
    {
      "id": "s11-290266",
      "title": "完整绘制组件：尺寸、参数、错误模式和重建都在这里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export default function App() {\n  const canvas=useRef<HTMLCanvasElement|null>(null),renderer=useRef<Renderer|null>(null);\n  const [angle,setAngle]=useState(0),[scale,setScale]=useState(0.8),[tx,setTx]=useState(0),[ty,setTy]=useState(0);\n  const [mode,setMode]=useState('valid'),[revision,setRevision]=useState(0),[status,setStatus]=useState('等待WebGL初始化');\n  const current=useRef<Params>({angle,scale,tx,ty});\n  useEffect(()=>{current.current={angle,scale,tx,ty};renderer.current?.draw(current.current)},[angle,scale,tx,ty]);\n  useEffect(()=>{\n    const element=canvas.current!;\n    const gl=element.getContext('webgl',{antialias:true});\n    if(!gl){setStatus('浏览器未提供WebGL1上下文；未绘制。请检查设备/浏览器设置。');return;}\n    let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null,observer:ResizeObserver|null=null;\n    const onLost=(event:Event)=>{event.preventDefault();renderer.current=null;setStatus('WebGL上下文丢失，等待恢复；旧资源已失效。');};\n    const onRestored=()=>setRevision(n=>n+1);\n    element.addEventListener('webglcontextlost',onLost);element.addEventListener('webglcontextrestored',onRestored);\n    try {\n      const vertex=mode==='compile-error'?VERTEX+'\\nBROKEN_TOKEN':VERTEX;\n      const fragment=mode==='link-error'?'precision mediump float; varying vec2 v_color; void main(){gl_FragColor=vec4(v_color,0.0,1.0);}':FRAGMENT;\n      program=makeProgram(gl,vertex,fragment);gl.useProgram(program);\n      buffer=gl.createBuffer();if(!buffer)throw new Error('无法分配buffer');\n      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,DATA,gl.STATIC_DRAW);\n      const position=gl.getAttribLocation(program,'a_position'),color=gl.getAttribLocation(program,'a_color'),matrix=gl.getUniformLocation(program,'u_matrix');\n      if(position<0||color<0||matrix===null)throw new Error('attribute/uniform未激活，检查shader与名称');\n      const stride=5*Float32Array.BYTES_PER_ELEMENT;\n      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,stride,0);\n      gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,stride,2*Float32Array.BYTES_PER_ELEMENT);\n      const draw=(params:Params)=>{\n        if(gl.isContextLost())return;\n        const rect=element.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);\n        const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));\n        if(element.width!==width||element.height!==height){element.width=width;element.height=height;}\n        gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);\n        gl.clearColor(0.06,0.12,0.10,1);gl.clear(gl.COLOR_BUFFER_BIT);\n        gl.uniformMatrix3fv(matrix,false,matrixFor(params,width/height));\n        gl.drawArrays(gl.TRIANGLES,0,3);\n        const error=gl.getError();\n        setStatus(`WebGL1：compile/link OK；drawArrays vertices=3；gl.getError()=${error===gl.NO_ERROR?'NO_ERROR':'ERROR'} (0x${error.toString(16)})；buffer=${width}×${height}`);\n      };\n      renderer.current={draw,dispose:()=>{gl.bindBuffer(gl.ARRAY_BUFFER,null);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}};\n      observer=new ResizeObserver(()=>draw(current.current));observer.observe(element);draw(current.current);\n    }catch(error){setStatus(String(error));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}\n    return ()=>{\n      observer?.disconnect();element.removeEventListener('webglcontextlost',onLost);element.removeEventListener('webglcontextrestored',onRestored);\n      renderer.current?.dispose();renderer.current=null;\n    };\n  },[mode,revision]);\n  const controls:[string,number,(v:number)=>void,number,number,number][]=[['角度°',angle,setAngle,-180,180,1],['缩放',scale,setScale,0,1.5,0.05],['平移X',tx,setTx,-1.5,1.5,0.05],['平移Y',ty,setTy,-1.5,1.5,0.05]];\n  return <main style={{padding:20,fontFamily:'system-ui',maxWidth:920,margin:'auto',lineHeight:1.7}}>\n    <h2>WebGL1：完整三角形与矩阵变换</h2><p>顶点位置+颜色 → shader编译/链接 → attribute → uniform mat3 → drawArrays。无外部图形库。</p>\n    <div style={{display:'flex',flexWrap:'wrap',gap:16}}>{controls.map(([name,value,set,min,max,step])=><label key={name}>{name} {value.toFixed(2)}<br/><input aria-label={name} type=\"range\" min={min} max={max} step={step} value={value} onChange={e=>set(Number(e.target.value))}/></label>)}</div>\n    <label>验证模式 <select aria-label=\"验证模式\" value={mode} onChange={e=>setMode(e.target.value)}><option value=\"valid\">正常绘制</option><option value=\"compile-error\">故意shader编译错误</option><option value=\"link-error\">故意varying链接错误</option></select></label>{' '}<button onClick={()=>{setAngle(0);setScale(0.8);setTx(0);setTy(0);setMode('valid');setRevision(n=>n+1)}}>重建/重置</button>\n    <p role=\"status\">{status}</p>\n    <canvas ref={canvas} width={640} height={320} style={{display:'block',width:'100%',height:320,maxWidth:'100%',border:'1px solid #4d7660'}}/>\n    <p>矩阵为P·T·R·S，列向量右侧先作用；P按画布宽高比修正横向比例。缩放0时三角形退化没有面积，移出裁剪范围也可能不可见，这些都可能仍是NO_ERROR。</p>\n    <p>诊断状态只能证明API路径与错误码；实际GPU画面需浏览器检查。JS测试仅核对矩阵与资源失败清理，不冒充真实着色器编译。</p>\n  </main>;\n}",
          "filename": "App.tsx · 完整React组件",
          "purpose": "接在前面参数、shader、编译器与DATA之后，就是完整示例文件。初始化、绘制、交互、上下文事件和清理均未省略。",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一次Effect获取webgl上下文，构建program、buffer与属性格式；成功后建立draw。draw读取CSS尺寸和DPR，设置drawing buffer，再viewport、clear、上传uniform矩阵并drawArrays。页面role=status显示compile/link、顶点数、gl.getError与缓冲尺寸。这样“看不见”至少可以先区分上下文缺失、编译/链接失败、API错误和坐标不可见。"
        },
        {
          "type": "paragraph",
          "text": "Canvas CSS宽度决定布局，drawing buffer决定实际可写像素。例子将DPR上限设为2，在ResizeObserver中按尺寸变化重画；同时更新viewport覆盖绘图缓冲。DPR更高并非总更好，分辨率上升会增加像素相关成本。本例没有持续动画，滑块和尺寸变化时才重画，也没有每帧重新上传固定DATA。"
        },
        {
          "type": "paragraph",
          "text": "普通参数Effect只更新current和调用已有draw；只有验证模式或重建版本变化才重新分配程序和buffer。退出或重建时断开ResizeObserver、移除事件监听并删除资源。上下文丢失事件preventDefault允许后续恢复，状态标记旧资源失效；恢复事件触发重建。浏览器/GPU仍可能拒绝恢复，不能把一个监听器当作恢复必然成功的保证。"
        },
        {
          "type": "experiment",
          "id": "webgl-pipeline",
          "title": "三角形、矩阵与编译/链接错误实验",
          "description": "操作角度/缩放/平移，切换故意错误再恢复正常；完整实现已经在正文。"
        }
      ]
    },
    {
      "id": "s16-211827",
      "title": "边界与性能：NO_ERROR仍然可能没有可见三角形",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "缩放设为0，三个顶点会落在同一点，图元退化没有面积；平移超出裁剪范围，图也可能消失。两种情况下API调用都可能合法，gl.getError仍为NO_ERROR。这正好说明错误码检查与坐标推演互补：前者发现错误调用，后者解释合法但不可见的结果。"
        },
        {
          "type": "paragraph",
          "text": "如果画面只有背景，按顺序查：上下文是否存在，两个shader编译和program链接是否成功，attribute/uniform位置是否有效，buffer布局是否20/0/8字节，顶点计数是否3，矩阵是否把坐标送出范围，viewport是否与实际缓冲匹配。每个问题都能对应代码中的值，比把所有原因都叫“GPU没渲染”更容易定位。"
        },
        {
          "type": "paragraph",
          "text": "本文不报告帧率或提速。真正性能诊断要区分JavaScript/提交成本与GPU/填充成本：很多draw call可能压CPU，大片透明覆盖和复杂片元可能压GPU；只减少三角形数量未必针对瓶颈。对单三角形做本例控制并不能推出复杂场景表现。使用Three.js能简化场景组织，仍需要理解资源、坐标和测量责任。"
        }
      ]
    },
    {
      "id": "s12-394675",
      "title": "验证：数学和生命周期已测，GPU结果单独核对",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/webgl-pipeline\nnpm ci\nnpm test\nnpm run build\nnpm run dev -- --port 4322 --strictPort",
          "filename": "终端",
          "purpose": "锁定React18.3.1/TypeScript5.7.2/Vite6.4.5，Node22.12.0实际测试与构建。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "8项Node测试实际通过：恒等/平移、旋转后平移、宽高比修正、退化缩放/非法参数、3×5缓冲布局、编译失败清理、链接失败清理、成功链接后保留program并释放shader引用。后面三项使用fake GL，验证JavaScript控制流，不会真的编译GLSL。因此不能据此写“所有GPU已通过”。"
        },
        {
          "type": "paragraph",
          "text": "集成验收已在桌面内置浏览器实际确认：默认渐变三角形可见且NO_ERROR；编译错误模式显示BROKEN_TOKEN语法错误，链接错误模式显示varying类型不匹配；恢复正常后再设90°，三角形实际逆时针旋转且NO_ERROR。该记录只覆盖这次桌面浏览器环境，不代表所有GPU。手机、不同设备、上下文丢失恢复仍待核验；截图与环境说明保留在集成记录中。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "stride为什么是20而不是5？",
              "vertexAttribPointer按字节计数，5个Float32每个4字节。"
            ],
            [
              "角度变化为什么不重新bufferData？",
              "顶点数据没变，改变的是本次绘制共享的u_matrix；更新uniform后再draw即可。"
            ],
            [
              "program链接成功能否忽略shader编译日志？",
              "不应。单段编译失败与跨阶段链接失败有不同原因，两道状态都应明确检查。"
            ],
            [
              "NO_ERROR时无图意味着浏览器坏了吗？",
              "不一定。退化、裁剪范围、合法但错误的变换都可能没有API错误。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "读完后应能沿一次draw指出每份数据的去向：DATA进入buffer，attribute解释字节，uniform提供矩阵，vertex输出位置和颜色，光栅化插值，fragment给出颜色，viewport决定像素映射。复杂渲染库可以封装这条链，但不能替你取消这些约定。"
        }
      ]
    }
  ],
  "questionIds": [
    "webgl-pipeline-spaces",
    "webgl-pipeline-bottleneck"
  ],
  "references": [
    {
      "title": "WebGL1.0.3固定规范",
      "url": "https://registry.khronos.org/webgl/specs/1.0.3/"
    },
    {
      "title": "MDN vertexAttribPointer",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer"
    },
    {
      "title": "MDN uniformMatrix",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniformMatrix"
    }
  ],
  "experiment": "react",
  "status": "review",
  "kind": "tutorial",
  "labMinutes": 30,
  "versions": [
    "WebGL 1 / GLSL ES 1.00",
    "规范核对固定 WebGL 1.0.3",
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2 / Node.js 22.12.0"
  ],
  "verifiedAt": "2026-10-23",
  "examples": [
    {
      "label": "完整三角形与参数实验",
      "path": "webgl-pipeline.zip"
    },
    {
      "label": "运行与GPU验收说明",
      "path": "webgl-pipeline/README.md"
    }
  ]
};
export default article;
