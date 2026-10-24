# Kubernetes基础实验验证记录

当前状态：aa5bae3隔离CI已完整成功；文章review，聚合由根维护，站点/手机尚待根验收。

目标：Ubuntu一次性VM、本机Unix-socket Docker/cgroupv2、Python3.12.14、kind v0.33.0、kubectl v1.35.8；显式kindest/node v1.35.8@sha256:07b2536e30b803ed61d1677a79df6115f798ce64c80f9e22f6ed45afd09323c0，官方kind0.33 release真实浏览核对；应用Python官方镜像摘要与Docker例相同。

运行：`timeout --signal=TERM --kill-after=160s 1080s bash examples/kubernetes-foundations/verify-linux.sh`。依赖首次镜像下载；不接触真实公司集群，全部假数据。root维护隔离CI和版本二进制下载校验。

已做：mac py_compile、bash -n、Linux guard77（修改系统/daemon之前退出）；SVG Quick Look1100px实际渲染与人工读图；Kubernetes v1.35 Deployment/Service/probes/resources官方文档浏览。首轮run40101256933在安装工具阶段exit2，尚未进入本例脚本，不能当成集群成功或应用缺陷证据。

设计覆盖（现已真实通过）：固定节点启动/装载、2副本就绪、Pod内实际DNS与Service HTTP、删Pod后新UID补足且ServiceIP不变、同PodUID的真实liveness容器重启、坏ready更新ProgressDeadlineExceeded且旧2ready EndpointSlice继续v1、显式undo、修正v2成功，以及专用cluster/镜像tag/私有kubeconfig清理。

边界：单节点kind不代表云、多节点高可用；emptyDir不是跨Pod共享持久库；请求/限制不是专属物理核；没有K8 OOM、Ingress、TLS、PV或生产SLA实测；不使用默认kubeconfig或prune。源码映射与内容类型本批追加；站点/手机未验收。

## 本批本机最终核对

`python3 examples/kubernetes-foundations/verify-article.py`：7块带真实examples路径的正文代码，均为源码连续原文；无伪文件名。四篇单独TypeScript strict/noEmit检查通过。四个bash -n通过，四个非Linux入口均在任何系统/daemon修改前退出77。完整最小服务、输入协议、调用、成功/失败/清理分支均在正文解释。SVG已1100px实际渲染人工检查，public只保留可编辑源文件；此检查不等于站点/手机验收。下载依赖模板nginx.conf.in/workload.yaml.in已通知根加入精确打包白名单，最终ZIP由根验收。

## 最新完整真实成功（当前）

https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40102026052 ，aa5bae3，2026-10-24。Ubuntu24.04.5、kernel6.17.0-1022-azure、Python3.12.14；kind v0.33.0 go1.26.7 linux/amd64；kubectl/client和server均v1.35.8，固定节点镜像真实使用。

- 2ready，Pod内系统DNS解析Service至10.96.29.100，并真实HTTP读v1。
- 删除Pod后旧UID 50c1dd4e-14ff-44cb-9e8a-a6e512a66474不在新副本，ServiceIP不变。
- 一次性health故障触发同PodUID重启，restartCount1、containerID改变并恢复ready；lastState terminated exitCode0/reasonCompleted。应用TERM能正常退出，因此不写成一定137；不是DockerOOM证据。
- APP_READY0坏rollout ProgressDeadlineExceeded，rollout非0，仍2ready EndpointSlice/v1、auto_rollbackfalse。显式undo后再更新好v2，最终2ready且Servicev2。
- 专用kind集群、应用镜像tag、节点容器、私有临时kubeconfig及目录确认清理完整。
- 同轮Docker新观察器、Nginx worker代际与Linux4项再次全部成功。

根CI曾在工具安装checksum、封装900秒上限等阶段失败，修正后才进入本例；这些是编排历史，不冒称应用脚本已运行。当前成功关闭集群执行受阻，源码未因成功改松断言。
