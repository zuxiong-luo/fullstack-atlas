# linear-data-structures 作者验证记录

日期：2026-10-24。状态：待独立审校与站点集成验收，源文章为 review。

## 环境与真实命令

macOS 14.5；Node.js v22.12.0；TypeScript 5.7.3；React/React DOM 18.3.1。依赖版本与package-lock.json相同。

先生成锁文件并执行首轮测试，再从锁文件进行实际清洁安装及最终检查：

```sh
npm ci --ignore-scripts --prefix examples/linear-data-structures
npm test --prefix examples/linear-data-structures
```

本次清洁安装12个包成功，审计0告警。build重新生成App.tsx并严格TypeScript编译；测试 9/9 通过，无跳过。本站 `npx tsc --noEmit` 也通过。耗时只由测试工具打印，不用于文章性能结论。

## 机制与失败证据

两结构各3000次操作、5000次FIFO/LIFO动作；每步比较模型与不变量。追加4096项逐前缀验证copies<2N；50次头插搬移1225次。回绕扩容序列逻辑2/3/4/5/6，复制4项；删除唯一节点后复用，非法下标与交叉括号均覆盖。

App.tsx由core.ts原文和视图模板合成，只import React；测试逐字验证这一关系。正文 5 块实际源码是对应core.ts的连续原文，已逐项校对，不把终端命令计入源码映射。

## 图形与资料

mechanism.svg通过XML解析，并用Quick Look实际渲染后查看。为避免Quick Look裁切，临时预览增加画布高度，不改变仓库SVG。检查标签、箭头与正文/代码过程一致；未发现溢出。图内槽位/引用/区间只表达教学关系。

已浏览Open Data Structures相应作者章节、ECMAScript对应Array/Map条目；归并/二分另外核对Princeton algs4固定提交7bb62c32f03fec900f0cc796a548ab992feffe4e。官方Princeton网页抓取403后改用作者GitHub固定提交源码，未把失败抓取记为读过。引用链接均在正文，代码是独立TS实现，不复制他人整段实现。

## 范围与交接

Vector/SinglyList/Stack/RingQueue和括号匹配均为真实被测TS。slot只是教学模型，不是V8内存；快照和不变量检查单计O(n)，无缩容、并发阻塞或可靠存储。

浏览器交互与390px视口由主代理集成后另记，作者未执行这些检查，不以编译和CPU结果替代。ZIP与离线资源采用站点现有打包器，本作者交付源码/README/锁文件；最终生成包内容检查由集成方完成。本次不提交/推送，也没有改共享聚合或站点鉴权。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
