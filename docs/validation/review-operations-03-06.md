# 运维第3～6篇独立交叉审校

2026-10-25；非作者，只读审全文/运行实现/模板/断言/README/失败历史/记录。linux-performance、docker-engineering、service-release-rollback、kubernetes-foundations。未在用户Mac安装Docker/K8或操作系统服务，不以本机静态检查冒充Linux执行。

## 固定提交与真实CI证据

核对aa5bae3的19个实际运行文件（四例Python/入口/Dockerfile/模板/kind配置），均与工作区逐字相同；verify-article属于仓库正文核验不计CI运行闭包。来源run40102026052：
https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40102026052

本地保留的work/expansion/run-40102026052.txt并不只有Actions摘要：逐段读取其所有4个job的Success状态与实际JSON/unittest输出，且对应sha aa5bae3。Ubuntu24.04.5/kernel6.17.0-1022-azure/CPython3.12.14；Docker28.0.4、Nginx1.24.0、kind0.33.0、kubectl/server1.35.8与节点摘要确认。

- Linux真实4项：CPU区间约0.4735s/CPU0.47s，单核99.25%（非要求固定数）；RSS before13287424→held46845952，release13287424，32MiB实际触页；逻辑读4194304/rchar4194324且read_bytes0；gone PID/重用身份/零间隔拒绝。读取多proc文件非原子、CPU ticks量化/RSS近似/缓存读不是设备吞吐均在正文明确。
- Docker：固定官方digest真实build；cpu.max50000/100000、memory.max134217728、pids.max32，UID10001/PID1/namespace不同；v1卷值1，TERM退出0，v2同卷读1及SIGTERM记录。独立64MiB OOM：allocator -9、memory.events oom_kill_delta1、swap.max0、peak67108864、Docker OOMKilledtrue、State/夹具exit137。观察器主动映射137与内核杀PID1区别说明清楚；不以任意退出码替代OOM。finally inspect确保自有容器/卷/tag不存在。
- Nginx：启动42/存活200但就绪503不切，错误候选-t不改active；真实held屏障后reload，新请求v2、旧请求v1，旧worker2499退出/新2515（动态值非断言常数）；同新worker响应v2/500/okfalse而health200，显式回滚v1，最后自有进程、端口可重绑、目录删除。reload返回/命中v2/旧worker结束三个阶段未混淆。
- K8：2ready与Pod内实际DNS→Service IP/HTTPv1；删除Pod新UID补足、IP不变；同PodUID liveness restartCount1/containerID变、lastState exit0 Completed（正常TERM，绝不写成必定137）；坏ready更新ProgressDeadlineExceeded/2ready端点继续v1/未自动回滚；显式undo再好v2/2ready；专有cluster、tag、私有kubeconfig已清理。

读取run40101256933旧失败：Docker原OOMKilled断言失败，Nginx即时500观察失败，K8工具安装阶段失败；对照修正源码与23a4808/aa5bae3成功，记录未隐去失败、不靠放松断言变绿。没有重新本机执行这些Linux集成；这是对真实隔离CI证据与同字节代码的独立审校。

## 本机独立检查

四套verify-article.py实际执行：3/7/5/7共22块连续原文匹配。四入口bash -n通过；四套在Mac实际运行均在系统/daemon修改前退出77。完整Python核心/测试/模板/故障收尾读审通过。独立查阅Linuxv6.8 proc、Nginx官方reload/proxy、Kubernetesv1.35探针/Deployment文档，与版本边界吻合。

4张SVG有效XML，实际QuickLook逐张渲染人工查看：PID+start_ticks阶段采样、容器/卷/信号、Nginx新旧请求与手动回滚、控制器/EndpointSlice与数据平面区分，箭头/标签无明显溢出。手机/站点图阅读由主代理另验，不拿QuickLook替代。

发现并由作者修正文案：Docker第二节原称COPY只送app.py，实际另含oom_fixture.py；已改为两个有限夹具文件，purpose同步，运行源码保持CI一致。没有剩余阻塞项。

## 仍不扩大验收范围

Linux没有独占设备冷缓存、swap压力、eBPF/perf或生产吞吐结论；Docker没有跨OS/漏洞扫描/备份/不可信代码沙箱保证；Nginx是单入口无状态路由回滚，不包含数据迁移、长连接SLA；K8是单节点kind，不包括真实多节点故障、Ingress/TLS/PV/云负载均衡。专用本次前缀清理不等于清除基础镜像/共享网络/构建缓存，强杀不能保证finally。ZIP里nginx.conf.in/workload.yaml.in必须保留，最终打包/离线/发布由根验收。
