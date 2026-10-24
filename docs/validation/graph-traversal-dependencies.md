# graph-traversal-dependencies 作者验证

2026-10-24，status review，待独立内容审稿与站点/浏览器集成。

## 真实环境与执行

macOS14.5 x64，Node22.12.0 / TypeScript5.7.3 / React18.3.1。`npm ci --ignore-scripts`实际清洁安装12包，audit0；`npm test`先生成App与tsc，再运行Node测试：**11/11通过**。

250随机小图全点对参照核对每个源BFS距离；500随机图DFS/Kahn环判断交叉、环逐边存在/闭合、DAG逐边rank约束；菱形、重复边、自环、孤立点、2万深链、坏端点和快照不可干扰实现。

默认邻接表[[1,2],[3],[3],[4],[]]、源0，BFS距离0,1,1,2,3。载入环[[1],[2],[1,3],[]]：Kahn order[0]/blocked[1,2,3]/acyclicfalse；DFS cycle[1,2,1]，3只是下游阻塞。

输入是稠密整数端点邻接表；自环/重复边合法，多重边入度与删除都逐条计数。BFS空图无合法源；DFS空pre，Kahn空图acyclictrue。reconstruct前先查distance不是-1；父链损坏或成环拒绝。

无观察回调按邻接表时间O(V+E)、额外状态O(V)，包括输入检查。DFS只构造第一个环见证；blocked不全是环成员。保存全部观察快照可达O(V(V+E))时间/空间，UI最多16顶点/每行32边；不是增量或真实任务执行器。

## 正文与资源

正文约三千汉字（不含代码），先概念再机制与失败。**5/5块真实连续原文**核对一致。core.ts原文嵌入App；测试确认仅React导入，浏览器不需要相对模块。下载ZIP/README路径已设置，无examples重复前缀。各分类index、共享实验注册/打包/工作流未修改，由根整合。

两张SVG有效XML；渲染/人工检查完成情况见交付补记。官方/原作者资料实际浏览：https://opendatastructures.org/ods-java/12_3_Graph_Traversal.html; https://algs4.cs.princeton.edu/lectures/keynote/42DirectedGraphs.pdf。未将扩展论文的特定比较常数或不同算法效果套到本实现。

## 未验证

作者没有冒称真实浏览器点击、390px手机、原生设备或线上发布。父代理做交互/下载/离线/路由验收后另记。CPU数学/性质验证不等于用户页面操作已通过；无生产吞吐/延迟结论。

## 本次最终图形与静态复核

两张原始SVG各嵌入1000方形预览外框，Quick Look实际栅格化并逐张人工查看，箭头、下标、值和标签无溢出；外框只为预览，不改发布源。预览位于/tmp/atlas-alg-batch2-render，不进仓库。独立内容类型检查无诊断。CPU测试之后未改算法；正文源码再次核对连续一致。浏览器与手机仍待根代理。
