import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "service-release-rollback",
  "topic": "operations",
  "title": "服务发布与回滚：反向代理、健康检查和配置变更",
  "description": "以私有Nginx和loopback双版本服务验证候选拒绝、配置校验、reload排空、切换后失败与显式路由回滚。",
  "minutes": 65,
  "labMinutes": 45,
  "tags": [
    "Nginx",
    "发布",
    "回滚",
    "健康检查",
    "反向代理"
  ],
  "scope": "一次性Linux私有Nginx前缀与有限后端；只做路由回滚，不覆盖数据库、TLS或真实长连接SLA。",
  "prerequisites": [
    "会运行终端命令并阅读基础Python",
    "理解上一章Linux进程与服务生命周期，示例可以独立下载运行"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Ubuntu24.04.5 / kernel6.17.0-1022-azure / CPython3.12.14",
    "Nginx1.24.0(Ubuntu)；worker代际、业务故障、显式回滚与清理通过"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "完整实验ZIP",
      "path": "service-release-rollback.zip"
    },
    {
      "label": "依赖、运行与验证记录",
      "path": "service-release-rollback/README.md"
    }
  ],
  "references": [
    {
      "title": "Nginx：reload与旧worker排空",
      "url": "https://nginx.org/en/docs/control.html"
    },
    {
      "title": "Nginx：反向代理模块",
      "url": "https://nginx.org/en/docs/http/ngx_http_proxy_module.html"
    },
    {
      "title": "Nginx：主配置与worker_shutdown_timeout",
      "url": "https://nginx.org/en/docs/ngx_core_module.html"
    },
    {
      "title": "Python3.12：HTTP服务与线程清理",
      "url": "https://docs.python.org/3.12/library/http.server.html"
    },
    {
      "title": "修后真实隔离CI成功与诊断",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101783608"
    }
  ],
  "sections": [
    {
      "id": "release",
      "title": "发布是把新版本接入流量，并验证它继续满足约定",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "服务发布是把一个确定版本放入运行环境，再使请求按照计划到达它的过程。启动程序只完成其中一步：候选可能活着却没有准备好，入口可能仍指向旧地址，切换后的业务也可能失败。回滚则是在失败后恢复一个已知可用的服务路径，并验证恢复效果；把配置文件改回去而不检查请求结果，还不能叫完成恢复。"
        },
        {
          "type": "paragraph",
          "text": "反向代理是客户端面前的服务入口。客户端访问代理地址，由代理建立到后端的连接并转发请求；后端版本更换时，客户端仍使用同一入口。本篇用自己的Nginx主进程和两个loopback后端演示这个关系，不改系统Nginx，不接触真实域名、TLS证书或公网流量。只有这些对象的生命周期都由实验控制，正常、故障与恢复才可重复。"
        },
        {
          "type": "paragraph",
          "text": "我们从v1开始：代理的新请求到v1。候选v2启动后先独立检查就绪，配置先做语法校验；一个已进入v1的请求保持未完成，再reload切到v2。新请求确认走v2后，明确释放旧请求，观察它仍由v1完成。最后让v2业务失败，恢复旧配置并从同一入口确认v1成功。每个结论都有对应HTTP与进程事件，不靠固定sleep推测“应该切完了”。"
        },
        {
          "type": "paragraph",
          "text": "目标环境是一次性Linux VM、CPython3.12.14与系统Nginx。首轮Ubuntu CI中Nginx1.24.0的候选拒绝与hold排空通过，但紧随其后的单次500检查失败。我们补上worker身份响应头与/proc退出确认后，23a4808修后CI已完整通过：Ubuntu24.04.5、kernel6.17.0-1022-azure、Python3.12.14、Nginx1.24.0。正文保留这个观察缺口与修正，不拿增加固定sleep替代真实代际条件；本机mac检查单独记录。"
        }
      ]
    },
    {
      "id": "health",
      "title": "先给存活、就绪和业务正确性划出不同问题",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "存活回答进程是否还能够执行基本响应；就绪回答当前是否适合接收业务流量；业务检查回答关键操作是否满足约定。它们可以使用不同接口和成本。若把远端所有依赖故障都塞进存活探针，管理器可能反复重启一个本身健康的程序；若只检查TCP能连接，又可能把正在返回500的新版本切上入口。"
        },
        {
          "type": "paragraph",
          "text": "本例后端从自己状态目录的mode.txt读取ok/error。/health始终表明进程能响应；/ready随mode改变返回200或503；业务/在error时返回500。这个可控制的差异用来证明“存活200不等于可发布”，并没有声称一份mode文件能代表真实数据库、配置兼容性或用户业务。APP_START_FAIL则在监听之前退出42，提供更早的失败阶段。"
        },
        {
          "type": "code",
          "code": "import argparse\nfrom http.server import BaseHTTPRequestHandler, ThreadingHTTPServer\nimport json\nimport os\nfrom pathlib import Path\nimport signal\nimport threading\n\nSTOP, RELEASE = threading.Event(), threading.Event()\n\n\nclass LimitedServer(ThreadingHTTPServer):\n    permits = threading.BoundedSemaphore(4)\n\n    def process_request(self, request, address):\n        if not self.permits.acquire(blocking=False):\n            self.shutdown_request(request)\n            return\n        try:\n            super().process_request(request, address)\n        except BaseException:\n            self.permits.release()\n            raise\n\n    def process_request_thread(self, request, address):\n        try:\n            super().process_request_thread(request, address)\n        finally:\n            self.permits.release()\n\n\ndef main():\n    parser = argparse.ArgumentParser()\n    parser.add_argument(\"--version\", choices=[\"v1\", \"v2\"], required=True)\n    parser.add_argument(\"--state\", type=Path, required=True)\n    options = parser.parse_args()\n    if os.environ.get(\"APP_START_FAIL\") == \"1\":\n        raise SystemExit(42)\n\n    class Handler(BaseHTTPRequestHandler):\n        def setup(self):\n            super().setup()\n            self.connection.settimeout(2)\n\n        def log_message(self, *arguments):\n            pass\n\n        def respond(self, status, **fields):\n            body = json.dumps({\"version\": options.version, **fields}).encode()\n            self.send_response(status)\n            self.send_header(\"Content-Length\", str(len(body)))\n            self.send_header(\"Content-Type\", \"application/json\")\n            self.send_header(\"Connection\", \"close\")\n            self.end_headers()\n            self.wfile.write(body)\n\n        def do_GET(self):\n            ready = (options.state / \"mode.txt\").read_text().strip() == \"ok\"\n            if self.path == \"/health\":\n                self.respond(200, alive=True)\n            elif self.path == \"/ready\":\n                self.respond(200 if ready else 503, ready=ready)\n            elif self.path == \"/hold\":\n                print(json.dumps({\"event\": \"held\", \"version\": options.version}), flush=True)\n                released = RELEASE.wait(5)\n                self.respond(200 if released else 503, released=released)\n            elif self.path == \"/\":\n                self.respond(200 if ready else 500, ok=ready)\n            else:\n                self.respond(404, error=\"not found\")\n\n        def do_POST(self):\n            if self.path == \"/release\" and self.headers.get(\"Content-Length\", \"0\") == \"0\":\n                RELEASE.set()\n                self.respond(200, released=True)\n            else:\n                self.respond(400, error=\"unsupported control request\")\n\n    def stop(number, frame):\n        STOP.set()\n        RELEASE.set()\n\n    for number in (signal.SIGINT, signal.SIGTERM):\n        signal.signal(number, stop)\n    with LimitedServer((\"127.0.0.1\", 0), Handler) as server:\n        server.timeout = .1\n        print(json.dumps({\"event\": \"ready\", \"port\": server.server_port, \"version\": options.version}), flush=True)\n        while not STOP.is_set():\n            server.handle_request()\n    print(json.dumps({\"event\": \"stopped\", \"version\": options.version}), flush=True)\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "examples/service-release-rollback/backend.py",
          "purpose": "完整后端夹具，最多四个请求处理线程，含存活/就绪/业务与显式hold/release协议。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "ThreadingHTTPServer的默认并发不是本例容量约定，所以LimitedServer用四个许可包住请求线程，结束时在finally归还。/hold最多等待5秒，显式/release负责推进，用于观察排空中的旧请求；它不是无限挂起连接，也不是生产控制接口。服务只绑定127.0.0.1动态端口，信号设置STOP并释放等待，server关闭时回收处理线程。"
        }
      ]
    },
    {
      "id": "proxy",
      "title": "让代理的入口、上游和生命周期都有自己的名字",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面的配置有独立prefix、PID文件与错误日志。daemon off让控制器直接持有Nginx主进程；只监听loopback动态端口，upstream指向某一个受控后端。代理使用Connection close，减少本实验对连接复用的额外假设；worker_connections32只是此配置的有限连接预算，不能当作业务每秒吞吐量。"
        },
        {
          "type": "code",
          "code": "daemon off;\nworker_processes 1;\nworker_shutdown_timeout 8s;\npid @ROOT@/nginx.pid;\nerror_log @ROOT@/nginx-error.log notice;\nevents { worker_connections 32; }\nhttp {\n  access_log off;\n  client_max_body_size 1k;\n  upstream notes { server 127.0.0.1:@BACKEND@; }\n  server {\n    listen 127.0.0.1:@FRONT@;\n    add_header X-Atlas-Worker $pid always;\n    location / {\n      proxy_pass http://notes;\n      proxy_http_version 1.1;\n      proxy_set_header Connection close;\n      proxy_connect_timeout 1s;\n      proxy_read_timeout 7s;\n      proxy_send_timeout 2s;\n    }\n  }\n}",
          "filename": "examples/service-release-rollback/nginx.conf.in",
          "purpose": "完整私有Nginx配置模板；@ROOT@、@FRONT@与@BACKEND@由控制器替换。",
          "language": "nginx",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "connect_timeout限制连接上游阶段，read_timeout约束两次读取之间的等待，不能把它简单当作整个响应的总时限。worker_shutdown_timeout8秒给旧worker排空设置上界，夹具hold5秒与proxy_read_timeout7秒也各有独立责任。真实服务若有更长的流式响应、WebSocket或大上传，需要根据协议单独设计，不能照搬这几个实验数字承诺无损切换。"
        },
        {
          "type": "figure",
          "src": "/figures/service-release-rollback/cutover.svg",
          "title": "切入口与旧请求排空是两个时刻",
          "alt": "v1旧请求已经进入后端；reload后新worker把新请求送到v2，旧worker等待v1响应后退出；失败再回到v1。",
          "caption": "明确的held事件证明旧请求已进入v1。文件替换、reload返回、流量命中v2和旧请求完成，是四种不同观察。"
        },
        {
          "type": "reference",
          "title": "Nginx proxy模块官方文档",
          "url": "https://nginx.org/en/docs/http/ngx_http_proxy_module.html",
          "note": "read timeout按相邻读取间隔定义，不等同整个响应总时限。"
        }
      ]
    },
    {
      "id": "prepare",
      "title": "候选先检查，坏配置不要覆盖正在使用的配置",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "控制器先启动v1和私有Nginx，确认入口返回v1，再构造两种候选失败。启动失败进程必须真实退出42；未就绪候选的/health200但/ready503，入口仍应返回v1。随后写一个含非法指令的候选配置并运行nginx -t，要求非零退出、active.conf摘要不变、旧入口仍可用。验证没有影响旧路径，比单看测试命令失败更完整。"
        },
        {
          "type": "code",
          "code": "            first, _ = backend(\"first\", \"v1\")\n            template = (ROOT / \"nginx.conf.in\").read_text()\n            def config(port):\n                return template.replace(\"@ROOT@\", str(work)).replace(\"@FRONT@\", str(front)).replace(\"@BACKEND@\", str(port))\n            previous = config(first)\n            active.write_text(previous)\n            proxy = subprocess.Popen([\"nginx\", \"-p\", str(work), \"-c\", str(active)],\n                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)\n            eventually(lambda: request(front)[1][\"version\"] == \"v1\", \"initial proxy v1\")\n            assert int((work / \"nginx.pid\").read_text()) == proxy.pid\n            old_worker = request(front, with_worker=True)[2]\n            old_identity = process_identity(old_worker)\n            assert old_identity is not None\n            backend(\"startup-failure\", \"v2\", fail=True)\n            bad, _ = backend(\"not-ready\", \"v2\", mode=\"error\")\n            assert request(bad, \"/health\")[0] == 200 and request(bad, \"/ready\")[0] == 503\n            assert request(front)[1][\"version\"] == \"v1\"\n            print(json.dumps({\"case\": \"preflight_reject\", \"startup_exit\": 42, \"alive\": 200, \"ready\": 503,\n                              \"active_version\": \"v1\"}), flush=True)\n            invalid = work / \"invalid.conf\"\n            invalid.write_text(previous + \"THIS_IS_NOT_A_DIRECTIVE;\\n\")\n            digest = hashlib.sha256(active.read_bytes()).hexdigest()\n            assert run([\"nginx\", \"-t\", \"-p\", str(work), \"-c\", str(invalid)], check=False).returncode != 0\n            assert hashlib.sha256(active.read_bytes()).hexdigest() == digest\n            assert request(front)[1][\"version\"] == \"v1\"\n            second, state = backend(\"second\", \"v2\")\n            assert request(second, \"/ready\")[0] == 200",
          "filename": "examples/service-release-rollback/verify.py",
          "purpose": "候选启动、就绪拒绝及非法配置的连续真实断言。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "nginx -t主要检查语法并尝试打开配置涉及的文件；它不访问后端完成业务交易，也不能保证随后reload时所有环境条件仍然相同。因此候选检查要包括独立的应用就绪与最小业务验证，切换后还要走入口检查后置条件。这里准备好的v2只处理无状态版本接口，真实数据库迁移和旧新协议兼容必须在另外的发布约定里证明。"
        },
        {
          "type": "paragraph",
          "text": "switch先写prepared.conf，对这个候选运行-t，通过后用同目录replace替换active，再请求reload。文件名替换提供的是本地目录项更新的原子性，不把整个发布包装成数据库事务：reload可能失败，新worker可能尚未接管，流量也可能仍经过旧worker。必须保留旧配置，并明确区分配置落盘与外部观察。"
        }
      ]
    },
    {
      "id": "cutover",
      "title": "把旧请求放在切换点两侧，验证reload真实语义",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "            def switch(text):\n                prepared = work / \"prepared.conf\"\n                prepared.write_text(text)\n                run([\"nginx\", \"-t\", \"-p\", str(work), \"-c\", str(prepared)])\n                prepared.replace(active)\n                run([\"nginx\", \"-s\", \"reload\", \"-p\", str(work), \"-c\", str(active)])\n\n            with ThreadPoolExecutor(1) as executor:\n                held = executor.submit(request, front, \"/hold\")\n                event(children[0], \"held\")\n                switch(config(second))\n                eventually(lambda: request(front)[1][\"version\"] == \"v2\", \"new requests use v2\")\n                assert request(first, \"/release\", post=True)[0] == 200\n                assert held.result(timeout=5)[1][\"version\"] == \"v1\"\n            eventually(lambda: process_identity(old_worker) != old_identity,\n                       \"old nginx worker exited after drain\")\n            new_worker = request(front, with_worker=True)[2]\n            assert new_worker != old_worker\n            print(json.dumps({\"case\": \"reload_drain\", \"held_request\": \"v1\", \"new_request\": \"v2\",\n                              \"invalid_config_left_active_unchanged\": True, \"old_worker\": old_worker,\n                              \"new_worker\": new_worker, \"old_worker_exited\": True}), flush=True)\n            (state / \"mode.txt\").write_text(\"error\")\n            failed = request(front, with_worker=True)\n            print(json.dumps({\"case\": \"postcutover_observation\", \"response\": failed,\n                              \"candidate_health\": request(second, \"/health\")}), flush=True)\n            assert failed == (500, {\"version\": \"v2\", \"ok\": False}, new_worker)\n            assert request(second, \"/health\")[0] == 200\n            switch(previous)\n            eventually(lambda: request(front) == (200, {\"version\": \"v1\", \"ok\": True}), \"rollback v1\")\n            print(json.dumps({\"case\": \"postcutover_rollback\", \"failed_business\": 500, \"recovered\": \"v1\"}), flush=True)",
          "filename": "examples/service-release-rollback/verify.py",
          "purpose": "关键切换、旧请求排空与切换后业务失败回滚的完整路径。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "测试在线程池中发出经过代理的/hold，等v1 stdout出现held后才switch。每个代理响应增加X-Atlas-Worker头，记录实际处理请求的Nginx worker PID；切换前同时保存该PID的/proc启动身份。入口观察到v2后释放v1旧请求，确认旧future仍返回v1，再等待原worker身份真正消失，才进行下一阶段的业务故障检查。这里不会以一次命中v2推断所有旧worker已经结束。"
        },
        {
          "type": "paragraph",
          "text": "Nginx官方说明reload成功后启动新worker，并请求旧worker优雅退出，旧worker关闭监听后继续服务已有客户端。本实验刻意选择无连接复用的短请求来观察这个差别，不将一次hold成功扩大成所有长连接均无损。若旧请求超时，先看held是否出现、后端是否收到release，再查proxy read超时与worker shutdown上界，不能只凭入口已经v2就宣称旧请求已安全结束。"
        },
        {
          "type": "paragraph",
          "text": "等旧worker退出后，测试才把v2的mode改成error，记录带worker PID的实际响应并要求它等于500、version v2、ok false；v2/health仍应200。随后switch(previous)，循环检查同一入口恢复200/v1。回滚由控制器显式执行，Nginx不会因为业务500自动还原配置。首轮CI的失败说明代际切换存在观察窗口，当前断言将新旧请求归属写进证据，而不是增加固定sleep。"
        },
        {
          "type": "reference",
          "title": "Nginx控制信号与reload",
          "url": "https://nginx.org/en/docs/control.html",
          "note": "新worker与旧worker优雅退出语义；实验另外观察worker身份，不依靠固定等待。"
        }
      ]
    },
    {
      "id": "run",
      "title": "失败路径和清理也属于发布验证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端",
          "code": "timeout --signal=TERM --kill-after=25s 120s bash examples/service-release-rollback/verify-linux.sh",
          "purpose": "一次性Linux环境运行；需Python3.12、Nginx与GNU timeout，无Docker、sudo或外网应用服务。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "paragraph",
          "text": "成功输出应有preflight_reject、reload_drain、postcutover_rollback，最后cleanup complete。入口选动态loopback端口，在一次性环境仍有预留关闭到Nginx绑定之间的小窗口；若端口被占用，脚本应该明确失败，不应接管已有监听者。所有后端和代理对象在Popen后立即记入自己的清理集合，避免初始ready失败时遗失进程。"
        },
        {
          "type": "code",
          "code": "        finally:\n            if proxy is not None and proxy.poll() is None:\n                proxy.send_signal(signal.SIGQUIT)\n                try:\n                    proxy.wait(timeout=10)\n                except subprocess.TimeoutExpired:\n                    proxy.kill()\n                    proxy.wait(timeout=2)\n            for process in children:\n                if process.poll() is None:\n                    process.terminate()\n                    try:\n                        process.wait(timeout=3)\n                    except subprocess.TimeoutExpired:\n                        process.kill()\n                        process.wait(timeout=2)\n                for pipe in [process.stdout, process.stderr]:\n                    pipe.close()\n            if proxy is not None:\n                proxy.stdout.close()\n                proxy.stderr.close()\n            assert all(process.poll() is not None for process in children)\n            assert proxy is None or proxy.poll() is not None\n            print(json.dumps({\"cleanup\": \"processes_stopped\", \"only_own_prefix\": work.name}), flush=True)\n    with socket.socket() as probe:\n        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)\n        probe.bind((\"127.0.0.1\", front))  # No private nginx listener remains.\n    assert not work.exists()\n    print(json.dumps({\"cleanup\": \"complete\", \"temporary_directory_removed\": True}), flush=True)\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "examples/service-release-rollback/verify.py",
          "purpose": "完整finally：只停自己创建的Nginx与后端，等待退出并检查端口和临时目录消失。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "代理先收到SIGQUIT，让旧worker优雅退出，10秒不结束才对自己的主进程强制终止；后端先TERM并等待，异常再kill。脚本不使用systemctl stop nginx，不写/etc/nginx，不按进程名批量kill。正常完整路径最后重绑自己的入口端口检查监听已消失，再检查临时目录已删除。外层SIGTERM给finally留出时间，SIGKILL和整机故障仍无法保证用户态清理。"
        },
        {
          "type": "paragraph",
          "text": "这个实验验证的是单入口、无状态后端的配置发布与路由回滚，不包含多机传播一致性、TLS、会话迁移、数据库回滚或真实流量SLA。若新版本已经写入旧版本无法理解的数据，恢复路由也未必恢复业务；需要先设计前后兼容的数据变更。接下来进入Kubernetes时，Deployment和Service会把部分职责交给控制器，但“就绪不等于业务完全正确、失败需要观察后置条件”仍然成立。"
        },
        {
          "type": "paragraph",
          "text": "修后真实CI记录旧worker PID3089已退出、新worker3105接管；故障响应为500、version v2、ok false且X-Atlas-Worker3105，候选health仍200。显式恢复后同一入口v1/200，自己的prefix进程、端口与临时目录均清理完成。PID只对应这一次运行，下一次不应硬编码；测试以每次实际响应和启动身份判断。文章保持review等最终站点与手机验收。"
        }
      ]
    }
  ]
};

export default article;
