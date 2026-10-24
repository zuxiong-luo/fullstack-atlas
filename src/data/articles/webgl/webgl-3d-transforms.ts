import type { Article } from '../../articleTypes';
const article:Article={
  "id": "webgl-3d-transforms",
  "topic": "webgl",
  "title": "从二维到三维：模型、视图、投影与深度",
  "description": "建立对象、世界、观察、裁剪、NDC与窗口坐标的连续模型，写出列主序MVP矩阵，再用两张相互遮挡的三角形验证透视、正交与深度测试。",
  "minutes": 60,
  "labMinutes": 35,
  "tags": [
    "WebGL2",
    "三维变换",
    "MVP",
    "投影",
    "深度缓冲",
    "GLSL ES3.00"
  ],
  "scope": "WebGL2/GLSL ES3.00，手写4×4矩阵与三维三角形场景；覆盖投影、深度、尺寸和上下文生命周期。不展开光照、骨骼动画、逆转置法线与完整场景图。",
  "prerequisites": [
    "理解顶点着色器、片元着色器和缓冲区的基本作用",
    "能读TypeScript数组与矩阵乘法的逐项求和；不要求事先会透视矩阵"
  ],
  "kind": "series",
  "status": "complete",
  "verifiedAt": "2026-10-24",
  "versions": [
    "WebGL2；规范文档快照2.0.0（2017-04-11，页面标draft）",
    "GLSL ES3.00 revision6",
    "Node.js22.12.0 / TypeScript5.7.3 / esbuild0.28.2",
    "React/ReactDOM18.3.1；浏览器WebGL2已实测，物理GPU型号与原生手机未核验"
  ],
  "questionIds": [],
  "experiment": "react",
  "examples": [
    {
      "label": "独立场景、锁文件和CPU/生命周期测试",
      "path": "webgl-3d-transforms.zip"
    },
    {
      "label": "运行说明与实际验证边界",
      "path": "webgl-3d-transforms/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "三维变换是什么：把同一个点放到不同的参考系里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "三维变换是用统一的计算规则，改变一个点的位置、朝向、大小，或者改变描述它的参考系。WebGL不会替你维护“相机”对象。顶点着色器最终写出gl_Position，管线把这个四维裁剪坐标继续处理成屏幕像素。模型、视图和投影矩阵，是我们在应用中建立这条转换链的方法。"
        },
        {
          "type": "paragraph",
          "text": "先把三件事分开。模型矩阵M决定物体在世界中的摆放；视图矩阵V把世界转换到相机的参考系；投影矩阵P把一个观察体积映到裁剪空间。你移动相机时，三角形的原始顶点可以完全不变，变化的是我们从哪个位置观察它。这样，编辑几何、摆放物体和调整镜头就不必混在一组坐标常量里。"
        },
        {
          "type": "paragraph",
          "text": "这篇接续二维管线文章，使用WebGL2与GLSL ES3.00。例子只有红、蓝两张三角形，但真正经过模型、视图、投影与深度比较。代码是本站教学实现，不是某个引擎的源码节选。规范来源固定到WebGL2.0.0文档快照；这个快照自身仍注明draft，因此它是可追溯参考，不称作冻结不变的最终规范。"
        },
        {
          "type": "figure",
          "src": "figures/webgl-3d-transforms/coordinates.svg",
          "title": "先把坐标空间连起来，再讨论矩阵数字",
          "alt": "箭头依次表示M、V、P、裁剪后的透视除法与viewport映射。图中的“先后”是点的计算过程，不是数组在内存中的排列顺序。",
          "caption": "箭头依次表示M、V、P、裁剪后的透视除法与viewport映射。图中的“先后”是点的计算过程，不是数组在内存中的排列顺序。"
        }
      ]
    },
    {
      "id": "spaces",
      "title": "六种坐标：每走一步，都能说出当前数字表达什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "空间",
            "本例含义",
            "下一步"
          ],
          "rows": [
            [
              "对象空间",
              "红三角形的局部顶点，例如z=0.25",
              "M旋转物体"
            ],
            [
              "世界空间",
              "本例没有额外场景父节点",
              "V把相机Z平移的逆变换施加给世界"
            ],
            [
              "观察空间",
              "相机在原点，面向-Z；这是本例选定的约定",
              "P产生四维裁剪坐标"
            ],
            [
              "裁剪空间",
              "x、y、z与w共同决定裁剪边界",
              "先裁剪，再对坐标除以w"
            ],
            [
              "NDC",
              "可见范围映到各轴[-1,1]",
              "viewport与深度范围映射"
            ],
            [
              "窗口空间",
              "绘图缓冲区中的像素与深度",
              "光栅化、深度比较、写入附件"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "不要在CPU上只算出三个数，就把w当作无关字段删掉。采用默认裁剪规则时，点需要满足-w≤x、y、z≤w才处在裁剪体内；三角形穿过边界时，管线会裁剪几何。随后再进行透视除法。特别是w接近零或顶点在相机后方时，简单把所有点除完再拼图，会产生难以解释的结果。"
        },
        {
          "type": "paragraph",
          "text": "NDC的z不是你写入的世界坐标z；它已经经过视图与投影。默认depthRange再把NDC深度映到[0,1]。片元阶段的深度比较使用窗口深度，并不是把原始顶点z做一次排序。后面讨论“更近的红色”时，前提就是这里选定的相机方向、投影矩阵与LESS比较方式。"
        },
        {
          "type": "paragraph",
          "text": "相机的视图变换是相机世界变换的逆。本例相机没有旋转，位于(0,0,camera)，所以V只需平移(0,0,-camera)。如果以后加入相机朝向，要构造完整逆变换或lookAt矩阵；不能把所有相机旋转角简单照抄给物体。WebGL API本身不会强迫你的应用只能选这一种世界坐标约定。"
        }
      ]
    },
    {
      "id": "matrices",
      "title": "矩阵的结构与乘法：右边先作用，不等于倒着写数组",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "我们使用列向量，写成clip=P×V×M×local。右侧矩阵先作用：先摆放物体，再转到观察空间，最后投影。代码里的Float32Array按列存储，与uniformMatrix4fv的transpose=false相配合。列主序是存储布局，列向量是代数约定；它们相关，但不是同一个概念。换用另一套约定时，必须同时调整推导和上传，不能只转置一个数组来碰运气。"
        },
        {
          "type": "code",
          "code": "export type Mat4=Float32Array;\nexport function multiply(a:Mat4,b:Mat4):Mat4 {\n  const out=new Float32Array(16);\n  for(let col=0;col<4;col++)for(let row=0;row<4;row++)\n    for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];\n  return out;\n}\nexport function translation(x:number,y:number,z:number):Mat4 {\n  return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);\n}\nexport function rotationY(radians:number):Mat4 {\n  const c=Math.cos(radians),s=Math.sin(radians);\n  return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);\n}\nexport function perspective(fovy:number,aspect:number,near:number,far:number):Mat4 {\n  if(![fovy,aspect,near,far].every(Number.isFinite)||fovy<=0||fovy>=Math.PI||aspect<=0||near<=0||far<=near)throw new RangeError('透视参数无效');\n  const f=1/Math.tan(fovy/2),nf=1/(near-far);\n  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);\n}\nexport function orthographic(left:number,right:number,bottom:number,top:number,near:number,far:number):Mat4 {\n  if(![left,right,bottom,top,near,far].every(Number.isFinite)||left>=right||bottom>=top||near<=0||near>=far)throw new RangeError('正交参数无效');\n  return new Float32Array([2/(right-left),0,0,0,0,2/(top-bottom),0,0,0,0,-2/(far-near),0,-(right+left)/(right-left),-(top+bottom)/(top-bottom),-(far+near)/(far-near),1]);\n}\nexport function clipPoint(matrix:Mat4,point:readonly[number,number,number]) {\n  const vector=[...point,1];return [0,1,2,3].map(row=>vector.reduce((sum,value,k)=>sum+matrix[k*4+row]*value,0));\n}\nexport function toNdc(clip:readonly number[]){\n  if(clip.length!==4||!clip.every(Number.isFinite)||Math.abs(clip[3])<1e-8)throw new RangeError('不能进行透视除法');\n  return clip.slice(0,3).map(v=>v/clip[3]);\n}\nexport const vertices=new Float32Array([\n  -.9,-.7,.25, 1,.18,.12, .9,-.7,.25, 1,.18,.12, 0,.9,.25, 1,.18,.12,\n  -.8,.7,-.25, .12,.4,1, .8,.7,-.25, .12,.4,1, 0,-.9,-.25, .12,.4,1,\n]);\nexport type Options={angle:number;camera:number;projection:'perspective'|'orthographic';depth:boolean;animate:boolean};\nexport const defaults:Options={angle:0,camera:3,projection:'perspective',depth:true,animate:false};\n",
          "language": "ts",
          "filename": "examples/webgl-3d-transforms/data.ts",
          "purpose": "完整CPU数据与矩阵实现：先看multiply的col/row/k，再看translation最后一列与perspective中的w项。Options是实验参数。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "multiply的每一项都遵循普通矩阵乘法：结果第row行、第col列，是左矩阵这一行与右矩阵这一列的点积。内存索引col*4+row只是把这一项放到列主序数组中。测试用一个很小的反例检查顺序：先旋转原点再平移到x=1，结果是(1,0,0)；先平移到x=1再绕Y轴旋转90°，结果接近(0,0,-1)。两者不同，说明顺序不能交换。"
        },
        {
          "type": "paragraph",
          "text": "旋转矩阵中的正负号来自本例选用的坐标约定。角度滑块是度数，传给sin、cos之前转为弧度。代码里的model只含Y旋转，因此物体围绕自身原点转；想让物体绕另一个中心公转，应显式组合平移与旋转，不能期待同一个angle字段自动区分这两种含义。"
        },
        {
          "type": "paragraph",
          "text": "平移为什么能和旋转放进同一种乘法？普通三维矩阵乘法把原点映到原点，无法单靠3×3线性矩阵表达平移。齐次坐标给位置补上w=1，用4×4矩阵的最后一列加入平移；方向向量则常以w=0表示，不受平移项影响。这里所有输入都是位置，所以shader写vec4(aPosition,1.0)。如果以后把法线也这样补1，物体平移就会错误地改变法线。"
        },
        {
          "type": "paragraph",
          "text": "模型矩阵也可以有缩放。若把不同轴缩成不同倍数，位置的变换仍可直接相乘，但法线需要另外保持与表面切线垂直，一般使用模型视图线性部分的逆转置。这不在本例光照范围内，却说明了为什么“有了MVP就能处理所有顶点信息”不准确：不同几何量的变换规则要先从含义推导。"
        }
      ]
    },
    {
      "id": "projection",
      "title": "透视与正交：距离怎样影响屏幕大小",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "透视投影让近处看起来更大。矩阵中f=1/tan(fovy/2)，决定垂直视角；水平缩放再除以aspect。关键在第四行让w=-z_view：同样大小的横向坐标，离相机越远，后续除的w越大，NDC中的尺寸越小。这个“除以距离相关的w”才是近大远小的来源，不是把z当作额外颜色信息交给GPU。"
        },
        {
          "type": "paragraph",
          "text": "正交投影没有这种距离缩放。本例把左右范围设为±1.3×aspect，上下范围为±1.3；相机远近变化仍改变观察空间z，但只要物体留在近远裁剪面内，屏幕大小基本不变。工程里的CAD视图、二维界面投影与某些等距场景会用这种特性；它不比透视低级，只是在表达不同的观察需求。"
        },
        {
          "type": "paragraph",
          "text": "near与far是相机前方的正距离，本例设为0.1和10，而观察空间中对应点的z分别为-0.1和-10。CPU测试确认它们投影后分别得到NDC z=-1和+1。透视深度在距离上并不均匀；near过分接近0，会让可用深度精度分布更不利。不要把near设成0来表达“看得无限近”，那会破坏这套矩阵的条件。"
        },
        {
          "type": "paragraph",
          "text": "投影尺寸取canvas.width/canvas.height，而不是CSS容器的某个固定宽度。画布在高DPR设备上可能使用更多绘图像素，但两边同时按比例放大，aspect不变。代码把DPR上限设为2只是控制教学场景的像素开销；它不是每台设备通用的性能最优值，也没有代替真实GPU测量。"
        },
        {
          "type": "paragraph",
          "text": "还可以反推透视矩阵的两个深度系数。设裁剪z=A×z_view+B，而w=-z_view；要求z_view=-near时除以w得到-1，z_view=-far时得到+1，解出的A正是(far+near)/(near-far)，B是2×far×near/(near-far)。代码不是凭记忆填入一串神秘常数，而是在指定近远面映射后求得的结果。"
        },
        {
          "type": "paragraph",
          "text": "视角fovy的缩放也来自一个直角三角形：距离为d时，可见区域半高为d×tan(fovy/2)。点的y先乘倒数1/tan(fovy/2)，再除以d，刚好把这个边界映到NDC的±1。加大视角会让同一物体变小并带来更强透视感；移动相机则改变物体到镜头的距离，两者都能改变大小，却不完全等价。"
        }
      ]
    },
    {
      "id": "drawing",
      "title": "把矩阵送入GPU：完整场景怎样建立和绘制",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';\nimport {vertices,multiply,perspective,orthographic,translation,rotationY,type Options} from './data.js';\nexport const vertexShader=`#version 300 es\nlayout(location=0) in vec3 aPosition;\nlayout(location=1) in vec3 aColor;\nuniform mat4 uMvp;\nout vec3 vColor;\nvoid main(){gl_Position=uMvp*vec4(aPosition,1.0);vColor=aColor;}`;\nexport const fragmentShader=`#version 300 es\nprecision highp float;\nin vec3 vColor;\nout vec4 outColor;\nvoid main(){outColor=vec4(vColor,1.0);}`;\nexport function createScene(gl:WebGL2RenderingContext,options:Options):Scene {\n  const scope=new ResourceScope();\n  try {\n    const program=makeProgram(gl,scope,vertexShader,fragmentShader);\n    const vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v));\n    const buffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));\n    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);\n    gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);\n    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);\n    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);\n    const mvp=requiredUniform(gl,program,'uMvp');\n    return {draw(width,height,time){\n      const aspect=width/height;\n      const projection=options.projection==='perspective'?perspective(Math.PI/3,aspect,.1,10):orthographic(-1.3*aspect,1.3*aspect,-1.3,1.3,.1,10);\n      const model=rotationY((options.angle+(options.animate?time*.025:0))*Math.PI/180);\n      const view=translation(0,0,-options.camera);\n      gl.viewport(0,0,width,height);gl.clearColor(.035,.06,.09,1);gl.clearDepth(1);\n      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);\n      options.depth?gl.enable(gl.DEPTH_TEST):gl.disable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);\n      gl.useProgram(program);gl.bindVertexArray(vao);gl.uniformMatrix4fv(mvp,false,multiply(projection,multiply(view,model)));\n      gl.drawArrays(gl.TRIANGLES,0,6);\n    },dispose(){scope.dispose();}};\n  }catch(error){scope.dispose();throw error;}\n}\n",
          "language": "ts",
          "filename": "examples/webgl-3d-transforms/renderer.ts",
          "purpose": "完整渲染实现：GLSL300 es输入输出、顶点布局、P×V×M上传、清屏与深度控制都在这里。创建失败时回收已经分配的资源。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "每个顶点有六个float：位置xyz与颜色rgb，共24字节。属性0从偏移0读三个float，属性1从偏移12读三个float。顶点着色器乘矩阵后写gl_Position，片元着色器只把插值颜色输出。因此如果画面不对，先分别检查坐标、属性布局和矩阵，而不是一开始就怀疑颜色空间或纹理。"
        },
        {
          "type": "paragraph",
          "text": "uniformMatrix4fv的第二个参数在WebGL中必须是false。上传的矩阵可以每帧改变，几何缓冲则在初始化时上传一次。这里没有在RAF里反复createBuffer；draw只更新当前矩阵和必要状态。为让参数变化的生命周期容易观察，React参数改变会重建这个小场景；这是一种明确的教学取舍，不等于大型引擎必须对每个滑块都重建全部GPU资源。"
        },
        {
          "type": "reference",
          "title": "WebGL2与GLSL版本边界",
          "url": "https://registry.khronos.org/webgl/specs/2.0.0/",
          "note": "GLSL源码以#version 300 es开头，不能把旧文的attribute/varying/gl_FragColor直接混入此程序。"
        }
      ]
    },
    {
      "id": "depth",
      "title": "深度测试：把“先画后画”和“离相机远近”分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-3d-transforms/depth.svg",
          "title": "初始状态的可观察对照",
          "alt": "角度0°、相机Z=3。红色先画，蓝色后画；深度启用时中心重叠处预期保留较近红色，关闭后预期被后画蓝色覆盖。",
          "caption": "角度0°、相机Z=3。红色先画，蓝色后画；深度启用时中心重叠处预期保留较近红色，关闭后预期被后画蓝色覆盖。"
        },
        {
          "type": "paragraph",
          "text": "深度缓冲为每个像素样本保存一个深度值。我们每次draw先clearDepth(1)，同时清颜色和深度，再启用DEPTH_TEST并使用LESS。红色片元通过后写入较小深度，后来的蓝色片元如果更远，就不能覆盖它。关闭深度比较后，普通不透明颜色写入按绘制顺序覆盖，蓝色后画便占据重叠区域。"
        },
        {
          "type": "paragraph",
          "text": "只启用深度测试却忘了清深度，会让上一帧的数据干扰下一帧。只调用clearColor也不会清掉深度附件。另一个常见问题是两张几乎共面的面片反复闪烁：深度精度有限，不能可靠区分极小差值，这类z-fighting需要检查near/far、几何重叠与绘制策略，不能用“GPU随机了”解释。"
        },
        {
          "type": "paragraph",
          "text": "旋转后，三角形上不同片元的距离发生变化；我们不承诺“红色永远在前”。要验证初始结论，先重置角度。透明几何又多一层颜色混合顺序，本篇只画不透明三角形；不能从这里的深度结果直接推出半透明物体可以任意排序。"
        },
        {
          "type": "paragraph",
          "text": "深度测试还依赖上下文确实提供深度附件。通常创建上下文默认请求depth，本例沿用这个默认；如果浏览器环境特殊，应检查getContextAttributes与DEPTH_BITS，而不是只看到enable调用就认定有足够精度。默认深度写入开启，本例没有改变depthMask；后续加入透明阶段时，要显式恢复状态，避免下一帧清深度或写入行为受到遗留状态影响。"
        },
        {
          "type": "paragraph",
          "text": "CPU测试中比较两个中心点的投影深度，只证明这两个点在所选矩阵下的前后关系；它没有计算三角形每个片元的覆盖、插值与深度精度。真正的中心像素实验才走完整管线。区分这两种证据，可以防止用一段正确矩阵测试替代所有GPU行为，也能在排错时明确下一步该观察哪一层。"
        }
      ]
    },
    {
      "id": "lifecycle",
      "title": "资源和上下文：CPU对象还在，不代表GPU资源仍有效",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export class ResourceScope {\n  private cleanups:Array<()=>void>=[];\n  private disposed=false;\n  own<T>(value:T|null,drop:(value:T)=>void):T {\n    if(value===null)throw new Error('GPU资源分配失败');\n    if(this.disposed){drop(value);throw new Error('资源作用域已经关闭');}\n    this.cleanups.push(()=>drop(value));return value;\n  }\n  dispose(){if(this.disposed)return;this.disposed=true;for(const drop of this.cleanups.reverse())drop();this.cleanups=[];}\n}\nexport function makeProgram(gl:WebGL2RenderingContext,scope:ResourceScope,vertex:string,fragment:string){\n  const compile=(type:number,source:string)=>{\n    const shader=scope.own(gl.createShader(type),s=>gl.deleteShader(s));\n    gl.shaderSource(shader,source);gl.compileShader(shader);\n    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'着色器编译失败');\n    return shader;\n  };\n  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);\n  const program=scope.own(gl.createProgram(),p=>gl.deleteProgram(p));\n  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);\n  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'程序链接失败');\n  return program;\n}\nexport function requiredUniform(gl:WebGL2RenderingContext,program:WebGLProgram,name:string){\n  const location=gl.getUniformLocation(program,name);\n  if(location===null)throw new Error('未找到活动uniform: '+name);return location;\n}\nexport function frameSize(width:number,height:number,dpr:number){\n  if(![width,height,dpr].every(Number.isFinite)||width<=0||height<=0||dpr<=0)throw new RangeError('画布尺寸无效');\n  const ratio=Math.min(dpr,2);return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))] as const;\n}\nexport type Scene={draw:(width:number,height:number,time:number)=>void;dispose:()=>void};\n\n// Retire a scene while its context is lost, before restoration changes generation.\nexport class SceneSlot {\n  current:Scene|undefined;\n  clear(){const previous=this.current;this.current=undefined;previous?.dispose();}\n}\n",
          "language": "ts",
          "filename": "examples/webgl-3d-transforms/gl-utils.ts",
          "purpose": "资源所有权与程序编译的完整公共模块。ResourceScope只管理本例创建的句柄；失败、参数重建和卸载共用同一套dispose。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "shader、program、buffer、VAO由createScene这一层拥有，反向清理并且只执行一次。编译和链接失败时也会走清理路径，错误日志保留在界面。CPU假GL测试检查“创建了哪些句柄、失败后是否逐一删除”，这证明所有权逻辑，不证明真正驱动接受了GLSL或已经画出三角形。"
        },
        {
          "type": "code",
          "code": "export default function App(){\n  const canvasRef=React.useRef<HTMLCanvasElement>(null);\n  const control=React.useRef<{probe:()=>void;lose:()=>void;restore:()=>void}|null>(null);\n  const [options,setOptions]=React.useState<Options>(defaults);\n  const [epoch,setEpoch]=React.useState(0),[lost,setLost]=React.useState(false);\n  const [status,setStatus]=React.useState('等待WebGL2初始化'),[evidence,setEvidence]=React.useState('尚未读取真实像素');\n  const change=(patch:Partial<Options>)=>setOptions(old=>({...old,...patch}));\n  React.useEffect(()=>{\n    const canvas=canvasRef.current;if(!canvas)return;\n    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});\n    if(!gl){setStatus('此浏览器或设备无法创建WebGL2；CPU测试不能代替GPU运行');return;}\n    const scenes=new SceneSlot();\n    let raf=0,dead=false;\n    const extension=gl.getExtension('WEBGL_lose_context');\n    const drawFrame=(time=performance.now())=>{\n      if(dead||gl.isContextLost()||!scenes.current)return;\n      const rect=canvas.getBoundingClientRect(),[width,height]=frameSize(Math.max(1,rect.width),Math.max(1,rect.height),window.devicePixelRatio||1);\n      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}\n      scenes.current.draw(width,height,time);\n    };\n    const loop=(time:number)=>{drawFrame(time);if(!dead&&!gl.isContextLost())raf=requestAnimationFrame(loop);};\n    const onLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);scenes.clear();setLost(true);setStatus('WebGL上下文已丢失，旧GPU资源不能继续使用');};\n    const onRestored=()=>{setLost(false);setEpoch(value=>value+1);};\n    canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);\n    const onResize=()=>drawFrame();\n    window.addEventListener('resize',onResize);\n    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(onResize);observer?.observe(canvas);\n    try {\n      gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);\n      scenes.current=createScene(gl,options);drawFrame();setStatus('WebGL2场景已建立；请读取像素与错误码核验当前设备');\n      if(options.animate)raf=requestAnimationFrame(loop);\n    }catch(error){setStatus(error instanceof Error?error.message:'初始化失败');}\n    control.current={probe(){\n      if(!scenes.current||gl.isContextLost()){setEvidence('当前没有可读的场景');return;}\n      drawFrame();const rgba=new Uint8Array(4);\n      gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);\n      setEvidence(JSON.stringify({rgba:[...rgba],glError:gl.getError(),version:gl.getParameter(gl.VERSION),size:[canvas.width,canvas.height]}));\n    },lose(){if(extension)extension.loseContext();else setEvidence('此环境没有WEBGL_lose_context扩展');},restore(){if(extension)extension.restoreContext();}};\n    return ()=>{dead=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',onResize);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);control.current=null;scenes.clear();};\n  },[options,epoch]);\n  return <main style={{fontFamily:'system-ui',padding:16,maxWidth:840,margin:'auto',color:'#16352b'}}>\n    <h1>三维变换与深度</h1>\n    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>\n<label>Y轴角度 {options.angle}°<input type=\"range\" min=\"-80\" max=\"80\" value={options.angle} onChange={e=>change({angle:+e.target.value})}/></label>\n<label>相机Z {options.camera}<input type=\"range\" min=\"2.2\" max=\"5\" step=\"0.1\" value={options.camera} onChange={e=>change({camera:+e.target.value})}/></label>\n<label>投影<select value={options.projection} onChange={e=>change({projection:e.target.value as Options['projection']})}><option value=\"perspective\">透视</option><option value=\"orthographic\">正交</option></select></label>\n<label><input type=\"checkbox\" checked={options.depth} onChange={e=>change({depth:e.target.checked})}/>深度测试</label>\n<label><input type=\"checkbox\" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续旋转</label>\n    </fieldset>\n    <canvas ref={canvasRef} aria-label=\"WebGL2交互场景\" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>\n    <p role=\"status\">{status}</p>\n    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取中心像素</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>\n    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>\n    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>\n  </main>;\n}\n",
          "language": "tsx",
          "filename": "examples/webgl-3d-transforms/view.tsx.txt",
          "purpose": "完整React视图，构建时与上面三个模块拼成仅import React的App.tsx。重点看RAF取消、resize监听解除、contextlost preventDefault与restored后重建；独立npm入口另有browser.tsx。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "上下文丢失不是一次普通颜色参数变化。旧GPU对象不再可用，要停止帧循环；允许恢复后，从CPU保留的数据重新创建程序和缓冲。这里在webglcontextlost中preventDefault，立即清空SceneSlot并dispose旧场景，收到restored再增加epoch触发重建；不能把旧句柄留到恢复后的effect清理才删除。恢复是否获准取决于浏览器与设备，按钮发出的请求不等于系统保证立刻恢复。"
        },
        {
          "type": "paragraph",
          "text": "“读取中心像素”会先同步draw，再立即readPixels，避免把默认绘图缓冲的长期保留当作前提。输出RGBA、getError与WebGL版本可以作为这一台设备的实测证据；getError=0只表示此前待报告GL错误为空，仍需结合图像、参数变化与上下文恢复观察，不能把单个0当作整篇算法正确的证明。"
        },
        {
          "type": "paragraph",
          "text": "上下文恢复还要注意对象代际：丢失会使旧句柄失效，恢复后再删除旧代句柄可能产生INVALID_OPERATION。视图在lost事件里就清空SceneSlot并释放旧场景，epoch变化后的重复清理因此为空操作，再创建新代资源。代际假GL回归先演示旧顺序的失效删除，再验证新顺序不会跨代删除；它不代替真实GPU恢复后的首次像素/错误码检查，也没有读取getError来隐藏错误。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行、对照与失败定位：把每条结论变成可检查的步骤",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/webgl-3d-transforms\nnpm ci\nnpm test\nnpm run dev\n# 打开 http://127.0.0.1:4331/\n# 结束时按 Ctrl+C；端口占用会报错，不自动切换端口。",
          "language": "bash",
          "filename": "终端",
          "purpose": "ZIP解压后在该目录执行；若已在示例目录，省略第一行。Node.js22.12.0。",
          "kind": "runnable"
        },
        {
          "type": "experiment",
          "id": "webgl-3d-transforms",
          "title": "交互验证：距离、投影与深度分别改变什么",
          "description": "独立React18.3.1场景，只导入React。右上控件更改参数；读取像素会输出当前设备的RGBA、WebGL版本和错误码。上下文丢失与恢复按钮用于检查资源重建。"
        },
        {
          "type": "list",
          "items": [
            "重置到0°、透视、相机Z=3、深度开启。读取中心像素，预期红色分量占优，错误码0；记录当前浏览器版本与设备。",
            "关闭深度再读，预期中心变为蓝色分量占优。重新开启，回到红色；这一步隔离深度与绘制顺序。",
            "把相机Z从3改到5，透视下三角形变小；切为正交再改变相机，大小保持，裁剪边界除外。",
            "开启连续旋转，调整窗口，确认比例与像素尺寸更新；再关闭旋转，离开实验，确认不再有本例RAF。",
            "模拟丢失，界面提示且停止绘制；请求恢复后重建，再读像素。扩展不可用时记录实际条件，不把没有事件算通过。"
          ],
          "ordered": true
        },
        {
          "type": "paragraph",
          "text": "本地已通过14项Node测试：矩阵顺序、近远面映射、aspect、无效参数、深度前后关系、着色器失败回收、重复dispose、SSR与自足源码同步。macOS14.5/Node22.12.0下完成npm ci与编译，并实际通过本地HTTP提供JS。这里的CPU记录不宣称GPU图像或手机渲染通过，真实浏览器记录由发布验收另外补齐。"
        },
        {
          "type": "table",
          "headers": [
            "现象",
            "先检查的证据"
          ],
          "rows": [
            [
              "只有背景色",
              "状态栏编译/链接日志、VAO属性、是否创建WebGL2"
            ],
            [
              "拉伸或宽高不对",
              "绘图缓冲宽高、aspect、viewport是否一致"
            ],
            [
              "靠近相机后突然切掉",
              "观察空间z与near，不要先改矩阵正负号"
            ],
            [
              "旋转有拖影或片元消失",
              "是否同时清COLOR/DEPTH、深度状态是否遗留"
            ],
            [
              "恢复后黑屏",
              "是否重新创建program/VAO/buffer，而非继续使用旧句柄"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "继续扩展前，建议先把一个顶点在每个空间中的四维坐标打印出来，逐步与图对照。想加入法线和光照时，还需要解释法线变换与插值；本例没有偷偷用一个漂亮立方体把这些前提藏起来。先把坐标和深度的因果关系验证清楚，后面的几何、纹理和复杂场景才有可靠的基础。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Khronos WebGL2.0.0文档快照（页面仍标为draft）",
      "url": "https://registry.khronos.org/webgl/specs/2.0.0/"
    },
    {
      "title": "GLSL ES3.00 revision6",
      "url": "https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf"
    },
    {
      "title": "MDN：上下文丢失事件",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event"
    }
  ]
};
export default article;
