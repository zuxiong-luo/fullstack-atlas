import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "kubernetes-foundations",
  "topic": "operations",
  "title": "Kubernetes 基础：工作负载、服务发现、探针与滚动更新",
  "description": "固定单节点kind环境，以真实Service DNS、Pod替换、探针重启和坏更新验证控制器职责与显式回滚。",
  "minutes": 75,
  "labMinutes": 45,
  "tags": [
    "Kubernetes",
    "Deployment",
    "Service",
    "探针",
    "滚动更新"
  ],
  "scope": "Kubernetes1.35单节点kind有限教学集群；不覆盖生产多节点、Ingress、TLS或持久化数据库。",
  "prerequisites": [
    "会运行终端命令并阅读基础Python",
    "理解上一章Linux进程与服务生命周期，示例可以独立下载运行"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Ubuntu24.04.5 / kernel6.17.0-1022-azure / CPython3.12.14",
    "kind v0.33.0 / kubectl与server v1.35.8 / 固定节点摘要",
    "真实Service DNS、Pod替换、探针重启、坏更新/显式undo及清理通过"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "完整实验ZIP",
      "path": "kubernetes-foundations.zip"
    },
    {
      "label": "依赖、运行与验证记录",
      "path": "kubernetes-foundations/README.md"
    }
  ],
  "references": [
    {
      "title": "Kubernetes v1.35：Deployment",
      "url": "https://v1-35.docs.kubernetes.io/docs/concepts/workloads/controllers/deployment/"
    },
    {
      "title": "Kubernetes v1.35：Service",
      "url": "https://v1-35.docs.kubernetes.io/docs/concepts/services-networking/service/"
    },
    {
      "title": "Kubernetes v1.35：启动、就绪与存活探针",
      "url": "https://v1-35.docs.kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/"
    },
    {
      "title": "Kubernetes v1.35：容器资源请求和限制",
      "url": "https://v1-35.docs.kubernetes.io/docs/concepts/configuration/manage-resources-containers/"
    },
    {
      "title": "kind v0.33.0：固定节点镜像摘要",
      "url": "https://github.com/kubernetes-sigs/kind/releases/tag/v0.33.0"
    },
    {
      "title": "完整单节点集群真实CI成功",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40102026052"
    }
  ],
  "sections": [
    {
      "id": "desired",
      "title": "Kubernetes把期望状态交给持续观察的控制器",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Kubernetes是管理容器化工作负载的平台。我们把希望运行的副本数、容器镜像和更新策略写成API对象，由控制器反复比较期望状态与实际状态，再执行创建、替换等动作。它不是把一条docker run换一种写法：命令返回后，控制循环仍然继续工作；实际状态可能暂时落后，也可能因资源或配置失败而长期达不到期望。"
        },
        {
          "type": "paragraph",
          "text": "Pod是Kubernetes调度与运行的一组容器单位，同一Pod内容器共享网络等上下文。本例每个Pod只放一个笔记夹具容器。Deployment描述无状态应用的副本与更新意图，借助ReplicaSet维持符合模板的Pod数量；kubelet在所在节点管理容器与探针。Pod被删除后会有新Pod补上，但新对象的UID不同，不能把“名字看起来相似”理解成原对象复活。"
        },
        {
          "type": "paragraph",
          "text": "Service为不断变化的Pod提供相对稳定的访问身份。客户端使用Service的DNS名称和端口，不需要保存某一个短命Pod的IP；选择器与EndpointSlice把后端集合组织起来。Service不会替你决定数据库事务，也不会让两个Pod自动共享内存计数。本篇只验证无状态版本接口，故意不把夹具/counter当成分布式一致计数器。"
        },
        {
          "type": "paragraph",
          "text": "实验固定kind v0.33.0、kubectl v1.35.8，显式选择官方release列出的Kubernetes v1.35.8节点镜像及摘要，不使用kind默认节点。文档也固定v1.35。2026-10-24隔离Ubuntu CI aa5bae3已完整执行：Ubuntu24.04.5、kernel6.17.0-1022-azure、CPython3.12.14，客户端与server均确认v1.35.8。本机mac只做静态检查，真实单节点kind结果来自该次VM，不扩大为多节点、高可用或生产验收。"
        }
      ]
    },
    {
      "id": "objects",
      "title": "从工作负载到访问路径，先看职责如何连接",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "/figures/kubernetes-foundations/controllers.svg",
          "title": "谁维持副本，谁接流量，谁重启容器",
          "alt": "Deployment经ReplicaSet维护两个Pod；Service DNS定位ClusterIP，EndpointSlice记录就绪端点，节点数据平面完成转发；kubelet执行探针并重启容器。",
          "caption": "箭头表示控制或请求关系，不表示API对象都在同一个进程。图为单节点教学模型，没有把Service画成数据库或自动回滚器。"
        },
        {
          "type": "paragraph",
          "text": "Service与EndpointSlice都是API对象，后者保存后端地址及就绪等条件，本身不会像Nginx进程一样转发字节。节点的数据平面根据这些状态安装转发规则或等价机制，才把ClusterIP请求送到实际Pod。图中从端点集合到Pod的箭头表示这种关联后的请求路径，不能读成EndpointSlice里运行了一个代理。解析到ClusterIP与最终连通后端也因此要分开验证。"
        },
        {
          "type": "paragraph",
          "text": "删除一个Pod与容器在原Pod内重启是两件事。前者由副本控制器补一个新Pod，UID变化；后者在同一Pod对象里换容器实例，containerID和restartCount变化。把两者分开观察，才知道恢复动作来自哪一层。脚本因此同时记录Pod UID、容器ID、重启次数和ServiceIP，而不是只数“又有两个绿点”。"
        },
        {
          "type": "paragraph",
          "text": "DNS解析成功也只完成地址发现。测试从自己的就绪Pod内，真正调用集群DNS解析notes.namespace.svc.cluster.local，检查结果等于Service的ClusterIP，再通过这个名称发HTTP请求读版本。它与网络篇的手工UDP DNS夹具不同，是这次kind集群的真实解析和Service路径；但单次请求成功不证明负载分配公平或所有网络策略正确。"
        },
        {
          "type": "reference",
          "title": "Kubernetes v1.35 Service",
          "url": "https://v1-35.docs.kubernetes.io/docs/concepts/services-networking/service/",
          "note": "Service/EndpointSlice是对象，后端转发由节点数据平面完成。"
        }
      ]
    },
    {
      "id": "manifest",
      "title": "把副本、探针、资源和数据寿命写在同一份配置里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "以下是完整工作负载模板。控制器把@IMAGE@替换成此次构建并装载进kind的专用镜像tag。imagePullPolicy Never让应用使用装载内容，避免测试过程中去外部仓库拉同名tag。replicas2、maxSurge1、maxUnavailable0表示更新时允许最多多一个Pod，计划内不主动减少可用数量；这需要节点实际有资源放下候选，不是一句“永远无停机”的保证。"
        },
        {
          "type": "code",
          "code": "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: notes\nspec:\n  replicas: 2\n  minReadySeconds: 1\n  progressDeadlineSeconds: 20\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0\n  selector:\n    matchLabels: { app: atlas-notes }\n  template:\n    metadata:\n      labels: { app: atlas-notes }\n    spec:\n      terminationGracePeriodSeconds: 3\n      securityContext:\n        runAsUser: 10001\n        runAsGroup: 10001\n        fsGroup: 10001\n      containers:\n        - name: notes\n          image: \"@IMAGE@\"\n          imagePullPolicy: Never\n          env:\n            - { name: APP_VERSION, value: v1 }\n            - { name: APP_READY, value: \"1\" }\n          ports:\n            - { name: http, containerPort: 8080 }\n          resources:\n            requests: { cpu: 50m, memory: 64Mi }\n            limits: { cpu: 250m, memory: 128Mi }\n          securityContext:\n            readOnlyRootFilesystem: true\n            allowPrivilegeEscalation: false\n            capabilities: { drop: [ALL] }\n          startupProbe:\n            httpGet: { path: /health, port: http }\n            periodSeconds: 1\n            failureThreshold: 30\n          readinessProbe:\n            httpGet: { path: /ready, port: http }\n            periodSeconds: 1\n            failureThreshold: 1\n          livenessProbe:\n            httpGet: { path: /health, port: http }\n            periodSeconds: 2\n            failureThreshold: 2\n          volumeMounts:\n            - { name: data, mountPath: /data }\n            - { name: temporary, mountPath: /tmp }\n      volumes:\n        - name: data\n          emptyDir: { sizeLimit: 16Mi }\n        - name: temporary\n          emptyDir: { sizeLimit: 8Mi }\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: notes\nspec:\n  selector: { app: atlas-notes }\n  ports:\n    - { name: http, port: 8080, targetPort: http }",
          "filename": "examples/kubernetes-foundations/workload.yaml.in",
          "purpose": "完整Deployment与ClusterIP Service：两副本、三类探针、有限资源、普通UID与独立emptyDir。",
          "language": "yaml",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "CPU请求50m参与调度，CPU上限250m约束运行配额；memory请求64Mi与上限128Mi分别承担调度和内存约束。它们不是专属物理核或“必定占用这么多内存”。内存超限可能引发OOM，CPU上限可能引发节流；本篇没有制造Kubernetes OOM，不把前篇Docker OOM实验移植成这里已验证的结果。"
        },
        {
          "type": "paragraph",
          "text": "只读rootfs与/data、/tmp可写emptyDir分开，fsGroup10001帮助普通UID写这些卷。emptyDir跟随Pod寿命，容器重启通常仍能看到原Pod卷内容，Pod被删除则不能拿它当持久数据库。sizeLimit也不提供事务、备份或跨Pod共享。本例用一次性文件触发探针失败，正是利用同一Pod中容器重启前后卷仍在的特点。"
        },
        {
          "type": "reference",
          "title": "Kubernetes v1.35资源请求与限制",
          "url": "https://v1-35.docs.kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
          "note": "分别核对requests的调度作用与limits运行约束。"
        }
      ]
    },
    {
      "id": "probes",
      "title": "探针分别决定启动等待、流量资格和重启",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "startupProbe先判断启动是否完成，在成功前避免就绪与存活探针抢先干预；readinessProbe决定是否被当作就绪后端；livenessProbe在失败达到阈值后触发容器重启。就绪失败本身不会命令Deployment回滚，也不会要求kubelet立即重启。配置这些探针之前，必须先明确“失败意味着暂时不接流量，还是程序无法继续工作”。"
        },
        {
          "type": "code",
          "code": "\"\"\"Finite local container fixture; never use this HTTPServer as a public server.\"\"\"\nfrom http.server import BaseHTTPRequestHandler, HTTPServer\nimport json\nimport os\nfrom pathlib import Path\nimport signal\nimport threading\n\nDATA = Path(\"/data\")\nVERSION = os.environ.get(\"APP_VERSION\", \"v1\")\nSTOP = threading.Event()\nSIGNALS = []\n\n\ndef counter() -> int:\n    path = DATA / \"counter.json\"\n    return json.loads(path.read_text())[\"value\"] if path.exists() else 0\n\n\ndef atomic(path: Path, value: object) -> None:\n    temporary = path.with_suffix(\".tmp\")\n    temporary.write_text(json.dumps(value))\n    temporary.replace(path)\n\n\nclass Handler(BaseHTTPRequestHandler):\n    def setup(self):\n        super().setup()\n        self.connection.settimeout(2)\n\n    def log_message(self, *arguments):\n        pass\n\n    def response(self, status: int, value: object):\n        body = json.dumps(value).encode()\n        self.send_response(status)\n        self.send_header(\"Content-Type\", \"application/json\")\n        self.send_header(\"Content-Length\", str(len(body)))\n        self.send_header(\"Connection\", \"close\")\n        self.end_headers()\n        self.wfile.write(body)\n\n    def do_GET(self):\n        if self.path in (\"/\", \"/health\"):\n            healthy = not (DATA / \"unhealthy-once\").exists()\n            self.response(200 if healthy else 503, {\"version\": VERSION, \"pid\": os.getpid(), \"uid\": os.getuid()})\n        elif self.path == \"/ready\":\n            ready = os.environ.get(\"APP_READY\", \"1\") == \"1\" and not (DATA / \"unhealthy-once\").exists()\n            self.response(200 if ready else 503, {\"ready\": ready, \"version\": VERSION})\n        elif self.path == \"/counter\":\n            self.response(200, {\"value\": counter(), \"version\": VERSION})\n        else:\n            self.response(404, {\"error\": \"not found\"})\n\n    def do_POST(self):\n        if self.path != \"/counter\" or self.headers.get(\"Content-Length\", \"0\") != \"0\":\n            self.response(400, {\"error\": \"only empty POST /counter is supported\"})\n            return\n        value = counter() + 1\n        atomic(DATA / \"counter.json\", {\"value\": value})\n        self.response(201, {\"value\": value, \"version\": VERSION})\n\n\ndef main():\n    if os.environ.get(\"APP_START_FAIL\") == \"1\":\n        raise SystemExit(42)\n    if VERSION not in {\"v1\", \"v2\"}:\n        raise ValueError(\"unsupported APP_VERSION\")\n    DATA.mkdir(exist_ok=True)\n    # One-shot probe failure fixture: a container restart consumes this marker.\n    (DATA / \"unhealthy-once\").unlink(missing_ok=True)\n\n    def request_stop(number, frame):\n        SIGNALS.append(signal.Signals(number).name)\n        STOP.set()\n\n    for number in (signal.SIGINT, signal.SIGTERM):\n        signal.signal(number, request_stop)\n    with HTTPServer((\"0.0.0.0\", 8080), Handler) as server:\n        server.timeout = .1\n        print(json.dumps({\"event\": \"ready\", \"version\": VERSION, \"pid\": os.getpid()}), flush=True)\n        try:\n            while not STOP.is_set():\n                server.handle_request()\n        finally:\n            atomic(DATA / (\"stopped-\" + VERSION + \".json\"), {\"signals\": SIGNALS, \"pid\": os.getpid()})\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "examples/kubernetes-foundations/app.py",
          "purpose": "完整容器服务；/ready可保持失败，/health可由一次性文件触发失败，真正重启才消费标记。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "正常/health与/ready返回200。坏更新设置APP_READY=0，新容器可以Running且存活200，却一直NotReady。另一个独立实验向某个Pod的/data写unhealthy-once，让health与ready都失败；应用只有在真正重新启动时才删除标记。脚本等待原Pod UID不变、restartCount增加、containerID变化并重新ready，证明kubelet确实执行了重启。这个标记是可复现故障夹具，不能类比为重启能自动修复任意业务错误。"
        },
        {
          "type": "code",
          "code": "            # A one-shot file makes health fail. Startup consumes it only after\n            # the kubelet actually restarts this container; the Pod UID stays.\n            target = ready_pods()[0]\n            target_name, target_uid = target[\"metadata\"][\"name\"], target[\"metadata\"][\"uid\"]\n            previous = target[\"status\"][\"containerStatuses\"][0]\n            kubectl(\"exec\", target_name, \"--\", \"python\", \"-c\",\n                    \"from pathlib import Path;Path('/data/unhealthy-once').write_text('fixture')\")\n            def restarted():\n                pod = obj(\"pod\", target_name)\n                statuses = pod[\"status\"].get(\"containerStatuses\", [])\n                if (pod[\"metadata\"][\"uid\"] == target_uid and statuses and statuses[0][\"ready\"]\n                        and statuses[0][\"restartCount\"] > previous[\"restartCount\"]):\n                    return statuses[0]\n                return None\n            current = eventually(restarted, \"liveness restart and readiness recovery\", seconds=60)\n            assert current[\"containerID\"] != previous[\"containerID\"]\n            print(json.dumps({\"case\": \"probe_restart\", \"same_pod_uid\": True,\n                              \"restart_count\": current[\"restartCount\"], \"last_state\": current[\"lastState\"]}), flush=True)",
          "filename": "examples/kubernetes-foundations/verify.py",
          "purpose": "原Pod内真实探针重启的连续断言，不由测试手工重启容器。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "reference",
          "title": "Kubernetes v1.35三类探针",
          "url": "https://v1-35.docs.kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/",
          "note": "启动、流量资格与容器重启属于不同动作。"
        },
        {
          "type": "paragraph",
          "text": "本次实际探针实验中，同一Pod的restartCount增至1、containerID改变并恢复ready，但lastState记录exitCode0、reason Completed。原因是应用能在终止信号下完成正常收尾；“被探针要求重启”不等于“一定被SIGKILL或退出137”。必须连同故障输入、Pod身份、计数和新实例恢复判断，不能只凭一个退出码归因。"
        }
      ]
    },
    {
      "id": "rollout",
      "title": "坏候选不会就绪，控制器报停滞也不等于自动回滚",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Deployment的progressDeadlineSeconds20表示观察更新进度的期限。候选一直NotReady时，旧两个就绪Pod仍可继续接流量，状态最终出现ProgressDeadlineExceeded。这个条件报告的是更新停滞，控制器不会因此自动把模板改回上一版。要恢复发布意图，操作者或上层发布系统需要明确执行undo或提交修正版本。"
        },
        {
          "type": "code",
          "code": "            kubectl(\"set\", \"env\", \"deployment/notes\", \"APP_VERSION=v2\", \"APP_READY=0\")\n            def stalled():\n                conditions = obj(\"deployment\", \"notes\")[\"status\"].get(\"conditions\", [])\n                return any(c[\"type\"] == \"Progressing\" and c.get(\"reason\") == \"ProgressDeadlineExceeded\" for c in conditions)\n            eventually(stalled, \"bad readiness rollout stalled\", seconds=60)\n            assert kubectl(\"rollout\", \"status\", \"deployment/notes\", \"--timeout=2s\", check=False, timeout=10).returncode != 0\n            slices = obj(\"endpointslices\", \"-l\", \"kubernetes.io/service-name=notes\")[\"items\"]\n            endpoints = [endpoint for item in slices for endpoint in item[\"endpoints\"] if endpoint[\"conditions\"].get(\"ready\")]\n            assert len(endpoints) == 2\n            assert all(next(e[\"value\"] for e in pod[\"spec\"][\"containers\"][0][\"env\"] if e[\"name\"] == \"APP_VERSION\") == \"v1\"\n                       for pod in ready_pods())\n            service_read(\"v1\")\n            print(json.dumps({\"case\": \"failed_rollout\", \"reason\": \"ProgressDeadlineExceeded\", \"ready_endpoints\": 2,\n                              \"serving_version\": \"v1\", \"auto_rollback\": False}), flush=True)\n            kubectl(\"rollout\", \"undo\", \"deployment/notes\")\n            rollout()\n            service_read(\"v1\")\n            kubectl(\"set\", \"env\", \"deployment/notes\", \"APP_VERSION=v2\", \"APP_READY=1\")\n            final = rollout()\n            assert all(next(e[\"value\"] for e in p[\"spec\"][\"containers\"][0][\"env\"] if e[\"name\"] == \"APP_VERSION\") == \"v2\" for p in final)\n            service_read(\"v2\")\n            print(json.dumps({\"case\": \"explicit_undo_then_good_update\", \"final_version\": \"v2\", \"ready_pods\": 2}), flush=True)",
          "filename": "examples/kubernetes-foundations/verify.py",
          "purpose": "失败滚动更新、旧就绪端点保留、显式undo与再次成功更新的完整关键路径。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "断言不只看rollout命令非零，还读取EndpointSlice确认两个ready端点，检查所有就绪Pod模板仍是v1，并通过Service实际取回v1。随后显式undo等待健康，再设置v2/ready1，要求最终两个就绪Pod与Service请求都是v2。这把“坏候选被隔离、旧路径仍工作、恢复后重新推进”连接成一条行为证据，而不是把apply成功误写为发布完成。"
        },
        {
          "type": "paragraph",
          "text": "minReadySeconds1让新Pod在保持就绪一小段时间后才计入可用，不是业务稳定性的统计证明。maxUnavailable0也无法阻止宿主突然故障、探针误配或真实依赖一起失败。若两个版本使用不兼容的数据格式，undo模板仍可能无法恢复业务；数据库兼容和备份不能由Deployment条件替代。"
        },
        {
          "type": "reference",
          "title": "Kubernetes v1.35 Deployment",
          "url": "https://v1-35.docs.kubernetes.io/docs/concepts/workloads/controllers/deployment/",
          "note": "ProgressDeadlineExceeded报告停滞，不自动执行回滚。"
        }
      ]
    },
    {
      "id": "isolated",
      "title": "创建自己的集群和身份，明确运行与清理边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "kind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nnetworking:\n  apiServerAddress: \"127.0.0.1\"\n  apiServerPort: 0\nnodes:\n  - role: control-plane",
          "filename": "examples/kubernetes-foundations/kind.yaml",
          "purpose": "单控制平面教学集群，API server只绑定127.0.0.1动态端口。",
          "language": "yaml",
          "kind": "runnable"
        },
        {
          "type": "code",
          "filename": "终端",
          "code": "timeout --signal=TERM --kill-after=160s 1080s bash examples/kubernetes-foundations/verify-linux.sh",
          "purpose": "一次性Linux VM运行；需本机Docker、Python3.12、kind v0.33.0、kubectl v1.35.8与GNU timeout，首次下载固定镜像需要网络。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "paragraph",
          "text": "脚本随机生成atlas-lab-k8s前缀，拒绝已有同名集群，创建私有临时kubeconfig；所有kubectl调用明确传入该文件、kind-context和专用namespace。kind create和delete也使用私有kubeconfig，避免修改默认context。镜像build、集群创建、装载、rollout与每次API请求都有有限超时；只是轮询观察真实条件，不因等够秒数就自动宣布成功。"
        },
        {
          "type": "code",
          "code": "        try:\n            print(kind_version, flush=True)\n            print(json.dumps({\"kubectl_client\": client[\"clientVersion\"][\"gitVersion\"], \"node_image\": NODE_IMAGE}), flush=True)\n            run([\"docker\", \"build\", \"--label\", \"atlas.lab=\" + prefix, \"-t\", image, str(ROOT)], timeout=180)\n            run([\"kind\", \"create\", \"cluster\", \"--name\", prefix, \"--image\", NODE_IMAGE,\n                 \"--config\", str(ROOT / \"kind.yaml\"), \"--kubeconfig\", str(kubeconfig), \"--wait\", \"120s\"], timeout=300)\n            run([\"kind\", \"load\", \"docker-image\", image, \"--name\", prefix], timeout=90)\n            kubectl(\"create\", \"namespace\", namespace, namespaced=False)\n            manifest = work / \"workload.yaml\"\n            manifest.write_text((ROOT / \"workload.yaml.in\").read_text().replace(\"@IMAGE@\", image))\n            kubectl(\"apply\", \"-f\", str(manifest))\n            initial = rollout()\n            server = json.loads(kubectl(\"version\", \"-o\", \"json\", namespaced=False).stdout)[\"serverVersion\"][\"gitVersion\"]\n            assert server == \"v1.35.8\"\n            baseline = service_read(\"v1\")\n            ip = obj(\"service\", \"notes\")[\"spec\"][\"clusterIP\"]\n            print(json.dumps({\"case\": \"deployment_service_dns\", \"server\": server, \"ready_pods\": 2,\n                              \"service_dns\": baseline[\"address\"], \"version\": \"v1\"}), flush=True)\n            old_uid = initial[0][\"metadata\"][\"uid\"]\n            kubectl(\"delete\", \"pod\", initial[0][\"metadata\"][\"name\"], \"--wait=true\", \"--timeout=30s\", timeout=40)\n            replacement = rollout()\n            assert old_uid not in {pod[\"metadata\"][\"uid\"] for pod in replacement}\n            assert obj(\"service\", \"notes\")[\"spec\"][\"clusterIP\"] == ip\n            service_read(\"v1\")\n            print(json.dumps({\"case\": \"controller_replacement\", \"replaced_uid\": old_uid, \"service_ip_unchanged\": True}), flush=True)",
          "filename": "examples/kubernetes-foundations/verify.py",
          "purpose": "完整创建与基线验证路径：固定节点、装载应用、部署、真实DNS和Pod替换。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "成功时应看到deployment_service_dns、controller_replacement、probe_restart、failed_rollout、explicit_undo_then_good_update，再看到清理完成。失败先按阶段定位：ImagePull或Never拉取错误查装载镜像与节点内容；Pending查请求和节点容量；Running/NotReady查ready响应；重启查lastState与探针。别一遇到失败就删除探针或提高deadline让状态暂时变绿，那会抹掉正在验证的问题。"
        },
        {
          "type": "code",
          "code": "        finally:\n            errors = []\n            for arguments in [[\"kind\", \"delete\", \"cluster\", \"--name\", prefix, \"--kubeconfig\", str(kubeconfig)], [\"docker\", \"image\", \"rm\", image]]:\n                try:\n                    run(arguments, check=False, timeout=90)\n                except (OSError, subprocess.TimeoutExpired) as error:\n                    errors.append(str(error))\n            if prefix in run([\"kind\", \"get\", \"clusters\"]).stdout.split():\n                errors.append(\"kind cluster remains\")\n            if run([\"docker\", \"inspect\", prefix + \"-control-plane\"], check=False).returncode == 0:\n                errors.append(\"kind node container remains\")\n            if run([\"docker\", \"image\", \"inspect\", image], check=False).returncode == 0:\n                errors.append(\"lab image tag remains\")\n            if errors:\n                raise RuntimeError(\"cleanup incomplete: \" + \"; \".join(errors))\n            print(json.dumps({\"cleanup\": \"cluster_and_lab_image_removed\", \"prefix\": prefix}), flush=True)\n    assert not work.exists()\n    print(json.dumps({\"cleanup\": \"complete\", \"private_kubeconfig_removed\": True}), flush=True)\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "examples/kubernetes-foundations/verify.py",
          "purpose": "完整清理：只删除专用集群和应用镜像tag，并确认节点容器、集群名和私有配置不残留。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "删除自己的kind集群会连带清理其内部namespace和Pod，随后删自己的应用tag并确认不存在。共享kind网络、节点基础镜像与Docker构建缓存可能保留，脚本没有prune，也不触碰其他context、集群或容器。外层TERM留出finally时间，强杀和主机故障仍不能保证清理。真实CI已全部通过，文章保持review等最终站点与图形验收；不覆盖Ingress、TLS、持久卷、多节点故障、云负载均衡或生产SLA。"
        },
        {
          "type": "paragraph",
          "text": "实际CI基线为2个就绪Pod，Pod内DNS解析得到ServiceIP10.96.29.100；删Pod后原UID消失，新副本补足且IP不变。坏更新确实进入ProgressDeadlineExceeded，仍保留2个ready端点并返回v1，auto_rollback为false；显式undo后再提交好v2，最终2个就绪副本与Service都返回v2。自己的cluster、应用tag与私有kubeconfig均确认清理。这个IP是该次动态分配，源码不硬编码。"
        }
      ]
    }
  ]
};

export default article;
