import type {Article} from '../articleTypes';
export const reactFiberStructureArticle: Article = {
  "id": "react-fiber-structure",
  "topic": "react",
  "title": "React 18.3.1 源码专题：Fiber 怎样保存身份、状态与工作树",
  "description": "从列表重排后计数跟错人的现象出发，读懂元素、Fiber、DOM、树指针和alternate，再用真实React验证状态保留与重置。",
  "minutes": 40,
  "labMinutes": 20,
  "tags": [
    "React 18.3.1",
    "Fiber",
    "源码",
    "key",
    "alternate"
  ],
  "kind": "tutorial",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-22",
  "scope": "普通函数组件与客户端同级协调；不展开SSR、hydration、Suspense和热更新特殊路径。",
  "prerequisites": [
    "useState与列表key",
    "JavaScript对象引用与函数身份"
  ],
  "questionIds": [
    "react-fiber-scheduling-interrupt"
  ],
  "experiment": "react",
  "sections": [
    {
      "id": "question",
      "title": "同一行数据换了位置，为什么计数跟错人了？",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "假设页面上有 A、B 两个计数器。你给 A 加了一次，随后把列表顺序反过来。如果 A 仍显示 1，符合直觉；如果变成 B 显示 1，你可能以为 setState 的异步时机出了问题。但这一次，更值得检查的是：React 认为更新前后哪些节点还是“同一个”。"
        },
        {
          "type": "paragraph",
          "text": "这个问题把我们带到 Fiber 的结构。元素描述下一版想要什么界面，Fiber 则在协调过程中保存节点身份、状态和待处理工作。只背 child、sibling、return 三个字段，很难解释计数为什么会跟错对象。我们沿这个小列表，从元素到工作树，再回到状态保留与重置，把结构与真实行为连起来。"
        },
        {
          "type": "paragraph",
          "text": "本文固定 React / React DOM 18.3.1，使用 createRoot 的客户端渲染，不展开 hydration、Suspense、Portal 或热更新。内部实现读这个版本的 .old.js 路径；ReactFeatureFlags.js 在此 tag 中的 enableNewReconciler 为 false。源码字段不是业务可依赖的公开 API，升级后应重新核对。"
        },
        {
          "type": "reference",
          "title": "React 18.3.1：old/new reconciler 选择开关",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js#L72-L75"
        },
        {
          "type": "experiment",
          "id": "react-fiber-structure",
          "title": "先观察四种身份变化",
          "description": "给A加一后重排、切换key策略、更换父级key、更换组件函数。每次都先预测状态会留在哪里。"
        }
      ]
    },
    {
      "id": "three-objects",
      "title": "先分清元素、Fiber 和 DOM",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "写出 <Counter id=\"A\" /> 时，你提供的是一个元素描述：组件类型、key、props 等。下一次父组件执行，又可以产生新的元素对象。新的描述对象不等于组件状态必须从头开始；协调过程会拿它与当前树比较，判断能否延续已有身份。"
        },
        {
          "type": "paragraph",
          "text": "Fiber 是 React 的内部节点。函数组件、宿主元素、文本、根以及其他内部类型都可能有各自的 Fiber。tag 表达节点类别，type 和 elementType 与组件类型有关，key 参与同级协调。stateNode 的含义依节点类别变化：常见宿主元素可关联 DOM，类组件可关联实例，函数组件通常没有这样的组件实例。"
        },
        {
          "type": "paragraph",
          "text": "因此，不能画一条“每个 Fiber 都指向一个 DOM”的固定连线。Counter 可以返回一个 button，但 Counter 对应函数组件 Fiber，button 另有宿主 Fiber。组件返回多个元素、Fragment 或 null 时，这种区别更明显。Fiber 也不是浏览器线程；它只是普通 JavaScript 对象，在主线程执行过程中被读写。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "回答的问题",
            "什么变化不应混淆"
          ],
          "rows": [
            [
              "React元素",
              "这轮希望呈现什么",
              "元素对象重新创建，不等于状态重置"
            ],
            [
              "Fiber",
              "这个工作节点是谁、保存什么、还有什么工作",
              "有工作节点，不等于已经改DOM"
            ],
            [
              "DOM",
              "浏览器当前有哪些宿主节点",
              "函数组件通常不对应独立DOM外壳"
            ]
          ]
        },
        {
          "type": "reference",
          "title": "FiberNode：身份、状态、树连接字段",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L118-L157"
        }
      ]
    },
    {
      "id": "links",
      "title": "child、sibling、return 怎样表示一棵树",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "普通业务树常用 children 数组保存孩子。Fiber 的常见连接方式不同：child 指向第一个孩子，sibling 串起后面的兄弟，return 指回逻辑父节点。名字 return 不是 JavaScript 的 return 语句，它是一条回到父节点的连接。"
        },
        {
          "type": "figure",
          "src": "figures/react-fiber-structure/tree.svg",
          "title": "两个兄弟计数器如何连接",
          "alt": "HostRoot的child指向App，App的child指向section，section的child指向Counter A，A的sibling指向Counter B，两个Counter的return均指向section，各有宿主p子节点。",
          "caption": "教学简图省略App返回的main外层、button、output及部分宿主子节点。sibling表示兄弟关系，不表示B是A的孩子；两个Counter的return都回到section。"
        },
        {
          "type": "paragraph",
          "text": "看图时，先从 section 向下找到 A，再沿 sibling 找到 B。B 完成后，return 把工作带回 section。真实工作循环还区分开始处理与完成处理，遇到没有孩子的节点会尝试兄弟；没有兄弟时继续往父级完成。本文只借这些指针解释“如何找到下一个位置”，不把一个简化遍历器冒充整个协调器。"
        },
        {
          "type": "paragraph",
          "text": "能够把位置保存在对象上，确实有利于在工作单元之间暂停和继续。但有这些字段并不自动意味着任意代码都可中断。一个函数组件内部正在执行的同步循环必须先返回；是工作循环在适当边界决定让出，不是 child 指针自带了线程调度能力。"
        },
        {
          "type": "code",
          "code": "type TeachingNode = {\n  name: string;\n  child: TeachingNode | null;\n  sibling: TeachingNode | null;\n  return: TeachingNode | null;\n};",
          "purpose": "只展示树连接关系，省略开始/完成工作、异常、优先级与提交；不可用作React实现。",
          "kind": "pseudocode",
          "filename": "结构示意",
          "language": "typescript"
        },
        {
          "type": "reference",
          "title": "createFiberFromElement 与 Fiber 的创建",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L604-L628"
        }
      ]
    },
    {
      "id": "state",
      "title": "状态在哪里？先看节点类别，再读字段",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "同一个字段名，在不同节点类型上可能保存不同结构。例如函数组件 Fiber 的 memoizedState 常是 Hook 链表的入口，而不是你传给 useState 的那个值本身。多个 useState 对应多个 Hook 节点，各个 Hook 再有自己的状态和更新队列。把 Fiber.memoizedState 直接等同于一个 count，会在阅读第二个 Hook 时马上走不通。"
        },
        {
          "type": "paragraph",
          "text": "updateQueue 也不能一概理解为 useState 的更新队列。函数组件的 Fiber.updateQueue 可以保存 Effect 相关结构；状态 Hook 的 queue 则位于 Hook 节点上。类组件和根节点又有自己的队列语义。读源码时先确认当前 Fiber 的 tag 和处理路径，再解释字段，能避开很多“画了一个方框就通用”的误导。"
        },
        {
          "type": "table",
          "headers": [
            "字段组",
            "这一层保存什么",
            "阅读时的注意点"
          ],
          "rows": [
            [
              "tag / key / elementType / type",
              "类别、同级身份和组件类型信息",
              "不是只比较一个key就能跨任意树复用"
            ],
            [
              "pendingProps / memoizedProps",
              "待处理输入与已处理输入",
              "字段名不表示一个完整深拷贝"
            ],
            [
              "memoizedState / updateQueue",
              "随节点类别变化的状态和队列结构",
              "Hook节点与Fiber节点不能混成一层"
            ],
            [
              "lanes / childLanes",
              "本节点与子树的待处理Lane集合",
              "表达工作集合，不是CPU线程编号"
            ],
            [
              "flags / subtreeFlags / deletions",
              "本轮工作标记及子树摘要（包含提交工作）",
              "在render准备，不等于标记时就修改DOM"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "对初读者而言，先把这些字段分成身份、结构、状态、待处理工作四组就够了。不需要把每一位flag背下来。你真正要问的是：这段函数正在判断能不能复用身份，还是正在计算状态，还是在准备提交工作？这三个问题不同，读源码的入口也不同。"
        },
        {
          "type": "reference",
          "title": "Hooks 的 Hook 类型与函数组件更新队列定义",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L132-L194"
        }
      ]
    },
    {
      "id": "alternate",
      "title": "alternate 是双缓冲，不是“再复制一遍页面”",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "current 指向已经提交的那一版工作树。准备下一版时，React 使用 work-in-progress。createWorkInProgress 先看 current.alternate：如果还没有另一份节点，就懒创建并互相连接；如果已有，就重用这个节点，更新输入并清理本轮不应继承的工作标记。"
        },
        {
          "type": "paragraph",
          "text": "这解释了为什么通常不需要每次更新无限增加一个新版本：两个对应节点可以交替承担当前版本和工作版本。但也不能把这句话写成“所有节点从第一次渲染起永远都有两个对象”。另一份节点是按需创建，树还可能插入、删除和重建，未更新节点不需要预先分配一对对象。"
        },
        {
          "type": "figure",
          "src": "figures/react-fiber-structure/alternate.svg",
          "title": "构建下一版时，哪些信息被沿用",
          "alt": "current与work-in-progress通过双向alternate连接。createWorkInProgress可沿用child、memoizedState、updateQueue引用，再由后续工作路径处理；flags与subtreeFlags清理或按StaticMask保留，提交后root.current切换到完成树。",
          "caption": "引用沿用不等于允许业务直接修改内部对象；这张图只说明createWorkInProgress的起始处理，后续协调还会调整子树与状态。"
        },
        {
          "type": "paragraph",
          "text": "尤其值得停下来读的是源码里的几行赋值：workInProgress.child = current.child，以及 memoizedState、updateQueue 的沿用。这不是递归深拷贝。dependencies 对象则有单独的克隆处理，因为渲染过程中会修改它。不同字段按各自生命周期处理，不能用“一棵完全独立的镜像树”概括所有内存关系。"
        },
        {
          "type": "code",
          "code": "workInProgress.child = current.child;\nworkInProgress.memoizedProps = current.memoizedProps;\nworkInProgress.memoizedState = current.memoizedState;\nworkInProgress.updateQueue = current.updateQueue;",
          "purpose": "React18.3.1 createWorkInProgress真实短节选；说明起始阶段沿用引用，不代表所有后续处理均共享。",
          "kind": "excerpt",
          "filename": "ReactFiber.old.js:306–309",
          "language": "javascript"
        },
        {
          "type": "reference",
          "title": "createWorkInProgress：创建、复用、字段重置与沿用",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L249-L330"
        },
        {
          "type": "paragraph",
          "text": "提交完成后，根的 current 切换到完成的那棵树。DOM 可见内容仍需要由提交阶段应用相应变更，不能认为把一个 JavaScript 指针换掉就已经更新浏览器。双缓冲给计算下一版留出空间，提交边界保证完成结果才成为当前版本；具体中断与提交顺序在工作循环专题继续展开。"
        }
      ]
    },
    {
      "id": "identity",
      "title": "key 相同，为什么仍然可能丢状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先把范围限定在同一个父节点的一组孩子中。在单元素协调路径里，reconcileSingleElement 会沿旧孩子检查 key；key匹配后还要检查元素类型。对于本篇使用的普通函数组件，可以先理解为组件函数身份必须兼容。真实源码还处理Fragment、lazy与开发热更新等分支，所以“key和type”是限定场景下的阅读入口，不是覆盖全部特殊节点的完整公式。"
        },
        {
          "type": "paragraph",
          "text": "在数组协调中，位置也参与没有显式key的匹配。用下标作为key，实际上告诉React“第0个位置还是第0个身份”。反转A/B后，第0行拿到的是B的props，但它可能延续此前属于第0行的局部状态。React没有把A的业务含义猜错；是我们把位置当成了身份。"
        },
        {
          "type": "paragraph",
          "text": "换成稳定业务ID后，同一父级下的A在重排时能与原来的A匹配，局部状态随它保留。移动仍然可能需要DOM操作；保留状态并不意味着完全不工作，也不保证每次组件函数都跳过执行。节点身份与memo是否跳过渲染是两个层次。"
        },
        {
          "type": "reference",
          "title": "reconcileSingleElement：先匹配key，再检查元素类型",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L1137-L1219"
        },
        {
          "type": "reference",
          "title": "数组协调中的slot匹配",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L566-L640"
        },
        {
          "type": "paragraph",
          "text": "还有两个反例。第一，更换父级section的key，会使原来的整组子树失去原有父级身份，即便每个孩子仍有稳定ID，状态也会重置。第二，把Counter换成另一个函数OtherCounter，即使两个函数返回同样的p、output、button，组件类型仍然不同，不能据此继续沿用前一个函数组件的状态。"
        },
        {
          "type": "paragraph",
          "text": "不要把随机key当成“强制刷新最简单的方法”。每次生成不同key意味着重建，局部输入、焦点和订阅生命周期都可能受到影响。确实需要清空一组表单时，可以有意更换一个代表业务版本的key；只是这应该是产品语义，而不是为了压掉渲染问题的偶然做法。"
        },
        {
          "type": "reference",
          "title": "未显式key时用index建立旧节点映射",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L307-L325"
        }
      ]
    },
    {
      "id": "single-source",
      "title": "把单元素匹配读完：找到同名节点以后，还要做什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "上面的key和类型规则，现在直接放回源码里看。这里的“单元素”指新结果是一个元素，并不表示旧孩子链表只能有一个节点。假设同一父级的旧孩子是A、B，而新结果只有B，函数仍然要沿sibling寻找B。下面保留完整函数，避免省掉不匹配分支后，让人误以为key相同就一定复用。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactChildFiber.old.js:1137–1212",
          "kind": "excerpt",
          "purpose": "阅读顺序：取key → 遍历旧孩子 → 判断类型 → 复用或记录删除 → 必要时创建。 React v18.3.1 原函数，保留 Flow 类型和原注释；依赖 React 内部上下文，不能单独运行。",
          "code": "function reconcileSingleElement(\n  returnFiber: Fiber,\n  currentFirstChild: Fiber | null,\n  element: ReactElement,\n  lanes: Lanes,\n): Fiber {\n  const key = element.key;\n  let child = currentFirstChild;\n  while (child !== null) {\n    // TODO: If key === null and child.key === null, then this only applies to\n    // the first item in the list.\n    if (child.key === key) {\n      const elementType = element.type;\n      if (elementType === REACT_FRAGMENT_TYPE) {\n        if (child.tag === Fragment) {\n          deleteRemainingChildren(returnFiber, child.sibling);\n          const existing = useFiber(child, element.props.children);\n          existing.return = returnFiber;\n          if (__DEV__) {\n            existing._debugSource = element._source;\n            existing._debugOwner = element._owner;\n          }\n          return existing;\n        }\n      } else {\n        if (\n          child.elementType === elementType ||\n          // Keep this check inline so it only runs on the false path:\n          (__DEV__\n            ? isCompatibleFamilyForHotReloading(child, element)\n            : false) ||\n          // Lazy types should reconcile their resolved type.\n          // We need to do this after the Hot Reloading check above,\n          // because hot reloading has different semantics than prod because\n          // it doesn't resuspend. So we can't let the call below suspend.\n          (typeof elementType === 'object' &&\n            elementType !== null &&\n            elementType.$$typeof === REACT_LAZY_TYPE &&\n            resolveLazy(elementType) === child.type)\n        ) {\n          deleteRemainingChildren(returnFiber, child.sibling);\n          const existing = useFiber(child, element.props);\n          existing.ref = coerceRef(returnFiber, child, element);\n          existing.return = returnFiber;\n          if (__DEV__) {\n            existing._debugSource = element._source;\n            existing._debugOwner = element._owner;\n          }\n          return existing;\n        }\n      }\n      // Didn't match.\n      deleteRemainingChildren(returnFiber, child);\n      break;\n    } else {\n      deleteChild(returnFiber, child);\n    }\n    child = child.sibling;\n  }\n\n  if (element.type === REACT_FRAGMENT_TYPE) {\n    const created = createFiberFromFragment(\n      element.props.children,\n      returnFiber.mode,\n      lanes,\n      element.key,\n    );\n    created.return = returnFiber;\n    return created;\n  } else {\n    const created = createFiberFromElement(element, returnFiber.mode, lanes);\n    created.ref = coerceRef(returnFiber, currentFirstChild, element);\n    created.return = returnFiber;\n    return created;\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "先看while里的两条路。child.key不等于目标key时，记录当前旧孩子的删除，再沿sibling继续找；因此旧A不匹配并不意味着找不到旧B。key相同后才检查类型：普通元素比较elementType，Fragment、热更新和lazy另有分支。本文的普通函数组件案例走child.elementType === elementType。"
        },
        {
          "type": "paragraph",
          "text": "如果B的key和类型都匹配，deleteRemainingChildren从B的下一个兄弟开始记录删除，useFiber则准备B的工作节点，并设置新的return。这里不会把匹配的B一起删除。如果key虽然相同，类型却不兼容，则从当前child开始记录剩余删除并break，随后走下面的新建路径；它不会继续寻找另一个相同key来尝试匹配。重复key本来也不应作为可依赖的身份设计。"
        },
        {
          "type": "paragraph",
          "text": "deleteChild和deleteRemainingChildren在这里记录协调结果，并不是马上把DOM移除。是否跟踪这些标记还受ChildReconciler的shouldTrackSideEffects控制。DOM删除由后续提交过程应用。这样才能把“决定哪一个旧节点不用了”与“真正修改页面”分开。"
        },
        {
          "type": "reference",
          "title": "reconcileSingleElement 原始源码（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L1137-L1212"
        },
        {
          "type": "reference",
          "title": "删除标记的记录 原始源码（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L276-L305"
        }
      ]
    },
    {
      "id": "slot-source",
      "title": "数组逐项匹配：返回null不等于直接删除",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "数组协调开头先按位置拿一个旧Fiber和一个新孩子，交给updateSlot。请注意，slot只是这一对候选的比较，并不是整个数组diff。下面看到return null时，先把它读成“这一次配对没有得到工作节点”，不要直接翻译成“旧节点已经被删掉”。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactChildFiber.old.js:566–630",
          "kind": "excerpt",
          "purpose": "重点看REACT_ELEMENT_TYPE分支：key相同才进入updateElement；key不同时返回null。 React v18.3.1 原函数，保留 Flow 类型和原注释；依赖 React 内部上下文，不能单独运行。",
          "code": "function updateSlot(\n  returnFiber: Fiber,\n  oldFiber: Fiber | null,\n  newChild: any,\n  lanes: Lanes,\n): Fiber | null {\n  // Update the fiber if the keys match, otherwise return null.\n\n  const key = oldFiber !== null ? oldFiber.key : null;\n\n  if (\n    (typeof newChild === 'string' && newChild !== '') ||\n    typeof newChild === 'number'\n  ) {\n    // Text nodes don't have keys. If the previous node is implicitly keyed\n    // we can continue to replace it without aborting even if it is not a text\n    // node.\n    if (key !== null) {\n      return null;\n    }\n    return updateTextNode(returnFiber, oldFiber, '' + newChild, lanes);\n  }\n\n  if (typeof newChild === 'object' && newChild !== null) {\n    switch (newChild.$$typeof) {\n      case REACT_ELEMENT_TYPE: {\n        if (newChild.key === key) {\n          return updateElement(returnFiber, oldFiber, newChild, lanes);\n        } else {\n          return null;\n        }\n      }\n      case REACT_PORTAL_TYPE: {\n        if (newChild.key === key) {\n          return updatePortal(returnFiber, oldFiber, newChild, lanes);\n        } else {\n          return null;\n        }\n      }\n      case REACT_LAZY_TYPE: {\n        const payload = newChild._payload;\n        const init = newChild._init;\n        return updateSlot(returnFiber, oldFiber, init(payload), lanes);\n      }\n    }\n\n    if (isArray(newChild) || getIteratorFn(newChild)) {\n      if (key !== null) {\n        return null;\n      }\n\n      return updateFragment(returnFiber, oldFiber, newChild, lanes, null);\n    }\n\n    throwOnInvalidObjectType(returnFiber, newChild);\n  }\n\n  if (__DEV__) {\n    if (typeof newChild === 'function') {\n      warnOnFunctionType(returnFiber);\n    }\n  }\n\n  return null;\n}"
        },
        {
          "type": "paragraph",
          "text": "新数组为[B,A]、旧数组为[A,B]时，第一次拿旧A和新B比较。稳定业务key不匹配，updateSlot返回null，数组协调退出这段顺序扫描，后续通过剩余旧节点的映射继续找B。也就是说，A没有因为这一次返回null就被判定永远不能复用。文本、空值和其他分支也说明：返回null不能被简单等同于“key变了”。"
        },
        {
          "type": "paragraph",
          "text": "如果使用下标key，旧第0项和新第0项的key相同，就进入updateElement。此时还必须检查元素类型。两项都使用Counter时，原第0项的状态被延续，新props却变成B；这才是B拿到A原来计数的完整原因。key匹配只是进入下一步，不是最终复用承诺。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactChildFiber.old.js:395–443",
          "kind": "excerpt",
          "purpose": "接着读被updateSlot调用的函数：同key之后，类型兼容才useFiber，否则创建新Fiber。 React v18.3.1 原函数，保留 Flow 类型和原注释；依赖 React 内部上下文，不能单独运行。",
          "code": "function updateElement(\n  returnFiber: Fiber,\n  current: Fiber | null,\n  element: ReactElement,\n  lanes: Lanes,\n): Fiber {\n  const elementType = element.type;\n  if (elementType === REACT_FRAGMENT_TYPE) {\n    return updateFragment(\n      returnFiber,\n      current,\n      element.props.children,\n      lanes,\n      element.key,\n    );\n  }\n  if (current !== null) {\n    if (\n      current.elementType === elementType ||\n      // Keep this check inline so it only runs on the false path:\n      (__DEV__\n        ? isCompatibleFamilyForHotReloading(current, element)\n        : false) ||\n      // Lazy types should reconcile their resolved type.\n      // We need to do this after the Hot Reloading check above,\n      // because hot reloading has different semantics than prod because\n      // it doesn't resuspend. So we can't let the call below suspend.\n      (typeof elementType === 'object' &&\n        elementType !== null &&\n        elementType.$$typeof === REACT_LAZY_TYPE &&\n        resolveLazy(elementType) === current.type)\n    ) {\n      // Move based on index\n      const existing = useFiber(current, element.props);\n      existing.ref = coerceRef(returnFiber, current, element);\n      existing.return = returnFiber;\n      if (__DEV__) {\n        existing._debugSource = element._source;\n        existing._debugOwner = element._owner;\n      }\n      return existing;\n    }\n  }\n  // Insert\n  const created = createFiberFromElement(element, returnFiber.mode, lanes);\n  created.ref = coerceRef(returnFiber, current, element);\n  created.return = returnFiber;\n  return created;\n}"
        },
        {
          "type": "reference",
          "title": "updateSlot 原始源码（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L566-L630"
        },
        {
          "type": "reference",
          "title": "updateElement 原始源码（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L395-L443"
        },
        {
          "type": "reference",
          "title": "数组顺序扫描与回退路径 原始源码（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L744-L932"
        }
      ]
    },
    {
      "id": "reuse-source",
      "title": "useFiber把身份匹配接到双缓冲",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在还差最后一环：源码反复调用useFiber，但“复用”究竟是不是直接改current？下面这个短函数把身份匹配与前面的alternate连接起来。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "ReactChildFiber.old.js:328–335",
          "kind": "excerpt",
          "purpose": "观察createWorkInProgress调用，以及index、sibling的重置。 React v18.3.1 原函数，保留 Flow 类型和原注释；依赖 React 内部上下文，不能单独运行。",
          "code": "function useFiber(fiber: Fiber, pendingProps: mixed): Fiber {\n  // We currently set sibling to null and index to 0 here because it is easy\n  // to forget to do before returning it. E.g. for the single child case.\n  const clone = createWorkInProgress(fiber, pendingProps);\n  clone.index = 0;\n  clone.sibling = null;\n  return clone;\n}"
        },
        {
          "type": "paragraph",
          "text": "useFiber调用createWorkInProgress，而不是直接把旧Fiber当成新返回值。后者会创建或取回alternate，沿用当前状态等起始信息。随后index归零、sibling清空，是为了让新一轮协调重新组织位置和兄弟连接；不能因此推断Hook状态被清空。位置连接、组件状态、工作标记，各自有不同的处理方式。"
        },
        {
          "type": "paragraph",
          "text": "把这条链连起来：key和类型帮助确定谁可以延续身份，useFiber为该身份取得工作节点，createWorkInProgress建立下一轮计算的起点。它们解释了状态为什么有机会保留，却没有证明组件会跳过执行，也没有决定这轮何时获得CPU时间。跳过工作要继续看bailout路径，执行先后要看Lane和根调度。"
        },
        {
          "type": "reference",
          "title": "useFiber 原始源码（v18.3.1）",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js#L328-L335"
        },
        {
          "type": "callout",
          "title": "源码许可与核验",
          "text": "本节原函数来自Facebook React v18.3.1，按MIT许可使用。完整源文件和原始版权许可保存在示例source-notes目录，并随ZIP下载；保留原注释，解释写在代码块之外。"
        }
      ]
    },
    {
      "id": "experiment",
      "title": "亲手验证身份，而不是读取私有字段",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "const [items, setItems] = useState([{id:\"A\"}, {id:\"B\"}]);\n// byIndex=false：稳定业务ID；true：把位置作为身份。\n<section key={epoch}>\n  {items.map((item, index) =>\n    <Row key={byIndex ? index : item.id} id={item.id} />\n  )}\n</section>",
          "purpose": "配套App.tsx的列表节选；完整项目提供Row、epoch和控制按钮。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "打开实验后，默认使用业务ID。给A加一，再交换A/B：A仍然是1，B仍然是0。切换到数组下标策略会主动清空这组实验，再给A加一并交换顺序：现在B显示1，因为它继承了第0个位置的状态。切换策略时的重置是示例主动更换父级key，不应误读成“只要更换策略React就必定执行相同重置”。"
        },
        {
          "type": "paragraph",
          "text": "然后分别尝试“更换父级key”和“更换组件类型”。先制造一个非零计数，点击后应回到0。这个实验只证明可观察的身份保留和重置，不读取DOM上的内部__reactFiber字段，不依赖某个内部对象地址。私有字段即使在调试时可见，也不适合作为应用逻辑或稳定验收接口。"
        },
        {
          "type": "code",
          "code": "cd examples/react-fiber-structure\nnpm ci\nnpm test\nnpm run build\nnpm run dev",
          "purpose": "完整仓库中从根目录开始；ZIP解压后直接cd react-fiber-structure。Node22与npm，默认无网络业务请求。",
          "kind": "runnable",
          "filename": "终端",
          "language": "sh"
        },
        {
          "type": "paragraph",
          "text": "测试使用React18.3.1的真实DOM renderer，在jsdom环境里点击按钮并断言最终输出，覆盖这四种情况。jsdom不是浏览器排版引擎，所以这些测试可以验证状态对应关系，不能验证绘制性能、布局、可见卡顿或调度切片。真实浏览器中的展示与交互需要另外检查。"
        },
        {
          "type": "paragraph",
          "text": "如果结果与预期不同，先看当前key策略和重置版本，再检查有没有在一次操作里同时切换类型。实验里组件函数都定义在模块顶层。若把子组件函数定义在父组件内部，每次父组件执行都可能得到新的函数对象，从而改变类型身份，那会引入本次不想混入的额外变量。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "结构解释到哪里，就把保证停在哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "从计数器反例回头看，状态跟错人的直接原因是协调身份定义与业务身份不同。Fiber让这个身份能够关联状态和待处理工作；key帮助React在同级集合中找到匹配对象；alternate支持构建下一版时复用对应节点。三者连起来，才能解释“元素重建了，状态为什么还在”。"
        },
        {
          "type": "paragraph",
          "text": "反过来，Fiber结构本身并不证明某次render一定中断、某个DOM一定复用、某段更新一定比另一段快。要回答更新先后，需要读Lane与工作循环；要回答某次state函数如何重放，需要读Hook队列；要回答什么时候修改DOM，需要读commit路径。把这些问题分开，是为了让每个结论都落在对应证据上。"
        },
        {
          "type": "paragraph",
          "text": "实际排查时可以按一条具体路径走：先确认父级身份是否稳定，再检查孩子的key与组件类型，接着观察局部状态是否保留，最后才考虑跳过渲染和性能优化。不要用memo去修复一个每次都变的key，也不要把强行重建当成已经解决状态来源的问题。"
        },
        {
          "type": "callout",
          "title": "本文的正确性边界",
          "text": "字段与复用路径固定到18.3.1源码；身份实验验证公开可观察行为。图形是有明确省略的结构示意，不展示全部Fiber类型，不包含源码插桩或性能测量。详细结论核验表见配套VERIFICATION.md。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "完整身份实验ZIP",
      "path": "react-fiber-structure.zip"
    },
    {
      "label": "结论与源码核验记录",
      "path": "react-fiber-structure/VERIFICATION.md"
    }
  ],
  "references": [
    {
      "title": "React18.3.1 Fiber结构和createWorkInProgress",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js"
    },
    {
      "title": "React18.3.1 子节点协调",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactChildFiber.old.js"
    },
    {
      "title": "状态的保留与重置（官方概念文档）",
      "url": "https://react.dev/learn/preserving-and-resetting-state"
    }
  ]
};
