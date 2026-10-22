import type {Article} from '../articleTypes';
export const reactFiberStructureArticle: Article = {
  "id": "react-fiber-structure",
  "topic": "react",
  "title": "Fiber 是什么：从概念、作用和结构理解 React 的更新",
  "description": "先认识 Fiber 这个内部节点对象，再理解它的作用、树结构、状态和双缓冲；沿一次计数更新串起工作过程，最后通过列表实验和 React 18.3.1 源码验证。",
  "minutes": 48,
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
  "scope": "Fiber入门与结构专题；以React DOM 18.3.1普通函数组件为例，讲清对象、树、状态与更新过程。协调源码作为后半篇进阶阅读；完整调度与双缓冲另有配套章节。",
  "prerequisites": [
    "会写函数组件、props和useState",
    "理解JavaScript对象引用；无需预先了解Fiber或调度源码"
  ],
  "questionIds": [
    "react-fiber-scheduling-interrupt"
  ],
  "experiment": "react",
  "sections": [
    {
      "id": "question",
      "title": "Fiber 的概念：它首先是一个内部节点对象",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Fiber 是 React 内部用来表示节点、保存状态和渲染工作信息的一种数据结构。在 React 18.3.1 的实现里，一个 Fiber 就是一个 JavaScript 对象。先记住这个具体形态：它有字段，字段里保存值或者指向其他对象的引用；它不是一个浏览器线程，也不是你需要在业务代码里手动创建的组件。"
        },
        {
          "type": "paragraph",
          "text": "为什么资料有时又把 Fiber 叫作“工作单元”或“架构”？因为 React 的更新计算会围绕这些节点推进，一个节点承载一部分待处理工作；以这些节点组织协调与渲染的实现，也常被统称为 Fiber 架构。本篇先从最容易看见的“节点对象”讲起，再解释它如何参与工作。不要把这三个说法当成三种互不相关的东西。"
        },
        {
          "type": "paragraph",
          "text": "例如你写了一个 Counter 计数器。React 要知道它属于哪个父节点、这次收到什么 props、之前的状态是什么、还有没有更新需要处理。函数组件对应的 Fiber 参与保存这些信息。多个 Fiber 通过父子、兄弟引用连接起来，形成 Fiber 树。后面说的“树”就是这些对象之间的关系，不是一张额外的页面截图。"
        },
        {
          "type": "paragraph",
          "text": "阅读顺序是：先分清它与元素、DOM的关系，再看为什么需要它、它有什么作用和特性；然后认识字段和一次更新，最后运行计数器实验、对照源码。前半篇建立认识，后半篇核对实现。你不需要一开始就读懂整段协调函数。"
        },
        {
          "type": "paragraph",
          "text": "本文固定 React / React DOM 18.3.1，使用 createRoot 的客户端渲染，不展开 hydration、Suspense、Portal 或热更新。内部实现读这个版本的 .old.js 路径；ReactFeatureFlags.js 在此 tag 中的 enableNewReconciler 为 false。源码字段不是业务可依赖的公开 API，升级后应重新核对。"
        },
        {
          "type": "reference",
          "title": "React 18.3.1：old/new reconciler 选择开关",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js#L72-L75"
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
      "id": "why-fiber",
      "title": "为什么需要 Fiber：函数执行完，信息还要留下来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先看一个最小计数器。点击按钮会请求把 count 加一。组件函数执行时可以产生本次输出，但函数调用结束以后，下一次更新仍然需要找到这个组件之前的状态。单靠本次函数调用的局部变量，无法承担这种跨更新的记录。React 必须在组件函数之外管理这些信息。"
        },
        {
          "type": "code",
          "code": "function Counter() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(n => n + 1)}>{count}</button>;\n}",
          "purpose": "普通函数组件片段；放在已导入useState的React项目中。点击只负责发起更新，状态由React管理。",
          "kind": "excerpt",
          "filename": "Counter.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "如果页面还有列表、表单和侧栏，React 还需要知道这些部分怎样连接：处理完当前组件，该去哪个孩子，孩子完成后又回到哪里。同时，本次更新可能只影响其中一部分，需要记录哪些节点和子树有工作。Fiber 把这些信息组织到节点对象上，工作循环再负责读取和更新它们。"
        },
        {
          "type": "paragraph",
          "text": "另一个需求是控制一大段渲染计算。依赖普通递归调用连续完成整棵树时，JavaScript调用栈中的执行不能由React随意暂停并在任意一行恢复。将节点与进度显式保存在对象中，能让工作循环按单元推进，并在允许让出的边界把控制权还给宿主环境。稍后继续或重新开始时，React有可用的工作记录。"
        },
        {
          "type": "paragraph",
          "text": "这里有两个前提：不是每次渲染都会让出；Fiber也不会把一个组件函数中的长循环自动切开。同步渲染仍然连续执行。并发渲染可以在工作单元之间检查是否让出，但正在执行的普通JavaScript函数要先返回。结构提供了组织工作的基础，是否让出还需要调度与工作循环共同决定。"
        }
      ]
    },
    {
      "id": "responsibilities",
      "title": "Fiber 的作用与特性：记录信息，让工作有迹可循",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "可以从三个作用认识Fiber。第一，关联一个节点的类型、输入和状态。第二，把节点连接成可以遍历的树。第三，记录更新与提交相关工作，让后续阶段知道哪里要继续处理。这些作用解释的是“React需要保留什么”；下面的特性解释“这种组织方式允许怎样处理”。"
        },
        {
          "type": "table",
          "headers": [
            "特性",
            "具体含义",
            "不能据此推出什么"
          ],
          "rows": [
            [
              "信息保存在节点对象上",
              "函数返回后仍能通过React内部结构找到状态与树关系",
              "业务代码不应读取或修改私有Fiber字段"
            ],
            [
              "工作按节点推进",
              "工作循环可以找到下一个节点，并在允许时让出",
              "不能中断组件函数内部正在执行的同步代码"
            ],
            [
              "当前版本与工作版本分开组织",
              "alternate关联同一逻辑节点的两份对应工作记录",
              "不是每轮深拷贝整棵树，也不是两套DOM"
            ],
            [
              "可复用匹配的身份与工作节点",
              "协调时判断哪些旧身份可以延续，下一版从已有信息开始",
              "复用不等于组件函数不执行，更不等于没有DOM变化"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "因此，“有了Fiber就一定更快”不是准确结论。它为可调度的渲染和信息复用提供结构，但真正的耗时仍取决于组件计算量、更新范围和提交工作量。把大量同步计算写进一个组件，不能指望换成Fiber以后自动消失。本文的实验也只验证身份和状态，不宣称测出了性能收益。"
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
          "text": "看完树的连接方式，再看每个节点内部保存什么。字段不必一次背下来，先按用途分类：身份决定它是谁，输入与状态参与计算，工作标记告诉后续阶段要处理哪里。下面提到的Lane先理解为用位集合表达的工作分类；本篇不要求掌握选择算法。"
        },
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
        },
        {
          "type": "code",
          "code": "  this.tag = tag;\n  this.key = key;\n  this.elementType = null;\n  this.type = null;\n  this.stateNode = null;\n\n  // Fiber\n  this.return = null;\n  this.child = null;\n  this.sibling = null;\n  this.index = 0;\n\n  this.ref = null;\n\n  this.pendingProps = pendingProps;\n  this.memoizedProps = null;\n  this.updateQueue = null;\n  this.memoizedState = null;\n  this.dependencies = null;\n\n  this.mode = mode;\n\n  // Effects\n  this.flags = NoFlags;\n  this.subtreeFlags = NoFlags;\n  this.deletions = null;\n\n  this.lanes = NoLanes;\n  this.childLanes = NoLanes;\n\n  this.alternate = null;",
          "purpose": "React v18.3.1 FiberNode构造函数的字段初始化节选。结合上表看字段分组；null和0是创建时的初始值，不是更新后永远保持的值。",
          "kind": "excerpt",
          "filename": "ReactFiber.old.js:125–155",
          "language": "javascript"
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
          "code": "  workInProgress.child = current.child;\n  workInProgress.memoizedProps = current.memoizedProps;\n  workInProgress.memoizedState = current.memoizedState;\n  workInProgress.updateQueue = current.updateQueue;",
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
          "text": "提交阶段会应用需要的DOM变更，并在mutation阶段之后、layout阶段之前把root.current指向完成树。不能认为仅仅换一个JavaScript指针就已经更新了浏览器。这里先建立两份工作记录的概念；首次分配、后续字段重置与连续轮换在双缓冲专篇逐步展开。"
        }
      ]
    },
    {
      "id": "update-walkthrough",
      "title": "一次点击怎样经过这些结构",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在回到前面的单个Counter，初始按钮显示0。这里先不重排列表、不更换类型，只看一次普通的setCount(n => n + 1)。把过程分成下面几步，就能把前面的字段连起来。"
        },
        {
          "type": "list",
          "items": [
            "请求更新：点击事件调用setter。React为这次更新建立记录，加入对应状态Hook的队列，并将相关待处理工作标记到节点和祖先路径。此时按钮不会因为队列里多了一条记录就直接变成1。",
            "安排工作：根调度决定怎样安排这次待处理工作。Fiber保存节点与工作信息，但它本身不会像线程一样主动运行。",
            "准备与计算：React从当前树准备工作版本。处理Counter时，根据本轮要处理的更新计算状态，组件函数这次读到count为1，返回描述按钮内容的新元素。",
            "协调孩子：React比较新描述与已有孩子，判断按钮对应节点可以延续还是需要重建，并在工作树上准备必要的变更。",
            "提交结果：这轮工作完成且进入提交路径后，React应用需要的DOM变更，切换当前树；浏览器绘制发生在自己的渲染流程里。组件计算、React提交和浏览器绘制不是同一个动作。"
          ]
        },
        {
          "type": "paragraph",
          "text": "这里的memoizedState也需要结合“哪一份树”来看：current上的相关状态是当前依据；工作版本上的Hook状态会随着这轮计算更新。尚未提交的计算结果不能直接当作用户已经看到的页面。工作可能被重试或放弃，是否进入提交要看完整渲染结果。"
        },
        {
          "type": "paragraph",
          "text": "沿着这条过程，Fiber的作用就具体了：树引用让React找到要处理的节点，Hook相关结构支持状态计算，props记录输入，flags等字段记录后续工作，alternate帮助组织当前与工作版本。调度决定什么时候处理，协调决定如何对应节点，提交负责把完成的工作应用出去。"
        }
      ]
    },
    {
      "id": "identity",
      "title": "理解了结构，再看列表中的状态为什么会跟错位置",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面才引入A、B计数器。A和B只是两条业务数据的标识；两行都使用同一个Counter组件，每行有各自的useState。初始顺序是A在上、B在下，两个数字都是0。你点击A一次，页面变成A为1、B为0；然后点击“交换顺序”，让B排在A前面。问题是：重排之后，哪个计数应该保留为1？"
        },
        {
          "type": "code",
          "code": "items.map((item, index) => (\n  <Counter key={item.id} id={item.id} />\n))\n// 对照实验只把key改成index，Counter组件类型不变。",
          "purpose": "列表片段：items包含{id:\"A\"}和{id:\"B\"}，Counter内部保存count。先固定组件类型，只改变身份匹配策略。",
          "kind": "excerpt",
          "filename": "列表身份对照.tsx",
          "language": "tsx"
        },
        {
          "type": "table",
          "headers": [
            "操作阶段",
            "使用业务ID作为key",
            "使用数组下标作为key"
          ],
          "rows": [
            [
              "初始",
              "A:0，B:0",
              "A:0，B:0"
            ],
            [
              "给A加一",
              "A:1，B:0",
              "A:1，B:0"
            ],
            [
              "反转数组顺序",
              "B:0，A:1",
              "B:1，A:0"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "使用业务ID时，旧A和新A的key相同，组件类型也没变，在同一父级的这组孩子里可以延续原有身份。于是A移动到第二行，但自己的状态仍为1。使用下标时，旧第0行的key是0，新第0行的key仍是0，且两者都是Counter。React延续第0个身份的状态，而这一行收到的id已经从A变成B，所以它显示B:1。"
        },
        {
          "type": "paragraph",
          "text": "这不是数字从A的状态队列“跑进”了B的队列，而是我们用位置定义的组件身份，与用A/B定义的业务身份不一致。现在再读“React认为哪些节点是同一个”，就有了明确含义：哪些旧身份能在本轮协调中延续，而不是仅仅比较屏幕上的文字是否相同。"
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
        },
        {
          "type": "experiment",
          "id": "react-fiber-structure",
          "title": "验证业务ID与位置身份的区别",
          "description": "初始A:0/B:0，给A加一后交换。先用业务ID，再切到下标策略重新操作；观察哪一行保留1。"
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
      "id": "single-source",
      "title": "把单元素匹配读完：找到同名节点以后，还要做什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面进入进阶源码阅读。刚才的实验是数组案例，但为了先看懂key与类型如何配合，我们先读更简单的单元素路径：假设同一父级原有A、B两个孩子，现在只返回B。单元素路径不是数组重排算法；下一节再回到数组。"
        },
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
          "code": "  function reconcileSingleElement(\n    returnFiber: Fiber,\n    currentFirstChild: Fiber | null,\n    element: ReactElement,\n    lanes: Lanes,\n  ): Fiber {\n    const key = element.key;\n    let child = currentFirstChild;\n    while (child !== null) {\n      // TODO: If key === null and child.key === null, then this only applies to\n      // the first item in the list.\n      if (child.key === key) {\n        const elementType = element.type;\n        if (elementType === REACT_FRAGMENT_TYPE) {\n          if (child.tag === Fragment) {\n            deleteRemainingChildren(returnFiber, child.sibling);\n            const existing = useFiber(child, element.props.children);\n            existing.return = returnFiber;\n            if (__DEV__) {\n              existing._debugSource = element._source;\n              existing._debugOwner = element._owner;\n            }\n            return existing;\n          }\n        } else {\n          if (\n            child.elementType === elementType ||\n            // Keep this check inline so it only runs on the false path:\n            (__DEV__\n              ? isCompatibleFamilyForHotReloading(child, element)\n              : false) ||\n            // Lazy types should reconcile their resolved type.\n            // We need to do this after the Hot Reloading check above,\n            // because hot reloading has different semantics than prod because\n            // it doesn't resuspend. So we can't let the call below suspend.\n            (typeof elementType === 'object' &&\n              elementType !== null &&\n              elementType.$$typeof === REACT_LAZY_TYPE &&\n              resolveLazy(elementType) === child.type)\n          ) {\n            deleteRemainingChildren(returnFiber, child.sibling);\n            const existing = useFiber(child, element.props);\n            existing.ref = coerceRef(returnFiber, child, element);\n            existing.return = returnFiber;\n            if (__DEV__) {\n              existing._debugSource = element._source;\n              existing._debugOwner = element._owner;\n            }\n            return existing;\n          }\n        }\n        // Didn't match.\n        deleteRemainingChildren(returnFiber, child);\n        break;\n      } else {\n        deleteChild(returnFiber, child);\n      }\n      child = child.sibling;\n    }\n\n    if (element.type === REACT_FRAGMENT_TYPE) {\n      const created = createFiberFromFragment(\n        element.props.children,\n        returnFiber.mode,\n        lanes,\n        element.key,\n      );\n      created.return = returnFiber;\n      return created;\n    } else {\n      const created = createFiberFromElement(element, returnFiber.mode, lanes);\n      created.ref = coerceRef(returnFiber, currentFirstChild, element);\n      created.return = returnFiber;\n      return created;\n    }\n  }"
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
          "code": "  function updateSlot(\n    returnFiber: Fiber,\n    oldFiber: Fiber | null,\n    newChild: any,\n    lanes: Lanes,\n  ): Fiber | null {\n    // Update the fiber if the keys match, otherwise return null.\n\n    const key = oldFiber !== null ? oldFiber.key : null;\n\n    if (\n      (typeof newChild === 'string' && newChild !== '') ||\n      typeof newChild === 'number'\n    ) {\n      // Text nodes don't have keys. If the previous node is implicitly keyed\n      // we can continue to replace it without aborting even if it is not a text\n      // node.\n      if (key !== null) {\n        return null;\n      }\n      return updateTextNode(returnFiber, oldFiber, '' + newChild, lanes);\n    }\n\n    if (typeof newChild === 'object' && newChild !== null) {\n      switch (newChild.$$typeof) {\n        case REACT_ELEMENT_TYPE: {\n          if (newChild.key === key) {\n            return updateElement(returnFiber, oldFiber, newChild, lanes);\n          } else {\n            return null;\n          }\n        }\n        case REACT_PORTAL_TYPE: {\n          if (newChild.key === key) {\n            return updatePortal(returnFiber, oldFiber, newChild, lanes);\n          } else {\n            return null;\n          }\n        }\n        case REACT_LAZY_TYPE: {\n          const payload = newChild._payload;\n          const init = newChild._init;\n          return updateSlot(returnFiber, oldFiber, init(payload), lanes);\n        }\n      }\n\n      if (isArray(newChild) || getIteratorFn(newChild)) {\n        if (key !== null) {\n          return null;\n        }\n\n        return updateFragment(returnFiber, oldFiber, newChild, lanes, null);\n      }\n\n      throwOnInvalidObjectType(returnFiber, newChild);\n    }\n\n    if (__DEV__) {\n      if (typeof newChild === 'function') {\n        warnOnFunctionType(returnFiber);\n      }\n    }\n\n    return null;\n  }"
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
          "code": "  function updateElement(\n    returnFiber: Fiber,\n    current: Fiber | null,\n    element: ReactElement,\n    lanes: Lanes,\n  ): Fiber {\n    const elementType = element.type;\n    if (elementType === REACT_FRAGMENT_TYPE) {\n      return updateFragment(\n        returnFiber,\n        current,\n        element.props.children,\n        lanes,\n        element.key,\n      );\n    }\n    if (current !== null) {\n      if (\n        current.elementType === elementType ||\n        // Keep this check inline so it only runs on the false path:\n        (__DEV__\n          ? isCompatibleFamilyForHotReloading(current, element)\n          : false) ||\n        // Lazy types should reconcile their resolved type.\n        // We need to do this after the Hot Reloading check above,\n        // because hot reloading has different semantics than prod because\n        // it doesn't resuspend. So we can't let the call below suspend.\n        (typeof elementType === 'object' &&\n          elementType !== null &&\n          elementType.$$typeof === REACT_LAZY_TYPE &&\n          resolveLazy(elementType) === current.type)\n      ) {\n        // Move based on index\n        const existing = useFiber(current, element.props);\n        existing.ref = coerceRef(returnFiber, current, element);\n        existing.return = returnFiber;\n        if (__DEV__) {\n          existing._debugSource = element._source;\n          existing._debugOwner = element._owner;\n        }\n        return existing;\n      }\n    }\n    // Insert\n    const created = createFiberFromElement(element, returnFiber.mode, lanes);\n    created.ref = coerceRef(returnFiber, current, element);\n    created.return = returnFiber;\n    return created;\n  }"
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
          "code": "  function useFiber(fiber: Fiber, pendingProps: mixed): Fiber {\n    // We currently set sibling to null and index to 0 here because it is easy\n    // to forget to do before returning it. E.g. for the single child case.\n    const clone = createWorkInProgress(fiber, pendingProps);\n    clone.index = 0;\n    clone.sibling = null;\n    return clone;\n  }"
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
      "id": "boundaries",
      "title": "结构解释到哪里，就把保证停在哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "回到本文开头，Fiber首先是一个节点对象。它把类型、输入、状态、树关系和待处理工作组织在一起；多个Fiber形成工作树，工作循环据此推进更新。双缓冲组织当前与工作版本，协调确定旧身份能否延续。计数器案例只是其中“身份与状态”这一条关系的验证，不是Fiber的全部用途。"
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
