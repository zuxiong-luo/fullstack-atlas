# webgl-texture-sampling

WebGL2 / GLSL ES3.00，React与ReactDOM **18.3.1**、Node.js **22.12.0**、TypeScript **5.7.3**、esbuild **0.28.2**。包与锁文件均独立，源码不引用仓库外文件。

## 安装、测试、运行

```sh
npm ci
npm test
npm run dev
# http://127.0.0.1:4333/
```

端口固定，占用会报错。Ctrl+C结束，服务会dispose打包上下文。依赖安装需要网络/本地缓存；安装完成后图形程序本身没有外部图片或脚本请求。ZIP不是已经包含node_modules的离线SDK。

`npm test`构建TypeScript并运行 **13项**Node测试；`npm run check`检查App.tsx与模块源码是否同步。

## 浏览器实验

NEAREST/LINEAR边缘不同；高UV倍率观察mipmap缩小；REPEAT/CLAMP区别；交换叠放顺序改变中心颜色。

“读取中心像素”先draw后同步readPixels，输出RGBA、getError、GL版本和绘图缓冲尺寸。期望glError=0并且在对应参数变化时图像出现预期变化；各GPU的插值/舍入可能不同，不要求所有RGBA整数完全一致。只输出0不能替代全图检查。

“模拟上下文丢失”使用可选WEBGL_lose_context扩展。支持时应出现停止状态；“请求恢复”后收到restored事件再重建资源。扩展不存在或系统不允许恢复时记录实际条件，不把按钮被点击算通过。WebGL2不可用会显示明确提示。

`App.tsx`由`gl-utils.ts`、`data.ts`、`renderer.ts`与`view.tsx.txt`生成，只有一个React导入，可直接进入本站React沙箱，实验ID **webgl-texture-sampling**。生成器只移除模块间import，保留连续原文；修改模块后运行npm run build。独立本地入口browser.tsx使用ReactDOM挂载，不属于沙箱源码。

## 验证范围

2026-10-24，macOS14.5 x64 / Node22.12.0：实际npm ci（安装14包）、TypeScript构建与13/13测试通过。覆盖60字节NPOT样本、3×5→1×2→1×1、行对齐、直通alpha顺序、纹理单元与采样配置；另含shader编译/链接失败回收、缺uniform失败回收、正常draw调用记录、重复dispose、DPR边界、SSR与自足源码同步。

Node中的fakeGL是调用记录器，不编译shader、不光栅化、不执行采样；这些测试证明CPU与所有权规则，**不是GPU证据**。SSR只证明视图可生成控件。真实桌面GPU、移动视口、真实手机与上下文恢复由站点发布验收另记，未运行不宣称完成。

本地已启动esbuild并通过HTTP请求index和app.js，证明独立入口可打包提供资源，仍不证明浏览器像素结果。

## 资源生命周期

scene拥有shader/program/VAO/buffer（纹理篇另拥有texture）。初始化抛错时释放已分配资源；参数变化与卸载时dispose一次。React cleanup取消RAF、ResizeObserver和resize/context监听。contextlost停止帧；restored后从CPU数据重建句柄。DPR上限2是教学预算，不是性能结论。

## 参考

- [Khronos WebGL2.0.0快照](https://registry.khronos.org/webgl/specs/2.0.0/)（2017-04-11；页面自身标为draft，不称最终冻结标准）
- [GLSL ES3.00 revision6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
- [MDN contextlost](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)

2026-10-24恢复顺序修复：根代理真实三维浏览器观察恢复后首次getError1282、第二次0。三套视图现在在contextlost事件立即SceneSlot.clear/dispose，不把旧代句柄留到restored后的effect cleanup。各增加1项带context generation的假GL回归，含旧顺序负对照；最新三套合计40/40通过。没有清空getError掩盖错误；真实GPU修复效果待根代理首次读复验。
