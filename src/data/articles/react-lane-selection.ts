import type { Article, ArticleBlock, ArticleSection } from '../articleTypes';
const p = (text: string): ArticleBlock => ({ type: 'paragraph', text });
const section = (id: string, title: string, blocks: ArticleBlock[]): ArticleSection => ({ id, title, paragraphs: [], blocks });
const ref = (title: string, file: string, lines: string): ArticleBlock => ({ type: 'reference', title, url: `https://github.com/facebook/react/blob/v18.3.1/packages/${file}#${lines}` });
const laneRef = (title: string, lines: string) => ref(title, 'react-reconciler/src/ReactFiberLane.old.js', lines);
const code = (code: string, purpose: string, filename = '位运算实验'): ArticleBlock => ({ type: 'code', code, language: 'javascript', filename, purpose, kind: 'runnable' });
const inlineSources:Record<string,ArticleBlock[]>={
  "highest": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:132-184",
      "kind": "excerpt",
      "purpose": "完整 getHighestPriorityLanes：Transition 与 Retry 返回输入中的整组位；其他类别通常返回单一位。",
      "code": "  switch (getHighestPriorityLane(lanes)) {\n    case SyncLane:\n      return SyncLane;\n    case InputContinuousHydrationLane:\n      return InputContinuousHydrationLane;\n    case InputContinuousLane:\n      return InputContinuousLane;\n    case DefaultHydrationLane:\n      return DefaultHydrationLane;\n    case DefaultLane:\n      return DefaultLane;\n    case TransitionHydrationLane:\n      return TransitionHydrationLane;\n    case TransitionLane1:\n    case TransitionLane2:\n    case TransitionLane3:\n    case TransitionLane4:\n    case TransitionLane5:\n    case TransitionLane6:\n    case TransitionLane7:\n    case TransitionLane8:\n    case TransitionLane9:\n    case TransitionLane10:\n    case TransitionLane11:\n    case TransitionLane12:\n    case TransitionLane13:\n    case TransitionLane14:\n    case TransitionLane15:\n    case TransitionLane16:\n      return lanes & TransitionLanes;\n    case RetryLane1:\n    case RetryLane2:\n    case RetryLane3:\n    case RetryLane4:\n    case RetryLane5:\n      return lanes & RetryLanes;\n    case SelectiveHydrationLane:\n      return SelectiveHydrationLane;\n    case IdleHydrationLane:\n      return IdleHydrationLane;\n    case IdleLane:\n      return IdleLane;\n    case OffscreenLane:\n      return OffscreenLane;\n    default:\n      if (__DEV__) {\n        console.error(\n          'Should have found matching lanes. This is a bug in React.',\n        );\n      }\n      // This shouldn't be reachable, but as a fallback, return the entire bitmask.\n      return lanes;\n  }"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L132–L184",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L132-L184",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "candidate": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:187-228",
      "kind": "excerpt",
      "purpose": "getNextLanes 第一段：函数入口到初始候选确定；保留 Idle、unblocked 与 pinged 的所有选择分支。",
      "code": "export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {\n  // Early bailout if there's no pending work left.\n  const pendingLanes = root.pendingLanes;\n  if (pendingLanes === NoLanes) {\n    return NoLanes;\n  }\n\n  let nextLanes = NoLanes;\n\n  const suspendedLanes = root.suspendedLanes;\n  const pingedLanes = root.pingedLanes;\n\n  // Do not work on any idle work until all the non-idle work has finished,\n  // even if the work is suspended.\n  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;\n  if (nonIdlePendingLanes !== NoLanes) {\n    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;\n    if (nonIdleUnblockedLanes !== NoLanes) {\n      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);\n    } else {\n      const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;\n      if (nonIdlePingedLanes !== NoLanes) {\n        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);\n      }\n    }\n  } else {\n    // The only remaining work is Idle.\n    const unblockedLanes = pendingLanes & ~suspendedLanes;\n    if (unblockedLanes !== NoLanes) {\n      nextLanes = getHighestPriorityLanes(unblockedLanes);\n    } else {\n      if (pingedLanes !== NoLanes) {\n        nextLanes = getHighestPriorityLanes(pingedLanes);\n      }\n    }\n  }\n\n  if (nextLanes === NoLanes) {\n    // This should only be reachable if we're suspended\n    // TODO: Consider warning in this path if a fallback timer is not scheduled.\n    return NoLanes;\n  }"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L187–L228",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L187-L228",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "wip": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:230-254",
      "kind": "excerpt",
      "purpose": "getNextLanes 第二段：WIP 比较与提前返回；下一段继续同一函数。",
      "code": "  // If we're already in the middle of a render, switching lanes will interrupt\n  // it and we'll lose our progress. We should only do this if the new lanes are\n  // higher priority.\n  if (\n    wipLanes !== NoLanes &&\n    wipLanes !== nextLanes &&\n    // If we already suspended with a delay, then interrupting is fine. Don't\n    // bother waiting until the root is complete.\n    (wipLanes & suspendedLanes) === NoLanes\n  ) {\n    const nextLane = getHighestPriorityLane(nextLanes);\n    const wipLane = getHighestPriorityLane(wipLanes);\n    if (\n      // Tests whether the next lane is equal or lower priority than the wip\n      // one. This works because the bits decrease in priority as you go left.\n      nextLane >= wipLane ||\n      // Default priority updates should not interrupt transition updates. The\n      // only difference between default updates and transition updates is that\n      // default updates do not support refresh transitions.\n      (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)\n    ) {\n      // Keep working on the existing in-progress tree. Do not interrupt.\n      return wipLanes;\n    }\n  }"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L230–L254",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L230-L254",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "expand": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:256-306",
      "kind": "excerpt",
      "purpose": "getNextLanes 最后一段：连续工作合并、纠缠扩展、最终返回。三段合起来覆盖完整选择函数。",
      "code": "  if (\n    allowConcurrentByDefault &&\n    (root.current.mode & ConcurrentUpdatesByDefaultMode) !== NoMode\n  ) {\n    // Do nothing, use the lanes as they were assigned.\n  } else if ((nextLanes & InputContinuousLane) !== NoLanes) {\n    // When updates are sync by default, we entangle continuous priority updates\n    // and default updates, so they render in the same batch. The only reason\n    // they use separate lanes is because continuous updates should interrupt\n    // transitions, but default updates should not.\n    nextLanes |= pendingLanes & DefaultLane;\n  }\n\n  // Check for entangled lanes and add them to the batch.\n  //\n  // A lane is said to be entangled with another when it's not allowed to render\n  // in a batch that does not also include the other lane. Typically we do this\n  // when multiple updates have the same source, and we only want to respond to\n  // the most recent event from that source.\n  //\n  // Note that we apply entanglements *after* checking for partial work above.\n  // This means that if a lane is entangled during an interleaved event while\n  // it's already rendering, we won't interrupt it. This is intentional, since\n  // entanglement is usually \"best effort\": we'll try our best to render the\n  // lanes in the same batch, but it's not worth throwing out partially\n  // completed work in order to do it.\n  // TODO: Reconsider this. The counter-argument is that the partial work\n  // represents an intermediate state, which we don't want to show to the user.\n  // And by spending extra time finishing it, we're increasing the amount of\n  // time it takes to show the final state, which is what they are actually\n  // waiting for.\n  //\n  // For those exceptions where entanglement is semantically important, like\n  // useMutableSource, we should ensure that there is no partial work at the\n  // time we apply the entanglement.\n  const entangledLanes = root.entangledLanes;\n  if (entangledLanes !== NoLanes) {\n    const entanglements = root.entanglements;\n    let lanes = nextLanes & entangledLanes;\n    while (lanes > 0) {\n      const index = pickArbitraryLaneIndex(lanes);\n      const lane = 1 << index;\n\n      nextLanes |= entanglements[index];\n\n      lanes &= ~lane;\n    }\n  }\n\n  return nextLanes;\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L256–L306",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L256-L306",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "mark": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:574-604",
      "kind": "excerpt",
      "purpose": "完整 markRootUpdated：记录 pending，并解释非 Idle 更新为什么清除挂起和 ping 状态。",
      "code": "export function markRootUpdated(\n  root: FiberRoot,\n  updateLane: Lane,\n  eventTime: number,\n) {\n  root.pendingLanes |= updateLane;\n\n  // If there are any suspended transitions, it's possible this new update\n  // could unblock them. Clear the suspended lanes so that we can try rendering\n  // them again.\n  //\n  // TODO: We really only need to unsuspend only lanes that are in the\n  // `subtreeLanes` of the updated fiber, or the update lanes of the return\n  // path. This would exclude suspended updates in an unrelated sibling tree,\n  // since there's no way for this update to unblock it.\n  //\n  // We don't do this if the incoming update is idle, because we never process\n  // idle updates until after all the regular updates have finished; there's no\n  // way it could unblock a transition.\n  if (updateLane !== IdleLane) {\n    root.suspendedLanes = NoLanes;\n    root.pingedLanes = NoLanes;\n  }\n\n  const eventTimes = root.eventTimes;\n  const index = laneToIndex(updateLane);\n  // We can always overwrite an existing timestamp because we prefer the most\n  // recent event, and we assume time is monotonically increasing.\n  eventTimes[index] = eventTime;\n}\n"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L574–L604",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L574-L604",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "ping": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:622-628",
      "kind": "excerpt",
      "purpose": "完整 markRootPinged：只并入已挂起位；本版本未使用 eventTime 参数。",
      "code": "export function markRootPinged(\n  root: FiberRoot,\n  pingedLanes: Lanes,\n  eventTime: number,\n) {\n  root.pingedLanes |= root.suspendedLanes & pingedLanes;\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L622–L628",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L622-L628",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ],
  "entangle": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:666-700",
      "kind": "excerpt",
      "purpose": "完整 markRootEntangled：已有关系与新关系在写入时合并，选择器只消费结果。",
      "code": "export function markRootEntangled(root: FiberRoot, entangledLanes: Lanes) {\n  // In addition to entangling each of the given lanes with each other, we also\n  // have to consider _transitive_ entanglements. For each lane that is already\n  // entangled with *any* of the given lanes, that lane is now transitively\n  // entangled with *all* the given lanes.\n  //\n  // Translated: If C is entangled with A, then entangling A with B also\n  // entangles C with B.\n  //\n  // If this is hard to grasp, it might help to intentionally break this\n  // function and look at the tests that fail in ReactTransition-test.js. Try\n  // commenting out one of the conditions below.\n\n  const rootEntangledLanes = (root.entangledLanes |= entangledLanes);\n  const entanglements = root.entanglements;\n  let lanes = rootEntangledLanes;\n  while (lanes) {\n    const index = pickArbitraryLaneIndex(lanes);\n    const lane = 1 << index;\n    if (\n      // Is this one of the newly entangled lanes?\n      (lane & entangledLanes) |\n      // Is this lane transitively entangled with the newly entangled lanes?\n      (entanglements[index] & entangledLanes)\n    ) {\n      entanglements[index] |= entangledLanes;\n    }\n    lanes &= ~lane;\n  }\n}\n\nexport function getBumpedLaneForHydration(\n  root: FiberRoot,\n  renderLanes: Lanes,\n): Lane {"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L666–L700",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L666-L700",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "expired": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberWorkLoop.old.js:866-878",
      "kind": "excerpt",
      "purpose": "performConcurrentWorkOnRoot 内实际决定 render 路径的连续节选。",
      "code": "  // We disable time-slicing in some cases: if the work has been CPU-bound\n  // for too long (\"expired\" work, to prevent starvation), or we're in\n  // sync-updates-by-default mode.\n  // TODO: We only check `didTimeout` defensively, to account for a Scheduler\n  // bug we're still investigating. Once the bug in Scheduler is fixed,\n  // we can remove this, since we track expiration ourselves.\n  const shouldTimeSlice =\n    !includesBlockingLane(root, lanes) &&\n    !includesExpiredLane(root, lanes) &&\n    (disableSchedulerTimeoutInWorkLoop || !didTimeout);\n  let exitStatus = shouldTimeSlice\n    ? renderRootConcurrent(root, lanes)\n    : renderRootSync(root, lanes);"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberWorkLoop.old.js L866–L878",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L866-L878",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "blocking": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:465-486",
      "kind": "excerpt",
      "purpose": "完整 includesBlockingLane 与 includesExpiredLane：检查执行方式用的两个谓词。",
      "code": "\nexport function includesBlockingLane(root: FiberRoot, lanes: Lanes) {\n  if (\n    allowConcurrentByDefault &&\n    (root.current.mode & ConcurrentUpdatesByDefaultMode) !== NoMode\n  ) {\n    // Concurrent updates by default always use time slicing.\n    return false;\n  }\n  const SyncDefaultLanes =\n    InputContinuousHydrationLane |\n    InputContinuousLane |\n    DefaultHydrationLane |\n    DefaultLane;\n  return (lanes & SyncDefaultLanes) !== NoLanes;\n}\n\nexport function includesExpiredLane(root: FiberRoot, lanes: Lanes) {\n  // This is a separate check from includesBlockingLane because a lane can\n  // expire after a render has already started.\n  return (lanes & root.expiredLanes) !== NoLanes;\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L465–L486",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L465-L486",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "priority": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactEventPriorities.old.js:70-82",
      "kind": "excerpt",
      "purpose": "完整 lanesToEventPriority：把 Lane 集合映射成事件优先级，供根回调转换使用。",
      "code": "export function lanesToEventPriority(lanes: Lanes): EventPriority {\n  const lane = getHighestPriorityLane(lanes);\n  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {\n    return DiscreteEventPriority;\n  }\n  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {\n    return ContinuousEventPriority;\n  }\n  if (includesNonIdleWork(lane)) {\n    return DefaultEventPriority;\n  }\n  return IdleEventPriority;\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactEventPriorities.old.js L70–L82",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactEventPriorities.old.js#L70-L82",
      "note": "固定 v18.3.1 原文，保留 Flow、注释及所示范围内全部分支；MIT 许可。此为 React 内部节选，依赖外部上下文，不能单独运行。关键解释在正文，链接仅用于核对出处。"
    }
  ],
  "highestBit": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:513-515",
      "kind": "excerpt",
      "purpose": "getHighestPriorityLanes 读取的完整辅助函数：最低有效位作为最高优先级代表。",
      "code": "export function getHighestPriorityLane(lanes: Lanes): Lane {\n  return lanes & -lanes;\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L513–L515",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L513-L515",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ],
  "expireTime": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:327-387",
      "kind": "excerpt",
      "purpose": "完整 computeExpirationTime：不同类别的防饥饿时限。",
      "code": "function computeExpirationTime(lane: Lane, currentTime: number) {\n  switch (lane) {\n    case SyncLane:\n    case InputContinuousHydrationLane:\n    case InputContinuousLane:\n      // User interactions should expire slightly more quickly.\n      //\n      // NOTE: This is set to the corresponding constant as in Scheduler.js.\n      // When we made it larger, a product metric in www regressed, suggesting\n      // there's a user interaction that's being starved by a series of\n      // synchronous updates. If that theory is correct, the proper solution is\n      // to fix the starvation. However, this scenario supports the idea that\n      // expiration times are an important safeguard when starvation\n      // does happen.\n      return currentTime + 250;\n    case DefaultHydrationLane:\n    case DefaultLane:\n    case TransitionHydrationLane:\n    case TransitionLane1:\n    case TransitionLane2:\n    case TransitionLane3:\n    case TransitionLane4:\n    case TransitionLane5:\n    case TransitionLane6:\n    case TransitionLane7:\n    case TransitionLane8:\n    case TransitionLane9:\n    case TransitionLane10:\n    case TransitionLane11:\n    case TransitionLane12:\n    case TransitionLane13:\n    case TransitionLane14:\n    case TransitionLane15:\n    case TransitionLane16:\n      return currentTime + 5000;\n    case RetryLane1:\n    case RetryLane2:\n    case RetryLane3:\n    case RetryLane4:\n    case RetryLane5:\n      // TODO: Retries should be allowed to expire if they are CPU bound for\n      // too long, but when I made this change it caused a spike in browser\n      // crashes. There must be some other underlying bug; not super urgent but\n      // ideally should figure out why and fix it. Unfortunately we don't have\n      // a repro for the crashes, only detected via production metrics.\n      return NoTimestamp;\n    case SelectiveHydrationLane:\n    case IdleHydrationLane:\n    case IdleLane:\n    case OffscreenLane:\n      // Anything idle priority or lower should never expire.\n      return NoTimestamp;\n    default:\n      if (__DEV__) {\n        console.error(\n          'Should have found matching lanes. This is a bug in React.',\n        );\n      }\n      return NoTimestamp;\n  }\n}"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L327–L387",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L327-L387",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ],
  "starved": [
    {
      "type": "code",
      "language": "javascript",
      "filename": "React 18.3.1 · ReactFiberLane.old.js:389-431",
      "kind": "excerpt",
      "purpose": "完整 markStarvedLanesAsExpired：从根当前状态计算过期标记。",
      "code": "export function markStarvedLanesAsExpired(\n  root: FiberRoot,\n  currentTime: number,\n): void {\n  // TODO: This gets called every time we yield. We can optimize by storing\n  // the earliest expiration time on the root. Then use that to quickly bail out\n  // of this function.\n\n  const pendingLanes = root.pendingLanes;\n  const suspendedLanes = root.suspendedLanes;\n  const pingedLanes = root.pingedLanes;\n  const expirationTimes = root.expirationTimes;\n\n  // Iterate through the pending lanes and check if we've reached their\n  // expiration time. If so, we'll assume the update is being starved and mark\n  // it as expired to force it to finish.\n  let lanes = pendingLanes;\n  while (lanes > 0) {\n    const index = pickArbitraryLaneIndex(lanes);\n    const lane = 1 << index;\n\n    const expirationTime = expirationTimes[index];\n    if (expirationTime === NoTimestamp) {\n      // Found a pending lane with no expiration time. If it's not suspended, or\n      // if it's pinged, assume it's CPU-bound. Compute a new expiration time\n      // using the current time.\n      if (\n        (lane & suspendedLanes) === NoLanes ||\n        (lane & pingedLanes) !== NoLanes\n      ) {\n        // Assumes timestamps are monotonically increasing.\n        expirationTimes[index] = computeExpirationTime(lane, currentTime);\n      }\n    } else if (expirationTime <= currentTime) {\n      // This lane expired\n      root.expiredLanes |= lane;\n    }\n\n    lanes &= ~lane;\n  }\n}\n\n// This returns the highest priority pending lanes regardless of whether they"
    },
    {
      "type": "reference",
      "title": "代码出处 · ReactFiberLane.old.js L389–L431",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js#L389-L431",
      "note": "固定 v18.3.1 原文，MIT 许可；保留所示连续范围，不可独立运行。代码和推导已在本页展示，链接只用于核对。"
    }
  ]
};
export const reactLaneSelectionArticle: Article = {
  id: 'react-lane-selection', topic: 'react', title: 'React 18.3.1 的 Lane 选择：有工作在等，为什么不先做它？',
  description: '从输入、列表和后台刷新同时等待的根状态出发，手算 pending、suspended、pinged、WIP 和纠缠关系，再区分选择工作与选择渲染路径。',
  minutes: 48, labMinutes: 25, kind: 'tutorial', status: 'review', verifiedAt: '2026-10-23',
  versions: ['React / React DOM 18.3.1', '源码 ReactFiberLane.old.js / ReactFiberWorkLoop.old.js', 'Node 22.12.0 / TypeScript 5.7.2'],
  tags: ['React 18', 'Lane', '优先级', 'Suspense', '源码'],
  scope: '固定 v18.3.1 的 old reconciler 与稳定版默认 feature flags；讨论根级选择，不实现完整更新队列、Suspense UI、Hydration 或 Scheduler。六类 Lane 实验是子集教学模型。',
  prerequisites: ['知道 render 与 commit 的区别', '能读简单 JavaScript 位运算', '知道 transition 可以让更新采用不同优先级'], questionIds: [], experiment: 'react',
  examples: [{ label: '下载 Lane 选择实验', path: 'react-lane-selection.zip' }, { label: '实验说明与核验方法', path: 'react-lane-selection/README.md' }, { label: '源码证据与验证记录', path: 'react-lane-selection/VERIFICATION.md' }],
  sections: [
    section('problem', 'Lane 选择是什么：从根上的工作集合选出本轮输入', [
p("Lane 是 React 内部为更新标记类别的一位，Lanes 是若干位组成的集合。Lane 选择发生在根上：它读取尚未完成、已经挂起、收到重试信号和正在渲染的集合，返回下一轮应该参与计算的工作集合。它负责决定“做哪些更新”，后面的根调度负责安排“何时得到执行机会”。本篇把选择器作为独立主题，先走普通输入，再解释会改变选择的条件。"),
p("先看没有挂起、没有进行中渲染的普通情况：根上有 Default=16 和 Transition A=64，pending=80。选择器先取非 Idle，再取未挂起，得到同样的 80；最高类别是 Default，结果返回 16。这个返回值没有删除 pending，也没有写 DOM，它只是下一阶段要消费的工作集合。后面每条特殊分支，都在改变这个基本过程的某一个条件。"),

      p('搜索页面里，输入框正在接收新字符，结果列表在计算，后台又通知你更新一块普通状态。如果只记住“React 优先做紧急任务”，遇到真实源码很快就会卡住：为什么 Default 的位比 Transition 小，React 有时却继续做 Transition？为什么后台还有 Idle 工作，一组列表更新挂起后，根却没有安排任何工作？'),
      p('这不是优先级规则失效，而是“优先级最高”只回答了一部分问题。React 还要知道：哪些工作仍在等，哪些目前做不下去，哪些收到可重试信号，是否已经为一棵工作树付出了计算，以及哪些更新希望一起处理。我们沿着同一个根来拆开这些判断。'),
      p('为了能手算，先给更新起几个短名字：S 是输入对应的同步更新，D 是一项 Default 更新，A 和 B 是两条 Transition Lane，I 是 Idle。这里是在分析已经分配好 Lane 的根状态，不是在承诺“所有输入永远是 S、所有后台回调永远是 D”。Lane 的分配受事件优先级、transition 上下文等影响；本文从分配结束的地方开始。'),
      p('全文固定 React 18.3.1 的 ReactFiberLane.old.js。不要把 React 19 或 main 分支中的同名函数拿来拼接解释。选择阶段、调度回调阶段和执行 render 阶段分开读，许多看似矛盾的说法就能对上位置。配套实验允许你编辑状态快照，展示选择依据，不访问 React 私有对象，也不伪装成性能测试。'),
      { type: 'experiment', id: 'react-lane-selection', title: '打开 Lane 选择器', description: '先选内置案例，再逐项调整 pending / suspended / pinged / WIP / expired。结果列出实际走过的教学分支。' },
    ]),
    section('bits', 'Lane 是一位，Lanes 是一组；先别把它当任务编号', [
      p('一个 Lane 用一个二进制位标识，一组 Lanes 则把多个位合在一个整数里。它不是“第几个任务”，也不是队列长度。十次更新可以落在同一条 Lane，一次 render 也可以选中多条 Lane。位集合的好处是，合并、求交和排除都可以用很少的运算表达。'),
      { type: 'table', headers: ['本文名字', '18.3.1 位值', '说明'], rows: [['S / Sync', '1', '最低有效位'], ['C / InputContinuous', '4', '中间的2是另一个Lane，本文不建模'], ['D / Default', '16', '不是Scheduler的Normal编号'], ['A / TransitionLane1', '64', 'Transition组中的第一位'], ['B / TransitionLane2', '128', 'Transition组中的第二位'], ['I / Idle', '536870912', '1 << 29；图形不会画出全部空白位']] },
      p('看一个很小的集合：D | A 等于 80。这不表示“优先级80”，而是16和64两个位置都置了1。对非空集合，lanes & -lanes 提取最低有效位；在这份源码的位布局中，这一位代表集合里最高的优先级。比较的是提取出来的单一 Lane，不是拿两个 Lanes 整数直接比较大小。空集合0要单独处理。'),
      code('const D = 16, A = 64;\nconst pending = D | A;\nconsole.log(pending);            // 80\nconsole.log(pending & A);        // 64：包含A\nconsole.log(pending & ~A);       // 16：排除A\nconsole.log(pending & -pending); // 16：最高位优先级代表', '在 Node 或浏览器控制台直接运行，理解后面每一步集合变化。'),
      p('源码共安排31个位，本文只展示六类。真实实现还区分 Hydration、Retry、Offscreen 等情况。JavaScript 位运算按32位整数进行，这也是不能任意把示例扩成几十个位、再期待原运算不变的原因。业务代码不应该导入这些内部常量；它们是理解版本行为的材料，不是公共 API。'),
      ...inlineSources.highestBit,
...inlineSources.highest,
    ]),
    section('root-sets', '四个字段描述的是不同事实，不是四条独立队列', [
      { type: 'figure', src: 'figures/react-lane-selection/sets.svg', title: '同一条 Lane 可以出现在多个集合里', alt: 'A仍在pending，同时出现在suspended和pinged中。pending表示未完成，suspended表示此前受阻，pinged表示收到重试信号；它们不是互斥队列。', caption: '示意快照，没有时间比例。ping不会自动把A从suspended集合删除。' },
      p('root.pendingLanes 是尚未完成的工作集合。它告诉你“还有什么”，但不能单独回答“现在能做什么”。root.suspendedLanes 记录此前渲染遇到挂起的 Lane；它们并没有完成，所以仍在 pending 里。root.pingedLanes 记录挂起工作收到唤醒信号，可以再试。ping 是允许尝试，不保证下一次 render 一定成功，也不等于此刻已经从 suspended 删除。'),
      p('例如 A 等待一个尚未满足的依赖。根可以是 pending={A,I}、suspended={A}、pinged={}。依赖通知之后，变成 pinged={A}，而 suspended 暂时仍包含 A。源码 markRootPinged 做的是将传入 Lane 与 suspended 求交，再并入 pinged；此版本虽接收 eventTime，却没有在函数中使用它。'),
      p('这些集合会被生命周期操作调整。markRootSuspended 会清除对应 ping 与过期时间；markRootFinished 会保留剩余 pending，并重置挂起与唤醒状态。markRootUpdated 对非 Idle 的新更新还可能清空根的 suspended/pinged，使后续 render 重新尝试。因此，不能只想象“挂起一次后，直到网络回来它永远待在原集合”。'),
      p('实验中的复选框是快照编辑器，不模拟上述事件链。它约束 suspended 是 pending 的子集、pinged 是 suspended 的子集，避免最明显的无效输入；它仍不代表任意勾选组合都能由某段应用代码自然产生。读源码时要同时看“谁读字段”和“谁改字段”，这是理解调度状态的基本方法。'),
      ...inlineSources.mark,
...inlineSources.ping,
p("带入 A=64：原先 suspended=64、pinged=0，调用 markRootPinged(root,64,time) 后，64&64 仍为64，所以 pinged 变成64。若传入不在 suspended 的 D=16，16&64=0，不会凭空把 D 加成可重试工作。再调用非 Idle 的 markRootUpdated(root,16,time)，pending 会并入16，而 suspended/pinged 被清零；这解释了为什么这些字段必须按时间点读，不能当永久标签。"),
    ]),
    section('candidate', '第一轮：先走通普通候选，再加挂起条件', [
      p('getNextLanes 首先检查 pending 是否为空。空就结束，不需要往下讨论 Scheduler。非空时先把非 Idle 工作取出来。如果还存在非 Idle，它只在这个池子里找；只有完全没有非 Idle 时，才进入 Idle 分支。这意味着“非 Idle 都挂起了”不等价于“现在可以顺手做 Idle”。'),
      p('在选定池子里，先排除 suspended，寻找未挂起工作。只要这样的工作存在，就从它们中选最高优先级类别；只有未挂起集合为空，才尝试 pinged。顺序很重要：假设 D 挂起且已 ping，A 没挂起，候选仍先选 A。不能把未挂起和已 ping 全部合起来，再直接取最高位。'),
      { type: 'table', headers: ['pending', 'suspended', 'pinged', '首轮候选', '原因'], rows: [['S,A', '空', '空', 'S', '非idle未挂起，Sync最高'], ['A,I', 'A', '空', '空', '非idle仍存在，没有未挂起或ping，暂不进入idle'], ['A,I', 'A', 'A', 'A', '允许重试非idle A'], ['D,A', 'D', 'D', 'A', '先使用未挂起的A，不先选已ping的D'], ['A,B', '空', '空', 'A,B', 'Transition类别整体选取候选中的transition位']] },
      p('最后一行值得停一下。函数名 getHighestPriorityLanes 末尾有 s：发现最高位属于 Transition 后，它返回输入集合中的 TransitionLanes，而不是只返回 A。Retry 也有自己的分组处理。于是“每次只处理最低的一位”不是这份源码的完整结论。分组不会把原候选里不存在的所有 Transition 位凭空加入；它是对当前候选做掩码。'),
      p('还没有进入 WIP 比较时，nextLanes 只是本轮候选。选择结果不会直接把那些位从 pending 清掉，也没有承诺这轮已经提交。把选择和完成混在一起，就会误以为没被选中的更新丢了。更新队列怎样跳过、保留和重放，是下一层机制。'),
      ...inlineSources.candidate,
    ]),
    section('wip', '第二轮：新候选值得丢下做到一半的工作吗？', [
      p('假设列表已经在渲染 A，随后根上出现 D。只看位值，16小于64，似乎一定该中断 A。但中断有成本：已经做的部分工作可能需要放弃或重做。getNextLanes 会把候选与 wipLanes 比较。这里 WIP 表示当前进行中的 render 所使用的 Lane 集合，不是又一份 root.pendingLanes。'),
      p('比较有三个前提：WIP 非空、它与候选不同、WIP 没与 suspended 相交。若进行中的工作已经挂起，源码不再用这个条件保护它。进入比较之后，候选最高位优先级等于或低于 WIP 时，函数直接返回 WIP；没有必要为了同级或者更低级工作主动丢下已有进度。'),
      p('还有一个容易漏掉的特例：候选最高位是 Default，WIP 最高位属于 Transition 时，也继续 WIP。它覆盖了数值比较的直觉。你不必把源码注释中的刷新语义推广成所有版本的原则，但在18.3.1.old里必须承认这条明确分支。本文“Default不打断Transition”总带着前面的非挂起等条件，不是无条件口号。'),
      { type: 'table', headers: ['进行中的WIP', '新候选', 'WIP是否挂起', '返回'], rows: [['A', 'D', '否', 'A：Default特例'], ['A', 'C', '否', 'C，随后可能带上D'], ['A', 'S', '否', 'S'], ['A', 'D', '是', 'D：不进入保护WIP的比较'], ['A', 'A,B', '否', 'A：最高位同级，提前返回']] },
      p('最后一行再次提醒我们，位集合不是一个简单排序队列。候选多了 B，不一定立刻扩展当前 render。在这一分支提前返回后，后面的连续事件合批与 entanglement 扩展根本不会执行。读源码时不能先把所有注释概括成规则，再忽略 return 的位置。'),
      ...inlineSources.wip,
    ]),
    section('entangle', '第三轮：选好主组后，哪些 Lane 要一起带上？', [
      p('没有在 WIP 分支提前返回，才进入后续扩展。稳定版默认 feature flag 下，如果候选包含 InputContinuousLane，会把 pending 中的 DefaultLane 一起并入。于是 C 和 D 可以在这一批一起渲染。这里也解释了为什么 C 与 D 不能干脆合成同一个 Lane：C 能打断 Transition，而上一节的 D 特例不能。'),
      p('再往后是 entanglement，本文译成“纠缠关系”：某条 Lane 与另外一些 Lane 有合批联系。root.entangledLanes 指出哪些位参与，root.entanglements 按位索引存储关联集合。选择器从本次候选中找参与者，把它们的关联集合并入 nextLanes。关系并不是在这个循环里靠业务字段猜出来的，而是更早由更新处理路径建立。'),
      p('用实验中的 A↔B 关系观察一次：pending={A,B}，A挂起，B没挂起，首轮候选是B。若没有WIP，开启纠缠后选中A,B。你可能会问，A不是刚被排除了吗？是的，第一轮是在找优先推进的组，随后关联扩展可以带回别的Lane；不能把第一轮过滤误读成最后集合永远不含挂起位的保证。这也不保证这轮一定顺利完成。'),
      { type: 'figure', src: 'figures/react-lane-selection/order.svg', title: 'return 的位置，会改变本轮是否扩展纠缠', alt: '候选选择之后先比较WIP。保留WIP则立即返回；否则先合并连续与默认工作，再扩展预先建立的纠缠关系，最后返回集合。', caption: '左侧提前返回不是遗漏。18.3.1.old 注释明确说明：普通纠缠尽力合批，不为每次中途建立的关系都抛弃已有进度。' },
      p('如果改成 WIP={A}、A/B都没挂起，候选会是A,B，WIP比较却先返回A。即使勾着纠缠，结果仍是A。源码把普通纠缠描述为尽力而为，不能据此向业务承诺“A、B无论何时都原子提交”。真正需要跨状态的一致性，应先设计好状态关系，而不是依赖一个私有调度细节。'),
      p('关系还存在传递性。markRootEntangled 会考虑已有关系：C和A有关系，再把A和B关联时，要把相关联系传播到已有条目。本文编辑器只建模两条Transition间预先建立的对称关系，不实现通用关系维护。固定源码对照测试也只检验这个已声明的子集，不把两个复选框称为完整React纠缠算法。'),
      ...inlineSources.expand,
      ...inlineSources.entangle,
      ref('稳定版默认关闭 allowConcurrentByDefault', 'shared/ReactFeatureFlags.js', 'L145-L154'),
    ]),
    section('expired', '过期不等于改成 SyncLane，也不等于直接跳过选择', [
      p('工作等太久，React需要降低持续让出的机会。root.expiredLanes 保存过期标记，但请重新检查 getNextLanes：这份18.3.1.old函数没有“先返回expired”这个分支。把其他版本实现、另一篇文章的伪代码直接套进来，会在这里得到错误答案。'),
      p('ensureRootIsScheduled 会先调用 markStarvedLanesAsExpired，再调用 getNextLanes。标记过期并不意味着把原来64的Transition位变成1，也不会凭空让不存在的工作进入pending。选择结束后，在 performConcurrentWorkOnRoot 里，React检查所选集合是否包含 expired，从而决定走并发 render 还是同步 render。过期主要影响这里的执行路径。'),
      p('因此，pending={A}时，不管expired为空还是A，选择结果都可以是A；区别是，A没有过期且满足其他条件时允许并发render，A过期后该路径转为同步render。再给pending加上S，S仍可先被选中；给A标过期不是宣告“所有更高优先级工作都不能再先做”。'),
      p('过期时间也不是任意任务创建后统一倒数。markStarvedLanesAsExpired 遍历pending：尚无过期时间的Lane，如果没挂起或已经ping，才计算新的过期时间；已经设置时间且达到期限，则标记expired。markRootSuspended又会清空对应过期时间。源码对不同类别给出不同策略：Sync/连续类为250ms，Default/Transition类为5000ms，Retry和Idle等在此函数里不设有效期限。它们是该版本防饥饿策略，不是公共API时限。'),
      p('用户能感受到的等待还包含浏览器任务排队、执行和绘制。不能把5000ms当作“transition一定在5秒内显示”，更不能把expired理解成“React已经完成这次更新”。悬挂依赖未满足时，换同步执行也不会替你制造缺失的数据。'),
      ...inlineSources.expireTime,
...inlineSources.starved,
      ref('先标记过期，再选择Lane', 'react-reconciler/src/ReactFiberWorkLoop.old.js', 'L691-L705'),
      ...inlineSources.expired,
    ]),
    section('scheduler', 'Lane 与 Scheduler Priority：两套标尺，中间有映射', [
      p('到这里，我们得到了“本轮要做哪些更新”。接下来才问“怎样安排根的执行回调”。root.callbackPriority 使用所选集合最高位代表回调优先级；Scheduler 接收的则是 Immediate、UserBlocking、Normal、Idle 这些类别。它们服务于不同层级，不能把Lane值64传给Scheduler后声称得到了Transition调度。'),
      p('稳定版这条路径里，SyncLane是特殊情况：它进入React内部同步回调队列，并在支持时安排微任务刷新；不能概括成所有Lane都会创建普通Scheduler任务。非Sync路径先经 lanesToEventPriority，再映射到Scheduler类别。Default和Transition在这个映射中都可能落到Normal，但React仍保留各自的Lane，用于根内选择、WIP比较和更新筛选。'),
      p('这是个很有用的反证：如果两者是同一优先级系统，Default与Transition映射成Normal以后，前面的差异就会丢失。实际没有，因为Scheduler决定什么时候有机会回调，React的Lane系统决定回调里选择哪些更新。即便回调名叫 performConcurrentWorkOnRoot，内部也可能因为blocking、expired或者Scheduler的didTimeout而调用renderRootSync。'),
      { type: 'table', headers: ['已选择的集合（本文子集）', '安排入口', '稳定默认路径的典型判断'], rows: [['S', 'React同步回调队列', '同步render'], ['C或C,D', 'Scheduler UserBlocking', 'blocking，走同步render'], ['D', 'Scheduler Normal', 'blocking，走同步render'], ['A或A,B', 'Scheduler Normal', '没有expired、didTimeout等阻碍时允许并发render'], ['I', 'Scheduler Idle', '满足条件时允许并发render']] },
      p('这里的“同步render”描述不在工作循环中主动让出，并不意味着调用setState那一行一定立刻写DOM。调度回调什么时候运行、render是否中断、commit什么时候发生，是相关但不同的问题。把它们都缩成“同步更新”四个字，经常会把解释带偏。'),
      ...inlineSources.priority,
      ref('根回调的Sync特殊路径与Scheduler映射', 'react-reconciler/src/ReactFiberWorkLoop.old.js', 'L717-L821'),
      ...inlineSources.blocking,
    ]),
    section('slice', '允许让出，不是每5ms强制掐断', [
      p('并发render需要执行到检查让出的地方，才有机会把主线程交回宿主环境。一个组件函数里的长同步循环不会因为选中了Transition Lane就被强行截断；选择器也不运行计时器，更不会把六个位转换成六个线程。实验页面显示“允许让出”，故意没有显示“一定切成几段”。'),
      p('Scheduler的预算和shouldYield判断需要结合版本、宿主配置与当次执行情况理解。常见的5ms描述是一种实现策略的简写，不是保证每过5ms就出现一次可见切片。单位工作自身耗时、是否已经超时、是否走同步render，都会改变观察结果。Lane选择实验回答的是集合与分支，不是实时系统的抢占定理。'),
      p('如果你的目标是解释输入卡顿，应回到真实页面测事件处理、render和提交，而不是拿这里的mask当性能分数。本篇没有毫秒提升数据：不同集合的结果是确定性逻辑输出，不代表某台手机会更快或更慢。理解机制可以指导实验，但不能替代实验。'),
      ref('并发工作循环只在工作单位之间检查shouldYield', 'react-reconciler/src/ReactFiberWorkLoop.old.js', 'L1824-L1831'),
    ]),
    section('run', '理解检查、实验输入与核验边界', [
p("检查一：pending={D,A}，suspended={D}，pinged={D}，WIP为空，谁先被选？解析：未挂起的非 Idle 集合为{A}，因此先选 A；只有未挂起集合为空时才尝试已 ping 的集合。把两者先合并再按位排序，会错误选 D。这个答案可直接沿正文第一段真实函数得到。"),
p("检查二：pending={A,B}，都未挂起，WIP={A}，A与B已经纠缠，是否选A,B？解析：初始候选为两个 Transition 位；WIP非空、不同且未挂起，两边最高位都为 A，因此在 WIP 分支提前返回 A。后面的纠缠循环没有执行。这里体现的是控制流，不能把源码后半段的规则提前应用。"),

      p('先在站内打开实验。预设“初始：输入和列表”会选S；切到“全部挂起也不选Idle”会返回空。不要一上来同时改所有勾选：先勾上A的pinged，观察从空变成A；再去掉A的pending，观察只剩I时才能选Idle。这个顺序能区分“没有可尝试的非idle工作”和“完全没有非idle工作”。'),
      p('继续选“Default不打断Transition”，观察WIP提前返回A。把Default换成Continuous，结果应变成C，若保留pending D还会带上D。再选“纠缠扩展候选”与“WIP提前返回”对照：前者能扩展到A,B，后者在到达纠缠循环之前就返回A。最后切换expired，确认它改变执行说明，而没有把选中的mask从64改为1。'),
      { type: 'code', language: 'sh', filename: '终端', kind: 'runnable', purpose: '从完整仓库根目录运行。独立ZIP解压后进入react-lane-selection即可，从npm ci开始。', code: 'cd examples/react-lane-selection\nnvm use\nnpm ci\nnpm test\nnpm run build\nnpm run dev' },
      p('Node固定22.12.0；不用nvm时手动切换对应Node版本，跳过nvm use。安装依赖需要网络。独立项目有lockfile、main.tsx与index.html，启动后打开终端打印的地址；站内实验室直接载入同一份App.tsx，不要求浏览器下载Node依赖。手机表格允许横向滚动，每个复选框都有明确的Lane和字段标签。'),
      p('测试不是只检查“结果包含某个词”。它读取仓库内保存的v18.3.1源码快照，验证SHA-256，再取出getHighestPriorityLanes与getNextLanes的原函数体，仅移除Flow签名，提供固定常量与辅助函数。教学选择器与这两段原逻辑在声明的六Lane子集上比较：遍历4^6个可用性快照，组合选定WIP与两种纠缠开关，并保留具体反例断言。'),
      p('这里的对照提供比“我看起来写对了”更强的证据，但仍有边界：它只验证选择函数在模型输入范围内的结果，不证明完整React生命周期，也不证明每个快照都能由真实组件事件产生。测试中的4^6来自每条Lane四种状态：不存在、未挂起、挂起未ping、挂起且ping，不是四种业务更新类型。'),
      { type: 'callout', title: '验证口径', text: '自动测试验证位运算、已知分支、源码子集对照和服务端初始渲染；TypeScript与生产构建另行验证。交互点击与手机视觉效果需在集成页面验收，不能用SSR字符串检查替代。详细环境、命令与证据表见VERIFICATION.md。' },
    ]),
    section('debug', '以后看到“不先做它”，沿着这五步排查', [
      { type: 'list', ordered: true, items: ['确认对应版本与源码分支，先找到pending中的实际Lane，不从业务名字猜。', '检查非idle池、suspended与pinged，分清未挂起优先和已ping兜底。', '检查是否已有WIP、WIP是否挂起，尤其注意Default例外与提前return。', '查看连续事件合批和预先建立的纠缠关系，别把初始候选当最终集合。', '最后再看回调映射、blocking、expired和didTimeout，解释执行方式。'] },
      p('开头的两个疑问现在可以具体回答：Default有时不先做，是因为进行中的Transition受到了明确的保留分支保护；Idle有时不做，是因为根上仍然存在非idle工作，即使那些工作暂时全部挂起。它们都不是“React随便调度”，而是有输入条件的选择策略。'),
      p('你也获得了一个更可靠的阅读习惯：先问某函数返回的是什么，再问返回值由谁消费。getNextLanes返回工作集合；ensureRootIsScheduled安排根回调；performConcurrentWorkOnRoot进一步决定render路径。把这些层次分清之后，Lane不再是一串需要背诵的二进制数字，而是一组可以推导、实验和核验的状态。'),
    ]),
  ],
  references: [
    { title: 'React 18.3.1 — ReactFiberLane.old.js', url: 'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberLane.old.js' },
    { title: 'React 18.3.1 — ReactFiberWorkLoop.old.js', url: 'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js' },
    { title: 'React 18.3.1 — ReactEventPriorities.old.js', url: 'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactEventPriorities.old.js' },
  ],
};
