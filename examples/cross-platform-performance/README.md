# 跨平台性能：Web代表平台的真实实验

固定Node22.12.0、React18.3.1、TypeScript5.7.3、esbuild0.25.12；package-lock独立锁定。无CDN/外部图片。

```sh
npm ci
npm test
npm run serve
```

打开 http://127.0.0.1:4353，Ctrl+C关闭自有服务。serve只提供固定HTML和dist/app.js，Cache-Control:no-store；HTML在bundle加载前标记，生产React bundle，未开启全局浏览器flag。CPU测试8/8只证明计算/边界与App源码同步，不证明浏览器性能。

操作：保持前台可见；先全量模式运行120步，再切窗口化运行；clone/transfer各跑一次，再读内存能力。工作负载固定2000行、32px行高、320px容器、相同终点scrollTop63680。每轮应119个rAF间隔；全量DOM2000，窗口化末端DOM13（非整行中段最多17）。若页面隐藏中断则丢弃本轮，不拿后台节流排名。

启动报HTML标记→layout effect和第二rAF机会，不叫原生冷启/实际绘制完成。rAF间隔不是物理显示帧，不把>16.7ms计数说成所有设备掉帧率。服务器no-store不等于OS缓存冷清、重启浏览器或磁盘冷缓存。

Worker为真实浏览器Worker，先8字节1次预热，再8×1MiB。每次检查id/size/首7/尾19；clone发送方保留1048576，transfer发送方变0。往返包含调度/传递/返回，不计buffer创建，不把短样本快慢推广普遍零拷贝。

observed.json是2026-10-24主代理真实内置Chromium观察，发行版未暴露、约607×954视口。完整原始窗口/通信从DOM工具读数保留；全量字段来自当次实际工具输出摘要，明确source。两轮都119样本同终点，DOM2000/13，p95约17.4/17.1ms；只作本次复现证据，不作跨端性能排名。内存API本轮有值，但非标准近似JS堆，不能覆盖RSS/GPU/所有Worker堆。未forceGC、未测泄漏。窄窗结果随后加pre-wrap呈现，测量算法未改。

未验证Flutter/RN真机、Android/iOS、原生手势、物理GPU帧/刷新率与全机内存；Web能力不能替代这些结论。下载源码和自足App可离线阅读，npm依赖与Node运行时需另装。站点离线/ZIP及实验室宿主CSP支持由主代理另验，独立入口只依赖现代浏览器Worker/blob和rAF。

2026-10-25独立审稿修正：非整行用ceil((scrollTop+height)/rowHeight)算右边界（overscan0也完整覆盖）；宿主无HTML mark时supported=false；Worker创建/工作/回收统一try/finally，构造失败也回收URL并恢复busy。新增三项回归后8/8。observed.json的2026-10-24窗口数据是修前（默认仍覆盖可见区、少一个overscan），新版复测单列，不冒称毫秒不变。

新版观测另存observed-revised-mobile.json：2026-10-25，390×844手机视口窗口化119样本/末端13/scrollTop63680，无横溢；实验室startup明确supported=false。没有同视口新版全量对照，不和旧desktop数据拼排名。手机视口依然是桌面Chromium，不等于真机。
