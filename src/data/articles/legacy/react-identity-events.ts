import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "react-identity-events",
  "topic": "react",
  "title": "React 核心（二）：节点身份、Hooks 与事件传播",
  "description": "从列表错位和弹窗点击穿透出发，把协调、状态归属与事件模型连接起来。",
  "minutes": 8,
  "tags": [
    "React",
    "Hooks",
    "key",
    "事件",
    "Portal"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "组件与 props",
    "DOM 事件捕获和冒泡"
  ],
  "sections": [
    {
      "id": "s12-304342",
      "title": "状态属于树中的位置与身份",
      "paragraphs": [
        "React 复用状态时会考虑组件类型、所在位置以及 key 等身份信息。列表删除第一项后，如果使用数组下标作为 key，后面的业务项可能继承前一项的输入状态。界面看似只是文本变化，实际状态已经对应错对象。",
        "key 只需在同一组兄弟元素中稳定且唯一；它不是发给后端的 ID，也不会自动成为组件 props。随机 key 会让每次渲染都像新组件，导致输入丢失、Effect 重新建立和不必要的挂载。"
      ]
    },
    {
      "id": "s19-366973",
      "title": "Hooks 调用顺序就是状态槽位的约定",
      "paragraphs": [
        "同一组件多次渲染时，React 依赖稳定的 Hooks 调用顺序识别状态。若把 useState 放入条件分支，某轮少调用一个 Hook，后续调用就无法按原位置匹配。解决方式通常是把条件放进 Hook 内部或拆分组件。",
        "把组件函数当普通函数直接调用，也会模糊组件边界及状态归属。使用 JSX 建立独立节点。自定义 Hook 复用的是逻辑，每次调用的状态并不会因为函数名一样就自动共享。"
      ]
    },
    {
      "id": "s12-321727",
      "title": "传播与默认行为是不同维度",
      "paragraphs": [
        "stopPropagation 控制事件传播，preventDefault 阻止默认行为。按钮在表单里可能触发表单提交，阻止冒泡并不等于阻止提交；可以为非提交按钮明确设置 type=\"button\"。React 事件对象提供统一接口，但仍需理解宿主 DOM 行为。",
        "Portal 的 DOM 可以位于组件外部容器，React 事件仍可沿 React 树传播。实现弹窗“点击背景关闭”时，可以比较 target 与 currentTarget，只在点中背景本身时关闭，而不是让每个子节点都阻止冒泡。"
      ],
      "code": "function Backdrop({ close, children }) {\n  return <div onClick={event => {\n    if (event.target === event.currentTarget) close();\n  }}>{children}</div>;\n}\n// 键盘 Escape、焦点管理与无障碍名称仍需单独实现。",
      "language": "tsx"
    },
    {
      "id": "s15-403303",
      "title": "订阅生命周期与事件闭包一起检查",
      "paragraphs": [
        "组件内事件处理器读取的是对应渲染的变量；注册到 window 的回调如果只注册一次，也可能长期持有旧闭包。订阅应有清理，且要明确回调如何获得所需的最新值。不要简单删除依赖或为每次按键无限注册监听器。",
        "现代 React DOM 与早期版本在事件委托位置、事件池等细节上存在差异。调试第三方组件与原生监听器混用时，应固定 React 版本并记录捕获和冒泡顺序，避免套用老版本经验。"
      ]
    },
    {
      "id": "s19-391767",
      "title": "练习：定位状态串行而不是先加 memo",
      "paragraphs": [
        "创建三个带输入框的列表项，输入不同内容，然后删除首项。对比 index key 与业务 ID key，记录哪个组件被复用。接着在 Portal 弹窗里打印内外层点击，解释为何 DOM 层级和 React 传播链不同。",
        "自测答案要点：key 修复身份，memo 只可能跳过某些重复计算，不能修复错误身份；阻止默认行为不能替代阻止传播；弹窗还需处理键盘焦点。把这三个责任混在一个事件函数里会使问题更难定位。"
      ]
    }
  ],
  "questionIds": [
    "react-identity-events-key",
    "react-identity-events-event"
  ],
  "references": [
    {
      "title": "React：保存与重置状态",
      "url": "https://react.dev/learn/preserving-and-resetting-state"
    },
    {
      "title": "React：事件",
      "url": "https://react.dev/learn/responding-to-events"
    },
    {
      "title": "React：Portal",
      "url": "https://react.dev/reference/react-dom/createPortal"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
