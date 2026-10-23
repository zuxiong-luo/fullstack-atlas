import type { Article, ArticleBlock, ArticleSection } from '../articleTypes';
const excerpts = {
  "mount": {
    "file": "ReactFiberHooks.old.js",
    "start": 1904,
    "end": 1913,
    "code": "function mountMemo<T>(\n  nextCreate: () => T,\n  deps: Array<mixed> | void | null,\n): T {\n  const hook = mountWorkInProgressHook();\n  const nextDeps = deps === undefined ? null : deps;\n  const nextValue = nextCreate();\n  hook.memoizedState = [nextValue, nextDeps];\n  return nextValue;\n}"
  },
  "update": {
    "file": "ReactFiberHooks.old.js",
    "start": 1915,
    "end": 1934,
    "code": "function updateMemo<T>(\n  nextCreate: () => T,\n  deps: Array<mixed> | void | null,\n): T {\n  const hook = updateWorkInProgressHook();\n  const nextDeps = deps === undefined ? null : deps;\n  const prevState = hook.memoizedState;\n  if (prevState !== null) {\n    // Assume these are defined. If they're not, areHookInputsEqual will warn.\n    if (nextDeps !== null) {\n      const prevDeps: Array<mixed> | null = prevState[1];\n      if (areHookInputsEqual(nextDeps, prevDeps)) {\n        return prevState[0];\n      }\n    }\n  }\n  const nextValue = nextCreate();\n  hook.memoizedState = [nextValue, nextDeps];\n  return nextValue;\n}"
  },
  "callback": {
    "file": "ReactFiberHooks.old.js",
    "start": 1881,
    "end": 1902,
    "code": "function mountCallback<T>(callback: T, deps: Array<mixed> | void | null): T {\n  const hook = mountWorkInProgressHook();\n  const nextDeps = deps === undefined ? null : deps;\n  hook.memoizedState = [callback, nextDeps];\n  return callback;\n}\n\nfunction updateCallback<T>(callback: T, deps: Array<mixed> | void | null): T {\n  const hook = updateWorkInProgressHook();\n  const nextDeps = deps === undefined ? null : deps;\n  const prevState = hook.memoizedState;\n  if (prevState !== null) {\n    if (nextDeps !== null) {\n      const prevDeps: Array<mixed> | null = prevState[1];\n      if (areHookInputsEqual(nextDeps, prevDeps)) {\n        return prevState[0];\n      }\n    }\n  }\n  hook.memoizedState = [callback, nextDeps];\n  return callback;\n}"
  },
  "deps": {
    "file": "ReactFiberHooks.old.js",
    "start": 326,
    "end": 371,
    "code": "function areHookInputsEqual(\n  nextDeps: Array<mixed>,\n  prevDeps: Array<mixed> | null,\n) {\n  if (__DEV__) {\n    if (ignorePreviousDependencies) {\n      // Only true when this component is being hot reloaded.\n      return false;\n    }\n  }\n\n  if (prevDeps === null) {\n    if (__DEV__) {\n      console.error(\n        '%s received a final argument during this render, but not during ' +\n          'the previous render. Even though the final argument is optional, ' +\n          'its type cannot change between renders.',\n        currentHookNameInDev,\n      );\n    }\n    return false;\n  }\n\n  if (__DEV__) {\n    // Don't bother comparing lengths in prod because these arrays should be\n    // passed inline.\n    if (nextDeps.length !== prevDeps.length) {\n      console.error(\n        'The final argument passed to %s changed size between renders. The ' +\n          'order and size of this array must remain constant.\\n\\n' +\n          'Previous: %s\\n' +\n          'Incoming: %s',\n        currentHookNameInDev,\n        `[${prevDeps.join(', ')}]`,\n        `[${nextDeps.join(', ')}]`,\n      );\n    }\n  }\n  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {\n    if (is(nextDeps[i], prevDeps[i])) {\n      continue;\n    }\n    return false;\n  }\n  return true;\n}"
  }
};
const p = (text: string): ArticleBlock => ({type:'paragraph',text});
const section = (id:string,title:string,blocks:ArticleBlock[]):ArticleSection=>({id,title,paragraphs:[],blocks});
const source = (key:keyof typeof excerpts,purpose:string):ArticleBlock=>{const x=excerpts[key];return {type:'code',language:'flow',filename:`React 18.3.1 · ${x.file}:${x.start}–${x.end} · MIT`,kind:'excerpt',purpose,code:x.code};};
const reference = (key:keyof typeof excerpts):ArticleBlock=>{const x=excerpts[key];return {type:'reference',title:`固定源码 ${x.file}:${x.start}–${x.end}`,url:`https://github.com/facebook/react/blob/v18.3.1/packages/${x.file==='shallowEqual.js'?'shared':'react-reconciler/src'}/${x.file}#L${x.start}-L${x.end}`};};
const sample=(code:string,purpose:string):ArticleBlock=>({type:'code',language:'tsx',filename:'App.tsx · 项目节选',kind:'excerpt',code,purpose});
export const reactHookMemoizationArticle: Article = {
 id:'react-hook-memoization',topic:'react',title:'useMemo 与 useCallback：缓存对象、依赖比较与函数闭包',description:'沿任务筛选的连续更新追踪Hook槽位、依赖比较和引用身份，实测正确缓存、错误依赖、对象依赖失效与重挂载。',
 minutes:43,labMinutes:25,kind:'series',status:'review',verifiedAt:'2026-10-23',versions:['React / React DOM 18.3.1','Node 22.12.0 / TypeScript 5.7.2'],tags:['React','useMemo','useCallback','闭包','依赖'],
 scope:'E2。固定18.3.1.old客户端Hook路径，讨论每个组件实例的记忆化值/函数与依赖比较。不讨论React Compiler、服务端cache、请求去重或持久化缓存。',prerequisites:['理解state快照和闭包','理解Hooks顺序及组件身份','知道memo浅比较与render/commit区别'],questionIds:[],experiment:'react',
 examples:[{label:'完整Hook记忆化实验',path:'react-hook-memoization.zip'},{label:'运行说明',path:'react-hook-memoization/README.md'},{label:'源码证据与验证记录',path:'react-hook-memoization/VERIFICATION.md'}],
 sections:[
 section('problem','先说清记忆化：当前Hook沿用上一次值或函数',[
 p('useMemo和useCallback是组件内部的记忆化Hook。记忆化指保存一次计算结果，在输入满足约定时继续沿用。useMemo保存计算返回的值；useCallback保存函数引用。它们属于当前组件实例的某个Hook位置，React通过依赖数组判断上次结果能否继续使用。'),
 p('需要它们的常见原因有两个：重复执行一段较重的纯计算；或者希望把稳定的对象、函数交给按引用比较的下游。前者关注计算成本，后者关注身份。两者都建立在业务语义不变的前提下：优化可以删掉，正确结果仍应成立。'),
 p('本文先建立保存结构，再沿挂载、依赖命中、依赖变化走通普通路径。之后用任务筛选验证依赖遗漏、新对象依赖与旧闭包，并解释换key为什么会重新开始。React.memo的组件级比较由专门文章主讲，这里只回顾函数引用会影响memo子组件这一必要前提。'),
 p('贯穿案例使用60条固定任务，初始query为字符串1，tick为0。Board展示正确缓存、遗漏依赖、不缓存三组筛选结果，同时观察每轮新建options的缓存引用。query在1和6之间切换；generation用作key，显式演示实例替换。先知道输入与组件关系，再看下面Hook为什么命中或重算。'),
 {type:'experiment',id:'react-hook-memoization',title:'打开 Hook 记忆化对照实验',description:'关键实现均在本文内。实验室用于亲手切换输入；每个故障组都明确标记。'}]),
 section('what','先确定缓存对象：值、函数、组件，不是一件事',[
 {type:'table',headers:['手段','沿用对象','谁决定命中','它不做什么'],rows:[['useMemo','计算返回的值','当前Hook的依赖逐项比较','不自动阻止当前组件执行'],['useCallback','函数引用','当前Hook的依赖逐项比较','不调用函数，不消除外层创建函数表达式'],['React.memo','组件父输入相同时的一部分工作','props比较及state/Context等工作检查','不冻结子树，不缓存任意历史参数组合']]},
 p('如果calculate返回一个数组，useMemo保留的是那份数组引用；如果返回一个数字，保留的就是那个值。useCallback保留传入的函数，通常包含创建时的词法环境。两者都依附于当前组件的Hook位置，不能理解成模块级Map，更不能把同一函数的所有历史参数都找回来。'),
 p('为什么说useMemo不阻止组件执行？React需要先执行到这次Hook调用，拿到新的依赖并比较，才知道能否跳过calculate。组件函数本身的其他逻辑、依赖数组创建、Hook访问和比较仍要发生。若真正昂贵的是组件外的布局或某个事件回调，单给一个轻量表达式包useMemo，并不会自动作用到那些工作。'),
 p('有两种常见收益：避免相同依赖下的昂贵纯计算；或者为下游memo/Effect提供稳定引用。它们可能同时存在，但不必强行一起使用。返回一个几乎不耗时的值也可能为了身份稳定而缓存；相反，一个很昂贵的计算如果每次依赖都变，缓存命中就很少。先说明要省哪部分工作，才有讨论成本的依据。')]),
 section('implementation','先把完整输入、计算与界面放在一起',[
 {type:'code',language:'tsx',filename:'examples/react-hook-memoization/App.tsx · 完整业务文件',kind:'excerpt',purpose:'内嵌配套文件（仅格式化换行）：TASKS、calculate、Identity、ChildButton、Board与App。入口只负责createRoot；样式和项目启动文件不参与缓存逻辑。',code:"import React, {\n  memo,\n  useCallback,\n  useLayoutEffect,\n  useMemo,\n  useRef,\n  useState,\n} from \"react\";\nexport const TASKS = Array.from({ length: 60 }, (_, i) => ({\n  id: i + 1,\n  title: `任务 ${i + 1}`,\n}));\nexport function calculate(tasks: typeof TASKS, query: string) {\n  let checksum = 0;\n  for (const task of tasks)\n    for (let j = 0; j < 4000; j++)\n      checksum = (checksum + ((task.id * 31 + j) % 97)) % 1000003;\n  return { rows: tasks.filter((t) => t.title.includes(query)), checksum };\n}\nfunction Identity({ value, name }: { value: unknown; name: string }) {\n  const ref = useRef<HTMLSpanElement>(null);\n  const previous = useRef<unknown>(undefined);\n  const changes = useRef(0);\n  useLayoutEffect(() => {\n    if (!Object.is(previous.current, value)) changes.current += 1;\n    previous.current = value;\n    if (ref.current) ref.current.textContent = String(changes.current);\n  });\n  return (\n    <p>\n      已提交的 {name} 引用变化：\n      <span data-identity={name} ref={ref}>\n        0\n      </span>\n    </p>\n  );\n}\nconst ChildButton = memo(function ChildButton({\n  onClick,\n  name,\n}: {\n  onClick: () => void;\n  name: string;\n}) {\n  return (\n    <div>\n      <button data-action={name} onClick={onClick}>\n        {name}：读取 query\n      </button>\n      <Identity value={onClick} name={name} />\n    </div>\n  );\n});\nexport function Board({ query, tick }: { query: string; tick: number }) {\n  const [report, setReport] = useState(\"尚未读取\");\n  const correct = useMemo(() => calculate(TASKS, query), [query]);\n  // 故障组1：遗漏query。请勿复制到业务代码。\n  const stale = useMemo(() => calculate(TASKS, query), []);\n  const options = { query };\n  const unstable = useMemo(() => calculate(TASKS, options.query), [options]);\n  const uncached = calculate(TASKS, query);\n  const callback = useCallback(() => setReport(`correct:${query}`), [query]);\n  // 故障组2：函数身份稳定，读取的却是挂载时快照。\n  const staleCallback = useCallback(() => setReport(`stale:${query}`), []);\n  // 该函数会随Board执行重新创建；它不一定是问题。\n  const inline = () => setReport(`inline:${query}`);\n  return (\n    <section>\n      <p>无关更新 tick={tick}</p>\n      <p data-result=\"correct\">正确缓存：{correct.rows.length}</p>\n      <p data-result=\"stale\">遗漏依赖：{stale.rows.length}</p>\n      <p data-result=\"uncached\">不缓存：{uncached.rows.length}</p>\n      <Identity name=\"correct\" value={correct} />\n      <Identity name=\"unstable\" value={unstable} />\n      <Identity name=\"uncached\" value={uncached} />\n      <ChildButton name=\"callback\" onClick={callback} />\n      <ChildButton name=\"stale-callback\" onClick={staleCallback} />\n      <ChildButton name=\"inline\" onClick={inline} />\n      <p data-result=\"report\">{report}</p>\n    </section>\n  );\n}\nexport default function App() {\n  const [query, setQuery] = useState(\"1\");\n  const [tick, setTick] = useState(0);\n  const [generation, setGeneration] = useState(0);\n  return (\n    <main\n      style={{\n        fontFamily: \"system-ui\",\n        maxWidth: 820,\n        padding: 20,\n        margin: \"auto\",\n        lineHeight: 1.7,\n      }}\n    >\n      <h1>Hook 记忆化保存了什么？</h1>\n      <p>\n        真实 React 18.3.1，无\n        StrictMode。诊断只观察已提交结果的引用变化，不统计被放弃计算，也不报告性能收益。\n      </p>\n      <label>\n        筛选{\" \"}\n        <input\n          aria-label=\"筛选\"\n          value={query}\n          onChange={(e) => setQuery(e.target.value)}\n        />\n      </label>\n      <button\n        data-action=\"query\"\n        onClick={() => setQuery((q) => (q === \"1\" ? \"6\" : \"1\"))}\n      >\n        切换1/6\n      </button>\n      <button data-action=\"unrelated\" onClick={() => setTick((n) => n + 1)}>\n        无关更新\n      </button>\n      <button data-action=\"remount\" onClick={() => setGeneration((n) => n + 1)}>\n        换 key 重挂载\n      </button>\n      <Board key={generation} query={query} tick={tick} />\n      <p>\n        遗漏依赖两组故意错误。换key后它们重新捕获当前query，不等于错误已经修复。\n      </p>\n    </main>\n  );\n}\n"},
 p('calculate先做确定性整数运算，再按title包含query过滤。它返回一个新对象，包含rows与checksum；每次真正调用时都会生成新结果引用。额外循环只是让“有一段计算工作”具体可见，不代表真实筛选成本。query=1时匹配ID1、10至19、21、31、41、51，共15条；query=6时匹配6、16、26、36、46、56、60，共7条。结果数量变化帮助暴露遗漏依赖。'),
 p('Identity在提交后的layout effect中比较本次value和前次value，再修改自己的span。它统计已提交引用变化，不统计calculate调用次数；两次计算可能产生同一原始值，被放弃的render也不在该诊断中。因此后文用它核对引用，不据此计算性能收益。无关tick虽然不参与筛选，仍作为prop传入Board，确保Board执行以触发Hook比较。'),
 p('先只点一次无关更新：query仍为1，正确缓存拿到同一结果引用，不缓存和options组拿到新引用。再切到6：正确组和不缓存组显示7，故障空依赖组停在15。接着点三个读取按钮：正确与inline读6，空依赖回调读1。下面逐步从源码解释这些观察。')]),
 section('mount','第一次调用：Hook保存的是[value, deps]',[
 p('先看18.3.1的mountMemo完整函数。它通过mountWorkInProgressHook得到当前Hook槽位，调用你传来的计算函数，再把结果和依赖一起放入memoizedState。这里的字段属于Hook，不是Fiber上整条Hook链的字段含义；同名字段在不同结构上要看清对象。'),
 source('mount','完整mountMemo。原Flow源码，MIT；源码代码块不是独立运行示例。'),
 p('带入实际输入：query="1"，calculate返回对象R1，包含匹配行和确定性checksum。这个Hook保存[R1,["1"]]并返回R1。若不传第二个参数，nextDeps是null；传[]则是长度为0的数组。这两种输入在后续更新中走不同路径，不能把“没写依赖”和“空依赖”当成同义写法。'),
 {type:'figure',src:'figures/react-hook-memoization/slots.svg',title:'同一Hook槽位，保存一份本次可沿用的值和依赖',alt:'首次query1保存R1和依赖1；无关更新依赖仍1返回R1；query6产生R6并替换；再次query1重新计算R1新对象，不从历史参数表取回最初对象。',caption:'流程示意，R1/R6代表引用身份而非内存地址。没有跨组件共享，也没有多key历史缓存。'},
 p('这里已经能看出生命周期限制：同一组件身份与同一Hook顺序，是找到原槽位的前提。条件调用、循环里数量变化会破坏Hook对应关系；换key导致重挂载，则开始一套新Hook，不会去旧实例那里取缓存。你需要长期保存的用户输入应当进入state等语义存储，而不是寄希望于一次计算缓存永不丢失。'),reference('mount')]),
 section('update','第二次调用：先比依赖，再决定返回旧值还是算新值',[
 source('update','完整updateMemo；未删去无依赖或旧状态不存在的回退分支。'),
 p('父组件只更新无关tick，Board仍会执行。新的query依然是"1"，依赖数组虽然是一份新数组，但比较函数逐项比较数组里的值，不要求数组对象本身相同。依赖命中后，updateMemo直接返回prevState[0]，所以correct组仍拿到R1。新的箭头计算函数已经由JavaScript表达式创建，但这条命中路径不会调用它。'),
 p('接着把query改成"6"。依赖不相等，代码继续执行nextCreate，得到R6，写入[R6,["6"]]。如果再改回"1"，它比较的是刚才保存的["6"]，于是重新计算，得到内容可能与R1相同、引用却不同的R1′。这不是缓存“失忆”，而是该Hook根本没有承诺维护按关键词索引的历史表。'),
 sample('const result = useMemo(\n  () => calculate(TASKS, query),\n  [query]\n);\n// TASKS是示例模块级固定数据，不在组件执行中重建。', '正确组与不缓存组得到相同业务结果；区别在能否沿用上次引用与计算。'),
 p('如果tasks来自props或state，并会换成新数组，那么tasks也属于依赖。示例省去它，只因为TASKS是模块级固定常量；不能把[query]照抄到数据会变化的业务组件。依赖列表是一份你向React提供的读取关系说明，不是任意挑几个“我希望变化时才计算”的开关。'),reference('update')]),
 section('trace','用一张记录表追踪同一个Hook位置',[
 {type:'table',headers:['操作','当前依赖与旧依赖','执行分支','Hook保存状态与输出'],rows:[['首次query=1','没有旧Hook','mountMemo调用calculate','保存[R1,[1]]，返回R1'],['tick从0到1','[1]对比[1]','updateMemo比较命中','沿用[R1,[1]]，返回同一R1'],['query改6','[6]对比[1]','比较失败，重新calculate','保存[R6,[6]]，返回R6'],['query改回1','[1]对比[6]','再次比较失败','保存[R1新,[1]]，不是最初R1'],['换generation/key','新组件身份，没有旧Hook','重新mountMemo','独立保存本次结果和依赖']]},
 p('表里的1和6表示字符串输入，R表示对象引用标签。每一步只与这次工作的上一份Hook状态比较，不存在“以前查询过1，所以去全局历史表找R1”的分支。你如果需要按多个关键词复用结果，必须另行设计key、容量、失效与共享范围；单个useMemo没有交付那张表。'),
 p('函数缓存也可以按同样方式推演：初次query=1保存[F1,[1]]；tick变化仍返回F1；query改6后保存[F6,[6]]。区别只在于useCallback不执行这个函数，直到用户点击按钮，函数才把自己闭包中的query写入report。缓存保存与业务调用发生在两个时刻。')]),
 section('dependencies','依赖数组比较的是每个位置，不会理解对象内容',[
 p('areHookInputsEqual是决定命中的函数。下面保留完整开发检查：热更新时可以忽略旧依赖；上次没有依赖、这次突然有依赖会回退；长度变化在开发模式发出警告；正常比较用Object.is语义逐项检查。依赖的顺序和数量必须固定，这不是可变参数的集合。'),
 source('deps','完整areHookInputsEqual，包括开发检查和长度警告；不要把生产分支缺少长度保护当成可改变依赖数量的支持。'),
 p('注意一个容易被伪代码抹平的细节：源码不是先对依赖数组做深比较。每个位置只做is比较；新对象即使内容一样也会不同。也不要据循环只比较两边共同长度，就故意动态增加或删除依赖。那违反Hook用法前提，开发模式会提示，生产中不值得依赖这种偶然表现。'),
 sample('const options = { query };\nconst result = useMemo(\n  () => calculate(TASKS, options.query),\n  [options]\n);', '故障组：每次Board执行都创建新的options，依赖总变，结果引用随无关更新改变。'),
 p('修复常常不需要再套一层useMemo。把临时对象放进计算函数，依赖真正决定结果的query即可；或在确实需要复用options身份时单独稳定它。但多一层记忆化也多一套依赖和理解成本。先去掉不必要的中间对象，通常比把整个组件包成缓存网更容易维护。'),
 p('另一种反例更危险：tasks原地修改，引用保持不变，而依赖只有tasks。React比较会命中，但内容已经变了。此时失效的是你的不可变数据约定，不是React应该做深遍历。输入变化要通过新引用或正确的依赖表达，让下游有可靠证据判断是否继续沿用。'),reference('deps')]),
 section('callback','useCallback保存旧函数，并不把旧函数改造成最新闭包',[
 p('现在看mountCallback与updateCallback。它们与memo结构相似，但没有nextCreate调用：保存的是callback本身。依赖命中直接返回旧函数；不命中则保存本次传入的新函数。React并不会把旧函数闭包里的query替换为最新值。'),
 source('callback','完整mountCallback与updateCallback，连续原源码。注意没有执行callback。'),
 sample('const onRead = useCallback(\n  () => setReport(`correct:${query}`),\n  [query]\n);\nconst staleRead = useCallback(\n  () => setReport(`stale:${query}`),\n  [] // 故意错误：遗漏query\n);', '正确组在query变时得到新函数，故障组稳定地保留挂载时query。'),
 p('挂载时query="1"，两个函数都能读1。更新到6时，正确组依赖不相等，保存F6；故障组空依赖仍命中，继续返回F1。按钮点击发生在更新之后，不代表它自动读取新的组件局部变量；调用的仍是那一份闭包。稳定不等于最新，这就是实验中stale:1的来源。'),
 p('函数prop的身份为什么重要？实验的ChildButton使用memo。当无关tick变化，正确useCallback保持onClick相同，按钮可以跳过父输入带来的工作；inline组每次拿到新函数，因此没有这个命中条件。可它的业务结果依然正确，通常也很廉价。不要为了让每个按钮都“安静”，反而给它制造旧闭包。'),
 p('useCallback也没有消除JavaScript对箭头函数表达式的求值。调用Hook之前，新函数已经被创建出来，Hook决定的是返回旧的还是新的。它主要解决向下传递的身份，不是一个阻止任何函数分配的编译器。本文也没有启用React Compiler，不能拿当前官网关于自动记忆化的新版说明反推这份18.3.1项目。'),reference('callback')]),
 section('stale','依赖遗漏不是一笔性能收益：先把正确性恢复',[
 p('故障useMemo把deps写成[]，挂载筛query1后，切query6仍然返回query1那份结果。和useCallback故障一样，问题是计算读取了变化的数据，却没有声明依赖。若你只有一个空状态界面，这类错误可能藏很久；所以测试必须包含“数据真正改变”的输入，而不是只测试同值重复渲染。'),
 p('示例故意切换1与6，两组匹配数量不同，能够在界面上直接看出错误。若选两组数量恰好相同的query，只比较length就可能漏掉内容已经不一致。实际业务测试更应该核对ID或完整展示数据，而不仅比较有几行。本示例纯函数测试还验证同输入结果确定、无匹配时为空。'),
 p('有时可以通过改写逻辑合理减少依赖。例如回调只根据上一份state追加任务，可以使用setTasks(previous => [...previous, task])，不再捕获外层tasks；但task本身若来自props，仍是依赖。这个改写改变了数据读取位置，不能把它泛化成“函数式更新可以让依赖都写空”。'),
 sample('const add = useCallback(() => {\n  setTasks(previous => [...previous, task]);\n}, [task]);', '示意性项目写法：通过更新函数读取最新旧state，但仍声明闭包中的task。不能直接替换本实验未定义的setTasks。'),
 p('把每个不稳定值塞进ref再让回调永远不变，也不是无成本解法。那会改变“读某次渲染快照”与“调用时读最新可变值”的语义，并引入同步时机问题。先说明你的业务要哪一种语义；不能为了绕过依赖检查，让正确性变成隐含约定。')]),
 section('lifetime','换key之后缓存重建，正好暴露它不是持久存储',[
 p('实验里点击“换key重挂载”，Board的Hook身份被替换。即使父query仍是6，正确缓存也从新的挂载开始；故障空依赖组这次捕获6，看上去突然恢复了。再切回1，它又会停在6。这一步很适合揭露错误依赖：重挂载只重置症状，没有修复读取关系。'),
 p('不同Board实例各有自己的Hook链；第一个实例算过query1，不会让第二个实例自动共享那份结果。组件卸载、身份变化、未完成的render被放弃，也不能被理解为一份用户必须永远可访问的仓库。React还会在开发刷新等特定情况下重算。你的应用应该能承受重新计算，而不是依赖缓存一直存在才能保持正确。'),
 p('不要在useMemo里建立必须精确释放的外部资源，例如连接、订阅或对象URL；计算发生在render，可能没有对应的提交生命周期。需要同步外部系统时用合适的Effect及清理；需要用户可编辑状态时用state；需要跨渲染保存非展示的可变实例字段时考虑ref。它们和“允许随时重新算的纯派生值”承担不同责任。'),
 p('同样，useMemo(()=>fetch(...), deps)不是完整请求缓存。Promise创建、取消、竞态、错误重试、请求去重、缓存过期与跨实例共享都还没解决。把一个Promise放到Hook里，并不会自动获得这些能力。客户端数据层可以有自己的缓存策略，但那应当有明确key、生命周期和失效机制，而不是借用同一个“缓存”词跳过设计。')]),
 section('cost','什么时候值得保留，什么时候应该删掉',[
 p('缓存没有跳过首次计算；依赖变化时仍需要计算，还额外比较依赖并保留结果与其可达对象。useCallback保留的闭包可能继续引用较大数据。每个Hook的管理、代码复杂度和错误依赖风险都是真实成本，不应只计算你理想中省下的那一次filter。'),
 p('可以用一个判断顺序：先确认页面有可感知或可测量的瓶颈；再定位是否来自重复纯计算或下游身份变化；检查常见交互里依赖是否经常相同；最后比较加缓存前后的真实样本。若输入每轮都变，优化算法、缩小列表、把state放到更合适位置，可能比保留上次结果更有效。'),
 p('示例的整数循环只是确定性工作负载，60条任务每条4000次，不代表真实任务筛选成本。它没有输出提速比例，也没有把提交后的引用计数当作执行耗时。做性能评估需要生产构建、固定设备/输入、预热和多次样本；StrictMode的开发检查与调试工具自身开销必须单独说明。'),
 p('最有用的正确性检查是：删除正确组的useMemo，直接调用calculate，筛选结果仍相同；删除正确useCallback，直接创建函数，点击仍读到当前query。可能失去某些身份稳定和跳过计算的机会，但不应该改变业务含义。如果删除优化就变成业务错误，你很可能把性能机制当作语义存储了。')]),
 section('reader-check','读完后，试着解释三个具体结果',[
 p('为什么每次写一个新的[query]数组仍能命中？areHookInputsEqual逐位置比较值，query字符串不变时Object.is成立；它没有要求依赖数组自身是同一引用。相反，[options]中的options每次都是新对象，因此无法命中。'),
 p('把依赖从[query]改成[]，为什么不是一种更强的优化？因为函数实际读取query，业务输入变了但你声明的输入没有变化。更新到6后仍返回初次query1的15条结果，或者仍调用捕获1的旧函数。缓存很稳定，语义却错了。'),
 p('换key后，错误组为什么短暂恢复正确？新实例执行挂载，空依赖计算这次读到当前query。它随后仍遗漏下一次变化。重挂载清掉了旧缓存，未修复依赖约定；正确修复是恢复[query]，或实质改写逻辑减少对外部变量的读取。')]),
 section('verify','从预测到验证，不只看一个“命中率”数字',[
 {type:'list',ordered:true,items:['初始query为1，记录正确结果、遗漏依赖结果和不缓存结果。','点击无关更新：correct引用保持，unstable与uncached引用改变。callback保持，inline新函数变化。','切换query为6：correct与uncached业务结果一致，遗漏依赖组仍停在query1。','分别点击callback、stale-callback和inline：应得到correct:6、stale:1、inline:6。','换key：新实例重新建立所有Hook；继续切query，故障组再次暴露问题。']},
 {type:'code',kind:'runnable',language:'sh',filename:'终端',purpose:'完整仓库根目录执行；独立ZIP解压后进入对应目录，从npm ci开始。',code:'cd examples/react-hook-memoization\nnvm use\nnpm ci\nnpm test\nnpm run build\nnpm run dev'},
 p('依赖锁定React18.3.1、Node22.12.0和TypeScript5.7.2。测试使用真实react-dom/createRoot与jsdom，不手写Hooks运行器。它验证无关更新、依赖变化、旧闭包、key重挂载与无缓存纯计算；源码核验另将正文所有原代码块与固定版本快照逐字比较。jsdom没有真实布局和绘制，不能替代手机阅读或浏览器性能验收。'),
 p('本章延续了E1的结论：身份相同是一种可用于减少工作的信号，却不是业务正确性的替代品。useMemo保存上一次可沿用的计算结果，useCallback保存上一次可沿用的函数；你提供的依赖决定这份承诺何时失效。把这个关系讲清楚，比记住“所有对象和回调都要包Hook”更能帮助你维护真实页面。')]),
 ],references:[{title:'React18.3.1 Hook实现',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberHooks.old.js'},{title:'useMemo公开语义（官网当前版本，仅作API语义补充）',url:'https://react.dev/reference/react/useMemo'},{title:'useCallback公开语义（官网当前版本）',url:'https://react.dev/reference/react/useCallback'}],
};
