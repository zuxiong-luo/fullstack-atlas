# webgl-framebuffer-postprocess 验证记录

2026-10-25。作者实现与记录，status保留review，待独立审稿、根代理最终站内/移动视口/资源发布验收。

## 实际环境、命令与结果

macOS14.5 x64、Node.js22.12.0、TypeScript5.7.3、React/React DOM18.3.1、esbuild0.28.2。

在examples/webgl-framebuffer-postprocess执行：

```sh
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm test
npm run check
npm run dev
```

- 实际从锁文件安装14个包，npm audit报告0漏洞；不打包node_modules。
- npm test实际**12/12通过**，没有skip。先生成自足App并tsc，再node --test。
- 本篇行为：尺寸/预算上限、RGBA8+Depth16名义字节、灰度CPU参照、不完整附件的部分初始化清理、双Pass绑定与viewport、同尺寸复用和resize回收、非法尺寸在分配前拒绝。
- 共同行为：资源倒序销毁/幂等、编译链接/缺uniform失败部分回收、SSR文本、DPR、GLSL300标识、唯一React import与App模块同步、context generation负对照与修正顺序。
- 正文**5/5块**examples完整路径代码均为实际文件连续原文，终端命令单独注明用途。
- 独立入口固定端口4338已运行，根代理进行真实浏览器观察如下。

## 根代理真实Chromium观察（与作者CPU验证分开）

1. 保持动画关闭，原色模式看完整彩色三角形并读像素。切灰度，同一位置RGB应接近相等；切边缘，颜色变化处较亮，平滑区域响应较弱。
2. 离屏比例在0.25..1间调整，第二Pass仍覆盖整个canvas。缩小影响输入采样和第一Pass规模，不能把总耗时直接按面积推算。
3. 勾选“故意不连接附件”，页面应明确显示Framebuffer不完整（本次真实状态0x8cd7）；取消后重建，首次探针应为glError0。该开关是缺少附件，不是模拟一个成功FBO。
4. “模拟上下文丢失”后等丢失状态，再请求恢复；restored后应重新创建颜色/深度附件，完整三角形再次出现，首次探针无错。

根代理真实Chromium、1680×1260绘制缓冲：原色中心RGB84/93/130，灰度94/94/94；无附件报Framebuffer0x8cd7，取消后首次探针0；丢失恢复后首次探针0。物理GPU与确切发行版未确认，不是所有设备固定像素值。

上述来自根代理现场消息；物理GPU/驱动、Chromium确切发行版未识别。GLSL真编译、readPixels与首次getError是实际浏览器证据，fakeGL不替代该证据。三套恢复后首探针均0，未通过预先清错伪造结果。计时采样数不一致，不作速度倍数结论。

## 来源及图形复核

- 固定Khronos WebGL2.0.0快照，正文明确该页Editor's Draft标记；GLSL ES3.00 revision6。
- EXT_disjoint_timer_query_webgl2 revision4、WEBGL_lose_context revision15（本篇使用到的能力）；原作者方向光教程/MDN API用于机制核对，不复制大段规范文字。
- 本篇两张SVG经XML解析、1000×1000外框Quick Look真实渲染并逐张查看；六张合计无文字越界或缺图。箭头、空间/Pass/查询代际与源码一致，临时图在/tmp/atlas-webgl-final-render/。
- 三篇独立tsc --noEmit --strict内容类型检查通过；npm run check各自退出0；两张已交付SVG均实际引用于正文figure块。

## 交付与限制

README包含运行、正常、失败、恢复和预期结果。ZIP应含data/renderer/gl-utils/view/App/browser/serve/sync/test、tsconfig、package及锁文件/README；排除node_modules/dist/public-app。网站离线包只保证示例文件随包缓存，安装Node依赖首次仍需网络。

未以接口夹具宣称真实显存泄漏已排除；未做真实手机、原生环境、跨厂商GPU和长期压力测试。根代理后续补最终站内实验/390px阅读、图形弹层、下载ZIP、离线包与发布版本；本文不提前标complete。
