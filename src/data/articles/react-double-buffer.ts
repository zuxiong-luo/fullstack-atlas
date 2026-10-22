import type {Article} from '../articleTypes';
export const reactDoubleBufferArticle:Article={
  "id": "react-double-buffer",
  "topic": "react",
  "title": "current 与 work-in-progress 怎样轮换：沿三轮更新读懂双缓冲",
  "description": "从任务标题编辑出发，逐段读 createWorkInProgress、useFiber 和 root.current 切换，区分新建节点、复用对象、沿用引用与提交结果。",
  "minutes": 32,
  "labMinutes": 25,
  "tags": [
    "React 18.3.1",
    "Fiber",
    "双缓冲",
    "源码"
  ],
  "kind": "tutorial",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-22",
  "scope": "C2；普通客户端任务节点的首次挂载与身份稳定更新。教学模型从已挂载任务开始，不模拟HostRoot、调度、Hook重放、Suspense或异常恢复。",
  "prerequisites": [
    "已读Fiber结构专题",
    "理解JavaScript引用相等与浅复制",
    "理解render和commit的区别"
  ],
  "questionIds": [],
  "experiment": "react",
  "examples": [
    {
      "label": "双缓冲模型完整项目",
      "path": "react-double-buffer.zip"
    },
    {
      "label": "源码与验证记录",
      "path": "react-double-buffer/VERIFICATION.md"
    }
  ],
  "sections": [
    {
      "id": "problem",
      "title": "编辑任务时，React 为什么不直接改当前树",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "任务看板上有一张卡片，标题是“任务 A”。你输入新标题，React 开始计算新的组件输出，但用户仍然需要看到一个完整的旧界面。如果计算中途出现更紧急的更新，尚未完成的结果还可能被放弃。此时要保存两件不同的东西：已经提交、可以作为当前依据的状态，以及正在尝试计算的下一版工作。"
        },
        {
          "type": "paragraph",
          "text": "双缓冲解决的是这个组织问题。它不是在内存里保存两张屏幕截图，也不意味着每次更新把整个对象图深拷贝一遍。React 为同一逻辑节点保留 current 与 work-in-progress 的对应关系，在需要时创建另一份工作节点，后续又能复用它。读完本文，你应该能沿着三轮操作回答：哪一个对象新建了、哪些引用沿用了、什么时候真正成为 current。"
        },
        {
          "type": "paragraph",
          "text": "本篇接着 C1 的节点结构往下走，固定 React 18.3.1 的 old reconciler。我们只追一个身份稳定的任务节点，不把 key 改变后的重建混进“复用”实验。源码节选是实际版本内容；页面步进器则明确是教学模型，两种证据分开使用。"
        },
        {
          "type": "experiment",
          "id": "react-double-buffer",
          "title": "逐步操作双缓冲模型",
          "description": "准备 → 完成 → 提交，连续做两轮，再准备并放弃一轮。观察F1/F2、引用相等和可见标题。"
        }
      ]
    },
    {
      "id": "first-mount",
      "title": "先纠正起点：根与普通任务节点并不同时拥有 alternate",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "“首次渲染没有 current，首次更新才创建 alternate”是一句容易过度简化的话。对于新挂载的普通函数组件，协调时确实可能没有旧 Fiber，初次创建时 alternate 为 null。但 HostRoot 不同：创建根时就先创建一个未初始化的根 Fiber，并把 root.current 指向它。不要把子组件的挂载状态套到根上。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiberRoot.old.js:165–171",
          "purpose": "createFiberRoot 建立最初的根节点；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  const uninitializedFiber = createHostRootFiber(\n    tag,\n    isStrictMode,\n    concurrentUpdatesByDefaultOverride,\n  );\n  root.current = uninitializedFiber;\n  uninitializedFiber.stateNode = root;"
        },
        {
          "type": "reference",
          "title": "createFiberRoot 建立最初的根节点",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberRoot.old.js#L165-L171"
        },
        {
          "type": "paragraph",
          "text": "初次从根开始准备渲染时，prepareFreshStack 仍会根据 root.current 创建根的工作版本。换句话说，第一次页面挂载过程中，根可以已经形成一对对应节点，而刚加入的任务子节点只有自己的第一份 Fiber。这两种情况同时存在，并不矛盾。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:1472–1474",
          "purpose": "prepareFreshStack 从当前根准备工作；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  const rootWorkInProgress = createWorkInProgress(root.current, null);\n  workInProgress = rootWorkInProgress;\n  workInProgressRootRenderLanes = subtreeRenderLanes = workInProgressRootIncludedLanes = lanes;"
        },
        {
          "type": "reference",
          "title": "prepareFreshStack 从当前根准备工作",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1472-L1474"
        },
        {
          "type": "paragraph",
          "text": "下面的 F1、F2 专指已经完成首次挂载的某个任务组件，F1 目前是它的 current，F1.alternate 还是 null。教学模型故意从这里开始，避免用一个两方框模型假装解释完整根初始化。首次挂载之后，我们准备第一次标题更新，才走到这个任务节点首次建立伙伴的分支。"
        }
      ]
    },
    {
      "id": "allocate",
      "title": "第一次更新：找到旧节点，按需建立伙伴",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiber.old.js:249–265",
          "purpose": "createWorkInProgress 读取alternate，没有时创建；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {\n  let workInProgress = current.alternate;\n  if (workInProgress === null) {\n    // We use a double buffering pooling technique because we know that we'll\n    // only ever need at most two versions of a tree. We pool the \"other\" unused\n    // node that we're free to reuse. This is lazily created to avoid allocating\n    // extra objects for things that are never updated. It also allow us to\n    // reclaim the extra memory if needed.\n    workInProgress = createFiber(\n      current.tag,\n      pendingProps,\n      current.key,\n      current.mode,\n    );\n    workInProgress.elementType = current.elementType;\n    workInProgress.type = current.type;\n    workInProgress.stateNode = current.stateNode;"
        },
        {
          "type": "reference",
          "title": "createWorkInProgress 读取alternate，没有时创建",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L249-L265"
        },
        {
          "type": "paragraph",
          "text": "函数输入是一个已有 current 节点和本次 pendingProps，返回的是本轮工作节点。先检查 current.alternate：存在就能考虑重用，不存在才调用 createFiber。新节点继承 tag、key、mode 等身份信息，而 pendingProps 使用本次传入值。这是创建一个工作节点，不是重新声明业务组件身份；已有状态是否延续，仍取决于前面的协调匹配。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiber.old.js:275–276",
          "purpose": "建立双向alternate连接；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "    workInProgress.alternate = current;\n    current.alternate = workInProgress;"
        },
        {
          "type": "reference",
          "title": "建立双向alternate连接",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L275-L276"
        },
        {
          "type": "paragraph",
          "text": "互相设置 alternate 之后，F1 能找到 F2，F2 也能找到 F1。对宿主节点而言，stateNode 可以继续指向原 DOM；这进一步说明两份 Fiber 不代表两份可见 DOM。函数组件通常没有对应组件实例，更不能把 stateNode 统一画成另一份页面。"
        },
        {
          "type": "figure",
          "src": "figures/react-double-buffer/rounds.svg",
          "title": "同一个任务经过挂载和两次提交",
          "alt": "挂载后current是F1且无伙伴；第一次更新准备F2，提交后current变F2；第二次更新复用F1，提交后current变F1。",
          "caption": "只画一个已挂载任务对应的两份Fiber；省略HostRoot和整棵子树。对象名字是教学标识。"
        }
      ]
    },
    {
      "id": "reuse",
      "title": "第二次更新：复用对象之前，为什么必须清理",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiber.old.js:278–289",
          "purpose": "复用分支更新输入并清理本轮工作标记；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "    workInProgress.pendingProps = pendingProps;\n    // Needed because Blocks store data on type.\n    workInProgress.type = current.type;\n\n    // We already have an alternate.\n    // Reset the effect tag.\n    workInProgress.flags = NoFlags;\n\n    // The effects are no longer valid.\n    workInProgress.subtreeFlags = NoFlags;\n    workInProgress.deletions = null;\n"
        },
        {
          "type": "reference",
          "title": "复用分支更新输入并清理本轮工作标记",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L278-L289"
        },
        {
          "type": "paragraph",
          "text": "第一次提交后 F2 成为 current，F1 仍通过 alternate 与它关联。再次准备更新，createWorkInProgress(F2, nextProps) 找到的就是旧 F1。省下的是再分配一个对应节点的开销，不是省略这轮计算。如果把 F1 上上一轮的临时提交标记原样留下，可能把已经完成过的删除或变更当成新一轮工作。"
        },
        {
          "type": "paragraph",
          "text": "所以复用分支先清空 flags、subtreeFlags 和 deletions；随后公共路径又从当前版本保留静态标记。注意这不是矛盾：静态标记描述跨渲染仍有意义的属性，本轮动态工作则需要重新确定。“重置 flags”不能写成“最后所有 flags 都为零”。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiber.old.js:300–309",
          "purpose": "静态标记与当前版本的状态引用沿用；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  // Reset all effects except static ones.\n  // Static effects are not specific to a render.\n  workInProgress.flags = current.flags & StaticMask;\n  workInProgress.childLanes = current.childLanes;\n  workInProgress.lanes = current.lanes;\n\n  workInProgress.child = current.child;\n  workInProgress.memoizedProps = current.memoizedProps;\n  workInProgress.memoizedState = current.memoizedState;\n  workInProgress.updateQueue = current.updateQueue;"
        },
        {
          "type": "reference",
          "title": "静态标记与当前版本的状态引用沿用",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L300-L309"
        },
        {
          "type": "paragraph",
          "text": "lanes 和 childLanes 此处从 current 复制，而不是全清空。它们描述待处理工作，不能因为复用了另一个对象就丢掉。后续开始处理、完成、根级清理有各自更新路径；仅看这一段初始化，不足以推断本轮最后还剩哪些优先级。"
        },
        {
          "type": "paragraph",
          "text": "pendingProps 是这轮准备处理的输入，memoizedProps 起初沿用当前版本已处理输入。两者暂时不同非常正常。一个工作对象刚准备好，并不意味着新输入已经计算完成；从“准备”跳到“提交”的错误模型会把这两个时刻揉成一个。"
        }
      ]
    },
    {
      "id": "references",
      "title": "沿用引用，不等于两份互不相干的深拷贝",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "观察上面的 child、memoizedState、updateQueue 赋值：它们直接沿用引用。这个起点让 React 不必预先克隆每一层对象，但后续具体机制必须负责自己的复制与更新。对于函数组件，memoizedState 可能是 Hook 链表入口，不能把一次引用赋值误解为状态 Hook 的全部更新算法。"
        },
        {
          "type": "paragraph",
          "text": "如果你在业务代码里原地修改旧状态对象，双缓冲并不会替你隔离污染。两个版本在准备阶段可能共同引用那个对象，闭包也可能读到它。不可变更新不是为了满足某个形式要求，而是在有快照和复用的系统里保住旧版本的语义。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiber.old.js:311–320",
          "purpose": "dependencies外层对象单独复制；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  // Clone the dependencies object. This is mutated during the render phase, so\n  // it cannot be shared with the current fiber.\n  const currentDependencies = current.dependencies;\n  workInProgress.dependencies =\n    currentDependencies === null\n      ? null\n      : {\n          lanes: currentDependencies.lanes,\n          firstContext: currentDependencies.firstContext,\n        };"
        },
        {
          "type": "reference",
          "title": "dependencies外层对象单独复制",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L311-L320"
        },
        {
          "type": "paragraph",
          "text": "这里反而专门复制 dependencies 外壳，因为渲染阶段会修改它。firstContext 仍沿用原引用，这也不是深拷贝。应当按字段的使用方式解释复制层次：工作节点复用、字段沿用、容器浅复制、后续链表克隆是不同层级的操作。只说“两棵完全独立的树”会隐藏这些关系。"
        },
        {
          "type": "table",
          "headers": [
            "准备结束时",
            "关系",
            "不代表什么"
          ],
          "rows": [
            [
              "child / memoizedState / updateQueue",
              "起初沿用 current 的引用",
              "不能推导后续都不会改动或复制"
            ],
            [
              "dependencies",
              "新外壳，firstContext沿用",
              "不是递归复制全部Context链"
            ],
            [
              "flags / subtreeFlags / deletions",
              "保留静态位，重置本轮临时信息",
              "不是保留上一轮所有副作用"
            ],
            [
              "alternate",
              "对应节点相互指向",
              "不是跨任意key/type自动保持身份"
            ]
          ]
        }
      ]
    },
    {
      "id": "use-fiber",
      "title": "useFiber 为什么还要清掉 sibling 和 index",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactChildFiber.old.js:328–335",
          "purpose": "useFiber在协调中准备可复用节点；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  function useFiber(fiber: Fiber, pendingProps: mixed): Fiber {\n    // We currently set sibling to null and index to 0 here because it is easy\n    // to forget to do before returning it. E.g. for the single child case.\n    const clone = createWorkInProgress(fiber, pendingProps);\n    clone.index = 0;\n    clone.sibling = null;\n    return clone;\n  }"
        },
        {
          "type": "reference",
          "title": "useFiber在协调中准备可复用节点",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L328-L335"
        },
        {
          "type": "paragraph",
          "text": "createWorkInProgress 不是只会由根直接调用。协调匹配到可复用的旧孩子时，useFiber 包装它，随后把 index 设为 0、sibling 设为 null，再把节点交还给协调过程。因为新孩子集合的顺序不一定与旧集合一致，不能顺手把旧 sibling 链当成新列表。新的位置和兄弟关系需要由调用方接好。"
        },
        {
          "type": "paragraph",
          "text": "例如旧顺序 A、B，新顺序只有 A。若复用 A 后仍把旧 B 当成它的新兄弟，就把已经不在新描述里的节点错误带了回来。这里清理连接是构建新结构的防护步骤；它本身不完成全部删除算法，也不判断所有 key/type 匹配规则，那部分交给数组协调专题。"
        },
        {
          "type": "paragraph",
          "text": "同样，起初 child 指向当前版本的孩子，也不意味着之后完全跳过这个子树。bailoutOnAlreadyFinishedWork 会检查子树是否还有本轮工作：没有就可能直接返回；有则克隆孩子的工作节点并继续进入子树。跳过当前组件计算与整棵子树不用处理不是一回事。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiberBeginWork.old.js:3382–3403",
          "purpose": "bailout仍需判断childLanes并按需克隆孩子；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  // Check if the children have any pending work.\n  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {\n    // The children don't have any work either. We can skip them.\n    // TODO: Once we add back resuming, we should check if the children are\n    // a work-in-progress set. If so, we need to transfer their effects.\n\n    if (enableLazyContextPropagation && current !== null) {\n      // Before bailing out, check if there are any context changes in\n      // the children.\n      lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);\n      if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {\n        return null;\n      }\n    } else {\n      return null;\n    }\n  }\n\n  // This fiber doesn't have work, but its subtree does. Clone the child\n  // fibers and continue.\n  cloneChildFibers(current, workInProgress);\n  return workInProgress.child;"
        },
        {
          "type": "reference",
          "title": "bailout仍需判断childLanes并按需克隆孩子",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberBeginWork.old.js#L3382-L3403"
        },
        {
          "type": "paragraph",
          "text": "还有一个进一步的边界：bailoutOnAlreadyFinishedWork 在已有 current 时会把 dependencies 重新沿用回 current.dependencies。因此前文说的外壳复制只描述 createWorkInProgress 的准备结束点，不能把它升级成“整轮任何时刻 dependencies 都不同”的不变量。"
        },
        {
          "type": "paragraph",
          "text": "cloneChildFibers 为直接孩子调用 createWorkInProgress，并重建 return/sibling 连接。它不是入口一次递归复制所有后代。读到 clone 这个名字，也仍然要检查调用范围：复制当前这一层、后续按需深入，与无条件深拷贝整树有本质区别。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiberBeginWork.old.js:3370–3373",
          "purpose": "bailout重新沿用当前dependencies；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  if (current !== null) {\n    // Reuse previous dependencies\n    workInProgress.dependencies = current.dependencies;\n  }"
        },
        {
          "type": "reference",
          "title": "bailout重新沿用当前dependencies",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberBeginWork.old.js#L3370-L3373"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactChildFiber.old.js:1372–1386",
          "purpose": "cloneChildFibers重建直接孩子的工作连接；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "  let currentChild = workInProgress.child;\n  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);\n  workInProgress.child = newChild;\n\n  newChild.return = workInProgress;\n  while (currentChild.sibling !== null) {\n    currentChild = currentChild.sibling;\n    newChild = newChild.sibling = createWorkInProgress(\n      currentChild,\n      currentChild.pendingProps,\n    );\n    newChild.return = workInProgress;\n  }\n  newChild.sibling = null;\n}"
        },
        {
          "type": "reference",
          "title": "cloneChildFibers重建直接孩子的工作连接",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L1372-L1386"
        }
      ]
    },
    {
      "id": "commit",
      "title": "完成计算之后，哪一刻才切换current",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactFiberWorkLoop.old.js:2150–2165",
          "purpose": "mutation后才把完成树设为current；React v18.3.1 真实节选，MIT License。",
          "kind": "excerpt",
          "code": "\n    // The next phase is the mutation phase, where we mutate the host tree.\n    commitMutationEffects(root, finishedWork, lanes);\n\n    if (enableCreateEventHandleAPI) {\n      if (shouldFireAfterActiveInstanceBlur) {\n        afterActiveInstanceBlur();\n      }\n    }\n    resetAfterCommit(root.containerInfo);\n\n    // The work-in-progress tree is now the current tree. This must come after\n    // the mutation phase, so that the previous tree is still current during\n    // componentWillUnmount, but before the layout phase, so that the finished\n    // work is current during componentDidMount/Update.\n    root.current = finishedWork;"
        },
        {
          "type": "reference",
          "title": "mutation后才把完成树设为current",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2150-L2165"
        },
        {
          "type": "paragraph",
          "text": "这段顺序要连着读：先执行 mutation 相关工作，再 root.current = finishedWork，随后进入 layout 工作。因此“current切换会自动更新DOM”是不对的；更新宿主的逻辑已经在提交路径里执行，根指针切换是在内部确认哪一版现在作为当前树。另一方面，“整个commit结束之后才切换”也不够精确，因为布局阶段开始前它已经切换了。"
        },
        {
          "type": "paragraph",
          "text": "双缓冲提供了可尝试的工作空间，但并不自动构成完整的事务回滚系统。组件 render 若偷偷修改全局对象、发送请求，放弃工作时 React 不能撤销这些外部行为。DOM提交也有自己的异常处理路径，不能把双缓冲类比为数据库事务然后推导出所有原子性保证。"
        },
        {
          "type": "paragraph",
          "text": "并发 render 可以在工作单元边界让出，未完成工作可能继续，也可能重新准备。中断不等于每次丢掉整棵树，放弃也不等于立即删除所有对应对象；下一次准备时可重用另一个节点并重新初始化有关信息。具体恢复、错误、Suspense路径各有处理，不能只靠两个指针给出统一结论。"
        },
        {
          "type": "paragraph",
          "text": "我们的模型把放弃操作写成清除本轮work指针，保持current和visible不变。它只验证“未提交结果不得替代当前结果”和“工作对象可被再次准备”的规则，不模拟React的中断判断，也不声称浏览器能观察到这些内部F1/F2身份。"
        }
      ]
    },
    {
      "id": "lab",
      "title": "手算三轮，再用测试检查信息有没有丢",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先准备标题“任务 B”，观察current仍为F1，work为F2，child与queue引用相等，dependencies外壳不相等。点击完成计算，模型flags增加更新位，可见标题仍是任务A；提交之后current变F2，可见标题才变任务B。第二轮输入任务C，准备时work应当是F1，提交后又轮到F1，累计创建节点数保持2。"
        },
        {
          "type": "paragraph",
          "text": "第三轮准备一个错误标题并完成，然后点击放弃。当前标题和current都不应改变。接着重新准备正确标题，模型复用之前的工作对象，但清掉它的临时标记与删除记录，从current重新取得已处理输入。测试还故意在未完成时调用commit，要求抛错；这是模型的验收约束，不是对React公开API增加了一条方法。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "独立模型项目，固定依赖并从干净安装验证。",
          "code": "cd examples/react-double-buffer\nnpm ci\nnpm test\nnpm run build\nnpm run dev"
        },
        {
          "type": "paragraph",
          "text": "模型使用真正的JavaScript对象和引用相等断言，但这些对象由我们创建，并非真实React的Fiber。界面只是用React显示模型结果。我们没有读取DOM私有字段，没有给React源码插桩，测试通过证明模型规则自洽，不证明某次真实React渲染发生了几次中断或创建了多少对象。"
        },
        {
          "type": "paragraph",
          "text": "模型也没有复制全部字段：不包含HostRoot生命周期、Hooks更新队列、Lane选择、effects执行、Context读取或宿主DOM变更。选择保留pending/memoized输入、alternate、少量引用与标记，是为了让本章承诺的对象轮换可以看见。想验证真实React行为，需要结合相应版本源码以及面向公开行为的实验，不能把模型界面的数字当性能证据。"
        },
        {
          "type": "paragraph",
          "text": "从这三轮回看，双缓冲不是“拷贝树然后替换页面”这么简单。它是按身份找到对应节点、按字段生命周期准备工作、按需要处理子树，再在提交边界切换当前版本的一组协作。理解这条链之后，后面读bailout、Hook重放和列表协调时，就不会再把复用、跳过与提交当成同一个动作。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "React18.3.1 ReactFiber.old.js",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js"
    },
    {
      "title": "React18.3.1 ReactChildFiber.old.js",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js"
    },
    {
      "title": "React18.3.1 ReactFiberWorkLoop.old.js",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js"
    },
    {
      "title": "React18.3.1 ReactFiberRoot.old.js",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberRoot.old.js"
    },
    {
      "title": "React18.3.1 ReactFiberBeginWork.old.js",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberBeginWork.old.js"
    }
  ]
};
