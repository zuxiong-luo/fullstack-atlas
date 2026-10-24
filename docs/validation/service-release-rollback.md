# 私有Nginx发布与回滚验证

当前状态：首轮发现观察缺口，23a4808修后真实Linux完整通过；文章review，站点/手机待根代理。

## 首轮事实

run https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101256933 ，6ac22f0，2026-10-24；Ubuntu24.04.5、kernel6.17.0-1022-azure、Python3.12.14、Nginx1.24.0 (Ubuntu)。

命令：`timeout --signal=TERM --kill-after=25s 120s bash examples/service-release-rollback/verify-linux.sh`。

实际preflight_reject（启动42、存活200/ready503/入口v1）、非法配置未覆盖active、reload_drain（旧请求v1、新请求v2）通过；随后业务500的即时单次断言失败，finally停自己进程成功，但未到达最后完整成功日志。不能把前两个case当成全套通过。

## 修正后的观察协议

Nginx响应X-Atlas-Worker=$pid，控制器保存旧worker PID与/proc start_ticks。held明确已进入v1；reload后真实v2；release旧请求并确认返回v1；有限轮询旧worker身份消失，再向候选注入error，要求新worker响应500/v2/okfalse且health200，输出实际响应后执行显式路由回滚。无固定sleep判成功。正文与模板、关键源码映射已同步；修后真实通过见后文。

## 本机与范围

mac只py_compile、bash -n、guard77。官方Nginx control/proxy/core文档已浏览核对，实际Nginx版本以上述CI为准。私有prefix/config/PID/log/动态loopback，无sudo、/etc、systemctl或真实域名。临时配置原子替换不是整个发布事务；路由恢复不回退数据库；短hold协议不证明真实长连接无损SLA。SIGKILL/断电不保证finally。

SVG已Quick Look 1100px实际渲染人工检查；正文类型与代码映射将本批追加。站点/手机未验收。

## 本批本机最终核对

`python3 examples/service-release-rollback/verify-article.py`：5块带真实examples路径的正文代码，均为源码连续原文；无伪文件名。四篇单独TypeScript strict/noEmit检查通过。四个bash -n通过，四个非Linux入口均在任何系统/daemon修改前退出77。完整最小服务、输入协议、调用、成功/失败/清理分支均在正文解释。SVG已1100px实际渲染人工检查，public只保留可编辑源文件；此检查不等于站点/手机验收。下载依赖模板nginx.conf.in/workload.yaml.in已通知根加入精确打包白名单，最终ZIP由根验收。

## 修后完整成功（当前）

https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40101783608 ，23a4808；Ubuntu24.04.5/kernel6.17.0-1022-azure/Python3.12.14/Nginx1.24.0。preflight与非法配置、reload drain继续通过；旧worker3089已退出，新3105接管；带worker身份的实际v2/500/okfalse及health200；显式回滚入口v1/200；cleanup processes_stopped、监听可重绑、临时目录已删除并complete。PID只是此轮输出，测试每次动态观察。没有以固定sleep作为成功条件。

再次复现：aa5bae3，https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40102026052 ，本例整套再次退出0；源码未改松断言。以各自原始CI详细计数为具体观测值，重复成功不假定毫秒/PID完全相同。
