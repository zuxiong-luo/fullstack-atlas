# shortest-paths 作者验证

2026-10-24，status review，等待独立内容审稿与根代理浏览器/手机/ZIP/离线发布验收。

## 真实运行

macOS14.5 x64、Node22.12.0、TypeScript5.7.3、React18.3.1。npm ci --ignore-scripts实际清洁安装12包/audit0，npm test构建后**10/10通过**。

默认距离[0,2,1,3]；目标3恢复[0,2,1,3]路径；松弛5、旧条目2。单位权图BFS与Dijkstra一致。

500随机图对独立Bellman-Ford式松弛；200单位权图对BFS；路径逐边存在/代价一致；3千高权长链、零环/平行边、确定距离顺序、坏父链与快照隔离。

稠密非负整数带权邻接表；V≤10000/E≤1000000，权重≤10^9。负权/小数/NaN/坏端点拒绝。零权环、自环、多重边合法。不可达Infinity，路径null，UI序列化为文字。

重复候选版本基础时间O(V+E log(E+2))、额外O(V+E)，图输入另计。不是decrease-key唯一条目版本，不误写O(V)堆空间。观察数组/堆快照历史额外成本大，UI限12顶点/每行24边。

## 源码与表达

约三千汉字正文（不含代码），定义和结构先于场景。**5/5连续原文源码匹配**；App完整包含core且只import React，例子自足。ZIP/README paths同ID，不改分类index/共享注册/打包。

官方/原作者资料已实际浏览核对：https://live.ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ec187276db0faaa047d655979a44de7f_MIT6_006S20_r13.pdf; https://opendatastructures.org/ods-java/12_3_Graph_Traversal.html。Dijkstra堆版本与decrease-key讲义区别明确；DP不把容量数值规模称输入位数多项式；贪心有交换/下界证明，带权与数量目标分开。

两张SVG XML有效，实际渲染/人工检查完成情况另在最终补记；CPU结果不冒充浏览器交互或手机设备。没有生产容量或任意规模保证。

最终补记：两图XML通过，实际Quick Look栅格化并逐张人工查看，箭头/数字/标签与正文相符，无明显溢出；1000方形外框只用于/tmp/atlas-alg-batch3-render预览。独立文章TypeScript检查无诊断，正文5块连续源码已核对。浏览器/390px手机仍待根代理。
