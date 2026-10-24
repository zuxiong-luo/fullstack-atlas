# greedy-intervals 作者验证

2026-10-24，status review，等待独立内容审稿与根代理浏览器/手机/ZIP/离线发布验收。

## 真实运行

macOS14.5 x64、Node22.12.0、TypeScript5.7.3、React18.3.1。npm ci --ignore-scripts实际清洁安装12包/audit0，npm test构建后**10/10通过**。

默认A[0,10),B[1,2),C[2,3),D[3,4)：最多选B/C/D三项，全部安排两房，覆盖并成[0,10)。最短时长反例[0,3),[3,6),[2,4)取中间只1但最优2。

600随机实例对子集枚举数量最优；另600房间数对最大同时重叠且逐房不冲突；300覆盖集合点检；错误策略固定反例、端点接触、嵌套、输入冻结/输出快照隔离及坏输入。

半开[start,end)，端点接触兼容。start/end安全整数且|x|≤10^9、start<end、唯一ID、最多10000项。拒绝零时长；允许负时间和相同边界不同任务。数量目标同等价值，不是带权最大收入。

按比较排序模型排序O(n log n)，选择/合并扫描O(n)，房间堆O(n log n)，复制输入/输出O(n)。保留观察快照额外O(n²)；UI最多16项。输入内存规划不是并发预订事务协议。

## 源码与表达

约三千汉字正文（不含代码），定义和结构先于场景。**5/5连续原文源码匹配**；App完整包含core且只import React，例子自足。ZIP/README paths同ID，不改分类index/共享注册/打包。

官方/原作者资料已实际浏览核对：https://cse.buffalo.edu/~atri/cse331/support/examples/interval_scheduling/index.html; https://courses.cs.vt.edu/~cs5114/spring2009/lectures/lecture04-greedy-scheduling.pdf。Dijkstra堆版本与decrease-key讲义区别明确；DP不把容量数值规模称输入位数多项式；贪心有交换/下界证明，带权与数量目标分开。

两张SVG XML有效，实际渲染/人工检查完成情况另在最终补记；CPU结果不冒充浏览器交互或手机设备。没有生产容量或任意规模保证。

最终补记：两图XML通过，实际Quick Look栅格化并逐张人工查看，箭头/数字/标签与正文相符，无明显溢出；1000方形外框只用于/tmp/atlas-alg-batch3-render预览。独立文章TypeScript检查无诊断，正文5块连续源码已核对。浏览器/390px手机仍待根代理。
