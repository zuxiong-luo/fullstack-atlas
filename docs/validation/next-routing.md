# next-routing 核验记录

日期 2026-10-24。状态 review，作者只提交自己的内容、示例和图形，主代理负责站点整合。

## 环境与真实命令

macOS 14.5 x64；Node 22.12.0、Next 16.4.2、React/React DOM 19.3.1、TypeScript 5.7.2。cacheComponents 默认关闭，webpack，构建 worker=1。

- `npm run build --prefix examples/next-routing`：成功，根入口静态，/notes/[id] 动态，/api/ping 动态。
- `npm test --prefix examples/next-routing`：**4/4**，真实生产 HTTP 与 RSC，4321，结束清理服务与临时目录。
- 独立临时 package.json/lock 的 `npm ci --dry-run --ignore-scripts` 成功。为节省磁盘，实际构建使用已有同版本375MB依赖的相对 symlink；未声称重新下载后逐包验收。ZIP 不依赖该 symlink，应 npm ci 安装锁文件。

## 用例

1. 普通文档请求有 text/html、布局、Counter初值、n1 正文、客户端脚本资源。
2. RSC n2 返回 text/x-component 与目标数据，无完整DOCTYPE文档；最多跟随3次同源307以兼容16.4.2 _rsc协议。
3. 动态片段选择 n1/n2，unknown显示自定义not-found；流式提交头后可能200，未声称严格所有输入404。
4. JSON端点返回对象，页面同时存在Link和普通a以供浏览器对照。

## 正文、来源和图形

7块带完整examples路径的源代码逐字匹配连续原文；内容独立TypeScript检查通过。tree.svg XML解析通过。正文概念顺序为路由树→文件→动态输入→首次文档→导航→失败→验证。

已浏览核对 Next 官方 layouts-and-pages、linking-and-navigating、not-found、route API；官网当前16.4.3，本文版本明确16.4.2，固定tag https://github.com/vercel/next.js/tree/v16.4.2 并以实际构建/HTTP为行为证据。引用不替代正文关键实现。

## 仍待检查

HTTP/RSC不是实际浏览器：未点击Counter、未完成hydration、未证明共享布局状态保留/重置。需要1280桌面、390手机视口实际检查图片/代码/布局；这些不等于真机。未验Windows、Vercel、多实例、离线运行服务器及生产性能。站点下载/ZIP/离线资源由主代理验收。

## 根代理发布前复核（2026-10-24）

正文图形完成网站1280×800及390×844检查，放大与局部滚动可用；图无正文矛盾、箭头遮挡或文字裁切。安全6/11、Python全前五章33、Next4/5/8真实用例通过；本批六套交付ZIP均解压到新目录，Node实际npm ci（Next另生产build），没有借用作者环境。Next路由另在实际浏览器验证计数2经Link保留、整页a重置0。以上补充作者阶段记录，不替代原文列明的浏览器Cookie策略、原生移动设备、托管平台或分布式边界。冻结站点、离线和发布证据另见批次记录。
