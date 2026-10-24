# 线性结构与精确操作成本

配套文章 ID：`linear-data-structures`。教学实现，不是运行时内部源码。

## 环境与运行

锁定 Node.js 22.12.0、TypeScript 5.7.3、React / React DOM 18.3.1。依赖由 package-lock.json 固定；不需要数据库、密钥或外部服务。

```sh
cd linear-data-structures
node --version
npm ci --ignore-scripts
npm test
# tests 9; pass 9; fail 0
```

`npm run build` 先运行 sync-browser.mjs，由 core.ts 原文与 view.tsx.txt 合成 App.tsx，再用 TypeScript 编译。不要只改生成文件：改 core 或视图后重新 build。dist 和 node_modules 是本地生成目录，不属于下载源码。

浏览器：打开文章的“运行实验”入口；或复制整个 App.tsx 到本站 React 实验室，运行。入口只导入 React，不需要沙箱解析其他文件。CPU 测试用 Node 执行，不等于浏览器交互验收。

## 目录

- core.ts：真实被测算法，不依赖 React。
- view.tsx.txt：有界交互视图；每次操作显示参数、结构与结果。
- App.tsx：可独立放入本站 React 沙箱的生成入口。
- sync-browser.mjs、tsconfig.json：生成与编译；test.mjs：性质、差分和边界断言。
- package.json、package-lock.json：环境与依赖。

## 操作与预期结果

1. 动态数组选下标0，依次插10、20、30，内容为30/20/10；第三次扩容；连续头插有搬移。
2. 单链表尾部插入后读取最后下标，hops随距离增加；删除唯一项后仍能重新使用。
3. 队列先点重置，再逐步执行九步预设：入10/20/30/40，出10/20，入50/60/70。第八步时已经回绕并填满，第九步复制4项扩容，结果30/40/50/60/70。
4. 栈入10/20后先出20；空pop/dequeue返回undefined。负数、小数和越界下标报错，结构不变。

9项测试包含两结构各3000次差分、5000次FIFO/LIFO动作、追加前缀copies<2N、50次头插1225次搬移、回绕/扩容/引用清理及括号边界。计数是教学槽位模型，不使用耗时证明复杂度。

## 边界

动态数组和循环队列不自动缩容；size/capacity分开。泛型若允许undefined，调用者要结合size判断空，生产可改带found结果。可视槽位null只供数字演示，不能当作通用存储序列化。assertInvariant/values/界面快照有额外O(n)成本，不计入单次基础操作界。无并发等待、背压或可靠持久化。

## 验证范围

2026-10-24在macOS 14.5、Node22.12.0完成依赖锁定、清洁安装和上述CPU/TypeScript检查。没有使用微基准、伪造复杂度实测或声称生产负载。浏览器/移动视口由站点集成验收另记，未完成时不以CPU测试替代。
