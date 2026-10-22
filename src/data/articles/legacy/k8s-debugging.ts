import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "k8s-debugging",
  "topic": "operations",
  "title": "从一个 502 出发：沿链路排查 Kubernetes 服务",
  "description": "从入口代理到应用进程，逐层验证地址、端口、就绪状态与资源等待。",
  "minutes": 15,
  "tags": [
    "K8s",
    "Linux",
    "Docker",
    "排障"
  ],
  "scope": "通用 Kubernetes 排障流程；入口控制器、权限与集群配置可能不同。",
  "prerequisites": [
    "容器与进程",
    "Service 与 Pod 的基本关系"
  ],
  "questionIds": [
    "k8s-probes",
    "k8s-release",
    "linux-debug",
    "docker",
    "node-backpressure"
  ],
  "sections": [
    {
      "id": "evidence",
      "title": "先确定错误是谁返回的",
      "paragraphs": [
        "浏览器看到 502，只能说明某个网关未得到可接受的上游响应。它不能直接证明应用代码报错，也不能证明数据库不可用。先确认响应来自哪个代理、是否只有某条接口失败，以及故障开始时间。",
        "记录请求路径、关联 ID 和时间范围，再对照部署变更、代理日志和应用日志。立即重启可能暂时恢复服务，也可能抹掉关键现场。",
        "排查的目标是缩小范围：客户端 → 入口代理 → Service → 就绪端点 → Pod 端口 → 应用 → 下游依赖。每走一步都要寻找支持或否定假设的证据。"
      ]
    },
    {
      "id": "routing",
      "title": "Running、Ready 和业务可用是三件事",
      "paragraphs": [
        "Pod 的 Running 阶段不等于应用已就绪。先看副本与重启次数，再看事件、退出原因和探针结果，确认它是否被作为可用后端接收流量。",
        "核对 Service selector 是否选中了目标 Pod，targetPort 是否匹配实际监听端口，以及应用是否只监听了容器内的回环地址。错误的路由关系无法靠重启解决。",
        "以下命令使用占位名称，需替换为实际命名空间和资源名；命令输出可能包含内部信息，不应原样公开。"
      ],
      "code": "kubectl -n <namespace> get pods -o wide\nkubectl -n <namespace> describe pod <pod>\nkubectl -n <namespace> logs <pod> --since=10m\nkubectl -n <namespace> logs <pod> --previous\nkubectl -n <namespace> get svc,endpointslices",
      "language": "shell"
    },
    {
      "id": "probes",
      "title": "探针不是同一项检查复制三次",
      "paragraphs": [
        "readiness 决定应用是否适合接收流量；liveness 用于识别需要重启恢复的情况；startup 为初始化较慢的应用提供启动阶段的保护。三者回答的问题不同。",
        "如果短暂的数据库不可用直接导致所有应用存活检查失败，集体重启可能使恢复更困难。就绪检查同样需要权衡：是否某个非核心依赖失败就应该移除整个实例？",
        "健康端点正常也不保证每条业务路径正确。还需要实际请求的错误率、延迟和关键业务监控来判断发布是否健康。"
      ]
    },
    {
      "id": "resources",
      "title": "CPU 不高，也可能是资源问题",
      "paragraphs": [
        "连接池、文件描述符、数据库锁和磁盘 I/O 等待都可能让接口慢，而 CPU 使用率并不高。应对齐同一故障时间窗口，检查应用和下游的等待。",
        "容器的资源限制与宿主机整体资源不同。宿主空闲时，容器仍可能受到 CPU 限流或内存限制。查看 OOM、退出码、事件和实际限制，比只看一张宿主 CPU 图更可靠。",
        "大文件、媒体处理和日志写入还可能争用磁盘。定位时要区分事件循环执行慢、外部进程抢资源和依赖服务慢，解决方式并不相同。"
      ]
    },
    {
      "id": "release",
      "title": "把排障结果变成发布改进",
      "paragraphs": [
        "若故障与发布相关，检查新副本就绪、旧副本排空、代理超时和终止宽限期。长任务与普通 HTTP 请求需要不同的退出策略。",
        "回滚应用镜像不等于回滚数据库。迁移要考虑新旧版本短时间并存，采用兼容性演进并保留验证步骤。",
        "恢复后，记录触发条件、关键证据、处理动作和预防措施。好的复盘能让下一次相似故障更快定位，而不只是留下“重启恢复”四个字。"
      ]
    }
  ],
  "references": [
    {
      "title": "Kubernetes：探针",
      "url": "https://kubernetes.io/docs/concepts/workloads/pods/probes/"
    },
    {
      "title": "Kubernetes：Service 排障",
      "url": "https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
