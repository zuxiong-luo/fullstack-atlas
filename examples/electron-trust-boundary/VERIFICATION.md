# Electron实际验证记录

日期2026-10-23。设备：macOS14.5 (23F79)，Intel x86_64；终端Node22.12.0。

## 版本与安装来源

- npm官方registry稳定latest实际核对为Electron45.0.0，已精确锁定package和lockfile。
- npm安装和`npm audit --json`均成功，审计当前报告0 vulnerabilities。这不是永远无漏洞的声明。
- 该版本npm包首次运行才下载二进制。官方GitHub资产HEAD正常，但本机实际大文件传输180秒只到111KB/119MB，未运行不完整文件。
- 随后从知名npm镜像的相同版本资产取得ZIP，并**先逐字节计算SHA-256，与官方npm Electron45包内checksums.json比较通过后才解压和执行**。
- 官方匹配值（darwin-x64 ZIP）：`7877c282e74a52f8d87949536a25735cf9982de1265b544c9cd258dd14eff4de`。
- 未关闭TLS验证、沙箱、contextIsolation或webSecurity；没有接受系统安全绕过。

官方依据：

- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/process-model
- https://www.electronjs.org/docs/latest/tutorial/sandbox
- https://www.electronjs.org/docs/latest/tutorial/context-isolation
- https://www.electronjs.org/docs/latest/api/context-bridge
- https://www.electronjs.org/docs/latest/tutorial/ipc

## 普通Node测试：已执行通过

`npm test`：5项通过。真实临时文件验证：来源/主frame/URL策略、严格参数、路径越界、外部URL白名单、角色权限、原型字段、主进程并发槽位、目标不覆盖、符号链接不跟随、已销毁窗口、目录错误的稳定返回。

故障用例会在终端打印预期的EEXIST目录错误日志；返回对象中没有内部路径。测试最后自动清理临时目录。

这些测试中的Ipc事件是普通对象，故不作为真实隔离证据。

## 真正Electron smoke：已执行通过

`npm run smoke`启动官方checksum匹配的真实桌面运行时，日志：

```json
{"electron":"45.0.0","chrome":"156.0.8078.48","node":"24.22.0","platform":"darwin","arch":"x64","boundary":{"require":"undefined","process":"undefined","api":["exportReport","openHelp"]}}
```

实际断言：

- BrowserWindow设置nodeIntegration=false、contextIsolation=true、sandbox=true；renderer主世界require/process为undefined。
- 通过真实renderer按钮触发preload与IPC；主进程创建完整summary.csv，内容与34字节结果一致，renderer状态文字更新。
- 实际IPC拒绝finance、../outside与重复目标。
- 第二个真实webContents加载相同URL，仍不能调用可信窗口能力，返回UNAUTHORIZED。
- 主进程只返回有限字段；真实窗口内容截图显示成功状态。
- 额外smoke核对popup/导航拒绝与未映射atlas资源404（最终记录以输出的checks列表为准）。

窗口内容截图保存到文章资源`public/figures/electron-trust-boundary/runtime-smoke.png`。另外两张SVG已实际光栅化检查，中文与标签可读，不含假造耗时。

## 仍未验证/未实现

- 没有人工原生鼠标/键盘与辅助功能全流程、真实保存对话框、系统外链浏览器交接测试；本例固定应用导出目录，不提供保存对话框。
- 没有Windows/Linux设备、签名、公证、安装器、自动更新或生产认证验收。
- 没有验证不同文件系统/网络盘hard link语义、断电持久性、恶意同OS用户替换目录和完整攻击面。
- 大数据取消、进度、恢复与配额未实现；当前只有固定小报表、单任务槽位。
- 页面iframe来源拒绝的策略有普通Node测试；smoke真实来源拒绝验证的是另一个webContents，不能说已用真实恶意子frame运行所有攻击。
