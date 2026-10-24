import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "webgl-performance-lifecycle",
  "topic": "webgl",
  "title": "渲染性能与生命周期：批次、计时、内存和上下文恢复",
  "description": "在同一几何场景比较逐项提交与实例化批次，分开记录CPU提交和可选GPU异步查询，限制样本与查询容量，明确字节估计、资源释放和丢失恢复证据。",
  "minutes": 60,
  "tags": [
    "批次",
    "GPU计时",
    "实例化",
    "内存",
    "上下文恢复"
  ],
  "scope": "在同一几何场景比较逐项提交与实例化批次，分开记录CPU提交和可选GPU异步查询，限制样本与查询容量，明确字节估计、资源释放和丢失恢复证据。 WebGL2、GLSL ES3.00；CPU数学/接口边界验证与真实浏览器像素分开。不是WebGL1兼容层或物理渲染引擎。",
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
      "path": "webgl-performance-lifecycle.zip"
    },
    {
      "label": "安装、像素与失败步骤",
      "path": "webgl-performance-lifecycle/README.md"
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
      "title": "Khronos：EXT_disjoint_timer_query_webgl2 revision4",
      "url": "https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/"
    },
    {
      "title": "Khronos：WEBGL_lose_context revision15",
      "url": "https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/"
    },
    {
      "title": "MDN：WebGL实践中的同步与资源建议",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "渲染性能要先问：时间到底花在哪条线上",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "浏览器主线程把WebGL调用提交给图形实现，GPU随后执行命令，两者可能重叠。一次draw调用返回，不代表像素已经算完；requestAnimationFrame回调也只是浏览器安排的帧入口，不是“GPU恰好开始”信号。因此拿performance.now包住draw得到一个数，不能直接把它命名为GPU渲染耗时。"
        },
        {
          "type": "paragraph",
          "text": "性能可能受JavaScript计算、API调用数量、驱动验证、顶点与片元数量、纹理带宽或同步等待影响。减少draw次数主要针对提交与批次开销，不保证减少相同几何的片元工作。我们用同一组小三角形做对照：逐项模式每项一次uniform更新和draw，实例化模式一次draw携带所有偏移。改变的是提交组织，不偷偷减少画面对象。"
        },
        {
          "type": "paragraph",
          "text": "本篇同时处理生命周期。一个场景越跑越慢，可能是每次参数修改都留下旧RAF、query或纹理；只有计时没有资源归属很难定位。交付包括真实可运行场景、CPU提交采样、可选GPU查询、名义缓冲字节和上下文恢复。没有事先写好的速度倍数，也不把开发机观察推广成手机GPU表现。"
        }
      ]
    },
    {
      "id": "same-work",
      "title": "相同输入、不同批次，才是有解释力的对照",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-performance-lifecycle/data.ts",
          "kind": "excerpt",
          "purpose": "完整确定性偏移数据与60样本窗口。count1..5000，nearest-rank百分位、空样本null、有限非负值检查与清空。",
          "code": "export type Options={count:number;batch:boolean;animate:boolean};\nexport const defaults:Options={count:1000,batch:true,animate:true};\nexport function offsetsFor(count:number){\n if(!Number.isInteger(count)||count<1||count>5000)throw new RangeError('instance count 1..5000');\n const side=Math.ceil(Math.sqrt(count)),spacing=1.8/side,offsets=new Float32Array(count*2);\n for(let i=0;i<count;i++){offsets[i*2]=-.9+spacing*(i%side+.5);offsets[i*2+1]=-.9+spacing*(Math.floor(i/side)+.5);}return {offsets,size:spacing*.65};\n}\nexport class Samples{\n private values:number[]=[];\n constructor(private capacity=60){if(!Number.isInteger(capacity)||capacity<1||capacity>1000)throw new RangeError('sample capacity 1..1000');}\n push(value:number){if(!Number.isFinite(value)||value<0)throw new RangeError('finite nonnegative measurement required');this.values.push(value);if(this.values.length>this.capacity)this.values.shift();}\n clear(){this.values=[];}\n summary(){if(!this.values.length)return {count:0,p50:null,p95:null};const s=[...this.values].sort((a,b)=>a-b),at=(p:number)=>s[Math.max(0,Math.ceil(p*s.length)-1)];return {count:s.length,p50:at(.5),p95:at(.95)};}\n}"
        },
        {
          "type": "paragraph",
          "text": "offsetsFor按规则生成网格，三角形数量一到五千，位置与局部尺寸由数量确定。相同count下，两模式使用完全相同顶点、偏移、颜色和旋转角度；做像素对照要关闭动画，并固定画布与DPR。数量改变时布局也改变，不能把不同count的截图差异误当实例化改变了几何。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-performance-lifecycle/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整顶点/片元shader。uniform选择实例偏移或单项偏移，同一位置公式与颜色保持不变。",
          "code": "export const vertexShader=`#version 300 es\nlayout(location=0) in vec2 aPosition;\nlayout(location=1) in vec2 aOffset;\nuniform bool uBatch;\nuniform vec2 uOffset;\nuniform float uSize;\nuniform float uAngle;\nout vec3 vColor;\nvoid main(){vec2 offset=uBatch?aOffset:uOffset;float c=cos(uAngle),s=sin(uAngle);vec2 p=mat2(c,s,-s,c)*aPosition*uSize+offset;gl_Position=vec4(p,0.0,1.0);vColor=vec3(aPosition*0.5+0.5,0.7);}`;\nexport const fragmentShader=`#version 300 es\nprecision highp float;\nin vec3 vColor;\nout vec4 outColor;\nvoid main(){outColor=vec4(vColor,1.0);}`;"
        },
        {
          "type": "paragraph",
          "text": "逐项模式禁用偏移数组并提供常量属性，实际位置来自uOffset；批次模式绑定偏移VBO，divisor为一，位置来自aOffset。两个VAO明确保存各自布局，避免切模式后遗留一个错误divisor。实例化把提交压成一次，但每个实例仍要执行顶点变换，并覆盖自己的片元，不能理解为只画了一个三角形再免费复制。"
        },
        {
          "type": "paragraph",
          "text": "实例化需要实例记录与对应divisor，逐项提交需要在每个draw前更新偏移，两者的API工作并非完全相同，正是本对照想测的变化。应该固定的是最终几何与颜色条件，而不是要求API调用逐条一样。若为了减少调用顺便降低几何数量，再把差异全部归功于批次，就失去解释力。"
        }
      ]
    },
    {
      "id": "cpu",
      "title": "CPU计时只包住你承诺要比较的提交区间",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例CPU区间从发绘制前的performance.now开始，到本批最后一次绘制调用返回结束。逐项模式包含每项uOffset更新，批次模式是一次实例化调用；program、VAO和公共uniform设置在区间外，所以它不是整个帧的CPU总耗时。把测量边界说清楚，才能让另一个人复现同一个指标。"
        },
        {
          "type": "paragraph",
          "text": "样本保留最近六十个，展示nearest-rank的中位和百分之九十五分位。样本少时百分位可能等于最大项，不宜解读为稳定尾延迟；编译预热、浏览器调度、后台页面与系统负载也会改变结果。切参数会重建场景并重置窗口，避免把不同count和模式的样本混在一组。"
        },
        {
          "type": "paragraph",
          "text": "我们不在CPU计时区间里插readPixels、getError或finish。它们可能触发同步或等待，把“提交成本”变成“等待前面命令完成”的混合数。像素按钮是独立诊断，它本身仍可能影响后续帧，所以严谨性能采样时不要边反复点回读边宣布测得稳定吞吐。"
        },
        {
          "type": "paragraph",
          "text": "计时分辨率可能使一个很短的提交区间显示零；它不表示CPU真的做了零工作。尤其浏览器会基于隐私政策降低时间精度，多次观测也未必得到足够细的非零值。页面保留原始数字和样本数，解释时应注明分辨率限制，不能为了“好看”用一个假定最小耗时替换它。"
        },
        {
          "type": "paragraph",
          "text": "在同一段JavaScript里立即读取大量查询结果也会改变CPU负担。因此本例的GPU轮询放在测量绘制区间外，证据百分位排序也只在读取时执行，不每个draw后重新排序。指标仍然只覆盖指定边界，排除的工作没有消失；若要评估整页CPU负载，需要浏览器性能工具和更宽的记录范围。"
        }
      ]
    },
    {
      "id": "gpu",
      "title": "GPU查询异步返回，不可用、未完成、失效要分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-performance-lifecycle/timing.svg",
          "title": "CPU与GPU有不同的测量边界",
          "alt": "CPU记录调用区间，GPU查询等待后续available；unsupported、waiting、disjoint都不填造一个零。",
          "caption": "CPU记录调用区间，GPU查询等待后续available；unsupported、waiting、disjoint都不填造一个零。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-performance-lifecycle/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整可选GPU计时器。最多4个未完成query，先检查available再读纳秒结果；disjoint丢弃pending和保留窗口；dispose处理active/pending。",
          "code": "type TimerExtension={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};\nexport class GpuTimer{\n private pending:WebGLQuery[]=[];private active:WebGLQuery|undefined;private dead=false;\n readonly samples=new Samples();readonly extension:TimerExtension|null;state='unsupported';\n constructor(private gl:WebGL2RenderingContext){this.extension=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;if(this.extension)this.state='waiting';}\n begin(){if(this.dead||!this.extension||this.active||this.pending.length>=4)return false;const q=this.gl.createQuery();if(!q)return false;this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,q);this.active=q;return true;}\n end(){if(!this.active||!this.extension)return;this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=undefined;}\n poll(){if(this.dead||!this.extension)return;\n  if(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)){for(const q of this.pending)this.gl.deleteQuery(q);this.pending=[];this.samples.clear();this.state='disjoint: discarded pending measurements';return;}\n  while(this.pending.length&&this.gl.getQueryParameter(this.pending[0],this.gl.QUERY_RESULT_AVAILABLE)){const q=this.pending.shift()!,ns=this.gl.getQueryParameter(q,this.gl.QUERY_RESULT);this.gl.deleteQuery(q);if(Number.isFinite(ns)&&ns>=0){this.samples.push(ns/1e6);this.state='valid milliseconds';}}\n }\n snapshot(){return {state:this.state,pending:this.pending.length,gpuMs:this.samples.summary()};}\n dispose(){if(this.dead)return;this.dead=true;if(this.active&&this.extension){this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.gl.deleteQuery(this.active);this.active=undefined;}for(const q of this.pending)this.gl.deleteQuery(q);this.pending=[];}\n}"
        },
        {
          "type": "paragraph",
          "text": "EXT_disjoint_timer_query_webgl2可能因浏览器、设备或隐私政策不可用，此时页面显示unsupported，GPU百分位为null。扩展存在时，用TIME_ELAPSED_EXT把绘制命令包起来，结束后先保存query，等后续事件循环或帧再查QUERY_RESULT_AVAILABLE。没有准备好就不读RESULT，也不写忙等循环堵住主线程。"
        },
        {
          "type": "paragraph",
          "text": "可用结果以纳秒返回，除以一百万变成毫秒；GPU_DISJOINT_EXT表示计时关联出现失效条件，不能继续使用这批数字。实现清除所有待完成查询和历史GPU窗口，再重新收集。查询容量最多四个，慢设备来不及返回时跳过新测量，仍继续绘制，避免为了测性能反而无限分配查询对象。"
        },
        {
          "type": "paragraph",
          "text": "这个GPU值是查询范围内的图形命令时间，不是某段JavaScript时间，也不等于整帧呈现到屏幕的延迟。CPU逐项慢慢提交时，GPU区间还可能包含命令到达与流水线等待影响，不能简单称为纯shader算术时间。CPU和GPU可能重叠，两个数直接相加也不是帧时长。"
        },
        {
          "type": "paragraph",
          "text": "查询返回可用通常需要浏览器有机会推进事件循环。把while循环写成“直到available为真”可能恰好阻止实现把状态更新成可用，从而把诊断工具变成卡死原因。这里每帧只尝试一次可用检查，没有新结果就下次再看；暂停动画时可能需要下一次独立探针才能看到前一轮结果。"
        },
        {
          "type": "paragraph",
          "text": "GPU测量也会有开销，扩展不是一个完全不影响被测程序的观察者。密集创建query或为每个小draw单独计时，可能主要测到诊断本身。本例对整个批次采一个区间并限制并发查询；更精细的分段应先确认样本成本和扩展限制，不把少量数字包装成完整GPU性能画像。"
        }
      ]
    },
    {
      "id": "render",
      "title": "完整批次提交与证据快照",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-performance-lifecycle/renderer.ts",
          "kind": "excerpt",
          "purpose": "完整双VAO/共享几何、逐项或实例化提交、独立CPU/GPU窗口、名义字节与清理。证据读取在计时区间外。",
          "code": "export type PerformanceScene=Scene&{evidence:()=>unknown};\nexport function createScene(gl:WebGL2RenderingContext,options:Options):PerformanceScene{\n const {offsets,size}=offsetsFor(options.count),scope=new ResourceScope(),cpu=new Samples();let timer:GpuTimer|undefined;\n try{const program=makeProgram(gl,scope,vertexShader,fragmentShader),single=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),batch=scope.own(gl.createVertexArray(),x=>gl.deleteVertexArray(x)),shape=scope.own(gl.createBuffer(),x=>gl.deleteBuffer(x)),instances=scope.own(gl.createBuffer(),x=>gl.deleteBuffer(x));\n  for(const vao of [single,batch]){gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,shape);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.45,.5,-.45,0,.55]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);}\n  gl.bindVertexArray(single);gl.disableVertexAttribArray(1);gl.vertexAttrib2f(1,0,0);\n  gl.bindVertexArray(batch);gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,offsets,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,8,0);gl.vertexAttribDivisor(1,1);\n  const useBatch=requiredUniform(gl,program,'uBatch'),offset=requiredUniform(gl,program,'uOffset'),scale=requiredUniform(gl,program,'uSize'),angle=requiredUniform(gl,program,'uAngle');timer=new GpuTimer(gl);\n  return {draw(width,height,time){timer!.poll();gl.viewport(0,0,width,height);gl.clearColor(.025,.04,.06,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(options.batch?batch:single);gl.uniform1i(useBatch,+options.batch);gl.uniform1f(scale,size);gl.uniform1f(angle,options.animate?time*.0004:0);\n   // Do not insert readPixels/getError/finish into either measured section.\n   timer!.begin();const started=performance.now();\n   try{if(options.batch)gl.drawArraysInstanced(gl.TRIANGLES,0,3,options.count);else for(let i=0;i<options.count;i++){gl.uniform2f(offset,offsets[i*2],offsets[i*2+1]);gl.drawArrays(gl.TRIANGLES,0,3);}}\n   finally{cpu.push(performance.now()-started);timer!.end();}\n  },evidence(){timer!.poll();return {mode:options.batch?'instanced':'individual',triangles:options.count,drawCalls:options.batch?1:options.count,cpuSubmissionMs:cpu.summary(),...timer!.snapshot(),estimatedBufferBytes:24+offsets.byteLength,note:'buffer bytes exclude driver/VAO/program/framebuffer overhead; timings are current device samples, not a speedup guarantee'};},dispose(){timer?.dispose();scope.dispose();}};\n }catch(error){timer?.dispose();scope.dispose();throw error;}\n}"
        },
        {
          "type": "paragraph",
          "text": "场景初始化只上传小三角形与偏移，动画帧中不重新分配VBO。count固定时，逐项有count次draw，批次有一次，测试能准确断言调用数；这说明提交组织改变了，不说明当前设备帧率一定提升同样倍数。若瓶颈在大量片元覆盖或昂贵采样，减少draw可能影响有限，需要继续用实际证据定位。"
        },
        {
          "type": "paragraph",
          "text": "计时器的begin可能因扩展缺失或pending满而不采样，end要能处理没有active的情况。绘制区间用finally结束本次计时并记录CPU，异常则向上反馈，而不是留一个永远active的query。测试包含活跃与已结束查询两种dispose，重复清理也不能再次删除同一有效句柄。"
        }
      ]
    },
    {
      "id": "memory",
      "title": "能计算的是名义字节，不是浏览器真实显存总量",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例位置VBO六个Float32值，二十四字节；偏移每实例两个Float32，八乘count字节。页面展示的estimatedBufferBytes就是这两项之和，不包括program、VAO、query、驱动对齐、canvas颜色/深度目标或实现缓存。JavaScript数组的byteLength可精确读取，但不能据此宣称测到了全部VRAM。"
        },
        {
          "type": "paragraph",
          "text": "DPR翻倍常使绘制缓冲宽高都翻倍，像素数量变成四倍；GPU工作与画布附件存储可能显著增长。本入口把DPR限制到二，但没有把这个值称为适合所有手机的性能保证。质量预算应结合CSS尺寸、离屏目标、采样次数和设备能力，不只看三角形数量。"
        },
        {
          "type": "paragraph",
          "text": "释放GPU资源的意义是结束应用所有权，驱动何时真正回收存储由实现决定。句柄计数回到零是必要的清理证据，但没有证明驱动缓存、系统显存或浏览器进程RSS立刻下降。本例不调用不存在的统一VRAM统计API，也不从JS堆快照推断GPU没有泄漏。"
        },
        {
          "type": "paragraph",
          "text": "上下文丢失时底层资源已经失效，但应用自己的数组、事件闭包和React状态仍可能保留。释放GPU句柄与清理JavaScript引用是两层责任：即使驱动回收了纹理，旧RAF或observer还在运行，也会继续制造无用工作。本例把停止循环、退休Scene和移除订阅放在同一所有权边界，避免只补一条deleteBuffer就称为泄漏修复。"
        }
      ]
    },
    {
      "id": "lifecycle",
      "title": "上下文恢复意味着新一代资源，而不是旧对象复活",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/webgl-performance-lifecycle/generations.svg",
          "title": "旧代场景在loss时就退休",
          "alt": "先停RAF并清除场景和query引用，再在restored事件重建；不能等恢复后才把旧代句柄拿来delete。",
          "caption": "先停RAF并清除场景和query引用，再在restored事件重建；不能等恢复后才把旧代句柄拿来delete。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/webgl-performance-lifecycle/gl-utils.ts",
          "kind": "excerpt",
          "purpose": "完整资源作用域、shader构造、uniform检查、DPR策略与场景槽位。清理幂等，SceneSlot先清引用再dispose。",
          "code": "export class ResourceScope {\n  private cleanups:Array<()=>void>=[];\n  private disposed=false;\n  own<T>(value:T|null,drop:(value:T)=>void):T {\n    if(value===null)throw new Error('GPU资源分配失败');\n    if(this.disposed){drop(value);throw new Error('资源作用域已经关闭');}\n    this.cleanups.push(()=>drop(value));return value;\n  }\n  dispose(){if(this.disposed)return;this.disposed=true;for(const drop of this.cleanups.reverse())drop();this.cleanups=[];}\n}\nexport function makeProgram(gl:WebGL2RenderingContext,scope:ResourceScope,vertex:string,fragment:string){\n  const compile=(type:number,source:string)=>{\n    const shader=scope.own(gl.createShader(type),s=>gl.deleteShader(s));\n    gl.shaderSource(shader,source);gl.compileShader(shader);\n    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'着色器编译失败');\n    return shader;\n  };\n  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);\n  const program=scope.own(gl.createProgram(),p=>gl.deleteProgram(p));\n  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);\n  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'程序链接失败');\n  return program;\n}\nexport function requiredUniform(gl:WebGL2RenderingContext,program:WebGLProgram,name:string){\n  const location=gl.getUniformLocation(program,name);\n  if(location===null)throw new Error('未找到活动uniform: '+name);return location;\n}\nexport function frameSize(width:number,height:number,dpr:number){\n  if(![width,height,dpr].every(Number.isFinite)||width<=0||height<=0||dpr<=0)throw new RangeError('画布尺寸无效');\n  const ratio=Math.min(dpr,2);return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))] as const;\n}\nexport type Scene={draw:(width:number,height:number,time:number)=>void;dispose:()=>void};\n\n// Retire a scene while its context is lost, before restoration changes generation.\nexport class SceneSlot {\n  current:Scene|undefined;\n  clear(){const previous=this.current;this.current=undefined;previous?.dispose();}\n}"
        },
        {
          "type": "paragraph",
          "text": "webglcontextlost时preventDefault表示应用愿意处理恢复，立刻取消RAF并清空当前SceneSlot。旧WebGL句柄已经不再代表可用资源，应在丢失阶段退休JS引用；若等新上下文建立后才执行旧场景cleanup，可能向新一代发送旧对象操作。恢复请求也不是同步成功，必须等待webglcontextrestored事件再重建。"
        },
        {
          "type": "code",
          "language": "tsx",
          "filename": "examples/webgl-performance-lifecycle/view.tsx.txt",
          "kind": "excerpt",
          "purpose": "完整React资源生命周期与诊断入口。loss停循环并退休旧场景，restored推动重建；卸载撤销RAF/observer/事件，像素读取与计时分离。",
          "code": "export default function App(){\n  const canvasRef=React.useRef<HTMLCanvasElement>(null);\n  const control=React.useRef<{probe:()=>void;lose:()=>void;restore:()=>void}|null>(null);\n  const [options,setOptions]=React.useState<Options>(defaults);\n  const [epoch,setEpoch]=React.useState(0),[lost,setLost]=React.useState(false);\n  const [status,setStatus]=React.useState('等待WebGL2初始化'),[evidence,setEvidence]=React.useState('尚未读取真实像素');\n  const change=(patch:Partial<Options>)=>setOptions(old=>({...old,...patch}));\n  React.useEffect(()=>{\n    const canvas=canvasRef.current;if(!canvas)return;\n    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});\n    if(!gl){setStatus('此浏览器或设备无法创建WebGL2；CPU测试不能代替GPU运行');return;}\n    const scenes=new SceneSlot();\n    let raf=0,dead=false;\n    const extension=gl.getExtension('WEBGL_lose_context');\n    const drawFrame=(time=performance.now())=>{\n      if(dead||gl.isContextLost()||!scenes.current)return;\n      const rect=canvas.getBoundingClientRect(),[width,height]=frameSize(Math.max(1,rect.width),Math.max(1,rect.height),window.devicePixelRatio||1);\n      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}\n      try{scenes.current.draw(width,height,time);}catch(error){cancelAnimationFrame(raf);setStatus(error instanceof Error?error.message:'绘制失败');throw error;}\n    };\n    const loop=(time:number)=>{try{drawFrame(time);if(!dead&&!gl.isContextLost())raf=requestAnimationFrame(loop);}catch{/* Stop this scene's loop; controls can rebuild it. */}};\n    const onLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);scenes.clear();setLost(true);setStatus('WebGL上下文已丢失，旧GPU资源不能继续使用');};\n    const onRestored=()=>{setLost(false);setEpoch(value=>value+1);};\n    canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);\n    const onResize=()=>{try{drawFrame();}catch{/* Error is already visible. */}};\n    window.addEventListener('resize',onResize);\n    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(onResize);observer?.observe(canvas);\n    try {\n      gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);\n      scenes.current=createScene(gl,options);drawFrame();setStatus('WebGL2场景已建立；请读取像素与错误码核验当前设备');\n      if(options.animate)raf=requestAnimationFrame(loop);\n    }catch(error){setStatus(error instanceof Error?error.message:'初始化失败');}\n    control.current={probe(){\n      if(!scenes.current||gl.isContextLost()){setEvidence('当前没有可读的场景');return;}\n      try{drawFrame();}catch{setEvidence('当前绘制失败，请先修复参数');return;}const rgba=new Uint8Array(4);\n      gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);\n      setEvidence(JSON.stringify({rgba:[...rgba],glError:gl.getError(),version:gl.getParameter(gl.VERSION),metrics:(scenes.current as Scene&{evidence?:()=>unknown}).evidence?.(),size:[canvas.width,canvas.height]}));\n    },lose(){if(extension)extension.loseContext();else setEvidence('此环境没有WEBGL_lose_context扩展');},restore(){if(extension)extension.restoreContext();}};\n    return ()=>{dead=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',onResize);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);control.current=null;scenes.clear();};\n  },[options,epoch]);\n  return <main style={{fontFamily:'system-ui',padding:16,maxWidth:840,margin:'auto',color:'#16352b'}}>\n    <h1>提交批次、异步计时与资源生命周期</h1>\n    <fieldset disabled={lost} style={{display:'grid',gap:12,border:'1px solid #8ca99b',padding:12}}>\n<label>三角形数 {options.count}<input type=\"range\" min=\"100\" max=\"5000\" step=\"100\" value={options.count} onChange={e=>change({count:+e.target.value})}/></label>\n<label><input type=\"checkbox\" checked={options.batch} onChange={e=>change({batch:e.target.checked})}/>实例化批次（取消则每三角形一次draw）</label>\n<label><input type=\"checkbox\" checked={options.animate} onChange={e=>change({animate:e.target.checked})}/>连续提交并旋转（关闭后手动读证据）</label>\n    </fieldset>\n    <canvas ref={canvasRef} aria-label=\"WebGL2交互场景\" style={{display:'block',width:'100%',aspectRatio:'4 / 3',background:'#091019',marginTop:12}}/>\n    <p role=\"status\">{status}</p>\n    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={lost} onClick={()=>control.current?.probe()}>读取像素与当前证据</button><button disabled={lost} onClick={()=>control.current?.lose()}>模拟上下文丢失</button><button disabled={!lost} onClick={()=>control.current?.restore()}>请求恢复上下文</button><button disabled={lost} onClick={()=>setOptions({...defaults})}>重置参数</button></div>\n    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{evidence}</pre>\n    <p>像素和错误码来自当前浏览器。测试夹具只证明CPU计算与清理调用，不能证明真实GPU渲染。计时不包含像素/错误读取；此按钮另行执行同步探针。GPU扩展不可用明确显示unsupported，不用CPU耗时冒充GPU时间。页面卸载会取消RAF并释放本例创建的资源。</p>\n  </main>;\n}"
        },
        {
          "type": "paragraph",
          "text": "卸载和参数改变都要取消本例RAF、断开ResizeObserver、移除窗口与canvas事件，并释放当前场景。React开发模式可能重复建立与清理，幂等dispose能让这些路径不依赖“只跑一次”的运气。测试用上下文代际夹具验证loss清旧引用之后恢复，再次清理不删除旧代；它不是模拟出真实GPU恢复成功。"
        },
        {
          "type": "paragraph",
          "text": "恢复后除了重新创建对象，也要重新建立布局、uniform与开关状态。旧VAO引用的buffer、旧program的uniform location都不能移植到新一代，默认状态也不应假设与之前一致。完整从CPU数据重建场景，比试着逐个修补失效句柄更容易审查；为此原始几何和参数必须仍由应用持有。"
        },
        {
          "type": "paragraph",
          "text": "重复重建夹具用一百轮检查所有创建句柄都有对应释放，能抓漏掉query或第二个VAO的错误。它不能证明浏览器驱动在一百轮后内存绝对不涨，也不能证明长时间真机恢复稳定。这些边界如果不写清，读者很容易把单元测试的live集合误读成真实显存仪表。"
        }
      ]
    },
    {
      "id": "protocol",
      "title": "先复现正确画面，再谈测量和优化",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "webgl-performance-lifecycle",
          "title": "比较批次并读取当前设备证据",
          "description": "关闭动画固定像素，对照逐项与实例化同画面；开启连续提交积累样本，再独立读证据。GPU扩展缺失或disjoint会明确标记。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端（解压后在package.json所在目录）",
          "kind": "runnable",
          "purpose": "固定Node22.12.0，独立安装并验证14项测试，再在127.0.0.1:4339启动；端口被占用会报错，不漂移。",
          "code": "node --version\n# v22.12.0\nnpm ci --ignore-scripts\nnpm test\n# tests 14, pass 14, fail 0\nnpm run check\nnpm run dev\n# http://127.0.0.1:4339/"
        },
        {
          "type": "paragraph",
          "text": "下载后npm ci、npm test实际14项通过，包含两个模式调用数、确定性偏移、样本边界、unsupported、不读取未available结果、纳秒转换、disjoint丢弃、查询清理和一百轮场景重建句柄归零。fakeGL证明的是接口调用与所有权约束，没有声称编译真正shader或测到真实显存。"
        },
        {
          "type": "paragraph",
          "text": "真实浏览器验证先确认WebGL2画面与glError零，再比较固定参数像素；如果GPU扩展不可用，记录这个限制即可。测量时先预热、保持前台与相同尺寸，记录设备、浏览器、count、模式和样本数；不要挑最好的一帧。上下文丢失/恢复后应重新出现画面，旧样本被清掉，不把两代数据混起来。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-25作者完成macOS14.5、Node22.12.0的CPU与清理检查，真实浏览器/GPU和手机由根代理另记。本篇提供的是可检查的测量边界与资源协议，不给虚构性能排名。后续优化应回到证据：提交多就批量化，片元重就减少覆盖或采样，资源累积就修所有权；每改一项再核对相同画面和相应指标。"
        },
        {
          "type": "paragraph",
          "text": "根代理在真实Chromium确认扩展可用、完整网格与glError零：实例化一千项一次draw，GPU窗口六十样本；逐项一千次draw，初次只取得七个GPU样本。两模式当时采样数不同且设备发行版未完全确认，只能作为接口和计时链路已工作的证据，不能从中发布速度倍数。恢复后逐项窗口重新积累，首次探针仍零。"
        },
        {
          "type": "paragraph",
          "text": "根观察中部分CPU提交为零，已按计时分辨率解释；GPU仍返回独立非零时间，没有被CPU替代。若你希望据此写性能报告，还需要固定机器、浏览器、前台状态、预热、相同样本数量、画布与输入，并重复实验。本站正文保留复现方法而不先写结论，避免让一个教学实验变成未经验证的设备排名。"
        }
      ]
    }
  ]
};
export default article;
