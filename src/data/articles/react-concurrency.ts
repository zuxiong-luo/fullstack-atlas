import type {Article} from '../articleTypes';
export const reactConcurrencyArticle: Article = {
  "id": "react-concurrency",
  "topic": "react",
  "title": "调度与并发：更新怎样排队、让出和继续",
  "description": "从调度的概念与分层讲起，串起Lane、根回调、Scheduler、Fiber循环与更新重放，再解释Transition、deferred value和异步边界。",
  "minutes": 85,
  "labMinutes": 40,
  "tags": [
    "React 18.3.1",
    "七篇系列·第5篇",
    "Lane",
    "Scheduler",
    "并发"
  ],
  "kind": "series",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-22",
  "scope": "固定18.3.1 old reconciler的客户端正常调度路径；涵盖挂起集合与异步边界概念，不冒充完整Suspense恢复或React19 Action实现。",
  "prerequisites": [
    "读过Fiber与协调篇",
    "理解函数组件、状态队列与纯计算"
  ],
  "questionIds": [],
  "experiment": "react",
  "sections": [
    {
      "id": "concept",
      "title": "调度是什么：决定工作先后与执行机会",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React调度是把“哪些更新需要处理”组织成执行计划的机制。它要回答三件事：这次先算哪些更新，何时把执行机会交给渲染器，以及计算还没完成时要继续还是让出。协调篇已经解释Fiber怎样组织一次更新；本篇在那条链上加入优先级与时间安排。调度不会替业务定义正确结果，更新队列仍需要保住操作顺序，提交仍需要把一份完成的结果应用到页面。"
        },
        {
          "type": "paragraph",
          "text": "并发渲染中的“并发”指多项渲染工作可以交错推进，不是同时开多个JavaScript线程执行函数组件。浏览器主线程上的组件计算、事件处理、DOM提交仍共享执行机会。如果某个函数连续做两秒同步计算，React不能从任意语句中间把它抢下来。我们随后会用这个边界解释：为什么加上startTransition，页面仍可能卡住。"
        },
        {
          "type": "paragraph",
          "text": "本文固定React18.3.1、createRoot客户端根、官方tag中的old reconciler和Scheduler实现。不是React19异步Action教程，也不把内部Lane常量当公共API。读完应能沿着setter→Lane→根回调→工作循环→提交追踪正常过程，并判断transition、deferred value、debounce和Worker各自解决什么问题。"
        },
        {
          "type": "figure",
          "src": "figures/react-concurrency/layers.svg",
          "title": "更新、根与 Scheduler 是不同层",
          "alt": "更新带Lane进入队列，根选择待处理Lane，安排Scheduler回调，渲染器处理Fiber，完成后提交。",
          "caption": "结构与顺序示意，不按耗时比例绘制；固定 React 18.3.1。"
        }
      ]
    },
    {
      "id": "priorities",
      "title": "先分清三种优先级，不要把数字混在一起",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一次输入会触发事件，事件具有交互紧迫程度。React据此或依据当前transition上下文给状态更新分配Lane。Lane是一个位，多个Lane用按位或组成集合；它不仅表达先后，还便于记录挂起、重试、纠缠等关系。到根要预约执行机会时，React再把选中工作的优先级映射成Scheduler任务优先级。三层有关联，但不是一组数字换了三个名字。"
        },
        {
          "type": "table",
          "headers": [
            "层次",
            "记录在哪里",
            "回答什么"
          ],
          "rows": [
            [
              "事件/当前更新优先级",
              "事件处理与React上下文",
              "这次更新来自什么紧迫程度的动作"
            ],
            [
              "Lane集合",
              "更新记录、Fiber、根",
              "哪些工作尚待处理，这轮选择哪些"
            ],
            [
              "Scheduler优先级与过期时间",
              "回调任务",
              "何时尝试调用回调，是否应让出"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "例如DefaultLane和TransitionLane最终都可能安排Normal级Scheduler回调，但React仍能根据Lane区分它们。反过来，也不能把“同步Lane”理解为必然调用Scheduler的Immediate任务：React18的同步根工作有专用内部队列，在支持微任务的环境下通过微任务刷新。后面会看到这条分支。"
        },
        {
          "type": "code",
          "purpose": "用小集合理解位运算；这些数来自该版本普通Lane，业务不要依赖内部数值。",
          "code": "const Sync = 1, Default = 16, TransitionA = 64;\nconst pending = Default | TransitionA;\nconsole.log(pending); // 80\nconsole.log((pending & TransitionA) !== 0); // true\nconsole.log(pending & ~TransitionA); // 16\nconsole.log(pending & -pending); // 16：最高优先级代表位",
          "language": "javascript",
          "filename": "位集合实验.js",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "这里最低有效位代表更高优先级，但整个集合值不能直接当优先级比较。80是两项工作的集合，并不是“优先级80”。最高优先级类别还可能包含多条Lane，例如选到Transition类别时会取候选中的Transition集合，而不是永远只取一个最低位。"
        }
      ]
    },
    {
      "id": "enqueue",
      "title": "从 setter 到根：更新先被记录，再安排执行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "以阅读清单搜索为例，text控制输入框，query控制昂贵的结果列表。输入事件先setText(next)，再把setQuery(next)包在startTransition中。setter会建立携带action与Lane的更新记录。函数式action描述状态变换；具体何时执行它由后续处理决定，不应在action里发送请求、修改外部计数或依赖只执行一次。"
        },
        {
          "type": "code",
          "purpose": "输入值保持紧急，列表参数可以过渡；这是完整实验change函数的核心。",
          "code": "function change(next: string) {\n  setText(next);\n  startTransition(() => {\n    setQuery(next);\n  });\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "purpose": "requestUpdateLane的transition分支：同事件复用已分配Lane",
          "code": "  const isTransition = requestCurrentTransition() !== NoTransition;\n  if (isTransition) {\n    if (__DEV__ && ReactCurrentBatchConfig.transition !== null) {\n      const transition = ReactCurrentBatchConfig.transition;\n      if (!transition._updatedFibers) {\n        transition._updatedFibers = new Set();\n      }\n\n      transition._updatedFibers.add(fiber);\n    }\n    // The algorithm for assigning an update to a lane should be stable for all\n    // updates at the same priority within the same event. To do this, the\n    // inputs to the algorithm must be the same.\n    //\n    // The trick we use is to cache the first of each of these inputs within an\n    // event. Then reset the cached values once we can be sure the event is\n    // over. Our heuristic for that is whenever we enter a concurrent work loop.\n    if (currentEventTransitionLane === NoLane) {\n      // All transitions within the same event are assigned the same lane.\n      currentEventTransitionLane = claimNextTransitionLane();\n    }\n    return currentEventTransitionLane;\n  }",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:469–491",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · requestUpdateLane的transition分支：同事件复用已分配Lane",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L469-L491"
        },
        {
          "type": "paragraph",
          "text": "这段先检查当前是否处在transition上下文，必要时领取一条Lane并记到当前事件缓存。它没有创建线程或把scope整体推迟；scope在调用startTransition时就执行。legacy模式、render阶段更新、显式更新优先级和宿主事件优先级还有其他分支，因此不能把上述一段说成所有Lane分配规则。"
        },
        {
          "type": "code",
          "purpose": "入队后通知根，并处理transition纠缠",
          "code": "    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);\n    if (root !== null) {\n      const eventTime = requestEventTime();\n      scheduleUpdateOnFiber(root, fiber, lane, eventTime);\n      entangleTransitionUpdate(root, queue, lane);\n    }",
          "language": "javascript",
          "filename": "ReactFiberHooks.old.js:2309–2314",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 入队后通知根，并处理transition纠缠",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L2309-L2314"
        },
        {
          "type": "paragraph",
          "text": "enqueueConcurrentHookUpdate负责把更新交给对应的收集路径，并取得需要通知的根；scheduleUpdateOnFiber标记根有工作并安排后续。这个版本还有interleaved等队列，不是每次调用都简单追加到pending后立即执行。对于可提前计算且结果相同的状态更新，eager bailout等路径还可能避免安排本次根渲染；“每次setter一定产生一次提交”从入口就不成立。"
        }
      ]
    },
    {
      "id": "lane-selection",
      "title": "根怎样选择本轮工作：pending 不等于现在就能做",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "根的pendingLanes表示尚未完成的工作；suspendedLanes表示此前被依赖阻塞的工作；pingedLanes表示已收到可以重试的信号。它们是集合，不是三条彼此排斥的队列。同一Lane可以还在pending，同时在suspended与pinged里。ping只说明可以再试，不保证下一次一定完成。"
        },
        {
          "type": "code",
          "purpose": "getNextLanes先在非Idle工作中挑未挂起或已唤醒的候选",
          "code": "  const pendingLanes = root.pendingLanes;\n  if (pendingLanes === NoLanes) {\n    return NoLanes;\n  }\n\n  let nextLanes = NoLanes;\n\n  const suspendedLanes = root.suspendedLanes;\n  const pingedLanes = root.pingedLanes;\n\n  // Do not work on any idle work until all the non-idle work has finished,\n  // even if the work is suspended.\n  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;\n  if (nonIdlePendingLanes !== NoLanes) {\n    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;\n    if (nonIdleUnblockedLanes !== NoLanes) {\n      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);\n    } else {\n      const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;\n      if (nonIdlePingedLanes !== NoLanes) {\n        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);\n      }\n    }\n  } else {\n    // The only remaining work is Idle.\n    const unblockedLanes = pendingLanes & ~suspendedLanes;\n    if (unblockedLanes !== NoLanes) {\n      nextLanes = getHighestPriorityLanes(unblockedLanes);\n    } else {\n      if (pingedLanes !== NoLanes) {\n        nextLanes = getHighestPriorityLanes(pingedLanes);\n      }\n    }\n  }\n",
          "language": "javascript",
          "filename": "ReactFiberLane.old.js:189–223",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · getNextLanes先在非Idle工作中挑未挂起或已唤醒的候选",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L189-L223"
        },
        {
          "type": "paragraph",
          "text": "按源码走一次：pending包含Default和TransitionA，Default挂起且已经ping，TransitionA没有挂起。代码先找非Idle中未挂起的集合，所以候选是TransitionA，而不是把已ping的Default也合进去重新比较。再看另一个反例：只有挂起且未ping的TransitionA，以及Idle工作；非Idle仍存在时不会直接转去做Idle，本轮可以没有候选。"
        },
        {
          "type": "table",
          "headers": [
            "pending",
            "suspended",
            "pinged",
            "初步候选"
          ],
          "rows": [
            [
              "Default、TransitionA",
              "Default",
              "Default",
              "TransitionA：先看未挂起"
            ],
            [
              "TransitionA、Idle",
              "TransitionA",
              "空",
              "空：非Idle尚未解决"
            ],
            [
              "TransitionA、TransitionB",
              "空",
              "空",
              "两条Transition：按类别取候选"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "如果已经有一轮工作在进行，候选还要与work-in-progress的Lane比较。切换意味着可能损失已经做过的计算，所以新候选不够紧急时可以继续原工作。此版本还特别规定Default不去打断正在进行的Transition。之后还会合并需要一起处理的纠缠Lane。顺序不能随意交换，否则教学模型会与源码得出不同结果。"
        },
        {
          "type": "code",
          "purpose": "已有工作与候选比较：保留进度及Default对Transition的例外",
          "code": "  if (\n    wipLanes !== NoLanes &&\n    wipLanes !== nextLanes &&\n    // If we already suspended with a delay, then interrupting is fine. Don't\n    // bother waiting until the root is complete.\n    (wipLanes & suspendedLanes) === NoLanes\n  ) {\n    const nextLane = getHighestPriorityLane(nextLanes);\n    const wipLane = getHighestPriorityLane(wipLanes);\n    if (\n      // Tests whether the next lane is equal or lower priority than the wip\n      // one. This works because the bits decrease in priority as you go left.\n      nextLane >= wipLane ||\n      // Default priority updates should not interrupt transition updates. The\n      // only difference between default updates and transition updates is that\n      // default updates do not support refresh transitions.\n      (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)\n    ) {\n      // Keep working on the existing in-progress tree. Do not interrupt.\n      return wipLanes;\n    }\n  }",
          "language": "javascript",
          "filename": "ReactFiberLane.old.js:233–254",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 已有工作与候选比较：保留进度及Default对Transition的例外",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L233-L254"
        },
        {
          "type": "code",
          "purpose": "非并发默认路径下连续输入与Default合并",
          "code": "  if (\n    allowConcurrentByDefault &&\n    (root.current.mode & ConcurrentUpdatesByDefaultMode) !== NoMode\n  ) {\n    // Do nothing, use the lanes as they were assigned.\n  } else if ((nextLanes & InputContinuousLane) !== NoLanes) {\n    // When updates are sync by default, we entangle continuous priority updates\n    // and default updates, so they render in the same batch. The only reason\n    // they use separate lanes is because continuous updates should interrupt\n    // transitions, but default updates should not.\n    nextLanes |= pendingLanes & DefaultLane;\n  }",
          "language": "javascript",
          "filename": "ReactFiberLane.old.js:256–267",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 非并发默认路径下连续输入与Default合并",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L256-L267"
        },
        {
          "type": "code",
          "purpose": "纠缠Lane被加入本轮集合",
          "code": "  const entangledLanes = root.entangledLanes;\n  if (entangledLanes !== NoLanes) {\n    const entanglements = root.entanglements;\n    let lanes = nextLanes & entangledLanes;\n    while (lanes > 0) {\n      const index = pickArbitraryLaneIndex(lanes);\n      const lane = 1 << index;\n\n      nextLanes |= entanglements[index];\n\n      lanes &= ~lane;\n    }\n  }\n\n  return nextLanes;\n}",
          "language": "javascript",
          "filename": "ReactFiberLane.old.js:291–306",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 纠缠Lane被加入本轮集合",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L291-L306"
        },
        {
          "type": "experiment",
          "id": "react-lane-selection",
          "title": "逐步试验 Lane 集合选择",
          "description": "这是固定版本选择规则的教学快照模型，不读取运行中的React根。先试Default挂起已ping与Transition未挂起的组合。"
        }
      ]
    },
    {
      "id": "root-callback",
      "title": "根回调：复用、取消和重新预约",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "选出nextLanes后，ensureRootIsScheduled用最高Lane作为root.callbackPriority。没有工作时清理回调；有工作且优先级与已预约回调相同，通常复用；优先级变了则取消旧Scheduler回调并安排新回调。不是每次setter都新建一个独立渲染任务，也不是取消回调就把更新队列里的状态更新删除。"
        },
        {
          "type": "code",
          "purpose": "比较根回调优先级，保留act特殊分支",
          "code": "  // We use the highest priority lane to represent the priority of the callback.\n  const newCallbackPriority = getHighestPriorityLane(nextLanes);\n\n  // Check if there's an existing task. We may be able to reuse it.\n  const existingCallbackPriority = root.callbackPriority;\n  if (\n    existingCallbackPriority === newCallbackPriority &&\n    // Special case related to `act`. If the currently scheduled task is a\n    // Scheduler task, rather than an `act` task, cancel it and re-scheduled\n    // on the `act` queue.\n    !(\n      __DEV__ &&\n      ReactCurrentActQueue.current !== null &&\n      existingCallbackNode !== fakeActCallbackNode\n    )\n  ) {",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:714–729",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 比较根回调优先级，保留act特殊分支",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L714-L729"
        },
        {
          "type": "code",
          "purpose": "相同优先级返回；否则取消旧回调",
          "code": "    // The priority hasn't changed. We can reuse the existing task. Exit.\n    return;\n  }\n\n  if (existingCallbackNode != null) {\n    // Cancel the existing callback. We'll schedule a new one below.\n    cancelCallback(existingCallbackNode);\n  }",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:743–750",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 相同优先级返回；否则取消旧回调",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L743-L750"
        },
        {
          "type": "paragraph",
          "text": "这里比较的是Lane代表值，不是粗粒度Scheduler级别。当根尚未开始Transition，或getNextLanes已经选出Default时，已有Transition对应Normal任务，新Default也可能对应Normal，但根的Lane优先级不同仍会替换回调。若Transition已在进行且未挂起，前节的保留进度分支可能继续选择它，此时不能说Default一定替换回调。取消任务的含义是旧预约不再按原计划执行；根上仍有pending工作，新回调会重新选择。"
        },
        {
          "type": "code",
          "purpose": "Sync走内部同步回调队列",
          "code": "  // Schedule a new callback.\n  let newCallbackNode;\n  if (newCallbackPriority === SyncLane) {\n    // Special case: Sync React callbacks are scheduled on a special\n    // internal queue\n    if (root.tag === LegacyRoot) {\n      if (__DEV__ && ReactCurrentActQueue.isBatchingLegacy !== null) {\n        ReactCurrentActQueue.didScheduleLegacyUpdate = true;\n      }\n      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));\n    } else {\n      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));\n    }\n    if (supportsMicrotasks) {\n      // Flush the queue in a microtask.\n      if (__DEV__ && ReactCurrentActQueue.current !== null) {\n        // Inside `act`, use our internal `act` queue so that these get flushed\n        // at the end of the current scope even when using the sync version\n        // of `act`.\n        ReactCurrentActQueue.current.push(flushSyncCallbacks);\n      } else {\n        scheduleMicrotask(() => {\n          // In Safari, appending an iframe forces microtasks to run.\n          // https://github.com/facebook/react/issues/22459\n          // We don't support running callbacks in the middle of render\n          // or commit so we need to check against that.\n          if (\n            (executionContext & (RenderContext | CommitContext)) ===\n            NoContext\n          ) {\n            // Note that this would still prematurely flush the callbacks\n            // if this happens outside render or commit phase (e.g. in an event).\n            flushSyncCallbacks();\n          }\n        });\n      }\n    } else {\n      // Flush the queue in an Immediate task.\n      scheduleCallback(ImmediateSchedulerPriority, flushSyncCallbacks);\n    }\n    newCallbackNode = null;",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:752–792",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · Sync走内部同步回调队列",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L752-L792"
        },
        {
          "type": "paragraph",
          "text": "接下来的源码在支持微任务时安排flushSyncCallbacks；无微任务支持时才借Immediate任务刷新。普通非Sync路径将Lane转换成Scheduler优先级并绑定performConcurrentWorkOnRoot。同步队列项与root.callbackNode的含义不同：Sync时callbackNode可以是null，但不能据此认定“根没有任何已安排的工作”。"
        },
        {
          "type": "code",
          "purpose": "非Sync映射到Scheduler级别并记录新的根回调",
          "code": "    let schedulerPriorityLevel;\n    switch (lanesToEventPriority(nextLanes)) {\n      case DiscreteEventPriority:\n        schedulerPriorityLevel = ImmediateSchedulerPriority;\n        break;\n      case ContinuousEventPriority:\n        schedulerPriorityLevel = UserBlockingSchedulerPriority;\n        break;\n      case DefaultEventPriority:\n        schedulerPriorityLevel = NormalSchedulerPriority;\n        break;\n      case IdleEventPriority:\n        schedulerPriorityLevel = IdleSchedulerPriority;\n        break;\n      default:\n        schedulerPriorityLevel = NormalSchedulerPriority;\n        break;\n    }\n    newCallbackNode = scheduleCallback(\n      schedulerPriorityLevel,\n      performConcurrentWorkOnRoot.bind(null, root),\n    );\n  }\n\n  root.callbackPriority = newCallbackPriority;\n  root.callbackNode = newCallbackNode;",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:794–819",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 非Sync映射到Scheduler级别并记录新的根回调",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L794-L819"
        },
        {
          "type": "experiment",
          "id": "react-root-scheduling",
          "title": "比较根回调如何复用与取消",
          "description": "按Transition→Transition→Default→Sync执行；模型只接收选好的Lane，输出预约记录，不执行真实任务。"
        }
      ]
    },
    {
      "id": "scheduler",
      "title": "Scheduler 如何给回调时间：队列、截止与 continuation",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Scheduler面对的是回调任务，不认识业务组件、Hook或列表key。已到可执行时间的任务进入taskQueue，以过期时间等信息排序；带delay的任务先进入timerQueue，到时才转入任务队列。排序使用小顶堆，取出最早应处理的任务；不能把timerQueue误当React所有state更新所在的队列。"
        },
        {
          "type": "code",
          "purpose": "任务循环：未过期时允许让出，回调可返回continuation",
          "code": "function workLoop(hasTimeRemaining, initialTime) {\n  let currentTime = initialTime;\n  advanceTimers(currentTime);\n  currentTask = peek(taskQueue);\n  while (\n    currentTask !== null &&\n    !(enableSchedulerDebugging && isSchedulerPaused)\n  ) {\n    if (\n      currentTask.expirationTime > currentTime &&\n      (!hasTimeRemaining || shouldYieldToHost())\n    ) {\n      // This currentTask hasn't expired, and we've reached the deadline.\n      break;\n    }\n    const callback = currentTask.callback;\n    if (typeof callback === 'function') {\n      currentTask.callback = null;\n      currentPriorityLevel = currentTask.priorityLevel;\n      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;\n      if (enableProfiling) {\n        markTaskRun(currentTask, currentTime);\n      }\n      const continuationCallback = callback(didUserCallbackTimeout);\n      currentTime = getCurrentTime();\n      if (typeof continuationCallback === 'function') {\n        currentTask.callback = continuationCallback;\n        if (enableProfiling) {\n          markTaskYield(currentTask, currentTime);\n        }\n      } else {\n        if (enableProfiling) {\n          markTaskCompleted(currentTask, currentTime);\n          currentTask.isQueued = false;\n        }\n        if (currentTask === peek(taskQueue)) {\n          pop(taskQueue);\n        }\n      }\n      advanceTimers(currentTime);\n    } else {\n      pop(taskQueue);\n    }\n    currentTask = peek(taskQueue);\n  }\n  // Return whether there's additional work\n  if (currentTask !== null) {\n    return true;\n  } else {\n    const firstTimer = peek(timerQueue);\n    if (firstTimer !== null) {\n      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);\n    }\n    return false;\n  }\n}",
          "language": "javascript",
          "filename": "Scheduler.js:189–244",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 任务循环：未过期时允许让出，回调可返回continuation",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/scheduler/src/forks/Scheduler.js#L189-L244"
        },
        {
          "type": "paragraph",
          "text": "重点看两处。第一，任务尚未过期且宿主需要让出时，循环退出这一轮。第二，callback可以返回另一个函数，Scheduler把它保留为当前任务的后续回调；返回非函数时视作本次任务完成。渲染器因此能在还有工作时交回continuation，而不必一次调用处理整棵树。"
        },
        {
          "type": "paragraph",
          "text": "过期是避免长期饥饿的机制，意味着有些分支会倾向继续处理，不能把时间片说成永不超过的硬实时上限。让出检查发生在协作边界，已开始执行的长函数仍可能超时。宿主调度也不等于requestAnimationFrame：该实现根据环境选择setImmediate、MessageChannel或setTimeout等通道，控制权交回后浏览器才有机会安排其他任务与绘制。"
        },
        {
          "type": "code",
          "purpose": "让出检查的初步时间判断",
          "code": "function shouldYieldToHost() {\n  const timeElapsed = getCurrentTime() - startTime;\n  if (timeElapsed < frameInterval) {\n    // The main thread has only been blocked for a really short amount of time;\n    // smaller than a single frame. Don't yield yet.\n    return false;\n  }",
          "language": "javascript",
          "filename": "Scheduler.js:440–446",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 让出检查的初步时间判断",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/scheduler/src/forks/Scheduler.js#L440-L446"
        },
        {
          "type": "paragraph",
          "text": "后续还会结合feature flag下的输入/绘制相关检查。这里的frameInterval是实现内部预算，不是浏览器承诺的固定刷新周期，也不是API规定的“每5ms精确中断”。分析一段性能记录时，应找真实长任务边界，而不是按教科书常数把时间线切格子。"
        }
      ]
    },
    {
      "id": "render-loop",
      "title": "回调开始后仍要再检查：并发入口也可能同步渲染",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "预约和执行之间可能又来了更新，也可能有passive effect安排了新工作。因此performConcurrentWorkOnRoot先刷新待处理passive effects，并检查当前回调是否已经被替换；随后再次调用getNextLanes。调度并不是预约时算好一份永远有效的清单，执行前的根状态才决定这次还能做什么。"
        },
        {
          "type": "code",
          "purpose": "是否启用时间切片取决于Lane、过期及回调超时条件",
          "code": "  const shouldTimeSlice =\n    !includesBlockingLane(root, lanes) &&\n    !includesExpiredLane(root, lanes) &&\n    (disableSchedulerTimeoutInWorkLoop || !didTimeout);\n  let exitStatus = shouldTimeSlice\n    ? renderRootConcurrent(root, lanes)\n    : renderRootSync(root, lanes);",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:872–878",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 是否启用时间切片取决于Lane、过期及回调超时条件",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L872-L878"
        },
        {
          "type": "paragraph",
          "text": "函数名叫performConcurrentWorkOnRoot，并不保证内部一定使用可让出的循环。这里shouldTimeSlice为false时会调用renderRootSync。阻塞Lane、过期工作及相应超时条件都参与选择。只有确定了这一层，才轮到Fiber工作循环逐个处理节点。"
        },
        {
          "type": "code",
          "purpose": "Fiber并发循环在工作单元之间检查shouldYield",
          "code": "function workLoopConcurrent() {\n  // Perform work until Scheduler asks us to yield\n  while (workInProgress !== null && !shouldYield()) {\n    performUnitOfWork(workInProgress);\n  }\n}",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:1824–1829",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · Fiber并发循环在工作单元之间检查shouldYield",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1824-L1829"
        },
        {
          "type": "paragraph",
          "text": "假设当前正在执行一个Row函数，里面有一个巨大的同步循环。while条件不会在那个函数每次循环时重新执行，只能等performUnitOfWork返回。所以拆成很多轻量Row有更多可让出的边界，而把同样计算全部放在父组件的一次filter或sort里，仍可能形成长任务。拆组件也有成本，应先测量，不要为切片无限拆碎业务。"
        },
        {
          "type": "code",
          "purpose": "如果根回调仍是原任务，返回后续执行入口",
          "code": "  ensureRootIsScheduled(root, now());\n  if (root.callbackNode === originalCallbackNode) {\n    // The task node scheduled for this root is the same one that's\n    // currently executed. Need to return a continuation.\n    return performConcurrentWorkOnRoot.bind(null, root);\n  }\n  return null;\n}",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:953–960",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 如果根回调仍是原任务，返回后续执行入口",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L953-L960"
        },
        {
          "type": "figure",
          "src": "figures/react-concurrency/timeline.svg",
          "title": "紧急输入与列表工作可以交错推进",
          "alt": "列表工作让出，输入事件更新紧急text，React可能重新准备列表，完成后才提交列表；render尝试不保证都提交。",
          "caption": "结构与顺序示意，不按耗时比例绘制；固定 React 18.3.1。"
        }
      ]
    },
    {
      "id": "rebase",
      "title": "中途改变优先级，为什么更新顺序不会随便颠倒",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "交错处理带来一个正确性问题：后来的紧急更新可以先展示，前面低优先级更新以后怎么补？不能简单在已经展示的值上补做，因为非交换运算会改变结果。初始化count=1，队列先加10再乘2；只处理乘2时暂时得到2，完整顺序应得到22，不能得到12。"
        },
        {
          "type": "code",
          "purpose": "updateReducer保留跳过项，并克隆其后已处理的更新",
          "code": "    do {\n      const updateLane = update.lane;\n      if (!isSubsetOfLanes(renderLanes, updateLane)) {\n        // Priority is insufficient. Skip this update. If this is the first\n        // skipped update, the previous update/state is the new base\n        // update/state.\n        const clone: Update<S, A> = {\n          lane: updateLane,\n          action: update.action,\n          hasEagerState: update.hasEagerState,\n          eagerState: update.eagerState,\n          next: (null: any),\n        };\n        if (newBaseQueueLast === null) {\n          newBaseQueueFirst = newBaseQueueLast = clone;\n          newBaseState = newState;\n        } else {\n          newBaseQueueLast = newBaseQueueLast.next = clone;\n        }\n        // Update the remaining priority in the queue.\n        // TODO: Don't need to accumulate this. Instead, we can remove\n        // renderLanes from the original lanes.\n        currentlyRenderingFiber.lanes = mergeLanes(\n          currentlyRenderingFiber.lanes,\n          updateLane,\n        );\n        markSkippedUpdateLanes(updateLane);\n      } else {\n        // This update does have sufficient priority.\n\n        if (newBaseQueueLast !== null) {\n          const clone: Update<S, A> = {\n            // This update is going to be committed so we never want uncommit\n            // it. Using NoLane works because 0 is a subset of all bitmasks, so\n            // this will never be skipped by the check above.\n            lane: NoLane,\n            action: update.action,\n            hasEagerState: update.hasEagerState,\n            eagerState: update.eagerState,\n            next: (null: any),\n          };\n          newBaseQueueLast = newBaseQueueLast.next = clone;\n        }\n",
          "language": "javascript",
          "filename": "ReactFiberHooks.old.js:815–858",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · updateReducer保留跳过项，并克隆其后已处理的更新",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L815-L858"
        },
        {
          "type": "code",
          "purpose": "实际计算状态，并写回memoizedState、baseState与baseQueue",
          "code": "        // Process this update.\n        if (update.hasEagerState) {\n          // If this update is a state update (not a reducer) and was processed eagerly,\n          // we can use the eagerly computed state\n          newState = ((update.eagerState: any): S);\n        } else {\n          const action = update.action;\n          newState = reducer(newState, action);\n        }\n      }\n      update = update.next;\n    } while (update !== null && update !== first);\n\n    if (newBaseQueueLast === null) {\n      newBaseState = newState;\n    } else {\n      newBaseQueueLast.next = (newBaseQueueFirst: any);\n    }\n\n    // Mark that the fiber performed work, but only if the new state is\n    // different from the current state.\n    if (!is(newState, hook.memoizedState)) {\n      markWorkInProgressReceivedUpdate();\n    }\n\n    hook.memoizedState = newState;\n    hook.baseState = newBaseState;\n    hook.baseQueue = newBaseQueueLast;\n\n    queue.lastRenderedState = newState;",
          "language": "javascript",
          "filename": "ReactFiberHooks.old.js:859–888",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · 实际计算状态，并写回memoizedState、baseState与baseQueue",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L859-L888"
        },
        {
          "type": "paragraph",
          "text": "第一次跳过加10时，React保留它并记录跳过前的newBaseState=1。后续乘2虽然本轮执行了，但因为前面还有跳过的操作，仍把乘2克隆到保留队列，并使用NoLane让重放时不再因为优先级被跳过。这轮memoizedState可以是2，baseState仍为1，baseQueue保留加10与乘2的顺序。以后从1重新计算这段，才得到22。"
        },
        {
          "type": "table",
          "headers": [
            "阶段",
            "本轮可见结果",
            "下轮计算起点",
            "保留操作"
          ],
          "rows": [
            [
              "初始",
              "1",
              "1",
              "加10、乘2"
            ],
            [
              "只处理后者",
              "2",
              "1",
              "加10、乘2（重放项）"
            ],
            [
              "全部处理",
              "22",
              "22",
              "空"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这是有意指定选择规则的算术推演，不意味着两次普通点击必然产生上述中间值。更新函数可能被重放，必须纯粹；如果函数里顺手扣款、写日志计数或发送请求，正确的状态重放也可能造成业务副作用重复。事务和网络幂等不能交给React更新队列代办。"
        },
        {
          "type": "experiment",
          "id": "react-hooks-queue",
          "title": "逐轮查看baseState与baseQueue",
          "description": "上方真实React对照值更新和函数更新；下方明确标注的模型用按钮指定优先级，展示2与22的来源。"
        }
      ]
    },
    {
      "id": "public-apis",
      "title": "把机制落到 API：Transition 与 deferred value",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Transition适合你能控制setter时，把可等待的结果更新标成过渡；输入框自身的受控value仍应及时更新。useDeferredValue适合拿到一个值但不直接控制它如何更新时，让昂贵子树使用可滞后的版本。两者都不等于请求限流：一次输入发一次请求的代码，不会因为列表变成deferred就自动少发请求。"
        },
        {
          "type": "code",
          "purpose": "接收外部query时使用deferred版本；Results需能在参数未变时跳过昂贵计算。",
          "code": "function SearchResults({ query }: { query: string }) {\n  const deferredQuery = useDeferredValue(query);\n  const stale = query !== deferredQuery;\n  return <div style={{opacity: stale ? 0.6 : 1}}>\n    <Results query={deferredQuery} />\n  </div>;\n}\n// Results在模块级定义，并按实际需要使用memo。",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "首次挂载没有可复用的旧值；在18.3.1的稳定API范围里不要把Canary的initialValue参数写进示例。后续值变了，React可以先尝试保留旧值的渲染，再安排新值；背景计算可被新的输入打断。若父组件每次都重建复杂对象作为输入，会制造本不需要的变化，先确认值的稳定性与业务语义。"
        },
        {
          "type": "reference",
          "title": "React 18 useDeferredValue：初次渲染、背景更新与限制",
          "url": "https://18.react.dev/reference/react/useDeferredValue"
        },
        {
          "type": "paragraph",
          "text": "React18的startTransition只标记scope同步执行期间安排的更新。不要直接写async scope再假定await之后的setter仍被原来的transition标记。可以先等待请求结果，再单独startTransition安排展示结果；但请求谁先返回仍需要请求ID或取消等业务策略控制，transition不替你防止旧响应覆盖新结果。"
        },
        {
          "type": "code",
          "purpose": "等待结束后单独标记展示更新；requestId检查必须由业务实现。",
          "code": "const result = await loadBooks(query);\nif (requestId !== latestRequestId.current) return;\nstartTransition(() => {\n  setBooks(result);\n});",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React18 useTransition：同步scope、受控输入与限制",
          "url": "https://18.react.dev/reference/react/useTransition"
        }
      ]
    },
    {
      "id": "async-boundary",
      "title": "Suspense、请求和错误是三种不同边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Suspense用于声明子树还不能完成渲染时显示什么后备内容。React.lazy加载组件是稳定支持的触发场景；框架也可以集成支持Suspense的数据读取。但普通useEffect里的fetch并不会自动让外层Suspense显示fallback。在Effect里维护loading仍然是一种独立的加载状态设计。"
        },
        {
          "type": "code",
          "purpose": "模块作用域声明lazy，避免每次render创建新的组件类型；路径由构建器打包。",
          "code": "const BookChart = lazy(() => import('./BookChart'));\nfunction Detail() {\n  return <Suspense fallback={<p>图表模块加载中…</p>}>\n    <BookChart />\n  </Suspense>;\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "已显示内容因为新更新再次挂起时，transition可以避免某些不必要的整体fallback切换；但新出现的边界、尚未展示的内容和具体树结构仍会影响结果，不能承诺“用transition永远不显示loading”。拒绝或渲染错误则需要Error Boundary等错误路径处理，不应让用户无限看到“加载中”。服务端流式渲染又有不同的恢复流程，留到第七篇用实际HTTP例子验证。"
        },
        {
          "type": "reference",
          "title": "Suspense 的受支持数据源与边界行为",
          "url": "https://18.react.dev/reference/react/Suspense"
        },
        {
          "type": "paragraph",
          "text": "Debounce按时间窗口减少触发次数，适合限制搜索请求；Worker把可移交的CPU任务放到另一线程，但要处理消息传输和取消；transition改变React更新安排，仍在主线程上计算。它们可以组合，却不能互相替代。纯计算巨大时，先减少算法复杂度或移走计算，再讨论React渲染的紧迫程度。"
        }
      ]
    },
    {
      "id": "experiment",
      "title": "完整实验：用同一输入框比较四种方式",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "实验初始输入为空，结果列表800行，每行16000次确定性迭代。这个规模只是制造可观察工作，不是某台设备的性能结论。默认普通模式下连续输入abcdef，再切换Transition重做；第三组只保留前40行，展示减少工作量；第四组故意把重计算放进startTransition回调，证明scope仍同步执行。"
        },
        {
          "type": "experiment",
          "id": "react-concurrency",
          "title": "真实React：输入与列表四组对照",
          "description": "建议先降低规模确保设备可操作。不要把页面快照或测试通过当作性能测量。"
        },
        {
          "type": "code",
          "purpose": "同步计算反例：startTransition只标记setter，不能让score自动后台执行。",
          "code": "startTransition(() => {\n  score(next.length, count * rounds); // 同步CPU计算，此处仍阻塞\n  setQuery(next);\n});",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "源码把Results用memo包裹，紧急text改变而query还没变时，才有机会省掉列表那部分昂贵工作。如果拿掉这个隔离边界，父组件因text更新时仍可能把列表重新计算一遍。第三组少渲染很多行与transition改变执行安排是两个不同变量，不能把它们的差异都归功于并发。"
        },
        {
          "type": "code",
          "purpose": "已有独立项目均带锁文件。进入对应目录后按README运行，不要跨目录混用依赖。",
          "code": "cd examples/react-concurrency\nnpm ci\nnpm test\nnpm run build\nnpm run dev",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "另两组Lane与根回调实验是教学模型，分别有版本源码对照测试；它们输出确定性的选择记录。真实React输入实验验证API组合和最终显示，不能在jsdom中验证屏幕绘制或固定让出毫秒数。浏览器Performance面板才用于观察长任务、输入到下一次绘制以及真实设备上的交互。"
        },
        {
          "type": "paragraph",
          "text": "复现时记录构建模式、浏览器、设备、行数、每行迭代数和输入序列。每组先预热，再重复同一操作，观察输入提交代理指标与浏览器时间线；代理指标只是事件处理记录到layout effect的间隔，不等于INP或实际paint。本文不提供未经采样的提速百分比。"
        }
      ]
    },
    {
      "id": "checklist",
      "title": "把一条更新链完整说出来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在可以按职责复述：事件与transition上下文影响Lane分配；更新记录进入状态队列并向根传播工作；根选择可做的Lane并复用或替换回调；Scheduler提供执行机会；渲染入口重新检查根并选择同步或并发循环；Fiber循环在单元边界推进；更新队列保留跳过操作的顺序；只有完成且可以提交的结果才进入页面。每一层都有自己的记录，不能用一个“异步setState”概括。"
        },
        {
          "type": "paragraph",
          "text": "调度改善的是响应机会，不保证计算量减少，也不等于保证每次输入都有独立可见的中间结果。下一篇性能优化从测量和工作量出发，继续回答：哪些计算原本就不该发生、哪些渲染范围可以缩小、哪些缓存会失效，以及怎样证明优化没有牺牲正确性。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "真实React输入实验",
      "path": "react-concurrency.zip"
    },
    {
      "label": "Lane选择模型与固定源码",
      "path": "react-lane-selection.zip"
    },
    {
      "label": "根回调模型与固定源码",
      "path": "react-root-scheduling.zip"
    },
    {
      "label": "更新队列模型与真实React对照",
      "path": "react-hooks-queue.zip"
    }
  ],
  "references": [
    {
      "title": "React18 useTransition",
      "url": "https://18.react.dev/reference/react/useTransition"
    },
    {
      "title": "React v18.3.1 Scheduler",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/scheduler/src/forks/Scheduler.js"
    }
  ]
};
