# 网络分层排查：验证记录

2026-10-24。文章`network-troubleshooting`状态review。**mac可移植预检与Ubuntu隔离CI各10/10通过；仍review等图/站点最终验收。**

## 环境与已完成

实际本机：macOS14.5 x86_64、CPython3.12.14（Clang22.1.3）；Python链接OpenSSL**3.5.8 25 Aug2026**，命令行openssl为**3.6.1 27 Jan2026**。二者不是同一版本，记录时没有混写。

示例包括DNS UDP A/IN报文子集、loopback TLS1.3/HTTP夹具、完整分层诊断CLI和10项测试。DNS明确为模拟协议子集，不验证系统递归解析器；TCP连接、TLS验证、HTTP状态和响应读取使用真实协议栈。证书临时生成且只显式传给本次客户端，不安装系统CA，不改hosts/resolv.conf/路由/防火墙。

实际浏览核对固定规范RFC1035、RFC9293、RFC8446、RFC9110/9112（文本版）；OpenSSL3.0 req文档；Python3.12 SSL说明。正文约3860字符，不含代码，完整展示dns_wire.py、diagnose.py、fixtures.py、verify-linux.sh，4个filename源码块与实际文件逐字相等。独立index导出operationsExpansionArticles，未接共享聚合。

## 本机实际命令和结果

在examples/network-troubleshooting：

```sh
/Users/luozuxiong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 test_network.py
```

最终结果：**10/10通过**，真实CLI子进程也使用同一sys.executable。覆盖全链路成功、DNS NXDOMAIN/无响应、TCP拒绝、TLS未知CA/主机名不匹配、HTTP404/503/读取超时、恢复、CLI退出0/2和夹具清理。

测试实际JSON摘要包括：

```json
{"case":"success","layers":["dns","tcp","tls","http"]}
{"case":"tcp_refusal","failed_layer":"tcp","recovered":true}
{"case":"hostname_mismatch","failed_layer":"tls","recovered":true}
{"case":"http_404_503","failed_layer":"http","recovered":true}
```

测试断言TLSv1.3与HTTP200；HTTP超时保留已通过TLS证据；失败后用正确受控输入重新全链路验证。恢复不是“生产故障已永久解决”的声明。预检发现mac对绑定未listen的端点返回超时，因此改为先预约后释放的真正未绑定端点；最终拒绝连接断言通过。释放端口存在被其他进程抢占的极小窗口，隔离CI降低竞争，意外被抢占应使断言失败，不接管任何已有服务。

另完成CPython3.12.14语法编译、Bash语法、源码映射**4块匹配**、定向TypeScript无诊断。两张运维SVG均实际Quick Look渲染并人工查看1100px图，图形为结构示意；预览只保留ignored work，不加入public发布。

`bash examples/network-troubleshooting/verify-linux.sh`在mac只返回**77**与Linux保护提示，没有触发网络设置修改。它不算Linux验收。

## LinuxCI要求与历史

目标Ubuntu24.04、Python3.12.14、OpenSSL3与GNU timeout；无第三方Python包，不需sudo或外网DNS。

```sh
timeout 90s bash examples/network-troubleshooting/verify-linux.sh
```

Linux入口将打印Python、Python链接OpenSSL、命令行OpenSSL与uname-r，并在60秒总期限内运行同10项真实本地实验与源码映射。根代理隔离首轮run40093602682已报告失败但尚无可读详细日志；在拿到实际Linux分步输出前，不推断网络步骤是否已运行或通过。这是首轮当时的排障状态；最终成功结果见下方，不继续作为当前受阻声明。

## 范围与未验证

没有真实公网DNS递归/缓存、IPv6、DNSSEC、CNAME、TCP回退、代理/CDN、HTTP2/3、公网丢包或生产负载实验。连接超时不等于已证明防火墙原因，TLS身份失败不靠关闭验证修复，HTTP503不等于前面全部网络失败。每操作timeout不同于全链路硬期限，响应体读取限制4096字节；未知程序异常不做笼统吞掉。浏览器/手机、ZIP离线独立运行也未在本轮作者侧验收。

## 当前最终Linux结果：Success

[run40097929509](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509)，head bea07732405b0faf0375adce85e3e242f8d0cb87。普通无strace完整job约30秒，两套脚本依序均0；网络10/10真实Linux本地实验通过并清理。实际Ubuntu24.04.5 LTS、CPython3.12.14、kernel6.17.0-1022-azure；OpenSSL命令行/链接库补丁未从该版本输出摘录，不借用上方mac的3.6.1/3.5.8。DNS模拟子集/真实TCP-TLS-HTTP边界不变。状态由受阻更新为Linux执行验收通过，仍review待最终图/站点；没有手机或公网结论。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
