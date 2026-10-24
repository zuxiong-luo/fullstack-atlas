# 反向代理发布：先验候选，再切流，最后验证与回滚

目标Linux隔离VM、CPython3.12.14、nginx系统二进制与GNU timeout。不需要Docker或systemd操作；作者mac未装nginx，没有Linux运行结果，当前仅语法/guard77，真实发布验收待CI。NGINX实际版本由nginx -v输出，参考官方proxy与信号控制文档。

```sh
timeout --signal=TERM --kill-after=25s 120s bash examples/service-release-rollback/verify-linux.sh
```

CI可安装nginx包，但脚本本身不安装/停止系统nginx、不写/etc/nginx、不发systemctl。普通runner启动自己的daemon off master、随机loopback端口、私有prefix配置/pid/log；每次nginx -t/-s reload都显式指向本次prefix/pid，核对pid文件就是自己Popen的PID。只清理自己的子进程/目录，最后确认前端端口可重新bind。

行为：先起v1并走真实NGINX；候选启动42或alive200/ready503都不切流；错误候选配置nginx -t失败不改active；第二候选v2 ready200后，临时配置先-t再原子replace并reload。旧v1请求先明确输出held事件保持在途，再切v2并证实新连接v2，显式释放旧请求后仍返回v1，证明旧请求排空与新流量切换分开。不是sleep猜窗口，也不保证所有生产请求永不断开。

切流后把v2自己的mode.txt改为error，真实业务500而存活仍200；校验并reload上一份配置回滚，新的前端请求恢复v1/200。旧版本在验证结束前保留；只回滚路由配置，不覆盖数据库或用户数据，也没有生产schema兼容性承诺。

backend仅本地教学夹具：最多4个请求线程、接受socket2s期限，hold最多5s，停止放行门并收口；所有绑定127.0.0.1。前端有连接/读/发送期限，nginx worker_shutdown_timeout8s。保留版本号、健康与业务结果，区分进程存活、候选就绪、代理语法、流量后验。没有TLS/公网、真实数据库迁移、零中断SLA或跨机负载均衡。
