# next-streaming-errors 作者验证

2026-10-24。status review，等待独立审稿与真实浏览器验收。macOS14.5 x64 / Node22.12.0 / Next16.4.2 / React与DOM19.3.1 / TS5.7.2，webpack，Cache Components关闭。

## 实际运行

在对应examples目录：

```sh
npm run build
npm test
npm run typecheck
```

构建与 **4/4真实HTTP测试**通过。端口4335，测试结束释放；手工start是复现说明，不混称为已点过浏览器。

真实node:http响应分段：先等待REGION_PENDING已到，断言REPORT_READY未到，随后独立HTTP release，再等待原响应完成。最终一次记录为释放前2个data事件、结束5个、状态200；事件数量是该次观察，不是协议保证。生产错误不包含内部原文、含digest，重新请求同一段成功；短期限超时和ID/Origin/忙碌约束都通过。

测试没有执行浏览器hydrate或点击retry。Next16.4.2已核对固定源码和实际安装：reset清边界状态，retry在transition中refresh再reset。HTTP新请求证明恢复条件，不冒充按钮已验。

## 正文、图形与依赖

- 8块关键代码正文与实际文件连续原文映射；另有必要框架出处说明。
- 独立TypeScript类型检查、XML与源码匹配由下方复核追加。
- 两张SVG以940方形外框Quick Look真实渲染逐张查看，检查标签/方向/边界，未见溢出；不是移动浏览器验收。
- 精确版本锁包含依赖；生产示例实际npm ci，流式示例本地复用此前同版本运行时，另有独立锁供ZIP干净安装。

## 仍需根代理验证

- [ ] 真实浏览器首访、hydrate、按钮交互。
- [ ] 流式错误retry/生产计数按钮、移动视口。
- [ ] 下载ZIP干净安装、资产和离线包完整性。
- [ ] Linux/Docker/托管多区域等专用环境，未执行时明确保留。

本机单进程Map，无持久化/租户隔离/跨实例同步。切走页面不等于报告工作已撤销，门依自己的期限结束；无真实上游性能结论。JavaScript、浏览器缓冲与代理可能改变最终显示时机，字节到达不能代替可见DOM检查。

## 最终静态复核

正文源码连续匹配8/8，两图XML有效，独立内容类型检查通过。示例npm run typecheck也通过。


根集成浏览器补验（2026-10-24）：内置Chromium实际hydration后，先初始化受控正常报告，页面可见REGION_PENDING且工作台仍可操作；点击释放后可见REPORT_READY/reads1。新ID初始化一次失败，释放后出现“报告加载失败”和digest，未泄露内部原文；实际点击“重新读取并恢复”后同段成功REPORT_READY/reads2。此为真实DOM与按钮验收，补足原HTTP测试未覆盖的浏览器范围；不代表原生手机或代理网络矩阵。
