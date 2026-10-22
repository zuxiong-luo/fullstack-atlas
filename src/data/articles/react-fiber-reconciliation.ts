import type {Article} from '../articleTypes';
export const reactFiberReconciliationArticle: Article = {
  "id": "react-fiber-reconciliation",
  "topic": "react",
  "title": "Fiber 与协调：React 怎样组织并完成一次更新",
  "description": "从Fiber的概念、作用和结构讲起，串起双缓冲、Hook更新队列、列表Diff、工作循环与提交；用源码、逐步推演和真实React实验验证一次更新。",
  "minutes": 75,
  "labMinutes": 35,
  "tags": [
    "React 18.3.1",
    "七篇系列·第4篇",
    "Fiber",
    "协调",
    "Diff",
    "提交"
  ],
  "kind": "series",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-22",
  "scope": "普通客户端函数组件的正常更新路径；协调源码以old reconciler为基准，不展开SSR/hydration、Suspense恢复或完整调度算法。",
  "prerequisites": [
    "组件、props、useState、key和状态快照",
    "了解Effect的setup/cleanup用法；无需预先懂Fiber"
  ],
  "questionIds": [],
  "experiment": "react",
  "sections": [
    {
      "id": "concept",
      "title": "Fiber 是什么：节点、树与工作记录",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Fiber是React内部表示节点、组织渲染工作的数据结构。在React 18.3.1中，它的具体形态是JavaScript对象：对象字段记录节点类型、输入、状态、树关系以及待处理工作。多个Fiber通过引用连接起来，构成React处理界面的工作树。先把它理解为一套内部记录，再讨论它为什么支持分段处理和复用。"
        },
        {
          "type": "paragraph",
          "text": "资料有时把Fiber称为“工作单元”，有时称为“架构”。前者强调工作循环围绕节点推进，后者指使用这些结构组织更新的整体实现。Fiber对象不会自己执行，也不是浏览器线程。调用组件、选择下一节点、让出执行权和提交变更，仍然由React相关函数完成。"
        },
        {
          "type": "paragraph",
          "text": "React元素、Fiber和DOM分别承担不同职责。<Row id=\"A\" />生成本轮需要什么界面的描述；Row对应的Fiber关联组件身份与状态；Row返回的li、button等宿主元素又有各自的Fiber，最终对应浏览器节点。一个函数组件Fiber通常没有独立的DOM外壳，所以Fiber树不能直接等同于DOM树。"
        },
        {
          "type": "paragraph",
          "text": "本篇是七篇系列中的第四篇，可以在读完第一篇后学习；需要理解函数组件、useState、key和基础Effect用法，不要求提前懂调度源码。所有内部代码固定为React/React DOM 18.3.1的old reconciler，源文件来自官方v18.3.1 tag。这里聚焦普通客户端更新，Suspense恢复、hydration和完整Scheduler算法留给各自主题，不用没有解释的特殊分支替代主线。"
        }
      ]
    },
    {
      "id": "purpose",
      "title": "为什么需要 Fiber：把连续计算组织成可追踪的工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一次组件函数调用结束后，React仍要保留它的状态，下次更新还要知道它与哪些父子节点相连。页面变大以后，还需要区分哪些节点有更新、哪些子树可以跳过、哪些宿主变化应该留到提交时处理。这些信息不能只藏在一次函数调用的局部变量里，必须有跨执行存在的组织结构。"
        },
        {
          "type": "paragraph",
          "text": "如果处理整棵树完全依靠一条连续递归调用，进度主要留在JavaScript调用栈中，React无法把任意正在执行的函数从中间暂停并原样恢复。Fiber把树关系与工作记录显式放在对象里，让外层工作循环能按单元推进。在允许并发让出的路径中，循环可以在单元之间把控制权还给宿主，并在后来继续或重启工作。"
        },
        {
          "type": "table",
          "headers": [
            "作用",
            "结构支持",
            "限制"
          ],
          "rows": [
            [
              "保留节点信息",
              "类型、props、状态和队列引用",
              "不等于把全部业务数据放进一个Fiber字段"
            ],
            [
              "组织遍历",
              "child、sibling、return",
              "指针本身不具备调度能力"
            ],
            [
              "准备下一版",
              "current与work-in-progress对应关系",
              "不是深拷贝整棵树，也不是两套DOM"
            ],
            [
              "记录后续工作",
              "lanes、flags和子树摘要",
              "更新优先级与提交标记不是同一种信息"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "可中断并不意味着React能打断函数组件里正在执行的for循环。同步工作循环也使用Fiber，但不会像并发循环那样按让出条件分段。还有提交阶段：本篇讨论的常规DOM提交，不是对每个DOM操作都按render工作单元随意切片。不要从“Fiber支持调度”推导出“所有工作都异步、都能中断、都会更快”。"
        }
      ]
    },
    {
      "id": "structure",
      "title": "Fiber 的结构：先看树，再看字段",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "我们沿用阅读清单，父组件App里有一个ul，ul下面是A、B、C三个Row；每行自己保存计数并返回li。Fiber.child指向第一个孩子，后面的同级节点通过sibling连接，return指向父节点。return是字段名，不是JavaScript的return语句。A的sibling是B，不代表B是A的孩子。"
        },
        {
          "type": "figure",
          "src": "figures/react-fiber-reconciliation/tree.svg",
          "title": "工作树中的父、子与兄弟",
          "alt": "ul的child指向Row A，A的sibling指向Row B再到Row C，三个Row的return都指回ul；Row A有li宿主孩子。",
          "caption": "省略HostRoot、App和其余宿主后代；图表示逻辑关系，不是DOM的一一映射。"
        },
        {
          "type": "table",
          "headers": [
            "字段组",
            "含义",
            "在过程中的用处"
          ],
          "rows": [
            [
              "tag / key / elementType / type",
              "类别、同级身份信息和类型",
              "决定按哪类节点处理，以及是否能延续旧身份"
            ],
            [
              "return / child / sibling / index",
              "父子兄弟与所在位置",
              "遍历和重新组织兄弟链"
            ],
            [
              "pendingProps / memoizedProps",
              "待处理输入与已处理输入",
              "计算这轮输出及比较已有输入"
            ],
            [
              "memoizedState / updateQueue",
              "节点类别相关的状态与队列结构",
              "函数组件与根/类组件的具体结构不同"
            ],
            [
              "lanes / childLanes",
              "本节点与子树尚有的工作分类集合",
              "支持选择更新及判断子树是否仍需处理"
            ],
            [
              "flags / subtreeFlags / deletions",
              "工作标记、子树摘要与删除记录",
              "为完成和提交阶段提供信息"
            ],
            [
              "alternate / stateNode",
              "对应版本与类别相关实例",
              "前者连接双缓冲；后者在宿主节点上可指向DOM"
            ]
          ]
        },
        {
          "type": "code",
          "code": "  this.tag = tag;\n  this.key = key;\n  this.elementType = null;\n  this.type = null;\n  this.stateNode = null;\n\n  // Fiber\n  this.return = null;\n  this.child = null;\n  this.sibling = null;\n  this.index = 0;\n\n  this.ref = null;\n\n  this.pendingProps = pendingProps;\n  this.memoizedProps = null;\n  this.updateQueue = null;\n  this.memoizedState = null;\n  this.dependencies = null;\n\n  this.mode = mode;\n\n  // Effects\n  this.flags = NoFlags;\n  this.subtreeFlags = NoFlags;\n  this.deletions = null;\n\n  this.lanes = NoLanes;\n  this.childLanes = NoLanes;\n\n  this.alternate = null;",
          "purpose": "按字段组读FiberNode的初始化；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiber.old.js:125–155",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "按字段组读FiberNode的初始化",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L125-L155"
        },
        {
          "type": "paragraph",
          "text": "这里的null与NoFlags是创建时的初始值，不代表更新以后永远为空。字段名也不能脱离节点类别解释：函数组件Fiber.memoizedState通常是Hook链表入口，根Fiber有自己的状态结构；函数组件的Fiber.updateQueue可保存Effect相关记录，它不是某一个useState的queue。下面会把这两层拆开。"
        }
      ]
    },
    {
      "id": "buffers",
      "title": "双缓冲：当前树与工作树怎样轮换",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "current表示已经提交、作为当前依据的节点或树；work-in-progress是本轮正在准备的版本。对于已经存在的同一逻辑身份，React可以用alternate把两份对应节点连起来。第一次需要另一份时创建，之后再次准备工作时可以复用已有对象，并重置本轮不该继承的临时标记。"
        },
        {
          "type": "code",
          "code": "export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {\n  let workInProgress = current.alternate;\n  if (workInProgress === null) {\n    // We use a double buffering pooling technique because we know that we'll\n    // only ever need at most two versions of a tree. We pool the \"other\" unused\n    // node that we're free to reuse. This is lazily created to avoid allocating\n    // extra objects for things that are never updated. It also allow us to\n    // reclaim the extra memory if needed.\n    workInProgress = createFiber(\n      current.tag,\n      pendingProps,\n      current.key,\n      current.mode,\n    );\n    workInProgress.elementType = current.elementType;\n    workInProgress.type = current.type;\n    workInProgress.stateNode = current.stateNode;\n\n    if (__DEV__) {\n      // DEV-only fields\n\n      workInProgress._debugSource = current._debugSource;\n      workInProgress._debugOwner = current._debugOwner;\n      workInProgress._debugHookTypes = current._debugHookTypes;\n    }\n\n    workInProgress.alternate = current;\n    current.alternate = workInProgress;\n  } else {\n    workInProgress.pendingProps = pendingProps;\n    // Needed because Blocks store data on type.\n    workInProgress.type = current.type;\n\n    // We already have an alternate.\n    // Reset the effect tag.\n    workInProgress.flags = NoFlags;\n\n    // The effects are no longer valid.\n    workInProgress.subtreeFlags = NoFlags;\n    workInProgress.deletions = null;",
          "purpose": "createWorkInProgress按需创建或复用另一份节点；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiber.old.js:249–288",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "createWorkInProgress按需创建或复用另一份节点",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L249-L288"
        },
        {
          "type": "paragraph",
          "text": "注意上段在已有alternate的分支中展示到删除记录重置，后面还有Profiler计时处理。下面继续看与状态起点有关的字段。工作版本并不是完全独立的深拷贝：child、memoizedState、updateQueue等引用在准备时可以沿用；后续协调、Hook处理再按各自规则组织新的结果。dependencies会建立另一层外壳，但其中部分引用仍然共享。"
        },
        {
          "type": "code",
          "code": "  // Reset all effects except static ones.\n  // Static effects are not specific to a render.\n  workInProgress.flags = current.flags & StaticMask;\n  workInProgress.childLanes = current.childLanes;\n  workInProgress.lanes = current.lanes;\n\n  workInProgress.child = current.child;\n  workInProgress.memoizedProps = current.memoizedProps;\n  workInProgress.memoizedState = current.memoizedState;\n  workInProgress.updateQueue = current.updateQueue;\n\n  // Clone the dependencies object. This is mutated during the render phase, so\n  // it cannot be shared with the current fiber.\n  const currentDependencies = current.dependencies;\n  workInProgress.dependencies =\n    currentDependencies === null\n      ? null\n      : {\n          lanes: currentDependencies.lanes,\n          firstContext: currentDependencies.firstContext,\n        };",
          "purpose": "静态标记、工作集合与状态引用的起点；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiber.old.js:300–320",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "静态标记、工作集合与状态引用的起点",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L300-L320"
        },
        {
          "type": "figure",
          "src": "figures/react-fiber-reconciliation/buffers.svg",
          "title": "同一逻辑节点的两轮更新",
          "alt": "已挂载F1作为current，第一次更新准备F2并提交；第二次更新复用F1，提交后它再次成为current；放弃未提交工作不切换current。",
          "caption": "F1/F2是教学标识，不读取私有地址；HostRoot首次挂载已有current，不适用“所有节点最初都没有current”的说法。"
        },
        {
          "type": "paragraph",
          "text": "这个设计也解释了两个常见误解。第一，并不是所有新挂载组件一开始就预先分配一对Fiber：alternate可以按需建立。第二，未提交结果被放弃，不意味着React能回滚业务函数中的外部副作用。你若在render时改了全局数组，丢弃工作树不会替你把数组改回来，所以组件计算必须保持纯粹。"
        }
      ]
    },
    {
      "id": "hooks",
      "title": "状态与更新队列：两条链解决不同问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Row使用useState保存count。函数组件Fiber的memoizedState关联Hook链表；每个Hook记录该调用位置的状态和其他信息，next连接下一个Hook。React按调用顺序对应这些记录，这就是不能任意在条件分支里增减普通状态Hook调用的结构原因之一。"
        },
        {
          "type": "code",
          "code": "export type Hook = {|\n  memoizedState: any,\n  baseState: any,\n  baseQueue: Update<any, any> | null,\n  queue: any,\n  next: Hook | null,\n|};\n",
          "purpose": "Hook节点的状态、队列与next；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiberHooks.old.js:147–154",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "Hook节点的状态、队列与next",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L147-L154"
        },
        {
          "type": "paragraph",
          "text": "Hook链表回答“这是该组件的第几个Hook”。某个状态Hook的更新队列则回答“这个状态还有哪些操作待处理”。两条链不能混成一条。count的三个更新属于同一个Hook的队列，不会因为调用setter三次就生成三个useState位置。"
        },
        {
          "type": "code",
          "code": "export type UpdateQueue<S, A> = {|\n  pending: Update<S, A> | null,\n  interleaved: Update<S, A> | null,\n  lanes: Lanes,\n  dispatch: (A => mixed) | null,\n  lastRenderedReducer: ((S, A) => S) | null,\n  lastRenderedState: S | null,\n|};\n",
          "purpose": "状态更新队列的pending与dispatch；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiberHooks.old.js:132–140",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "状态更新队列的pending与dispatch",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L132-L140"
        },
        {
          "type": "paragraph",
          "text": "在该版本的相关实现中，pending可以指向环形更新链的尾节点，尾节点的next再指向首节点。这样的表示便于追加和与已有baseQueue合并。本文并不把所有更新一律描述为直接进入pending：该版本还存在并发收集、interleaved等处理路径，具体入队时机与工作阶段有关。重要的是，setter建立更新记录，后续处理根据本轮选择的工作计算状态，而不是直接修改当前DOM。"
        },
        {
          "type": "paragraph",
          "text": "为什么还需要baseState与baseQueue？当本轮只处理一部分优先级的更新时，跳过的更新不能消失，后面已经处理过的操作也可能需要保留顺序并重放。比如初始1，先请求加10，再请求乘2；若本轮只处理后者，暂时结果是2，但之后按原顺序重算应得到22，而不是在2上直接加10得到12。这个例子是假定更新选择的推演，不宣称两个普通连续点击必然产生这个调度顺序。"
        },
        {
          "type": "paragraph",
          "text": "对于本实验单次加一，使用setCount(n => n + 1)，本轮处理这个更新便得到下一状态。理解这条简单路径即可继续读协调；不同Lane下baseQueue如何克隆和重放属于第五篇调度主题，不应拿简化算术模型冒充整个Hook实现。"
        }
      ]
    },
    {
      "id": "reconciliation",
      "title": "协调是什么：把新的元素描述接到旧身份上",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "协调是根据新的元素描述和已有节点，决定哪些身份可以延续、哪些需要新建或删除，并准备新的子树关系。这里的“复用”首先指状态身份和工作节点的对应，不等于跳过组件函数，更不等于这一轮没有DOM操作。"
        },
        {
          "type": "paragraph",
          "text": "例如ul仍在同一个父位置，新旧孩子都是key为A的Row。普通函数组件的类型也一致时，可以为旧A取得工作节点，再用新的props继续处理。如果key相同但类型换成另一个函数OtherRow，不能仅凭相同key强行沿用原组件状态。Fragment、lazy和热更新还有相应分支，因此“key加type”是普通场景的理解入口，不是完整实现的所有条件。"
        },
        {
          "type": "code",
          "code": "  function updateElement(\n    returnFiber: Fiber,\n    current: Fiber | null,\n    element: ReactElement,\n    lanes: Lanes,\n  ): Fiber {\n    const elementType = element.type;\n    if (elementType === REACT_FRAGMENT_TYPE) {\n      return updateFragment(\n        returnFiber,\n        current,\n        element.props.children,\n        lanes,\n        element.key,\n      );\n    }\n    if (current !== null) {\n      if (\n        current.elementType === elementType ||\n        // Keep this check inline so it only runs on the false path:\n        (__DEV__\n          ? isCompatibleFamilyForHotReloading(current, element)\n          : false) ||\n        // Lazy types should reconcile their resolved type.\n        // We need to do this after the Hot Reloading check above,\n        // because hot reloading has different semantics than prod because\n        // it doesn't resuspend. So we can't let the call below suspend.\n        (typeof elementType === 'object' &&\n          elementType !== null &&\n          elementType.$$typeof === REACT_LAZY_TYPE &&\n          resolveLazy(elementType) === current.type)\n      ) {\n        // Move based on index\n        const existing = useFiber(current, element.props);\n        existing.ref = coerceRef(returnFiber, current, element);\n        existing.return = returnFiber;\n        if (__DEV__) {\n          existing._debugSource = element._source;\n          existing._debugOwner = element._owner;\n        }\n        return existing;\n      }\n    }\n    // Insert\n    const created = createFiberFromElement(element, returnFiber.mode, lanes);\n    created.ref = coerceRef(returnFiber, current, element);\n    created.return = returnFiber;\n    return created;\n  }",
          "purpose": "updateElement检查类型后决定useFiber或创建；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactChildFiber.old.js:395–443",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "updateElement检查类型后决定useFiber或创建",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L395-L443"
        },
        {
          "type": "paragraph",
          "text": "这里进入updateElement的前置条件来自调用者；不能只看到函数内部检查type，就推断key不重要。数组路径的updateSlot先比较候选key，匹配后才调用updateElement。类型兼容后调用useFiber，把“身份可延续”接到“准备工作版本”。"
        },
        {
          "type": "code",
          "code": "  function useFiber(fiber: Fiber, pendingProps: mixed): Fiber {\n    // We currently set sibling to null and index to 0 here because it is easy\n    // to forget to do before returning it. E.g. for the single child case.\n    const clone = createWorkInProgress(fiber, pendingProps);\n    clone.index = 0;\n    clone.sibling = null;\n    return clone;\n  }",
          "purpose": "useFiber准备对应版本并重置兄弟位置字段；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactChildFiber.old.js:328–335",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "useFiber准备对应版本并重置兄弟位置字段",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L328-L335"
        },
        {
          "type": "paragraph",
          "text": "index归零、sibling置空用于重新组织这一轮的位置与兄弟链，不等于清空Hook状态。也不能把useFiber理解为直接返回current：它调用createWorkInProgress，得到供这轮处理的版本。"
        }
      ]
    },
    {
      "id": "diff",
      "title": "列表 Diff：先匹配，再记录插入、移动和删除",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "为了让过程明确，先限定输入：同一ul下的普通Row数组，稳定唯一业务key，旧顺序A B C，新顺序C A B，三种Row类型都相同。A之前已经加到1。我们要解释两件事：状态如何继续属于A，DOM顺序怎样变成C A B。"
        },
        {
          "type": "paragraph",
          "text": "数组协调先顺序比较旧孩子与新孩子。第一次旧A对新C，key不匹配，updateSlot返回null，退出这段扫描。这不表示A已经不可复用，也不表示A立刻从DOM删除；接下来还会把剩余旧孩子放进映射，继续寻找新孩子对应的旧身份。"
        },
        {
          "type": "code",
          "code": "  function mapRemainingChildren(\n    returnFiber: Fiber,\n    currentFirstChild: Fiber,\n  ): Map<string | number, Fiber> {\n    // Add the remaining children to a temporary map so that we can find them by\n    // keys quickly. Implicit (null) keys get added to this set with their index\n    // instead.\n    const existingChildren: Map<string | number, Fiber> = new Map();\n\n    let existingChild = currentFirstChild;\n    while (existingChild !== null) {\n      if (existingChild.key !== null) {\n        existingChildren.set(existingChild.key, existingChild);\n      } else {\n        existingChildren.set(existingChild.index, existingChild);\n      }\n      existingChild = existingChild.sibling;\n    }\n    return existingChildren;\n  }",
          "purpose": "剩余孩子按key或index建立映射；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactChildFiber.old.js:307–326",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "剩余孩子按key或index建立映射",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L307-L326"
        },
        {
          "type": "paragraph",
          "text": "对于显式key，映射使用key；没有显式key时使用旧index。后续updateFromMap按新key查找候选，再检查类型等条件。匹配复用的旧节点会从映射移除，表示它已被消费；新列表处理完后仍留在映射里的旧孩子，会进入删除记录。新孩子找不到兼容旧身份则新建。"
        },
        {
          "type": "code",
          "code": "    // Add all children to a key map for quick lookups.\n    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);\n\n    // Keep scanning and use the map to restore deleted items as moves.\n    for (; newIdx < newChildren.length; newIdx++) {\n      const newFiber = updateFromMap(\n        existingChildren,\n        returnFiber,\n        newIdx,\n        newChildren[newIdx],\n        lanes,\n      );\n      if (newFiber !== null) {\n        if (shouldTrackSideEffects) {\n          if (newFiber.alternate !== null) {\n            // The new fiber is a work in progress, but if there exists a\n            // current, that means that we reused the fiber. We need to delete\n            // it from the child list so that we don't add it to the deletion\n            // list.\n            existingChildren.delete(\n              newFiber.key === null ? newIdx : newFiber.key,\n            );\n          }\n        }\n        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);\n        if (previousNewFiber === null) {\n          resultingFirstChild = newFiber;\n        } else {\n          previousNewFiber.sibling = newFiber;\n        }\n        previousNewFiber = newFiber;\n      }\n    }\n\n    if (shouldTrackSideEffects) {\n      // Any existing children that weren't consumed above were deleted. We need\n      // to add them to the deletion list.\n      existingChildren.forEach(child => deleteChild(returnFiber, child));\n    }",
          "purpose": "映射回退中的复用、位置标记与删除记录；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactChildFiber.old.js:864–902",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "映射回退中的复用、位置标记与删除记录",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L864-L902"
        },
        {
          "type": "paragraph",
          "text": "复用状态还不够，排列也要处理。placeChild维护lastPlacedIndex：已经接受的复用节点在旧列表中到达的位置。接着读到一个旧index更小的复用节点，说明它落在这个已建立顺序的后方，需要Placement标记；没有alternate的新节点也要Placement，表示插入。"
        },
        {
          "type": "code",
          "code": "  function placeChild(\n    newFiber: Fiber,\n    lastPlacedIndex: number,\n    newIndex: number,\n  ): number {\n    newFiber.index = newIndex;\n    if (!shouldTrackSideEffects) {\n      // During hydration, the useId algorithm needs to know which fibers are\n      // part of a list of children (arrays, iterators).\n      newFiber.flags |= Forked;\n      return lastPlacedIndex;\n    }\n    const current = newFiber.alternate;\n    if (current !== null) {\n      const oldIndex = current.index;\n      if (oldIndex < lastPlacedIndex) {\n        // This is a move.\n        newFiber.flags |= Placement;\n        return lastPlacedIndex;\n      } else {\n        // This item can stay in place.\n        return oldIndex;\n      }\n    } else {\n      // This is an insertion.\n      newFiber.flags |= Placement;\n      return lastPlacedIndex;\n    }\n  }\n",
          "purpose": "placeChild区分可留位置、移动与插入；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactChildFiber.old.js:337–366",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "placeChild区分可留位置、移动与插入",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L337-L366"
        },
        {
          "type": "table",
          "headers": [
            "新节点",
            "旧index",
            "比较前lastPlacedIndex",
            "本轮结果"
          ],
          "rows": [
            [
              "C",
              "2",
              "0",
              "2不小于0，不加移动标记；lastPlacedIndex变2"
            ],
            [
              "A",
              "0",
              "2",
              "0小于2，标记Placement；lastPlacedIndex仍2"
            ],
            [
              "B",
              "1",
              "2",
              "1小于2，标记Placement；lastPlacedIndex仍2"
            ]
          ]
        },
        {
          "type": "figure",
          "src": "figures/react-fiber-reconciliation/diff.svg",
          "title": "A B C → C A B：移动标记不等于状态重建",
          "alt": "C复用旧index2且更新lastPlacedIndex；A、B复用旧节点但分别标Placement。提交后顺序C A B，A本地计数仍为1。",
          "caption": "这是更新路径的示意，不是挂载路径，也没有声称移动次数最少。Placement用于插入或移动，需结合alternate判断。"
        },
        {
          "type": "paragraph",
          "text": "这个例子里，React可以保持C，再把A、B相应宿主节点移到后面，最终得到C A B。读者常凭肉眼认为“只移动C到前面就够了”，却据此误判源码。该启发式并不保证所有排列的全局最少移动次数；它追求可用的协调代价，不是通用最短编辑算法。"
        },
        {
          "type": "paragraph",
          "text": "再看A B C变成A D C：A可以在顺序阶段匹配，旧B遇到新D后转入映射；D新建并标记插入，C仍可复用，未被消费的B记录删除。删除标记也不是当场removeChild，真正应用到宿主树还要等提交阶段。重复key没有可靠的业务语义，应当先修数据身份，而不是依赖某次碰巧看到的结果。"
        }
      ]
    },
    {
      "id": "work-loop",
      "title": "工作循环：向下开始工作，向上完成工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "树结构和协调规则已经准备好，接下来是谁逐个处理节点？外层工作循环维护当前待处理的workInProgress，调用performUnitOfWork。beginWork根据节点类别处理输入、执行函数组件等工作，并可能返回下一个孩子；没有继续向下的节点时，转入completeUnitOfWork。"
        },
        {
          "type": "code",
          "code": "function performUnitOfWork(unitOfWork: Fiber): void {\n  // The current, flushed, state of this fiber is the alternate. Ideally\n  // nothing should rely on this, but relying on it here means that we don't\n  // need an additional field on the work in progress.\n  const current = unitOfWork.alternate;\n  setCurrentDebugFiberInDEV(unitOfWork);\n\n  let next;\n  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {\n    startProfilerTimer(unitOfWork);\n    next = beginWork(current, unitOfWork, subtreeRenderLanes);\n    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);\n  } else {\n    next = beginWork(current, unitOfWork, subtreeRenderLanes);\n  }\n\n  resetCurrentDebugFiberInDEV();\n  unitOfWork.memoizedProps = unitOfWork.pendingProps;\n  if (next === null) {\n    // If this doesn't spawn new work, complete the current work.\n    completeUnitOfWork(unitOfWork);\n  } else {\n    workInProgress = next;\n  }\n\n  ReactCurrentOwner.current = null;\n}",
          "purpose": "performUnitOfWork连接开始与完成；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiberWorkLoop.old.js:1831–1857",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "performUnitOfWork连接开始与完成",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1831-L1857"
        },
        {
          "type": "paragraph",
          "text": "把开始阶段理解为“只做diff”也不完整。函数组件需要执行函数、处理Hooks并协调返回的孩子；宿主组件等节点走不同分支。另一方面，也不是每个节点都必然重新执行全部工作，输入与工作集合满足条件时存在bailout路径。跳过当前组件计算与跳过整段子树也不是同一件事。"
        },
        {
          "type": "paragraph",
          "text": "completeWork处理节点的完成工作，例如宿主节点的创建或更新准备，并向父级汇总标记；完成当前节点后，如果有兄弟就去兄弟，没有则回到父节点继续完成。正常无异常的遍历可以理解为：先向下展开，再逐层回收本轮结果。"
        },
        {
          "type": "code",
          "code": "\n    const siblingFiber = completedWork.sibling;\n    if (siblingFiber !== null) {\n      // If there is more work to do in this returnFiber, do that next.\n      workInProgress = siblingFiber;\n      return;\n    }\n    // Otherwise, return to the parent\n    completedWork = returnFiber;\n    // Update the next thing we're working on in case something throws.\n    workInProgress = completedWork;\n  } while (completedWork !== null);\n\n  // We've reached the root.\n  if (workInProgressRootExitStatus === RootInProgress) {\n    workInProgressRootExitStatus = RootCompleted;\n  }\n}",
          "purpose": "完成后找兄弟，没有兄弟则回父级；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiberWorkLoop.old.js:1939–1956",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "完成后找兄弟，没有兄弟则回父级",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L1939-L1956"
        },
        {
          "type": "paragraph",
          "text": "关键细节是“render不改DOM”这句口号过于粗糙。挂载时React DOM可在完成阶段创建尚未插入页面的宿主节点、准备属性和后代；它不等于用户已经看到页面变化。应当说，render准备结果，commit应用到已挂载宿主树。不要用是否出现过document.createElement作为是否已经提交的唯一依据。"
        },
        {
          "type": "paragraph",
          "text": "并发路径可以在工作单元边界判断是否让出，同步路径则持续处理；异常还可能进入unwind而不是正常完成。本文的完整更新链路指正常成功路径，并不省略这些边界提示，但不把异常恢复算法混进初次遍历推导。"
        }
      ]
    },
    {
      "id": "commit",
      "title": "提交阶段：哪些工作才真正影响当前页面",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "完成一次render之后，根可以持有finishedWork，但有完成树不代表已经展示。提交过程会处理此前需要刷新的passive工作，并按当前结果进入相应阶段。正常的主要阶段可以分为before-mutation、mutation、layout；它们属于React提交过程，不能直接拿来当浏览器布局和绘制阶段的名字。"
        },
        {
          "type": "table",
          "headers": [
            "阶段",
            "典型工作",
            "容易混淆的地方"
          ],
          "rows": [
            [
              "before-mutation",
              "变更前的准备和某些类组件snapshot",
              "不是useEffect的通用执行阶段"
            ],
            [
              "mutation",
              "宿主插入/移动/更新/删除，相关ref拆除与layout清理",
              "Placement只是工作标记，需要在这里落实"
            ],
            [
              "root.current切换",
              "把完成树设为当前依据",
              "在mutation之后、layout之前，不是仅换指针就完成DOM更新"
            ],
            [
              "layout",
              "变更后运行布局相关Effect和ref挂接等工作",
              "DOM已变不等于浏览器已经绘制新像素"
            ],
            [
              "passive刷新",
              "处理普通Effect的清理与setup",
              "不能保证每次都严格在paint之后"
            ]
          ]
        },
        {
          "type": "code",
          "code": "    // The next phase is the mutation phase, where we mutate the host tree.\n    commitMutationEffects(root, finishedWork, lanes);\n\n    if (enableCreateEventHandleAPI) {\n      if (shouldFireAfterActiveInstanceBlur) {\n        afterActiveInstanceBlur();\n      }\n    }\n    resetAfterCommit(root.containerInfo);\n\n    // The work-in-progress tree is now the current tree. This must come after\n    // the mutation phase, so that the previous tree is still current during\n    // componentWillUnmount, but before the layout phase, so that the finished\n    // work is current during componentDidMount/Update.\n    root.current = finishedWork;",
          "purpose": "mutation之后切换root.current，再进入layout；React v18.3.1原码节选，保留原注释和Flow类型，依赖内部上下文，不能独立运行。",
          "filename": "ReactFiberWorkLoop.old.js:2151–2165",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "mutation之后切换root.current，再进入layout",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2151-L2165"
        },
        {
          "type": "paragraph",
          "text": "对Row的count从0变1，新的layout setup可以读到DOM中的1。旧layout cleanup捕获的count仍是0，因为那是创建清理函数时的状态快照。不要把“清理看到旧闭包”误读成“此刻所有DOM必然仍是旧版”：具体DOM读数还取决于节点、阶段和遍历顺序，因此本例只断言setup的DOM与对应提交结果一致。"
        },
        {
          "type": "paragraph",
          "text": "普通useEffect属于passive刷新入口。它可能通过后续调度执行，也存在同步刷新的路径，不能稳定写成“浏览器先画，useEffect再跑”。本文只要求同一Effect更新时先清理旧的，再建立新的；不承诺任意兄弟组件之间所有Effect和浏览器paint的全局日志顺序。"
        },
        {
          "type": "paragraph",
          "text": "实验的ref回调用useCallback保持稳定，value变化不会仅因函数引用变化而拆除重挂。若把ref回调直接写成每轮新函数，观察到的detach/attach还可能来自ref身份变化，而不是DOM节点重建。排查时要控制这个变量。"
        }
      ]
    },
    {
      "id": "whole-update",
      "title": "把一次加一串起来：哪个结构在什么时候发挥作用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在从Row A的count=0出发，只点击一次“给A加一”，不要同时重排。事件处理函数读取本次状态并调用setter；更新记录进入React的相应收集/队列路径，相关工作被标记到节点和根。根安排执行机会，这一层将在调度篇深入，Fiber对象本身不会主动运行。"
        },
        {
          "type": "paragraph",
          "text": "开始处理后，React基于current准备工作版本，处理A的状态Hook并得到1；Row A返回包含1的output描述。协调判断对应宿主身份是否可延续；完成阶段准备必要变更并汇总工作。成功进入提交后，把变化应用到DOM，切换当前树，运行相应布局工作与后续passive工作。"
        },
        {
          "type": "table",
          "headers": [
            "观测对象",
            "点击之前",
            "计算过程中",
            "提交之后"
          ],
          "rows": [
            [
              "A的状态",
              "当前依据是0",
              "工作版本计算出1",
              "提交后的当前依据是1"
            ],
            [
              "A的output DOM",
              "显示0",
              "不能因为函数算出1就视为已更新",
              "本例显示1且节点对象可保留"
            ],
            [
              "A的布局Effect",
              "保留上一轮清理函数",
              "计算本身不执行新setup",
              "旧cleanup捕获0，新setup读到1"
            ],
            [
              "A的组件身份",
              "父位置、key、类型稳定",
              "协调延续身份",
              "局部状态延续而非初始化"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这条链解释了为什么“复用Fiber”“状态更新”“组件重新执行”和“DOM更新”不是同义词。本例四者可以按各自规则同时发生。换成一次没有需要的宿主变化的计算，组件可能执行但DOM不需要改；换成不同key，组件可能重新挂载并重置state。分析时先明确是哪种行为，再找对应证据。"
        }
      ]
    },
    {
      "id": "experiment",
      "title": "完整实验：用公开行为验证，不读取私有 Fiber",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "配套App提供A、B、C三行，每行有独立count。按钮可以加一、重排为C A B、改为A D C、替换父级key，或切到下标key故障组。每行记录render、稳定ref以及两类Effect的诊断信息。它使用真实React，不是一个被包装成React的模拟调度器。"
        },
        {
          "type": "experiment",
          "id": "react-fiber-reconciliation",
          "title": "观察状态、DOM与提交记录",
          "description": "先清空记录，再做一次操作并读取记录。比较稳定key重排、插入删除、父级key重建与下标key反例。"
        },
        {
          "type": "code",
          "code": "useLayoutEffect(() => {\n  record(`${id}:layout:setup:${count}:DOM=${node.current?.textContent}`);\n  return () => record(`${id}:layout:cleanup:${count}`);\n}, [id, count]);\n\nuseEffect(() => {\n  record(`${id}:passive:setup:${count}`);\n  return () => record(`${id}:passive:cleanup:${count}`);\n}, [id, count]);",
          "purpose": "完整Row中的诊断片段。record、node与id/count定义见配套App；日志只用于教学，不用于控制业务。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "预期结果",
            "验证的边界"
          ],
          "rows": [
            [
              "给A加一",
              "A显示1，layout setup读到DOM=1",
              "一次正常状态更新"
            ],
            [
              "稳定key重排C A B",
              "A仍为1，三行原DOM节点可保留",
              "位置变化不等于身份重建"
            ],
            [
              "从初始A B C改为A D C",
              "A/C保留，B卸载，D新挂载",
              "新增、删除与保留同时存在"
            ],
            [
              "切到下标key，A加一再重排",
              "C显示1，A显示0",
              "状态跟位置而不是业务ID"
            ],
            [
              "更换父级key",
              "全部行计数归0，原DOM被替换",
              "父级身份改变影响后代"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "“清空记录”和“读取记录”也会更新展示日志的父组件，可能带来额外render诊断；稳定依赖下不会因此把已有Effect重新setup。看日志时先找到目标事件，不要把总行数当成真实提交次数。默认无StrictMode，避免开发检查混入基础实验；这不是建议业务关闭StrictMode。"
        },
        {
          "type": "code",
          "code": "cd examples/react-fiber-reconciliation\nnpm ci\nnpm test\nnpm run build\nnpm run dev",
          "purpose": "Node.js22，锁定依赖见package-lock.json；ZIP解压后进入项目目录运行。站内实验室无需安装。",
          "filename": "终端",
          "language": "sh",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "测试以React DOM 18.3.1和jsdom驱动实际交互，断言state结果、DOM对象身份及Effect关系。它不读取__reactFiber私有属性，也不证明浏览器paint顺序或性能收益。placeChild的标记推演来自固定版本源码，实验的DOM结果是另一层证据，二者不能互相冒充。"
        }
      ]
    },
    {
      "id": "limits",
      "title": "读完以后，怎样用这些知识分析问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果状态跟错对象，先确认父级身份、key与组件类型；如果组件函数执行却看不到变化，区分是否只是计算以及是否产生宿主变更；如果Effect日志让人困惑，区分闭包捕获值、实际DOM读数和阶段；如果输入卡顿，再去检查计算工作量与调度边界。不要让“Fiber”变成所有问题的笼统答案。"
        },
        {
          "type": "paragraph",
          "text": "这篇建立的是结构与正常更新链路：Fiber组织记录，双缓冲准备下一版，Hook与队列处理状态，协调决定身份与位置，工作循环推进计算，提交应用结果。它保留了与调度的接口，但不把Lane选择、Scheduler堆、Suspense恢复、服务端hydration和所有Effect特殊分支都挤成几句结论。下一篇调度主题将在这条已建立的链上解释谁先做、何时让出以及怎样重启。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "完整协调与提交实验ZIP",
      "path": "react-fiber-reconciliation.zip"
    },
    {
      "label": "验证记录与限制",
      "path": "react-fiber-reconciliation/VERIFICATION.md"
    }
  ],
  "references": [
    {
      "title": "React v18.3.1 reconciler源码",
      "url": "https://github.com/facebook/react/tree/v18.3.1/packages/react-reconciler/src"
    }
  ]
};
