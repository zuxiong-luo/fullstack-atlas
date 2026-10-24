# 分层网络排查：本地DNS子集、真实TCP/TLS/HTTP

**Ubuntu24.04.5隔离CI与mac可移植预检各10/10通过。** Linux证据来自真实CI，不把mac预检替代Linux。Linux脚本在mac先退出77，不修改宿主网络配置。

固定协议资料：DNS RFC1035、TCP RFC9293、TLS1.3 RFC8446、HTTP语义RFC9110、HTTP/1.1消息RFC9112；工具资料OpenSSL3.0与Python3.12。实际Linux为Ubuntu24.04.5、CPython3.12.14、kernel6.17.0-1022-azure；OpenSSL具体补丁尚未摘录，不使用mac版本冒充。

## CI

无需第三方Python依赖、外网DNS、付费服务、Node包或现有主机。依赖Python3.12、openssl、GNU timeout；网络实验不需要sudo。Linux专用验证：

```sh
timeout 90s bash examples/network-troubleshooting/verify-linux.sh
```

脚本打印Python、Python链接OpenSSL、命令行OpenSSL与内核版本，再在60秒总期限内运行10项真实夹具测试。每个网络操作和CLI子进程另有期限。所有服务器只绑定127.0.0.1动态端口，证书为临时文件，不安装CA，不改hosts/resolv.conf/路由/防火墙。mac作者仅直接运行`python3.12 test_network.py`做可移植检查，未越过Linux入口。

## 文件与简化边界

- `dns_wire.py`：DNS UDP A/IN报文教学子集。校验事务ID、标志、问题和固定A答案。不是生产DNS客户端，不含递归、缓存、DNSSEC、AAAA、CNAME与TCP回退。
- `fixtures.py`：本机UDP DNS响应子集、临时自签名证书、真实TLS1.3/HTTP服务，及独立启动CLI。DNS明确为模拟；后面TCP/TLS/HTTP由真实系统库与协议栈执行。
- `diagnose.py`：完整分层探针CLI，输出JSON与退出0/2；保留已通过checks，错误指出failed_layer。
- `test_network.py`：10项正常/故障/恢复/退出码/清理断言。
- `verify-linux.sh`：Linux保护和有界运行；`verify-article.py`在仓库核对正文真实连续源码，独立ZIP缺正文时明确跳过映射。

连接拒绝夹具先申请临时端口后释放，再连接未绑定端点；隔离VM减少被抢占概率。若另一个进程恰好占用，断言会失败，而不会接管或杀其他进程。作者预检曾发现“绑定但不listen”在mac表现为超时，已改为真正未绑定端点；最终10项通过，Linux语义仍等CI确认。

## 手动运行

在`examples/network-troubleshooting`目录运行，下载ZIP则进入解压目录：

```sh
lab_state=$(mktemp -d /tmp/atlas-lab-network.XXXXXX)
python3 fixtures.py --state "$lab_state" &
lab_pid=$!
# 看见event=ready后读取manifest（不要用固定sleep猜就绪）
dns_port=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["dns_port"])' "$lab_state/manifest.json")
tls_port=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["tls_port"])' "$lab_state/manifest.json")
python3 diagnose.py --dns-port "$dns_port" --port "$tls_port" --cafile "$lab_state/cert.pem"
python3 diagnose.py --dns-port "$dns_port" --port "$tls_port" --cafile "$lab_state/cert.pem" --path /unavailable
kill -TERM "$lab_pid"
wait "$lab_pid"
rm -rf -- "$lab_state"
```

fixture最多60秒，支持TERM/INT清理。它生成一天有效、SAN为atlas.test的证书和私钥，只供本次显式信任。独立脚本运行时请使用新建临时state目录，不指向已有业务目录。

正常输出摘要：`ok=true`，checks依次含dns(address=127.0.0.1)、tcp(connected=true)、tls(version=TLSv1.3/hostname_verified=true)、http(status=200)。完整JSON还含body。mac预检实际观察到此结果；Linux待确认。

失败对照，每次在原正常命令后只改一个条件：

| 输入变化 | failed_layer/证据 | 恢复 |
| --- | --- | --- |
| `--name missing.atlas.test` | dns / DnsFailure / NXDOMAIN | 改回atlas.test |
| `--name timeout.atlas.test --timeout 0.1` | dns / TimeoutError，尚无其他checks | 改回可回答名字 |
| `--port manifest中的refused_port` | tcp / ConnectionRefusedError，已有DNS | 改回tls_port |
| 省略`--cafile` | tls / SSLCertVerificationError，已有DNS+TCP | 提供正确实验CA |
| `--server-name wrong.atlas.test` | tls / SSLCertVerificationError | 改回atlas.test |
| `--path /missing`或`/unavailable` | http / 404或503，前三层完成 | 改回/ok |
| `--path /slow --timeout 0.1` | http读取超时，TLS已完成 | 自动测试放行Event后重试 |

HTTP故障也输出有效JSON，但退出2；它不是“HTTP没响应”的同义词。timeout是相应操作等待限制，不是全链路总期限。body读取上限4096字节，超过视为工具容量失败。

## 工具补充与解释

在Linux中可用有限期限的OpenSSL/curl额外交叉看证书与状态（仅供手动观察，CI主断言来自Python）：

```sh
timeout 5s openssl s_client -connect "127.0.0.1:$tls_port" -servername atlas.test -CAfile "$lab_state/cert.pem" -verify_return_error -verify_hostname atlas.test -tls1_3 </dev/null
curl --noproxy '*' --resolve "atlas.test:$tls_port:127.0.0.1" --cacert "$lab_state/cert.pem" --max-time 3 -i "https://atlas.test:$tls_port/ok"
```

这类命令必须在fixture尚未停止、变量仍有效时运行。curl的resolve绕开解析而保留逻辑主机身份，不能作为本例DNS模拟服务已通过的证据；不使用`-k`跳过身份验证。curl不是自动验收所需依赖。

## 验证范围

10项测试覆盖：全链路成功、DNS不存在/无响应、TCP拒绝、TLS未知CA/主机名错、HTTP404/503/读取超时、每种故障后正确输入恢复、真实CLI退出码、证书删除与监听关闭。没有公网丢包、IPv6、代理/CDN、操作系统递归DNS、HTTP2/3、生产负载或手机验收。CI回来后记录run链接、Linux版本和实际结果。

## 当前LinuxCI结果

[run40097929509](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509)，head bea07732405b0faf0375adce85e3e242f8d0cb87，两套Linux脚本依序返回0；本网络脚本实际10/10通过并完成资源清理。DNS是本地UDP A/IN模拟，TCP/TLS/HTTP由真实OS协议栈完成；不扩张为系统递归DNS/公网/CDN/手机验收。仍review等最终图形与站点。
