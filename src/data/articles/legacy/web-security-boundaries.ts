import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "web-security-boundaries",
  "topic": "identity",
  "title": "Web 安全：从 XSS、CSRF 到越权与 SSRF",
  "description": "按输入、身份、资源和出站请求四条边界建立防线，而不是只背攻击名称。",
  "minutes": 8,
  "tags": [
    "安全",
    "XSS",
    "CSRF",
    "SSRF",
    "越权"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "HTTP、Cookie、同源策略",
    "服务端接口"
  ],
  "sections": [
    {
      "id": "s14-362290",
      "title": "安全检查应放在事实发生的边界",
      "paragraphs": [
        "浏览器界面可以隐藏按钮，但实际读取或修改数据的服务端必须再次验证身份与资源权限。订单 ID、租户 ID 或角色字段来自请求，只是输入，不是授权证明。",
        "先建立威胁模型：哪些数据重要、谁能输入、谁能执行、哪些外部系统被信任。一个按钮能否被看到和一个操作能否被执行，是两个不同问题。本手册的纯客户端登录只是学习内容展示控制。"
      ]
    },
    {
      "id": "s16-401676",
      "title": "XSS：把数据误解释成可执行内容",
      "paragraphs": [
        "React 普通文本插值会转义，但 dangerouslySetInnerHTML、富文本渲染、URL 属性和第三方组件仍需审查。编码必须适合输出上下文；HTML 文本编码不能拿来替代 JavaScript 或 URL 上下文处理。",
        "富文本采用成熟清洗器和允许列表，避免自己写正则清洗 HTML。CSP 可降低部分执行风险，但不是修复危险 DOM 注入的替代品。敏感 Cookie 使用 HttpOnly 有助于减少直接读取，却不能阻止 XSS 代替用户操作页面。"
      ]
    },
    {
      "id": "s17-161503",
      "title": "CSRF 与 CORS 的职责不同",
      "paragraphs": [
        "浏览器自动携带会话 Cookie，使跨站请求可能以用户身份到达服务端。CSRF 防御结合合适的 SameSite 策略、CSRF token、Origin 等验证，并避免用 GET 改变业务状态。",
        "CORS 主要控制浏览器脚本能否读取跨源响应，不是通用的服务端请求防火墙。服务端仍需鉴权；没有 CORS 许可也不代表所有跨站请求都无法发送。不要用“前端报跨域了”证明操作没有执行。"
      ]
    },
    {
      "id": "s18-376221",
      "title": "越权与 SSRF：身份内侧和网络外侧",
      "paragraphs": [
        "对象级授权应检查当前主体是否可访问目标资源，且租户过滤尽量成为查询的一部分。测试不仅要有未登录请求，还要有用户 A 请求用户 B 的资源，这类错误很容易被正常路径掩盖。",
        "如果服务端按用户提供的 URL 抓取内容，应限制允许的目标、协议、端口和重定向。仅在字符串里屏蔽 localhost 不够，还要考虑解析结果、私网地址、DNS 变化及网络出口控制。不要把内网或云元数据端点暴露为通用抓取能力。"
      ],
      "code": "输入 → 解析与长度限制\n身份 → 验证会话，不信任请求内自报角色\n资源 → 检查用户/租户与目标对象的关系\n出站 → 允许目标范围，校验重定向，限制超时与响应体\n输出 → 按上下文编码，避免执行不可信内容",
      "language": "检查顺序"
    },
    {
      "id": "s14-394976",
      "title": "练习：给一个导入接口设计反例",
      "paragraphs": [
        "接口接收文档 URL 并导入知识库。先测试普通文档，再测试超大响应、重定向到不允许目标、用户指定别人的知识库 ID、恶意富文本及重复提交。测试环境使用自建受控端点，不针对第三方系统。",
        "参考判定：输入合法不代表 URL 目标可信；成功抓取不代表用户有权写入指定库；文档内容也不能作为后续 Agent 的系统指令。将每条防线与具体责任对应，才能避免一个“安全过滤函数”承担所有事情。"
      ]
    }
  ],
  "questionIds": [
    "web-security-boundaries-csrf",
    "web-security-boundaries-ssrf"
  ],
  "references": [
    {
      "title": "OWASP：授权",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html"
    },
    {
      "title": "OWASP：CSRF",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"
    },
    {
      "title": "OWASP：SSRF",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
