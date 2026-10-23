# 验证记录与实际缺口

2026-10-23，macOS / Node22.12.0。

5项Node测试通过：静态selector/命名targetPort检查、数字端口不可静态判定；实际本机HTTP ready200/alive200与ready503/alive200。

当前环境找不到kubectl/docker/kind/minikube/podman/colima，因此容器构建、Pod部署、EndpointSlice、入口控制器和NetworkPolicy均未验证。这些检查不能标成已完成，文章保持审阅稿。命令与预期判断是演练步骤，没有伪造命令输出。
