# 哈希碰撞与 LRU

配套文章 ID：`hash-lru`。教学实现，不是运行时内部源码。

## 环境与运行

锁定 Node.js 22.12.0、TypeScript 5.7.3、React / React DOM 18.3.1。依赖由 package-lock.json 固定；不需要数据库、密钥或外部服务。

```sh
cd hash-lru
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

1. 勾选全碰撞（会清空表），set A=0、B=2。get A为0；delete A后B仍在。
2. 重置普通表，放A/B/C容量4；更新A不变容量；加入D容量8且rehashed=3。
3. LRU容量2，put A=1、put B=2、get A、put C=3，最终MRU→LRU为C/A，淘汰B。
4. peek不刷新顺序，get命中刷新；容量0不存。数值0不能用真值判断为未命中。

9项测试含普通及常数哈希各5000动作差分，低负载下100次线性失败比较，Unicode/特殊键与快照隔离；LRU跨0/1/2/7容量6000动作，对照顺序数组模型并检查Map/双链表相同节点集合。

## 边界

字符串UTF-16教学哈希不是密码哈希或抗攻击哈希；键处理要计入长度。低负载不保证好分布。LRU链操作常数步，整体还依赖JS Map定位；语言规范只保证平均次线性，不保证每次最坏O(1)。按条目而非字节限容，无TTL、异步加载合并、分布式一致性或生产命中率结论。

## 验证范围

2026-10-24在macOS 14.5、Node22.12.0完成依赖锁定、清洁安装和上述CPU/TypeScript检查。没有使用微基准、伪造复杂度实测或声称生产负载。浏览器/移动视口由站点集成验收另记，未完成时不以CPU测试替代。
