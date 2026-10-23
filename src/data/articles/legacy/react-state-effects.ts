import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "react-state-effects",
  "topic": "react",
  "title": "从状态快照到请求竞态：理解 React 的数据流",
  "description": "从快照、Effect建立与清理讲起，用可控异步源逐步推演取消、晚到成功、旧失败和显示归属；关键代码全部在正文。",
  "minutes": 45,
  "tags": [
    "React",
    "Hooks",
    "闭包",
    "竞态"
  ],
  "scope": "React 18.3.1 客户端 Effect 与单组件查询生命周期；可控传输器只用于行为验证，不模拟真实 fetch 或共享查询缓存。",
  "prerequisites": [
    "JavaScript 闭包",
    "Promise 与事件循环"
  ],
  "questionIds": [
    "react-snapshot",
    "effect-race",
    "event-loop",
    "web-performance",
    "concurrency-pool"
  ],
  "experiment": "react",
  "sections": [
    {
      "id": "snapshot",
      "title": "状态快照是什么：先区分本轮变量与后续界面",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "状态快照指的是一次组件执行所读取的 props 和 state。组件函数在这一轮拿到 count=0，基于它创建的处理函数便能读到这个 0。调用 setter 会请求 React 处理后续更新；它没有把已经创建的闭包中的 count 改写成一个指向“全局最新值”的变量。理解这个对象，才能分析定时器、Promise 和订阅里看到的旧值。"
        },
        {
          "type": "paragraph",
          "text": "本篇深入一个具体问题：用户从查询 A 切到 B，A 的异步回调后来仍然执行，谁有资格改变当前结果？我们把状态快照、Effect 生命周期和结果归属接成一条完整路径。状态队列的内部算法留在专门的 Hooks 队列文章；这里用真实 React 与可控的异步源验证页面行为。"
        },
        {
          "type": "paragraph",
          "text": "先做一个没有请求的最小观察。当前 count=0，点击保存闭包，存入的是本轮创建的 () => count；再点击加一，界面变成 1；最后读取保存的函数，仍得到 0。这里刻意用 state 保存函数，使函数成为显式的教学数据，而不是定时器。给 setter 传入 () => () => count，是因为外层会被 React 作为更新函数调用，返回的内层才是要保存的值。"
        },
        {
          "type": "code",
          "code": "const [count,setCount]=useState(0);\nconst [captured,setCaptured]=useState<(()=>number)|null>(null);\n// 保存按钮：创建并保存本轮的读取函数\nsetCaptured(()=>()=>count);\n// 另一次点击：让新界面读到下一状态\nsetCount(n=>n+1);\n// 读取按钮：调用先前保存的函数\nconst value=captured?.();",
          "purpose": "配套 App 的关键操作分开表示：每段由不同按钮触发，不能粘成一个点击处理器来推断中间渲染。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "时点",
            "界面 count",
            "保存函数来自哪一轮",
            "函数返回"
          ],
          "rows": [
            [
              "挂载",
              "0",
              "尚未保存",
              "无"
            ],
            [
              "保存",
              "0",
              "count=0 的那一轮",
              "0"
            ],
            [
              "加一并提交",
              "1",
              "仍是保存时那一轮",
              "0"
            ],
            [
              "重新保存",
              "1",
              "count=1 的这一轮",
              "1"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这说明旧闭包有自己的数据含义，并不天然是错误。比如“提交时保存当时的表单内容”，就需要那一轮的快照。问题出在把旧请求的结果当成当前查询的结果，或误以为每个异步回调都会自动读取最新界面状态。"
        }
      ]
    },
    {
      "id": "effect",
      "title": "Effect 有什么作用：为一段外部同步定义开始和结束",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Effect 用于在提交之后把组件与外部系统同步。查询值是 React 数据，等待远端结果是外部工作；Effect 可以在 query 改变时建立新的一轮同步，并返回 cleanup 结束上一轮。每一轮 setup 和它返回的 cleanup 都有自己的闭包，因此 A 的 cleanup 应结束 A 的资源，B 的 setup 应建立 B 的资源。"
        },
        {
          "type": "paragraph",
          "text": "先限定普通路径：空查询不启动请求；查询 A 时创建一个 AbortController，把 signal 交给传输层，并保存 active=true；A 成功且这一轮仍有效时，发布 A 的数据。切换 B 时，A cleanup 把自己的 active 改为 false 并发出取消信号，然后 B setup 创建独立控制器和独立 active。A 和 B 不是共用一个会被下一轮重新打开的全局布尔值。"
        },
        {
          "type": "table",
          "headers": [
            "变化",
            "旧同步",
            "新同步",
            "界面归属"
          ],
          "rows": [
            [
              "空 → A",
              "无",
              "建立 A",
              "等待 A"
            ],
            [
              "A → B",
              "A 的 active=false，取消 A",
              "建立 B",
              "等待 B"
            ],
            [
              "B → 空",
              "结束 B",
              "不请求",
              "idle"
            ],
            [
              "组件卸载",
              "结束当前轮",
              "不再建立",
              "不再发布到该组件"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "依赖 [query, load] 表达的是同步过程用到了哪两个随渲染可能变化的值。如果父组件每次创建新的 load 函数，即使 query 没变，也会触发同步重建。示例让 transport 的实例只在挂载初始化，load 引用因而稳定。修复重复请求应从输入身份和业务关系入手；随意删掉 load 或 query，只会让闭包与需求脱节。"
        },
        {
          "type": "figure",
          "src": "figures/react-state-effects/ownership.svg",
          "title": "A 被结束以后，晚到的响应不再拥有写入资格",
          "alt": "A开始请求R1，切B时A清理并取消，R2完成展示B，R1晚到被忽略。",
          "caption": "示意顺序由实验按钮控制；箭头不表示真实耗时。"
        },
        {
          "type": "paragraph",
          "text": "需要区分触发理由：点击“保存订单”应在对应事件流程里发起写操作；不能仅因为某个展示状态变化就无条件再提交订单。这里用 Effect，是因为查询同步要持续跟随 query 的归属，而不是因为所有异步代码都应该放进 Effect。"
        }
      ]
    },
    {
      "id": "transport",
      "title": "先看异步源：怎样让晚到的响应稳定重现",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "依赖真实接口的速度很难稳定复现 A 晚于 B。下面使用可手动完成的传输器：load 返回一个 Promise，把它的 resolve/reject 连同 query 存入请求表。按钮决定哪一个先完成，所以测试不需要碰运气等待若干毫秒。这里 requests 是传输器内部的诊断记录，不是页面结果的权威来源。"
        },
        {
          "type": "code",
          "code": "export type Pending={id:number;query:string;aborted:boolean;resolve:(value:string[])=>void;reject:(error:Error)=>void};\nexport function createTransport(){\n  const requests:Pending[]=[];\n  function load(query:string,signal:AbortSignal){\n    return new Promise<string[]>((resolve,reject)=>{\n      const entry:Pending={id:requests.length+1,query,aborted:signal.aborted,resolve,reject};\n      requests.push(entry);\n      const abort=()=>{entry.aborted=true;};\n      signal.addEventListener('abort',abort,{once:true});\n      // 教学传输故意允许取消后仍完成：用来验证写入资格，不能当作真实 fetch。\n      entry.resolve=value=>{signal.removeEventListener('abort',abort);resolve(value);};\n      entry.reject=error=>{signal.removeEventListener('abort',abort);reject(error);};\n    });\n  }\n  return {requests,load};\n}",
          "purpose": "完整传输器。它刻意在收到 abort 后只记标志，仍允许 resolve/reject，验证消费者能拒绝已过期结果。它不是 fetch 实现。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第一次 load(\"A\", signalA) 创建编号 1，第二次 load(\"B\", signalB) 创建编号 2。取消 A 后，entry1.aborted 变为 true，但 Promise 仍未结束；点击完成 2 才让 B 的 then 运行，点击完成 1 又会让 A 的 then 运行。这种不配合取消的行为是故意构造的反例。真实 fetch 的取消通常会拒绝相应 Promise，但取消不了所有下游工作，更不承诺已经执行的服务端操作被撤销。"
        },
        {
          "type": "paragraph",
          "text": "传输器在完成或失败时移除 abort 监听，避免已结束请求继续持有信号回调。它把接收到取消信号与 Promise 最终怎样结束分开记录：这两件事分开以后，我们才能单独验证资源释放和写入保护。请求表为方便观察保留历史，也允许请求一直不结束；生产实现应定义容量、超时和记录回收，不能直接沿用这个无界诊断容器。"
        }
      ]
    },
    {
      "id": "race",
      "title": "请求结果怎样归属：完整 Hook 与三条写入路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export type Transport=ReturnType<typeof createTransport>;\ntype Result={query:string;status:'idle'|'loading'|'success'|'error';items:string[];error:string};\nexport function useSearch(query:string,load:Transport['load']){\n  const [result,setResult]=useState<Result>({query:'',status:'idle',items:[],error:''});\n  useEffect(()=>{\n    if(!query){setResult({query,status:'idle',items:[],error:''});return;}\n    let active=true;const controller=new AbortController();\n    setResult({query,status:'loading',items:[],error:''});\n    load(query,controller.signal).then(\n      items=>{if(active)setResult({query,status:'success',items,error:''});},\n      error=>{if(active)setResult({query,status:'error',items:[],error:String(error.message||error)});}\n    );\n    return ()=>{active=false;controller.abort();};\n  },[query,load]);\n  // 提交新query到新Effect建立前，旧state不能冒充新query的结果。\n  return result.query===query?result:{query,status:query?'loading':'idle',items:[],error:''} as Result;\n}",
          "purpose": "完整结果类型与 useSearch。成功和失败都检查该轮 active，返回值还校验结果的 query；不省略关键回调。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "按正常 A 路径读：初始 state 是 idle；setup 发布 {query:\"A\",status:\"loading\"}；请求完成时 active 仍为 true，于是一次性发布 A 的 success、items 和空 error。把这些字段作为同一对象更新，避免多个 setter 把 loading、data、error 拼成互相矛盾的组合。"
        },
        {
          "type": "paragraph",
          "text": "现在按反例走。先启动 A，再切 B。A cleanup 已将 A 的 active 置 false。B 返回时，B 的 active 仍为 true，所以界面收到 B结果；A 随后返回，它的 then 能执行，却不能调用 setResult。注意，检查的不是“此刻网络是否连接”，而是该回调是否仍属于一轮有效同步。"
        },
        {
          "type": "paragraph",
          "text": "旧失败同样要拦住。若 B 成功后 A 才报错，A 的拒绝回调没有资格把界面改成 error。示例用 status 联合状态表达完成与失败，没有额外 finally 去设 loading=false；若项目改用 finally，也必须检查本轮资格，否则 A 的完成会错误地结束 B 的 loading。"
        },
        {
          "type": "paragraph",
          "text": "还要看最后一行返回判断。query 已提交成 B，但 B 的新 Effect 尚未执行时，内部 result 可能仍是 A。result.query===query 才允许返回原结果；不相等时返回 B 的 loading 视图。这样既有“旧回调不能写”的保护，也有“旧 state 不能冒充新 query”的显示保护。它们处理的是不同时间窗口。"
        },
        {
          "type": "table",
          "headers": [
            "操作顺序",
            "允许发布",
            "拒绝发布",
            "最终视图"
          ],
          "rows": [
            [
              "A开始 → B开始 → B成功 → A成功",
              "B成功",
              "A成功",
              "B / success / B结果"
            ],
            [
              "A开始 → B开始 → B成功 → A失败",
              "B成功",
              "A失败",
              "B / success / B结果"
            ],
            [
              "A开始 → A失败",
              "A失败",
              "无",
              "A / error / A失败"
            ],
            [
              "A开始 → 清空 → A成功",
              "清空 idle",
              "A成功",
              "空 / idle / 无结果"
            ]
          ]
        }
      ]
    },
    {
      "id": "refs",
      "title": "ref、取消和缓存怎样各司其职",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "为什么不把结果都塞进 ref？ref.current 可以保存可变句柄，却不会因为赋值自动请求重新渲染。界面上的 status 和 items 需要随状态变化而更新，所以这里用 state。控制器可以是本轮 Effect 的局部变量；本例没有跨轮命令式取消需求，就不必为了“总能取到最新”先增加一个共享 ref。"
        },
        {
          "type": "paragraph",
          "text": "active 也可以换成递增请求代数：启动时记下自己的编号，发布前与当前编号比较。关键在于编号的作用域。组件内部的查询适合每个实例自己的生命周期；多个组件共享的缓存，应把代数与完整查询键绑定，由缓存层统一仲裁，不能让两个组件各自决定同一条共享数据的版本。"
        },
        {
          "type": "paragraph",
          "text": "当需求扩展到跨页面复用、去重、后台刷新、重试和服务端数据失效时，可以把这些约定交给查询缓存工具。此前仍要明确 query key 包含哪些条件：比如租户、用户、筛选和分页。仅有 query 字符串未必足以区分业务身份。取消和结果失效的思想仍然成立，只是拥有者从单个 Effect 变成了数据层。"
        },
        {
          "type": "paragraph",
          "text": "本例没有声称取消意味着后端操作回滚。读取结果过期可以忽略；写操作已经发生却丢失响应时，重试还需要服务端幂等键、状态查询等协议。这属于请求语义，不能靠 React cleanup 单方面保证。"
        }
      ]
    },
    {
      "id": "practice",
      "title": "完整页面、运行方法与理解检查",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {useEffect,useState} from 'react';",
          "purpose": "文件开头的完整导入；按顺序接上传输器、类型、Hook，再接下面的 App 即为单文件示例。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "export default function App(){\n  const [transport]=useState(createTransport);\n  const [query,setQuery]=useState('');const [count,setCount]=useState(0);\n  const [captured,setCaptured]=useState<(()=>number)|null>(null);\n  const [report,setReport]=useState('尚未保存');\n  const [,refresh]=useState(0);const result=useSearch(query,transport.load);\n  return <main style={{padding:20,fontFamily:'system-ui',lineHeight:1.8,maxWidth:800,margin:'auto'}}>\n    <h1>状态快照与请求归属</h1>\n    <section><h2>闭包何时建立</h2><output aria-label=\"当前计数\">{count}</output>{' '}\n      <button onClick={()=>setCount(n=>n+1)}>加一</button>{' '}\n      <button onClick={()=>{setCaptured(()=>()=>count);setReport(`保存了 ${count}`);}}>保存闭包</button>{' '}\n      <button onClick={()=>setReport(captured?`闭包读到 ${captured()}`:'请先保存')}>读取闭包</button>\n      <p aria-label=\"闭包记录\">{report}</p></section>\n    <section><h2>手动控制响应顺序</h2>\n      <p>没有网络。取消只标记请求，仍可手动完成旧请求，模拟不配合取消的上游。</p>\n      <button onClick={()=>setQuery('A')}>查询 A</button>{' '}\n      <button onClick={()=>setQuery('B')}>查询 B</button>{' '}\n      <button onClick={()=>setQuery('')}>清空查询</button>\n      <p>当前关键词：<output aria-label=\"当前查询\">{query||'空'}</output></p>\n      <p aria-label=\"查询状态\">{result.status}</p>\n      <p aria-label=\"查询结果\">{result.items.join(',')||'无结果'}</p>\n      {result.error&&<p role=\"alert\">{result.error}</p>}\n      <button onClick={()=>refresh(n=>n+1)}>查看请求表</button>\n      <ol>{transport.requests.map(r=><li key={r.id}>\n        请求 {r.id} / {r.query} / {r.aborted?'已收到取消信号':'未取消'}{' '}\n        <button onClick={()=>{r.resolve([`${r.query}结果`]);refresh(n=>n+1);}}>完成 {r.id}</button>{' '}\n        <button onClick={()=>{r.reject(new Error(`${r.query}失败`));refresh(n=>n+1);}}>失败 {r.id}</button>\n      </li>)}</ol>\n    </section>\n  </main>;\n}",
          "purpose": "完整调用组件。按钮手动完成请求，页面明确显示当前查询、状态和结果。点击查看请求表会刷新诊断列表。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "filename": "终端",
          "purpose": "在仓库根目录执行；ZIP解压后进入目录，从 npm ci 开始。Node.js 22。",
          "code": "cd examples/react-state-effects\nnpm ci\nnpm test\nnpm run build\nnpm run dev"
        },
        {
          "type": "paragraph",
          "text": "先保存闭包、加一、读取，确认界面 1 与闭包 0 可以同时成立。再点查询 A、查询 B、查看请求表，先完成 2，再完成 1；结果应始终是 B。重挂载或刷新后重做，改为失败 1，应看到旧失败也无法覆盖 B。最后单独让当前请求失败，再清空查询，确认错误消失并回到 idle。"
        },
        {
          "type": "table",
          "headers": [
            "先自己回答",
            "解析"
          ],
          "rows": [
            [
              "只写 controller.abort() 为什么还不够？",
              "它请求上游取消；消费者还要判断仍在执行的后续回调有没有资格发布。本实验故意让上游不配合取消以检验这一点。"
            ],
            [
              "为什么新 query 已经是 B，还要校验 result.query？",
              "新 Effect 建立之前，内部 state 可能仍属于 A。显示归属校验覆盖这段窗口。"
            ],
            [
              "active 为什么放在 setup 局部而不是模块顶层？",
              "每轮与每个组件都需要独立资格。共享布尔值可能被新请求改回 true，让旧回调重新获得资格。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "自动测试用 React DOM 18.3.1 与 jsdom 验证闭包、晚到成功、晚到失败、当前错误、清空与卸载取消。它验证的是前端行为，不测真实网络速度、浏览器绘制或服务端回滚。完整实验与正文代码相同，实验入口只方便动手，不是补齐正文的前提。"
        },
        {
          "type": "experiment",
          "id": "react-state-effects",
          "title": "动手改变响应顺序",
          "description": "先启动 A 再启动 B，按不同顺序完成或失败。观察当前结果的归属。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "React：状态快照",
      "url": "https://react.dev/learn/state-as-a-snapshot"
    },
    {
      "title": "React：使用 Effect 同步",
      "url": "https://react.dev/learn/synchronizing-with-effects"
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
  "examples": [
    {
      "label": "完整示例 ZIP",
      "path": "react-state-effects.zip"
    },
    {
      "label": "运行与验证记录",
      "path": "react-state-effects/VERIFICATION.md"
    }
  ]
};
export default article;
