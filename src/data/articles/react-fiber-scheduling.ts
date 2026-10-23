import type {Article, ArticleBlock, ArticleSection} from '../articleTypes';
const p=(text:string):ArticleBlock=>({type:'paragraph',text});
const code=(purpose:string,code:string,filename='App.tsx'):ArticleBlock=>({type:'code',language:'tsx',filename,purpose,code,kind:'excerpt'});
const ref=(title:string,path:string):ArticleBlock=>({type:'reference',title,url:'https://github.com/facebook/react/blob/v18.3.1/'+path});
const section=(id:string,title:string,blocks:ArticleBlock[]):ArticleSection=>({id,title,paragraphs:[],blocks});
const inlineSources:Record<string,ArticleBlock[]>={
  "dispatch": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberHooks.old.js:2309-2314",
      "kind": "excerpt",
      "purpose": "dispatchSetState 的普通入队与根安排连续节选；eager 和 render-phase 判断已经在本段前完成。",
      "code": "    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);\n    if (root !== null) {\n      const eventTime = requestEventTime();\n      scheduleUpdateOnFiber(root, fiber, lane, eventTime);\n      entangleTransitionUpdate(root, queue, lane);\n    }"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberHooks.old.js L2309–L2314",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L2309-L2314",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "loop": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberWorkLoop.old.js:1824-1860",
      "kind": "excerpt",
      "purpose": "完整 workLoopConcurrent 与 performUnitOfWork：只在工作单元调用前检查让出。",
      "code": "function workLoopConcurrent() {\n  // Perform work until Scheduler asks us to yield\n  while (workInProgress !== null && !shouldYield()) {\n    performUnitOfWork(workInProgress);\n  }\n}\n\nfunction performUnitOfWork(unitOfWork: Fiber): void {\n  // The current, flushed, state of this fiber is the alternate. Ideally\n  // nothing should rely on this, but relying on it here means that we don't\n  // need an additional field on the work in progress.\n  const current = unitOfWork.alternate;\n  setCurrentDebugFiberInDEV(unitOfWork);\n\n  let next;\n  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {\n    startProfilerTimer(unitOfWork);\n    next = beginWork(current, unitOfWork, subtreeRenderLanes);\n    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);\n  } else {\n    next = beginWork(current, unitOfWork, subtreeRenderLanes);\n  }\n\n  resetCurrentDebugFiberInDEV();\n  unitOfWork.memoizedProps = unitOfWork.pendingProps;\n  if (next === null) {\n    // If this doesn't spawn new work, complete the current work.\n    completeUnitOfWork(unitOfWork);\n  } else {\n    workInProgress = next;\n  }\n\n  ReactCurrentOwner.current = null;\n}\n\nfunction completeUnitOfWork(unitOfWork: Fiber): void {\n  // Attempt to complete the current unit of work, then move to the next"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberWorkLoop.old.js L1824–L1860",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1824-L1860",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "render": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberWorkLoop.old.js:866-878",
      "kind": "excerpt",
      "purpose": "并发入口选择同步还是并发 render 的实际条件。",
      "code": "  // We disable time-slicing in some cases: if the work has been CPU-bound\n  // for too long (\"expired\" work, to prevent starvation), or we're in\n  // sync-updates-by-default mode.\n  // TODO: We only check `didTimeout` defensively, to account for a Scheduler\n  // bug we're still investigating. Once the bug in Scheduler is fixed,\n  // we can remove this, since we track expiration ourselves.\n  const shouldTimeSlice =\n    !includesBlockingLane(root, lanes) &&\n    !includesExpiredLane(root, lanes) &&\n    (disableSchedulerTimeoutInWorkLoop || !didTimeout);\n  let exitStatus = shouldTimeSlice\n    ? renderRootConcurrent(root, lanes)\n    : renderRootSync(root, lanes);"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberWorkLoop.old.js L866–L878",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L866-L878",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ]
};
export const reactFiberArticle:Article={
 id:'react-fiber-scheduling',topic:'react',title:'输入框为什么卡顿：沿一次更新读懂 React Fiber 与调度',
 description:'从一个输入带动 800 行计算的页面出发，追踪更新入队、Lane、工作树、中断与提交，并用四组实验分清调整优先级和减少工作量。',
 minutes:44,labMinutes:35,tags:['React 18','Fiber','Lane','Transition','性能测量'],kind:'tutorial',status:'review',versions:['React / React DOM 18.3.1','TypeScript 5.7.2','Node.js 22'],verifiedAt:'2026-10-23',
 scope:'讨论 createRoot 客户端更新；不展开 SSR、Hydration、Suspense 重试与 React 19 的异步 Action 语义。示意图不代表精确耗时，实验不提供未经测量的性能提升比例。',
 prerequisites:['能写受控输入和 useState','了解 JavaScript 同步调用与浏览器事件循环','知道组件执行与 DOM 更新不是同一件事'],
 questionIds:['react-fiber-scheduling-interrupt','react-fiber-scheduling-transition'],experiment:'react',examples:[{label:'下载完整 React 调度实验（ZIP）',path:'react-fiber-scheduling.zip'},{label:'运行与测量说明',path:'react-fiber-scheduling/README.md'}],
 sections:[
 section('problem','先认识调度：把界面工作按紧急程度组织起来',[
p("React 调度是组织界面更新执行顺序的内部机制：状态更新进入队列，以 Lane 标记工作类别，根选择本轮工作并安排回调，再由工作循环推进渲染。Fiber 是保存节点状态、树关系和工作进度的对象。二者配合，让允许延后的渲染在工作单元之间让出主线程，让更紧急的输入反馈有机会先完成。"),
p("本篇是这套机制的应用观察篇：用同一个搜索输入，把“修改工作优先级”和“直接减少工作量”分开验证。源码专篇负责详解队列、Lane与根调度的数据结构；这里正文保留理解实验所需的真实入口与完整案例。先走输入一次字符的普通路径，再加入连续输入和长同步计算两个条件。"),

 p('你在页面顶部输入一个关键词，下面的结果列表跟着更新。数据不需要请求，逻辑也没有死循环，但输入几个字之后，光标和文字开始迟钝。直觉上你可能会给过滤函数加 useMemo，或者给状态更新包一层 startTransition。先别急着选 API：这两种操作解决的并不是同一个问题。'),
 p('用户输入后，浏览器需要执行事件处理函数，React 需要计算下一版界面，随后修改 DOM，浏览器还要完成样式、布局和绘制。只要其中一段长时间占着主线程，新的输入就只能等待。我们要分别回答：工作为什么这么多，以及哪些工作必须先完成。减少列表规模是在减少工作；transition 则是在仍有工作要做时，允许输入的更新先获得处理机会。'),
 p('本文使用一个有意放大的案例：一个受控输入，带动 800 个结果行，每行执行一段确定性的整数计算。它模拟昂贵的展示计算，不模拟真实搜索相关性。普通模式和 transition 模式的行数、计算函数完全相同，这样我们才能比较调度。第三种模式只显示前 40 行，用来观察减少工作量；第四种模式把重计算放进 transition 回调，验证一个经常被误解的边界。'),
 {type:'experiment',id:'react-scheduling',title:'打开四组调度对照实验',description:'单文件 App.tsx，React 18.3.1。先保持默认 800 行和每行 16000 次迭代，再根据设备调整。'},
 p('示例使用 createRoot，没有包 StrictMode。这样做是为了减少第一次观察时的额外开发行为，不代表业务项目应该移除 StrictMode。本站实验室和独立项目的开发构建会有额外开销；做最终性能判断时还需要看生产构建。React 当前官网可能展示更新版本的 API，本文内部实现以 v18.3.1 tag 为准。')]),
 section('state-split','完整案例上半部：计算、行组件与复用边界',[
{"type": "code", "language": "tsx", "filename": "examples/react-fiber-scheduling/App.tsx · 第一段", "kind": "excerpt", "purpose": "原项目从导入到 Results 的完整连续代码；下一段 App 紧接在后。score 在每个 Row 中计算，React 获得 Row 之间的工作边界。", "code": "import React, {\n  memo,\n  useState,\n  useTransition,\n  useLayoutEffect,\n  useRef,\n} from \"react\";\ntype Mode = \"sync\" | \"transition\" | \"reduced\" | \"blocking\";\nconst modes: { id: Mode; label: string }[] = [\n  { id: \"sync\", label: \"普通更新\" },\n  { id: \"transition\", label: \"Transition\" },\n  { id: \"reduced\", label: \"减少工作量\" },\n  { id: \"blocking\", label: \"同步计算反例\" },\n];\n// 确定性 CPU 工作，模拟单行计算，不在 render 内读写时钟或外部状态。\nexport function score(seed: number, rounds: number): number {\n  let n = seed | 0;\n  for (let i = 0; i < rounds; i++)\n    n = (Math.imul(n ^ i, 1664525) + 1013904223) | 0;\n  return n >>> 0;\n}\nfunction Row({\n  index,\n  query,\n  rounds,\n}: {\n  index: number;\n  query: string;\n  rounds: number;\n}) {\n  const value = score(index + query.length, rounds);\n  return (\n    <div style={{ padding: \"3px 8px\", borderBottom: \"1px solid #eee\" }}>\n      {index + 1}. {query || \"全部\"} · {value}\n    </div>\n  );\n}\nconst Results = memo(function Results({\n  query,\n  count,\n  rounds,\n}: {\n  query: string;\n  count: number;\n  rounds: number;\n}) {\n  return (\n    <div>\n      {Array.from({ length: count }, (_, index) => (\n        <Row key={index} index={index} query={query} rounds={rounds} />\n      ))}\n    </div>\n  );\n});\n"},
p("先把输入交代清楚：页面初始 text/query 都为空，count=800，每行 rounds=16000。score(seed,rounds) 是纯整数循环，相同输入返回相同值；第0行的 seed 等于 query.length。它只模拟 CPU 成本。Row 返回一个宿主 div，Results 负责创建800个独立行组件。index key 在本例稳定位置不重排的条件下使用。"),

{"type": "code", "language": "tsx", "filename": "examples/react-fiber-scheduling/App.tsx · 第二段", "kind": "excerpt", "purpose": "完整 App 函数，接上段即为原文件；包含四模式选择、状态、事件入口、提交观察与结果展示，不要求跳到实验室补齐代码。", "code": "export default function App() {\n  const [mode, setMode] = useState<Mode>(\"sync\");\n  const [text, setText] = useState(\"\");\n  const [query, setQuery] = useState(\"\");\n  const [count, setCount] = useState(800);\n  const [rounds, setRounds] = useState(16000);\n  const [pending, startTransition] = useTransition();\n  const lastInput = useRef<{ text: string; at: number } | null>(null);\n  const visibleCount = mode === \"reduced\" ? Math.min(count, 40) : count;\n  useLayoutEffect(() => {\n    const sample = lastInput.current;\n    if (!sample || sample.text !== text) return;\n    console.log(\"[输入提交代理指标 ms]\", {\n      mode,\n      text,\n      elapsed: +(performance.now() - sample.at).toFixed(2),\n    });\n    lastInput.current = null;\n  }, [text, mode]);\n  function change(next: string) {\n    lastInput.current = { text: next, at: performance.now() };\n    setText(next);\n    if (mode === \"transition\" || mode === \"blocking\")\n      startTransition(() => {\n        if (mode === \"blocking\")\n          console.log(\"[同步计算校验值]\", score(next.length, count * rounds));\n        setQuery(next);\n      });\n    else setQuery(next);\n  }\n  return (\n    <main\n      style={{\n        fontFamily: \"system-ui\",\n        padding: 20,\n        maxWidth: 760,\n        margin: \"auto\",\n      }}\n    >\n      <h2>同一个输入框，四种工作安排</h2>\n      <p>\n        连续输入 abcdef，观察输入、列表标题、pending\n        和控制台。先用默认规模，再按机器能力调整。\n      </p>\n      <div style={{ display: \"flex\", flexWrap: \"wrap\", gap: 8 }}>\n        {modes.map((m) => (\n          <button\n            key={m.id}\n            onClick={() => setMode(m.id)}\n            aria-pressed={mode === m.id}\n            style={{\n              padding: 8,\n              background: mode === m.id ? \"#cce6db\" : \"#fff\",\n            }}\n          >\n            {m.label}\n          </button>\n        ))}\n      </div>\n      <p>\n        <label>\n          行数{\" \"}\n          <select\n            value={count}\n            onChange={(e) => setCount(Number(e.target.value))}\n          >\n            {[200, 800, 1600].map((n) => (\n              <option key={n}>{n}</option>\n            ))}\n          </select>\n        </label>{\" \"}\n        <label>\n          每行迭代{\" \"}\n          <select\n            value={rounds}\n            onChange={(e) => setRounds(Number(e.target.value))}\n          >\n            {[4000, 16000, 48000].map((n) => (\n              <option key={n}>{n}</option>\n            ))}\n          </select>\n        </label>\n      </p>\n      <input\n        aria-label=\"实验输入\"\n        value={text}\n        onChange={(e) => change(e.target.value)}\n        placeholder=\"连续输入 abcdef\"\n        style={{ width: \"100%\", boxSizing: \"border-box\", padding: 10 }}\n      />\n      <p role=\"status\">\n        输入：{text || \"空\"} ｜ 列表参数：{query || \"空\"} ｜{\" \"}\n        {pending ? \"pending：正在准备列表\" : \"已提交\"}\n      </p>\n      <p>\n        当前渲染 {visibleCount} 行；减少工作量只显示前 40\n        行，是分页的简化示意，不是完整虚拟列表。\n      </p>\n      <div\n        style={{\n          height: 280,\n          overflow: \"auto\",\n          opacity: pending ? 0.6 : 1,\n          border: \"1px solid #bbb\",\n        }}\n      >\n        <Results query={query} count={visibleCount} rounds={rounds} />\n      </div>\n    </main>\n  );\n}\n"},
 p('text 决定用户正在编辑的输入框，query 决定结果列表。普通模式同时调用 setText 和 setQuery，列表会跟随这次输入进入更新流程。transition 模式仍然立即调用两个 setter，但 React 给它们安排的更新优先级不同。不要把“回调立即执行”和“界面立即完成”混为一谈：setter 把更新交给 React，不等于这个组件现在就已经完成渲染。'),
 p('输入框的 value 必须绑定 text，而不是绑定 query。否则你把用户正在编辑的内容也放进了允许滞后的更新里。两份状态不是复制同一个业务事实来回同步，它们表达两个不同时间点：用户最新输入是什么，以及结果目前按照哪个查询展示。页面应该明确展示这种滞后，例如 pending 时保留旧结果并降低透明度。'),
 p('另一个容易漏掉的地方是 Results 外层的 memo。在紧急更新中，text 变了，query 还没有变化。如果 Results 的 props 保持相同，memo 让这棵昂贵子树有机会跳过这次父组件带来的渲染。没有这个边界，父组件为了更新输入而重新执行时，也可能再次带上列表工作，掩盖你想观察的调度差异。memo 不是强制缓存指令；自身状态和读取的 context 等仍可触发更新。'),
 p('这里用 index 作为 key 是因为数据是固定位置的演示行，不做插入、删除或重排。真实搜索列表应使用结果的稳定业务 ID。本篇不把节点身份和调度混在一起讲，但 key 的变化会改变复用关系，确实会影响你的性能实验。')]),
 section('queue','setter 之后：更新先进入队列',[
 p('组件执行时拿到的是这一轮渲染的状态快照。调用 setQuery 并不是修改当前函数里 query 变量的值，而是创建一条待处理更新。Hooks 内部为状态维护队列，更新记录包含 action 和 lane 等信息。action 可以是直接值，也可以是根据旧状态计算新状态的函数。后面的渲染再按被选中的工作集合处理这些记录。'),
 p('Lane 可以先理解为更新所属的优先级类别；在实现里它是位集合，可以高效地合并与判断多个类别。不要把它理解成一条独立线程，也不要以为一个 Lane 永远只装一个更新。React 还需要表达当前节点及其子树有哪些待处理工作，把这份信息向根传播，根才知道还有什么没有做完。'),
 p('在我们的输入事件中，受控输入的更新很紧急；在 startTransition 同步回调内安排的列表更新会获得 transition 类别。requestUpdateLane 根据当前上下文选择 lane。接着更新入队，scheduleUpdateOnFiber 通知根安排工作。这些名称值得记住，但更重要的是它们把业务意图转换成了调度信息：界面不是只有一个“全都立刻刷新”的开关。'),
 ...inlineSources.dispatch,
 ref('优先级选择和根调度：查 requestUpdateLane、scheduleUpdateOnFiber、ensureRootIsScheduled','packages/react-reconciler/src/ReactFiberWorkLoop.old.js'),
 p('如果这一轮只处理紧急更新，列表的 transition 更新不会因此消失。被跳过的工作仍需保留，后续在适合的优先级下重新参与状态计算。对于函数式更新，顺序必须保持一致，否则延后某个加一操作之后，最终状态可能算错。React 用基础状态和保留下来的更新队列处理这件事；这是“稍后做”比简单 setTimeout 更复杂的地方。'),
 p('用一个数字看重放为什么必要：基础状态是 1，先排入低优先级的 n => n + 10，再排入紧急的 n => n * 2。紧急一轮先跳过加十，临时展示 2。之后不能在这个 2 上补一次加十得到 12，因为原始顺序要求先加再乘，最终应是 22。React 因此需要从跳过之前的基础状态出发，把相关后续更新按顺序重新计算。这不是撤销已经展示过的 DOM，而是保证最终状态遵守更新语义。'),
 {type:'table',headers:['时刻','参与计算的更新','结果'],rows:[['初始','基础状态','1'],['紧急渲染','暂时跳过 +10，处理 ×2','2'],['后续重放','从基础状态 1 依次 +10、×2','22']]}
]),
 section('fiber','为什么需要一棵可以保存进度的工作树',[
 p('想象你用普通递归遍历一棵组件树：执行父节点，再执行每个孩子。如果整段递归一直占着 JavaScript 调用栈，浏览器没有机会处理下一次输入。要能够暂停，你需要把“执行到哪儿了、下一个节点是谁、完成后回到哪里”保存到普通数据结构里，而不只是隐含在调用栈里。Fiber 正是 React 用来组织这些工作的节点结构。'),
 {type:'figure',src:'figures/react-fiber-scheduling/fiber.svg',title:'同一个界面的当前树与工作树',alt:'左侧是已提交的 current 树，右侧是计算中的 work-in-progress 树。相应节点由 alternate 连接；右侧父节点 child 指向首个子节点，子节点 sibling 指向兄弟，return 指回父节点。',caption:'教学简图：每个框代表一个 Fiber，不保证对应一个 DOM 元素。真实结构还包含状态、更新队列、Lane 和副作用标记。'},
 p('图里的 child 指向第一个孩子，sibling 指向下一个兄弟，return 指回父节点。这些连接让遍历不必完全依赖递归函数的调用栈。处理完一个节点之后，可以向下进入孩子，也可以在子树完成后回到父级，再寻找尚未处理的兄弟。函数组件、宿主 DOM 节点等都可能有自己的 Fiber；Fiber 不是虚拟 DOM 对象的别名，更不是一个浏览器线程。'),
 p('current 是最近一次已经提交的版本。React 构建下一版时使用 work-in-progress；对应节点可以通过 alternate 关联。这样，计算新界面时，用户仍然看到旧界面。被中断或放弃的计算不应该把半成品随意写进当前 DOM。alternate 也不意味着每次 setState 都从零深拷贝整棵树：节点可以复用，子树可以跳过，是否复用取决于身份和待处理工作。'),
 p('Fiber 上的 memoizedProps、memoizedState 保存已处理的信息，pendingProps 是待处理输入，flags 等标记记录之后需要做的提交工作。这些字段共同支持“先算出下一版，再一次性进入提交阶段”的过程。只记住 child、sibling、return 三个指针，还不足以解释状态为什么不会随着中断丢掉。'),
 ref('结构字段与 work-in-progress 复用：查 FiberNode、createWorkInProgress','packages/react-reconciler/src/ReactFiber.old.js')]),
 section('lanes','优先级怎样影响执行方式',[
...inlineSources.render,
p("这段检查的是已经选好的 lanes：普通 Default 包含阻塞类别，常见路径会用 renderRootSync；Transition 在不阻塞、未过期、未触发 Scheduler 超时等前提下，可以用 renderRootConcurrent。先看这组正向条件，再读下面的让出循环，就能区分“回调名称包含 Concurrent”和“这轮真的允许切片”。"),

 p('根节点可能同时有多种待处理工作。getNextLanes 要选出这一轮要处理的集合，并考虑正在进行的工作、挂起、过期等状态。ensureRootIsScheduled 会比较已有回调的优先级，必要时复用或重新安排回调。这里有两层概念：Lane 帮 React 表达更新之间的关系，Scheduler 帮 React 把执行机会安排到主线程上。二者有关联，但不是同一套编号。'),
 p('在允许并发渲染的路径里，工作循环会在工作单元之间检查是否应该让出。如果要让出，React 保留进度，当前任务返回，浏览器才有机会处理其他事件。之后还可能继续未完成的工作。但紧急的同步路径不这样让出；即使使用 createRoot，也不能把任何更新都理解成自动切成若干小片。更新类别、过期状态及执行路径会影响选择。'),
 ref('Lane 集合的选择：查 getNextLanes','packages/react-reconciler/src/ReactFiberLane.old.js'),
 {type:'code',language:'text',purpose:'只保留协作式让出的思想；这不是 React 的真实实现，也没有实现 Lane、异常恢复或提交。',kind:'pseudocode',code:'while (还有工作 && 本轮允许继续) {\n  处理一个工作单元();\n  保存下一单元的位置();\n}\n如果还有工作：安排后续执行机会；\n否则：进入提交前的检查。'},
 p('最重要的边界是：React 不能暂停你正在执行的一段普通 JavaScript 函数，然后从它内部某一行恢复。一个 Row 的计算要先返回，调度器才可能在后续工作边界让出。如果你把全部 800 行的重计算放到一个组件函数的单个 map 或循环里，即使列表更新是 transition，那一大段同步计算仍可能占满主线程。拆出组件只是在合适的情况下增加可调度边界，不会让运算本身免费。'),
 p('也不要把时间切片写成“每 5 毫秒必定中断”。浏览器的事件循环、设备性能和具体实现都会影响执行。React 能协作让出，不是操作系统的抢占调度；一个过长的工作单元仍然会突破你想象中的时间预算。源码中的阈值不是应用可以依赖的交互承诺。')]),
 section('timeline','输入又来了：继续、重做与提交',[
 {type:'figure',src:'figures/react-fiber-scheduling/timeline.svg',title:'旧列表仍然可见，新输入先被处理',alt:'示意顺序：输入a产生紧急输入更新和列表transition，输入先提交；列表a渲染部分工作后让出；输入ab到达，紧急输入提交；列表工作按最新状态重新协调，最后提交ab结果。',caption:'顺序示意，不是实测火焰图。具体重用与重做范围由树结构和待处理更新决定，并非每次输入必然重建整棵树。'},
 p('沿图走一遍：输入 a 后，输入框对应的紧急状态先得到处理，列表开始准备 a 的结果。还没算完时，React 在工作边界让出。下一次输入 ab 到达后，新的紧急更新需要先响应；列表不应该强迫用户等 a 的全部结果完成后才能继续打字。随后 React 再根据当前状态处理列表工作。'),
 p('这里的“中断”有两种容易混淆的含义：一次任务暂时让出，之后可能继续；或者因为更高优先级的更新改变了条件，需要重新协调之前的工作。不能仅凭 console.log 出现两次就断言发生了哪一种。开发模式、StrictMode、父组件更新、Context 变化都可能让组件多次执行。最终有多少次 DOM 提交，需要单独观察。'),
 p('render 阶段的任务是计算下一版树，并准备要做的变更。它允许被打断和放弃，所以组件函数必须保持纯粹：不要在里面扣库存、发请求或修改外部对象。否则某轮后来被丢弃的计算已经在系统外部留下影响，React 没有办法替你撤销。把副作用放进事件或合适的 Effect，只是基本边界；Effect 本身仍需要正确的清理与幂等考虑。'),
 p('commit 阶段才把这轮完成的结果应用到 DOM，并处理相应的 ref 和布局 Effect 等工作。主要 DOM 变更与布局 Effect 的提交过程不会像并发 render 那样按 Fiber 工作单元让出。浏览器通常要等 JavaScript 返回后才能绘制。因此，transition 即使让 render 更容易响应输入，也救不了一个长时间执行的 useLayoutEffect，或者一次插入大量 DOM 带来的后续布局成本。普通 useEffect 的刷新有独立安排，不应该用“所有 Effect 都在绘制之后”概括所有场景。'),
...inlineSources.loop,
p("带入列表第一个 Row：beginWork 执行 Row 及其 score。该函数返回以后，React 才能更新 workInProgress 并在循环下一次判断 shouldYield。如果当前预算需要让出，while 退出，尚未完成的节点位置仍在 workInProgress；同一个 Row 的 score 内部没有这个判断。因此把800次 score 全移到 Results 内部的一个循环，虽然算量相同，却使单个工作单元变长。"),
 p('现在回到“双树”结构：用户读到的 DOM 来自已提交结果；work-in-progress 可以多次尝试，但只有达到提交条件的版本才成为新界面。并发渲染的价值不是让两个组件同时占用两个 CPU 核心，而是允许不同紧急程度的工作交替推进，并保持对用户展示的结果有一致的提交边界。')]),
 section('counterexample','为什么包进 startTransition 的计算还是卡',[
 code('反例取自第四种模式：startTransition 不会把同步函数搬到后台线程。',`setText(next);
startTransition(() => {
  const checksum = score(next.length, count * rounds);
  console.log('[同步计算校验值]', checksum);
  setQuery(next);
});`),
 p('这段代码进入回调就开始算，直到 score 返回才执行 setQuery。尽管 setText 已经被调用，浏览器仍然要等这个事件处理过程退出，才能获得后续执行机会。这里没有给 React 一棵可分段处理的工作树，只有一个普通函数的长循环。你会看到 transition 没有解决这段阻塞；如果只看 API 名字，很容易误以为“非阻塞更新”意味着回调里的任意代码都非阻塞。'),
 p('如果真正耗时的是独立的大规模数据计算，可以考虑 Web Worker，或者把任务拆为会主动让出的多个阶段。Worker 需要付出消息传输、数据复制或转移、结果过期处理的成本；如果开销主要在 DOM 渲染，Worker 又无法代替主线程完成它。先在 Performance 里找到耗时段，才能选对工具。'),
 p('React 18.3.1 还有一个版本边界：startTransition 的同步作用域结束后，后续定时器或 await 之后安排的更新不会自动继承这里的标记。不要从当前官网对新版异步 Action 的介绍反推 React 18。本文示例故意没有异步请求；实际搜索还需要处理请求取消、旧响应覆盖新响应等问题，那些不是 transition 替你保证的。')]),
 section('experiment','按同一组输入做四次实验',[
 {type:'table',headers:['模式','保持相同的部分','有意改变的部分','应该检查什么'],rows:[['普通更新','800 行、每行相同计算','text 和 query 都普通更新','输入提交是否被列表工作拖后'],['Transition','同样的行数和计算','列表更新优先级较低，子树 memo','输入可先提交，列表允许暂时落后'],['减少工作量','同样的单行函数','只创建前 40 行','工作总量和 DOM 数量下降，内容也少了'],['同步计算反例','仍有 transition 列表','回调内增加一段长同步循环','事件处理阶段仍然阻塞']]},
 p('先打开实验，保持默认参数，分别在四种模式里连续输入 abcdef。每次切换模式后等待列表稳定，再清空输入、重新开始，避免把切换模式的那次渲染混进输入样本。机器太快、差异看不出来时，先提高行数或每行迭代，再考虑 DevTools 的 CPU 节流。不要同时修改两个参数，否则很难解释差异来自哪里。'),
 p('在 transition 模式里，text 和 query 暂时不同是允许的；停止输入之后，二者应最终一致，pending 应回到 false。它们未必每次都肉眼可见地分开：小规模工作可能在下一帧之前完成。没有看到 loading 闪烁，并不能证明没有 transition；反过来，一次明显闪烁也不能证明响应性已经改善。'),
 p('第三种模式通过缩小输出规模降低成本，但也改变了产品行为：只展示前 40 行。真实系统可以分页，或者用虚拟列表只渲染可见范围，同时正确处理滚动高度、键盘导航和可访问性。示例不把简单 slice 冒充完整虚拟列表。调度优化和工作量优化经常一起使用，不能拿少显示 760 行的结果声称“transition 快了若干倍”。'),
 {type:'code',language:'bash',purpose:'从独立示例目录安装锁定依赖、验证并启动；需 Node.js 22 和 npm。',kind:'runnable',filename:'终端',code:'cd examples/react-fiber-scheduling\nnpm ci\nnpm test\nnpm run build\nnpm run dev'},
 p('独立示例的入口 main.tsx 使用 createRoot；App.tsx 也是本站实验室载入的同一份源码。启动后访问终端打印的本机地址。npm test 检查计算的确定性和初始渲染结构，npm run build 检查 TypeScript 与构建；这些检查不会证明浏览器调度或输入延迟，交互验收需要下面的步骤。')]),
 section('measure','怎样测量，才不会被日志骗了',[
 p('先区分三个指标。事件处理耗时是这次输入回调执行了多久；React 提交耗时或渲染耗时关注框架工作；用户感受到的延迟还包含事件等待及浏览器绘制。一个指标下降不代表另外两个必然下降。本文控制台打印的是“输入事件处理函数开始，到 text 对应布局 Effect 执行”的时间代理指标，它接近这次状态提交的观察点，不包含实际绘制完成，也不是 INP。'),
 code('提交代理指标的观测位置；完整示例用 ref 关联最新输入，避免把首次挂载记作输入样本。',`useLayoutEffect(() => {
  const sample = lastInput.current;
  if (!sample || sample.text !== text) return;
  console.log('[输入提交代理指标 ms]', {
    mode, text, elapsed: performance.now() - sample.at
  });
  lastInput.current = null;
}, [text, mode]);`),
 p('打开浏览器 Performance 面板，开始录制，再执行一组固定输入，最后停止。沿着主线程看输入事件、JavaScript 工作、布局和绘制。同步反例应能在输入事件处理期间找到 score 长循环；transition 的列表工作可能分成多个任务，中间出现处理其他事件的机会。不能仅凭肉眼看到空隙就断言某个具体 Fiber 被抢占，必要时结合 React DevTools 的组件分析定位是哪棵子树执行。'),
 p('如果要比较数据，记录浏览器版本、设备型号、构建模式、CPU 节流档位、行数和每行迭代。先预热一次，每个模式做相同输入至少五组，保留全部样本，报告中位数及较慢样本，而不是只挑最好一次。开发构建与生产构建分开记录，DevTools 开启本身也可能影响结果。本文不提供未经真实采集的毫秒数或提升比例。'),
 p('React Profiler 适合帮助判断哪些组件参与了提交，但不能把一次提交的 actualDuration 当成完整用户交互时延，更不能据此统计所有被放弃工作的成本。多个组件 render 日志也不能替代提交计数。想测“重算了多少工作”，需要专门的采样或性能分析；不要在组件函数里增加全局计数器后，又假设这仍是完全纯粹、无干扰的性能实验。'),
 {type:'callout',title:'本篇验证口径',text:'配套自动检查验证计算确定性、800 行初始输出和类型构建；浏览器输入响应、桌面与手机图形可读性由站点整合时单独验收。未运行性能采样之前，不标注性能收益。本地测试环境和实际命令见示例 README。'}]),
 section('decision','检查理解，再决定怎样优化',[
p("检查一：初始 query为空，在 transition 模式只输入 a，为什么紧急一轮可能跳过列表？解析：setText 安排紧急状态，setQuery 位于 transition；紧急一轮的 query 仍为空，Results 的 query/count/rounds 三个 props 都与上轮相同，于是 memo 边界有机会跳过父级带来的昂贵工作。之后 transition 更新 query=a，才计算新列表。这里同时需要状态分离和稳定的列表 props。"),
p("检查二：把全部 score 放进 startTransition 回调，为什么输入提交还会等？解析：回调就在事件处理过程中同步执行；计算完成之前，既没有返回浏览器，也没有进入可分段的 Fiber 工作循环。可调度的是后续标记的状态更新，不是把任意同步循环搬成后台线程。正文完整 App 的 blocking 分支可以直接验证这一点。"),

 p('现在可以按原因做选择了。如果事件处理函数本身很长，先减少同步工作、拆任务或考虑 Worker；如果昂贵的结果子树占据紧急更新，分开输入状态和结果状态，检查 memo 边界，再考虑 transition；如果 DOM 数量和布局本身过大，分页、虚拟化和更便宜的布局通常比换一个更新优先级更直接。'),
 p('如果你的页面已经只有很少工作，额外 transition、pending 状态和缓存比较可能只增加理解成本。用户不一定需要每个小动作都有两阶段反馈。另一方面，旧结果允许暂时可见的筛选、图表和页面切换，很适合把紧急反馈与昂贵结果分开。取舍的依据是“用户需要马上看到什么”，而不是“这个 API 看起来更高级”。'),
 p('回答开头的问题：输入框卡，是因为主线程没有及时完成用户需要的反馈。Fiber 把渲染组织成可以保存状态的工作结构，Lane 表达待处理更新的优先级关系，并发工作循环在合适边界让出，提交阶段把完成结果变成可见 DOM。它们让 React 有机会先处理输入，但不会消除同步计算、DOM 变更和绘制的成本。'),
 p('接下来可以亲手做两个修改：先去掉 Results 的 memo，保持其它参数不变，观察紧急渲染是否重新带上列表；再把所有 score 调用搬到 Results 里的一个循环，观察单个组件工作变长后，让出机会有什么变化。不要先写预设结论，先保存 Performance 记录，再用本篇的更新队列、工作单元和提交边界解释你看到的现象。')]),
 ],references:[
 {title:'React 18.3.1：工作循环和提交',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js'},
 {title:'React 18.3.1：Fiber 结构',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js'},
 {title:'React 18.3.1：Hooks 更新队列',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js'},
 {title:'React 18.3.1：Lane 选择',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js'},
 {title:'React 18.3.1：开源版本使用 old reconciler 的开关',url:'https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js'},
 {title:'startTransition 官方说明（当前版本；异步行为不要套用到 React 18）',url:'https://react.dev/reference/react/startTransition'},
 ]
};
