import type {Article,ArticleBlock,ArticleSection} from '../articleTypes';
const snippets={
  "dispatch": {
    "file": "ReactFiberHooks.old.js",
    "start": 2309,
    "end": 2314,
    "code": "    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);\n    if (root !== null) {\n      const eventTime = requestEventTime();\n      scheduleUpdateOnFiber(root, fiber, lane, eventTime);\n      entangleTransitionUpdate(root, queue, lane);\n    }"
  },
  "mark": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 547,
    "end": 550,
    "code": "\n  // Mark that the root has a pending update.\n  markRootUpdated(root, lane, eventTime);\n"
  },
  "pick": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 691,
    "end": 713,
    "code": "function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {\n  const existingCallbackNode = root.callbackNode;\n\n  // Check if any lanes are being starved by other work. If so, mark them as\n  // expired so we know to work on those next.\n  markStarvedLanesAsExpired(root, currentTime);\n\n  // Determine the next lanes to work on, and their priority.\n  const nextLanes = getNextLanes(\n    root,\n    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,\n  );\n\n  if (nextLanes === NoLanes) {\n    // Special case: There's nothing to work on.\n    if (existingCallbackNode !== null) {\n      cancelCallback(existingCallbackNode);\n    }\n    root.callbackNode = null;\n    root.callbackPriority = NoLane;\n    return;\n  }\n"
  },
  "priority": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 714,
    "end": 753,
    "code": "  // We use the highest priority lane to represent the priority of the callback.\n  const newCallbackPriority = getHighestPriorityLane(nextLanes);\n\n  // Check if there's an existing task. We may be able to reuse it.\n  const existingCallbackPriority = root.callbackPriority;\n  if (\n    existingCallbackPriority === newCallbackPriority &&\n    // Special case related to `act`. If the currently scheduled task is a\n    // Scheduler task, rather than an `act` task, cancel it and re-scheduled\n    // on the `act` queue.\n    !(\n      __DEV__ &&\n      ReactCurrentActQueue.current !== null &&\n      existingCallbackNode !== fakeActCallbackNode\n    )\n  ) {\n    if (__DEV__) {\n      // If we're going to re-use an existing task, it needs to exist.\n      // Assume that discrete update microtasks are non-cancellable and null.\n      // TODO: Temporary until we confirm this warning is not fired.\n      if (\n        existingCallbackNode == null &&\n        existingCallbackPriority !== SyncLane\n      ) {\n        console.error(\n          'Expected scheduled callback to exist. This error is likely caused by a bug in React. Please file an issue.',\n        );\n      }\n    }\n    // The priority hasn't changed. We can reuse the existing task. Exit.\n    return;\n  }\n\n  if (existingCallbackNode != null) {\n    // Cancel the existing callback. We'll schedule a new one below.\n    cancelCallback(existingCallbackNode);\n  }\n\n  // Schedule a new callback.\n  let newCallbackNode;"
  },
  "cancel": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 743,
    "end": 750,
    "code": "    // The priority hasn't changed. We can reuse the existing task. Exit.\n    return;\n  }\n\n  if (existingCallbackNode != null) {\n    // Cancel the existing callback. We'll schedule a new one below.\n    cancelCallback(existingCallbackNode);\n  }"
  },
  "syncQueue": {
    "file": "ReactFiberSyncTaskQueue.old.js",
    "start": 23,
    "end": 33,
    "code": "export function scheduleSyncCallback(callback: SchedulerCallback) {\n  // Push this callback into an internal queue. We'll flush these either in\n  // the next tick, or earlier if something calls `flushSyncCallbackQueue`.\n  if (syncQueue === null) {\n    syncQueue = [callback];\n  } else {\n    // Push onto existing queue. Don't need to schedule a callback because\n    // we already scheduled one when we created the queue.\n    syncQueue.push(callback);\n  }\n}"
  },
  "micro": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 765,
    "end": 793,
    "code": "    if (supportsMicrotasks) {\n      // Flush the queue in a microtask.\n      if (__DEV__ && ReactCurrentActQueue.current !== null) {\n        // Inside `act`, use our internal `act` queue so that these get flushed\n        // at the end of the current scope even when using the sync version\n        // of `act`.\n        ReactCurrentActQueue.current.push(flushSyncCallbacks);\n      } else {\n        scheduleMicrotask(() => {\n          // In Safari, appending an iframe forces microtasks to run.\n          // https://github.com/facebook/react/issues/22459\n          // We don't support running callbacks in the middle of render\n          // or commit so we need to check against that.\n          if (\n            (executionContext & (RenderContext | CommitContext)) ===\n            NoContext\n          ) {\n            // Note that this would still prematurely flush the callbacks\n            // if this happens outside render or commit phase (e.g. in an event).\n            flushSyncCallbacks();\n          }\n        });\n      }\n    } else {\n      // Flush the queue in an Immediate task.\n      scheduleCallback(ImmediateSchedulerPriority, flushSyncCallbacks);\n    }\n    newCallbackNode = null;\n  } else {"
  },
  "normal": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 794,
    "end": 821,
    "code": "    let schedulerPriorityLevel;\n    switch (lanesToEventPriority(nextLanes)) {\n      case DiscreteEventPriority:\n        schedulerPriorityLevel = ImmediateSchedulerPriority;\n        break;\n      case ContinuousEventPriority:\n        schedulerPriorityLevel = UserBlockingSchedulerPriority;\n        break;\n      case DefaultEventPriority:\n        schedulerPriorityLevel = NormalSchedulerPriority;\n        break;\n      case IdleEventPriority:\n        schedulerPriorityLevel = IdleSchedulerPriority;\n        break;\n      default:\n        schedulerPriorityLevel = NormalSchedulerPriority;\n        break;\n    }\n    newCallbackNode = scheduleCallback(\n      schedulerPriorityLevel,\n      performConcurrentWorkOnRoot.bind(null, root),\n    );\n  }\n\n  root.callbackPriority = newCallbackPriority;\n  root.callbackNode = newCallbackNode;\n}\n"
  },
  "entry": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 840,
    "end": 853,
    "code": "  const originalCallbackNode = root.callbackNode;\n  const didFlushPassiveEffects = flushPassiveEffects();\n  if (didFlushPassiveEffects) {\n    // Something in the passive effect phase may have canceled the current task.\n    // Check if the task node for this root was changed.\n    if (root.callbackNode !== originalCallbackNode) {\n      // The current task was canceled. Exit. We don't need to call\n      // `ensureRootIsScheduled` because the check above implies either that\n      // there's a new task, or that there's no remaining work on this root.\n      return null;\n    } else {\n      // Current task was not canceled. Continue.\n    }\n  }"
  },
  "chooseAgain": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 855,
    "end": 878,
    "code": "  // Determine the next lanes to work on, using the fields stored\n  // on the root.\n  let lanes = getNextLanes(\n    root,\n    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,\n  );\n  if (lanes === NoLanes) {\n    // Defensive coding. This is never expected to happen.\n    return null;\n  }\n\n  // We disable time-slicing in some cases: if the work has been CPU-bound\n  // for too long (\"expired\" work, to prevent starvation), or we're in\n  // sync-updates-by-default mode.\n  // TODO: We only check `didTimeout` defensively, to account for a Scheduler\n  // bug we're still investigating. Once the bug in Scheduler is fixed,\n  // we can remove this, since we track expiration ourselves.\n  const shouldTimeSlice =\n    !includesBlockingLane(root, lanes) &&\n    !includesExpiredLane(root, lanes) &&\n    (disableSchedulerTimeoutInWorkLoop || !didTimeout);\n  let exitStatus = shouldTimeSlice\n    ? renderRootConcurrent(root, lanes)\n    : renderRootSync(root, lanes);"
  },
  "continuation": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 953,
    "end": 959,
    "code": "  ensureRootIsScheduled(root, now());\n  if (root.callbackNode === originalCallbackNode) {\n    // The task node scheduled for this root is the same one that's\n    // currently executed. Need to return a continuation.\n    return performConcurrentWorkOnRoot.bind(null, root);\n  }\n  return null;"
  },
  "syncEntry": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 1233,
    "end": 1242,
    "code": "  flushPassiveEffects();\n\n  let lanes = getNextLanes(root, NoLanes);\n  if (!includesSomeLane(lanes, SyncLane)) {\n    // There's no remaining sync work left.\n    ensureRootIsScheduled(root, now());\n    return null;\n  }\n\n  let exitStatus = renderRootSync(root, lanes);"
  },
  "cancelTask": {
    "file": "Scheduler.js",
    "start": 414,
    "end": 419,
    "code": "\n  // Null out the callback to indicate the task has been canceled. (Can't\n  // remove from the queue because you can't remove arbitrary nodes from an\n  // array based heap, only the first one.)\n  task.callback = null;\n}"
  },
  "propagate": {
    "file": "ReactFiberConcurrentUpdates.old.js",
    "start": 142,
    "end": 184,
    "code": "function markUpdateLaneFromFiberToRoot(\n  sourceFiber: Fiber,\n  lane: Lane,\n): FiberRoot | null {\n  // Update the source fiber's lanes\n  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);\n  let alternate = sourceFiber.alternate;\n  if (alternate !== null) {\n    alternate.lanes = mergeLanes(alternate.lanes, lane);\n  }\n  if (__DEV__) {\n    if (\n      alternate === null &&\n      (sourceFiber.flags & (Placement | Hydrating)) !== NoFlags\n    ) {\n      warnAboutUpdateOnNotYetMountedFiberInDEV(sourceFiber);\n    }\n  }\n  // Walk the parent path to the root and update the child lanes.\n  let node = sourceFiber;\n  let parent = sourceFiber.return;\n  while (parent !== null) {\n    parent.childLanes = mergeLanes(parent.childLanes, lane);\n    alternate = parent.alternate;\n    if (alternate !== null) {\n      alternate.childLanes = mergeLanes(alternate.childLanes, lane);\n    } else {\n      if (__DEV__) {\n        if ((parent.flags & (Placement | Hydrating)) !== NoFlags) {\n          warnAboutUpdateOnNotYetMountedFiberInDEV(sourceFiber);\n        }\n      }\n    }\n    node = parent;\n    parent = parent.return;\n  }\n  if (node.tag === HostRoot) {\n    const root: FiberRoot = node.stateNode;\n    return root;\n  } else {\n    return null;\n  }\n}"
  },
  "syncBranch": {
    "file": "ReactFiberWorkLoop.old.js",
    "start": 754,
    "end": 764,
    "code": "  if (newCallbackPriority === SyncLane) {\n    // Special case: Sync React callbacks are scheduled on a special\n    // internal queue\n    if (root.tag === LegacyRoot) {\n      if (__DEV__ && ReactCurrentActQueue.isBatchingLegacy !== null) {\n        ReactCurrentActQueue.didScheduleLegacyUpdate = true;\n      }\n      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));\n    } else {\n      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));\n    }"
  }
} as const;
const p=(text:string):ArticleBlock=>({type:'paragraph',text});
const section=(id:string,title:string,blocks:ArticleBlock[]):ArticleSection=>({id,title,paragraphs:[],blocks});
const source=(key:keyof typeof snippets,purpose:string):ArticleBlock[]=>{const x=snippets[key];const path=x.file==='Scheduler.js'?'scheduler/src/forks/':'react-reconciler/src/';return [{type:'code',language:'javascript',filename:`React 18.3.1 · ${x.file}:${x.start}-${x.end}`,kind:'excerpt',purpose,code:x.code},{type:'reference',title:`固定原源码 ${x.file} L${x.start}–L${x.end}`,url:`https://github.com/facebook/react/blob/v18.3.1/packages/${path}${x.file}#L${x.start}-L${x.end}`,note:'按原始文本逐行截取，保留 Flow 和注释；仅节选，不可单独运行。React 源码 MIT 许可与完整文件在示例 source-notes。'}];};
export const reactRootSchedulingArticle:Article={id:'react-root-scheduling',topic:'react',title:'更新已经入队，谁来执行：React 根回调的复用、取消与重排',description:'沿任务看板的一次筛选更新，从 dispatch 追到根的 callbackNode，解释为何同类更新复用回调、Normal 任务仍会重排，以及 Sync 为什么没有普通任务句柄。',minutes:47,labMinutes:25,tags:['React 18.3.1','根调度','Sync队列','Scheduler','源码'],kind:'series',status:'review',versions:['React / React DOM 18.3.1','Node.js 22.12.0','TypeScript 5.7.2'],verifiedAt:'2026-10-23',scope:'D3。聚焦 createRoot、非 render-phase、没有 eager bailout 的普通状态更新，以及稳定版 old reconciler。解释 Lane 选完之后的根回调安排；不重写 Lane 选择、Scheduler 堆、完整 Suspense、错误恢复和浏览器事件循环。',prerequisites:['读过 Hooks 更新队列与 Lane 选择','理解 Fiber 的 return 路径和根','区分 render、commit 与浏览器 paint'],questionIds:[],experiment:'react',examples:[{label:'下载根回调模型',path:'react-root-scheduling.zip'},{label:'运行说明',path:'react-root-scheduling/README.md'},{label:'核验记录',path:'react-root-scheduling/VERIFICATION.md'}],sections:[
section('problem','根调度是什么：为一个根维护当前执行安排',[
p("根调度是 React 为 FiberRoot 维护执行入口的机制。它把根上已经记录的待处理工作转换成一个当前安排：优先级未改变时复用，改变时取消旧的普通回调并重新登记，没有候选时清空根回调字段。Hook 的 update 保存“怎么算状态”，Lane 选择决定“这轮算哪些”，根回调则让这些工作获得后续执行机会。"),
p("先走最普通的一条路径：一个 createRoot 根没有回调，收到非 render-phase 的 Transition 状态更新；入队函数取得根，scheduleUpdateOnFiber 标记待处理 Lane，ensureRootIsScheduled 选到64，安排一个 Normal Scheduler 回调并保存句柄。后续再改变一个条件，分别讨论同级更新、紧急 Sync、无候选和过时入口。"),

p('任务看板有一张正在更新的筛选列表。用户继续输入，新的列表状态又到达，紧接着一个紧急操作更新了顶部输入框。你已经知道 setter 会入队，也知道 Lane 可以区分工作。接下来还有一个缺口：这些记录不会自己执行，到底是谁把根交给后面的执行入口？已有任务还在等时，再来一条更新，是新增任务、复用任务，还是先取消旧任务？'),
p('如果回答“setState 调用 Scheduler”，你会漏掉两个很重要的事实：相同 Lane 优先级可以沿用根已有的安排；Sync 又走 React 内部队列，不一定有普通 Scheduler 任务句柄。另一个反直觉的地方是，Default 和 Transition 都可能映射到 Scheduler Normal，但根仍可能取消旧回调、创建新回调。两层优先级在这里有各自的用途。'),
p('本文沿着一次普通更新把调用链补完整。我们从没有发生 eager bailout 的 dispatchSetState 开始，追到当前 Fiber、根、根回调，再进入同步或并发执行入口。源码固定 React 18.3.1 的 old reconciler；正文关键代码是从原文件逐行截取的真实节选，完整文件和许可随示例提供。实验则刻意只做“安排回调”的确定性模型，避免把定时器动画包装成真实 React 调度。'),
{type:'experiment',id:'react-root-scheduling',title:'打开根回调安排实验',description:'依次检查 Transition、Transition、Default、Sync、Sync、无工作，观察 callbackPriority、callbackNode 与取消记录。按钮输入已选最高 Lane，不运行根渲染。'},
p('先用一句话划定本章终点：我们要解释“根已经决定下一批工作之后，执行机会怎么安排、安排过期后如何纠正”。Scheduler 内部怎样排序、宿主如何触发执行，是下一章；本文不会用某个固定毫秒数代替那一整层机制。')]),
section('dispatch','第一站：更新记录、Fiber 路径、根，分别在做什么',[
...source('dispatch','dispatchSetState 普通路径：先入队并获取根，再记录事件时间、安排根工作，最后处理 transition 纠缠。'),
p('从第一行开始追。enqueueConcurrentHookUpdate 接收的是发起更新的 fiber、该 Hook 的 queue、更新记录和 lane。它一边处理更新入队，一边沿 Fiber 关系找到根；返回 root 才能继续向下。root 为空时，这个分支不会调用 scheduleUpdateOnFiber。不能看到函数名里有 Fiber 就以为调度器为每个组件独立创建浏览器任务，真正安排的单位是根。'),
p('在这个版本中，普通并发入队先写 queue.interleaved，之后转入 pending；这属于 D1 的队列问题。这里另看标记如何传播：发起节点及它的 alternate 合并 lanes，祖先及其 alternate 合并 childLanes。前者说明这个节点有工作，后者让祖先知道子树有工作；这两种标记不能互相替代。'),
...source('propagate','向根传播的局部循环。完整函数还处理源节点、开发告警和最终 HostRoot 判断。'),
p('图上沿 return 向上走，最后到 HostRoot，再取它的 stateNode 得到 FiberRoot。注意 HostRoot 是树中的 Fiber 节点，FiberRoot 是保存根调度状态的对象。callbackNode、callbackPriority、pendingLanes 属于后者。把这两个都简称 root 可以写代码，却很容易在画图时把字段放错位置。'),
{type:'figure',src:'figures/react-root-scheduling/chain.svg',title:'入队与根调度是同一次更新的不同步骤',alt:'组件Hook的dispatch先把更新入队并沿Fiber return标记到HostRoot，取得FiberRoot；scheduleUpdateOnFiber标记根pending，再ensureRootIsScheduled选择根回调。',caption:'只展示本文普通路径。源Fiber的lanes、祖先childLanes与FiberRoot.pendingLanes是不同位置的状态。'},
p('scheduleUpdateOnFiber 先通过 markRootUpdated 标记根的 pending 状态，然后处理不同执行上下文。正常事件产生的更新会进入 ensureRootIsScheduled。原文件 L635 后还有 LegacyRoot 的同步刷新条件，本章使用 createRoot，不应该把那条历史兼容分支套过来，得出“所有 Sync setter 当场刷新 DOM”的结论。'),
...source('mark','scheduleUpdateOnFiber 将更新记入根；后续普通路径在 L635 调用 ensureRootIsScheduled。'),
p('dispatch 片段的最后一行也值得记住：entangleTransitionUpdate 在 scheduleUpdateOnFiber 返回之后执行。不要为了画一条漂亮的流水线，把版本中真实顺序倒过来。之后根的选择会再次读取当前关系；今天先把安排和实际执行分开，后面你就能理解这种重新读取为什么必要。')]),
section('root-fields','第二站：根上两项字段到底承诺了什么',[
p('FiberRoot.callbackPriority 保存的是已安排回调所代表的最高 Lane，不是 Scheduler Normal 的枚举值。callbackNode 则保存 Scheduler 返回的任务句柄；Sync 的安排会把它写成 null。两项字段合起来说明“这个根目前按照什么优先级安排过入口”，却没有保存所有更新记录。取消句柄不等于从 Hook 队列删除更新。'),
{type:'table',headers:['状态','callbackPriority','callbackNode','可以推出什么'],rows:[['没有选中工作','NoLane','null','当前根不需要这个安排；不必然等于pending为空'],['非Sync已经安排','最高Lane，例如64','Scheduler任务句柄','已有可复用或可取消的普通回调'],['Sync已经安排','SyncLane','null','Sync入口在内部队列；null不是“无工作”']]},
p('这里的“没有选中工作”可能是没有 pending，也可能是现有工作暂时都不能推进。上一章已经看到非 Idle 全部挂起时，getNextLanes 可以返回空；根不能凭 callbackNode=null 就宣称所有更新完成。调度状态与业务完成状态是不同维度。'),
p('还有一个容易过度概括的源码注释：每个根维护一个当前任务安排。它不表示整页只有一个任务，也不表示浏览器中只有一个回调；多个根可各有安排，Sync 的内部队列与刷新机会又有不同表示。我们只讨论一个根的当前回调字段，不借这句话推导全局队列大小。')]),
section('choose','第三站：检查时重新选择，不保存过时的工作快照',[
...source('pick','ensureRootIsScheduled 起点：记录旧句柄、标记过期、重新选择工作；无候选时撤销普通回调并清空根字段。'),
p('existingCallbackNode 先保存旧句柄，以便后面判断是否取消。接着 markStarvedLanesAsExpired 更新防饥饿标记，再调用 getNextLanes。若根就是当前正在工作的根，传入当前 renderLanes，让选择器考虑已有进度；否则传 NoLanes。这不是重复劳动，而是在变化后的根状态下重新判断安排是否仍合适。'),
p('返回空时会取消非空的 Scheduler 句柄，清空两个根字段并结束。代码没有清空 pendingLanes，也没有遍历 Hook 队列删除 action。这是解释“取消旧任务后为什么更新没丢”的第一条证据：被撤销的是执行安排，待计算的数据仍由相应队列和根字段保存。'),
p('选出工作之后，下一步取最高 Lane 表示回调优先级。假设本轮是两个 Transition 的集合，根字段只记录代表优先级，不把整个集合复制成一个被冻结的执行参数；进入执行入口之后还要再次读取根。新的更新与被唤醒的工作，因此有机会影响后面的选择。')]),
section('reuse','第四站：相同 Lane 复用；相同 Normal 不一定复用',[
...source('priority','复用判断看的是最高 Lane；开发 act 队列是一个明确例外。'),
p('核心比较是 existingCallbackPriority === newCallbackPriority。相同就可以保留已有安排，避免每次输入都取消并重新创建同优先级任务。如果工作集合变了但最高 Lane 没变，也可能走这个分支；这并不要求“所有 pending 内容完全相同”。已有回调执行时会重新选择，因此不必为每条新记录分配一个独立根回调。'),
p('代码中保留了 act 例外：开发环境进入 act 时，原来的 Scheduler 任务有时需要转到 act 队列，不能因为优先级相同就直接复用。我们模型设置 __DEV__=false，不模拟这条路径。测试里使用 act 主动刷新工作时，也不能把观察结果直接说成浏览器自然安排的时序。'),
p("上面的完整连续片段已同时展示复用 return 和取消旧句柄。接下来带入三个确定的选择结果，观察同一组字段如何变化。"),
p('用实验手算一次：先选 Transition A，得到 callbackPriority=64 和句柄 #1。再次选 A，复用 #1。接着直接把已选最高 Lane 改为 Default=16，根看到优先级不同，于是取消 #1、创建 #2。二者映射到 Scheduler 时都可能是 Normal，但根的 Lane 比较并不会因此相等。'),
p('这个模型操作有一个非常明确的前提：按钮直接给出 getNextLanes 已经选定的结果。真实应用如果正在执行 Transition，Default 可能因 WIP 保留分支根本没被选中，此时不会走我们这次重排。不要用模型里的“检查 Default”按钮反驳 D2 的条件；它们分别研究选择之后与选择过程。'),
p('取消也不是线程中断。Scheduler 的取消实现会清除任务上的 callback，后续队列处理才会跳过它；已经在 JavaScript 调用栈里执行的函数，不会因此被强行掐断。取消根回调更不负责撤销网络请求、回滚 DOM 或清掉闭包。它只改变这个执行安排还能不能继续使用。'),
...source('cancelTask','Scheduler 取消路径的尾部：置空任务 callback。完整函数前半部分仅包含可选分析记录。')]),
section('sync','第五站：Sync 先入内部队列，不等于立刻调用 render',[
p('若新优先级是 SyncLane，createRoot 路径把 performSyncWorkOnRoot.bind(null, root) 交给 scheduleSyncCallback，而不是走普通 scheduleCallback 分支。绑定的是根对象；它不是在这里执行组件函数。先看被调用的入队函数，就能消除“名字叫 Sync 所以这一行已经渲染”的误读。'),
...source('syncBranch','createRoot 的分支绑定根，向 Sync 内部队列登记入口；LegacyRoot 分支同时保留供比较。'),
...source('syncQueue','内部队列接收函数，未在这里调用它；刷新由另外入口触发。'),
p('syncQueue 是 React 模块内部的回调数组，可以容纳来自多个根的同步入口。ensureRootIsScheduled 在支持微任务的宿主中安排 flush；微任务回调又检查当前不在 render/commit 上下文才刷新。没有微任务支持时，用 Scheduler Immediate 回调作为刷新后备。开发 act 还会把刷新交给 act 队列。这些是同一版本里的条件分支，不能压成“Sync 就是 Promise.then”一句话。'),
...source('micro','普通支持微任务的分支末尾，以及不支持时的后备。Sync 的 newCallbackNode 被设为 null。'),
p('对照模型再点两次 Sync。第一次取消旧的普通回调，Sync 队列计数加一、微任务计数加一，root.callbackNode=null，callbackPriority=Sync。第二次优先级没变，复用判断直接返回，不因句柄是 null 就重新安排。若你自己写模型时仅凭“句柄存在”判断复用，会把 Sync 反复加入队列。'),
p('再把候选改成无工作，根字段清空，但已经安排的微任务不会被这里的 cancelCallback 撤销；它并没有一个普通 callbackNode 可取消。安全性来自执行入口再次判断，而不是假设所有过时的执行机会都能从宿主队列移除。这个思路在业务异步代码里也很常见：尽力取消之外，执行时仍检查条件是否有效。')]),
section('normal','第六站：普通回调安排到 Scheduler，但还没决定一定并发渲染',[
...source('normal','非 Sync 分支把 Lane 集合映射到事件优先级，再选 Scheduler 类别；绑定执行入口后保存根字段。'),
p('这段 switch 输入的是 lanesToEventPriority(nextLanes)，输出才是 Scheduler 的 Immediate、UserBlocking、Normal、Idle。根仍把 newCallbackPriority 这个 Lane 写回 callbackPriority。于是这里同时存在两套标尺：Lane 在 React 根内部表达更新类别，Scheduler 类别控制回调安排。它们都不能直接等同于浏览器公开任务 API 的优先级。'),
p('scheduleCallback 在正常非 act 路径把函数交给 Scheduler。Scheduler 后面通过自己的宿主机制获得执行机会，才调用绑定了 root 的 performConcurrentWorkOnRoot，并传入 didTimeout。本文模型只记录“创建了一个什么类别的回调”，不执行 MessageChannel、计时器或时间切片；下一章再拆宿主任务与继续回调。'),
{type:'figure',src:'figures/react-root-scheduling/routes.svg',title:'两个根执行入口，三种不同的“优先级”概念',alt:'选定最高Lane后，Sync走React内部队列和flush到performSyncWorkOnRoot；非Sync先映射Scheduler类别，由宿主机会执行performConcurrentWorkOnRoot。后者还会决定同步或并发render。',caption:'流程箭头代表调用或安排关系，不代表耗时；Scheduler 类别不是浏览器原生任务优先级。'},
p('名字含 Concurrent 的入口也可能执行同步 render。执行时会检查阻塞 Lane、过期标记和 Scheduler 的 didTimeout，再决定 renderRootConcurrent 还是 renderRootSync。调度层给你一个回调机会，不代表其中每段工作都会让出。反过来，同步 render 也不等于原 setter 那一行已经改了 DOM。')]),
section('enter','回调终于执行：先别用旧安排直接开工',[
...source('entry','并发入口先刷新已有 passive Effects；若这使根的回调身份改变，当前入口停止。'),
p('保存 originalCallbackNode，然后 flushPassiveEffects，是为了处理上轮提交留下的普通 Effect。Effect 里可能安排新更新，进而改变根上的回调。所以刷新完成后比较句柄：变了就返回 null，不沿用已经过时的当前任务。被比较的是当前根的回调身份，不是某个 action 值是否相同。'),
...source('chooseAgain','执行入口重新选择 Lane，再用独立条件决定 render 路径。'),
p('注意 getNextLanes 又出现一次。第一次是为了安排，第二次是为了现在执行。两者之间可以发生更新、唤醒、取消或 Effects 引入的变化。回调绑定 root，让它读取当前状态，比把第一次 nextLanes 永远捕获进闭包更能处理这些变化。模型没有模拟这个执行阶段，原函数对照测试也不宣称已经跑过 render。'),
...source('syncEntry','Sync 入口也会刷新 passive 并重新选择；已经没有 Sync 工作时，重新安排后返回。'),
p('这里正好回答上一节的微任务问题：旧的 Sync 执行机会即使到达，入口发现当前选择不含 Sync，也会 ensureRootIsScheduled 然后返回。它不会因为早先进过 Sync 队列，就不顾最新根状态强行以旧假设渲染。不要把这段防御逻辑误写成“所有排过的同步入口都必然提交一次”。')]),
section('continuation','做完一段之后，为什么又要 ensure 一次',[
...source('continuation','并发入口退出前再次安排；只有当前根仍指向同一任务，才返回继续函数。'),
p('如果根还有同优先级工作、回调身份仍是 originalCallbackNode，就返回一个绑定同一根的函数，作为 continuation 给 Scheduler。它是函数返回值，不是这里立即递归调用。Scheduler 如何消费这个返回值属于下一章；在本章，至少应区分“返回继续函数”和“当场运行下一轮”。'),
p('如果期间重新安排了更高优先级回调，或者已经没有可做工作，根句柄与原先不同，旧入口返回 null，不再把自己当作后续工作来源。一次检查并不够：入口前、passive 刷新后、退出前都可能改变安排。它们针对的是不同时间点，而不是重复写同一个保险判断。'),
p('commit 后剩余 Lane 会按相应生命周期更新，根调度再次检查还有什么；本文没有实现提交。把“执行一个回调”当作“清空全部 pending”会丢掉延后或挂起工作，也会无法解释一个任务为何返回 continuation。任务、更新记录、完成的树分别属于不同层次，不能用一个 done 布尔值概括全部。')]),
section('lab','把关键模型放在眼前，再核对实际轨迹',[
{"type": "code", "language": "tsx", "filename": "examples/react-root-scheduling/App.tsx · 完整安排模型", "kind": "excerpt", "purpose": "从原项目导入到 ensure 的全部代码；省略只有按钮与结果显示的 JSX。输入已选最高 Lane，输出新根模型，不执行 render。", "code": "import React,{useState} from 'react';\nexport type Lane=0|1|4|16|64|128;\nexport type Task={id:number;priority:string;cancelled:boolean};\nexport type RootModel={priority:Lane;node:number|null;nextId:number;tasks:Task[];syncCount:number;microtasks:number;trace:string[]};\nexport const empty=():RootModel=>({priority:0,node:null,nextId:1,tasks:[],syncCount:0,microtasks:0,trace:[]});\nexport const names:Record<Lane,string>={0:'无可选工作',1:'Sync',4:'Continuous',16:'Default',64:'Transition A',128:'Transition B'};\n// 教学根安排模型：输入是已经选定集合的最高 Lane。未实现 Lane 选择或 Scheduler。\nexport function ensure(previous:RootModel,next:Lane):RootModel{\n const state:RootModel={...previous,tasks:previous.tasks.map(x=>({...x})),trace:[...previous.trace,`检查已选工作：${names[next]}`]};\n function cancel(){if(state.node!==null){const task=state.tasks.find(x=>x.id===state.node);if(task)task.cancelled=true;state.trace.push(`取消 Scheduler callback #${state.node}；更新记录不被删除`);}}\n if(next===0){cancel();state.node=null;state.priority=0;state.trace.push('清空根的 callback 字段；已排入的 Sync 微任务不可在此取消');return state;}\n if(state.priority===next){state.trace.push(`Lane 优先级相同，复用安排（node=${state.node??'null'}）`);return state;}\n cancel();\n if(next===1){state.syncCount++;state.microtasks++;state.node=null;state.trace.push('加入 React Sync 内部队列；安排一次 flush 微任务；callbackNode=null');}\n else{const priority=next===4?'UserBlocking':'Normal';const id=state.nextId++;state.tasks.push({id,priority,cancelled:false});state.node=id;state.trace.push(`创建 Scheduler ${priority} callback #${id}`);}\n state.priority=next;return state;\n}\n"},
p("带入 empty()，先 ensure(root,64)：priority 从0变64，node从null变1，tasks新增 Normal #1。再 ensure(root,64)，只增加trace，node仍是1。改为16，#1.cancelled变true，新建 Normal #2。改为1，#2取消，node变null，priority为1，syncCount和microtasks各加一。再次传1只复用已有Sync安排；传0只清字段，累计计数仍为1。每项变化都能在正文函数中找到写入位置。"),
p("理解检查：为什么不能把复用条件改成“node存在并且Scheduler类别相同”？解析：64与16都映射 Normal，却要在根层重排；Sync则node为null，但priority=1的安排仍能复用。根需要比较 Lane 优先级，句柄只表示一种具体执行安排。若误把 cancelled 任务从业务更新队列一起删掉，还会丢掉未完成的用户操作。"),

{type:'code',language:'bash',filename:'终端',kind:'runnable',purpose:'独立示例使用锁定依赖；不用 nvm 时先准备 Node 22.12.0，再跳过 nvm use。',code:'cd examples/react-root-scheduling\nnvm use\nnpm ci\nnpm test\nnpm run build\nnpm run dev'},
p('打开终端地址，按 Transition → Transition → Default → Sync → Sync → 无工作 点击。应依次看到创建 #1、复用 #1、取消 #1 并创建 Normal #2、取消 #2 后 Sync 入队一次、复用 Sync 安排、清空根字段但仍保留累计的 Sync 入队记录。没有隐藏的定时器自动推进，所以可以随时停下来读每一步。'),
p('故意用两条错误规则预测一下：只按 Scheduler Normal 相等就复用，会漏掉第三步的重排；只要 callbackNode=null 就判断无任务，会漏掉第五步的 Sync 复用。配套测试直接覆盖这两个反例。界面上的“已取消”表示执行安排失效，不表示删除用户的更新。'),
p('为了不让验证变成“自己实现自己证明”，测试从完整 v18.3.1 源文件中提取 ensureRootIsScheduled 原函数体，仅去掉 Flow 函数签名；Lane 选择作为输入，Scheduler 与宿主调用用可记录的替身。它枚举六个最高 Lane 值的四步序列，共 1296 条，对比每步根字段、任务取消、Sync 入队与微任务登记。源码快照哈希和许可一起保存，节选也能逐字核验。'),
p('这个对照能证明模型在声明条件下复现了安排分支，不能证明真实浏览器时延、React render 或所有 feature flags。测试固定 createRoot、非 act、支持微任务，不执行安排的函数，不模拟 WIP、挂起、纠缠和过期推进。Sync 队列与微任务计数在页面里是累计登记，没有自动 flush；这不是一个实时调度器。'),
p('完整 App.tsx 只有 React 外部导入，可在本站实验室运行。源码文件进入示例下载包，正文引用指向固定 tag。安装本地依赖仍需要网络，站点离线包是否覆盖本例资源由整合检查确认；不能把本地 build 通过写成手机离线已经验收。')]),
section('close','回到看板：现在可以分层解释“为什么没立即执行”',[
p('先确认更新是否走到普通 dispatch 路径，还是被 eager bailout 或 render-phase 分支处理；再确认 Lane 是否标记到了正确的根；接着看 getNextLanes 当前是否有候选；有候选时比较根的 callbackPriority，判断复用还是取消重排；最后追 Sync 内部队列或 Scheduler 回调到执行入口，检查最新状态是否仍允许继续。这个顺序比一开始猜“浏览器卡了”更能缩小范围。'),
p('正常路径的关键不是把每个 setter 尽快变成一个独立任务，而是让一个根始终有符合当前工作状态的执行安排。数据更新由队列保存，工作选择由 Lane 规则处理，根负责复用和更换入口，Scheduler 与宿主负责提供执行机会，render 与 commit 再负责得到和应用结果。每一层都回答不同的问题。'),
p('下一章可以沿非 Sync 的 scheduleCallback 继续追：它如何组织就绪任务、延迟任务和 continuation，什么时候检查让出。今天已经建立了那个入口的来路；再深入时就不容易把 Scheduler 中一个 task，当成 Hook 队列里一条 update。')]),
],references:[{title:'React 18.3.1 根工作循环',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js'},{title:'React 18.3.1 Sync内部队列',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberSyncTaskQueue.old.js'},{title:'React 18.3.1 Hooks dispatch',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js'}]};
