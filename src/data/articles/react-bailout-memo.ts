import type { Article, ArticleBlock, ArticleSection } from '../articleTypes';
const excerpts = {
  "ordinary": {
    "file": "ReactFiberBeginWork.old.js",
    "start": 3722,
    "end": 3767,
    "code": "  if (current !== null) {\n    const oldProps = current.memoizedProps;\n    const newProps = workInProgress.pendingProps;\n\n    if (\n      oldProps !== newProps ||\n      hasLegacyContextChanged() ||\n      // Force a re-render if the implementation changed due to hot reload:\n      (__DEV__ ? workInProgress.type !== current.type : false)\n    ) {\n      // If props or context changed, mark the fiber as having performed work.\n      // This may be unset if the props are determined to be equal later (memo).\n      didReceiveUpdate = true;\n    } else {\n      // Neither props nor legacy context changes. Check if there's a pending\n      // update or context change.\n      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(\n        current,\n        renderLanes,\n      );\n      if (\n        !hasScheduledUpdateOrContext &&\n        // If this is the second pass of an error or suspense boundary, there\n        // may not be work scheduled on `current`, so we check for this flag.\n        (workInProgress.flags & DidCapture) === NoFlags\n      ) {\n        // No pending updates or context. Bail out now.\n        didReceiveUpdate = false;\n        return attemptEarlyBailoutIfNoScheduledUpdate(\n          current,\n          workInProgress,\n          renderLanes,\n        );\n      }\n      if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {\n        // This is a special case that only exists for legacy mode.\n        // See https://github.com/facebook/react/pull/19216.\n        didReceiveUpdate = true;\n      } else {\n        // An update was scheduled on this fiber, but there are no new props\n        // nor legacy context. Set this to false. If an update queue or context\n        // consumer produces a changed value, it will set this to true. Otherwise,\n        // the component will assume the children have not changed and bail out.\n        didReceiveUpdate = false;\n      }\n    }"
  },
  "simple": {
    "file": "ReactFiberBeginWork.old.js",
    "start": 607,
    "end": 668,
    "code": "  if (current !== null) {\n    const prevProps = current.memoizedProps;\n    if (\n      shallowEqual(prevProps, nextProps) &&\n      current.ref === workInProgress.ref &&\n      // Prevent bailout if the implementation changed due to hot reload.\n      (__DEV__ ? workInProgress.type === current.type : true)\n    ) {\n      didReceiveUpdate = false;\n\n      // The props are shallowly equal. Reuse the previous props object, like we\n      // would during a normal fiber bailout.\n      //\n      // We don't have strong guarantees that the props object is referentially\n      // equal during updates where we can't bail out anyway — like if the props\n      // are shallowly equal, but there's a local state or context update in the\n      // same batch.\n      //\n      // However, as a principle, we should aim to make the behavior consistent\n      // across different ways of memoizing a component. For example, React.memo\n      // has a different internal Fiber layout if you pass a normal function\n      // component (SimpleMemoComponent) versus if you pass a different type\n      // like forwardRef (MemoComponent). But this is an implementation detail.\n      // Wrapping a component in forwardRef (or React.lazy, etc) shouldn't\n      // affect whether the props object is reused during a bailout.\n      workInProgress.pendingProps = nextProps = prevProps;\n\n      if (!checkScheduledUpdateOrContext(current, renderLanes)) {\n        // The pending lanes were cleared at the beginning of beginWork. We're\n        // about to bail out, but there might be other lanes that weren't\n        // included in the current render. Usually, the priority level of the\n        // remaining updates is accumulated during the evaluation of the\n        // component (i.e. when processing the update queue). But since since\n        // we're bailing out early *without* evaluating the component, we need\n        // to account for it here, too. Reset to the value of the current fiber.\n        // NOTE: This only applies to SimpleMemoComponent, not MemoComponent,\n        // because a MemoComponent fiber does not have hooks or an update queue;\n        // rather, it wraps around an inner component, which may or may not\n        // contains hooks.\n        // TODO: Move the reset at in beginWork out of the common path so that\n        // this is no longer necessary.\n        workInProgress.lanes = current.lanes;\n        return bailoutOnAlreadyFinishedWork(\n          current,\n          workInProgress,\n          renderLanes,\n        );\n      } else if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {\n        // This is a special case that only exists for legacy mode.\n        // See https://github.com/facebook/react/pull/19216.\n        didReceiveUpdate = true;\n      }\n    }\n  }\n  return updateFunctionComponent(\n    current,\n    workInProgress,\n    Component,\n    nextProps,\n    renderLanes,\n  );\n}"
  },
  "generic": {
    "file": "ReactFiberBeginWork.old.js",
    "start": 541,
    "end": 564,
    "code": "  const currentChild = ((current.child: any): Fiber); // This is always exactly one child\n  const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(\n    current,\n    renderLanes,\n  );\n  if (!hasScheduledUpdateOrContext) {\n    // This will be the props with resolved defaultProps,\n    // unlike current.memoizedProps which will be the unresolved ones.\n    const prevProps = currentChild.memoizedProps;\n    // Default to shallow comparison\n    let compare = Component.compare;\n    compare = compare !== null ? compare : shallowEqual;\n    if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {\n      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);\n    }\n  }\n  // React DevTools reads this flag.\n  workInProgress.flags |= PerformedWork;\n  const newChild = createWorkInProgress(currentChild, nextProps);\n  newChild.ref = workInProgress.ref;\n  newChild.return = workInProgress;\n  workInProgress.child = newChild;\n  return newChild;\n}"
  },
  "pending": {
    "file": "ReactFiberBeginWork.old.js",
    "start": 3470,
    "end": 3489,
    "code": "function checkScheduledUpdateOrContext(\n  current: Fiber,\n  renderLanes: Lanes,\n): boolean {\n  // Before performing an early bailout, we must check if there are pending\n  // updates or context.\n  const updateLanes = current.lanes;\n  if (includesSomeLane(updateLanes, renderLanes)) {\n    return true;\n  }\n  // No pending update, but because context is propagated lazily, we need\n  // to check for a context change before we bail out.\n  if (enableLazyContextPropagation) {\n    const dependencies = current.dependencies;\n    if (dependencies !== null && checkIfContextChanged(dependencies)) {\n      return true;\n    }\n  }\n  return false;\n}"
  },
  "subtree": {
    "file": "ReactFiberBeginWork.old.js",
    "start": 3365,
    "end": 3404,
    "code": "function bailoutOnAlreadyFinishedWork(\n  current: Fiber | null,\n  workInProgress: Fiber,\n  renderLanes: Lanes,\n): Fiber | null {\n  if (current !== null) {\n    // Reuse previous dependencies\n    workInProgress.dependencies = current.dependencies;\n  }\n\n  if (enableProfilerTimer) {\n    // Don't update \"base\" render times for bailouts.\n    stopProfilerTimerIfRunning(workInProgress);\n  }\n\n  markSkippedUpdateLanes(workInProgress.lanes);\n\n  // Check if the children have any pending work.\n  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {\n    // The children don't have any work either. We can skip them.\n    // TODO: Once we add back resuming, we should check if the children are\n    // a work-in-progress set. If so, we need to transfer their effects.\n\n    if (enableLazyContextPropagation && current !== null) {\n      // Before bailing out, check if there are any context changes in\n      // the children.\n      lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);\n      if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {\n        return null;\n      }\n    } else {\n      return null;\n    }\n  }\n\n  // This fiber doesn't have work, but its subtree does. Clone the child\n  // fibers and continue.\n  cloneChildFibers(current, workInProgress);\n  return workInProgress.child;\n}"
  },
  "context": {
    "file": "ReactFiberNewContext.old.js",
    "start": 274,
    "end": 286,
    "code": "          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);\n          const alternate = fiber.alternate;\n          if (alternate !== null) {\n            alternate.lanes = mergeLanes(alternate.lanes, renderLanes);\n          }\n          scheduleContextWorkOnParentPath(\n            fiber.return,\n            renderLanes,\n            workInProgress,\n          );\n\n          // Mark the updated lanes on the list, too.\n          list.lanes = mergeLanes(list.lanes, renderLanes);"
  },
  "ancestors": {
    "file": "ReactFiberNewContext.old.js",
    "start": 156,
    "end": 187,
    "code": "export function scheduleContextWorkOnParentPath(\n  parent: Fiber | null,\n  renderLanes: Lanes,\n  propagationRoot: Fiber,\n) {\n  // Update the child lanes of all the ancestors, including the alternates.\n  let node = parent;\n  while (node !== null) {\n    const alternate = node.alternate;\n    if (!isSubsetOfLanes(node.childLanes, renderLanes)) {\n      node.childLanes = mergeLanes(node.childLanes, renderLanes);\n      if (alternate !== null) {\n        alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);\n      }\n    } else if (\n      alternate !== null &&\n      !isSubsetOfLanes(alternate.childLanes, renderLanes)\n    ) {\n      alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);\n    } else {\n      // Neither alternate was updated.\n      // Normally, this would mean that the rest of the\n      // ancestor path already has sufficient priority.\n      // However, this is not necessarily true inside offscreen\n      // or fallback trees because childLanes may be inconsistent\n      // with the surroundings. This is why we continue the loop.\n    }\n    if (node === propagationRoot) {\n      break;\n    }\n    node = node.return;\n  }"
  },
  "shallow": {
    "file": "shallowEqual.js",
    "start": 18,
    "end": 52,
    "code": "function shallowEqual(objA: mixed, objB: mixed): boolean {\n  if (is(objA, objB)) {\n    return true;\n  }\n\n  if (\n    typeof objA !== 'object' ||\n    objA === null ||\n    typeof objB !== 'object' ||\n    objB === null\n  ) {\n    return false;\n  }\n\n  const keysA = Object.keys(objA);\n  const keysB = Object.keys(objB);\n\n  if (keysA.length !== keysB.length) {\n    return false;\n  }\n\n  // Test for A's keys different from B.\n  for (let i = 0; i < keysA.length; i++) {\n    const currentKey = keysA[i];\n    if (\n      !hasOwnProperty.call(objB, currentKey) ||\n      !is(objA[currentKey], objB[currentKey])\n    ) {\n      return false;\n    }\n  }\n\n  return true;\n}\n"
  },
  "late": {
    "file": "ReactFiberBeginWork.old.js",
    "start": 1047,
    "end": 1059,
    "code": "  if (current !== null && !didReceiveUpdate) {\n    bailoutHooks(current, workInProgress, renderLanes);\n    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);\n  }\n\n  if (getIsHydrating() && hasId) {\n    pushMaterializedTreeId(workInProgress);\n  }\n\n  // React DevTools reads this flag.\n  workInProgress.flags |= PerformedWork;\n  reconcileChildren(current, workInProgress, nextChildren, renderLanes);\n  return workInProgress.child;"
  }
};
const p = (text: string): ArticleBlock => ({type:'paragraph',text});
const section = (id:string,title:string,blocks:ArticleBlock[]):ArticleSection=>({id,title,paragraphs:[],blocks});
const source = (key:keyof typeof excerpts,purpose:string):ArticleBlock=>{const x=excerpts[key];return {type:'code',language:'flow',filename:`React 18.3.1 · ${x.file}:${x.start}–${x.end} · MIT`,kind:'excerpt',purpose,code:x.code};};
const reference = (key:keyof typeof excerpts):ArticleBlock=>{const x=excerpts[key];return {type:'reference',title:`固定源码 ${x.file}:${x.start}–${x.end}`,url:`https://github.com/facebook/react/blob/v18.3.1/packages/${x.file==='shallowEqual.js'?'shared':'react-reconciler/src'}/${x.file}#L${x.start}-L${x.end}`};};
const sample=(code:string,purpose:string):ArticleBlock=>({type:'code',language:'tsx',filename:'App.tsx · 项目节选',kind:'excerpt',code,purpose});
export const reactBailoutMemoArticle: Article = {
 id:'react-bailout-memo',topic:'react',title:'props 没变，为什么还会更新：拆开 React.memo 与 bailout',description:'用任务面板验证父更新、对象 props、自身 state、Context 和子树工作，再沿 React 18.3.1 真实源码判断到底跳过哪一层。',
 minutes:42,labMinutes:30,kind:'series',status:'review',verifiedAt:'2026-10-22',versions:['React / React DOM 18.3.1','Node 22.12.0 / TypeScript 5.7.2'],tags:['React','memo','bailout','Context','childLanes'],
 scope:'E1。固定18.3.1.old reconciler稳定默认flags；客户端createRoot、函数组件。解释复用和跳过工作，不推导完整Suspense/Offscreen/热更新机制，不把开发观察当性能结论。',prerequisites:['知道元素身份、render与commit区别','能读Lane集合的交集','理解函数闭包与引用相等'],questionIds:[],experiment:'react',
 examples:[{label:'完整memo实验与测试',path:'react-bailout-memo.zip'},{label:'运行说明',path:'react-bailout-memo/README.md'},{label:'源码和验证记录',path:'react-bailout-memo/VERIFICATION.md'}],
 sections:[
 section('problem','一句“props没变”里，藏着三个不同的问题',[
 p('任务看板的父组件更新了时钟，你觉得列表的标题根本没变，列表就不该再执行。于是加上memo。起初有效，后来传入一个options对象，效果消失；再把对象稳定住，切换主题时组件又执行了。更奇怪的是，某次面板没执行，面板下面的进度按钮却成功加了一。到底是哪条规则在起作用？'),
 p('先把“没变”说清楚：是显示出的文字相同，还是每个prop值用Object.is比较相同，或者整个props对象就是同一个引用？这三件事不等价。再把“没更新”拆开：组件函数没有执行、React没有进入它的子树、最终没有修改DOM，也不是同一件事。本文要建立的正是这些区别。'),
 p('贯穿案例是一个memo任务面板，里面有自己的state、一个读取主题Context的地方和一个独立管理进度的子任务。旁边还有普通组件、每次收到新对象的memo卡片，以及一个错误比较函数的按钮。实验使用真实React18.3.1和createRoot，没有StrictMode。内部字段只通过固定源码解释，不从页面偷读Fiber来证明结论。'),
 {type:'experiment',id:'react-bailout-memo',title:'打开真实 React.memo 实验',description:'先做父组件无关更新，再试子任务state、自身state、Context和旧闭包按钮。诊断显示已提交观察点，不是所有render尝试次数。'},
 p('bailout可以理解为在已有结果可沿用的前提下，提前结束本层的某些工作。它不是一份以任意props为key的永久缓存，也不是把组件变成不会更新的静态图片。current、work-in-progress和更新Lane仍然存在；究竟能跳过哪里，要继续看子树是否有本轮工作。')]),
 section('plain','普通组件：值相同，并不自动得到memo的浅比较',[
 p('父函数重新执行时，常见的JSX写法会创建新的元素描述及props对象。哪怕title仍是同一个字符串，旧props对象与新props对象的引用也可能不同。beginWork首先关心的是这层引用判断，不能把它误说成每个普通函数组件都会自动逐字段比较props。'),
 source('ordinary','beginWork中current非空的完整连续判断块；省略其前后的类型分派与其他逻辑，保留更新、捕获和legacy例外。'),
 p('带入具体输入：旧props={title:"任务列表"}，新props是另一份同内容对象。oldProps !== newProps成立，didReceiveUpdate先标true。后续memo路径有机会根据浅比较把它调回false；普通组件通常继续执行。这个标志不是“页面已改变”，只是本轮内部工作判断。'),
 p('反过来，同一个元素或相同props引用在某些树结构里可以让普通组件进入早期bailout检查，前提还包括没有相关的自身更新、Context工作或捕获标志。组合式children由较外层创建、内层只有自己state更新，就是理解“不是所有父更新都会沿路重算所有函数”的一个入口。不要把一般规律写成绝对的整树重渲染。'),reference('ordinary')]),
 section('shallow','memo默认比较什么：一层值比较，不是递归比较内容',[
 p('先看真正决定相等的函数。这里的is对应Object.is语义，hasOwnProperty用于判断属性属于对象本身。代码先检查整体相同，再检查对象类型、键数量和每个键值。这是浅比较：对象里面再套一个对象时，不继续追进去。'),
 source('shallow','完整shallowEqual函数，保留原Flow类型与注释；不是可独立运行文件。'),
 sample('const first = { options: { title: "任务列表" } };\nconst second = { options: { title: "任务列表" } };\nObject.is(first.options, second.options); // false\n// memo默认浅比较会发现options不同。', '外层title文本相同，并不能让两个新建options引用相同。'),
 p('实验的ObjectCard每次都收到options={{title:"任务列表"}}，所以父无关更新仍会通过这一关。数组、函数、JSX children对象也有同样的引用问题。把每个输入都深比较并不是自然升级：深层数据规模可能不断增加，比较本身就可能比重新计算更贵。'),
 p('Object.is还与===存在细节差异：NaN与自身相等，+0和-0不相等。对常见任务对象，更重要的仍是引用与不可变更新。原地改task.title而保持task引用，可能让比较认为输入没变；这不是memo应该替你补救的用法。先让变化能被正确表达，再谈跳过计算。'),reference('shallow')]),
 section('simple','相等只拿到一张入场券：自身更新还要继续检查',[
 p('React.memo在18.3.1有不同内部路径。简单函数、默认比较且符合对应条件时会采用SimpleMemoComponent；有自定义比较等情况则使用MemoComponent包装。用户不应该依赖两者Fiber布局，但读源码必须知道自己看的是哪条路径。下面从SimpleMemoComponent的current非空分支一直展示到回退调用，前面的开发校验没有影响本次例子。'),
 source('simple','updateSimpleMemoComponent更新主路径与末尾回退；保留ref、热更新、Lane恢复和legacy特殊分支。'),
 p('先带入“父无关更新”：title字符串不变、ref不变、实现类型没变，浅比较成立。React可以沿用旧props对象；再调用checkScheduledUpdateOrContext。如果本组件没有本轮相关工作，就恢复current.lanes中尚需保留的Lane，然后进入bailout。恢复Lane不是制造新更新，而是避免跳过组件求值后丢掉其他优先级的待处理信息。'),
 p('现在只改一个条件：用户点击面板自己的state按钮。props仍相同，但面板有相关的自身工作，因此不能走相同的早退路径，会继续updateFunctionComponent。memo是围绕父传入props的一项优化，不是阻止自己状态变化的门禁。源码已经把“相等”和“没有工作”分成了两次判断。'),
 source('pending','完整checkScheduledUpdateOrContext；注意lazy Context分支受feature flag控制。'),
 p('current.lanes与renderLanes有交集，说明本节点有这轮需要处理的更新。没有交集不代表从此没有任何更新，只说明那些位不属于本轮。源码还保留lazy Context检查分支，不过稳定版默认enableLazyContextPropagation=false；下一节会展示实际默认Context传播怎样标记Lane，避免把被关闭的分支当作唯一解释。'),reference('simple'),reference('pending')]),
 section('subtree','父不需要执行，为什么子任务仍然能加一？',[
 p('轮到实验里最有解释力的一步：只点“子任务进度+1”。进度属于Leaf，memo面板没有新props，也没有自己的state变化。你会看到Leaf值增长，而面板的诊断节点没有新增提交后记录。若把memo理解成整块冻结，这个行为根本解释不通。'),
 {type:'figure',src:'figures/react-bailout-memo/subtree.svg',title:'当前节点无工作，不代表后代无工作',alt:'面板自身lanes与本轮无交集，但childLanes含有子任务更新位。bailout跳过面板求值后沿child进入Leaf；Leaf自身lanes匹配并处理state。',caption:'结构示意，不读取真实私有Fiber。l表示当前更新所属位，数值不是固定某一事件类型。'},
 source('subtree','完整bailoutOnAlreadyFinishedWork；两种出口决定能否跳过整段子树。'),
 p('把renderLanes={l}、Panel.lanes={}、Panel.childLanes={l}代入：includesSomeLane(renderLanes,childLanes)为true，因此不会返回null，而是cloneChildFibers并返回workInProgress.child，继续沿下方工作。clone在这里准备本轮孩子的工作节点，不是把后代业务对象深拷贝一遍。函数名里的bailout没有承诺整棵子树都不用走。'),
 p('再把childLanes也改成空：稳定版默认lazy传播关闭，此分支就返回null，才表示本次可以不继续该子树。若childLanes只有本轮未选中的另一个优先级位，也会因没有交集而暂时跳过；更新仍需在相应轮次处理。判断依据是集合交集，不是childLanes是否大于零。'),
 p('这也解释了lanes和childLanes为什么不能合成一个字段：前者帮助判断本节点是否有工作，后者帮助判断“自己可以不重算，但要不要往下找”。祖先在安排子更新时得到后代工作摘要，不需要每次把所有子节点搜一遍才知道有没有待办。实验验证公开行为，图和源码说明内部机制，两种证据各自有边界。'),reference('subtree')]),
 section('context','Context不是隐藏在props里的一个键',[
 p('现在点“切换Context”。Panel的title仍然相同，却会显示新主题。原因不是memo浅比较突然失效，而是Panel读取了Theme，形成另一条数据依赖。Context值变化后，消费者必须有机会重新读取它；不能让一个相等的title拦住主题更新。'),
 p('稳定默认路径采用eager传播。找到匹配的Context依赖之后，下面这段连续代码把renderLanes合到消费者fiber及其alternate上，再沿父链安排工作。此前的消费者匹配和类组件强制更新处理未贴出；本篇函数组件案例从已匹配消费者处继续，不能把这段当成完整传播遍历器。'),
 source('context','propagateContextChange_eager中已匹配消费者后的连续标记段；前面负责遍历与依赖匹配。'),
 source('ancestors','scheduleContextWorkOnParentPath的主循环；省略末尾开发环境一致性警告，不改变Lane合并逻辑。'),
 p('Panel消费Theme，所以自己lanes会被标记，前一节的checkScheduledUpdateOrContext据此看到相关工作。若订阅者只是更深的Leaf，中间未订阅的memo父节点也能通过childLanes继续向下，而无需把所有父组件函数都重新执行。这条机制与“props没变就整树冻结”的模型完全不同。'),
 p('Context更新粒度也是设计选择。一个Provider value把主题、任务列表和选中项全塞进同一个新对象，消费者即使只取主题，也不能因为没读其他字段就自动得到选择器级订阅。可以先拆分责任不同的Context，或在外层读取Context、向memo子组件传较小的标量props；是否需要外部store则取决于订阅与一致性需求，而不是先堆更多memo。'),reference('context'),reference('ancestors')]),
 section('comparator','自定义比较返回true，是在承诺行为也相同',[
 p('实验的错误按钮只比较label，忽略onClick。它看起来很合理：按钮文字没变，不用重新渲染。但回调闭包读取父组件的tick。父tick从0变成1时，新onClick的行为已经不同；比较函数却返回true，使内部按钮继续保留旧回调。点它会读到unsafe:0，默认比较按钮则读到safe:1。'),
 sample('const UnsafeButton = memo(Button,\n  (prev, next) => prev.label === next.label\n);\n// 父组件每次创建的函数捕获本次tick：\n<UnsafeButton label="读取" onClick={() => report(tick)} />', '故意遗漏onClick的失败版本。完整App同时提供默认比较的正确组。'),
 source('generic','updateMemoComponent已挂载分支的比较与回退；省略前面的首次挂载及开发校验，保留自定义compare和ref条件。'),
 p('带入这段源码：当前包装节点没有相关自身工作，compare选择你的函数，label相同返回true、ref也相同，于是进入bailout。React没有能力知道你的比较承诺漏掉了闭包。比较函数必须覆盖所有会影响输出和行为的props，包括函数。遇到大型嵌套结构时，要证明自己的比较比重新渲染更便宜且语义完整，不能用“写一个deepEqual”代替这两项证据。'),
 p('修复不一定是把回调随便包一个空依赖useCallback。那会在上游制造另一份旧闭包。优先保留正确数据流，必要时按真实依赖稳定函数；下一篇会具体推导useCallback保存的是什么。只有正确性先成立，减少执行次数才有意义。'),reference('generic')]),
 section('late','看见函数执行，也不能反推出后面一定完整重做',[
 p('前面主要讨论进入函数前的跳过。函数组件还有另一类情况：已经调用Hooks处理更新，结果并没有产生实际变化，后面仍可能bailout。看updateFunctionComponent里renderWithHooks之后的这段代码，它检查didReceiveUpdate，并可能沿用孩子工作。'),
 source('late','updateFunctionComponent在renderWithHooks之后的连续收尾；前面已经求值组件与Hooks。'),
 p('这意味着“我在函数顶部打了一条日志”只能证明某次求值发生，不能证明它已经提交，更不能证明所有后代都重算并修改DOM。相同state值的更新也可能通过更早的队列优化直接避免安排某些工作；不能仅凭一次按钮实验总结所有场景的固定调用次数。'),
 p('本实验的计数故意放在独立诊断节点的layout effect里。它描述当前示例已提交观察点变化，避免在render里写全局计数器污染纯函数。但它也不是全部尝试次数：被放弃的并发render不会贡献同样记录，StrictMode开发检查会改变诊断次数，因此实验固定关闭StrictMode。生产项目仍应保留适合自己的检查策略，不能为了数字好看去掉开发检查。'),reference('late')]),
 section('verify','按这一顺序操作，不要一次混入多个原因',[
 {type:'list',ordered:true,items:['刷新示例，记录面板、子任务、对象卡片和普通组件的初始诊断数。','点击父无关更新：稳定props的面板保持，对象卡片和普通组件增加。','只点击子任务：进度增加，面板诊断保持；这验证跳过自身但进入子树。','点击面板自身state，再切Context：两次都应展示新值，不能被memo拦住。','父tick变大后分别点击两种比较按钮：错误组保留旧闭包，默认比较组读取当前快照。']},
 {type:'code',kind:'runnable',language:'sh',filename:'终端',purpose:'从完整仓库根目录执行；独立ZIP解压后进入react-bailout-memo，从npm ci开始。',code:'cd examples/react-bailout-memo\nnvm use\nnpm ci\nnpm test\nnpm run build\nnpm run dev'},
 p('Node固定22.12.0，不使用nvm时手动准备版本。测试用jsdom、真实react-dom/createRoot与act执行相同点击，断言state、Context、旧闭包结果和诊断变化。它不是手写一个memo模型再测自己，也不承诺jsdom能反映浏览器布局、绘制和性能。所有正文原代码由固定源码行段提取，测试逐字比对，避免引用链接正确而展示代码已经漂移。'),
 p('做业务性能评估时，再进入生产构建下的Profiler与浏览器Performance，记录输入规模、交互和设备。memo会增加比较工作、保留已有结果关联，也会增加维护稳定输入的复杂度。若组件很小、props总变，收益可能覆盖不了成本；若卡顿来自布局、网络或主线程外的另一阶段，memo更不负责修复。本文不给未经采样的提速百分比。'),
 p('回到最初的疑问，props相同只解释了一条输入路径。先判断引用与浅比较，再看自身state/Context对应的Lane，最后检查childLanes。你会得到更精确的描述：“这次跳过面板函数，但保留对Leaf更新的遍历”，而不是含糊地说“memo没生效”。')]),
 ],references:[{title:'React18.3.1 BeginWork',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberBeginWork.old.js'},{title:'React18.3.1 Context传播',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberNewContext.old.js'}],
};
