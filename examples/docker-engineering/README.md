# Docker工程：隔离进程、可写数据与有界失败

目标Linux一次性VM、local Unix-socket Docker daemon、cgroup v2、CPython3.12.14。作者mac无Docker，本机只有语法/guard77预检；真实隔离CI已全部通过：Ubuntu24.04.5、kernel6.17.0-1022-azure、CPython3.12.14、Docker28.0.4。Docker步骤22秒，源快照2b75f22，运行 https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40100003555 。

基镜像固定Python3.12.14-slim-bookworm及多架构摘要sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e，2026-10-24从Docker官方registry tag响应Docker-Content-Digest取得。固定摘要保持同一镜像内容，不声称跨CPU架构产生相同二进制。

```sh
timeout --signal=TERM --kill-after=45s 360s bash examples/docker-engineering/verify-linux.sh
```

脚本先拒绝非Linux、远程DOCKER_HOST/非unix context；不使用prune，不改既有镜像/容器/卷/网络。只创建随机atlas-lab-docker-*容器/镜像tag/命名卷，应用只publish127.0.0.1的动态端口。结束按确切名字删除并inspect确认没有残留；外层SIGTERM进入finally，SIGKILL/断电仍无用户态保证。

服务普通UID10001、exec-form CMD成为容器PID1，自行处理TERM。只读rootfs与写/data命名卷分开；tmpfs8MiB、cap-drop ALL、no-new-privileges；128MiB内存且memory-swap同值、0.5 CPU、pids32。不是把这些参数包装成完整沙箱/生产安全加固。verify同时核对inspect和容器内真实cpu.max/memory.max/pids.max，CPU限额不等于独占半个核。

正常流程：v1 HTTP/UID/PID/独立PID namespace；POST/counter写1；docker stop发TERM并退出0；同卷v2读取1并检查v1停止记录。卷持久化不是数据库事务/备份，也不能让两个服务无锁同时写counter.json；本例先停v1再起v2。

失败：APP_START_FAIL=1在监听前退出42；另一个专门容器限制64MiB且无swap扩张，只申请256MiB触发自己的cgroup OOM，要求OOMKilled=true/exit137。它是隔离VM中的有界故障，不对宿主/其他进程做压力测试；若环境不支持这些Linux资源条件，测试失败而非假称通过。Docker HEALTHCHECK/镜像层缓存/数据备份不在本次行为证据中。

实际CI：cpu.max=50000 100000、memory.max=134217728、pids.max=32；UID10001/PID1/不同namespace；卷值1；启动退出42；OOMKilled=true且exit137；最后cleanup complete。固定摘要的基镜像真实拉取、构建成功。这是一次隔离Linux行为验证，不是生产容量、镜像漏洞扫描或跨平台实测。

## 重复运行暴露的边界与当前复测状态

run40101256933（6ac22f0）中资源、UID/PID与持久化仍通过，但旧单进程OOMKilled断言失败；当时未输出足够State/logs/cgroup事件，不能提前归因swap或MemoryError。当前新增oom_fixture.py：低内存PID1观察器在同一64MiB cgroup内启动分配子进程，记录前后memory.events/max/swap.max/peak，严格要求分配者SIGKILL与oom_kill增量，再显式映射夹具退出137。控制器另查OOMKilled并输出State/logs，最多5秒等待Docker状态反映事件，不接受任意失败。此新源码仍待隔离复测，前一成功不替代修后验收。
