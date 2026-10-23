import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "k8s-debugging",
  "topic": "operations",
  "title": "从一个 502 出发：沿链路排查 Kubernetes 服务",
  "description": "先认识Deployment、Service、EndpointSlice与入口控制器，再沿请求链收集证据；提供完整演练声明、本地HTTP与静态检查，并明确尚未完成集群验证。",
  "minutes": 55,
  "tags": [
    "K8s",
    "Linux",
    "Docker",
    "排障"
  ],
  "scope": "本地应用与静态声明已验证；集群、容器镜像、Ingress控制器和网络策略未实跑，命令为待验证的独立环境演练。",
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
      "title": "Kubernetes服务链是什么：先认识对象，再追踪一次请求",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Kubernetes 用声明描述工作负载和服务关系：Deployment 管理 Pod 副本，Service 为一组后端提供稳定访问约定，EndpointSlice 记录服务发现需要的后端信息；Ingress 描述 HTTP 路由，由实际安装的控制器解释执行。你看到的一个网址，背后是多层配置、进程和网络路径共同工作的结果。"
        },
        {
          "type": "paragraph",
          "text": "排障的作用是用证据逐段缩小范围。收到502，先确定是哪一层返回、它联系了什么上游、联系失败还是上游主动报错，再决定检查哪个对象。502、503、504的具体含义和映射取决于控制器、代理配置与失败阶段；不能把一个状态码直接翻译成“Pod挂了”。"
        },
        {
          "type": "paragraph",
          "text": "本篇提供一个小HTTP应用、Deployment/Service声明和故障演练步骤。当前机器没有kubectl、容器运行时或集群，因此只实际验证了应用HTTP行为和静态连接检查，未声称重现真实集群502。下面集群命令是待运行的演练步骤，判断分支是观察方法，不伪造kubectl实测输出。"
        },
        {
          "type": "figure",
          "src": "figures/k8s-debugging/request-chain.svg",
          "title": "从客户端到应用，每一跳都要有自己的证据",
          "alt": "客户端经入口路由、Service后端发现到Pod应用，每层分别核对响应、路由、EndpointSlice与进程。",
          "caption": "逻辑排查路径。具体代理可直接使用EndpointSlice后端，不要求请求真的经过独立Service进程。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "它能说明什么",
            "它不能单独证明"
          ],
          "rows": [
            [
              "Pod phase=Running",
              "Pod已经进入运行阶段",
              "所有容器就绪、正确监听、业务依赖可用"
            ],
            [
              "Pod Ready",
              "当前就绪条件满足",
              "客户端的DNS/TLS/入口路径正确"
            ],
            [
              "Service",
              "服务选择和端口约定",
              "选中的进程一定提供业务"
            ],
            [
              "Ingress",
              "期望的Host/Path与后端路由",
              "有控制器接管、地址可达或证书正确"
            ]
          ]
        },
        {
          "type": "code",
          "code": "kubectl config current-context\nkubectl get namespaces\nkubectl -n atlas-debug-lab get ingress,svc,pods -o wide\nkubectl -n atlas-debug-lab get events --sort-by=.metadata.creationTimestamp",
          "filename": "终端：第一组只读证据",
          "purpose": "先核对context与命名空间，避免在错误集群排查。命令需你自己的实验集群，本文未执行。",
          "language": "bash",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "收集客户端请求时间、Host、路径、状态、请求ID和发布版本，再去控制器日志中关联同一次请求。响应头里的Server可作线索，不能作为可信的唯一身份认证。如果TLS握手前已经失败，先处理证书/域名链路；不要先在应用日志里找一个根本没到达的请求。"
        }
      ]
    },
    {
      "id": "routing",
      "title": "Service怎样找到应用：完整声明与逐跳验证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "我们让应用监听8080，容器端口命名为http；Service对外声明80，把targetPort指向http。Service selector与Pod标签均为app=atlas-debug。先把这三个关系看完整：标签决定选谁，targetPort决定找哪里，真实进程决定那里有没有服务。containerPort只是声明，不会替Node调用listen。"
        },
        {
          "type": "code",
          "code": "import http from 'node:http';\nexport function createApp({ready=true}={}){\n return http.createServer((req,res)=>{\n  if(req.url==='/ready'){res.writeHead(ready?200:503);res.end(ready?'ready':'not ready');return;}\n  if(req.url==='/health'){res.end('alive');return;}\n  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'atlas-debug',path:req.url}));\n });\n}\nif(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){\n const server=createApp({ready:process.env.READY!=='false'});\n server.listen(Number(process.env.PORT||8080),'0.0.0.0');\n process.on('SIGTERM',()=>server.close());\n}\n",
          "filename": "app.mjs",
          "purpose": "完整最小HTTP应用。/ready和/health分开，业务返回JSON；本地实跑测试覆盖状态，集群行为另行验证。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{\n  \"apiVersion\": \"apps/v1\",\n  \"kind\": \"Deployment\",\n  \"metadata\": {\n    \"name\": \"atlas-debug\",\n    \"namespace\": \"atlas-debug-lab\"\n  },\n  \"spec\": {\n    \"replicas\": 2,\n    \"selector\": {\n      \"matchLabels\": {\n        \"app\": \"atlas-debug\"\n      }\n    },\n    \"template\": {\n      \"metadata\": {\n        \"labels\": {\n          \"app\": \"atlas-debug\"\n        }\n      },\n      \"spec\": {\n        \"containers\": [\n          {\n            \"name\": \"web\",\n            \"image\": \"atlas-debug:local\",\n            \"imagePullPolicy\": \"Never\",\n            \"ports\": [\n              {\n                \"name\": \"http\",\n                \"containerPort\": 8080\n              }\n            ],\n            \"readinessProbe\": {\n              \"httpGet\": {\n                \"path\": \"/ready\",\n                \"port\": \"http\"\n              },\n              \"periodSeconds\": 2\n            },\n            \"livenessProbe\": {\n              \"httpGet\": {\n                \"path\": \"/health\",\n                \"port\": \"http\"\n              },\n              \"initialDelaySeconds\": 5,\n              \"periodSeconds\": 5\n            },\n            \"resources\": {\n              \"requests\": {\n                \"cpu\": \"50m\",\n                \"memory\": \"32Mi\"\n              },\n              \"limits\": {\n                \"cpu\": \"250m\",\n                \"memory\": \"128Mi\"\n              }\n            }\n          }\n        ]\n      }\n    }\n  }\n}\n",
          "filename": "deployment.json",
          "purpose": "完整Deployment，命名空间atlas-debug-lab。镜像atlas-debug:local需先自行构建并加载到实验集群。",
          "language": "json",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{\n  \"apiVersion\": \"v1\",\n  \"kind\": \"Service\",\n  \"metadata\": {\n    \"name\": \"atlas-debug\",\n    \"namespace\": \"atlas-debug-lab\"\n  },\n  \"spec\": {\n    \"selector\": {\n      \"app\": \"atlas-debug\"\n    },\n    \"ports\": [\n      {\n        \"name\": \"http\",\n        \"port\": 80,\n        \"targetPort\": \"http\"\n      }\n    ]\n  }\n}\n",
          "filename": "service.json",
          "purpose": "完整Service，ClusterIP类型默认生效；selector对应Pod标签，http映射到命名端口。",
          "language": "json",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "kubectl -n atlas-debug-lab get svc atlas-debug -o yaml\nkubectl -n atlas-debug-lab get pods -l app=atlas-debug --show-labels -o wide\nkubectl -n atlas-debug-lab get endpointslices -l kubernetes.io/service-name=atlas-debug -o yaml\nkubectl -n atlas-debug-lab describe pod <POD_NAME>",
          "filename": "终端：查选择关系和后端",
          "purpose": "<POD_NAME>换为你实际看到的名称；关注EndpointSlice地址、端口和ready条件，不只看条目存在。",
          "language": "bash",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "实际观察",
            "下一步判断",
            "先别做什么"
          ],
          "rows": [
            [
              "没有符合标签的Pod",
              "核对selector、Pod标签和namespace",
              "不要先改Ingress超时"
            ],
            [
              "有Pod但没有可用后端",
              "查Ready、探针、EndpointSlice端口和控制器事件",
              "不要把Running当就绪"
            ],
            [
              "后端地址/端口存在，Pod请求失败",
              "核对监听地址、端口、进程日志、NetworkPolicy与网络路径",
              "不要从静态containerPort推断已监听"
            ],
            [
              "Pod可达而Service路径失败",
              "查端口映射、DNS/Service数据平面和源位置差异",
              "不要认定一定是应用代码"
            ],
            [
              "Service路径可达而外部失败",
              "回到IngressClass、Host/Path、TLS及控制器上游日志",
              "不要反复重启健康Pod"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "测试来源必须可比。kubectl port-forward会把本机请求转给选中的Pod端口，适合隔离应用自身问题；它没有验证客户端到集群网络、Service转发或Ingress。某台调试Pod能访问，也只证明那个来源的路径，不代表所有NetworkPolicy来源都一样。记录每次从哪里访问、访问哪个地址与端口。"
        },
        {
          "type": "code",
          "code": "kubectl -n atlas-debug-lab port-forward deployment/atlas-debug 18080:8080\n# 在另一个终端访问应用（这不经过Ingress/Service链路）\ncurl -i http://127.0.0.1:18080/ready\ncurl -i http://127.0.0.1:18080/",
          "filename": "终端：单独验证应用",
          "purpose": "先保持port-forward运行；成功只把问题范围缩小到应用之外，不宣布整个网络恢复。",
          "language": "bash",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "probes",
      "title": "探针的职责：活着、可接流量、启动完成分别判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "readiness决定实例是否适合接流量；liveness用于发现需要重启恢复的失活；startup为慢启动应用提供启动期检查。若把一段不稳定的远端数据库查询同时塞进liveness，一次数据库抖动可能让所有健康进程被轮流重启，反而加重恢复压力。"
        },
        {
          "type": "paragraph",
          "text": "本例/health只说明进程能处理HTTP，/ready由实例配置控制。READY=false时，它仍能在/health返回200，却在/ready返回503。两个本地HTTP测试已经验证这种区分；在集群里，具体多久移除后端还受探针周期、阈值与控制器更新影响，本文没有测量这个传播时间。"
        },
        {
          "type": "code",
          "code": "kubectl -n atlas-debug-lab set env deployment/atlas-debug READY=false\nkubectl -n atlas-debug-lab get pods -w\n# 在另一个终端观察EndpointSlice；不要只等Pod phase改变\nkubectl -n atlas-debug-lab get endpointslices -l kubernetes.io/service-name=atlas-debug -o yaml\n# 修复演练：恢复就绪配置\nkubectl -n atlas-debug-lab set env deployment/atlas-debug READY=true\nkubectl -n atlas-debug-lab rollout status deployment/atlas-debug",
          "filename": "终端：待执行的就绪故障演练",
          "purpose": "仅操作独立实验namespace；set env会创建新版本Pod，不是瞬间修改现有Node进程环境。",
          "language": "bash",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "startup、readiness与liveness不必机械设置成三份。先定义应用怎样完成初始化、什么条件下适合接请求、哪类失活可以靠重启恢复，再选择探针。阈值影响故障发现和误判，不应只为了看起来“检查得快”设得极小。"
        }
      ]
    },
    {
      "id": "resources",
      "title": "502之外的证据：资源、超时与发布窗口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "CPU平均值低也可能超时。请求可能在等待外部I/O、队列、锁或连接池；短时CPU受限和内存触顶也可能被平均值掩盖。先把客户端/入口/应用的时间预算排成顺序，再用同一个请求ID对齐排队、执行与上游等待。盲目提高代理超时会让更多请求占住资源，却未减少实际工作。"
        },
        {
          "type": "code",
          "code": "kubectl -n atlas-debug-lab describe pod <POD_NAME>\nkubectl -n atlas-debug-lab logs <POD_NAME> --all-containers --since=10m\nkubectl -n atlas-debug-lab logs <POD_NAME> -c web --previous\nkubectl -n atlas-debug-lab rollout history deployment/atlas-debug\n# 仅当集群已安装metrics支持时可用\nkubectl -n atlas-debug-lab top pods",
          "filename": "终端：生命周期和资源证据",
          "purpose": "查看重启原因、上次退出、事件与资源限制。--previous需要存在前一个容器实例，top不是所有集群都可用。",
          "language": "bash",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "证据",
            "可能的解释方向",
            "需要补什么"
          ],
          "rows": [
            [
              "OOMKilled或内存限制相关退出",
              "进程或容器内存压力",
              "查看实际分配/泄漏/峰值及限制，不能只增加重启"
            ],
            [
              "入口超时，应用仍在处理",
              "链路预算不一致或上游长等待",
              "检查取消是否传递，记录等待阶段"
            ],
            [
              "滚动发布时错误集中",
              "就绪、终止、连接排空或旧依赖不兼容",
              "按版本与时间对齐事件，验证摘流和优雅退出"
            ],
            [
              "只有一个来源访问失败",
              "策略、DNS或网络路径差异",
              "从相同来源复现，不用本机port-forward代替"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "NetworkPolicy是否生效还取决于集群网络实现；创建资源不等于规则已按你想象执行。排查先读现有策略与流量方向，再在实验环境增加最小规则验证。本文不会提供一条删除全部策略的“修复命令”。业务恢复与长期修复也要分开：必要时回滚具体发布，但保留日志和对象快照，避免重启把唯一的失败证据冲掉。"
        }
      ]
    },
    {
      "id": "release",
      "title": "完整演练与验收：明确哪些已经运行，哪些等待集群",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "# 教学复现版本，部署前应按实际支持周期和安全公告更新。\nFROM node:22.12.0-alpine\nWORKDIR /app\nCOPY app.mjs .\nUSER node\nEXPOSE 8080\nCMD [\"node\",\"app.mjs\"]\n",
          "filename": "Dockerfile",
          "purpose": "教学构建文件，固定Node22.12.0镜像标签供复现；生产应按支持周期/安全修订选择基础镜像。本机未构建镜像。",
          "language": "docker",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{\n  \"apiVersion\": \"v1\",\n  \"kind\": \"Namespace\",\n  \"metadata\": {\n    \"name\": \"atlas-debug-lab\"\n  }\n}\n",
          "filename": "namespace.json",
          "purpose": "独立实验命名空间；不要把演练资源混进现有业务namespace。",
          "language": "json",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{\n  \"apiVersion\": \"networking.k8s.io/v1\",\n  \"kind\": \"Ingress\",\n  \"metadata\": {\n    \"name\": \"atlas-debug\",\n    \"namespace\": \"atlas-debug-lab\"\n  },\n  \"spec\": {\n    \"ingressClassName\": \"REPLACE_WITH_INSTALLED_CLASS\",\n    \"rules\": [\n      {\n        \"host\": \"atlas-debug.test\",\n        \"http\": {\n          \"paths\": [\n            {\n              \"path\": \"/\",\n              \"pathType\": \"Prefix\",\n              \"backend\": {\n                \"service\": {\n                  \"name\": \"atlas-debug\",\n                  \"port\": {\n                    \"number\": 80\n                  }\n                }\n              }\n            }\n          ]\n        }\n      }\n    ]\n  }\n}\n",
          "filename": "ingress.json",
          "purpose": "可选Ingress声明。必须把class占位改为实际已安装控制器的IngressClass；没有控制器只创建对象不会提供入口。",
          "language": "json",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "cd examples/k8s-debugging\nnode --test test.mjs\n# 以下步骤需要已有容器环境和独立kind实验集群，本文未执行\ndocker build -t atlas-debug:local .\nkind load docker-image atlas-debug:local --name <LAB_CLUSTER>\nkubectl apply -f namespace.json -f deployment.json -f service.json\nkubectl -n atlas-debug-lab rollout status deployment/atlas-debug\n# 配好IngressClass后再单独apply ingress.json",
          "filename": "终端：本地测试与集群准备",
          "purpose": "先确认kubectl context属于你的实验集群。这里不是一键安装集群脚本，缺少环境时停止在待验证状态。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "故障一：把Service selector改成app=wrong。观察后端是否消失，再恢复为atlas-debug。故障二：把targetPort改成9999，即使selector正确，进程仍监听8080，检查实际连接错误与控制器日志；改回http后重新验证。故障三：设置READY=false，区分容器活着与后端可用，恢复以后再次验证入口。错误HTTP状态由实际控制器决定，不预先写死一定返回502。"
        },
        {
          "type": "code",
          "code": "// 静态连接检查，只从声明推导明显的selector/端口错误，不冒充K8s控制面或网络实现。\nexport function inspect(deployment,service){\n const labels=deployment.spec.template.metadata.labels;\n const selected=Object.entries(service.spec.selector).every(([k,v])=>labels[k]===v);\n const ports=deployment.spec.template.spec.containers.flatMap(c=>c.ports||[]);\n const findings=[];\n if(!selected)findings.push('SELECTOR_MISMATCH');\n for(const port of service.spec.ports){\n  const target=port.targetPort??port.port;\n  if(typeof target==='string'&&!ports.some(p=>p.name===target))findings.push('NAMED_PORT_MISSING');\n  // 数字targetPort不要求声明containerPort；声明不等于进程真的监听。\n }\n return findings;\n}\n",
          "filename": "inspect.mjs",
          "purpose": "完整静态连接检查器，只发现selector/命名端口的明显错误。数字端口不能仅凭声明推断监听成功。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "本机执行了5项测试：正确静态连接、错误selector、未知命名端口与数字端口边界，以及真实本地HTTP的ready/alive两组行为。没有kubectl、容器运行时、kind或集群，因此Deployment调度、EndpointSlice更新、真实Ingress错误与网络策略均未实际验证。页面继续标审阅稿，验证记录把环境缺口列为未完成。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "Pod Running而Service没有可用后端，下一步是什么？",
              "核对selector与Ready，再看EndpointSlice条件；Running不是流量资格。"
            ],
            [
              "port-forward成功能证明Ingress正常吗？",
              "不能，它绕开了入口和Service路径；只把应用自身可用作为一段证据。"
            ],
            [
              "声明targetPort=9999，静态检查无错，为什么仍失败？",
              "数字端口是合法声明，进程可能没有监听它。必须用运行证据补足静态声明。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "演练结束只清理你创建的atlas-debug-lab资源，保留检查记录；不要对现有业务命名空间套用清理命令。发布改进应落到可验证条件：就绪何时成立、旧版本怎样摘流、终止时怎样结束请求、依赖失败怎样降级，而不是只在文档里写“增加监控”。"
        }
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
  "status": "review",
  "kind": "tutorial",
  "labMinutes": 40,
  "verifiedAt": "2026-10-23",
  "versions": [
    "Kubernetes稳定API：apps/v1、v1、networking.k8s.io/v1",
    "本地应用Node22.12.0；未运行真实集群"
  ],
  "examples": [
    {
      "label": "完整排障演练ZIP",
      "path": "k8s-debugging.zip"
    },
    {
      "label": "验证范围与环境缺口",
      "path": "k8s-debugging/VERIFICATION.md"
    }
  ]
};
export default article;
