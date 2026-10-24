# 最短路径与优先队列：从 BFS 到 Dijkstra

文章ID：shortest-paths。独立可运行教学代码，不是原作者/引擎源码复制。

## 环境与运行

固定Node22.12.0、TypeScript5.7.3、React/ReactDOM18.3.1，完整依赖锁文件；无密钥/外部服务。

```sh
cd shortest-paths
npm ci --ignore-scripts
npm test
# tests 10; pass 10; fail 0
```

build先由core.ts+view.tsx.txt生成只import React的App.tsx，再tsc。不要只改生成App，修改源后重新build。CPU测试真正执行dist/core.js；dist/node_modules不进下载。

## 浏览器与预期

在文章实验入口运行，或把完整App.tsx粘入本站React沙箱；没有相对模块或外部包导入。更改参数后重新建立轨迹。

默认距离[0,2,1,3]；目标3恢复[0,2,1,3]路径；松弛5、旧条目2。单位权图BFS与Dijkstra一致。

## 边界与复杂度

稠密非负整数带权邻接表；V≤10000/E≤1000000，权重≤10^9。负权/小数/NaN/坏端点拒绝。零权环、自环、多重边合法。不可达Infinity，路径null，UI序列化为文字。

重复候选版本基础时间O(V+E log(E+2))、额外O(V+E)，图输入另计。不是decrease-key唯一条目版本，不误写O(V)堆空间。观察数组/堆快照历史额外成本大，UI限12顶点/每行24边。

## 文件与证据

core.ts为实际被测算法；view.tsx.txt为有界交互；App.tsx为生成独立入口；sync-browser.mjs/tsconfig.json生成与编译；test.mjs为性质/差分/失败用例。package-lock.json锁所有版本。

500随机图对独立Bellman-Ford式松弛；200单位权图对BFS；路径逐边存在/代价一致；3千高权长链、零环/平行边、确定距离顺序、坏父链与快照隔离。

2026-10-24在macOS14.5 x64、Node22.12.0真实清洁安装12小包、audit0，构建与10项CPU测试通过。图形渲染、浏览器/手机/离线/发布范围分别记录，不把CLI通过当UI验收；没有微基准、生产负载或虚构速度结论。静态实验可离线运行已缓存的浏览器资源；CLI仍需本机依赖。
