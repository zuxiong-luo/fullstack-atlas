import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "browser-security-policies",
  "topic": "identity",
  "title": "浏览器安全策略：同源、CORS、CSP 与 Cookie 属性",
  "description": "先区分源、站点与凭据，再用两个loopback源复现响应读取、预检、nonce脚本与HttpOnly边界，说明浏览器执法和服务端授权分别保证什么。",
  "scope": "先区分源、站点与凭据，再用两个loopback源复现响应读取、预检、nonce脚本与HttpOnly边界，说明浏览器执法和服务端授权分别保证什么。 配套数据均为本机虚构数据，不修改本站鉴权，也不处理真实用户凭据。",
  "minutes": 58,
  "tags": [
    "同源策略",
    "CORS",
    "CSP",
    "Cookie",
    "HttpOnly"
  ],
  "prerequisites": [
    "理解HTTP请求/响应、Cookie与基本JavaScript",
    "阅读过会话文章；授权篇另外需要基础SQL与事务概念"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Node.js 22.12.0",
    "WHATWG Fetch/HTML：2026-10-24核验",
    "CSP3 2026-09-16工作草案"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 35,
  "questionIds": [],
  "examples": [
    {
      "label": "下载完整源码ZIP",
      "path": "browser-security-policies.zip"
    },
    {
      "label": "运行、验证与限制",
      "path": "browser-security-policies/README.md"
    }
  ],
  "references": [
    {
      "title": "WHATWG HTML：源与站点",
      "url": "https://html.spec.whatwg.org/multipage/browsers.html#same-origin"
    },
    {
      "title": "WHATWG Fetch：CORS协议",
      "url": "https://fetch.spec.whatwg.org/#http-cors-protocol"
    },
    {
      "title": "W3C CSP3：2026-09-16工作草案",
      "url": "https://www.w3.org/TR/2026/WD-CSP3-20260916/"
    },
    {
      "title": "MDN：Set-Cookie属性",
      "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie"
    },
    {
      "title": "MDN：Referrer-Policy",
      "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy"
    }
  ],
  "sections": [
    {
      "id": "origins",
      "title": "同源策略的对象：谁能接触哪个源的数据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "浏览器同源策略是一组隔离规则，用来限制一个源的脚本接触另一个源的数据与文档。常规HTTP源由协议、主机和端口决定：协议或端口不同，即使主机相同也跨源。它不是“浏览器不能向其他网站发请求”的总开关；导航、表单和一些资源加载本来就能跨源，响应能否被脚本读取、页面能否访问对方DOM，还要分别判断。"
        },
        {
          "type": "paragraph",
          "text": "站点和源也不同。Cookie的SameSite关心站点关系，通常结合协议与可注册域名，不按端口拆分；IP主机有对应的主机比较规则。本文用127.0.0.1的两个HTTP端口：API4351、UI4352。它们跨源，但同站；Cookie又不按端口隔离。这个设置能隔离CORS问题，却不能假装已经测过真正跨站Cookie或第三方Cookie限制。"
        },
        {
          "type": "paragraph",
          "text": "本文交付两个只绑定loopback的Node服务，数据全部虚构。上游有公开响应、教学Cookie、受保护JSON写入，以及一个刻意缺少保护的内存计数器；前端页面依次发请求，把可读取状态和服务器计数放在一起。CSP还有独立探针页。这样我们能区分“请求没发送”“服务器拒绝”“服务器已处理但浏览器不让脚本读”。"
        }
      ]
    },
    {
      "id": "cors",
      "title": "CORS给的是读取许可，不是任何调用者的通行证",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "CORS是服务端通过响应头向浏览器表达跨源共享许可的协议。收到跨源响应后，浏览器检查Access-Control-Allow-Origin等字段；不符合条件时，网页脚本拿不到可读响应。Node客户端或curl不因此自动服从浏览器的读取限制。所以服务端保护私有数据仍须校验会话或令牌，不能只看响应里有没有写CORS头。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/browser-security-policies/server.mjs",
          "purpose": "精确允许UI源并声明Vary，凭据模式显式启用；同时给出nonce CSP、nosniff和Referrer策略。json帮助函数只负责序列化。",
          "kind": "excerpt",
          "code": "export function corsHeaders(origin,allowedOrigin,credentials=false){\n  const headers={'vary':'Origin'};\n  if(origin===allowedOrigin){headers['access-control-allow-origin']=allowedOrigin;if(credentials)headers['access-control-allow-credentials']='true';}\n  return headers;\n}\nexport function securityHeaders(nonce,apiOrigin){return {\n  'content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; connect-src ${apiOrigin}; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'`,\n  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','cache-control':'no-store',\n};}\nfunction json(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(value));}"
        },
        {
          "type": "paragraph",
          "text": "代码只在Origin与预先配置的UI源完全相等时写允许源，不把任意Origin原样反射。Vary: Origin提醒缓存，这份共享许可随请求源变化；如果前面还有共享缓存，缓存键与其他Vary维度也必须一起检查。本例响应统一no-store，仍保留Vary解释协议，不据此宣称配置已经适用于所有CDN。"
        },
        {
          "type": "paragraph",
          "text": "读取许可、凭据发送是两件事。跨源fetch默认credentials为same-origin，因此即使同站Cookie已经存在，默认也不附带给不同端口的API；显式include才请求携带符合Cookie规则的凭据。凭据响应要求精确允许源与Allow-Credentials:true，不能把Allow-Origin:*当作可用组合。我们的/wildcard只返回公开标记，用来安全演示这条失败路径。"
        }
      ]
    },
    {
      "id": "preflight",
      "title": "预检在实际请求之前，但预检成功不表示业务被授权",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "浏览器根据请求方法、头部和Content-Type等条件决定是否预检。应用JSON和自定义X-Lab头的POST会先发OPTIONS，询问目标源是否允许这个方法和这些头。预检通常不携带跨源请求本身的用户凭据，服务端不能要求它先通过同一Cookie认证；但实际写入到达时，仍必须重新做身份与权限判断。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/browser-security-policies/server.mjs",
          "purpose": "完整预检分支：路径、源、方法、请求头都在允许范围内才204；json-denied专门演示预检拒绝，计数与实际POST分开。",
          "kind": "excerpt",
          "code": "    if(req.method==='OPTIONS'){\n      if(path==='/json-denied'){metrics.deniedPreflights++;json(res,403,{error:'PREFLIGHT_DENIED'});return;}\n      const headers=(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);\n      if(path!=='/json-write'||origin!==uiOrigin||req.headers['access-control-request-method']!=='POST'||headers.some(h=>!['content-type','x-lab'].includes(h))){json(res,403,{error:'PREFLIGHT_DENIED'});return;}\n      res.writeHead(204,{...cors,'access-control-allow-methods':'POST','access-control-allow-headers':'Content-Type, X-Lab','vary':'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'});res.end();return;\n    }"
        },
        {
          "type": "paragraph",
          "text": "教学服务器只允许/json-write的POST以及Content-Type、X-Lab两个头。返回的允许方法和头说明协议范围，不是让代码信任X-Lab的内容，也不是对资源所有权的授权。Node测试不带Cookie取得204，再直接发送同一个实际POST得到401，明确证明预检许可与登录态是不同判断。"
        },
        {
          "type": "paragraph",
          "text": "如果预检拒绝，符合标准的浏览器不会继续发起这次对应的实际请求。若请求本来不需要预检，它可能已经到服务器了，只是响应最后不能被脚本读。失败时看到的TypeError无法单独告诉你在哪一层失败；应对照Network里的OPTIONS与实际请求，以及服务端的独立计数。"
        }
      ]
    },
    {
      "id": "simple-write",
      "title": "为什么“没有配置CORS”不能防止所有跨源写入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "示例/simple-write接受一个普通表单类型POST，增加无业务意义的内存计数，再返回不带CORS的响应。前端跨源fetch会遇到读取失败，但下一次通过正常允许接口查询metrics，simpleWrites已经加一。我们刻意让这个端点无认证且只改教学计数，用来展示浏览器读取限制不具有事务回滚能力；它不能照搬到真实扣费、改邮箱等接口。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/browser-security-policies/server.mjs",
          "purpose": "对照失败与修复边界：simple-write无保护；json-write在真实请求阶段检查Origin、会话、自定义头和有界JSON后才产生效果。",
          "kind": "excerpt",
          "code": "    // Deliberately unauthenticated, harmless in-memory counter: CORS cannot protect a write.\n    if(req.method==='POST'&&path==='/simple-write'){metrics.simpleWrites++;json(res,200,{applied:true});return;}\n    if(req.method==='POST'&&path==='/json-denied'){metrics.deniedPosts++;json(res,200,{applied:true});return;}\n    if(req.method==='POST'&&path==='/json-write'){\n      if(origin!==uiOrigin)throw new HttpError(403,'ORIGIN_REQUIRED');authenticated(req);\n      if(req.headers['x-lab']!=='yes')throw new HttpError(403,'LAB_HEADER_REQUIRED');\n      const body=await input(req,onBodyChunk);if(Object.keys(body).join(',')!=='message'||typeof body.message!=='string'||body.message.length>64)throw new HttpError(422,'BAD_INPUT');\n      metrics.jsonWrites++;json(res,200,{applied:true},cors);return;\n    }"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/browser-security-policies/server.mjs",
          "purpose": "完整有界JSON接收：原始字节按Buffer累计，结束后一次严格UTF-8解码，避免多字节字符跨网络分片被替换。",
          "kind": "excerpt",
          "code": "async function input(req,onBodyChunk){\n  if(!/^application\\/json(?:\\s*;|$)/i.test(req.headers['content-type']??''))throw new HttpError(415,'JSON_REQUIRED');\n  let bytes=0;const chunks=[];\n  const timer=setTimeout(()=>req.destroy(new Error('body timeout')),1500);\n  try{for await(const chunk of req){bytes+=chunk.length;if(bytes>1024)throw new HttpError(413,'BODY_LIMIT');chunks.push(Buffer.from(chunk));onBodyChunk?.(chunk.length);}}\n  finally{clearTimeout(timer);}\n  try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}\n  catch{throw new HttpError(400,'BAD_JSON');}\n}"
        },
        {
          "type": "paragraph",
          "text": "字节上限与字符解码还要分开。网络分块可能切在一个汉字的UTF-8字节中间，不能对每块Buffer直接转字符串再拼；那会把合法字符变成替代符。这里先有界收集Buffer，结束后统一用fatal模式解码，无效UTF-8明确400。回归测试等待服务端确已收到第一片，再发送后续字节，验证合法64字符消息成功，不靠固定休眠猜分片。"
        },
        {
          "type": "paragraph",
          "text": "受保护的写入要按实际认证方式处理CSRF。本文的受保护演示同时限定精确Origin、JSON类型与自定义头，并检查Cookie；它不是一套通用CSRF框架。Origin在浏览器中受控制，但非浏览器客户端可以自行构造该头，所以它只能作为浏览器攻击路径的一道检查，不能替代用户认证与对象授权。"
        },
        {
          "type": "paragraph",
          "text": "把所有写入改为JSON能减少传统表单直接构造路径，但不应据此忽略同源脚本被攻陷、代理改写或宽松CORS。原有会话文章给出了随机CSRF令牌与轮换，安全边界文章还讨论XSS与对象授权；这里重点是把发送、读取和服务端生效分开，不把其中一种机制包装成全套安全。"
        }
      ]
    },
    {
      "id": "cookies",
      "title": "Cookie属性分别限制脚本、传输和站点关系",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "HttpOnly让匹配Cookie不通过document.cookie暴露给脚本，但浏览器仍可能把它随请求发送。因此XSS即使读不到会话串，也可能以当前用户身份发起同源操作。Secure约束Cookie在安全传输场景发送；SameSite限制跨站上下文中的携带条件；Path主要用于匹配请求路径，不是不同应用之间可靠的保密隔离。"
        },
        {
          "type": "paragraph",
          "text": "本实验通过API/session设置sid为HttpOnly、SameSite=Lax、Path=/，另设display=visible作对照。UI和API主机相同、端口不同，UI的document.cookie应能看到display，却不应该看到sid。使用include请求/private仍能认证成功。实验只验证这一组同站条件，不能把它表述成Lax允许所有跨站fetch，更不能声称已经验证HTTPS的Secure属性。"
        },
        {
          "type": "table",
          "headers": [
            "属性/规则",
            "主要回答",
            "不能代替"
          ],
          "rows": [
            [
              "HttpOnly",
              "网页脚本能否读取Cookie值",
              "XSS预防、请求授权"
            ],
            [
              "Secure",
              "是否限制安全传输场景",
              "证书校验与服务端权限"
            ],
            [
              "SameSite",
              "跨站上下文是否允许携带",
              "跨源读取许可、完整CSRF防御"
            ],
            [
              "credentials",
              "这次fetch请求是否请求附带凭据",
              "Cookie本身的域/路径/站点限制"
            ],
            [
              "CORS",
              "网页脚本能否读取跨源响应",
              "请求身份、资源所有权"
            ]
          ],
          "caption": "策略分层，不把多个开关合并成一个“安全模式”。"
        },
        {
          "type": "paragraph",
          "text": "生产会话通常应结合HTTPS配置Secure，并优先缩小Cookie作用范围；__Host-前缀还有Secure、Path=/及无Domain等要求。本文HTTP夹具故意不用这种前缀，避免交付一个不符合要求却看似更安全的名称。第三方Cookie阻止策略、浏览器版本差异与隐私配置也会影响实际携带，必须在目标浏览器独立验收。"
        }
      ]
    },
    {
      "id": "csp",
      "title": "CSP约束页面执行与连接，nonce必须每次响应新建",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Content-Security-Policy是页面给浏览器的资源与执行限制。本文默认拒绝所有来源，再仅允许带当前响应nonce的脚本；connect-src允许连接教学API，base-uri禁止改基地址，object-src禁用对象资源，frame-ancestors禁止本页被嵌入。不同指令覆盖不同入口，default-src不会替所有指令提供默认值，因此不能只放一个default-src就以为框架嵌入也已处理。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/browser-security-policies/server.mjs",
          "purpose": "UI与CSP探针实际实现：每个HTML响应独立随机nonce；授权脚本记录执行和策略事件，随后无nonce脚本尝试改标记，预期被阻止。",
          "kind": "excerpt",
          "code": "  const ui=createServer((req,res)=>{\n    const nonce=randomBytes(18).toString('base64'),headers=securityHeaders(nonce,apiOrigin);\n    if(req.url==='/browser.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(client);return;}\n    res.writeHead(200,{'content-type':'text/html; charset=utf-8',...headers});\n    if(req.url==='/csp'){\n      res.end(`<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>CSP执行探针</title><h1>有nonce的脚本执行，无nonce的脚本被拒绝</h1><pre id=\"output\"></pre><script nonce=\"${nonce}\">window.probe={allowed:true,blockedRan:false,violations:[]};function show(){document.getElementById('output').textContent=JSON.stringify(window.probe,null,2)}document.addEventListener('securitypolicyviolation',e=>{window.probe.violations.push({directive:e.effectiveDirective,blockedURI:e.blockedURI});show()});document.addEventListener('DOMContentLoaded',show);</script><script>window.probe.blockedRan=true;</script>`);return;\n    }\n    res.end(`<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>浏览器策略实验</title><body data-api=\"${apiOrigin}\"><h1>两个不同端口：跨源，但仍是同站</h1><p>只操作本机虚构数据。此HTTP夹具不验证Secure、TLS或跨站SameSite。</p><button id=\"run\">依次执行浏览器策略探针</button><a href=\"/csp\">查看CSP脚本探针</a><pre id=\"output\"></pre><script nonce=\"${nonce}\" src=\"/browser.js\"></script>`);\n  });"
        },
        {
          "type": "paragraph",
          "text": "nonce由randomBytes每个HTML响应生成，再同时进入响应头和受信脚本标签。不要把nonce放成全站永久常量，也不要给用户可注入的任意脚本统一补nonce；攻击者若能让恶意脚本带上有效nonce，限制就失去意义。受信脚本仍需安全处理数据，本例用textContent写观察结果，避免顺手把输入送进innerHTML。"
        },
        {
          "type": "paragraph",
          "text": "探针页的授权脚本先设allowed=true、blockedRan=false，并监听securitypolicyviolation；后面无nonce脚本试图把blockedRan改true。符合策略的浏览器应保留false并报告script-src-elem/inline。只检查头字符串不能证明脚本真的被挡住，故这部分必须打开页面实际看结果。Report-Only适合观测兼容性，不会按相同方式阻断；本例使用的是强制执行头。"
        }
      ]
    },
    {
      "id": "browser-run",
      "title": "一次完整浏览器检查，把协议现象与服务端证据合起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/browser-security-policies/browser.js",
          "purpose": "完整浏览器探针，直接发真实跨源fetch，不用Node模拟CORS执法。每项输出读取结果，简单写入另对照服务器delta。",
          "kind": "excerpt",
          "code": "const api=document.body.dataset.api,output=document.getElementById('output'),button=document.getElementById('run');\nbutton.addEventListener('click',async()=>{\n  button.disabled=true;const results=[];\n  const record=(name,result)=>{results.push({name,...result});output.textContent=JSON.stringify(results,null,2);};\n  async function probe(name,path,options={}){\n    try{const response=await fetch(api+path,options),body=await response.json();record(name,{readable:true,status:response.status,body});return body;}\n    catch(error){record(name,{readable:false,error:error.name});return null;}\n  }\n  try{\n    await probe('无CORS响应不能被脚本读取','/no-cors');\n    await probe('不带凭据的星号公共响应可以读取','/wildcard');\n    await probe('credentials include与星号不兼容','/wildcard',{credentials:'include'});\n    await probe('建立仅供本机实验的HttpOnly Cookie','/session',{credentials:'include'});\n    record('Cookie按host不按端口隔离；HttpOnly对脚本不可见',{documentCookie:document.cookie,httpOnlyHidden:!document.cookie.split(';').some(s=>s.trim().startsWith('sid=')),visibleCookie:document.cookie.includes('display=visible')});\n    await probe('跨源fetch默认不附带同站Cookie','/private');\n    await probe('显式include后服务端认证通过','/private',{credentials:'include'});\n    const before=await fetch(api+'/metrics').then(r=>r.json());\n    await probe('简单POST可发送但响应被CORS挡住','/simple-write',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'example=1'});\n    const after=await fetch(api+'/metrics').then(r=>r.json());record('服务端效果不会被读取限制回滚',{simpleWriteDelta:after.simpleWrites-before.simpleWrites});\n    await probe('预检拒绝后实际JSON POST不应发送','/json-denied',{method:'POST',headers:{'Content-Type':'application/json','X-Lab':'yes'},body:JSON.stringify({message:'test'})});\n    await probe('允许预检与凭据后，实际写入仍独立检查身份','/json-write',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Lab':'yes'},body:JSON.stringify({message:'test'})});\n    await probe('最终服务端计数','/metrics');\n  }finally{button.disabled=false;}\n});"
        },
        {
          "type": "figure",
          "src": "figures/browser-security-policies/mechanism.svg",
          "title": "浏览器读取许可与服务端生效是两条路径",
          "alt": "简单POST可先到达API并增加计数，再因缺少CORS而无法读取响应；JSON写入先预检，实际请求仍检查会话；nonce CSP独立限制页面脚本",
          "caption": "简单POST可先到达API并增加计数，再因缺少CORS而无法读取响应；JSON写入先预检，实际请求仍检查会话；nonce CSP独立限制页面脚本；只描述本夹具职责，不把客户端限制替代服务端授权。"
        },
        {
          "type": "paragraph",
          "text": "页面探针依次检查无CORS、公开星号响应、凭据与星号冲突、Cookie可见性、默认与include认证、简单POST生效、预检拒绝以及受保护写入。成功探针的最终metrics中deniedPreflights增加、deniedPosts保持0，jsonWrites增加一；简单写入delta应为1。重复执行前会取得新教学sid，计数不会自动归零，应看增量而不是要求总数永远为1。"
        },
        {
          "type": "paragraph",
          "text": "CSP探针在另一个页面，不能只看控制台有红色日志就算正确：应确认allowed为true、blockedRan为false，事件记录的指令与被拒绝资源对应。若授权脚本都没运行，先看nonce头与标签是否一致；若跨源请求根本没到API，先检查本地服务端口、connect-src、预检与浏览器网络错误，再讨论Cookie。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "运行、真实验证范围与排查顺序",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "filename": "终端 · 本地复现",
          "purpose": "下载ZIP解压后，在Node22.12环境运行；测试应10项通过。浏览器执法另需打开本地UI。",
          "kind": "runnable",
          "code": "cd browser-security-policies\nnpm ci --ignore-scripts\nnpm test\n# tests 10; pass 10; fail 0\nnpm start\n# UI http://127.0.0.1:4352 ; API http://127.0.0.1:4351"
        },
        {
          "type": "paragraph",
          "text": "Node22.12.0下已实际通过10项测试，包含真实双源HTTP、精确Origin、无凭据预检与实际401、无CORS直接客户端读取、简单写入、实际写入检查、大小限制与随机nonce头。这些测试故意没有把Node当作浏览器：Node能读到没有CORS的响应，正好说明需要浏览器来验另一层。主代理另外在真实Chromium中点击探针，确认无CORS与凭据星号读取失败、HttpOnly值不可见、默认401而include200、简单写入delta1，以及预检拒绝后deniedPosts为0；CSP页确认授权脚本执行、无nonce脚本未执行并出现script-src-elem事件。可能还出现浏览器或工具样式注入触发的额外策略事件，不能要求事件总数恰好为1。该观察范围与版本记录另存验证文件，正文仍待独立审校。"
        },
        {
          "type": "paragraph",
          "text": "这个夹具只监听127.0.0.1，不改浏览器安全设置或系统信任库。它需要本地Node进程，不能把启动服务代码塞进GitHub Pages后声称在线运行同等协议实验；离线包能保存正文、图和下载源码，不能在断网的纯静态页面凭空提供两个HTTP后端。停止main后关闭自己服务，测试夹具则自动释放随机端口。"
        },
        {
          "type": "paragraph",
          "text": "最后把判断顺序固定下来：先确认谁发起、属于哪个源和站点；再确认浏览器是否发送、携带哪些凭据；随后看服务端认证授权与效果；最后判断响应读取和页面脚本是否被策略允许。只有这些层次分开，才不会把“控制台提示CORS”误解成后端从未收到请求，或把“请求200”误解成网页已经能安全读取。"
        },
        {
          "type": "reference",
          "title": "WHATWG HTML：源与站点",
          "url": "https://html.spec.whatwg.org/multipage/browsers.html#same-origin",
          "note": ""
        },
        {
          "type": "reference",
          "title": "WHATWG Fetch：CORS协议",
          "url": "https://fetch.spec.whatwg.org/#http-cors-protocol",
          "note": ""
        },
        {
          "type": "reference",
          "title": "W3C CSP3：2026-09-16工作草案",
          "url": "https://www.w3.org/TR/2026/WD-CSP3-20260916/",
          "note": ""
        },
        {
          "type": "reference",
          "title": "MDN：Set-Cookie属性",
          "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie",
          "note": ""
        },
        {
          "type": "reference",
          "title": "MDN：Referrer-Policy",
          "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy",
          "note": ""
        }
      ]
    }
  ]
};
export default article;
