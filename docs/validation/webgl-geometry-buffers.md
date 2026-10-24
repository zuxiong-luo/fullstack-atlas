# webgl-geometry-buffers 验证记录

日期：2026-10-24。作者本地验证；status保留review，待独立审稿和真实浏览器验收。

## 实际环境和命令

macOS14.5 x64，Node.js22.12.0，TypeScript5.7.3，React/DOM18.3.1，esbuild0.28.2。

在`examples/webgl-geometry-buffers`运行：

```sh
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm test
npm run check
npm run dev
```

- 真正安装14个依赖包，精确package-lock已落盘；未复制node_modules进入ZIP。
- npm test：**13/13通过**，未跳过。
- 覆盖：交错字节布局、四顶点六索引、实例容量、越界拒绝在分配前、VAO/divisor与draw参数。
- 共享行为：shader编译与链接失败/缺uniform/正常draw之后均回收所有句柄，dispose幂等；DPR输入边界；GLSL版本标识；SSR控件；自足App源码同步。
- 已启动固定端口4332的独立esbuild入口，通过HTTP获取HTML与JS。该证据不等价于浏览器/GPU执行。
- 正文关键源码来自本目录连续原文；文章源码同步和SVG结构检查见下方复核。

## 官方依据

核对Khronos WebGL2.0.0文档快照、GLSL ES3.00 revision6与MDN对应API。规范快照自身标draft，正文明确注明；没有引用latest版本为固定标准，没有复制规范段落。所有示例代码是本仓库教学实现。

## 待补实机证据

- [ ] 桌面浏览器真实图形与readPixels/getError；预期：实例数1到3依次从左增加；实例数3中心不为背景；勾选坏索引明确CPU拒绝，取消后恢复。
- [ ] 390×844等移动视口布局、控件和SVG局部滚动。
- [ ] 上下文丢失/恢复事件、重建资源、离开后RAF停止。
- [ ] 真实手机GPU。移动视口检查不替代原生手机。

fakeGL仅验证调用和资源所有权，不编译GLSL或输出图像。没跑GPU不能把40项合计CPU测试说成GPU通过。打包器应排除node_modules、dist与public-app，ZIP包含锁文件、模块、生成器、README及独立serve入口。

## 作者图形与源码复核

- 各篇4块正文源码（data、renderer、gl-utils、完整view）与真实文件连续原文相符，三篇合计13/13。
- 独立TypeScript内容类型检查通过。
- 六张SVG经XML结构检查；Quick Look在940方形外框内真实渲染并逐张查看，防止宽图缩略裁剪，检查标题、标签、箭头与代码关系，未见溢出。临时预览在`/tmp/atlas-webgl-figure-review/`，不作为网站资源提交。
- 几何layout箭头已统一为VAO描述引用缓冲的方向；图形检查不替代文章中的浏览器/移动视口验收。

2026-10-24恢复顺序修复：根代理真实三维浏览器观察恢复后首次getError1282、第二次0。三套视图现在在contextlost事件立即SceneSlot.clear/dispose，不把旧代句柄留到restored后的effect cleanup。各增加1项带context generation的假GL回归，含旧顺序负对照；最新三套合计40/40通过。没有清空getError掩盖错误；真实GPU修复效果待根代理首次读复验。

根代理独立浏览器修后实际复验：loss/restored后首次probe RGBA[140,83,141,255]，glError0；UI版本WebGL2.0（OpenGL ES3.0 Chromium）。独立4331～4333入口验证，不识别物理GPU硬件/驱动，不能称物理真机GPU或真实手机验证。站内沙箱初次实际渲染过，HMR/长源码后DOM超时；根另做冻结后沙箱回归。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
