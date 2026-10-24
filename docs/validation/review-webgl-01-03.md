# WebGL三篇独立复审

2026-10-24，非原作者复读与复现。范围：`webgl-3d-transforms`、`webgl-geometry-buffers`、`webgl-texture-sampling`三篇完整正文、对应独立示例（模块/视图/生成器/测试/README）与六张SVG。**静态复读后根代理真实浏览器发现恢复后的首次GL错误，本轮已修复三套视图并补代际回归；真实修复效果待根复验。没有由本审稿者进行真实浏览器GPU、移动视口或真实手机验收。** 保持文章review，由根代理补实际浏览器证据后决定聚合。

## 独立执行

macOS14.5 x64，Node22.12.0。三套现有锁定依赖目录分别实际执行`npm test`和`npm run check`，不把原作者记录当复现：

| 独立目录 | Node测试 | 自足App同步检查 |
| --- | --- | --- |
| examples/webgl-3d-transforms | 14/14，无跳过 | 通过 |
| examples/webgl-geometry-buffers | 13/13，无跳过 | 通过 |
| examples/webgl-texture-sampling | 13/13，无跳过 | 通过 |

原始37/37；修复后三套分别14/14、13/13、13/13，合计40/40，均包含TypeScript构建。本轮复用已安装的精确依赖，没有重新宣称执行npm ci。独立内容类型检查`tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --skipLibCheck src/data/articles/webgl/index.ts`无诊断。另解析文章数据，核对所有12个带examples路径的代码块是对应真实文件的连续原文；源码映射12/12。

## 推导与实现核对

- 三维：列向量与列主序分别解释；矩阵索引col×4+row与P×V×M一致；先裁剪再除w、near/far观察z为负、NDC到窗口深度的区分正确。透视A/B系数与near→-1、far→+1推导相符，正交不随距离缩小的前提包括裁剪范围。红蓝前后结论限角度0与既定相机/LESS，不把CPU中心点计算说成完整片元证据。
- 几何：交错20字节记录、position偏移0、color偏移8、80字节总长与代码/图一致；索引6项与顶点4条区分，type/offset按字节对齐。VAO属性捕获ARRAY_BUFFER和ELEMENT_ARRAY_BUFFER自身绑定的不同准确。divisor1的8字节实例记录、最多3实例与实际数组容量一致；越界索引在创建GPU对象前拒绝，视图预先清背景，取消故障后重新创建。正文还明确WebGL2固定重启标记使Uint16最大值不能当普通索引。
- 纹理：3×5 RGBA为60字节；RGB宽3、默认alignment4的五行最少57字节而非45/60，最后一行无需尾padding。NPOT完整mip链3×5→1×2→1×1正确，额外纹素3/15约20%；没有把大方形的约1/3开销套成任意尺寸定律。采样器uniform为单元编号0、NEAREST/LINEAR的MAG限制、WebGL1与2 NPOT边界正确。直通alpha输出与blendFuncSeparate匹配，alpha因子ONE避免平方；颜色公式限不透明目标与当前数值空间，没有冒称完整线性色彩管理。
- 生命周期：资源scope反向且幂等删除；编译/链接/缺uniform路径清理已创建对象；RAF、ResizeObserver与事件监听在视图卸载解除。丢失时preventDefault并暂停，restored后由CPU数据重建。规范/真实驱动是否接受GLSL、实际删除时机、恢复后像素与错误码都需真实上下文；本轮不把假GL记录的delete调用提升为即时显存回收或GPU验收。

## 官方资料复核

实际浏览[Khronos WebGL2.0.0快照](https://registry.khronos.org/webgl/specs/2.0.0/)：2017-04-11、页面确标editor's draft，正文没有称最终冻结规范；核对NPOT支持全部正常包裹/mipmap及PRIMITIVE_RESTART_FIXED_INDEX始终启用。[GLSL ES3.00 revision6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)版本声明和3.00输入/输出语法与shader一致。另核对MDN的[vertexAttribPointer](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer)、[texImage2D](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D)、[blendFuncSeparate](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendFuncSeparate)、[contextlost事件](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)。MDN为当前维护API页，不伪称它们也固定在2017快照。

## 图形与证据边界

六张SVG均XML可解析。独立复制到ignored `work/expansion/webgl-independent/`，加方形留白外框避免Quick Look对宽图裁切，以1100px真实渲染并逐张人工查看：coordinates/depth、layout/draw、sampling/blend。标题、坐标箭头方向、VAO描述引用缓冲方向、布局/实例数字、NPOT层级和混合数值均与正文相符；未见文字裁切/覆盖。临时预览没有放入public。

CPU/假GL/SSR/HTTP能证明的范围在文章与README已分清。本轮没有启动浏览器、没有readPixels/getError实测、没有WEBGL_lose_context事件恢复实测，也没有390×844布局或手机GPU结果；这些仍由根代理验收。40项通过不覆盖真实GLSL编译、光栅化、纹理过滤、透明合成与驱动兼容。

## 真实浏览器反馈后的修复

根代理独立提供实际三维浏览器结果：默认深度中心RGBA[255,46,31,255]/error0，关闭深度蓝色[31,102,255,255]/error0，loss提示正确；restored重建后首次读取error1282，第二次0。不能由此单独断言根因，但原顺序确实会在恢复后的epoch effect cleanup才dispose旧代对象。

三套gl-utils新增SceneSlot，在contextlost中立即clear：先清空当前引用再dispose旧场景；epoch cleanup重复clear不再删除失效代句柄，restored仅重建。没有添加getError清空循环。各增加1项实际createScene对象的代际假GL回归：负对照把旧资源留到restore后删除，能观察invalidDeletes；修复路径在lost期clear，恢复后再次clear无失效删除，新代能draw并清理完毕。三套npm test+check复跑40/40，App生成源码与12个文章代码块已同步。此测试模拟API对象代际，不执行GPU；仍需根在真实恢复后首次读取确认error0。

根代理后续独立浏览器复验已返回：纹理恢复首次[17,50,92,255]/error0，三维[255,46,31,255]/0，几何[140,83,141,255]/0；UI报告WebGL2.0（OpenGL ES3.0 Chromium）。属于真实浏览器WebGL上下文证据，没有识别物理GPU硬件/驱动，不称手机或物理真机GPU。独立4331～4333入口稳定复验；站内沙箱最初渲染过，后HMR/长源码致DOM超时，冻结后站内回归另待根。
