import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "electron-trust-boundary",
  "topic": "flutter",
  "title": "Electron：进程模型、IPC 与桌面权限边界",
  "description": "从文件导出功能出发，把渲染进程、preload 与主进程的职责分开。",
  "minutes": 8,
  "tags": [
    "Electron",
    "IPC",
    "preload",
    "桌面安全"
  ],
  "scope": "Electron 本地工程示例，不能在浏览器实验室直接运行；主进程实现需按应用补齐。",
  "prerequisites": [
    "浏览器安全模型",
    "Node.js 文件接口"
  ],
  "sections": [
    {
      "id": "s17-482283",
      "title": "桌面应用不是一个拥有全部权限的网页",
      "paragraphs": [
        "主进程管理应用生命周期和系统能力，渲染进程负责界面。preload 可以在受控边界上暴露少量功能。若让渲染内容随意访问 Node.js，网页 XSS 的影响可能从页面数据扩大到本机文件。",
        "界面是否加载远程内容、是否允许新窗口、是否能导航到其他来源都会影响风险。即使只加载打包页面，也要考虑富文本、第三方依赖和外部链接引入的不可信内容。"
      ]
    },
    {
      "id": "s19-463235",
      "title": "IPC 设计成业务能力，而不是万能通道",
      "paragraphs": [
        "避免暴露任意 channel 调用、任意路径读写或 shell 执行。更合适的接口是 exportReport(reportId)：主进程校验调用者、加载有权限的数据，再让用户通过文件对话框选择目标。",
        "参数 Schema 只解决格式，不解决授权。主进程仍需验证 sender / frame 来源、资源归属、文件范围和操作是否允许。错误返回应可诊断，但不应把内部绝对路径或令牌无条件传回界面。"
      ],
      "code": "// preload.cjs：教学接口，主进程必须实现校验\nconst { contextBridge, ipcRenderer } = require('electron');\ncontextBridge.exposeInMainWorld('reports', {\n  export: reportId => ipcRenderer.invoke('report:export', { reportId })\n});\n// 不要暴露 ipcRenderer 本身或通用 execute(command)。",
      "language": "js"
    },
    {
      "id": "s16-422260",
      "title": "隔离、沙箱与内容策略形成多层约束",
      "paragraphs": [
        "启用上下文隔离，使 preload 的特权环境与页面脚本分开；根据应用需求保持沙箱及合适的 Node 集成设置。CSP 限制脚本来源和执行方式，但不能代替 IPC 内的业务校验。",
        "外部 URL 打开前校验协议和目标，不把任意字符串交给系统处理。监听新窗口和导航行为，明确哪些链接可在应用内加载，哪些交给浏览器。默认配置会随版本演进，发布前核对目标 Electron 版本。"
      ]
    },
    {
      "id": "s10-264569",
      "title": "长任务不要占住主进程",
      "paragraphs": [
        "主进程还承担窗口与生命周期协调，重压缩、索引和大文件解析应评估后台线程或独立进程。设计进度事件、取消、超时和错误恢复，避免点击导出后窗口失去响应。",
        "订阅进度时要有取消订阅机制，防止反复打开窗口累积监听器。应用更新涉及签名、来源和失败回退，不能把下载到一个文件等同于安全更新完成。"
      ]
    },
    {
      "id": "s14-430459",
      "title": "练习：从被攻击的渲染进程思考",
      "paragraphs": [
        "假设渲染进程已经能运行任意脚本，列出它通过暴露接口仍能做什么。若答案是“读任意文件、执行任意命令”，边界设计已经失效；若只有按权限导出指定报表，损害范围明显更可控。",
        "验收包括：非法 reportId、来自未知 frame 的调用、重复请求、取消保存、目标不可写以及导出中关闭窗口。每个失败都应有可预测结果，而不是只测正常下载。"
      ]
    }
  ],
  "questionIds": [
    "electron-trust-boundary-ipc",
    "electron-trust-boundary-lifecycle"
  ],
  "references": [
    {
      "title": "Electron：安全指南",
      "url": "https://www.electronjs.org/docs/latest/tutorial/security"
    },
    {
      "title": "Electron：进程模型",
      "url": "https://www.electronjs.org/docs/latest/tutorial/process-model"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
