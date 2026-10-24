# Shader 与光照：法线、材质和逐像素计算

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

预期Node版本v22.12.0；npm test先生成/编译代码，再通过**12/12**项node:test；check没有输出且退出0。浏览器打开 http://127.0.0.1:4337/ 。Ctrl+C结束服务器。端口固定，占用会直接失败，不自动换端口；先结束本例旧进程，勿随意杀其他服务。

也可把完整App.tsx复制到站点React18.3.1沙箱，唯一导入是React。该文件由gl-utils.ts、data.ts、renderer.ts、view.tsx.txt生成，修改模块后执行npm run build；npm run check检查生成文件精确同步。browser.tsx只负责独立开发入口，serve.mjs监听127.0.0.1。

## 文件和运行边界

- data.ts：CPU数据/数学/输入边界；renderer.ts：真实GLSL与WebGL2绘制。
- gl-utils.ts：资源作用域、编译链接失败、DPR策略和场景槽位。
- view.tsx.txt：React控件、RAF、像素探针、丢失恢复与卸载清理；App.tsx为自足聚合入口。
- test.mjs：数学与接口调用夹具；fakeGL没有真实编译GLSL、光栅化、测量GPU或真实显存。
- package-lock.json锁依赖；ZIP不含node_modules、dist、public-app等生成物，首次npm ci仍需联网。网站离线缓存不等于本地Node依赖已安装。

CPU验证范围：逆转置保持非均匀缩放与剪切后的正交关系、平移与纯旋转、奇异/错长度/零光向拒绝、Lambert单位化与背光截断、425条球面记录及2160索引、正确与故意错误uniform上传。共同覆盖：编译/链接/缺uniform部分失败清理、正常draw后销毁幂等、DPR2上限、SSR控制文本、App精确同步和旧上下文代际退休。

## 浏览器操作与预期

1. 保持动画关闭和默认参数，看到完整椭球；点击“读取像素与当前证据”，记录RGBA、size、WebGL版本和glError。
2. 只切“故意错误法线”，其余参数保持相同；非均匀缩放下光照会改变。切“法线颜色”看方向，调整光向与高光指数分别理解漫反射和高光。
3. 点击“模拟上下文丢失”，等状态明确丢失后再点“请求恢复上下文”；等待实际restored事件，再读取首次探针。不能用第二次清掉错误后冒充第一次正确。
4. 正文CPU测试也覆盖零缩放、非法矩阵、零光向等拒绝；UI只暴露合法滑块范围。没有WebGL2或lose扩展时明确提示。

根代理在真实Chromium、1680×1260绘制缓冲观察默认中心RGBA235/172/141/255，错误模型法线204/134/93/255；glError均0，丢失恢复后首次探针0。该像素不是跨设备固定答案，未确认物理GPU与确切浏览器发行版。

## 版本依据与限制

固定参考Khronos WebGL2.0.0快照（2017-04-11，页面本身仍标Editor's Draft，勿冒称无草案标记最终标准）、GLSL ES3.00 revision6（2016-01-29）。计时采用EXT_disjoint_timer_query_webgl2 revision4，恢复用WEBGL_lose_context revision15。未提供完整PBR/HDR或跨设备性能结论。

作者于2026-10-25在macOS14.5 x64/Node22.12.0完成类型、CPU与清理验证；根代理真实Chromium观察如上。真实手机/GPU硬件驱动/浏览器发行版识别、站内最终移动视口、下载与离线包由根代理分别验收，不能把CPU夹具或桌面视口当作真实手机验收。
