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
  "verifiedAt": "2026-10-22",
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
          "text": "本篇继续使用阅读清单：列表有300本书，每行能切换“已选”，页面还有一个与书籍无关的计数器。我们依次比较普通行、memo但函数prop不稳定、memo且输入稳定，以及固定行高窗口。每一组都说明省掉了什么、没有省掉什么，再用行为断言检查结果，避免看到日志变少就宣布页面快了。"
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
          "text": "Context还要单独看。Provider的value改变，读取该Context的消费者需要获取新值；外层memo不能把消费者锁死在旧值。把频繁变化的输入和低频主题塞到同一个大对象里，会扩大受影响范围。拆分合理的Context、将state与稳定dispatch分开或使用选择性订阅，解决的是通知范围；不要用错误比较函数阻止必要更新。"
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
      "title": "不可变更新既影响正确性，也决定复用粒度",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "要让只有第0行变化，数组应该新建，第0行对象也应该新建，其他行对象尽量沿用。这样上层知道列表变了，memo行又能知道自己是否真的变了。把全部对象都复制会扩大渲染；原地修改后继续返回旧数组则可能使React认为状态没变，让界面不更新。两种写法问题不同，不能只凭“用了展开运算符”判断更新合理。"
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
          "text": "这里仍有一次O(n)的map与列表协调；只更新一行不意味着整次工作O(1)。数据很大时，可以考虑按ID规范化、精确订阅或持久化数据结构，但要测量查找、分配、订阅管理和代码复杂度的总成本。不能把“Row少执行了”扩展成“列表没有任何工作”。"
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
          "text": "源码用areHookInputsEqual逐项比较依赖。对本例filtered而言，[books,query]完整描述过滤所需输入；tick变化不改变依赖，过滤结果数组可以沿用。query变了或books新建了，过滤仍要重新执行。它不会加速首次计算，也不会把filter自动移到后台。"
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
          "text": "JavaScript仍会先求出你传给useCallback的函数表达式，Hook再决定返回旧函数还是保存新函数。它不是禁止所有函数分配的魔法；价值通常在于把稳定引用传给依赖它的memo子组件或其他Hook。若没有这样的使用方，增加Hook和依赖比较可能只有维护成本。"
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
          "text": "这是可运行的固定行高教学窗口，不是生产级通用虚拟列表。动态行高需要测量与偏移修正；键盘焦点不能随卸载随便丢掉；屏幕阅读器、浏览器查找、滚动恢复、粘性分组和触底加载还要设计。本文明确不把这几十行代码宣称为成熟列表库替代品。实际项目应结合无障碍与交互需求选择方案。"
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
          "text": "初始普通模式300行，所有书未选。点击无关计数，普通行的提交诊断会增加。切到“memo + 不稳定函数”后重复，仍会增加；切到“memo + 稳定输入”后再点，行诊断保持不变。选中第0行则只有该行应增加，其他书仍保持原状态。模式切换会重建列表诊断，因此比较各模式内部的前后变化，不要跨模式比较绝对计数。"
        },
        {
          "type": "paragraph",
          "text": "窗口模式初始渲染9行：视口6行加后侧3行，前侧被0截断。滚到440px时渲染12行。先选中第0本，滚出去再回来，应仍已选；显示行的诊断计数可能重置，因为窗口确实卸载了它们。搜索会重置窗口位置，避免缩小结果后还停在空白的旧偏移。"
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
      "title": "最后形成一条可重复的优化流程",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先描述可观察的慢：何时、什么规模、哪种设备、用户在等什么。再用工具定位等待属于哪一层。然后选择最小改动：调整状态归属、稳定真正需要的输入、减少挂载范围、优化算法或按需加载。修改后先检查行为，再重复同一套测量，把成本和收益一起记录。"
        },
        {
          "type": "paragraph",
          "text": "缓存需要说清缓存对象、命中条件、失效时机与维护成本。Fiber双缓冲保存工作记录，memo比较组件输入，useMemo保存计算结果，请求缓存保存远端数据；它们不能用一个“缓存优化”混为一谈。读完这篇，应当能解释某次优化到底省了哪项工作，也能在缺乏收益证据时坦率地说“目前只验证了机制，没有证明更快”。"
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
