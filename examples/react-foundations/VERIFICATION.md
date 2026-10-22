# 标杆验证记录

日期：2026-10-22。正文id：react-foundations。定位为七篇系列第1篇审阅稿。

## 环境与自动验证

- React/React DOM 18.3.1、TypeScript 5.7.2、Node.js 22；依赖使用package-lock.json。
- npm ci成功；npm test七项通过。使用真实React DOM与jsdom，不是手写React模型。
- 覆盖：值更新与函数更新、受控搜索、父子回调与派生统计、稳定ID的状态及DOM身份保留、下标key反例、过滤卸载、父级key重置。
- 示例npm run build通过；不把jsdom验证当成布局、绘制或性能证据。

## 事实核对与范围

概念对照官方文档：state-as-a-snapshot、render-and-commit、preserving-and-resetting-state、choosing-the-state-structure。当前官网文档可能显示新版本，实验仍锁定18.3.1，没有使用React19专属API。

正文不宣称某次render一定产生DOM变化、key可以跨父级保存状态、setter返回可等待Promise、或者状态一定存在函数局部变量里。示例不启用StrictMode以便集中观察，正文说明开发检查，不建议业务关闭StrictMode。

图形为概念示意，不是线程或性能时间线。统计为全部books的已读数量，搜索只影响显示数量。行草稿在卸载后丢失是实验约定；真实产品若要求保留，需要提升或持久化草稿数据。

## 浏览器与离线范围

本站实验室执行单文件App.tsx，完整项目下载包含安装与测试命令。图形、文章与实验代码由站点构建进入离线资源；Node依赖需另行安装。此记录不宣称业务数据持久化，不记录虚构耗时或优化收益。

## 本次实际浏览器检查

生产构建通过，主站28项测试通过。127.0.0.1:4173上实测：A标已读后统计1；稳定ID反转后A草稿保留；过滤A再恢复时草稿空、已读保留；下标key反转后A草稿出现在B；从0开始值更新结果1、函数更新结果3，快照报告均为0。三张SVG实际打开检查，390px视口整页scrollWidth为390，长代码/表格局部滚动。

本次只检查新增资源进入离线构建清单，没有重新执行断网测试，不把资源清单检查写成断网实测。
