import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "graph-traversal-dependencies",
  "topic": "algorithms",
  "title": "图的遍历与依赖：BFS、DFS 和拓扑排序",
  "description": "建立有向图、前沿和发现状态的概念，实现BFS边数距离、显式帧DFS环见证和Kahn拓扑序；区分共享后继、环成员与被环阻塞的任务。",
  "minutes": 55,
  "tags": [
    "有向图",
    "BFS",
    "DFS",
    "拓扑排序",
    "依赖分析"
  ],
  "scope": "建立有向图、前沿和发现状态的概念，实现BFS边数距离、显式帧DFS环见证和Kahn拓扑序；区分共享后继、环成员与被环阻塞的任务。 TypeScript 5.7.3 / React 18.3.1 / Node.js 22.12.0；教学算法与快照轨迹额外成本分开，不以运行耗时证明复杂度。",
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
      "path": "graph-traversal-dependencies.zip"
    },
    {
      "label": "安装、操作与验证说明",
      "path": "graph-traversal-dependencies/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Open Data Structures：图遍历",
      "url": "https://opendatastructures.org/ods-java/12_3_Graph_Traversal.html"
    },
    {
      "title": "Princeton Algorithms：有向图原作者讲义",
      "url": "https://algs4.cs.princeton.edu/lectures/keynote/42DirectedGraphs.pdf"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "图是对象之间的关系，先说清边的含义",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "图由顶点和边组成，顶点表示对象，边表示关系。有向边v→w区分方向，无向边则可看成两个方向的连接。任务依赖图中，本文约定“前置任务→后续任务”；如果你的输入写的是“任务→它依赖的任务”，必须先反向转换。箭头意义不同，入度和拓扑结果的业务解释也会反过来。"
        },
        {
          "type": "paragraph",
          "text": "树里的节点只有一个父亲，图允许多个顶点指向同一后继，也允许形成环。因此直接把树的递归代码搬过来，会遇到重复访问甚至不终止。图遍历需要保存发现或完成状态；不同遍历还维护不同的前沿，即已经知道、但尚未处理完的工作集合。BFS用队列，DFS用栈，拓扑排序则维护当前已无前置依赖的节点。"
        },
        {
          "type": "paragraph",
          "text": "我们用构建任务0到4贯穿：0完成后可做1与2，两者都指向3，随后3指向4；另有孤立节点5。先用它说明重复遇见同一后继，再加入1↔2制造依赖环。文章交付的是有限内存图的算法，不提供真实多机任务执行、失败重试或数据库并发调度器；拓扑顺序也不自动等于生产执行计划。"
        }
      ]
    },
    {
      "id": "representation",
      "title": "邻接表、入度和输入边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "邻接表g[v]列出从v出发的所有终点。V个顶点、E条边时，占用O(V+E)空间，扫描一个顶点的后继与它的出边数成正比。邻接矩阵则为每对顶点留槽位，空间O(V²)，适合的访问模式不同。本文没有为了方便可视化把矩阵开销藏进线性复杂度声明。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/graph-traversal-dependencies/core.ts",
          "kind": "excerpt",
          "purpose": "图类型、稠密邻接表与端点检查，以及可选教学观察事件。整数编号必须落在0..V-1。",
          "code": "export type Graph=readonly (readonly number[])[];\nexport function validateGraph(g:Graph){\n for(let v=0;v<g.length;v++){if(!Object.hasOwn(g,v)||!Array.isArray(g[v]))throw new RangeError('dense adjacency lists required');for(let i=0;i<g[v].length;i++){const w=g[v][i];if(!Object.hasOwn(g[v],i)||!Number.isInteger(w)||w<0||w>=g.length)throw new RangeError('edge endpoint outside graph');}}\n}\nexport type GraphEvent={action:string;vertex:number;frontier:number[];state:number[]};\nexport type ObserveGraph=(e:GraphEvent)=>void;"
        },
        {
          "type": "paragraph",
          "text": "重复边在本例是合法多重边：0→1出现两次，就在入度中加两次，移除0时也减两次。BFS仍只发现1一次。自环也允许作为输入，但它会使拓扑排序失败。非法端点、小数下标和空洞直接拒绝，避免把undefined当成顶点。检查本身O(V+E)，所有公开算法都会先检查；不会每走一条边重新扫描全图。"
        },
        {
          "type": "table",
          "headers": [
            "算法",
            "需要的状态",
            "保证的结果"
          ],
          "rows": [
            [
              "BFS",
              "单源距离、parent、先进先出队列",
              "可达节点的最少边数；只适合等权/无权距离"
            ],
            [
              "DFS",
              "白灰黑颜色、显式帧、parent",
              "深度访问与完成顺序；有向回边可给环见证"
            ],
            [
              "Kahn",
              "剩余入度、就绪队列",
              "DAG的完整拓扑序；有环时只给部分已就绪序列"
            ]
          ],
          "caption": "三者都有访问顺序，但顺序用途不能互换。"
        },
        {
          "type": "paragraph",
          "text": "有向图里的“连通”也要谨慎使用。从零能到三，不表示从三能回到零；单源可达集合、忽略方向的连通分量和强连通分量是不同对象。本文的遍历不负责求强连通分量，只给单源距离或覆盖全图的访问森林。看到结果里有多个根，不应直接把它们解释为无向连通分量数量。"
        },
        {
          "type": "paragraph",
          "text": "图在算法运行期间视为不变。若遍历到一半才加一条边，已经完成的节点是否需要重开、入度是否还可信，都需要新的增量协议。这里先检查再遍历，测试还冻结输入数组，确保实现没有偷偷改邻接表；这证明调用方数据得到保留，不保证调用方并发修改时仍能获得某一时刻的快照。"
        }
      ]
    },
    {
      "id": "bfs",
      "title": "BFS按层扩张，第一次发现就确定边数距离",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "BFS从源点0开始，将distance[0]设为0并入队。取出一个顶点v后，扫描所有后继w；若w尚未发现，令distance[w]=distance[v]+1、parent[w]=v并立刻入队。队列使距离较小的层先处理，所以第一次发现w时，不可能还有尚未处理的更短层能给出更短边数。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/graph-traversal-dependencies/core.ts",
          "kind": "excerpt",
          "purpose": "完整BFS。distance=-1既表示未发现也表示单源不可达；入队时设置，避免菱形共享后继重复入队。",
          "code": "export function bfs(g:Graph,start:number,observe?:ObserveGraph){\n validateGraph(g);if(!Number.isInteger(start)||start<0||start>=g.length)throw new RangeError('invalid start');\n const distance=new Array<number>(g.length).fill(-1),parent=new Array<number>(g.length).fill(-1),queue=[start],order:number[]=[];distance[start]=0;\n for(let head=0;head<queue.length;head++){const v=queue[head];order.push(v);for(const w of g[v])if(distance[w]===-1){distance[w]=distance[v]+1;parent[w]=v;queue.push(w);}observe?.({action:'expand',vertex:v,frontier:queue.slice(head+1),state:[...distance]});}\n return {order,distance,parent};\n}"
        },
        {
          "type": "figure",
          "src": "figures/graph-traversal-dependencies/frontiers.svg",
          "title": "共享后继不是两份工作",
          "alt": "0经1或2都能到3。BFS距离是边数；标记发生在入队时，DFS看到已完成节点则不等于有环。",
          "caption": "0经1或2都能到3。BFS距离是边数；标记发生在入队时，DFS看到已完成节点则不等于有环。"
        },
        {
          "type": "paragraph",
          "text": "如果直到出队才标记，1和2处理时可能都把3加入队列。最终结果有时仍能补救，但队列可能装入大量重复工作，parent也可能被覆盖，原先“一点入队一次”的证明失效。这里先标记再入队，使每个可达顶点只进入一次，每条可达出边只扫描一次。全图输入检查加上遍历仍为O(V+E)。"
        },
        {
          "type": "paragraph",
          "text": "样例距离为[0,1,1,2,3,-1]。parent只记录首次发现的路径，因邻接表顺序不同，0→1→3与0→2→3可能选其中任一条；它们都是两条边。若边权不同，先发现不再保证总权最小，必须换用适合权重条件的算法。后续最短路径篇再讨论Dijkstra，不能把BFS的“最少边数”扩大成任意成本最小。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/graph-traversal-dependencies/core.ts",
          "kind": "excerpt",
          "purpose": "从parent逆向恢复路径，检查非法下标和环。调用前必须检查BFS distance[target]不是-1；未发现节点的parent=-1不意味着存在单点可达路径。",
          "code": "export function reconstruct(parent:readonly number[],target:number){\n if(!Number.isInteger(target)||target<0||target>=parent.length)throw new RangeError('invalid target');const path:number[]=[],seen=new Set<number>();\n for(let v=target;v!==-1;v=parent[v]){if(!Number.isInteger(v)||v<0||v>=parent.length||seen.has(v))throw new RangeError('invalid parent chain');seen.add(v);path.push(v);}return path.reverse();\n}"
        },
        {
          "type": "paragraph",
          "text": "不可达节点的parent仍为负一，单独恢复这个父链会得到只含目标的数组，看起来像长度零的路径。因此完整使用方式必须先检查distance不是负一，再调用恢复函数。恢复函数另外拒绝父链中的越界和环，解决的是损坏父数据；可达性则来自那次BFS的距离状态，两者提供的保证不同。"
        },
        {
          "type": "paragraph",
          "text": "队列顺序为什么能证明最少边数，还可以用反证看：若首次发现的距离不是最短，必存在一个更近前驱尚未把目标加入。可是更近层的前驱按先进先出原则早该被处理，矛盾。这一推导要求每条边贡献相同的一步距离；边权即便都为正，也不足以让原BFS直接求总权最小。"
        }
      ]
    },
    {
      "id": "dfs",
      "title": "DFS需要区分未见、正在处理、已经完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "深度优先从当前节点继续探索，直到没有未处理后继，再退回父节点。我们用0白色表示尚未发现，1灰色表示已发现且仍在当前调用路径上，2黑色表示全部出边已处理完。只用一个visited足以避免重复访问，却不足以区分当前祖先与已经完成的共享后继，因此判断有向环时必须保存更多状态。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/graph-traversal-dependencies/core.ts",
          "kind": "excerpt",
          "purpose": "完整显式帧DFS，遍历所有连通分支。frame.next是下一条未扫描的边；灰色回边沿parent重建实际环，黑色边不误报。",
          "code": "export function dfs(g:Graph,observe?:ObserveGraph){\n validateGraph(g);const color=new Array<number>(g.length).fill(0),parent=new Array<number>(g.length).fill(-1),pre:number[]=[],post:number[]=[];let cycle:number[]|null=null;\n for(let root=0;root<g.length;root++)if(!color[root]){\n  color[root]=1;pre.push(root);const stack=[{v:root,next:0}];\n  while(stack.length){const frame=stack[stack.length-1];\n   if(frame.next===g[frame.v].length){color[frame.v]=2;post.push(frame.v);stack.pop();observe?.({action:'finish',vertex:frame.v,frontier:stack.map(f=>f.v),state:[...color]});continue;}\n   const w=g[frame.v][frame.next++];\n   if(color[w]===0){parent[w]=frame.v;color[w]=1;pre.push(w);stack.push({v:w,next:0});observe?.({action:'discover',vertex:w,frontier:stack.map(f=>f.v),state:[...color]});}\n   else if(color[w]===1&&cycle===null){const chain=[frame.v];while(chain[chain.length-1]!==w)chain.push(parent[chain[chain.length-1]]);cycle=chain.reverse();cycle.push(w);observe?.({action:'back edge',vertex:w,frontier:[...cycle],state:[...color]});}\n  }\n }\n return {pre,post,parent,cycle};\n}"
        },
        {
          "type": "paragraph",
          "text": "帧保存v与next，相当于递归函数暂停在第几条后继。发现白色w时，先推进父帧next，再把w标灰并推入新帧；当next等于出边数量时，把v标黑、记入post后弹栈。pre记录首次发现顺序，post记录完成顺序。外层继续找白色根，所以孤立点和从0不可达的分支也会覆盖。"
        },
        {
          "type": "paragraph",
          "text": "扫描到灰色w时，w仍在当前栈路径中，必为当前顶点的祖先或自身。沿parent从当前顶点回到w，再加上当前的v→w，得到闭合环。扫描到黑色w则只说明已经处理过，可能是菱形图里的共享节点，并不能凭它声称存在环。这个判断针对有向图；无向图用双向边表达时，回到父亲的边需要另处理。"
        },
        {
          "type": "paragraph",
          "text": "我们的DFS用显式帧，二万顶点长链不会消耗同样深度的JavaScript调用栈，但仍需要O(V)颜色、parent和帧空间。给环构造一次见证时再走至多O(V)父链，随后保留它继续完成遍历，基础总时间仍O(V+E)。若要枚举所有简单环，输出数量本身可能非常大，不能沿用这个线性承诺。"
        },
        {
          "type": "paragraph",
          "text": "灰色不是“以后某个时刻还会处理”，而是严格属于当前尚未退出的深度路径。若用一个全局待处理集合代替当前栈，可能把另一个分支里的候选误当祖先，给出并不存在的环。显式帧与颜色必须同进同出：压栈时设灰，全部出边处理完并弹栈时才设黑。"
        },
        {
          "type": "paragraph",
          "text": "环见证不一定是最短环，也不一定按数字最小者开头。相同图改变邻接表顺序，第一次遇到的回边可能不同，但见证每条有向边都必须存在，最后顶点必须回到开头。测试因此检查边和闭合关系，而不是在随机图中强行要求某一个固定序列；固定样例才用于讲解具体步骤。"
        }
      ]
    },
    {
      "id": "topological",
      "title": "拓扑顺序按依赖可执行，不按DFS名字猜顺序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "拓扑序要求每条v→w中的v排在w之前。有向无环图DAG才可能满足这个要求：如果有1→2→1，无论谁先都违反另一条边。反过来，有限DAG必有一个入度0节点，否则从任意节点不断追前驱最终重复形成环。Kahn算法就不断取出这样的节点，把它的出边从剩余图中删除。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/graph-traversal-dependencies/core.ts",
          "kind": "excerpt",
          "purpose": "完整Kahn算法。入度统计多重边，队列只在入度首次降为0时加入；返回部分order、blocked及acyclic，不伪称有环时已完成排序。",
          "code": "export function topological(g:Graph,observe?:ObserveGraph){\n validateGraph(g);const indegree=new Array<number>(g.length).fill(0);for(const edges of g)for(const w of edges)indegree[w]++;\n const queue:number[]=[];for(let v=0;v<g.length;v++)if(!indegree[v])queue.push(v);const order:number[]=[];\n for(let head=0;head<queue.length;head++){const v=queue[head];order.push(v);for(const w of g[v])if(--indegree[w]===0)queue.push(w);observe?.({action:'remove ready',vertex:v,frontier:queue.slice(head+1),state:[...indegree]});}\n const blocked:number[]=[];for(let v=0;v<g.length;v++)if(indegree[v]>0)blocked.push(v);\n return {order,blocked,acyclic:order.length===g.length};\n}"
        },
        {
          "type": "paragraph",
          "text": "初始入度为0的节点全部进入队列。取出v后，对每条v→w把w剩余入度减1；只有降到0才说明所有尚未移除的前驱都已经完成，可以加入就绪队列。队列中同一批无依赖节点之间通常没有唯一顺序。若业务想按字典序选，就绪集合应改优先队列，复杂度和取舍也随之变化。"
        },
        {
          "type": "figure",
          "src": "figures/graph-traversal-dependencies/cycles.svg",
          "title": "被环阻塞的下游，不一定属于环",
          "alt": "1与2形成环，3依赖2，所以Kahn的blocked为1、2、3；DFS见证只有1、2、1。两种结果回答不同问题。",
          "caption": "1与2形成环，3依赖2，所以Kahn的blocked为1、2、3；DFS见证只有1、2、1。两种结果回答不同问题。"
        },
        {
          "type": "paragraph",
          "text": "队列空时，如果已输出V个点，所有边都按前驱在先得到解释；否则剩余图存在环。注意blocked中的所有点不一定都在环上，它们也可能只是依赖环的后续节点。样例[[1],[2],[1,3],[]]先取0，再无新就绪点；blocked为[1,2,3]，真正的环见证是[1,2,1]。错误提示应该把“环本身”和“受它影响的任务”分开。"
        },
        {
          "type": "paragraph",
          "text": "DFS在无环时逆转完成顺序也可得到拓扑序，但必须先确认没有环，不能把任何post.reverse都当成合法结果。Kahn更直观地展示当前可执行前沿；DFS更方便给出一条具体循环依赖链。生产系统常同时需要两个视角，但真正的并行执行还要管理任务状态、资源配额与失败传播，本篇仅给结构分析。"
        },
        {
          "type": "paragraph",
          "text": "多个就绪点都能执行时，拓扑序本身没有规定并发度。把当前全部就绪任务同时启动，可能超过数据库连接或机器内存；只取一个又可能浪费资源。生产调度器应把“依赖满足”与“资源允许”分成两个判断。更重要的是，只有前置任务真正成功，才能释放后继依赖，不能在刚启动时就照搬这里的移除操作。"
        },
        {
          "type": "paragraph",
          "text": "有环时返回的部分序列也有用途：它表示在这张静态依赖图里可以先完成的一部分任务。但如果需求是原子地发布整个构建，不能因为这部分可排就提前执行不可回滚动作。调用者必须读取acyclic，而不是只遍历order；错误策略应展示具体环，再说明哪些下游被连带阻塞，避免让用户去修改其实没有环的末端任务。"
        }
      ]
    },
    {
      "id": "run",
      "title": "用状态图和独立参照证明自己没有漏边",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "graph-traversal-dependencies",
          "title": "观察BFS、三色DFS与Kahn的前沿",
          "description": "默认菱形依赖；切换预设查看环及下游阻塞。state分别是距离、颜色或剩余入度，不能只看最终数字顺序。"
        },
        {
          "type": "paragraph",
          "text": "输入邻接表最多16个顶点、每行32条边，建立轨迹后逐步看frontier和state。BFS只从选择的source出发，DFS覆盖所有分支，Kahn会把所有初始就绪点加入；三者起始范围不同，所以不要求每个步骤序列相同。改变输入后重新建立，旧轨迹不会自动变成新图结果。"
        },
        {
          "type": "paragraph",
          "text": "在Node22.12执行npm ci --ignore-scripts、npm test，11项实际通过。250组小图的每个源点BFS距离与独立全点对松弛参照比较；500组图交叉核对DFS环判断和Kahn完整性，逐条验证环见证确有边；DAG结果则逐边检查rank[v]<rank[w]。另覆盖菱形、孤立点、自环、重复边、非法端点、深链与坏parent。"
        },
        {
          "type": "paragraph",
          "text": "正文基础时间按邻接表为O(V+E)，额外状态为O(V)，另计输入和返回结果。观察回调会复制队列/颜色/入度等快照，在每次事件都保留V项时，轨迹可能需要O(V(V+E))额外时间与空间；这正是视图限制规模的原因，不把教育动画的全部历史包装成线性内存。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24在macOS14.5、Node22.12.0清洁安装并完成TypeScript与11项CPU验证，没有把浏览器交互、手机或真实任务系统负载提前标为已验。下一步处理带权路径时，先沿用这里的顶点、边和前沿概念，再明确“第一次发现”为什么不够；算法选择始终从输入条件和要保证的结果开始。"
        },
        {
          "type": "paragraph",
          "text": "全点对参照在小图上依次尝试中间顶点，成本更高，却提供与队列不同的距离推导路径。随机图规模有界，适合差分；二万节点长链则专门检查显式帧不会依赖深递归。两类测试各有用途，不能拿小图对拍通过就声称大图内存无上限，也不能拿深链完成就证明环处理正确。"
        },
        {
          "type": "paragraph",
          "text": "这些例子的编号是紧凑整数。如果真实对象使用字符串标识，先建立字符串到编号的映射，再保留反向表用于输出；不要把任意输入字符串直接当数组属性。映射本身有存储和查找成本，但不会改变邻接表上的遍历机制。将外部标识、结构表示和业务执行分开，才能在报错时说清是输入引用不存在、图里有环，还是任务执行失败。"
        }
      ]
    }
  ]
};
export default article;
