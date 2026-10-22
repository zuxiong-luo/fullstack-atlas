import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "react-fiber-scheduling",
  "topic": "react",
  "title": "React 核心（一）：Fiber、更新优先级与可中断渲染",
  "description": "沿一次输入更新区分调度、协调与提交，理解并发渲染能做什么、不能做什么。",
  "minutes": 8,
  "tags": [
    "React",
    "Fiber",
    "调度",
    "Transition"
  ],
  "scope": "以 React 18 的同步 transition 用法为例；Fiber / lanes 是内部模型，不承诺字段或实现跨版本稳定。",
  "prerequisites": [
    "闭包与事件循环",
    "React 状态更新"
  ],
  "sections": [
    {
      "id": "s7-175985",
      "title": "先分清三个阶段",
      "paragraphs": [
        "触发更新后，React 需要决定先处理哪些工作，再计算新的组件树，最后把变化提交到宿主环境。调度决定工作的紧急程度，协调决定哪些节点可以复用，提交负责让用户实际看到变化。render 被执行不代表 DOM 已经更新。",
        "以搜索框为例，输入字符必须及时显示，而上万条结果的重新渲染可以稍后完成。如果两件事都抢占主线程，用户会觉得输入卡顿。把更新分级是为了交互延迟，不是为了让计算总量自动减少。"
      ]
    },
    {
      "id": "s16-288290",
      "title": "Fiber 是工作单元，不是线程",
      "paragraphs": [
        "Fiber 可以理解为保存组件工作状态与树关系的数据结构，包含与父、子、兄弟节点的联系。React 用显式的工作结构组织遍历，才有机会在工作单元之间暂停、继续或放弃某一轮计算。它不是浏览器线程，也不是 Web Worker。",
        "当前已提交的树与正在计算的树可以在逻辑上分开。低优先级计算可能被更紧急的更新打断，之前的一部分计算可能重新进行。因此组件渲染必须纯净：不要在 render 中扣费、写数据库或修改共享变量。内部字段与调度实现不是稳定公共 API，分析源码时应固定版本。"
      ]
    },
    {
      "id": "s24-399646",
      "title": "Transition 标记更新，不会搬走同步计算",
      "paragraphs": [
        "在 React 18 的示例中，输入值正常更新，结果所依赖的查询值放入 transition。React 可以优先处理输入并重新计算结果树。但 startTransition 的回调本身同步执行；在回调里执行一个耗时 500ms 的普通循环仍会阻塞主线程。",
        "可中断的是 React 管理的渲染工作边界，不是任意 JavaScript 指令。单个组件内部过大的同步计算也不能被神奇地切开。应先减少数据规模、使用虚拟列表或把纯计算交给 Worker，再评估调度是否改善交互。"
      ],
      "code": "const [input, setInput] = useState('');\nconst [query, setQuery] = useState('');\nconst [isPending, startTransition] = useTransition();\nfunction onChange(event) {\n  const value = event.target.value;\n  setInput(value);\n  startTransition(() => setQuery(value));\n}\n// input 驱动输入框；query 传给结果组件。\n// 重计算放在 startTransition 回调里，并不会进入后台线程。",
      "language": "tsx"
    },
    {
      "id": "s8-205966",
      "title": "优先级与提交边界",
      "paragraphs": [
        "可以把 lanes 理解为内部用于组织不同更新批次与优先级的信息。它帮助 React 选择工作并处理被跳过的更新；不要把它等同于固定毫秒数或业务上的线程优先级。理解更新何时可以延后，比背诵位掩码数值更有迁移价值。",
        "一次提交中的 DOM 变更通常需要同步完成，避免用户看到树更新到一半的状态。布局 Effect 中的重活仍可能延迟绘制。并发渲染改善的是可调度阶段，不能抵消很昂贵的提交、布局或绘制。"
      ]
    },
    {
      "id": "s17-506141",
      "title": "验证：以交互延迟而不是渲染次数评判",
      "paragraphs": [
        "建立一个大列表，分别测试直接更新、transition、虚拟列表三种方案。在同一设备和生产构建中记录输入响应、提交时长与总计算量。transition 可能让渲染次数增加，却让输入更流畅，这并不矛盾。",
        "自测：如果把排序挪到 startTransition 回调里仍卡顿，瓶颈在哪？参考判断：排序仍是同步执行；应检查算法、数据量与线程边界，而不是继续增加 transition。若主线程快而帧率仍低，再检查布局与 GPU 绘制。"
      ]
    }
  ],
  "questionIds": [
    "react-fiber-scheduling-interrupt",
    "react-fiber-scheduling-transition"
  ],
  "references": [
    {
      "title": "React：useTransition",
      "url": "https://react.dev/reference/react/useTransition"
    },
    {
      "title": "React：渲染与提交",
      "url": "https://react.dev/learn/render-and-commit"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
