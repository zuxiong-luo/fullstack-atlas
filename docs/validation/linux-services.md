# Linux服务基础：验证记录

2026-10-24。文章`linux-services`状态review，**Linux/systemd隔离CI已完整通过；文章仍review等图形/站点最终验收**。作者macOS14.5 x86_64没有Linux VM；根代理负责Ubuntu24.04隔离CI。

## 已完成与素材

新增`examples/linux-services/`最小服务、只读inspect、3项Linux专用子进程测试、两套systemd unit模板、Linux入口与真实user/system服务编排。随机临时用户/服务/目录前缀均为atlas-lab；只监听loopback动态端口，不修改宿主现有服务。普通runner用户通过sudo操作自己创建资源，编排器拒绝以root直接运行。

正文约3740字符叙述（不含代码），展示完整service.py、inspect.py、两套unit模板、verify-linux.sh和verify_systemd.py。6个filename代码块已逐字验证为对应完整文件原文；映射脚本在仓库内实际执行通过。operationsExpansionArticles仅在独立index导出，未改共享聚合/catalog/types/workflow。

固定官方资料实际浏览：systemd255的service/exec/kill/systemctl；Linux内核v6.8 proc文档；man7页面页尾明确Linux man-pages6.19（signal/pthreads）；Python3.12 signal说明。文稿区分文档基线与实际CI版本，不冒称Ubuntu内核就是6.8。

## 本机实际检查

- CPython3.12.14：Python源码语法编译检查；Bash `bash -n`通过。
- `bash examples/linux-services/verify-linux.sh`在mac返回**77**，输出`SKIP: Linux/systemd required; no host service operation performed.`。这是保护分支按预期工作，**不是Linux/proc/systemd测试通过**。
- `python3.12 examples/linux-services/verify-article.py`报告**6块连续真实源码匹配**。
- 定向`tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --skipLibCheck src/data/articles/operations/index.ts`无诊断。
- SVG XML可解析，Quick Look生成1100px预览并人工查看，无文字裁切；图为生命周期示意，无虚构耗时。预览PNG仅位于ignored work/expansion/operations。

## CI精确要求与当前状态

Ubuntu24.04完整VM，PID1为systemd；actions/setup-python固定3.12.14；免密sudo。依赖systemd、dbus-user-session、util-linux(runuser)、passwd(useradd/userdel)、coreutils(timeout/install)，不需要第三方Python包。勿sudo整个脚本。

```sh
timeout --signal=TERM --kill-after=30s 240s bash examples/linux-services/verify-linux.sh
```

入口先输出Python/systemctl/kernel版本，再运行3项proc/信号测试和user/system两套真实启动→TERM停止→失败42→有限重启耗尽→修复恢复→清理。所有子命令与轮询有期限，失败时finally只处理自己命名资源。MainPID/HTTP一致、/proc cgroup一致、NRestarts>=1、ExecMainStatus42和严格cleanup=complete已在最终普通CI全部通过。

根代理已报告隔离首轮[run40093602682](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40093602682)失败，公开摘要仅见失败位置、匿名不可见详细日志，正在增加公开annotation重跑。未据摘要猜测失败原因，未把proc或systemd任一阶段写作已通过。等待根代理转发真实输出后再修正并回填。

## 未验证与限制

实际Ubuntu/systemd/kernel/Python版本与proc3项已取得；两scope完整断言与修复后账户创建/清理现已在最终普通CI通过；详细历史保留如下。没有系统性能基准、生产权限加固、容器、高可用、浏览器/手机验收。SIGKILL或断电不能保证用户态finally执行，实验只允许一次性VM；KILL案例自身也验证应用停止记录可能缺失、ready可能残留。未来CI通过后仍只覆盖该固定实验，不扩展为任意服务管理承诺。

## 第二轮真实trace与修复（历史：当时受阻）

根代理取得[run40094537231](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40094537231)真实trace：Ubuntu24.04.5 LTS；systemd255（255.4-1ubuntu8.17）；kernel6.17.0-1022-azure；CPython3.12.14。proc/信号**3/3通过**；systemd编排在旧第57行`sudo -n useradd --create-home --shell /usr/sbin/nologin atlas-lab-*`超出15秒。未到user manager或unit生命周期，不归因为权限/manager问题。旧finally打印complete但user_created尚False，不能作为无残留证据。

修复：创建前拒绝已有同名账户/组，显式选20000..59999未占用UID；`--no-log-init --uid ... --user-group --home-dir /var/tmp/本次目录/home`，创建上限30秒。官方[useradd手册](https://man7.org/linux/man-pages/man8/useradd.8.html)确认no-log-init跳过lastlog/faillog；**实际trace只证明超时，没有证明耗时一定来自lastlog**。不修改既有用户。finally不依赖成功标志，始终查询本次唯一用户名并核对UID/home，清理私有组的部分创建、管理器、unit和目录；检查实际账户/组、UID进程、unit及目录均无残留后才输出complete，否则报incomplete。

新增`tests/test_cleanup.py`，CPython3.12.14本机**3/3模拟回归通过**：useradd创建账户/组后超时仍清理；模拟userdel未删除时不输出complete；用户名对应不同UID时拒绝删除身份。全部系统命令被mock拦截，不更改macOS账户/服务，**不是Linux systemd验收**。脚本入口增加groupdel依赖与该回归步骤。正文完整源码同步；修复后的真实Linux两scope结果仍待根代理隔离CI。

第三轮隔离[run40095286144](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40095286144)：模拟部分清理3/3与Linux proc/信号3/3均通过；修复后的useradd成功，实际账户清理complete。下一失败是普通runner直接Path.exists读取0700的/run/user/20000被PermissionError拒绝，尚未证明unit生命周期。已改为既有sudo -n test -S /run/user/UID/bus，以退出码轮询真正socket；不chmod或削弱runtime目录权限。完整两scope仍待下一轮CI。

后续useradd仍30秒超时，不能将--no-log-init当已证根因。根代理18c1c46隔离strace annotation实际看到openat循环读取Rust工具链rlib/rmeta并创建输出（例如librustc_literal_escaper）；这证明账户创建在复制工具文件。现明确在本次work下创建空skel目录，传useradd --skel，以免教学用户复制镜像默认dotfiles/工具链；保留--no-log-init、有限UID/home/超时与严格清理。默认skeleton是慢点的解释仍待无strace新实验确认，两scope仍保持受阻。

## 当前最终结果：完整Success

根代理取得[run40097929509](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509)，head bea07732405b0faf0375adce85e3e242f8d0cb87，job30秒/total33秒。普通无strace真实Ubuntu脚本依序均返回0：模拟部分清理3/3、proc/信号3/3、user与system两scope全部健康/MainPID/cgroup、TERM停止、失败42/有限重启耗尽、修复恢复与严格清理断言通过；随后网络10/10亦通过。环境为上述真实Ubuntu24.04.5/systemd255.4-1ubuntu8.17/kernel6.17.0-1022-azure/CPython3.12.14。先前pending/受阻段落是排障历史，当前运行验收已完成，未改源码。

实际strace循环复制Rust rlib/rmeta，空skel后普通CI完整通过，这一对照支持默认模板复制是超时重要来源；没有假称最初lastlog猜测得到证实。图/手机与站点最终验收仍由根负责；review状态保留，不扩展为生产高可用或任意Linux发行版承诺。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
