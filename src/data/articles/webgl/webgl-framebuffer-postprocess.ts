import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "webgl-framebuffer-postprocess",
  "topic": "webgl",
  "title": "离屏渲染与后处理：Framebuffer、纹理与多 Pass",
  "description": "把完整三角形先绘制到自建颜色纹理，再以全屏Pass执行原色、灰度和边缘处理；管理附件完整性、视口、反馈环、尺寸预算及失败清理。",
  "minutes": 60,
  "tags": [
    "Framebuffer",
    "Renderbuffer",
    "后处理",
    "多Pass",
    "资源生命周期"
  ],
  "scope": "把完整三角形先绘制到自建颜色纹理，再以全屏Pass执行原色、灰度和边缘处理；管理附件完整性、视口、反馈环、尺寸预算及失败清理。 WebGL2、GLSL ES3.00；CPU数学/接口边界验证与真实浏览器像素分开。不是WebGL1兼容层或物理渲染引擎。",
  "prerequisites": [
    "已读本分类三维变换、GPU数据与纹理采样篇",
    "理解顶点/片元阶段、列主序矩阵、VAO和资源释放"
  ],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "WebGL2.0.0文档快照（2017-04-11，页面仍标editor draft）",
    "GLSL ES3.00 revision6",
    "React18.3.1",
    "TypeScript5.7.3",
    "Node22.12.0"
  ],
  "verifiedAt": "2026-10-25",
  "labMinutes": 40,
  "examples": [
    {
      "label": "下载完整示例ZIP",
      "path": "webgl-framebuffer-postprocess.zip"
    },
    {
      "label": "安装、像素与失败步骤",
      "path": "webgl-framebuffer-postprocess/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Khronos：WebGL2.0.0固定快照",
      "url": "https://registry.khronos.org/webgl/specs/2.0.0/"
    },
    {
      "title": "Khronos：GLSL ES3.00 revision6",
      "url": "https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf"
    },
    {
      "title": "MDN：Framebuffer完整性检查",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/checkFramebufferStatus"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "离屏不是看不见的画布，而是换一个输出目标",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Framebuffer指定绘制结果写到哪些附件。默认帧缓冲通常连接当前canvas呈现目标，自建Framebuffer则可以把颜色写入纹理、深度写入Renderbuffer。它本身主要保存附件关系，不是一个已经装满像素的图片对象；真正的像素存储来自附件。先分清描述关系与存储，才能知道该申请、采样和释放什么。"
        },
        {
          "type": "paragraph",
          "text": "离屏渲染让某一次绘制的结果成为下一次输入，例如先画场景，再做颜色调整、模糊或合成。一次“先渲染后采样”的阶段叫Pass。这里保留完整彩色三角形作为第一Pass，第二Pass用全屏三角形把离屏纹理显示为原色、灰度或简化边缘。不是只清屏就叫已经完成后处理，也不依赖外部图片服务。"
        },
        {
          "type": "paragraph",
          "text": "本文使用WebGL2和GLSL ES3.00，颜色附件RGBA8、深度附件Depth16，不实现HDR、多重采样解析、阴影或延迟渲染。第二Pass只采样颜色，不采样深度，所以用Renderbuffer承载深度足够；如果后续算法需要读取深度值，应换成适当深度纹理并重新核对格式和采样限制。"
        }
      ]
    },
    {
      "id": "attachments",
      "title": "纹理保存颜色，Renderbuffer服务这次深度测试",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-framebuffer-postprocess/passes.svg",
          "title": "颜色从第一Pass流向第二Pass",
          "alt": "Framebuffer连接颜色纹理与深度Renderbuffer；第二Pass先回默认目标再采样，图中没有隐含CPU回读或纹理复制。",
          "caption": "Framebuffer连接颜色纹理与深度Renderbuffer；第二Pass先回默认目标再采样，图中没有隐含CPU回读或纹理复制。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-framebuffer-postprocess/data.ts",
          "kind": "excerpt",
          "purpose": "完整尺寸政策、名义存储估算、CPU灰度参照与第一Pass三角形数据。离屏边长额外限制2048，不只依赖设备最大值。",
          "code": "export type Options={scale:number;mode:number;angle:number;incomplete:boolean;animate:boolean};\nexport const defaults:Options={scale:.5,mode:0,angle:0,incomplete:false,animate:false};\nexport function targetSize(width:number,height:number,scale:number,maxSize:number){\n if(![width,height,scale,maxSize].every(Number.isFinite)||width<1||height<1||scale<.25||scale>1||maxSize<1)throw new RangeError('离屏尺寸参数无效');\n return [Math.max(1,Math.min(Math.floor(maxSize),2048,Math.round(width*scale))),Math.max(1,Math.min(Math.floor(maxSize),2048,Math.round(height*scale)))] as const;\n}\nexport function targetBytes(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048)throw new RangeError('尺寸需为1..2048整数');return width*height*(4+2);}\nexport function gray(rgb:readonly number[]){if(rgb.length!==3||!rgb.every(Number.isFinite))throw new RangeError('RGB需要三个有限值');return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}\nexport const triangle=new Float32Array([-.85,-.75,1,.15,.05,.85,-.75,.05,.85,.15,0,.9,.1,.2,1]);"
        },
        {
          "type": "paragraph",
          "text": "颜色纹理分配一级不可变存储，内格式RGBA8，设置线性过滤与边缘夹取。我们不生成mipmap，因此缩小过滤不能选择需要不存在的多级链。深度Renderbuffer用DEPTH_COMPONENT16，尺寸和颜色一致。Framebuffer把二者接到COLOR_ATTACHMENT0与DEPTH_ATTACHMENT，深度测试才能在这个离屏目标中发挥作用。"
        },
        {
          "type": "paragraph",
          "text": "分配成功不等于组合有效。必须在绑定目标后checkFramebufferStatus，只有FRAMEBUFFER_COMPLETE才继续。常见错误包括没有附件、格式不支持、尺寸或采样配置不相容；完整性检查给的是组合可用证据，不保证shader、UV或业务颜色已经正确，所以还需要实际绘制与像素检查。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-framebuffer-postprocess/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整离屏目标构造、附件检查和异常清理。受控incomplete模式故意不接附件，得到清晰错误；finally恢复默认绑定。",
          "code": "export type Target={texture:WebGLTexture;framebuffer:WebGLFramebuffer;width:number;height:number;bytes:number;dispose:()=>void};\nexport function createTarget(gl:WebGL2RenderingContext,width:number,height:number,incomplete=false):Target{\n const bytes=targetBytes(width,height),scope=new ResourceScope();\n try{const texture=scope.own(gl.createTexture(),x=>gl.deleteTexture(x)),framebuffer=scope.own(gl.createFramebuffer(),x=>gl.deleteFramebuffer(x)),depth=scope.own(gl.createRenderbuffer(),x=>gl.deleteRenderbuffer(x));\n  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);\n  if(!incomplete){gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);}\n  const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(status!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Framebuffer不完整: 0x'+status.toString(16));\n  return {texture,framebuffer,width,height,bytes,dispose(){scope.dispose();}};\n }catch(error){scope.dispose();throw error;}finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);}\n}"
        },
        {
          "type": "paragraph",
          "text": "我们用ResourceScope记录每个已创建句柄。若第二个附件或完整性检查失败，先释放已经建立的texture、FBO和RBO，再把错误交页面。不能只在完整初始化成功后才登记清理，否则最需要排错的时候反而留下部分资源。finally还恢复framebuffer、renderbuffer和texture绑定，避免后续代码继承一个半坏状态。"
        },
        {
          "type": "paragraph",
          "text": "Renderbuffer不能像普通颜色纹理一样直接交给sampler读取，它适合只作为绘制附件的存储。颜色选择Texture，正是因为下一Pass需要采样；深度选择Renderbuffer，是因为这里只用于测试和丢弃。对象类型应由后续访问需求决定，不是把所有东西都建成纹理就天然更通用或更省内存。"
        },
        {
          "type": "paragraph",
          "text": "texStorage2D指定不可变的级数、格式和尺寸，后续不能靠同一个对象随意改存储大小。resize时重建新纹理正是这个约定的结果。默认纹理参数也不能完全依赖，尤其过滤需要的mipmap级数必须与真实存储一致；一个附件完整但采样配置错误的纹理，仍可能在第二Pass得到黑色。"
        }
      ]
    },
    {
      "id": "first-pass",
      "title": "第一Pass：视口跟输出附件的尺寸走",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-framebuffer-postprocess/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整第一Pass着色器：旋转彩色三角形并把插值色输出到当前颜色附件。没有跳过几何绘制。",
          "code": "export const vertexShader=`#version 300 es\nlayout(location=0) in vec2 aPosition;\nlayout(location=1) in vec3 aColor;\nuniform float uAngle;\nout vec3 vColor;\nvoid main(){float c=cos(uAngle),s=sin(uAngle);gl_Position=vec4(mat2(c,s,-s,c)*aPosition,0.0,1.0);vColor=aColor;}`;\nexport const fragmentShader=`#version 300 es\nprecision highp float;\nin vec3 vColor;\nout vec4 outColor;\nvoid main(){outColor=vec4(vColor,1.0);}`;"
        },
        {
          "type": "paragraph",
          "text": "第一Pass先绑定离屏Framebuffer，再把viewport设成离屏宽高，清除颜色和深度，然后画三角形。绑定FBO不会自动修改viewport，如果沿用屏幕尺寸，绘制可能只占目标一部分或被截断。程序、VAO、深度测试和清屏值也应明确设置，不依赖某个之前的Pass刚好留下了正确状态。"
        },
        {
          "type": "paragraph",
          "text": "当前几何只有一个三角形，深度附件主要展示完整配置与生命周期；它没有因为存在就证明遮挡场景已完整测试。第二Pass不需要三维深度测试，应关闭。后处理每个像素的颜色来源已经是纹理，而不是再用原场景的深度条件挡掉整个屏幕。"
        },
        {
          "type": "paragraph",
          "text": "清除是对当前绑定目标和相关状态生效的操作，不是把所有离屏目标一起归零。多个目标轮换时，每个需要初始化的颜色或深度都要按它自己的使用方式处理。若以后引入scissor或写掩码，还要注意它们也可能影响清除范围；本文新建上下文与明确状态没有展开这些额外状态管理。"
        }
      ]
    },
    {
      "id": "second-pass",
      "title": "第二Pass：全屏三角形取样，不需要CPU搬像素",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-framebuffer-postprocess/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整全屏顶点与片元着色器。gl_VertexID生成覆盖画布的大三角形；sampler读取颜色纹理，按模式输出灰度或3×3离散边缘。",
          "code": "export const postVertex=`#version 300 es\nout vec2 vUv;\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;\nexport const postFragment=`#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uSource;\nuniform int uMode;\nout vec4 outColor;\nvoid main(){\n vec3 c=texture(uSource,vUv).rgb;\n if(uMode==1)c=vec3(dot(c,vec3(0.2126,0.7152,0.0722)));\n if(uMode==2){vec2 texel=1.0/vec2(textureSize(uSource,0));vec3 sum=vec3(0.0);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)sum+=texture(uSource,vUv+vec2(float(x),float(y))*texel).rgb;c=clamp(c*9.0-sum,0.0,1.0);}\n outColor=vec4(c,1.0);\n}`;"
        },
        {
          "type": "paragraph",
          "text": "全屏Pass用三个顶点覆盖整屏，不必为一个矩形发六个顶点。gl_VertexID生成零、零，二、零，零、二的坐标，再映射到裁剪空间负一到三；屏幕内插值得到零到一的UV。VAO仍显式绑定，但不需要位置VBO。它是覆盖屏幕的几何技巧，不是绕过光栅化或片元着色器。"
        },
        {
          "type": "paragraph",
          "text": "uSource写入的是纹理单元编号零，activeTexture使用的则是TEXTURE0枚举，二者不可混用。先激活单元，再绑定第一Pass颜色纹理，片元texture读取它。纹理原点与两次绘制的UV约定都在同一套WebGL坐标下，本例无需为HTML图片来源额外翻Y；换成不同来源纹理时，应重新检查上传与UV约定。"
        },
        {
          "type": "paragraph",
          "text": "同一上下文的命令顺序保证前面的渲染结果供后面的采样使用，不需要在两个Pass之间调用finish或readPixels。CPU回读再上传会增加同步与带宽，而且没有解决这里必须靠GPU内部依赖处理的问题。绑定默认Framebuffer只是改变后续写入目标，不会把纹理内容自动复制到canvas。"
        },
        {
          "type": "paragraph",
          "text": "全屏三角形有一部分在裁剪范围外，光栅化只保留屏幕内覆盖。传入的UV在整个大三角形上插值，屏幕内恰好落在零到一，这与普通小三角形不同。若把三个顶点都限制在屏幕角落，却仍期待覆盖另一个半屏，会得到缺角；调试时先看覆盖关系，再怀疑texture读取。"
        },
        {
          "type": "paragraph",
          "text": "采样一张纹理并不需要它曾经显示在屏幕上。第一Pass的结果可以始终不呈现，只由第二Pass消费；这正是后处理可组合的基础。同样，离屏纹理也不会因为绑定回默认目标而自动消失，直到重新写入或释放，它都保有自己的图像存储。把呈现、存储与采样拆开理解，可以少写很多不必要的复制。"
        }
      ]
    },
    {
      "id": "feedback",
      "title": "不要在同一个图像上同时采样和写入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第二Pass必须先bindFramebuffer(null)，再采样离屏颜色。若仍把该颜色纹理作为当前输出附件，同时在片元里读它，就产生反馈环；不能期待GPU按某个“先读左边再写右边”的像素顺序完成。它通常是无效操作，而不是一种可以取巧的原地滤镜。"
        },
        {
          "type": "paragraph",
          "text": "多次迭代模糊常用两个目标轮换：本次从A读、向B写，下次从B读、向A写。它增加存储，但明确分开读写图像。本篇只有离屏到默认目标的两个Pass，没有把轮换仅写成一个名称就冒充已交付多轮模糊；真正关键的是检查每一Pass当前读取和写入是否指向同一图像。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-framebuffer-postprocess/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整双Pass顺序、目标重建与资源释放。先写离屏再回默认；两次viewport分别设置，目标同尺寸复用。",
          "code": "export function createScene(gl:WebGL2RenderingContext,options:Options):Scene{\n targetSize(1,1,options.scale,1);if(!Number.isInteger(options.mode)||options.mode<0||options.mode>2||!Number.isFinite(options.angle))throw new RangeError('后处理参数无效');\n const scope=new ResourceScope();let target:Target|undefined;\n try{const first=makeProgram(gl,scope,vertexShader,fragmentShader),post=makeProgram(gl,scope,postVertex,postFragment),geometry=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),screen=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),buffer=scope.own(gl.createBuffer(),x=>gl.deleteBuffer(x));gl.bindVertexArray(geometry);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,triangle,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,20,8);\n  const angle=requiredUniform(gl,first,'uAngle'),source=requiredUniform(gl,post,'uSource'),mode=requiredUniform(gl,post,'uMode'),maxSize=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));\n  return {draw(width,height,time){const [w,h]=targetSize(width,height,options.scale,maxSize);if(!target||target.width!==w||target.height!==h){const next=createTarget(gl,w,h,options.incomplete);target?.dispose();target=next;}\n   // Pass 1 writes the attachment. Pass 2 first binds a different framebuffer.\n   gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.clearColor(.03,.08,.16,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(first);gl.bindVertexArray(geometry);gl.uniform1f(angle,(options.angle+(options.animate?time*.025:0))*Math.PI/180);gl.drawArrays(gl.TRIANGLES,0,3);\n   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.useProgram(post);gl.bindVertexArray(screen);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.uniform1i(source,0);gl.uniform1i(mode,options.mode);gl.drawArrays(gl.TRIANGLES,0,3);\n  },dispose(){target?.dispose();target=undefined;scope.dispose();}};\n }catch(error){target?.dispose();scope.dispose();throw error;}\n}"
        },
        {
          "type": "paragraph",
          "text": "WebGL对反馈环的约束比某些桌面图形技巧更保守，不能凭某台设备似乎读到了上一帧数据就当作可用协议。要跨帧累积或多轮处理，也应明确上一轮输入与本轮输出的分离和交换时点。测试中的两个draw之间显式绑定默认目标，就是为了让这个关键边界可以从源码和调用序列同时核对。"
        }
      ]
    },
    {
      "id": "filters",
      "title": "灰度和边缘只是局部像素运算，不是完整视觉算法",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "灰度示例对RGB做加权和再复制到三个通道。权重和为一，CPU参照能验证白色仍为一、纯红得到约零点二一二六。这里把shader数值当作本实验线性颜色，不包含纹理解码、完整色彩管理或人眼主观亮度校准；若输入是编码后的照片，不能不解码就把公式结果称为精确线性亮度。"
        },
        {
          "type": "paragraph",
          "text": "边缘模式取当前像素周围三乘三样本，计算中心八倍减其他八项，再截断到零到一。代码写作中心九倍减九项总和，二者等价。它突出局部变化，没有梯度方向、非极大值抑制或阈值连接，不是Canny。负响应被截断也会丢信息，图像更“有线条”不意味着所有边缘都被准确检测。"
        },
        {
          "type": "paragraph",
          "text": "采样步长来自textureSize，也就是离屏纹理真实像素尺寸。若改用canvas宽高计算，而离屏只有半分辨率，卷积邻域就会走错尺度。边缘夹取让边界外采样复用边缘值，是一种明确的边界政策；镜像、重复或补零会得到不同边缘，不能把这些差异都归咎于shader精度。"
        },
        {
          "type": "paragraph",
          "text": "边缘结果在三角形外背景与内部插值色之间有明显响应，是因为邻域存在颜色变化；内部平滑渐变的响应可能较弱。它不能区分物体语义轮廓与材质纹理变化，也没有深度或法线参与。如果需求是几何描边，需要设计不同输入附件与边缘规则，而不只是把当前强度系数调得更高。"
        }
      ]
    },
    {
      "id": "size",
      "title": "分辨率不是只影响清晰度，也影响存储和工作量",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-framebuffer-postprocess/lifetime.svg",
          "title": "尺寸改变时完整建立新目标，再替换旧目标",
          "alt": "名义附件字节只含RGBA8与Depth16，不包括驱动、canvas和其他对象；受控无附件失败必须停在绘制前。",
          "caption": "名义附件字节只含RGBA8与Depth16，不包括驱动、canvas和其他对象；受控无附件失败必须停在绘制前。"
        },
        {
          "type": "paragraph",
          "text": "离屏比例可选四分之一到一，并受设备纹理与Renderbuffer上限以及本例二千零四十八边长预算限制。六百四十乘四百八十画布、比例一半，目标为三百二十乘二百四十。颜色四字节加深度两字节，名义存储四十六万零八百字节；驱动可能对齐或采用不同实际布局，所以不能把它称为真实显存测量。"
        },
        {
          "type": "paragraph",
          "text": "resize时先创建并检查新目标，成功后才释放旧目标。这样失败不会先把仍有效的旧资源删掉；同尺寸时直接复用，避免每帧重新分配。降低离屏分辨率会减少第一Pass覆盖的离屏像素和输入纹理存储，但第二Pass仍覆盖整个canvas，每个输出片元的采样次数也没有因此减少。不能简单把总耗时按面积比例推算，真实瓶颈还要测。"
        },
        {
          "type": "paragraph",
          "text": "名义附件字节随宽高乘积增长，但多个Pass并不等于每个都保留一份完整颜色历史。此例只有一份离屏颜色与深度，屏幕输出由默认目标管理；若增加两个轮换目标，就需要把两份都算进去。把“多Pass”直接乘成无限多张纹理，或只算颜色忘记深度，都不能反映实际对象所有权。"
        }
      ]
    },
    {
      "id": "run",
      "title": "完整性失败、灰度与恢复都要有可重复步骤",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "webgl-framebuffer-postprocess",
          "title": "运行双Pass并观察受控失败",
          "description": "保持动画关闭，比较原色与灰度像素；调整scale看离屏采样变化。勾选无附件应显示Framebuffer不完整，取消后重建；再测试上下文恢复。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端（解压后在package.json所在目录）",
          "kind": "runnable",
          "purpose": "固定Node22.12.0，独立安装并验证12项测试，再在127.0.0.1:4338启动；端口被占用会报错，不漂移。",
          "code": "node --version\n# v22.12.0\nnpm ci --ignore-scripts\nnpm test\n# tests 12, pass 12, fail 0\nnpm run check\nnpm run dev\n# http://127.0.0.1:4338/"
        },
        {
          "type": "paragraph",
          "text": "下载后npm ci、npm test实际12项通过，涵盖尺寸预算、名义字节、灰度参照、附件失败清理、两个Pass之间回默认目标、不同viewport、同尺寸复用和resize回收。fakeGL只检查调用与生命周期，没有编译真正shader，更不能证明最终像素颜色正确。"
        },
        {
          "type": "paragraph",
          "text": "真实WebGL2中先看到彩色三角形，切灰度后三通道应接近相等；边缘模式在颜色变化处增强，平坦区域较暗。像素按钮在绘制后独立readPixels并读错误码，不能在性能测量中每帧调用。上下文丢失后取消RAF、退休旧资源，恢复事件后重新建立全部附件和程序，不能复用旧纹理句柄。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-25记录macOS14.5、Node22.12.0的类型与CPU边界检查，真实浏览器和手机由根代理另验。固定参考版本与前篇一致，完整ZIP包含所有shader、构造、清理与React入口。理解这里的读写目标与资源规模后，下一篇就能区分究竟是CPU提交、片元工作还是资源管理拖慢渲染。"
        },
        {
          "type": "paragraph",
          "text": "根代理在真实Chromium看到原色中心84/93/130，切灰度后94/94/94；无附件开关明确报Framebuffer 0x8cd7，取消后首次像素探针错误码零。三角形完整出现，丢失/恢复后首次探针也为零。实际画布1680乘1260，物理GPU与确切浏览器发行版未核验，不能把这次观察扩展到所有设备。"
        },
        {
          "type": "paragraph",
          "text": "检查灰度时同一像素三个通道接近相等，比记住某一个亮度数字更有迁移价值。检查受控失败时，要看它是否停止继续使用不完整目标，以及取消选项能否恢复；光看到红色错误文字也不够。实际像素、错误状态与资源清理是不同证据，分别核验才不会让一个层面的成功掩盖另一个层面的错误。"
        }
      ]
    }
  ]
};
export default article;
