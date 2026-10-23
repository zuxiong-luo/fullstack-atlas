# Kubernetes请求链排障演练

Node22标准库，无npm依赖，`node --test test.mjs`执行5项本地测试。

完整集群步骤与三个故障见站内同ID文章。需要独立实验集群、容器运行时、kubectl和实际安装的入口控制器；先确认context，不触碰业务namespace。资源使用atlas-debug-lab，镜像atlas-debug:local必须自行构建并加载。ingress.json保留IngressClass占位，必须按实际环境配置后才可apply。

JSON是Kubernetes接受的声明格式。只apply明确的namespace.json/deployment.json/service.json，不对本目录整体apply，package.json不是Kubernetes资源。

未实际运行集群；静态检查不能证明数据平面、探针传播、Ingress或NetworkPolicy工作。测试不把模拟输出当作kubectl结果。Dockerfile为固定教学版本，生产另按支持周期和安全修订选择镜像。
