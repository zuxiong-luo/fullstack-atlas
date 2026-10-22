import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "webgl-pipeline",
  "topic": "webgl",
  "title": "WebGL：从顶点到像素，理解渲染流水线",
  "description": "把缓冲区、着色器、坐标空间和帧预算串起来，再判断什么时候需要 Three.js。",
  "minutes": 8,
  "tags": [
    "WebGL",
    "GPU",
    "Shader",
    "矩阵",
    "渲染"
  ],
  "scope": "以 WebGL 1 基本流水线为主；清屏示例可在 React 实验室运行，GPU 功能取决于浏览器与设备。",
  "prerequisites": [
    "JavaScript 与 Canvas",
    "向量和矩阵基础"
  ],
  "sections": [
    {
      "id": "s19-335562",
      "title": "CPU 描述工作，GPU 处理并行数据",
      "paragraphs": [
        "WebGL 是浏览器访问图形能力的接口。JavaScript 负责准备数据、状态与绘制命令，GPU 对顶点和片元执行着色程序。仅把循环写成 JavaScript 不会自动获得 GPU 并行能力，数据必须通过缓冲区与着色器进入流水线。",
        "顶点着色器处理每个顶点并输出裁剪空间坐标；图元装配与光栅化产生片元，片元着色器计算颜色等输出，再经过深度、模板和混合等处理。片元并不总与最终屏幕像素一一对应，最终写入受测试与覆盖规则影响。"
      ]
    },
    {
      "id": "s9-274087",
      "title": "坐标变换要追踪空间",
      "paragraphs": [
        "模型空间表示对象自身，世界空间表示对象在场景的位置，视图空间对应相机，投影把它映射到裁剪空间，再经过透视除法得到标准化设备坐标。把空间混用，会出现相机移动时光照跟着错误方向变化等问题。",
        "矩阵乘法不可交换。旋转后平移与平移后旋转会得到不同轨迹。法线的变换也不能简单照搬位置变换，尤其是非均匀缩放；应理解逆转置法线矩阵的用途，再使用图形库封装。"
      ]
    },
    {
      "id": "s11-290266",
      "title": "先验证上下文与绘图缓冲",
      "paragraphs": [
        "Canvas 的 CSS 尺寸和实际绘图缓冲尺寸是两个概念。高 DPI 屏幕下要考虑 devicePixelRatio，但提高缓冲分辨率会增加像素填充成本，应结合设备预算而非无限放大。",
        "下面是可在本站 React 实验室运行的最小上下文示例，它只清屏，不是三角形渲染器。绘制几何还需创建程序、上传顶点、绑定 attribute 并发出 draw 调用；每一步都应检查错误与着色器编译日志。"
      ],
      "code": "import React, { useEffect, useRef } from 'react';\nexport default function App() {\n  const ref = useRef(null);\n  useEffect(() => {\n    const gl = ref.current.getContext('webgl');\n    if (!gl) return;\n    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);\n    gl.clearColor(0.12, 0.25, 0.2, 1);\n    gl.clear(gl.COLOR_BUFFER_BIT);\n  }, []);\n  return <canvas ref={ref} width={480} height={240}\n    style={{ maxWidth: '100%', borderRadius: 12 }} />;\n}",
      "language": "jsx"
    },
    {
      "id": "s16-211827",
      "title": "性能问题要分 CPU 与 GPU",
      "paragraphs": [
        "draw call 过多常增加 CPU 提交与驱动开销，可评估合批或实例化。过大的纹理、复杂片元计算、透明物体重复覆盖则可能压在 GPU 与带宽上。减少多边形并不一定解决填充率瓶颈。",
        "避免每帧分配大量临时对象、重复上传不变数据或同步读回 GPU 结果。释放不再使用的 buffer、texture 和 program，并处理上下文丢失及恢复。Three.js 简化场景组织，但资源生命周期与性能判断仍由工程师负责。"
      ]
    },
    {
      "id": "s12-394675",
      "title": "练习：用控制变量辨认瓶颈",
      "paragraphs": [
        "固定物体数量，把画布分辨率减半：若帧时间明显下降，可能与像素工作量相关。固定分辨率而合并绘制提交：若 CPU 时间下降，应检查提交成本。一次只改一个变量，并记录设备与测量方法。",
        "自测：为什么 100 个透明大面片可能比上万个小三角形更慢？重点是屏幕覆盖、透明混合和重复片元计算，不只顶点数量。进一步练习可实现旋转三角形，再加入深度测试对照。"
      ]
    }
  ],
  "questionIds": [
    "webgl-pipeline-spaces",
    "webgl-pipeline-bottleneck"
  ],
  "references": [
    {
      "title": "MDN：WebGL 入门",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL"
    },
    {
      "title": "Khronos：WebGL 规范",
      "url": "https://registry.khronos.org/webgl/specs/latest/1.0/"
    }
  ],
  "experiment": "react",
  "status": "overview",
  "kind": "overview"
};
export default article;
