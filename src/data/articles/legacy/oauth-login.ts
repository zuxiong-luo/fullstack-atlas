import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "oauth-login",
  "topic": "identity",
  "title": "从一次第三方登录，理解 OAuth、OIDC 与 PKCE",
  "description": "沿着浏览器跳转和服务端校验，区分授权、身份与网站自己的会话。",
  "minutes": 14,
  "tags": [
    "OAuth 2.0",
    "OIDC",
    "PKCE",
    "HTTPS"
  ],
  "scope": "协议原理与授权码流程；具体参数以身份提供商文档为准。",
  "prerequisites": [
    "HTTP 请求与重定向",
    "Cookie 与浏览器存储"
  ],
  "questionIds": [
    "oauth",
    "session-jwt",
    "https",
    "http-cache",
    "cache-isolation"
  ],
  "sections": [
    {
      "id": "boundaries",
      "title": "先把三个问题分开",
      "paragraphs": [
        "用户点击“第三方登录”，看起来只有一次操作，实际涉及三件事：通信对端是否可信、第三方是否确认了用户身份、本站是否建立了自己的会话。HTTPS、身份协议和本站会话分别承担不同责任。",
        "OAuth 2.0 解决的是委托授权：应用获得访问受保护资源的能力。OIDC 在其上增加身份层，使用 ID Token 等机制表达认证结果。不能因为拿到了某个 access token，就把它当成适用于任意系统的身份证。",
        "本站最终仍需把外部身份映射到内部用户。绑定键应围绕身份提供商及稳定的 subject 设计，不应仅凭一个未经确认的邮箱把两个账号自动合并。"
      ]
    },
    {
      "id": "journey",
      "title": "沿着授权码走一遍",
      "paragraphs": [
        "以支持 OIDC 的提供商为例：浏览器前往授权端点，用户完成登录与授权，提供商将浏览器重定向到预先注册的回调地址，并附带授权码。这个 code 是短期的交换凭据，不是用户资料。",
        "客户端把 code 交给令牌端点兑换，随后验证返回的身份声明。服务端应用和浏览器公开客户端的能力不同：浏览器无法保守 client secret，不能把密钥放在前端环境变量后就认为安全。",
        "验证通过后，本站可以建立自己的会话。身份提供商的会话、本站 Cookie 和访问外部 API 的 token 各自有有效期与退出机制，应分别设计。"
      ],
      "code": "浏览器 → 授权端点：发起授权请求\n提供商 → 回调地址：返回 code + state\n客户端 → 令牌端点：code + code_verifier\n客户端：验证身份声明、匹配内部用户\n本站：建立自己的会话",
      "language": "流程"
    },
    {
      "id": "proof",
      "title": "PKCE、state 与 nonce 各管什么",
      "paragraphs": [
        "PKCE 在发起请求时提交 code_challenge，兑换时提供对应的 code_verifier，用来绑定请求与兑换过程。截获授权码的人如果没有 verifier，就不应能独立完成兑换。",
        "state 用于关联发起请求与回调，常用于抵御登录流程中的 CSRF。OIDC nonce 则用于将身份令牌与认证请求关联。不要把这些字段视为可随便填写的装饰参数。",
        "这些机制不能代替其他验证。还应校验回调地址、签名、issuer、audience、有效期，并根据所用流程验证相关声明。应使用成熟库实现这些规则，而不是手写一个“解码 JWT 就登录”的流程。"
      ],
      "takeaway": "解码 token 只是在读取内容，校验 token 才是在建立信任。"
    },
    {
      "id": "session",
      "title": "真正的工程问题发生在登录之后",
      "paragraphs": [
        "如果网站采用 HttpOnly Cookie，脚本不能直接读取该 Cookie，但浏览器会自动携带它，因此还需要考虑 CSRF。若凭证存放在可被脚本读取的存储中，则要评估 XSS 后的泄露风险。两种选择都有配套要求。",
        "退出本站通常不等于退出提供商。立即撤销会话、刷新令牌轮换、单设备退出、账号权限变化，都需要明确服务端事实来源。不要把“前端删除了 token”表述为“所有副本均已失效”。",
        "定位登录失败时，按跳转、回调参数、令牌兑换、身份校验、本站会话这几个阶段留出诊断点。日志不记录原始 token、授权码或 Cookie，只记录必要的关联标识和失败分类。"
      ]
    },
    {
      "id": "tradeoffs",
      "title": "把身份流程放回系统边界",
      "paragraphs": [
        "对于有 BFF 的应用，可以把部分凭证与外部 API 调用留在服务端；纯浏览器应用则需要采用适合公开客户端的流程。选型应先考虑应用形态与信任边界，再选择库。",
        "本手册的阅读口令只是学习材料的客户端展示开关，与本文讨论的真实认证不同。理解这个差异，才能在需要保护账户、订单或支付信息时选择合适的方案。"
      ]
    }
  ],
  "references": [
    {
      "title": "OAuth 2.0 安全最佳实践（RFC 9700）",
      "url": "https://www.rfc-editor.org/rfc/rfc9700.html"
    },
    {
      "title": "OpenID Connect Core",
      "url": "https://openid.net/specs/openid-connect-core-1_0.html"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
