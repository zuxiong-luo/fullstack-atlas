import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "algorithms-invariants",
  "topic": "algorithms",
  "title": "算法不是背模板：复杂度、不变量与边界测试",
  "description": "用二分、滑动窗口和 BFS 建立推导方法，把答案落实为可以运行和验证的代码。",
  "minutes": 8,
  "tags": [
    "算法",
    "二分",
    "BFS",
    "动态规划",
    "复杂度"
  ],
  "scope": "二分示例可复制到 JS 实验室；其余练习需自行实现并验证前提。",
  "prerequisites": [
    "数组、Map、Set",
    "循环与递归"
  ],
  "sections": [
    {
      "id": "s11-300677",
      "title": "先表达输入、输出和约束",
      "paragraphs": [
        "解题前写清楚数据是否有序、是否允许重复、数值范围、空输入如何处理。相同题目在这些条件变化后可能需要完全不同的方法。例如滑动窗口依赖窗口性质可以随指针移动维护，带负数的和约束通常不能直接套用全正数方案。",
        "复杂度不仅看代码有几层循环。两个指针各最多移动 n 次，嵌套写法也可能是 O(n)；递归要计算每层工作量与分支数。空间复杂度包括递归栈、辅助容器和输出之外需要保留的数据。"
      ]
    },
    {
      "id": "s14-350134",
      "title": "二分的核心是保持一个区间约定",
      "paragraphs": [
        "以 lower_bound 为例，目标是找到第一个大于等于 target 的位置。使用左闭右开区间 [lo, hi)，并保持 lo 左侧都小于目标、hi 及其右侧都不小于目标的边界含义。每次更新必须缩小区间，结束时 lo 就是插入位置。",
        "mid 小于 target 时可以排除 mid 及左侧；否则 mid 仍可能是答案，所以把 hi 移到 mid。若随意混用闭区间和半开区间，很容易死循环或漏掉最后一个值。"
      ],
      "code": "function lowerBound(values, target) {\n  let lo = 0, hi = values.length;\n  while (lo < hi) {\n    const mid = lo + Math.floor((hi - lo) / 2);\n    if (values[mid] < target) lo = mid + 1;\n    else hi = mid;\n  }\n  return lo;\n}\nconsole.log(lowerBound([], 3));          // 0\nconsole.log(lowerBound([1, 2, 2, 4], 2)); // 1\nconsole.log(lowerBound([1, 2, 2, 4], 9)); // 4",
      "language": "js"
    },
    {
      "id": "s14-340944",
      "title": "滑动窗口与动态规划从状态出发",
      "paragraphs": [
        "最长无重复子串可以维护窗口内字符的最近位置，遇到重复字符时让左边界向右移动且不回退。正确性来自“当前窗口无重复”这个不变量；如果只记一个全局 Set 而不维护窗口，无法解释字符离开窗口后的行为。",
        "动态规划则先定义状态意义，再写转移和初始条件。零钱最少数量可以定义 dp[s] 为凑出金额 s 的最少枚数；不可达状态设为无穷，dp[0]=0。循环顺序会影响是否允许重复使用物品，不能只背一段双循环。"
      ]
    },
    {
      "id": "s13-272646",
      "title": "BFS、队列与图的访问状态",
      "paragraphs": [
        "无权图中 BFS 按层扩展，因此首次到达节点时获得最少边数路径。通常在入队时标记 visited，避免同一节点被不同邻居重复加入队列。边有不同权重时，不能继续用“第一次到达就最短”的无权假设。",
        "JavaScript 数组频繁 shift 可能带来移动开销，可用 head 下标读取队列。DFS 适合连通性、回溯与拓扑相关任务，但深图递归可能栈溢出。选择遍历方式应从问题性质和运行环境出发。"
      ]
    },
    {
      "id": "s10-286076",
      "title": "验证比样例更有说服力",
      "paragraphs": [
        "每个算法至少覆盖空输入、单元素、重复、极端边界和不满足前提的输入。随机生成小规模数据，与朴素算法做差分对照，能发现手写样例漏掉的问题。性能测试则单独使用大输入，不能用小样例证明复杂度。",
        "练习：给 lowerBound 写 upperBound，再实现一个有重复边的无权图 BFS。验收时解释区间不变量和入队标记，而不是只贴运行输出。二分必须事先有序；若每次都先排序，整体成本还包含排序。"
      ]
    }
  ],
  "questionIds": [
    "algorithms-invariants-binary",
    "algorithms-invariants-bfs"
  ],
  "references": [
    {
      "title": "Python bisect：二分边界定义",
      "url": "https://docs.python.org/3/library/bisect.html"
    },
    {
      "title": "MIT：算法课程",
      "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/"
    }
  ],
  "experiment": "js",
  "status": "overview",
  "kind": "overview"
};
export default article;
