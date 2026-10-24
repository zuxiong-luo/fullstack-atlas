# 稳定归并与边界二分

配套文章 ID：`sorting-binary-search`。教学实现，不是运行时内部源码。

## 环境与运行

锁定 Node.js 22.12.0、TypeScript 5.7.3、React / React DOM 18.3.1。依赖由 package-lock.json 固定；不需要数据库、密钥或外部服务。

```sh
cd sorting-binary-search
node --version
npm ci --ignore-scripts
npm test
# tests 8; pass 8; fail 0
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

1. 默认4,2,2,7,1，逐次合并后得到1#4/2#1/2#2/4#0/7#3，两个2原始次序保留。
2. 目标2，排序结果lower=1、upper=3，等值数量2；切换upper重置步骤。
3. 输入1,2,2,2,4,8，目标2，lower依次[0,6)→[0,3)→[0,1)→[1,1)，upper=4。
4. 直接二分输入先检查升序，2,1应拒绝；空数组两个边界为0；目标不存在返回合法插入边界，可能等于n，不应读取a[n]。

8项测试：1000组排序差分/幂等/输入不变；带身份对象稳定性；600组数组×25目标对照线性参照；每个二分步骤严格缩小及分区不变量；空/单项/重复/负小数、NaN/Infinity/空洞拒绝。无计时复杂度结论。

## 边界

compare必须一致且可形成排序规则；基础mergeSort不负责验证任意比较器。bound要求有限升序数据和有限目标，准备阶段检查；查询内部不扫描O(n)前提。基础归并O(n log n)时间/O(n)辅助空间；可选教学回调每次复制整数组，保留全轨迹额外可达O(n²)时间/引用空间，只在最多32项视图开启。不要把轨迹分配成本包装成算法本身空间界。

## 验证范围

2026-10-24在macOS 14.5、Node22.12.0完成依赖锁定、清洁安装和上述CPU/TypeScript检查。没有使用微基准、伪造复杂度实测或声称生产负载。浏览器/移动视口由站点集成验收另记，未完成时不以CPU测试替代。
