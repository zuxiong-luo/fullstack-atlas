import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "react-identity-events",
  "topic": "react",
  "title": "React 核心（二）：节点身份、Hooks 与事件传播",
  "description": "从组件身份和Hook位置讲起，直接展示列表、Portal、表单与订阅完整代码，区分React逻辑关系、DOM关系和事件职责。",
  "minutes": 50,
  "tags": [
    "React",
    "Hooks",
    "key",
    "事件",
    "Portal"
  ],
  "scope": "React 18.3.1 客户端节点身份、公开事件语义与Portal；包含教学面板，不实现生产模态框或事件系统全部内部委托路径。",
  "prerequisites": [
    "组件与 props",
    "DOM 事件捕获和冒泡"
  ],
  "sections": [
    {
      "id": "s12-304342",
      "title": "先认识组件身份：状态由哪一个节点保留",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "组件身份是 React 用来对应更新前后节点的关系。同一个 Row 函数能在列表里出现多次，每个具体节点分别保存自己的 state。React 协调孩子时，结合父级位置、key 和组件类型决定是否延续旧身份。理解这层关系，才能知道草稿为什么保留、转移或重置。"
        },
        {
          "type": "paragraph",
          "text": "本篇把身份与事件分别讲清，再用 Portal 把两者连接起来：状态跟 React 节点的身份，事件传播也有 React 逻辑父子关系；而浏览器看到的是 DOM 父子关系。它们相关，但你不能用 DOM 在哪里来猜全部 React 行为。需要先会读 useState、props、基础 DOM 捕获和冒泡；版本固定 React/React DOM 18.3.1。"
        },
        {
          "type": "paragraph",
          "text": "先把初始界面交代完整：A、B、C 三行都有独立草稿框。你给 A 写“A笔记”，给 B 写“B笔记”，然后删除 A。希望 B 仍显示 B笔记、C 仍为空。下面是完整 Row，草稿属于每行自己的 Hook，而不是父级数组。"
        },
        {
          "type": "code",
          "code": "function Row({id}:{id:string}){\n  const [draft,setDraft]=useState('');\n  return <li data-row={id}>{id}{' '}<input aria-label={`草稿 ${id}`} value={draft} onChange={e=>setDraft(e.target.value)}/><output aria-label={`内容 ${id}`}>{draft||'空'}</output></li>;\n}",
          "purpose": "完整行组件：业务 id 来自 props，draft 保存在这个组件身份的 state 里。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "const [ids,setIds]=useState(['A','B','C']);\nconst [indexKey,setIndexKey]=useState(false);\nconst [epoch,setEpoch]=useState(0);\n// render：父ul身份由epoch控制，正常操作不改变它。\n<ul key={epoch}>{ids.map((id,index)=><Row key={indexKey?index:id} id={id}/>)}</ul>\n// 删除按钮事件：\nsetIds(xs=>xs.slice(1));",
          "purpose": "父级持有列表数据和 key 策略。片段中的 render 与事件各在自己的位置，完整 App 见后文。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "key 策略",
            "删除前第0行",
            "删除后第0行",
            "结果"
          ],
          "rows": [
            [
              "业务ID",
              "key=A，draft=A笔记",
              "key=B，沿用旧B",
              "B仍是B笔记"
            ],
            [
              "下标",
              "key=0，draft=A笔记",
              "key=0，props.id改为B",
              "B继承A笔记"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "下标故障组并非 React 把 B 的草稿读错了，而是你把身份定义为“第0个 Row”，删除前后这个位置的 key 与类型都相同。数据变成 B，state 却仍属于延续的第0个节点。修复要改变身份约定。给它加 memo 只影响某些计算是否能跳过，无法把错误的身份改成业务 ID。"
        },
        {
          "type": "paragraph",
          "text": "key 只参与同一父级孩子的对应；换父级 key 或把 Row 换成另一个组件类型，都会改变状态能否延续。key 是 React 的特殊信息，不会自动成为 props.key，所以 Row 另外接收 id。随机 key 会反复重建节点，不该用来掩盖状态设计问题。确实需要重置时，用稳定的业务版本值有意改变 key，并明确重置时机。"
        }
      ]
    },
    {
      "id": "s19-366973",
      "title": "Hooks 的顺序：在同一身份中找到同一份状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "身份解决“是哪一个组件”，Hook 顺序进一步解决“这个组件的哪一份记录”。假设 Row 先调用 useState 保存 draft，再调用另一个 useState 保存 expanded。更新时 React 依次对应这两次调用，才能把草稿交给草稿位置，把展开状态交给展开位置。"
        },
        {
          "type": "code",
          "code": "function Row({id}:{id:string}) {\n  const [draft,setDraft]=useState('');\n  const [expanded,setExpanded]=useState(false);\n  if (!id) return null; // 所有Hook已按稳定顺序调用\n  return <button onClick={()=>setExpanded(v=>!v)}>\n    {expanded ? draft || id : id}\n  </button>;\n}",
          "purpose": "独立的结构示意，不替换上面的草稿实验。Hook全部在条件返回之前。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "若把第二个 Hook 放到 if (expanded) 里面，一轮调用一个、下一轮调用两个，后面的状态记录就不能稳定对应。应让 Hook 总按相同顺序调用，再把条件放进结果或 Effect 的过程；也可以把真正有独立生命周期的部分拆成子组件。条件本身并没有被禁止，受约束的是普通 Hook 的调用位置和次序。"
        },
        {
          "type": "paragraph",
          "text": "同理，使用 <Row id=\"A\" /> 建立独立组件节点，而不是在父组件里直接执行 Row({id:\"A\"})。直接调用会让 Hook 运行在当前渲染上下文中，失去你希望建立的组件边界。自定义 Hook 复用逻辑，每次调用仍属于自己的调用方；函数名相同不会让两个 Row 自动共享 draft。"
        }
      ]
    },
    {
      "id": "s12-321727",
      "title": "事件怎样走：先区分传播、默认行为与 Portal",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "事件传播描述监听器沿关系链被调用的过程。普通点击先经历捕获，再到目标与冒泡。React 用 onClickCapture 和 onClick 表达这些阶段；target 是原始触发节点，currentTarget 是当前这个处理器所在节点。默认行为则是浏览器为元素定义的操作，比如表单提交或链接导航，它与是否继续传播是两项职责。"
        },
        {
          "type": "table",
          "headers": [
            "手段",
            "作用",
            "本例用途"
          ],
          "rows": [
            [
              "event.stopPropagation()",
              "阻止后续传播阶段沿相应链继续",
              "Portal按钮阻止后续父级冒泡"
            ],
            [
              "event.preventDefault()",
              "取消可取消事件的默认行为",
              "表单onSubmit保留交互但取消浏览器提交"
            ],
            [
              "type=\"button\"",
              "声明按钮不承担表单提交",
              "普通操作按钮不触发submit"
            ],
            [
              "target===currentTarget",
              "判断是否直接点击该容器本身",
              "只点击背景时关闭面板"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "Portal 把一段内容渲染到另一个已有 DOM 容器，本例是 document.body；它仍保留原来的 React 父子关系。App 的 main 不包含 Portal 按钮的实际 DOM，但 App 的 React 捕获与冒泡处理器仍能收到该按钮的 React 点击事件。先看两种树，再读完整面板实现。"
        },
        {
          "type": "figure",
          "src": "figures/react-identity-events/two-trees.svg",
          "title": "Portal 改变 DOM 落点，保留 React 逻辑归属",
          "alt": "React逻辑树中按钮属于App，DOM树中面板位于body下且不在main内；捕获从App到按钮，冒泡返回App。",
          "caption": "这是公开行为的父子关系示意，不是事件委托内部源码图；中间节点省略。"
        },
        {
          "type": "code",
          "code": "function PortalPanel({close,stop,log}:{close:()=>void;stop:boolean;log:(line:string)=>void}){\n  const button=useRef<HTMLButtonElement>(null);\n  useEffect(()=>{\n    const previous=document.activeElement as HTMLElement|null;\n    button.current?.focus();\n    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};\n    window.addEventListener('keydown',key);\n    return ()=>{window.removeEventListener('keydown',key);previous?.focus();};\n  },[close]);\n  return createPortal(<div data-backdrop onClick={e=>{if(e.target===e.currentTarget)close();}} style={{border:'2px solid #46735e',padding:20,margin:20}}>\n    <section aria-label=\"Portal 事件面板\"><h2>DOM 在 body 下，逻辑上仍属于 App</h2>\n      <button ref={button} data-portal-action onClick={event=>{log('button');if(stop)event.stopPropagation();}}>Portal 点击</button>{' '}\n      <button onClick={close}>关闭面板</button>\n      <p>Escape 可关闭；此面板演示事件与焦点恢复，不实现完整模态焦点圈定。</p>\n    </section>\n  </div>,document.body);\n}",
          "purpose": "完整 PortalPanel：createPortal 来自 react-dom，容器已有；背景按 target/currentTarget 判断，Escape订阅有清理，保留进入前焦点供关闭后恢复。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这里先看 return 的最后一个参数 document.body，它决定 DOM 落点；再看背景 onClick，只有 target 与 currentTarget 相同才调用 close。点击内部按钮，事件确实会冒泡到背景，但 target 是按钮，所以不会被误判成背景点击。这比给每个孩子都写 stopPropagation 更能直接表达“只点空白关闭”的需求。"
        },
        {
          "type": "paragraph",
          "text": "按钮的 stop 开关负责另一件事。它开启时，按钮处理器调用 stopPropagation，后续 owner-bubble 不再运行；之前已经运行的 owner-capture 不会被撤回。该顺序用于说明捕获与冒泡，而不是承诺混入任意第三方原生监听器后仍有完全相同的全局日志顺序。"
        },
        {
          "type": "table",
          "headers": [
            "实验设置",
            "按钮事件顺序",
            "面板是否关闭"
          ],
          "rows": [
            [
              "正常传播",
              "owner-capture → button → owner-bubble",
              "否"
            ],
            [
              "阻止按钮冒泡",
              "owner-capture → button",
              "否"
            ],
            [
              "直接点击背景",
              "背景自己调用close",
              "是"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "面板额外实现 Escape 和焦点恢复，便于观察建立与清理。它是事件教学面板，不是完整生产模态框：没有焦点圈定、背景 inert、滚动锁定等组合能力。产品里的模态交互应使用符合无障碍要求的实现，并验证键盘与读屏体验。"
        }
      ]
    },
    {
      "id": "s15-403303",
      "title": "订阅生命周期：让当前监听器读到当前版本",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React 元素上的事件处理器随提交更新；自己注册到 window 的原生监听器，需要自己管理生命周期。本例有 version 状态，点击发送 ping 后监听器应显示当前版本。我们使用 Effect 在 version 改变后清理旧函数，再注册捕获新版本的新函数。"
        },
        {
          "type": "code",
          "code": "const [version,setVersion]=useState(0);\nconst [heard,setHeard]=useState(-1);\nuseEffect(()=>{\n  const ping=()=>setHeard(version);\n  window.addEventListener('atlas-ping',ping);\n  return ()=>window.removeEventListener('atlas-ping',ping);\n},[version]);\n// 发送按钮：window.dispatchEvent(new Event('atlas-ping'));",
          "purpose": "与完整App相同的订阅路径；移除时传入同一个 ping 引用，依赖体现闭包读取的 version。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "初始 setup 保存读0的监听器。版本变1并提交后，cleanup移除读0的函数，随后setup建立读1的函数。若依赖错误写成[]，监听器会长期读0；若遗漏removeEventListener，每次版本变化又添一个函数，一次ping便会让多个旧闭包一起执行。错误原因不同：一个是订阅没有更新，一个是旧订阅没有结束。"
        },
        {
          "type": "paragraph",
          "text": "React 18 不沿用老版本网页事件对象的池化使用约定，事件委托和原生事件混用仍要按具体版本验证。本文只断言自己控制的 React Portal 传播和原生订阅结果，不从一次日志推断 document、多个 root 和第三方库之间所有监听顺序。"
        }
      ]
    },
    {
      "id": "s19-391767",
      "title": "完整 App 与验证：把身份和事件分开观察",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {useEffect,useRef,useState} from 'react';\nimport {createPortal} from 'react-dom';",
          "purpose": "完整App.tsx导入。按顺序接上前文Row、PortalPanel，再接下面App即可构成文件。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "export default function App(){\n  const [ids,setIds]=useState(['A','B','C']);const [indexKey,setIndexKey]=useState(false);\n  const [epoch,setEpoch]=useState(0);const [open,setOpen]=useState(false);const [stop,setStop]=useState(false);\n  const [events,setEvents]=useState<string[]>([]);const [submitted,setSubmitted]=useState(0);\n  const [version,setVersion]=useState(0);const [heard,setHeard]=useState(-1);\n  useEffect(()=>{\n    const ping=()=>setHeard(version);window.addEventListener('atlas-ping',ping);\n    return ()=>window.removeEventListener('atlas-ping',ping);\n  },[version]);\n  // 只用React稳定setter本身作为关闭策略，避免每次更新制造新的订阅依赖。\n  const close=useRef(()=>setOpen(false)).current;\n  const log=(line:string)=>setEvents(lines=>[...lines,line]);\n  const isPortal=(event:React.MouseEvent)=>event.target instanceof Element&&event.target.hasAttribute('data-portal-action');\n  return <main data-owner style={{padding:20,fontFamily:'system-ui',lineHeight:1.8,maxWidth:800,margin:'auto'}}\n    onClickCapture={event=>{if(isPortal(event))log('owner-capture');}}\n    onClick={event=>{if(isPortal(event))log('owner-bubble');}}>\n    <h1>节点身份与事件归属</h1><section><h2>身份实验</h2>\n      <p>key：{indexKey?'下标':'业务 ID'}</p>\n      <button onClick={()=>setIds(xs=>xs.slice(1))}>删除首项</button>{' '}\n      <button onClick={()=>{setIndexKey(v=>!v);setIds(['A','B','C']);setEpoch(n=>n+1);}}>切换 key 并重置</button>\n      <ul key={epoch}>{ids.map((id,index)=><Row key={indexKey?index:id} id={id}/>)}</ul></section>\n    <section><h2>Portal 传播与表单默认行为</h2>\n      <button onClick={()=>setOpen(true)}>打开 Portal</button>{' '}\n      <label><input type=\"checkbox\" checked={stop} onChange={e=>setStop(e.target.checked)}/>阻止 Portal 冒泡</label>{' '}\n      <button onClick={()=>setEvents([])}>清空事件</button><p aria-label=\"传播记录\">{events.join(' → ')||'无'}</p>\n      {open&&<PortalPanel close={close} stop={stop} log={log}/>}\n      <form onSubmit={event=>{event.preventDefault();setSubmitted(n=>n+1);}}>\n        <button type=\"button\">普通按钮</button>{' '}<button type=\"submit\">提交表单</button>\n        <output aria-label=\"提交次数\">{submitted}</output>\n      </form></section>\n    <section><h2>原生订阅的建立和清理</h2><button onClick={()=>setVersion(n=>n+1)}>增加订阅版本</button>{' '}\n      <button onClick={()=>window.dispatchEvent(new Event('atlas-ping'))}>发送 ping</button>\n      <p>版本 {version}；<output aria-label=\"监听读数\">{heard}</output></p></section>\n  </main>;\n}",
          "purpose": "完整App：行身份、Portal传播、表单和window订阅分别展示；稳定close引用避免面板每次日志更新都重建焦点/键盘同步。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "filename": "终端",
          "purpose": "仓库根目录运行；独立ZIP进入目录后从 npm ci 开始，Node.js 22。",
          "code": "cd examples/react-identity-events\nnpm ci\nnpm test\nnpm run build\nnpm run dev"
        },
        {
          "type": "paragraph",
          "text": "先给A、B各输入不同草稿，删除A，业务key下B应保留自己的草稿和原输入DOM。切换key策略会重置列表，重新输入后删除A：这次B显示A笔记。每次只改变key策略，才知道差异来自身份，而不是混入了另一次重挂载。"
        },
        {
          "type": "paragraph",
          "text": "接着打开Portal并点击按钮，观察三段传播记录；开启阻止冒泡后清空记录再点击，只剩capture和button。点击内部不能关闭，直接点背景才能关闭。普通表单按钮不触发提交，submit处理器则显式取消默认提交并更新次数。最后提高订阅版本、发送ping，检查读数与当前版本一致。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "Portal在body里，为什么App仍收到点击？",
              "Portal保留React逻辑父子关系，公开React事件按这条关系传播。DOM落点只回答页面节点放哪里。"
            ],
            [
              "停止冒泡能否阻止表单默认提交？",
              "两者职责不同。应声明按钮type或在适当的submit处理器里preventDefault，不能靠stopPropagation代替。"
            ],
            [
              "删A以后B继承A草稿，能用memo解决吗？",
              "不能。首先修正key定义，使新B对应旧B。跳过计算不会重新定义组件身份。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "测试使用React DOM18.3.1与jsdom覆盖草稿/DOM身份、Portal捕获冒泡、背景判断、可取消表单事件、订阅更新及Escape焦点恢复。jsdom不能替代真实浏览器的默认导航、完整模态无障碍或读屏验收。配套实验与正文同源，页面需要运行时可直接打开，关键逻辑已经完整展示。"
        },
        {
          "type": "experiment",
          "id": "react-identity-events",
          "title": "动手观察身份与 Portal 传播",
          "description": "分别改变key策略和冒泡策略，一次只改变一个变量，预测结果再操作。"
        }
      ]
    }
  ],
  "questionIds": [
    "react-identity-events-key",
    "react-identity-events-event"
  ],
  "references": [
    {
      "title": "React：保存与重置状态",
      "url": "https://react.dev/learn/preserving-and-resetting-state"
    },
    {
      "title": "React：事件",
      "url": "https://react.dev/learn/responding-to-events"
    },
    {
      "title": "React：Portal",
      "url": "https://react.dev/reference/react-dom/createPortal"
    }
  ],
  "status": "review",
  "kind": "tutorial",
  "verifiedAt": "2026-10-23",
  "labMinutes": 25,
  "versions": [
    "React / React DOM 18.3.1",
    "Node.js 22",
    "TypeScript 5.7.2"
  ],
  "experiment": "react",
  "examples": [
    {
      "label": "完整示例 ZIP",
      "path": "react-identity-events.zip"
    },
    {
      "label": "运行与验证记录",
      "path": "react-identity-events/VERIFICATION.md"
    }
  ]
};
export default article;
