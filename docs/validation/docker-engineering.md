# Docker工程验证记录

当前状态：首轮通过、第二轮发现OOM观测缺口；新诊断夹具在23a4808修后完整通过。文章review，聚合由根维护；站点/手机仍待根代理。未修改共享聚合。

## 首轮旧快照真实隔离CI（历史证据）

- 运行：https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40100003555 ，源快照2b75f22，2026-10-24，Docker步骤22秒。
- Ubuntu24.04.5 LTS；kernel6.17.0-1022-azure；CPython3.12.14；Docker28.0.4，cgroupv2。
- 命令：`timeout --signal=TERM --kill-after=45s 360s bash examples/docker-engineering/verify-linux.sh`，退出0。
- 官方Python3.12.14-slim-bookworm固定多架构摘要真实拉取与构建成功。
- 实际容器内cpu.max=`50000 100000`，memory.max=`134217728`，pids.max=`32`；inspect对应配置亦通过。
- UID10001、容器PID1、宿主/容器PID namespace不同；v1写计数1，stop退出0，v2同卷读回1并读取v1 SIGTERM记录。
- APP_START_FAIL真实退出42；独立64MiB限制容器申请256MiB，State.OOMKilled=true、exit137。
- finally删除自己确切命名容器/卷/镜像tag，inspect确认不存在，cleanup complete；不执行prune。基础镜像与构建缓存可保留。

## 本机证据与资料

macOS本机只有Python编译、bash -n与非Linuxguard77；不冒称本机容器验证。基镜像摘要2026-10-24经官方registry tag响应Docker-Content-Digest确认；官方Docker run/Dockerfile/volumes/resource_constraints文档已浏览核对。cgroup语义参考Linux v6.8官方文档。

代码映射7/7、内容strict类型和SVG实际渲染均通过，详见本机最终核对。行为限制：普通UID/只读rootfs/去capabilities不构成完整不可信代码沙箱；JSON replace不是数据库事务或断电备份；CPU配额不等于专用物理核；这次OOM只限自己的小容器，不是宿主压测；SIGKILL/断电不能保证finally。

## 第二轮重现失败（历史）

run https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101256933 ，6ac22f0：cgroup/UID/PID/namespace/volume/信号仍通过，原单进程OOMKilled断言失败，finally仍complete。旧日志缺少State/logs/events，不能判断确切原因。新源码增加完整oom_fixture.py（小PID1观察器+受限分配子进程），保留64MiB且swap.max0、要求分配者-9及真实oom_kill增量，再显式退出137；控制器另严格要求Docker OOMKilled/State137并打印诊断。当时待修后复测；后续真实修后结果见下节。

## 本批本机最终核对

`python3 examples/docker-engineering/verify-article.py`：7块带真实examples路径的正文代码，均为源码连续原文；无伪文件名。四篇单独TypeScript strict/noEmit检查通过。四个bash -n通过，四个非Linux入口均在任何系统/daemon修改前退出77。完整最小服务、输入协议、调用、成功/失败/清理分支均在正文解释。SVG已1100px实际渲染人工检查，public只保留可编辑源文件；此检查不等于站点/手机验收。下载依赖模板nginx.conf.in/workload.yaml.in已通知根加入精确打包白名单，最终ZIP由根验收。

## 修后完整成功（当前）

https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101783608 ，23a4808。环境仍Ubuntu24.04.5/kernel6.17.0-1022-azure/Python3.12.14/Docker28.0.4。OOM memory.max67108864、swap.max0、peak67108864；分配者-9、oom_kill_delta1、Docker State OOMKilledtrue/Exit137，finally cleanup complete。主服务限额/UID/PID/namespace/信号/持久化全部继续通过。观察器的137是验证后显式映射，与“内核杀死PID1”的旧夹具语义不同，正文明确说明；严格OOM证明没有放宽成任意失败。

再次复现：aa5bae3，https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40102026052 ，本例整套再次退出0；源码未改松断言。以各自原始CI详细计数为具体观测值，重复成功不假定毫秒/PID完全相同。
