# WebGL1完整三角形

React/React DOM18.3.1、TypeScript5.7.2、Vite6.4.5、esbuild0.28.2；Node22.12.0。单文件App.tsx仅import React，无外部图形库/图片/远端资源。

```sh
cd examples/webgl-pipeline
npm ci
npm test
npm run build
npm run dev -- --port 4322 --strictPort
```

浏览器正常模式应出现渐变三角形，状态显示compile/link OK、vertices=3、NO_ERROR与实际drawing buffer尺寸。角度/缩放/平移改变uniform矩阵；默认mat3为P*T*R*S，列向量，P对画布宽高比修正，调用uniformMatrix3fv transpose=false。

验证模式：故意shader编译错误应展示编译日志；故意varying链接错误应展示链接日志；切回正常模式重建资源并重新绘制。缩放0或平移出可见范围时可能看不到图，NO_ERROR仍可能成立。

8项Node测试仅验证数学、buffer布局、编译/链接失败资源清理和成功路径的对象生命周期（使用fake GL）。fake不实际编译GLSL，不代表GPU测试。真实浏览器/GPU、上下文丢失恢复、手机展示需要主代理记录。

Canvas CSS尺寸与drawing buffer按DPR（最多2）区分；ResizeObserver重画，不用无意义的持续rAF。模式重建/卸载会删除buffer/program，shader在链接后标记删除，直到不再被program引用才真正回收。上下文丢失时资源失效，恢复后重建。没有纹理、深度/混合场景、相机透视或Three.js集成；不报告虚构帧率。
