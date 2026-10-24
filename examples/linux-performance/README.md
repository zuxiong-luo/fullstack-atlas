# Linux性能：用同一个受控PID区分CPU、驻留内存与逻辑I/O

目标CPython3.12.14、完整Linux /proc。本机mac没有Linux VM，仅有源码/Bash语法与guard77；隔离Ubuntu CI四项已真实通过。文档参考固定内核v6.8 proc，实测Ubuntu24.04.5、kernel6.17.0-1022-azure、CPython3.12.14。

```sh
timeout --signal=TERM --kill-after=5s 60s bash examples/linux-performance/verify-linux.sh
```

无需sudo、外网、第三方Python包、sysctl修改、清缓存或压力施加到其他进程。脚本只Popen自己的worker，并用stdin控制单个有限CPU/32MiB驻留分配/4MiB本机临时文件读写；每阶段stdout确认后，子进程仍活着，才能读同一PID/proc快照。正常quit+wait，异常清理只kill自己Popen子进程，临时目录自清理。

4项测试分别检查：CPU累计ticks增加；触页后32MiB对象被持有、RSS增幅超过16MiB；真实逻辑rchar/wchar至少4MiB；已退出PID、复用身份与零时间间隔拒绝作为有效观测。释放对象不强制断言RSS回到基线；read_bytes可能0，因为刚写数据仍在page cache。one_core_percent=CPU秒/观测区间秒×100，是单核口径，不是瞬时load average，也不是全机总核归一化值。/proc字段不是一个原子事务；记录start_ticks防PID复用。

诊断前先定义业务延迟/错误，再结合CPU运行、内存驻留/压力、逻辑与物理I/O分支。本实验没有真实存储瓶颈、OOM、swap、perf/eBPF、冷缓存或吞吐基准，不通过drop_caches或对宿主磁盘施压制造故障。

## 文件与源码映射

`.python-version`, `README.md`, `observe.py`, `test_linux.py`, `verify-article.py`, `verify-linux.sh`, `worker.py`。无第三方Python依赖；`.python-version`固定作者解释器版本。

仓库中运行 `python3 examples/linux-performance/verify-article.py` 核对正文代码连续原文；下载独立包不含文章TS，脚本明确提示跳过映射，不假装已验证正文。

真实运行： https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101256933 ，快照6ac22f0，4/4通过（0.348秒）。CPU区间0.247234秒/累计0.25秒→101.1186%（短窗口ticks量化）；RSS before13324288/held46882816/released13324288字节；逻辑4MiB读的rchar4194324/read_bytes0，write_bytes4194304。一次CI观测不构成生产吞吐或冷缓存磁盘基准。
