# cross-platform-performance 验证记录

2026-10-24，作者实现与CPU核验，主代理真实浏览器测量。段落约4187字符，6块连续源映射，独立App仅React导入，不改分类index。

## 版本/构建

Node22.12.0、React18.3.1、TS5.7.3、esbuild0.25.12，macOS14.5。独立package-lock锁定。最初esbuild0.24.2安装出现audit1中等级告警，独立例子改为0.25.12（官方release核对），再ci audit0；不改全站依赖。npm test实际5/5，build生产React、tsc通过；全站tsc退出0。

```sh
npm ci --prefix examples/cross-platform-performance --ignore-scripts --no-fund
npm test --prefix examples/cross-platform-performance
npm run serve --prefix examples/cross-platform-performance
```

服务只提供固定HTML/bundle，127.0.0.1:4353，HTML与JS no-store。浏览器运行期间自有fixture会话35849；结束作者停止，不碰其他端口。

## 主代理真实浏览器结果

工具：Codex内置Chromium，发行版号未暴露，不猜版本。视口约607×954，body有效591px；首次navigate未手工清缓存，服务no-store不等于OS冷启动。

- 启动：HTML前置inline→layout effect40.3ms；→第二rAF机会173.7ms。不是FCP、物理呈现或原生冷启。
- 先全量2000行/320px/32px/120步：119间隔，p5016.7ms/p9517.4/max32.8，>16.7计60，elapsed2048.9，DOM2000，scrollTop63680。
- 后窗口化相同工作：119间隔，p5016.7/p9517.1/max17.7，>16.7计50，elapsed2005.6，DOM13，同scrollTop63680。
- Worker先8字节预热一次，后8×1MiB：clone p502.7/p953.3/max3.3ms，每项sender/received1048576；transfer p500.1/p950.2/max0.2，每项sender0/received1048576，首尾/ID真实校验通过。
- performance.memory支持，used57867833/total62207201/limit4395630592。非标准近似JS堆，不是RSS/所有Worker堆，不做GC或泄漏结论；未forceGC。

examples/cross-platform-performance/observed.json保存来源与边界；窗口/通信/内存来自主代理DOM原始JSON，工作目录保留两原始文件；全量值来自当次实际工具返回摘要，source明确非原始JSON保留。仅一次受工具观察的短窗口，不用于框架排名或普遍transfer提速比例。

主代理截图见窄窗长行显示不便，已将结果pre改pre-wrap/overflowWrap:anywhere，重新sync/build/5项测试，测量算法未改。无需开启全局flag。视图格式修改不伪称重新测得完全相同毫秒值。

## CPU/图文与边界

5项校验最近秩/非法样本、全滚动位置结构与64000总高度/最多16项、头尾/非法参数、通信尺寸与App core一致。它们不代替真实浏览器。6块源连续匹配，图XML通过，QuickLook实际渲染人工查看四个测量边界无明显溢出。查阅MDN rAF/Worker/非标准memory、Flutter真机profile与RN性能官方资料；没有把Web框架版本推广到未构建的原生环境。

本篇代表平台WebDOM，不验证RN/Flutter真机、Android/iOS后台、原生手势/帧、物理GPU/显示器刷新或系统内存。rAF调度间隔不等于FPS，16.7只是60Hz参考，程序scrollTop不代替真实手势。8样本通信p95等于最大样本，不能给生产尾延迟保证。实验室宿主CSP、站点文章手机/ZIP/离线由根统一验收。

## 2026-10-25独立审稿发现与修正

1. visibleRange允许overscan0，却按first+ceil(height/rowHeight)算end：top1时少最后1px。现end=ceil((top+height)/rowHeight)+overscan；默认非整行最多17、终点仍13，所有位置/overscan0补回归。
2. 实验室宿主没有独立HTML的__atlasBoot，原版可能输出NaN经JSON成null；新增startupMark能力检查，缺标记明确supportedfalse。
3. 原new Worker在try外，若CSP/能力拒绝，会残留busy与URL；现withOwnedWorker统一创建/terminate/revoke，view最终finally恢复busy。注入构造抛错以及工作成功/失败验证恰当回收。

重新生产build/tsc、8/8CPU通过。正文源码7块连续映射（新增资源helper）。old observed.json仍是10-24修前真实数据并已明确；默认可见内容当时未裁掉，但overscan语义变化，新版浏览器结果另记，不能沿用旧数字冒称同一代码。当前fixture5774供根复测。

## 2026-10-25修后浏览器复测（当前代码）

主代理实际内置Chromium，发行版未暴露；390×844手机视口，body374/scroll374无横溢。navigate、未强制清缓存，HTML→commit50.6ms/secondrAF175.9。新版window固定2000/120步/119样本：p5016.7/p9517.6/max17.7ms，>16.7共60，elapsed2004.7，DOM末端13/scrollTop63680。保存observed-revised-mobile.json，原DOM结果work/expansion/cross-performance-revised-mobile.json。

站内沙箱已实际编译：缺HTML前置标记时startup supportedfalse，说明清楚；未输出NaN/null假时长；手机iframe body356/scroll356。该次没有新版相同视口全量/通信重测，因此不把旧24日desktop数据和新版mobile组成性能对照，也不编造速度排名。手机视口非原生设备。独立作者Py再用干净临时依赖副本8/8/源码7，手机浏览器由根核验；交叉审记录review-cross-platform-02-03.md。4353自有fixture最终关闭。
