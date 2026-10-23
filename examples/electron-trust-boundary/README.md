# Electron 权限边界：可运行的报表导出

固定Electron45.0.0，终端工具Node22.12.0。实际设备macOS14.5 x86_64；Electron内部Chromium156.0.8078.48、Node24.22.0。示例采用原生HTML/JS，无大型前端或桌面打包工具链。

## 安装和运行

```bash
nvm use
npm ci
npx electron --version
npm test
npm run smoke
npm start
```

不用nvm时准备对应Node后跳过第一步。45.0.0的npm包可能在首次运行时才下载对应平台二进制，所以先执行版本命令完成运行时准备。没有运行时的smoke会返回明确错误，不在测试里无限等下载。保留HTTPS、官方checksum与沙箱校验；不要用关闭证书或`--no-sandbox`来解决安装问题。

`npm start`显示桌面窗口，角色固定reader。初始ID `summary` 可导出。终端打印主进程选择的目录：`app.getPath('userData')/exports`。返回只含文件名和字节数，不向renderer提供任意文件路径接口。

项目是开发运行实例，没有打包安装器、签名、公证或自动更新。首次npm安装/二进制下载需要网络，运行导出不访问远程服务。帮助按钮经主进程打开固定Electron官方安全文档；自动smoke不打开系统浏览器。

## 正常输入和反例

- `summary`：创建34字节CSV（含两行月度数据），界面显示成功。
- 再次 `summary`：`ALREADY_EXISTS`，文件不覆盖。
- `finance`：格式有效但角色无权，`FORBIDDEN`。
- `../outside` 或任意路径片段：`INVALID_INPUT`。
- 同时调用：主进程槽位使后到请求为`BUSY`。
- 未知webContents、非主frame、非固定URL：`UNAUTHORIZED`。
- 输出目标已是符号链接：不跟随，`ALREADY_EXISTS`；外部文件不变。
- 目录不可用：`IO_ERROR`，内部路径只在终端日志，不返回界面。

默认导出目录中已有文件不会自动删除。若需重复正常导出，可自行管理自己的测试文件，不要在真实数据目录做破坏实验。

## 关键文件

- `main.cjs`：atlas协议只映射三个固定资源，窗口隔离与沙箱、IPC、导航和权限限制。
- `preload.cjs`：只暴露`exportReport(id)`与`openHelp()`，固定通道。
- `policy.cjs`：webContents/mainFrame/URL、严格ID、路径和HTTPS帮助地址校验。
- `export-service.cjs`：固定资源与角色、单任务槽位、临时文件完整写入、hard link无覆盖发布。
- `renderer.js` / `index.html`：界面事件、CSP、textContent反馈。

preload属于渲染进程内的隔离上下文，不是第三个OS进程。

## 验证层次

`npm test`的5项测试在普通Node中验证策略和真实临时文件。它们不证明Electron进程隔离。

`npm run smoke`启动真正Electron45、沙箱renderer与隔离preload，检查主世界require/process不可用、桥接形状、真实按钮/IPC/文件内容、受限资源、越界、重复、另一个同URL真实webContents拒绝、popup/导航阻止、未映射资源404；保存临时窗口截图并输出实际引擎版本。它不需要关闭任何安全设置。

## 限制

reader是固定演示角色，不是完整认证；示例无长任务取消/进度订阅。文件hard link发布在已验证的本地文件系统可用，不承诺所有网络盘。没有fsync断电持久性，也不防御同一个OS用户任意替换应用目录或主进程。强制结束时可残留临时文件；生产导出应另设计清理、配额与任务恢复。

详细测试、二进制校验及尚未验证的平台见`VERIFICATION.md`。
