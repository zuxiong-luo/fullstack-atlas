# webgl-shader-lighting 验证记录

2026-10-25。作者实现与记录，status保留review，待独立审稿、根代理最终站内/移动视口/资源发布验收。

## 实际环境、命令与结果

macOS14.5 x64、Node.js22.12.0、TypeScript5.7.3、React/React DOM18.3.1、esbuild0.28.2。

在examples/webgl-shader-lighting执行：

```sh
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm test
npm run check
npm run dev
```

- 实际从锁文件安装14个包，npm audit报告0漏洞；不打包node_modules。
- npm test实际**12/12通过**，没有skip。先生成自足App并tsc，再node --test。
- 本篇行为：逆转置保持非均匀缩放与剪切后的正交关系、平移与纯旋转、奇异/错长度/零光向拒绝、Lambert单位化与背光截断、425条球面记录及2160索引、正确与故意错误uniform上传。
- 共同行为：资源倒序销毁/幂等、编译链接/缺uniform失败部分回收、SSR文本、DPR、GLSL300标识、唯一React import与App模块同步、context generation负对照与修正顺序。
- 正文**5/5块**examples完整路径代码均为实际文件连续原文，终端命令单独注明用途。
- 独立入口固定端口4337已运行，根代理进行真实浏览器观察如下。

## 根代理真实Chromium观察（与作者CPU验证分开）

1. 保持动画关闭和默认参数，看到完整椭球；点击“读取像素与当前证据”，记录RGBA、size、WebGL版本和glError。
2. 只切“故意错误法线”，其余参数保持相同；非均匀缩放下光照会改变。切“法线颜色”看方向，调整光向与高光指数分别理解漫反射和高光。
3. 点击“模拟上下文丢失”，等状态明确丢失后再点“请求恢复上下文”；等待实际restored事件，再读取首次探针。不能用第二次清掉错误后冒充第一次正确。
4. 正文CPU测试也覆盖零缩放、非法矩阵、零光向等拒绝；UI只暴露合法滑块范围。没有WebGL2或lose扩展时明确提示。

根代理在真实Chromium、1680×1260绘制缓冲观察默认中心RGBA235/172/141/255，错误模型法线204/134/93/255；glError均0，丢失恢复后首次探针0。该像素不是跨设备固定答案，未确认物理GPU与确切浏览器发行版。

上述来自根代理现场消息；物理GPU/驱动、Chromium确切发行版未识别。GLSL真编译、readPixels与首次getError是实际浏览器证据，fakeGL不替代该证据。三套恢复后首探针均0，未通过预先清错伪造结果。计时采样数不一致，不作速度倍数结论。

## 来源及图形复核

- 固定Khronos WebGL2.0.0快照，正文明确该页Editor's Draft标记；GLSL ES3.00 revision6。
- EXT_disjoint_timer_query_webgl2 revision4、WEBGL_lose_context revision15（本篇使用到的能力）；原作者方向光教程/MDN API用于机制核对，不复制大段规范文字。
- 本篇两张SVG经XML解析、1000×1000外框Quick Look真实渲染并逐张查看；六张合计无文字越界或缺图。箭头、空间/Pass/查询代际与源码一致，临时图在/tmp/atlas-webgl-final-render/。
- 三篇独立tsc --noEmit --strict内容类型检查通过；npm run check各自退出0；两张已交付SVG均实际引用于正文figure块。

## 交付与限制

README包含运行、正常、失败、恢复和预期结果。ZIP应含data/renderer/gl-utils/view/App/browser/serve/sync/test、tsconfig、package及锁文件/README；排除node_modules/dist/public-app。网站离线包只保证示例文件随包缓存，安装Node依赖首次仍需网络。

未以接口夹具宣称真实显存泄漏已排除；未做真实手机、原生环境、跨厂商GPU和长期压力测试。根代理后续补最终站内实验/390px阅读、图形弹层、下载ZIP、离线包与发布版本；本文不提前标complete。
