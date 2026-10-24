import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "hash-lru",
  "topic": "algorithms",
  "title": "哈希与缓存结构：冲突、负载、查找与 LRU",
  "description": "实现可观察桶分布的字符串哈希表和 Map 加双向链表的 LRU；从键相等、不变量与访问序列解释平均查找、碰撞退化、扩容及淘汰。",
  "minutes": 55,
  "tags": [
    "哈希表",
    "碰撞",
    "负载因子",
    "LRU",
    "双向链表"
  ],
  "scope": "实现可观察桶分布的字符串哈希表和 Map 加双向链表的 LRU；从键相等、不变量与访问序列解释平均查找、碰撞退化、扩容及淘汰。使用 TypeScript 5.7.3、React 18.3.1、Node.js 22.12.0；算法与有界教学轨迹分开，不把交互轨迹的分配成本算成基础算法成本。",
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
      "path": "hash-lru.zip"
    },
    {
      "label": "安装、步骤与测试说明",
      "path": "hash-lru/README.md"
    }
  ],
  "experiment": "react",
  "questionIds": [],
  "references": [
    {
      "title": "Open Data Structures：分离链接哈希",
      "url": "https://opendatastructures.org/ods-python/5_1_ChainedHashTable_Hashin.html"
    },
    {
      "title": "ECMAScript：Map 的语义与平均访问要求",
      "url": "https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects"
    },
    {
      "title": "Node.js 22.12.0：测试运行器",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/test.html"
    }
  ],
  "sections": [
    {
      "id": "mapping",
      "title": "哈希表解决按键定位，缓存还要回答保留谁",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "哈希表是一种按键保存与查找值的数据结构。它先把键映射成整数，再映射到有限数量的桶，从一个较小候选集合里寻找相等键。比如设备编号 A 对应最近读取的状态，调用者只关心 A 的值，而不关心 A 是数组里的第几项。哈希减少候选范围，但不能把整数结果当作身份：两个不同键可以得到相同哈希，也可以只是在取模后落入同桶。"
        },
        {
          "type": "paragraph",
          "text": "LRU 是另一个层次的规则，意思是最近最少使用：缓存满了，就移除距离上一次使用最久的条目。它需要两种能力：按键找到条目，以及快速改变访问顺序。哈希表适合第一件事，双向链表适合第二件事。我们先独立实现一个分离链接哈希表理解定位，再用 JS Map 充当 LRU 的索引，避免把两个教学重点缠在一份复杂实现里。"
        },
        {
          "type": "paragraph",
          "text": "本文键限定字符串、值限定数字，缓存容量按条目数量计算。没有网络请求、过期时间或分布式共享。你会在实验里主动制造所有键落入同一个桶，看到低负载也能退化；再通过 A、B、A、C 的访问，检查到底谁应该被淘汰。先明确这些语义，才能判断代码是否实现了想要的缓存。"
        }
      ]
    },
    {
      "id": "hash",
      "title": "哈希值、桶位置与键相等分别负责什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/hash-lru/core.ts",
          "purpose": "确定性 UTF-16 教学哈希：乘法与异或混合到32位，最后转无符号；不是密码哈希，也不声称抗恶意输入。",
          "kind": "excerpt",
          "code": "export type Entry={key:string;value:number};\n// Deterministic UTF-16 teaching hash, not a cryptographic or attack-resistant hash.\nexport function hashString(key:string):number{\n  let hash=2166136261;\n  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619)>>>0;\n  return hash;\n}"
        },
        {
          "type": "paragraph",
          "text": "hashString 从字符串的 UTF-16 码元逐项计算，再用无符号整数模桶数量确定位置。空字符串同样有位置，汉字和表情也能作为键；表情可能占两个码元，不影响相同字符串得到相同结果。算法不做 Unicode 规范化，所以视觉相似但编码不同的字符串仍可能是不同键。需要规范化的业务应先在边界统一规则。"
        },
        {
          "type": "paragraph",
          "text": "计算哈希本身要读长度为 k 的键，因此至少有 O(k) 工作；比较字符串也可能检查多个码元。人们常说“哈希查询 O(1)”，通常把键长度或已计算哈希的处理当成固定成本，并假设分布良好。我们会明确写出这个模型，而不是把用户可提交的超长字符串也当成没有成本。"
        },
        {
          "type": "paragraph",
          "text": "整数哈希不是加密、签名或匿名化。这里的确定性函数没有随机种子，也没有对抗刻意碰撞的证明；实验还允许把函数替换为永远返回0。扩容会改变桶的位置，却不能保证把本来就相同的哈希分开。因此生产服务处理不可信大量键时，不能把这个小函数当作抵御哈希洪泛的安全设计。"
        }
      ]
    },
    {
      "id": "chain",
      "title": "分离链接：同一桶中的每个候选仍要比较原键",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/hash-lru/core.ts",
          "purpose": "哈希表完整实现。set 先更新已有键，必要时双倍扩容并重新分桶；get/delete 在桶内逐项检查原键。",
          "kind": "excerpt",
          "code": "export class ChainedMap{\n  private buckets:Entry[][]=Array.from({length:4},()=>[]);\n  size=0;\n  comparisons=0;\n  rehashed=0;\n  constructor(private hash:(key:string)=>number=hashString){}\n  get capacity(){return this.buckets.length;}\n  private bucket(key:string){return this.buckets[(this.hash(key)>>>0)%this.capacity];}\n  get(key:string):number|undefined{\n    for(const item of this.bucket(key)){this.comparisons++;if(item.key===key)return item.value;}\n    return undefined;\n  }\n  set(key:string,value:number){\n    const bucket=this.bucket(key);\n    for(const item of bucket){this.comparisons++;if(item.key===key){item.value=value;return;}}\n    if((this.size+1)/this.capacity>0.75){\n      const old=this.buckets;this.buckets=Array.from({length:this.capacity*2},()=>[]);\n      for(const chain of old)for(const item of chain){this.bucket(item.key).push(item);this.rehashed++;}\n    }\n    this.bucket(key).push({key,value});this.size++;\n  }\n  delete(key:string):boolean{\n    const bucket=this.bucket(key);\n    for(let i=0;i<bucket.length;i++){this.comparisons++;if(bucket[i].key===key){bucket.splice(i,1);this.size--;return true;}}\n    return false;\n  }\n  snapshot():Entry[][]{return this.buckets.map(chain=>chain.map(item=>({...item})));}\n  assertInvariant(){\n    let n=0;const seen=new Set<string>();\n    this.buckets.forEach((chain,index)=>{for(const item of chain){\n      if(seen.has(item.key)||(this.hash(item.key)>>>0)%this.capacity!==index)throw new Error('bucket invariant');\n      seen.add(item.key);n++;\n    }});\n    if(n!==this.size)throw new Error('size invariant');\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "每个桶是一个 Entry 数组。get 逐项比较 item.key===key，找到才返回值；没有找到返回 undefined。set 先在旧桶里寻找已有键，找到就覆盖且不增加 size；只有新键才判断扩容并插入。这个顺序很重要：若每次修改值都先增加 size 或扩容，计数和容量会与真实条目数量脱节。"
        },
        {
          "type": "paragraph",
          "text": "删除时也要找到相同键，只移除那一项；删除整个桶会把碰撞的其他键一起丢掉。本例桶使用数组，所以 splice 还会移动桶内后继项，成本与桶长相关，不单单是一次引用修改。snapshot 返回副本，防止观察界面的赋值修改内部 Entry。assertInvariant 检查所有键只出现一次、都处于正确桶，并核对总数。"
        }
      ]
    },
    {
      "id": "load",
      "title": "负载因子控制平均拥挤，扩容必须重新分桶",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "负载因子 α=size/capacity，是每个桶的平均条目数。本例新键加入后若超过0.75，就先把桶数加倍。假设散列分布足够均匀，桶内候选的期望数量受 α 控制；在键长度固定的模型中，一次普通查询平均可以接近常数成本。这个假设是结论的一部分，不是表里写了0.75就自动成立。"
        },
        {
          "type": "paragraph",
          "text": "扩容时不能只在后面补几个空桶，因为位置是 hash%capacity，容量变了位置也可能变。代码遍历所有旧 Entry，按新容量重新计算桶；此时不改变 size，不重复调用会触发阈值判断的 set。容量4时放 A、B、C仍为4；更新 A 不扩容；再放新键 D会变8，并迁移原3项。测试直接断言这条路径。"
        },
        {
          "type": "paragraph",
          "text": "倍增与上一篇动态数组有相似的摊还思路：触发扩容时容量至少按倍数增长，历次迁移的总条目数为几何级数。在每个键哈希成本有界的前提下，这部分对连续插入的总成本线性。但插入前查找重复键仍可能受碰撞影响，所以不能据此无条件宣布整张表的每次 set 都是摊还 O(1)。"
        },
        {
          "type": "paragraph",
          "text": "把100个不同键都交给 hash=()=>0，所有条目在同一桶。即使扩容后负载低于0.75，查一个不存在的键仍要比较100次，最坏 O(n)。我们的测试精确检查比较次数，而不通过计时猜测退化。常数哈希是受控反例，用来揭示分布假设；它不是在模拟某个真实引擎的 Map 实现。"
        }
      ]
    },
    {
      "id": "lru-policy",
      "title": "LRU 的“使用”需要先定规则",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "缓存和持久存储的职责不同：缓存只保留一部分可再次获取的数据，淘汰意味着不再保留本地副本，不等于删除业务记录。LRU 按最近一次访问排序，并不是按写入时间淘汰的 FIFO，也不等于达到时间就失效的 TTL。一个条目可以很久以前写入，却因为刚刚读过而暂时保留。"
        },
        {
          "type": "paragraph",
          "text": "本例规定 get 命中会刷新位置，get 未命中不改变顺序，put 新值和更新已有值都刷新位置，peek 只观察不刷新。容量0合法，始终不存；返回值0也合法，不能用 if(value) 判断是否命中。用 undefined 表示未命中的前提，是缓存值不允许 undefined；若以后开放任意类型，应该提供 has 或带 found 的结果。"
        },
        {
          "type": "figure",
          "src": "figures/hash-lru/mechanism.svg",
          "title": "碰撞与最近使用顺序是两种不同关系",
          "alt": "左侧常数哈希让A/B/C同处0号桶但仍是独立键；右侧容量2依次put A、put B、get A、put C，顺序从MRU到LRU，最终淘汰B",
          "caption": "左侧常数哈希让A/B/C同处0号桶但仍是独立键；右侧容量2依次put A、put B、get A、put C，顺序从MRU到LRU，最终淘汰B。图中是本示例数据与逻辑关系，不代表 JS 引擎内存布局或计时结果。"
        },
        {
          "type": "paragraph",
          "text": "假设容量2，先 put(A,1)，链为 A；再 put(B,2)，链为 B→A；get(A) 后变为 A→B；put(C,3) 后先成为 C→A→B，再淘汰尾部 B，结果 C→A。若实现只在首次插入时排序，最后被淘汰的就会是 A，那是 FIFO 行为，和本文承诺不同。"
        }
      ]
    },
    {
      "id": "lru-implementation",
      "title": "Map 定位，双向链表移动：保持同一批节点",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "typescript",
          "filename": "examples/hash-lru/core.ts",
          "purpose": "LRU 全部实现，含构造校验、摘链、头插、读取、窥看、更新、淘汰及结构断言；节点由同一 Map 与链共同引用。",
          "kind": "excerpt",
          "code": "type CacheNode={key:string;value:number;prev:CacheNode|null;next:CacheNode|null};\nexport class LRU{\n  private nodes=new Map<string,CacheNode>();\n  private head:CacheNode|null=null;\n  private tail:CacheNode|null=null;\n  constructor(readonly capacity:number){if(!Number.isSafeInteger(capacity)||capacity<0)throw new RangeError('capacity must be a nonnegative safe integer');}\n  get size(){return this.nodes.size;}\n  private detach(node:CacheNode){\n    if(node.prev)node.prev.next=node.next;else this.head=node.next;\n    if(node.next)node.next.prev=node.prev;else this.tail=node.prev;\n    node.prev=null;node.next=null;\n  }\n  private front(node:CacheNode){\n    node.prev=null;node.next=this.head;\n    if(this.head)this.head.prev=node;else this.tail=node;\n    this.head=node;\n  }\n  get(key:string):number|undefined{\n    const node=this.nodes.get(key);if(!node)return undefined;\n    this.detach(node);this.front(node);return node.value;\n  }\n  peek(key:string):number|undefined{return this.nodes.get(key)?.value;}\n  put(key:string,value:number):string|undefined{\n    if(this.capacity===0)return undefined;\n    const existing=this.nodes.get(key);\n    if(existing){existing.value=value;this.detach(existing);this.front(existing);return undefined;}\n    const node:CacheNode={key,value,prev:null,next:null};this.nodes.set(key,node);this.front(node);\n    if(this.size>this.capacity){const victim=this.tail!;this.detach(victim);this.nodes.delete(victim.key);return victim.key;}\n    return undefined;\n  }\n  keys():string[]{const keys:string[]=[];for(let p=this.head;p;p=p.next)keys.push(p.key);return keys;}\n  assertInvariant(){\n    let count=0,previous:CacheNode|null=null;\n    for(let p=this.head;p;p=p.next){if(p.prev!==previous||this.nodes.get(p.key)!==p||++count>this.size)throw new Error('links invariant');previous=p;}\n    if(count!==this.size||previous!==this.tail||this.size>this.capacity||this.head?.prev||this.tail?.next)throw new Error('cache invariant');\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "节点带 prev 和 next，Map 保存 key→节点引用。命中后不用从头找位置，直接 detach 修复左右邻居，再 front 放到头部。头节点、尾节点和唯一节点都由同一组分支处理：摘掉唯一节点时 head 与 tail 都变 null；头插时原表为空则 tail 也指向新节点。先把这两个小操作写对，比在 get/put 里散落四套指针逻辑更容易验证。"
        },
        {
          "type": "paragraph",
          "text": "核心不变量有三条：Map 中每个键恰好对应链上一个节点；链的 head.prev 与 tail.next 为空，相邻引用互相对得上；size 不超过容量。淘汰要同时摘链和 nodes.delete，漏一个都会出错：只删 Map 会留下永远走不到的索引，或者链里还有幽灵节点；只摘链则 Map 仍把已淘汰项当成命中。测试在每一步后检查两个结构一致。"
        },
        {
          "type": "paragraph",
          "text": "摘链与头插只修改常数条引用，这部分严格是 O(1)。但总访问还依赖 Map 的定位成本。ECMAScript 要求 Map 的平均访问随元素数量呈次线性，并不指定必须用哈希表或每次常数时间。用常见哈希索引的平均模型，可以说 LRU 平均 O(1)；不能把它升级成语言标准保证的最坏 O(1)。keys、snapshot 和断言都要遍历，另计 O(n)。"
        }
      ]
    },
    {
      "id": "failure",
      "title": "失败与边界：容量、顺序和并发各有自己的问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "容量1特别适合抓指针错误，因为每次新键都要淘汰原来唯一的节点。容量0则必须在插入之前返回，避免刚插入又依赖空尾节点清理。负数、小数、NaN 和无穷容量在构造时拒绝。缓存不会因为参数不合法而悄悄变成无限存储；上层还应根据真实内存预算设置合理上限，安全整数并不等于适合机器容量。"
        },
        {
          "type": "paragraph",
          "text": "此实现的同步 get/put 在单个 JS 调用中完成，没有 await。但是“先查缓存，未命中就异步加载，再写回”是另一个协议：多个调用可能同时未命中，造成缓存击穿；较早请求也可能更晚覆盖新结果。LRU 的链表正确，并没有解决请求合并、版本校验或并发授权。不要在异步加载前后各调用一次方法，就宣称整段业务具有原子性。"
        },
        {
          "type": "paragraph",
          "text": "缓存键还必须包含数据身份。若把不同用户、租户或语言的结果都放在同一个键 report 下，再正确的淘汰算法也会返回错数据。键规范化、隔离和读取权限应由业务边界负责；共享缓存命中不代表已经授权。这里示例只用公开数字，避免让一个教学数据结构承担并未实现的安全保证。"
        }
      ]
    },
    {
      "id": "lab",
      "title": "通过碰撞、访问顺序与差分模型验证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "experiment",
          "id": "hash-lru",
          "title": "哈希与 LRU 交互实验",
          "description": "切换常数哈希后依次放A/B/C/D，看碰撞和扩容；下方用相同键值操作独立LRU，观察命中、peek、更新与淘汰。"
        },
        {
          "type": "paragraph",
          "text": "碰撞模式切换会重置哈希表，避免同一份旧桶用新哈希计算后再也找不到键。先放 A=0 和 B=2，读 A必须得到0，删除 A后B仍存在。再添加 C、D，观察容量增长和桶链。下方将容量设2，按上一节序列操作；peek B后位置不变，get B则会移动。每个按钮执行一步，当前容量、顺序与结果都会保留。"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端 · 独立复现",
          "purpose": "下载 ZIP 解压后进入目录执行；应看到 9 项通过。浏览器交互由文末实验入口打开。",
          "kind": "runnable",
          "code": "cd hash-lru\nnode --version # v22.12.0\nnpm ci --ignore-scripts\nnpm test\n# tests 9; pass 9; fail 0"
        },
        {
          "type": "paragraph",
          "text": "在 macOS 14.5、Node.js 22.12.0 运行9项测试通过。哈希表用普通和全碰撞函数各做5000次动作，与 Map 的键值语义对照；LRU用0/1/2/7容量共6000次动作，对照一个易检查的顺序数组模型。另测0值、空键、__proto__、Unicode、快照隔离以及扩容。差分参照不是速度基准，多个模型一致也不能代替对不变量的解释。"
        }
      ]
    },
    {
      "id": "production",
      "title": "把教学缓存扩展到工程前，还要明确哪些预算",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "按条目数限容不等于按字节限容，一个大对象可能抵得上几万个小值。正式缓存常需要权重预算、过期清理、命中与淘汰统计，甚至防止大批一次性扫描把热点挤掉。LRU只是一个可解释的基线，不是所有工作负载的最佳策略。选择别的策略之前，应先记录访问分布和内存占用，而不是因为名字更复杂就替换。"
        },
        {
          "type": "paragraph",
          "text": "本例无 TTL，也没有定时器；不要把放入100个键后内存看似稳定，写成不存在泄漏的证明。测试证明的是条目数和引用结构符合约定。本文让你分清了键定位与访问顺序，下一篇则进一步利用有序性：当数据已经排序，怎样用不断缩小的区间准确找到第一次、最后一次出现的位置。"
        },
        {
          "type": "reference",
          "title": "Open Data Structures：分离链接哈希",
          "url": "https://opendatastructures.org/ods-python/5_1_ChainedHashTable_Hashin.html",
          "note": "用于核对分离链接、负载与分布假设；本文哈希不是随机通用哈希。"
        },
        {
          "type": "reference",
          "title": "ECMAScript：Map 的语义与平均访问要求",
          "url": "https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects",
          "note": "Map 的平均次线性要求，不能据此宣称所有操作最坏常数时间。"
        },
        {
          "type": "reference",
          "title": "Node.js 22.12.0：测试运行器",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/test.html",
          "note": ""
        }
      ]
    }
  ]
};
export default article;
