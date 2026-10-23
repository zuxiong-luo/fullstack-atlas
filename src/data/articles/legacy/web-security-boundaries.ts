import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "web-security-boundaries",
  "topic": "identity",
  "title": "Web 安全的四条边界：XSS、CSRF、对象授权与受控出站",
  "description": "沿一个文档导入操作，区分代码执行、请求意图、资源权限与出站目标，交付只在loopback运行的受控复现、修复代码和失败测试。",
  "minutes": 43,
  "tags": [
    "安全",
    "XSS",
    "CSRF",
    "SSRF",
    "越权"
  ],
  "scope": "本机教学文档服务，含故意不转义的无害标记预览和修复；身份为固定demo会话。SSRF实现收窄为受控documentId目录+本地transport桩，不提供任意URL抓取或通用DNS/IP防护器，不扫描第三方。",
  "prerequisites": [
    "HTTP、Cookie、浏览器同源概念",
    "Node请求处理与JavaScript对象"
  ],
  "sections": [
    {
      "id": "s14-362290",
      "title": "先认识安全边界：谁提供数据，谁决定执行",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "安全边界，是一份数据或一次操作从较少信任的一侧进入较多权限的一侧的位置。浏览器输入进入HTML解释器、带Cookie的请求进入服务端、请求里的文档ID进入数据库、用户参数变成服务端出站目标，都发生了这种跨越。XSS、CSRF、越权和SSRF各自针对其中不同的判断，不能用一个“安全过滤函数”全部代替。"
        },
        {
          "type": "paragraph",
          "text": "本文固定一个场景：Alice登录文档网站，只能修改自己的文档a；Bob拥有文档b；网站允许导入经过配置的guide文档并预览内容。攻击输入可能来自URL、请求体或导入文档，服务端保存的owner和会话才是授权事实。我们先看普通写入与导入，再分别改变一个条件，检查哪条边界拒绝它。"
        },
        {
          "type": "figure",
          "src": "figures/web-security-boundaries/boundaries.svg",
          "title": "同一个文档导入操作的四条边界",
          "alt": "会话、Origin和CSRF token先确认请求上下文，资源owner确认权限，固定documentId映射允许出站目标，最终把不可信内容作为HTML文本编码输出。",
          "caption": "只在127.0.0.1实验。导入transport为本地桩，没有访问外部目标；每道检查职责不同。"
        },
        {
          "type": "table",
          "headers": [
            "边界",
            "攻击要利用的错误",
            "本篇的处理"
          ],
          "rows": [
            [
              "输出解释",
              "把文本交给HTML解析并执行事件",
              "HTML文本编码，safe预览加CSP"
            ],
            [
              "请求意图",
              "浏览器自动带Cookie，被诱导发起操作",
              "写操作验证方法、Origin与CSRF token"
            ],
            [
              "对象权限",
              "有自己会话就修改别人的ID",
              "服务端存储owner与当前user比较"
            ],
            [
              "出站权限",
              "让服务器替输入者访问任意目标",
              "只接documentId，配置映射固定URL"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "示例只监听本机4312，不含真实账号或隐私。/demo-session明确允许选择固定用户；它只是建立教学上下文。故意不转义的unsafe预览只含设置body属性的无害样本，用于比较解释行为；不能把这个实验对外部署。本文没有扫描第三方，也不把测试通过当生产安全认证。"
        }
      ]
    },
    {
      "id": "s16-401676",
      "title": "XSS：数据怎样变成浏览器会执行的内容",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "XSS的关键是解释器：原本应该展示给用户的内容被当作HTML、脚本或其他可执行上下文解释。假设文档内容是下面的字符串，unsafe预览直接把它拼入<p>内部，浏览器会把img识别为元素；加载本机不存在的x触发onerror，样本只给body设置一个标记。safe预览则显示原始文字。"
        },
        {
          "type": "code",
          "code": "<img src=\"x\" onerror=\"document.body.dataset.demo='executed'\">",
          "filename": "本机无害输入",
          "purpose": "仅在本项目/unsafe-preview中观察标记。src=x只访问该本机服务，不读取凭据、不请求外站。",
          "language": "html",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "修复应匹配输出上下文。本文是HTML文本节点，所以把&、<、>、引号编码为实体；结果中的&lt;img显示为字面文字，不再建立img元素。若是在浏览器DOM中更新纯文本，优先textContent；React普通文本插值也处理文本转义，但dangerouslySetInnerHTML会重新跨入需要审查的HTML解释边界。"
        },
        {
          "type": "code",
          "code": "import {timingSafeEqual} from 'node:crypto';\nexport class Rejected extends Error { constructor(code) {super(code); this.code=code;} }\nfunction requireValue(value, code) {if(!value) throw new Rejected(code);}\nexport const APP_ORIGIN = 'http://127.0.0.1:4312';\nexport function htmlText(value) {\n  return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\n}\nfunction equal(a,b) {\n  return typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) &&\n    timingSafeEqual(Buffer.from(a),Buffer.from(b));\n}\nexport function authorizeWrite({method, origin, csrf}, session, document) {\n  requireValue(session, 'unauthenticated');\n  requireValue(method==='POST', 'method_not_allowed');\n  requireValue(origin===APP_ORIGIN, 'origin_mismatch');\n  requireValue(equal(csrf,session.csrf), 'csrf_mismatch');\n  // The resource owner comes from stored data, never from request.owner or role.\n  requireValue(document && document.owner===session.user, 'not_found_or_forbidden');\n}",
          "filename": "security.mjs · 输出、身份与授权",
          "purpose": "完整htmlText和authorizeWrite，包括长度安全比较。下面分别用具体输入带读各条检查。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "htmlText不是通用清洗器：把这个函数用于<script>内部拼接或CSS上下文，不会自动变安全。URL属性还需要协议/目标约束；确实要支持富文本时，应使用成熟HTML清洗器与允许列表，而不是自己写正则删除script标签。本文只承诺纯文本预览，所以选择编码而不是保留部分HTML。"
        },
        {
          "type": "paragraph",
          "text": "safe路由另设CSP default-src none，作为纵深约束。核心修复仍是使内容保留文本含义；自动测试直接断言响应中是&lt;img而非<img，避免CSP关闭事件后掩盖仍在发生的HTML注入。HttpOnly只能阻止脚本直接读取该Cookie，XSS仍可能使用浏览器已有会话替用户操作，因而也不替代输出修复。"
        },
        {
          "type": "reference",
          "title": "输出上下文与清洗依据：OWASP XSS Prevention",
          "url": "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"
        }
      ]
    },
    {
      "id": "s17-161503",
      "title": "CSRF：请求到了服务端，不等于用户有这个意图",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Cookie由浏览器按规则自动附带，因此别的页面可能诱导浏览器发送带用户身份的请求。CSRF要利用的是“自动携带身份”，不要求先读到Cookie。我们的写操作是POST，先有会话，再要求Origin精确等于APP_ORIGIN，最后比较请求X-CSRF-Token与服务端会话csrf。token来自同源demo会话响应，不从URL参数或请求自报值中建立可信事实。"
        },
        {
          "type": "paragraph",
          "text": "带入正常请求：session.user=alice，Origin=http://127.0.0.1:4312，csrf与该会话相同，文档a的owner也是alice，authorizeWrite返回而不抛错。换Origin为另一个站点，首先得到origin_mismatch；保留Origin但换token，得到csrf_mismatch。失败都发生在target.text赋值之前。"
        },
        {
          "type": "paragraph",
          "text": "SameSite=Lax能限制一部分跨站Cookie发送，但“同站”与“同源”不是同一个边界，尤其是子域、顶层导航和部署策略。本文保留Origin与同步token两层；实际应用优先用框架提供的成熟CSRF实现。非浏览器客户端可以自行填写Origin，所以Origin本身不是身份凭据；服务端会话与资源授权仍然必须验证。"
        },
        {
          "type": "paragraph",
          "text": "CORS主要约束浏览器脚本能否读取跨源响应。某些跨站请求仍能发送到服务端，因此“浏览器控制台报跨域”不能证明操作没执行。本文安全路由没有放宽CORS，检查仍在服务端完成；smoke用显式Origin验证分支，但它不是完整浏览器CSRF自动化。"
        },
        {
          "type": "reference",
          "title": "Origin、token、SameSite职责依据：OWASP CSRF Prevention",
          "url": "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"
        }
      ]
    },
    {
      "id": "s18-376221",
      "title": "对象授权与SSRF：身份内侧和网络外侧分开判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "通过会话和CSRF检查，只证明请求属于当前上下文。Alice仍然不能写文档b。authorizeWrite最后读取服务端target.owner，与session.user比较；请求体里即使加role=admin或owner=alice也不会参与决策。失败统一给not_found_or_forbidden，避免用响应细节任意暴露资源是否存在。真实数据库实现宜把user/tenant条件放进查询或条件更新，而不仅在UI隐藏按钮。"
        },
        {
          "type": "paragraph",
          "text": "SSRF发生在服务端把输入解释成可访问网络目标时。若业务只需要若干已配置文档，最容易解释和验证的方案是让用户传documentId，不接受任意URL。下面的guide映射由服务端代码配置；看起来像URL的输入会先因unknown_document拒绝，连transport都不会被调用。"
        },
        {
          "type": "code",
          "code": "// This lab intentionally has no arbitrary URL fetcher. Only a configured document ID maps to a URL.\nconst DOCUMENTS = new Map([['guide','https://docs.example.invalid/guide.txt']]);\nexport function outboundUrl(id) {\n  requireValue(typeof id==='string' && DOCUMENTS.has(id), 'unknown_document');\n  const url=new URL(DOCUMENTS.get(id));\n  requireValue(url.protocol==='https:' && url.hostname==='docs.example.invalid' &&\n    !url.username && !url.password && (!url.port || url.port==='443'), 'invalid_target');\n  return url.href;\n}\nexport async function fetchDocument(id, transport, maxBytes=1024) {\n  const url=outboundUrl(id);\n  // Real fetch adapter must retain redirect:error and the timeout, not auto-follow.\n  const response=await transport(url,{redirect:'error',signal:AbortSignal.timeout(1000)});\n  requireValue(response.status===200,'upstream_status');\n  requireValue(response.body && Symbol.asyncIterator in response.body,'invalid_body');\n  const chunks=[]; let bytes=0;\n  for await (const raw of response.body) {\n    const chunk=Buffer.from(raw);bytes+=chunk.length;\n    if(bytes>maxBytes) {\n      // Exiting for-await calls the iterator return method; the adapter must implement stream cleanup.\n      throw new Rejected('response_too_large');\n    }\n    chunks.push(chunk);\n  }\n  return Buffer.concat(chunks).toString('utf8');\n}",
          "filename": "security.mjs · 受控出站",
          "purpose": "完整documentId映射、目标约束、显式拒绝跳转、1秒预算和流式响应字节上限。transport参数在server中为本地桩。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "正常输入documentId=guide，得到唯一配置的HTTPS地址，再把redirect:error和超时signal交给transport。响应必须为200，body必须可异步读取；每个chunk累计字节数，超过1024立即拒绝。退出for-await会调用迭代器return，测试用finally确认流清理；真实适配器需要保留这个关闭行为。"
        },
        {
          "type": "paragraph",
          "text": "输入http://127.0.0.1/、file:///etc/hosts、带userinfo的伪装URL、guide/../admin都不是允许的ID，直接拒绝。测试中的这些只是字符串，从不发网络请求。响应为302也拒绝，不能自动跟到一个新目标。这个限制的代价是只支持配置文档；我们有意缩小能力，而不在几十行代码里承诺任意URL都安全。"
        },
        {
          "type": "paragraph",
          "text": "若产品真的需要任意URL，需要另外处理解析后的IP、IPv4/IPv6与私网范围、DNS变化/重绑定、每次重定向、连接实际目标及代理/网络出口政策。只在字符串中查localhost或只检查第一次域名不足以覆盖这些问题。本篇未实现和验证这类通用抓取器；网络出口控制应作为独立防线。"
        },
        {
          "type": "reference",
          "title": "资源授权依据：OWASP Authorization",
          "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html"
        },
        {
          "type": "reference",
          "title": "SSRF目标允许列表与出站边界：OWASP SSRF Prevention",
          "url": "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
        }
      ]
    },
    {
      "id": "http-service",
      "title": "把四道检查接到真实HTTP操作上",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import http from 'node:http';\nimport {randomBytes} from 'node:crypto';\nimport {APP_ORIGIN, Rejected, htmlText, authorizeWrite, fetchDocument} from './security.mjs';\nconst sessions=new Map(), docs=new Map([['a',{id:'a',owner:'alice',text:'Alice document'}],['b',{id:'b',owner:'bob',text:'Bob document'}]]);\nconst harmless='<img src=\"x\" onerror=\"document.body.dataset.demo=\\'executed\\'\">';\nasync function readJson(req) {\n let text='';for await (const chunk of req) {text+=chunk;if(Buffer.byteLength(text)>2048)throw new Rejected('body_too_large');}\n try{return JSON.parse(text);}catch{throw new Rejected('invalid_json');}\n}\nfunction json(res,status,data,headers={}) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}\nfunction session(req) {const sid=/(?:^|;\\s*)lab_sid=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie??'')?.[1];return sessions.get(sid);}\n// Transport is a deterministic local stub, and never sends an outbound network request.\nasync function localTransport(url, options) {\n if(options.redirect!=='error')throw new Error('redirect policy lost');\n return {status:200,body:(async function*(){yield Buffer.from('Local controlled document sample');})()};\n}\nhttp.createServer(async(req,res)=>{\n try {\n  const url=new URL(req.url,APP_ORIGIN);\n  if(req.method==='GET' && url.pathname==='/demo-session') {\n   const user=url.searchParams.get('user');if(!['alice','bob'].includes(user))throw new Rejected('unknown_demo_user');\n   if(sessions.size>=1000)throw new Rejected('demo_capacity');\n   const sid=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');sessions.set(sid,{user,csrf});\n   json(res,200,{demo:true,user,csrf},{'Set-Cookie':`lab_sid=${sid}; HttpOnly; SameSite=Lax; Path=/`});\n  } else if(req.method==='GET' && ['/safe-preview','/unsafe-preview'].includes(url.pathname)) {\n   const text=url.searchParams.get('text')??harmless;if(text.length>1000)throw new Rejected('input_too_large');\n   const safe=url.pathname==='/safe-preview';\n   // Unsafe route is deliberately vulnerable, local-only and contains no real data.\n   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',...(safe?{'Content-Security-Policy':\"default-src 'none'; base-uri 'none'; frame-ancestors 'none'\"}:{})});\n   res.end(`<html><body><h1>LOCAL ${safe?'SAFE':'UNSAFE'} PREVIEW</h1><p>${safe?htmlText(text):text}</p><p>Check body data-demo in devtools. Harmless marker only.</p></body></html>`);\n  } else if(req.method==='POST' && url.pathname==='/write') {\n   const body=await readJson(req);if(!body || typeof body!=='object' || typeof body.id!=='string' || typeof body.text!=='string' || body.text.length>1000)throw new Rejected('invalid_input');\n   const target=docs.get(body.id);authorizeWrite({method:req.method,origin:req.headers.origin,csrf:req.headers['x-csrf-token']},session(req),target);\n   target.text=body.text;json(res,200,{id:target.id,text:target.text});\n  } else if(req.method==='POST' && url.pathname==='/import') {\n   const body=await readJson(req);if(!body || typeof body!=='object')throw new Rejected('invalid_input');\n   const target=docs.get(body.id);authorizeWrite({method:req.method,origin:req.headers.origin,csrf:req.headers['x-csrf-token']},session(req),target);\n   const text=await fetchDocument(body.documentId,localTransport);target.text=text;json(res,200,{id:target.id,text});\n  } else json(res,404,{demo:true,help:['GET /safe-preview','GET /unsafe-preview','GET /demo-session?user=alice','POST /write','POST /import']});\n } catch(error) {json(res,error instanceof Rejected?403:500,{error:error instanceof Rejected?error.code:'internal'});}\n}).listen(4312,'127.0.0.1',()=>console.log('LOCAL SECURITY LAB ONLY: http://127.0.0.1:4312 ; no real auth or outbound fetch.'));",
          "filename": "server.mjs",
          "purpose": "完整本机适配，包括受控会话、safe/unsafe预览、写入与导入；没有外部抓取，localTransport只返回固定样本。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "看/write的顺序：先限制并解析JSON，验证id/text，再从docs找目标，然后authorizeWrite，最后才赋target.text。导入同样先确认目标权限，再取允许的文档；不能先抓网络、写入内容以后才检查owner。输入校验、身份、对象授权和出站政策在不同位置形成闭环。"
        },
        {
          "type": "paragraph",
          "text": "localTransport是刻意保留的替换接口：它检查跳转策略后返回一个本地异步流，地址使用保留域名example.invalid，不会真的访问。这样可以稳定测试状态、大小和关闭行为，不把教学程序变成通用代理。正式换成fetch时，还要在真实网络环境验收连接预算与出口配置。"
        },
        {
          "type": "paragraph",
          "text": "教学HTTP将校验失败统一返回403，便于在一次实验里看拒绝；生产接口应依语义区分输入错误、未登录、无权、资源不可见和体积上限等状态。会话Map不持久化，最多1000记录；没有真正用户登录、会话到期回收或数据库事务。这些限制在运行说明中明确记录。"
        }
      ]
    },
    {
      "id": "s14-394976",
      "title": "从正常操作开始，再逐条改变输入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/web-security-boundaries\nnode --version\nnpm ci\nnpm test\nnpm start\n# 另开终端，同一目录运行：\nnpm run smoke",
          "filename": "终端",
          "purpose": "Node22.12.0实跑，只有本机4312；不要对第三方系统运行实验。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "smoke先获取Alice教学会话与csrf，再以同源Origin写a，实际得到200；同样凭据改写b得到403；只把Origin换成外站字符串也得到403。safe-preview返回编码后的img样本和CSP。它验证真实HTTP适配，不以函数mock代替所有链路。"
        },
        {
          "type": "paragraph",
          "text": "11项自动测试实际通过：HTML敏感字符编码、本人正常写、无会话、Origin/token/方法分别拒绝、他人/不存在资源、任意URL形式拒绝、固定URL与跳转参数、拒绝目标不调用transport、302响应拒绝、超大流触发清理。另有HTTP smoke成功运行。测试不证明生产站点整体安全，也没有浏览器扫描或外部攻击。"
        },
        {
          "type": "paragraph",
          "text": "浏览器可分别打开本机/safe-preview和/unsafe-preview。unsafe默认样本可能使document.body.dataset.demo变成executed，safe应显示字面标签且没有该标记。自动测试只核对编码与HTTP响应，没有自动驱动浏览器事件；若要记录真实执行差异，需要把浏览器版本和观察另列，不把字符串断言写成事件执行证据。"
        }
      ]
    },
    {
      "id": "reader-check",
      "title": "把防线和问题一一对应",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "检查问题",
            "解析"
          ],
          "rows": [
            [
              "Alice携带正确CSRF token能不能写Bob文档？",
              "不能。CSRF检查的是请求上下文，对象owner仍然必须匹配当前用户。"
            ],
            [
              "CSP阻止事件执行，是否说明HTML拼接已修好？",
              "不能。CSP是补充限制；safe路径仍需把数据按文本编码，避免解释成元素。"
            ],
            [
              "documentId合法是否能跳过资源授权？",
              "不能。出站目标允许，不等于用户能把内容写入指定知识库。"
            ],
            [
              "拒绝localhost字符串能不能作为通用SSRF修复？",
              "不能。地址解析、重定向、DNS与出口还有独立边界；本例选择固定目录，不承诺通用抓取。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "一个合理的排查顺序是：发生了什么具有权限的动作，输入从哪里来，在哪一层被解释或被信任，哪条检查本来应该拒绝。XSS看输出解释，CSRF看浏览器自动身份与意图，越权看对象关系，SSRF看服务器出站能力。把问题落在具体边界上，比增加一个叫securityFilter的通用函数更容易验证，也更容易审查。"
        }
      ]
    }
  ],
  "questionIds": [
    "web-security-boundaries-csrf",
    "web-security-boundaries-ssrf"
  ],
  "references": [
    {
      "title": "OWASP XSS Prevention",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"
    },
    {
      "title": "OWASP CSRF Prevention",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"
    },
    {
      "title": "OWASP Authorization",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html"
    },
    {
      "title": "OWASP SSRF Prevention",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
    }
  ],
  "status": "review",
  "kind": "tutorial",
  "labMinutes": 25,
  "versions": [
    "Node.js 22.12.0",
    "标准HTTP、Cookie、Origin与HTML文本上下文",
    "仅标准库，无第三方依赖"
  ],
  "verifiedAt": "2026-10-23",
  "examples": [
    {
      "label": "受控安全实验与测试",
      "path": "web-security-boundaries.zip"
    },
    {
      "label": "运行及安全边界说明",
      "path": "web-security-boundaries/README.md"
    }
  ]
};
export default article;
