import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "sliding-monotonic",
  "topic": "algorithms",
  "title": "滑动窗口与单调结构：怎样减少重复扫描",
  "description": "从区间有效性、候选支配与生命周期出发，推导正数最短窗口、固定窗口最大值与下一个严格更大元素；用不变量和差分测试说明何时能安全删除。",
  "minutes": 55,
  "tags": [
    "滑动窗口",
    "单调队列",
    "单调栈",
    "不变量",
    "摊还分析"
  ],
  "scope": "从区间有效性、候选支配与生命周期出发，推导正数最短窗口、固定窗口最大值与下一个严格更大元素；用不变量和差分测试说明何时能安全删除。 TypeScript 5.7.3 / React 18.3.1 / Node.js 22.12.0；教学算法与快照轨迹额外成本分开，不以运行耗时证明复杂度。",
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
      "path": "sliding-monotonic.zip"
    },
    {
      "label": "安装、操作与验证说明",
      "path": "sliding-monotonic/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Lemire：滑动最大最小值原始论文 v5",
      "url": "https://arxiv.org/abs/cs/0610046v5"
    },
    {
      "title": "Open Data Structures：队列与双端结构",
      "url": "https://opendatastructures.org/ods-java/3_1_SLList_Singly_Linked_Li.html"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "窗口与单调结构，分别在保存什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "滑动窗口用一对边界表示连续区间，并在边界移动时复用已有状态。比如右端多纳入一个数，区间和可以加上它，而不必重新扫描整个区间。“滑动”只是维护区间的方式，不能保证任意问题都能线性解决；真正关键的是，什么时候可以把左端永久向右移动，且不会漏掉更好的答案。"
        },
        {
          "type": "paragraph",
          "text": "单调结构保存的则是仍有竞争力的候选。最大值队列按值递减保存下标，较早且更小的候选可以被新候选淘汰；单调栈保存尚未等到答案的下标。它们不要求输入有序，也不需要把所有输入重新排序。删除一个候选必须有理由：已经离开范围，或者可以证明以后也不会再胜出。"
        },
        {
          "type": "paragraph",
          "text": "本文用一串按到达顺序记录的整数贯穿。我们先找正数序列中和达到目标的最短连续段，再对可含负数的序列找固定宽度最大值，最后找每项右边第一个严格更大的位置。三个问题都减少了重复扫描，但维护的状态、可删除条件和相等值策略不同，不能只背一段while后到处替换。"
        }
      ]
    },
    {
      "id": "model",
      "title": "先约定输入和区间，避免证明漂移",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "正文统一用从0开始的数组下标。循环中的窗口写成闭区间[left,right]，长度为right-left+1；返回最短答案时end是右开边界，便于直接slice(start,end)。没有答案时length=0、start=end=-1。这些约定看似琐碎，却决定了“移走一项后是否还有效”和结果能否直接使用。"
        },
        {
          "type": "paragraph",
          "text": "为了让整数求和和比较有明确含义，公共检查只接受稠密数组、绝对值不超过十亿的安全整数，最多一百万项；总和绝对值不超过10^15，仍在Number的安全整数范围内。正数窗口额外要求每项大于0。空洞、NaN、小数或越界数直接拒绝，而不是让它们悄悄破坏比较和单调性。输入检查是一次O(n)工作，与后面的查询循环分别说明。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/sliding-monotonic/core.ts",
          "kind": "excerpt",
          "purpose": "公共输入约束与观察事件类型。接下来的三个算法共享这个检查；观察回调可选，基础调用不保存快照。",
          "code": "export function numbers(a:readonly number[],positive=false){\n  if(a.length>1_000_000)throw new RangeError('at most one million values');\n  for(let i=0;i<a.length;i++)if(!Object.hasOwn(a,i)||!Number.isSafeInteger(a[i])||Math.abs(a[i])>1_000_000_000||(positive&&a[i]<=0))throw new RangeError('dense bounded integers required');\n}\nexport type WindowEvent={action:string;left:number;right:number;sum?:number;deque?:number[];best?:number;output?:number[]};\nexport type Observe=(event:WindowEvent)=>void;"
        },
        {
          "type": "table",
          "headers": [
            "问题",
            "朴素重复工作",
            "优化保留的状态"
          ],
          "rows": [
            [
              "最短正数达标区间",
              "枚举每个左端并继续累加，O(n²)",
              "left、sum、当前最优区间"
            ],
            [
              "宽度k最大值",
              "每个窗口扫描k项，O(nk)",
              "可能成为最大值的下标双端队列"
            ],
            [
              "右侧首个更大项",
              "每项向右找，最坏O(n²)",
              "还没找到答案的下标栈"
            ]
          ],
          "caption": "以下复杂度按整数操作为常数成本，不是某次计时结果。"
        }
      ]
    },
    {
      "id": "positive",
      "title": "正数窗口：为什么收缩之后无需回头",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "先看[2,3,1,2,4,3]、target=7。右端依次纳入2、3、1时还不达标，纳入下一个2后和为8，于是得到长度4。随后移走左边2，和变6，当前右端下再缩就更不可能达标，所以停下，继续扩张。后面右端走到最后，连续收缩最终保留[4,3]，最短长度为2。"
        },
        {
          "type": "paragraph",
          "text": "为什么刚才丢弃的左端不必再考虑？在固定右端下，左端越往右，正数和越小，因此达到目标的左端形成一个前缀。我们把其中所有仍达标的起点依次检查。某个起点已经得到以当前右端结束的达标区间后，未来右端更靠右只会使长度更长，不可能改善这个起点的最短答案，于是可以永久移走它。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/sliding-monotonic/core.ts",
          "kind": "excerpt",
          "purpose": "完整正数窗口实现。更新最优答案之后才减去左项，返回右开end。moves统计右端加入与左端移出，不是毫秒。",
          "code": "export function minPositiveWindow(a:readonly number[],target:number,observe?:Observe){\n  numbers(a,true);if(!Number.isSafeInteger(target)||target<=0)throw new RangeError('positive safe target required');\n  let left=0,sum=0,best=Infinity,start=-1,end=-1,moves=0;\n  for(let right=0;right<a.length;right++){\n    sum+=a[right];moves++;observe?.({action:'expand',left,right,sum,best});\n    while(sum>=target){\n      if(right-left+1<best){best=right-left+1;start=left;end=right+1;}\n      sum-=a[left++];moves++;observe?.({action:'shrink',left,right,sum,best});\n    }\n  }\n  return {length:best===Infinity?0:best,start,end,moves};\n}"
        },
        {
          "type": "paragraph",
          "text": "外层right走n次，内层left也只从0走到n，所有循环累计最多2n次边界移动。while嵌在for里不意味着一定O(n²)，关键是跨迭代有没有重复走回原来的位置。代码除返回结果与可选观察轨迹外只保留常数个标量；如果调用者打开快照收集，轨迹消耗要另算。"
        },
        {
          "type": "figure",
          "src": "figures/sliding-monotonic/boundaries.svg",
          "title": "正数前提与两个边界",
          "alt": "先固定输入、目标和下标；负数反例显示sum不再单调时，不能沿用同一收缩条件。",
          "caption": "先固定输入、目标和下标；负数反例显示sum不再单调时，不能沿用同一收缩条件。"
        },
        {
          "type": "paragraph",
          "text": "还可以反过来理解最短窗口的正确性：当右端来到某个位置时，我们把所有仍能达标的左端逐个检查，直到下一个左端已不达标。对这个右端而言，最后一次达标就是它的最短候选；对曾经移走的左端而言，未来更右的结尾只会更长。这两个方向合起来，才说明全局最短不会遗漏，单独一句“双指针不回头”只说明速度，没有说明答案正确。"
        },
        {
          "type": "paragraph",
          "text": "目标很大而始终无法达标时，左端一次也不移动，循环仍正常结束并返回无解标记。目标很小时，某一个右端可能触发多次收缩，看上去瞬间工作量很大，但它消耗的是此前尚未移出的项，不会在下个右端重新消耗。测试既检查结果区间的实际和，也检查全局长度与枚举答案一致，避免只验证某个答案确实可行而遗漏更短答案。"
        }
      ]
    },
    {
      "id": "counterexample",
      "title": "负数不是一个小边界，而是换掉了证明",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "把输入改成[1,-1,5]、target=5。盲套前一段逻辑，最后和为5，先记录长度3；移走1后和为4，while停止，结果错过了单独[5]。原因是再移走负数-1反而能让和增大。先前“无效以后继续缩也无效”的推导已经不成立，不能靠把if换成while或多写一次减法补救。"
        },
        {
          "type": "paragraph",
          "text": "本实现选择明确拒绝负数；这比静默返回看似合理的错误长度更有价值。若要处理带负数的最短和问题，可以从前缀和与可支配起点重新推导另一套单调双端队列，但那是新的不变量，不是本文正数算法的宽松模式。固定宽度最大值不做求和单调判断，所以接下来可以合法包含负数。"
        }
      ]
    },
    {
      "id": "deque",
      "title": "最大值队列：删除依据是过期或被支配",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "固定宽度k=3时，右端r对应窗口[r-k+1,r]。队列保存下标而非只保存值，因为过期取决于位置。先删掉队首小于左界的下标，再从队尾删掉值不大于新值的下标，最后加入r。队首就是当前最大值；窗口还没填满时只维护候选，不输出答案。"
        },
        {
          "type": "paragraph",
          "text": "队尾删除为什么安全？设旧下标i小于新下标r，且a[i]≤a[r]。将来凡是仍包含i的窗口，也会包含更晚到达的r；r的值不小，而且更晚过期，所以i不可能再成为我们需要的唯一最大值。相等时留下更新的r可以延长候选寿命。如果任务要求返回最早最大值的下标，就需要改等号策略，不能只说两种写法完全等价。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/sliding-monotonic/core.ts",
          "kind": "excerpt",
          "purpose": "完整环形双端队列实现。head/size避免Array.shift的搬移；容量k，先过期再淘汰再写入，保证槽位足够。",
          "code": "export function windowMax(a:readonly number[],k:number,observe?:Observe){\n  numbers(a);if(!Number.isInteger(k)||k<1||k>a.length)throw new RangeError('1 <= k <= length required');\n  const ring=new Array<number>(k),output:number[]=[];let head=0,size=0,pushes=0,removals=0;\n  const at=(i:number)=>ring[(head+i)%k];\n  const snapshot=()=>Array.from({length:size},(_,i)=>at(i));\n  for(let right=0;right<a.length;right++){\n    const left=right-k+1;\n    while(size&&at(0)<left){head=(head+1)%k;size--;removals++;}\n    while(size&&a[at(size-1)]<=a[right]){size--;removals++;}\n    ring[(head+size)%k]=right;size++;pushes++;\n    if(left>=0)output.push(a[at(0)]);\n    observe?.({action:left>=0?'emit':'fill',left:Math.max(0,left),right,deque:snapshot(),output:[...output]});\n  }\n  return {output,pushes,removals};\n}"
        },
        {
          "type": "figure",
          "src": "figures/sliding-monotonic/dominance.svg",
          "title": "一次移动中有两种不同的删除",
          "alt": "输入与每个下标在图中固定。先删除离开窗口的项，再删除仍在窗口但被新5支配的项；最后队首给出5。",
          "caption": "输入与每个下标在图中固定。先删除离开窗口的项，再删除仍在窗口但被新5支配的项；最后队首给出5。"
        },
        {
          "type": "paragraph",
          "text": "环形数组中第i个候选位于(head+i)%k。size表示候选数，不等于窗口宽度；严格递减输入时可能保留k个，而递增输入时通常只保留最新一个。每个下标加入一次，随后最多从一端删除一次，所以全部删除次数不超过n，时间O(n)，辅助候选空间O(k)，返回的n-k+1个最大值另占O(n)输出空间。"
        },
        {
          "type": "paragraph",
          "text": "这个结论并不依赖数据随机。测试同时使用长递增和长递减序列，前者频繁从尾部删，后者主要等待过期从头删；它们只是验证实现与计数上界，线性结论来自生命周期证明。Lemire的原始论文还研究同时求最大与最小的更细比较次数界；本文只是单个最大值的常见候选队列，不能把论文的“三次比较”上界直接贴到这里。"
        },
        {
          "type": "reference",
          "title": "Lemire：滑动最大最小值原始论文 v5",
          "url": "https://arxiv.org/abs/cs/0610046v5",
          "note": "原作者论文固定v5。作为滑动极值问题的延伸，不声称本文实现复现了其联合max/min算法或比较常数。"
        },
        {
          "type": "paragraph",
          "text": "输入值相等时的规则值得单独试一次：对[4,4,4]和宽度二，若使用小于等于删除，队列每步只留下最新的一个四，最大值输出仍是两个四。若保留相等旧项，队列可以同时保存两个四，等较早的过期后再取较新的。两种都能求最大值，但它们对应的最大值下标不同。先决定要数值、最早位置还是最晚位置，再谈哪种比较符号更合适。"
        },
        {
          "type": "paragraph",
          "text": "环形数组的先后顺序也有实际作用。上一步队列最多装宽度个候选，下一步先删除过期项，或者由新项淘汰尾项，才写入新下标。这样候选数不会超过容量。如果颠倒成先写入再删除，满队列时可能覆盖仍要读取的队首。逻辑上的双端队列并不等于随便用取模下标就正确，容量不变量必须与操作顺序一起成立。"
        },
        {
          "type": "paragraph",
          "text": "若改成持续输入的流，候选队列可以不保留整个过去，只保存当前窗口下标和值，并把最大值逐个交给下游；本文为了让纯函数好测，接收完整数组并返回完整结果。两种形式的输出存储边界不同。流中的序号长期递增还要考虑安全整数上限，不能把有限数组实现直接包装成永不停止的生产服务。"
        }
      ]
    },
    {
      "id": "stack",
      "title": "单调栈：被移除是因为答案已经确定",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "对[2,2,3,1,4]，我们要返回右侧第一个严格更大元素的下标，答案为[2,2,4,4,-1]。栈中存放尚未找到答案的项，值从底到顶非递增。新值到来时，连续解决比它小的栈顶：它们此前没遇见更大值，而当前就是从左到右第一次满足条件的位置。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/sliding-monotonic/core.ts",
          "kind": "excerpt",
          "purpose": "完整单调栈实现。相等值不弹出，因为题目要求严格更大；next保存答案下标，-1表示不存在。",
          "code": "export type StackEvent={index:number;action:string;stack:number[];next:number[]};\nexport function nextGreater(a:readonly number[],observe?:(event:StackEvent)=>void){\n  numbers(a);const stack:number[]=[],next=new Array<number>(a.length).fill(-1);let pushes=0,pops=0;\n  for(let i=0;i<a.length;i++){\n    while(stack.length&&a[stack[stack.length-1]]<a[i]){next[stack.pop()!]=i;pops++;}\n    stack.push(i);pushes++;observe?.({index:i,action:'resolve then push',stack:[...stack],next:[...next]});\n  }\n  return {next,pushes,pops};\n}"
        },
        {
          "type": "paragraph",
          "text": "这里的弹出和最大值队列有不同含义：队列弹尾意味着旧候选以后不可能胜出，栈弹顶意味着旧问题已经获得答案。相等的两个2都应留着等后面的3，若使用≤弹出，就会把第二个2错误地当作第一个2的“严格更大”。每个下标入栈一次、出栈至多一次，基础时间O(n)，栈和答案各O(n)。"
        },
        {
          "type": "paragraph",
          "text": "考虑一个看似自然的错误实现：新项只和栈顶比较一次，解决一个旧项后立刻把自己压栈。对[5,4,3,6]，六应同时解决前面三个待定位置；只弹一次会让四和五永远错过这个首个更大项。while不是为了让代码显得更有技巧，而是因为一次到达可能关闭多个独立的未决问题。"
        },
        {
          "type": "paragraph",
          "text": "严格递增输入会让每次新值解决前一个，栈很短；严格递减输入则没有任何弹出，所有位置等待到结尾并保留无解。最坏辅助空间因此仍为线性，不能因为默认示例只看到三四个候选就宣传常数空间。若问题变成环形数组的下一个更大值，需要另外规定最多扫描几轮以及哪些轮次允许入栈，本实现没有隐含环形含义。"
        }
      ]
    },
    {
      "id": "run",
      "title": "自己看状态，再用不同方法核对结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "sliding-monotonic",
          "title": "逐步看窗口与候选",
          "description": "输入最多32项。默认最大值示例得到3,3,5,5,6,7；正数预设target7得到length2/start4/end6；next模式观察相等值不被提前解决。"
        },
        {
          "type": "paragraph",
          "text": "交互入口显示当前left/right、sum、候选下标或未决栈，以及最终结果和累计操作计数。先建立轨迹再点下一步；修改输入后必须重新建立，这样旧轨迹不会冒充新参数的运行。快照只为理解状态，在视图内最多32项，不是面向百万项的监控实现。"
        },
        {
          "type": "paragraph",
          "text": "下载后用Node22.12执行npm ci --ignore-scripts、npm test。构建把实际core.ts原文与view.tsx.txt合成只导入React的App.tsx，再执行TypeScript检查和10项CPU测试。最短窗口用1500组数据对照枚举全部区间；最大值用700组数据对照逐窗扫描；next用1000组数据对照逐项向右找，另检查每个快照的不变量和入出计数。"
        },
        {
          "type": "paragraph",
          "text": "观察回调复制当前deque、output或stack、next，保留全部步骤的额外时间与引用空间可到O(n²)；即使基础环形队列只需O(k)，保存全部输出快照也会更大。因此不要把演示轨迹的内存开销记到算法基础空间上，也不要用页面卡顿倒推单调队列失去了线性性质。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24在macOS14.5、Node22.12.0完成清洁安装、TypeScript和10项测试，没有以计时结果宣传性能。浏览器实际交互、手机视口及离线下载由站点集成另验。理解后的练习是返回最早最大值的下标：先改相等值保留规则，再让重复值测试证明新要求，而不是只换一个输出字段。"
        },
        {
          "type": "paragraph",
          "text": "对拍测试使用更慢但更直接的枚举参照，是因为两种实现应该有不同的出错方式。若拿同一段单调逻辑改变量名当参照，比较通过几乎没有增加证据。随机种子固定便于重放某个失败输入，但随机测试并不能穷尽所有数组；正数与支配关系的推导负责一般性，差分、边界和状态断言负责抓实现偏差。"
        },
        {
          "type": "paragraph",
          "text": "真正迁移到业务时，先问数据是否会更新过去的项。如果历史值可以被修改，已经淘汰的候选可能重新变得有用，普通单调队列不再能直接复原。时间戳乱序到达、窗口按真实时间而非固定项数、以及窗口需要撤销，都要重新设计有效期与状态。本文的删除结论依赖按顺序追加且旧值不变，讲清这个前提比给它贴上“所有窗口通用”更重要。"
        }
      ]
    }
  ]
};
export default article;
