import type { Article } from '../../articleTypes';
const article:Article={
  "id": "webgl-geometry-buffers",
  "topic": "webgl",
  "title": "几何与 GPU 数据：属性、索引缓冲和实例化",
  "description": "从字节记录与属性读取规则出发，构造一个索引四边形，再用每实例偏移画出多份几何；明确stride、offset、divisor与draw计数，提供越界拒绝及资源回收验证。",
  "minutes": 55,
  "labMinutes": 35,
  "tags": [
    "WebGL2",
    "顶点属性",
    "索引缓冲",
    "VAO",
    "实例化",
    "数据布局"
  ],
  "scope": "WebGL2/GLSL ES3.00中的浮点顶点属性、Uint16索引、VAO与实例化；完整二维彩色四边形场景。不涉及骨骼动画、压缩格式、分布式资源加载与未测量的性能收益。",
  "prerequisites": [
    "知道顶点与片元着色器的分工",
    "能读TypedArray；已了解NDC与viewport不是同一层坐标"
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
      "path": "webgl-geometry-buffers.zip"
    },
    {
      "label": "运行说明与实际验证边界",
      "path": "webgl-geometry-buffers/README.md"
    }
  ],
  "sections": [
    {
      "id": "records",
      "title": "GPU几何是什么：数据记录与读取方式共同组成模型",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "GPU几何通常由顶点属性、图元连接关系和绘制参数组成。顶点属性不只有位置，还可以有颜色、法线和UV；连接关系决定这些属性记录怎样组成点、线或三角形。缓冲区只是一段GPU可读取的字节存储，自己不知道“第几个float是颜色”。应用必须把属性布局与着色器输入对应起来。"
        },
        {
          "type": "paragraph",
          "text": "这正是vertexAttribPointer的作用：给某个属性位置记录“从哪个缓冲、每次读几个分量、相邻记录隔多少字节、从哪里开始”。这里先理解描述规则，再写一张四边形。例子会复用四条顶点记录组成两个三角形，随后用实例数据把同一份几何画到三个位置。这样能分别看清顶点、索引和实例三种步进。"
        },
        {
          "type": "paragraph",
          "text": "我们沿用WebGL2与GLSL ES3.00，不把WebGL1的ANGLE_instanced_arrays扩展调用混进来。所有几何都在程序里生成，没有模型下载或解析。画面只用NDC平面位置，因此四边形在4:3画布上不承诺像素宽高相等；三维投影与aspect校正在前一篇单独解释。"
        },
        {
          "type": "figure",
          "src": "figures/webgl-geometry-buffers/layout.svg",
          "title": "缓冲保存字节，VAO保存怎样读",
          "alt": "位置与颜色共享80字节顶点缓冲；索引使用另一个12字节缓冲；实例偏移又使用一个24字节缓冲。箭头指属性描述引用数据，而不是复制全部顶点。",
          "caption": "位置与颜色共享80字节顶点缓冲；索引使用另一个12字节缓冲；实例偏移又使用一个24字节缓冲。箭头指属性描述引用数据，而不是复制全部顶点。"
        }
      ]
    },
    {
      "id": "layout",
      "title": "属性结构：stride与offset都以字节计算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例一个顶点记录由position.xy和color.rgb组成，共五个32位float，因此stride是20字节。位置从偏移0读两个float，颜色从偏移8读三个float。第i个顶点颜色的起点是i×20+8；结束位置再加12。最后一条记录i=3的颜色结束于80，刚好落在整个Float32Array的字节长度边界上。"
        },
        {
          "type": "code",
          "code": "export const mesh=new Float32Array([\n  -.24,-.3, 1,.25,.1, .24,-.3, .1,.85,.35,\n  .24,.3, .1,.4,1, -.24,.3, .9,.7,.1,\n]);\nexport const indices=new Uint16Array([0,1,2,0,2,3]);\nexport const offsets=new Float32Array([-.65,0, 0,0, .65,0]);\nexport function validateMesh(data:Float32Array,elements:Uint16Array,instances:number,instanceData:Float32Array){\n  const strideBytes=20,vertexCount=data.byteLength/strideBytes;\n  if(!Number.isInteger(vertexCount)||vertexCount===0)throw new RangeError('顶点记录必须完整');\n  if(!Number.isInteger(instances)||instances<1||instances>3||instanceData.length<instances*2)throw new RangeError('实例记录不足');\n  if(elements.length===0||elements.length%3!==0)throw new RangeError('三角形索引不完整');\n  for(const index of elements)if(index>=vertexCount)throw new RangeError('索引超过顶点记录数');\n  return {strideBytes,vertexCount,indexCount:elements.length,instanceCount:instances};\n}\nexport function attributeByteEnd(vertexIndex:number,stride:number,offset:number,components:number){\n  if(![vertexIndex,stride,offset,components].every(Number.isInteger)||vertexIndex<0||stride<=0||offset<0||components<1||components>4||offset+components*4>stride)throw new RangeError('属性布局无效');\n  return vertexIndex*stride+offset+components*4;\n}\nexport type Options={instances:number;invalid:boolean;animate:boolean};\nexport const defaults:Options={instances:3,invalid:false,animate:false};\n",
          "language": "ts",
          "filename": "examples/webgl-geometry-buffers/data.ts",
          "purpose": "完整几何数据、布局与容量检查。validateMesh针对本篇固定格式，不声称是任意WebGL布局的通用验证器。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "把stride错写成5，会让GPU按五个字节跨记录，而不是五个float；把颜色offset写成2也不是“第二个float”，它需要满足类型对齐并且表达正确的字节位置。浏览器可能报告INVALID_OPERATION，或者布局仍合法却读出错误颜色。后一种不会自动变成GL错误，因此必须同时检查画面和数据推导。"
        },
        {
          "type": "paragraph",
          "text": "attributeByteEnd函数是一个辅助算式，专门对应这里的float交错记录。它检查一条属性在本例记录内能否放下；它不覆盖half-float、整数属性、压缩数据和所有跨缓冲组合。严格的通用加载器要根据类型大小、stride为0时的紧密布局、各属性divisor与绘制范围分别验证，不能把这几行函数包装成所有模型都安全的证据。"
        },
        {
          "type": "table",
          "headers": [
            "调用字段",
            "本例位置属性",
            "本例颜色属性"
          ],
          "rows": [
            [
              "location",
              "0",
              "1"
            ],
            [
              "size",
              "2",
              "3"
            ],
            [
              "type / normalized",
              "FLOAT / false",
              "FLOAT / false"
            ],
            [
              "stride（字节）",
              "20",
              "20"
            ],
            [
              "offset（字节）",
              "0",
              "8"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "对于整数压缩颜色，常见方式是Uint8存储并使用normalized=true，让定点值映到浮点范围；如果着色器输入本身是整数向量，则需要理解vertexAttribIPointer的整数路径。本篇全部使用Float32Array与vec输入，故normalized对这些浮点值没有归一化效果，不能拿这里的false推出所有属性都该关闭归一化。"
        },
        {
          "type": "reference",
          "title": "vertexAttribPointer的字节布局约定",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer"
        },
        {
          "type": "paragraph",
          "text": "这里使用交错布局，把同一顶点的不同属性连续放在一起。另一种做法是位置、颜色分别放入不同缓冲，属性指针使用各自的stride。交错布局便于一次上传完整顶点，分离布局便于只更新会变化的属性；读取局部性与更新代价都需要具体测量。选择一种布局后，应把字节约定写下来，不让模型生产方和渲染方各自猜测。"
        },
        {
          "type": "paragraph",
          "text": "缓冲大小也不是浏览器自动替你限制的产品预算。四条记录只有80字节，但外部模型可能带来数百万顶点与多套属性；即使每个索引合法，总字节数仍可能超出内存预算。实际资源入口应在分配TypedArray和上传之前限制数量、分量和累计体积，失败时保留可追踪的模型ID，而不是在GPU分配失败后才开始寻找来源。"
        }
      ]
    },
    {
      "id": "indices",
      "title": "索引选择整条顶点记录：四个点怎样拼成两个三角形",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-geometry-buffers/draw.svg",
          "title": "索引与实例复用的是不同层次的数据",
          "alt": "索引选择四条顶点中的记录，实例再复用这组图元。绘制参数count是索引项数6，不是独立顶点数4。",
          "caption": "索引选择四条顶点中的记录，实例再复用这组图元。绘制参数count是索引项数6，不是独立顶点数4。"
        },
        {
          "type": "paragraph",
          "text": "两个三角形使用索引0,1,2与0,2,3。共同的角点0和2不用复制第二份属性记录，索引本身则仍有六项。drawElements的count表示要消费多少个索引；type=UNSIGNED_SHORT说明每项占两字节；offset是索引缓冲的字节起点，必须按对应类型对齐。这里offset=0，不是“第0个顶点的地址”。"
        },
        {
          "type": "paragraph",
          "text": "索引复用的是全部按顶点步进的属性，不只有position。如果一个立方体角点在不同面上需要不同法线，或者UV在纹理接缝两侧不同，它们虽然空间位置相同，却不能直接共享同一条完整顶点记录。应该拆记录再分别索引。只按xyz坐标去重，会把光照边界或纹理接缝合错。"
        },
        {
          "type": "paragraph",
          "text": "本例只用Uint16，最大可表达索引值是65535，但实际合法范围还要看缓冲里到底有多少条记录：这里只有四条，所以索引4已经越界。大型模型在WebGL2可使用UNSIGNED_INT与Uint32Array，或拆成多批；不能简单把TypedArray换大却忘记修改draw参数里的type以及字节对齐。"
        },
        {
          "type": "paragraph",
          "text": "索引并不保证所有场景都更快。索引缓存、顶点着色器工作量、数据局部性与额外索引带宽都会影响结果。对于只有一个三角形的模型，建立索引可能只是增加一层数据；对于共享大量属性的网格，它通常能避免重复存储。本篇测的是读取规则和结果，不发布“节省多少帧”的虚构对比。"
        },
        {
          "type": "paragraph",
          "text": "还要注意WebGL2的固定索引图元重启规则：所选索引类型的最大值被用作重启标记。Uint16虽然能存65535，这个值在对应绘制语义中不是普通顶点索引；若需要引用更多记录，应选择适当类型与分批策略。本例最大索引只有3，因此没有触发这个边界。先说“能表达多少数字”，再说“绘制怎样解释它”，才不会把存储范围和语义范围混为一谈。"
        },
        {
          "type": "paragraph",
          "text": "索引可能使实现复用顶点处理结果，但不要据此断言“索引0出现两次，顶点着色器一定只运行一次”。缓存策略与执行细节属于实现空间，不能依赖它产生业务副作用。顶点着色器应当从当前属性和uniform计算输出；本例用索引证明连接关系，不通过猜测shader调用次数证明正确性。"
        }
      ]
    },
    {
      "id": "vao",
      "title": "VAO记录什么：ARRAY_BUFFER绑定与ELEMENT_ARRAY_BUFFER绑定的区别",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';\nimport {mesh,indices,offsets,validateMesh,type Options} from './data.js';\nexport const vertexShader=`#version 300 es\nlayout(location=0) in vec2 aPosition;\nlayout(location=1) in vec3 aColor;\nlayout(location=2) in vec2 aOffset;\nuniform float uAngle;\nout vec3 vColor;\nvoid main(){\n  float c=cos(uAngle),s=sin(uAngle);\n  vec2 p=mat2(c,s,-s,c)*aPosition+aOffset;\n  gl_Position=vec4(p,0.0,1.0);vColor=aColor;\n}`;\nexport const fragmentShader=`#version 300 es\nprecision highp float;\nin vec3 vColor;\nout vec4 outColor;\nvoid main(){outColor=vec4(vColor,1.0);}`;\nexport function createScene(gl:WebGL2RenderingContext,options:Options):Scene {\n  const elements=options.invalid?new Uint16Array([0,1,4]):indices;\n  const counts=validateMesh(mesh,elements,options.instances,offsets);\n  const scope=new ResourceScope();\n  try {\n    const program=makeProgram(gl,scope,vertexShader,fragmentShader);\n    const vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v));\n    const vertexBuffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));\n    const indexBuffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));\n    const instanceBuffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));\n    gl.bindVertexArray(vao);\n    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);\n    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,20,0);\n    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,20,8);\n    gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,offsets,gl.STATIC_DRAW);\n    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,8,0);gl.vertexAttribDivisor(2,1);\n    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,elements,gl.STATIC_DRAW);\n    const angle=requiredUniform(gl,program,'uAngle');\n    return {draw(width,height,time){\n      gl.viewport(0,0,width,height);gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT);\n      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(vao);\n      gl.uniform1f(angle,options.animate?time*.0005:0);\n      gl.drawElementsInstanced(gl.TRIANGLES,counts.indexCount,gl.UNSIGNED_SHORT,0,counts.instanceCount);\n    },dispose(){scope.dispose();}};\n  }catch(error){scope.dispose();throw error;}\n}\n",
          "language": "ts",
          "filename": "examples/webgl-geometry-buffers/renderer.ts",
          "purpose": "完整着色器、VAO配置与实例绘制。三个缓冲的绑定顺序、属性divisor与索引类型都在正文可见。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "VAO保存属性是否开启、属性格式、关联的顶点缓冲，以及元素索引缓冲绑定等状态。调用vertexAttribPointer时，当前ARRAY_BUFFER会进入该属性的描述。此后单纯把ARRAY_BUFFER绑定为另一只buffer，不会自动把已经设置好的颜色属性改过去；必须在正确VAO下重新设置属性指针。"
        },
        {
          "type": "paragraph",
          "text": "ELEMENT_ARRAY_BUFFER的绑定本身则属于当前VAO状态。教学代码先bindVertexArray，再绑定索引缓冲；绘制时绑定同一个VAO，就能取得正确索引对象。若在VAO仍绑定时把元素缓冲绑定成null，相当于改掉它的索引状态，下一次drawElements可能失去所需缓冲。不要把“解绑全部对象”当成不影响状态的惯例。"
        },
        {
          "type": "paragraph",
          "text": "着色器使用layout(location=...)固定属性位置，避免CPU代码与驱动分配的位置对不上。真实引擎也可在链接前绑定位置或链接后查询，但这需要另一套显式约定。uniform仍然查询并检查是否存在；优化掉或拼错名称的uniform不应悄悄继续使用。"
        }
      ]
    },
    {
      "id": "instancing",
      "title": "实例化：同一套索引，哪些属性按实例前进",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "实例化让一次绘制调用处理多份同类几何。这里location0的位置和location1的颜色都保持默认divisor=0，按顶点索引读取；location2偏移的divisor设为1，每个实例前进一条记录。实例0的偏移是(-0.65,0)，实例1是(0,0)，实例2是(0.65,0)。顶点着色器把旋转后的局部位置加上这一份偏移。"
        },
        {
          "type": "paragraph",
          "text": "drawElementsInstanced的最后一个参数是实例数量，与前面的索引数量相互独立。设为2时，只画前两份偏移对应的几何；设为3时画三份。divisor大于1表示多个实例共享一条属性记录，并不是把几何整体缩小。GLSL也提供gl_InstanceID，适合按实例编号计算一部分数据，但编号本身不会自动查出位置或材质。"
        },
        {
          "type": "paragraph",
          "text": "如果忘了设置divisor，偏移会按顶点索引读取。我们只有三条偏移却有索引3，便会出现属性容量不足；即使多补一条记录让容量合法，形状也会因每个角点读到不同偏移而扭曲。这个问题不应靠增加随机padding“修好”，而要先判断此属性应该随哪个层次变化。"
        },
        {
          "type": "paragraph",
          "text": "一次实例绘制可以减少CPU提交多次draw的开销，但顶点着色、光栅化、片元计算和过度绘制仍然存在。材质、纹理、混合方式不同的对象还需要分组或更复杂的数据布局。是否值得实例化，应在具体场景测量CPU与GPU时间；这里三个四边形只用于解释机制，不足以推导真实产品的性能结论。"
        },
        {
          "type": "reference",
          "title": "drawElementsInstanced参数与divisor关系",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawElementsInstanced"
        },
        {
          "type": "paragraph",
          "text": "如果每个实例需要完整模型矩阵，mat4属性会占四个连续的属性位置，每列都要设置指针和divisor。这会消耗更多属性槽与实例带宽，因此应查询设备限制，必要时选择其他数据组织方式。当前例子只需要两个float的偏移，故意避免一开始就引入矩阵属性，让“按实例前进”这一条机制可以单独验证。"
        },
        {
          "type": "paragraph",
          "text": "更新数据也要区分对象数量与内容变化。静态几何可一次bufferData上传；少量动态实例偏移可以复用缓冲并更新局部，而不是每帧创建新缓冲。STATIC_DRAW只是使用方式提示，不能把它当成禁止更新或保证性能的强制语义。本例动画只更新uniform，不修改几何数据，验证范围中不包含高频动态实例上传的吞吐能力。"
        }
      ]
    },
    {
      "id": "failure",
      "title": "失败路径：错误的数据在上传之前就被拒绝",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "勾选“构造越界索引”后，示例把元素改成[0,1,4]，仍只有四条顶点记录。validateMesh在分配任何GPU资源之前抛出RangeError，界面显示“索引超过顶点记录数”，画面只剩已清理的背景。这个操作验证的是应用边界，不是浏览器真的成功绘制了坏索引；测试也断言没有创建GPU句柄。"
        },
        {
          "type": "paragraph",
          "text": "安全边界有两层：应用尽早验证可预见的数据问题，WebGL实现仍负责自己的有效性检查。CPU校验不等于可以跳过浏览器检查，也不能穷尽驱动行为。接收外部模型时还要限制总字节数、实例上限、属性数和资源预算；本例实例数限制为1～3，正好对应已交付的实例数组容量。"
        },
        {
          "type": "paragraph",
          "text": "创建program、VAO或buffer途中失败，要释放已经创建的对象；正常离开页面也要清理。所有权不应由“调用了多少个API”决定，而应能回答每个句柄由谁删除。下面的公共模块与视图展示完整收尾，参数变化后也会先释放上一个场景，避免重复分配不断累积。"
        },
        {
          "type": "code",
          "code": "export class ResourceScope {\n  private cleanups:Array<()=>void>=[];\n  private disposed=false;\n  own<T>(value:T|null,drop:(value:T)=>void):T {\n    if(value===null)throw new Error('GPU资源分配失败');\n    if(this.disposed){drop(value);throw new Error('资源作用域已经关闭');}\n    this.cleanups.push(()=>drop(value));return value;\n  }\n  dispose(){if(this.disposed)return;this.disposed=true;for(const drop of this.cleanups.reverse())drop();this.cleanups=[];}\n}\nexport function makeProgram(gl:WebGL2RenderingContext,scope:ResourceScope,vertex:string,fragment:string){\n  const compile=(type:number,source:string)=>{\n    const shader=scope.own(gl.createShader(type),s=>gl.deleteShader(s));\n    gl.shaderSource(shader,source);gl.compileShader(shader);\n    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'着色器编译失败');\n    return shader;\n  };\n  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);\n  const program=scope.own(gl.createProgram(),p=>gl.deleteProgram(p));\n  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);\n  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'程序链接失败');\n  return program;\n}\nexport function requiredUniform(gl:WebGL2RenderingContext,program:WebGLProgram,name:string){\n  const location=gl.getUniformLocation(program,name);\n  if(location===null)throw new Error('未找到活动uniform: '+name);return location;\n}\nexport function frameSize(width:number,height:number,dpr:number){\n  if(![width,height,dpr].every(Number.isFinite)||width<=0||height<=0||dpr<=0)throw new RangeError('画布尺寸无效');\n  const ratio=Math.min(dpr,2);return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))] as const;\n}\nexport type Scene={draw:(width:number,height:number,time:number)=>void;dispose:()=>void};\n\n// Retire a scene while its context is lost, before restoration changes generation.\nexport class SceneSlot {\n  current:Scene|undefined;\n  clear(){const previous=this.current;this.current=undefined;previous?.dispose();}\n}\n",
          "language": "ts",
          "filename": "examples/webgl-geometry-buffers/gl-utils.ts",
          "purpose": "完整作用域与着色器编译逻辑。失败日志、null分配与幂等清理是可复现的错误边界，不用真实GPU跑假数据来证明。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "export default function App(){\n  const canvasRef=React.useRef<HTMLCanvasElement>(null);\n  const control=React.useRef<{probe:()=>void;lose:()=>void;restore:()=>void}|null>(null);\n  const [options,setOptions]=React.useState<Options>(defaults);\n  const [epoch,setEpoch]=React.useState(0),[lost,setLost]=React.useState(false);\n  const [status,setStatus]=React.useState('等待WebGL2初始化'),[evidence,setEvidence]=React.useState('尚未读取真实像素');\n  const change=(patch:Partial<Options>)=>setOptions(old=>({...old,...patch}));\n  React.useEffect(()=>{\n    const canvas=canvasRef.current;if(!canvas)return;\n    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});\n    if(!gl){setStatus('此浏览器或设备无法创建WebGL2；CPU测试不能代替GPU运行');return;}\n    const scenes=new SceneSlot();\n    let raf=0,dead=false;\n    const extension=gl.getExtension('WEBGL_lose_context');\n    const drawFrame=(time=performance.now())=>{\n      if(dead||gl.isContextLost()||!scenes.current)return;\n      const rect=canvas.getBoundingClientRect(),[width,height]=frameSize(Math.max(1,rect.width),Math.max(1,rect.height),window.devicePixelRatio||1);\n      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}\n      scenes.current.draw(width,height,time);\n    };\n    const loop=(time:number)=>{drawFrame(time);if(!dead&&!gl.isContextLost())raf=requestAnimationFrame(loop);};\n    const onLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);scenes.clear();setLost(true);setStatus('WebGL上下文已丢失，旧GPU资源不能继续使用');};\n    const onRestored=()=>{setLost(false);setEpoch(value=>value+1);};\n    canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);\n    const onResize=()=>drawFrame();\n    window.addEventListener('resize',onResize);\n    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(onResize);observer?.observe(canvas);\n    try {\n      gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);\n      scenes.current=createScene(gl,options);drawFrame();setStatus('WebGL2场景已建立；请读取像素与错误码核验当前设备');\n      if(options.animate)raf=requestAnimationFrame(loop);\n    }catch(error){setStatus(error instanceof Error?error.message:'初始化失败');}\n    control.current={probe(){\n      if(!scenes.current||gl.isContextLost()){setEvidence('当前没有可读的场景');return;}\n      drawFrame();const rgba=new Uint8Array(4);\n      gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);\n      setEvidence(JSON.stringify({rgba:[...rgba],glError:gl.getError(),version:gl.getParameter(gl.VERSION),size:[canvas.width,canvas.height]}));\n    },lose(){if(extension)extension.loseContext();else setEvidence('此环境没有WEBGL_lose_context扩展');},restore(){if(extension)extension.restoreContext();}};\n    return ()=>{dead=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',onResize);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);control.current=null;scenes.clear();};\n  },[options,epoch]);\n  return <main style={{fontFamily:'system-ui',padding:16,maxWidth:840,margin:'auto',color:'#16352b'}}>\n    <h1>顶点、索引与实例化</h1>\n    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>\n<label>实例数 {options.instances}<input type=\"range\" min=\"1\" max=\"3\" value={options.instances} onChange={e=>change({instances:+e.target.value})}/></label>\n<label><input type=\"checkbox\" checked={options.invalid} onChange={e=>change({invalid:e.target.checked})}/>构造越界索引（CPU拒绝）</label>\n<label><input type=\"checkbox\" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续旋转</label>\n<p>顶点4条 × 20字节；索引6个 × 2字节；实例偏移每条8字节。NDC单位，未做像素等比例校正。</p>\n    </fieldset>\n    <canvas ref={canvasRef} aria-label=\"WebGL2交互场景\" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>\n    <p role=\"status\">{status}</p>\n    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取中心像素</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>\n    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>\n    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>\n  </main>;\n}\n",
          "language": "tsx",
          "filename": "examples/webgl-geometry-buffers/view.tsx.txt",
          "purpose": "完整React容器：字段约束、CPU错误展示、DPR尺寸、RAF、readPixels、上下文恢复与卸载清理。构建生成自足App.tsx。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "上下文恢复还要注意对象代际：丢失会使旧句柄失效，恢复后再删除旧代句柄可能产生INVALID_OPERATION。视图在lost事件里就清空SceneSlot并释放旧场景，epoch变化后的重复清理因此为空操作，再创建新代资源。代际假GL回归先演示旧顺序的失效删除，再验证新顺序不会跨代删除；它不代替真实GPU恢复后的首次像素/错误码检查，也没有读取getError来隐藏错误。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "怎样运行与逐步验收：先看数量，再看像素与生命周期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/webgl-geometry-buffers\nnpm ci\nnpm test\nnpm run dev\n# 打开 http://127.0.0.1:4332/\n# 结束时按 Ctrl+C；端口占用会报错，不自动切换端口。",
          "language": "bash",
          "filename": "终端",
          "purpose": "ZIP解压后在该目录执行；若已在示例目录，省略第一行。Node.js22.12.0。",
          "kind": "runnable"
        },
        {
          "type": "experiment",
          "id": "webgl-geometry-buffers",
          "title": "交互验证：从一个实例增加到三个实例",
          "description": "独立React18.3.1场景，只导入React。右上控件更改参数；读取像素会输出当前设备的RGBA、WebGL版本和错误码。上下文丢失与恢复按钮用于检查资源重建。"
        },
        {
          "type": "list",
          "items": [
            "默认显示三份彩色四边形；把实例数降到1，保留最左一份，再改为2和3，逐步核对偏移顺序。",
            "在实例数3时读取中心像素，中心对应中间实例内部，预期不是背景且glError=0；少于2个实例时，中心像素可处在空白，不能据此误判失败。",
            "勾选越界索引，预期明确CPU拒绝而非部分图形；取消后重新创建，图形恢复。",
            "连续旋转时改变窗口尺寸；随后模拟上下文丢失、恢复并重读。卸载时确认RAF停止，资源只释放一次。"
          ],
          "ordered": true
        },
        {
          "type": "paragraph",
          "text": "本机Node22.12.0下，13项测试通过：布局字节地址、四顶点六索引、实例容量、越界前置拒绝、VAO配置调用、draw参数与重复清理。编译和npm ci真实执行；测试里的假GL只记录API调用，不执行顶点着色器，不生成像素，也不证明具体驱动支持当前格式。真实桌面与手机视口的GPU验收独立记录。"
        },
        {
          "type": "table",
          "headers": [
            "观察到的问题",
            "优先核对"
          ],
          "rows": [
            [
              "颜色像随机数",
              "stride20、颜色offset8、着色器输入location1"
            ],
            [
              "只出现一个四边形",
              "是否使用Instanced调用、最后的实例数量、divisor1"
            ],
            [
              "形状被扯开",
              "偏移是否误按顶点步进、缓冲容量是否足够"
            ],
            [
              "INVALID_OPERATION",
              "VAO索引绑定、type与字节对齐、活动属性范围"
            ],
            [
              "切换参数后资源增加",
              "旧scene.dispose、RAF与事件监听是否解除"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "从这个例子继续做网格加载时，建议先写一个“布局说明”对象，打印每个属性的类型、字节步幅、偏移和步进层次，再接模型文件。做到这一步，读者应该能从一条draw调用追到它消费的具体记录，而不只记住“把数组上传到GPU”这一句。纹理篇会在同样的属性机制上加入UV与采样，继续说明数据怎样成为颜色。"
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
    },
    {
      "title": "MDN vertexAttribPointer",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer"
    },
    {
      "title": "MDN drawElementsInstanced",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawElementsInstanced"
    }
  ]
};
export default article;
