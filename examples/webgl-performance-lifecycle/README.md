# WebGL性能：批次、资源生命周期与测量

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

预期Node版本v22.12.0；npm test先生成/编译代码，再通过**14/14**项node:test；check没有输出且退出0。浏览器打开 http://127.0.0.1:4339/ 。Ctrl+C结束服务器。端口固定，占用会直接失败，不自动换端口；先结束本例旧进程，勿随意杀其他服务。

也可把完整App.tsx复制到站点React18.3.1沙箱，唯一导入是React。该文件由gl-utils.ts、data.ts、renderer.ts、view.tsx.txt生成，修改模块后执行npm run build；npm run check检查生成文件精确同步。browser.tsx只负责独立开发入口，serve.mjs监听127.0.0.1。

## 文件和运行边界

- data.ts：CPU数据/数学/输入边界；renderer.ts：真实GLSL与WebGL2绘制。
- gl-utils.ts：资源作用域、编译链接失败、DPR策略和场景槽位。
- view.tsx.txt：React控件、RAF、像素探针、丢失恢复与卸载清理；App.tsx为自足聚合入口。
- test.mjs：数学与接口调用夹具；fakeGL没有真实编译GLSL、光栅化、测量GPU或真实显存。
- package-lock.json锁依赖；ZIP不含node_modules、dist、public-app等生成物，首次npm ci仍需联网。网站离线缓存不等于本地Node依赖已安装。

CPU验证范围：固定几何下逐项/实例化draw调用数、偏移生成边界、nearest-rank百分位与60样本上限、unsupported空GPU结果、available前不读RESULT、纳秒到毫秒、最多4查询、disjoint清窗、active/pending销毁、100次重建句柄回零。共同覆盖：编译/链接/缺uniform部分失败清理、正常draw后销毁幂等、DPR2上限、SSR控制文本、App精确同步和旧上下文代际退休。

## 浏览器操作与预期

1. 默认1000个小三角形、实例化模式，连续运行以积累窗口；读证据应看到drawCalls1、triangles1000。关闭实例化，在同count下应为drawCalls1000；画面仍是同一几何和颜色。
2. 要做像素对照，分别关闭动画、固定画布、count与其他参数再读。网格中心可能在三角形间隙，只看到背景不能单凭一个像素宣布整个画面未绘制，要连同完整截图与错误码检查。
3. GPU计时扩展可选：unsupported表示没有该能力，GPU分位数为null；waiting表示尚无可读结果；disjoint会丢弃待返回结果和旧GPU窗口。关闭动画后可能需要后续独立探针推进一次结果读取，绝不忙等。
4. 测量性能先预热、保持前台与相同尺寸、记录环境并取得相同样本数；readPixels是单独诊断，不放进CPU提交区间，也不要边回读边作性能结论。CPU0可能是计时分辨率，不代表零工作。
5. 模拟loss后请求恢复；完整网格重现、首次probe0、窗口从新场景重新积累。页面退出与参数变化应释放query/VAO/VBO/program，CPU夹具不能证明真实显存马上回落。

根代理真实Chromium、1680×1260绘制缓冲、timer扩展可用，完整网格/glError0/中心背景6/10/15。实例化1000项draw1时GPU60样本p50=0.079833ms、p95=0.092333ms；逐项1000draw初次只有GPU7样本p50=0.289916ms、p95=0.3555ms，CPU14样本p50=0.2ms/p95=0.3ms；恢复后GPU60样本p50=0.289582ms/p95=0.585417ms、CPU约0.2/0.3ms。采样数不一致，物理GPU/确切发行版未确认，这些是接口工作的观测，不发布提速倍数或设备性能排名。

## 版本依据与限制

固定参考Khronos WebGL2.0.0快照（2017-04-11，页面本身仍标Editor's Draft，勿冒称无草案标记最终标准）、GLSL ES3.00 revision6（2016-01-29）。计时采用EXT_disjoint_timer_query_webgl2 revision4，恢复用WEBGL_lose_context revision15。未提供完整PBR/HDR或跨设备性能结论。

作者于2026-10-25在macOS14.5 x64/Node22.12.0完成类型、CPU与清理验证；根代理真实Chromium观察如上。真实手机/GPU硬件驱动/浏览器发行版识别、站内最终移动视口、下载与离线包由根代理分别验收，不能把CPU夹具或桌面视口当作真实手机验收。
