# React 18.3.1 源码专题核验记录

核验日期：2026-10-22。四篇新增独立文章，本地审阅，尚未发布。原25篇重写清单另行维护。

## 证据方法

- 固定facebook/react的v18.3.1标签，使用该版本默认old reconciler路径。关键论述附近直接链接源文件与实际行号，不使用网页抽取工具的行号。
- 作者完成后由另一位审校者逐项对照源码；主代理整合、复核和运行浏览器实验。
- 结构专题修正Hook定义引用范围、补充无key的index映射来源、明确树图省略main、避免把全部flag解释成纯提交标记。
- Hooks专题明确pending与interleaved、useState eager条件与useReducer区别，补充Hook类型定义链接。
- Lane的官方源码快照经独立下载逐字节核对。SHA256：853884a0e4b5f0bb5fd907291e77854ddc1e1d2b0954986a242707749f2a4690。下载包保留React MIT许可证。
- 工作循环明确completeWork仍属render、layout cleanup可能读到子DOM新内容、passive不固定晚于paint。

## 示例与结果

| 专题 | 示例路径 | 自动验证 |
|---|---|---|
| Fiber结构 | examples/react-fiber-structure | 真实ReactDOM/jsdom，4项：ID重排、下标反例、父key重置、组件类型重置 |
| Hooks队列 | examples/react-hooks-queue | 6项教学模型测试：环形顺序、跳过、基础值与重放等 |
| Lane选择 | examples/react-lane-selection | 6项，含65,536次限定六类Lane组合与固定原函数对照 |
| 工作循环与提交 | examples/react-work-loop-commit | 1个综合真实ReactDOM场景：更新、ref、Effect清理建立、换key、卸载 |

四个项目均有锁文件，完成干净npm ci --ignore-scripts、npm test、npm run build。Node22，React18.3.1；新示例Vite6.4.5/esbuild0.28.2。

## 浏览器实际观察

生产预览端口4183，内置浏览器。Fiber身份实验观察业务ID重排后A=1/B=0；下标key重排后B=1/A=0。Hooks真实React实验逐次重置后，值更新三次=2、函数更新三次=4、延后加十再紧急乘二=22。Lane选择器Default/WIP场景保留Transition A；非Idle全挂起场景不回退Idle。工作循环更新日志显示layout cleanup capturedValue=0，但DOM为数值1，随后layout setup/passive cleanup/passive setup。

检查四篇文章图形入口与放大展示；Hooks重放图、Lane分支图、commit图的文字箭头与正文一致。390px视口Hooks文章document.scrollWidth=390，没有页面级横向溢出；图形使用局部横向滚动。未完成所有设备浏览器组合的视觉验证。

## 站点与离线包

站点24项回归测试通过，构建通过。现有渲染测试扩展到四篇新文，验证章节锚点、图形文件、实验入口、公开内容不泄漏研习答案链接。无配套研习题的新文明确显示整理中。

四个ZIP均包含测试脚本与锁文件；八张SVG、四个ZIP及源码下载进入生产离线清单。Lane包包含LICENSE.react。此轮验证清单与现有Service Worker回归测试，未重新做断网全站下载演练。依赖安装仍需网络或本机包缓存，不宣称ZIP能在全新断网电脑上安装。

## 证据边界

模型不是React完整实现，Lane对照只覆盖文中声明子集；jsdom不是布局/绘制引擎。日志和rAF不能证明paint已经发生。本轮未发布帧率、性能倍数、中断次数或真实设备性能结论。四篇保留审阅状态，读者反馈后再决定发布。

## 源码原位阅读与高亮（2026-10-22）

53处React固定版本正文引用可展开本地源码（10个官方源文件，SHA256与许可保存在public/sources/react-v18.3.1）。范围截取严格跟随原链接，单行或无行号入口显示40行上下文并明确标识，不冒充完整函数。Prism1.30.0为文章代码与展开源码提供语法着色，token以React文本节点渲染，不把源码作为HTML执行。保留原文复制。

26项测试及构建通过；新增测试逐一检查引用资源和行号，验证Flow着色与HTML转义。浏览器验证截图中的mapRemainingChildren引用可展开、包含token与多色文字；10个源码文件和许可均进入离线清单。本轮未再次执行整包断网演练。
