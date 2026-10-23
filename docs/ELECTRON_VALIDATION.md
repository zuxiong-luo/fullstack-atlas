# Electron专题升级记录

2026-10-23。旧文8分钟概览，只有preload短片段，缺完整主进程、调用者、输入/权限/路径实现、运行环境与真实验证。现在已重写为完整本地CSV导出专题，保留文章ID、原五个section锚点、研习关联；status为review。

交付：

- `src/data/articles/legacy/electron-trust-boundary.ts`：概念/作用→进程与上下文→窗口配置→窄API→来源/格式/角色/路径→完整写入→UI→边界与验证。全部关键生产文件在正文，来源链接只用于核对。
- `examples/electron-trust-boundary/**`：Electron45.0.0锁定；main、隔离preload、renderer、严格策略、无覆盖文件发布、5项策略/真实文件测试、真实Electron smoke和运行说明。
- `public/figures/electron-trust-boundary/**`：两张可编辑SVG及真正Electron运行截图，已实际查看渲染。

实际设备macOS14.5 Intel x64；终端Node22.12.0；真实Electron45.0.0、Chromium156.0.8078.48、内嵌Node24.22.0。5项普通测试通过，真实Electron smoke通过。官方GitHub下载速度受阻后使用同版镜像ZIP，先对照官方npm包checksums.json验证SHA-256再解压执行，未降低TLS/沙箱防护。准确checksum和测试边界在示例VERIFICATION.md。

安全实现明确：nodeIntegration=false、contextIsolation=true、sandbox=true；固定atlas协议资产映射；权限、窗口/导航/webview拒绝；contextBridge只暴露2个业务方法；主进程检查可信webContents、mainFrame与URL；严格reportId、角色表、主进程选目录；临时文件O_EXCL/O_NOFOLLOW，完整写后link无覆盖发布；错误返回不泄露绝对路径。

限制：真实smoke不代替人工原生交互/无障碍、跨OS、签名或生产系统验收；未做长任务取消、更新程序、完整认证或断电一致性。普通Node事件对象测试不冒充真实隔离，实际第二个webContents拒绝与renderer无Node能力单独记录。

下载ZIP/离线资源注册与站点视觉由主任务整合，不能把GitHub Pages说成能直接运行Electron。
