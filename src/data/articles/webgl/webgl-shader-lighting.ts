import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "webgl-shader-lighting",
  "topic": "webgl",
  "title": "Shader 与光照：法线、材质和逐像素计算",
  "description": "从表面方向和同空间向量出发，推导逆转置法线矩阵，绘制可调非均匀缩放球体，完成Lambert漫反射与简化Blinn高光，并区分颜色计算和真实材料。",
  "minutes": 60,
  "tags": [
    "Shader",
    "法线",
    "逆转置",
    "逐像素光照",
    "材质"
  ],
  "scope": "从表面方向和同空间向量出发，推导逆转置法线矩阵，绘制可调非均匀缩放球体，完成Lambert漫反射与简化Blinn高光，并区分颜色计算和真实材料。 WebGL2、GLSL ES3.00；CPU数学/接口边界验证与真实浏览器像素分开。不是WebGL1兼容层或物理渲染引擎。",
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
      "path": "webgl-shader-lighting.zip"
    },
    {
      "label": "安装、像素与失败步骤",
      "path": "webgl-shader-lighting/README.md"
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
      "title": "WebGL2Fundamentals原作者：方向光与法线",
      "url": "https://webgl2fundamentals.org/webgl/lessons/webgl-3d-lighting-directional.html"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "Shader负责哪一段，光照又在算什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Shader是在图形流水线特定阶段执行的程序。顶点着色器处理输入顶点并输出裁剪位置及供插值的量，片元着色器为覆盖到的片元计算颜色。它们不是运行在浏览器主线程上的普通JavaScript回调，也不是写一个颜色公式后就能跳过缓冲布局、程序链接和绘制调用。前几篇已经把三角形送进流水线，这篇把颜色来源从固定顶点色扩展到表面与光线的关系。"
        },
        {
          "type": "paragraph",
          "text": "光照模型用表面方向、光源、观察方向和材质参数近似计算看到的亮度。最简单的方向光假设各处入射方向相同，没有随距离变化的衰减。我们先用漫反射解释朝向对亮度的影响，再加一个依赖观察方向的简化高光。它是教学模型，不是阴影、全局光照、真实材料测量或完整PBR。"
        },
        {
          "type": "paragraph",
          "text": "贯穿场景是一颗有平滑法线的球，沿X非均匀放大并绕Y转动。你能切换正确法线与故意错误的模型矩阵法线，调整光向、高光指数，或直接看法线颜色。用同一个场景比较，才能知道变化来自哪条计算；只看一张“好像有立体感”的截图，不能说明法线变换一定正确。"
        }
      ]
    },
    {
      "id": "normal",
      "title": "法线是垂直表面的方向，不是另一个位置",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "法线与表面切向量垂直，通常参与光照前要归一化。位置说明点在哪里，方向说明朝向哪里，两者处理平移的方式不同。对单位球，局部位置向量恰好与外法线同向，所以可以用相同数值生成；这只是球的几何性质，不能把任意模型的位置数组直接当法线数组。"
        },
        {
          "type": "paragraph",
          "text": "本例球面用经纬分段生成，默认四百二十五条顶点记录，每条是位置三项加法线三项，索引二千一百六十项。极点处跳过退化三角形，接缝保留独立顶点。球体共享相邻顶点法线而呈平滑表面；立方体的硬边通常需要不同面的法线，不能因为角点位置相同就把所有属性强行合并。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-shader-lighting/data.ts",
          "kind": "excerpt",
          "purpose": "完整程序生成球面与法线。分段3..64、每条24字节、Uint16索引；没有外部模型或图片下载。",
          "code": "export function sphereMesh(rows=16,columns=24){\n if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<3||rows>64||columns<3||columns>64)throw new RangeError('球面分段3..64');const data:number[]=[],indices:number[]=[];\n for(let y=0;y<=rows;y++){const phi=y/rows*Math.PI;for(let x=0;x<=columns;x++){const theta=x/columns*Math.PI*2,p=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];data.push(...p,...p);}}\n for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;if(y!==0)indices.push(a,b,a+1);if(y!==rows-1)indices.push(a+1,b,b+1);}\n return {vertices:new Float32Array(data),indices:new Uint16Array(indices)};\n}"
        },
        {
          "type": "paragraph",
          "text": "平移不改变表面方向；只旋转时可以把旋转同样作用在法线上。但非均匀缩放会改变角度关系，直接乘模型矩阵后再normalize也救不回来，因为错误已经是方向歪了，而不只是长度不等于一。下面用点积把这个差别算出来。"
        },
        {
          "type": "paragraph",
          "text": "一个顶点可以有多套属性，位置相同不代表法线必须相同。共享平滑球面的法线会让相邻片元朝向连续；硬边立方体若共用平均法线，会看起来像被磨圆，轮廓却仍方。这是数据表达决定的表面效果，不是打开某个光照API后驱动会自动替你计算正确法线。"
        },
        {
          "type": "paragraph",
          "text": "法线方向反了与三角形绕序反了也不是同一问题。绕序可能影响正反面判定和剔除，法线影响点积亮度。本例未打开面剔除，避免把背面被裁掉与背光变暗混在一个开关里。排查模型发黑时，先用法线色观察方向，再逐项检查空间、光向与剔除规则。"
        }
      ]
    },
    {
      "id": "inverse-transpose",
      "title": "为什么是逆转置，而不是再背一个矩阵名字",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "设表面切向量为t、法线为n，满足t·n=0。模型线性变换M把切线变成Mt，我们要找一个变换后的法线n′，使(Mt)·n′仍为零。取n′为M的逆转置乘n，点积就变成t·n，保持垂直。这是逆转置的用途：保存切线与法线的正交关系，并不是为了让模型看起来更高级。"
        },
        {
          "type": "figure",
          "src": "figures/webgl-shader-lighting/normal.svg",
          "title": "一次非均匀缩放的具体反例",
          "alt": "原切线(1,1,0)、法线(1,-1,0)；X放大两倍后，错误法线点积3，正确逆转置法线点积0。",
          "caption": "原切线(1,1,0)、法线(1,-1,0)；X放大两倍后，错误法线点积3，正确逆转置法线点积0。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-shader-lighting/data.ts",
          "kind": "excerpt",
          "purpose": "完整逆转置、方向变换、归一化和CPU漫反射参照。矩阵按列主序上传，拒绝奇异或非有限变换。",
          "code": "export function normalMatrix(model:Mat4):Float32Array{\n if(model.length!==16)throw new RangeError('模型矩阵必须16项');\n const a=model[0],b=model[4],c=model[8],d=model[1],e=model[5],f=model[9],g=model[2],h=model[6],i=model[10];\n const A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,det=a*A+b*B+c*C;\n if(!Array.from(model).every(Number.isFinite)||Math.abs(det)<1e-8)throw new RangeError('法线矩阵需要非奇异模型变换');\n // Cofactor matrix / det is transpose(inverse(M)); column-major upload.\n return new Float32Array([A,c*h-b*i,b*f-c*e,B,a*i-c*g,c*d-a*f,C,b*g-a*h,a*e-b*d].map(x=>x/det));\n}\nexport function transform3(m:Float32Array,p:readonly number[]){return [0,1,2].map(row=>m[row]*p[0]+m[3+row]*p[1]+m[6+row]*p[2]);}\nexport function unit(v:readonly number[]){const n=Math.hypot(...v);if(!Number.isFinite(n)||n<1e-8)throw new RangeError('方向向量不可为零');return v.map(x=>x/n);}\nexport function diffuse(normal:readonly number[],light:readonly number[]){const n=unit(normal),l=unit(light);return Math.max(0,n.reduce((s,x,i)=>s+x*l[i],0));}"
        },
        {
          "type": "paragraph",
          "text": "只取模型矩阵的线性三乘三部分计算世界法线，不把平移或透视投影塞进去。零缩放使线性矩阵不可逆，应该在上传前拒绝；传一串NaN让shader继续运行，只会得到难解释的黑块。本例用行列式检查退化，数值稳定性仍有范围：极端缩放和近奇异矩阵需要更严谨的误差政策，不是把阈值随便改小就解决。"
        },
        {
          "type": "paragraph",
          "text": "也可以在观察空间做全部光照，但必须把法线、光向、位置与相机都转换到同一个空间。错误常来自一半使用世界方向、一半使用观察方向，转动相机后高光就像粘在物体上。本文选择世界空间，固定相机世界位置为零、零、三点五，便于在片元代码中核对每个向量。"
        },
        {
          "type": "paragraph",
          "text": "归一化只会改变长度，不能恢复已经歪掉的垂直关系。在图中把错误法线除以自身长度之后，它与变换后切线的点积仍非零，只是数值缩小。因此“我最后已经normalize了”不能作为跳过逆转置的理由；要先把方向变换正确，再建立单位长度。"
        },
        {
          "type": "paragraph",
          "text": "列主序说的是数组如何装入矩阵，不代表数学乘法从左到右执行。本例模型为旋转乘缩放，作用到列向量时先缩放后旋转；法线矩阵由这个实际模型计算。若把上传数据转置一次又在shader里换乘法方向，可能偶然让某个角度看起来对，但剪切与非均匀缩放的垂直性测试会揭穿这种混用。"
        }
      ]
    },
    {
      "id": "shader",
      "title": "逐像素：插值之后重新建立单位方向",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-shader-lighting/spaces.svg",
          "title": "位置与方向统一到世界空间",
          "alt": "顶点阶段变换世界位置与法线；片元阶段重新归一化，光向和观察方向也在世界空间；投影只负责裁剪位置。",
          "caption": "顶点阶段变换世界位置与法线；片元阶段重新归一化，光向和观察方向也在世界空间；投影只负责裁剪位置。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-shader-lighting/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整GLSL ES3.00顶点与片元着色器。法线插值后normalize；方向光Lambert与Blinn半程向量高光同空间，避免零半程向量除零。",
          "code": "export const vertexShader=`#version 300 es\nlayout(location=0) in vec3 aPosition;\nlayout(location=1) in vec3 aNormal;\nuniform mat4 uModel;\nuniform mat4 uViewProjection;\nuniform mat3 uNormal;\nout vec3 vWorld;\nout vec3 vNormal;\nvoid main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=uNormal*aNormal;gl_Position=uViewProjection*world;}`;\nexport const fragmentShader=`#version 300 es\nprecision highp float;\nin vec3 vWorld;\nin vec3 vNormal;\nuniform vec3 uLight;\nuniform float uShine;\nuniform bool uNormalColor;\nuniform bool uGamma;\nout vec4 outColor;\nvoid main(){\n vec3 n=normalize(vNormal),l=normalize(uLight);\n vec3 view=normalize(vec3(0.0,0.0,3.5)-vWorld);\n vec3 sum=l+view;float sumLength=length(sum);vec3 halfVector=sumLength>0.00001?sum/sumLength:vec3(0.0);\n float lambert=max(dot(n,l),0.0);\n float spec=lambert>0.0?pow(max(dot(n,halfVector),0.0),uShine):0.0;\n vec3 color=vec3(0.8,0.27,0.08)*(0.12+0.75*lambert)+vec3(0.35)*spec;\n if(uNormalColor)color=n*0.5+0.5;\n else if(uGamma)color=pow(max(color,vec3(0.0)),vec3(1.0/2.2));\n outColor=vec4(color,1.0);\n}`;"
        },
        {
          "type": "paragraph",
          "text": "顶点阶段输出vWorld和vNormal，光照没有在顶点阶段先算成一个亮度。光栅化会插值这些量，片元再normalize(vNormal)，因为两个单位向量线性组合一般不再单位长度。这样球面上的亮度变化按片元计算，较粗网格上的高光也不只受几个顶点采样限制；几何轮廓的分段粗糙仍需要增加顶点，片元公式不能补出真实轮廓。"
        },
        {
          "type": "paragraph",
          "text": "uLight约定为从表面指向平行光源的方向。漫反射使用max(dot(N,L),0)，面朝光时较亮，背向光时不产生正的漫反射。若你的输入表示光线传播方向，就需要取反，不能只看到法线朝前却发黑就盲目加绝对值。abs会把背面也照亮，掩盖方向定义错误。"
        },
        {
          "type": "paragraph",
          "text": "观察方向V来自相机位置减世界片元位置。半程方向H为L加V的归一化，简化高光用max(N·H,0)的shine次方，只在漫反射朝光时启用。指数越大，高光通常越集中，它不是物理粗糙度的严格反函数。本例还保护L与V正好抵消的情况，避免对零向量归一化。"
        },
        {
          "type": "paragraph",
          "text": "逐像素并不意味着每个屏幕像素都会执行一次片元shader：覆盖、裁剪、深度和多重采样等会影响实际调用。这里关闭抗锯齿并用简单球体，只讨论插值方向到片元计算颜色的路径。不能根据canvas宽乘高就宣布精确shader调用次数，更不应以此估出未经测量的GPU耗时。"
        },
        {
          "type": "paragraph",
          "text": "高光所在位置随观察方向改变，而漫反射只依赖表面与光向。若以后加入可移动相机，应同时更新世界相机位置uniform与view矩阵；只改投影后的画面却继续拿旧相机点计算V，会得到视觉位置与高光不一致的问题。本篇固定相机是为了把这一关系明示，而不是声称观察方向可以忽略。"
        }
      ]
    },
    {
      "id": "material",
      "title": "材质色、环境项和显示变换的承诺各到哪",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "片元颜色包含橙色基底乘环境加漫反射，再叠加白色高光。环境项只是保证背光处仍可见的常量，不代表真实环境光积分；材质参数是人为指定，也没有能量守恒或金属度工作流。理解这种简化的价值是能读懂来源，而不是把几个常量调好后就称为真实材料。"
        },
        {
          "type": "paragraph",
          "text": "可选的gamma二点二只是近似显示变换，对非负颜色做幂函数；它不等于完整sRGB分段编码，更没有覆盖贴图输入解码、HDR、色调映射与浏览器色彩管理。法线调试色直接把方向分量从负一到一映射到零到一，不应用相同gamma。这样颜色可以帮助检查方向，却不能当作精确色度测量。"
        },
        {
          "type": "paragraph",
          "text": "改变高光指数、光向或非均匀缩放后，应在同一视角对照。若把相机、材质、灯光和法线模式同时改了，即使图片更漂亮，也很难证明修的是哪一项。本文刻意保留错误法线开关，用可重复反例说明模型矩阵为什么不够，而不是只展示最终成功版本。"
        },
        {
          "type": "paragraph",
          "text": "颜色超过一时，当前普通输出会在最终目标表示范围内受限，并没有保留HDR信息。把高光强度继续加大可能只得到更大的饱和白块，不代表更真实的光源。需要高动态范围时，要从离屏格式、颜色空间和色调映射一起设计；下一篇的RGBA8目标仍是普通范围教学，不偷偷承诺浮点管线。"
        }
      ]
    },
    {
      "id": "render",
      "title": "从数据布局到uniform，把完整链路连接起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-shader-lighting/data.ts",
          "kind": "excerpt",
          "purpose": "完整模型参数、默认值与旋转乘缩放。scaleX必须正且不超过2，shine为1..128；动画只改变Y角度。",
          "code": "export type Options={angle:number;scaleX:number;light:number;shine:number;wrongNormal:boolean;normalColor:boolean;gamma:boolean;animate:boolean};\nexport const defaults:Options={angle:25,scaleX:1.6,light:35,shine:32,wrongNormal:false,normalColor:false,gamma:true,animate:false};\nexport function lightingModel(options:Options,time=0){\n if(![options.angle,options.scaleX,options.light,options.shine,time].every(Number.isFinite)||options.scaleX<=0||options.scaleX>2||options.shine<1||options.shine>128)throw new RangeError('光照参数或缩放无效');\n const s=new Float32Array([options.scaleX,0,0,0,0,.7,0,0,0,0,1,0,0,0,0,1]);return multiply(rotationY((options.angle+(options.animate?time*.015:0))*Math.PI/180),s);\n}"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-shader-lighting/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整球面绘制与资源所有权。位置/法线stride24，索引绘制，模型/视投影/法线矩阵分开上传；初始化任一失败都会释放部分句柄。",
          "code": "export function createScene(gl:WebGL2RenderingContext,options:Options):Scene{\n lightingModel(options);const scope=new ResourceScope();\n try{const program=makeProgram(gl,scope,vertexShader,fragmentShader),vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v)),buffer=scope.own(gl.createBuffer(),v=>gl.deleteBuffer(v)),indices=scope.own(gl.createBuffer(),v=>gl.deleteBuffer(v)),mesh=sphereMesh();\n  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);\n  const model=requiredUniform(gl,program,'uModel'),vp=requiredUniform(gl,program,'uViewProjection'),normal=requiredUniform(gl,program,'uNormal'),light=requiredUniform(gl,program,'uLight'),shine=requiredUniform(gl,program,'uShine'),normalColor=requiredUniform(gl,program,'uNormalColor'),gamma=requiredUniform(gl,program,'uGamma');\n  return {draw(width,height,time){const m=lightingModel(options,time);const n=options.wrongNormal?new Float32Array([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]):normalMatrix(m);const angle=options.light*Math.PI/180;\n   gl.viewport(0,0,width,height);gl.clearColor(.025,.04,.06,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(vao);gl.uniformMatrix4fv(model,false,m);gl.uniformMatrix4fv(vp,false,multiply(perspective(Math.PI/3,width/height,.1,20),translation(0,0,-3.5)));gl.uniformMatrix3fv(normal,false,n);gl.uniform3f(light,Math.sin(angle),.35,Math.cos(angle));gl.uniform1f(shine,options.shine);gl.uniform1i(normalColor,+options.normalColor);gl.uniform1i(gamma,+options.gamma);gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);\n  },dispose(){scope.dispose();}};\n }catch(error){scope.dispose();throw error;}\n}"
        },
        {
          "type": "paragraph",
          "text": "同一个VAO解释位置与法线：位置偏移零、法线偏移十二字节、stride二十四字节。索引绑定也属于该VAO。每次绘制上传模型矩阵、世界法线矩阵和视投影矩阵，三个用途不同，不能因为它们都叫矩阵就互相复用。光向、高光和调试模式作为uniform，参数变化不需要重新生成球面数据。"
        },
        {
          "type": "paragraph",
          "text": "完整React入口为了让教学清理容易核验，在参数改变时重建场景并释放旧资源；生产交互通常可以保持program/VAO不变，只更新uniform。本文不把这种可读性选择宣传为性能最佳实现。动画循环中则只计算新矩阵和发绘制，不每帧重建球面。"
        },
        {
          "type": "paragraph",
          "text": "shader编译与program链接是两步，不应只检查JavaScript调用有没有抛异常。WebGL通常把编译错误放在状态与日志里，uniform还可能因未使用被优化成不可获取。本例makeProgram与requiredUniform都保留明确失败，构造场景的catch释放部分资源；测试用故意失败的接口夹具检验这些路径，而真实GLSL仍需实际浏览器编译。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "先验证几何，再到真实像素上检查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "webgl-shader-lighting",
          "title": "比较非均匀缩放下的正确与错误法线",
          "description": "保持同一角度与光向，切换wrongNormal或normalColor；读取像素/错误码，尝试上下文丢失并恢复。球体应重新出现。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端（解压后在package.json所在目录）",
          "kind": "runnable",
          "purpose": "固定Node22.12.0，独立安装并验证12项测试，再在127.0.0.1:4337启动；端口被占用会报错，不漂移。",
          "code": "node --version\n# v22.12.0\nnpm ci --ignore-scripts\nnpm test\n# tests 12, pass 12, fail 0\nnpm run check\nnpm run dev\n# http://127.0.0.1:4337/"
        },
        {
          "type": "paragraph",
          "text": "下载后npm ci、npm test实际通过12项CPU与接口夹具检查：逆转置在非均匀缩放及剪切后仍垂直，平移不影响方向，Lambert单位化与背光截断，球面索引有效，奇异变换拒绝，编译/链接失败清理和旧上下文代际退休。正确与错误法线uniform确实不同，但这仍不等于已经在GPU看到差别。"
        },
        {
          "type": "paragraph",
          "text": "真实浏览器应创建WebGL2，显示椭球并随光向改变明暗。读取中心像素时记录RGBA、WebGL版本和glError；需要对照时保持动画关闭、尺寸和其他参数固定。法线色应随旋转和缩放呈合理变化，上下文恢复后不能继续引用旧VAO、program或query。没有WebGL2时页面明确提示，不用空画布当成功。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-25记录本机macOS14.5、Node22.12.0的数学与清理结果，真实浏览器像素与手机集成由根代理另记。固定参考为WebGL2.0.0快照与GLSL ES3.00 revision6，前者页面自己仍标editor draft，不能冒称它是无草案标记的最终规范。理解了本篇后，再把片元输出先写入纹理，就进入离屏与多Pass。"
        },
        {
          "type": "paragraph",
          "text": "根代理已在真实Chromium观察到默认中心像素为235/172/141/255，保持参数只切错误法线后为204/134/93/255，错误码均零；丢失后恢复的首次探针也为零。这是当前浏览器/尺寸的实际证据，不是所有GPU的固定像素答案。物理GPU与浏览器确切发行版未确认，手机与站内最终阅读另验。"
        },
        {
          "type": "paragraph",
          "text": "若你读到不同像素，先核对默认参数、动画、画布尺寸、颜色开关与采样位置，而不是立刻把颜色差异当作公式错误。不同实现和量化也可能造成小差别。真正关键的是相同设备的受控前后变化、错误码、正确几何关系，以及恢复后还能完整绘制，这些证据应该彼此支持。"
        }
      ]
    }
  ]
};
export default article;
