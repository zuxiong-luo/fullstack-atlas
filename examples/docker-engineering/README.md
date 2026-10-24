# Docker工程：隔离进程、可写数据与有界失败

目标Linux一次性VM、local Unix-socket Docker daemon、cgroup v2、CPython3.12.14。作者mac无Docker，仅语法/guard77预检；实际容器/资源/信号/OOM验证待隔离CI，不能写成已通过。Docker Engine实际版本由CI docker version记录，不声称mac验证过Linux隔离。

基镜像固定Python3.12.14-slim-bookworm及多架构摘要sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e，2026-10-24从Docker官方registry tag响应Docker-Content-Digest取得。固定摘要保持同一镜像内容，不声称跨CPU架构产生相同二进制。

```sh
timeout --signal=TERM --kill-after=45s 360s bash examples/docker-engineering/verify-linux.sh
```

脚本先拒绝非Linux、远程DOCKER_HOST/非unix context；不使用prune，不改既有镜像/容器/卷/网络。只创建随机atlas-lab-docker-*容器/镜像tag/命名卷，应用只publish127.0.0.1的动态端口。结束按确切名字删除并inspect确认没有残留；外层SIGTERM进入finally，SIGKILL/断电仍无用户态保证。

服务普通UID10001、exec-form CMD成为容器PID1，自行处理TERM。只读rootfs与写/data命名卷分开；tmpfs8MiB、cap-drop ALL、no-new-privileges；128MiB内存且memory-swap同值、0.5 CPU、pids32。不是把这些参数包装成完整沙箱/生产安全加固。verify同时核对inspect和容器内真实cpu.max/memory.max/pids.max，CPU限额不等于独占半个核。

正常流程：v1 HTTP/UID/PID/独立PID namespace；POST/counter写1；docker stop发TERM并退出0；同卷v2读取1并检查v1停止记录。卷持久化不是数据库事务/备份，也不能让两个服务无锁同时写counter.json；本例先停v1再起v2。

失败：APP_START_FAIL=1在监听前退出42；另一个专门容器限制64MiB且无swap扩张，只申请256MiB触发自己的cgroup OOM，要求OOMKilled=true/exit137。它是隔离VM中的有界故障，不对宿主/其他进程做压力测试；若环境不支持这些Linux资源条件，测试失败而非假称通过。Docker HEALTHCHECK/镜像层缓存/数据备份不在本次行为证据中。
