# C2 事实与证据

2026-10-22，React v18.3.1 old reconciler。正文节选从固定tag源码逐行提取，无伪造源码。上游源码许可MIT，仓库public/sources/react-v18.3.1/LICENSE保留。

|事实|源码位置（packages/react-reconciler/src）|证据边界|
|---|---|---|
|HostRoot先有初始current|ReactFiberRoot.old.js 165–171|与新挂载普通子节点alternate为null不同|
|根准备调用createWorkInProgress|ReactFiberWorkLoop.old.js 1472–1474|初次根渲染也可已有对应节点|
|首次为对应节点分配伙伴、相互连接|ReactFiber.old.js 249–276|非每次深复制整树|
|后续复用并重置动态工作|ReactFiber.old.js 278–309|flags随后保留StaticMask，Lane集合不随意清零|
|child/state/queue沿用引用，dependencies外壳复制|ReactFiber.old.js 306–320|仅准备阶段，后续机制各自修改；firstContext仍沿用|
|useFiber清空index/sibling|ReactChildFiber.old.js 328–335|新关系由协调路径重建，不等于删除算法|
|bailout仍检查孩子工作并可克隆孩子|ReactFiberBeginWork.old.js 3365–3404；ReactChildFiber.old.js 1360–1386|此bailout可重新沿用dependencies；不存在整轮外壳永远不同的保证|
|mutation后current切换，layout之前|ReactFiberWorkLoop.old.js 2150–2178|不是整个commit结束之后，也不是只改指针就改DOM|

来源基址：https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/

## 已执行

macOS x86_64，Node22.12.0。npm ci --ignore-scripts、npm test（3/3）、npm run build全部通过，audit0。测试覆盖：首次创建/再次复用的同一对象引用；引用沿用/外壳复制；未完成拒绝提交；放弃后current/visible不变；下次准备清理临时标记和deletions。

## 教学模型与真实React的界线

模型的commit写visible字符串并改current，既无真实宿主提交，也无布局/passive阶段。模型的abandon只清除work指针；不是React异常恢复实现。flags位为自定，节点计数只统计模型。没有插桩真实Fiber，不声明真实React每次重渲染恰好创建多少对象。浏览器画面、手机图形可读性需要整合验证；无性能结论。
