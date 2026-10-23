import type {Article,ArticleBlock,ArticleSection} from '../articleTypes';
const p=(text:string):ArticleBlock=>({type:'paragraph',text});
const ref=(title:string,file:string,lines:string):ArticleBlock=>({type:'reference',title,url:`https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/${file}.old.js#${lines}`});
const c=(purpose:string,code:string,kind:'excerpt'|'pseudocode'|'runnable'='excerpt',language='tsx'):ArticleBlock=>({type:'code',purpose,code,kind,language,filename:language==='bash'?'终端':'App.tsx'});
const s=(id:string,title:string,blocks:ArticleBlock[]):ArticleSection=>({id,title,paragraphs:[],blocks});
const inlineSources:Record<string,ArticleBlock[]>={
  "basic": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberHooks.old.js:724-727",
      "kind": "excerpt",
      "purpose": "完整 basicStateReducer：函数 action 接收上一个计算结果，值 action 直接替换。",
      "code": "function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {\n  // $FlowFixMe: Flow doesn't like mixed types\n  return typeof action === 'function' ? action(state) : action;\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberHooks.old.js L724–L727",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L724-L727",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "types": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberHooks.old.js:124-153",
      "kind": "excerpt",
      "purpose": "Update、UpdateQueue 与 Hook 完整类型定义；中间保留开发告警变量。",
      "code": "export type Update<S, A> = {|\n  lane: Lane,\n  action: A,\n  hasEagerState: boolean,\n  eagerState: S | null,\n  next: Update<S, A>,\n|};\n\nexport type UpdateQueue<S, A> = {|\n  pending: Update<S, A> | null,\n  interleaved: Update<S, A> | null,\n  lanes: Lanes,\n  dispatch: (A => mixed) | null,\n  lastRenderedReducer: ((S, A) => S) | null,\n  lastRenderedState: S | null,\n|};\n\nlet didWarnAboutMismatchedHooksForComponent;\nlet didWarnUncachedGetSnapshot;\nif (__DEV__) {\n  didWarnAboutMismatchedHooksForComponent = new Set();\n}\n\nexport type Hook = {|\n  memoizedState: any,\n  baseState: any,\n  baseQueue: Update<any, any> | null,\n  queue: any,\n  next: Hook | null,\n|};"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberHooks.old.js L124–L153",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L124-L153",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ],
  "merge": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberHooks.old.js:778-814",
      "kind": "excerpt",
      "purpose": "updateReducer 的合并与初始化连续节选；从 current.baseState 开始，pending 接到旧 baseQueue 之后。",
      "code": "  let baseQueue = current.baseQueue;\n\n  // The last pending update that hasn't been processed yet.\n  const pendingQueue = queue.pending;\n  if (pendingQueue !== null) {\n    // We have new updates that haven't been processed yet.\n    // We'll add them to the base queue.\n    if (baseQueue !== null) {\n      // Merge the pending queue and the base queue.\n      const baseFirst = baseQueue.next;\n      const pendingFirst = pendingQueue.next;\n      baseQueue.next = pendingFirst;\n      pendingQueue.next = baseFirst;\n    }\n    if (__DEV__) {\n      if (current.baseQueue !== baseQueue) {\n        // Internal invariant that should never happen, but feasibly could in\n        // the future if we implement resuming, or some form of that.\n        console.error(\n          'Internal error: Expected work-in-progress queue to be a clone. ' +\n            'This is a bug in React.',\n        );\n      }\n    }\n    current.baseQueue = baseQueue = pendingQueue;\n    queue.pending = null;\n  }\n\n  if (baseQueue !== null) {\n    // We have a queue to process.\n    const first = baseQueue.next;\n    let newState = current.baseState;\n\n    let newBaseState = null;\n    let newBaseQueueFirst = null;\n    let newBaseQueueLast = null;\n    let update = first;"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberHooks.old.js L778–L814",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L778-L814",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "skip": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberHooks.old.js:815-841",
      "kind": "excerpt",
      "purpose": "updateReducer 的 do 循环和跳过分支；下一块继续同一个 if/else。",
      "code": "    do {\n      const updateLane = update.lane;\n      if (!isSubsetOfLanes(renderLanes, updateLane)) {\n        // Priority is insufficient. Skip this update. If this is the first\n        // skipped update, the previous update/state is the new base\n        // update/state.\n        const clone: Update<S, A> = {\n          lane: updateLane,\n          action: update.action,\n          hasEagerState: update.hasEagerState,\n          eagerState: update.eagerState,\n          next: (null: any),\n        };\n        if (newBaseQueueLast === null) {\n          newBaseQueueFirst = newBaseQueueLast = clone;\n          newBaseState = newState;\n        } else {\n          newBaseQueueLast = newBaseQueueLast.next = clone;\n        }\n        // Update the remaining priority in the queue.\n        // TODO: Don't need to accumulate this. Instead, we can remove\n        // renderLanes from the original lanes.\n        currentlyRenderingFiber.lanes = mergeLanes(\n          currentlyRenderingFiber.lanes,\n          updateLane,\n        );\n        markSkippedUpdateLanes(updateLane);"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberHooks.old.js L815–L841",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L815-L841",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ],
  "apply": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberHooks.old.js:842-890",
      "kind": "excerpt",
      "purpose": "同一循环的可处理分支、队列闭合和 Hook 写回；对应上一块的 else。",
      "code": "      } else {\n        // This update does have sufficient priority.\n\n        if (newBaseQueueLast !== null) {\n          const clone: Update<S, A> = {\n            // This update is going to be committed so we never want uncommit\n            // it. Using NoLane works because 0 is a subset of all bitmasks, so\n            // this will never be skipped by the check above.\n            lane: NoLane,\n            action: update.action,\n            hasEagerState: update.hasEagerState,\n            eagerState: update.eagerState,\n            next: (null: any),\n          };\n          newBaseQueueLast = newBaseQueueLast.next = clone;\n        }\n\n        // Process this update.\n        if (update.hasEagerState) {\n          // If this update is a state update (not a reducer) and was processed eagerly,\n          // we can use the eagerly computed state\n          newState = ((update.eagerState: any): S);\n        } else {\n          const action = update.action;\n          newState = reducer(newState, action);\n        }\n      }\n      update = update.next;\n    } while (update !== null && update !== first);\n\n    if (newBaseQueueLast === null) {\n      newBaseState = newState;\n    } else {\n      newBaseQueueLast.next = (newBaseQueueFirst: any);\n    }\n\n    // Mark that the fiber performed work, but only if the new state is\n    // different from the current state.\n    if (!is(newState, hook.memoizedState)) {\n      markWorkInProgressReceivedUpdate();\n    }\n\n    hook.memoizedState = newState;\n    hook.baseState = newBaseState;\n    hook.baseQueue = newBaseQueueLast;\n\n    queue.lastRenderedState = newState;\n  }\n"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberHooks.old.js L842–L890",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L842-L890",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ],
  "eager": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberHooks.old.js:2233-2318",
      "kind": "excerpt",
      "purpose": "完整 dispatchSetState：从创建 Update 到 render-phase、eager 快速退出与普通根调度。",
      "code": "function dispatchSetState<S, A>(\n  fiber: Fiber,\n  queue: UpdateQueue<S, A>,\n  action: A,\n) {\n  if (__DEV__) {\n    if (typeof arguments[3] === 'function') {\n      console.error(\n        \"State updates from the useState() and useReducer() Hooks don't support the \" +\n          'second callback argument. To execute a side effect after ' +\n          'rendering, declare it in the component body with useEffect().',\n      );\n    }\n  }\n\n  const lane = requestUpdateLane(fiber);\n\n  const update: Update<S, A> = {\n    lane,\n    action,\n    hasEagerState: false,\n    eagerState: null,\n    next: (null: any),\n  };\n\n  if (isRenderPhaseUpdate(fiber)) {\n    enqueueRenderPhaseUpdate(queue, update);\n  } else {\n    const alternate = fiber.alternate;\n    if (\n      fiber.lanes === NoLanes &&\n      (alternate === null || alternate.lanes === NoLanes)\n    ) {\n      // The queue is currently empty, which means we can eagerly compute the\n      // next state before entering the render phase. If the new state is the\n      // same as the current state, we may be able to bail out entirely.\n      const lastRenderedReducer = queue.lastRenderedReducer;\n      if (lastRenderedReducer !== null) {\n        let prevDispatcher;\n        if (__DEV__) {\n          prevDispatcher = ReactCurrentDispatcher.current;\n          ReactCurrentDispatcher.current = InvalidNestedHooksDispatcherOnUpdateInDEV;\n        }\n        try {\n          const currentState: S = (queue.lastRenderedState: any);\n          const eagerState = lastRenderedReducer(currentState, action);\n          // Stash the eagerly computed state, and the reducer used to compute\n          // it, on the update object. If the reducer hasn't changed by the\n          // time we enter the render phase, then the eager state can be used\n          // without calling the reducer again.\n          update.hasEagerState = true;\n          update.eagerState = eagerState;\n          if (is(eagerState, currentState)) {\n            // Fast path. We can bail out without scheduling React to re-render.\n            // It's still possible that we'll need to rebase this update later,\n            // if the component re-renders for a different reason and by that\n            // time the reducer has changed.\n            // TODO: Do we still need to entangle transitions in this case?\n            enqueueConcurrentHookUpdateAndEagerlyBailout(\n              fiber,\n              queue,\n              update,\n              lane,\n            );\n            return;\n          }\n        } catch (error) {\n          // Suppress the error. It will throw again in the render phase.\n        } finally {\n          if (__DEV__) {\n            ReactCurrentDispatcher.current = prevDispatcher;\n          }\n        }\n      }\n    }\n\n    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);\n    if (root !== null) {\n      const eventTime = requestEventTime();\n      scheduleUpdateOnFiber(root, fiber, lane, eventTime);\n      entangleTransitionUpdate(root, queue, lane);\n    }\n  }\n\n  markUpdateInDevTools(fiber, lane, action);\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberHooks.old.js L2233–L2318",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L2233-L2318",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "enqueue": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberConcurrentUpdates.old.js:34-111",
      "kind": "excerpt",
      "purpose": "队列登记、interleaved 转 pending、普通入队和 eager-bailout 入队的完整连续函数。",
      "code": "export function pushConcurrentUpdateQueue(\n  queue: HookQueue<any, any> | ClassQueue<any>,\n) {\n  if (concurrentQueues === null) {\n    concurrentQueues = [queue];\n  } else {\n    concurrentQueues.push(queue);\n  }\n}\n\nexport function finishQueueingConcurrentUpdates() {\n  // Transfer the interleaved updates onto the main queue. Each queue has a\n  // `pending` field and an `interleaved` field. When they are not null, they\n  // point to the last node in a circular linked list. We need to append the\n  // interleaved list to the end of the pending list by joining them into a\n  // single, circular list.\n  if (concurrentQueues !== null) {\n    for (let i = 0; i < concurrentQueues.length; i++) {\n      const queue = concurrentQueues[i];\n      const lastInterleavedUpdate = queue.interleaved;\n      if (lastInterleavedUpdate !== null) {\n        queue.interleaved = null;\n        const firstInterleavedUpdate = lastInterleavedUpdate.next;\n        const lastPendingUpdate = queue.pending;\n        if (lastPendingUpdate !== null) {\n          const firstPendingUpdate = lastPendingUpdate.next;\n          lastPendingUpdate.next = (firstInterleavedUpdate: any);\n          lastInterleavedUpdate.next = (firstPendingUpdate: any);\n        }\n        queue.pending = (lastInterleavedUpdate: any);\n      }\n    }\n    concurrentQueues = null;\n  }\n}\n\nexport function enqueueConcurrentHookUpdate<S, A>(\n  fiber: Fiber,\n  queue: HookQueue<S, A>,\n  update: HookUpdate<S, A>,\n  lane: Lane,\n) {\n  const interleaved = queue.interleaved;\n  if (interleaved === null) {\n    // This is the first update. Create a circular list.\n    update.next = update;\n    // At the end of the current render, this queue's interleaved updates will\n    // be transferred to the pending queue.\n    pushConcurrentUpdateQueue(queue);\n  } else {\n    update.next = interleaved.next;\n    interleaved.next = update;\n  }\n  queue.interleaved = update;\n\n  return markUpdateLaneFromFiberToRoot(fiber, lane);\n}\n\nexport function enqueueConcurrentHookUpdateAndEagerlyBailout<S, A>(\n  fiber: Fiber,\n  queue: HookQueue<S, A>,\n  update: HookUpdate<S, A>,\n  lane: Lane,\n): void {\n  const interleaved = queue.interleaved;\n  if (interleaved === null) {\n    // This is the first update. Create a circular list.\n    update.next = update;\n    // At the end of the current render, this queue's interleaved updates will\n    // be transferred to the pending queue.\n    pushConcurrentUpdateQueue(queue);\n  } else {\n    update.next = interleaved.next;\n    interleaved.next = update;\n  }\n  queue.interleaved = update;\n}\n"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberConcurrentUpdates.old.js L34–L111",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberConcurrentUpdates.old.js#L34-L111",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ]
};
export const reactHooksQueueArticle:Article={
id:'react-hooks-queue',topic:'react',title:'React Hooks 更新队列：环形链表、跳过与重放',description:'从连续 setState 和一次跨优先级更新出发，区分 Hook 链表、环形更新队列与 baseQueue，推导跳过、重放和 eager bailout 的边界。',minutes:43,labMinutes:25,tags:['React 18.3.1','Hooks','更新队列','Rebase','源码'],kind:'tutorial',status:'review',versions:['React / React DOM 18.3.1','TypeScript 5.7.2','Node.js 22'],verifiedAt:'2026-10-23',scope:'聚焦客户端 createRoot 下 useState/useReducer 的状态队列。固定 old reconciler；不展开 Effect 队列、Suspense、类组件队列或新版 React 行为。教学模型只解释顺序，不实现 React 调度器。',prerequisites:['会使用 useState 和函数式更新','了解组件每次执行拿到状态快照','知道 transition 可标记非紧急更新'],questionIds:[],experiment:'react',examples:[{label:'源码证据与验证记录',path:'react-hooks-queue/VERIFICATION.md'},{label:'Hooks 更新队列实验与模型',path:'react-hooks-queue.zip'}],
sections:[
s('problem','更新队列是什么，它为什么需要保留历史',[
p("Hooks 更新队列是 React 为一个状态 Hook 保存待计算操作的数据结构。每次调用 setter，会交入一个 action：它可以直接替换状态，也可以根据前一个状态计算新状态。渲染时，React 根据本轮允许处理的 Lane 消费这些操作，得到这轮状态。本文研究的是“已经选好本轮工作之后，状态怎么算”，不重复七篇主线中的事件、Effect 与根调度。"),
p("它比普通先进先出队列多承担一项职责：当一部分操作必须延后，既让紧急操作先得到结果，又保存之后按原始顺序重算所需的信息。Hook 链表负责找到状态槽位，更新环负责记录操作，baseState 和 baseQueue 负责保存重算的起点与后续操作。先认识三者，再用一个计数器逐轮验证。"),

p('一个计数器初始是 1。你先安排加十，再安排乘二，数学上应该得到 22。但如果加十属于暂时可以延后的更新，而乘二必须立即响应，React 会先算出什么？如果先显示 2，后面直接补一个加十就得到 12，顺序已经被改坏了。调度可以让某项工作晚一点执行，却不能随意改变状态更新的含义。'),
p('这正是更新队列值得单独读一篇的原因。它不只是把几个 setter 收进数组，等空闲时挨个执行。它还要记住哪些操作暂时没算、应该从哪个旧状态重新开始，以及已经参与过计算的操作为什么可能还得留在队列里。我们沿着同一个计数器走，最后解释清楚 1、2、22 分别来自哪里。'),
p('本文分开两个观察窗口：上半部分运行真正的 React 18.3.1；下半部分运行可以逐轮点击的教学模型。模型把 Lane 简化成 1 和 2，并把选择时机交给按钮，不会伪装成 React 内部调试器。你可以用它验证计算规则，再对照固定版本源码判断真实框架多做了什么。'),
{type:'experiment',id:'react-hooks-queue',title:'打开 Hooks 更新队列实验',description:'上方观察真实 React 的最终状态；下方逐轮观察基础状态、保留队列与重放。每组真实实验先点“重置为 1”。'},
p('源码引用全部固定到 v18.3.1 的 .old.js 文件。React 仓库在这一版本同时有新旧实现文件，混着读很容易把不同版本的数据结构拼成一个不存在的实现。尤其要留意 interleaved：本文会指出它，不能把其它版本的并发入队流程直接套过来。')]),
s('snapshot','先走通普通路径：同一优先级的操作按序计算',[
c('两个按钮只改变 action 的形态。每组先重置为 1，再单独点击。',`// 当前这次渲染中，n 是 1。
setN(n + 1);
setN(n + 1);
setN(n + 1); // 三次都把值 2 交给队列。

// 另一次实验，从 1 开始。
setN(x => x + 1);
setN(x => x + 1);
setN(x => x + 1); // 依次用上一个计算结果，最终为 4。`),
p('setN(n + 1) 里的加法是你的 JavaScript 现在执行的。当前事件函数闭包中的 n 没有因为前一个 setter 而变成新值，所以交出去的是三个 2，不是“以后再加一”的三个指令。React 处理这组三个替换值，最终仍然是 2。它并没有丢掉两次点击，也不是批处理把三条记录简单压成了一条。'),
p('函数式更新交出去的是如何从前一个状态得到下一个状态。处理时第一条把 1 变成 2，第二条接着把 2 变成 3，第三条得到 4。useState 使用的 basicStateReducer 在这一版本做的核心选择就是：action 是函数便用旧状态调用它，否则把 action 当成下一状态。这个区别比“setter 是异步的”更能解释结果。'),
...inlineSources.basic,
p('顺序同样重要。先函数加一，再替换为 2，结果是 2；先替换为 2，再函数加一，结果是 3。只有当下一状态依赖队列中前一个状态时才需要函数式写法；直接保存输入框当前值，用替换值就很自然。函数式更新不是让代码“更异步”，而是准确表达状态依赖。'),
p('更新函数必须保持纯粹，不要在里面发请求、写日志作为业务记录或递增外部计数器。它可能在提前计算、正常渲染或重放时执行，开发环境也可能为了检查纯度额外调用。一次用户动作对应一次业务副作用，应该在事件边界或明确的业务流程里记录，不能把 updater 调用次数当成动作次数。')]),
s('structures','先分清两条链：哪一个 Hook，哪一次更新',[
{type:'figure',src:'figures/react-hooks-queue/structures.svg',title:'Hook 链表负责位置，更新环负责这个状态的操作',alt:'Fiber memoizedState 指向 Hook A，再经 next 指向 Hook B。Hook A 的 queue 指向一条更新环，尾指针指向 U2，U2.next 指回 U1，U1.next 指向 U2。',caption:'结构简图。图中 queue.pending 表示转入 pending 后的更新；普通并发入队还会先经过 interleaved。Hook 的 next 与 Update 的 next 不是同一条链。'},
p('函数组件调用了两个 useState，React 需要知道这次读的是哪一份状态。Fiber 的 memoizedState 指向 Hook 链表，Hook 的 next 连接下一个 Hook。挂载时按调用顺序创建，更新时按对应顺序取出或复制。这里保存的是“这个组件的状态槽位”，不是用户点了几次按钮。条件性地多调用或少调用 Hook，会打乱对应关系。'),
p('一个状态 Hook 又保存自己的 queue。queue 里的 Update 才表示一次 setter 提交的 action 和 lane。于是两个同名 next 含义完全不同：Hook.next 走向下一个状态槽位；Update.next 走向同一状态的下一条更新。不要因为两者都像链表，就说 React 把所有 useState 更新混到一条全局队列。'),
...inlineSources.types,
ref('按顺序挂载与复制 Hook', 'ReactFiberHooks','L635-L715'),
{type:'table',headers:['位置','本篇需要读懂的字段','解决的问题'],rows:[['Fiber','memoizedState','从组件找到 Hook 链表入口'],['Hook','memoizedState / baseState / baseQueue / queue / next','本轮结果、重算起点、待重放操作、共享队列及下个 Hook'],['UpdateQueue','pending / interleaved / lastRenderedState / lastRenderedReducer','接收新更新与提前计算的依据'],['Update','action / lane / next / hasEagerState / eagerState','更新做什么、什么时候参与、怎样连接及是否已有提前结果']]},
p('名字还会误导一次：Fiber.updateQueue 对函数组件可以承载 Effect 等信息，并不是这里每个状态 Hook 的 queue。本文讨论状态队列，不把 Effect 环或类组件更新队列拉来混称。看源码先确认变量属于哪一种对象，比一口气背下所有字段有用。')]),
s('circular','为什么 pending 指向尾巴，却能按先后顺序读',[
p('这一版本的 pending 和 interleaved 非空时指向环形链表的最后一条记录。尾巴的 next 指向最早的一条。只有一条时，它的 next 指向自己。添加新记录时，把新记录接在旧尾巴后面，再让新尾巴指回原来的第一条；队列指针移到新尾巴即可，不必从头遍历寻找末尾。'),
c('可运行教学函数的节选：只演示环形尾指针，不包含并发队列登记。',`export function append(tail: Ring | null, update: Update): Ring {
  const node = {update} as Ring;
  node.next = tail ? tail.next : node;
  if (tail) tail.next = node;
  return node;
}`),
p('如果原来是 U1 → U2 → U1，尾指针是 U2，再加入 U3 后应成为 U1 → U2 → U3 → U1，尾指针变成 U3。遍历从 tail.next 开始，在回到起点时停止。如果误从 tail 开始，最后插入的操作就跑到第一位了；对于加十和乘二这样的非交换操作，错误会直接改变结果。'),
p('不过，上面的函数不能叫“React 18 的 dispatchSetState 实现”。在我们固定的版本里，普通非 render-phase 路径调用 enqueueConcurrentHookUpdate，更新先接到 queue.interleaved。finishQueueingConcurrentUpdates 再把 interleaved 接到 pending 后面，并清空 interleaved。这样处理并发渲染过程中收到的更新，不是每次 setter 都直接改 pending。'),
...inlineSources.enqueue,
p('之后 updateReducer 会把新的 pending 环接到已有 baseQueue 后面，再清空 pending。两个尾指针都知道各自的头，因此接合时交换相关 next 连接就能保留“旧待重放操作在前、新到操作在后”的顺序。链表的好处是这一步不需要复制整个数组；代价是指针操作更容易读错，也需要分清当前树和工作树共用、复制的部分。'),
...inlineSources.merge,
p('教学程序用环验证插入顺序，随后转换成数组实现重放，故意把两个难点拆开。它没有模拟 interleaved 的生命周期、根调度、错误重试或 Fiber 树，不能拿模型的内部形态当作源码截图。')]),
s('first-pass','第一轮：跳过加十，先算乘二',[
c('真实 React 按钮的核心路径；跨优先级但保持入队顺序。',`// 开始前 n = 1；这两条更新属于同一个状态 Hook。
startTransition(() => setN(x => x + 10));
setN(x => x * 2);`),
p('transition 回调同步执行，所以加十先入队。随后事件中的乘二属于更紧急的更新。这一轮选出的 renderLanes 如果不包含加十的 lane，React 暂时跳过它，但仍能处理乘二。计算从基础状态 1 开始，本轮结果是 2。这里说的是一轮状态计算；小例子很快，浏览器未必把中间的 2 单独绘制给你看。'),
p('跳过不等于删除。第一次遇到被跳过的更新时，需要保存当时的计算结果作为新的 baseState。在本例中第一次就是加十，因此 baseState 仍是 1。被跳过的加十会被复制进新的 baseQueue，保留它的 lane。以后哪轮允许处理它，就有位置可找，也有正确起点可用。'),
p('接着处理乘二时，前面已经出现过跳过项。React 不仅算出 2，还要把乘二也复制进保留队列，但将副本的 lane 设成 NoLane。这一步最容易被误删：乘二明明做过，为什么还要留？因为以后从 1 重新接上加十时，仍然需要按原顺序再乘二，否则只能得到 11。'),
...inlineSources.skip,
{type:'figure',src:'figures/react-hooks-queue/rebase.svg',title:'显示值 2 与重放起点 1 可以同时存在',alt:'初始基础值1，队列为低优先级加10后紧急乘2。紧急轮跳过加10，显示2，但保留基础值1及加10原lane、乘2的NoLane副本。延后轮从1开始，加10得到11，再乘2得到22，队列清空。',caption:'两轮计算的顺序示意，不表示两次浏览器绘制。NoLane 的副本表示之后重放时不可再被优先级筛掉，不是让用户再点击一次。'},
p('memoizedState 和 baseState 因而可能不同。前者是这轮计算出的状态；后者是在还有跳过项时，为后续重放留下的起点。把它们都解释成“当前 state”，下一轮就很容易从 2 开始，算出错误结果。')]),
s('rebase','第二轮：为什么是 22，而不是 12 或 44',[
...inlineSources.apply,
p("把两个源码片段接着看：第一轮 renderLanes 只有紧急位，+10 进入上节的跳过分支；×2 进入这里的 else，因为 newBaseQueueLast 已非空，先追加 lane=NoLane 的副本，再把 newState 从 1 算成 2。循环结束，newBaseQueueLast.next 指回新队列头，hook.memoizedState 写入 2，hook.baseState 写入 1，hook.baseQueue 指向乘二副本这个尾节点。显示状态与重算起点由不同字段保存，信息并未相互覆盖。"),

p('允许处理延后更新时，从保留下来的 baseState=1 出发。先执行加十得到 11，再执行乘二得到 22。NoLane 在这个实现里是零位集合，子集检查不会把它排除；它不是新的一档低优先级，而是让已经处理过的后续操作在重放时继续参与。队列中没有再被跳过的项时，新 baseState 可以前进到 22，baseQueue 清空。'),
p('如果从可见的 2 开始只补加十，会得到 12，改变了原本的顺序。如果从 2 开始把完整队列再执行一次，会得到 24，同样不对。如果不理解“重新计算”而直接在已经显示的结果上又乘一次，还可能算出 44。正确性同时依赖两个条件：回到首个跳过之前的基础状态，并保留从那里开始的有序更新。'),
c('教学模型关键分支。完整函数有 trace 输出和返回值，可在实验室逐轮查看。',`if ((renderLanes & update.lane) !== update.lane) {
  if (!skipped) newBaseState = state;
  skipped = true;
  retained.push({...update});
} else {
  if (skipped) retained.push({...update, lane: 0});
  state = update.apply(state);
}`),
p('换一个顺序检查自己有没有真的理解：初始 1，紧急乘二、延后加十、紧急乘二。紧急轮结果是 4，但新的 baseState 应该是第一次乘二后的 2。保留队列只有加十和后面的乘二副本，下一轮是 (2+10)×2=24。若总把最初的 1 当基础状态，这组实验就会失败。配套测试专门覆盖了这一点。'),
p('纯函数使得重放有意义。对相同输入，更新函数要能给出一致输出；如果乘二里顺手改了模块变量，重放一次就多改一次，状态队列无法替你撤销外部影响。React 保证状态更新的计算语义，不保证任意混进来的副作用只执行一次。'),
p('模型的 lane=1、2 只是两组位，真实 Lane 有更多类别、过期和纠缠等安排。本文用模型解释选定 renderLanes 后怎样计算，不推导根为什么恰好选择这一组；后一个问题应该回到调度文章。')]),
s('eager','相同值为什么有时连调度都省了',[
p("普通路径理解以后，再看一个提前结束的分支：当节点没有待处理工作时，useState 的 dispatch 可以先计算下一状态。若结果与上轮相同，这次更新就可能省去根调度。这个优化称为 eager bailout；先检查条件，再解释按钮现象。"),
p('在 dispatchSetState 的非 render-phase 分支，源码先检查 fiber.lanes 为空，而且 alternate 不存在或 lanes 也为空，再确认 lastRenderedReducer 可用，才尝试根据 lastRenderedState 提前算出下一状态。这叫 eager state：本来可能要等渲染时才能算的结果，在这条快速路径先算一下。比较使用 Object.is 语义，并非 JSON 序列化或对象字段深比较。'),
...inlineSources.eager,
p('若提前结果相等，React 调用专门的 eagerly-bailout 入队函数，然后返回，不为这次更新安排普通的根调度。这并不是把更新对象彻底扔掉：它仍留在队列路径里，因为以后其它更新可能使它参与重放。若此前还有待处理工作，或者不满足快速路径条件，就不能用“相同值必然在 setter 处退出”解释所有情况。'),
p('还要区分 useState 与 useReducer。本文引用的提前计算逻辑在 dispatchSetState；这一版本 dispatchReducerAction 的普通路径直接入队并调度，没有照搬这个 eager 分支。它们之后都可以经由 updateReducer 处理队列，不意味着两个 dispatch 函数完全一样。把观察到的 useState 快速退出扩大成“所有 Hook setter 都一样”，是读源码时很常见的跨层误推。'),
ref('对比 useReducer 的 dispatchReducerAction', 'ReactFiberHooks','L2194-L2231'),
p('修改一个对象的字段再 set 同一个对象，是相同引用导致错误结果的典型反例。Object.is 仍然相等，UI 可能保持旧样子；更糟的是你已经改坏了其它闭包读到的旧状态。正确做法是创建表示新状态的新对象，同时保留未改部分的引用，而不是为了绕过 bailout 随便塞一个随机字段。'),
c('失败与修正：不要把更新队列当作变更检测器。',`// 错误：修改旧快照，引用没变。
state.count += 1;
setState(state);

// 修正：从队列提供的前一个状态计算新对象。
setState(previous => ({...previous, count: previous.count + 1}));`),
p('例子里的提交日志放在 useLayoutEffect，依赖 n 和 pending。它没有出现，只能说明这个观察点没有再次运行，不能证明组件函数一次也没执行。eager 路径的结论来自固定源码条件；按钮仅帮助你看到“不发生可见变化”这个外部现象。')]),
s('validation','完整模型与带解析的检查',[
{"type": "code", "language": "tsx", "filename": "examples/react-hooks-queue/App.tsx · 类型与全部模型函数", "kind": "excerpt", "purpose": "从原项目逐字提取。包含 append、entries、rebase 的全部依赖；后续 JSX 面板和真实 React 按钮未在此块展示。用它即可在纸上推导两轮结果。", "code": "import React, {useState, useTransition, useLayoutEffect} from 'react';\n// 教学模型：显式指定 lane，无 Scheduler、Fiber、eager state 或异常恢复。\nexport type Update={label:string;lane:0|1|2;apply:(n:number)=>number};\nexport type Ring={update:Update;next:Ring};\nexport function append(tail:Ring|null,update:Update):Ring {\n  const node={update} as Ring;node.next=tail?tail.next:node;\n  if(tail)tail.next=node;return node;\n}\nexport function entries(tail:Ring|null):Update[]{\n  if(!tail)return [];const result:Update[]=[];let node=tail.next;\n  do{result.push(node.update);node=node.next;}while(node!==tail.next);return result;\n}\nexport function rebase(baseState:number,queue:Update[],renderLanes:number){\n  let state=baseState,newBaseState=baseState,skipped=false;\n  const retained:Update[]=[],trace:string[]=[];\n  for(const update of queue){\n    if((renderLanes&update.lane)!==update.lane){\n      if(!skipped)newBaseState=state;\n      skipped=true;retained.push({...update});trace.push(`跳过 ${update.label}；保留原 lane=${update.lane}`);\n    }else{\n      if(skipped)retained.push({...update,lane:0});\n      const before=state;state=update.apply(state);\n      trace.push(`${before} → ${update.label} → ${state}${skipped?'；复制为 lane=0 以便重放':''}`);\n    }\n  }\n  return {state,baseState:skipped?newBaseState:state,queue:retained,trace};\n}\n"},
p("理解检查：输入 [×2(紧急), +10(延后), ×2(紧急)]，初始值 1。第一轮紧急位下输出是什么，baseState 又是什么？解析：先乘二得到 2，首次跳过加十时把 2 保存为基础，最后乘二使本轮显示 4；保留队列是 +10 和最后的 NoLane 乘二。下一轮从 2 算 (2+10)×2=24。若把 baseState 固定为初始 1，就会错误得到 22。"),
p("再检查一个边界：第一轮之后仍只允许紧急位，是否会把显示 2 再乘成 4？解析：从保存的基础 1 开始，+10 再跳过，NoLane 的乘二参与后仍得到 2。重放的是从基础出发的纯计算，不是把所有动作追加到已经显示的值上。"),

c('从仓库根目录安装锁定依赖。浏览器实验不访问网络接口。',`cd examples/react-hooks-queue
npm ci
npm test
npm run build
npm run dev`,'runnable','bash'),
p('访问终端打印的地址。先分别重置并点击两个三次加一按钮，确认 2 与 4。再重置，点击跨优先级按钮，等 pending 结束，确认最终 22。控制台记录提交观察点；在真实 React 部分不要强求肉眼看见 2，也不要把开发工具控制台的记录顺序当成浏览器已完成绘制。'),
p('教学模型第一次点“下一轮”，应显示 state=2、baseState=1，保留 +10[lane2] 与 ×2[lane0]；第二次应显示 22、22 和空队列。模型按钮与真实 React 按钮彼此独立，重置一个不会重置另一个。'),
p('然后做两个有意义的破坏实验：把第一轮的 baseState 错改为本轮显示值，重放会算错；删除已执行操作的 NoLane 副本，最终只能得到 11。运行 npm test，相关断言应失败。实验的目的不是背答案 22，而是看清哪个信息一旦丢掉，就无法维持原始顺序。'),
p('自动测试覆盖环形插入顺序、两轮重放、首个跳过之前已有操作、所有更新可处理、值替换与函数操作、重复跳过。它们测试的是教学模型，不是 React 包的内部单元测试；构建验证只证明源码与类型能通过工具链，不证明某台手机的交互时序。具体已执行结果及未验项目记录在示例 VERIFICATION.md。'),
p('示例只 import React，完整 App.tsx 可在本站实验室运行；独立项目入口使用 createRoot，不包 StrictMode。这里为了观察简洁而省略 StrictMode，不建议业务项目为减少日志把它关掉。源码和测试没有服务端依赖或密钥，离线阅读时仍应区别“已缓存浏览器资源”与“首次 npm ci 需要下载依赖”。')]),
s('takeaway','排查状态问题时，按这四个问题往下走',[
p('先问交给 setter 的究竟是什么：是已经算好的值，还是依赖前一个状态的函数？再问它属于哪个 Hook：是否条件调用、组件身份变化或重挂载，让你读到了另一份状态？接着看操作顺序与优先级：有没有被延后的更新，是否把暂时显示的结果误当作重放基础？最后才检查有没有相同引用、外部副作用或不纯 updater，使快速路径和重放把原有问题暴露出来。'),
p('今天的加十乘二案例说明了一个具体机制：允许部分更新先提交，并不意味着剩下操作可以直接套在最新显示值上。Hook 保留本轮状态和重放起点，更新队列保留被跳过的项及其后的必要副本，后续从正确基础重新计算，才能同时满足响应优先级和原始操作顺序。'),
p('这套结构也有代价：需要保存和复制更新记录，某些计算会重复执行，理解成本高于一个普通变量。因此应用代码应该先把状态表达清楚、让 updater 保持纯粹，而不是手动模仿内部队列。源码知识帮助你解释边界和设计实验，业务代码仍应使用稳定 API。下一步可以给模型增加第三个优先级，先写出每轮 baseState 和保留队列，再运行测试核对；不要靠画最终值猜中间过程。')]),
],references:[{title:'v18.3.1 Hooks 状态、队列与 dispatch',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js'},{title:'v18.3.1 并发更新入队',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberConcurrentUpdates.old.js'}]};
