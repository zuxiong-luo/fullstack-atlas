import type {Question} from './content';
export const expandedQuestions = [
  {
    "id": "react-fiber-scheduling-interrupt",
    "topic": "frontend",
    "title": "Fiber 为什么能支持可中断渲染，为什么仍然会卡顿？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "React",
      "Fiber",
      "调度",
      "Transition"
    ],
    "summary": "Fiber 让渲染工作可分段组织，但 JavaScript 同步函数、提交和布局仍可能阻塞主线程。优先级影响先做什么，不直接减少工作量。",
    "principles": [
      "区分 render 的可暂停计算与 commit 的宿主更新。",
      "被放弃的渲染不能留下业务副作用。",
      "用性能记录把组件计算、DOM 提交与布局成本分开。"
    ],
    "pitfalls": [
      "把 Fiber 当成多线程。",
      "用渲染次数直接判断性能好坏。"
    ],
    "followups": [
      "单个组件计算很久时如何拆分？",
      "为什么 Worker 不能直接修改 DOM？"
    ],
    "scenario": "搜索列表：把输入紧急更新与结果树更新分开，并对比虚拟列表。",
    "related": [
      "react-snapshot",
      "web-performance",
      "react-fiber-scheduling-transition"
    ],
    "source": "https://react.dev/reference/react/useTransition"
  },
  {
    "id": "react-fiber-scheduling-transition",
    "topic": "frontend",
    "title": "startTransition 和防抖分别解决什么问题？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "React",
      "Fiber",
      "调度",
      "Transition"
    ],
    "summary": "Transition 调整 React 更新优先级，防抖减少触发频率。两者都不自动取消网络请求，也不保证旧结果不覆盖新结果。",
    "principles": [
      "输入框受控值保持紧急更新，结果更新可延后。",
      "防抖适合减少请求次数，但会引入等待。",
      "请求归属仍需取消信号或版本标记，不能靠 transition 保证顺序。"
    ],
    "pitfalls": [
      "以为 transition 回调异步执行。",
      "只做防抖就忽略响应竞态。"
    ],
    "followups": [
      "useDeferredValue 与请求缓存如何配合？",
      "如何让 pending 状态不引起页面闪烁？"
    ],
    "scenario": "素材搜索同时处理输入延迟、请求配额和旧响应覆盖。",
    "related": [
      "effect-race",
      "react-fiber-scheduling-interrupt"
    ],
    "source": "https://react.dev/reference/react/useTransition"
  },
  {
    "id": "react-identity-events-key",
    "topic": "frontend",
    "title": "为什么列表用 index 作为 key 会让输入状态错位？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "React",
      "Hooks",
      "key",
      "事件",
      "Portal"
    ],
    "summary": "当列表插入或删除时，下标对应的业务对象变化，但 React 可能复用原位置的状态。问题在节点身份，而不是数组遍历本身。",
    "principles": [
      "key 在兄弟节点中表达稳定身份。",
      "受控值和组件内部状态都要明确归属。",
      "更换 key 可以有意重置状态，但会重新建立生命周期。"
    ],
    "pitfalls": [
      "为消除警告每次生成随机 key。",
      "认为加 memo 能修复状态归属。"
    ],
    "followups": [
      "静态不重排的列表是否一定不能用 index？",
      "切换用户编辑表单时如何主动重置？"
    ],
    "scenario": "动态表单删除一行后检查其他行的草稿归属。",
    "related": [
      "react-snapshot",
      "react-identity-events-event"
    ],
    "source": "https://react.dev/learn/preserving-and-resetting-state"
  },
  {
    "id": "react-identity-events-event",
    "topic": "frontend",
    "title": "Portal 弹窗里为什么还能触发外层 React 点击事件？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "React",
      "Hooks",
      "key",
      "事件",
      "Portal"
    ],
    "summary": "Portal 改变 DOM 挂载位置，但保留 React 树关系，事件可沿 React 树传播。应按交互目的决定是否阻止传播。",
    "principles": [
      "区分 target、currentTarget 和组件树关系。",
      "stopPropagation 不等于 preventDefault。",
      "背景关闭应识别点击背景本身，同时补齐焦点和键盘行为。"
    ],
    "pitfalls": [
      "把所有点击都 stopPropagation，破坏全局交互。",
      "认为移到 body 就自动隔离所有事件。"
    ],
    "followups": [
      "原生监听器与 React 监听器如何定位顺序？",
      "如何验证键盘用户能关闭弹窗？"
    ],
    "scenario": "实现带表单的弹窗，避免内部点击关闭背景。",
    "related": [
      "effect-race",
      "react-identity-events-key"
    ],
    "source": "https://react.dev/learn/preserving-and-resetting-state"
  },
  {
    "id": "next-server-boundaries-rsc",
    "topic": "frontend",
    "title": "Server Component 与 SSR、Client Component 如何区分？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Next.js",
      "RSC",
      "SSR",
      "缓存",
      "BFF"
    ],
    "summary": "组件类型决定执行与模块边界；SSR 决定初始 HTML 如何生成。客户端组件也可能被预渲染，但交互代码要在浏览器运行。",
    "principles": [
      "按数据访问、交互、依赖体积拆组件。",
      "传到客户端的 props 按公开数据审查。",
      "动态服务端能力需要运行环境，静态托管不能代替它。"
    ],
    "pitfalls": [
      "把 use client 当作关闭所有服务端渲染。",
      "认为 Server Component 的全部输出都保密。"
    ],
    "followups": [
      "如何定位 hydration 不一致？",
      "为什么服务端不能直接读取 window？"
    ],
    "scenario": "账户页服务端校验会话，仅向交互组件传必要字段。",
    "related": [
      "cache-isolation",
      "next-server-boundaries-cache"
    ],
    "source": "https://nextjs.org/docs/app/getting-started/server-and-client-components"
  },
  {
    "id": "next-server-boundaries-cache",
    "topic": "frontend",
    "title": "有服务端鉴权，为什么仍可能发生用户数据串缓存？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Next.js",
      "RSC",
      "SSR",
      "缓存",
      "BFF"
    ],
    "summary": "鉴权验证访问身份，缓存键决定哪些请求共享响应。两者要分别正确，才能保证返回数据属于当前用户。",
    "principles": [
      "列出所有缓存层与身份维度。",
      "写操作校验资源归属，再处理缓存失效。",
      "用两个账户及退出重登建立回归场景。"
    ],
    "pitfalls": [
      "认为私有页面不会被 CDN 缓存。",
      "更新数据库后只刷新一个组件就认为所有缓存同步。"
    ],
    "followups": [
      "公共商品和私人收藏如何组合？",
      "哪层应该处理租户隔离？"
    ],
    "scenario": "租户切换后出现旧统计报表，逐层追踪缓存命中。",
    "related": [
      "session-jwt",
      "http-cache",
      "next-server-boundaries-rsc"
    ],
    "source": "https://nextjs.org/docs/app/getting-started/server-and-client-components"
  },
  {
    "id": "node-capacity-pressure",
    "topic": "backend",
    "title": "流式导出为什么仍可能占满内存？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Node.js",
      "背压",
      "流",
      "容量",
      "Worker"
    ],
    "summary": "流本身不保证有界内存。忽略背压、无限并发转换、在业务层积累结果或不释放连接都会让缓冲增长。",
    "principles": [
      "检查生产者是否等待消费者。",
      "把每请求缓冲乘以并发量估算。",
      "跟踪队列长度、RSS 和输出端速度。"
    ],
    "pitfalls": [
      "把 highWaterMark 当全局内存上限。",
      "流式读取后仍将全部结果 push 进数组。"
    ],
    "followups": [
      "慢客户端断开如何取消？",
      "压缩占 CPU 时如何分离瓶颈？"
    ],
    "scenario": "百万行日志导出，给慢速客户端增加限速做对照实验。",
    "related": [
      "node-backpressure",
      "concurrency-pool",
      "node-capacity-cpu"
    ],
    "source": "https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop"
  },
  {
    "id": "node-capacity-cpu",
    "topic": "backend",
    "title": "Node.js 异步函数为什么会拖慢其他请求？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Node.js",
      "背压",
      "流",
      "容量",
      "Worker"
    ],
    "summary": "await 只在等待时让出执行；它前后的同步计算仍共享事件循环。应定位 CPU 工作、线程池等待和下游排队的区别。",
    "principles": [
      "CPU profile 定位同步热点。",
      "worker_threads 适合可分离的 CPU 工作。",
      "限制线程池与排队长度，避免把阻塞变成资源耗尽。"
    ],
    "pitfalls": [
      "把函数声明成 async 就认为不阻塞。",
      "无限创建 Worker 提升并发。"
    ],
    "followups": [
      "怎样验证是事件循环延迟而不是网络慢？",
      "如何处理工作线程失败？"
    ],
    "scenario": "媒体元数据解析进入专用任务队列，API 只负责提交与查询。",
    "related": [
      "linux-debug",
      "node-capacity-pressure"
    ],
    "source": "https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop"
  },
  {
    "id": "python-async-services-cancel",
    "topic": "python",
    "title": "TaskGroup、超时与取消如何共同管理请求生命周期？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Python",
      "asyncio",
      "TaskGroup",
      "类型",
      "并发"
    ],
    "summary": "TaskGroup 管理子任务的共同生命周期，超时提供停止预算，取消让任务协作清理。业务必须定义部分成功时是否保留结果。",
    "principles": [
      "依赖资源使用上下文管理器关闭。",
      "不要吞掉取消异常导致上层超时失效。",
      "独立任务失败策略与整组失败策略分开。"
    ],
    "pitfalls": [
      "以为取消会撤销远端副作用。",
      "在 async 函数里调用阻塞等待。"
    ],
    "followups": [
      "如何允许部分检索源失败？",
      "如何在取消后处理已写入的数据？"
    ],
    "scenario": "并行访问两个检索源，其中一个超时，按产品需求决定降级或整体失败。",
    "related": [
      "retry",
      "python-async-services-semaphore"
    ],
    "source": "https://docs.python.org/3/library/asyncio-task.html"
  },
  {
    "id": "python-async-services-semaphore",
    "topic": "python",
    "title": "Semaphore 能否让百万项任务批处理保持有界内存？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Python",
      "asyncio",
      "TaskGroup",
      "类型",
      "并发"
    ],
    "summary": "不能单独保证。它限制同时进入区段的数量，不限制已创建 task、输入数组和累计结果的体积。",
    "principles": [
      "采用固定消费者和有界队列。",
      "分批读取并及时写出结果。",
      "把排队时间纳入整体 deadline。"
    ],
    "pitfalls": [
      "一次创建全部 task 后才加并发限制。",
      "仅观察请求并发不观察对象数量。"
    ],
    "followups": [
      "进程池和线程池何时适用？",
      "任务生产者比消费者快怎么办？"
    ],
    "scenario": "文档向量化管道使用分页读取和有界消费者。",
    "related": [
      "concurrency-pool",
      "python-async-services-cancel"
    ],
    "source": "https://docs.python.org/3/library/asyncio-task.html"
  },
  {
    "id": "algorithms-invariants-binary",
    "topic": "algorithms",
    "title": "如何证明二分查找正确，而不是靠记忆调整加减一？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "算法",
      "二分",
      "BFS",
      "动态规划",
      "复杂度"
    ],
    "summary": "先规定区间与答案范围，再证明每次更新保留答案并严格缩小区间。终止时根据不变量推导返回值。",
    "principles": [
      "lowerBound 的答案允许等于数组长度。",
      "重复值要定义返回任意值还是首个位置。",
      "空数组无需特殊扫描，半开区间自然终止。"
    ],
    "pitfalls": [
      "混用 lo<=hi 与 hi=mid 的模板。",
      "不检查有序前提。"
    ],
    "followups": [
      "upperBound 的比较条件如何变化？",
      "数据动态插入时数组二分是否足够？"
    ],
    "scenario": "有序时间戳中查找某一天的首条日志。",
    "related": [
      "event-loop",
      "algorithms-invariants-bfs"
    ],
    "source": "https://docs.python.org/3/library/bisect.html"
  },
  {
    "id": "algorithms-invariants-bfs",
    "topic": "algorithms",
    "title": "BFS 为什么能求无权最短路径？什么时候会失效？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "算法",
      "二分",
      "BFS",
      "动态规划",
      "复杂度"
    ],
    "summary": "队列按距离层推进，先发现的路径边数最少。带权图中边数不再代表成本，必须改用适当的最短路算法。",
    "principles": [
      "入队标记避免重复扩展。",
      "保存前驱才能重建路径。",
      "区分访问节点数和边数，复杂度通常为 O(V+E)。"
    ],
    "pitfalls": [
      "出队才标记造成大量重复。",
      "把带权路径直接当无权处理。"
    ],
    "followups": [
      "0/1 权重可以如何利用双端队列？",
      "负权边为什么影响 Dijkstra 的前提？"
    ],
    "scenario": "任务依赖图中查找最少依赖跳数与不可达节点。",
    "related": [
      "algorithms-invariants-binary"
    ],
    "source": "https://docs.python.org/3/library/bisect.html"
  },
  {
    "id": "webgl-pipeline-spaces",
    "topic": "graphics",
    "title": "模型、世界、视图、裁剪空间分别解决什么问题？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "WebGL",
      "GPU",
      "Shader",
      "矩阵",
      "渲染"
    ],
    "summary": "它们把对象局部定义、场景摆放、相机观察和投影规则分开。每一步都必须清楚输入与输出属于哪个空间。",
    "principles": [
      "矩阵乘法顺序影响结果。",
      "裁剪后进行透视除法与视口变换。",
      "法线在非均匀缩放下需要特殊处理。"
    ],
    "pitfalls": [
      "把投影当简单缩放。",
      "在不同空间直接做向量点积。"
    ],
    "followups": [
      "正交投影与透视投影如何不同？",
      "为什么相机本身也对应变换？"
    ],
    "scenario": "机器人场景把雷达点和机身模型放进统一世界坐标。",
    "related": [
      "webgl-pipeline-bottleneck"
    ],
    "source": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL"
  },
  {
    "id": "webgl-pipeline-bottleneck",
    "topic": "graphics",
    "title": "如何区分 WebGL 的 CPU 提交瓶颈与 GPU 填充瓶颈？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "WebGL",
      "GPU",
      "Shader",
      "矩阵",
      "渲染"
    ],
    "summary": "分别改变 draw call 数量和绘图分辨率，结合 CPU/GPU 测量观察帧时间变化，避免只凭多边形数量判断。",
    "principles": [
      "合批主要减少提交开销。",
      "分辨率和透明覆盖影响片元工作。",
      "测量时保持其他变量和设备一致。"
    ],
    "pitfalls": [
      "只减顶点数不检查屏幕覆盖。",
      "每帧同步读取 GPU 结果干扰测量。"
    ],
    "followups": [
      "实例化何时适用？",
      "资源泄漏怎样表现？"
    ],
    "scenario": "可视化大场景逐项评估提交、纹理、透明度与分辨率。",
    "related": [
      "web-performance",
      "webgl-pipeline-spaces"
    ],
    "source": "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL"
  },
  {
    "id": "cross-platform-models-render",
    "topic": "crossplatform",
    "title": "RN 与 Flutter 的卡顿为什么不能只用“重渲染太多”解释？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "React Native",
      "Flutter",
      "JSI",
      "Fabric",
      "跨平台"
    ],
    "summary": "两者的渲染流水线和宿主不同，重建配置、协调、布局与绘制都可能贡献成本。需要沿具体流水线测量。",
    "principles": [
      "RN 区分 JS 工作与原生布局挂载。",
      "Flutter 区分 build、layout、paint 和 raster。",
      "用真机 profile 或发布近似环境复现。"
    ],
    "pitfalls": [
      "把所有 RN 版本都按旧 bridge 解释。",
      "认为 Flutter build 等于重绘全屏。"
    ],
    "followups": [
      "同步原生调用有什么代价？",
      "如何判断图片解码瓶颈？"
    ],
    "scenario": "机器人地图叠加实时列表，分别测量通信处理与帧耗时。",
    "related": [
      "web-performance",
      "cross-platform-models-stream"
    ],
    "source": "https://reactnative.dev/architecture/render-pipeline"
  },
  {
    "id": "cross-platform-models-stream",
    "topic": "crossplatform",
    "title": "Flutter / RN 页面切换后如何避免旧设备数据覆盖新设备？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "React Native",
      "Flutter",
      "JSI",
      "Fabric",
      "跨平台"
    ],
    "summary": "连接与消息都带设备和连接代次，清理旧订阅并在提交状态时校验归属。取消与校验应配合使用。",
    "principles": [
      "分离连接状态与 UI 状态。",
      "重连必须有退避和资源释放。",
      "控制确认与高频展示数据不能用同一丢弃策略。"
    ],
    "pitfalls": [
      "只在卸载时清理，不处理设备变化。",
      "高频消息全量驱动页面更新。"
    ],
    "followups": [
      "后台返回后如何恢复？",
      "消息重复确认如何幂等？"
    ],
    "scenario": "同一终端从机器人 A 切换到 B，注入迟到的 A 消息验证隔离。",
    "related": [
      "effect-race",
      "idempotency",
      "cross-platform-models-render"
    ],
    "source": "https://reactnative.dev/architecture/render-pipeline"
  },
  {
    "id": "electron-trust-boundary-ipc",
    "topic": "crossplatform",
    "title": "为什么启用 contextIsolation 后仍要校验 IPC？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Electron",
      "IPC",
      "preload",
      "桌面安全"
    ],
    "summary": "隔离限制执行环境共享，但暴露给页面的能力仍能被页面调用。过宽的 IPC 接口会重新打开特权通道。",
    "principles": [
      "仅暴露具体业务能力。",
      "主进程校验调用来源与参数、资源权限。",
      "路径与 shell 参数不能由不可信输入无限决定。"
    ],
    "pitfalls": [
      "把 ipcRenderer 整体暴露到 window。",
      "认为类型检查等于授权检查。"
    ],
    "followups": [
      "如何处理 iframe 发起的请求？",
      "导出任务如何取消？"
    ],
    "scenario": "桌面知识库导出指定文档，而非任意读写磁盘。",
    "related": [
      "electron-trust-boundary-lifecycle"
    ],
    "source": "https://www.electronjs.org/docs/latest/tutorial/security"
  },
  {
    "id": "electron-trust-boundary-lifecycle",
    "topic": "crossplatform",
    "title": "Electron 导出任务为什么会导致窗口无响应或监听器泄漏？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "Electron",
      "IPC",
      "preload",
      "桌面安全"
    ],
    "summary": "重活占据主进程会影响窗口协调，跨进程订阅没有清理会随窗口重建累积。需要独立任务生命周期。",
    "principles": [
      "任务拥有唯一 ID 和取消句柄。",
      "进度监听返回解除订阅函数。",
      "窗口销毁与任务结束分别清理资源。"
    ],
    "pitfalls": [
      "主进程同步处理大文件。",
      "每次打开窗口新增监听但从不移除。"
    ],
    "followups": [
      "任务完成时窗口已关闭怎么办？",
      "如何避免同一导出重复执行？"
    ],
    "scenario": "大报表压缩放到工作进程，窗口仅订阅进度。",
    "related": [
      "node-backpressure",
      "idempotency",
      "electron-trust-boundary-ipc"
    ],
    "source": "https://www.electronjs.org/docs/latest/tutorial/security"
  },
  {
    "id": "web-security-boundaries-csrf",
    "topic": "network",
    "title": "CORS 为什么不能替代 CSRF 防御和接口鉴权？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "安全",
      "XSS",
      "CSRF",
      "SSRF",
      "越权"
    ],
    "summary": "CORS 约束浏览器脚本的跨源读取，不保证请求不会到达服务器。身份、来源与资源权限必须分别验证。",
    "principles": [
      "Cookie 自动携带与脚本读取响应是两种机制。",
      "CSRF token 和来源校验应结合会话设计。",
      "服务端写操作不能依赖前端按钮或 CORS。"
    ],
    "pitfalls": [
      "前端显示跨域错误就认为写入没发生。",
      "把 GET 用于删除或转账等状态变更。"
    ],
    "followups": [
      "SameSite 能否解决所有场景？",
      "Bearer token 存储方式带来什么取舍？"
    ],
    "scenario": "用受控双站点测试设置修改接口的 CSRF 防线。",
    "related": [
      "session-jwt",
      "web-security-boundaries-ssrf"
    ],
    "source": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html"
  },
  {
    "id": "web-security-boundaries-ssrf",
    "topic": "network",
    "title": "一个 URL 导入接口需要哪些服务端安全边界？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "安全",
      "XSS",
      "CSRF",
      "SSRF",
      "越权"
    ],
    "summary": "它同时涉及出站网络访问、响应体资源消耗、内容处理和写入授权，不能仅检查 URL 格式。",
    "principles": [
      "校验目标与解析后的网络范围、重定向。",
      "限制超时、大小和内容类型。",
      "验证目标知识库归属并清洗展示内容。"
    ],
    "pitfalls": [
      "只屏蔽字符串 localhost。",
      "把下载的文本当可信指令继续执行。"
    ],
    "followups": [
      "DNS 重绑定如何影响方案？",
      "如何防止压缩包解压放大？"
    ],
    "scenario": "构建文档导入功能，使用受控模拟服务验证拒绝路径。",
    "related": [
      "oauth",
      "web-security-boundaries-csrf"
    ],
    "source": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html"
  },
  {
    "id": "agent-foundations-schema",
    "topic": "ai",
    "title": "结构化输出通过 Schema 校验，为什么仍不能直接执行？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "LLM",
      "token",
      "结构化输出",
      "Agent"
    ],
    "summary": "Schema 校验语法形状，业务校验确认真实对象、权限与约束。格式正确的动作也可能错误或越权。",
    "principles": [
      "分别处理拒绝、截断、解析失败和业务失败。",
      "将模型输出视为不可信输入。",
      "真实执行结果由工具或数据库确认。"
    ],
    "pitfalls": [
      "合法 JSON 就直接写数据库。",
      "把低温度当作正确率保证。"
    ],
    "followups": [
      "怎样测试不存在的文档引用？",
      "为什么输出字段要带来源标识？"
    ],
    "scenario": "知识库助手只接受来自本轮检索结果的引用 ID。",
    "related": [
      "ts-model",
      "agent-foundations-choice"
    ],
    "source": "https://www.anthropic.com/research/building-effective-agents"
  },
  {
    "id": "agent-foundations-choice",
    "topic": "ai",
    "title": "何时用固定工作流，何时需要 Agent？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "LLM",
      "token",
      "结构化输出",
      "Agent"
    ],
    "summary": "若步骤与分支可清晰预定义，先使用工作流；若下一步需要基于动态观察选择，才评估 Agent，并给它预算和权限边界。",
    "principles": [
      "先建立单次调用或检索基线。",
      "用任务成功率、成本和延迟比较。",
      "工具循环必须有终止与恢复设计。"
    ],
    "pitfalls": [
      "所有 AI 功能都套多 Agent。",
      "把框架数量当能力。"
    ],
    "followups": [
      "哪些行为必须由程序决定？",
      "如何证明自主循环确实有收益？"
    ],
    "scenario": "固定发票提取先用结构化调用，不增加自主工具选择。",
    "related": [
      "agent-foundations-schema"
    ],
    "source": "https://www.anthropic.com/research/building-effective-agents"
  },
  {
    "id": "agent-tools-mcp-trust",
    "topic": "ai",
    "title": "MCP 是否替应用解决了工具授权和提示注入？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Tool Calling",
      "MCP",
      "JSON Schema",
      "幂等"
    ],
    "summary": "MCP 提供标准交互形式，应用仍负责决定可连接谁、可调用什么、数据给谁以及如何对待不可信结果。",
    "principles": [
      "身份从受信认证上下文取得。",
      "工具参数和资源范围在执行端校验。",
      "工具描述及输出不自动拥有指令权威。"
    ],
    "pitfalls": [
      "发现了工具就默认允许执行。",
      "模型参数里的 tenantId 直接作为授权依据。"
    ],
    "followups": [
      "读工具与写工具怎样分级？",
      "工具结果需要截断时保留哪些信息？"
    ],
    "scenario": "只读企业文档工具必须按当前用户过滤文档。",
    "related": [
      "oauth",
      "agent-tools-mcp-retry"
    ],
    "source": "https://modelcontextprotocol.io/specification/2025-06-18/architecture"
  },
  {
    "id": "agent-tools-mcp-retry",
    "topic": "ai",
    "title": "工具超时后如何避免重复写入或重复扣费？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Tool Calling",
      "MCP",
      "JSON Schema",
      "幂等"
    ],
    "summary": "以业务意图生成稳定幂等键，并通过持久状态查询或复用结果确认是否已执行。不能从超时推断远端没有成功。",
    "principles": [
      "区分本轮调用 ID 与业务操作 ID。",
      "重试复用同一业务键。",
      "持久化状态与外部副作用之间需要恢复策略。"
    ],
    "pitfalls": [
      "每次重试生成新的幂等键。",
      "模型认为失败就无条件再次执行。"
    ],
    "followups": [
      "工具没有幂等能力时怎么办？",
      "如何表示结果未知状态？"
    ],
    "scenario": "自动生成并发布报告时，上传成功但响应丢失后查询原任务。",
    "related": [
      "idempotency",
      "retry",
      "agent-tools-mcp-trust"
    ],
    "source": "https://modelcontextprotocol.io/specification/2025-06-18/architecture"
  },
  {
    "id": "agent-rag-debug",
    "topic": "ai",
    "title": "RAG 回答不准确，如何判断该改检索还是改提示？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "RAG",
      "Embedding",
      "检索",
      "引用",
      "向量数据库"
    ],
    "summary": "保存各阶段产物，用可支撑答案的资料是否进入上下文划分问题。证据未到模型面前先修数据与检索，证据充足却使用错误再分析生成。",
    "principles": [
      "检查原文解析和分块。",
      "比较候选召回、重排与最终上下文。",
      "对生成检查证据支持和拒答行为。"
    ],
    "pitfalls": [
      "只换更大模型。",
      "不断扩大 top-k 而不评测噪声。"
    ],
    "followups": [
      "错误码搜索为什么向量检索可能不如关键词？",
      "如何处理规则新旧版本冲突？"
    ],
    "scenario": "知识库助手把旧规则作为现行规则，检查版本元数据与检索过滤。",
    "related": [
      "agent-rag-acl"
    ],
    "source": "https://www.anthropic.com/news/contextual-retrieval"
  },
  {
    "id": "agent-rag-acl",
    "topic": "ai",
    "title": "RAG 的文档权限应在哪些阶段执行？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "RAG",
      "Embedding",
      "检索",
      "引用",
      "向量数据库"
    ],
    "summary": "应在检索候选范围和实际读取时落实权限，避免未经授权片段进入模型上下文。生成后的隐藏无法抹掉已泄露的信息。",
    "principles": [
      "权限以服务端身份与 ACL 为准。",
      "缓存键包含用户或租户权限维度。",
      "共享变更后更新索引可见性或做读取复核。"
    ],
    "pitfalls": [
      "只过滤最终引用。",
      "把向量库 namespace 当完整授权系统。"
    ],
    "followups": [
      "撤销权限后缓存如何失效？",
      "共享文档是否要复制向量？"
    ],
    "scenario": "两个租户同名文件的检索隔离回归测试。",
    "related": [
      "cache-isolation",
      "agent-rag-debug"
    ],
    "source": "https://www.anthropic.com/news/contextual-retrieval"
  },
  {
    "id": "agent-control-loop-checkpoint",
    "topic": "ai",
    "title": "Agent 有 checkpoint 为什么仍可能重复执行工具？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Agent",
      "工作流",
      "状态机",
      "Checkpoint",
      "多Agent"
    ],
    "summary": "工具副作用与检查点通常不在同一事务里，崩溃窗口会使恢复无法确定执行结果。需要幂等与结果查询处理这个窗口。",
    "principles": [
      "恢复依赖持久记录而非模型记忆。",
      "操作 ID 在恢复时保持稳定。",
      "未知结果和明确失败分开。"
    ],
    "pitfalls": [
      "把 checkpoint 等同于 exactly-once。",
      "重启后从头执行全部步骤。"
    ],
    "followups": [
      "没有查询接口时如何补偿？",
      "审批记录应绑定哪些字段？"
    ],
    "scenario": "发布报告完成后进程崩溃，恢复时读取同一 operationId 的结果。",
    "related": [
      "idempotency",
      "worker-lease",
      "agent-control-loop-budget"
    ],
    "source": "https://www.anthropic.com/research/building-effective-agents"
  },
  {
    "id": "agent-control-loop-budget",
    "topic": "ai",
    "title": "Agent 循环应设置哪些停止条件？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Agent",
      "工作流",
      "状态机",
      "Checkpoint",
      "多Agent"
    ],
    "summary": "步骤、总时限、调用费用、工具并发和结果体积都需要程序硬限制，并以明确状态结束或请求用户输入。",
    "principles": [
      "预算检查在每次调用前执行。",
      "限制单次工具超时和全局 deadline。",
      "保存预算耗尽时的中间成果，允许后续显式恢复。"
    ],
    "pitfalls": [
      "只在提示词中说不要循环太久。",
      "把预算耗尽当任务成功。"
    ],
    "followups": [
      "多 Agent 如何共享全局预算？",
      "连续工具错误何时停止？"
    ],
    "scenario": "知识助手检索不到答案时停止并说明不足，避免重复无效搜索。",
    "related": [
      "retry",
      "agent-control-loop-checkpoint"
    ],
    "source": "https://www.anthropic.com/research/building-effective-agents"
  },
  {
    "id": "agent-context-memory-memory",
    "topic": "ai",
    "title": "聊天历史、checkpoint 和长期记忆有什么区别？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "上下文工程",
      "记忆",
      "摘要",
      "数据隔离"
    ],
    "summary": "历史是交互记录，checkpoint 是执行恢复状态，长期记忆是经过选择、带来源与生命周期的跨任务信息。它们可以关联但不应混存为一个无限文本。",
    "principles": [
      "恢复状态必须能确定下一步。",
      "长期事实保留来源和确认状态。",
      "上下文只挑本轮必要信息。"
    ],
    "pitfalls": [
      "将模型猜测永久存为用户事实。",
      "认为向量化历史就完成记忆管理。"
    ],
    "followups": [
      "用户改正偏好如何覆盖旧摘要？",
      "哪些数据不应进入长期记忆？"
    ],
    "scenario": "知识助手按用户确认的语言偏好输出，并允许撤回。",
    "related": [
      "agent-context-memory-compression"
    ],
    "source": "https://www.anthropic.com/research/effective-context-engineering-for-ai-agents"
  },
  {
    "id": "agent-context-memory-compression",
    "topic": "ai",
    "title": "如何验证上下文压缩没有丢失关键约束？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "上下文工程",
      "记忆",
      "摘要",
      "数据隔离"
    ],
    "summary": "用跨多轮任务检验压缩前后的行为，并对身份、权限、预算和已确认条件保留结构化状态或原文引用。",
    "principles": [
      "摘要是有损表示。",
      "关键约束不只依赖自由文本摘要。",
      "需要时回读原始证据。"
    ],
    "pitfalls": [
      "只用短问答评估长任务记忆。",
      "把摘要写得更自信当作更准确。"
    ],
    "followups": [
      "如何处理相互冲突的记忆？",
      "删除如何传播到索引与缓存？"
    ],
    "scenario": "长任务压缩后仍只能修改测试环境，不能扩展到生产。",
    "related": [
      "cache-isolation",
      "agent-context-memory-memory"
    ],
    "source": "https://www.anthropic.com/research/effective-context-engineering-for-ai-agents"
  },
  {
    "id": "agent-evaluation-judge",
    "topic": "ai",
    "title": "如何设计 Agent 评测，避免“模型自己夸自己”？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Evals",
      "评测",
      "Trace",
      "回归",
      "可观测性"
    ],
    "summary": "以外部可验证的任务目标为核心，规则、人工与模型评审分层使用，并校准模型评审的偏差。",
    "principles": [
      "最终状态和工具轨迹都纳入评测。",
      "开发集与独立测试集分离。",
      "对语义评分抽样人工复核并固定 rubric。"
    ],
    "pitfalls": [
      "只打一个主观总分。",
      "重复调试同一批问题后宣称泛化提升。"
    ],
    "followups": [
      "如何处理基础设施失败？",
      "评审模型更换如何保持可比性？"
    ],
    "scenario": "知识助手每次变更后检查引用支持与权限硬门槛。",
    "related": [
      "agent-evaluation-rollout"
    ],
    "source": "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"
  },
  {
    "id": "agent-evaluation-rollout",
    "topic": "ai",
    "title": "模型升级后平均分更高，为什么仍可能不能发布？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Evals",
      "评测",
      "Trace",
      "回归",
      "可观测性"
    ],
    "summary": "平均值可能掩盖关键类别退化、越权、成本暴涨或尾延迟。需要分组指标、硬门槛与灰度回滚依据。",
    "principles": [
      "固定模型与提示版本记录。",
      "重复运行评估波动。",
      "对比质量、费用和延迟而非单分数。"
    ],
    "pitfalls": [
      "忽略少数高风险任务。",
      "测试样本少却宣称小差异有显著收益。"
    ],
    "followups": [
      "如何选灰度样本？",
      "多次尝试成功率怎样解释？"
    ],
    "scenario": "检索升级提高普通问答分数，却让资料不足时更爱编造，应阻止发布。",
    "related": [
      "retry",
      "agent-evaluation-judge"
    ],
    "source": "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"
  },
  {
    "id": "agent-security-injection",
    "topic": "ai",
    "title": "为什么提示注入不能仅靠更严格的系统提示解决？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Prompt Injection",
      "沙箱",
      "权限",
      "审批"
    ],
    "summary": "外部内容与指令共享语言通道，模型可能被误导。执行安全必须由独立权限、隔离与数据流限制支撑。",
    "principles": [
      "外部文档不能授予新权限。",
      "不提供任务不需要的高风险工具。",
      "评测实际工具行为而不只看最终拒绝文本。"
    ],
    "pitfalls": [
      "只加入“不要被注入”一句话。",
      "工具错误提示要求扩大权限就自动照做。"
    ],
    "followups": [
      "怎样测试间接注入？",
      "为什么只读工具也可能泄露数据？"
    ],
    "scenario": "网页检索结果要求发送内部资料时，由出站与工具策略拒绝。",
    "related": [
      "web-security-boundaries-ssrf",
      "agent-security-approval"
    ],
    "source": "https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html"
  },
  {
    "id": "agent-security-approval",
    "topic": "ai",
    "title": "怎样避免 Agent 的审批被旧参数或模型输出绕过？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "Prompt Injection",
      "沙箱",
      "权限",
      "审批"
    ],
    "summary": "审批来自可信用户或策略，绑定具体动作、目标和内容。执行前再次核对，实质变化使原审批失效。",
    "principles": [
      "审批对象有稳定 ID 与内容摘要。",
      "模型自报批准不改变真实审批状态。",
      "执行端校验当前身份和资源权限。"
    ],
    "pitfalls": [
      "一次确认永久授权任意写入。",
      "审批后替换目标地址仍直接执行。"
    ],
    "followups": [
      "低风险动作如何自动化？",
      "如何设计可撤销发布？"
    ],
    "scenario": "报告先生成草稿，再审批确定版本与发布目标。",
    "related": [
      "agent-control-loop-checkpoint",
      "agent-security-injection"
    ],
    "source": "https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html"
  },
  {
    "id": "agent-production-cost",
    "topic": "ai",
    "title": "Agent 的成本和延迟应该用哪些指标衡量？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "部署",
      "成本",
      "延迟",
      "限流",
      "可观测性"
    ],
    "summary": "按完成任务统计总费用和成功率，同时拆分排队、模型、工具和流式首字时间。单次调用便宜不代表任务便宜。",
    "principles": [
      "重试与失败调用都计入成本。",
      "限制租户预算和全局并发。",
      "模型路由以分任务评测结果为依据。"
    ],
    "pitfalls": [
      "只统计成功那次的 token。",
      "把流式首字快当任务完成快。"
    ],
    "followups": [
      "缓存如何避免跨租户泄露？",
      "限流时如何控制重试风暴？"
    ],
    "scenario": "对比轻模型多次尝试与强模型单次完成的总成本。",
    "related": [
      "node-capacity-cpu",
      "agent-production-recovery"
    ],
    "source": "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"
  },
  {
    "id": "agent-production-recovery",
    "topic": "ai",
    "title": "浏览器断开或服务发布后，长任务怎样可靠恢复？",
    "level": "工程实践",
    "minutes": 15,
    "tags": [
      "AI",
      "部署",
      "成本",
      "延迟",
      "限流",
      "可观测性"
    ],
    "summary": "执行状态独立于连接持久化，使用任务 ID、attempt 和幂等键恢复；客户端重连查询已有任务，服务端停止接新工作后处理在途任务。",
    "principles": [
      "结果写入后再通知。",
      "租约恢复拒绝旧 attempt 覆盖。",
      "用户取消与断线是不同语义。"
    ],
    "pitfalls": [
      "断线自动重新创建收费任务。",
      "部署直接杀进程却无恢复状态。"
    ],
    "followups": [
      "取消时工具已产生副作用怎么办？",
      "如何恢复断线期间的事件？"
    ],
    "scenario": "报告生成连接中断后通过 taskId 查询，不重复创建报告。",
    "related": [
      "worker-lease",
      "idempotency",
      "agent-production-cost"
    ],
    "source": "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"
  }
] satisfies Question[];
