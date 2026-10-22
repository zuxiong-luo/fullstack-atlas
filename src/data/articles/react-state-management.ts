import type {Article} from '../articleTypes';
export const reactStateManagementArticle: Article = {
  "id": "react-state-management",
  "topic": "react",
  "title": "状态管理：组件状态、Store 与服务端数据",
  "description": "从数据归属和单一事实来源出发，实现稳定快照Store，解释Context、选择器、请求缓存、乱序仲裁、乐观回滚与SSR隔离。",
  "minutes": 65,
  "labMinutes": 30,
  "kind": "series",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-22",
  "tags": [
    "七篇系列·第3篇",
    "状态管理",
    "useSyncExternalStore",
    "请求缓存",
    "Context"
  ],
  "scope": "客户端状态与服务端缓存的职责、可运行教学Store和查询缓存；不实现生产查询库、真实后端、持久化或完整SSR服务。",
  "prerequisites": [
    "组件、props、useState和基础Effect",
    "Promise与不可变对象更新"
  ],
  "questionIds": [],
  "experiment": "react",
  "sections": [
    {
      "id": "concept",
      "title": "状态管理是什么：决定数据由谁保存、由谁改变",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "状态管理是对应用中会变化的数据进行组织：在哪里保存，谁有权修改，哪些界面依赖它，以及何时把它同步到别处。它不是某一个库的名字。一个组件里的useState已经在管理状态；引入Store只是把某些数据的存放和通知机制移到组件外，并不会自动解决数据归属和一致性。"
        },
        {
          "type": "paragraph",
          "text": "先把“状态”和“界面”分开。状态是当前事实，例如一篇文章是否读完；界面是根据事实和展示规则计算出的结果，例如未读列表和进度条。若事实存两份，却没有严格的同步规则，两处界面迟早会各说各话。选择Redux还是Zustand之前，先把哪些是事实、哪些是计算结果分清，通常更有价值。"
        },
        {
          "type": "paragraph",
          "text": "本篇继续做阅读清单：初始有“Fiber与协调”“Hooks与交互”两篇，都未读。用户可以标记已读、筛选未读，页面显示已读数量。随后我们增加一个独立的服务端摘要缓存，研究请求重复、返回乱序和保存失败。模拟接口不会写数据库；清单也不会自动同步到这份摘要，这个刻意分开的边界方便观察客户端状态和服务端数据各自的责任。"
        },
        {
          "type": "paragraph",
          "text": "示例固定React/React DOM 18.3.1、TypeScript 5.7.2与Node.js 22。你需要会写组件、useState和基本Effect；不需要预先用过状态库。本文会交付可运行的小型Store、请求缓存与行为测试，但不会把它宣传成可以替换成熟查询库的生产方案。React官方网站当前展示较新版本，本文只引用18.3.1已有的API契约，并用固定版本实验与源码核对。"
        }
      ]
    },
    {
      "id": "ownership",
      "title": "先分类，再决定状态放在哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "状态不是越集中越好。把输入框每次键入都放进全局Store，可能让本来独立的局部交互变成全应用要维护的公共协议；把共享数据复制进每个组件，又会失去共同来源。判断位置时，先问三个问题：哪些组件需要它？离开页面后还要不要保留？权威数据来自当前浏览器还是服务端？"
        },
        {
          "type": "table",
          "headers": [
            "数据",
            "建议归属",
            "原因"
          ],
          "rows": [
            [
              "“只看未读”开关",
              "页面组件；需要分享时放URL",
              "只影响当前展示，不是文章的业务事实"
            ],
            [
              "未提交的编辑文本",
              "表单局部草稿",
              "用户可能取消，不能每敲一字就覆盖服务端事实"
            ],
            [
              "跨区域共享的阅读偏好",
              "最近公共祖先或有明确生命周期的Store",
              "多个入口需要看到同一份事实"
            ],
            [
              "列表接口返回的文章",
              "按查询key组织的服务端缓存",
              "客户端持有副本，需要刷新、失效和权限隔离"
            ],
            [
              "已读数量、筛选结果",
              "从事实派生",
              "不额外维护另一份可能过期的真相"
            ],
            [
              "选中的文章ID",
              "路由/URL或局部状态",
              "需要刷新恢复、深链或返回历史时优先URL"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "“单一事实来源”不是全世界只能有一个对象。服务器保存已发布标题，编辑框保存用户尚未提交的草稿，这两份数据语义不同，可以同时存在。但必须明说什么时候从服务器复制为草稿、什么时候提交、提交失败保留什么。若都叫title、随时互相覆盖，问题不是React不会同步，而是系统没有定义哪份值说了算。"
        },
        {
          "type": "paragraph",
          "text": "把筛选条件放URL，也不是再把同一值同步进Store：可以直接从URL解析后渲染。确实需要输入过程与最终查询值分开时，把它们命名为draftQuery和committedQuery，并定义提交时机。账号切换同样是归属问题：不同用户的缓存不能因为组件还没卸载就沿用同一个key。"
        },
        {
          "type": "figure",
          "src": "figures/react-state-management/ownership.svg",
          "title": "阅读清单的数据归属与更新方向",
          "alt": "局部筛选和共享清单共同派生视图；服务端摘要通过带用户的查询key进入独立缓存。",
          "caption": "结构示意。派生结果不反向同步为新的事实；缓存只是服务端副本，持久化写入还需要服务器接口。"
        }
      ]
    },
    {
      "id": "minimal",
      "title": "保持状态最小：派生值、对象身份和不可变更新",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "最初两篇文章都未读，已读数为0。点击Fiber的按钮后，只修改该文章的read，再由清单计算已读数1。如果额外存readCount，就必须在新增、删除、导入、撤销等每条路径同步计数。少一个维护分支，就可能出现列表全未读、进度却为1的矛盾。派生值把这个一致性问题变成一次确定计算。"
        },
        {
          "type": "code",
          "code": "const readCount = state.books.filter(book => book.read).length;\nconst visible = state.books.filter(book => !onlyUnread || !book.read);",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "同一份清单派生统计与展示结果；此处不需要Effect维护另一份状态",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "派生计算每次执行不代表一定昂贵。两条数据没必要先加缓存。将来清单足够大、计算足够重，再测量是否需要记忆化或索引。useMemo可以减少重复计算，不能成为事实来源；丢掉计算缓存后重新计算，结果仍应正确。"
        },
        {
          "type": "code",
          "code": "export function reducer(state: ReadingState, action: Action): ReadingState {\n  if (!state.books.some(book => book.id === action.id)) return state;\n  return {...state, books: state.books.map(book => book.id === action.id\n    ? {...book, read: !book.read} : book)};\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "完整reducer：只复制变化路径，未命中的操作保持原对象",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这个reducer返回新根对象、新数组和被修改文章的新对象；另一篇文章仍沿用原引用。旧状态里的Fiber依然未读，新状态里才是已读，因此旧快照不会被事后篡改。这里所谓不可变更新，是不修改已经发布的旧对象，不是每次深拷贝所有东西。深拷贝会丢掉无变化部分的稳定身份，还可能带来无谓成本。"
        },
        {
          "type": "paragraph",
          "text": "反过来，如果直接执行state.books[0].read=true，然后继续返回同一个state，读取这份对象的旧渲染也会看到被改写的内容；依赖引用比较的订阅者却可能判断“没变化”。只把外层对象复制一份但仍原地改内部book，也会污染旧快照。TypeScript的readonly能帮助阻止常规误写，但不是运行时冻结或安全边界，绕过类型仍可破坏约定。"
        },
        {
          "type": "reference",
          "title": "Redux：最小状态与派生选择器",
          "url": "https://redux.js.org/usage/deriving-data-selectors",
          "note": "此处使用通用设计原则；示例没有安装Redux。"
        }
      ]
    },
    {
      "id": "lifting-context",
      "title": "从状态提升到 reducer + Context：先解决归属，再解决传递",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果列表和进度条是同一个页面下的兄弟组件，先把books提升到它们最近的公共祖先，再把数据和事件回调传下去。状态提升的作用是统一事实来源，而不是为了减少渲染。父组件更新后，默认仍会重新计算它返回的子组件；是否值得做性能优化，要结合实际工作量判断。"
        },
        {
          "type": "paragraph",
          "text": "当操作从toggle增加为导入、删除、撤销，useReducer可以把转换规则集中到一个纯函数。dispatch描述发生了什么，reducer根据旧状态和动作计算新状态。不要在reducer里发请求或写localStorage：React可能重新执行计算，这类外部影响不应混进状态推导。先验证动作是否可接受，再返回下一版状态，测试也不需要挂载组件。"
        },
        {
          "type": "code",
          "code": "const StateContext = createContext<ReadingState | null>(null);\nconst DispatchContext = createContext<Dispatch<Action> | null>(null);\n\nfunction ReadingProvider({children}: {children: ReactNode}) {\n  const [state, dispatch] = useReducer(reducer, initialState);\n  return <DispatchContext.Provider value={dispatch}>\n    <StateContext.Provider value={state}>{children}</StateContext.Provider>\n  </DispatchContext.Provider>;\n}",
          "language": "tsx",
          "filename": "ReadingProvider.tsx",
          "purpose": "Provider结构示意节选；需从React导入createContext/useReducer及相应类型，复用上面的reducer。React18使用.Provider语法",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "Context负责沿组件树传递值，它本身不是一个能自动管理复杂业务的Store。Provider的value变化后，读取该Context的组件会收到新值；普通useContext不会因为你只解构了books[0]就自动订阅那一个字段。即使消费者使用memo，Context的新值也能使它更新。这一点和父组件传入稳定props是否能跳过渲染，是两条不同的更新路径。"
        },
        {
          "type": "paragraph",
          "text": "把state与dispatch拆成两个Context，让只负责发动作的消费者不必订阅state变化。不过这只减少Context变化带来的更新，不承诺这些组件再也不会因父组件、props或自己的状态而渲染。把大对象的value包装在useMemo里，可以避免父级无关更新时创建新value；真正state变了，依赖它的value仍会变，消费者仍要处理。"
        },
        {
          "type": "paragraph",
          "text": "如果所有读取者每次都需要整个清单，Context方案已经合理。若有很多独立区域，只关心高频变化数据的一小部分，再考虑带选择器的订阅机制。不要只因为组件嵌套超过三层就认定必须引入全局库。"
        },
        {
          "type": "reference",
          "title": "React：useContext的更新与memo边界",
          "url": "https://react.dev/reference/react/useContext",
          "note": ""
        }
      ]
    },
    {
      "id": "store",
      "title": "外部 Store 的本质：保存快照，发布通知",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "外部Store把状态保存在React组件之外，由它提供读取、更新和订阅接口。这里的“外部”是相对React状态系统而言，不是说必须在服务器上。我们的工厂创建一个独立实例：state保留最新快照，listeners记录订阅者，dispatch负责生成新快照再通知。"
        },
        {
          "type": "code",
          "code": "export function createReadingStore(seed: ReadingState = initialState) {\n  let state = seed;\n  const listeners = new Set<() => void>();\n  return {\n    getSnapshot: () => state,\n    subscribe(listener: () => void) {\n      listeners.add(listener);\n      return () => { listeners.delete(listener); };\n    },\n    dispatch(action: Action) {\n      const next = reducer(state, action);\n      if (Object.is(next, state)) return;\n      state = next;\n      [...listeners].forEach(listener => listener());\n    },\n  };\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "完整Store实现。注意先替换state再通知；取消订阅必须移除同一个listener",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "按一次“切换fiber”，执行顺序是dispatch调用reducer、拿到新对象、替换state，最后调用listeners。订阅者收到的通知本身不携带业务变化，它会再读取最新快照。这样一个通知表达的是“可能有变化，请检查”，而不是必须重新渲染。无效ID返回旧对象，Store直接退出，不发布无意义通知。"
        },
        {
          "type": "paragraph",
          "text": "把state赋值放到通知之后会怎样？监听器执行时读取到的还是旧状态，通知结束后才变成新状态，界面可能等下一次变化才更新。取消订阅遗漏则会留下已不用的回调。示例测试覆盖先发布再通知、无效操作不通知、取消订阅后不再通知以及旧快照不被修改。"
        },
        {
          "type": "paragraph",
          "text": "实例的生命周期同样重要。示例在App里用useState惰性初始化工厂，使同一个App挂载期间持有同一个Store。重新挂载会得到新实例和初始清单，这是本实验的设计。如果业务需要跨页面保留，可以把Provider放在更高的稳定位置；只有明确需要整个浏览器会话共享时才使用客户端模块单例。"
        }
      ]
    },
    {
      "id": "subscription",
      "title": "useSyncExternalStore：React 怎样安全地读取外部快照",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "const [store] = useState(() => createReadingStore());\nconst state = useSyncExternalStore(store.subscribe, store.getSnapshot);",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "组件把订阅和读取能力交给React；这不是用Effect手工转存另一份业务状态",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "useSyncExternalStore连接Store和React：subscribe注册变化通知，getSnapshot提供当前可渲染的值。Store不变时，重复读取应得到同一个快照；发生变化时才返回不同的快照。React用Object.is比较，所以不论是对象还是原始值，都必须把“值是否变化”的约定设计好。"
        },
        {
          "type": "code",
          "code": "const badGetSnapshot = () => ({...store.getSnapshot()});\n// 错误：即使没有更新，每次读取也得到新对象。\nconst goodGetSnapshot = store.getSnapshot;\n// 正确：Store只在dispatch产生实际变化时替换快照。",
          "language": "tsx",
          "filename": "snapshot-contract.ts",
          "purpose": "失败与修正对照：不要为了“防止外部修改”在每次读取时无条件复制",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "每次读取都创建新对象，会把一次检查变成又一次“新变化”，可能出现重复更新或快照必须缓存的警告。另一端的错误是原地修改对象却一直返回同一引用：通知虽然到了，但比较可能认为值没有变化。正确做法是更新时创建快照、读取时返回它，而不是读取时制造版本。"
        },
        {
          "type": "paragraph",
          "text": "为什么不简单useEffect订阅，再setState(store.getSnapshot())？渲染读取和Effect安装之间存在时间窗口，Store可能在窗口内改变；并发准备界面时也可能在不同位置读取到不同版本。官方Hook处理订阅、检查和一致性相关工作。不要把它概括成一个Effect包装器，也不要认为用了它就可以原地修改共享对象。"
        },
        {
          "type": "reference",
          "title": "React：useSyncExternalStore接口与快照契约",
          "url": "https://react.dev/reference/react/useSyncExternalStore",
          "note": ""
        },
        {
          "type": "paragraph",
          "text": "源码可以确认“通知后重新读取并比较”这一步。以下摘自React 18.3.1 old reconciler，is对应Object.is语义。它只是完整Hook的一部分；订阅安装与一致性检查不止这一处，不能从这个短片段推出所有并发行为。"
        },
        {
          "type": "code",
          "code": "function subscribeToStore(fiber, inst, subscribe) {\n  const handleStoreChange = () => {\n    // The store changed. Check if the snapshot changed since the last time we\n    // read from the store.\n    if (checkIfSnapshotChanged(inst)) {\n      // Force a re-render.\n      forceStoreRerender(fiber);\n    }\n  };\n  // Subscribe to the store and return a clean-up function.\n  return subscribe(handleStoreChange);\n}\n\nfunction checkIfSnapshotChanged(inst) {\n  const latestGetSnapshot = inst.getSnapshot;\n  const prevValue = inst.value;\n  try {\n    const nextValue = latestGetSnapshot();\n    return !is(prevValue, nextValue);\n  } catch (error) {\n    return true;\n  }\n}\n",
          "language": "js",
          "filename": "ReactFiberHooks.old.js:1478–1501",
          "purpose": "固定版本原始源码；前一函数返回取消订阅函数，后一函数比较上次快照与当前值",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1：subscribeToStore与checkIfSnapshotChanged",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L1478-L1501",
          "note": ""
        },
        {
          "type": "paragraph",
          "text": "如果只显示已读数量，可以让getSnapshot返回number。即使清单其他字段变化，只要数量相同，读取结果仍相等，这条订阅不会因为快照变化请求渲染。但不要直接返回每次新建的过滤数组。实际状态库通常提供selector以及相应缓存或比较策略；选择器本身必须稳定、可重复计算，不能读取时顺手修改Store。父组件引起的渲染是另一回事，选择器不会消除一切渲染。"
        }
      ]
    },
    {
      "id": "choice",
      "title": "Redux、Zustand 和 Context：用需求选择，而不是比口号",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "到这里再选库，判断标准会更具体：团队是否需要统一动作约定与调试记录？是否需要选择器？状态作用域是一个页面、一个编辑器实例还是整个客户端？请求缓存是否已有独立方案？这些问题比“哪个更轻”更能预测维护成本。"
        },
        {
          "type": "table",
          "headers": [
            "方案",
            "适合考虑的情况",
            "需要自己明确的边界"
          ],
          "rows": [
            [
              "useState / useReducer + props",
              "归属清楚、共享层级不深",
              "不要复制共享事实；reducer保持纯粹"
            ],
            [
              "reducer + Context",
              "树内共享、变化频率与消费范围可控",
              "Context并不自动做到字段级订阅"
            ],
            [
              "Redux Toolkit + React Redux",
              "团队需要统一动作/reducer约定和成熟工具链",
              "不要把所有临时输入都放全局；业务模型仍由团队设计"
            ],
            [
              "Zustand",
              "希望直接组织Store动作、按选择器读取的客户端状态",
              "模块单例、实例作用域、持久化和SSR策略需显式设计"
            ],
            [
              "TanStack Query / RTK Query",
              "请求复用、缓存失效、后台刷新与mutation协调",
              "不是本地表单草稿的默认归宿，也不是数据库"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "Redux Toolkit是官方推荐的Redux逻辑编写方式，并提供可选的RTK Query。这不是说“Redux过时了，只有另一种库才现代”。Zustand也不是天然免除架构设计：同样需要决定Store的粒度和服务端请求隔离。本文不安装这两种库，不用未运行的API拼出所谓最佳实践，更不发布它们的体积或速度排名。比较的是职责取舍，而不是某个版本的内部实现。"
        },
        {
          "type": "reference",
          "title": "Redux Toolkit：官方定位与RTK Query入口",
          "url": "https://redux-toolkit.js.org/introduction/getting-started",
          "note": ""
        },
        {
          "type": "reference",
          "title": "Zustand v5.0.3：Next.js中的按请求Store设计",
          "url": "https://github.com/pmndrs/zustand/blob/v5.0.3/docs/guides/nextjs.md",
          "note": "固定资料版本供追溯；本文未运行Zustand/Next.js集成。"
        }
      ]
    },
    {
      "id": "server-cache",
      "title": "服务端数据为何需要另一套模型：key、过期与请求状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "浏览器里的主题偏好由当前客户端控制，服务端文章数据却可能被另一个设备修改。把HTTP返回值塞进Store，当然能显示出来，但你还得回答：多久后不可信？重复访问是否复用？同一用户不同筛选能否互相覆盖？保存之后哪些列表应该更新？这些就是请求缓存承担的工作。"
        },
        {
          "type": "paragraph",
          "text": "查询key表示“这是哪一份结果”。阅读摘要可以用[reading-summary,userId,schemaVersion]，带筛选的文章列表还要包含状态、页码等影响响应的参数。不要把密码或令牌直接放key；用户标识用于区分结果，授权仍必须由服务端检查。如果漏掉用户ID，账号切换时旧缓存可能短暂甚至长期显示另一人的内容。"
        },
        {
          "type": "code",
          "code": "const key = JSON.stringify(['reading-summary', userId, 1]);\n// 固定顺序的字符串/数字数组用于本例。\n// 任意对象、Date、undefined等输入需要更严格的规范化策略。",
          "language": "tsx",
          "filename": "query-key.ts",
          "purpose": "key是请求身份；不是随手把URL截一段作为缓存索引",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "本例每个key对应一个entry：snapshot是稳定的可渲染状态，pending代表正在执行的请求，version是判断返回结果是否还有效的代数。snapshot同时保存data与status，因此刷新期间可以继续显示旧数据；请求失败也可以保留上次成功数据，并显示error，而不是突然清空整个区域。"
        },
        {
          "type": "code",
          "code": "export type QueryState<T> = Readonly<{\n  status: 'idle' | 'loading' | 'success' | 'error'; data?: T;\n  error?: string; stale: boolean;\n}>;",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "数据存在、正在刷新和数据是否过期，是不同维度",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "stale表示这份副本应再验证，不等于立刻删除。invalidate先增加version使旧在途响应失去写入资格，再保留data、标为stale；本实验不自动请求，用户需再点“读取摘要”。成熟库往往还有活跃订阅、自动refetch、重试、缓存回收等规则，不能把这个小实现的默认行为套到它们身上。"
        },
        {
          "type": "paragraph",
          "text": "请求去重也有前提：同一个key代表同一数据语义，且未要求强制刷新时，已有pending可以共享。不同key不能合并。如果调用方用同一个key却传入会返回不同数据的fetcher，缓存无从识别这是设计错误。我们没有设置过期计时器，所以一次成功后会一直复用到显式失效或强制刷新；生产场景必须根据业务明确新鲜度策略。"
        }
      ]
    },
    {
      "id": "race",
      "title": "返回乱序：最后返回的不一定是当前想要的结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "初始摘要为空。发起旧请求R1，随后用户强制刷新发起R2。假设R2先返回“新响应”，R1最后才返回“旧响应”。如果每个成功回调都直接写缓存，界面会从新变旧。AbortController可以减少不需要的网络工作，但不能作为所有时序的唯一保障；缓存仍需要判断这个回调是否有权写入。"
        },
        {
          "type": "code",
          "code": "    load(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {\n      const value = entry(key);\n      if (!force && value.pending) return value.pending;\n      if (!force && value.snapshot.status === 'success' && !value.snapshot.stale)\n        return Promise.resolve(value.snapshot.data as T);\n      const version = ++value.version;\n      publish(value, {status: 'loading', data: value.snapshot.data, stale: true});\n      const pending = Promise.resolve().then(fetcher).then(data => {\n        if (version === value.version) publish(value, {status: 'success', data, stale: false});\n        return data;\n      }, error => {\n        if (version === value.version) publish(value, {\n          status: 'error', data: value.snapshot.data, stale: true,\n          error: error instanceof Error ? error.message : String(error),\n        });\n        throw error;\n      }).finally(() => { if (version === value.version) value.pending = undefined; });\n      value.pending = pending;\n      return pending;\n    },",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "完整load方法：先共享在途Promise，再通过版本号仲裁返回结果；此节选属于createQueryCache",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "R1启动时拿到version1，R2启动时把entry推进到version2。R2返回，2等于当前代数，所以发布结果；R1返回，1不等于2，数据只能返回给R1自己的调用者，不能再发布到共享缓存。注意这个区别：Promise仍然成功了，如果调用者拿到R1返回值又手动写别处，仍会重新制造竞态。界面应读取缓存快照，不要再维护一份不受仲裁的副本。"
        },
        {
          "type": "paragraph",
          "text": "错误路径同样要判断版本。不然旧请求晚到的失败会把已经成功的新页面覆盖成错误。finally清理pending也必须判断版本，避免R1结束时把仍在进行的R2从entry里清掉。测试使用手动控制resolve的Promise，确保确实按R2、R1顺序完成；并不依赖机器快慢或网络运气。"
        },
        {
          "type": "paragraph",
          "text": "本例使用一个全局listener集合，某个key变化时所有订阅者都会被通知，再由各自的快照比较决定是否更新。这是为让实现可读而保留的效率边界。高频、多key系统可以按key维护监听者与回收规则，但不能在优化时破坏快照稳定性。"
        }
      ]
    },
    {
      "id": "optimistic",
      "title": "乐观更新：先显示并不等于已经保存",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "乐观更新是提交请求之前或等待期间，先在客户端显示预计会成功的结果。它减少等待感，却增加失败恢复和并发处理的责任。阅读摘要原来是“服务端初始摘要”，点击修改后立即显示“乐观修改”；100ms后模拟保存失败，应该恢复旧值，并保留“需要重新验证”的标记。"
        },
        {
          "type": "code",
          "code": "    optimistic(key: string, data: T) {\n      const value = entry(key), previous = value.snapshot;\n      const version = ++value.version;\n      value.pending = undefined; // old reads can finish, but cannot write back\n      publish(value, {status: 'success', data, stale: true});\n      return {\n        rollback() {\n          if (value.version !== version) return false;\n          value.version++;\n          publish(value, {...previous, stale: true,\n            status: previous.status === 'loading'\n              ? (previous.data === undefined ? 'idle' : 'success') : previous.status});\n          return true;\n        },\n      };\n    },",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "条件回滚：只能恢复由当前这次乐观操作仍然占有的版本",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "直接保存previous、失败后无条件set(previous)，在只有一个请求时看似正确；一旦用户先修改M1又修改M2，M1稍后失败就会把M2也抹掉。本例让每次乐观写入获得独立version。回滚前检查自己是不是当前版本：是，恢复；不是，返回false，让调用方知道不能安全覆盖。这也是为什么按钮的失败提示分成“已回滚”和“已有较新版本”。"
        },
        {
          "type": "paragraph",
          "text": "但条件回滚并没有解决所有并发mutation。假设M2的previous本来就包含M1的未确认结果，后来两次都失败，仅按版本恢复可能仍留下未确认内容。这里应按同一实体串行保存、维护可重放的操作层，或在失败后重新读取权威数据。示例选择明确展示这个边界：只演示单次回滚和拒绝覆盖新版本，不声称多次并发保存已经与服务器一致。"
        },
        {
          "type": "paragraph",
          "text": "真实保存成功后，优先使用服务端返回的规范化结果，并使受影响的列表与统计查询失效。请求超时也不能立即推断“服务器没写”：服务端可能已保存，只是响应丢了。对于不能重复执行的操作，需要幂等键、版本条件写入或状态查询等服务器协议。客户端的version只是在本实例内仲裁回调，不是数据库版本，也不能防止另一个设备覆盖数据。"
        },
        {
          "type": "reference",
          "title": "TanStack Query：乐观更新与失败恢复",
          "url": "https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates",
          "note": "用作成熟方案的延伸资料；示例是自定义教学缓存，不声称复刻查询库。"
        }
      ]
    },
    {
      "id": "ssr",
      "title": "持久化与 SSR：Store 生命周期也是正确性的一部分",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "刷新浏览器后本示例会恢复初始清单，因为Store只在内存里。要持久化到localStorage，必须再定义序列化格式、schema版本、损坏数据处理与迁移。读取到JSON并不等于数据可信，应校验结构；浏览器存储也不能代替服务端授权，更不适合塞入不该暴露给页面脚本的秘密。"
        },
        {
          "type": "paragraph",
          "text": "SSR则有另一种生命周期：一个Node进程可能同时处理很多用户请求。如果把可变Store或带用户数据的缓存放成服务器模块单例，请求A写入的数据可能被请求B读到。解决办法不是等渲染结束后清空，因为并发请求可能交错；应为每次请求创建独立实例，再把只属于该请求的初始状态传到客户端。测试中的两个工厂实例互不影响，只验证这个必要条件，不等于验证了完整SSR服务。"
        },
        {
          "type": "code",
          "code": "function createRequestState(books: readonly Book[]) {\n  const initial = {books};\n  const store = createReadingStore(initial);\n  return {store, initial};\n}\n\n// 服务端与客户端hydration都必须获得语义相同的初始数据。\n// 传给Provider的initial应在一次hydration中保持稳定。\nconst state = useSyncExternalStore(\n  store.subscribe,\n  store.getSnapshot,\n  () => initial,\n);",
          "language": "tsx",
          "filename": "request-scope.tsx",
          "purpose": "请求实例与getServerSnapshot的接口示意；并非可直接部署的SSR服务器",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "getServerSnapshot提供服务器渲染以及客户端hydration期间使用的初始快照。这里说的相同，是序列化后数据一致，不是跨进程共享同一对象地址。客户端需要稳定持有反序列化的初始对象，不能每次getServerSnapshot都JSON.parse出一个新对象。随后普通客户端更新通过getSnapshot读取Store最新值。未提供第三个参数的本实验只用于客户端渲染，不能直接拿去服务端renderToString。"
        },
        {
          "type": "paragraph",
          "text": "把初始数据塞进HTML时还需要安全序列化，不能将含有任意文本的JSON直接拼到script标签里。账号退出时也要清除或隔离相关内存缓存与持久化数据。本文没有实现SSR、跨标签页同步、持久化或服务器权限检查；这些缺口必须由工程层补齐，不能因为Store代码只有几十行就忽略。"
        }
      ]
    },
    {
      "id": "lab",
      "title": "运行实验：用观察结果检查模型",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "react-state-management",
          "title": "阅读清单、稳定快照与请求乱序实验",
          "description": "标记已读、读取摘要、制造响应乱序，观察派生数据和带版本仲裁的缓存。示例全部为本地模拟。"
        },
        {
          "type": "code",
          "code": "cd examples/react-state-management\nnpm ci\nnpm test\nnpm run build\nnpm run dev -- --port 4303 --strictPort",
          "language": "bash",
          "filename": "terminal",
          "purpose": "Node.js22下运行独立项目；4303是此示例端口，本站仍固定4173",
          "kind": "runnable"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "预期观察",
            "验证的机制"
          ],
          "rows": [
            [
              "初始状态点击切换fiber",
              "已读数从0变1",
              "共享Store发布新快照，统计从同一清单派生"
            ],
            [
              "只看未读",
              "已读的Fiber从列表隐藏，已读数仍为1",
              "展示过滤不是删除业务数据"
            ],
            [
              "读取摘要，完成后再读取",
              "结果复用，不必生成新请求",
              "成功且未过期的缓存复用"
            ],
            [
              "标记过期，再读取",
              "先保留旧数据，后得到成功状态",
              "失效与删除不是同一操作"
            ],
            [
              "制造响应乱序",
              "两个请求结束后保留“新响应”",
              "旧响应无权覆盖最新版本"
            ],
            [
              "已读取摘要后，乐观修改后失败",
              "先显示乐观值，再恢复旧值且待验证",
              "单次失败回滚和新鲜度是两个问题"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "测试入口test.mjs使用真实React 18.3.1和jsdom检查订阅后的界面结果，用纯逻辑测试检查结构共享、取消订阅、去重、key隔离、失效、旧响应、错误恢复与条件回滚。请求时序测试使用可控Promise，不把setTimeout耗时当性能结果。jsdom不提供真实浏览器布局和绘制测量；浏览器演示中的20ms/100ms只是人为安排完成顺序，不是网络速度结论。"
        },
        {
          "type": "paragraph",
          "text": "若看不到更新，先检查是否原地修改了已发布对象、getSnapshot是否稳定、Store是否在每次render重新创建。若数据倒退，检查查询key是否完整、旧响应是否仍能写入、组件是否绕过缓存另存了一份数据。若失败后恢复了错误版本，画出每次mutation的起点、快照和返回顺序，不要只盯最后一行setState。"
        }
      ]
    },
    {
      "id": "closing",
      "title": "把这些机制放回实际项目",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在可以按一条清楚的顺序处理状态：先区分事实、草稿与派生结果，再按共享范围决定归属；局部需求用组件状态，共享树内数据可以提升或用Context，独立Store提供稳定快照和订阅；服务端副本按查询身份管理新鲜度、并发和失败。只有这些规则确定以后，库才能把重复实现收起来，而不是替你猜业务含义。"
        },
        {
          "type": "paragraph",
          "text": "本篇实现的成果不是“又一个全局变量”：它有不可变快照、通知时序、取消订阅、请求代数和回滚资格这些可测试的约束。下一步读性能篇时，可以进一步讨论选择器、稳定身份和更新范围，但先让正确性成立。少渲染一次不能弥补读错用户数据，更多缓存也不能弥补一个缺少关键参数的key。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "完整状态与缓存实验ZIP",
      "path": "react-state-management.zip"
    },
    {
      "label": "验证记录与限制",
      "path": "react-state-management/VERIFICATION.md"
    }
  ],
  "references": [
    {
      "title": "React useSyncExternalStore",
      "url": "https://react.dev/reference/react/useSyncExternalStore"
    },
    {
      "title": "React v18.3.1 Hook实现",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js"
    }
  ]
};
