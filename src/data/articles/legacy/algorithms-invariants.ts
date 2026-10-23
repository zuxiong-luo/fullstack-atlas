import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "algorithms-invariants",
  "topic": "algorithms",
  "title": "算法怎样推导：二分边界、窗口、BFS与动态规划",
  "description": "先写约束和朴素解，再用不变量解释区间、窗口、访问状态与DP；交付完整代码、lower_bound交互步进和确定种子差分测试。",
  "minutes": 45,
  "tags": [
    "算法",
    "二分",
    "BFS",
    "动态规划",
    "复杂度"
  ],
  "scope": "四个明确问题：非递减有限数值数组的lower_bound、按Unicode码点的最长无重复子串、无权邻接Map的BFS、正面额可重复使用的最少硬币。交互步进只覆盖二分，不承诺所有算法可视化。",
  "prerequisites": [
    "数组、Map、循环与函数",
    "理解索引与基础递推，不需预先背算法模板"
  ],
  "sections": [
    {
      "id": "s11-300677",
      "title": "算法是输入到输出的规则，先把承诺写清楚",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "算法是一套从输入得到输出的有限步骤。理解一个算法，需要同时回答它在什么条件下正确、循环中保留什么事实、何时结束，以及资源成本随输入怎样增长。代码能跑出一个样例只是起点；如果条件或边界没说清，相同几行代码换个输入就可能失去意义。"
        },
        {
          "type": "paragraph",
          "text": "本文用四个小问题学习同一种推导方法。主线是lower_bound：在非递减数组里找到第一个大于等于target的位置；然后把“不变量”迁移到无重复窗口、无权BFS与硬币DP。四套实现全部给出，二分另有可操作步进。你不需要跳去实验室补关键代码。"
        },
        {
          "type": "table",
          "headers": [
            "问题",
            "约束",
            "输出"
          ],
          "rows": [
            [
              "lower_bound",
              "数组有序、允许重复，值和target有限",
              "最左的>=位置；没有则返回n"
            ],
            [
              "无重复子串",
              "字符串按Unicode码点而非视觉字素簇计数",
              "最长连续无重复区间的码点长度"
            ],
            [
              "BFS",
              "有限无权有向邻接Map，起点存在",
              "可达节点最少边数、父节点与入队顺序"
            ],
            [
              "最少硬币",
              "正整数面额可无限用，金额0到10000",
              "最少枚数；不可达返回-1"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "朴素解不是应该跳过的步骤。lower_bound从左扫描遇到第一个>=就返回，O(n)；最长子串可从每个起点扩张并用Set找重复，最坏O(n²)；BFS的问题若靠枚举所有路径会在环里重复；硬币若枚举每次选择会重复求同一剩余金额。改进算法需要指出具体重复了什么或怎样排除候选，而不是先宣布“用模板”。"
        }
      ]
    },
    {
      "id": "s14-350134",
      "title": "二分：保持区间含义，才知道每次该排除谁",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "朴素扫描正确，是因为有序数组中最先满足条件的位置就是答案。二分利用更强的事实：中间值若小于target，左侧所有值也小于target，可以整段排除；中间值若大于等于target，中间位置仍可能是最左答案，应该保留它作为右侧边界。"
        },
        {
          "type": "paragraph",
          "text": "我们约定待判断区间是[lo,hi)，保持两个不变量：索引<lo的值都小于target；索引>=hi的值都大于等于target。初始化lo=0、hi=n，两侧为空所以成立；退出时lo=hi，中间没有待判断项，两侧条件刚好把答案确定在lo。n可以作为答案，表示在末尾插入，不是一个可读取的元素索引。"
        },
        {
          "type": "code",
          "code": "import React, {useMemo, useState} from 'react';\n// Fast search assumes finite, nondecreasing inputs. Validation belongs to the boundary.\nexport function validateSorted(values: number[], target: number) {\n  if (!Number.isFinite(target) || values.some(v => !Number.isFinite(v))) throw new Error('只接受有限数值');\n  if (values.some((v,i) => i > 0 && values[i-1] > v)) throw new Error('二分前提：数组必须非递减有序');\n}\nexport function linearLowerBound(values: number[], target: number): number {\n  const index = values.findIndex(value => value >= target);\n  return index === -1 ? values.length : index;\n}\nexport function lowerBound(values: number[], target: number): number {\n  let lo=0, hi=values.length;\n  while (lo<hi) {\n    const mid=lo+Math.floor((hi-lo)/2);\n    if (values[mid]<target) lo=mid+1;\n    else hi=mid;\n  }\n  return lo;\n}\nexport type Step={lo:number;hi:number;mid:number|null;note:string};\nexport function traceLowerBound(values:number[], target:number):Step[] {\n  validateSorted(values,target);\n  let lo=0,hi=values.length;\n  const steps:Step[]=[];\n  while(lo<hi) {\n    const mid=lo+Math.floor((hi-lo)/2);\n    steps.push({lo,hi,mid,note:values[mid]<target?`${values[mid]} < ${target}：下一步 lo=${mid+1}`:`${values[mid]} ≥ ${target}：下一步 hi=${mid}`});\n    if(values[mid]<target) lo=mid+1; else hi=mid;\n  }\n  steps.push({lo,hi,mid:null,note:`区间为空，插入位置=${lo}`});\n  return steps;\n}",
          "filename": "App.tsx · 二分与轨迹",
          "purpose": "完整边界校验、朴素扫描、快速二分、Step结构与轨迹生成。轨迹用于教学，lowerBound本体不重复扫描验证。",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "figure",
          "src": "figures/algorithms-invariants/lower-bound.svg",
          "title": "数组[1,2,2,4]查找2的完整收缩",
          "alt": "区间依次[0,4)、[0,2)、[0,1)、[1,1)，mid依次2、1、0，最后返回1。lo左侧小于target，hi及右侧大于等于target。",
          "caption": "mid相等时hi=mid，保留更靠左的候选；橙边表示当前比较，灰色是已排除范围。"
        },
        {
          "type": "paragraph",
          "text": "具体代入：lo=0、hi=4，mid=2，values[2]=2，不小于目标，所以hi=2。接着mid=1仍相等，hi=1。再看mid=0，值1小于目标，lo=1。现在[1,1)为空，返回1。若相等就直接返回mid，第一次可能返回2，便违背了“第一个”这个题目承诺。"
        },
        {
          "type": "paragraph",
          "text": "每步都严格缩短hi-lo：小于时lo至少增1；否则mid<hi使hi减小。由此既证明终止，也解释了为何小于分支必须用mid+1。改成lo=mid，在[0,1)且值小于目标时会永远停在0。中点写lo+floor((hi-lo)/2)也避免把JavaScript位运算强制32位整数的行为引入本题。"
        },
        {
          "type": "paragraph",
          "text": "快速函数每步把候选区间缩小约一半，时间O(log n)、辅助空间O(1)。交互入口先做O(n)有序/有限校验，再保存O(log n)条轨迹，所以整个演示入口不是纯O(log n)。若每次查询前排序，还要加上排序成本；数组插入也可能移动O(n)元素，不能把“找位置快”理解为整个操作都快。"
        },
        {
          "type": "reference",
          "title": "边界语义核对：Python bisect_left的分区定义",
          "url": "https://docs.python.org/3.12/library/bisect.html#bisect.bisect_left"
        }
      ]
    },
    {
      "id": "s14-340944",
      "title": "窗口与DP：一个维护当前区间，一个复用已知子问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先看最长无重复连续子串。朴素做法从每个起点向右试，很多已读字符会被反复处理。优化时让右边界不断推进，同时保持[left,right]无重复。last记录每个字符最近出现的位置；若该位置在窗口内，就把left推到它后一位。left只前进，意味着已经排除的左边界不会再回来。"
        },
        {
          "type": "code",
          "code": "// Unicode code-point length, not UTF-16 code-unit or grapheme-cluster length.\nexport function longestUnique(text:string):number {\n  const chars=Array.from(text),last=new Map<string,number>();\n  let left=0,best=0;\n  for(let right=0;right<chars.length;right++) {\n    const prior=last.get(chars[right]);\n    if(prior!==undefined)left=Math.max(left,prior+1);\n    last.set(chars[right],right);\n    best=Math.max(best,right-left+1);\n  }\n  return best;\n}",
          "filename": "App.tsx · 无重复窗口",
          "purpose": "完整longestUnique。Array.from按Unicode码点拆分；它不是按组合字形/字素簇计数。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入abba：读到第一个a与b，窗口ab，长度2；第二个b的prior=1，left从0到2，窗口只剩b。最后a的prior=0早已在窗口左边，所以left=max(2,1)仍为2，窗口ba。若直接left=prior+1会退回1，使窗口bba含重复，却把长度算成3。Math.max保护的是不变量，不是一个可随意省略的小优化。"
        },
        {
          "type": "paragraph",
          "text": "n为码点数量，每个右边界推进一次，Map常规查写按均摊O(1)估算，时间O(n)。本实现Array.from额外存n个码点，last最多n项，所以辅助空间O(n)。Emoji可以是多个码点的视觉组合，本题输出按码点定义，不声称按用户感知字符计数。"
        },
        {
          "type": "paragraph",
          "text": "动态规划则换一个角度。凑金额6、面额[1,3,4]时，贪心先拿4得到4+1+1共3枚，但3+3只要2枚。令dp[sum]表示“恰好凑出sum的最少枚数”；若最后一枚是coin，前面必须能凑出sum-coin，所以候选是dp[sum-coin]+1。"
        },
        {
          "type": "code",
          "code": "export function minCoins(coins:number[],amount:number):number {\n  if(!Number.isSafeInteger(amount)||amount<0||amount>10000)throw new Error('金额需为0到10000整数');\n  if(coins.some(c=>!Number.isSafeInteger(c)||c<=0))throw new Error('面额需为正整数');\n  const dp=Array<number>(amount+1).fill(Infinity);dp[0]=0;\n  for(let sum=1;sum<=amount;sum++)for(const coin of coins) {\n    if(coin<=sum)dp[sum]=Math.min(dp[sum],dp[sum-coin]+1);\n  }\n  return Number.isFinite(dp[amount])?dp[amount]:-1;\n}",
          "filename": "App.tsx · 可重复面额的最少硬币",
          "purpose": "完整输入限制、初始状态、转移与不可达返回；面额为正才能让sum-coin严格小于sum。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "dp[0]=0是起点，不可达先设Infinity。按sum从1到amount推进，每个可用coin的前置状态都已处理，因此可以取最小值；允许反复使用面额，因为dp[sum-coin]本身可包含同一种coin。[2]凑3仍为Infinity，返回-1；空面额凑0返回0。面额0或负数会破坏递推依赖，所以边界直接拒绝。"
        },
        {
          "type": "paragraph",
          "text": "k种面额、金额A时，循环做A×k次候选检查，时间O(Ak)、辅助空间O(A)。它依赖金额这个数值规模，不能只按输入数字的位数称作高效；金额上限10000是本例明确的资源约束。若硬币只能用一次，就需要重新设计状态与循环顺序，不能把这份“无限使用”实现直接套过去。"
        }
      ]
    },
    {
      "id": "s13-272646",
      "title": "BFS：最短来自层次顺序，去重发生在入队",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在把不变量用于图。无权图中每条边成本都是1，BFS队列总是先处理较近层，再处理更远层。起点距离0；弹出距离d的节点时，尚未发现的邻居距离就是d+1。如果更短路径存在，它应来自更早的层，早已把该邻居发现，因此首次入队就能确定最少边数。"
        },
        {
          "type": "code",
          "code": "export function bfs(graph:Map<string,string[]>,start:string) {\n  if(!graph.has(start))throw new Error('起点不在图中');\n  const queue=[start],distance=new Map([[start,0]]),parent=new Map<string,string|null>([[start,null]]);\n  for(let head=0;head<queue.length;head++) {\n    const node=queue[head];\n    for(const next of graph.get(node)??[]) {\n      if(!graph.has(next))throw new Error('邻接点不在图中');\n      if(distance.has(next))continue;\n      distance.set(next,distance.get(node)!+1); // Mark on enqueue, not on dequeue.\n      parent.set(next,node); queue.push(next);\n    }\n  }\n  return {distance,parent,order:queue};\n}",
          "filename": "App.tsx · 无权图BFS",
          "purpose": "完整队列、距离、父节点与非法邻接处理。Map只核查从起点实际访问到的部分；不自动验证不可达分支。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "例图A→B、C，B→D，C→D。A出队，把B、C标记距离1再入队；处理B时发现D，标记2；处理C再遇D，distance.has(D)为真，不重复入队。parent[D]=B保留其中一条最短路径。若等到出队才标记，B和C都可能把D加入，重复边与环会放大队列。"
        },
        {
          "type": "paragraph",
          "text": "实现用head下标移动，不反复shift。每个可达节点最多入队一次，每条可达边检查一次，时间O(Vr+Er)，距离/父节点/队列辅助空间O(Vr)。Vr、Er指从起点可达的部分；不可达X不在distance里。遇到邻接表里不存在的可达目标直接抛错，让输入缺陷暴露。"
        },
        {
          "type": "paragraph",
          "text": "反例是不同边权：A→D成本10，A→B成本1，B→D成本1。按边数BFS可能先发现直达D，却不是成本最小的路径。这里的输入结构根本没有权重，题目只问最少边数；一旦换成最小权重，需要根据约束选择其他算法，不能继续沿用首次发现即最优的证明。"
        },
        {
          "type": "reference",
          "title": "BFS层次与最短路径依据：MIT 6.006 Lecture9",
          "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-9-breadth-first-search/"
        }
      ]
    },
    {
      "id": "interactive-step",
      "title": "把状态展示出来：完整二分步进组件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export default function App() {\n  const [input,setInput]=useState('1,2,2,4'),[target,setTarget]=useState('2'),[index,setIndex]=useState(0);\n  const result=useMemo(()=>{\n    try {\n      const values=input.trim()===''?[]:input.split(',').map(part=>{if(!part.trim())throw new Error('数值之间不要留空项');return Number(part);});\n      if(values.length>30)throw new Error('步进演示最多30项');\n      if(!target.trim())throw new Error('请输入目标值');\n      const numeric=Number(target);return {values,steps:traceLowerBound(values,numeric),error:''};\n    }catch(error){return {values:[] as number[],steps:[] as Step[],error:String(error)}}\n  },[input,target]);\n  const position=Math.min(index,Math.max(0,result.steps.length-1)),step=result.steps[position];\n  return <main style={{padding:20,fontFamily:'system-ui',maxWidth:900,margin:'auto',lineHeight:1.7}}>\n    <h2>lower_bound：区间一步一步缩小</h2>\n    <p>目标：找到第一个 ≥ target 的位置；返回长度n表示放在末尾。下方展示的是本轮判断之前的 [lo,hi)。</p>\n    <label>非递减数组 <input value={input} onChange={e=>{setInput(e.target.value);setIndex(0)}} style={{width:'min(100%,24rem)'}}/></label>{' '}\n    <label>target <input type=\"number\" value={target} onChange={e=>{setTarget(e.target.value);setIndex(0)}} style={{width:100}}/></label>\n    {result.error?<p role=\"alert\">{result.error}</p>:<>\n      <p><button disabled={position===0} onClick={()=>setIndex(n=>n-1)}>上一步</button>{' '}<button disabled={position>=result.steps.length-1} onClick={()=>setIndex(n=>n+1)}>下一步</button>{' '}<button onClick={()=>setIndex(0)}>重置</button></p>\n      <p role=\"status\">步骤{position+1}/{result.steps.length}；lo={step.lo}，hi={step.hi}，mid={step.mid??'结束'}；{step.note}</p>\n      <div style={{display:'flex',gap:8,overflowX:'auto',padding:8}}>{result.values.map((value,i)=><div key={i} style={{minWidth:65,padding:8,border:i===step.mid?'3px solid #b45b14':'1px solid #789183',background:i>=step.lo&&i<step.hi?'#dcece0':'#f0f0f0',color:'#173b2d'}}><strong>{value}</strong><br/>index {i}<br/>{i===step.mid?'mid':i<step.lo?'< target':i>=step.hi?'≥ target':'待判断'}</div>)}<div style={{minWidth:65,padding:8}}>末尾<br/>index {result.values.length}</div></div>\n      <p>区间内只是待判断，不代表全都等于target；lo左边已知小于，hi及右边已知大于等于。末尾标记不是数组元素。</p>\n    </>}\n    <p>其他完整算法在本文件导出：longestUnique('abba')={longestUnique('abba')}；minCoins([1,3,4],6)={minCoins([1,3,4],6)}。交互步进只负责二分，不伪装成通用可视化器。</p>\n  </main>;\n}",
          "filename": "App.tsx · 交互组件",
          "purpose": "接在前面的导出算法之后，与React import共同组成完整App.tsx。输入解析、错误、上一步/下一步、区间标签均在正文。",
          "language": "tsx",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "默认target=2，点击下一步观察lo/hi/mid按前文顺序改变。把数组留空会得到插入位置0；改成2,1应显示有序前提错误。改变数组或target会从第0步重新开始，避免拿旧轨迹位置读新输入。方块文字同时写待判断/<target/≥target，不只依赖颜色表达状态。"
        },
        {
          "type": "experiment",
          "id": "algorithms-invariants",
          "title": "二分区间交互步进",
          "description": "使用完整App.tsx查看当前区间、比较与结束位置；正文已包含全部算法和UI代码。"
        }
      ]
    },
    {
      "id": "s10-286076",
      "title": "验证不变量，而不是只验证几个答案",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/algorithms-invariants\nnpm ci\nnpm test\nnpm run build\nnpm run dev -- --port 4321 --strictPort",
          "filename": "终端",
          "purpose": "Node22.12.0、React18.3.1与锁定依赖。站内实验入口不影响下载项目独立运行。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "实际7项Node测试通过。二分除空、单项、重复、越界外，还用固定种子生成1000组小数组，与朴素扫描差分对照；每一条trace都断言左右分区成立、mid在区间里、下一步严格收缩、末步结果等于快速算法。这些检查既能发现错答案，也能指出错在何种状态转换。"
        },
        {
          "type": "paragraph",
          "text": "其他测试覆盖abba防止left回退、Unicode码点、BFS环/重复边/自环/不可达/非法邻接、DP贪心反例/不可达/零金额与非法面额。TypeScript与Vite生产构建通过。自动测试没有用小输入测一次耗时就证明复杂度，复杂度来自前面的操作次数推导；交互和手机布局另需真实浏览器验收。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "二分为什么相等时不直接返回？",
              "目标是最左>=，mid可能只是多个满足点之一，hi=mid继续保留左侧候选。"
            ],
            [
              "abba最后一个a为什么不能把left改成1？",
              "先前已把left推到2；旧a已离开窗口，回退会重新引入重复b。"
            ],
            [
              "BFS父节点可能有不同答案，是不是错了？",
              "同一节点可能有多条等长最短路径；邻接顺序影响选中哪条，最少边数仍正确。"
            ],
            [
              "DP得到2枚是否证明贪心总不行？",
              "只证明本例贪心策略不能普遍正确；具体面额系统可能有额外性质，须另证明。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "以后面对新题，可以按同一顺序问：输入和目标究竟是什么，朴素解重复了哪里，我保留的状态代表什么，每次更新后哪条事实仍成立，结束时这条事实如何推出答案。这样写出来的代码有可检查的理由，出错时也能定位到一个边界或状态，而不只剩下“模板记错了”。"
        }
      ]
    }
  ],
  "questionIds": [
    "algorithms-invariants-binary",
    "algorithms-invariants-bfs"
  ],
  "references": [
    {
      "title": "Python3.12 bisect边界定义",
      "url": "https://docs.python.org/3.12/library/bisect.html"
    },
    {
      "title": "MIT6.006 BFS",
      "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-9-breadth-first-search/"
    }
  ],
  "experiment": "react",
  "status": "review",
  "kind": "tutorial",
  "labMinutes": 30,
  "versions": [
    "TypeScript 5.7.2",
    "React / React DOM 18.3.1",
    "Node.js 22.12.0"
  ],
  "verifiedAt": "2026-10-23",
  "examples": [
    {
      "label": "算法实现、步进与测试",
      "path": "algorithms-invariants.zip"
    },
    {
      "label": "运行与复杂度边界",
      "path": "algorithms-invariants/README.md"
    }
  ]
};
export default article;
