# Linux服务：进程、线程、信号与systemd隔离实验

**验证状态：proc/信号3项已在隔离Ubuntu CI通过；systemd编排在useradd超时处失败，修复后待重验。** 作者macOS没有Linux VM；本机语法/guard77和3项模拟清理测试不能替代Linux/systemd验收。

文档基线：systemd255固定版本文档、Linux内核v6.8的proc文档、Linux man-pages6.19的signal/pthreads页面。实际CI为Ubuntu24.04.5 LTS、systemd255（255.4-1ubuntu8.17）、kernel6.17.0-1022-azure、CPython3.12.14。内核v6.8只是所引用文档版本。

## CI依赖与运行

需要一次性Ubuntu24.04完整VM、PID1为systemd、Python3.12、sudo免密。不能在macOS执行系统操作；脚本先检测`uname -s`，非Linux退出77。不要在Docker代替真实systemd宿主，也不要以root执行整个编排器。

建议CI由主代理配置，不包含在本示例里：

```sh
sudo apt-get update
sudo apt-get install -y systemd dbus-user-session util-linux passwd coreutils openssl
# 使用actions/setup-python固定3.12.14后，以普通runner用户运行：
timeout --signal=TERM --kill-after=30s 240s bash examples/linux-services/verify-linux.sh
```

不访问公司服务、不改现有账户与服务配置。脚本随机创建`atlas-lab-<随机串>`临时用户、同前缀system/user服务及`/var/tmp/atlas-lab-*`目录；只启停自己创建的unit和该临时UID的user manager。system unit放`/run/systemd/system`，不enable开机启动；user unit放临时用户的`~/.config/systemd/user`。UID显式选20000..59999之间未占用值，home放本次/var/tmp目录下；--no-log-init跳过lastlog/faillog初始化，useradd期限30秒。结束移除unit、重读管理器、停止自己的user manager、重新查询并核对临时账户UID/home、删除账户/私有组与目录；即使useradd超时也清理部分创建结果。最终核验账户、组、unit、该UID进程及目录无残留后才报cleanup=complete，失败报cleanup incomplete。命令与轮询均有期限，SIGTERM触发Python的finally；强制SIGKILL/断电不保证用户态清理。

## 文件

- `service.py`：完整loopback HTTP服务，动态空闲端口，一个主线程与一个等待Event的工作线程；SIGTERM/SIGINT只请求退出，finally join线程、关闭socket、删除ready并记录停止。
- `inspect.py`：只读`/proc/PID/status`、task、fd与cgroup，PID来自本实验ready文件，不发送信号。
- `tests/test_cleanup.py`：3项模拟系统命令测试，不更改宿主账户/服务；覆盖useradd超时后的部分创建清理、删除失败不误报成功、身份不匹配拒绝删除。可在mac运行，不等于Linux实测。
- `test_process.py`：Linux专用3项真实子进程测试，覆盖proc/线程/描述符、优雅TERM、KILL绕过清理及恢复、退出42。
- `atlas-lab-system.service.in`、`atlas-lab-user.service.in`：可编辑unit模板；编排器替换绝对路径与临时用户名，不是直接可安装的成品unit。
- `verify_systemd.py`：真实user/system两种服务，各执行启动/HTTP健康、TERM停止、启动失败42/有限重启耗尽、恢复与日志读取；finally只清理本次命名资源。
- `verify-linux.sh`：Linux保护、依赖/版本输出、限定时间的proc测试与systemd编排入口。
- `verify-article.py`：仓库内核对正文代码为真实连续原文；独立ZIP缺正文则明确跳过映射，不伪称核验。

## 非特权手动实验

以下命令只用于Linux，在示例目录运行。state必须是新建临时目录：

```sh
lab_state=$(mktemp -d /tmp/atlas-lab-manual.XXXXXX)
python3 service.py --state "$lab_state" &
lab_pid=$!
# 看见service.py打印event=ready后，读取真正快照：
python3 inspect.py "$lab_state"
kill -TERM "$lab_pid"
wait "$lab_pid"
cat "$lab_state/stopped.json"
rm -rf -- "$lab_state"
```

正常应观察：task_ids包含主PID和worker_tid；每个线程的Tgid相同；HTTP健康PID等于进程PID；TERM后退出0、ready消失、stopped.signals为`["SIGTERM"]`。这些断言已在隔离Ubuntu CI的3项proc/信号测试通过；两个systemd范围仍待重验。自动测试不靠“等两秒”认定就绪，而是读ready中的本次PID和真实HTTP响应。

KILL测试只杀自己Popen得到的子进程：退出状态为负SIGKILL，stopped不存在，ready可能残留；重新启动清理旧标记并恢复健康。因此ready文件存在不等于进程仍活着，也不能替代健康检查。

## systemd故障与恢复

每种scope预期输出三类JSON：`graceful_stop`、`fault`、`recovery`，最后`cleanup=complete`。fault应是服务`failed`、ExecMainStatus42、NRestarts至少1。脚本只把自己的EnvironmentFile切为`ATLAS_LAB_START_FAIL=1`，观察真实失败，再改0、reset-failed并重新启动；不靠伪造systemctl输出证明重启。

Type=exec只表示程序成功exec，不承诺HTTP业务就绪；Restart=on-failure与StartLimit约束重启；TimeoutStopSec4s与KillMode=control-group约束停止范围。系统服务和用户服务由不同管理器管理，`User=`只在system模板出现。没有交付容器隔离、权限加固或生产高可用配置。

## 待回填

[run40094537231](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40094537231)实际trace由根代理取得：上述Ubuntu环境，proc3项通过；旧useradd15秒超时，原cleanup标志不足以证明账户不存在。当前修复和模拟回归已完成，仍需重跑两scope实际JSON/日志、账户创建与清理确认。当前不把文章加入聚合发布，不把mac退出77写作“通过Linux测试”。

模拟回归可单独运行：`python3 examples/linux-services/tests/test_cleanup.py`。这些测试拦截所有系统命令，不启动或删除宿主用户/服务。

第三轮隔离[run40095286144](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40095286144)：模拟部分清理3/3与Linux proc/信号3/3均通过；修复后的useradd成功，实际账户清理complete。下一失败是普通runner直接Path.exists读取0700的/run/user/20000被PermissionError拒绝，尚未证明unit生命周期。已改为既有sudo -n test -S /run/user/UID/bus，以退出码轮询真正socket；不chmod或削弱runtime目录权限。完整两scope仍待下一轮CI。

后续useradd仍30秒超时，不能将--no-log-init当已证根因。根代理18c1c46隔离strace annotation实际看到openat循环读取Rust工具链rlib/rmeta并创建输出（例如librustc_literal_escaper）；这证明账户创建在复制工具文件。现明确在本次work下创建空skel目录，传useradd --skel，以免教学用户复制镜像默认dotfiles/工具链；保留--no-log-init、有限UID/home/超时与严格清理。默认skeleton是慢点的解释仍待无strace新实验确认，两scope仍保持受阻。
