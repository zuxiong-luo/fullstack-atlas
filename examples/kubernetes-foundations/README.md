# Kubernetes基础：控制器、Service、探针与一次失败滚动更新

目标Linux一次性VM、local Unix-socket Docker daemon/cgroupv2、CPython3.12.14、kind **v0.33.0**、kubectl **v1.35.8**。节点显式固定`kindest/node:v1.35.8@sha256:07b2536e30b803ed61d1677a79df6115f798ce64c80f9e22f6ed45afd09323c0`，来自kind官方v0.33 release页；不用该kind默认的1.37。概念资料固定Kubernetes v1.35文档。应用镜像沿独立Dockerfile锁Python3.12.14官方摘要，无第三方Python包。

作者mac没有Docker/SDK集群，仅语法与guard77，不把它算成集群验证；真实kind行为待根隔离CI。CI需下载kind/kubectl与镜像，可用官方release与dl.k8s.io并校验官方SHA256。kind create需要本地Docker权限；不要在用户已有生产集群执行演示。

```sh
timeout --signal=TERM --kill-after=160s 1080s bash examples/kubernetes-foundations/verify-linux.sh
```

脚本拒绝非Linux与远程Docker；随机atlas-lab-k8s-*集群、私有临时kubeconfig、显式context、同前缀namespace。API server只127.0.0.1动态端口；应用只在隔离Docker/Pod网络，不发布公网。创建与删除kind都指定私有kubeconfig，不修改用户默认context。无prune，无枚举删除其他集群。结束删自己cluster（连带namespace/Pod）与自己镜像tag，检查节点container/cluster/tag无残留，临时kubeconfig自删；强杀不保证finally。

实际待验步骤：

1. Docker build → kind create固定节点 → load本机应用镜像 → apply Deployment2副本与ClusterIP Service。imagePullPolicy Never确保使用已装载镜像，非外部registry临时拉取。
2. 等rollout真实成功，从Pod使用真实集群DNS解析notes.namespace.svc.cluster.local，IP等于ServiceClusterIP，再HTTP取得v1。不是前篇手工DNS模拟。
3. 删除自己一个Pod，控制器补足2就绪副本，旧Pod UID消失，ServiceIP不变；Pod替换不等于Service替换。
4. 在自己Pod的/data写一次性unhealthy-once标记，使/health失败；startup时只在真正container重启后消费标记。观察同一PodUID/containerID改变/restartCount增加并重新ready，证明liveness/kubelet重启；不是手工重启后冒称探针生效。该标记只是故障夹具，不是生产错误自动恢复协议。
5. APP_VERSION=v2/APP_READY=0产生Running但NotReady候选，maxSurge1/maxUnavailable0保留旧2就绪端点；20秒progress deadline后状态ProgressDeadlineExceeded，rollout非0，Service仍v1。Deployment**不会因此自动回滚**。
6. 显式rollout undo恢复，再提交v2/ready1并等待成功，两Pod与Service都v2。

Manifest给runAsUser/Group10001与fsGroup10001以写自己的emptyDir；readonly rootfs、drop ALL、no-new-privileges；requests CPU50m/内存64Mi，limits250m/128Mi。requests是调度请求，CPU limit是配额，memory limit可能触发容器OOM，不能互当“预留物理核”。emptyDir sizeLimit不是事务/数据库备份，也不能当成跨Pod共享持久存储；Pod删除会丢失自己的数据。/counter仅单Pod夹具，集群测试只查无状态版本，不宣称Service自动共享计数。

startup/readiness/liveness各有职责：启动期等待、从就绪端点移除、重启容器；Service和Deployment职责不同。没有Ingress、TLS、持久卷、真实多节点故障、云负载均衡/生产安全或跨区域SLA。CI结果返回前文章保持review/集群运行受阻；真实手机不涉及本例。
