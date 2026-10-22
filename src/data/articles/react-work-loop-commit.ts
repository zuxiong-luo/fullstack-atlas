import type {Article,ArticleBlock,ArticleSection} from '../articleTypes';
const p=(text:string):ArticleBlock=>({type:'paragraph',text});
const s=(id:string,title:string,blocks:ArticleBlock[]):ArticleSection=>({id,title,paragraphs:[],blocks});
const source=(title:string,file:string,line:number):ArticleBlock=>({type:'reference',title,url:`https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/${file}.old.js#L${line}`});
const code=(purpose:string,text:string):ArticleBlock=>({type:'code',language:'tsx',filename:'App.tsx',kind:'excerpt',purpose,code:text});
export const reactWorkLoopArticle:Article={id:'react-work-loop-commit',topic:'react',title:'组件已经执行，DOM 为什么没变：React 工作循环与提交',description:'沿一次数值更新追踪 beginWork、completeWork、mutation、ref 和 Effect，把组件执行、DOM 提交与浏览器绘制分开验证。',minutes:32,labMinutes:25,tags:['React 18','工作循环','commit','Effect','源码'],kind:'tutorial',status:'review',versions:['React / React DOM 18.3.1','Node.js 22','TypeScript 5.7.2'],verifiedAt:'2026-10-22',scope:'使用 createRoot 的客户端函数组件更新；不展开 Hydration、Suspense 恢复、错误边界、Offscreen 和 useInsertionEffect 的完整算法。React 内部遍历顺序按 v18.3.1 核对，不把它作为跨版本业务 API。',prerequisites:['理解 useState 与闭包','会使用 ref、useEffect 和 useLayoutEffect','知道 JavaScript 任务结束与浏览器绘制不是同一个时刻'],questionIds:[],experiment:'react',examples:[{label:'源码证据与验证记录',path:'react-work-loop-commit/VERIFICATION.md'},{label:'提交阶段观测实验',path:'react-work-loop-commit.zip'}],sections:[
s('question','先别把三种“更新”当成一件事',[
p('你在组件里打了一条日志，看到新状态已经是 1，页面却还显示 0。于是你把读取 DOM 的代码挪到 useEffect，另一次点击时又发现 Effect 比想象中更早执行。问题不一定是 React 慢，也不一定是浏览器乱序：我们经常用“更新了”同时指组件函数执行、真实 DOM 改动和屏幕像素改变，这三个时刻没有理由完全重合。'),
p('本文只追踪一个很小的界面：一个按钮，把 span 中的数值加一。我们在 render、callback ref、布局 Effect 和普通 Effect 的建立与清理位置打印日志。再替换 key、卸载组件，观察哪些关系保持不变，哪些关系依赖具体路径。小例子没有模拟大量计算，目的是把顺序看清；它不能证明并发渲染的中断次数或性能收益。'),
{type:'experiment',id:'react-work-loop-commit',title:'运行 DOM、ref 与 Effect 时序实验',description:'依次更新数值、替换 key、卸载；开启布局 Effect 阻塞选项观察反例。请查看实验室控制台。'},
p('版本固定为 React 18.3.1，入口使用 createRoot，不包 StrictMode。React 18.3.1 开源配置使用 old reconciler，因此本文链接 .old.js 文件，而不是看到目录中 .new.js 就默认它更符合运行版本。正式业务应保留适合项目的 StrictMode；这里关闭是为了先观察基本路径，再单独解释开发检查。')]),
s('work-unit','工作循环到底在循环什么',[
p('从根节点安排好这一轮工作之后，React 需要沿 Fiber 树处理组件。函数组件要执行函数，宿主节点要准备属性变化，子树需要协调身份；这些工作不是一个“把 JSX 一次翻译成 DOM”的黑盒。React 在 workInProgress 中保存当前处理位置，循环把它交给 performUnitOfWork。'),
p('performUnitOfWork 先拿到当前节点的 alternate，调用 beginWork，处理本节点并判断下一步是否进入子节点。如果 beginWork 给出下一节点，工作指针就移动过去；如果没有新的子工作，进入 completeUnitOfWork，完成当前节点，然后找兄弟或向父级回退。所谓 begin 和 complete 是树遍历中的两个方向，不是一次界面更新的 render 与 commit 两个阶段。'),
source('performUnitOfWork：beginWork 返回值决定下一步','ReactFiberWorkLoop',1831),
source('completeUnitOfWork：完成、兄弟节点与向父级回退','ReactFiberWorkLoop',1859),
{type:'figure',src:'figures/react-work-loop-commit/traversal.svg',title:'向下处理与向上完成都属于 render',alt:'App 向下进入 Probe，再进入 span。span 完成后回到 Probe，再完成 App。整段位于 render 区域；之后才进入 commit。',caption:'省略 HostRoot、文本节点和 bailout 的教学简图；completeWork 不是 commit。'},
p('为什么要把完成过程单独说清？因为最常见的误读是看到 completeWork 就以为节点已经展示到页面。实际上，挂载路径可能在 render 阶段创建尚未接入页面的宿主实例，更新路径则准备提交所需的信息；“创建一个 DOM 对象”和“把它插入当前可见文档”不是一回事。render 不应对已提交界面做任意的可见修改，这才是允许放弃工作的重要前提。'),
source('completeWork 的 HostComponent 挂载：创建宿主实例','ReactFiberCompleteWork',1010),
source('bubbleProperties：汇集子树标记','ReactFiberCompleteWork',642),
p('完成时还需要汇集子树的标记，让提交遍历知道哪里有变化。flags 表示本节点的工作，subtreeFlags 概括子树中的相关工作。它们让 React 可以跳过没有对应提交工作的分支，而不是每次都盲目修改每一个节点。这里的 Effect 标记并不专指 useEffect；DOM 放置、更新、ref 等也有相关标记，读源码时要看具体上下文。')]),
s('yield','可中断的准确边界在哪里',[
p('workLoopSync 持续处理工作，直到没有 workInProgress；workLoopConcurrent 除了检查还有没有工作，还会询问 shouldYield。后者在工作单元之间决定是否返回，把执行机会交还给宿主。把执行位置保存下来，才有之后继续或重新协调工作的可能。'),
source('workLoopSync 与 renderRootConcurrent 的入口','ReactFiberWorkLoop',1736),
source('workLoopConcurrent：在处理下一单元之前检查让出','ReactFiberWorkLoop',1824),
p('但 JavaScript 不是在函数任意一行被 React 暂停的。performUnitOfWork 内部调用的组件函数要返回，React 才有机会继续到相应检查点；completeUnitOfWork 自己也可能连续向上完成多个节点。不能把“每个 Fiber 都能让出”理解成每个节点的每一步都自带抢占点。一个组件内部的大循环依然能阻塞主线程。'),
p('使用 createRoot 也不意味着每轮都走并发工作循环。performConcurrentWorkOnRoot 会结合阻塞 Lane、过期状态和回调是否超时等条件选择并发或同步 render 路径。函数名含 Concurrent，不代表里面所有执行都可中断。应当读它选择 renderRootConcurrent 还是 renderRootSync 的条件，而不是根据名字作结论。'),
source('performConcurrentWorkOnRoot：shouldTimeSlice 的条件','ReactFiberWorkLoop',824),
p('被让出的 render 可能继续，也可能因为更高优先级更新或其他条件重新计算。因此 render 日志只证明“尝试执行过”，不证明该次结果提交了。实验里的日志刻意放在组件执行中做诊断，它本身属于观测副作用；业务逻辑不能依赖日志计数，更不能在那里发订单、修改订阅或操作 DOM。')]),
s('commit-entry','到达提交入口，还要先处理哪些事情',[
p('一轮 render 完成之后，根上会有 finishedWork 和对应的完成信息。commitRootImpl 消费这份结果，但它开头并不是立刻改 DOM：它先刷新已有的待处理 passive Effects，直到相关待处理状态清空。这提醒我们，一条控制台日志的来源可能是上一轮提交，不能因为它靠近本轮日志就给它贴上本轮标签。'),
source('commitRootImpl 入口：刷新已有 passive Effects，再读取 finishedWork','ReactFiberWorkLoop',1985),
p('真正进入主要提交过程时，可以按 before-mutation、mutation、layout 三段理解。before-mutation 是读取变更前信息的机会，典型源码路径包括类组件的 snapshot；它不是 useEffect 的执行位置。mutation 处理宿主树变化、相关 ref 拆除和布局 Effect 的清理；layout 则在变更后运行相应布局工作。这里只解释常见路径，删除子树、Portal、Suspense 等分支不能凭这三句话推断所有细节。'),
{type:'figure',src:'figures/react-work-loop-commit/commit.svg',title:'提交阶段与 passive 刷新的关系',alt:'render 完成后进入 before mutation、mutation、root.current 切换、layout。passive cleanup 与 setup 在独立刷新入口中处理，可能在当前任务末尾同步刷新，也可能调度后续回调。浏览器 paint 不放在固定的 passive 前后位置。',caption:'顺序图刻意不把 paint 固定画在 useEffect 前面；普通 Effect 的刷新路径需要结合更新类型判断。'},
p('root.current = finishedWork 位于 mutation 之后、layout 之前。这个位置不是随意安排的：卸载等 mutation 期间仍需要之前的树作为当前树，布局阶段则应以完成后的树为当前树。DOM 已经完成相应变化，布局 Effect 因而可以读取这次提交后的宿主节点。它不意味着用户此刻已经看到了新像素。'),
source('mutation → root.current 切换 → layout 的直接调用顺序','ReactFiberWorkLoop',2150),
p('主要 DOM 变更和布局 Effect 的提交过程，不会像并发 render 那样在 Fiber 单元之间主动让出。主线程上这段 JavaScript 没返回，浏览器通常就没有机会绘制。因此不要把“commit 不切片”说成“commit 很快”：插入大量节点、昂贵的 ref 回调、布局 Effect 中读取布局并修改样式，都可能让提交很重。')]),
s('layout','清理函数看到的旧状态与当前 DOM',[
code('每次 value 变化重新建立 Effect；清理函数捕获建立时的 value。',`useLayoutEffect(() => {
  trace('layout setup', {value, dom: ref.current?.textContent});
  return () => trace('layout cleanup', {
    capturedValue: value,
    dom: ref.current?.textContent
  });
}, [value, slow]);`),
p('从 0 更新到 1 时，新一轮 render 中 value 已经是 1，但旧布局 Effect 的清理函数仍然捕获 0。这里没有状态倒退；这是两个不同函数闭包的创建时间不同。dom 字段则是在日志发生当下读取 ref 的结果。把 capturedValue 和 dom 同时打印，可以看出“我记住的状态”和“此刻 DOM 内容”是两种证据。'),
p('更微妙的一点是，布局 Effect 的 cleanup 在 mutation 阶段执行，但不应把它理解成“所有 DOM 修改之前”。本例中 Probe 返回 span，mutation 遍历先处理孩子，再在函数组件分支清理布局 Effect，所以清理时可能已经读到更新后的子节点文本。依靠旧 DOM 做测量，不能仅仅把代码放在 useLayoutEffect 的返回函数里。'),
source('函数组件 mutation 分支：先遍历子树，再清理布局 Effects','ReactFiberCommitWork',2083),
p('随后 layout 阶段运行新的 setup，这时本例的 ref 已指向相应宿主节点，读到的新文本应与 value 一致。这适合做必要的布局测量，例如测量弹层后决定定位；但 setup 里的每一点同步工作都可能推迟绘制。若只是在订阅外部服务、不要求绘制前完成，普通 Effect 通常更合适。'),
p('勾选实验中的“布局 Effect 阻塞约 40ms”，再点更新。示例在 layout setup 中执行有界忙等待，用来制造故障而不是模拟推荐写法。你应在 Performance 中看到同步占用，但不应拿某次计时刚好 40ms 推导帧率或 INP。设备、调试工具、计时粒度都会影响观察，阻塞不是精确的性能基准。')]),
s('refs','ref 不是每次 render 都重新绑定',[
code('稳定 callback ref；回调身份不会随着 value 变化而变化。',`const attach = useCallback((node: HTMLSpanElement | null) => {
  ref.current = node;
  trace(node ? 'ref attach' : 'ref detach', {
    dom: node?.textContent ?? null
  });
}, []);`),
p('首次挂载时，DOM 节点提交，ref 获得节点，然后本例 Probe 的布局 Effect 可以读取它。普通 value 更新不会更换 span 的身份，attach 回调也保持稳定，因此不应该仅因这次重新执行组件就出现一组 detach / attach。这是验证“render 次数不等于挂载次数”的直接办法。'),
p('点击替换 key，React 会把 Probe 当成不同身份。旧组件的 Effects 要清理，旧 ref 要拆除，新组件要建立 Effects 并绑定新的节点。用户可能仍看到同样的数字，但它背后的组件生命周期已经变化。另一个常见原因是每次 render 创建新的内联 callback ref；即使 DOM 节点复用，ref 回调身份变化也可能触发重新解绑与绑定。'),
source('commitAttachRef：为宿主实例绑定 callback 或对象 ref','ReactFiberCommitWork',1232),
p('React 18 的 callback ref 在解绑时接收 null。不要把新版 ref 回调返回清理函数的行为套到这里；本例回调不返回清理函数。也不要把本例中子节点 ref 与父组件布局 Effect 的观测推广成任意树中所有 ref 和所有 Effect 的全局业务顺序。跨组件同步需求应该通过明确的数据流解决，不能依赖未承诺的遍历细节。')]),
s('passive','useEffect 为什么不保证“绘制之后”',[
p('passive Effects 由独立的刷新入口处理。flushPassiveEffectsImpl 在这个入口中先处理 passive unmount 工作，再处理 passive mount 工作；在同一个依赖变化的 Effect 上，可以观察到旧 cleanup 先于新 setup。注意这里的 unmount / mount 函数名也覆盖更新时 Effect 的销毁与重新建立，不等于组件一定从树中卸载再挂载。'),
source('flushPassiveEffectsImpl：passive cleanup 与 setup 的调用顺序','ReactFiberWorkLoop',2408),
p('React 会为 passive 工作安排后续执行机会，但在某些路径也会同步刷新。v18.3.1 的 commitRootImpl 末尾明确检查 pendingPassiveEffectsLanes 是否包含 SyncLane，并且根不是 LegacyRoot；满足条件就调用 flushPassiveEffects。点击触发的更新就是很值得观察的路径。此前的提交或布局阶段触发的后续同步工作，也会让“每个 Effect 都等到下一帧”这个假设失效。'),
source('SyncLane 与非 LegacyRoot 条件下的同步 passive 刷新','ReactFiberWorkLoop',2292),
p('所以，我们可以说 useEffect 不用于要求绘制前完成的布局测量，却不能反过来保证它一定在绘制之后执行。把动画启动、去掉遮罩或统计“用户已经看见页面”的逻辑建立在这种保证上，会在不同交互路径下出问题。实际绘制是浏览器行为，不是 React 调用一个函数后就自动完成的事件。'),
p('实验在按钮处理函数里还注册了 requestAnimationFrame。rAF 回调通常发生在绘制前的渲染机会中，不是“上一条 DOM 修改已经显示”的证据。控制台中 passive 和 rAF 的相对位置可帮助你提出假设，但真正判断绘制需要 Performance 时间线及相关渲染记录。jsdom 完全不绘制，自动测试更不能对此下结论。')]),
s('run','从安装到能解释一组日志',[
{type:'code',language:'bash',filename:'终端',kind:'runnable',purpose:'安装独立示例锁定依赖，并运行生命周期检查和构建。',code:'cd examples/react-work-loop-commit\nnpm ci\nnpm test\nnpm run build\nnpm run dev'},
p('第一次挂载时，本例无 StrictMode 的基本日志会出现 render attempt、ref attach、layout setup、passive setup。先检查 layout setup 读取的 DOM 文本是数值 0。不要在另一个树结构或开启开发检查之后仍强求完全相同的日志数量；应该先验证前置条件。'),
{type:'table',headers:['操作','要验证的关系','不能从中证明什么'],rows:[['更新数值','旧 cleanup 在新 setup 前；新 layout 读到新文本；稳定 ref 不重绑','不能证明浏览器已经绘制'],['替换 key','旧 ref 拆除、新 ref 绑定；Effects 重建','不能证明用户看到了空白帧'],['卸载','布局和 passive 的清理被执行；ref 拆除','不能推出全部树形结构的清理全序'],['布局阻塞反例','同步工作推迟主线程返回','不能当作真实业务性能数据']]},
p('自动测试使用 React act 配合 jsdom，检查实际 DOM 和日志关系。act 会主动处理 React 工作与 Effects，因此这个测试用于验收生命周期与节点关系，不能拿它观察 passive 相对真实浏览器绘制的时间。测试刻意没有断言 rAF 的位置，也没有用固定毫秒延时猜测什么时候提交。'),
p('如果结果不符合预期，先查是否使用相同版本、同一入口、是否开启 StrictMode，再检查 callback ref 身份与 key 是否变化。看到 render 两次不能马上归因为并发中断；看到 passive setup 两次也不能马上判为订阅泄漏。React 开发检查会额外检验 Effect 建立与清理是否对称，正确修复通常是补齐清理逻辑，而不是用一个永久标志跳过第二次执行。')]),
s('use','真正有用的排查顺序',[
p('如果新状态日志出现而 DOM 还没变，先确认日志在 render 还是 commit 路径；如果布局读取有时不对，检查读取的是旧闭包还是当前节点，以及测量是否确实需要在 layout 阶段；如果 UI 卡住，别只看 render，继续查 ref 回调、布局 Effect、DOM 规模和浏览器布局。把三个时刻分开之后，问题通常会缩小到一个可以验证的位置。'),
p('源码阅读也应该围绕这些问题展开。先读 workLoop 与 performUnitOfWork，理解处理位置怎样移动；再读 completeUnitOfWork，确认完成工作仍属于 render；然后在 commitRootImpl 找三段调用和 current 切换；最后追某一个标记进入 commitMutationEffectsOnFiber 或 passive 刷新。沿一条具体路径走，比一次记住文件里所有函数更容易发现错误假设。'),
p('本文实验提供真实 React 的生命周期观测，没有实现一个自称等价的调度器，也没有证明特定工作被中断。下一步可以把同一个 Probe 放到更多层父子组件中，比较局部顺序如何变化，同时保留“业务不依赖内部遍历顺序”的边界。组件执行是计算尝试，提交是把完成结果应用到宿主，绘制是浏览器呈现像素：这三个概念会一直帮助你读懂后续源码。')])],references:[{title:'React 18.3.1 工作循环与提交入口',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.old.js'},{title:'React 18.3.1 各类提交工作',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.old.js'},{title:'React 18.3.1 reconciler 开关',url:'https://github.com/facebook/react/blob/v18.3.1/packages/shared/ReactFeatureFlags.js#L74'}]};
