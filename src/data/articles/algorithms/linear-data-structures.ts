import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "linear-data-structures",
  "topic": "algorithms",
  "title": "线性结构：数组、链表、栈与队列的操作代价",
  "description": "从顺序关系与操作接口出发，实现动态数组、单链表、栈和循环队列；用不变量、差分测试与精确操作计数解释查找、搬移和摊还成本。",
  "minutes": 55,
  "tags": [
    "数组",
    "单链表",
    "栈",
    "循环队列",
    "摊还分析"
  ],
  "scope": "从顺序关系与操作接口出发，实现动态数组、单链表、栈和循环队列；用不变量、差分测试与精确操作计数解释查找、搬移和摊还成本。使用 TypeScript 5.7.3、React 18.3.1、Node.js 22.12.0；算法与有界教学轨迹分开，不把交互轨迹的分配成本算成基础算法成本。",
  "prerequisites": [
    "会读 TypeScript 函数、对象、循环和数组下标",
    "理解引用与复制的区别；无需预先背诵复杂度表"
  ],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "TypeScript 5.7.3",
    "React 18.3.1",
    "Node.js 22.12.0"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 30,
  "examples": [
    {
      "label": "下载完整源码 ZIP",
      "path": "linear-data-structures.zip"
    },
    {
      "label": "安装、步骤与测试说明",
      "path": "linear-data-structures/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Open Data Structures：数组列表",
      "url": "https://opendatastructures.org/ods-python/2_1_ArrayStack_Fast_Stack_O.html"
    },
    {
      "title": "Open Data Structures：单链表",
      "url": "https://opendatastructures.org/ods-python/3_1_SLList_Singly_Linked_Li.html"
    },
    {
      "title": "ECMAScript：Array 对象语义",
      "url": "https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array-objects"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "线性结构是什么：顺序关系与接口不是同一回事",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "线性数据结构用一个先后顺序组织元素。除首尾外，每个位置都有前一个和后一个位置。这里的“线性”描述逻辑关系，不要求对象在真实内存里排成一条线。数组靠下标定位，链表靠节点引用连接；它们都能表示同一串数值，但完成同一种操作的过程不同。"
        },
        {
          "type": "paragraph",
          "text": "栈和队列还要再分清一层：它们首先是操作规则。栈只从同一端放入和取出，后进先出；队列从一端加入、另一端取出，先进先出。底层可以是数组，也可以是链表。因此“数组、链表、栈、队列哪个快”缺少条件，我们应先说需要按下标读取，还是不断从队首取任务，再讨论怎样实现。"
        },
        {
          "type": "paragraph",
          "text": "本文实现一个小型结构实验台。相同的10、20、30，分别放进不同结构，逐步执行插入、删除和读取。你会看到逻辑结果、容量与底层槽位，也会看到搬移或跳转次数。代码是教学实现，JS Array 只是承载槽位的工具；我们没有复刻 V8 的元素类型转换、稀疏数组或垃圾回收机制。"
        }
      ]
    },
    {
      "id": "cost",
      "title": "先定义成本，再比较 O(1)、O(n) 与摊还",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "复杂度回答规模 n 增长时工作量怎样变化，不是预测这一台电脑上的毫秒。本文把一次槽位读取、写入或引用跳转视为常数工作；复制一个对象引用不递归复制对象本身。在这个模型中，下标定位不随 n 增长，而从头沿 next 找第 i 项需要走 i 次。比较有用的前提，是说明我们数的是什么。"
        },
        {
          "type": "paragraph",
          "text": "最坏成本看某一次最不利操作；摊还成本看一串合法操作的总成本，再按操作数分摊。摊还不要求请求随机，也不等于把几次跑得快的时间取平均。比如扩容那一次追加需要复制旧内容，确实会贵；我们接下来证明，一直按倍数扩容时，所有追加引起的复制总量仍受线性上界约束。"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "本例动态数组",
            "本例单链表"
          ],
          "rows": [
            [
              "读取第 i 项",
              "O(1)",
              "O(i+1)，最坏 O(n)"
            ],
            [
              "尾部追加",
              "单次最坏 O(n)，摊还 O(1)",
              "维护 tail 时 O(1)"
            ],
            [
              "头部删除",
              "O(n) 搬移",
              "O(1)"
            ],
            [
              "按下标中间插删",
              "O(n-i) 搬移，加可能扩容",
              "先找前驱 O(i)，然后 O(1) 改引用"
            ]
          ],
          "caption": "成本针对本文实现，不是语言对所有内建数组操作的性能承诺。"
        }
      ]
    },
    {
      "id": "vector",
      "title": "动态数组：把有效长度与预留容量分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "动态数组在一段有容量的槽位中保存元素。size 是已经存在多少项，capacity 是目前预留多少槽位，两者不能混用。不变量是0≤size≤capacity，只有[0,size)属于逻辑内容。读取 size 处即便物理槽位存在也必须拒绝，否则调用者会把预留空间误认为实际元素。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/linear-data-structures/core.ts",
          "purpose": "动态数组完整定义，含整数下标检查、倍增、逆向插入与正向删除；copies 和 shifts 分别累计扩容复制和有序搬移。",
          "kind": "excerpt",
          "code": "export type Cost={copies:number;shifts:number;hops:number};\nfunction indexCheck(i:number,n:number,insert=false){if(!Number.isInteger(i)||i<0||i>n-(insert?0:1))throw new RangeError('index out of range');}\nexport class Vector<T>{\n  private data:(T|undefined)[]=new Array(2);\n  size=0;\n  cost:Cost={copies:0,shifts:0,hops:0};\n  get capacity(){return this.data.length;}\n  get(i:number):T{indexCheck(i,this.size);return this.data[i] as T;}\n  insert(i:number,value:T){\n    indexCheck(i,this.size,true);\n    if(this.size===this.capacity){\n      const next:(T|undefined)[]=new Array(this.capacity*2);\n      for(let k=0;k<this.size;k++){next[k]=this.data[k];this.cost.copies++;}\n      this.data=next;\n    }\n    for(let k=this.size;k>i;k--){this.data[k]=this.data[k-1];this.cost.shifts++;}\n    this.data[i]=value;this.size++;\n  }\n  remove(i:number):T{\n    indexCheck(i,this.size);const value=this.data[i] as T;\n    for(let k=i;k<this.size-1;k++){this.data[k]=this.data[k+1];this.cost.shifts++;}\n    this.data[--this.size]=undefined;return value;\n  }\n  values():T[]{return this.data.slice(0,this.size) as T[];}\n  slots(){return Array.from({length:this.capacity},(_,i)=>i<this.size?this.data[i]:null);}\n  assertInvariant(){if(this.size<0||this.size>this.capacity)throw new Error('vector bounds');}\n}"
        },
        {
          "type": "paragraph",
          "text": "插入第 i 项时，原来的[i,size)都要往右一格。循环从右向左，是为了先搬走旧值再覆盖槽位。如果从 i 开始向右复制，10、20、30中间插入时，前一个旧值会反复覆盖后一个，最后得到多份相同内容。删除则反过来，从左向右把后续元素补上，最后清空原尾部引用。"
        },
        {
          "type": "paragraph",
          "text": "我们故意不自动缩容。这样反复添加、删除边界元素不会在扩容和缩容之间抖动，但一个曾经装过大量数据的 Vector 会保留高峰容量。若业务需要回收容量，可以提供显式压缩，或者采用增长与缩小不同的阈值；不能每次 size 少一项就重新分配整个数组。"
        }
      ]
    },
    {
      "id": "amortized",
      "title": "为什么倍增追加是摊还 O(1)，头插仍然不是",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例初始容量2，后续是4、8、16……。只做尾部追加时，只有填满旧容量才复制，复制量形成2+4+8+…的几何级数。假设已完成 N 次追加，最后一次被复制的旧容量小于 N，所有复制之和小于2N。再加 N 次放入新值，总代价 O(N)，所以每次追加摊还 O(1)。这也直接说明扩容当次仍可能复制 O(N) 项。"
        },
        {
          "type": "paragraph",
          "text": "这个结论有操作范围。每次在头部插入时，不管是否扩容，都要移动原有的全部元素。连续 N 次头插的搬移数是0+1+…+(N-1)=N(N-1)/2；扩容优化只能减少重新分配的部分，无法抹掉保持逻辑顺序所需的搬移。把“动态数组追加快”推广成“所有插入都快”，就会在这里出错。"
        },
        {
          "type": "paragraph",
          "text": "测试不是运行一次再看耗时，而是检查每个追加前缀的 copies<2N，并确认4096项容量变为4096、追加没有 shifts；另用50次头插得到1225次搬移。计数为前面的推导提供可复现证据。计数不包含引擎分配、绘图和测试断言，因此不拿它们推算某个线上请求会花几毫秒。"
        }
      ]
    },
    {
      "id": "linked",
      "title": "单链表：修改连接便宜，找到前驱未必便宜",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "单链表每个节点保存 value 和 next。head 指第一项，tail 指最后一项，空表时两者都是 null。与数组不同，节点的逻辑邻居由 next 决定，不需要搬动后面的值。维护 tail 后，追加只需接上新节点；删除头部则直接让 head 指向下一项。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/linear-data-structures/core.ts",
          "purpose": "单链表完整实现。注意头插、尾插、中间插入三个分支，以及删除最后一项时清除 tail。",
          "kind": "excerpt",
          "code": "type Link<T>={value:T;next:Link<T>|null};\nexport class SinglyList<T>{\n  private head:Link<T>|null=null;\n  private tail:Link<T>|null=null;\n  size=0;\n  cost:Cost={copies:0,shifts:0,hops:0};\n  private nodeAt(i:number):Link<T>{\n    indexCheck(i,this.size);let node=this.head!;\n    for(let k=0;k<i;k++){node=node.next!;this.cost.hops++;}\n    return node;\n  }\n  get(i:number):T{return this.nodeAt(i).value;}\n  insert(i:number,value:T){\n    indexCheck(i,this.size,true);const node:Link<T>={value,next:null};\n    if(i===0){node.next=this.head;this.head=node;if(this.size===0)this.tail=node;}\n    else if(i===this.size){this.tail!.next=node;this.tail=node;}\n    else{const before=this.nodeAt(i-1);node.next=before.next;before.next=node;}\n    this.size++;\n  }\n  remove(i:number):T{\n    indexCheck(i,this.size);let removed:Link<T>;\n    if(i===0){removed=this.head!;this.head=removed.next;}\n    else{const before=this.nodeAt(i-1);removed=before.next!;before.next=removed.next;if(removed===this.tail)this.tail=before;}\n    this.size--;if(this.size===0)this.tail=null;\n    removed.next=null;return removed.value;\n  }\n  values():T[]{const out:T[]=[];for(let p=this.head;p;p=p.next)out.push(p.value);return out;}\n  assertInvariant(){\n    let n=0,last:Link<T>|null=null;for(let p=this.head;p;p=p.next){last=p;if(++n>this.size)throw new Error('cycle or count');}\n    if(n!==this.size||last!==this.tail||(this.size===0&&this.head!==null))throw new Error('list endpoints');\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "“链表插入 O(1)”通常隐藏了已经找到前驱这个条件。本例 API 接收下标，因此在中间插入仍须从 head 走到 i-1。删除单链表中的一个节点也通常需要前驱，不能把双向链表的已知节点删除结论直接搬过来。这里不暴露节点句柄，避免跨链表、已删除节点等额外所有权问题；下一篇 LRU 会用双向链表说明已知节点移动。"
        },
        {
          "type": "paragraph",
          "text": "最容易漏的是只剩一个节点的删除：head 变成 null，但若 tail 仍指着旧节点，下一次尾插就可能接到已经脱离逻辑链的对象。assertInvariant 遍历计数、检查最后节点等于 tail，并防止环导致无限遍历。它每次检查 O(n)，用于测试，不是对外操作复杂度的一部分。"
        }
      ]
    },
    {
      "id": "stack",
      "title": "栈：用受限接口表达嵌套关系",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "栈只暴露 push 与 pop，就能把“最近开始但尚未结束”的工作放在顶部。括号匹配是一个完整例子：读到左括号压栈，读到右括号取出最近左括号并检查种类，读完后栈必须为空。只数左右括号个数不够，([)]数量相等，但关闭顺序错误。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/linear-data-structures/core.ts",
          "purpose": "栈用动态数组尾部实现。push 摊还常数成本，pop 不搬移其他元素。",
          "kind": "excerpt",
          "code": "export class Stack<T>{\n  private data=new Vector<T>();\n  get size(){return this.data.size;}\n  push(value:T){this.data.insert(this.size,value);}\n  pop():T|undefined{return this.size===0?undefined:this.data.remove(this.size-1);}\n  values(){return this.data.values();}\n}"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/linear-data-structures/core.ts",
          "purpose": "完整括号匹配，忽略非括号字符。右括号遇到空栈也返回 false。",
          "kind": "excerpt",
          "code": "export function bracketsBalanced(text:string):boolean{\n  const stack=new Stack<string>(),pairs:Record<string,string>={')':'(',']':'[','}':'{'};\n  for(const ch of text){\n    if('([{'.includes(ch))stack.push(ch);\n    else if(Object.hasOwn(pairs,ch)&&stack.pop()!==pairs[ch])return false;\n  }\n  return stack.size===0;\n}"
        },
        {
          "type": "paragraph",
          "text": "这个应用的时间 O(n)，每个字符最多做一次入栈或出栈，额外空间最坏 O(n)。不应为了避免显式栈而随意改成深递归：运行时调用栈同样占空间，而且有深度限制。这里的 pop 返回 undefined 表示空；如果泛型 T 本身允许 undefined，调用者必须结合 size 判断，或改成带 found 的结果类型。"
        }
      ]
    },
    {
      "id": "ring",
      "title": "循环队列：用头下标前进，避免每次整体左移",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "队列常用来保存待处理任务。如果每出队一次都把其余项向左搬，处理 N 个初始任务会累计二次搬移。循环队列保留 head 和 size，第 i 个逻辑元素放在(head+i)%capacity槽位，尾部新项也按这个公式定位。出队只清空 head 并前进一步，不要求剩余元素在物理槽位中从0连续排列。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/linear-data-structures/core.ts",
          "purpose": "循环队列完整实现。满时按逻辑顺序复制到双倍容量并归零 head；空时 dequeue 返回 undefined。",
          "kind": "excerpt",
          "code": "export class RingQueue<T>{\n  private data:(T|undefined)[]=new Array(4);\n  head=0;\n  size=0;\n  copies=0;\n  get capacity(){return this.data.length;}\n  enqueue(value:T){\n    if(this.size===this.capacity){\n      const next:(T|undefined)[]=new Array(this.capacity*2);\n      for(let i=0;i<this.size;i++){next[i]=this.data[(this.head+i)%this.capacity];this.copies++;}\n      this.data=next;this.head=0;\n    }\n    this.data[(this.head+this.size)%this.capacity]=value;this.size++;\n  }\n  dequeue():T|undefined{\n    if(this.size===0)return undefined;\n    const value=this.data[this.head];this.data[this.head]=undefined;\n    this.head=(this.head+1)%this.capacity;this.size--;\n    if(this.size===0)this.head=0;return value;\n  }\n  values():T[]{return Array.from({length:this.size},(_,i)=>this.data[(this.head+i)%this.capacity] as T);}\n  slots(){return Array.from({length:this.capacity},(_,i)=>this.data[i]??null);}\n  assertInvariant(){if(this.size<0||this.size>this.capacity||this.head<0||this.head>=this.capacity)throw new Error('queue bounds');}\n}"
        },
        {
          "type": "figure",
          "src": "figures/linear-data-structures/mechanism.svg",
          "title": "相同逻辑顺序，不同维护成本",
          "alt": "上方数组头插搬移3项；中间单链表连接新头；下方循环队列 head=2，逻辑20/30/40/50按槽位2/3/0/1保存",
          "caption": "上方数组头插搬移3项；中间单链表连接新头；下方循环队列 head=2，逻辑20/30/40/50按槽位2/3/0/1保存。图中是本示例数据与逻辑关系，不代表 JS 引擎内存布局或计时结果。"
        },
        {
          "type": "paragraph",
          "text": "当 head=2、capacity=4，逻辑内容可能横跨数组尾部和开头。扩容必须复制 data[(head+i)%旧容量]，不能直接把物理数组原样铺过去。否则队首会从错误位置开始。我们的测试先填满0、1、2、3，出两项，再入4、5，最后加入6触发扩容，结果必须是2、3、4、5、6。"
        },
        {
          "type": "paragraph",
          "text": "size 区分空与满；只看 head 是否等于尾下标会有歧义。删除清空槽位是为了释放该结构对已移除对象的引用，不代表垃圾回收马上发生。队列没有自动缩容，所以容量由历史高峰决定；它也没有线程同步、阻塞等待、背压或持久化，不能直接当作可靠消息队列。"
        }
      ]
    },
    {
      "id": "lab",
      "title": "亲手验证：看参数、步骤、结果，而不是动画速度",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "linear-data-structures",
          "title": "线性结构操作实验",
          "description": "选择动态数组、单链表、栈或循环队列，输入数值和下标。每个按钮执行一步，展示内容、槽位及累计代价；队列附九步回绕与扩容脚本。"
        },
        {
          "type": "paragraph",
          "text": "先选择动态数组，把下标固定0，依次插入10、20、30：第三次触发复制，头插还增加搬移。然后重置，改成单链表，在尾部插入后读取末项，观察 hops 随下标增长。最后选循环队列，先重置再执行九步脚本，确认第八步时已经回绕并填满，第九步扩容后 head 归零，逻辑顺序保持不变。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端 · 独立复现",
          "purpose": "下载 ZIP 解压后进入目录执行；应看到 9 项通过。浏览器交互由文末实验入口打开。",
          "kind": "runnable",
          "code": "cd linear-data-structures\nnode --version # v22.12.0\nnpm ci --ignore-scripts\nnpm test\n# tests 9; pass 9; fail 0"
        },
        {
          "type": "paragraph",
          "text": "实际验证在 macOS 14.5、Node.js 22.12.0 执行，9项测试通过。动态数组和单链表各做3000次受控操作，对照原生数组的逻辑结果；FIFO/LIFO做5000次混合操作；另查空结构、单节点重用、非法下标、括号交叉和回绕扩容。原生数组在这里是语义参照，测试没有据此推断其内部数据结构。"
        }
      ]
    },
    {
      "id": "choices",
      "title": "回到选择：看完整工作负载，而不是背一张优劣表",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "读多、按下标访问多，动态数组容易理解；大量队首取出，循环队列避免本实现中的逐项搬移；需要已知节点任意移位，双向链表才更合适。链表还要为每个节点保存引用并分配对象，遍历也可能缺少局部性。底层布局依赖语言和引擎，我们只把这些作为需要测量的工程因素，不从抽象复杂度直接宣称链表一定省内存或更快。"
        },
        {
          "type": "paragraph",
          "text": "实验台为了展示快照会把内容转成数组并渲染整个结构，这一步 O(n)，不会因为某个底层操作是 O(1) 就消失。正式系统可限制可视范围、按批处理或在边界复制；教学界面最多256项，只为让每一步可读。下一篇沿用“接口、不变量、定位成本”的思路，讨论哈希为什么会碰撞，以及缓存怎样维护最近使用顺序。"
        },
        {
          "type": "reference",
          "title": "Open Data Structures：数组列表",
          "url": "https://opendatastructures.org/ods-python/2_1_ArrayStack_Fast_Stack_O.html",
          "note": "用于核对倍增和摊还分析；本文实现与计数为独立 TypeScript 示例。"
        },
        {
          "type": "reference",
          "title": "Open Data Structures：单链表",
          "url": "https://opendatastructures.org/ods-python/3_1_SLList_Singly_Linked_Li.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "ECMAScript：Array 对象语义",
          "url": "https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array-objects",
          "note": ""
        }
      ]
    }
  ]
};
export default article;
