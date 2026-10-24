# 贪心与区间问题：怎样证明局部选择成立

文章ID：greedy-intervals。独立可运行教学代码，不是原作者/引擎源码复制。

## 环境与运行

固定Node22.12.0、TypeScript5.7.3、React/ReactDOM18.3.1，完整依赖锁文件；无密钥/外部服务。

```sh
cd greedy-intervals
npm ci --ignore-scripts
npm test
# tests 10; pass 10; fail 0
```

build先由core.ts+view.tsx.txt生成只import React的App.tsx，再tsc。不要只改生成App，修改源后重新build。CPU测试真正执行dist/core.js；dist/node_modules不进下载。

## 浏览器与预期

在文章实验入口运行，或把完整App.tsx粘入本站React沙箱；没有相对模块或外部包导入。更改参数后重新建立轨迹。

默认A[0,10),B[1,2),C[2,3),D[3,4)：最多选B/C/D三项，全部安排两房，覆盖并成[0,10)。最短时长反例[0,3),[3,6),[2,4)取中间只1但最优2。

## 边界与复杂度

半开[start,end)，端点接触兼容。start/end安全整数且|x|≤10^9、start<end、唯一ID、最多10000项。拒绝零时长；允许负时间和相同边界不同任务。数量目标同等价值，不是带权最大收入。

按比较排序模型排序O(n log n)，选择/合并扫描O(n)，房间堆O(n log n)，复制输入/输出O(n)。保留观察快照额外O(n²)；UI最多16项。输入内存规划不是并发预订事务协议。

## 文件与证据

core.ts为实际被测算法；view.tsx.txt为有界交互；App.tsx为生成独立入口；sync-browser.mjs/tsconfig.json生成与编译；test.mjs为性质/差分/失败用例。package-lock.json锁所有版本。

600随机实例对子集枚举数量最优；另600房间数对最大同时重叠且逐房不冲突；300覆盖集合点检；错误策略固定反例、端点接触、嵌套、输入冻结/输出快照隔离及坏输入。

2026-10-24在macOS14.5 x64、Node22.12.0真实清洁安装12小包、audit0，构建与10项CPU测试通过。图形渲染、浏览器/手机/离线/发布范围分别记录，不把CLI通过当UI验收；没有微基准、生产负载或虚构速度结论。静态实验可离线运行已缓存的浏览器资源；CLI仍需本机依赖。
