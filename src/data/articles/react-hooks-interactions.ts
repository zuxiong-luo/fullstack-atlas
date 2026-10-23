import type {Article} from '../articleTypes';
export const reactHooksInteractionsArticle: Article = {
  "id": "react-hooks-interactions",
  "topic": "react",
  "title": "Hooks 与交互：状态、闭包、副作用和异步请求",
  "description": "从 Hook 的职责讲起，用阅读清单串起状态快照、更新队列、Reducer、Ref、事件、Effect 清理和请求竞态；交付可运行案例与真实 React 测试。",
  "minutes": 55,
  "labMinutes": 30,
  "tags": [
    "React 18.3.1",
    "七篇系列·第2篇",
    "Hooks",
    "Effect",
    "异步竞态"
  ],
  "kind": "series",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-23",
  "scope": "客户端函数组件的状态与外部同步；不使用 React 19 新接口，不覆盖完整请求缓存或服务端写入幂等实现。",
  "prerequisites": [
    "了解函数组件、props、受控输入和基础 JavaScript Promise",
    "建议先阅读 React 基础篇"
  ],
  "questionIds": [],
  "experiment": "react",
  "sections": [
    {
      "id": "concept",
      "title": "Hooks 是什么：给函数组件连接状态和外部系统的接口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Hook 是 React 提供给函数组件的一组接口，用来保存跨渲染的状态、读取上下文、引用 DOM，或者在提交后与外部系统同步。useState、useReducer、useRef、useEffect 都属于这组接口，但它们不是四种可以随意互换的“存变量方法”。先分清各自负责什么，比背一遍参数更有用。"
        },
        {
          "type": "paragraph",
          "text": "组件函数每次执行时都会重新建立局部变量。如果你写 let done = 0，下次调用不会自动得到上一次点击后的结果。useState 让 React 关联并保留这个组件位置上的状态，下一次调用把那一轮的值交给组件。useRef 保留一个可变容器，修改容器不会要求 React 重画；useEffect 则登记一个在提交后开始、必要时停止的同步过程。"
        },
        {
          "type": "paragraph",
          "text": "第一篇已经建立了“状态快照、数据向下、事件请求更新”的基本模型。本篇不再重讲整套清单，而是沿着一个新问题深入：界面切换到新关键词以后，旧的事件函数和旧的请求还在执行，怎样判断它们读的是哪份数据、能否继续改变界面？先认识 Hook 的调用规则，再连接闭包、Effect 和异步结果。计数区与阅读清单保留为独立诊断工具。"
        },
        {
          "type": "paragraph",
          "text": "示例固定 React / React DOM 18.3.1，使用 createRoot；完整项目默认不开 StrictMode，测试会单独开启。当前 react.dev 文档可能显示较新版本，所以本篇只采用 18.3.1 已存在并由本地实验覆盖的接口，不使用 useEffectEvent、use、Actions 等后来出现的能力。这里不会把 Hook 的使用规则直接当作完整的 Fiber 或调度算法。"
        },
        {
          "type": "table",
          "headers": [
            "需要做的事",
            "先选什么",
            "为什么"
          ],
          "rows": [
            [
              "显示“已读数量”",
              "从清单计算",
              "它是现有状态的结果，不需要第二份来源"
            ],
            [
              "保存清单",
              "useState / useReducer",
              "变化应引起界面更新"
            ],
            [
              "保留输入框节点",
              "useRef",
              "要执行 focus，不靠节点引用绘制正文"
            ],
            [
              "按关键词查询建议",
              "Effect + 清理",
              "关键词决定当前应该同步哪一份外部数据"
            ],
            [
              "响应一次标记已读点击",
              "事件处理函数",
              "这个动作由明确的用户操作触发"
            ]
          ]
        }
      ]
    },
    {
      "id": "rules",
      "title": "调用规则：为什么 Hook 不能藏在条件和事件里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React 在渲染组件时管理 Hook 对应的记录。对 useState、useReducer、useEffect 等接口，稳定的调用顺序让本次调用能够对应上一次的记录；变量叫 count 还是 total 并不是匹配依据。把 useState 放进 if，条件改变就可能让后面的调用错位。把它放进点击函数，又脱离了 React 正在渲染该组件的阶段。"
        },
        {
          "type": "code",
          "code": "function ReadingPanel({ enabled }: { enabled: boolean }) {\n  const [query, setQuery] = useState('');\n  const result = useSuggestions(enabled ? query : '');\n  if (!enabled) return <p>查询已关闭</p>;\n  return <input value={query} onChange={e => setQuery(e.target.value)} />;\n}",
          "purpose": "Hook 始终调用；把条件放进参数或 Hook 内部的 Effect，而不是跳过调用。组件节选。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "这里 enabled=false 时仍然调用两个 Hook，然后才返回关闭提示。useSuggestions 内部收到空字符串后不请求。另一个合理选择是把查询区域拆成独立子组件，通过是否挂载子组件控制生命周期；代价是卸载后该子组件的本地状态也会重置。两种写法语义不同，不应只为了通过规则机械改写。"
        },
        {
          "type": "paragraph",
          "text": "自定义 Hook 也遵守这些规则。普通工具函数可以处理数组、解析数据，但不能偷偷调用 useState；调用 Hook 的函数按约定以 use 开头，且只从组件或另一个 Hook 的顶层调用。工程中启用 eslint-plugin-react-hooks 的 rules-of-hooks 与 exhaustive-deps 检查，前者检查调用位置，后者辅助检查同步依赖；它们不能替你决定业务动作是否本来就不该放进 Effect。"
        },
        {
          "type": "reference",
          "title": "官方规则：Hook 的调用位置",
          "url": "https://react.dev/reference/rules/rules-of-hooks"
        }
      ]
    },
    {
      "id": "snapshot",
      "title": "状态快照与闭包：一次函数调用只拿到这一轮的数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "快照的意思是：一次渲染得到的 state 值不会因为调用 setter 就在当前函数里自动变成新值。setter 提交更新请求，下一次渲染再得到新状态。事件函数定义在某次组件调用里，因此它也能访问那次调用的变量，这就是 JavaScript 闭包在 React 中的表现。它不是 React 随机延迟赋值。"
        },
        {
          "type": "code",
          "code": "const [count, setCount] = useState(0);\nconst saved = useRef<(() => number) | null>(null);\n// 点击时把本轮 count 封进一个函数。\nfunction saveSnapshot() { saved.current = () => count; }\nfunction increase() { setCount(n => n + 1); }\nfunction readSaved() { return saved.current?.(); }",
          "purpose": "先在 count=0 时保存，再增加，再读取；旧函数仍返回 0。完整页面提供这三个按钮。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "按顺序操作：初始页面显示 0，点“保存快照”，再点“函数更新三次”，页面显示 3，最后点“读取旧闭包”，文字仍显示 0。原因是 ref 保存了旧函数，而那个函数引用旧渲染的 count。ref 容器本身一直存在，不会把里面的旧闭包自动改写成新闭包。你必须明确想要“操作当时的值”还是“执行时的最新值”。"
        },
        {
          "type": "paragraph",
          "text": "提交阅读反馈时记录用户点击当时选中的文章，往往应该使用当时快照。轮询或长连接回调要使用最新配置，则需要重新同步订阅，或者设计明确的可变引用。不能一看到旧值就用 ref 替代所有 state：这样界面不会随修改重画，而且可能把本应保持一致的一轮数据拆成不同时间的值。"
        },
        {
          "type": "paragraph",
          "text": "同样的规则适用于 async：await 前的事件函数不会在 await 后变成新一轮渲染的函数。异步回来后执行 setCount(count + 1)，仍可能从旧值计算；如果业务含义就是“在处理队列中的当前值上加一”，才使用函数更新。await setCount(...) 也不是等待 React 提交的接口，setter 返回值不能提供这种保证。"
        },
        {
          "type": "reference",
          "title": "官方说明：状态作为快照",
          "url": "https://react.dev/learn/state-as-a-snapshot"
        }
      ]
    },
    {
      "id": "queue",
      "title": "从已知的快照继续：混合更新按什么顺序计算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "上一章已经验证了三次值更新得到 1、三次函数更新得到 3。这里推进一步：替换和函数更新混在同一个处理函数里会怎样？先不考虑优先级，只看一次点击中三个请求的参数。下面的事件在 count=0 时依次提交“替换为 5”“在待处理值上加一”“替换为 10”。"
        },
        {
          "type": "code",
          "code": "function replaceAndCalculate() {\n  setCount(count + 5);\n  setCount(n => n + 1);\n  setCount(10);\n}",
          "purpose": "基于前文 count / setCount 的教学片段；各表达式按顺序入队。下表从初始 0 推演，最终是 10；它不是配套按钮的原样源码。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "队列条目（从 0 开始）",
            "处理方式",
            "中间结果"
          ],
          "rows": [
            [
              "替换为 5",
              "忽略之前累计值，得到 5",
              "5"
            ],
            [
              "n => n + 1",
              "接着处理前一结果",
              "6"
            ],
            [
              "替换为 10",
              "后来的替换覆盖累计结果",
              "10"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "批处理是把一组更新合并安排处理，避免每次调用都马上执行完整更新。React 18 的 createRoot 扩展了自动批处理范围，包括 Promise 回调、定时器等场景。它不是跨任意时间段的事务，也不是把每个 setter 合并成一个操作；更新队列里的计算仍要遵守各自语义。连续两个独立点击也不能假设永远合成一次提交。"
        },
        {
          "type": "paragraph",
          "text": "这里应分清三件事：闭包让 count + 5 使用事件创建时的值；队列让 updater 接到前一个待处理结果；批处理让 React 能一起安排这些请求。把第三个 setCount(10) 删除，结果就会是 6。这一推演只依赖参数和顺序，不需要先知道 Lane 或 Scheduler。"
        },
        {
          "type": "paragraph",
          "text": "更新函数必须是纯计算。不要在 n=>{sendRequest();return n+1} 里发请求；开发检查可能额外调用更新函数，未来渲染处理也不能承担“只运行一次”的业务承诺。请求放在明确事件或有清理边界的同步流程，更新函数只返回下一状态。对象或数组更新也要创建新的变化部分，不能先修改旧对象再把同一个引用塞回去。"
        },
        {
          "type": "reference",
          "title": "官方说明：状态更新队列",
          "url": "https://react.dev/learn/queueing-a-series-of-state-updates"
        },
        {
          "type": "reference",
          "title": "React 18：自动批处理与开发检查的版本依据",
          "url": "https://react.dev/blog/2022/03/29/react-v18"
        }
      ]
    },
    {
      "id": "reducer-ref",
      "title": "useReducer 与 useRef：一个组织状态变化，一个保留可变引用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "第一篇已经决定清单保存 books、已读数由 books 推导。现在多了“重置”和“标记”两种动作，可以用 reducer 把状态转换集中起来。事件只描述发生了什么，reducer 根据旧状态和动作决定新状态；这让新增动作时有一个明确的修改位置。"
        },
        {
          "type": "code",
          "code": "type Book = { id: string; title: string; done: boolean };\ntype Action = { type: 'toggle'; id: string } | { type: 'reset' };\nfunction reducer(state: Book[], action: Action): Book[] {\n  switch (action.type) {\n    case 'reset': return initialBooks.map(book => ({ ...book }));\n    case 'toggle':\n      return state.map(book => book.id === action.id\n        ? { ...book, done: !book.done } : book);\n  }\n}\nconst [books, dispatch] = useReducer(reducer, initialBooks);\nconst done = books.filter(book => book.done).length;",
          "purpose": "reducer 接收旧状态和事件，返回新状态；未变化记录保留引用。initialBooks 在完整项目定义。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "带入初始清单看 toggle：action.id=\"hooks\" 时，第一项命中并得到新的 done=true 对象，第二项沿用旧对象，map 返回新数组。下一次组件执行时 done 计算为 1。随后 dispatch({type:\"reset\"}) 会从 initialBooks 创建两条新记录，done 回到 0。reducer 没有直接修改页面；它仍然是在回答“下一份状态是什么”。"
        },
        {
          "type": "paragraph",
          "text": "useReducer 的价值是把多种业务转换集中成一张可检查的规则表。dispatch({type:\"toggle\",id:\"hooks\"}) 描述发生了什么，reducer 决定下一状态。它仍然是组件状态，不会自动成为全局 Store，也不会天然比 useState 更快。两个简单独立开关用 useState 很清楚；多个字段必须协同变化时，reducer 更容易维护不变量。"
        },
        {
          "type": "paragraph",
          "text": "完整示例测试同时检查结果和不可变性：被切换记录产生新对象，未变化记录保持原引用，原数组中的 done 仍然为 false。这里只保存本地阅读状态，没有持久化；刷新会重置。持久化、跨组件订阅与服务端数据一致性属于下一篇状态管理。"
        },
        {
          "type": "code",
          "code": "const input = useRef<HTMLInputElement>(null);\nreturn <>\n  <input ref={input} />\n  <button onClick={() => input.current?.focus()}>聚焦输入</button>\n</>;",
          "purpose": "DOM ref 的合理用途：在用户点击后执行命令，不用它保存需要显示的查询文字。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "useRef 返回的对象在同一组件实例后续渲染之间保持身份；改变 current 不触发渲染。它适合保存定时器句柄、DOM 引用或者命令回调。不要在渲染过程中随意读写 current 来维持业务状态，否则渲染重试时很难解释结果。读取可变引用的时机通常应放在事件或 Effect。若一个值决定界面，先问是否应使用 state。"
        },
        {
          "type": "reference",
          "title": "官方 API：useReducer",
          "url": "https://react.dev/reference/react/useReducer"
        },
        {
          "type": "reference",
          "title": "官方 API：useRef",
          "url": "https://react.dev/reference/react/useRef"
        }
      ]
    },
    {
      "id": "events",
      "title": "事件与 Effect：按“为什么执行”区分职责",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "事件处理函数响应一次明确交互；Effect 则声明某个外部系统应与当前已提交界面保持同步。标记已读由点击触发，应该直接 dispatch。输入关键词发生变化后，建议结果要跟随关键词变化，适合通过 Effect 管理请求。Effect 并不是“所有复杂逻辑的存放区”。"
        },
        {
          "type": "paragraph",
          "text": "例如把“发送阅读反馈”写成 useEffect(()=>sendFeedback(),[selectedBook])，就把原本一次点击的动作变成了选择变化的副作用：初次打开、切换选择、开发检查都可能触发发送。正确做法是给提交按钮一个处理函数，在那里读取当时的表单快照并发请求。若要求刷新或重试也不能重复写入，还需要服务端幂等；关闭 StrictMode 并不能提供幂等保证。"
        },
        {
          "type": "paragraph",
          "text": "事件冒泡也影响交互。把列表行点击和内部按钮点击都写成 toggle，点按钮可能执行两次。先使用语义清晰的按钮，不要让整个列表项和内部按钮重复拥有同一个动作；确实要阻止父级响应时使用 stopPropagation。preventDefault 取消表单提交或链接导航等默认行为，和阻止冒泡是不同的事。受控输入在 onChange 里读取 e.target.value 并更新 state，不要通过手动改 DOM 的 value 与 React 争夺同一份显示数据。"
        },
        {
          "type": "paragraph",
          "text": "剩余条数、筛选结果、按钮是否可用都是渲染时可以算出的信息。不要写 Effect 先计算过滤数组再 setFiltered：这样先提交一版旧结果，再请求一次更新，还增加依赖关系。只有计算确实昂贵时才讨论 memo 或别的优化，正确的数据来源应先建立。"
        },
        {
          "type": "reference",
          "title": "官方说明：事件与 Effect 的区别（本篇不使用较新 Effect Event API）",
          "url": "https://react.dev/learn/separating-events-from-effects"
        }
      ]
    },
    {
      "id": "lifecycle",
      "title": "Effect 是一段同步过程：依赖、清理与闭包一起理解",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一个 Effect 包含 setup 和可选的 cleanup。setup 开始这一轮外部同步，cleanup 停止这一轮同步。依赖变化且新界面提交后，React 先清理旧一轮，再建立新一轮；卸载时清理最后一轮。清理函数也来自某次渲染，所以它知道该停止哪一个订阅、定时器或请求，而不是“随便停止当前看到的资源”。"
        },
        {
          "type": "code",
          "code": "useEffect(() => {\n  const controller = new AbortController();\n  let active = true;\n  loader(query, controller.signal).then(items => {\n    if (active) setItems(items);\n  });\n  return () => {\n    active = false;\n    controller.abort();\n  };\n}, [query, loader]);",
          "purpose": "生命周期核心节选；错误、空查询与显示状态由后面的完整 Hook 补齐。active 是每轮 setup 的独立局部变量。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "依赖列表描述 Effect 读取了哪些会变化的渲染输入，不是你想让它“多久执行一次”的开关。React 使用 Object.is 对比各项。query 改变必须重新查询，loader 改变意味着外部操作实现变了，也必须纳入依赖。把 loader 定义成组件内每次新建的函数，会导致每次提交都得到不同引用；本例把默认实现定义在模块作用域，既稳定又没有藏住对 query 的读取。"
        },
        {
          "type": "table",
          "headers": [
            "阶段",
            "本轮闭包记住的值",
            "发生的事"
          ],
          "rows": [
            [
              "提交 query=\"react\" 后",
              "setup R：query=\"react\"、controller R、active R",
              "发起 react 查询；回调读取的是 active R"
            ],
            [
              "query 变为 \"hooks\" 并提交",
              "旧 cleanup R 仍引用 R 的局部变量",
              "将 active R=false，取消 controller R"
            ],
            [
              "开始新一轮 setup H",
              "query=\"hooks\"、controller H、active H=true",
              "建立 hooks 查询；H 和 R 的局部变量彼此独立"
            ],
            [
              "hooks 结果到达",
              "成功回调检查 active H",
              "H 有效，更新本轮结果"
            ],
            [
              "组件卸载",
              "最后一轮 cleanup H",
              "H 失效，停止其资源"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这就是闭包、依赖和清理之间的联系：依赖决定何时需要新一轮，闭包让每一轮记住自己的参数和资源，清理终止旧一轮。清理时 query 并不会神奇地变成新值；旧清理拿到旧资源，恰好是我们需要的。先按这条普通路径理解，再看下节“旧请求晚到”的失败路径。"
        },
        {
          "type": "reference",
          "title": "官方 API：Effect 的同步与清理约定",
          "url": "https://react.dev/reference/react/useEffect"
        }
      ]
    },
    {
      "id": "race",
      "title": "异步竞态：取消请求与拒绝过期结果是两道不同的边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在再看失败场景。初始关键词为空，没有请求。点击“查询 slow”后启动请求 S；在它结束前点“查询 fast”启动请求 F。如果 F 先完成，界面先显示 fast；随后 S 完成，朴素的 then(setItems) 又把结果改为 slow，输入却仍写着 fast。这里不是 state 更新丢了，而是两个合法响应写入了同一个位置，旧响应没有证明自己仍属于当前查询。"
        },
        {
          "type": "figure",
          "src": "figures/react-hooks-interactions/lifecycle.svg",
          "title": "请求切换中的资源清理与结果接纳",
          "alt": "slow setup 创建独立 active。fast 提交后 cleanup slow 将 active=false 并取消，再 setup fast；fast 成功接受，旧 slow 即使返回也忽略。",
          "caption": "先读中间的 cleanup，再看底部旧响应被拒绝。图上的时间距离是示意，测试用手动完成 Promise 控制顺序。"
        },
        {
          "type": "paragraph",
          "text": "AbortController 的职责是通知支持取消的操作停止，减少不再需要的工作；active 的职责是判断某一轮结果是否还能回写。上游可能忽略 signal，或者取消时处理已经进入后续解析流程，所以不能把“我调用了 abort”直接当成“旧结果绝不会抵达”。本例两者都用：cleanup 先设 active=false，再 abort；每个成功和失败回调都检查自己的 active。"
        },
        {
          "type": "paragraph",
          "text": "active 要定义在 Effect 的 setup 内，而不是组件外的共享变量。每轮同步需要自己的有效性；若所有请求共用一个布尔值，新请求把它改回 true，会让旧请求误以为自己仍然有效。也可以使用单调递增的请求编号，但编号同样必须在成功和失败路径检查。这里选择局部标记，因为“这一轮是否被清理”的含义直接对应 Effect 生命周期。"
        },
        {
          "type": "paragraph",
          "text": "页面还有一个容易遗漏的瞬间：query 已经变成 fast，下一轮 Effect 尚未更新 state 时，state 里仍可能保存 slow 的成功结果。完整 Hook 把 query 和结果一起存储，在返回时比较 state.query 与当前 query；不匹配就返回 loading 或 idle，避免把旧结果冒充成新查询结果。保留旧数据也可以是一种产品设计，但要明确标记它是旧数据，而不是无意混用。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "完整 useSuggestions：状态、错误、取消和显示归属一起交付",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先把 Hook 依赖的输入输出约定放在眼前。Loader 接收关键词和取消信号，返回字符串数组的 Promise。下面是项目内的完整模拟实现；它不发网络请求，让正常、较慢和失败路径能稳定复现。"
        },
        {
          "type": "code",
          "code": "export type Loader = (query:string, signal:AbortSignal)=>Promise<string[]>;\n// A deterministic fake I/O source: slow takes 600ms, fast takes 40ms.\n// This is a teaching transport, not measured network latency.\nexport const loadSuggestions:Loader = (query,signal)=>new Promise((resolve,reject)=>{\n  if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}\n  const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};\n  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);if(query==='error')reject(new Error('模拟上游失败'));else resolve([`${query} 的阅读建议`]);},query==='slow'?600:40);\n  signal.addEventListener('abort',abort,{once:true});\n});",
          "purpose": "项目原样节选：Loader 类型与默认 transport。其余 Hook 代码接在后面；文件顶部从 react 导入 useEffect、useState。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "普通路径先创建 timer，并在到期时移除 abort 监听，然后 resolve 条目或 reject 错误。取消路径则清除 timer 并 reject AbortError；once 让已触发的取消监听移除。开头 signal.aborted 的检查覆盖“调用时就已经失效”的情况。600ms 与 40ms 只是控制实验顺序，不是测量结果。"
        },
        {
          "type": "code",
          "code": "type SearchState = {query:string;status:'idle'|'loading'|'success'|'error';items:string[];error:string};\nexport function useSuggestions(query:string, loader:Loader=loadSuggestions) {\n  const [state,setState]=useState<SearchState>({query:'',status:'idle',items:[],error:''});\n  useEffect(()=>{\n    if(!query){setState({query,status:'idle',items:[],error:''});return;}\n    const controller=new AbortController();let active=true;\n    setState({query,status:'loading',items:[],error:''});\n    loader(query,controller.signal).then(items=>{\n      if(active)setState({query,status:'success',items,error:''});\n    },error=>{\n      if(active)setState({query,status:'error',items:[],error:error instanceof Error?error.message:String(error)});\n    });\n    return ()=>{active=false;controller.abort();};\n  },[query,loader]);\n  // An old response can briefly remain in state before the next Effect runs.\n  // Never label that old result as belonging to the new query.\n  return state.query===query?state:{query,status:query?'loading':'idle',items:[],error:''} as SearchState;\n}",
          "purpose": "项目完整 Hook 原样节选；上面已给出 Loader 与默认实现，导入 useEffect、useState 后可读通整个请求路径。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "state 使用 idle、loading、success、error 四种状态，调用方不必从三个布尔值猜测当前阶段。空关键词立即返回 idle，不启动请求；新的有效查询开始时清空旧条目和错误；成功保存本轮条目；失败显示错误文字。取消或过期查询没有资格改变新查询的状态，所以失败处理也检查 active。"
        },
        {
          "type": "paragraph",
          "text": "默认 loader 用定时器模拟 I/O，并正确解除 abort 监听。slow 固定等待 600ms，其他查询等待 40ms；输入 error 时返回错误。这些数字是教学输入，不是网络测速数据。真实替换为 fetch 时，需要检查 response.ok，再验证 JSON 的业务结构；HTTP 500 不会自动让 fetch 的 Promise 以网络错误拒绝，只有拿到合法且属于当前查询的数据才能进入 success。"
        },
        {
          "type": "code",
          "code": "const loader: Loader = async (query, signal) => {\n  const response = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`, { signal });\n  if (!response.ok) throw new Error(`HTTP ${response.status}`);\n  const value: unknown = await response.json();\n  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {\n    throw new Error('建议数据必须是字符串数组');\n  }\n  return value;\n};",
          "purpose": "真实 HTTP 替换示例，需自行提供同源 /api/suggestions 服务；本站静态页面不提供该接口，本片段不作为已联调证据。",
          "kind": "excerpt",
          "filename": "App.tsx",
          "language": "tsx"
        },
        {
          "type": "paragraph",
          "text": "这个 Hook 没有请求缓存、跨组件去重或重试退避。两个组件各调用一次 useSuggestions，会各有自己的 state 和 Effect，也可能各发一次请求。自定义 Hook 复用的是组织逻辑，不是自动共享某份状态。真正共享请求结果要引入更高层所有者或专门的数据缓存，下一篇会讨论。"
        },
        {
          "type": "paragraph",
          "text": "抽取 Hook 的理由是把“关键词到有效结果”的完整约定放在一个地方，而不是把每一个 useState 都包装成新名字。它的输入、输出、清理和错误策略应该能被一句业务话说明。调用者知道什么时候 loading、何时展示 error，比调用者需要知道内部用了几个 Effect 更重要。"
        },
        {
          "type": "code",
          "code": "function SuggestionsPanel() {\n  const [query, setQuery] = useState('');\n  const result = useSuggestions(query);\n  return <section>\n    <label>关键词 <input value={query}\n      onChange={event => setQuery(event.target.value)} /></label>\n    <p>{result.status}</p>\n    <ul>{result.items.map(item => <li key={item}>{item}</li>)}</ul>\n    {result.error && <p role=\"alert\">{result.error}</p>}\n  </section>;\n}",
          "purpose": "基于项目查询区域整理的独立组件节选，不是 React 源码；同文件使用上面的 Hook，省去计数与清单诊断 UI。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "调用处只管把输入交给 Hook，再按结果渲染。输入变成 fast 的那一轮，即使内部 state 仍是 slow，返回前的 state.query===query 检查也会提供 fast 的 loading。这个判断不启动请求；下一轮 Effect 才负责外部操作。这样“当前输入”和“展示给用户的结果归属”始终一致。"
        },
        {
          "type": "reference",
          "title": "官方说明：自定义 Hook 复用逻辑，而非自动共享状态",
          "url": "https://react.dev/learn/reusing-logic-with-custom-hooks"
        }
      ]
    },
    {
      "id": "strict",
      "title": "StrictMode：用重复建立和清理发现资源泄漏",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React 18 的开发 StrictMode 会额外检查渲染纯度，并在初次挂载时对 Effect 执行一次额外的建立与清理检查。生产构建不会执行这组开发检查。用户看到请求发起两次，应该先检查第一轮是否被清理，而不是先用一个 ref 锁住 Effect 永远不再运行。"
        },
        {
          "type": "paragraph",
          "text": "在本例 StrictMode 测试中，首次 setup 创建请求 1，检查 cleanup 取消它，然后 setup 创建请求 2。我们让请求 1 故意忽略取消并返回数据，界面仍应保持 loading；只有请求 2 完成才成为 success。最后卸载，第二个 signal 也必须被取消。这测试的是能够重新建立资源的正确性，而不是“永远只发一个请求”的假设。"
        },
        {
          "type": "paragraph",
          "text": "如果 setup 添加一个监听，cleanup 应移除同一个监听；如果 setup 开启定时器，cleanup 应清除对应句柄。若 setup 发出不可撤销的业务写操作，cleanup 不能让已发生的外部写入消失，说明你需要重新审视它为什么在同步阶段执行，并在业务接口层设计去重。AbortSignal 不会回滚服务端已经接受的订单或支付。"
        },
        {
          "type": "paragraph",
          "text": "浏览器实验默认不打开 StrictMode，便于第一次观察；独立测试显式包裹 React.StrictMode 验证清理。不要把这两种环境的日志次数直接比较，更不要用 jsdom 的调度结果预测所有浏览器绘制顺序。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "运行实验：每一步都有输入、预期结果和失败判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "react-hooks-interactions",
          "title": "运行阅读清单 Hooks 实验",
          "description": "比较替换与函数更新，保存旧闭包，切换已读状态，控制 slow / fast 请求。完整取消边界由项目测试覆盖。"
        },
        {
          "type": "code",
          "code": "cd examples/react-hooks-interactions\nnpm ci\nnpm test\nnpm run build\nnpm run dev -- --port 4192 --strictPort",
          "purpose": "Node.js 22 环境运行独立示例；4192 仅用于此独立示例，不改变主站固定 4173。",
          "kind": "runnable",
          "filename": "终端",
          "language": "bash"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "预期",
            "若不一致先检查"
          ],
          "rows": [
            [
              "刷新，替换三次",
              "计数从 0 到 1",
              "是否错误地换成函数更新"
            ],
            [
              "再函数更新三次",
              "从 1 到 4",
              "是否仍然传入旧 count + 1"
            ],
            [
              "在 0 保存快照，再更新，再读取",
              "旧闭包仍显示 0",
              "保存的是函数还是另一个会被改写的容器"
            ],
            [
              "标记 Hooks 已读，再重置",
              "已读数量 1，再回到 0",
              "是否直接修改旧对象，是否维护重复数量状态"
            ],
            [
              "slow 后很快 fast",
              "最终只显示 fast 的建议",
              "成功和失败回调是否都检查有效性"
            ],
            [
              "模拟失败，再清空",
              "error，再 idle",
              "是否留下旧错误或空查询仍启动请求"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "自动测试不靠等待 600ms 来碰碰运气。它注入一个手动完成的 loader，先返回 fast，再返回 slow，直接验证最新结果不会被覆盖；上游故意忽略 signal，验证的正是 active 这道结果接纳边界。另一个用例验证失败、清空和过期拒绝；StrictMode 用例验证额外清理以及最终卸载。"
        },
        {
          "type": "paragraph",
          "text": "当前已在 Node.js 22.12.0、React DOM 18.3.1、jsdom 26.1.0 环境完成 5 项测试，并通过 TypeScript 检查和 Vite 构建。测试使用真实 React 更新与 Effect，未使用手写 Hook 调度模型。它不证明真实 HTTP 服务已联调、不测量浏览器帧率，也不覆盖服务端缓存、SSR 或移动端输入法的全部交互。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "把这些规则带回业务：先确定数据属于哪一轮",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "理解普通路径后，再补几个容易误用的边界。它们都服从同一条原则：Effect 读取了哪些输入，就要据此重新同步；每一轮资源都要能独立停止。"
        },
        {
          "type": "paragraph",
          "text": "不要为了阻止重复请求删除依赖。先检查依赖是否确实必要：可以把只在 Effect 使用的配置对象移进去，把纯工具函数移到模块作用域，把基于旧状态的计算改为函数更新。如果函数确实要捕获变化的配置，就保留依赖并正确清理。useCallback 可以稳定函数身份，但它的依赖同样需要诚实，不能用它掩盖过期闭包。"
        },
        {
          "type": "paragraph",
          "text": "省略依赖数组，Effect 在该组件每次提交后重新同步；空数组表示没有从渲染中读取的可变依赖，并不保证应用生命周期永远只执行一次：组件会重新挂载，开发检查也会额外执行。把“空数组等于 componentDidMount”当规则，会忽略清理和重新同步的语义。"
        },
        {
          "type": "paragraph",
          "text": "useLayoutEffect 在 DOM 变更后、浏览器绘制前处理需要同步测量布局的工作，会阻塞绘制；useEffect 不应承担必须阻止首帧闪动的布局测量。也不能反过来断言 useEffect 一定在绘制之后执行，交互及更新路径会影响时机。本例只验证资源先清后建与请求结果有效性，不用日志替浏览器证明绘制时间。"
        },
        {
          "type": "paragraph",
          "text": "排查旧值时，先问函数来自哪次渲染，而不是先怪 setter；排查重复更新时，先看传入的是替换值还是计算函数；排查 Effect 时，先问外部同步是否真的必要、依赖是否完整、清理是否对应自己的资源；排查异步覆盖时，检查结果能否证明它仍属于当前查询。每个问题都有具体观察点，没必要把它们统一叫成“React 很玄学”。"
        },
        {
          "type": "table",
          "headers": [
            "检查理解",
            "解析"
          ],
          "rows": [
            [
              "把 active 放进组件外，全体请求共用，会怎样？",
              "fast 的 setup 把共享标记置为 true 后，晚到的 slow 也看到 true，仍可覆盖新结果。标记必须属于各自 setup，或使用能区分请求的编号。"
            ],
            [
              "依赖从 [query, loader] 改成 [] 能避免竞态吗？",
              "只能让后续关键词不再触发同步，查询功能本身就错了。竞态要通过清理和结果归属解决，不能靠删除真实依赖。"
            ],
            [
              "为什么成功和失败回调都检查 active？",
              "旧请求除了能带回旧数据，也可能带回旧错误。只防成功覆盖，slow 的晚到错误仍可能把 fast 的成功界面改成 error。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "本章交付的是可靠的组件交互：纯计算负责推导界面，事件表达用户动作，状态记录要展示的数据，ref 保存命令引用，Effect 管理外部同步，清理拒绝过期工作。接下来状态管理会沿着这个清单扩展多个组件和服务端缓存，讨论数据该归谁、谁订阅、何时失效。Hook 的基本语义不会因换一个状态库而消失。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "完整 Hooks 交互实验 ZIP",
      "path": "react-hooks-interactions.zip"
    },
    {
      "label": "验证记录与限制",
      "path": "react-hooks-interactions/VERIFICATION.md"
    }
  ],
  "references": [
    {
      "title": "React 18 发布说明",
      "url": "https://react.dev/blog/2022/03/29/react-v18"
    }
  ]
};
