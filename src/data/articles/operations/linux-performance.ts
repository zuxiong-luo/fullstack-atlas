import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "linux-performance",
  "topic": "operations",
  "title": "Linux 性能排查：CPU、内存、磁盘与 I/O",
  "description": "用同一个受控进程解释CPU时间、驻留内存和逻辑/物理I/O，提供四项有限Linux实验与失败观测边界。",
  "minutes": 60,
  "labMinutes": 45,
  "tags": [
    "Linux",
    "性能",
    "proc",
    "内存",
    "I/O"
  ],
  "scope": "只读/proc与受控CPU/32MiB内存/4MiB临时文件；不制造宿主压力，不宣称容量收益。",
  "prerequisites": [
    "会运行终端命令并阅读基础Python",
    "理解上一章Linux进程与服务生命周期，示例可以独立下载运行"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Linux v6.8 proc文档；实测kernel6.17.0-1022-azure",
    "Ubuntu24.04.5 / CPython3.12.14；隔离CI4/4通过"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "完整实验ZIP",
      "path": "linux-performance.zip"
    },
    {
      "label": "依赖、运行与验证记录",
      "path": "linux-performance/README.md"
    }
  ],
  "references": [
    {
      "title": "Linux v6.8：proc字段与进程I/O",
      "url": "https://www.kernel.org/doc/html/v6.8/filesystems/proc.html"
    },
    {
      "title": "Linux man-pages：proc_pid_stat",
      "url": "https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html"
    },
    {
      "title": "Linux man-pages：proc_pid_io",
      "url": "https://man7.org/linux/man-pages/man5/proc_pid_io.5.html"
    },
    {
      "title": "Python3.12：单调时钟与进程CPU时间",
      "url": "https://docs.python.org/3.12/library/time.html"
    },
    {
      "title": "Linux四项真实CI与完整输出",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101256933"
    }
  ],
  "sections": [
    {
      "id": "meaning",
      "title": "性能排查先回答：谁在等什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "性能是程序在指定输入和资源条件下完成工作的表现。响应时间描述一次工作从提交到结束用了多久，吞吐量描述单位时间完成多少工作，错误率描述其中有多少没有达到约定。CPU、内存、磁盘指标是解释这些结果的证据，不能拿一个百分比代替业务结果。比如接口从200毫秒变成2秒，先固定路径、输入规模、并发和观察窗口，再问时间花在计算、排队、等锁、远端请求还是存储。"
        },
        {
          "type": "paragraph",
          "text": "操作系统把这些原因拆成不同层次：调度器决定线程何时得到CPU；内存管理决定虚拟地址如何映射到驻留页；文件系统和块设备共同完成持久化。一个进程可能在这些阶段之间反复切换。“CPU不高”只能说明选定窗口内没有持续消耗很多CPU，不能推出服务没有问题；线程等待连接池时，机器甚至可能很空闲。"
        },
        {
          "type": "paragraph",
          "text": "本篇先用同一个受控Python子进程建立三组可解释的观察：有限整数计算、持有并触碰32MiB内存、向自己的临时文件写入并读回4MiB。控制器收到阶段完成记录后，子进程继续存活，因而可以读取同一PID的前后快照。我们验证计数器含义和失败边界，不把这个小实验包装成生产容量测试，也不修改内核参数或清空宿主页缓存。"
        },
        {
          "type": "paragraph",
          "text": "文档口径固定Linux v6.8的proc说明与CPython3.12，解释器锁3.12.14；运行文档与实际内核分开。2026-10-24隔离Ubuntu CI已经通过四项真实集成断言，实际为Ubuntu24.04.5、kernel6.17.0-1022-azure、CPython3.12.14，unittest总耗时0.348秒。本机mac只有编译、Bash语法与guard77证据，不能替代这次Linux执行。"
        }
      ]
    },
    {
      "id": "counters",
      "title": "先区分累计量、瞬时量和观察窗口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "进程CPU时间是该进程执行用户态与内核态代码累计消耗的时间，不是进程出生后经过的墙钟时间。读取两次累计计数，相减得到窗口内的CPU秒；再除以同一窗口的单调时钟秒，得到相对一个CPU核的占用比例。单线程受控计算通常不会持续超过一个核；多线程本机代码可能并行，这个口径就可能超过100%。若监控平台另按全机逻辑CPU数量归一化，两者不能直接比较。"
        },
        {
          "type": "paragraph",
          "text": "load average统计可运行以及某些不可中断等待任务的平均数量，既不是CPU百分比，也不是某个HTTP接口的排队长度。看到load升高，要继续区分CPU争用与不可中断等待；看到进程CPU秒增加，要结合墙钟和业务完成数判断这些计算有没有产生有效工作。这里不根据一条load数值自动归因“磁盘坏了”。"
        },
        {
          "type": "paragraph",
          "text": "内存也要先统一单位。虚拟地址空间包含预留映射，RSS表示当前驻留在物理内存的页面规模，峰值RSS记录生命周期内曾到达的高点。它们都不是“业务对象净大小”。共享页、分配器保留、解释器对象开销会使这些数值不同。proc的VmRSS/VmHWM以KiB报告，本例明确乘1024转字节；这些采样本身存在近似与不同步，不能据此做逐字节的对象归属分析。"
        },
        {
          "type": "figure",
          "src": "/figures/linux-performance/observations.svg",
          "title": "同一进程的三种观察",
          "alt": "受控worker在前后快照之间完成CPU、内存或I/O阶段；控制管道确认后继续存活。",
          "caption": "图中是观察关系示意，没有伪造性能曲线。所有差值都绑定PID与start_ticks，阶段确认比固定sleep更可靠。"
        }
      ]
    },
    {
      "id": "sampler",
      "title": "把身份、时间与单位写进采样器",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面是完整只读采样器。stat的第二个字段comm有括号并可能含空格，所以不能直接对整行split后按固定下标读取。代码先越过最后的右括号，再读取utime、stime与starttime；将ticks除以系统SC_CLK_TCK，而不是假设每秒固定100次。start_ticks与PID共同检查观察身份，防止把旧进程退出后复用的数字当成同一个对象。"
        },
        {
          "type": "code",
          "code": "\"\"\"Read only this caller-selected PID; do not tune the host or send signals.\"\"\"\nimport json\nimport os\nfrom pathlib import Path\nimport sys\nimport time\n\n\ndef snapshot(pid: int) -> dict[str, object]:\n    if sys.platform != \"linux\":\n        raise RuntimeError(\"Linux /proc required\")\n    root = Path(\"/proc\") / str(pid)\n    stat = (root / \"stat\").read_text()\n    fields = stat[stat.rfind(\")\") + 2:].split()  # comm may contain spaces/parentheses.\n    status = {}\n    for line in (root / \"status\").read_text().splitlines():\n        key, _, value = line.partition(\":\")\n        if key in {\"VmRSS\", \"VmHWM\", \"Threads\"}:\n            status[key] = int(value.split()[0])\n    counters = {key: int(value) for line in (root / \"io\").read_text().splitlines()\n                for key, value in [line.split(\":\", 1)]}\n    ticks = os.sysconf(\"SC_CLK_TCK\")\n    return {\"pid\": pid, \"start_ticks\": int(fields[19]), \"sample_monotonic_s\": time.monotonic(),\n            \"cpu_seconds\": (int(fields[11]) + int(fields[12])) / ticks,\n            \"clock_ticks_per_s\": ticks, \"rss_bytes\": status[\"VmRSS\"] * 1024,\n            \"peak_rss_bytes\": status[\"VmHWM\"] * 1024, \"threads\": status[\"Threads\"], \"io\": counters}\n\n\ndef delta(before: dict, after: dict) -> dict[str, object]:\n    if before[\"pid\"] != after[\"pid\"] or before[\"start_ticks\"] != after[\"start_ticks\"]:\n        raise ValueError(\"different process identity or reused PID\")\n    elapsed = after[\"sample_monotonic_s\"] - before[\"sample_monotonic_s\"]\n    if elapsed <= 0:\n        raise ValueError(\"non-positive observation interval\")\n    cpu = after[\"cpu_seconds\"] - before[\"cpu_seconds\"]\n    return {\"interval_s\": elapsed, \"cpu_seconds\": cpu, \"one_core_percent\": cpu / elapsed * 100,\n            \"rss_change_bytes\": after[\"rss_bytes\"] - before[\"rss_bytes\"],\n            \"io_delta\": {key: after[\"io\"][key] - value for key, value in before[\"io\"].items()}}\n\n\nif __name__ == \"__main__\":\n    print(json.dumps(snapshot(int(sys.argv[1]))))",
          "filename": "examples/linux-performance/observe.py",
          "purpose": "完整采样器与差值计算：只读调用者指定的PID，输出单位明确的累计量与区间量。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "sample_monotonic_s防墙钟校时，但读取stat、status、io并不是一次原子事务：进程在两次文件读取之间仍可能运行或退出。采样间隔很短时，调度时机与计数器精度会放大比例误差。因此本例只断言有方向的变化，不要求CPU比例恰好100，也不把某一次read_bytes差值当作整机存储吞吐。跨次PID或启动时间不同、时间差不正，delta直接拒绝给出看似精确的数字。"
        },
        {
          "type": "paragraph",
          "text": "实际排查常先用ps、top或pidstat观察目标，再按明确假设深入。本采样器保留了其中最关键的推导路径，便于核对工具显示的口径。如果读/proc时报FileNotFoundError，先确认目标是否已退出；PermissionError要检查用户身份和proc挂载策略。不要为了让一段教学脚本读到数据而放宽整机权限，也不要遇到失败就替换成另一个同号PID继续累计。"
        },
        {
          "type": "reference",
          "title": "Linux v6.8：proc字段定义",
          "url": "https://www.kernel.org/doc/html/v6.8/filesystems/proc.html",
          "note": "核对stat/status/io的单位与采样边界；文档内核与实际运行内核分开。"
        },
        {
          "type": "reference",
          "title": "man-pages：进程I/O计数",
          "url": "https://man7.org/linux/man-pages/man5/proc_pid_io.5.html",
          "note": "rchar/wchar与read_bytes/write_bytes的含义不同。"
        }
      ]
    },
    {
      "id": "controlled",
      "title": "让工作负载自己确认阶段完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "worker只接受控制器通过自己的stdin发送的JSON行，每次执行一种有限工作，并在stdout输出JSON确认。CPU阶段固定五百万次整数循环；内存阶段分配32MiB并每4096字节写一次，让页面实际被触碰；I/O阶段写四个1MiB块，flush后fsync，再分块读回并删除自己的文件。所有阶段串行，不用睡眠时间冒充完成条件。"
        },
        {
          "type": "code",
          "code": "\"\"\"A controlled child: each acknowledged stage stays alive for /proc sampling.\"\"\"\nimport gc\nimport json\nimport os\nfrom pathlib import Path\nimport sys\nimport tempfile\nimport time\n\n\ndef reply(**fields):\n    print(json.dumps(fields), flush=True)\n\n\ndef main():\n    held = None\n    with tempfile.TemporaryDirectory(prefix=\"atlas-lab-perf-worker-\") as folder:\n        reply(event=\"ready\", pid=os.getpid())\n        for line in sys.stdin:\n            if len(line) > 128:\n                raise ValueError(\"control record too long\")\n            operation = json.loads(line)[\"operation\"]\n            started, cpu = time.perf_counter(), time.process_time()\n            if operation == \"cpu\":\n                checksum = 0\n                for value in range(5_000_000):\n                    checksum = (checksum + value * value) & 0xFFFFFFFF\n                extra = {\"checksum\": checksum}\n            elif operation == \"allocate\":\n                held = bytearray(32 * 1024 * 1024)\n                for offset in range(0, len(held), 4096):\n                    held[offset] = 1\n                extra = {\"held_bytes\": len(held)}\n            elif operation == \"release\":\n                held = None\n                gc.collect()\n                extra = {\"held_bytes\": 0}\n            elif operation == \"io\":\n                path = Path(folder) / \"payload.bin\"\n                data = b\"x\" * (1024 * 1024)\n                with path.open(\"wb\") as output:\n                    for _ in range(4):\n                        output.write(data)\n                    output.flush()\n                    os.fsync(output.fileno())\n                with path.open(\"rb\") as source:\n                    count = sum(len(chunk) for chunk in iter(lambda: source.read(65536), b\"\"))\n                path.unlink()\n                extra = {\"logical_bytes\": count}\n            elif operation == \"quit\":\n                reply(event=\"stopped\", pid=os.getpid())\n                return\n            else:\n                raise ValueError(\"unknown operation\")\n            reply(event=operation, wall_s=time.perf_counter() - started,\n                  cpu_s=time.process_time() - cpu, **extra)\n\n\nif __name__ == \"__main__\":\n    main()",
          "filename": "examples/linux-performance/worker.py",
          "purpose": "完整受控worker；只在自己的临时目录操作文件，quit后正常释放资源。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "控制记录的128字符检查发生在for line已经读入完整行之后，它只是协议校验，不是输入峰值内存硬上限。这里的管道由同一个测试控制，不是暴露给任意网络客户端。fsync表达把文件数据提交到文件系统/存储栈的要求，不足以证明某个虚拟磁盘或硬件在断电后一定保留了数据；共享CI存储也不能当成你的生产磁盘。"
        },
        {
          "type": "paragraph",
          "text": "我们特意在allocate之后保留held引用。若创建完对象立刻丢弃，控制器采到的可能只有释放后的状态，无法解释“究竟有没有分配”。release把引用置空并执行垃圾回收，只保证示例不再持有这块对象；操作系统RSS是否立刻回到原点仍取决于分配器与映射行为。峰值RSS更不会随着释放下降。"
        }
      ]
    },
    {
      "id": "integration",
      "title": "从输入、确认到断言形成可复现闭环",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "测试为每个案例创建独立子进程，先读ready记录，再取before快照，写入operation，等确认后取after。selector只负责有界等待管道可读；10秒没有确认会失败，而不是把“等够时间”当作成功。addCleanup在首次读取之前登记，所以启动成功但初始记录异常也会回收自己的子进程。"
        },
        {
          "type": "code",
          "code": "import json\nfrom pathlib import Path\nimport selectors\nimport subprocess\nimport sys\nimport unittest\nfrom observe import delta, snapshot\n\n\n@unittest.skipUnless(sys.platform == \"linux\", \"Linux /proc integration required\")\nclass ObservedWorkloads(unittest.TestCase):\n    def setUp(self):\n        self.child = subprocess.Popen([sys.executable, \"-u\", str(Path(__file__).with_name(\"worker.py\"))],\n                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,\n                                      text=True, bufsize=1)\n        self.selector = selectors.DefaultSelector()\n        self.addCleanup(self.cleanup_child)\n        self.selector.register(self.child.stdout, selectors.EVENT_READ)\n        self.assertEqual(self.read()[\"pid\"], self.child.pid)\n\n    def read(self):\n        if not self.selector.select(10):\n            self.fail(\"child stage acknowledgement not observed within 10s\")\n        line = self.child.stdout.readline()\n        if not line:\n            self.fail(\"child exited: \" + self.child.stderr.read())\n        return json.loads(line)\n\n    def command(self, operation):\n        self.child.stdin.write(json.dumps({\"operation\": operation}) + \"\\n\")\n        self.child.stdin.flush()\n        return self.read()\n\n    def cleanup_child(self):\n        try:\n            if self.child.poll() is None:\n                self.command(\"quit\")\n                self.child.wait(timeout=3)\n            self.assertEqual(self.child.returncode, 0)\n        finally:\n            if self.child.poll() is None:\n                self.child.kill()\n                self.child.wait(timeout=2)\n            self.selector.close()\n            for pipe in [self.child.stdin, self.child.stdout, self.child.stderr]:\n                pipe.close()\n\n    def test_gone_process_and_reused_pid_are_failed_observations(self):\n        before = snapshot(self.child.pid)\n        self.command(\"quit\")\n        self.child.wait(timeout=3)\n        with self.assertRaises((FileNotFoundError, ProcessLookupError)):\n            snapshot(self.child.pid)\n        with self.assertRaisesRegex(ValueError, \"identity\"):\n            delta(before, before | {\"start_ticks\": before[\"start_ticks\"] + 1})\n        with self.assertRaisesRegex(ValueError, \"interval\"):\n            delta(before, before)\n        print(json.dumps({\"case\": \"failed_observation\", \"gone_pid_rejected\": True,\n                          \"reused_pid_rejected\": True, \"zero_interval_rejected\": True}), flush=True)\n\n    def test_cpu_ticks_are_interval_work_not_instantaneous_load(self):\n        before = snapshot(self.child.pid)\n        result = self.command(\"cpu\")\n        change = delta(before, snapshot(self.child.pid))\n        self.assertGreater(result[\"cpu_s\"], .01)\n        self.assertGreater(change[\"cpu_seconds\"], 0)\n        self.assertGreater(change[\"one_core_percent\"], 0)\n        print(json.dumps({\"case\": \"cpu\", \"worker\": result, \"observed\": change}), flush=True)\n\n    def test_resident_allocation_is_held_then_released_without_claiming_rss_reset(self):\n        before = snapshot(self.child.pid)\n        result = self.command(\"allocate\")\n        held = snapshot(self.child.pid)\n        self.assertEqual(result[\"held_bytes\"], 32 * 1024 * 1024)\n        self.assertGreater(held[\"rss_bytes\"] - before[\"rss_bytes\"], 16 * 1024 * 1024)\n        self.assertEqual(self.command(\"release\")[\"held_bytes\"], 0)\n        after = snapshot(self.child.pid)\n        self.assertGreaterEqual(after[\"peak_rss_bytes\"], before[\"peak_rss_bytes\"])\n        print(json.dumps({\"case\": \"memory\", \"before\": before[\"rss_bytes\"], \"held\": held[\"rss_bytes\"],\n                          \"released\": after[\"rss_bytes\"], \"peak\": after[\"peak_rss_bytes\"]}), flush=True)\n\n    def test_logical_io_does_not_imply_the_same_physical_disk_reads(self):\n        before = snapshot(self.child.pid)\n        result = self.command(\"io\")\n        change = delta(before, snapshot(self.child.pid))\n        self.assertEqual(result[\"logical_bytes\"], 4 * 1024 * 1024)\n        self.assertGreaterEqual(change[\"io_delta\"][\"rchar\"], result[\"logical_bytes\"])\n        self.assertGreaterEqual(change[\"io_delta\"][\"wchar\"], result[\"logical_bytes\"])\n        # read_bytes may stay zero because the same data is still in page cache.\n        self.assertGreaterEqual(change[\"io_delta\"][\"read_bytes\"], 0)\n        print(json.dumps({\"case\": \"cached_io\", \"worker\": result, \"observed\": change}), flush=True)\n\n\nif __name__ == \"__main__\":\n    unittest.main(verbosity=2)",
          "filename": "examples/linux-performance/test_linux.py",
          "purpose": "完整四项Linux集成测试，包含成功负载、失效观察和子进程清理。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "code",
          "filename": "终端",
          "code": "timeout --signal=TERM --kill-after=5s 60s bash examples/linux-performance/verify-linux.sh",
          "purpose": "在Linux一次性环境运行；需要Python3.12与GNU timeout，无第三方包、sudo或外网。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "paragraph",
          "text": "成功输出应包含cpu、memory、cached_io、failed_observation四种case及unittest的OK。cpu记录有正的累计CPU秒；memory的held减before超过16MiB，虽然实际对象为32MiB，阈值给采样差异留出余量；cached_io的rchar/wchar至少覆盖4MiB，read_bytes允许为0。失败观测案例在子进程真正退出并wait后读取/proc，确认它不能再被当作活进程；另外用变更的start_ticks与零间隔检查身份和数学边界。"
        },
        {
          "type": "paragraph",
          "text": "如果CPU断言失败，先查看worker是否收到命令、是否提前退出、采样窗口是否包住计算；如果内存断言失败，先看held_bytes是否确认以及该环境proc是否完整，不能直接把阈值删掉让CI变绿。如果I/O逻辑计数增加而read_bytes为0，恰好说明刚写的数据可从缓存读回，而不是“没有执行read”。清理先发送quit并wait，只有自己创建的进程拒绝退出时才kill并wait；脚本不会扫描或杀死其他Python进程。"
        },
        {
          "type": "paragraph",
          "text": "本次CI中CPU工作墙钟0.246992秒、工作CPU0.246984秒，proc区间0.247234秒、累计CPU差0.25秒，得到101.1186%单核口径。短区间计数ticks量化使比例略过100%，不能据此推断Python循环用了多个核。内存before13324288、held46882816、released13324288字节；4MiB逻辑读回对应rchar4194324、read_bytes0、write_bytes4194304。它们是一次共享CI环境的观测，非冷缓存磁盘基准或通用阈值。"
        }
      ]
    },
    {
      "id": "diagnosis",
      "title": "把指标组合成判断分支，避免凭单点调参",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "带着业务慢请求回到真实服务时，先固定同一时间窗口。墙钟延迟高且CPU秒同步增加，可以继续找热函数、重复序列化或算法复杂度；CPU低而请求在等连接池，需要看池的等待与占用，而不是先加核。CPU饱和也不一定是当前进程导致，容器配额节流和同机竞争都可能让服务等不到执行机会。必须把进程指标与宿主或容器资源范围对齐。"
        },
        {
          "type": "paragraph",
          "text": "RSS持续增长时，比较相同负载下每轮结束后的基线与峰值，再检查对象保留、缓存上限和映射。一次大对象分配后的RSS不立即下降不能单独证明泄漏；相反，业务对象计数看似稳定也不能排除原生库内存。内存压力要再结合回收、交换或压力停顿指标观察，本例没有制造这些系统级条件，不根据32MiB实验推算机器能承受多少并发。"
        },
        {
          "type": "paragraph",
          "text": "存储分支先区分应用逻辑读写、实际块设备字节、操作完成延迟。缓存命中能使逻辑读很大而设备读很小；fsync频繁可能让少量写入也具有较大尾延迟；容器、虚拟机与宿主的设备口径又可能不同。后续可在独占测试环境引入明确文件系统和设备、固定数据集与冷热条件，再记录iostat等工具的区间结果。不能在共享机器上随意drop_caches制造“冷读”基准。"
        },
        {
          "type": "paragraph",
          "text": "这套实验提供了一条证据链：有限输入触发明确工作，阶段确认包住采样区间，计数器在正确单位与身份下形成差值，失败时停止推导。隔离CI已通过四项：CPU、驻留内存、逻辑I/O与失效采样；仍未验证真实存储瓶颈、OOM、swap、perf/eBPF或生产吞吐。文章保持review，等待最终站点与图形验收，不能根据一次小实验补写性能提升。"
        }
      ]
    }
  ]
};

export default article;
