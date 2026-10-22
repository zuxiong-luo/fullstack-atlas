import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "next-server-boundaries",
  "topic": "nextjs",
  "title": "Next.js：Server Components、渲染与缓存边界",
  "description": "从一个账户页面拆解代码在哪执行、数据发到哪里，以及缓存如何避免串用户。",
  "minutes": 8,
  "tags": [
    "Next.js",
    "RSC",
    "SSR",
    "缓存",
    "BFF"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "React 组件",
    "HTTP 与会话"
  ],
  "sections": [
    {
      "id": "s16-390231",
      "title": "服务器组件与服务器渲染不是同义词",
      "paragraphs": [
        "Server Components 描述组件执行和模块边界；SSR 描述生成初始 HTML 的过程。Client Components 在完整页面加载时也可能参与服务端预渲染，所以不能把 use client 理解成“这个文件永远不在服务器执行”。",
        "服务器组件可以靠近数据源执行，把所需结果交给界面。它不意味着所有数据库字段都安全：只要数据被传入客户端组件 props 或出现在返回内容中，就应当按已发送给浏览器处理。"
      ]
    },
    {
      "id": "s18-200107",
      "title": "use client 是模块依赖边界",
      "paragraphs": [
        "客户端入口及其导入的依赖会影响客户端代码包。把整页标为客户端容易把本可留在服务端的工作和依赖带给浏览器。常见做法是在服务端获取和整理数据，再把可交互的小部件放进客户端组件。",
        "服务端组件可以通过 children 等组合方式被放在客户端组件的界面中，但不能据此假定客户端模块可以随意导入服务器专用依赖。密钥、数据库连接和权限查询必须保持在服务器边界内。"
      ],
      "code": "// 服务端伪代码，需由真实认证与数据库实现支撑\nasync function AccountPage() {\n  const user = await requireSession();\n  const record = await loadAccount(user.id);\n  const view = { name: record.name, plan: record.plan };\n  return <AccountControls account={view} />;\n}\n// 不要把 token、内部权限标记或完整数据库行传给客户端。",
      "language": "tsx"
    },
    {
      "id": "s10-261709",
      "title": "给缓存写一份明确契约",
      "paragraphs": [
        "先列出浏览器缓存、请求内复用、服务端数据缓存、路由产物与 CDN 等层次。每层回答：键是什么、保存多久、谁共享、如何失效。用户态数据若误用不带身份的共享键，认证成功也无法防止错误数据返回。",
        "Next.js 的缓存 API、默认行为和配置会随版本变化。项目应锁定版本，显式表达需要缓存还是需要实时读取，再用两个不同账户验证。学习时记住缓存的责任，不要背“所有 fetch 默认缓存”这样的无版本结论。"
      ]
    },
    {
      "id": "s14-336522",
      "title": "写操作把鉴权、幂等与刷新分开",
      "paragraphs": [
        "Server Action 或 Route Handler 接受来自客户端的输入，必须当成公开边界验证。页面上隐藏按钮不能替代写操作内的身份和资源归属校验。订单 ID 来自请求不代表当前用户有权修改它。",
        "成功写入后需要让读视图更新：失效目标缓存、更新客户端状态或重新获取数据。数据库已提交但页面未更新是可见性问题；重复提交产生两笔订单则是幂等问题，两者不能混为一谈。"
      ]
    },
    {
      "id": "s12-338026",
      "title": "静态部署与动态能力的取舍",
      "paragraphs": [
        "本手册部署到 GitHub Pages，是静态应用。需要运行时数据库、服务器组件动态读取、服务器写操作的 Next.js 项目需要相应运行环境，不能仅把一个动态应用导出为 HTML 就保留全部能力。",
        "自测：两个用户看到同一份订单列表，如何排查？先核对服务端数据来源和用户归属，再检查共享缓存键、响应缓存头和客户端查询缓存。逐层禁用缓存做诊断可以缩小范围，但最终方案应恢复正确的缓存边界。"
      ]
    }
  ],
  "questionIds": [
    "next-server-boundaries-rsc",
    "next-server-boundaries-cache"
  ],
  "references": [
    {
      "title": "Next.js：服务器与客户端组件",
      "url": "https://nextjs.org/docs/app/getting-started/server-and-client-components"
    },
    {
      "title": "Next.js：缓存",
      "url": "https://nextjs.org/docs/app/guides/caching"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
