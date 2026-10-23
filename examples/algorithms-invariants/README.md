# 算法不变量与二分步进

React/React DOM18.3.1、TypeScript5.7.2、Vite6.4.5、esbuild0.28.2；Node22.12.0。App.tsx只依赖React，可接本站实验室。

```sh
cd examples/algorithms-invariants
npm ci
npm test
npm run build
npm run dev -- --port 4321 --strictPort
```

默认[1,2,2,4]找2：按下一步，区间依次[0,4)→[0,2)→[0,1)→[1,1)，结果1。可切换空数组、全相同、target越界。无序或非有限输入显示错误；前后步骤、输入变化重置位置。

导出完整lowerBound、traceLowerBound、longestUnique、bfs、minCoins。lowerBound本体假定有序且有限，O(log n)；交互入口额外做O(n)校验与O(log n)轨迹存储，不宣称整体只有O(log n)。字符串按Unicode code point处理，不按视觉字素簇。BFS只支持无权邻接Map，按入队标记；DP为可重复使用正面额的最少硬币数。

7项Node测试含1000组确定种子差分与每步不变量；其余覆盖Unicode/abba、环/重复边/自环/不可达/非法邻接、DP贪心反例与不可达。build验证类型与打包；交互与手机视觉另由浏览器检查，不把Node测试当UI测试。
