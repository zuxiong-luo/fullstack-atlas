# Agent 知识库助手 · 第一章

章节标记 `chapter-01-v1`，入口见 `shared/chapter-01.json`。当前只交付可验证的模型调用边界，后续章节尚未实现，不包含 SQLite、工具或 RAG。

- Python：见 [python/README.md](python/README.md)
- TypeScript：见 [typescript/README.md](typescript/README.md)
- 共同行为：[shared/CONTRACT.md](shared/CONTRACT.md)
- 共用输入：[shared/request.json](shared/request.json)
- 失败及成功验收：[shared/cases.json](shared/cases.json)

从站点下载 ZIP 时，解压得到 `agent-workshop/`。直接进入其中的 `python/` 或 `typescript/`，执行对应 README 从创建环境/安装依赖开始的命令；跳过其中以完整仓库为起点的 `cd examples/...`。不要移动 shared 文件夹，两种语言测试都会读取它。

安装依赖需要联网；安装后默认 mock 与本地假 HTTP 测试不调用模型供应商。真实适配器已实现但未验证真实付费调用。服务仅绑定本机回环地址，不能由 GitHub Pages 执行。
