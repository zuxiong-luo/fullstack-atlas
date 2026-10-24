# 树的访问与最小优先级

配套文章ID：`trees-heaps-recursion`。本站教学实现，非引擎/框架源码。

## 固定环境与完整运行

Node.js22.12.0、TypeScript5.7.3、React/ReactDOM18.3.1，依赖由package-lock.json锁定。不需要外部API、数据库、密钥或计费。

```sh
cd trees-heaps-recursion
node --version
npm ci --ignore-scripts
npm test
# tests 10; pass 10; fail 0
```

`npm run build`先把core.ts原文与view.tsx.txt合成App.tsx，再编译核心与视图。修改core或view后重新build，不要只改生成App。dist/node_modules为本地产物，不进入下载ZIP。

## 交互入口

从文章“运行实验”打开；或复制整个App.tsx到本站React沙箱。该文件只import React，不依赖沙箱相对模块加载。输入改变后重新建立轨迹，先前轨迹是旧参数的快照。树篇的固定树直接切换顺序/下一节点，堆操作直接单步执行。

预期：固定树4(2(1,3),7(null,9))：先序4,2,1,3,7,9；中序1,2,3,4,7,9；后序1,3,2,9,7,4；层序4,2,7,1,3,9。heapify7,2,9,1,5,3得到1,2,3,7,5,9，逐次pop1,2,3,5,7,9。

## 目录

- core.ts：真正被CPU测试执行的算法。
- view.tsx.txt：React有界状态视图；App.tsx是可独立粘贴生成入口。
- sync-browser.mjs、tsconfig.json：生成与TypeScript编译。
- test.mjs：性质、差分、失败和边界测试。
- package.json/package-lock.json：精确版本；README.md：本说明。

## 边界与失败

树有限数值，null为空；对象身份共享/成环拒绝，不按相等值去重。递归预算0..256，根深度0，超出预算主动报错，不冒充V8实际栈上限。堆有限数值、空pop/peek返回undefined，不承诺相等任务稳定。

遍历本身O(n)、显式深度帧O(h)，输出O(n)，公开API防御Set另O(n)不可忽略；层序队列保留O(n)引用。堆peekO(1)，push/pop键比较O(log n)，建堆O(n)；values/assertInvariant为O(n)观察。JS数组容量管理不属键比较承诺。

## 验证证据

2026-10-24在macOS14.5 x64/Node22.12.0实际完成npm ci、TypeScript构建与10项CPU测试，无失败。200浅随机树递归独立参照；2万节点深链显式帧成功、递归预算失败；环/共享/空树；堆6000混合操作对排序多重集合，每步不变量；不同规模底向上建堆比较≤2n。

不是以一次耗时验证复杂度，没有虚构微基准或GPU结果。SVG正文图已另进行实际渲染；浏览器交互/手机视口/ZIP离线属于站点集成，未完成时不以CPU检查替代。静态Pages可运行React实验，CLI测试需本机Node与已安装依赖。
