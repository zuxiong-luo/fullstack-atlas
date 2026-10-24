# next-streaming-errors

精确版本：Node **22.12.0**，Next **16.4.2**，React/DOM **19.3.1**，TypeScript **5.7.2**。App Router，webpack生产构建，`cacheComponents:false`。package与锁文件独立，无源码外相对引用。

## 安装与生产验证

```sh
cd next-streaming-errors
npm ci
npm run build
npm test
DEMO_LAB=1 DEMO_APP_ORIGIN=http://127.0.0.1:4335 npm start
# http://127.0.0.1:4335/
```

如果已在仓库examples/next-streaming-errors中，省略cd。端口固定，占用会报错；Ctrl+C停止手工进程。安装依赖需网络或有效缓存，源码ZIP不包含node_modules、.next或release，离线阅读不代表离线自动拥有Node服务。

## 文件与正常/失败行为

- app/layout.tsx、Controls.tsx：共享交互面板。
- app/reports/[id]/：page内局部Suspense、loading、error、not-found。
- lib/gates.ts：本进程受控门；app/api/gates/route.ts：有界教学控制。
- test/：生产真实HTTP顺序和失败断言。

1. 工作台初始化正常等待，导航后共享面板保留、报告出现REGION_PENDING；30秒内点击释放，显示REPORT_READY。
2. 初始化一次失败并释放，生产浏览器应显示段落错误；点击“重新读取并恢复”，按Next16.4.2 retry重新请求该段并成功。
3. 30秒不释放会超时。最多32个ID，未释放ID不能重置；需要新实验可重用已完成ID。
4. Origin严格等于显式DEMO_APP_ORIGIN，浏览器请使用127.0.0.1固定地址；这不是身份鉴权。不要把DEMO_LAB=1的控制面部署到公网。

## 实际证据

2026-10-24，macOS14.5 x64。`npm run build`与 **4/4真实HTTP测试**通过。

真实node:http响应分段：先等待REGION_PENDING已到，断言REPORT_READY未到，随后独立HTTP release，再等待原响应完成。最终一次记录为释放前2个data事件、结束5个、状态200；事件数量是该次观察，不是协议保证。生产错误不包含内部原文、含digest，重新请求同一段成功；短期限超时和ID/Origin/忙碌约束都通过。

测试没有执行浏览器hydrate或点击retry。Next16.4.2已核对固定源码和实际安装：reset清边界状态，retry在transition中refresh再reset。HTTP新请求证明恢复条件，不冒充按钮已验。

正文有8块对应示例文件的连续原文映射；版本源码链接用于注明出处，不替代本地代码。两张SVG经XML与作者Quick Look真实查看；站点/移动视口另记。

## 边界

本机单进程Map，无持久化/租户隔离/跨实例同步。切走页面不等于报告工作已撤销，门依自己的期限结束；无真实上游性能结论。JavaScript、浏览器缓冲与代理可能改变最终显示时机，字节到达不能代替可见DOM检查。

真实浏览器hydrate、错误恢复按钮、手机视口和真手机不由HTTP测试替代；尚未执行时保留待验。测试临时部署/状态目录正常结束会删除，强杀整个测试不保证finally。


根集成浏览器补验（2026-10-24）：内置Chromium实际hydration后，先初始化受控正常报告，页面可见REGION_PENDING且工作台仍可操作；点击释放后可见REPORT_READY/reads1。新ID初始化一次失败，释放后出现“报告加载失败”和digest，未泄露内部原文；实际点击“重新读取并恢复”后同段成功REPORT_READY/reads2。此为真实DOM与按钮验收，补足原HTTP测试未覆盖的浏览器范围；不代表原生手机或代理网络矩阵。
