# 非 React 新专题 SVG 视觉审校记录

核验日期：2026-10-23。范围为本轮后端9篇、前端5篇、Agent 8章的仓库内SVG，共26张；不含既有React图，也不把Electron运行截图当作SVG审校。

## 方法与实际查看

使用官方 npm 包 `@resvg/resvg-js 2.6.2` 将仓库SVG渲染为白底、宽1400px的PNG，实际加载macOS PingFang中文字体；初次全量使用系统字体，修订及新增图使用显式PingFang/SFNS字体。用PIL生成约700px单图的contact sheets，逐页调用view_image查看；对Agent02/03/04/05/06/08、Node生命周期、Next边界另查看1400px单图。检查中文是否缺字、标签是否超框、箭头起止/走向、默认填充、画布裁切及图示机制。

复现脚本和PNG留在忽略的 `work/topic-figure-review/`，不是运行时依赖：

```sh
node work/topic-figure-review/render.cjs
node work/topic-figure-review/render-selected.cjs agent-tools-mcp/execution.svg agent-rag/retrieval.svg agent-control-loop/checkpoints.svg agent-context-memory/boundaries.svg agent-production/capacity.svg
```

这份结论是**桌面SVG栅格视觉核验**；没有操作浏览器、没有验证CSS容器/缩放/横向滚动，也没有验证手机真机。不能据此标记响应式页面或移动端阅读已验收。

## 发现、修正与复验

1. Agent02 `execution.svg` 和Agent03 `retrieval.svg` 的折线路径没有显式 `fill="none"`，SVG默认闭合填充产生深绿色楔形。已反馈作者，由作者修两图；随后实际重新渲染并view_image复验，均变为清晰的细折线与单箭头，楔形消失。
2. Agent06 `layers.svg` 第一框的英文 `owner / question / expected` 抵住右边框并触及箭头。将该行字号21减到18，重渲染后文字完整位于框内，和箭头有间距。
3. Node `lifecycle.svg` 顶部第一框 `校验 rows / delay` 越框，第二框 `active < maxActive` 抵住右框。只将两行字号21减到18；重渲染后两行完整位于各自框内。
4. 新增Agent04/05/08三图已逐张渲染查看。检查点/恢复状态、owner与memory读取边界、超时后未结算资源仍占槽三种解释没有因图形误导成自动重试、全量物理删除或超时立即释放；中文字、箭头与边距正常。

修订没有更改图中的业务流程或共享渲染器。其余图未发现阻断阅读的中文字缺失、画布裁切、错误箭头填充或标签重叠。Next边界图箭头标签跨服务端/浏览器分隔线，表达跨界传输，未遮挡关键字；图中不以画幅面积表示耗时或线程比例。

## 最终文件清单

下表列出本次实际查看后的源文件、viewBox及SHA256前12位，便于后续改图判断是否需要重新审校。`通过`只指本记录的桌面栅格范围。

| SVG（相对 public/figures/） | viewBox | 源码摘要 | 结果 |
| --- | --- | --- | --- |
| `agent-context-memory/boundaries.svg` | `0 0 1000 790` | `a35c6fcead90` | 通过 |
| `agent-control-loop/checkpoints.svg` | `0 0 1000 790` | `6cf645442887` | 通过 |
| `agent-evaluation/layers.svg` | `0 0 1180 690` | `8c733516bc1f` | 通过 |
| `agent-foundations/boundaries.svg` | `0 0 1000 520` | `8374f0f8ebf8` | 通过 |
| `agent-foundations/sequence.svg` | `0 0 1000 680` | `fe75b659b4c9` | 通过 |
| `agent-production/capacity.svg` | `0 0 1000 790` | `42679af40d7f` | 通过 |
| `agent-rag/retrieval.svg` | `0 0 1100 520` | `8fd80620a627` | 通过 |
| `agent-security/boundary.svg` | `0 0 1100 520` | `b8f5a286568e` | 通过 |
| `agent-tools-mcp/execution.svg` | `0 0 1100 520` | `bb9e33d589a9` | 通过 |
| `algorithms-invariants/lower-bound.svg` | `0 0 1100 530` | `52d333366a3a` | 通过 |
| `cross-platform-models/model.svg` | `0 0 1100 650` | `dbde3b9e9bc9` | 通过 |
| `electron-trust-boundary/export.svg` | `0 0 1000 620` | `02dede7c73b0` | 通过 |
| `electron-trust-boundary/processes.svg` | `0 0 1050 620` | `ae0da79f490c` | 通过 |
| `flutter-engineering/model.svg` | `0 0 1100 650` | `365c52fe32b2` | 通过 |
| `k8s-debugging/request-chain.svg` | `0 0 960 320` | `95aa037d029b` | 通过 |
| `next-server-boundaries/boundaries.svg` | `0 0 1000 610` | `e2d62aa0ab41` | 通过 |
| `next-server-boundaries/cache-flow.svg` | `0 0 1000 640` | `c229c7524b52` | 通过 |
| `node-capacity/backpressure.svg` | `0 0 1040 500` | `622b4a333bb5` | 通过 |
| `node-capacity/lifecycle.svg` | `0 0 1040 620` | `77cf3da3c22a` | 通过 |
| `oauth-login/flow.svg` | `0 0 1100 630` | `0b465cc54977` | 通过 |
| `offline-first-static-site/snapshot.svg` | `0 0 960 370` | `6837852c7db2` | 通过 |
| `python-async-services/lifecycle.svg` | `0 0 1100 590` | `4b189769a549` | 通过 |
| `reliable-tasks/flow.svg` | `0 0 1060 560` | `59d9e9df9805` | 通过 |
| `transactions-locks/flow.svg` | `0 0 1060 560` | `6e55a94fd7da` | 通过 |
| `web-security-boundaries/boundaries.svg` | `0 0 1100 540` | `33dceb505d8c` | 通过 |
| `webgl-pipeline/coordinates.svg` | `0 0 1100 680` | `f553b18de3ee` | 通过 |
