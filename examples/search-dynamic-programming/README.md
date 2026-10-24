# 搜索与动态规划：回溯、记忆化和状态转移

文章ID：search-dynamic-programming。独立可运行教学代码，不是原作者/引擎源码复制。

## 环境与运行

固定Node22.12.0、TypeScript5.7.3、React/ReactDOM18.3.1，完整依赖锁文件；无密钥/外部服务。

```sh
cd search-dynamic-programming
npm ci --ignore-scripts
npm test
# tests 11; pass 11; fail 0
```

build先由core.ts+view.tsx.txt生成只import React的App.tsx，再tsc。不要只改生成App，修改源后重新build。CPU测试真正执行dist/core.js；dist/node_modules不进下载。

## 浏览器与预期

在文章实验入口运行，或把完整App.tsx粘入本站React沙箱；没有相对模块或外部包导入。更改参数后重新建立轨迹。

默认A2/3,B3/4,C4/5,D2/3（重量/价值），容量6最优8，表格恢复A+C之一。重复预设6件1/1容量3：plain calls98、memo calls34/hits9/states18，值3。默认4件本身memo无命中，不虚构收益。

## 边界与复杂度

0/1背包、不要求装满。唯一ID、正整数重量≤2000、非负整数值≤10^6，n≤200，capacity整数0..2000。回溯/plain最多20件，topDown最多100件，搜索总调用预算250000可能主动拒绝；不是无限资源承诺。

普通值递归最坏O(2^n)，带最佳路径复制的回溯保守O(n·2^n)；memo/二维O(nC)时间/存储、深度O(n)；一维O(C)空间仅值不重建。O(nC)是伪多项式。轨迹另外计算，UI12件/容量30。

## 文件与证据

core.ts为实际被测算法；view.tsx.txt为有界交互；App.tsx为生成独立入口；sync-browser.mjs/tsconfig.json生成与编译；test.mjs为性质/差分/失败用例。package-lock.json锁所有版本。

400随机小问题对独立位掩码子集枚举；二维每个前缀容量对拍；选中IDs的重量/价值/唯一性；同物品一维升序错误6 vs正确3；缓存跨调用、合法0、预算失败、空/无解与快照隔离。

2026-10-24在macOS14.5 x64、Node22.12.0真实清洁安装12小包、audit0，构建与11项CPU测试通过。图形渲染、浏览器/手机/离线/发布范围分别记录，不把CLI通过当UI验收；没有微基准、生产负载或虚构速度结论。静态实验可离线运行已缓存的浏览器资源；CLI仍需本机依赖。
