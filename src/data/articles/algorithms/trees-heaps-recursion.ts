import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "trees-heaps-recursion",
  "topic": "algorithms",
  "title": "树、堆与递归：结构关系、遍历和优先级",
  "description": "先分清二叉树、搜索树与二叉堆，再用递归和显式栈解释访问顺序，实际实现底向上建堆、插入与弹出，并验证深度、环与比较次数边界。",
  "minutes": 55,
  "tags": [
    "二叉树",
    "递归",
    "显式栈",
    "二叉堆",
    "优先队列"
  ],
  "scope": "先分清二叉树、搜索树与二叉堆，再用递归和显式栈解释访问顺序，实际实现底向上建堆、插入与弹出，并验证深度、环与比较次数边界。 TypeScript 5.7.3 / React 18.3.1 / Node.js 22.12.0；教学算法与快照轨迹额外成本分开，不以运行耗时证明复杂度。",
  "prerequisites": [
    "会读 TypeScript 数组、函数与循环",
    "理解栈、队列及基础 O 记号；前置内容见本分类前四篇"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "TypeScript 5.7.3",
    "React 18.3.1",
    "Node.js 22.12.0"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 30,
  "examples": [
    {
      "label": "下载完整示例 ZIP",
      "path": "trees-heaps-recursion.zip"
    },
    {
      "label": "安装、操作与验证说明",
      "path": "trees-heaps-recursion/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Open Data Structures：二叉树概念",
      "url": "https://opendatastructures.org/ods-java/6_Binary_Trees.html"
    },
    {
      "title": "Open Data Structures：隐式二叉堆",
      "url": "https://opendatastructures.org/ods-cpp/10_1_Implicit_Binary_Tree.html"
    },
    {
      "title": "MDN：过深递归错误",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "树是层级关系，二叉不是“已经排好序”",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "有根树用父子关系组织节点：根没有父亲，其余节点各有一个父亲，从根到任意节点只有一条路径。二叉树把每个节点的孩子位置限制为左、右两个，允许其中一个或两个为空。它首先描述结构，并不自动规定左边的值更小。目录、语法结构和表达式都可以用树表达；节点身份与节点值要分开看。"
        },
        {
          "type": "paragraph",
          "text": "搜索树和堆在结构上又加了不同的顺序要求。二叉搜索树要求左子树整体小于当前节点、右子树整体大于它（重复值策略另定）；最小堆只要求每个父亲不大于孩子。前者方便按键定位，后者方便反复取最小。把“左孩子小于父亲”当作搜索树完整条件，或者把堆当成排序数组，都会推导出错误操作。"
        },
        {
          "type": "paragraph",
          "text": "本文从一个固定六节点二叉树开始：根4，左子树2包含1和3，右子树7有右孩子9。先回答访问顺序怎样产生，再处理深度与异常结构，最后把同样的父子关系压进数组，做数字优先级队列。我们不在这一篇实现平衡搜索树或可修改键的句柄堆，这些结构解决的是进一步的查找和更新需求。"
        }
      ]
    },
    {
      "id": "shape",
      "title": "节点、深度与高度，是读遍历代码的坐标",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "根的深度为0，沿一条父子边向下深度加1；高度是从一个节点到最深叶子的边数。链式退化的n节点树高度n-1，平衡树高度才是O(log n)。所以“二叉”不能保证搜索或递归深度是对数。完全二叉树则要求最后一层以上都满，最后一层从左连续填充；这是后面数组堆能用下标公式的前提。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/trees-heaps-recursion/core.ts",
          "kind": "excerpt",
          "purpose": "节点类型与真正树结构的检查。Set按对象身份识别环或多个父亲共享的节点，不因两个节点值相同就把它们当同一对象。",
          "code": "export type TreeNode={value:number;left:TreeNode|null;right:TreeNode|null};\nexport function validateTree(root:TreeNode|null){\n const seen=new Set<TreeNode>(),stack=root?[root]:[];\n while(stack.length){const node=stack.pop()!;if(typeof node!=='object'||node===null||!Number.isFinite(node.value)||seen.has(node))throw new TypeError('finite values and a genuine tree required');seen.add(node);if(node.left)stack.push(node.left);if(node.right)stack.push(node.right);}\n return seen.size;\n}"
        },
        {
          "type": "paragraph",
          "text": "即便TypeScript类型写了TreeNode，运行时传入的对象也可能连成环，或让两个父亲指向同一对象。后者是有向无环图中的共享子图，不再符合本篇树的唯一父亲约束。validateTree使用显式栈与Set检查对象身份和有限数值，防止遍历无限推进；这层防御需要O(n)额外空间，不能在统计整段公开API时假装它免费。"
        },
        {
          "type": "figure",
          "src": "figures/trees-heaps-recursion/traversal.svg",
          "title": "同一结构，不同输出时机",
          "alt": "固定六节点树同时给出四种顺序；顺序差异来自输出发生在进入、左子树之后、两个子树之后或队列出队时。",
          "caption": "固定六节点树同时给出四种顺序；顺序差异来自输出发生在进入、左子树之后、两个子树之后或队列出队时。"
        },
        {
          "type": "paragraph",
          "text": "对象引用决定结构身份，数值只是载荷。两个不同叶子都存一并不违反树定义；同一个叶子被左右孩子共同引用才违反唯一父亲。这个区别与前端界面里内容相同不等于实例相同是类似的，但此处没有依赖组件框架：检查直接使用对象引用，复制值或修改展示标签不会改变父子连接。"
        },
        {
          "type": "paragraph",
          "text": "空树与单节点也要放进定义中。空树遍历输出空数组，没有根可以访问；单节点的深度和高度都为零，四种遍历都只输出它。深度预算零意味着只允许根，不意味着不允许任何节点。代码和测试把边数作为深度单位，避免把节点数量当高度后在预算边界差一层。"
        }
      ]
    },
    {
      "id": "traversal",
      "title": "先序、中序、后序，是同一过程的三个观察点",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "深度优先遍历会先沿当前分支继续，再返回尚未完成的父节点。对于每个节点，可以在进入它时输出（先序），处理完左子树后输出（中序），或两边都处理完再输出（后序）。不要把三个名称当成三段无关口诀：它们共享同一组访问路径，只是把输出放在不同时间。"
        },
        {
          "type": "paragraph",
          "text": "固定树先序为4,2,1,3,7,9，中序为1,2,3,4,7,9，后序为1,3,2,9,7,4。中序恰好升序，是因为这棵样例也满足搜索树全子树约束；任意二叉树的中序并不保证有序。后序适合先聚合孩子结果再计算父节点，例如表达式求值或目录大小，但如果结构是有共享节点的图，还必须重新定义重复计算策略。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/trees-heaps-recursion/core.ts",
          "kind": "excerpt",
          "purpose": "完整显式帧遍历与层序实现。phase0/1/2记录递归原本会保存的返回位置，level则用队列与head游标推进。",
          "code": "export type Visit={value:number;depth:number};\nexport function traverse(root:TreeNode|null,order:'pre'|'in'|'post'|'level'):Visit[]{\n validateTree(root);if(!['pre','in','post','level'].includes(order))throw new RangeError('unknown traversal');if(!root)return [];\n const out:Visit[]=[];\n if(order==='level'){const q=[{node:root,depth:0}];for(let head=0;head<q.length;head++){const {node,depth}=q[head];out.push({value:node.value,depth});if(node.left)q.push({node:node.left,depth:depth+1});if(node.right)q.push({node:node.right,depth:depth+1});}return out;}\n const stack=[{node:root,depth:0,phase:0}];\n while(stack.length){const f=stack[stack.length-1];\n  if(f.phase===0){if(order==='pre')out.push({value:f.node.value,depth:f.depth});f.phase=1;if(f.node.left)stack.push({node:f.node.left,depth:f.depth+1,phase:0});}\n  else if(f.phase===1){if(order==='in')out.push({value:f.node.value,depth:f.depth});f.phase=2;if(f.node.right)stack.push({node:f.node.right,depth:f.depth+1,phase:0});}\n  else{if(order==='post')out.push({value:f.node.value,depth:f.depth});stack.pop();}\n }\n return out;\n}"
        },
        {
          "type": "paragraph",
          "text": "显式帧保存node、depth和phase。phase0意味着刚进入，输出先序后准备左孩子；phase1表示左边已完成，输出中序后准备右孩子；phase2表示两边都完成，输出后序再弹栈。先修改父帧phase再推入子帧，等子帧完成弹出时，父帧就知道应该从哪里继续，而不是重新访问左边。"
        },
        {
          "type": "paragraph",
          "text": "层序遍历使用先进先出队列：先出根，再出根的孩子，再到下一层。队列保存深度，出队后把孩子标为depth+1。这里用数组加head游标，不反复Array.shift。队列中的引用会保留到函数返回，最坏O(n)；若要在长生命周期流式任务里不断出队，需要循环队列或回收已消费引用，而不是照搬这个一次性遍历的存储策略。"
        },
        {
          "type": "paragraph",
          "text": "选择遍历顺序应从依赖关系反推。序列化结构时先写父节点信息，先序容易安排；计算每个目录的总大小时，需要先拿到孩子结果，后序更自然；按层展示组织结构则适合层序。仅给出一串正确遍历数字还不够，应该能说清为什么这个输出时机满足当前任务的数据依赖。"
        },
        {
          "type": "paragraph",
          "text": "若在遍历过程中修改孩子引用，结果就不再只是“同一棵树的遍历”。例如进入父节点后又插入一个左孩子，它是否应该被访问，取决于你定义的是输入快照还是动态结构。本文函数调用期间不修改树，返回的是数值与深度快照；如果要做边遍历边编辑的工具，需要明确迭代失效政策、复制策略或版本检查。"
        }
      ]
    },
    {
      "id": "recursion",
      "title": "递归保存的是继续执行的位置，不是免费的循环",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/trees-heaps-recursion/core.ts",
          "kind": "excerpt",
          "purpose": "有显式教学深度预算的递归先序。先做结构检查；最大预算256，根深度0，超出时主动抛可解释错误。",
          "code": "export function recursivePreorder(root:TreeNode|null,maxDepth=256):number[]{\n validateTree(root);if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>256)throw new RangeError('depth budget 0..256');const out:number[]=[];\n function visit(node:TreeNode|null,depth:number){if(!node)return;if(depth>maxDepth)throw new RangeError('teaching recursion depth budget exceeded');out.push(node.value);visit(node.left,depth+1);visit(node.right,depth+1);}\n visit(root,0);return out;\n}"
        },
        {
          "type": "paragraph",
          "text": "递归调用需要在调用栈中保存当前局部状态与返回位置。树高h时，深度优先递归通常需要O(h)调用栈；一条很深的链可能耗尽引擎栈。具体多少层会出错与引擎、构建和函数帧大小有关，没有可移植的“JavaScript总能递归一万层”常数。因此本例主动限制到256边，错误来自我们自己的预算，不伪称测出了V8的栈容量。"
        },
        {
          "type": "paragraph",
          "text": "显式栈把这些帧搬到普通数据结构中，能控制容量、暂停和观测，但没有消灭内存需求。深度优先遍历仍可能保存O(h)帧，结果数组O(n)，结构防御Set另有O(n)。测试生成两万节点退化链，显式实现完成，递归实现按预算拒绝；它证明的是本实现的边界处理，不是显式栈可以无上限吞入任意输入。"
        },
        {
          "type": "reference",
          "title": "MDN：过深递归错误",
          "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion",
          "note": "引擎在过深调用时可能抛出RangeError/InternalError；本文采用自己的预算错误，不依赖某个固定溢出层数。"
        }
      ]
    },
    {
      "id": "heap-concept",
      "title": "优先队列的目标，是随时拿到当前最小项",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "普通队列按到达先后取任务，优先队列按优先级取任务。例如持续收到期限不同的待办，下一次总要取最早截止的项。每次都排序整个数组可以做到，但新项到来后会反复处理已知关系。二叉最小堆只维护父不大于子的局部约束，就能让全局最小值始终在根。"
        },
        {
          "type": "paragraph",
          "text": "为什么局部条件能推出根最小？从任意节点沿父链到根，每经过一条边，父值都不大于孩子；不等式逐层传递，所以根不大于任意后代。但兄弟之间没有顺序要求，更不能在堆数组上直接二分查某个值。查任意键可能仍要O(n)，这是为高效取最小做的取舍。"
        },
        {
          "type": "figure",
          "src": "figures/trees-heaps-recursion/heap.svg",
          "title": "数组槽位怎样表示完全二叉树",
          "alt": "真实样例建堆后为[1,2,3,7,5,9]；数组没有完全排序，只有父子大小关系需要成立。",
          "caption": "真实样例建堆后为[1,2,3,7,5,9]；数组没有完全排序，只有父子大小关系需要成立。"
        }
      ]
    },
    {
      "id": "heap-code",
      "title": "插入上浮、弹出下沉，每次只修一条路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/trees-heaps-recursion/core.ts",
          "kind": "excerpt",
          "purpose": "完整数字最小堆：有限优先级检查、底向上建堆、上浮、下沉、空堆与不变量检查。comparisons只计键比较，不代表全部CPU指令。",
          "code": "export class MinHeap{\n private data:number[];comparisons=0;\n constructor(values:readonly number[]=[]){this.data=Array.from(values);for(const n of this.data)if(!Number.isFinite(n))throw new RangeError('finite priorities required');for(let i=Math.floor(this.data.length/2)-1;i>=0;i--)this.down(i);}\n get size(){return this.data.length;}\n values(){return [...this.data];}\n peek(){return this.data[0];}\n private less(i:number,j:number){this.comparisons++;return this.data[i]<this.data[j];}\n private swap(i:number,j:number){[this.data[i],this.data[j]]=[this.data[j],this.data[i]];}\n private down(i:number){for(;;){let smallest=i;const left=2*i+1,right=left+1;if(left<this.size&&this.less(left,smallest))smallest=left;if(right<this.size&&this.less(right,smallest))smallest=right;if(smallest===i)return;this.swap(i,smallest);i=smallest;}}\n push(value:number){if(!Number.isFinite(value))throw new RangeError('finite priority required');this.data.push(value);let i=this.size-1;while(i>0){const parent=Math.floor((i-1)/2);if(!this.less(i,parent))break;this.swap(i,parent);i=parent;}}\n pop():number|undefined{if(!this.size)return undefined;const value=this.data[0],last=this.data.pop()!;if(this.size){this.data[0]=last;this.down(0);}return value;}\n assertInvariant(){for(let i=1;i<this.size;i++)if(this.data[Math.floor((i-1)/2)]>this.data[i])throw new Error('heap order broken');}\n}"
        },
        {
          "type": "paragraph",
          "text": "数组从0开始时，i的左孩子是2i+1，右孩子是2i+2，父亲为floor((i-1)/2)。追加一项保持完全二叉树形状，只可能破坏它与父亲的大小关系，所以沿父链上浮。弹出根后，把末项放到根并删除尾槽，形状仍完整，但新根可能比孩子大，于是与更小的孩子交换，继续向下修复。"
        },
        {
          "type": "paragraph",
          "text": "下沉时必须比较两个存在的孩子。若只看左孩子，可能在左边不小于父亲时错误停止，而右边还更小。本实现先把当前i当smallest，再依次考虑left、right，选出三者最小；它等于i才停止。空堆pop和peek返回undefined，单项pop直接清空，不继续读取已经不存在的根。"
        },
        {
          "type": "paragraph",
          "text": "完全树高度O(log n)，所以插入和弹出的键比较沿一条路径至多O(log n)，peek为O(1)。这里的数字数组由JS引擎管理，内建push可能涉及容量管理；我们描述的是堆的比较/交换工作，而不是承诺引擎每次物理分配都恒定。values和assertInvariant分别复制/扫描O(n)，只是教学观测，不属于取最小的常数成本。"
        },
        {
          "type": "paragraph",
          "text": "有些实现弹出根时把数组首项直接移除，使剩余项整体左移，然后希望原来的大小关系依旧成立。问题不只是搬移成本：下标变化也改变了每个节点的父子关系。末项搬根再下沉只让一条路径可能违规，才能局部修复；把全部元素左移后，需要重新检查大范围结构，失去这一证明。"
        },
        {
          "type": "paragraph",
          "text": "优先级不必等于紧急程度的数值大小，本例明确“数字越小越先出”。如果业务里分数越高越优先，可以使用最大堆或反向一致比较；不要一边在入堆时取负值，一边在弹出时又按原值修复。带小数的有限优先级在这里合法，而非数值和无穷值拒绝；它与上一篇为安全求和限定整数的输入政策不同。"
        }
      ]
    },
    {
      "id": "heapify",
      "title": "底向上建堆为什么是线性，而不是逐项插入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "构造器复制输入，然后从最后一个非叶节点floor(n/2)-1逆向down。它处理某个父节点时，其两个孩子的子树已经是堆；修好这棵更大的子树后继续向前，最终根子树也完成。这是一个从局部已成立到全树成立的归纳过程，而不是希望随便调几次下沉就能排好。"
        },
        {
          "type": "paragraph",
          "text": "把每个节点都估成log n会得到宽松的O(n log n)上界，但没有利用层高分布。约一半节点是叶子，不下沉；约四分之一最多走一层，再上一层数量继续减半。总工作受n×(1/4+2/8+3/16+…)这类收敛级数约束，所以底向上建堆是O(n)。逐项push也是合法建堆方式，但其最坏比较成本不能直接用这个证明。"
        },
        {
          "type": "paragraph",
          "text": "本例只存数字，不承诺同优先级任务稳定。如果改为任务对象并要求先来先服务，需要用(priority,sequence)做一致比较，并处理sequence范围；仅仅看到某次相等值保持顺序不能推出稳定性。动态修改堆内部元素的priority也会破坏约束，需要定位并上浮/下沉的专门操作，不能让values返回内部数组任意修改。"
        },
        {
          "type": "paragraph",
          "text": "建堆之后依次弹出可以得到升序序列，但这不意味着建堆本身已经完成排序。连续弹出还要进行多次下沉，总比较成本最坏为对数级工作累加。若目标只要最小的几个元素，维护堆可能很合适；若目标一次性输出全体有序数据，则应把整个取出过程也纳入复杂度，而不是只报构造的线性成本。"
        },
        {
          "type": "paragraph",
          "text": "对于不断更新截止时间的任务，最小堆也不会自动知道某项变了。常见方案是维护任务到槽位的映射并修复，或者加入带版本的新条目、取出时丢弃旧版本；前者有索引维护成本，后者有过期条目容量问题。本文保持不可变的数字项，把插入与弹出讲完整，再在最短路径篇用过期条目解释另一种受控策略。"
        }
      ]
    },
    {
      "id": "validation",
      "title": "从固定树看到状态，再用差分检验实现",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "trees-heaps-recursion",
          "title": "观察四种遍历与数组堆",
          "description": "固定树逐步高亮输出；插入或弹出数字优先级后看父子下标、peek和比较累计，验证堆数组无须整体排序。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/trees-heaps-recursion/core.ts",
          "kind": "excerpt",
          "purpose": "文章图形和交互共用的固定样例，防止正文顺序与视图结构各用一棵树。",
          "code": "export function sampleTree():TreeNode{return {value:4,left:{value:2,left:{value:1,left:null,right:null},right:{value:3,left:null,right:null}},right:{value:7,left:null,right:{value:9,left:null,right:null}}};}"
        },
        {
          "type": "paragraph",
          "text": "下载后在Node22.12执行npm ci --ignore-scripts、npm test，10项测试实际通过。200组浅树的三种顺序与独立递归参照对照；两万深链验证显式帧与预算失败；环、共享节点、空树、重复值覆盖输入边界。堆通过6000次混合操作与排序多重集合对照，每次检查父子不变量，并检查不同规模逆序数组建堆的比较上界。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24本机macOS14.5完成清洁安装、TypeScript和CPU检查；没有用一次运行毫秒数证明线性建堆，也没有把递归预算当系统极限。浏览器与手机交互由集成另验。继续学习图时要特别记住：一旦允许共享子节点或环，树里的“沿孩子走一定会结束”就不再成立，visited、颜色和依赖状态会成为必要信息。"
        }
      ]
    }
  ]
};
export default article;
