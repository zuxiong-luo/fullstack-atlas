import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "sorting-binary-search",
  "topic": "algorithms",
  "title": "排序与二分：有序性、分治和边界不变量",
  "description": "实现稳定归并排序及半开区间 lower/upper bound，通过循环不变量推导正确性，用原始身份、逐步轨迹和差分性质测试验证排序、重复值与边界。",
  "minutes": 60,
  "tags": [
    "归并排序",
    "稳定性",
    "二分查找",
    "循环不变量",
    "lower_bound"
  ],
  "scope": "实现稳定归并排序及半开区间 lower/upper bound，通过循环不变量推导正确性，用原始身份、逐步轨迹和差分性质测试验证排序、重复值与边界。使用 TypeScript 5.7.3、React 18.3.1、Node.js 22.12.0；算法与有界教学轨迹分开，不把交互轨迹的分配成本算成基础算法成本。",
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
      "path": "sorting-binary-search.zip"
    },
    {
      "label": "安装、步骤与测试说明",
      "path": "sorting-binary-search/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Princeton algs4：固定提交归并排序",
      "url": "https://github.com/kevin-wayne/algs4/blob/7bb62c32f03fec900f0cc796a548ab992feffe4e/src/main/java/edu/princeton/cs/algs4/Merge.java"
    },
    {
      "title": "Princeton algs4：固定提交二分查找",
      "url": "https://github.com/kevin-wayne/algs4/blob/7bb62c32f03fec900f0cc796a548ab992feffe4e/src/main/java/edu/princeton/cs/algs4/BinarySearch.java"
    },
    {
      "title": "Open Data Structures：比较排序",
      "url": "https://opendatastructures.org/ods-python/11_Sorting_Algorithms.html"
    },
    {
      "title": "ECMAScript：Array.prototype.sort",
      "url": "https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.sort"
    }
  ],
  "sections": [
    {
      "id": "order",
      "title": "排序先定义顺序，二分再利用已经成立的顺序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "排序把一组元素重新排列，使相邻元素满足同一个比较规则；二分是在已经有序、或某个条件已经单调的范围中，每次排除一部分不可能的答案。两者经常搭配，但不是一回事：排序负责建立结构，二分负责利用结构。没有前置的有序性，二分的“丢掉一半”就没有依据，循环能结束也不代表答案正确。"
        },
        {
          "type": "paragraph",
          "text": "本文只展开一种排序：稳定归并排序；再用同一组数据推导首个不小于目标、首个大于目标的两个边界。这样足以看清分治、稳定性和区间不变量，不把十种算法都压成一句口诀。输入是有限数字，排序演示为每个元素保留原始编号，重复的2因此仍可被区分。"
        },
        {
          "type": "paragraph",
          "text": "比较器返回负、零、正，分别表示前一个应在前、等价、后一个应在后。比较规则需要一致：例如 a<b、b<c时应有a<c，相等关系也要一致。若比较器按随机数变化、在比较时修改键，或者把无法比较的 NaN 混进数值排序，算法就无法维持之前推导出的有序子问题。"
        }
      ]
    },
    {
      "id": "split",
      "title": "归并排序的作用与结构：拆开后解决，再合起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "归并排序把半开区间[lo,hi)分成[lo,mid)和[mid,hi)，先分别排序，再把两个有序区间合为一个。半开表示包含左端、不包含右端，所以长度直接等于hi-lo，空区间是lo=hi，一项区间长度1。统一这一种定义后，递归结束条件和数组切片更容易对齐，不必在不同阶段不断补减一。"
        },
        {
          "type": "paragraph",
          "text": "归并的关键不是“递归”这两个字，而是合并时已经知道左右两边各自有序。每次从两个尚未取出的首元素里选更小的那个，后面的元素不可能比自己的首元素更早成为全局最小。取走一项，问题又变成同样的结构；直到两边都耗尽，当前区间就完成。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/sorting-binary-search/core.ts",
          "purpose": "稳定归并排序的完整实现。输入浅复制后排序，aux复用；onMerge可选，仅教学时保存快照。",
          "kind": "excerpt",
          "code": "export type MergeStep<T>={lo:number;mid:number;hi:number;values:T[];comparisons:number;writes:number};\nexport function mergeSort<T>(input:readonly T[],compare:(a:T,b:T)=>number,onMerge?:(step:MergeStep<T>)=>void):T[]{\n  const values=[...input],aux=new Array<T>(values.length);\n  let comparisons=0,writes=0;\n  function sort(lo:number,hi:number){\n    if(hi-lo<2)return;\n    const mid=lo+Math.floor((hi-lo)/2);sort(lo,mid);sort(mid,hi);\n    for(let k=lo;k<hi;k++)aux[k]=values[k];\n    let left=lo,right=mid;\n    for(let k=lo;k<hi;k++){\n      if(left===mid)values[k]=aux[right++];\n      else if(right===hi)values[k]=aux[left++];\n      else{comparisons++;values[k]=compare(aux[left],aux[right])<=0?aux[left++]:aux[right++];}\n      writes++;\n    }\n    onMerge?.({lo,mid,hi,values:[...values],comparisons,writes});\n  }\n  sort(0,values.length);return values;\n}"
        },
        {
          "type": "paragraph",
          "text": "aux 保存合并前的区间，values 接收合并后的结果。若直接边读 values 边往前写，新值可能覆盖另一侧还未读取的旧值。先拷贝这个区间，就让读取与写入分离。不是每层重新复制整个数组：基础实现只创建一个长度 n 的 aux，递归时复用不同区间。输入本身也被浅复制，调用者原数组顺序保持不变。"
        }
      ]
    },
    {
      "id": "proof",
      "title": "把合并正确性写成不变量，而不是相信递归",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "合并循环开始时，values[lo,k)已经包含左右区间被取出部分的全部元素，且按序排列；left和right分别指向两边第一个尚未取出的元素。初始k=lo，输出为空，不变量成立。若一边耗尽，另一边剩余内容已排序，可以继续取；否则比较两个首项，选择不大的那项，它就不会破坏输出顺序，也没有漏掉更小候选。"
        },
        {
          "type": "paragraph",
          "text": "每次循环只消费一个来源元素，并写入一个输出位置，因此既不会多创造元素，也不会漏元素。循环执行hi-lo次后两边全部消费，整个[lo,hi)是原区间的一次有序排列。再用归纳：长度0或1天然有序；若两个更短子区间已正确排序，合并就得到当前区间正确结果，于是最外层也成立。"
        },
        {
          "type": "paragraph",
          "text": "稳定性回答的是比较结果相等的两个原始对象，排序后相对次序是否保留。代码用<=优先取左边，相等时左区间的对象先输出；同一区间内部又由递归保持顺序，因此全程稳定。若改成严格<，相等时会先取右边，排序数值仍可能正确，但原始身份顺序会反转。实验给2标上#1和#2，你可以直接检查这一点。"
        }
      ]
    },
    {
      "id": "complexity",
      "title": "为什么是 O(n log n)，哪些额外工作另算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一层合并处理的总区间长度为 n，因为同层区间互不重叠；每次把范围大致减半，层数为 O(log n)，于是总复制与输出工作 O(n log n)。更正式地写，T(n)=T(⌊n/2⌋)+T(⌈n/2⌉)+O(n)。比较器若本身要比较长字符串或复杂对象，应把一次比较的成本再乘进去，不能一直假定是整数减法。"
        },
        {
          "type": "paragraph",
          "text": "基础算法需要输出副本、aux各 O(n)，以及 O(log n)递归栈；总辅助空间仍是 O(n)。但教学 onMerge 会复制当前整个 values 以便回放，一共有 O(n)次合并事件，保存全部轨迹可能多达 O(n²)时间与引用空间。实验最多32项，明确把这部分可视化开销与基础算法分开；不打开回调就不生成快照。"
        },
        {
          "type": "paragraph",
          "text": "8个元素的例子有3层合并，输出写入恰好24次；比较次数随数据排列变化，不一定等于24。测试精确检查写入与有序子区间，没有用某个单次运行的毫秒数字证明复杂度。现代运行时的内建排序通常更复杂，本例解释的是这份归并代码，不声称复刻了 V8 的 Array.sort。"
        }
      ]
    },
    {
      "id": "bound-concept",
      "title": "lower_bound：寻找分界，不急着寻找相等项",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "现在我们已有升序数组。lower_bound(target)定义为首个值≥target的位置；如果所有值都更小，就返回 n。这个定义覆盖目标不存在的情况，也明确规定重复值应返回哪一个。把它想成真假分界：左边都满足a[i]<target，右边都满足a[i]≥target。我们要找的是分界位置，它可以位于两个元素之间，也可以在数组末端。"
        },
        {
          "type": "paragraph",
          "text": "用lo、hi表示尚未确定的候选范围[lo,hi)。循环不变量是：[0,lo)中的元素都小于target，[hi,n)中的元素都大于等于target，答案在闭区间[lo,hi]之间。初始lo=0、hi=n，两边已确认区间都为空，因此条件自然成立；注意候选元素区间是半开，答案是边界位置，所以允许答案等于hi。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/sorting-binary-search/core.ts",
          "purpose": "lower/upper bound完整实现及等值区间。mid属于当前候选元素；走右侧用mid+1，走左侧保留mid作为可能答案。",
          "kind": "excerpt",
          "code": "export type BoundStep={lo:number;hi:number;mid:number;value:number;move:'lo'|'hi';nextLo:number;nextHi:number};\n// Precondition: ascending finite numbers; checked at the UI boundary, not inside each query.\nexport function bound(values:readonly number[],target:number,upper=false,onStep?:(step:BoundStep)=>void):number{\n  let lo=0,hi=values.length;\n  while(lo<hi){\n    const mid=lo+Math.floor((hi-lo)/2),value=values[mid];\n    const goRight=upper?value<=target:value<target;\n    const nextLo=goRight?mid+1:lo,nextHi=goRight?hi:mid;\n    onStep?.({lo,hi,mid,value,move:goRight?'lo':'hi',nextLo,nextHi});\n    lo=nextLo;hi=nextHi;\n  }\n  return lo;\n}\nexport function equalRange(values:readonly number[],target:number):[number,number]{return [bound(values,target),bound(values,target,true)];}"
        },
        {
          "type": "paragraph",
          "text": "若a[mid]<target，升序保证[lo,mid]也都小于target，因此把lo改成mid+1，不能留在mid；否则mid本身可能就是首个合格项，把hi改成mid，不能直接mid-1。两个分支都让hi-lo严格变小，最小可到0。退出时lo=hi，左右确认条件仍成立，这个唯一分界就是答案。"
        }
      ]
    },
    {
      "id": "upper",
      "title": "upper_bound 与重复值范围：只改比较条件，含义要一起改",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "upper_bound寻找首个>target的位置，因此左侧确认条件改成≤target，右侧改成>target。mid值等于目标时应该走右侧，这就是代码中upper?value<=target:value<target的区别。循环结构没有变，但不变量随定义改变，不是记住一个开关就可以不解释行为。"
        },
        {
          "type": "paragraph",
          "text": "给定[1,2,2,2,4,8]，lower_bound(2)=1，upper_bound(2)=4，因此等值元素恰好占[1,4)，数量3。需要第一个相等项时，还要检查lower<n且a[lower]===target；需要最后一个相等项时，先确认范围非空，再取upper-1。不能把upper-1无条件当作找到，否则空数组和未命中会产生错误下标。"
        },
        {
          "type": "figure",
          "src": "figures/sorting-binary-search/mechanism.svg",
          "title": "归并建立有序性，二分缩小合法的边界位置",
          "alt": "上方按左侧优先合并两个有序子区间并保留2的身份；下方[1,2,2,2,4,8]查lower_bound(2)：[0,6)→[0,3)→[0,1)→[1,1)，结果1",
          "caption": "上方按左侧优先合并两个有序子区间并保留2的身份；下方[1,2,2,2,4,8]查lower_bound(2)：[0,6)→[0,3)→[0,1)→[1,1)，结果1。图中是本示例数据与逻辑关系，不代表 JS 引擎内存布局或计时结果。"
        },
        {
          "type": "paragraph",
          "text": "这组输入的lower过程可以逐步手算：lo0、hi6，mid3值2，hi变3；mid1值2，hi变1；mid0值1，lo变1，结束。每一步丢掉的部分都有有序性支撑。返回结果1不是因为“碰到一个2就停”，而是已经证明位置1之前全都小于2，因此遇到多个相等项也不会随机返回中间一个。"
        }
      ]
    },
    {
      "id": "boundaries",
      "title": "最常见的失败：区间混用、未排序与无效数值",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "把闭区间写法里的hi=mid-1搬进这份半开实现，会把可能的答案mid直接丢掉；把lo=mid写进右侧分支，长度1且mid=lo时又可能永远不缩小。更改代码前先重写不变量和终止度量：每次循环必须维持已确认两侧的性质，并使hi-lo严格减小。光看几个常规输入恰好返回正确，抓不住这些问题。"
        },
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/sorting-binary-search/core.ts",
          "purpose": "实验输入边界：最多32项有限数字，拒绝空洞与NaN/Infinity；assertSorted仅在准备查询时执行一次。",
          "kind": "excerpt",
          "code": "export function parseFiniteList(text:string):number[]{\n  if(!text.trim())return [];\n  const tokens=text.split(',');if(tokens.length>32)throw new RangeError('最多32项');\n  return tokens.map(token=>{if(!token.trim())throw new Error('逗号之间不能为空');const n=Number(token.trim());if(!Number.isFinite(n))throw new Error('必须是有限数字');return n;});\n}\nexport function assertSorted(values:readonly number[]):void{\n  for(let i=0;i<values.length;i++)if(!Number.isFinite(values[i])||(i>0&&values[i-1]>values[i]))throw new Error('二分输入必须按升序排列');\n}"
        },
        {
          "type": "paragraph",
          "text": "二分核心刻意不在每次查询内部扫描验证排序，否则每次多 O(n)，查询就不再只是 O(log n)。在可信、有序数据结构内部，这是由拥有者保证的不变量；接收外部数据时，先校验或排序，再执行多次查询。实验既可自动排序后查询，也能单独检查原始输入；输入2,1会被明确拒绝作为直接二分前提。"
        },
        {
          "type": "paragraph",
          "text": "本例使用lo+Math.floor((hi-lo)/2)，避免把下标交给会转成32位有符号整数的位运算写法。JS数字没有和某些定长整数语言完全相同的加法溢出行为，但这不等于任何写法都适合大型下标。这里还要求目标有限；NaN会让大小比较失去期望含义，不应该静默返回某个看似合法的边界。"
        }
      ]
    },
    {
      "id": "lab",
      "title": "运行与验证：从原始身份到每个区间都能解释",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "sorting-binary-search",
          "title": "归并与二分步骤实验",
          "description": "输入最多32个数字，逐次观察合并后的区间、原始编号、比较与写入；在排序结果上切换lower/upper并逐步查看lo、hi、mid和更新方向。"
        },
        {
          "type": "paragraph",
          "text": "默认4,2,2,7,1按“下一次合并”逐步走完，最终应是1、2#1、2#2、4、7，两个2的编号顺序不变。目标2的等值范围是[1,3)。切换upper会重置二分步骤；修改输入后需重新生成轨迹，界面会同时显示正在使用的固定数据和固定目标，避免文本框的新值与旧轨迹混淆。空输入允许生成空数组，两个边界都为0。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端 · 独立复现",
          "purpose": "下载 ZIP 解压后进入目录执行；应看到 8 项通过。浏览器交互由文末实验入口打开。",
          "kind": "runnable",
          "code": "cd sorting-binary-search\nnode --version # v22.12.0\nnpm ci --ignore-scripts\nnpm test\n# tests 8; pass 8; fail 0"
        },
        {
          "type": "paragraph",
          "text": "实际在macOS 14.5、Node.js 22.12.0通过8项测试：1000组数组与数值sort差分，同时检查不修改输入和排序幂等；200个带身份对象验证稳定性；600组有序数组对25种目标，核对线性参照、左右分区和等值范围。另逐步断言边界循环严格缩小、每次合并区间有序，以及空、单项、全相等、负数和小数。"
        }
      ]
    },
    {
      "id": "tradeoffs",
      "title": "什么时候先排序，什么时候一次线性查找更合适",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "只查一次，先花O(n log n)排序再做O(log n)二分，未必胜过直接O(n)扫描。数据相对稳定、需要多次范围查询时，排序的成本才可能由后续查询摊开。若不断插入并要求保持顺序，数组还要支付搬移成本；二分找到插入位置是O(log n)，把元素放进去并不是自动O(log n)。"
        },
        {
          "type": "paragraph",
          "text": "归并排序在这里带来稳定性与可解释的最坏界，但需要额外数组；内建sort、堆或树可以服务不同需求。本文没有泛称“最优算法”，而是给出输入规则、完整实现、正确性理由和可反驳的测试。以后遇到新的查找题，先写出边界含义、已确认区域和收缩条件，再写while循环，会比背几段看起来相似的模板稳得多。"
        },
        {
          "type": "reference",
          "title": "Princeton algs4：固定提交归并排序",
          "url": "https://github.com/kevin-wayne/algs4/blob/7bb62c32f03fec900f0cc796a548ab992feffe4e/src/main/java/edu/princeton/cs/algs4/Merge.java",
          "note": "固定提交仅供核对归并与稳定性；本文为独立TS半开区间实现，不逐字复制Java代码。"
        },
        {
          "type": "reference",
          "title": "Princeton algs4：固定提交二分查找",
          "url": "https://github.com/kevin-wayne/algs4/blob/7bb62c32f03fec900f0cc796a548ab992feffe4e/src/main/java/edu/princeton/cs/algs4/BinarySearch.java",
          "note": "该源码是查相等的闭区间示例，本文另推导lower/upper，不能混用更新规则。"
        },
        {
          "type": "reference",
          "title": "Open Data Structures：比较排序",
          "url": "https://opendatastructures.org/ods-python/11_Sorting_Algorithms.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "ECMAScript：Array.prototype.sort",
          "url": "https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.sort",
          "note": ""
        }
      ]
    }
  ]
};
export default article;
