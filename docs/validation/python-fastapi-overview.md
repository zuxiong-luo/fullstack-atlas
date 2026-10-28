# Python 新版标杆：FastAPI 总览

日期：2026-10-28。当前交付新版14篇目录中的第9篇，另外13篇仍待编写。旧九篇继续撤下，不恢复旧正文或用规划数量冒充文章数量；当前全站109篇。

## 内容与边界

- 稳定ID：`python-fastapi-overview`，16个章节锚点。
- 从Node.js/NestJS经验出发，先解释框架定位、组件职责、能力边界和核心API，再进入最小应用、完整报价接口和双端对照。
- 关键Python与NestJS文件全文放在正文；源码片段与仓库文件由构建检查核对。官方链接用于核对与注明来源。
- 两张本地SVG解释组件关系与正常/失败响应路径。依赖不被画成“所有输入校验成功后才运行”的错误固定顺序。
- 报价是本地演示，不接数据库、不提交任务、不扣费、不调用模型。`response_model`的投影和输出校验、普通注解不校验、JSON `30.0`解析差异都使用实际测试验证。

## 环境与可复现验证

本机macOS14.5 x86_64、CPython3.12.14、Node22.12.0、TypeScript5.7.2。FastAPI0.162.0、Starlette1.10.0、Pydantic2.14.1、Uvicorn0.54.0、NestJS10.4.22。依赖完整锁定，项目详见`examples/python-node-course/VERIFICATION.md`。

1. 源码目录运行`npm test`：1项真实Nest HTTP测试，遍历14组共享输入，通过。
2. Python运行`python -m unittest discover -s 09-fastapi-overview -v`：7项应用行为测试、1项真实双端HTTP测试，共8项通过。
3. 双端测试真实启动Uvicorn及Nest，14组输入各发到两个进程，共28次报价请求；成功、422、409与预期一致。`{"seconds":30.0}`的FastAPI422/Nest200是明确保留的语言差异。
4. 将构建生成的`downloads/python-node-course.zip`解压至全新目录：22个源文件逐字节对应原项目，包含锁文件、共享JSON、测试与说明，不包含虚拟环境、node_modules、dist和缓存。
5. ZIP解压目录创建独立Python虚拟环境，按requirements.lock安装；另行`npm ci --ignore-scripts`。随后重新执行Node与Python全部测试，结果与源码目录一致。
6. 站点`npm test`最终快照：14个文件、67项通过。`npm run build`通过，交付检查覆盖235个下载入口、151个图形引用、395处源码节选、98个引用ZIP。大包体积提示仍保留。

## 浏览器检查

在本机内置浏览器实际打开构建预览，检查以下行为：

- 1280像素桌面：标题、正文、目录跳转、代码语法高亮（849个token节点）、两个本地图形、giscus讨论框加载正常。
- 1280×1100视口完整打开两张SVG，检查箭头方向、框内标签和底部说明，无溢出；放大和关闭可用。
- 393×852手机视口：document宽度与视口均为393，页面无整体横向溢出；长代码只在代码区滚动。图形可以局部横向滚动，放大弹窗保留关闭入口。
- Python分类显示1篇实际文章与13篇待编写；`Annotated`可搜索到本篇；旧`python-fastapi`地址显示撤稿提示并链接新文。
- 系列序号仍为9/14，但显式注明已发布1篇；没有链接到不存在的相邻文章。

本次手机检查是浏览器视口验收，不替代iOS/Android真机或系统浏览器矩阵。

## 离线与限制

正文进入应用包，本地SVG、示例下载进入现有离线清单。服务端项目运行需要另外安装Python/Node及锁定依赖；Swagger UI默认CDN资产不随本站离线包缓存。`/docs`返回200不等于断网交互文档已可用。

NestJS10.x教学对照安装时存在7项依赖告警（4 moderate、3 high），已在示例验证记录说明，没有声称生产安全审核通过。未验证Windows、容器、生产负载或付费模型。新增Linux CI任务独立安装并运行相同用例，实际运行结论以对应发布工作流为准。

发布时需检查Pages实际资源、两张SVG、下载ZIP逐文件内容与离线清单，不以git push成功替代线上验收。

## 实际发布结果

实现提交：`f782bff0d8428ac40c39c5d26792133172b7622b`。

- [Pages发布40631620148](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40631620148)：build与deploy成功。
- [示例CI 40631620156](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40631620156)：新增fastapi-overview任务在Ubuntu24.04通过；既有Python和5组Node回归也通过。
- 线上主脚本`assets/index-B5KJNVvd.js`、样式`assets/index-CPoJcVX6.css`、sw.js及两张SVG与本地构建逐字节相同。
- 下载ZIP共25个条目（含目录），文件集合和每个文件内容均与已验收下载包一致。
- 线上离线清单版本`2f90c79ddcb870de`，1548个资源，文件集合与本地相同，包含新增SVG及python-node-course下载。
- [线上文章](https://zuxiong-luo.github.io/fullstack-atlas/#article/python-fastapi-overview)。线上浏览器导航超时，本次不宣称做过线上交互复验；本地同构建页面已完成上述桌面和手机视口检查，线上采用实际资源内容核对。
