# 算法第4～6篇独立交叉审稿

2026-10-24；审稿人非作者。范围sliding-monotonic、trees-heaps-recursion、graph-traversal-dependencies全文/核心/视图/测试/README/锁文件/图/记录。只写审稿记录，没有修改作者文件。

## 独立运行与来源

本机Node22.12.0/macOS14.5，使用当前已安装锁定TS/React依赖，未冒称本轮全新安装。

- npm test --prefix examples/sliding-monotonic：10/10。
- npm test --prefix examples/trees-heaps-recursion：10/10。
- npm test --prefix examples/graph-traversal-dependencies：11/11。

构建实际执行sync-browser+tsc，App包含相同已测core原文且仅React导入。正文关键源4/5/5块连续匹配。核对Lemire cs/0610046v5（没有把其max-min三比较定理冒称本例max-only算法结论）、ODS隐式二叉堆/图遍历、现有有向图知识与不变量推导。

## 内容与失败路径

窗口：严格正数前提、闭区间与返回右开、[1,-1,5]反例、每个边界只前进；最大值下标过期/支配/相等保留新项、环容量先删后添；nextGreater严格<与同时解决多个项。1500/700/1000组不同朴素参照，2n/入出次数界、20k长序列、观察快照另计平方开销。没有用毫秒数伪证复杂度。

树堆：结构与排序规则分开，identity Set检测环/共享子节点；深度边数根0，先/中/后显式phase，层序队列引用边界；递归256是自设预算非V8极限；公开API防御Set O(n)未隐藏。200组树递归参照、20k深链、6000堆混合对拍、空/单/重复/坏数、建堆比较界。堆只父≤子，任意查找与稳定性未过度承诺。

图：依赖前置→后续、重复多重边入度处理；BFS入队标记/等权距离/不可达parent边界；DFS三色当前祖先与黑色共享后继区别、真实环见证；Kahn blocked包含下游不等于全部在环、部分order不可冒充完整调度。250图全点对距离、500图环/拓扑交叉、20k链、自环/重复/坏端点/坏parent、冻结输入与观察回调拷贝。轨迹额外时间空间单列，不冒称生产任务调度。

## 图形与验收范围

6张SVG XML解析通过，实际QuickLook逐张渲染查看：窗口[4,5]与返回[4,6)、队首过期与尾支配两种删除、固定树四序、heapify[1,2,3,7,5,9]、菱形BFS、环[1,2,1]及blocked[1,2,3]一致；未见明显标签/箭头溢出。

视图代码读审输入上限、参数/当前结构/步骤和结果，浏览器真实点击/390手机/离线与下载由根集成单列，本轮CLI/QuickLook不替代浏览器验收。未发现阻塞问题。
