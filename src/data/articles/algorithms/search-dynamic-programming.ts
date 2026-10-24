import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "search-dynamic-programming",
  "topic": "algorithms",
  "title": "搜索与动态规划：回溯、记忆化和状态转移",
  "description": "用同一个0/1背包问题逐步建立选择树、充分状态、记忆化与自底向上表，验证路径恢复和一维更新次序，并说明伪多项式与搜索预算。",
  "minutes": 55,
  "tags": [
    "回溯",
    "记忆化",
    "动态规划",
    "0/1背包",
    "伪多项式"
  ],
  "scope": "用同一个0/1背包问题逐步建立选择树、充分状态、记忆化与自底向上表，验证路径恢复和一维更新次序，并说明伪多项式与搜索预算。 TypeScript 5.7.3 / React 18.3.1 / Node.js 22.12.0；教学算法与快照轨迹额外成本分开，不以运行耗时证明复杂度。",
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
      "path": "search-dynamic-programming.zip"
    },
    {
      "label": "安装、操作与验证说明",
      "path": "search-dynamic-programming/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "MIT6.006 Fall2011：背包与伪多项式时间",
      "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-21-dp-iii-parenthesization-edit-distance-knapsack/"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "搜索先枚举选择，动态规划再复用同样的未来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "搜索通过尝试合法选择来寻找答案，回溯则在完成一个分支后撤销临时选择，继续探索其他分支。动态规划解决其中一种可复用结构：不同选择历史到达同一个状态后，未来子问题完全相同，可以只求一次再重复使用。它不是在任意递归外面加缓存，就自动得到正确且快速的算法。"
        },
        {
          "type": "paragraph",
          "text": "这里用0/1背包贯穿：每件物品有重量、价值和唯一ID，最多选一次，总重量不超过容量，目标是总价值最大。不要求正好装满，不允许无限拿同一件，也不在本篇加入颜色配额、物品依赖或相邻限制。问题约束先固定，后面的状态和转移才有明确含义。"
        },
        {
          "type": "paragraph",
          "text": "默认四件为A重量二价值三，B三/四，C四/五，D二/三，容量六。最优价值八，例如A加C或C加D；并非九。这个小例没有明显重复非终止状态，记忆化未必出现命中。我们另外提供六件都为一/一、容量三的重复子问题预设，让你确实看到缓存复用，而不假装任何递归加Map都会在默认输入上立刻减少调用。"
        }
      ]
    },
    {
      "id": "input",
      "title": "把可解范围与教学预算写在接口前",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/search-dynamic-programming/core.ts",
          "kind": "excerpt",
          "purpose": "完整输入检查：正整数重量、非负有界整数价值、唯一ID、容量0..2000与最多200件。各搜索版本另有深度或调用预算。",
          "code": "export type Item={id:string;weight:number;value:number};\nexport function validateItems(items:readonly Item[],capacity:number){\n if(!Number.isInteger(capacity)||capacity<0||capacity>2000||items.length>200)throw new RangeError('capacity 0..2000, at most 200 items');const ids=new Set<string>();\n for(let i=0;i<items.length;i++){const x=items[i];if(!Object.hasOwn(items,i)||!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||!Number.isInteger(x.weight)||x.weight<1||x.weight>2000||!Number.isSafeInteger(x.value)||x.value<0||x.value>1_000_000)throw new RangeError('unique IDs, positive weights and bounded values required');ids.add(x.id);}\n}"
        },
        {
          "type": "paragraph",
          "text": "零容量、空物品和没有任何一件能装下都是合法输入，最大值零、选择为空。物品重量必须正整数，价值允许零，最多一百万；最多二百件使价值总和仍安全。拒绝重复ID是为了让重建的选项可定位，不是说两件物品不能恰好有同样重量与价值，它们可以有不同身份。"
        },
        {
          "type": "paragraph",
          "text": "容量按整数数值上界两千限制，避免读者粘贴十亿后立即申请巨表。回溯和无缓存搜索最多二十件，递归深度版本最多一百件；所有搜索还限制二十五万次调用，超出时明确错误。输入在数学上有答案，不代表教学进程应该无限继续。自底向上表最多二百乘两千的规模，与递归版本预算是不同选择。"
        }
      ]
    },
    {
      "id": "backtracking",
      "title": "先写出完整选择树，知道漏掉什么才谈优化",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "到第i件时，第一分支不选它，第二分支在重量允许时选择它。两条分支都进入i加一，直到所有物品处理完，再比较当前价值与最优。这样每个合法子集对应一条明确路径，不会漏掉“当前看起来不划算但与后面组合更好”的情况。局部价值重量比最高不一定给出0/1背包全局最优。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/search-dynamic-programming/core.ts",
          "kind": "excerpt",
          "purpose": "完整路径回溯。path只存本次分支选择，push后用finally配对pop；记录最优与观察叶子时复制，避免之后撤销改坏历史。",
          "code": "export type SearchEvent={i:number;remaining:number;value:number;action:string;path?:string[]};\nexport function backtrackKnapsack(items:readonly Item[],capacity:number,observe?:(e:SearchEvent)=>void){\n validateItems(items,capacity);if(items.length>20)throw new RangeError('backtracking demo at most 20 items');const path:string[]=[],best:{value:number;ids:string[]}={value:0,ids:[]};let calls=0;\n function visit(i:number,remaining:number,value:number){if(++calls>250000)throw new RangeError('search call budget exceeded');if(i===items.length){if(value>best.value){best.value=value;best.ids=[...path];}observe?.({i,remaining,value,action:'leaf',path:[...path]});return;}\n  visit(i+1,remaining,value);const item=items[i];if(item.weight<=remaining){path.push(item.id);try{visit(i+1,remaining-item.weight,value+item.value);}finally{path.pop();}}\n }\n visit(0,capacity,0);return {...best,calls};\n}"
        },
        {
          "type": "paragraph",
          "text": "path是共享的临时工作区，不能把best.ids直接指向它。否则下一分支pop或push会顺便改写已经记录的答案。每次改进时复制当前路径，观察事件也发送快照。这里的finally保证异常向上传播时撤销当前选择，但错误后没有继续假装返回部分最优；调用预算耗尽意味着本次搜索未完整完成。"
        },
        {
          "type": "paragraph",
          "text": "最坏每层有两种选择，选择树节点数量指数增长。无观察且只计算值的递归为指数级调用；本回溯在改进最优时复制最多n项路径，保守最坏时间可到O(n·2^n)，工作路径和最优路径各O(n)。开启每个叶子轨迹还会增加输出成本，不能把路径复制当成免费常数。"
        },
        {
          "type": "paragraph",
          "text": "这个回溯不是剪枝优化版。它只在重量放不下时拒绝选择，没有使用剩余价值上界来提前砍掉不可能更优的分支。若加入分支限界，上界必须永远不低估该分支可能的最优价值；过低的估计会把真最优剪掉。性能优化先要求安全性证明，与下一篇贪心的“安全删除候选”是同一种责任。"
        }
      ]
    },
    {
      "id": "state",
      "title": "状态为什么是i和剩余容量，不能只记当前分数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "定义f(i,c)为只考虑第i件及后续物品、剩余容量c时，还能增加的最大价值。它不包含过去已经获得的价值。因此两个历史即使累计分数不同，只要来到同一个i、剩余容量同为c，未来可选集合和空间就一样，f可以复用。若缓存里存的是从起点累计总分，却仍用i/c作键，就会把不同历史错误合并。"
        },
        {
          "type": "figure",
          "src": "figures/search-dynamic-programming/states.svg",
          "title": "历史不同，未来条件相同才允许复用",
          "alt": "缓存返回未来增量，不把过去累计价值揉进去；若加入颜色等限制，需要把影响未来的信息纳入状态。",
          "caption": "缓存返回未来增量，不把过去累计价值揉进去；若加入颜色等限制，需要把影响未来的信息纳入状态。"
        },
        {
          "type": "paragraph",
          "text": "状态只用c不够，因为处理到哪一件决定哪些物品还可以选；只用i也不够，因为剩余容量决定哪些分支合法。相反，把完整已选ID列表也放进键，虽然常能避免错误，却可能让几乎每段历史都独一无二，失去复用。好的状态不是尽量短，而是在足够描述未来的前提下去掉无关历史。"
        },
        {
          "type": "paragraph",
          "text": "假如新增“同色最多一件”，i/c就不充分了：相同i/c但此前选过颜色不同，会改变后面合法物品。此时必须增加颜色状态或换一种算法，不能继续沿用旧缓存键并期待测试帮你蒙混过去。状态正确性是动态规划的核心，Map只是保存已经证明等价的子问题。"
        },
        {
          "type": "paragraph",
          "text": "有时会问，既然剩余容量已经表示用了多少重量，是否能去掉i？不能，因为两个不同位置即使容量相同，尚未处理的物品也不同。只缓存c相当于让后缀三件与后缀一件共用结果。小输入上可能恰巧没错，但只需让被跳过的那件价值很高，就能得到稳定反例。"
        }
      ]
    },
    {
      "id": "memo",
      "title": "从分支得到递推，再把重复状态存起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "不选当前件得到f(i+1,c)。若装得下，选择得到value[i]+f(i+1,c-weight[i])，二者取最大；i等于n时没有剩余物品，返回零。每条依赖都让i增大，因此不会回到当前状态，不需要递归处理一个尚未完成的自身值。若状态依赖有环，就不能随意使用相同的记忆化写法。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/search-dynamic-programming/core.ts",
          "kind": "excerpt",
          "purpose": "完整普通/记忆化递归。缓存仅属于一次调用，状态键为i:c，只有计算完成后存值；has避免把合法0错当未命中。",
          "code": "export function topDownKnapsack(items:readonly Item[],capacity:number,memoized=true,observe?:(e:SearchEvent)=>void){\n validateItems(items,capacity);if(items.length>100)throw new RangeError('top-down depth budget 100 items');if(!memoized&&items.length>20)throw new RangeError('plain recursion demo at most 20 items');const memo=new Map<string,number>();let calls=0,hits=0,computed=0;\n function value(i:number,c:number):number{if(++calls>250000)throw new RangeError('search call budget exceeded');if(i===items.length)return 0;const key=i+':'+c;if(memoized&&memo.has(key)){hits++;const answer=memo.get(key)!;observe?.({i,remaining:c,value:answer,action:'memo hit'});return answer;}\n  const item=items[i],skip=value(i+1,c),take=item.weight<=c?item.value+value(i+1,c-item.weight):-Infinity,answer=Math.max(skip,take);computed++;if(memoized)memo.set(key,answer);observe?.({i,remaining:c,value:answer,action:'computed'});return answer;\n }\n return {value:value(0,capacity),calls,hits,computed,states:memo.size};\n}"
        },
        {
          "type": "paragraph",
          "text": "六件一/一、容量三的实际结果为三。无缓存递归调用九十八次、计算五十六个非终止节点；记忆化调用三十四次、九次命中、计算并存十八个状态。这是固定输入上的精确调用计数，不是速度倍数，更不保证所有输入都有这些常数。默认四件例两者都调用二十三次、命中零，正好说明复用程度取决于状态重叠。"
        },
        {
          "type": "paragraph",
          "text": "缓存放在函数内部，每次输入重新创建。若把Map放模块全局却不把物品内容纳入键，不同请求都访问f(0,6)，可能读出上一次问题的答案。状态键足够的前提还包含这次物品集合固定不变。测试连续求不同问题，确认没有跨调用缓存污染。"
        },
        {
          "type": "paragraph",
          "text": "状态最多n乘(C+1)，每个状态只展开有限分支，按常数数值操作计算时间O(nC)、存值O(nC)，递归深度O(n)。实现另有二十五万调用预算，所以即便在输入大小范围内，密集状态搜索仍可能主动停止；需要稳定覆盖整个允许表规模时，可直接用下面的迭代表，不把预算错误伪装成最优值零。"
        },
        {
          "type": "paragraph",
          "text": "缓存的查询还要区分不存在和答案为零。本实现用memo.has，再读取值；若写成if(memo.get(key))，合法零值会被当作未命中，结果或许仍对，却失去“每状态算一次”的成本保证。全零价值或所有剩余物品都装不下，是验证这类错误的简单输入。"
        }
      ]
    },
    {
      "id": "table",
      "title": "自底向上：先计算依赖，再计算使用它的状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "为了让行更好读，表采用另一种等价定义：dp[i][c]是前i件、容量不超过c的最大价值。第零行全零；第i行从第i减一行转移，仍是不选或选当前件两种情况。它和前面的后缀f方向不同，但解决同一个完整问题。不要把前缀公式和后缀循环方向拼在一起。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/search-dynamic-programming/core.ts",
          "kind": "excerpt",
          "purpose": "完整二维表与选中ID恢复。选择分支只读上一行；回溯遇到相等值时优先不选，返回其中一种最优组合。",
          "code": "export function tableKnapsack(items:readonly Item[],capacity:number){\n validateItems(items,capacity);const table=Array.from({length:items.length+1},()=>new Array<number>(capacity+1).fill(0));\n for(let i=1;i<=items.length;i++){const item=items[i-1];for(let c=0;c<=capacity;c++){table[i][c]=table[i-1][c];if(item.weight<=c)table[i][c]=Math.max(table[i][c],item.value+table[i-1][c-item.weight]);}}\n const ids:string[]=[];let c=capacity;for(let i=items.length;i>0;i--)if(table[i][c]!==table[i-1][c]){const item=items[i-1];ids.push(item.id);c-=item.weight;}\n return {value:table[items.length][capacity],ids:ids.reverse(),table};\n}"
        },
        {
          "type": "paragraph",
          "text": "为什么表先初始化零而不是负无穷？因为题目允许不装满，空集合始终可行，任何容量上界都有至少零价值。如果改成必须精确装满，只有容量零的起始状态可行，其他状态应有不可达标记，转移时也要传播不可达。初始值表达的是问题条件，不是为了让数组好分配随便填一个数字。"
        },
        {
          "type": "paragraph",
          "text": "恢复答案从最后一行、目标容量往回走。如果当前值与上一行一样，可以选择不拿这件；否则当前最优需要它，记录ID并减去重量，再继续上一行。每次最多选一件且行数下降，所以不会重复选择。多个最优集合存在时，返回一种就足够；测试核对选中重量、价值和ID唯一，不强迫不同正确实现返回同一组。"
        },
        {
          "type": "paragraph",
          "text": "表完整保存(n+1)乘(C+1)状态，时间空间均O(nC)，重建额外O(n)。视图里可以观察容量增加时最优值不会下降，加入更多可选物品也不会让最优值变差。这些是本问题非负价值与可不选的推论；若换成精确选择数量或有惩罚的模型，不能把单调关系当万能规律。"
        }
      ]
    },
    {
      "id": "compact",
      "title": "一维压缩必须守住上一行，而不是只删数组维度",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/search-dynamic-programming/core.ts",
          "kind": "excerpt",
          "purpose": "完整一维最优值版本。容量逆向扫描，确保读取的较小容量仍属于上一轮，不恢复选择IDs。",
          "code": "export function compactKnapsack(items:readonly Item[],capacity:number){\n validateItems(items,capacity);const best=new Array<number>(capacity+1).fill(0);for(const item of items)for(let c=capacity;c>=item.weight;c--)best[c]=Math.max(best[c],item.value+best[c-item.weight]);return best[capacity];\n}"
        },
        {
          "type": "figure",
          "src": "figures/search-dynamic-programming/table.svg",
          "title": "下降扫描保护0/1，升序会重复拿当前物品",
          "alt": "单件重量2价值3、容量4：正确结果3，升序错误结果6。用具体数值检查依赖版本。",
          "caption": "单件重量2价值3、容量4：正确结果3，升序错误结果6。用具体数值检查依赖版本。"
        },
        {
          "type": "paragraph",
          "text": "二维转移只读上一行。压缩后，如果容量从大往小更新，c-weight比c小，还没被本件更新，因此仍是上一行；如果从小往大，较小容量可能刚刚拿过本件，再读取就相当于同一件重复使用。单件二/三、容量四的错误结果六，就是这个依赖版本混乱的直接证据。"
        },
        {
          "type": "paragraph",
          "text": "一维值表只保留O(C)空间，但本文不再恢复选中ID。若强行只凭最后一行的数字追溯，很容易把不同时刻的状态拼成不存在的选择。想保留重建能力，需要额外决策信息、重新计算或采用其他可证明方案；空间减少与输出能力之间的取舍应明确告诉调用方。"
        },
        {
          "type": "paragraph",
          "text": "一维压缩也不意味着可以任意交换物品与容量两层循环。外层逐件、内层降序保留的是每件最多一次；如果改成容量外层再枚举物品，状态依赖和重复选择含义都可能改变。记住循环顺序背后的“读取哪一版状态”，比记住某个题型固定写降序更有迁移价值。"
        }
      ]
    },
    {
      "id": "bounds",
      "title": "伪多项式、搜索预算与换模型的时机",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "O(nC)中的C是容量数值，而输入二进制编码C只需要约log₂C位。容量从一千变十亿，编码只是多几位，表格却增长百万倍，因此这称伪多项式时间，不能只说“动态规划总是多项式所以很快”。大容量、小物品数可能适合折半搜索；价值总和较小还可以考虑按价值建状态。"
        },
        {
          "type": "paragraph",
          "text": "更一般的背包可能需要近似、分支限界或优化求解器，选择依赖规模、精确性与预算。回溯与DP没有谁永远替代谁：当未来状态几乎不重叠，缓存只增加存储；当约束无法压缩成可管理状态，记忆化也可能仍然指数。先估算状态空间，再决定用哪一种演算法，才是本篇要训练的能力。"
        }
      ]
    },
    {
      "id": "run",
      "title": "同题不同实现，用差分结果与状态检查互相约束",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "search-dynamic-programming",
          "title": "观察路径、记忆化命中与二维表",
          "description": "默认容量6结果8；重复子问题预设六件一/一、容量3，普通98调用、记忆化34调用/9命中。可切换回溯、普通递归和记忆化。"
        },
        {
          "type": "paragraph",
          "text": "清洁安装后npm test实际通过11项。四百组小问题与独立位掩码子集枚举比较所有实现；逐个表格状态与对应前缀枚举核对；重建ID检查容量和值；非法重量、重复ID、空输入、预算失败与跨调用缓存也覆盖。首轮测试曾揭示默认例预期九的笔算错误，修正为八后重跑通过，未把失败断言偷偷当成算法正确证明。"
        },
        {
          "type": "paragraph",
          "text": "轨迹保存叶子路径或每次状态事件，额外成本按事件数和快照大小计算。视图最多十二件、容量三十，不把完整历史当基础O(C)空间。2026-10-24在macOS14.5、Node22.12.0完成TypeScript与CPU实测；浏览器/手机由集成另验。下一篇将看到：只有能证明当前选择可安全固定，才可以进一步把分支减少成贪心。"
        }
      ]
    }
  ]
};
export default article;
