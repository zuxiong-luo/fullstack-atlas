import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "react-state-effects",
  "topic": "react",
  "title": "从状态快照到请求竞态：理解 React 的数据流",
  "description": "把一次渲染、一个闭包和一轮异步请求连起来，解释界面为什么会读到旧状态。",
  "minutes": 13,
  "tags": [
    "React",
    "Hooks",
    "闭包",
    "竞态"
  ],
  "scope": "函数组件与 Hooks；配套实验使用 React 18。",
  "prerequisites": [
    "JavaScript 闭包",
    "Promise 与事件循环"
  ],
  "questionIds": [
    "react-snapshot",
    "effect-race",
    "event-loop",
    "web-performance",
    "concurrency-pool"
  ],
  "experiment": "react",
  "sections": [
    {
      "id": "snapshot",
      "title": "一次渲染是一张快照",
      "paragraphs": [
        "组件执行时读到的 state 属于那次渲染。事件处理器、定时器和异步回调都可能捕获这一轮的变量。调用更新函数是在请求后续渲染，不是在原地修改当前闭包。",
        "因此，分析旧值问题时，先标记回调是在什么时候创建的、又在什么时候执行。单说“setState 是异步的”解释不了为什么一个几秒后执行的回调仍然读到旧值。",
        "连续提交 setCount(count + 1) 时，计算可能都基于同一张快照。函数式更新把计算放入更新队列，适合根据前一个状态推导后一个状态。但它不会自动修复其他 props 或变量的闭包。"
      ],
      "code": "setCount(count + 1); // 基于当前渲染的 count\nsetCount(count + 1);\n\nsetCount(previous => previous + 1); // 基于队列中的前值\nsetCount(previous => previous + 1);",
      "language": "tsx"
    },
    {
      "id": "effect",
      "title": "Effect 负责建立和撤销同步关系",
      "paragraphs": [
        "Effect 适合与组件外部系统同步，例如订阅事件、连接服务或同步非 React 控件。由用户点击直接触发的提交操作，通常应先考虑放在事件处理器中，而不是把所有业务都搬进 Effect。",
        "依赖变化时，React 清理上一轮同步，再建立新一轮。清理不只发生在卸载时。缺失清理的订阅、定时器和网络回调，可能在旧页面已经失效后继续影响新页面。",
        "依赖数组应反映所使用的响应式值。要减少不必要的重新执行，应调整代码结构与数据流，而不是为了消除提示随意删依赖。"
      ]
    },
    {
      "id": "race",
      "title": "请求取消与结果失效是两种保护",
      "paragraphs": [
        "用户先搜索 A，再搜索 B。如果 A 更晚返回，无条件写入结果就会把界面倒退到 A。这个问题与请求是否报错无关，而是结果的归属已经过期。",
        "下面的最小示例同时使用取消信号和失效标记。取消用于尽可能停止无用工作，标记用于保护前端状态。浏览器取消请求不保证服务端已经停止处理，因此有副作用的操作仍需后端幂等设计。"
      ],
      "code": "useEffect(() => {\n  let active = true;\n  const controller = new AbortController();\n  setLoading(true);\n  setError(null);\n  fetch(`/api/search?q=${encodeURIComponent(query)}`, {\n    signal: controller.signal\n  })\n    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })\n    .then(data => { if (active) setResults(data); })\n    .catch(error => {\n      if (active && error.name !== \"AbortError\") setError(error.message);\n    })\n    .finally(() => { if (active) setLoading(false); });\n  return () => { active = false; controller.abort(); };\n}, [query]);",
      "language": "tsx",
      "takeaway": "不仅保护成功结果，错误和 finally 中的状态更新也要检查是否属于当前请求。"
    },
    {
      "id": "refs",
      "title": "ref 不是修复一切的捷径",
      "paragraphs": [
        "ref 可以持有可变值且不触发重新渲染，适合保存外部句柄等信息。但界面依赖的数据如果全部放入 ref，会让 UI 更新失去明确的数据流。",
        "面对重复请求、缓存、重试、后台刷新等组合问题，可以考虑查询缓存工具；但库不会自动知道你的租户边界、任务身份和错误策略，查询键与失效时机仍需要设计。",
        "实践时可以先用配套计数实验验证状态更新，再在项目中给每轮请求加上可追踪的标识，观察旧回调是否还在提交结果。"
      ]
    }
  ],
  "references": [
    {
      "title": "React：状态快照",
      "url": "https://react.dev/learn/state-as-a-snapshot"
    },
    {
      "title": "React：使用 Effect 同步",
      "url": "https://react.dev/learn/synchronizing-with-effects"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
