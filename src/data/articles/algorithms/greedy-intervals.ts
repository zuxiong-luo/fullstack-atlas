import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "greedy-intervals",
  "topic": "algorithms",
  "title": "贪心与区间问题：怎样证明局部选择成立",
  "description": "明确区间端点与优化目标，用交换论证证明最早结束的数量最优，给出错误规则反例，再实现全部任务的最少房间和覆盖合并，说明三者不能混用。",
  "minutes": 55,
  "tags": [
    "贪心",
    "交换论证",
    "区间选择",
    "区间分配",
    "覆盖合并"
  ],
  "scope": "明确区间端点与优化目标，用交换论证证明最早结束的数量最优，给出错误规则反例，再实现全部任务的最少房间和覆盖合并，说明三者不能混用。 TypeScript 5.7.3 / React 18.3.1 / Node.js 22.12.0；教学算法与快照轨迹额外成本分开，不以运行耗时证明复杂度。",
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
      "path": "greedy-intervals.zip"
    },
    {
      "label": "安装、操作与验证说明",
      "path": "greedy-intervals/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Buffalo CSE331：从反例推导区间选择",
      "url": "https://cse.buffalo.edu/~atri/cse331/support/examples/interval_scheduling/index.html"
    },
    {
      "title": "Virginia Tech CS5114：区间选择与区间分配",
      "url": "https://courses.cs.vt.edu/~cs5114/spring2009/lectures/lecture04-greedy-scheduling.pdf"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "贪心意味着固定当前选择，必须先证明不会后悔",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "贪心算法每一步按某个规则作选择，并把它固定，不回头枚举其他分支。它快的原因往往是删掉了搜索树中的大量可能性，但删除必须有证明：被删掉的分支里不能藏着比当前选择更好的答案。感觉“更短”“更早”“冲突更少”都只是候选直觉，不是正确性证据。"
        },
        {
          "type": "paragraph",
          "text": "区间问题特别适合练这个区别。每项任务有开始和结束时间，本文统一用半开区间[start,end)，所以一个任务结束于二，下一个开始于二，二者不冲突。第一目标是一个房间内选数量最多的互不冲突任务，每项同等价值，允许舍弃任务；不是把全部任务都排进去，也不是最大化收入。"
        },
        {
          "type": "paragraph",
          "text": "接着我们用同一输入解决另外两个目标：把全部任务安排到尽量少的房间，以及把所有占用时间合并成覆盖区间。它们都操作start/end，却有不同输出和证明。先写清目标，再定排序和更新规则，能避免见到区间就机械地按某一端点排序。"
        }
      ]
    },
    {
      "id": "input",
      "title": "时间、身份和端点约定必须可检验",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/greedy-intervals/core.ts",
          "kind": "excerpt",
          "purpose": "完整输入检查。正时长、唯一ID、绝对值不超过10^9的安全整数时间，最多一万区间；零时长明确不属于本模型。",
          "code": "export type Interval={id:string;start:number;end:number};\nexport function validateIntervals(input:readonly Interval[]){\n if(input.length>10000)throw new RangeError('at most 10000 intervals');const ids=new Set<string>();\n for(let i=0;i<input.length;i++){const x=input[i];if(!Object.hasOwn(input,i)||!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||!Number.isSafeInteger(x.start)||!Number.isSafeInteger(x.end)||Math.abs(x.start)>1_000_000_000||Math.abs(x.end)>1_000_000_000||x.start>=x.end)throw new RangeError('unique IDs and bounded start < end required');ids.add(x.id);}\n}"
        },
        {
          "type": "paragraph",
          "text": "负时间在本模型里合法，它可以是相对某个基准之前的时刻；start必须严格小于end，空区间则拒绝。现实时间需要额外处理时区、夏令时与精度，这里使用整数坐标只讨论算法。相同起止的两项仍可有不同ID，它们互相冲突，不应因为数值相同就去重成一项并丢掉业务身份。"
        },
        {
          "type": "paragraph",
          "text": "端点约定直接决定比较符号。半开区间兼容条件为next.start≥previous.end；如果业务要求两场之间有清洁间隔，就应把约束扩展为start≥end+gap，再重新说明输入和证明。把大于误写成大于等于或反过来，会改变可选数量，不能期待排序阶段自动补救。"
        }
      ]
    },
    {
      "id": "counterexamples",
      "title": "先用反例排除那些看起来很合理的规则",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "输入A为[0,10)，B为[1,2)，C为[2,3)，D为[3,4)。如果按最早开始，先固定A后就只能选一项；选B、C、D则有三项。早开始不保证留下足够空间，恰恰可能一开始占住整个时间。这个反例已经足以否定“最早开始总能最优”，不需要再跑一百次看平均效果。"
        },
        {
          "type": "paragraph",
          "text": "按最短时长也不行。A=[0,3)、B=[3,6)、C=[2,4)，最短的C会挡住另外两项，只得一项；A和B兼容，可以选两项。长度小只描述自己占的空间，不说明它把其他区间切在什么位置。寻找反例时，先画能放下的两边，再插一个更短的中间阻挡者，通常比随机试数更有方向。"
        },
        {
          "type": "paragraph",
          "text": "这些错误策略在部分数据上当然可能与最优一致。测试成功样例只能证明那一组没错，不能推出所有输入都成立。贪心要交付的是一个关于任意合法输入的安全选择论证；后面的随机差分用来检查代码是否遵守这个论证，而不替代证明。"
        }
      ]
    },
    {
      "id": "exchange",
      "title": "最早结束为什么能安全固定：交换一个最优解",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "让g是所有候选中结束最早的一项。任取一个最优兼容集合，按时间排好，第一项记为o。因为g结束不晚于o，用g替换o后，后续原本能接在o之后的任务也一定能接在g之后；集合仍合法，数量不变。因此至少存在一个同样最优的解，以贪心的g开头。"
        },
        {
          "type": "figure",
          "src": "figures/greedy-intervals/exchange.svg",
          "title": "交换不是找到答案，而是证明选择不会排除所有最优解",
          "alt": "先固定同等价值、单房间数量最大，再用结束时间不晚证明后续仍可兼容；剩下的是同类子问题。",
          "caption": "先固定同等价值、单房间数量最大，再用结束时间不晚证明后续仍可兼容；剩下的是同类子问题。"
        },
        {
          "type": "paragraph",
          "text": "选定g后，只保留start≥end(g)的任务，剩下问题与原问题形式相同。再对它应用同样交换论证，每一步都能和某个最优解对齐。有限次后就得到整个贪心结果。证明重点不是“结束早看起来余量大”，而是明确构造出一个包含当前选择、又不降低目标的最优解。"
        },
        {
          "type": "paragraph",
          "text": "如果g与o本来就是同一项，无需交换；若多个区间结束相同，任选一个结束最早的候选都能保持后续可行性。实现用开始时间与ID再打平，只是为了演示与测试输出稳定，不意味着这些平局规则决定了全局最优。没有把最优解唯一性当成正确性的前提。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/greedy-intervals/core.ts",
          "kind": "excerpt",
          "purpose": "完整最多兼容项选择。先复制排序避免改调用方，再扫描当前结束边界；返回克隆后的选中区间，观察快照也独立。",
          "code": "const byId=(a:Interval,b:Interval)=>a.id<b.id?-1:a.id>b.id?1:0;\nexport type IntervalEvent={id:string;action:string;end:number;selected:string[]};\nexport function maximumCompatible(input:readonly Interval[],observe?:(e:IntervalEvent)=>void){\n validateIntervals(input);const sorted=[...input].sort((a,b)=>a.end-b.end||a.start-b.start||byId(a,b)),selected:Interval[]=[];let end=-Infinity;\n for(const x of sorted){const take=x.start>=end;if(take){selected.push({...x});end=x.end;}observe?.({id:x.id,action:take?'take':'skip overlap',end,selected:selected.map(v=>v.id)});}\n return selected;\n}"
        },
        {
          "type": "paragraph",
          "text": "按结束时间排好后，只需要记最后选中项的end，不必逐个检查所有已选任务。已选序列本来按时间不重叠，最新结束边界就是当前可行性门槛。排序占主导工作，扫描O(n)，在比较排序成本模型下整体O(n log n)；返回结果与复制输入O(n)空间，观察历史另计。"
        },
        {
          "type": "paragraph",
          "text": "交换论证中的最优解只是数学比较对象，不要求算法先算出它。如果必须先知道最优解才能运行贪心，就失去意义。我们证明任意最优解都能被调整成包含g的一份最优解，从而允许程序只固定g并处理剩余项。这也解释了为什么证明和代码的职责不同：代码作选择，证明说明删掉其他选择仍然安全。"
        }
      ]
    },
    {
      "id": "weights",
      "title": "目标一变，原证明里的“数量不变”就可能没用了",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果A=[0,3)价值一百，B=[0,1)价值一，按最早结束会选B，但最大收入应选A。交换保证数量不减，不保证价值不减；把o换成g可能把高价值换成低价值。因此带权区间选择需要新的状态与转移，例如按结束排序后结合最后兼容前驱做动态规划，不能复用本篇数量贪心的结论。"
        },
        {
          "type": "paragraph",
          "text": "同样地，优先安排某个客户、限制不同类型配额或要求必须包含某项，都可能改变安全交换的条件。不要把“加一个字段”视为对原算法毫无影响。先指出证明哪一步仍然成立、哪一步失效，再考虑扩展，比只在排序比较器上多拼一个优先级更稳妥。"
        }
      ]
    },
    {
      "id": "rooms",
      "title": "第二个目标：全部任务必须保留，最少要几个房间",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "区间分配不允许丢任务。先按开始时间处理，维护每个已有房间最后任务的结束时间；新任务到来时，如果最早空闲的房间已结束，就复用它，否则开新房间。最早结束房间用一个最小堆管理，每个房间始终保留一个当前结束记录，不需要每次扫描全部房间。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/greedy-intervals/core.ts",
          "kind": "excerpt",
          "purpose": "完整内部房间最小堆。按end比较；只在已知非空时pop。堆里是每间房最后结束时间，不是仅有当前活跃任务。",
          "code": "type Room={end:number;room:number};\nclass Rooms{\n data:Room[]=[];\n peek(){return this.data[0];}\n push(value:Room){this.data.push(value);let i=this.data.length-1;while(i){const p=Math.floor((i-1)/2);if(this.data[p].end<=this.data[i].end)break;[this.data[p],this.data[i]]=[this.data[i],this.data[p]];i=p;}}\n pop(){const first=this.data[0],last=this.data.pop()!;if(this.data.length){this.data[0]=last;let i=0;for(;;){let best=i,l=2*i+1,r=l+1;if(l<this.data.length&&this.data[l].end<this.data[best].end)best=l;if(r<this.data.length&&this.data[r].end<this.data[best].end)best=r;if(best===i)break;[this.data[i],this.data[best]]=[this.data[best],this.data[i]];i=best;}}return first;}\n}"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/greedy-intervals/core.ts",
          "kind": "excerpt",
          "purpose": "完整最少房间分配。顺开始时间扫描，已空闲则取出复用，否则开新编号；每间房更新后的结束值重新入堆。",
          "code": "export type RoomEvent={id:string;room:number;rooms:{end:number;room:number}[]};\nexport function minimumRooms(input:readonly Interval[],observe?:(e:RoomEvent)=>void){\n validateIntervals(input);const sorted=[...input].sort((a,b)=>a.start-b.start||a.end-b.end||byId(a,b)),heap=new Rooms(),assignment:{id:string;room:number}[]=[];let count=0;\n for(const x of sorted){const available=heap.peek();const room=available&&available.end<=x.start?heap.pop().room:count++;heap.push({room,end:x.end});assignment.push({id:x.id,room});observe?.({id:x.id,room,rooms:heap.data.map(r=>({...r}))});}\n return {count,assignment};\n}"
        },
        {
          "type": "paragraph",
          "text": "为什么开新房间一定必要？当前最早结束的房间还晚于新任务的开始，说明所有已有房间在这个开始时刻都被某个更早开始的任务占用。连同新任务，此刻同时重叠数量等于旧房间数加一，任何合法方案至少需要这么多房间。算法只在达到这个下界时增加房间，所以最后使用的数量最优。"
        },
        {
          "type": "paragraph",
          "text": "这里的堆可能保存已经空闲的房间，它表示所有已开房间的最后结束时间，不是实时在线人数。一个新任务只需要一个房间，取最早可用的一个再放回即可，不必先删光所有已结束记录。若把它误当活跃集合全部弹掉，又没有保存可复用房间编号，就可能不断新建房间，破坏输出分配。"
        },
        {
          "type": "paragraph",
          "text": "默认A占房间零，B、C、D可以依次用房间一，所以全部任务需要两间，与只选三个兼容任务并不矛盾。分配输出逐项记录room，测试按房间分组检查任意相邻任务不重叠，再与独立最大同时重叠数比较；只断言count等于二而不检查实际分配，仍可能漏掉把冲突任务放同房间的错误。"
        },
        {
          "type": "paragraph",
          "text": "最少房间的下界可以在任何时刻观察：若同时重叠d个任务，少于d个房间必然让两项冲突。单独知道最大重叠却还没有给出可行分配，本算法既构造分配，又只在下界增加时开房间。这个“构造达到下界”的证明比“最早空闲看起来合理”更直接，也适合核验实际返回的room编号。"
        }
      ]
    },
    {
      "id": "coverage",
      "title": "第三个目标：合并的是时间集合，不是任务选择",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/greedy-intervals/core.ts",
          "kind": "excerpt",
          "purpose": "完整覆盖合并。按start排序，重叠或接触则扩展当前end；只输出覆盖段，不声称保留每项任务身份。",
          "code": "export function mergeCoverage(input:readonly Interval[]){\n validateIntervals(input);const sorted=[...input].sort((a,b)=>a.start-b.start||a.end-b.end||byId(a,b)),out:{start:number;end:number}[]=[];\n for(const x of sorted){const last=out[out.length-1];if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else out.push({start:x.start,end:x.end});}return out;\n}"
        },
        {
          "type": "paragraph",
          "text": "合并覆盖要表示所有任务占用时间的并集，所以按start排序，若下一项开始不晚于当前段结束，就把结束更新为两者更大值。它既不拒绝冲突，也不优化数量。默认并集只有[0,10)，不代表只允许执行一个任务，而是整个范围至少有一项任务占用。"
        },
        {
          "type": "paragraph",
          "text": "半开区间[0,1)和[1,2)在调度时兼容，但在覆盖意义上可合成[0,2)。两个处理并不矛盾：前者判断任务是否同时占用资源，后者表示它们的时间集合是否有间隙。正文分别写出目标和比较条件，避免只看到一个等号就认为两个算法必须用同一个输出解释。"
        },
        {
          "type": "figure",
          "src": "figures/greedy-intervals/rooms.svg",
          "title": "同一输入的三种合法答案",
          "alt": "最多兼容任务3项、全部安排2间房、覆盖并集1段；它们的优化对象和数据含义完全不同。",
          "caption": "最多兼容任务3项、全部安排2间房、覆盖并集1段；它们的优化对象和数据含义完全不同。"
        },
        {
          "type": "paragraph",
          "text": "嵌套区间需要更新为max(last.end,next.end)，不能无条件把end换成下一项结束。如果当前已有[0,10)，后面看到[2,3)，无条件赋值会把覆盖缩成[0,3)，丢掉后面的真实占用。排序只保证开始位置递增，不保证结束位置也递增；保留不变量时要区分已经知道的有序维度。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "从可行性到最优性，检查也分两层",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "测试先核对可行性：选中集合内不能重叠，每个任务只出现一次，每间房的安排也不能冲突。然后才核对最优值：六百组小输入用全部子集枚举求最多数量；另外六百组用独立时间点重叠计数验证最少房间。一个可行解不自动最优，一个正确的数量也不能保证返回的具体集合合法。"
        },
        {
          "type": "paragraph",
          "text": "覆盖合并则不与任务数量比较，而是对生成数据的所有半整数采样点核对并集覆盖一致，再确认结果各段之间已有真实间隙。输入时间是整数，因此这些采样覆盖了会改变集合关系的端点与区间内部位置；这不是对任意浮点时间的通用采样证明，准确范围由输入模型决定。"
        },
        {
          "type": "paragraph",
          "text": "用错误策略反例做固定回归也很有用。未来重构若把结束排序误改成长度排序，随机输入不一定立即暴露，但三项中间阻挡者用例会稳定失败。输入为空、相同起止不同ID、负时间、端点接触、零时长拒绝与快照隔离都各有断言，避免成功路径掩盖边界政策。"
        },
        {
          "type": "paragraph",
          "text": "输入复制同样属于可用性要求。如果对调用方数组原地排序，其他界面或逻辑可能突然失去原来的任务显示顺序，虽然最优数量没变，系统行为却变了。这里复制后排序，并克隆返回的选中项；测试冻结输入、修改输出和观察快照，确认算法状态与调用方数据没有意外共享可变引用。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行与扩展：先问自己优化的到底是什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "greedy-intervals",
          "title": "观察选择、房间与覆盖的差别",
          "description": "默认最多选择B/C/D；切到全部任务用最少房间，结果2；每步高亮正在处理项与当前边界/堆快照，覆盖结果另展示。"
        },
        {
          "type": "paragraph",
          "text": "下载后在Node22.12运行npm ci --ignore-scripts、npm test，10项TypeScript与CPU测试通过。视图最多十六项，能修改JSON并重建轨迹；显示线段、端点及当前项，不伪造执行耗时。观察selected或房间数组每步复制，历史额外O(n²)量级，不属于基础扫描的常数状态。"
        },
        {
          "type": "paragraph",
          "text": "2026-10-24在macOS14.5完成清洁安装与测试，浏览器和手机交互由集成另验。下一次遇到区间任务，先写“可不可以丢任务、是不是同等价值、端点相遇算不算冲突、输出要身份还是覆盖集合”。这些条件确定后，才能选择一个确有安全性证明的排序与推进方式。"
        },
        {
          "type": "paragraph",
          "text": "当区间来自不可信JSON时，应先检查整个集合再作排序和分配，避免处理一半才遇到非法时间而留下不可解释结果。这里所有算法先统一验证，失败时不返回部分方案。真正发布会议室预订还要在服务端处理并发占用与事务约束；一份内存最优分配不能替代数据库里防止重复预订的协议。"
        }
      ]
    }
  ]
};
export default article;
