# trees-heaps-recursion 作者验证

2026-10-24，status review，待独立内容审稿与站点/浏览器集成。

## 真实环境与执行

macOS14.5 x64，Node22.12.0 / TypeScript5.7.3 / React18.3.1。`npm ci --ignore-scripts`实际清洁安装12包，audit0；`npm test`先生成App与tsc，再运行Node测试：**10/10通过**。

200浅随机树递归独立参照；2万节点深链显式帧成功、递归预算失败；环/共享/空树；堆6000混合操作对排序多重集合，每步不变量；不同规模底向上建堆比较≤2n。

固定树4(2(1,3),7(null,9))：先序4,2,1,3,7,9；中序1,2,3,4,7,9；后序1,3,2,9,7,4；层序4,2,7,1,3,9。heapify7,2,9,1,5,3得到1,2,3,7,5,9，逐次pop1,2,3,5,7,9。

树有限数值，null为空；对象身份共享/成环拒绝，不按相等值去重。递归预算0..256，根深度0，超出预算主动报错，不冒充V8实际栈上限。堆有限数值、空pop/peek返回undefined，不承诺相等任务稳定。

遍历本身O(n)、显式深度帧O(h)，输出O(n)，公开API防御Set另O(n)不可忽略；层序队列保留O(n)引用。堆peekO(1)，push/pop键比较O(log n)，建堆O(n)；values/assertInvariant为O(n)观察。JS数组容量管理不属键比较承诺。

## 正文与资源

正文约三千汉字（不含代码），先概念再机制与失败。**5/5块真实连续原文**核对一致。core.ts原文嵌入App；测试确认仅React导入，浏览器不需要相对模块。下载ZIP/README路径已设置，无examples重复前缀。各分类index、共享实验注册/打包/工作流未修改，由根整合。

两张SVG有效XML；渲染/人工检查完成情况见交付补记。官方/原作者资料实际浏览：https://opendatastructures.org/ods-java/6_Binary_Trees.html; https://opendatastructures.org/ods-cpp/10_1_Implicit_Binary_Tree.html; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion。未将扩展论文的特定比较常数或不同算法效果套到本实现。

## 未验证

作者没有冒称真实浏览器点击、390px手机、原生设备或线上发布。父代理做交互/下载/离线/路由验收后另记。CPU数学/性质验证不等于用户页面操作已通过；无生产吞吐/延迟结论。

## 本次最终图形与静态复核

两张原始SVG各嵌入1000方形预览外框，Quick Look实际栅格化并逐张人工查看，箭头、下标、值和标签无溢出；外框只为预览，不改发布源。预览位于/tmp/atlas-alg-batch2-render，不进仓库。独立内容类型检查无诊断。CPU测试之后未改算法；正文源码再次核对连续一致。浏览器与手机仍待根代理。
