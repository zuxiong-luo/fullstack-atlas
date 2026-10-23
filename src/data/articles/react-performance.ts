import type {Article} from '../articleTypes';
export const reactPerformanceArticle: Article = {
  "id": "react-performance",
  "topic": "react",
  "title": "性能优化：先定位成本，再减少真正多余的工作",
  "description": "从性能指标与工具讲起，推导状态归属、memo、Hook缓存、不可变更新和列表窗口，用正确性实验区分减少工作与隐藏错误。",
  "minutes": 80,
  "labMinutes": 40,
  "tags": [
    "React 18.3.1",
    "七篇系列·第6篇",
    "性能",
    "Profiler",
    "窗口化"
  ],
  "kind": "series",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-23",
  "scope": "客户端性能定位与可验证优化；固定行高窗口为教学实现，不覆盖动态测量/完整无障碍。未提供未经测量的生产收益。",
  "prerequisites": [
    "props、state、不可变更新",
    "Fiber复用与提交",
    "Hook依赖和闭包"
  ],
  "questionIds": [],
  "experiment": "react",
  "sections": [
    {
      "id": "concept",
      "title": "性能优化是什么：让一次交互少等待、少做无效工作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React性能优化是在保持结果正确的前提下，降低页面完成任务需要的时间和资源。它既包括少计算、少渲染、少更新DOM，也包括让紧急反馈更早出现、降低首次下载与执行成本。目标不是把组件渲染次数压到零：用户选中一本书，相关行就应该更新；如果界面不动只是因为比较函数屏蔽了变化，那是错误，不是优化。"
        },
        {
          "type": "paragraph",
          "text": "贯穿案例是一份300本书的清单，每行可切换“已选”，页面还有一个无关计数器。我们先建立成本与测量概念，再逐项解释状态位置、memo和窗口化，最后用同一次“计数加一”走完整条诊断流程。你可以只读正文跟完关键代码；实验入口用于亲手验证，出处链接用于核对。"
        },
        {
          "type": "paragraph",
          "text": "阅读前需要理解props、状态快照、不可变更新、Fiber复用与提交。示例固定React/React DOM18.3.1，不假定React Compiler已启用。当前实验不发布任何提速百分比；它交付可复现机制和测量方法，你可以用自己的目标设备补上真实性能证据。"
        }
      ]
    },
    {
      "id": "measure",
      "title": "先定位瓶颈：慢在网络、计算、渲染，还是浏览器绘制",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "用户说“点击很慢”时，先把一次交互拆开。事件可能排队等待主线程；处理函数可能做重计算；React可能计算大量子树；提交可能操作很多DOM；浏览器随后还要计算样式、布局与绘制。另一些等待来自网络或模块下载。只记录组件函数执行几次，无法区分这些原因。"
        },
        {
          "type": "figure",
          "src": "figures/react-performance/pipeline.svg",
          "title": "从输入到可见反馈的成本分布",
          "alt": "输入等待、事件处理、React计算、提交、浏览器布局与绘制依次构成观察路径；网络可能与计算交叠。",
          "caption": "教学结构示意，无虚构耗时。实验使用React18.3.1。"
        },
        {
          "type": "table",
          "headers": [
            "观察工具",
            "能回答的问题",
            "不能直接推导"
          ],
          "rows": [
            [
              "浏览器Network",
              "请求大小、等待与加载顺序",
              "某个组件是否memo命中"
            ],
            [
              "浏览器Performance",
              "主线程长任务、脚本、布局、绘制关系",
              "哪个业务算法一定该换库"
            ],
            [
              "React DevTools Profiler",
              "哪些组件参与提交、React渲染耗时",
              "全部网络等待或完整页面paint耗时"
            ],
            [
              "DOM/交互测试",
              "结果与节点行为是否正确",
              "用户设备的交互P95"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "先固定输入规模与操作：300行、给第0行选中、无关计数加一、滚动到第10行。第一次挂载和后续更新分别记录，先预热再采集相同数量样本。报告中写明构建模式、浏览器版本、设备与是否限速；同时保留中位数和尾部样本，不只截一次最好看的数字。若业务瓶颈是请求串行，给每个Row加memo并不能让接口更早返回。"
        },
        {
          "type": "reference",
          "title": "Chrome DevTools：Performance面板",
          "url": "https://developer.chrome.com/docs/devtools/performance/overview"
        }
      ]
    },
    {
      "id": "profiler",
      "title": "怎样读 Profiler：actualDuration 与 baseDuration",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Profiler围住一个React子树，onRender在相关提交时提供渲染观测。actualDuration是这次更新中该子树用于渲染的时间；baseDuration是根据组件最近渲染成本估算的完整子树成本。后者不是“关闭优化后重新实测了一遍”，二者也不包括所有下载、浏览器布局和屏幕绘制。因此actualDuration下降是线索，最终体验仍需浏览器时间线或真实用户指标验证。"
        },
        {
          "type": "code",
          "purpose": "记录采样，不在Profiler回调里setState；否则测量面板可能自己制造更新循环。",
          "code": "const samples: Array<{phase:string;actual:number;base:number}> = [];\n<Profiler id=\"books\" onRender={(_id,phase,actual,base) => {\n  samples.push({phase,actual,base});\n}}>\n  <BookList />\n</Profiler>",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "正常生产构建默认关闭Profiler计时，需要使用对应profiling构建才能在生产模式采样；本例为了方便复现，在本地npm run dev下使用开发React观测。开发结果适合定位，不直接充当生产收益。站内实验室如果加载普通生产运行时，读取结果可能没有样本，界面会明确提示，而不是伪造0毫秒。"
        },
        {
          "type": "reference",
          "title": "React18 Profiler：指标与生产profiling限制",
          "url": "https://18.react.dev/reference/react/Profiler"
        },
        {
          "type": "paragraph",
          "text": "本例用最近秩法汇总：将n个数从小到大排序，P95取ceil(0.95×n)对应的值；空样本返回null。样本少时P95接近最大值，应说明样本量。测量按钮自身也会更新父组件，所以读取的是点击之前的快照。实际报告应区分mount与update，不把首次初始化和后续选择动作混成一组。"
        },
        {
          "type": "code",
          "purpose": "独立可测的汇总函数；不修改传入样本。",
          "code": "export function percentile(values:number[],fraction:number){\n  if(!values.length) return null;\n  const sorted=[...values].sort((a,b)=>a-b);\n  const index=Math.max(0,Math.min(sorted.length-1,Math.ceil(fraction*sorted.length)-1));\n  return sorted[index];\n}",
          "language": "typescript",
          "filename": "App.tsx",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "scope",
      "title": "先缩小状态影响范围，再考虑缓存",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "当无关计数保存在页面顶层时，顶层更新会重新执行它返回的子树计算，普通Row也可能随父组件执行。如果这个计数只服务一个工具栏，把它放回工具栏通常比给整页到处加useMemo更直接：它让一次局部动作从更小的节点开始。状态应放在需要共享它的最近合理位置，不是所有值都往上提或塞进全局Store。"
        },
        {
          "type": "code",
          "purpose": "工具栏自己的更新不再要求重新执行整个清单容器。",
          "code": "function Toolbar() {\n  const [tick,setTick]=useState(0);\n  return <button onClick={()=>setTick(n=>n+1)}>记录 {tick}</button>;\n}\nfunction ReadingPage() {\n  return <><Toolbar/><BookList/></>;\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "另一种情况是容器自己的视觉状态，例如鼠标悬停或展开/收起。把昂贵内容作为稳定children传进容器，容器内部状态变化时可以避免由容器重新创建那段元素描述。但如果上层自己每次也重新渲染并创建children，条件就不同。组件组合优化来自实际数据流，不是任何地方包一层组件都会更快。"
        },
        {
          "type": "paragraph",
          "text": "状态管理篇已经说明Context传播，这里只关心它带来的工作范围：把高频输入和低频主题放在同一个value，会让只用主题的消费者也收到变化。性能问题如果来自这种通知范围，应先调整订阅边界，而不是继续给消费者套memo。"
        },
        {
          "type": "experiment",
          "id": "react-bailout-memo",
          "title": "补充实验：memo、子节点state与Context",
          "description": "比较父组件无关更新、面板自身更新、叶子更新和Context变化。观察的是提交后诊断，不是性能基准。"
        }
      ]
    },
    {
      "id": "memo",
      "title": "memo 比较的是输入：引用稳定为何重要",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React.memo给组件增加props比较的优化机会。默认逐个prop按Object.is比较；同内容的新对象、新数组或新函数仍可能被认为改变。这里“浅比较”是比较props各字段的值，不是把嵌套数据结构递归扫一遍。因此把整个book原样传入可以利用未改变对象的引用，而每次都传{...book}会破坏这个条件。"
        },
        {
          "type": "code",
          "purpose": "MemoComponent在没有相关更新或Context变化时比较props与ref",
          "code": "  const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(\n    current,\n    renderLanes,\n  );\n  if (!hasScheduledUpdateOrContext) {\n    // This will be the props with resolved defaultProps,\n    // unlike current.memoizedProps which will be the unresolved ones.\n    const prevProps = currentChild.memoizedProps;\n    // Default to shallow comparison\n    let compare = Component.compare;\n    compare = compare !== null ? compare : shallowEqual;\n    if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {\n      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);\n    }",
          "language": "javascript",
          "filename": "ReactFiberBeginWork.old.js:542–555",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · MemoComponent在没有相关更新或Context变化时比较props与ref",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberBeginWork.old.js#L542-L555"
        },
        {
          "type": "paragraph",
          "text": "将本例代进去：无关tick增加，books引用没变，某行book对象也没变。如果onToggle保持同一函数引用，浅比较可以通过，相关行计算有机会跳过。若onToggle每次写成新箭头函数，哪怕函数体文字完全一样，prop值仍不同，memo会继续处理。这就是实验第二组“加了memo却没省工作”的原因。"
        },
        {
          "type": "table",
          "headers": [
            "这次更新的输入",
            "源码经过的判断",
            "行计算的结果"
          ],
          "rows": [
            [
              "tick变了，book与onToggle沿用",
              "没有该行自己的更新；默认浅比较通过，ref相同",
              "可以进入bailout，跳过这次行计算"
            ],
            [
              "book不变，onToggle是新函数",
              "浅比较发现函数引用变化",
              "继续计算行"
            ],
            [
              "第0本selected变化",
              "第0行book是新对象，比较不通过",
              "第0行需要计算；其他行仍可比较通过"
            ]
          ]
        },
        {
          "type": "code",
          "purpose": "稳定回调利用函数式更新读取当次最新列表；不捕获过期books。",
          "code": "const stableToggle=useCallback((id:number)=>{\n  setBooks(prev=>prev.map(book =>\n    book.id===id ? {...book,selected:!book.selected} : book\n  ));\n},[]);\n// 每行接收原book对象与stableToggle。",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "空依赖在这里成立是因为闭包只使用稳定setter以及传入id，更新数据通过prev取得。不要机械把任何回调都改成[]。如果函数还读取当前过滤条件或权限，则这些值必须纳入依赖或重新设计参数来源。稳定引用只能帮助性能，不能把旧业务条件冻住。"
        },
        {
          "type": "paragraph",
          "text": "memo也不是子树的永久封印。组件自身state或消费的Context变化仍可能使它更新；子节点有工作时，即使当前组件计算被跳过，React仍可能沿childLanes进入后代。Fiber的身份复用只保证更新前后的对应关系，与是否跳过计算是两层不同判断。"
        },
        {
          "type": "reference",
          "title": "React18 memo：props比较、自身state与Context",
          "url": "https://18.react.dev/reference/react/memo"
        }
      ]
    },
    {
      "id": "identity",
      "title": "结构共享怎样把一次修改限制在一行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "沿用状态管理篇的结构共享约定：只复制变化路径。本节关注它的性能含义。toggleBook返回新数组，被选中的book得到新对象，其他299本仍是原对象；memo拿到这些引用，就能把“这一行的数据没变”转成一次可用的跳过条件。"
        },
        {
          "type": "code",
          "purpose": "完整状态转换函数；测试检查新旧引用和旧数据是否被修改。",
          "code": "export function toggleBook(books:Book[],id:number){\n  return books.map(book=>book.id===id\n    ? {...book,selected:!book.selected}\n    : book);\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "实现",
            "数组身份",
            "未修改行身份",
            "后果"
          ],
          "rows": [
            [
              "原地改字段并返回原数组",
              "相同",
              "相同",
              "可能被跳过，破坏状态快照"
            ],
            [
              "每行都展开复制",
              "新",
              "全新",
              "可以正确但失去细粒度复用"
            ],
            [
              "只复制修改行",
              "新",
              "沿用",
              "正确表达实际变化范围"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这让299行有机会跳过组件计算，但上层仍做了一次map，并创建和协调列表元素。优化报告应写“缩小行组件计算范围”，而不是“把列表更新变成O(1)”。只有定位到这次线性遍历本身已成瓶颈，再考虑索引、精确订阅等进一步设计。"
        }
      ]
    },
    {
      "id": "hook-cache",
      "title": "useMemo 与 useCallback：保存什么、何时失效",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "useMemo保存某次纯计算的返回值和依赖；useCallback保存函数引用和依赖。它们的记录属于当前组件的Hook位置，不是全局多key缓存。依赖相同可以返回上次记录，依赖改变就重新保存。通常它们只为当前依赖组合保留最近结果，先搜A再搜B再搜A，不能假定A的旧结果还在一个自动建立的字典里。"
        },
        {
          "type": "code",
          "purpose": "updateMemo：依赖一致返回已有值，否则重新计算并保存",
          "code": "function updateMemo<T>(\n  nextCreate: () => T,\n  deps: Array<mixed> | void | null,\n): T {\n  const hook = updateWorkInProgressHook();\n  const nextDeps = deps === undefined ? null : deps;\n  const prevState = hook.memoizedState;\n  if (prevState !== null) {\n    // Assume these are defined. If they're not, areHookInputsEqual will warn.\n    if (nextDeps !== null) {\n      const prevDeps: Array<mixed> | null = prevState[1];\n      if (areHookInputsEqual(nextDeps, prevDeps)) {\n        return prevState[0];\n      }\n    }\n  }\n  const nextValue = nextCreate();\n  hook.memoizedState = [nextValue, nextDeps];\n  return nextValue;\n}",
          "language": "javascript",
          "filename": "ReactFiberHooks.old.js:1915–1934",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · updateMemo：依赖一致返回已有值，否则重新计算并保存",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L1915-L1934"
        },
        {
          "type": "paragraph",
          "text": "先只看三个位置：prevState[1]保存上一次依赖，areHookInputsEqual决定是否命中，prevState[0]是命中时返回的旧结果。过滤的依赖是[books, query]：tick从0变1时这两个输入都没变，直接返回旧数组；query从空串变成“1”时比较失败，执行nextCreate，再把新结果与新依赖一起写回Hook。"
        },
        {
          "type": "code",
          "purpose": "updateCallback：命中时返回以前的函数引用",
          "code": "function updateCallback<T>(callback: T, deps: Array<mixed> | void | null): T {\n  const hook = updateWorkInProgressHook();\n  const nextDeps = deps === undefined ? null : deps;\n  const prevState = hook.memoizedState;\n  if (prevState !== null) {\n    if (nextDeps !== null) {\n      const prevDeps: Array<mixed> | null = prevState[1];\n      if (areHookInputsEqual(nextDeps, prevDeps)) {\n        return prevState[0];\n      }\n    }\n  }\n  hook.memoizedState = [callback, nextDeps];\n  return callback;\n}",
          "language": "javascript",
          "filename": "ReactFiberHooks.old.js:1888–1902",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "React v18.3.1 · updateCallback：命中时返回以前的函数引用",
          "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js#L1888-L1902"
        },
        {
          "type": "paragraph",
          "text": "updateCallback的相同分支返回prevState[0]，不同分支保存当前传入的callback。JavaScript求值时仍会创建本轮函数，Hook决定最终交给调用者的是哪一个引用。这里需要稳定引用的使用方是MemoRow的onToggle；没有使用方依赖这个身份时，就没有必要仅为“函数必须缓存”增加Hook。"
        },
        {
          "type": "code",
          "purpose": "过滤结果是派生数据，直接计算或按已测量成本记忆化，而不是Effect再写一份state。",
          "code": "const filtered=useMemo(\n  ()=>books.filter(book=>book.title.includes(query)),\n  [books,query]\n);",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "不要把必须长期保留的业务值放进useMemo然后指望永不丢失。重新挂载会重建Hook，开发修改与初次挂起等场景也可能影响缓存；业务正确性需要state、ref或真正的数据存储来表达。读取每次变化的配置却漏写依赖，得到的不是高命中率，而是过期结果。"
        },
        {
          "type": "reference",
          "title": "React18 useMemo：性能用途与缓存生命周期",
          "url": "https://18.react.dev/reference/react/useMemo"
        },
        {
          "type": "experiment",
          "id": "react-hook-memoization",
          "title": "补充实验：依赖、失效与旧闭包",
          "description": "对照依赖稳定、正常失效和缺失依赖；明确缓存内容而不是笼统说“React有缓存”。"
        }
      ]
    },
    {
      "id": "comparator",
      "title": "最危险的优化：比较通过了，行为却错了",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "自定义比较函数返回true的含义是：沿用旧props仍能得到等价输出和行为。不是“这几个字段看起来一样”。假设按钮label永远不变，但onClick捕获了父组件当轮tick；比较函数只看label，就会保留旧onClick。用户看到按钮正常，点击却读到旧计数。视觉没变不能证明交互等价。"
        },
        {
          "type": "code",
          "purpose": "故意错误的对照：忽略read的变化。完整实验旁边有默认比较的正确按钮。",
          "code": "const UnsafeRead=memo(\n  function Read({read}:{read:()=>void}) {\n    return <button onClick={read}>读取</button>;\n  },\n  ()=>true\n);",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "实验初始tick=0。先点“无关计数加一”得到1，再点“错误比较：读取计数”，结果仍是0；默认比较按钮则读到1。自动测试断言这一差异，用来说明优化必须先通过行为检查。不要为了消掉渲染警告而永远返回true，也不要把函数prop直接从比较逻辑里删掉。"
        },
        {
          "type": "paragraph",
          "text": "深比较也不是通用救援。如果嵌套数据大、深度不受约束，比较本身可能比重新计算更贵；循环引用还要处理。设计更小、更稳定且语义清晰的props通常更容易维护。确需自定义比较时，先证明等价条件，再在目标设备测比较成本与跳过工作收益。"
        }
      ]
    },
    {
      "id": "window",
      "title": "减少工作量：固定行高窗口怎样推导",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "前面的优化仍可能让页面保留全部300行DOM。列表更大时，即使React计算很快，浏览器维护、布局和绘制大量节点也有成本。窗口化只挂载视口附近的一段行，用总高度占位，滚动时切换显示范围。分页减少的是一次提供的数据；窗口化减少的是同时挂载的节点。两者也可以组合。"
        },
        {
          "type": "figure",
          "src": "figures/react-performance/window.svg",
          "title": "窗口范围：总高度、偏移与 overscan",
          "alt": "总高度N乘行高，视口根据scrollTop定位start/end，额外行overscan减少滚动边缘空白；可见项绝对定位到start乘行高。",
          "caption": "教学结构示意，无虚构耗时。实验使用React18.3.1。"
        },
        {
          "type": "paragraph",
          "text": "本例固定行高44px，视口264px，理论上容纳6行，再向两侧各多保留3行作为overscan。scrollTop为440时，起始可见索引是10；减去3得到start=7。末端用ceil((440+264)/44)=16，再加3得到end=19。采用左闭右开区间[7,19)，渲染12行，外层总高度仍为300×44=13200px。"
        },
        {
          "type": "code",
          "purpose": "完整范围计算。输入是非负滚动位置、正行高和视口高度；末端限制在total之内。",
          "code": "export function windowRange(total:number,scrollTop:number,rowHeight:number,height:number,overscan=3){\n  const start=Math.max(0,Math.floor(scrollTop/rowHeight)-overscan);\n  const end=Math.min(total,Math.ceil((scrollTop+height)/rowHeight)+overscan);\n  return {start:Math.min(start,total),end};\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "purpose": "完整App中的布局核心；range、shown与Item来自配套文件。",
          "code": "<div style={{height:264,overflowY:\"auto\"}} onScroll={e=>setTop(e.currentTarget.scrollTop)}>\n  <div style={{height:filtered.length*44,position:\"relative\"}}>\n    <div style={{position:\"absolute\",top:range.start*44,left:0,right:0}}>\n      {shown.map(book=><Item key={book.id} book={book} onToggle={stableToggle}/>)}\n    </div>\n  </div>\n</div>",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "窗口会卸载离开范围的行，所以重要业务状态必须放到可持续存在的容器或Store。选中第0本后滚动离开再回来，仍应已选；如果把业务选中仅存在Row的useState里，卸载后就会丢失。key不能阻止真实卸载，也不是永久保存本地状态的仓库。"
        },
        {
          "type": "paragraph",
          "text": "这个窗口假设每行始终44px。若标题换行改变实际高度，偏移公式就失效，需要测量并修正；若焦点所在行离开窗口，还需要设计焦点保留。动态行高、无障碍、查找与滚动恢复决定了生产方案的复杂度，本文的固定行高例子用来理解几何和状态生命周期。"
        }
      ]
    },
    {
      "id": "other-costs",
      "title": "代码分割、重计算与调度怎样配合",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "首屏慢也许是下载了根本还不用的编辑器或图表模块。React.lazy配合动态import可以推迟加载，Suspense提供等待界面。但拆包会带来额外请求和加载失败路径，过度拆分还可能制造瀑布。先看构建产物与Network，再按路由、低频工具或可独立加载功能切分；已经缓存的代码重复访问时收益又不同。"
        },
        {
          "type": "code",
          "purpose": "模块级声明lazy，加载失败应交给外层Error Boundary处理。",
          "code": "const Editor=lazy(()=>import('./Editor'));\nfunction BookDetails({editing}:{editing:boolean}) {\n  return editing\n    ? <Suspense fallback={<p>编辑器加载中…</p>}><Editor/></Suspense>\n    : <p>选择编辑后加载工具。</p>;\n}",
          "language": "tsx",
          "filename": "App.tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果耗时来自单次大排序、编码或解析，memo只能在输入不变时复用，输入每次变了仍然贵。先检查算法与数据结构，例如重复遍历能否合并、线性查找能否建立索引；可移交的纯CPU计算可以用Worker，但通信复制、取消过期任务和内存占用都要计入。React调度无法打断一个函数内部已经开始的同步循环。"
        },
        {
          "type": "paragraph",
          "text": "transition或deferred value可以优先响应输入，但它们改变执行安排，不保证总工作更少。窗口化、减少派生数据重复计算和稳定输入减少工作量；调度让这些工作在更合适的时机发生。这两个方向常常需要一起做，但每次实验最好只改一个变量，才能知道收益来自哪里。"
        },
        {
          "type": "reference",
          "title": "React18 lazy：动态模块加载与声明位置",
          "url": "https://18.react.dev/reference/react/lazy"
        }
      ]
    },
    {
      "id": "diagnosis",
      "title": "走完一次诊断：为什么计数加一，整张清单都在工作？",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "这是基于配套代码的诊断演练，不是虚构的线上事故或耗时报告。固定条件为300行、空搜索、全部未选，唯一操作是“无关计数加一”。目标先定成：计数正确增加，而书籍业务状态不变；然后检查本次更新是否仍让所有行参与计算。"
        },
        {
          "type": "code",
          "code": "type Book = {id: number; title: string; selected: boolean};\nfunction Row({book,onToggle}:{book:Book;onToggle:(id:number)=>void}) {\n  return <button onClick={()=>onToggle(book.id)}>\n    {book.title}：{book.selected ? '已选' : '未选'}\n  </button>;\n}\nconst MemoRow = memo(Row);\nconst Item = mode === 'plain' ? Row : MemoRow;\nconst toggle = mode === 'unstable'\n  ? (id:number) => stableToggle(id)\n  : stableToggle;\n// App的列表区域：\n{shown.map(book => <Item key={book.id} book={book} onToggle={toggle}/>)}",
          "language": "tsx",
          "filename": "App.tsx",
          "purpose": "把完整实验中的比较路径放在一起；Row省略诊断计数与布局，stableToggle沿用前文，shown是当前显示的书籍数组。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一步排除错误方向。这个按钮只setTick，没有HTTP调用；列表本来已经挂载，key也没有因tick改变。可先排除“这次点击在等接口”与“更换key造成全量重新挂载”这两个假设。接着看行上的提交诊断和React Profiler，而不是先引入缓存库。"
        },
        {
          "type": "paragraph",
          "text": "第二步建立对照。在普通行模式下，App因tick更新重新计算列表，Row没有props比较屏障。改到“memo + 不稳定函数”，book沿用，但toggle每次都是新箭头函数，因此onToggle使比较失败。这个对照很重要：加了memo没有达到目标，有具体输入变化可以解释。"
        },
        {
          "type": "paragraph",
          "text": "第三步只改回调身份。切到“memo + 稳定输入”，重复同样操作；stableToggle和book都沿用，行诊断应保持不变。随后点第0本的切换按钮，第0行应改变为已选，其他行保留原状态。后一个动作证明优化仍允许必要更新，没有把界面冻住。"
        },
        {
          "type": "table",
          "headers": [
            "对照组",
            "无关计数加一后的预期",
            "由此可得的结论"
          ],
          "rows": [
            [
              "普通行",
              "行诊断增加",
              "父级更新传播到了行计算"
            ],
            [
              "memo + 不稳定函数",
              "行诊断仍增加",
              "新函数prop阻止了比较命中"
            ],
            [
              "memo + 稳定输入",
              "行诊断不增加；计数仍增加",
              "无关操作可以跳过行计算"
            ],
            [
              "稳定输入后选择第0本",
              "第0行变化，其他行保持",
              "必要数据变化仍被保留"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "行诊断在layout effect中累加，反映该行参与提交后的观察，不统计所有被放弃的render尝试。模式切换通过key重建列表，因此只比较同一模式内操作前后的增量。先完成这组行为检查，再用Profiler采样，最后用浏览器Performance检查交互到显示之间是否仍有长任务或大量布局。"
        },
        {
          "type": "paragraph",
          "text": "第四步形成可复查记录。每种模式先预热5次，清空采样，再执行20次计数加一，记录构建、设备、浏览器、样本数、中位数与P95。两组使用相同操作和规模；20次只是入门练习，尾部估计很不稳定，正式评估需要更多样本。本文没有填写耗时，因为这些数必须来自实际设备。"
        },
        {
          "type": "table",
          "headers": [
            "记录项",
            "本演练如何填写"
          ],
          "rows": [
            [
              "行为",
              "普通与不稳定memo仍有行更新；稳定输入可跳过，需实际按步骤确认"
            ],
            [
              "耗时与环境",
              "由执行者填写真实值；不得拿测试运行时间代替"
            ],
            [
              "若React耗时下降但体验没变",
              "继续查布局、绘制、其他脚本和输入等待"
            ],
            [
              "最终决定",
              "收益稳定且正确性通过才保留；否则优先把tick下沉到工具栏等更简单方案"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "如果慢的是滚动而不是这个按钮，切换窗口模式才是另一个假设：它减少挂载节点，而非只跳过计算。不要把memo、窗口化和调度同时打开后，把全部改善归给最后加的那一行代码。"
        }
      ]
    },
    {
      "id": "experiment",
      "title": "完整实验与验收：正确结果必须先过关",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "react-performance",
          "title": "打开清单优化实验",
          "description": "先比较三种行模式的无关更新，再切换窗口，最后验证错误比较产生旧闭包。"
        },
        {
          "type": "paragraph",
          "text": "实验入口保留普通行、不稳定memo、稳定memo与窗口四组，按上一节诊断顺序验证前三组。随后开启窗口：初始9行，滚动到440px时12行；先选中第0本，滚出去再回来仍已选。搜索会重置窗口位置，避免结果变少后停在原来的空白偏移。"
        },
        {
          "type": "code",
          "purpose": "Node22，从仓库根进入项目；ZIP解压则直接进入该目录。",
          "code": "cd examples/react-performance\nnpm ci\nnpm test\nnpm run build\nnpm run dev",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "自动测试覆盖不可变引用、窗口几何、样本汇总、普通与不稳定memo的行为、稳定输入下的选择性更新、错误比较旧闭包，以及滚动卸载后的选中状态。它们验证正确性与工作范围，不测量浏览器性能。jsdom没有真实布局与屏幕绘制，不能把这些测试运行时间当列表基准。"
        },
        {
          "type": "paragraph",
          "text": "性能采样请先选择一种模式，预热操作，清空采样，重复固定动作再读取。开发Profiler输出用于定位；发布收益应补充生产profiling构建与浏览器实测。若没有收益或差异落在噪声范围内，应撤回复杂优化或降低结论强度，而不是继续添加更多缓存直到图表好看。"
        }
      ]
    },
    {
      "id": "decision",
      "title": "检查你是否已经分清：少做工作，还是只是看不到变化",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "判断题",
            "沿机制解释"
          ],
          "rows": [
            [
              "Fiber沿用，组件就一定没有重新执行吗？",
              "不一定。身份复用保留节点关系与状态；是否跳过计算还取决于输入、更新与Context。"
            ],
            [
              "actualDuration降低，就能说交互P95改善吗？",
              "不能直接推出。它测量React渲染成本，输入等待、布局和绘制还需完整时间线或用户指标。"
            ],
            [
              "第0行改变，其他行memo命中，是O(1)更新吗？",
              "不是。上层map、元素协调等工作仍存在，只是减少了行组件计算。"
            ],
            [
              "比较函数永远返回true，为什么按钮还会读到旧计数？",
              "它继续沿用旧props，其中的回调捕获旧tick；输出外观一样，交互语义已不等价。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "一份可靠的优化结论应该能补全这句话：在什么操作和规模下，哪一层原来做了什么工作，我改变了什么输入或工作范围，行为检查与测量分别证明了什么。这样即使最终没有明显提速，排查也留下了清楚的依据。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "清单优化完整项目ZIP",
      "path": "react-performance.zip"
    },
    {
      "label": "验证记录与测量限制",
      "path": "react-performance/VERIFICATION.md"
    }
  ],
  "references": [
    {
      "title": "React18 Profiler",
      "url": "https://18.react.dev/reference/react/Profiler"
    },
    {
      "title": "React18 memo",
      "url": "https://18.react.dev/reference/react/memo"
    },
    {
      "title": "固定React18.3.1 Hook实现",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js"
    }
  ]
};
