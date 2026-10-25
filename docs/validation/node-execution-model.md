# Node 执行模型：2026-10-25 增补验收

## 范围与兼容性

保留 `node-execution-model`、全部原章节锚点、questionIds/评论归属；增加V8/宿主绑定/libuv/OS、文件、TCP、真实资源追踪四节，不新建文章。原8项测试保持，新增真实fs/HTTP与ENOENT2项。

环境macOS14.5 x64，Node v22.12.0，npm10.9.0；无第三方依赖。未升级Node。

```sh
npm ci --ignore-scripts --prefix examples/node-execution-model
npm test --prefix examples/node-execution-model
node examples/node-execution-model/io-trace.mjs
```

本次 **10/10通过**。main、CJS/ESM、I/O内immediate、Promise/unref退出、分块取消、async失败均保持。新实验text/body均notes，事件file:submit→file:callback→http:submit→server:request→http:response→http:end，资源FSREQCALLBACK/TCPWRAP/TCPCONNECTWRAP/HTTPCLIENTREQUEST。不存在文件打开返回ENOENT；server尚未监听，hook与自有socket按finally清理。

## 固定源码与证据分层

实际下载 https://raw.githubusercontent.com/nodejs/node/v22.12.0/ 下的 lib/fs.js、lib/internal/fs/read/context.js、src/node_file.cc、lib/net.js、src/tcp_wrap.cc、deps/uv/src/unix/fs.c/tcp.c、lib/internal/process/task_queues.js 与LICENSE。

正文显示11段连续原源码；逐段按 `source-fragments/manifest.json` 的原文件/行号比对。没有改写原分支/注释，第三方MIT归属放入THIRD_PARTY_NOTICES.txt并在每段就近说明。

解释中区分：JS业务/资源是本机直接观察；C++→libuv→OS职责根据固定源码推导；未采系统调用/线程ID。macOS文件通用工作池路径不扩展成Linux每次必走池，明确io_uring尝试分支；数值地址TCP不含DNS。微任务函数与CJS/ESM完整实验均在正文，不靠外链补关键结论。

## 图形与限制

layers.svg经CUA内置浏览器实际完整渲染，标签/箭头无裁切。Quick Look宽图缩略图曾裁切，因此未将该缩略图作为合格证据。原runtime/checkpoints图保留；站点手机视口、高亮、下载ZIP与离线由主集成最终确认。

未验证Windows/Linux内核追踪、io_uring、native扩展或生产容量。async_hooks类型不当作工作线程身份。服务器只绑定127.0.0.1随机端口，自己创建自己关闭。
