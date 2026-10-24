# search-dynamic-programming 作者验证

2026-10-24，status review，等待独立内容审稿与根代理浏览器/手机/ZIP/离线发布验收。

## 真实运行

macOS14.5 x64、Node22.12.0、TypeScript5.7.3、React18.3.1。npm ci --ignore-scripts实际清洁安装12包/audit0，npm test构建后**11/11通过**。

默认A2/3,B3/4,C4/5,D2/3（重量/价值），容量6最优8，表格恢复A+C之一。重复预设6件1/1容量3：plain calls98、memo calls34/hits9/states18，值3。默认4件本身memo无命中，不虚构收益。

400随机小问题对独立位掩码子集枚举；二维每个前缀容量对拍；选中IDs的重量/价值/唯一性；同物品一维升序错误6 vs正确3；缓存跨调用、合法0、预算失败、空/无解与快照隔离。

0/1背包、不要求装满。唯一ID、正整数重量≤2000、非负整数值≤10^6，n≤200，capacity整数0..2000。回溯/plain最多20件，topDown最多100件，搜索总调用预算250000可能主动拒绝；不是无限资源承诺。

普通值递归最坏O(2^n)，带最佳路径复制的回溯保守O(n·2^n)；memo/二维O(nC)时间/存储、深度O(n)；一维O(C)空间仅值不重建。O(nC)是伪多项式。轨迹另外计算，UI12件/容量30。

## 源码与表达

约三千汉字正文（不含代码），定义和结构先于场景。**5/5连续原文源码匹配**；App完整包含core且只import React，例子自足。ZIP/README paths同ID，不改分类index/共享注册/打包。

官方/原作者资料已实际浏览核对：https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-21-dp-iii-parenthesization-edit-distance-knapsack/。Dijkstra堆版本与decrease-key讲义区别明确；DP不把容量数值规模称输入位数多项式；贪心有交换/下界证明，带权与数量目标分开。

两张SVG XML有效，实际渲染/人工检查完成情况另在最终补记；CPU结果不冒充浏览器交互或手机设备。没有生产容量或任意规模保证。

首轮默认期望笔算9错误，独立子集差分与所有实现均给8；已将固定期望/视图纠正为8后11/11重跑。后加重复预设按钮，tsc重建通过；实际默认plain/memo各23calls、0hits，重复预设98→34calls/9hits，不伪造所有输入加速。

最终补记：两图XML通过，实际Quick Look栅格化并逐张人工查看，箭头/数字/标签与正文相符，无明显溢出；1000方形外框只用于/tmp/atlas-alg-batch3-render预览。独立文章TypeScript检查无诊断，正文5块连续源码已核对。浏览器/390px手机仍待根代理。
