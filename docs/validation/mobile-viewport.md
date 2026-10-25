# 手机视口与缩放限制验证

核验日期：2026-10-25。

## 问题与处理

用户截图中内容左侧被截断，页面可以横向移动。桌面浏览器在同等手机视口下，登录前后均未复现根文档横向溢出，不能据此断定 iPhone 上的唯一成因。原移动端专栏搜索框只有 12px；输入焦点触发的 Safari 自动放大是需要排除的因素。

本次修改：

- 视口设置固定初始、最小、最大比例为 1，并声明 `user-scalable=no`。
- 页面及其滚动容器使用 `touch-action: pan-x pan-y`，保留单指上下、左右滚动，限制页面双指缩放和双击放大。
- 补充 Safari 的 `gesturestart`、`gesturechange` 和多指 `touchstart`、`touchmove` 取消处理；事件监听明确为非 passive。单指、点击、输入、选择和桌面键盘事件不拦截。
- 手机宽度或触屏设备上的表单字号至少为 16px，大字号模式继续按根字号放大，避免输入框因文字过小触发自动缩放。
- 保留站内小／中／大字号。未以 `overflow-x: hidden` 掩盖布局问题，未禁用代码块内部横向滚动。

实现入口：`src/lib/viewport.ts`、`src/main.tsx`、`src/styles.css`、`index.html`。

## 自动检查

- `npm test`：12 个文件、60 项测试通过。新增 3 项覆盖 Safari 手势、多指取消、单指及普通交互保留、全部监听清理。
- `npm run build`：通过；沿用现有资源生成与离线清单检查，239 个文章下载引用、152 个图形引用、410 处正文源码、97 个 ZIP 验证通过。大 bundle 体积提示仍存在。

## 浏览器检查

环境：macOS 上 Codex 内置浏览器，检查本地生产构建。以下为桌面浏览器视口模拟，未冒充 iPhone 真机。

- 已登录专栏：320、360、375、393、414、760、1280px，分别切换小／中／大字号，共 21 组。所有根文档 `scrollWidth === innerWidth`。
- 未登录专栏：320、393px，三档字号，共 6 组，无根文档横向溢出。
- Fiber 文章：320、393px，中／大字号，共 4 组，无根文档横向溢出。393px 的正文代码区宽 361px，长代码内容宽 550px，`overflow-x: auto`，`touch-action: pan-x pan-y`。
- 首页：320、393px，大字号，无根文档横向溢出。
- 393px、中字号的专栏搜索框为 16px；搜索 Fiber 正常筛选，清空后恢复全部文章，观测到视口比例为 1。
- 登录表单、导航展开、站内字号切换、登录与退出交互正常。没有修改访问控制、笔记、文章内容或离线数据。

## 限制与资料

尚未执行 iPhone Safari 真机的输入法弹出、双指、双击、横竖屏及“添加到主屏幕”模式验证。桌面视口检查与事件单测不能替代这些手势验收。

浏览器或系统的强制缩放／辅助功能可以覆盖页面声明，跨域 iframe 内部也有独立的手势处理；本次控制站点自身页面，不承诺覆盖系统设置。参见 [MDN viewport](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport) 与 [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)。
