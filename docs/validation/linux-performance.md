# Linux性能实验验证记录

状态：真实Linux4/4通过，文章review，站点/手机验收仍待根代理。

- 2026-10-24，run https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101256933 ，源6ac22f0。
- Ubuntu24.04.5 LTS / kernel6.17.0-1022-azure / CPython3.12.14。
- `timeout --signal=TERM --kill-after=5s 60s bash examples/linux-performance/verify-linux.sh`，四项全部OK，0.348秒。
- CPU worker wall0.246991935s/cpu0.246983546s；proc区间0.24723443s、累计CPU0.25s→101.1186023%单核口径；ticks量化使短窗口略过100%，不是多核并行结论。
- 内存before13324288、held46882816、released13324288、peak46776320字节。proc采样近似/不同步可使HWM与RSS瞬时关系不精确，不作对象逐字节分析；测试只要求持有增幅>16MiB及HWM非倒退。
- 文件逻辑4194304B；rchar4194324/wchar4194410/read_bytes0/write_bytes4194304，缓存读与逻辑I/O区别成立。
- 子进程quit+wait后/proc读取失败，PID启动身份不一致与零时间间隔均拒绝。
- 无sudo、外网、sysctl/drop_caches、宿主压力或其他进程操作；清理只涉及自己的Popen子进程/临时文件。

mac仅py_compile/bash -n/guard77；Linux证据来自上述隔离CI。参考Linux内核v6.8 proc、man-pages proc_pid_stat/proc_pid_io和Python3.12 time文档。没有真实存储瓶颈、OOM/swap、perf/eBPF、吞吐基准或性能提升主张。

四图统一Quick Look 1100px实际渲染及人工读图；本图观察关系、中文标签、单位、箭头无裁切。预览只在ignored work/expansion，public仅SVG。正文/source映射与内容类型检查见本批最终追加。

## 本批本机最终核对

`python3 examples/linux-performance/verify-article.py`：3块带真实examples路径的正文代码，均为源码连续原文；无伪文件名。四篇单独TypeScript strict/noEmit检查通过。四个bash -n通过，四个非Linux入口均在任何系统/daemon修改前退出77。完整最小服务、输入协议、调用、成功/失败/清理分支均在正文解释。SVG已1100px实际渲染人工检查，public只保留可编辑源文件；此检查不等于站点/手机验收。下载依赖模板nginx.conf.in/workload.yaml.in已通知根加入精确打包白名单，最终ZIP由根验收。

再次复现：aa5bae3，https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40102026052 ，本例整套再次退出0；源码未改松断言。以各自原始CI详细计数为具体观测值，重复成功不假定毫秒/PID完全相同。
