import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "docker-engineering",
  "topic": "operations",
  "title": "Docker 工程：镜像构建、容器隔离、数据卷与资源限制",
  "description": "固定镜像摘要，以计数服务验证PID/UID、命名卷、SIGTERM、实际cgroup限额和有界OOM失败。",
  "minutes": 65,
  "labMinutes": 45,
  "tags": [
    "Docker",
    "镜像",
    "数据卷",
    "cgroup",
    "资源限制"
  ],
  "scope": "Linux本机Docker/cgroupv2有限实验；不连接远程daemon，不宣称生产沙箱或卷备份。",
  "prerequisites": [
    "会运行终端命令并阅读基础Python",
    "理解上一章Linux进程与服务生命周期，示例可以独立下载运行"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Ubuntu24.04.5 / kernel6.17.0-1022-azure / CPython3.12.14",
    "Docker28.0.4 / cgroupv2；固定Python基镜像摘要",
    "修后CI：真实allocator SIGKILL/oom_kill1/Docker OOMKilled与137；完整清理通过"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "完整实验ZIP",
      "path": "docker-engineering.zip"
    },
    {
      "label": "依赖、运行与验证记录",
      "path": "docker-engineering/README.md"
    }
  ],
  "references": [
    {
      "title": "Docker：运行进程与镜像引用",
      "url": "https://docs.docker.com/engine/containers/run/"
    },
    {
      "title": "Docker：Dockerfile语法",
      "url": "https://docs.docker.com/reference/dockerfile/"
    },
    {
      "title": "Docker：命名卷生命周期",
      "url": "https://docs.docker.com/engine/storage/volumes/"
    },
    {
      "title": "Docker：CPU与内存资源限制",
      "url": "https://docs.docker.com/engine/containers/resource_constraints/"
    },
    {
      "title": "Linux v6.8：cgroup v2接口",
      "url": "https://www.kernel.org/doc/html/v6.8/admin-guide/cgroup-v2.html"
    },
    {
      "title": "完整Docker隔离CI成功记录",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40100003555"
    },
    {
      "title": "修后真实隔离CI成功与诊断",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101783608"
    }
  ],
  "sections": [
    {
      "id": "model",
      "title": "容器仍是进程，镜像负责交付它的文件与启动约定",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Docker把应用需要的文件系统内容、默认启动命令和部分元数据组织成镜像，再根据镜像创建容器。容器运行时，内核中的进程真实消耗宿主CPU、内存和I/O；namespace改变它看到的进程、网络等视图，cgroup组织并限制资源。它不是每个应用各带一个完整Linux内核的虚拟机，也不会因为文件系统看起来独立就自动具备资源上限。"
        },
        {
          "type": "paragraph",
          "text": "镜像是交付对象，容器是具体运行实例。可以从同一个镜像启动两个不同环境变量、不同数据卷的容器；删除其中一个实例不会把镜像变成另一版。常见镜像由多层文件变更与配置组成，运行时还可附加可写层。把业务数据只写在实例的可写层，会让重建实例变成数据生命周期问题；命名卷则把数据放到由Docker独立管理的位置。"
        },
        {
          "type": "paragraph",
          "text": "本篇继续使用本机笔记服务的简化计数接口：v1收到一次空POST，把计数写成1；停止v1后，v2挂同一卷读回1。然后分别验证启动前失败和受控内存超限。通过这些行为，我们能回答“镜像内容锁住了吗、数据归谁、信号到了谁、限制有没有真的落到内核”，而不只是看到docker run返回了一串ID。"
        },
        {
          "type": "paragraph",
          "text": "实验目标为一次性Linux VM、本机Unix socket Docker、cgroup v2与CPython3.12.14。真实环境为Ubuntu24.04.5、kernel6.17.0-1022-azure、Python3.12.14和Docker28.0.4。首轮通过后，重复运行暴露旧OOM夹具诊断不足；改为同cgroup观察进程后，2026-10-24的23a4808隔离CI再次完整通过，并保留真实oom_kill事件与进程退出证据。本机mac只有静态检查，Linux结果来自这些独立VM运行。"
        }
      ]
    },
    {
      "id": "build",
      "title": "先固定构建输入，再讨论缓存和可复现性",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "tag便于人阅读，却可能被重新指向其他内容；digest引用绑定内容。下面同时写清Python版本、发行版和多架构镜像摘要。摘要在2026-10-24从官方registry的tag响应取得，锁住镜像索引内容；不同CPU平台仍可能选择不同平台镜像，并不保证跨架构二进制相同。镜像锁定也不替代源码审查与后续补丁升级策略。"
        },
        {
          "type": "code",
          "code": "FROM python:3.12.14-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e\nENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1\nWORKDIR /app\nCOPY app.py oom_fixture.py /app/\nRUN mkdir -p /data && chown 10001:10001 /data\nUSER 10001:10001\nEXPOSE 8080\nSTOPSIGNAL SIGTERM\nCMD [\"python\", \"-u\", \"/app/app.py\"]",
          "filename": "examples/docker-engineering/Dockerfile",
          "purpose": "完整镜像定义；普通UID运行，显式数据目录与exec形式CMD，基镜像固定摘要。",
          "language": "dockerfile",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "*\n!app.py\n!Dockerfile\n!oom_fixture.py",
          "filename": "examples/docker-engineering/.dockerignore",
          "purpose": "构建上下文仅允许两个有限夹具与Dockerfile，避免把临时数据和其他文件发送给构建器。",
          "language": "text",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "COPY只送入app.py与oom_fixture.py两个有限夹具文件，减少无关文件进入构建上下文。这里没有pip install或系统安装步骤，避免构建时额外解析不固定依赖；有依赖的真实服务还应锁版本和来源。镜像缓存可以复用相同输入的构建步骤，但缓存命中不等于运行正确，也不等于安全审计完成。本实验没有测构建加速，更没有用几次本机缓存时间推断团队CI收益。"
        },
        {
          "type": "paragraph",
          "text": "USER10001让服务避免以容器root运行；镜像构建时先创建/data并赋给这个UID。EXPOSE只描述应用端口，不会自动向宿主发布。CMD使用JSON数组直接执行Python，容器内主进程因此接收停止信号；若改成经过shell却没有exec的启动脚本，信号接收对象和转发路径就需要重新验证。"
        },
        {
          "type": "reference",
          "title": "Dockerfile官方语法",
          "url": "https://docs.docker.com/reference/dockerfile/",
          "note": "核对exec CMD、USER、EXPOSE与固定镜像引用。"
        }
      ]
    },
    {
      "id": "service",
      "title": "把可写数据与退出行为做成可观察接口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面是完整有限服务。它只处理几个本地夹具请求，不作为公网HTTP服务器。正常启动监听容器内部8080，GET/health返回版本、容器内PID与UID，空POST/counter写入计数。服务串行处理请求，读改写不声称具备多进程事务隔离；atomic临时文件替换只避免读到正在写的一半内容，不保证断电持久化，也不解决多个写者竞争。"
        },
        {
          "type": "code",
          "code": "\"\"\"Finite local container fixture; never use this HTTPServer as a public server.\"\"\"\nfrom http.server import BaseHTTPRequestHandler, HTTPServer\nimport json\nimport os\nfrom pathlib import Path\nimport signal\nimport threading\n\nDATA = Path(\"/data\")\nVERSION = os.environ.get(\"APP_VERSION\", \"v1\")\nSTOP = threading.Event()\nSIGNALS = []\n\n\ndef counter() -> int:\n    path = DATA / \"counter.json\"\n    return json.loads(path.read_text())[\"value\"] if path.exists() else 0\n\n\ndef atomic(path: Path, value: object) -> None:\n    temporary = path.with_suffix(\".tmp\")\n    temporary.write_text(json.dumps(value))\n    temporary.replace(path)\n\n\nclass Handler(BaseHTTPRequestHandler):\n    def setup(self):\n        super().setup()\n        self.connection.settimeout(2)\n\n    def log_message(self, *arguments):\n        pass\n\n    def response(self, status: int, value: object):\n        body = json.dumps(value).encode()\n        self.send_response(status)\n        self.send_header(\"Content-Type\", \"application/json\")\n        self.send_header(\"Content-Length\", str(len(body)))\n        self.send_header(\"Connection\", \"close\")\n        self.end_headers()\n        self.wfile.write(body)\n\n    def do_GET(self):\n        if self.path in (\"/\", \"/health\"):\n            self.response(200, {\"version\": VERSION, \"pid\": os.getpid(), \"uid\": os.getuid()})\n        elif self.path == \"/ready\":\n            ready = os.environ.get(\"APP_READY\", \"1\") == \"1\"\n            self.response(200 if ready else 503, {\"ready\": ready, \"version\": VERSION})\n        elif self.path == \"/counter\":\n            self.response(200, {\"value\": counter(), \"version\": VERSION})\n        else:\n            self.response(404, {\"error\": \"not found\"})\n\n    def do_POST(self):\n        if self.path != \"/counter\" or self.headers.get(\"Content-Length\", \"0\") != \"0\":\n            self.response(400, {\"error\": \"only empty POST /counter is supported\"})\n            return\n        value = counter() + 1\n        atomic(DATA / \"counter.json\", {\"value\": value})\n        self.response(201, {\"value\": value, \"version\": VERSION})\n\n\ndef main():\n    if os.environ.get(\"APP_START_FAIL\") == \"1\":\n        raise SystemExit(42)\n    if VERSION not in {\"v1\", \"v2\"}:\n        raise ValueError(\"unsupported APP_VERSION\")\n    DATA.mkdir(exist_ok=True)\n\n    def request_stop(number, frame):\n        SIGNALS.append(signal.Signals(number).name)\n        STOP.set()\n\n    for number in (signal.SIGINT, signal.SIGTERM):\n        signal.signal(number, request_stop)\n    with HTTPServer((\"0.0.0.0\", 8080), Handler) as server:\n        server.timeout = .1\n        print(json.dumps({\"event\": \"ready\", \"version\": VERSION, \"pid\": os.getpid()}), flush=True)\n        try:\n            while not STOP.is_set():\n                server.handle_request()\n        finally:\n            atomic(DATA / (\"stopped-\" + VERSION + \".json\"), {\"signals\": SIGNALS, \"pid\": os.getpid()})\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "examples/docker-engineering/app.py",
          "purpose": "完整最小服务：普通UID、计数写入、有限读超时、TERM记录与启动失败分支。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "主循环每轮检查STOP，SIGTERM/SIGINT处理器只记下信号并请求退出，finally写stopped-v1.json。这个记录比“容器现在不在运行”多一层证据：测试能检查正常停止时Python确实看到了SIGTERM。APP_START_FAIL=1则在监听之前退出42，故意让“进程创建成功”和“应用服务可用”成为两个不同状态。"
        },
        {
          "type": "figure",
          "src": "/figures/docker-engineering/boundaries.svg",
          "title": "镜像、运行实例与命名卷的生命周期",
          "alt": "两个先后运行的容器共享只读镜像内容和同一命名卷，但各自拥有进程与资源边界。",
          "caption": "v1先停再启动v2；共享卷不表示两个实例可以无锁并发修改JSON文件。图为教学结构，不是完整安全边界证明。"
        }
      ]
    },
    {
      "id": "runtime",
      "title": "运行参数要能在容器内部找到对应证据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "主服务配置只读根文件系统，把/data映射到专用命名卷，/tmp用8MiB临时内存文件系统；同时去掉capabilities并禁止权限提升。这些选择缩小本例写入和权限范围，不把容器变成可以执行任意不可信程序的完整沙箱。宿主只在127.0.0.1动态端口暴露8080，测试明确绕过HTTP代理访问它。"
        },
        {
          "type": "paragraph",
          "text": "CPU参数0.5表示配额约束，不是独占半个物理核；128MiB内存配合相同memory-swap值，阻止这个容器用额外swap扩大预算；pids32约束任务数量。只读取docker inspect会证明配置被接受，所以脚本还进入容器读取cgroup v2的cpu.max、memory.max、pids.max。三个值要与请求的配额一致，才形成配置到内核接口的证据。"
        },
        {
          "type": "code",
          "code": "        def start(name, version):\n            docker(\"run\", \"--detach\", \"--name\", name, \"--label\", \"atlas.lab=\" + prefix,\n                   \"--read-only\", \"--tmpfs\", \"/tmp:rw,noexec,nosuid,size=8m\", \"--cap-drop\", \"ALL\",\n                   \"--security-opt\", \"no-new-privileges\", \"--memory\", \"128m\", \"--memory-swap\", \"128m\",\n                   \"--cpus\", \"0.5\", \"--pids-limit\", \"32\", \"--mount\", f\"type=volume,source={volume},target=/data\",\n                   \"--publish\", \"127.0.0.1::8080\", \"--env\", \"APP_VERSION=\" + version, image)\n            info = inspect(name)\n            port = int(info[\"NetworkSettings\"][\"Ports\"][\"8080/tcp\"][0][\"HostPort\"])\n            eventually(lambda: request(port)[1][\"version\"] == version, version + \" HTTP health\")\n            return port\n\n        port = start(names[0], \"v1\")\n        first = inspect(names[0])\n        config = first[\"HostConfig\"]\n        assert config[\"ReadonlyRootfs\"] and config[\"Memory\"] == 128 * 1024 * 1024\n        assert config[\"NanoCpus\"] == 500_000_000 and config[\"PidsLimit\"] == 32\n        assert first[\"Config\"][\"User\"] == \"10001:10001\"\n        limits = json.loads(docker(\"exec\", names[0], \"python\", \"-c\",\n            \"from pathlib import Path;import json;root=Path('/sys/fs/cgroup');\"\n            \"print(json.dumps({k:(root/k).read_text().strip() for k in ['cpu.max','memory.max','pids.max']}))\").stdout)\n        quota, period = map(int, limits[\"cpu.max\"].split())\n        assert quota / period == .5 and limits[\"memory.max\"] == str(128 * 1024 * 1024)\n        assert limits[\"pids.max\"] == \"32\"\n        print(json.dumps({\"case\": \"actual_cgroup_v2_limits\", **limits}), flush=True)\n        assert request(port)[1][\"pid\"] == 1 and request(port)[1][\"uid\"] == 10001\n        host_namespace = os.readlink(\"/proc/self/ns/pid\")\n        container_namespace = docker(\"exec\", names[0], \"python\", \"-c\", \"import os;print(os.readlink('/proc/self/ns/pid'))\").stdout.strip()\n        assert host_namespace != container_namespace",
          "filename": "examples/docker-engineering/verify.py",
          "purpose": "运行容器与核对实际cgroup接口的连续关键路径。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "容器内部/health必须报告pid1和uid10001，PID namespace标识必须与宿主控制器不同。这证明本次运行的进程视图隔离，不证明其他namespace、安全模块和所有宿主攻击面都已测试。真实性能问题还要观察节流时间与业务延迟；“限额存在”不能推出“该配额一定满足服务需求”。"
        },
        {
          "type": "reference",
          "title": "Linux v6.8 cgroup v2",
          "url": "https://www.kernel.org/doc/html/v6.8/admin-guide/cgroup-v2.html",
          "note": "cpu.max、memory.max与pids.max是不同资源接口；测试读取实际值。"
        }
      ]
    },
    {
      "id": "lifecycle",
      "title": "用重建、失败与恢复检验生命周期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "正常路径先在v1写1，docker stop给予3秒停止窗口，再核对退出0。v2用同一卷启动后应读到1，并在卷中读到v1的SIGTERM记录。这里的恢复是重新创建实例并读回已有数据；卷在实例停止后继续存在，不代表自动备份、数据格式兼容或数据库恢复协议已经建立。"
        },
        {
          "type": "code",
          "filename": "examples/docker-engineering/oom_fixture.py",
          "language": "python",
          "kind": "runnable",
          "purpose": "完整有界OOM夹具；保留同cgroup低内存观察器，要求分配子进程SIGKILL及oom_kill增量，不把MemoryError视为通过。",
          "code": "\"\"\"Observe a bounded cgroup OOM; keep a small PID1 reader after the allocator dies.\"\"\"\nimport json\nfrom pathlib import Path\nimport subprocess\nimport sys\n\nROOT = Path('/sys/fs/cgroup')\n\n\ndef snapshot():\n    values = {name: (ROOT / name).read_text().strip()\n              for name in ('memory.max', 'memory.swap.max', 'memory.current', 'memory.peak')}\n    values['memory.events'] = {key: int(value) for line in (ROOT / 'memory.events').read_text().splitlines()\n                              for key, value in [line.split()]}\n    return values\n\n\ndef main():\n    before = snapshot()\n    print(json.dumps({'event': 'oom_before', 'cgroup': before}), flush=True)\n    program = ('import json;chunks=[];'\n               'print(json.dumps({\"event\":\"allocator_started\"}),flush=True);'\n               'exec(\"for _ in range(32):\\\\n chunks.append(bytearray(8*1024*1024))\");'\n               'print(json.dumps({\"event\":\"unexpected_allocation_success\"}),flush=True)')\n    child = subprocess.Popen([sys.executable, '-u', '-c', program])\n    try:\n        result = child.wait(timeout=20)\n    finally:\n        if child.poll() is None:\n            child.kill()\n            child.wait(timeout=2)\n    after = snapshot()\n    killed = after['memory.events']['oom_kill'] - before['memory.events']['oom_kill']\n    print(json.dumps({'event': 'oom_after', 'allocator_exit': result,\n                      'oom_kill_delta': killed, 'cgroup': after}), flush=True)\n    if result != -9 or killed < 1:\n        raise RuntimeError('expected allocator SIGKILL and real cgroup oom_kill increment')\n    # Translate the verified allocator death to a deliberate fixture exit status.\n    # Docker OOMKilled and memory.events are checked separately by the controller.\n    raise SystemExit(137)\n\n\nif __name__ == '__main__':\n    main()"
        },
        {
          "type": "code",
          "code": "        assert request(port, \"/counter\", post=True) == (201, {\"value\": 1, \"version\": \"v1\"})\n        docker(\"stop\", \"--time\", \"3\", names[0])\n        assert inspect(names[0])[\"State\"][\"ExitCode\"] == 0\n        port = start(names[1], \"v2\")\n        assert request(port, \"/counter\")[1] == {\"value\": 1, \"version\": \"v2\"}\n        stopped = json.loads(docker(\"exec\", names[1], \"python\", \"-c\",\n                             \"from pathlib import Path;print(Path('/data/stopped-v1.json').read_text())\").stdout)\n        assert stopped[\"signals\"] == [\"SIGTERM\"]\n        print(json.dumps({\"case\": \"isolation_persistence_signal\", \"persistent_value\": 1,\n                          \"uid\": 10001, \"pid_in_container\": 1, \"different_pid_namespace\": True}), flush=True)\n        docker(\"run\", \"--detach\", \"--name\", names[2], \"--env\", \"APP_START_FAIL=1\", image)\n        assert docker(\"wait\", names[2]).stdout.strip() == \"42\"\n        docker(\"run\", \"--detach\", \"--name\", names[3], \"--memory\", \"64m\", \"--memory-swap\", \"64m\",\n               \"--pids-limit\", \"16\", \"--cpus\", \"0.5\", image, \"python\", \"-u\", \"/app/oom_fixture.py\")\n        waited = docker(\"wait\", names[3], timeout=30).stdout.strip()\n        logs = docker(\"logs\", names[3], check=False)\n        state = inspect(names[3])[\"State\"]\n        print(json.dumps({\"case\": \"oom_diagnostic\", \"wait_exit\": waited, \"state\": state,\n                          \"stdout\": logs.stdout, \"stderr\": logs.stderr}), flush=True)\n        events = [json.loads(line) for line in logs.stdout.splitlines() if line.startswith(\"{\")]\n        after = next(event for event in events if event[\"event\"] == \"oom_after\")\n        assert after[\"allocator_exit\"] == -9 and after[\"oom_kill_delta\"] >= 1\n        assert after[\"cgroup\"][\"memory.max\"] == str(64 * 1024 * 1024)\n        assert after[\"cgroup\"][\"memory.swap.max\"] == \"0\"\n        eventually(lambda: inspect(names[3])[\"State\"][\"OOMKilled\"] is True,\n                   \"Docker cgroup OOM event reflected in state\", seconds=5)\n        assert waited == \"137\" and inspect(names[3])[\"State\"][\"ExitCode\"] == 137\n        print(json.dumps({\"case\": \"bounded_failures\", \"startup_exit\": 42, \"oom_killed\": True,\n                          \"allocator_sigkill\": True, \"cgroup_oom_kill_delta\": after[\"oom_kill_delta\"],\n                          \"fixture_exit\": 137}), flush=True)",
          "filename": "examples/docker-engineering/verify.py",
          "purpose": "持久化、正常停止、启动失败和受控OOM的完整连续断言。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "第二个失败容器memory与memory-swap都锁64MiB，内部低内存PID1观察器启动分配子进程，子进程每次持有8MiB，最多256MiB。观察器在子进程结束后记录memory.events、memory.peak、memory.max与memory.swap.max，要求分配者被SIGKILL且真实oom_kill计数增加，再明确把这个已验证故障映射为夹具退出137。控制器另外要求Docker的OOMKilled=true，并打印完整State和容器日志；它不会把普通MemoryError或任意退出码当作OOM成功。"
        },
        {
          "type": "paragraph",
          "text": "容器退出码要结合阶段解释：42来自启动校验；新夹具137由观察器在验证分配子进程OOM后显式返回，不能单独充当内核杀死容器PID1的证据。真实OOM证据来自子进程-9、cgroup oom_kill增量与Docker OOMKilled。若失败，先从State、stderr、memory.swap.max和events判断是普通分配失败、资源配置不符还是事件尚未反映，不能直接放宽断言。出现只读或权限错误，则回到具体目录及普通UID所有权检查。"
        },
        {
          "type": "reference",
          "title": "Docker命名卷生命周期",
          "url": "https://docs.docker.com/engine/storage/volumes/",
          "note": "卷独立于运行实例，但持久化不等于数据库事务或备份。"
        }
      ]
    },
    {
      "id": "run",
      "title": "从独立入口运行，并核验自己创建的资源已清理",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端",
          "code": "timeout --signal=TERM --kill-after=45s 360s bash examples/docker-engineering/verify-linux.sh",
          "purpose": "在具有本机Docker权限的一次性Linux VM运行；需要Python3.12与GNU timeout，首次拉固定镜像需要registry网络。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "paragraph",
          "text": "入口拒绝非Linux、显式DOCKER_HOST以及非unix Docker context，防止把练习发往另一台daemon。镜像、四个容器和卷使用同一个随机atlas-lab-docker前缀，创建前拒绝撞名。finally按确切名称删除这些资源并再次inspect检查不存在；没有prune，也不遍历删除用户其他容器。基础镜像和构建缓存可能保留，清理声明仅覆盖本次创建的名字。"
        },
        {
          "type": "code",
          "code": "    finally:\n        failures = []\n        for name in names:\n            try:\n                docker(\"rm\", \"--force\", name, check=False)\n            except (OSError, subprocess.TimeoutExpired) as error:\n                failures.append(str(error))\n        for arguments in [(\"volume\", \"rm\", volume), (\"image\", \"rm\", image)]:\n            try:\n                docker(*arguments, check=False)\n            except (OSError, subprocess.TimeoutExpired) as error:\n                failures.append(str(error))\n        for arguments in [(\"inspect\", n) for n in names] + [(\"volume\", \"inspect\", volume), (\"image\", \"inspect\", image)]:\n            if docker(*arguments, check=False).returncode == 0:\n                failures.append(\"resource remains: \" + arguments[-1])\n        if failures:\n            raise RuntimeError(\"cleanup incomplete: \" + \"; \".join(failures))\n        print(json.dumps({\"cleanup\": \"complete\", \"prefix\": prefix}), flush=True)\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "examples/docker-engineering/verify.py",
          "purpose": "完整异常与清理路径；部分创建成功也按预先规划的确切名称检查。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "成功结果应依次出现actual_cgroup_v2_limits、isolation_persistence_signal、bounded_failures和cleanup complete。若失败，Docker命令带30秒级超时，build单独180秒；外层超时先发TERM，让Python进入finally，再给清理余量。SIGKILL、机器掉电和daemon失联都不能由用户态finally保证，因此不能用最后一句日志替代inspect确认。"
        },
        {
          "type": "paragraph",
          "text": "最新修后CI保留了完整证据：主服务cpu.max50000 100000、memory.max134217728、pids.max32，UID10001/PID1且namespace不同，卷值1与SIGTERM记录通过。OOM专用容器memory.max67108864、swap.max0、peak67108864，分配子进程-9、oom_kill_delta1，Docker State OOMKilled=true/ExitCode137，最后cleanup complete。旧单进程夹具曾在重复运行中未得到OOMKilled，缺少当时诊断，不能倒推确定根因；新夹具用独立事件把失败原因收口。文章仍review等站点最终验收。"
        },
        {
          "type": "paragraph",
          "text": "接下来发布服务时，还需要在容器成功之外增加候选就绪、入口流量切换、旧请求排空和回滚后置条件。命名卷会继续存在，也意味着应用升级必须独立考虑数据格式兼容；单个容器能正常停止，只是可发布系统的一部分。"
        }
      ]
    }
  ]
};

export default article;
