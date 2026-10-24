import type { Article } from '../../articleTypes';
const article:Article={
  "id": "webgl-texture-sampling",
  "topic": "webgl",
  "title": "纹理与采样：UV、过滤、mipmap 和透明混合",
  "description": "用3×5程序生成RGBA纹理完成双面片场景，从UV插值和边界包裹讲到缩放过滤、NPOT完整性、mipmap与透明混合顺序；提供实际采样控件和可检查的上传布局。",
  "minutes": 60,
  "labMinutes": 35,
  "tags": [
    "WebGL2",
    "纹理",
    "UV",
    "mipmap",
    "NPOT",
    "alpha混合"
  ],
  "scope": "WebGL2/GLSL ES3.00中的普通2D纹理、程序RGBA样本与二维透明叠放；涵盖上传对齐、采样完整性和上下文清理。不展开PBR、压缩纹理、各向异性过滤与完整色彩管理。",
  "prerequisites": [
    "理解顶点属性与片元着色器之间的插值",
    "知道alpha表示覆盖/不透明度的数值约定，不需要事先掌握纹理API"
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
      "path": "webgl-texture-sampling.zip"
    },
    {
      "label": "运行说明与实际验证边界",
      "path": "webgl-texture-sampling/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "纹理与UV是什么：颜色数据和采样坐标要分开理解",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "纹理是GPU能够按坐标读取的数据集合。它常保存图像颜色，也可以保存法线、深度或其他数值；本篇只使用二维RGBA颜色。UV是对这份数据进行采样的二维坐标，通常让一个表面的角点对应(0,0)到(1,1)。顶点着色器把UV传给片元着色器，光栅化过程插值得到当前片元的UV，再由texture函数按采样规则取颜色。"
        },
        {
          "type": "paragraph",
          "text": "UV不等于屏幕像素位置。移动四边形可以改变它落在画布上的位置，而UV仍覆盖同一张纹理；把UV乘以3，则在同一个表面跨越三个纹理坐标周期。最终是重复图案还是拉伸边缘，取决于包裹模式。把这两层分开，你才能区分“几何被拉伸”与“图像采样规则变了”。"
        },
        {
          "type": "paragraph",
          "text": "本例不下载图片，而是生成一张3×5的小纹理，交替放入黄色、蓝色及两种alpha。它不是二次幂尺寸，适合同时观察WebGL2的NPOT能力与mipmap层级。画面叠放两张带不同颜色系数的四边形，读者可改UV倍率、过滤、包裹和绘制顺序，每个控件对应一条独立机制。"
        },
        {
          "type": "figure",
          "src": "figures/webgl-texture-sampling/sampling.svg",
          "title": "先分清坐标、过滤和层级三个决定",
          "alt": "UV决定读哪里；wrap决定越界坐标怎样映射；min/mag过滤决定怎样结合纹素；mipmap提供不同分辨率的数据。它们不是同一个“清晰度开关”。",
          "caption": "UV决定读哪里；wrap决定越界坐标怎样映射；min/mag过滤决定怎样结合纹素；mipmap提供不同分辨率的数据。它们不是同一个“清晰度开关”。"
        }
      ]
    },
    {
      "id": "pixels",
      "title": "像素结构与上传：3×5 RGBA究竟需要多少字节",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export const textureWidth=3,textureHeight=5;\nexport function checkerPixels(){\n  const result=new Uint8Array(textureWidth*textureHeight*4);\n  for(let y=0;y<textureHeight;y++)for(let x=0;x<textureWidth;x++){\n    const i=(y*textureWidth+x)*4,bright=(x+y)%2===0;\n    result.set(bright?[255,230,90,210]:[40,150,220,100],i);\n  }return result;\n}\nexport function mipDimensions(width:number,height:number){\n  if(![width,height].every(v=>Number.isInteger(v)&&v>0&&v<=16384))throw new RangeError('尺寸无效');\n  const levels:Array<[number,number]>=[];\n  for(;;){levels.push([width,height]);if(width===1&&height===1)return levels;width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));}\n}\nexport function unpackBytes(width:number,height:number,components:number,alignment:number){\n  if(![width,height,components].every(v=>Number.isInteger(v)&&v>0)||components>4||![1,2,4,8].includes(alignment))throw new RangeError('上传布局无效');\n  const row=width*components,stride=Math.ceil(row/alignment)*alignment;\n  return {row,stride,required:stride*(height-1)+row};\n}\nexport function overOpaque(src:readonly[number,number,number,number],dst:readonly[number,number,number]){\n  return dst.map((v,i)=>src[i]*src[3]+v*(1-src[3]));\n}\nexport const quad=new Float32Array([\n  -1,-1,0,0, 1,-1,1,0, 1,1,1,1,\n  -1,-1,0,0, 1,1,1,1, -1,1,0,1,\n]);\nexport type Options={filter:'nearest'|'linear'|'mipmap';repeat:boolean;uvScale:number;blend:boolean;reverse:boolean;opacity:number;animate:boolean};\nexport const defaults:Options={filter:'nearest',repeat:true,uvScale:3,blend:true,reverse:false,opacity:.75,animate:false};\n",
          "language": "ts",
          "filename": "examples/webgl-texture-sampling/data.ts",
          "purpose": "完整程序样本、UV几何、mipmap尺寸、上传字节计算与直通alpha公式。所有输入来自本地数组，不依赖图片域名或跨域请求。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "checkerPixels每个纹素写四个Uint8通道，所以3×5×4=60字节。RGB值在着色器里作为归一化颜色读取，alpha的210和100分别接近0.824和0.392。数组按行写入，但“第0行对应视觉上方还是下方”不是Uint8Array自己定义的图像语义：这里把第0行对应v=0一侧，并按这一约定生成图案。"
        },
        {
          "type": "paragraph",
          "text": "上传有三个容易混淆的字段：internalformat描述GPU内部格式，format描述输入分量排列，type描述每个分量的数据类型。本例WebGL2使用RGBA8、RGBA、UNSIGNED_BYTE这一合法组合；不能看到三个名字都提到颜色，就任意改成互不兼容的格式。gl.texImage2D不会替你猜数组是RGB、RGBA还是浮点深度。"
        },
        {
          "type": "paragraph",
          "text": "UNPACK_ALIGNMENT决定输入各行的对齐要求，默认是4。这里RGBA宽3恰好每行12字节，默认已经能对齐；代码仍显式设为1，使“紧密排列”的约定可见。如果改成RGB宽3，每行9字节，默认对齐会使相邻行起点间隔12，而紧密数组没有这段padding。五行的最小覆盖长度是4×12+9=57，不是45；最后一行后无需再补满padding。"
        },
        {
          "type": "paragraph",
          "text": "这也是unpackBytes测试要区分row、stride、required的原因。它只计算本例Uint8二维、无额外行长与跳过参数的布局；WebGL2的UNPACK_ROW_LENGTH、SKIP_ROWS等会引入更多条件，不能照搬这个算式覆盖全部上传方式。生产解析器应先限定支持的像素格式，再计算精确长度与内存预算。"
        },
        {
          "type": "paragraph",
          "text": "程序数组还避免了异步图片加载与跨域污染，但真实图像路径需要另外处理这些边界。上传前应确认图像解码完成、来源允许使用，并确定是否翻转Y和是否预乘alpha。typed array、HTML图像与视频的输入约定并不完全一样；不要把针对DOM图像的像素存储选项，机械当作任意数组上传都会执行的变换。"
        }
      ]
    },
    {
      "id": "uv",
      "title": "UV经过插值之后，还要选择边界包裹",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例每个顶点记录为position.xy、uv.xy，stride16字节，UV偏移8字节。两张面片共用同一套UV，但有不同的屏幕偏移与颜色系数。顶点着色器把aUv乘以uUvScale；片元着色器从vUv采样。因为本例所有顶点的裁剪w都为1，透视校正插值退化为平面线性情况；三维透视下不能简单按屏幕x,y手工线性插UV来替代管线。"
        },
        {
          "type": "paragraph",
          "text": "REPEAT让整数部分形成重复周期，CLAMP_TO_EDGE把越界采样约束到边缘。倍率为1时，几何覆盖一份纹理；倍率大于1且开启REPEAT时出现更多图案；切为CLAMP后，超出边界的大部分区域会接近边缘纹素的颜色。这里没有镜像重复选项，但MIRRORED_REPEAT是另一种包裹规则，不需要复制纹理文件才能实现。"
        },
        {
          "type": "paragraph",
          "text": "同一张图的UV接缝可能需要拆顶点，因为索引选中的是整条属性记录。如果一个角点既要u=0又要u=1，只有位置相同并不足以共享一条记录。这与上一章“法线不同就不能只按xyz合并顶点”是同一个读取机制，换成纹理场景后更容易观察接缝。"
        },
        {
          "type": "paragraph",
          "text": "不能仅凭“图案模糊”就改UV或DPR。先确认UV范围和包裹是否正确，再判断当前是纹理放大还是缩小，最后检查过滤与数据分辨率。错误坐标被LINEAR过滤后可能看起来更平滑，但它依然在采样错误的位置。"
        }
      ]
    },
    {
      "id": "filtering",
      "title": "过滤与mipmap：放大和缩小是两种问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一个纹素是纹理中的样本，一个片元是当前绘制准备写入的屏幕样本。纹理被放大时，许多片元对应同一小片纹理；NEAREST选择邻近纹素，边界更硬，LINEAR结合附近样本，过渡更平滑。放大过滤只允许NEAREST或LINEAR，不能把LINEAR_MIPMAP_LINEAR直接传给MAG_FILTER。"
        },
        {
          "type": "paragraph",
          "text": "缩小时，一个屏幕片元可能覆盖大量纹素。只取一个邻近样本，会让细密棋盘随视角或缩放跳变。mipmap提前存一组逐级缩小的纹理，让采样能够选取更接近当前覆盖范围的层级。LINEAR_MIPMAP_LINEAR在每层做线性过滤，并在相邻层之间插值，通常称为三线性过滤；它不表示“三维纹理”。"
        },
        {
          "type": "paragraph",
          "text": "层级尺寸每次按各轴除以2向下取整，最小为1。因此3×5接着是1×2，再是1×1，共三层。generateMipmap在已有level0上生成这条链。本例初始化时总是生成完整链，再由控件改变min filter，避免切到mipmap过滤后却没有对应数据。真实大纹理的生成和存储有成本，不能因为小样本没感觉就每帧调用一次。"
        },
        {
          "type": "paragraph",
          "text": "默认UV倍率3、纹理只有3×5，通常仍处于放大区间，所以切mipmap不一定肉眼有巨大差别。把倍率升到接近128，并保持REPEAT，在本实验画布上更可能进入缩小采样；具体层级由片元之间的UV变化率和绘制尺寸共同决定，浏览器不会只看一个“缩放百分比”字段。要测过滤效果，必须同时记录视口、纹理尺寸与UV倍率。"
        },
        {
          "type": "table",
          "headers": [
            "条件",
            "WebGL1的NPOT二维纹理",
            "WebGL2的本例3×5纹理"
          ],
          "rows": [
            [
              "包裹",
              "通常需CLAMP_TO_EDGE才能保持可采样完整性",
              "允许REPEAT等正常包裹规则"
            ],
            [
              "mipmap",
              "NPOT不能按WebGL1规则使用完整mipmap过滤",
              "可生成3×5→1×2→1×1"
            ],
            [
              "缩小过滤",
              "需NEAREST或LINEAR，避免要求mipmap",
              "可选择LINEAR_MIPMAP_LINEAR"
            ],
            [
              "仍需满足的条件",
              "格式、尺寸、采样完整性等要求仍在",
              "同样不能漏层、使用非法参数或超出设备上限"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "不要把“WebGL2允许NPOT”误读成任何纹理参数都合法。整数纹理、浮点格式可过滤能力、采样器类型与内部格式匹配，都有各自规则。本篇只承诺RGBA8普通颜色纹理这一组组合。mipmap能缓解缩小高频带来的闪烁，也不能自动解决斜视表面的各向异性或所有几何锯齿。"
        },
        {
          "type": "reference",
          "title": "MDN：纹理与WebGL1二次幂限制的背景",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL",
          "note": "该教程以WebGL1规则为背景，不能把其中NPOT限制直接套到本篇WebGL2。"
        },
        {
          "type": "paragraph",
          "text": "mipmap的存储开销也应按尺寸计算。常见的“约多三分之一”来自两轴同时减半的充分大二次幂方形，每层面积约为前一层四分之一，形成几何级数。本例只有15+2+1个纹素，共18个，额外约20%；细长纹理又可能呈现不同的比例。不要把一个近似结论当成任意NPOT纹理的精确内存预算。"
        },
        {
          "type": "paragraph",
          "text": "LINEAR的“线性”说的是采样插值，不自动表示输入已经处于线性光空间；LINEAR_MIPMAP_LINEAR的两个LINEAR又分别指层内与层间插值。把三个语境混用，会出现明明过滤正确却仍在错误色彩空间做合成的问题。这里先把采样规则跑通，后面的色彩管理应建立在明确的数据格式和转换步骤上。"
        }
      ]
    },
    {
      "id": "rendering",
      "title": "完整实现：绑定纹理单元、采样器和面片",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';\nimport {quad,checkerPixels,textureWidth,textureHeight,type Options} from './data.js';\nexport const vertexShader=`#version 300 es\nlayout(location=0) in vec2 aPosition;\nlayout(location=1) in vec2 aUv;\nuniform vec2 uOffset;\nuniform float uUvScale;\nout vec2 vUv;\nvoid main(){gl_Position=vec4(aPosition*0.65+uOffset,0.0,1.0);vUv=aUv*uUvScale;}`;\nexport const fragmentShader=`#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uTexture;\nuniform vec3 uTint;\nuniform float uOpacity;\nout vec4 outColor;\nvoid main(){vec4 sampleColor=texture(uTexture,vUv);outColor=vec4(sampleColor.rgb*uTint,sampleColor.a*uOpacity);}`;\nexport function createScene(gl:WebGL2RenderingContext,options:Options):Scene {\n  const scope=new ResourceScope();\n  try {\n    const program=makeProgram(gl,scope,vertexShader,fragmentShader);\n    const vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v));\n    const buffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));\n    const texture=scope.own(gl.createTexture(),t=>gl.deleteTexture(t));\n    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);\n    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);\n    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);\n    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);\n    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,textureWidth,textureHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,checkerPixels());\n    gl.generateMipmap(gl.TEXTURE_2D);\n    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,options.filter==='nearest'?gl.NEAREST:options.filter==='linear'?gl.LINEAR:gl.LINEAR_MIPMAP_LINEAR);\n    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,options.filter==='nearest'?gl.NEAREST:gl.LINEAR);\n    const wrap=options.repeat?gl.REPEAT:gl.CLAMP_TO_EDGE;\n    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);\n    const sampler=requiredUniform(gl,program,'uTexture'),offset=requiredUniform(gl,program,'uOffset');\n    const scale=requiredUniform(gl,program,'uUvScale'),tint=requiredUniform(gl,program,'uTint'),opacity=requiredUniform(gl,program,'uOpacity');\n    return {draw(width,height,_time){\n      gl.viewport(0,0,width,height);gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT);\n      gl.disable(gl.DEPTH_TEST);options.blend?gl.enable(gl.BLEND):gl.disable(gl.BLEND);\n      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);\n      gl.useProgram(program);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);\n      gl.uniform1i(sampler,0);gl.uniform1f(scale,options.uvScale);gl.uniform1f(opacity,options.opacity);\n      const layers=[{x:-.18,y:-.12,t:[1,.45,.35]},{x:.18,y:.12,t:[.35,.65,1]}];\n      for(const layer of options.reverse?[...layers].reverse():layers){gl.uniform2f(offset,layer.x,layer.y);gl.uniform3fv(tint,layer.t);gl.drawArrays(gl.TRIANGLES,0,6);}\n    },dispose(){scope.dispose();}};\n  }catch(error){scope.dispose();throw error;}\n}\n",
          "language": "ts",
          "filename": "examples/webgl-texture-sampling/renderer.ts",
          "purpose": "完整GLSL、纹理上传、mipmap、采样器、两张面片和混合设置。uTexture接收纹理单元编号0，而不是纹理对象。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "activeTexture(TEXTURE0)选择当前要操作的纹理单元，bindTexture把对象绑定到该单元的二维目标，uniform1i(uTexture,0)让sampler2D从编号0读取。uniform里不是传WebGLTexture对象，也不是传TEXTURE0这个枚举值本身。更复杂的材质可以使用多个单元，但仍需逐一对应sampler与当前绑定。"
        },
        {
          "type": "paragraph",
          "text": "片元着色器输出vec4(sample.rgb×tint,sample.a×opacity)。这份RGB没有提前乘alpha，属于直通alpha约定。为了保持例子可追溯，纹理数据、shader输出与混合因子始终遵守同一约定；若把预乘图像接进来却继续使用直通alpha因子，边缘就可能出现过暗或光晕。"
        }
      ]
    },
    {
      "id": "alpha",
      "title": "透明混合：颜色公式不负责替你排列物体",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-texture-sampling/blend.svg",
          "title": "交换叠放顺序，颜色为什么不同",
          "alt": "图中数字是在不透明黑色背景上对直通alpha RGB做的数值演示。它解释混合顺序，不声称本篇已经完成物理线性色彩管理。",
          "caption": "图中数字是在不透明黑色背景上对直通alpha RGB做的数值演示。它解释混合顺序，不声称本篇已经完成物理线性色彩管理。"
        },
        {
          "type": "paragraph",
          "text": "对直通alpha源颜色，RGB输出为src.rgb×src.a+dst.rgb×(1-src.a)。我们使用blendFuncSeparate，RGB因子是SRC_ALPHA与ONE_MINUS_SRC_ALPHA，alpha因子是ONE与ONE_MINUS_SRC_ALPHA。这样alpha也按source-over组合，而不是被同一SRC_ALPHA因子再平方一次。画布本身alpha:false，例子关心的是画布内部两层颜色，而非与网页背景的透明合成。"
        },
        {
          "type": "paragraph",
          "text": "透明混合不满足交换律。半透明红叠到蓝上，和蓝叠到红上，会得到不同的RGB。控件交换layers数组的绘制顺序，几何和纹理没有变化，中心重叠颜色仍应该改变；关闭BLEND后，后画面片直接覆盖，alpha不会自动替你完成透明叠加。shader写出较小alpha和启用混合是两个不同条件。"
        },
        {
          "type": "paragraph",
          "text": "本例二维场景关闭深度测试，目的是单独观察顺序。一般三维渲染会先画不透明对象，再按合适顺序画半透明对象，通常保留深度测试并关闭透明阶段深度写入。即使按物体中心从远到近排序，相交透明几何也可能排不正确；那需要拆分、深度剥离或其他透明方案，不能靠本例一个reverse复选框概括全部问题。"
        },
        {
          "type": "paragraph",
          "text": "还要区分颜色公式与色彩管理。本篇用普通RGBA8样本直接做数值混合，没有建立sRGB纹理解码、线性光照计算和输出转换的完整管线。因此CPU的overOpaque只证明选定数值空间下的代数顺序，不是照片在视觉上一定能量正确的证明。扩展到真实图像或PBR时，应单独确定每个输入与输出的色彩空间。"
        },
        {
          "type": "reference",
          "title": "blendFunc与混合因子的API语义",
          "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFunc"
        },
        {
          "type": "paragraph",
          "text": "当目标本身也透明时，保存的RGB与alpha采用哪种表示要贯穿管线，不能只看单个blendFunc。这里画布alpha:false、清屏alpha=1，所有绘制都叠在不透明目标上，CPU辅助函数因此只返回三个RGB分量。它没有实现任意透明图层文件的预乘与反预乘转换，也没有证明DOM页面如何与画布合成。"
        }
      ]
    },
    {
      "id": "lifecycle",
      "title": "纹理也是资源：初始化失败和上下文恢复都要重新处理",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export class ResourceScope {\n  private cleanups:Array<()=>void>=[];\n  private disposed=false;\n  own<T>(value:T|null,drop:(value:T)=>void):T {\n    if(value===null)throw new Error('GPU资源分配失败');\n    if(this.disposed){drop(value);throw new Error('资源作用域已经关闭');}\n    this.cleanups.push(()=>drop(value));return value;\n  }\n  dispose(){if(this.disposed)return;this.disposed=true;for(const drop of this.cleanups.reverse())drop();this.cleanups=[];}\n}\nexport function makeProgram(gl:WebGL2RenderingContext,scope:ResourceScope,vertex:string,fragment:string){\n  const compile=(type:number,source:string)=>{\n    const shader=scope.own(gl.createShader(type),s=>gl.deleteShader(s));\n    gl.shaderSource(shader,source);gl.compileShader(shader);\n    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'着色器编译失败');\n    return shader;\n  };\n  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);\n  const program=scope.own(gl.createProgram(),p=>gl.deleteProgram(p));\n  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);\n  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'程序链接失败');\n  return program;\n}\nexport function requiredUniform(gl:WebGL2RenderingContext,program:WebGLProgram,name:string){\n  const location=gl.getUniformLocation(program,name);\n  if(location===null)throw new Error('未找到活动uniform: '+name);return location;\n}\nexport function frameSize(width:number,height:number,dpr:number){\n  if(![width,height,dpr].every(Number.isFinite)||width<=0||height<=0||dpr<=0)throw new RangeError('画布尺寸无效');\n  const ratio=Math.min(dpr,2);return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))] as const;\n}\nexport type Scene={draw:(width:number,height:number,time:number)=>void;dispose:()=>void};\n\n// Retire a scene while its context is lost, before restoration changes generation.\nexport class SceneSlot {\n  current:Scene|undefined;\n  clear(){const previous=this.current;this.current=undefined;previous?.dispose();}\n}\n",
          "language": "ts",
          "filename": "examples/webgl-texture-sampling/gl-utils.ts",
          "purpose": "完整资源作用域与编译逻辑；texture、buffer、VAO、program和shader都属于本例作用域。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "export default function App(){\n  const canvasRef=React.useRef<HTMLCanvasElement>(null);\n  const control=React.useRef<{probe:()=>void;lose:()=>void;restore:()=>void}|null>(null);\n  const [options,setOptions]=React.useState<Options>(defaults);\n  const [epoch,setEpoch]=React.useState(0),[lost,setLost]=React.useState(false);\n  const [status,setStatus]=React.useState('等待WebGL2初始化'),[evidence,setEvidence]=React.useState('尚未读取真实像素');\n  const change=(patch:Partial<Options>)=>setOptions(old=>({...old,...patch}));\n  React.useEffect(()=>{\n    const canvas=canvasRef.current;if(!canvas)return;\n    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});\n    if(!gl){setStatus('此浏览器或设备无法创建WebGL2；CPU测试不能代替GPU运行');return;}\n    const scenes=new SceneSlot();\n    let raf=0,dead=false;\n    const extension=gl.getExtension('WEBGL_lose_context');\n    const drawFrame=(time=performance.now())=>{\n      if(dead||gl.isContextLost()||!scenes.current)return;\n      const rect=canvas.getBoundingClientRect(),[width,height]=frameSize(Math.max(1,rect.width),Math.max(1,rect.height),window.devicePixelRatio||1);\n      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}\n      scenes.current.draw(width,height,time);\n    };\n    const loop=(time:number)=>{drawFrame(time);if(!dead&&!gl.isContextLost())raf=requestAnimationFrame(loop);};\n    const onLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);scenes.clear();setLost(true);setStatus('WebGL上下文已丢失，旧GPU资源不能继续使用');};\n    const onRestored=()=>{setLost(false);setEpoch(value=>value+1);};\n    canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);\n    const onResize=()=>drawFrame();\n    window.addEventListener('resize',onResize);\n    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(onResize);observer?.observe(canvas);\n    try {\n      gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);\n      scenes.current=createScene(gl,options);drawFrame();setStatus('WebGL2场景已建立；请读取像素与错误码核验当前设备');\n      if(options.animate)raf=requestAnimationFrame(loop);\n    }catch(error){setStatus(error instanceof Error?error.message:'初始化失败');}\n    control.current={probe(){\n      if(!scenes.current||gl.isContextLost()){setEvidence('当前没有可读的场景');return;}\n      drawFrame();const rgba=new Uint8Array(4);\n      gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);\n      setEvidence(JSON.stringify({rgba:[...rgba],glError:gl.getError(),version:gl.getParameter(gl.VERSION),size:[canvas.width,canvas.height]}));\n    },lose(){if(extension)extension.loseContext();else setEvidence('此环境没有WEBGL_lose_context扩展');},restore(){if(extension)extension.restoreContext();}};\n    return ()=>{dead=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',onResize);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);control.current=null;scenes.clear();};\n  },[options,epoch]);\n  return <main style={{fontFamily:'system-ui',padding:16,maxWidth:840,margin:'auto',color:'#16352b'}}>\n    <h1>纹理、过滤与透明混合</h1>\n    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>\n<label>过滤<select value={options.filter} onChange={e=>change({filter:e.target.value as Options['filter']})}><option value=\"nearest\">NEAREST</option><option value=\"linear\">LINEAR</option><option value=\"mipmap\">LINEAR_MIPMAP_LINEAR</option></select></label>\n<label>UV倍率 {options.uvScale}<input type=\"range\" min=\"1\" max=\"128\" value={options.uvScale} onChange={e=>change({uvScale:+e.target.value})}/></label>\n<label>不透明度 {options.opacity}<input type=\"range\" min=\"0.1\" max=\"1\" step=\"0.05\" value={options.opacity} onChange={e=>change({opacity:+e.target.value})}/></label>\n<label><input type=\"checkbox\" checked={options.repeat} onChange={e=>change({repeat:e.target.checked})}/>REPEAT（关闭为CLAMP_TO_EDGE）</label>\n<label><input type=\"checkbox\" checked={options.blend} onChange={e=>change({blend:e.target.checked})}/>透明混合</label>\n<label><input type=\"checkbox\" checked={options.reverse} onChange={e=>change({reverse:e.target.checked})}/>交换绘制顺序</label>\n<p>程序生成3×5 RGBA纹理；mipmap为3×5 → 1×2 → 1×1。高UV倍率用于观察缩小过滤。</p>\n    </fieldset>\n    <canvas ref={canvasRef} aria-label=\"WebGL2交互场景\" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>\n    <p role=\"status\">{status}</p>\n    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取中心像素</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>\n    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>\n    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。页面卸载会取消RAF并释放本例创建的资源。</p>\n  </main>;\n}\n",
          "language": "tsx",
          "filename": "examples/webgl-texture-sampling/view.tsx.txt",
          "purpose": "完整React容器与采样控件。App.tsx由本地模块原文组合，仅import React；RAF、事件监听、GPU句柄在卸载或参数重建时回收。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "纹理完成上传后，这个WebGLTexture不等于永远有效的图片文件。上下文丢失时旧纹理对象不可继续用，恢复后需要重新执行texImage2D与generateMipmap。好在程序样本由CPU函数产生，可以重建；如果以后改成网络图片，要明确是否保留原始像素、重取资源的权限与失败状态。"
        },
        {
          "type": "paragraph",
          "text": "这里每次参数改变会重建小场景，便于让对象所有权与恢复路径一致。它不代表生产代码应该为一次min filter变化重新编译program。真实优化可把参数更新与资源重建分开，但必须保留相同的清理规则；不能用“缓存”解释永不删除的纹理。GPU内存耗尽也未必以可预测的JavaScript异常出现，因此还需资源预算与上下文丢失处理。"
        },
        {
          "type": "paragraph",
          "text": "上下文恢复还要注意对象代际：丢失会使旧句柄失效，恢复后再删除旧代句柄可能产生INVALID_OPERATION。视图在lost事件里就清空SceneSlot并释放旧场景，epoch变化后的重复清理因此为空操作，再创建新代资源。代际假GL回归先演示旧顺序的失效删除，再验证新顺序不会跨代删除；它不代替真实GPU恢复后的首次像素/错误码检查，也没有读取getError来隐藏错误。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "从样本到像素：怎样验证当前环境真的执行了采样",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/webgl-texture-sampling\nnpm ci\nnpm test\nnpm run dev\n# 打开 http://127.0.0.1:4333/\n# 结束时按 Ctrl+C；端口占用会报错，不自动切换端口。",
          "language": "bash",
          "filename": "终端",
          "purpose": "ZIP解压后在该目录执行；若已在示例目录，省略第一行。Node.js22.12.0。",
          "kind": "runnable"
        },
        {
          "type": "experiment",
          "id": "webgl-texture-sampling",
          "title": "交互验证：纹理周期、过滤与叠放顺序",
          "description": "独立React18.3.1场景，只导入React。右上控件更改参数；读取像素会输出当前设备的RGBA、WebGL版本和错误码。上下文丢失与恢复按钮用于检查资源重建。"
        },
        {
          "type": "list",
          "items": [
            "默认画面是两张相互叠放的棋盘面片。UV=1时看一份图案，REPEAT+较高倍率形成重复；关闭REPEAT应出现边缘延展，而非继续平铺。",
            "在较低倍率比较NEAREST与LINEAR边缘；提高到接近128比较缩小过滤。记录画布尺寸，不能要求任意分辨率下差异同样明显。",
            "保持其他参数，读取中心像素；交换绘制顺序后再读，重叠处RGBA通常改变，getError应为0。关闭BLEND，比较后画覆盖。",
            "模拟丢失、恢复，再次读取像素；离开页面，确认清理纹理与帧监听。浏览器不能创建WebGL2时，记录不支持提示而不是空白成功。"
          ],
          "ordered": true
        },
        {
          "type": "paragraph",
          "text": "已在macOS14.5/Node22.12.0执行npm ci、TypeScript构建与13项测试，覆盖60字节样本、NPOT层级、行对齐、混合次序、采样器参数及资源回收。假GL能核对配置和失败收尾，不能执行texture采样或证明mipmap画面正确。真实GPU、移动视口和手机原生环境分别记录，不能由本页SSR测试代替。"
        },
        {
          "type": "table",
          "headers": [
            "问题",
            "先检查"
          ],
          "rows": [
            [
              "整张黑或只有背景",
              "program日志、采样器单元、完整mipmap链、WebGL2支持"
            ],
            [
              "图案上下和预期相反",
              "数组行约定与UV方向；不要同时改两处来抵消"
            ],
            [
              "边缘发黑或透明不对",
              "数据是否预乘、shader输出约定、混合因子"
            ],
            [
              "改变mipmap看不出差异",
              "是否真的在缩小区间、UV倍率与画布像素数"
            ],
            [
              "读到glError=0仍画面不对",
              "合法但错误的UV、包裹、布局与绘制顺序"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "下一步可以保持shader不变，把程序样本替换成自己的像素生成器，再逐项核对上传布局和采样结果。先能解释“这个片元为什么读到这些纹素、为什么与背景合成这种颜色”，再进入纹理压缩、法线贴图或材质系统，读到复杂引擎代码时才不会把每个新API都当成孤立技巧。"
        },
        {
          "type": "paragraph",
          "text": "采样测试不要只保存一张截图。可以记录同一设备在默认参数、交换顺序、高UV倍率三种配置的中心像素与错误码，再附全图对照。某些中心恰好落在纹素边界，线性插值与实现舍入会影响具体整数，所以验收通常检查有意义的变化与容差，而不是要求每台GPU输出完全相同的四个字节。"
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
      "title": "MDN texImage2D",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D"
    },
    {
      "title": "MDN blendFunc",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFunc"
    },
    {
      "title": "MDN WebGL纹理教程",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL"
    }
  ]
};
export default article;
