# 离屏渲染：Framebuffer、多Pass与后处理

这是WebGL2 / GLSL ES3.00教学实现，React18.3.1、TypeScript5.7.3、Node.js22.12.0；esbuild0.28.2。前置：已理解顶点/片元阶段、VAO/VBO及基本坐标变换。没有服务端或外部图片依赖，不要求付费服务。

## 独立运行

解压本篇ZIP，进入包含package.json的目录。先安装Node.js22.12.0，再执行：

```sh
node --version
npm ci --ignore-scripts
npm test
npm run check
npm run dev
```

预期Node版本v22.12.0；npm test先生成/编译代码，再通过**12/12**项node:test；check没有输出且退出0。浏览器打开 http://127.0.0.1:4338/ 。Ctrl+C结束服务器。端口固定，占用会直接失败，不自动换端口；先结束本例旧进程，勿随意杀其他服务。

也可把完整App.tsx复制到站点React18.3.1沙箱，唯一导入是React。该文件由gl-utils.ts、data.ts、renderer.ts、view.tsx.txt生成，修改模块后执行npm run build；npm run check检查生成文件精确同步。browser.tsx只负责独立开发入口，serve.mjs监听127.0.0.1。

## 文件和运行边界

- data.ts：CPU数据/数学/输入边界；renderer.ts：真实GLSL与WebGL2绘制。
- gl-utils.ts：资源作用域、编译链接失败、DPR策略和场景槽位。
- view.tsx.txt：React控件、RAF、像素探针、丢失恢复与卸载清理；App.tsx为自足聚合入口。
- test.mjs：数学与接口调用夹具；fakeGL没有真实编译GLSL、光栅化、测量GPU或真实显存。
- package-lock.json锁依赖；ZIP不含node_modules、dist、public-app等生成物，首次npm ci仍需联网。网站离线缓存不等于本地Node依赖已安装。

CPU验证范围：尺寸/预算上限、RGBA8+Depth16名义字节、灰度CPU参照、不完整附件的部分初始化清理、双Pass绑定与viewport、同尺寸复用和resize回收、非法尺寸在分配前拒绝。共同覆盖：编译/链接/缺uniform部分失败清理、正常draw后销毁幂等、DPR2上限、SSR控制文本、App精确同步和旧上下文代际退休。

## 浏览器操作与预期

1. 保持动画关闭，原色模式看完整彩色三角形并读像素。切灰度，同一位置RGB应接近相等；切边缘，颜色变化处较亮，平滑区域响应较弱。
2. 离屏比例在0.25..1间调整，第二Pass仍覆盖整个canvas。缩小影响输入采样和第一Pass规模，不能把总耗时直接按面积推算。
3. 勾选“故意不连接附件”，页面应明确显示Framebuffer不完整（本次真实状态0x8cd7）；取消后重建，首次探针应为glError0。该开关是缺少附件，不是模拟一个成功FBO。
4. “模拟上下文丢失”后等丢失状态，再请求恢复；restored后应重新创建颜色/深度附件，完整三角形再次出现，首次探针无错。

根代理真实Chromium、1680×1260绘制缓冲：原色中心RGB84/93/130，灰度94/94/94；无附件报Framebuffer0x8cd7，取消后首次探针0；丢失恢复后首次探针0。物理GPU与确切发行版未确认，不是所有设备固定像素值。

## 版本依据与限制

固定参考Khronos WebGL2.0.0快照（2017-04-11，页面本身仍标Editor's Draft，勿冒称无草案标记最终标准）、GLSL ES3.00 revision6（2016-01-29）。计时采用EXT_disjoint_timer_query_webgl2 revision4，恢复用WEBGL_lose_context revision15。未提供完整PBR/HDR或跨设备性能结论。

作者于2026-10-25在macOS14.5 x64/Node22.12.0完成类型、CPU与清理验证；根代理真实Chromium观察如上。真实手机/GPU硬件驱动/浏览器发行版识别、站内最终移动视口、下载与离线包由根代理分别验收，不能把CPU夹具或桌面视口当作真实手机验收。
