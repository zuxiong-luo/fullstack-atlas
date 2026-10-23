import type {Article} from '../articleTypes';
export const reactWorkLoopArticle: Article = {
  "id": "react-work-loop-commit",
  "topic": "react",
  "title": "React 工作循环与提交：从处理 Fiber 到应用 DOM 更新",
  "description": "从 render、commit 与浏览器绘制的职责讲起，用真实工作循环源码和完整观测组件，推演一次数值更新、ref 与 Effect 的建立清理。",
  "minutes": 48,
  "labMinutes": 25,
  "tags": [
    "React 18",
    "工作循环",
    "commit",
    "Effect",
    "源码"
  ],
  "kind": "tutorial",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "Node.js 22",
    "TypeScript 5.7.2"
  ],
  "verifiedAt": "2026-10-23",
  "scope": "使用 createRoot 的客户端函数组件更新；不展开 Hydration、Suspense 恢复、错误边界、Offscreen 和 useInsertionEffect 的完整算法。React 内部遍历顺序按 v18.3.1 核对，不把它作为跨版本业务 API。",
  "prerequisites": [
    "理解 useState 与闭包",
    "会使用 ref、useEffect 和 useLayoutEffect",
    "知道 JavaScript 任务结束与浏览器绘制不是同一个时刻"
  ],
  "questionIds": [],
  "experiment": "react",
  "examples": [
    {
      "label": "源码证据与验证记录",
      "path": "react-work-loop-commit/VERIFICATION.md"
    },
    {
      "label": "提交阶段观测实验",
      "path": "react-work-loop-commit.zip"
    }
  ],
  "sections": [
    {
      "id": "question",
      "title": "工作循环、提交、绘制各负责什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "工作循环是 React 在 render 阶段推进 Fiber 计算的内部过程：处理当前节点、进入孩子、完成节点，再去兄弟或回父级。提交是把已经完成的一轮结果应用到宿主环境的阶段；在 React DOM 中包括相应 DOM 变更、ref 与布局工作。绘制则由浏览器把结果呈现成像素。先分清这三个职责，后面每条日志才有归属。"
        },
        {
          "type": "paragraph",
          "text": "本文只沿一个普通更新走：初始 span 显示“数值 0”，点击后状态请求加一，下一轮 Probe 返回“数值 1”，提交更新文本。我们先读这条完整路径，再看替换 key、卸载和布局阻塞的反例。你只需要理解 useState、ref 和 Effect；调度如何挑 Lane 不在这里展开。"
        },
        {
          "type": "experiment",
          "id": "react-work-loop-commit",
          "title": "运行 DOM、ref 与 Effect 时序实验",
          "description": "依次更新数值、替换 key、卸载；开启布局 Effect 阻塞选项观察反例。请查看实验室控制台。"
        },
        {
          "type": "paragraph",
          "text": "版本固定为 React 18.3.1，入口使用 createRoot，不包 StrictMode。React 18.3.1 开源配置使用 old reconciler，因此本文链接 .old.js 文件，而不是看到目录中 .new.js 就默认它更符合运行版本。正式业务应保留适合项目的 StrictMode；这里关闭是为了先观察基本路径，再单独解释开发检查。"
        }
      ]
    },
    {
      "id": "work-unit",
      "title": "工作循环到底在循环什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "从根节点安排好这一轮工作之后，React 需要沿 Fiber 树处理组件。函数组件要执行函数，宿主节点要准备属性变化，子树需要协调身份；这些工作不是一个“把 JSX 一次翻译成 DOM”的黑盒。React 在 workInProgress 中保存当前处理位置，循环把它交给 performUnitOfWork。"
        },
        {
          "type": "paragraph",
          "text": "performUnitOfWork 先拿到当前节点的 alternate，调用 beginWork，处理本节点并判断下一步是否进入子节点。如果 beginWork 给出下一节点，工作指针就移动过去；如果没有新的子工作，进入 completeUnitOfWork，完成当前节点，然后找兄弟或向父级回退。所谓 begin 和 complete 是树遍历中的两个方向，不是一次界面更新的 render 与 commit 两个阶段。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:1831–1857",
          "purpose": "performUnitOfWork 完整函数：beginWork 的返回值如何决定下一位置。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "function performUnitOfWork(unitOfWork: Fiber): void {\n  // The current, flushed, state of this fiber is the alternate. Ideally\n  // nothing should rely on this, but relying on it here means that we don't\n  // need an additional field on the work in progress.\n  const current = unitOfWork.alternate;\n  setCurrentDebugFiberInDEV(unitOfWork);\n\n  let next;\n  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {\n    startProfilerTimer(unitOfWork);\n    next = beginWork(current, unitOfWork, subtreeRenderLanes);\n    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);\n  } else {\n    next = beginWork(current, unitOfWork, subtreeRenderLanes);\n  }\n\n  resetCurrentDebugFiberInDEV();\n  unitOfWork.memoizedProps = unitOfWork.pendingProps;\n  if (next === null) {\n    // If this doesn't spawn new work, complete the current work.\n    completeUnitOfWork(unitOfWork);\n  } else {\n    workInProgress = next;\n  }\n\n  ReactCurrentOwner.current = null;\n}"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:1831–1857（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1831-L1857",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "paragraph",
          "text": "带入 workInProgress=Probe 的工作节点：current 取它的 alternate，beginWork 执行这一轮 Probe，返回要继续处理的 span 工作节点。memoizedProps 更新为刚处理的 pendingProps，next 不为空，因此 workInProgress 移到 span。轮到没有新孩子的节点时，next 为 null，才进入 completeUnitOfWork。组件已经执行到 value=1，只说明这次计算已到达，当前 DOM 文本仍需等提交。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:1859–1890",
          "purpose": "completeUnitOfWork 普通完成分支；后续异常展开与遍历尾部另作说明。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "function completeUnitOfWork(unitOfWork: Fiber): void {\n  // Attempt to complete the current unit of work, then move to the next\n  // sibling. If there are no more siblings, return to the parent fiber.\n  let completedWork = unitOfWork;\n  do {\n    // The current, flushed, state of this fiber is the alternate. Ideally\n    // nothing should rely on this, but relying on it here means that we don't\n    // need an additional field on the work in progress.\n    const current = completedWork.alternate;\n    const returnFiber = completedWork.return;\n\n    // Check if the work completed or if something threw.\n    if ((completedWork.flags & Incomplete) === NoFlags) {\n      setCurrentDebugFiberInDEV(completedWork);\n      let next;\n      if (\n        !enableProfilerTimer ||\n        (completedWork.mode & ProfileMode) === NoMode\n      ) {\n        next = completeWork(current, completedWork, subtreeRenderLanes);\n      } else {\n        startProfilerTimer(completedWork);\n        next = completeWork(current, completedWork, subtreeRenderLanes);\n        // Update render duration assuming we didn't error.\n        stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);\n      }\n      resetCurrentDebugFiberInDEV();\n\n      if (next !== null) {\n        // Completing this fiber spawned new work. Work on that next.\n        workInProgress = next;\n        return;"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:1859–1890（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1859-L1890",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:1939–1956",
          "purpose": "completeUnitOfWork 的兄弟和回父级尾部；中间异常 unwind 分支未展示。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "\n    const siblingFiber = completedWork.sibling;\n    if (siblingFiber !== null) {\n      // If there is more work to do in this returnFiber, do that next.\n      workInProgress = siblingFiber;\n      return;\n    }\n    // Otherwise, return to the parent\n    completedWork = returnFiber;\n    // Update the next thing we're working on in case something throws.\n    workInProgress = completedWork;\n  } while (completedWork !== null);\n\n  // We've reached the root.\n  if (workInProgressRootExitStatus === RootInProgress) {\n    workInProgressRootExitStatus = RootCompleted;\n  }\n}"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:1939–1956（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1939-L1956",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "paragraph",
          "text": "这里显示普通完成分支和遍历尾部，中间 1891–1938 的异常 unwind 分支未贴出；出现异常时会展开或重试，不能按本段无异常序列推演。对本例的 span，completeWork 返回 null，尾部先找 sibling。没有兄弟就令 completedWork=returnFiber，回到 Probe 再完成。若换成两个兄弟 span，第一支完成后先转去第二支，等两支都完成才回父级。"
        },
        {
          "type": "reference",
          "title": "performUnitOfWork：beginWork 返回值决定下一步",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1831"
        },
        {
          "type": "reference",
          "title": "completeUnitOfWork：完成、兄弟节点与向父级回退",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1859"
        },
        {
          "type": "figure",
          "src": "figures/react-work-loop-commit/traversal.svg",
          "title": "向下处理与向上完成都属于 render",
          "alt": "App 向下进入 Probe，再进入 span。span 完成后回到 Probe，再完成 App。整段位于 render 区域；之后才进入 commit。",
          "caption": "省略 HostRoot、文本节点和 bailout 的教学简图；completeWork 不是 commit。"
        },
        {
          "type": "paragraph",
          "text": "为什么要把完成过程单独说清？因为最常见的误读是看到 completeWork 就以为节点已经展示到页面。实际上，挂载路径可能在 render 阶段创建尚未接入页面的宿主实例，更新路径则准备提交所需的信息；“创建一个 DOM 对象”和“把它插入当前可见文档”不是一回事。render 不应对已提交界面做任意的可见修改，这才是允许放弃工作的重要前提。"
        },
        {
          "type": "reference",
          "title": "completeWork 的 HostComponent 挂载：创建宿主实例",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCompleteWork.old.js#L1010"
        },
        {
          "type": "reference",
          "title": "bubbleProperties：汇集子树标记",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCompleteWork.old.js#L642"
        },
        {
          "type": "paragraph",
          "text": "完成时还需要汇集子树的标记，让提交遍历知道哪里有变化。flags 表示本节点的工作，subtreeFlags 概括子树中的相关工作。它们让 React 可以跳过没有对应提交工作的分支，而不是每次都盲目修改每一个节点。这里的 Effect 标记并不专指 useEffect；DOM 放置、更新、ref 等也有相关标记，读源码时要看具体上下文。"
        }
      ]
    },
    {
      "id": "yield",
      "title": "可中断的准确边界在哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "workLoopSync 持续处理工作，直到没有 workInProgress；workLoopConcurrent 除了检查还有没有工作，还会询问 shouldYield。后者在工作单元之间决定是否返回，把执行机会交还给宿主。把执行位置保存下来，才有之后继续或重新协调工作的可能。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:1736–1741",
          "purpose": "同步循环完整函数：处理直到没有待处理位置。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "function workLoopSync() {\n  // Already timed out, so perform work without checking if we need to yield.\n  while (workInProgress !== null) {\n    performUnitOfWork(workInProgress);\n  }\n}"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:1736–1741（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1736-L1741",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:1824–1829",
          "purpose": "并发循环完整函数：每次处理下一工作单元前检查 shouldYield。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "function workLoopConcurrent() {\n  // Perform work until Scheduler asks us to yield\n  while (workInProgress !== null && !shouldYield()) {\n    performUnitOfWork(workInProgress);\n  }\n}"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:1824–1829（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1824-L1829",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "paragraph",
          "text": "若开始时 workInProgress 是 Probe 且 shouldYield 为 false，进入 performUnitOfWork，Probe 必须先执行返回；下一次 while 再检查。若此时 shouldYield 为 true，退出循环，保留当前位置供后续处理。若进入的是 workLoopSync，则不会检查 shouldYield。两段代码解释了让出的确切边界，也解释为何组件中的一个长循环仍会堵住主线程。"
        },
        {
          "type": "reference",
          "title": "workLoopSync 与 renderRootConcurrent 的入口",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1736"
        },
        {
          "type": "reference",
          "title": "workLoopConcurrent：在处理下一单元之前检查让出",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1824"
        },
        {
          "type": "paragraph",
          "text": "但 JavaScript 不是在函数任意一行被 React 暂停的。performUnitOfWork 内部调用的组件函数要返回，React 才有机会继续到相应检查点；completeUnitOfWork 自己也可能连续向上完成多个节点。不能把“每个 Fiber 都能让出”理解成每个节点的每一步都自带抢占点。一个组件内部的大循环依然能阻塞主线程。"
        },
        {
          "type": "paragraph",
          "text": "使用 createRoot 也不意味着每轮都走并发工作循环。performConcurrentWorkOnRoot 会结合阻塞 Lane、过期状态和回调是否超时等条件选择并发或同步 render 路径。函数名含 Concurrent，不代表里面所有执行都可中断。应当读它选择 renderRootConcurrent 还是 renderRootSync 的条件，而不是根据名字作结论。"
        },
        {
          "type": "reference",
          "title": "performConcurrentWorkOnRoot：shouldTimeSlice 的条件",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L824"
        },
        {
          "type": "paragraph",
          "text": "被让出的 render 可能继续，也可能因为更高优先级更新或其他条件重新计算。因此 render 日志只证明“尝试执行过”，不证明该次结果提交了。实验里的日志刻意放在组件执行中做诊断，它本身属于观测副作用；业务逻辑不能依赖日志计数，更不能在那里发订单、修改订阅或操作 DOM。"
        }
      ]
    },
    {
      "id": "commit-entry",
      "title": "到达提交入口，还要先处理哪些事情",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一轮 render 完成之后，根上会有 finishedWork 和对应的完成信息。commitRootImpl 消费这份结果，但它开头并不是立刻改 DOM：它先刷新已有的待处理 passive Effects，直到相关待处理状态清空。这提醒我们，一条控制台日志的来源可能是上一轮提交，不能因为它靠近本轮日志就给它贴上本轮标签。"
        },
        {
          "type": "reference",
          "title": "commitRootImpl 入口：刷新已有 passive Effects，再读取 finishedWork",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1985"
        },
        {
          "type": "paragraph",
          "text": "真正进入主要提交过程时，可以按 before-mutation、mutation、layout 三段理解。before-mutation 是读取变更前信息的机会，典型源码路径包括类组件的 snapshot；它不是 useEffect 的执行位置。mutation 处理宿主树变化、相关 ref 拆除和布局 Effect 的清理；layout 则在变更后运行相应布局工作。这里只解释常见路径，删除子树、Portal、Suspense 等分支不能凭这三句话推断所有细节。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:2130–2178",
          "purpose": "主要提交顺序的连续节选：before mutation、mutation、current 切换与 layout。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "\n    // The first phase a \"before mutation\" phase. We use this phase to read the\n    // state of the host tree right before we mutate it. This is where\n    // getSnapshotBeforeUpdate is called.\n    const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(\n      root,\n      finishedWork,\n    );\n\n    if (enableProfilerTimer) {\n      // Mark the current commit time to be shared by all Profilers in this\n      // batch. This enables them to be grouped later.\n      recordCommitTime();\n    }\n\n    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {\n      // Track the root here, rather than in commitLayoutEffects(), because of ref setters.\n      // Updates scheduled during ref detachment should also be flagged.\n      rootCommittingMutationOrLayoutEffects = root;\n    }\n\n    // The next phase is the mutation phase, where we mutate the host tree.\n    commitMutationEffects(root, finishedWork, lanes);\n\n    if (enableCreateEventHandleAPI) {\n      if (shouldFireAfterActiveInstanceBlur) {\n        afterActiveInstanceBlur();\n      }\n    }\n    resetAfterCommit(root.containerInfo);\n\n    // The work-in-progress tree is now the current tree. This must come after\n    // the mutation phase, so that the previous tree is still current during\n    // componentWillUnmount, but before the layout phase, so that the finished\n    // work is current during componentDidMount/Update.\n    root.current = finishedWork;\n\n    // The next phase is the layout phase, where we call effects that read\n    // the host tree after it's been mutated. The idiomatic use case for this is\n    // layout, but class component lifecycles also fire here for legacy reasons.\n    if (__DEV__) {\n      if (enableDebugTracing) {\n        logLayoutEffectsStarted(lanes);\n      }\n    }\n    if (enableSchedulingProfiler) {\n      markLayoutEffectsStarted(lanes);\n    }\n    commitLayoutEffects(finishedWork, root, lanes);"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:2130–2178（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2130-L2178",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "table",
          "headers": [
            "本例的时点",
            "当前可读信息",
            "随后动作"
          ],
          "rows": [
            [
              "render 返回新 span 描述",
              "新闭包 value=1；尚未应用宿主变更",
              "完成整轮计算"
            ],
            [
              "mutation 处理子节点",
              "span 文本更新为数值1",
              "父函数组件清理旧布局 Effect"
            ],
            [
              "root.current 切换",
              "完成树成为当前依据",
              "进入 layout"
            ],
            [
              "新的 layout setup",
              "读取 value=1 和数值1的 DOM",
              "按条件刷新 passive，浏览器以后获得绘制机会"
            ]
          ]
        },
        {
          "type": "figure",
          "src": "figures/react-work-loop-commit/commit.svg",
          "title": "提交阶段与 passive 刷新的关系",
          "alt": "render 完成后进入 before mutation、mutation、root.current 切换、layout。passive cleanup 与 setup 在独立刷新入口中处理，可能在当前任务末尾同步刷新，也可能调度后续回调。浏览器 paint 不放在固定的 passive 前后位置。",
          "caption": "顺序图刻意不把 paint 固定画在 useEffect 前面；普通 Effect 的刷新路径需要结合更新类型判断。"
        },
        {
          "type": "paragraph",
          "text": "root.current = finishedWork 位于 mutation 之后、layout 之前。这个位置不是随意安排的：卸载等 mutation 期间仍需要之前的树作为当前树，布局阶段则应以完成后的树为当前树。DOM 已经完成相应变化，布局 Effect 因而可以读取这次提交后的宿主节点。它不意味着用户此刻已经看到了新像素。"
        },
        {
          "type": "reference",
          "title": "mutation → root.current 切换 → layout 的直接调用顺序",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2150"
        },
        {
          "type": "paragraph",
          "text": "主要 DOM 变更和布局 Effect 的提交过程，不会像并发 render 那样在 Fiber 单元之间主动让出。主线程上这段 JavaScript 没返回，浏览器通常就没有机会绘制。因此不要把“commit 不切片”说成“commit 很快”：插入大量节点、昂贵的 ref 回调、布局 Effect 中读取布局并修改样式，都可能让提交很重。"
        }
      ]
    },
    {
      "id": "layout",
      "title": "清理函数看到的旧状态与当前 DOM",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先把实验中的完整代码放在这里，再讨论 cleanup 与 setup。Probe 定义了稳定 ref 回调以及两类 Effect；App 提供数值更新、换 key、卸载和慢布局四种操作。界面样式也一并保留，所以这段与仓库 App.tsx 完全一致。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "配套项目完整组件；已包含输入、操作处理与观测逻辑。正文可直接阅读全部关键路径，main.tsx、HTML 和锁定依赖属于启动环境。",
          "code": "import React, {\n  useCallback,\n  useEffect,\n  useLayoutEffect,\n  useRef,\n  useState,\n} from \"react\";\n// 教学观测：render 日志有意属于诊断副作用，业务 render 不应依赖它。\nfunction trace(phase: string, detail: unknown) {\n  console.log(\"[commit-lab]\", phase, JSON.stringify(detail));\n}\nfunction Probe({ value, slow }: { value: number; slow: boolean }) {\n  const ref = useRef<HTMLSpanElement | null>(null);\n  const attach = useCallback((node: HTMLSpanElement | null) => {\n    ref.current = node;\n    trace(node ? \"ref attach\" : \"ref detach\", {\n      dom: node?.textContent ?? null,\n    });\n  }, []);\n  trace(\"render attempt\", { value });\n  useLayoutEffect(() => {\n    trace(\"layout setup\", { value, dom: ref.current?.textContent ?? null });\n    if (slow) {\n      const until = performance.now() + 40;\n      while (performance.now() < until) {\n        /* 有界反例：阻塞布局Effect */\n      }\n    }\n    return () =>\n      trace(\"layout cleanup\", {\n        capturedValue: value,\n        dom: ref.current?.textContent ?? null,\n      });\n  }, [value, slow]);\n  useEffect(() => {\n    trace(\"passive setup\", { value, dom: ref.current?.textContent ?? null });\n    return () =>\n      trace(\"passive cleanup\", {\n        capturedValue: value,\n        dom: ref.current?.textContent ?? null,\n      });\n  }, [value, slow]);\n  return (\n    <span ref={attach} data-testid=\"value\">\n      数值 {value}\n    </span>\n  );\n}\nexport default function App() {\n  const [value, setValue] = useState(0);\n  const [visible, setVisible] = useState(true);\n  const [identity, setIdentity] = useState(0);\n  const [slow, setSlow] = useState(false);\n  function update() {\n    trace(\"event start\", { value });\n    setValue((v) => v + 1);\n    trace(\"event end\", { value });\n    requestAnimationFrame(() =>\n      trace(\"rAF callback\", { note: \"这是绘制前回调，不是已完成绘制的证据\" }),\n    );\n  }\n  return (\n    <main\n      style={{\n        padding: 24,\n        fontFamily: \"system-ui\",\n        lineHeight: 1.7,\n        maxWidth: 760,\n        margin: \"auto\",\n      }}\n    >\n      <h2>一次更新，哪些工作真的提交了？</h2>\n      <p>\n        打开控制台，依次尝试更新、替换身份、卸载。日志是教学诊断，render\n        次数不代表提交次数。\n      </p>\n      <div style={{ display: \"flex\", gap: 10, flexWrap: \"wrap\" }}>\n        <button onClick={update}>更新数值</button>\n        <button onClick={() => setIdentity((k) => k + 1)}>替换 key</button>\n        <button onClick={() => setVisible((v) => !v)}>\n          {visible ? \"卸载\" : \"挂载\"}\n        </button>\n      </div>\n      <p>\n        <label>\n          <input\n            type=\"checkbox\"\n            checked={slow}\n            onChange={(e) => setSlow(e.target.checked)}\n          />{\" \"}\n          布局 Effect 阻塞约 40ms（反例）\n        </label>\n      </p>\n      <div style={{ border: \"1px solid #91aa9b\", padding: 16 }}>\n        {visible ? (\n          <Probe key={identity} value={value} slow={slow} />\n        ) : (\n          <span>已卸载</span>\n        )}\n      </div>\n      <p>\n        稳定 ref 回调不会仅因为 value 更新就重新 attach。Effect 清理里的\n        capturedValue 是创建该清理函数时的状态；DOM\n        读数则是执行清理当下的实际内容。\n      </p>\n    </main>\n  );\n}"
        },
        {
          "type": "code",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt",
          "purpose": "每次 value 变化重新建立 Effect；清理函数捕获建立时的 value。",
          "code": "useLayoutEffect(() => {\n  trace('layout setup', {value, dom: ref.current?.textContent});\n  return () => trace('layout cleanup', {\n    capturedValue: value,\n    dom: ref.current?.textContent\n  });\n}, [value, slow]);"
        },
        {
          "type": "paragraph",
          "text": "从 0 更新到 1 时，新一轮 render 中 value 已经是 1，但旧布局 Effect 的清理函数仍然捕获 0。这里没有状态倒退；这是两个不同函数闭包的创建时间不同。dom 字段则是在日志发生当下读取 ref 的结果。把 capturedValue 和 dom 同时打印，可以看出“我记住的状态”和“此刻 DOM 内容”是两种证据。"
        },
        {
          "type": "paragraph",
          "text": "更微妙的一点是，布局 Effect 的 cleanup 在 mutation 阶段执行，但不应把它理解成“所有 DOM 修改之前”。本例中 Probe 返回 span，mutation 遍历先处理孩子，再在函数组件分支清理布局 Effect，所以清理时可能已经读到更新后的子节点文本。依靠旧 DOM 做测量，不能仅仅把代码放在 useLayoutEffect 的返回函数里。"
        },
        {
          "type": "reference",
          "title": "函数组件 mutation 分支：先遍历子树，再清理布局 Effects",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L2083"
        },
        {
          "type": "paragraph",
          "text": "随后 layout 阶段运行新的 setup，这时本例的 ref 已指向相应宿主节点，读到的新文本应与 value 一致。这适合做必要的布局测量，例如测量弹层后决定定位；但 setup 里的每一点同步工作都可能推迟绘制。若只是在订阅外部服务、不要求绘制前完成，普通 Effect 通常更合适。"
        },
        {
          "type": "paragraph",
          "text": "勾选实验中的“布局 Effect 阻塞约 40ms”，再点更新。示例在 layout setup 中执行有界忙等待，用来制造故障而不是模拟推荐写法。你应在 Performance 中看到同步占用，但不应拿某次计时刚好 40ms 推导帧率或 INP。设备、调试工具、计时粒度都会影响观察，阻塞不是精确的性能基准。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberCommitWork.old.js:2083–2150",
          "purpose": "函数组件 mutation 分支：先递归子树，再执行布局 Effect 清理；截取至该分支末尾。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "function commitMutationEffectsOnFiber(\n  finishedWork: Fiber,\n  root: FiberRoot,\n  lanes: Lanes,\n) {\n  const current = finishedWork.alternate;\n  const flags = finishedWork.flags;\n\n  // The effect flag should be checked *after* we refine the type of fiber,\n  // because the fiber tag is more specific. An exception is any flag related\n  // to reconcilation, because those can be set on all fiber types.\n  switch (finishedWork.tag) {\n    case FunctionComponent:\n    case ForwardRef:\n    case MemoComponent:\n    case SimpleMemoComponent: {\n      recursivelyTraverseMutationEffects(root, finishedWork, lanes);\n      commitReconciliationEffects(finishedWork);\n\n      if (flags & Update) {\n        try {\n          commitHookEffectListUnmount(\n            HookInsertion | HookHasEffect,\n            finishedWork,\n            finishedWork.return,\n          );\n          commitHookEffectListMount(\n            HookInsertion | HookHasEffect,\n            finishedWork,\n          );\n        } catch (error) {\n          captureCommitPhaseError(finishedWork, finishedWork.return, error);\n        }\n        // Layout effects are destroyed during the mutation phase so that all\n        // destroy functions for all fibers are called before any create functions.\n        // This prevents sibling component effects from interfering with each other,\n        // e.g. a destroy function in one component should never override a ref set\n        // by a create function in another component during the same commit.\n        if (\n          enableProfilerTimer &&\n          enableProfilerCommitHooks &&\n          finishedWork.mode & ProfileMode\n        ) {\n          try {\n            startLayoutEffectTimer();\n            commitHookEffectListUnmount(\n              HookLayout | HookHasEffect,\n              finishedWork,\n              finishedWork.return,\n            );\n          } catch (error) {\n            captureCommitPhaseError(finishedWork, finishedWork.return, error);\n          }\n          recordLayoutEffectDuration(finishedWork);\n        } else {\n          try {\n            commitHookEffectListUnmount(\n              HookLayout | HookHasEffect,\n              finishedWork,\n              finishedWork.return,\n            );\n          } catch (error) {\n            captureCommitPhaseError(finishedWork, finishedWork.return, error);\n          }\n        }\n      }\n      return;\n    }"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberCommitWork.old.js:2083–2150（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L2083-L2150",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "paragraph",
          "text": "关键判断是先 recursivelyTraverseMutationEffects，后在 Update 标记下清理 HookLayout。本例的子 span 文本先由子树 mutation 处理，所以 Probe 的旧 cleanup 可以同时记录 capturedValue=0 与 DOM“数值 1”。这并不矛盾：前者是旧闭包，后者是执行时读取。若你需要更新前的几何快照，不能把任意 layout cleanup 当作所有 DOM 变更之前的统一入口。"
        }
      ]
    },
    {
      "id": "refs",
      "title": "ref 不是每次 render 都重新绑定",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt",
          "purpose": "稳定 callback ref；回调身份不会随着 value 变化而变化。",
          "code": "const attach = useCallback((node: HTMLSpanElement | null) => {\n  ref.current = node;\n  trace(node ? 'ref attach' : 'ref detach', {\n    dom: node?.textContent ?? null\n  });\n}, []);"
        },
        {
          "type": "paragraph",
          "text": "首次挂载时，DOM 节点提交，ref 获得节点，然后本例 Probe 的布局 Effect 可以读取它。普通 value 更新不会更换 span 的身份，attach 回调也保持稳定，因此不应该仅因这次重新执行组件就出现一组 detach / attach。这是验证“render 次数不等于挂载次数”的直接办法。"
        },
        {
          "type": "paragraph",
          "text": "点击替换 key，React 会把 Probe 当成不同身份。旧组件的 Effects 要清理，旧 ref 要拆除，新组件要建立 Effects 并绑定新的节点。用户可能仍看到同样的数字，但它背后的组件生命周期已经变化。另一个常见原因是每次 render 创建新的内联 callback ref；即使 DOM 节点复用，ref 回调身份变化也可能触发重新解绑与绑定。"
        },
        {
          "type": "reference",
          "title": "commitAttachRef：为宿主实例绑定 callback 或对象 ref",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.old.js#L1232"
        },
        {
          "type": "paragraph",
          "text": "React 18 的 callback ref 在解绑时接收 null。不要把新版 ref 回调返回清理函数的行为套到这里；本例回调不返回清理函数。也不要把本例中子节点 ref 与父组件布局 Effect 的观测推广成任意树中所有 ref 和所有 Effect 的全局业务顺序。跨组件同步需求应该通过明确的数据流解决，不能依赖未承诺的遍历细节。"
        }
      ]
    },
    {
      "id": "passive",
      "title": "useEffect 为什么不保证“绘制之后”",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "passive Effects 由独立的刷新入口处理。flushPassiveEffectsImpl 在这个入口中先处理 passive unmount 工作，再处理 passive mount 工作；在同一个依赖变化的 Effect 上，可以观察到旧 cleanup 先于新 setup。注意这里的 unmount / mount 函数名也覆盖更新时 Effect 的销毁与重新建立，不等于组件一定从树中卸载再挂载。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:2445–2446",
          "purpose": "passive 刷新入口的卸载/建立调用顺序。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "  commitPassiveUnmountEffects(root.current);\n  commitPassiveMountEffects(root, root.current, lanes, transitions);"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:2445–2446（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2445-L2446",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "code",
          "kind": "excerpt",
          "language": "flow",
          "filename": "ReactFiberWorkLoop.old.js:2299–2305",
          "purpose": "SyncLane 且非 LegacyRoot 时同步刷新 passive 的条件。React v18.3.1 连续原码节选，依赖内部上下文；MIT License，版权归 Meta/Facebook 及贡献者。",
          "code": "  if (\n    includesSomeLane(pendingPassiveEffectsLanes, SyncLane) &&\n    root.tag !== LegacyRoot\n  ) {\n    flushPassiveEffects();\n  }\n"
        },
        {
          "type": "reference",
          "title": "代码出处：ReactFiberWorkLoop.old.js:2299–2305（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2299-L2305",
          "note": "正文已展示关键代码，链接仅供追溯；完整许可随站内源码副本保留。"
        },
        {
          "type": "paragraph",
          "text": "本例从旧 value=0 更新到1，passive 刷新先运行旧 cleanup，再运行新 setup。SyncLane 条件说明刷新可能就在当前任务尾部完成，尚未让浏览器绘制。它给的是一种明确可发生的顺序，不要求每次交互都能肉眼区分；控制台看到 setup 也不是看到屏幕更新的证据。"
        },
        {
          "type": "reference",
          "title": "flushPassiveEffectsImpl：passive cleanup 与 setup 的调用顺序",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2408"
        },
        {
          "type": "paragraph",
          "text": "React 会为 passive 工作安排后续执行机会，但在某些路径也会同步刷新。v18.3.1 的 commitRootImpl 末尾明确检查 pendingPassiveEffectsLanes 是否包含 SyncLane，并且根不是 LegacyRoot；满足条件就调用 flushPassiveEffects。点击触发的更新就是很值得观察的路径。此前的提交或布局阶段触发的后续同步工作，也会让“每个 Effect 都等到下一帧”这个假设失效。"
        },
        {
          "type": "reference",
          "title": "SyncLane 与非 LegacyRoot 条件下的同步 passive 刷新",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2292"
        },
        {
          "type": "paragraph",
          "text": "所以，我们可以说 useEffect 不用于要求绘制前完成的布局测量，却不能反过来保证它一定在绘制之后执行。把动画启动、去掉遮罩或统计“用户已经看见页面”的逻辑建立在这种保证上，会在不同交互路径下出问题。实际绘制是浏览器行为，不是 React 调用一个函数后就自动完成的事件。"
        },
        {
          "type": "paragraph",
          "text": "实验在按钮处理函数里还注册了 requestAnimationFrame。rAF 回调通常发生在绘制前的渲染机会中，不是“上一条 DOM 修改已经显示”的证据。控制台中 passive 和 rAF 的相对位置可帮助你提出假设，但真正判断绘制需要 Performance 时间线及相关渲染记录。jsdom 完全不绘制，自动测试更不能对此下结论。"
        }
      ]
    },
    {
      "id": "run",
      "title": "从安装到能解释一组日志",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "安装独立示例锁定依赖，并运行生命周期检查和构建。",
          "code": "cd examples/react-work-loop-commit\nnpm ci\nnpm test\nnpm run build\nnpm run dev"
        },
        {
          "type": "paragraph",
          "text": "第一次挂载时，本例无 StrictMode 的基本日志会出现 render attempt、ref attach、layout setup、passive setup。先检查 layout setup 读取的 DOM 文本是数值 0。不要在另一个树结构或开启开发检查之后仍强求完全相同的日志数量；应该先验证前置条件。"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "要验证的关系",
            "不能从中证明什么"
          ],
          "rows": [
            [
              "更新数值",
              "旧 cleanup 在新 setup 前；新 layout 读到新文本；稳定 ref 不重绑",
              "不能证明浏览器已经绘制"
            ],
            [
              "替换 key",
              "旧 ref 拆除、新 ref 绑定；Effects 重建",
              "不能证明用户看到了空白帧"
            ],
            [
              "卸载",
              "布局和 passive 的清理被执行；ref 拆除",
              "不能推出全部树形结构的清理全序"
            ],
            [
              "布局阻塞反例",
              "同步工作推迟主线程返回",
              "不能当作真实业务性能数据"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "自动测试使用 React act 配合 jsdom，检查实际 DOM 和日志关系。act 会主动处理 React 工作与 Effects，因此这个测试用于验收生命周期与节点关系，不能拿它观察 passive 相对真实浏览器绘制的时间。测试刻意没有断言 rAF 的位置，也没有用固定毫秒延时猜测什么时候提交。"
        },
        {
          "type": "paragraph",
          "text": "如果结果不符合预期，先查是否使用相同版本、同一入口、是否开启 StrictMode，再检查 callback ref 身份与 key 是否变化。看到 render 两次不能马上归因为并发中断；看到 passive setup 两次也不能马上判为订阅泄漏。React 开发检查会额外检验 Effect 建立与清理是否对称，正确修复通常是补齐清理逻辑，而不是用一个永久标志跳过第二次执行。"
        }
      ]
    },
    {
      "id": "use",
      "title": "真正有用的排查顺序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "把整次更新再串起来：事件请求 value 加一；工作循环处理 Probe 和孩子，得到待提交结果；mutation 更新宿主并清理旧布局工作；current 切到完成树；layout 读新 DOM；passive 按刷新入口先清理再建立。浏览器何时绘制需要结合自己的渲染机会判断。"
        },
        {
          "type": "table",
          "headers": [
            "用本文代码判断",
            "解析"
          ],
          "rows": [
            [
              "render attempt 的 value 已是1，为什么不能立刻认为 DOM 是1？",
              "日志位于计算尝试；宿主文本仍须通过提交路径应用。未提交或被放弃的render不能充当DOM完成证据。"
            ],
            [
              "稳定 ref 为何数值更新时通常不重绑？",
              "同一个span身份延续，attach 也由 useCallback 保持同一函数；换 key 或换回调身份才改变相应绑定条件。"
            ],
            [
              "cleanup 捕获0，DOM却读到1，是状态回退吗？",
              "不是。cleanup 来自旧render闭包，DOM是执行当下读取；本例mutation先处理孩子再清理父函数组件布局Effect。"
            ],
            [
              "布局中忙等待会不会被 concurrent while 救场？",
              "不会。它发生在commit的layout中，不在上述并发render循环的单元检查点内。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "本文普通路径不涵盖 Suspense、错误恢复、Portal、Offscreen 和完整插入 Effect 算法；树遍历细节固定18.3.1，不应作为跨组件业务同步协议。自动测试的 act 会主动处理 Effect，jsdom 没有绘制；它们可以验收节点和日志关系，绘制时机与性能仍需真实浏览器观测。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "React 18.3.1 工作循环与提交入口",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js"
    },
    {
      "title": "React 18.3.1 各类提交工作",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.old.js"
    },
    {
      "title": "React 18.3.1 reconciler 开关",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js#L74"
    }
  ]
};
