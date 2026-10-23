# Agent 知识库助手 · 双语言工程

Python与TypeScript使用相同输入、文档样本、HTTP协议和验收用例。默认确定性mock，无需密钥；mock与关键词检索回归不作为模型质量证据。

| 章节 | 内容 | 版本入口 |
| --- | --- | --- |
| 01 | 请求、模型适配、结构/业务校验、错误和超时 | [chapter-01.json](shared/chapter-01.json) |
| 02 | 工具白名单、文档授权、MCP stdio子集 | [chapter-02.json](shared/chapter-02.json) |
| 03 | 检索、证据和引用 | [chapter-03.json](shared/chapter-03.json) |
| 04 | SQLite检查点、认领和恢复 | [chapter-04.json](shared/chapter-04.json) |
| 05 | 显式记忆、隔离和删除 | [chapter-05.json](shared/chapter-05.json) |
| 06 | 可重复的检索评测 | [chapter-06.json](shared/chapter-06.json) |
| 07 | 提示注入、权限和越权失败 | [chapter-07.json](shared/chapter-07.json) |
| 08 | 容量、预算和本地部署 | [chapter-08.json](shared/chapter-08.json) |

第一章保留独立的 [Python](python/README.md)、[TypeScript](typescript/README.md) 工程与 `/v1/answers`。第二至八章使用 [Python v2](python-v2/README.md)、[TypeScript v2](typescript-v2/README.md) 和 [共同契约](shared/v2/CONTRACT.md)。v2以CHAPTER逐步开放同一份代码，不虚构独立Git标签；入口文件所在提交固定对应源码。

先按两个实现的README安装依赖，并在TypeScript v2执行 `npm run build`。之后从仓库根目录运行实际HTTP一致性检查：

```sh
examples/agent-workshop/python-v2/.venv/bin/python \
  examples/agent-workshop/shared/v2/verify-http-parity.py
```

检查器启动两种语言的本地进程、使用临时SQLite库，执行相同用例后关闭进程。它检查接口行为，不调用外部模型，不代表生产身份认证、分布式部署或模型语义评测。

从站点下载ZIP后，解压得到 `agent-workshop/`。保留shared与两个实现目录的相对位置；进入相应语言目录执行README命令，跳过以完整仓库为起点的 `cd examples/...`。依赖首次安装需要联网，离线文章缓存不包含Python、Node、原生依赖或外部模型服务。

真实模型HTTP适配器由服务端环境变量显式启用；本次未调用真实付费模型。示例只绑定回环地址，演示令牌不是生产认证；GitHub Pages只展示文章与下载源码，不运行这些服务器。容器配置属于交付源码，未运行容器的环境不得标作部署验收通过。
