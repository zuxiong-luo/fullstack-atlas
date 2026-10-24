# 算法第1～3篇独立审校

2026-10-24，审稿者 expansion_node。范围：linear-data-structures、hash-lru、sorting-binary-search 的正文、core、view、测试、README与SVG关系。只读作者文件。范围内未发现发布阻塞。

## 实际复现

macOS14.5 x64 / Node22.12.0 / TypeScript5.7.3 / React18.3.1。使用各项目已有精确锁与已安装依赖，未声称本轮重新联网干净安装。

```sh
npm test --prefix examples/linear-data-structures
npm test --prefix examples/hash-lru
npm test --prefix examples/sorting-binary-search
```

分别 **9/9、9/9、8/8** 通过。构建会先同步自足App，再运行TypeScript编译和Node测试。正文连续源码逐项核验 **5/3/3块** 均与实际文件匹配。三张SVG为有效XML，按源码与说明逐项复核状态和箭头；站点真实渲染/交互与移动视口由主代理验收，本记录不冒充已操作浏览器。

## 推导与实现

- 动态数组保持size/capacity边界，插入从右向左搬，删除从左向右搬并清尾引用；倍增复制总量<2N仅针对追加前缀，头插仍有N(N−1)/2搬移。没有把JS Array工具载体等同于V8物理实现。
- 单链表有tail，尾插常数；中间下标操作仍需定位前驱，删除唯一节点维护head/tail。循环队列按逻辑顺序扩容，清除出队引用；空值undefined与泛型undefined歧义有说明。断言/快照额外O(n)不计入基本接口模型。
- 哈希依赖字符串长度与分布假设，碰撞仍逐键比较，更新不增长size，扩容重新分桶。固定hash=0精确证明100次失败查找比较，没有以低负载保证最坏常数时间。
- LRU使用独立JS Map+同一批双向节点；命中和更新刷新，peek与未命中不刷新；零/一容量和头尾节点行为正确。链表修改为常数引用操作，Map标准仅要求平均次线性，没有被写成语言保证的最坏O(1)。容量是条目而非字节，未附带TTL、并发加载合并或权限隔离承诺。
- 归并相等优先左侧，浅复制输入+复用aux，保持身份顺序；不带回调的基础算法O(n log n)/O(n)，保存整数组轨迹可能O(n²)已与基础算法分开。
- lower/upper采用半开候选区间，mid分支严格缩小；答案是边界位置可等于n，等值范围[lower,upper)。有序性在边界校验，未把每次O(n)扫描藏进O(log n)查询；NaN/无穷在视图入口拒绝，core有前置条件说明。

## 证据质量

线性结构两实现各3000动作差分、5000 FIFO/LIFO动作，哈希普通与全碰撞各5000动作，LRU四种容量共6000动作；排序1000数组、200身份对象、二分600数组×25目标，均结合不变量和边界，而不是只测几条“正常返回”。未用耗时证明渐进复杂度。

图中数组头插三次搬移、队列head2逻辑位置、全碰撞桶、容量2的A/B/A/C淘汰B、稳定合并身份和lower路径[0,6)→[0,3)→[0,1)→[1,1)与实现一致。图是教学状态，不声称JS引擎内存或基准轨迹。

## 一手资料核对

- [Open Data Structures数组列表](https://opendatastructures.org/ods-python/2_1_ArrayStack_Fast_Stack_O.html)、[分离链接哈希](https://opendatastructures.org/ods-python/5_1_ChainedHashTable_Hashin.html)：结构模型与增长/分布前提。
- [ECMAScript Map语义](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects)：平均次线性要求，未规定具体哈希实现。
- [Princeton固定提交Merge.java](https://github.com/kevin-wayne/algs4/blob/7bb62c32f03fec900f0cc796a548ab992feffe4e/src/main/java/edu/princeton/cs/algs4/Merge.java)：归并与稳定性机制参考。本站代码明确为自己的教学实现，未冒充V8排序源码。

## 限制

本轮未新增性能基准、内存快照、原生设备或生产负载证据；CPU单测不能替代按钮交互和响应式验收。实验规模上限和轨迹成本均明确，下载、离线包与站点评论关联由主代理集成。
