# 窗口与单调候选

配套文章ID：`sliding-monotonic`。本站教学实现，非引擎/框架源码。

## 固定环境与完整运行

Node.js22.12.0、TypeScript5.7.3、React/ReactDOM18.3.1，依赖由package-lock.json锁定。不需要外部API、数据库、密钥或计费。

```sh
cd sliding-monotonic
node --version
npm ci --ignore-scripts
npm test
# tests 10; pass 10; fail 0
```

`npm run build`先把core.ts原文与view.tsx.txt合成App.tsx，再编译核心与视图。修改core或view后重新build，不要只改生成App。dist/node_modules为本地产物，不进入下载ZIP。

## 交互入口

从文章“运行实验”打开；或复制整个App.tsx到本站React沙箱。该文件只import React，不依赖沙箱相对模块加载。输入改变后重新建立轨迹，先前轨迹是旧参数的快照。树篇的固定树直接切换顺序/下一节点，堆操作直接单步执行。

预期：默认[1,3,-1,-3,5,3,6,7]、k3输出[3,3,5,5,6,7]。min预设[2,3,1,2,4,3]/target7返回length2/start4/end6/moves11。next对[2,2,3,1,4]返回下标[2,2,4,4,-1]。

## 目录

- core.ts：真正被CPU测试执行的算法。
- view.tsx.txt：React有界状态视图；App.tsx是可独立粘贴生成入口。
- sync-browser.mjs、tsconfig.json：生成与TypeScript编译。
- test.mjs：性质、差分、失败和边界测试。
- package.json/package-lock.json：精确版本；README.md：本说明。

## 边界与失败

输入先验稠密、安全整数|x|≤10^9、长度≤10^6；正数min额外拒绝0/负数。固定宽度要求1≤k≤n；空数组max拒绝，min/next有空结果。min target为正安全整数。无解min长度0且start/end=-1。

未开observe的min额外标量O(1)，max候选O(k)+输出O(n)，next栈/输出O(n)，时间都O(n)。observer复制数组及累积输出，保留全历史额外可达O(n²)；视图限制32项。

## 验证证据

2026-10-24在macOS14.5 x64/Node22.12.0实际完成npm ci、TypeScript构建与10项CPU测试，无失败。最短窗口1500组全区间枚举差分；最大值700组逐窗差分及每步候选有效期/严格单调/队首最大检查；next1000组逐项扫描差分；长递增/递减2万项检查每项至多移除一次。

不是以一次耗时验证复杂度，没有虚构微基准或GPU结果。SVG正文图已另进行实际渲染；浏览器交互/手机视口/ZIP离线属于站点集成，未完成时不以CPU检查替代。静态Pages可运行React实验，CLI测试需本机Node与已安装依赖。
