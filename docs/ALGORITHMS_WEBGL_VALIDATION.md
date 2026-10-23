# 算法与 WebGL 专题重写验收

2026-10-23，依据 ARTICLE_WRITING_GUIDE.md 第1—14节；文章保留review状态。

## 算法

原文缺滑动窗口、BFS和DP实现，要求自行补题；二分只有样例输出，没有证明收缩/不变量/随机对照，也无步进展示。

已改为六节递进专题，保留原5个节ID及文章/问题关联。明确四题约束、朴素解和改进动机，正文完整给出全部App.tsx（算法按逻辑分段、UI独立段），不靠跳转补代码。

- lowerBound：半开区间、不变量、终止、最左重复边界；快速本体O(log n)/O(1)，入口校验O(n)、轨迹O(log n)另计。
- longestUnique：码点定义，abba防止left回退，时间/空间说明。
- bfs：无权邻接Map、入队标记、父节点、重复/环/不可达，权重反例；仅校验可达部分。
- minCoins：无限正面额、贪心反例[1,3,4]凑6、DP定义/初值/转移/不可达/复杂度与金额上限。
- App提供二分输入、前后步、区间/中点/末尾位置和错误显示；lower-bound.svg与默认轨迹一致。

实际Node22.12.0执行7项测试通过，含1000组固定种子小数据差分、逐步分区与严格缩短断言；TypeScript/Vite构建通过。未用样例耗时证明复杂度。主代理随后在桌面IAB实际点击二分下一步，观测[0,4)→[0,2)→[0,1)→[1,1)，最终返回1且下一步禁用，截图已保存；未做手机设备验收。

## WebGL

原文仅清屏，缺完整几何绘制、shader编译/链接日志、缓冲布局、矩阵实现、资源生命周期与真实GPU观测。

现七节，保留原5个节ID及研习关联。完整App.tsx全部关键代码直接正文，按数学/GLSL/编译器/数据/组件分段；WebGL1/GLSL ES1.00，固定核对WebGL1.0.3规范，React/React DOM18.3.1、TypeScript5.7.2、Vite6.4.5、esbuild0.28.2、Node22.12.0。

交付：

- 3顶点，每顶点x,y,r,g,b；20字节stride，position offset0、color offset8；vertex/fragment与插值完整。
- 列主序mat3 P*T*R*S，uniformMatrix3fv transpose=false；角度、缩放、平移交互，DPR上限2和ResizeObserver同步viewport。
- 真正drawArrays(TRIANGLES,0,3)，状态显示compile/link、NO_ERROR/错误码、实际缓冲尺寸。
- 可控shader语法错误、varying链接类型错误、恢复正常重建；buffer/program清理、shader删除标记、上下文丢失/恢复监听。
- coordinates.svg标明模型/NDC/像素单位和buffer格式，非性能实测图。

实际Node8项测试及生产构建通过：恒等/平移、旋转后平移、aspect修正、退化/非法参数、buffer布局、fake GL编译失败/链接失败/成功后的资源控制流。fake不真实编译GLSL，不能作为GPU证据。

主代理已在桌面内置浏览器实际运行dev端口4326并反馈：

1. 默认渐变三角形像素可见，NO_ERROR。
2. compile-error模式实际显示BROKEN_TOKEN语法错误。
3. link-error模式实际显示varying类型不匹配。
4. 恢复valid后设置角度90，画面实际逆时针旋转，仍NO_ERROR。

此记录来自本次桌面IAB观测与主代理保存截图；未记录硬件renderer详情，不代表所有GPU。手机、其他设备、上下文丢失恢复尚未验证。

## 事实、资源与集成边界

已核对Python3.12 bisect_left分区定义、MIT6.006 BFS、Khronos固定WebGL1.0.3、MDN vertexAttribPointer与uniformMatrix API约定。来源链接用于追溯，算法推导和关键实现留在正文。

两个示例依赖版本锁定，有独立README、测试、入口、tsconfig与package-lock。图均为仓库SVG，主代理负责最终站内浏览器入口、ZIP/离线索引、站点搜索/路由/评论和线上发布；本代理不修改共享聚合器。不报告虚构帧率或性能收益。
