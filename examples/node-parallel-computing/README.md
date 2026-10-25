# node-parallel-computing

Node.js **22.12.0**、原生ESM，无第三方npm依赖；macOS14.5 x64实测。精确引擎与package-lock独立。

## 命令

```sh
cd node-parallel-computing
npm ci
npm test
node demo.mjs
```

ZIP解压后进入对应目录；仓库中可`cd examples/node-parallel-computing`。`npm test` **17/17通过**。示例不依赖数据库、密钥、UI沙箱或付费服务；源代码下载不包含Node运行时。

## 文件

compute.mjs是有界可信纯CPU任务；worker.mjs同时支持线程与进程。
endpoint.mjs适配消息/停止；pool.mjs管理任务身份、准入、队列、期限、取消、单次结算、退出替换与有限重启。
communication.mjs检查所有权，demo.mjs可直接运行；test.mjs为真实隔离验收。

## 预期与实际证据

真实thread与process各有正常、队列限容、排队取消、普通异常、退出替换、started后取消、期限和关闭测试。另验线程ArrayBuffer转移使发送端byteLength0，进程advanced IPC复制保持8；无效输入和重启预算关闭。

正常质数结果10/100/1000为4/25/168。thread同PID、不同threadId；process不同PID、threadId0。PID来自当前运行，不需要等于文档某个数。测试没有用耗时证明加速，没有把事件循环模型当作真实Worker。

运行demo最后应两个池都running0/queued0，随后finally关闭。测试正常退出证明本次未留下挂住测试的Worker/子进程；OS强杀整个主测试不保证finally。

## 边界

- size1..4、queue0..32、timeout1..10000ms，任务limit2..5000000；队列在内存，主进程死则丢，不是持久消息系统。
- throw/crash只为故障教学，不能把它们做成公网执行接口。固定模块可信，不提供权限沙箱。
- Worker resourceLimits不等于总RSS硬限额；CPU隔离不自动回滚外部数据库、邮件或支付。
- 取消运行任务会终止整个执行者，等待exit才替换；close是中止，不是drain。
- 进程示例只在本机OS验证；没有Linux/容器CPU配额/生产吞吐结论。

正文关键代码与真实文件连续匹配；两张可编辑SVG用Quick Look实际渲染检查。站点手机视口、ZIP干净安装及离线清单由主代理单列，不用CLI测试替代页面验收。

## 2026-10-25：线程层次与进程 API

```sh
node process-modes.mjs
node cluster-demo.mjs
```

process-modes 对照 spawn/execFile 原样传参、固定 POSIX shell 命令、64字节 maxBuffer 失败与 fork IPC。
child-events 提供消息/退出/错误/deadline 单次结算；新增故障验收覆盖peer退出、无回复、cluster启动前退出。
cluster 只在随机loopback同端口服务8次独立连接，不作公平分发或生产吞吐结论。

本次测试 **17/17 通过**；原13项完整保留，新增4项（包括IPC多个失败分支）。
POSIX shell与cluster调度在macOS验证，Windows另验。silence模式有意保活等待，用父进程期限与 finally 回收；不留下后台worker。
