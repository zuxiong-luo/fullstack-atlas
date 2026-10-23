import type { Article } from '../articleTypes';
export const reactFoundationsArticle: Article = {
  "id": "react-foundations",
  "topic": "react",
  "title": "React 基础：从组件和数据流理解页面更新",
  "description": "从React的概念与作用出发，用阅读清单逐步讲清JSX、组件、Props、State、状态快照、更新过程、受控输入与key身份。包含完整实验、图形和失败对照。",
  "minutes": 55,
  "labMinutes": 30,
  "tags": [
    "React 18.3.1",
    "七篇系列·第1篇",
    "组件",
    "数据流",
    "State",
    "key"
  ],
  "kind": "series",
  "status": "review",
  "versions": [
    "React / React DOM 18.3.1",
    "TypeScript 5.7.2",
    "Node.js 22"
  ],
  "verifiedAt": "2026-10-23",
  "scope": "浏览器函数组件的基础模型与可观察行为；先建立组件、数据和身份的关系，Effect 生命周期、外部状态订阅、Fiber 与调度分别在后续篇章展开。",
  "prerequisites": [
    "JavaScript函数、数组map/filter和对象引用",
    "基本HTML；不需要先读React源码"
  ],
  "questionIds": [],
  "experiment": "react",
  "sections": [
    {
      "id": "what",
      "title": "React 是什么：用数据描述交互界面",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React 是一个用于构建用户界面的库。它最核心的做法，是让你把界面拆成组件，并通过组件的输入和状态描述“现在应该显示什么”。数据发生变化时，React重新计算相关界面，并把需要的变化应用到实际渲染目标上。本篇讨论浏览器，所以这个目标是DOM。"
        },
        {
          "type": "paragraph",
          "text": "这里的“声明式”是什么意思？假设阅读清单有两本书，一本已读。我们希望页面显示“已读1本”，并在这本书旁边显示“标为未读”按钮。声明式代码直接描述这两种结果与数据的关系。用户点击后，先改变数据，后续界面仍然由同一套规则计算。你不需要在每个按钮事件里分别找到总数、标题和按钮，再手动修改三处DOM。"
        },
        {
          "type": "code",
          "code": "function ReadingSummary({ completed }: { completed: number }) {\n  return <p>已读 {completed} 本</p>;\n}",
          "purpose": "先只看输入与输出：completed是输入，返回的JSX描述显示结果。这个组件没有自己的状态。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "React 把“计算界面”和“应用 DOM 变更”组织起来，让业务代码主要围绕数据关系表达意图。阅读清单里，行按钮和已读汇总共享一份数据；我们只维护这份数据，界面便能按同一套规则更新。下面先认识组成这套规则的组件、元素、props 和 state。"
        },
        {
          "type": "paragraph",
          "text": "本文是七篇系列的第一篇。你需要能读懂函数、数组map/filter和对象展开，不需要了解Fiber或调度源码。我们先建立组件、数据和更新的认识，再用一份完整阅读清单验证。运行基准固定为React与React DOM 18.3.1，使用createRoot；引用的官方学习文档用于概念核对，网页当前版本不代表本例已升级。"
        }
      ]
    },
    {
      "id": "representations",
      "title": "从 JSX 到页面：分清组件、元素与 DOM",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "JSX是允许我们在JavaScript中写界面描述的语法。它看起来像HTML，但并不是浏览器收到的一段HTML字符串。构建工具会转换它，产生创建React元素的代码。React元素可以理解为“本次要渲染什么”的描述对象，里面包含类型、props等信息；它本身不是屏幕上的DOM节点。"
        },
        {
          "type": "code",
          "code": "function Greeting({ name }: { name: string }) {\n  return <h2>你好，{name}</h2>;\n}\n\nconst description = <Greeting name=\"小罗\" />;\n// description 是元素描述，不是一次 Greeting() 的直接调用。",
          "purpose": "大写Greeting表示自定义组件；小写h2表示浏览器宿主元素。不要把元素变量当成DOM节点。",
          "filename": "Greeting.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "组件则规定如何根据输入生成描述。对于这里的函数组件，React会在需要时调用Greeting，把props交给它，然后继续处理返回的h2元素。元素描述组件，组件返回元素；这两句话并不矛盾，它们处于处理过程的不同位置。JSX中使用大写开头的组件名，才能让它被当作组件类型，而不是普通HTML标签名。"
        },
        {
          "type": "paragraph",
          "text": "最后，React DOM把宿主元素映射到浏览器节点。Greeting不必对应一个额外的DOM外壳；它返回h2，就可以只生成一个h2节点。一个组件也可以返回多个元素或null。因此组件树和DOM树相关，却不是一一对应的。说“重新创建了一个元素对象”也不等于“把对应DOM删掉再建一次”。"
        },
        {
          "type": "figure",
          "src": "figures/react-foundations/layers.svg",
          "title": "同一段界面的三个层次",
          "alt": "Greeting组件接收name，返回h2元素描述；React DOM处理描述，浏览器里出现h2节点。组件本身没有额外DOM外壳。",
          "caption": "这是概念关系图，省略构建工具生成的具体调用和React内部结构；箭头不表示一次简单的字符串转换。"
        },
        {
          "type": "code",
          "code": "import React from \"react\";\nimport { createRoot } from \"react-dom/client\";\nimport App from \"./App\";\n\nconst container = document.getElementById(\"root\");\nif (!container) throw new Error(\"缺少 #root 容器\");\ncreateRoot(container).render(<App />);",
          "purpose": "独立项目需要入口把React接到DOM容器。本站实验室已经提供入口，粘贴App时不要重复创建根。",
          "filename": "main.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "JSX中的花括号用于放JavaScript表达式，例如{book.title}或{items.map(...)}；条件判断也使用普通JavaScript。数组循环要给元素稳定的key，具体原因在后面解释。表达式不能直接把一个任意对象当作可见文本，应该明确选择字段，或者在调试场景把它序列化。"
        }
      ]
    },
    {
      "id": "components",
      "title": "组件的作用：按职责拆分，不是每个标签都建一个文件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "我们要实现一份阅读清单：显示A“React基础”和B“TypeScript基础”，可以标记已读、搜索、反转顺序，并给每行写临时笔记。先不考虑状态，把它分成App、BookRow、汇总区和搜索框。App负责组织数据与交互，BookRow负责一行的展示和行内操作。汇总区如果很简单，可以直接写在App里，不必为了组件数量单独抽文件。"
        },
        {
          "type": "paragraph",
          "text": "组件边界通常来自稳定职责或独立变化需求。一个复杂编辑器有自己的交互和生命周期，值得拆；仅仅包一层div并不能自动提高可维护性。拆分之后也要能说清输入是什么、由谁拥有状态、通过什么事件请求变化，否则只会把难懂的代码散到更多地方。"
        },
        {
          "type": "code",
          "code": "type Book = { id: string; title: string; done: boolean };\n\nfunction BookTitle({ book }: { book: Book }) {\n  return <strong>{book.title}</strong>;\n}\n\n// 同一个组件类型可以出现在多个位置。\n// <BookTitle book={bookA} />\n// <BookTitle book={bookB} />",
          "purpose": "BookTitle是组件类型，两个使用位置分别收到不同props。组件类型不等于某个唯一的页面实例。",
          "filename": "BookTitle.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "后面说“组件实例”时，指树中某个具体使用位置所对应的组件身份，不是说函数组件会生成一个可供业务操作的class实例。同一个BookRow函数可以用于两本书，两行也可以拥有彼此独立的局部状态。不要因为它们由同一个函数定义，就以为状态也只有一份。"
        }
      ]
    },
    {
      "id": "props",
      "title": "Props 与单向数据流：数据向下，操作请求向上",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Props是组件的外部输入。对于BookRow，书名和已读状态来自App。子组件负责显示这些值，但不应直接修改传进来的book对象。即使JavaScript允许修改对象属性，React也不会因此自动知道哪些界面需要重新计算，而且这个对象可能正在被父组件或其他组件共享。"
        },
        {
          "type": "paragraph",
          "text": "需要改变已读状态时，父组件传入一个回调onToggle。BookRow在点击时调用它，并传回书籍ID；App收到请求后更新自己拥有的数据。所谓“操作请求向上”，只是调用传入的普通函数，不是一种自动把数据向上同步的隐藏机制。数据仍然从拥有者向下提供。"
        },
        {
          "type": "code",
          "code": "function BookRow({ book, onToggle }: {\n  book: Book;\n  onToggle: (id: string) => void;\n}) {\n  return <button onClick={() => onToggle(book.id)}>\n    {book.done ? \"标为未读\" : \"标为已读\"} {book.id}\n  </button>;\n}",
          "purpose": "BookRow发出操作请求，不修改book。箭头函数延后到点击时调用；不要写成onClick={onToggle(book.id)}。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "figure",
          "src": "figures/react-foundations/flow.svg",
          "title": "谁拥有数据，谁负责改变它",
          "alt": "App保存books，经book prop传给BookRow；用户点击BookRow的按钮，onToggle(id)回调到App；App更新books后再次向下提供数据。",
          "caption": "回调和数据流方向不同。这里没有全局Store，也没有双向绑定。"
        },
        {
          "type": "paragraph",
          "text": "children也是一种prop，通常用于组合界面。例如一个Panel只负责标题和边框，它可以接收children并放到内部，让调用方决定里面是清单还是表单。这比让Panel认识所有业务类型更灵活，但也不意味着每个组件都必须使用children。"
        },
        {
          "type": "code",
          "code": "function Panel({ title, children }: {\n  title: string; children: React.ReactNode;\n}) {\n  return <section><h2>{title}</h2>{children}</section>;\n}\n// <Panel title=\"阅读清单\"><BookTitle book={bookA} /></Panel>",
          "purpose": "组件组合把通用外观与业务内容分开。示例需要React类型和前面的BookTitle定义。",
          "filename": "Panel.tsx",
          "language": "tsx",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "state",
      "title": "State 是什么：哪些信息需要跨渲染保留",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "State是React为组件身份保留的数据，更新它可以请求重新渲染。函数组件每次执行都会重新建立局部变量，但React能在身份延续时把对应状态交给下一次执行。useState提供当前这次执行读取的值，以及请求更新的setter。这里先使用它，不展开内部Hook链表。"
        },
        {
          "type": "code",
          "code": "const [books, setBooks] = useState(initialBooks);\nconst [query, setQuery] = useState(\"\");\n\nconst visible = books.filter(book =>\n  book.title.toLowerCase().includes(query.trim().toLowerCase())\n);\nconst completed = books.filter(book => book.done).length;",
          "purpose": "books与query是需要记住的事实；visible与completed可由已有输入计算。initialBooks是返回初始数组的函数。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这里最容易多存两个state：visibleBooks和completedCount。这样每次读书状态、搜索或清单变化，都必须记得同步它们。如果忘更新其中一个，列表、汇总和搜索结果就会互相矛盾。对于本例这种便宜的计算，直接在渲染时推导更清楚。是否需要计算缓存是性能问题，不应该为了缓存先制造第二份数据来源。"
        },
        {
          "type": "table",
          "headers": [
            "信息",
            "放在哪里",
            "原因"
          ],
          "rows": [
            [
              "书籍及已读状态",
              "App的books state",
              "清单和汇总共同使用"
            ],
            [
              "搜索词",
              "App的query state",
              "由输入框改变，并决定列表"
            ],
            [
              "已读数量、过滤结果",
              "渲染时计算",
              "可以由已有状态得到"
            ],
            [
              "某一行临时笔记",
              "该BookRow的局部state",
              "本例允许行卸载后丢弃；若产品要求保留应调整归属"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "状态并不是越靠上越好。所有状态都放在根组件，会扩大依赖关系，也使本来独立的组件互相牵连。基本判断是：谁需要读它，谁需要改变它，它需要存活多久？多个兄弟组件共享时，通常先考虑最近的共同父级。跨页面持久化或跨设备同步则是另一层需求，本篇不把localStorage或服务端存储混称为React state。"
        },
        {
          "type": "reference",
          "title": "官方概念：选择状态结构",
          "url": "https://react.dev/learn/choosing-the-state-structure"
        }
      ]
    },
    {
      "id": "snapshot",
      "title": "状态快照：setter 不会改写正在执行的变量",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "“状态是快照”不是说界面被冻结，而是说一次组件执行拿到的state值，在这次执行所创建的处理函数里有确定含义。假设当前count为0，点击处理函数连续调用三次setCount(count + 1)。三个表达式都基于同一个0计算，所以请求的值都是1。不能把它想成对某块共享变量连续做了三次自增。"
        },
        {
          "type": "code",
          "code": "function addByValue() {\n  setCount(count + 1);\n  setCount(count + 1);\n  setCount(count + 1);\n  // 当前这次处理函数里的count仍然是0（假设点击前为0）。\n}\n\nfunction addByUpdater() {\n  setCount(n => n + 1);\n  setCount(n => n + 1);\n  setCount(n => n + 1);\n}",
          "purpose": "重置为0后分别执行：值更新得到1；函数更新按队列累积得到3。不是把第二段理解为三次立刻改DOM。",
          "filename": "快照对照.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "函数式更新把“怎样根据前一个待处理值计算下一个值”交给React。本例三个更新依次产生1、2、3。它适合下一值依赖上一值的场景，但不是所有setter都必须用函数。例如搜索框已经给出了新的完整字符串，setQuery(nextValue)就很直接。"
        },
        {
          "type": "paragraph",
          "text": "React会批处理这类同一个事件中的状态更新，减少不必要的中间渲染。快照与批处理相关但不是同一个概念：前者解释处理函数为什么仍读到旧值，后者解释多次请求如何被组织处理。不要用一句“setState是异步的”替代这两个解释，也不要把setter当成可await的Promise来等待DOM更新。"
        },
        {
          "type": "paragraph",
          "text": "实验中的“本次处理函数读取的count=0”会和最终计数1或3同时显示，正是为了区分这两种时间点。更新函数要保持纯粹，不能在里面发请求、改外部数组或记录必须恰好执行一次的业务事件。开发检查或重新计算可能使这种副作用暴露出问题。"
        },
        {
          "type": "reference",
          "title": "官方概念：State作为快照",
          "url": "https://react.dev/learn/state-as-a-snapshot"
        }
      ]
    },
    {
      "id": "immutable",
      "title": "更新对象与数组：改变数据关系，而不是悄悄改旧对象",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "阅读清单不能直接写book.done = true然后期待页面自动更新。我们需要构造新的books数组，并为变化的那本书创建新对象，未变化的书仍可以沿用原对象。这样既不改写已有快照，也给React与后续比较提供清晰的引用变化。"
        },
        {
          "type": "code",
          "code": "function toggle(id: string) {\n  setBooks(previous => previous.map(book =>\n    book.id === id ? { ...book, done: !book.done } : book\n  ));\n}\n\nfunction reverse() {\n  setBooks(previous => [...previous].reverse());\n}",
          "purpose": "map生成新数组；只替换匹配书籍。reverse会修改它操作的数组，所以先展开复制。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "// 错误示范：不要这样更新React state。\nbooks[0].done = true;\nsetBooks(books);",
          "purpose": "原地修改后把相同引用交回setter，React可能跳过更新；更严重的是已有对象被改写，破坏了状态快照。",
          "filename": "反例.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "为什么有时原地修改“看起来也有效”？因为另一个状态更新让组件重新执行时，代码读到了已经被改过的对象。偶然显示出来不说明更新方式正确，它只是把数据变化寄托在别的触发上。调试时尤其容易出现按钮A改数据不刷新、点击按钮B后才突然显示的现象。"
        },
        {
          "type": "paragraph",
          "text": "对象展开是浅复制。如果book还有嵌套的progress对象，更新progress.page需要复制到该层：{...book, progress: {...book.progress, page: 10}}。没有变化的分支可以共享引用，不必一律深拷贝。不可变更新关注的是不修改此前的数据，而不是每次把整个应用状态复制一遍。"
        }
      ]
    },
    {
      "id": "render",
      "title": "页面怎样更新：计算、提交与绘制分开理解",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在已经知道事件怎样请求改变state，接下来把它与页面连起来。初次挂载时，入口调用root.render；后续点击“标为已读A”时，onToggle请求修改App的数据。React随后处理更新并计算新的组件输出。这个调用组件、计算描述的过程称为render。"
        },
        {
          "type": "paragraph",
          "text": "App得到新的books，计算completed，再给BookRow传入更新后的book。React比较新旧描述，准备需要的宿主变化。进入commit时，它才把对应变化应用到DOM。在浏览器中，布局、绘制还有自己的时机，因此“组件函数已执行”“DOM已变化”和“像素已显示”不能混成一件事。"
        },
        {
          "type": "table",
          "headers": [
            "时刻",
            "数据与计算",
            "页面"
          ],
          "rows": [
            [
              "点击之前",
              "A.done=false，B.done=false；completed=0",
              "两本未读，汇总 0"
            ],
            [
              "点击 A 的按钮",
              "onToggle(\"A\") → toggle(\"A\")；map 返回新数组，A.done=true",
              "请求更新，当前事件函数继续执行"
            ],
            [
              "下次 render",
              "App 读到新 books，completed=1；两行收到各自 book",
              "计算下一版描述"
            ],
            [
              "commit 完成",
              "新的描述成为已提交界面",
              "A 按钮变为“标为未读 A”，汇总 1；B 的文字不变"
            ]
          ]
        },
        {
          "type": "figure",
          "src": "figures/react-foundations/phases.svg",
          "title": "标为已读的一次更新",
          "alt": "点击触发更新请求，React调用组件计算输出，提交必要DOM变更，浏览器在自己的渲染流程中显示结果。计算不等于已经提交。",
          "caption": "本图是正常完成路径，省略并发中断和错误；不表示每个阶段耗时相同，也不是性能测量。"
        },
        {
          "type": "paragraph",
          "text": "这张图与上表可以一起读：render 回答“新的界面是什么”，commit 负责把差异应用到 DOM，浏览器再显示像素。重新执行组件不意味着整页 DOM 被替换。B 的组件即使被调用，只要它产生的宿主内容没有变化，就不需要为了这次已读操作重写 B 的文字。"
        },
        {
          "type": "paragraph",
          "text": "组件计算应该是纯粹的：对于同样的props、state和Context，不修改输入或外部数据，也不在render期间做请求和订阅。React可能重新调用组件或放弃未提交结果。网络、计时器与外部系统同步应该根据具体需求放在事件或Effect里，下一篇再深入区分。"
        },
        {
          "type": "reference",
          "title": "官方概念：渲染与提交",
          "url": "https://react.dev/learn/render-and-commit"
        }
      ]
    },
    {
      "id": "forms",
      "title": "受控输入与状态提升：让界面只有一个明确的数据来源",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "搜索框是受控输入：value来自query，输入事件把新的字符串写回query，下一轮渲染再次把query交给输入框。输入框不是完全失去浏览器行为，而是它的显示值受React提供的value约束。只写value却不处理更新，通常会得到无法按预期编辑的输入。"
        },
        {
          "type": "code",
          "code": "<input\n  aria-label=\"搜索书名\"\n  value={query}\n  onChange={event => setQuery(event.target.value)}\n/>",
          "purpose": "输入的新值来自事件；query控制显示和过滤。初始query为空字符串，避免中途从未受控切换成受控。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果改成defaultValue，含义变成“给输入框一个初始值”。后续编辑的值由DOM维护，不会自动同步成App的query。非受控输入适合只在提交时读取数据等场景；本例需要实时筛选和汇总，所以使用受控方式更方便。不要同时把DOM里的值和React state当成两个互相独立的权威来源。"
        },
        {
          "type": "paragraph",
          "text": "搜索词放在App，是因为输入框和列表都依赖它。假如把query只保存在独立SearchBox里，BookList便无法直接知道它的值。把状态移动到共同父级，再分别传value、onChange和过滤结果，就是状态提升。它不是让子组件直接读父组件的内部变量，而是明确改变拥有者和接口。"
        },
        {
          "type": "paragraph",
          "text": "临时笔记也是受控输入，但它受BookRow自己的note控制。“受控”不等于必须由全局Store或根组件控制，它描述的是值与更新接口的关系。我们保留这个局部状态，正好在下一节观察组件身份改变时发生什么。"
        }
      ]
    },
    {
      "id": "identity",
      "title": "组件身份与 key：状态究竟跟着谁走",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先把实验背景说完整。初始顺序为A“React基础”、B“TypeScript基础”，两行临时笔记都为空。你在A的输入框写“先读这一章”，然后点击反转顺序。业务上希望B排到上面，A排到下面，笔记仍属于A。"
        },
        {
          "type": "paragraph",
          "text": "两行都使用同一个BookRow组件类型。稳定业务ID作为key时，React在同一父级下能把新A与旧A对应起来，保留它的局部状态。使用下标时，反转前后第0行的key都为0，组件类型也相同，原第0行的note就可能延续给如今显示B的那一行。显示数据换了，沿用的组件身份却仍按位置定义。"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "业务ID作为key",
            "数组下标作为key"
          ],
          "rows": [
            [
              "初始",
              "A空，B空",
              "A空，B空"
            ],
            [
              "A输入“先读”",
              "A先读，B空",
              "A先读，B空"
            ],
            [
              "反转后顺序B、A",
              "B空，A先读",
              "B先读，A空"
            ]
          ]
        },
        {
          "type": "code",
          "code": "visible.map((book, index) => (\n  <BookRow\n    key={byIndex ? index : book.id}\n    book={book}\n    onToggle={toggle}\n  />\n))",
          "purpose": "故障组只更换key策略；类型保持BookRow。实验切换策略时会主动重置数据和父级key，避免两组状态混在一起。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "key只在相应父级的兄弟集合中参与身份匹配，不是全局查找ID。相同key也不能保证跨父级或不同组件类型继续保留状态；更换父级身份会影响下面整组子树。key还是React使用的特殊信息，子组件不能靠props.key读取业务ID，应像这里一样另外传book或id。"
        },
        {
          "type": "paragraph",
          "text": "组件类型也参与身份判断。因此 BookRow 定义在模块顶层。如果把它定义在 App 函数内部，App 每次执行都会产生新的函数对象；即使书籍 key 相同，新的组件类型也会让原来的行状态重建。这里的判断依据是函数对象的身份，不是函数名称或返回的标签看起来相同。"
        },
        {
          "type": "paragraph",
          "text": "再做一个更容易误判的操作：给A写笔记并标记已读，然后搜索TypeScript，让A消失，再清空搜索。A再次出现时，已读仍在，临时笔记却为空。原因是已读记录在仍然存活的App.books里，而BookRow A已经被过滤出渲染树并卸载。稳定key帮助匹配仍在协调范围中的身份，不会自动保存已卸载组件的历史state。"
        },
        {
          "type": "paragraph",
          "text": "如果产品要求隐藏后保留草稿，应该把草稿按book.id保存到适当的上级或持久化层，而不是期待key充当缓存数据库。真实列表是否允许下标key，也要看是否存在重排、插入、删除以及行内状态需求；本例允许反转，因此下标不符合业务身份。"
        },
        {
          "type": "reference",
          "title": "官方概念：保留与重置状态",
          "url": "https://react.dev/learn/preserving-and-resetting-state"
        }
      ]
    },
    {
      "id": "practice",
      "title": "把片段拼成完整阅读清单，再逐项验证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面是配套 App.tsx 的完整内容，按三个函数边界拆开显示；顺序合并后就是同一个文件。关键实现都在本页，实验室与下载只是运行方式。第一段先建立数据类型和行组件：已读从父级传入，临时笔记保存在该行，因此它们具有不同生命周期。"
        },
        {
          "type": "code",
          "code": "import React, { useState } from 'react';\ntype Book = { id: string; title: string; done: boolean };\nconst initialBooks = (): Book[] => [\n  { id: 'A', title: 'React 基础', done: false },\n  { id: 'B', title: 'TypeScript 基础', done: false },\n];\nfunction BookRow({ book, onToggle }: { book: Book; onToggle: (id: string) => void }) {\n  const [note, setNote] = useState('');\n  return <li data-row={book.id} style={{ padding: 12, border: '1px solid #b9c9c0', marginBottom: 12 }}>\n    <strong>{book.id} · {book.title}</strong>{' '}\n    <button onClick={() => onToggle(book.id)}>{book.done ? '标为未读' : '标为已读'} {book.id}</button>\n    <p>状态：<output data-done={book.id}>{book.done ? '已读' : '未读'}</output></p>\n    <label>临时笔记 {book.id}<input aria-label={`临时笔记 ${book.id}`} value={note} onChange={e => setNote(e.target.value)} style={{ maxWidth: '100%', boxSizing: 'border-box' }}/></label>\n    <p>当前草稿：<output data-note={book.id}>{note || '（空）'}</output></p>\n  </li>;\n}",
          "purpose": "完整 App.tsx 的第 1 段，原样节选：导入、初始数据与 BookRow。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这里 BookRow 不保存第二份 done。点击只把 book.id 交还 App；笔记则通过本行 setNote 更新。之后观察“过滤后已读保留、笔记消失”，就能从这两份数据的所有者直接推导原因。"
        },
        {
          "type": "code",
          "code": "function SnapshotCounter() {\n  const [count, setCount] = useState(0);\n  const [report, setReport] = useState('尚未点击');\n  function values() {\n    setCount(count + 1); setCount(count + 1); setCount(count + 1);\n    setReport(`本次处理函数读取的 count=${count}`);\n  }\n  function updaters() {\n    setCount(n => n + 1); setCount(n => n + 1); setCount(n => n + 1);\n    setReport(`本次处理函数读取的 count=${count}`);\n  }\n  return <section aria-label=\"快照实验\"><h2>状态快照实验</h2>\n    <p>计数：<output data-count>{count}</output>；<span data-report>{report}</span></p>\n    <button onClick={values}>三次值更新</button>{' '}<button onClick={updaters}>三次函数更新</button>{' '}\n    <button onClick={() => { setCount(0); setReport('尚未点击'); }}>重置计数</button>\n  </section>;\n}",
          "purpose": "完整 App.tsx 的第 2 段，原样节选：独立计数诊断区。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "SnapshotCounter 的 report 记录处理函数当时读取的 count；output 展示下一次渲染得到的 count。让两个值同时出现，是为了把“事件读了什么”与“更新后显示什么”分开。它不参与书籍清单的数据。"
        },
        {
          "type": "code",
          "code": "export default function App() {\n  const [books, setBooks] = useState(initialBooks);\n  const [query, setQuery] = useState('');\n  const [byIndex, setByIndex] = useState(false);\n  const [generation, setGeneration] = useState(0);\n  const visible = books.filter(book => book.title.toLowerCase().includes(query.trim().toLowerCase()));\n  const completed = books.filter(book => book.done).length;\n  function toggle(id: string) {\n    setBooks(previous => previous.map(book => book.id === id ? { ...book, done: !book.done } : book));\n  }\n  function changeStrategy() {\n    setByIndex(value => !value); setBooks(initialBooks()); setQuery(''); setGeneration(n => n + 1);\n  }\n  return <main style={{ fontFamily: 'system-ui', maxWidth: 760, margin: 'auto', padding: 20, lineHeight: 1.8 }}>\n    <h1>阅读清单：数据、状态和身份</h1>\n    <p>React 18.3.1；无网络请求，无 StrictMode，不统计性能。刷新后数据重置。</p>\n    <label>搜索书名 <input aria-label=\"搜索书名\" value={query} onChange={e => setQuery(e.target.value)} /></label>\n    <p data-summary>总共 {books.length} 本，已读 {completed} 本，当前显示 {visible.length} 本。</p>\n    <p>当前 key：{byIndex ? '数组下标（故障对照）' : '业务 ID'}</p>\n    <button onClick={() => setBooks(previous => [...previous].reverse())}>反转顺序</button>{' '}\n    <button onClick={changeStrategy}>切换 key 策略并重置</button>{' '}\n    <button onClick={() => setGeneration(n => n + 1)}>只重建列表</button>\n    <ul key={generation} style={{ padding: 0, listStyle: 'none' }}>\n      {visible.map((book, index) => <BookRow key={byIndex ? index : book.id} book={book} onToggle={toggle} />)}\n    </ul>\n    <p>临时笔记属于行组件，过滤掉一行会卸载它，重新显示时草稿为空；已读状态属于父组件，仍然保留。真实产品若要保留隐藏后的草稿，应调整数据归属。</p>\n    <SnapshotCounter />\n  </main>;\n}",
          "purpose": "完整 App.tsx 的第 3 段，原样节选：状态所有者、事件与最终界面。",
          "filename": "App.tsx",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "读主组件时先沿 toggle 走一遍：事件给 ID，map 产生新 books，completed 与 visible 重新计算，BookRow 收到新输入。再看两个实验开关：byIndex 只改变行 key 策略；generation 改变整个 ul 的身份，会重建它下面的行。切换策略同时重置初始数据和 generation，是为了让两组实验从相同初始条件开始。"
        },
        {
          "type": "paragraph",
          "text": "三段合并为 App.tsx，配合前面的 main.tsx 即可接到现有 React 项目；完整示例已包含入口、HTML 与锁定依赖。本站实验室已经提供入口，直接运行即可。"
        },
        {
          "type": "experiment",
          "id": "react-foundations",
          "title": "阅读清单与状态快照实验",
          "description": "验证数据流、派生统计、输入控制、key身份和三次状态更新。每一步都有对应预期结果。"
        },
        {
          "type": "code",
          "code": "cd examples/react-foundations\nnpm ci\nnpm test\nnpm run build\nnpm run dev",
          "purpose": "仓库根目录开始。ZIP解压后进入react-foundations目录再执行；Node.js 22，依赖版本见lock文件。",
          "filename": "终端",
          "language": "sh",
          "kind": "runnable"
        },
        {
          "type": "table",
          "headers": [
            "步骤",
            "操作",
            "应该观察到什么"
          ],
          "rows": [
            [
              "1",
              "初始直接观察",
              "总共2本、已读0本、显示2本"
            ],
            [
              "2",
              "标为已读A",
              "A已读，汇总已读1本，B仍未读"
            ],
            [
              "3",
              "输入搜索词React，再清空",
              "显示1本，再恢复2本；汇总已读仍按整个清单计算"
            ],
            [
              "4",
              "给A写笔记后反转",
              "业务ID模式下笔记仍属于A"
            ],
            [
              "5",
              "切换key策略，给A写笔记后反转",
              "故障组中笔记出现在B；切换策略本身会重置实验"
            ],
            [
              "6",
              "业务ID模式，给A写笔记并标已读，过滤掉A再恢复",
              "草稿丢失，已读保留"
            ],
            [
              "7",
              "重置计数，点三次值更新；再重置，点三次函数更新",
              "结果分别1和3，处理函数报告都读取到0"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "如果结果不一致，先看key模式、过滤词和是否重置了计数。不要一边改变多个变量，一边推断原因。比如先让计数成为1再点函数更新，结果应该是4，不是3；文中的3明确建立在从0开始的条件上。"
        },
        {
          "type": "paragraph",
          "text": "自动测试使用真实React DOM 18.3.1和jsdom，断言页面结果与节点身份，覆盖七条行为。jsdom不能代表浏览器布局、绘制和性能；浏览器中的输入和阅读效果另行检查。测试通过说明声明的场景有证据，不意味着所有React内部路径都已经验证。"
        },
        {
          "type": "paragraph",
          "text": "本例没有保存到磁盘；刷新会重置数据。离线包可以保存文章、图形和浏览器实验资源，但并不等于保存了这份清单的业务状态。若要运行下载的Node项目，npm依赖仍需安装。"
        }
      ]
    },
    {
      "id": "recap",
      "title": "回头串起来：现在你应该能解释一次普通交互",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "以标记A已读为例，点击发生在BookRow，回调把A的ID交给App；App用不可变更新生成新的books；下次组件计算时，汇总与行内容从同一份数据得出；React提交必要的DOM变更。搜索只是改变query并推导visible，不需要复制整个清单状态。重排时，key与类型帮助决定哪些组件身份延续，因此局部笔记能否跟对对象也是数据设计的一部分。"
        },
        {
          "type": "table",
          "headers": [
            "先自己回答",
            "解析"
          ],
          "rows": [
            [
              "A 标记已读时，B 的组件函数执行就代表 B 的 DOM 必须改变吗？",
              "不代表。组件执行计算描述；宿主内容未改变时，不需要相应 DOM 修改。把函数调用次数当作 DOM 操作次数，会混淆 render 与 commit。"
            ],
            [
              "稳定 key 为什么保不住过滤掉后又出现的笔记？",
              "key 帮助协调时匹配身份；过滤掉的行已经卸载，局部 note 随之结束。App 的 books 仍存活，所以已读保留。"
            ],
            [
              "直接修改 book.done，再传回原 books 为什么不可靠？",
              "旧快照已被修改，而 setter 仍收到同一引用，React 可以跳过更新。即使另一次更新碰巧把修改显示出来，也只是掩盖了数据流错误。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "最后集中记住本篇的范围：React 负责界面计算与更新，路由和持久化仍需另行选择；组件计算应保持纯粹，开发 StrictMode 可能增加检查调用；本例使用普通浏览器更新，不用调用日志判断绘制次数。后面的实验是观察这些行为的工具，不能把某一次观察推广为所有内部路径的保证。"
        },
        {
          "type": "paragraph",
          "text": "下一篇再把Hooks、Effect、闭包和异步请求展开；第三篇讨论跨组件与服务端状态；第四、五篇才进入Fiber、协调和调度。这里有意不提前借用Lane、bailout等内部名词解释简单交互。内部实现值得学，但它应当建立在你已经能描述公开行为的基础上。"
        }
      ]
    }
  ],
  "examples": [
    {
      "label": "完整阅读清单实验ZIP",
      "path": "react-foundations.zip"
    },
    {
      "label": "验证记录与限制",
      "path": "react-foundations/VERIFICATION.md"
    }
  ],
  "references": [
    {
      "title": "官方概念：选择状态结构",
      "url": "https://react.dev/learn/choosing-the-state-structure"
    },
    {
      "title": "官方概念：State作为快照",
      "url": "https://react.dev/learn/state-as-a-snapshot"
    },
    {
      "title": "官方概念：渲染与提交",
      "url": "https://react.dev/learn/render-and-commit"
    },
    {
      "title": "官方概念：保留与重置状态",
      "url": "https://react.dev/learn/preserving-and-resetting-state"
    }
  ]
};
