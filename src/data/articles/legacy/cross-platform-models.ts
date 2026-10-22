import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "cross-platform-models",
  "topic": "flutter",
  "title": "跨平台：React Native、Flutter 的渲染与通信模型",
  "description": "理解共享业务代码之外的差异，围绕设备能力、线程和交付成本做选型。",
  "minutes": 8,
  "tags": [
    "React Native",
    "Flutter",
    "JSI",
    "Fabric",
    "跨平台"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "React 或 Dart 基础",
    "移动端生命周期"
  ],
  "sections": [
    {
      "id": "s14-414901",
      "title": "先列出平台需求，再讨论复用率",
      "paragraphs": [
        "电商 App、机器人终端与桌面控制台的约束不同：可访问性、原生 SDK、后台行为、设备通信、启动时间和多语言都可能成为关键因素。代码复用率只是指标之一，原生插件维护与调试成本同样需要计入。",
        "RN 和 Flutter 都能建立跨平台界面，但宿主组件、渲染组织和语言运行时不同。框架不能消除平台权限、系统版本及硬件差异；关键设备能力应先做真机验证，再决定大规模迁移。"
      ]
    },
    {
      "id": "s18-134375",
      "title": "React Native 的现代架构",
      "paragraphs": [
        "React Native 通过 React 协调界面，新架构中的 Fabric、JSI 与原生模块体系改变了旧异步 bridge 的部分约束。不要把所有版本都描述成“每次更新必须序列化经过同一条桥”。渲染、提交和挂载的责任需要分开理解。",
        "JSI 提供运行时与原生能力互操作的机制，但同步调用并不总是更好：昂贵的同步原生操作仍会拖住调用线程。列表掉帧应区分 JS 计算、布局、原生挂载、图片解码和动画执行，不能看到卡顿就归因于桥。"
      ]
    },
    {
      "id": "s15-178526",
      "title": "Flutter 的三棵树与状态",
      "paragraphs": [
        "Widget 是界面配置，Element 维持实例与身份，RenderObject 承担布局绘制相关工作。build 被调用不等于整个屏幕重新光栅化；同样，减少 build 次数也不保证昂贵绘制已经消失。",
        "状态应按生命周期放置：局部交互、共享业务状态和服务端数据不是同一类。GetX、Provider 或其他状态库提供组织工具，但不会自动解决订阅泄漏、请求竞态或设备重连后旧消息覆盖。"
      ]
    },
    {
      "id": "s16-311666",
      "title": "设备通信把 UI 生命周期变复杂",
      "paragraphs": [
        "建立连接状态机，区分未连接、连接中、已连接、重连与关闭。每次连接产生一个 generation，回调写入状态前校验归属；页面销毁或切换设备时取消订阅。重连应有退避，不能无上限地不断创建连接。",
        "高频设备数据不应每条都驱动整页重建。根据业务容忍度聚合或按帧发布最新快照，但告警和控制确认不能随意丢弃。数据展示与控制指令采用不同的可靠性策略。"
      ],
      "code": "设备连接 → generation = 12\n数据流 → 校验设备 ID 与 generation → 领域状态\n领域状态 → 按展示频率聚合 → 局部 UI\n控制指令 → commandId → 超时/确认/幂等 → 状态更新\n切换设备 → 取消旧订阅 → generation = 13",
      "language": "架构示意"
    },
    {
      "id": "s9-244390",
      "title": "真机验收清单与练习",
      "paragraphs": [
        "同一个页面至少验证前后台切换、弱网、权限拒绝、多语言、低端设备与热启动。性能应使用接近发布的构建和真实设备，开发模式的检查与工具开销可能扭曲结论。",
        "练习：画出机器人终端的连接状态机，并解释旧流在重连后到达如何处理。参考答案应包含消息归属、订阅取消、展示节流、控制确认及可观测性；只回答“使用状态管理库”不足以说明设计。"
      ]
    }
  ],
  "questionIds": [
    "cross-platform-models-render",
    "cross-platform-models-stream"
  ],
  "references": [
    {
      "title": "React Native：渲染流水线",
      "url": "https://reactnative.dev/architecture/render-pipeline"
    },
    {
      "title": "Flutter：架构概览",
      "url": "https://docs.flutter.dev/resources/architectural-overview"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
