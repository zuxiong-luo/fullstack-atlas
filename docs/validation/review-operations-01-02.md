# Linux 与网络两篇独立交叉审校

2026-10-24。审稿者为 Node/Next/WebGL 示例作者，只读原作者文章、示例和图形；不以作者侧测试代替独立复现。

## 本次实际读取与复现

完整阅读 `linux-services`、`network-troubleshooting` 正文、README、验证记录及配套实现：服务/信号/proc 检查、systemd 两套 unit、有限期限编排与严格清理、DNS 子集、真实 TCP/TLS/HTTP 夹具及故障测试。检查两张 SVG 的方向、状态标签与正文代码对应关系；未自行再次进行浏览器像素或手机验收。

本机 macOS 14.5 x64、CPython 3.12.14，独立执行：

- `examples/linux-services/tests/test_cleanup.py`：**3/3 模拟回归通过**，全部系统账户命令被 mock，不改宿主账户或服务。
- `examples/network-troubleshooting/test_network.py`：**10/10 通过**。DNS 为明确限定的 UDP A/IN 模拟子集；TCP、TLS 1.3、HTTP 和 CLI 为真实本机协议栈。
- 两个 `verify-article.py`：**6/4 块连续原文映射通过**。

没有在 macOS 上执行 Linux 专用 proc/systemd 操作，也没有将保护退出 77 或上述 mock 标为 Linux 实测。

## 独立核对 Linux 证据

通过 GitHub 公开 API 实际查询 [run 40097929509](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509)：head 为 `bea07732405b0faf0375adce85e3e242f8d0cb87`，结论 `success`；job `120883980572` 的 systemd 生命周期和 DNS/TCP/TLS/HTTP 恢复步骤均为 `success`。匿名详细日志下载没有取得，故不声称自行读过完整 Linux stdout。

根代理另提供实际运行输出的环境与断言范围：Ubuntu 24.04.5 LTS、systemd 255.4-1ubuntu8.17、kernel 6.17.0-1022-azure、CPython 3.12.14；proc/信号 3 项、模拟清理 3 项、user/system 两套启动→健康/MainPID/cgroup→TERM→失败 42/有限重启→恢复→严格清理，以及网络 10 项依序通过。这些详细断言证据与本次独立 API 成功状态分开记录，未自行重跑该 CI。

作者保留早期失败历史，同时已回填当前成功状态。修复普通 runner 对 0700 runtime 目录的错误读取时使用 `sudo test -S`，没有放宽目录权限；strace 观察到 useradd 复制 Rust 工具文件，显式空 skel 后普通 CI 成功，不能把早期 lastlog 猜测改写为已证根因。Linux OpenSSL 具体补丁尚未摘录，未用 mac 数值填充。

## 正确性与边界

核对 systemd 255 service 文档、Python 3.12 signal/ssl 文档及网络规范。Type=exec 不等于业务 ready；线程有独立 TID、共享进程 TGID；TERM 的用户态清理与 KILL 绕过 finally 明确区分。编排只操作本次随机用户、unit、home、runtime，核对账户身份；部分 useradd 超时仍清理，失败不假报 complete。system/user manager 与 system unit 的 User= 没有混淆。

网络案例逐层保留已完成证据，连接超时不直接推断防火墙；名称不符、未知 CA 不靠关闭证书校验修复；HTTP 404/503 不抹去前面的 TCP/TLS 成功。读取最多 4096 字节，各操作 timeout 明确不等于全链路硬期限。DNS 子集没有冒充系统递归解析、DNSSEC 或公网探测。临时证书不装系统 CA、不改 hosts/路由/防火墙。

审稿发现网络正文一处仍写“Linux 版仍等 CI”，已反馈原作者并确认改为 mac 观测与 Linux 独立成功分别记录。其余历史段落均明确是当时状态。

结论：**在已声明实验范围内未发现剩余阻断性机制、源码或证据一致性问题**。仍不覆盖生产服务加固、任意 Linux 发行版、容器内 systemd、高可用、公网 DNS/CDN/HTTP2/3、手机原生环境；图形真实浏览器/手机及下载离线发布由根代理另验。
