import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "shortest-paths",
  "topic": "algorithms",
  "title": "最短路径与优先队列：从 BFS 到 Dijkstra",
  "description": "从路径代价和松弛建立距离估计，推导非负权下确定最短距离的条件，实际实现带过期条目的二叉堆Dijkstra，并用独立松弛参照验证。",
  "minutes": 55,
  "tags": [
    "最短路径",
    "Dijkstra",
    "松弛",
    "优先队列",
    "非负权"
  ],
  "scope": "从路径代价和松弛建立距离估计，推导非负权下确定最短距离的条件，实际实现带过期条目的二叉堆Dijkstra，并用独立松弛参照验证。 TypeScript 5.7.3 / React 18.3.1 / Node.js 22.12.0；教学算法与快照轨迹额外成本分开，不以运行耗时证明复杂度。",
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
      "path": "shortest-paths.zip"
    },
    {
      "label": "安装、操作与验证说明",
      "path": "shortest-paths/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "MIT6.006 Spring2020：Dijkstra与优先队列",
      "url": "https://live.ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ec187276db0faaa047d655979a44de7f_MIT6_006S20_r13.pdf"
    },
    {
      "title": "Open Data Structures：图遍历与BFS",
      "url": "https://opendatastructures.org/ods-java/12_3_Graph_Traversal.html"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "最短路径求的是什么：边数还是边权之和",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "路径是一串首尾相接的边，路径代价是这些边权的总和。最短路径要求在指定源点到目标的所有可达路径中，找到代价最小的一条。边权可以表示距离、费用或其他可加成本，但不是所有业务指标都能直接相加；如果目标是最小化最大风险或时间依赖的路程，需要先重新定义问题。"
        },
        {
          "type": "paragraph",
          "text": "上一章的BFS求最少边数，因为每次跨边都增加同样的一步。边权都相同且为正时，最少边数也意味着总代价最小；权重不同就不成立。比如零到一有直达边权十，零到二再到一分别为一、一，前者只有一条边，却比两条边的代价二更贵。发现得早不等于路线更便宜。"
        },
        {
          "type": "paragraph",
          "text": "本篇实现非负整数权图的单源最短距离，并恢复一条路径。我们先讲距离估计怎样改进，再证明何时可以把某个估计确定下来，最后实现优先队列。带负权的Bellman-Ford只作为独立测试参照，没有把它包装成完整生产接口；负环检测、全点对、启发式A*与动态道路更新也不混进这一条推导。"
        }
      ]
    },
    {
      "id": "representation",
      "title": "带权邻接表与距离的初始含义",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "邻接表每条记录为[终点,权重]，顶点编号从零开始。源点distance为零，其他点先设Infinity，表示尚未知道可达路线，不代表存在一条成本无穷的实际路径。parent记下当前最好路线的前驱，初始为负一；只有通过有效改进才更新它。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/shortest-paths/core.ts",
          "kind": "excerpt",
          "purpose": "完整输入约束：稠密邻接表、有效端点与非负整数权，限制顶点/边总数以界定教学资源与数值范围。",
          "code": "export type WeightedGraph=readonly (readonly (readonly [number,number])[])[];\nexport function validateWeighted(g:WeightedGraph){\n if(g.length>10000)throw new RangeError('at most 10000 vertices');let count=0;\n for(let v=0;v<g.length;v++){if(!Object.hasOwn(g,v)||!Array.isArray(g[v]))throw new RangeError('dense adjacency lists required');for(let i=0;i<g[v].length;i++){const e=g[v][i];if(!Object.hasOwn(g[v],i)||!Array.isArray(e)||e.length!==2||!Number.isInteger(e[0])||e[0]<0||e[0]>=g.length||!Number.isSafeInteger(e[1])||e[1]<0||e[1]>1_000_000_000)throw new RangeError('endpoint or nonnegative integer weight invalid');if(++count>1_000_000)throw new RangeError('at most one million edges');}}\n}"
        },
        {
          "type": "paragraph",
          "text": "本例最多一万顶点、一百万边，权重为零到十亿的安全整数。非负最短路线总可以去掉无益的环，存在至多V减一条边的简单最优路线，相关距离与一次候选加法都远低于Number安全整数上限。我们不用小数避免近似比较与相等判断干扰本篇；实际处理实数成本时，需要另外规定误差和相等策略。"
        },
        {
          "type": "paragraph",
          "text": "平行边、自环和零权合法。平行边表示同一对点有不同可选连接；零权环不会让代价持续下降。实现只在candidate严格小于旧值时更新，等值不会反复入队，因此零环不会制造无限循环。负权、NaN、坏端点和空洞在开始前拒绝，不等到堆中才发现比较规则已经失效。"
        },
        {
          "type": "paragraph",
          "text": "用Infinity做未发现标记是接口约定，不应该在展示时把它默默转成普通零。JSON本身没有Infinity，直接JSON.stringify会把它写成null；实验显式替换为“不可达”文字。若要给真实HTTP接口输出，应该设计distance为数字或null并另有reachable状态，而不是让序列化器偶然决定业务语义。"
        }
      ]
    },
    {
      "id": "relaxation",
      "title": "松弛是用一条已知路线改进一个上界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果已经知道一条到v的路线代价distance[v]，再走v→w权重cost，就得到一条到w的候选路线candidate=distance[v]+cost。它比distance[w]小时，改写距离并把parent[w]设为v。这叫松弛。距离始终对应某条已发现的实际路线，所以是最短真实距离的上界；算法要逐步把上界降低到最优。"
        },
        {
          "type": "paragraph",
          "text": "贯穿样例是零到一权十、零到二权一、二到一权一、一到三权一、二到三权八。处理零后一的估计十、二的估计一；处理二后一改成二，三暂为九；再处理一，三改成三。最后距离[0,2,1,3]，目标三路线零→二→一→三。初次把十写进距离数组，只意味着发现路线，绝不能把一永久标成无需再改。"
        },
        {
          "type": "figure",
          "src": "figures/shortest-paths/relaxation.svg",
          "title": "同一顶点的估计可以多次改进",
          "alt": "所有边、候选与旧条目来自固定样例；输出计数是本实现实际算法步骤，不是运行毫秒。",
          "caption": "所有边、候选与旧条目来自固定样例；输出计数是本实现实际算法步骤，不是运行毫秒。"
        }
      ]
    },
    {
      "id": "proof",
      "title": "为什么当前最小候选可以确定：非负权用在这里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Dijkstra每次选择尚未确定、当前估计距离最小的顶点u，把它确定，再松弛它的出边。正确性不是因为用了堆，而是因为非负权保证尚未处理的远路不会绕回来变得更短。堆只负责高效选出这个最小候选，换成每轮扫描所有未确定点，推导仍然成立，只是成本不同。"
        },
        {
          "type": "paragraph",
          "text": "假设u的估计还不是最短，存在一条更短路线。沿这条路线从源出发，找到第一个未确定的顶点y，它前面的x已确定。处理x时已经松弛x→y，所以y的当前估计不会大于这条路线到y的前缀成本。后面的权重非负，前缀成本又不会大于整条到u的路线，于是y应有比u更小的候选，和“u是最小”矛盾。"
        },
        {
          "type": "figure",
          "src": "figures/shortest-paths/cut.svg",
          "title": "用跨越已确定集合的一条边完成证明",
          "alt": "证明依赖非负后缀。出现负边时，前缀可能更贵而后面再变便宜，就不能这样确定。",
          "caption": "证明依赖非负后缀。出现负边时，前缀可能更贵而后面再变便宜，就不能这样确定。"
        },
        {
          "type": "paragraph",
          "text": "例如零→一权二、零→二权五、二→一权负四。先确定一为二后，经二却可以得到一，说明非负前提确实必要。把代码改成允许已经确定的点重新入队，不等于原来的Dijkstra证明继续成立，也可能失去原本的工作上界。遇到负边应选择另一套有相应证明和负环政策的算法。"
        },
        {
          "type": "reference",
          "title": "MIT6.006 Spring2020：Dijkstra与优先队列",
          "url": "https://live.ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ec187276db0faaa047d655979a44de7f_MIT6_006S20_r13.pdf",
          "note": "官方课程从非负权、松弛和优先队列分析Dijkstra；本篇用重复条目替代decrease-key，因而空间和对数项单独计算。"
        },
        {
          "type": "paragraph",
          "text": "非负权还意味着零权边不会破坏确定顺序：后缀可以保持同样成本，却不能变小。因此多个同距点可以按任意顺序确定，不需要把零权专门排除。但若要返回所有最短路径，零权环可能使“路径”是否允许重复顶点影响结果规模，必须另下定义。本篇只恢复一条父链，严格改进规则避免围绕相等路线不断改父亲。"
        }
      ]
    },
    {
      "id": "heap",
      "title": "优先队列存候选快照，不偷偷修改旧键",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/shortest-paths/core.ts",
          "kind": "excerpt",
          "purpose": "完整内部二叉最小堆。条目包含顶点、距离快照与递增序号，距离相同按入队顺序稳定比较。snapshot只为观察复制。",
          "code": "type Entry={vertex:number;distance:number;sequence:number};\nclass Frontier{\n private data:Entry[]=[];private sequence=0;\n get size(){return this.data.length;}\n snapshot(){return this.data.map(x=>({...x}));}\n private before(a:Entry,b:Entry){return a.distance<b.distance||(a.distance===b.distance&&a.sequence<b.sequence);}\n push(vertex:number,distance:number){const e={vertex,distance,sequence:this.sequence++};this.data.push(e);let i=this.size-1;while(i){const p=Math.floor((i-1)/2);if(!this.before(this.data[i],this.data[p]))break;[this.data[i],this.data[p]]=[this.data[p],this.data[i]];i=p;}}\n pop(){if(!this.size)return undefined;const first=this.data[0],last=this.data.pop()!;if(this.size){this.data[0]=last;let i=0;for(;;){let smallest=i;const l=2*i+1,rr=l+1;if(l<this.size&&this.before(this.data[l],this.data[smallest]))smallest=l;if(rr<this.size&&this.before(this.data[rr],this.data[smallest]))smallest=rr;if(smallest===i)break;[this.data[i],this.data[smallest]]=[this.data[smallest],this.data[i]];i=smallest;}}return first;}\n}"
        },
        {
          "type": "paragraph",
          "text": "一种实现给每个顶点在堆里保留唯一条目，改进时decrease-key，需要维护顶点到槽位的位置映射。本文选择更容易核验的另一种方式：改进就推入一个新条目，旧条目仍在堆中。这样减少了索引同步逻辑，但堆可能含多个同顶点的距离快照，所以出队时必须和当前distance核对。"
        },
        {
          "type": "paragraph",
          "text": "默认样例会留下(一,十)和(三,九)。当它们终于出队时，当前距离已分别为二和三，这两项只是过期候选，直接跳过，不再次扫描出边。若把旧条目的距离写回distance，或者仍用它展开，就会把已经获得的更好结果覆盖或制造无用工作。条目的顶点相同，不表示它们是同一次有效估计。"
        },
        {
          "type": "paragraph",
          "text": "不要把堆内部数组误认为全体候选已经排序。它只保证根最小，其他槽位满足父子约束。视图显示内部数组用于核对结构，不能从第二个槽位推断全局第二小。条目距离相同按sequence稳定选择，只为了演示可重放；最短距离正确性不要求在多个同距点之间使用某一个固定顺序。"
        },
        {
          "type": "paragraph",
          "text": "重复条目是一种用空间换实现简单的策略，不能只看到代码少就认为没有代价。在大量边反复改善同一点时，旧候选会暂存到出队才释放；如果应用图极大，唯一条目加位置索引可能更合适。两者应共享最小候选确定的证明，但维护一致性、容量与测试重点不同。"
        }
      ]
    },
    {
      "id": "implementation",
      "title": "完整确定、松弛与过期判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/shortest-paths/core.ts",
          "kind": "excerpt",
          "purpose": "完整Dijkstra。出队先确认距离快照与未确定状态，再确定并扫描每条出边；严格改进时更新parent并入堆。",
          "code": "export type PathEvent={action:string;vertex:number;distance:number[];settled:boolean[];frontier:{vertex:number;distance:number}[]};\nexport function dijkstra(g:WeightedGraph,start:number,observe?:(e:PathEvent)=>void){\n validateWeighted(g);if(!Number.isInteger(start)||start<0||start>=g.length)throw new RangeError('invalid source');\n const distance=new Array<number>(g.length).fill(Infinity),parent=new Array<number>(g.length).fill(-1),settled=new Array<boolean>(g.length).fill(false),q=new Frontier();let pushes=1,stale=0,relaxations=0;\n distance[start]=0;q.push(start,0);\n const notify=(action:string,v:number)=>{if(observe)observe({action,vertex:v,distance:[...distance],settled:[...settled],frontier:q.snapshot()});};\n while(q.size){const e=q.pop()!;\n  if(e.distance!==distance[e.vertex]||settled[e.vertex]){stale++;notify('discard stale',e.vertex);continue;}\n  const v=e.vertex;settled[v]=true;notify('settle',v);\n  for(const [w,weight] of g[v]){relaxations++;const candidate=distance[v]+weight;if(candidate<distance[w]){distance[w]=candidate;parent[w]=v;q.push(w,candidate);pushes++;notify('relax '+v+'→'+w,w);}}\n }\n return {distance,parent,settled,stats:{pushes,stale,relaxations}};\n}"
        },
        {
          "type": "paragraph",
          "text": "settled与第一次发现是两个阶段。distance由Infinity变有限，表示已有一条路线；候选成为堆中最小且通过过期检查，才进入settled。每个可达顶点最多真正展开一次。计数relaxations是扫描的出边条数，pushes统计新候选，stale统计丢弃旧候选；它们描述实现工作，不是CPU指令数或数据库请求量。"
        },
        {
          "type": "paragraph",
          "text": "不可达点不会入堆，distance保持Infinity、settled为false。目标路径恢复前先检查不可达，再沿parent逆向回到源；坏父链中的越界和环会拒绝。返回某一条最优路线，不枚举所有最优路线。相同距离的其他前驱不更新parent，这是明确的单路径输出政策，而不是遗漏了另一条必须返回的结果。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/shortest-paths/core.ts",
          "kind": "excerpt",
          "purpose": "完整路径恢复与损坏链检查。不可达返回null；不把parent=-1误当已找到单点路径。",
          "code": "export function shortestPath(parent:readonly number[],distance:readonly number[],target:number){\n if(parent.length!==distance.length||!Number.isInteger(target)||target<0||target>=parent.length)throw new RangeError('invalid result/target');if(distance[target]===Infinity)return null;\n const out:number[]=[],seen=new Set<number>();for(let v=target;v!==-1;v=parent[v]){if(!Number.isInteger(v)||v<0||v>=parent.length||seen.has(v))throw new RangeError('invalid parent chain');seen.add(v);out.push(v);}return out.reverse();\n}"
        },
        {
          "type": "paragraph",
          "text": "路径查找本身没有认证含义。若顶点表示租户内资源，必须在构图前确定哪些边可访问，或在业务边界重新校验权限；算法只回答给定图上的成本。现实导航还可能有时间依赖、禁行和费用多目标，不应把一个数值最短结果直接叫作对所有业务约束都最优。"
        },
        {
          "type": "paragraph",
          "text": "我们在取出最小候选时通知settle事件，再逐条通知relax，因此某个settle快照可能还没包含它带来的新候选。这是精确的观察时机，不是丢了边。读轨迹时应该连着看后续松弛事件；把所有事件都误认为“该轮已完全结束”会让读者以为堆暂时为空就代表算法结束。"
        }
      ]
    },
    {
      "id": "cost",
      "title": "重复候选改变了空间界和堆操作上界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "每次成功松弛至少对应一次边扫描，所以新候选最多E加一。每条可达出边只扫描一次，但堆的条目数可达O(E)，不能把本实现的辅助空间写成只有O(V)。距离、父链与确定状态占O(V)，重复候选占O(E)，输入图另占O(V+E)。"
        },
        {
          "type": "paragraph",
          "text": "因此在常数成本模型下，时间可写为O(V+E+(E+1)log(E+2))，简写为O(V+E log(E+2))，额外空间O(V+E)。对于通常无大量平行边的简单图，可用E与V的关系化简对数项；本文允许多重边，保留按实际堆条目规模的表达更准确。不能把唯一条目decrease-key版本的界直接复制过来。"
        },
        {
          "type": "paragraph",
          "text": "小图或非常稠密图中，每轮线性选择最小点的O(V²+E)实现可能更简单，常数与存储访问也有不同取舍。二叉堆不是让所有规模都自动最快的标签。这里用500组随机图对照独立松弛参照来核验正确性，而不是拿一次计时宣布任何图都应使用同一个实现。"
        },
        {
          "type": "paragraph",
          "text": "直接按顶点编号遍历并做一次松弛不是Dijkstra。它可能在更好路线出现前就走过某个节点的出边，之后虽然距离变小，影响却没有传播到更远节点。优先队列的作用不是替for循环装饰一个数据结构，而是维护“下一次展开谁”的选择条件；测试默认图专门让较晚发现的路线更便宜来暴露这种错误。"
        }
      ]
    },
    {
      "id": "bfs",
      "title": "回到BFS：一致的输入条件应得到一致结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/shortest-paths/core.ts",
          "kind": "excerpt",
          "purpose": "仅接受单位权重的完整BFS对照。它明确拒绝非单位权重，避免把边数距离误当总代价。",
          "code": "export function unitWeightBfs(g:WeightedGraph,start:number){\n validateWeighted(g);for(const list of g)for(const [,weight]of list)if(weight!==1)throw new RangeError('BFS distance requires unit weights');if(!Number.isInteger(start)||start<0||start>=g.length)throw new RangeError('invalid source');\n const distance=new Array<number>(g.length).fill(Infinity),queue=[start];distance[start]=0;for(let h=0;h<queue.length;h++){const v=queue[h];for(const [w]of g[v])if(distance[w]===Infinity){distance[w]=distance[v]+1;queue.push(w);}}return distance;\n}"
        },
        {
          "type": "paragraph",
          "text": "当所有权重为一时，FIFO队列按距离层推进，等价于一种不需要通用堆的优先策略。测试在200组单位权图中核对BFS与Dijkstra的全距离一致。这个对照帮助确认两篇文章的概念衔接：不是BFS“过时”，而是更一般的权重需要更一般的前沿选择。"
        },
        {
          "type": "paragraph",
          "text": "权重都为零或一时还有专门的双端队列方法；DAG即使带负权，也可以利用拓扑序做一次松弛。这些选择都来自额外输入结构，而不是看算法名字哪个更高级。先确认负权、环和规模，再选要付出的状态和复杂度，通常比背一个“最短路径万能模板”更可靠。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行时看距离如何改变，测试时用独立参照",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "shortest-paths",
          "title": "逐步观察候选、确定与过期",
          "description": "默认得到[0,2,1,3]和路线0→2→1→3。下一步区分settle、relax和discard stale；负权输入直接报错。"
        },
        {
          "type": "paragraph",
          "text": "下载后执行npm ci --ignore-scripts、npm test，10项CPU与TypeScript检查实际通过。500组随机非负图与独立Bellman-Ford式松弛参照比较；路径逐边核对存在并累加成本；另测零环、自环、平行边、不可达、坏端点、三千高权长链、确定距离非递减以及快照不能干扰算法。"
        },
        {
          "type": "paragraph",
          "text": "观察回调会复制距离、settled和堆快照，全部轨迹可远大于基础算法存储，所以视图最多十二顶点、每行二十四边。2026-10-24在macOS14.5、Node22.12.0完成清洁运行；真实浏览器与手机由集成另验，不用CPU测试替代。接下来把“状态在何时足够、何时能复用”推广到搜索问题，就进入动态规划。"
        },
        {
          "type": "paragraph",
          "text": "路径成本测试使用独立参照距离，而不只是拿结果数组与自己算出的parent互相验证。两个输出可能同时由同一个错误逻辑产生，彼此一致仍然错误。随机图的全距离对拍、具体路径的边存在和权重之和、确定距离的单调性分别守住不同层面；这些证据合起来，才比一条默认路线截图更可靠。"
        }
      ]
    }
  ]
};
export default article;
