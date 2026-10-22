# 标杆批验证记录

日期：2026-10-21。状态：**本地标杆预览，等待读者反馈；未发布。**

## 交付范围

- `react-fiber-scheduling`：完整重写、两张本地SVG、四模式React实验、固定18.3.1源码引用、运行与测量说明。
- `agent-foundations`：完整重写、两张本地SVG、Python与TypeScript完整服务、共享契约/Schema/输入/失败用例、真实HTTP适配器。
- 新渲染模型支持交替段落、列表、代码、图形、表格、提示、近旁引用与实验入口。旧文适配器保留；25篇ID、评论topic与研习关联保留。
- 示例源码白名单打包为ZIP供下载；浏览器实验草稿按示例ID独立保存。

## 自动与服务验证

| 对象 | 实际验证 | 结果与边界 |
|---|---|---|
| 主站 | `npm test` | 24项通过：含旧文适配、新块搜索/渲染、图形引用、示例草稿隔离、公开阅读/受限研习、离线缓存恢复 |
| 主站 | `npm run build` | TypeScript及Vite生产构建通过；离线manifest生成。Babel/TypeScript worker大包警告仍存在，是实验室的现有工具依赖 |
| React独立示例 | `npm ci`、`npm test`、`npm run build` | 2项测试与类型/构建通过；SSR检查会出现useLayoutEffect提示，不作为浏览器性能证据 |
| Python服务 | Python3.12.14，`python -m pytest -q` | 36项通过，含共享10用例、本地假HTTP上游；pip check、compileall和Uvicorn真实socket请求通过 |
| TypeScript服务 | Node22.12.0，`npm ci`、`npm run build`、`npm test` | 16项通过，含共享10用例、本地HTTP传输异常/取消；npm start与curl通过 |

两套服务由不同作者实现并交叉审校。已修正尾部换行ID、非标准JSON常量、Unicode trim、Content-Type、内部错误分类等差异。各服务更完整记录见 examples/agent-workshop/*/VERIFICATION.md。

## 浏览器实际验收

在 macOS 的内置浏览器进行：

- 1280px桌面阅读与390×844手机视口：文章、代码、图形正常；手机整页scrollWidth=viewportWidth=390，图形局部横向滚动。放大图形使用原生dialog，关闭返回文章。
- React四模式实际切换并输入：普通、transition、同步反例最终输入和列表参数一致；减少工作量显示40行；同步反例打印同步计算校验值。
- 固定版源码由另一名作者交叉核对。发现并修正时间线图中render/commit重叠。
- 开发预览实际发现并修复静态下载目录与`?raw`示例导入路径冲突。下载源码改用`downloads/`，实验页重新运行通过。
- 文章目录滚动、关联实验链接与图形加载通过；修正桌面目录与实验按钮的重叠。移动端目录保留为可滚动列表。
- 评论topic仍为`article/<id>`，未提交测试评论或修改现有Discussions。

## 离线实际验收

生产预览端口4181，先以已有本地展示账号登录并一键下载。页面确认保存45项资源，约8.9MiB。manifest检查覆盖四张SVG、两个源码ZIP和React运行时，不包含node_modules、.venv、密钥文件。

随后**停止本次启动的4181服务器**：此前未打开的Agent第一章能打开并完整刷新，四个图形节点（正文及放大副本）加载成功；此前未访问的React实验页能加载Babel/运行时、运行并输入`offline`，最终显示输入/列表参数一致。服务关闭模拟的是站点源不可达，不是切断整台电脑网络；外部评论和参考链接不属于离线保证。

验收后恢复预览服务供读者查看。源码压缩包包含可阅读/下载文件，不包含Python/Node依赖包；首次安装依赖仍需网络。服务器项目不能在浏览器沙箱中执行。

## 尚未声称完成的事项

- 没有调用真实付费模型，没有模型准确率、成本或性能数据。
- React浏览器行为已验收，但未采集五组Performance样本、没有INP或性能提升数值。
- 没有真实手机硬件测试；手机检查是390px浏览器视口。
- 本批不包含后续23篇重写及Flutter/RN/Electron/K8s专用环境验收。
- 标杆等待用户对深度与表达的反馈，仍为review状态；没有推送或检查新线上版本。
