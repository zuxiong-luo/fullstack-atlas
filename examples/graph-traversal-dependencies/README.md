# 图的前沿与依赖

配套文章ID：`graph-traversal-dependencies`。本站教学实现，非引擎/框架源码。

## 固定环境与完整运行

Node.js22.12.0、TypeScript5.7.3、React/ReactDOM18.3.1，依赖由package-lock.json锁定。不需要外部API、数据库、密钥或计费。

```sh
cd graph-traversal-dependencies
node --version
npm ci --ignore-scripts
npm test
# tests 11; pass 11; fail 0
```

`npm run build`先把core.ts原文与view.tsx.txt合成App.tsx，再编译核心与视图。修改core或view后重新build，不要只改生成App。dist/node_modules为本地产物，不进入下载ZIP。

## 交互入口

从文章“运行实验”打开；或复制整个App.tsx到本站React沙箱。该文件只import React，不依赖沙箱相对模块加载。输入改变后重新建立轨迹，先前轨迹是旧参数的快照。树篇的固定树直接切换顺序/下一节点，堆操作直接单步执行。

预期：默认邻接表[[1,2],[3],[3],[4],[]]、源0，BFS距离0,1,1,2,3。载入环[[1],[2],[1,3],[]]：Kahn order[0]/blocked[1,2,3]/acyclicfalse；DFS cycle[1,2,1]，3只是下游阻塞。

## 目录

- core.ts：真正被CPU测试执行的算法。
- view.tsx.txt：React有界状态视图；App.tsx是可独立粘贴生成入口。
- sync-browser.mjs、tsconfig.json：生成与TypeScript编译。
- test.mjs：性质、差分、失败和边界测试。
- package.json/package-lock.json：精确版本；README.md：本说明。

## 边界与失败

输入是稠密整数端点邻接表；自环/重复边合法，多重边入度与删除都逐条计数。BFS空图无合法源；DFS空pre，Kahn空图acyclictrue。reconstruct前先查distance不是-1；父链损坏或成环拒绝。

无观察回调按邻接表时间O(V+E)、额外状态O(V)，包括输入检查。DFS只构造第一个环见证；blocked不全是环成员。保存全部观察快照可达O(V(V+E))时间/空间，UI最多16顶点/每行32边；不是增量或真实任务执行器。

## 验证证据

2026-10-24在macOS14.5 x64/Node22.12.0实际完成npm ci、TypeScript构建与11项CPU测试，无失败。250随机小图全点对参照核对每个源BFS距离；500随机图DFS/Kahn环判断交叉、环逐边存在/闭合、DAG逐边rank约束；菱形、重复边、自环、孤立点、2万深链、坏端点和快照不可干扰实现。

不是以一次耗时验证复杂度，没有虚构微基准或GPU结果。SVG正文图已另进行实际渲染；浏览器交互/手机视口/ZIP离线属于站点集成，未完成时不以CPU检查替代。静态Pages可运行React实验，CLI测试需本机Node与已安装依赖。
