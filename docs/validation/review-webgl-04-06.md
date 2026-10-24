# WebGL 第4～6篇独立审稿与复现

日期：2026-10-25。审稿人：并行作者 expansion_data，未参与这三篇实现。范围为 `webgl-shader-lighting`、`webgl-framebuffer-postprocess`、`webgl-performance-lifecycle` 的正文、示例、六张 SVG、README、锁文件与作者验证记录。结论：目前未发现阻断性的机制、源码映射或复现问题；站点最终资源、手机视口和发布版本仍由主代理验收，本文不代替这些检查。

## 独立运行的环境与命令

本机实际 `node --version` 为 v22.12.0，macOS 14.5。示例锁定 React/React DOM 18.3.1、TypeScript 5.7.3、esbuild 0.28.2。

第一次在原示例目录复用现有依赖运行三套 `npm test`，分别 12/12、12/12、14/14 通过。随后复制每套示例到 `work/expansion/review-webgl-clean/<article-id>/`，排除 node_modules、dist、public-app 等生成目录，在这些独立副本中重新运行：

```sh
npm ci
npm test
npm run check
```

三套实际各安装14个包、audit报告0漏洞；从新依赖编译并执行 CPU 测试仍分别 **12/12、12/12、14/14**，无跳过。三套 check 均退出0。逐文件比较13份运行/锁定文件，副本与作者正式冻结后的源文件字节一致；README为作者随后补齐的说明，另行完整阅读。没有启动或改占作者现有4337/4338/4339服务。

编译测试会核对生成 App：只有 React 导入，嵌入完整数据、资源、renderer和视图，并检查原模块同步。正文完整路径代码独立逐块与实际文件比较：**5/5、5/5、6/6 连续原文一致**；每篇两张图均有正文 figure 块且目标路径存在。终端运行指令另计，不把它们当源码摘录。

## 光照：数学到 shader 的链路

- 重新核对切线与法线正交推导 `(Mt)·(M⁻ᵀn)=t·n`。列主序逆转置实现与非均匀缩放、剪切测试一致；平移不进入方向变换，奇异矩阵拒绝，归一化不能修复错误方向。图中的 t=(1,1,0)、n=(1,-1,0)、X放大2后错误点积3/正确点积0计算相符。
- 球面425条记录、每条位置加法线、2160索引及极点退化跳过与正文一致；位置恰好等于法线只适用于当前单位球，不推广到任意模型。
- 顶点输出世界位置和法线，片元重新 normalize；光向、观察方向与法线都在世界空间。方向约定是从表面指向光源；Lambert背光截断与Blinn半程向量的零长度保护符合实际代码。
- 高光指数、常量环境项和近似gamma2.2均明确是教学简化；没有把它们当物理粗糙度、完整sRGB或PBR。固定相机点与view矩阵、错误法线开关及失败说明一致。
- CPU测试证明数学不变量、uniform上传与资源所有权，不证明真实GPU着色结果；README与正文区分了这一边界。

## 离屏渲染：附件关系与两次绘制

- FBO保存附件关系，颜色纹理和深度renderbuffer保存实际目标数据。RGBA8+Depth16的 `w*h*6` 只作名义字节预算，没有冒充驱动真实显存。
- 创建时先登记各资源所有权，再连接并检查 FRAMEBUFFER_COMPLETE；不完整目标清理部分资源并解除绑定。正常resize先创建/验证新目标，再换出旧目标，同尺寸复用；尺寸先受比例、设备上限与2048预算约束。
- Pass1写离屏目标并使用其viewport；Pass2先切默认FBO和画布viewport，再采样上一步颜色纹理，避免当前写入图像反馈。该切换没有CPU纹理复制，也不需要插入finish；图示与调用测试相符。
- 全屏三角形的顶点/UV插值与shader一致。灰度计算假设及3×3 Laplacian边缘核明确，没有称为物理色度处理或完整Canny；反复采样所需纹素尺寸来自实际离屏纹理。
- 故意不连接附件是可复现失败，不是模拟成功结果；恢复需要重新创建资源，附件完整性本身不能保证shader、颜色和UV正确。

## 性能与生命周期：两条时间线不混用

- 逐项和实例化使用同一几何、偏移及实例数量，差异是每项uniform/draw与一次instanced draw；固定数量下调用数测试验证100与1。缓冲字节只计已知数据，不含VAO、program、驱动或帧缓冲。
- CPU区间只测本线程逐项uniform/draw提交；GPU query独立包围绘制，结果纳秒转换毫秒。两者可能重叠，不能相加为帧时长，也不能把CPU提交结束当GPU完成。
- query只在后续轮询available后读取RESULT，待返回上限4；unsupported与waiting均没有伪造0。disjoint丢弃待返回和保留的旧GPU样本；60样本窗口与nearest-rank百分位与测试一致。
- readPixels/getError位于单独探针，不藏进测量区间；探针仍可能影响后续帧，正文有说明。CPU计时分辨率出现0，不意味着零成本；不同样本数的现有观察不据此计算提速倍数。
- loss事件取消RAF，并在旧上下文仍丢失时退休旧场景；restored事件后创建新代资源，不把旧对象保留到新代再删除。卸载断开observer/listener/RAF与当前资源；CPU代际夹具及100次重建句柄归零证明调用协议，而不证明驱动真实显存立即回落。

## 规范与图形的独立检查

实际浏览核对以下原始资料：

- [Khronos WebGL 2.0.0 固定快照](https://registry.khronos.org/webgl/specs/2.0.0/)：2017-04-11，页面仍保留 Editor’s Draft 标记；正文没有把草案标记抹掉。
- [GLSL ES 3.00 revision 6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)：2016-01-29，核对输入/输出、插值、矩阵及函数语义。
- [EXT_disjoint_timer_query_webgl2](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)：revision4，核对available、disjoint与异步读取边界。
- [WEBGL_lose_context](https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/)：revision15，恢复通过事件调度，不是调用restore后同步继续使用旧句柄。
- [WebGL2Fundamentals 原作者方向光说明](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-lighting-directional.html)：用于与原理和法线空间交叉核对。

六份SVG全部XML解析并通过Quick Look实际渲染，临时预览在 `/tmp/atlas-review-webgl-final/`；审稿逐张查看法线/空间、Pass/目标生命周期、计时/资源代际，未见文字越界、缺失箭头或与代码方向相反。为避免系统缩略图裁剪，临时副本扩展外框，仓库SVG未改；此项是桌面图形检查，不冒充手机或站内放大交互验收。

## 主代理真实GPU证据的归属与限制

作者最终记录和主代理现场消息提供独立Chromium入口的真实WebGL2观测：光照正确/错误中心RGBA分别235/172/141/255与204/134/93/255；离屏原色RGB84/93/130、灰度94/94/94，无附件得到0x8cd7、恢复正常附件后首探针0；性能页实际扩展可用、1000项实例化draw1与逐项draw1000。三套context恢复后的第一次探针均为glError0，没有预先清错。审稿已核对这些记录与暴露的操作、代码、失败条件一致，**没有声称由本审稿人重新操作GPU**。

记录还保留了真实计时窗口的样本数不同这一限制，不使用它们发布加速倍数。Chromium精确发行版、物理GPU与驱动未核验；没有把软件/虚拟化实现猜成特定硬件。真实手机、跨厂商GPU、原生环境、长时间显存压力、最终站内390px阅读/图形弹层、ZIP/离线和线上发布验收须分别记录。
