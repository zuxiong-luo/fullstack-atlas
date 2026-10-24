# webgl-performance-lifecycle 验证记录

2026-10-25。作者实现与记录，status保留review，待独立审稿、根代理最终站内/移动视口/资源发布验收。

## 实际环境、命令与结果

macOS14.5 x64、Node.js22.12.0、TypeScript5.7.3、React/React DOM18.3.1、esbuild0.28.2。

在examples/webgl-performance-lifecycle执行：

```sh
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm test
npm run check
npm run dev
```

- 实际从锁文件安装14个包，npm audit报告0漏洞；不打包node_modules。
- npm test实际**14/14通过**，没有skip。先生成自足App并tsc，再node --test。
- 本篇行为：固定几何下逐项/实例化draw调用数、偏移生成边界、nearest-rank百分位与60样本上限、unsupported空GPU结果、available前不读RESULT、纳秒到毫秒、最多4查询、disjoint清窗、active/pending销毁、100次重建句柄回零。
- 共同行为：资源倒序销毁/幂等、编译链接/缺uniform失败部分回收、SSR文本、DPR、GLSL300标识、唯一React import与App模块同步、context generation负对照与修正顺序。
- 正文**6/6块**examples完整路径代码均为实际文件连续原文，终端命令单独注明用途。
- 独立入口固定端口4339已运行，根代理进行真实浏览器观察如下。

## 根代理真实Chromium观察（与作者CPU验证分开）

1. 默认1000个小三角形、实例化模式，连续运行以积累窗口；读证据应看到drawCalls1、triangles1000。关闭实例化，在同count下应为drawCalls1000；画面仍是同一几何和颜色。
2. 要做像素对照，分别关闭动画、固定画布、count与其他参数再读。网格中心可能在三角形间隙，只看到背景不能单凭一个像素宣布整个画面未绘制，要连同完整截图与错误码检查。
3. GPU计时扩展可选：unsupported表示没有该能力，GPU分位数为null；waiting表示尚无可读结果；disjoint会丢弃待返回结果和旧GPU窗口。关闭动画后可能需要后续独立探针推进一次结果读取，绝不忙等。
4. 测量性能先预热、保持前台与相同尺寸、记录环境并取得相同样本数；readPixels是单独诊断，不放进CPU提交区间，也不要边回读边作性能结论。CPU0可能是计时分辨率，不代表零工作。
5. 模拟loss后请求恢复；完整网格重现、首次probe0、窗口从新场景重新积累。页面退出与参数变化应释放query/VAO/VBO/program，CPU夹具不能证明真实显存马上回落。

根代理真实Chromium、1680×1260绘制缓冲、timer扩展可用，完整网格/glError0/中心背景6/10/15。实例化1000项draw1时GPU60样本p50=0.079833ms、p95=0.092333ms；逐项1000draw初次只有GPU7样本p50=0.289916ms、p95=0.3555ms，CPU14样本p50=0.2ms/p95=0.3ms；恢复后GPU60样本p50=0.289582ms/p95=0.585417ms、CPU约0.2/0.3ms。采样数不一致，物理GPU/确切发行版未确认，这些是接口工作的观测，不发布提速倍数或设备性能排名。

上述来自根代理现场消息；物理GPU/驱动、Chromium确切发行版未识别。GLSL真编译、readPixels与首次getError是实际浏览器证据，fakeGL不替代该证据。三套恢复后首探针均0，未通过预先清错伪造结果。计时采样数不一致，不作速度倍数结论。

## 来源及图形复核

- 固定Khronos WebGL2.0.0快照，正文明确该页Editor's Draft标记；GLSL ES3.00 revision6。
- EXT_disjoint_timer_query_webgl2 revision4、WEBGL_lose_context revision15（本篇使用到的能力）；原作者方向光教程/MDN API用于机制核对，不复制大段规范文字。
- 本篇两张SVG经XML解析、1000×1000外框Quick Look真实渲染并逐张查看；六张合计无文字越界或缺图。箭头、空间/Pass/查询代际与源码一致，临时图在/tmp/atlas-webgl-final-render/。
- 三篇独立tsc --noEmit --strict内容类型检查通过；npm run check各自退出0；两张已交付SVG均实际引用于正文figure块。

## 交付与限制

README包含运行、正常、失败、恢复和预期结果。ZIP应含data/renderer/gl-utils/view/App/browser/serve/sync/test、tsconfig、package及锁文件/README；排除node_modules/dist/public-app。网站离线包只保证示例文件随包缓存，安装Node依赖首次仍需网络。

未以接口夹具宣称真实显存泄漏已排除；未做真实手机、原生环境、跨厂商GPU和长期压力测试。根代理后续补最终站内实验/390px阅读、图形弹层、下载ZIP、离线包与发布版本；本文不提前标complete。
