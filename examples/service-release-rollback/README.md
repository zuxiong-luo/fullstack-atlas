# 反向代理发布：先验候选，再切流，最后验证与回滚

目标Linux隔离VM、CPython3.12.14、nginx系统二进制与GNU timeout。不需要Docker或systemd操作；作者mac未装nginx，本机仅语法/guard77；修后真实隔离CI已全部通过：Ubuntu24.04.5、kernel6.17.0-1022-azure、Python3.12.14、Nginx1.24.0。NGINX实际版本由nginx -v输出，参考官方proxy与信号控制文档。

```sh
timeout --signal=TERM --kill-after=25s 120s bash examples/service-release-rollback/verify-linux.sh
```

CI可安装nginx包，但脚本本身不安装/停止系统nginx、不写/etc/nginx、不发systemctl。普通runner启动自己的daemon off master、随机loopback端口、私有prefix配置/pid/log；每次nginx -t/-s reload都显式指向本次prefix/pid，核对pid文件就是自己Popen的PID。只清理自己的子进程/目录，最后确认前端端口可重新bind。

行为：先起v1并走真实NGINX；候选启动42或alive200/ready503都不切流；错误候选配置nginx -t失败不改active；第二候选v2 ready200后，临时配置先-t再原子replace并reload。旧v1请求先明确输出held事件保持在途，再切v2并证实新连接v2，显式释放旧请求后仍返回v1，证明旧请求排空与新流量切换分开。不是sleep猜窗口，也不保证所有生产请求永不断开。

切流后把v2自己的mode.txt改为error，真实业务500而存活仍200；校验并reload上一份配置回滚，新的前端请求恢复v1/200。旧版本在验证结束前保留；只回滚路由配置，不覆盖数据库或用户数据，也没有生产schema兼容性承诺。

backend仅本地教学夹具：最多4个请求线程、接受socket2s期限，hold最多5s，停止放行门并收口；所有绑定127.0.0.1。前端有连接/读/发送期限，nginx worker_shutdown_timeout8s。保留版本号、健康与业务结果，区分进程存活、候选就绪、代理语法、流量后验。没有TLS/公网、真实数据库迁移、零中断SLA或跨机负载均衡。

## 首轮真实失败与修正历史

run40101256933/6ac22f0，Ubuntu24.04.5、kernel6.17.0-1022-azure、Python3.12.14、Nginx1.24.0：preflight_reject与reload_drain通过，随后立即要求入口500失败。观察到一次v2响应并不代表旧worker已经退出；当前加入X-Atlas-Worker实际PID响应头，保存旧PID/start_ticks，在hold释放后等待旧worker身份消失，再检查带新worker身份的v2业务500与存活200。轮询有截止时间，不用sleep宣称切换成立。修后CI已通过，具体证据见下节。

## 文件与源码映射

`.python-version`, `README.md`, `backend.py`, `nginx.conf.in`, `verify-article.py`, `verify-linux.sh`, `verify.py`。无第三方Python依赖；`.python-version`固定作者解释器版本。

仓库中运行 `python3 examples/service-release-rollback/verify-article.py` 核对正文代码连续原文；下载独立包不含文章TS，脚本明确提示跳过映射，不假装已验证正文。

## 修后完整成功

https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101783608 ，23a4808。旧worker3089身份消失，新worker3105；v2业务500/okfalse且响应worker3105，health200；显式rollback后入口v1/200；自己的所有进程、监听与临时prefix清理成功。PID为单次实际输出，测试不硬编码。
