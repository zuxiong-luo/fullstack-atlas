# Linux性能：用同一个受控PID区分CPU、驻留内存与逻辑I/O

目标CPython3.12.14、完整Linux /proc。本机mac没有Linux VM，当前只做源码/Bash语法与guard77；Linux3项真实实验待隔离CI，不能当已验证性能数字。文档参考固定内核v6.8 proc，运行内核由CI打印。

```sh
timeout --signal=TERM --kill-after=5s 60s bash examples/linux-performance/verify-linux.sh
```

无需sudo、外网、第三方Python包、sysctl修改、清缓存或压力施加到其他进程。脚本只Popen自己的worker，并用stdin控制单个有限CPU/32MiB驻留分配/4MiB本机临时文件读写；每阶段stdout确认后，子进程仍活着，才能读同一PID/proc快照。正常quit+wait，异常清理只kill自己Popen子进程，临时目录自清理。

3项测试分别检查：CPU累计ticks增加；触页后32MiB对象被持有、RSS增幅超过16MiB；真实逻辑rchar/wchar至少4MiB。释放对象不强制断言RSS回到基线；read_bytes可能0，因为刚写数据仍在page cache。one_core_percent=CPU秒/观测区间秒×100，是单核口径，不是瞬时load average，也不是全机总核归一化值。/proc字段不是一个原子事务；记录start_ticks防PID复用。

诊断前先定义业务延迟/错误，再结合CPU运行、内存驻留/压力、逻辑与物理I/O分支。本实验没有真实存储瓶颈、OOM、swap、perf/eBPF、冷缓存或吞吐基准，不通过drop_caches或对宿主磁盘施压制造故障。
