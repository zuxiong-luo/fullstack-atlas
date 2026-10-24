import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "linux-services",
  "topic": "operations",
  "title": "Linux 服务基础：进程、线程、信号与服务管理",
  "description": "从进程资源、线程执行和信号退出建立服务模型，交付loopback服务、proc观察及真实systemd用户/系统服务实验；Ubuntu隔离CI已验证进程、信号和两种scope的systemd服务生命周期。",
  "minutes": 58,
  "labMinutes": 45,
  "tags": [
    "Linux",
    "进程",
    "线程",
    "信号",
    "systemd"
  ],
  "scope": "Linux普通进程与systemd服务生命周期；文档systemd255/Linux6.8 proc/man-pages6.19；Ubuntu24.04.5隔离CI已通过proc3、模拟清理3与真实user/system两scope完整生命周期。",
  "prerequisites": [
    "会使用终端和读取基础Python",
    "理解HTTP请求，尚不要求懂Linux内核或systemd"
  ],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "systemd255文档；CI 255.4-1ubuntu8.17",
    "Linux v6.8 proc文档；CI kernel6.17.0-1022-azure；man-pages6.19",
    "Ubuntu24.04.5 LTS / CPython3.12.14；完整隔离CI通过"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "Linux服务实验ZIP",
      "path": "linux-services.zip"
    },
    {
      "label": "运行、权限与验证状态",
      "path": "linux-services/README.md"
    }
  ],
  "references": [
    {
      "title": "Linux6.8：proc文件系统",
      "url": "https://github.com/torvalds/linux/blob/v6.8/Documentation/filesystems/proc.rst"
    },
    {
      "title": "Linux man-pages6.19：pthreads",
      "url": "https://man7.org/linux/man-pages/man7/pthreads.7.html"
    },
    {
      "title": "Linux man-pages6.19：signal",
      "url": "https://man7.org/linux/man-pages/man7/signal.7.html"
    },
    {
      "title": "systemd255：服务类型与重启",
      "url": "https://www.freedesktop.org/software/systemd/man/255/systemd.service.html"
    },
    {
      "title": "systemd255：停止范围与信号",
      "url": "https://www.freedesktop.org/software/systemd/man/255/systemd.kill.html"
    },
    {
      "title": "systemd255：systemctl与管理器",
      "url": "https://www.freedesktop.org/software/systemd/man/255/systemctl.html"
    },
    {
      "title": "完整Ubuntu隔离CI实际成功记录",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509"
    }
  ],
  "sections": [
    {
      "id": "process",
      "title": "服务先是进程，再由管理器组织生命周期",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "进程是操作系统组织程序运行和资源的一种基本单位。对本篇常见的Linux程序，一个进程拥有地址空间、打开的文件描述符和身份等资源；线程是在这组资源内执行代码的执行流，有自己的栈和调度状态。服务则是长期承担某项职责的程序以及围绕它的启动、停止、失败恢复约定。把程序放到后台，只改变它与当前终端的关系，并不自动得到完整的服务管理。"
        },
        {
          "type": "paragraph",
          "text": "我们要运行一个只监听本机的HTTP健康服务：主线程处理请求，工作线程等待停止事件，退出时两者一起收口。先手动观察进程与线程，再用信号请求退出，最后交给systemd分别作为用户服务和系统服务管理。这样，端口、进程、停止记录与管理器状态都指向同一个案例，读者能沿一条生命周期判断问题在哪里。"
        },
        {
          "type": "paragraph",
          "text": "文档语义固定systemd255、Linux内核v6.8的proc文档与Linux man-pages6.19；文档版本不等于运行内核。隔离CI系列实际环境为Ubuntu24.04.5 LTS、systemd255.4-1ubuntu8.17、kernel6.17.0-1022-azure和CPython3.12.14。最新普通无strace运行已完整通过：proc与信号3项、模拟部分清理3项，以及user/system两套真实服务启动、停止、失败重启耗尽、恢复和清理。作者本机macOS没有Linux VM，Linux证据来自这次隔离CI；文章仍review等最终图形与站点验收。"
        }
      ]
    },
    {
      "id": "tasks",
      "title": "从PID和线程ID区分资源身份与执行身份",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Linux把可调度的任务暴露为线程ID。常见多线程进程中，各线程拥有不同TID，但属于同一个线程组，Tgid相同；主线程的TID通常就是这个组的进程ID。Python的os.getpid报告进程身份，thread.native_id给出系统线程ID。不要把Python线程对象的标识、pthread_t与内核TID混成一个数字，也不要拿“有两个线程”直接推出它们正在两个CPU核上同时计算。"
        },
        {
          "type": "paragraph",
          "text": "线程共享大部分进程资源，所以打开的监听socket并不是每个线程都各有一份独立服务。共享对象的修改也可能相互影响，需要同步协议。我们的工作线程只等待Event，不修改业务数据；主线程收到停止请求后设置同一个事件，让工作线程退出，再join确认它已经结束。这里用一个很小的协作协议，把“通知”和“确实停止”区分开。"
        },
        {
          "type": "paragraph",
          "text": "/proc是内核暴露进程等信息的伪文件系统，并非磁盘上保存的一份永远正确的状态档案。/proc/PID/status包含身份、线程数和调度状态；task目录列出线程；fd目录中的链接指向文件、socket等打开对象；cgroup说明所属控制组。读取期间进程仍可能变化，因此它是观测快照，字段之间不是一个原子事务。PID也可能复用，不能当永久业务身份。"
        },
        {
          "type": "reference",
          "title": "固定版本依据：Linux6.8 proc说明",
          "url": "https://github.com/torvalds/linux/blob/v6.8/Documentation/filesystems/proc.rst"
        },
        {
          "type": "reference",
          "title": "线程共享与独立属性：man-pages6.19",
          "url": "https://man7.org/linux/man-pages/man7/pthreads.7.html"
        }
      ]
    },
    {
      "id": "minimal",
      "title": "完整最小服务：就绪、停止请求与资源清理",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/linux-services/service.py",
          "kind": "excerpt",
          "purpose": "完整可运行服务。只绑定127.0.0.1动态端口；正常启动写本次PID/端口，退出时join线程并记录信号。",
          "code": "\"\"\"Small loopback service with explicit thread and signal lifecycle.\"\"\"\nimport argparse\nfrom http.server import BaseHTTPRequestHandler, HTTPServer\nimport json\nimport os\nfrom pathlib import Path\nimport signal\nimport threading\n\n\ndef write_json(path: Path, value: object) -> None:\n    temporary = path.with_suffix(\".tmp\")\n    temporary.write_text(json.dumps(value), encoding=\"utf-8\")\n    temporary.replace(path)\n\n\ndef main() -> int:\n    parser = argparse.ArgumentParser()\n    parser.add_argument(\"--state\", type=Path, required=True)\n    arguments = parser.parse_args()\n    state = arguments.state\n    state.mkdir(parents=True, exist_ok=True)\n    for name in (\"ready.json\", \"stopped.json\"):\n        (state / name).unlink(missing_ok=True)\n    if os.environ.get(\"ATLAS_LAB_START_FAIL\") == \"1\":\n        print(json.dumps({\"event\": \"start_failed\", \"exit_code\": 42}), flush=True)\n        return 42\n    stopping = threading.Event()\n    received = []\n\n    def request_stop(number, frame):\n        received.append(signal.Signals(number).name)\n        stopping.set()\n\n    signal.signal(signal.SIGTERM, request_stop)\n    signal.signal(signal.SIGINT, request_stop)\n\n    class Handler(BaseHTTPRequestHandler):\n        def do_GET(self):\n            body = json.dumps({\"pid\": os.getpid(), \"status\": \"ok\"}).encode()\n            self.send_response(200 if self.path == \"/health\" else 404)\n            self.send_header(\"Content-Type\", \"application/json\")\n            self.send_header(\"Content-Length\", str(len(body)))\n            self.end_headers()\n            self.wfile.write(body)\n\n        def log_message(self, *args):\n            pass\n\n    class Server(HTTPServer):\n        def get_request(self):\n            connection, address = super().get_request()\n            connection.settimeout(1)\n            return connection, address\n\n    with Server((\"127.0.0.1\", 0), Handler) as server:\n        server.timeout = 0.2\n        worker = threading.Thread(target=stopping.wait, name=\"atlas-lab-worker\")\n        worker.start()\n        try:\n            information = {\"pid\": os.getpid(), \"port\": server.server_port,\n                           \"worker_tid\": worker.native_id}\n            write_json(state / \"ready.json\", information)\n            print(json.dumps({\"event\": \"ready\", **information}), flush=True)\n            while not stopping.is_set():\n                server.handle_request()\n        finally:\n            stopping.set()\n            worker.join(timeout=2)\n            if worker.is_alive():\n                raise RuntimeError(\"worker did not stop\")\n            (state / \"ready.json\").unlink(missing_ok=True)\n            write_json(state / \"stopped.json\", {\"pid\": os.getpid(), \"signals\": received})\n            print(json.dumps({\"event\": \"stopped\", \"signals\": received}), flush=True)\n    return 0\n\n\nif __name__ == \"__main__\":\n    raise SystemExit(main())\n"
        },
        {
          "type": "paragraph",
          "text": "Server构造时绑定端口0，让内核分配当前可用端口，避免去占某个用户服务的固定端口。工作线程启动后，ready.json才写入本次PID、端口和native_id；HTTP的/health也返回PID。文件标记帮助找到端点，真正的健康响应证明这个端点能够完成请求，两者不能相互替代。未知路径返回404，不影响健康入口的含义。"
        },
        {
          "type": "paragraph",
          "text": "主循环用带短超时的handle_request，周期性回到停止条件；每个已接受socket也有读取超时，避免一个只连接不发请求的客户端无限拖住停止。信号处理函数只记录请求并设置Event，不在里面做耗时收尾。finally通知工作线程、join、删除ready并写停止记录；HTTPServer上下文关闭监听socket。服务没有子进程、数据库或公网入口，不能把这个最小实现当生产HTTP服务器。"
        },
        {
          "type": "paragraph",
          "text": "ATLAS_LAB_START_FAIL=1让启动在绑定端口前以42退出。这个有意的失败开关只服务于验证管理器重启和恢复；它不是随机模拟“可能失败”。读者能明确知道失败发生在哪个阶段，也能判断没有ready是因为程序没启动成功，还是只是业务健康暂时没有响应。"
        }
      ]
    },
    {
      "id": "observe",
      "title": "只读排查脚本：先确认自己观察的是哪一个进程",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/linux-services/inspect.py",
          "kind": "excerpt",
          "purpose": "完整只读/proc快照脚本，输入是本实验state目录；非Linux先退出77，不发送信号或修改服务。",
          "code": "\"\"\"Read-only Linux /proc snapshot for the PID named by this lab's readiness file.\"\"\"\nimport json\nfrom pathlib import Path\nimport sys\n\n\ndef inspect(state: Path) -> dict:\n    if sys.platform != \"linux\":\n        raise RuntimeError(\"Linux /proc required\")\n    ready = json.loads((state / \"ready.json\").read_text())\n    pid = int(ready[\"pid\"])\n    process = Path(\"/proc\") / str(pid)\n    status = {}\n    for line in (process / \"status\").read_text().splitlines():\n        key, _, value = line.partition(\":\")\n        if key in {\"Name\", \"State\", \"Pid\", \"Tgid\", \"PPid\", \"Threads\"}:\n            status[key] = value.strip()\n    descriptors = {}\n    for path in (process / \"fd\").iterdir():\n        try:\n            descriptors[path.name] = str(path.readlink())\n        except FileNotFoundError:\n            descriptors[path.name] = \"vanished during snapshot\"\n    return {\"pid\": pid, \"status\": status,\n            \"task_ids\": sorted(int(path.name) for path in (process / \"task\").iterdir()),\n            \"fds\": descriptors, \"cgroup\": (process / \"cgroup\").read_text().strip()}\n\n\nif __name__ == \"__main__\":\n    if sys.platform != \"linux\":\n        print(\"SKIP: Linux /proc required\", file=sys.stderr)\n        raise SystemExit(77)\n    print(json.dumps(inspect(Path(sys.argv[1])), ensure_ascii=False))\n"
        },
        {
          "type": "paragraph",
          "text": "先从本次ready读取PID，再看status里的Pid/Tgid/Threads，接着核对task中是否包含worker_tid。fd的链接会显示socket或普通文件；它们是进程拥有的句柄，不应被误读成“打开了几个磁盘文件”。脚本允许链接在读取中消失，并把这个竞争如实标成vanished，避免把进程的动态变化当作解析器错误。"
        },
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "purpose": "仅Linux，在examples/linux-services目录运行。观察到event=ready后再执行inspect；所有信号只发送给本次启动保存的lab_pid。",
          "code": "lab_state=$(mktemp -d /tmp/atlas-lab-manual.XXXXXX)\npython3 service.py --state \"$lab_state\" &\nlab_pid=$!\n# 等待上方出现event=ready，然后执行：\npython3 inspect.py \"$lab_state\"\nkill -TERM \"$lab_pid\"\nwait \"$lab_pid\"\ncat \"$lab_state/stopped.json\"\nrm -rf -- \"$lab_state\""
        },
        {
          "type": "paragraph",
          "text": "隔离Linux CI已通过3项proc/信号测试：task集合包含不同的主PID和worker_tid，各线程status的Tgid一致，HTTP响应PID匹配，描述符集合至少包含标准流。若inspect找不到/proc/PID，先确认服务是否已经退出、ready是否残留；若权限失败，确认观察者身份与目标用户。不要在没核对身份前对系统上看起来相似的PID发信号。"
        }
      ]
    },
    {
      "id": "signals",
      "title": "信号是请求或控制事件，退出仍有过程",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "信号的处置可以是默认动作、忽略或由处理函数接收。SIGTERM通常表达终止请求，程序有机会执行约定的收尾；SIGKILL不能被捕获、屏蔽或忽略，内核终止执行，不会替应用运行finally。对本例，TERM使Python处理函数设置Event，主循环结束并返回0；没有自定义处理时，同名信号可以产生不同的默认退出行为，所以不能背一个统一退出码代替查看实际处置。"
        },
        {
          "type": "paragraph",
          "text": "信号到达也不等于“进程这一刻就已经不存在”。停止可能需要等待当前请求和工作线程；父进程还要wait收集子进程退出状态，避免留下未回收的僵尸。Python的信号处理函数在主解释器主线程执行，和底层异步信号处理的约束还要区分。标准信号也不适合作为可靠逐条计数的消息队列，多个同类未决信号可能合并。"
        },
        {
          "type": "paragraph",
          "text": "自动实验先等ready与HTTP真实就绪，再TERM并要求退出0、ready消失、stopped.signals为SIGTERM。另一个子进程只用KILL终止，断言没有stopped但ready仍可能留下；随后启动替代进程，要求新的ready指向新PID并恢复健康。这3项进程测试已在隔离Ubuntu CI通过；它们没有覆盖后面的systemd用户与系统服务编排，不能用前一层的成功替代后一层验收。"
        },
        {
          "type": "reference",
          "title": "信号语义：man-pages6.19 signal",
          "url": "https://man7.org/linux/man-pages/man7/signal.7.html"
        },
        {
          "type": "reference",
          "title": "Python3.12信号处理线程边界",
          "url": "https://docs.python.org/3.12/library/signal.html"
        }
      ]
    },
    {
      "id": "manager",
      "title": "systemd把启动、停止范围和失败策略变成显式配置",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "/figures/linux-services/lifecycle.svg",
          "title": "服务生命周期与两个管理器范围",
          "alt": "启动exec成功后还需要HTTP就绪；TERM进入收尾后停止，故障42触发有限重启再failed，修复配置reset-failed后恢复；用户与系统管理器各有独立unit范围。",
          "caption": "状态与职责示意，不表示运行耗时。Type=exec不是HTTP就绪协议，KILL会绕过应用收尾。"
        },
        {
          "type": "code",
          "language": "ini",
          "filename": "examples/linux-services/atlas-lab-system.service.in",
          "kind": "excerpt",
          "purpose": "完整系统unit模板。编排器替换绝对路径和独立临时用户名，安装到/run/systemd/system；不是直接可启动的成品unit。",
          "code": "[Unit]\nDescription=Atlas isolated service lifecycle laboratory\nStartLimitIntervalSec=10s\nStartLimitBurst=3\n\n[Service]\nType=exec\nUser=@USER@\nWorkingDirectory=@ROOT@\nEnvironmentFile=-@STATE@/service.env\nExecStart=\"@PYTHON@\" -u \"@APP@\" --state \"@STATE@\"\nRestart=on-failure\nRestartSec=200ms\nKillSignal=SIGTERM\nKillMode=control-group\nTimeoutStopSec=4s\nNoNewPrivileges=yes\nStandardOutput=journal\nStandardError=journal\n\n[Install]\nWantedBy=multi-user.target\n"
        },
        {
          "type": "code",
          "language": "ini",
          "filename": "examples/linux-services/atlas-lab-user.service.in",
          "kind": "excerpt",
          "purpose": "完整用户unit模板，由临时用户自己的systemd --user管理；用户身份来自管理器，不再设置User=。",
          "code": "[Unit]\nDescription=Atlas isolated user service lifecycle laboratory\nStartLimitIntervalSec=10s\nStartLimitBurst=3\n\n[Service]\nType=exec\nWorkingDirectory=@ROOT@\nEnvironmentFile=-@STATE@/service.env\nExecStart=\"@PYTHON@\" -u \"@APP@\" --state \"@STATE@\"\nRestart=on-failure\nRestartSec=200ms\nKillSignal=SIGTERM\nKillMode=control-group\nTimeoutStopSec=4s\nNoNewPrivileges=yes\nStandardOutput=journal\nStandardError=journal\n\n[Install]\nWantedBy=default.target\n"
        },
        {
          "type": "paragraph",
          "text": "Type=exec把“可执行程序成功exec”作为一层启动确认，但程序接下来仍可能校验配置失败，也不代表HTTP已经就绪。Restart=on-failure在异常退出时尝试重启，StartLimit限制短时间启动次数，防止错误配置造成无休止循环；人工stop属于明确停止操作，不应被理解成一次需要自动恢复的崩溃。环境文件前面的减号允许首次没有该文件，故障实验随后只改变自己的文件。"
        },
        {
          "type": "paragraph",
          "text": "KillSignal=SIGTERM先给程序机会收尾，TimeoutStopSec=4s限定停止等待，KillMode=control-group把停止范围覆盖到这个unit控制组中的进程成员，而不只盯主PID。cgroup是资源与生命周期组织机制，不因此等于容器安全隔离。本例还用/proc/PID/cgroup核对MainPID确实属于管理器给出的ControlGroup，不靠服务名猜进程归属。"
        },
        {
          "type": "paragraph",
          "text": "system服务由系统管理器管理，可以用User指定非特权运行身份；user服务由用户管理器管理，systemctl --user与普通systemctl看到的是不同范围。启动只影响当前运行状态，enable主要建立按目标启动的配置链接，不等于立即启动；daemon-reload重新读取unit配置，不代表程序完成应用级reload。我们的unit没有ExecReload，所以不提供一个假装可用的reload命令。"
        },
        {
          "type": "reference",
          "title": "systemd255服务类型与重启规则",
          "url": "https://www.freedesktop.org/software/systemd/man/255/systemd.service.html"
        },
        {
          "type": "reference",
          "title": "systemd255停止范围与信号",
          "url": "https://www.freedesktop.org/software/systemd/man/255/systemd.kill.html"
        }
      ]
    },
    {
      "id": "integration",
      "title": "自动复现：以真实状态屏障驱动故障和恢复",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "filename": "examples/linux-services/verify-linux.sh",
          "kind": "excerpt",
          "purpose": "完整CI入口。Linux检查在依赖与sudo之前；非Linux退出77，不触发任何系统服务修改。",
          "code": "#!/usr/bin/env bash\nset -euo pipefail\nif [[ \"$(uname -s)\" != \"Linux\" ]]; then\n  echo 'SKIP: Linux/systemd required; no host service operation performed.' >&2\n  exit 77\nfi\nfor tool in python3 systemctl timeout sudo runuser useradd userdel groupdel journalctl; do\n  command -v \"$tool\" >/dev/null || { echo \"Missing required tool: $tool\" >&2; exit 78; }\ndone\npython3 -c 'import sys; assert sys.version_info[:2] == (3, 12), sys.version'\nsudo -n true\nroot_dir=\"$(cd -- \"$(dirname -- \"${BASH_SOURCE[0]}\")\" && pwd)\"\npython3 --version\ncat /etc/os-release\nsystemctl --version\nuname -r\ntimeout 15s python3 \"$root_dir/tests/test_cleanup.py\"\ntimeout 45s python3 \"$root_dir/test_process.py\"\n# The Python orchestrator owns cleanup; its subprocesses have individual deadlines.\n# Its finally removes only its generated atlas-lab-* user, units and /var/tmp tree.\npython3 \"$root_dir/verify_systemd.py\"\npython3 \"$root_dir/verify-article.py\"\n"
        },
        {
          "type": "paragraph",
          "text": "入口需要完整Ubuntu VM和免密sudo，不在容器或mac上冒充systemd宿主。编排器随机建立atlas-lab前缀临时用户，单独启动这个UID的user manager，用户unit写临时用户目录，系统unit写/run，均不enable。每次健康检查同时核对MainPID和HTTP响应；故障阶段观察实际failed、ExecMainStatus42和至少一次NRestarts；恢复阶段修复环境、reset-failed，再真正请求健康。"
        },
        {
          "type": "paragraph",
          "text": "收尾先按逆序停止本次unit、删除文件并重读管理器，再停止临时UID的用户管理器、删账户/私有组和本次目录；最后检查unit文件、账户/组、该UID进程与目录都不存在，才输出cleanup=complete。命令超时或残留会明确报cleanup incomplete，不把“执行过finally”当成功。它不停止其他服务；SIGKILL或断电仍可打断finally，因此只允许一次性VM。外层总期限也不是生产恢复时间承诺。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/linux-services/verify_systemd.py",
          "kind": "excerpt",
          "purpose": "完整Linux集成编排：真实命令、故障注入、观察屏障和本次命名资源清理。每个子命令与轮询有期限；仅一次性VM允许sudo。",
          "code": "\"\"\"Linux disposable-VM integration: own units/user only; every command is bounded.\"\"\"\nimport grp\nimport json\nimport os\nfrom pathlib import Path\nimport pwd\nimport shutil\nimport signal\nimport subprocess\nimport sys\nimport tempfile\nimport time\nfrom urllib.request import urlopen\nimport uuid\n\nROOT = Path(__file__).resolve().parent\nSUDO = [\"sudo\", \"-n\"]\n\n\ndef run(arguments, *, check=True, timeout=15):\n    result = subprocess.run(arguments, capture_output=True, text=True, timeout=timeout)\n    if check and result.returncode:\n        raise RuntimeError(f\"{arguments!r}: {result.returncode}\\n{result.stdout}\\n{result.stderr}\")\n    return result\n\n\ndef eventually(predicate, label, seconds=12):\n    deadline = time.monotonic() + seconds\n    while time.monotonic() < deadline:\n        value = predicate()\n        if value:\n            return value\n        time.sleep(0.05)  # Poll an observed state; never infer readiness from elapsed sleep.\n    raise AssertionError(\"not observed: \" + label)\n\n\ndef main():\n    if sys.platform != \"linux\" or not Path(\"/run/systemd/system\").is_dir():\n        raise SystemExit(\"Linux booted with systemd is required\")\n    if Path(\"/proc/1/comm\").read_text().strip() != \"systemd\":\n        raise SystemExit(\"PID 1 must be systemd in the disposable VM\")\n    if os.geteuid() == 0:\n        raise SystemExit(\"Run as the CI user with passwordless sudo, not as root\")\n    run(SUDO + [\"true\"])\n    prefix = \"atlas-lab-\" + uuid.uuid4().hex[:10]\n    # Refuse pre-existing identities; this run may delete only its own random name.\n    for lookup in (pwd.getpwnam, grp.getgrnam):\n        try:\n            lookup(prefix)\n        except KeyError:\n            continue\n        raise RuntimeError(\"temporary identity already exists: \" + prefix)\n    uid = None\n    for candidate in range(20000, 60000):\n        try:\n            pwd.getpwuid(candidate)\n        except KeyError:\n            uid = candidate\n            break\n    if uid is None:\n        raise RuntimeError(\"no unused ordinary UID in 20000..59999\")\n    work = Path(tempfile.mkdtemp(prefix=prefix + \"-\", dir=\"/var/tmp\"))\n    work.chmod(0o755)\n    installed = []\n\n    def interrupted(number, frame):\n        raise KeyboardInterrupt(f\"signal {number}\")\n\n    signal.signal(signal.SIGTERM, interrupted)\n    try:\n        skeleton = work / \"skel\"\n        skeleton.mkdir(mode=0o755)\n        # Avoid copying the VM image's default skeleton/toolchains.\n        # Avoid sparse lastlog initialization; keep even a partially created home\n        # under the directory owned by this run. Timeout is not proof of rollback.\n        run(SUDO + [\"useradd\", \"--no-log-init\", \"--uid\", str(uid), \"--user-group\",\n                    \"--home-dir\", str(work / \"home\"), \"--skel\", str(skeleton), \"--create-home\",\n                    \"--shell\", \"/usr/sbin/nologin\", prefix], timeout=30)\n        account = pwd.getpwnam(prefix)\n        if account.pw_uid != uid or account.pw_dir != str(work / \"home\"):\n            raise RuntimeError(\"temporary identity does not match the reserved UID/home\")\n        app = work / \"service.py\"\n        shutil.copyfile(ROOT / \"service.py\", app)\n        app.chmod(0o644)\n        run(SUDO + [\"systemctl\", \"start\", f\"user@{uid}.service\"])\n        eventually(lambda: run(SUDO + [\"test\", \"-S\", f\"/run/user/{uid}/bus\"],\n                               check=False).returncode == 0, \"isolated user bus\")\n        user_ctl = SUDO + [\"runuser\", \"-u\", prefix, \"--\", \"env\",\n                           f\"XDG_RUNTIME_DIR=/run/user/{uid}\",\n                           f\"DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/{uid}/bus\",\n                           \"systemctl\", \"--user\"]\n        system_ctl = SUDO + [\"systemctl\"]\n        for scope, ctl in ((\"user\", user_ctl), (\"system\", system_ctl)):\n            unit = f\"{prefix}-{scope}.service\"\n            state = work / scope\n            state.mkdir(mode=0o755)\n            run(SUDO + [\"chown\", f\"{uid}:{account.pw_gid}\", str(state)])\n            text = (ROOT / f\"atlas-lab-{scope}.service.in\").read_text()\n            replacements = {\"USER\": prefix, \"ROOT\": str(work), \"STATE\": str(state),\n                            \"PYTHON\": sys.executable, \"APP\": str(app)}\n            for key, value in replacements.items():\n                if any(character in value for character in ('\"', \"\\n\", \"\\\\\")):\n                    raise ValueError(\"unsupported unit path character\")\n                text = text.replace(f\"@{key}@\", value)\n            prepared = work / unit\n            prepared.write_text(text)\n            destination = (Path(account.pw_dir) / \".config/systemd/user\" / unit\n                           if scope == \"user\" else Path(\"/run/systemd/system\") / unit)\n            run(SUDO + [\"install\", \"-d\", \"-m\", \"755\", str(destination.parent)])\n            run(SUDO + [\"install\", \"-m\", \"644\", str(prepared), str(destination)])\n            installed.append((scope, ctl, unit, destination))\n            run(ctl + [\"daemon-reload\"])\n            run(ctl + [\"start\", unit])\n\n            def healthy():\n                try:\n                    info = json.loads((state / \"ready.json\").read_text())\n                    main_pid = int(run(ctl + [\"show\", unit, \"-p\", \"MainPID\", \"--value\"]).stdout)\n                    if main_pid != info[\"pid\"]:\n                        return False\n                    with urlopen(f\"http://127.0.0.1:{info['port']}/health\", timeout=1) as response:\n                        return json.load(response)[\"pid\"] == main_pid\n                except (OSError, ValueError):\n                    return False\n\n            eventually(healthy, scope + \" HTTP health and MainPID\")\n            control_group = run(ctl + [\"show\", unit, \"-p\", \"ControlGroup\", \"--value\"]).stdout.strip()\n            assert control_group.startswith(\"/\"), control_group\n            pid = int(run(ctl + [\"show\", unit, \"-p\", \"MainPID\", \"--value\"]).stdout)\n            assert control_group in Path(f\"/proc/{pid}/cgroup\").read_text()\n            run(ctl + [\"stop\", unit])\n            stopped = json.loads((state / \"stopped.json\").read_text())\n            assert stopped[\"signals\"] == [\"SIGTERM\"], stopped\n            assert run(ctl + [\"is-active\", unit], check=False).returncode != 0\n            print(json.dumps({\"scope\": scope, \"phase\": \"graceful_stop\", \"signal\": \"SIGTERM\",\n                              \"control_group\": control_group}), flush=True)\n            # Break only this instance's environment, then observe actual restart exhaustion.\n            environment_file = work / f\"{scope}.env\"\n            environment_file.write_text(\"ATLAS_LAB_START_FAIL=1\\n\")\n            run(SUDO + [\"install\", \"-o\", str(uid), \"-g\", str(account.pw_gid), \"-m\", \"644\",\n                        str(environment_file), str(state / \"service.env\")])\n            run(ctl + [\"start\", unit], check=False)\n            eventually(lambda: run(ctl + [\"is-failed\", unit], check=False).returncode == 0,\n                       scope + \" failed after bounded restarts\")\n            status = run(ctl + [\"show\", unit, \"-p\", \"ExecMainStatus\", \"--value\"]).stdout.strip()\n            restarts = int(run(ctl + [\"show\", unit, \"-p\", \"NRestarts\", \"--value\"]).stdout)\n            assert status == \"42\" and restarts >= 1, (status, restarts)\n            print(json.dumps({\"scope\": scope, \"phase\": \"fault\", \"state\": \"failed\",\n                              \"exit_status\": status, \"restarts\": restarts}), flush=True)\n            environment_file.write_text(\"ATLAS_LAB_START_FAIL=0\\n\")\n            run(SUDO + [\"install\", \"-o\", str(uid), \"-g\", str(account.pw_gid), \"-m\", \"644\",\n                        str(environment_file), str(state / \"service.env\")])\n            run(ctl + [\"reset-failed\", unit])\n            run(ctl + [\"start\", unit])\n            eventually(healthy, scope + \" recovery\")\n            run(ctl + [\"stop\", unit])\n            journal = (SUDO + [\"journalctl\", f\"_SYSTEMD_USER_UNIT={unit}\", \"-n\", \"12\", \"--no-pager\"]\n                       if scope == \"user\" else SUDO + [\"journalctl\", \"-u\", unit, \"-n\", \"12\", \"--no-pager\"])\n            print(run(journal).stdout, flush=True)\n            print(json.dumps({\"scope\": scope, \"phase\": \"recovery\", \"healthy\": True}), flush=True)\n    finally:\n        cleanup_errors = []\n\n        def cleanup(arguments):\n            try:\n                run(arguments, check=False, timeout=30)\n            except (OSError, subprocess.TimeoutExpired) as error:\n                cleanup_errors.append(str(error))\n\n        for scope, ctl, unit, destination in reversed(installed):\n            cleanup(ctl + [\"stop\", unit])\n            cleanup(ctl + [\"reset-failed\", unit])\n            cleanup(SUDO + [\"rm\", \"-f\", \"--\", str(destination)])\n            cleanup(ctl + [\"daemon-reload\"])\n        # Query the actual account even when useradd failed or timed out. Never\n        # remove a different UID/home, including a pre-existing unrelated account.\n        try:\n            account = pwd.getpwnam(prefix)\n        except KeyError:\n            account = None\n        identity_matches = (account is None or\n                            (account.pw_uid == uid and account.pw_dir == str(work / \"home\")))\n        if identity_matches:\n            cleanup(SUDO + [\"systemctl\", \"stop\", f\"user@{uid}.service\",\n                            f\"user-runtime-dir@{uid}.service\"])\n            if account is not None:\n                cleanup(SUDO + [\"userdel\", \"--remove\", prefix])\n            # useradd may have created the private group before the passwd entry.\n            try:\n                grp.getgrnam(prefix)\n            except KeyError:\n                pass\n            else:\n                cleanup(SUDO + [\"groupdel\", prefix])\n        else:\n            cleanup_errors.append(\"refused to remove mismatched temporary identity: \" + prefix)\n        assert work.parent == Path(\"/var/tmp\") and work.name.startswith(prefix + \"-\")\n        cleanup(SUDO + [\"rm\", \"-rf\", \"--\", str(work)])\n        for scope, ctl, unit, destination in installed:\n            if destination.exists():\n                cleanup_errors.append(\"unit remains: \" + str(destination))\n        for lookup in (pwd.getpwnam, grp.getgrnam):\n            try:\n                lookup(prefix)\n            except KeyError:\n                continue\n            cleanup_errors.append(\"temporary identity remains: \" + prefix)\n        # The reserved UID was unused before this run; no process may remain.\n        remaining = []\n        for entry in Path(\"/proc\").iterdir():\n            if entry.name.isdecimal():\n                try:\n                    if entry.stat().st_uid == uid:\n                        remaining.append(entry.name)\n                except FileNotFoundError:\n                    pass\n        if remaining:\n            cleanup_errors.append(\"temporary UID still owns processes: \" + repr(remaining))\n        if work.exists():\n            cleanup_errors.append(\"temporary directory remains: \" + str(work))\n        if cleanup_errors:\n            raise RuntimeError(\"cleanup incomplete: \" + \"; \".join(cleanup_errors))\n        print(json.dumps({\"cleanup\": \"complete\", \"prefix\": prefix, \"uid\": uid}), flush=True)\n\n\nif __name__ == \"__main__\":\n    main()\n"
        },
        {
          "type": "paragraph",
          "text": "创建账户也是可能部分成功的系统操作。编排器先拒绝已有同名账户/组，选取20000到59999之间未占用的UID，显式指定临时home并用--no-log-init跳过lastlog/faillog初始化，创建命令上限30秒。首次CI只证实旧useradd超时，尚不能断定慢在lastlog；这项修改避免一条已知的额外初始化路径。超时不代表回滚，所以finally始终重新查询唯一用户名，核对UID与home后才删除账户；私有组若只创建了一半也会清理。 后续实际strace看到useradd在循环openat复制Rust工具链rlib/rmeta文件，因此为不需要工具链的教学账户显式创建空skel并传--skel。trace证明复制行为，空skel后的普通无straceCI完整通过；结合实际复制轨迹，这个对照支持默认模板复制是本次超时的重要来源，而不是把最初lastlog假设当成已证根因。"
        }
      ]
    },
    {
      "id": "triage",
      "title": "把输出变成判断：进程、健康与管理器分层看",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "观察",
            "优先判断",
            "下一步证据"
          ],
          "rows": [
            [
              "ready存在但HTTP拒绝连接",
              "可能是KILL后的旧标记或端口错误",
              "核对本次PID、/proc及MainPID，不先宣称业务健康"
            ],
            [
              "进程在、HTTP超时",
              "请求处理或应用就绪路径可能卡住",
              "检查请求日志与线程状态，区分监听和完成响应"
            ],
            [
              "unit反复auto-restart后failed",
              "启动故障与次数预算已耗尽",
              "看ExecMainStatus、NRestarts和journal中的start_failed"
            ],
            [
              "stop后仍有成员",
              "停止范围、请求时限或收尾可能有问题",
              "检查ControlGroup成员、TimeoutStopSec与KillMode"
            ],
            [
              "user范围找不到system服务",
              "可能查看了另一个管理器",
              "明确systemctl还是systemctl --user，再核对unit安装目录"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "本例journal输出是结构化ready、start_failed与stopped事件，管理器还提供退出原因。日志告诉我们“程序说发生了什么”，状态与健康探测告诉我们“系统现在能观察到什么”，两者一起才能缩小问题。如果只看systemctl start返回0就宣布服务可用，会漏掉exec之后的配置失败；如果只看HTTP失败就认定进程死了，也会漏掉活着但没有完成请求的程序。"
        },
        {
          "type": "paragraph",
          "text": "最新隔离Ubuntu CI已完整通过。proc3项证明真实进程/线程/信号行为，两个systemd范围分别通过MainPID/HTTP健康与cgroup核对、TERM优雅停止、退出42/有限重启耗尽、修复恢复和无残留清理；模拟清理3项另覆盖部分创建失败，不混称为真实服务结果。没有验证高负载、容器、生产权限加固、高可用或手机。掌握这一条小服务生命周期之后，再继续性能与网络专题，才能知道自己排查的到底是执行、资源、管理器，还是应用协议。"
        },
        {
          "type": "reference",
          "title": "Ubuntu隔离CI：两套Linux脚本依序完整通过",
          "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509",
          "note": "head bea07732405b0faf0375adce85e3e242f8d0cb87；job约30秒，总约33秒，不是性能基准。"
        }
      ]
    }
  ]
};
export default article;
