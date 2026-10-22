import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "flutter-engineering",
  "topic": "flutter",
  "title": "从 Flutter 界面到设备通信：跨端应用的工程边界",
  "description": "结合机器人终端与 App 场景，连接状态、渲染、通信生命周期和性能诊断。",
  "minutes": 14,
  "tags": [
    "Flutter",
    "GetX",
    "gRPC",
    "跨端"
  ],
  "scope": "Flutter 工程方法与教学示例；不包含公司源码或未验证的性能成果。",
  "prerequisites": [
    "Dart 异步基础",
    "Widget 与 State 基础"
  ],
  "questionIds": [
    "cross-platform-models-render",
    "cross-platform-models-stream"
  ],
  "sections": [
    {
      "id": "context",
      "title": "跨端交付不只是把页面画出来",
      "paragraphs": [
        "在机器人终端、旅游 App 和保单服务等场景中，UI 都只是用户看到的表面。设备状态、网络连接、业务权限和操作结果如何映射到界面，决定了应用是否容易理解和维护。",
        "机器人终端定制涉及多语言、定制 UI、实时雷达图以及与硬件的通信；旅游 App 则更关注首页、产品与预约入口。两者都使用 Flutter，但状态来源、刷新节奏和错误处理并不相同。",
        "因此，技术方案先从业务链路出发：哪些状态来自服务端，哪些是设备遥测，哪些仅属于当前页面？哪些操作可以重试，哪些操作重复执行会造成真实副作用？"
      ]
    },
    {
      "id": "state",
      "title": "把连接、业务与视图状态拆开",
      "paragraphs": [
        "把所有值塞进一个全局控制器，短期方便，长期会使页面与连接管理紧密耦合。更稳妥的方式是明确职责：通信层解析数据，业务层维护状态与规则，视图层订阅需要展示的部分。",
        "GetX 或其他状态方案是实现手段。真正重要的是所有权与生命周期：由谁创建订阅、由谁取消，离开页面以后连接是否继续，重新进入时如何取得当前状态。",
        "连接已建立不代表设备可执行任务；命令已发送也不代表设备执行成功。界面应区分连接状态、业务状态和单次操作状态，而不是共享一个 loading。"
      ],
      "code": "设备 / 服务端\n    ↓ 协议解析、时间戳、错误分类\n通信层：连接与订阅生命周期\n    ↓ 领域数据\n业务层：状态转换、命令确认、重试策略\n    ↓ 视图所需状态\nUI：局部刷新、状态提示、用户操作",
      "language": "职责示意"
    },
    {
      "id": "render",
      "title": "先测量卡在哪里，再减少开销",
      "paragraphs": [
        "Flutter 的界面更新并不意味着每个 Widget 重建都会执行同等规模的布局与绘制。优化时要区分构建、布局、绘制与栅格化的成本，避免看到 rebuild 就立即重写架构。",
        "高频遥测不一定需要以相同频率刷新全部页面。对实时图形可以考虑合并更新、限制无意义的数据变化和缩小重建范围，但展示频率不能破坏业务对实时性的要求。",
        "在合适的 profile 模式和目标设备上观察性能。Debug 模式下的表现不能直接当成最终性能结论；目标设备、屏幕刷新率和绘制复杂度也会影响帧预算。"
      ]
    },
    {
      "id": "communication",
      "title": "通信排障要给每一段计时",
      "paragraphs": [
        "用户说“点击后卡住”，问题可能在主 isolate 的同步计算，也可能在网络请求、设备响应或 UI 等待错误的状态。先记录操作发起、请求发送、响应收到与界面更新的时间点。",
        "gRPC 调用要按具体客户端能力设置 deadline，管理流订阅的取消与重连。断线后继续保留旧订阅，可能造成重复回调和资源泄漏；取消旧订阅后也要处理迟到结果。",
        "对于有副作用的设备命令，重试前需要知道是否支持命令 ID、幂等或查询执行结果。不能因为超时就断言设备没有执行，更不能无限重试。"
      ]
    },
    {
      "id": "delivery",
      "title": "让维护和交付成为实现的一部分",
      "paragraphs": [
        "多语言不仅是字符串替换，还包括长度变化、字体、布局和必要的方向适配。Android 与不同终端环境也可能出现交互、动画和系统集成差异，需要在实际设备上验证。",
        "对重复业务模块先识别稳定部分，再抽取可配置组件。过早把所有差异抽象成大量开关，反而会让组件比重复实现更难维护。",
        "跨端经验的价值，在于能说明如何把业务、设备与界面连接起来，以及遇到异常时如何定位和恢复。它应通过具体责任和案例表达，而不是只列出框架名称。"
      ]
    }
  ],
  "references": [
    {
      "title": "Flutter：性能最佳实践",
      "url": "https://docs.flutter.dev/perf/best-practices"
    },
    {
      "title": "Flutter：性能视图",
      "url": "https://docs.flutter.dev/tools/devtools/performance"
    },
    {
      "title": "gRPC：Deadlines",
      "url": "https://grpc.io/docs/guides/deadlines/"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
