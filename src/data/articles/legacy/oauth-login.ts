import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "oauth-login",
  "topic": "identity",
  "title": "OAuth 授权码与 PKCE：从浏览器事务到本站会话",
  "description": "先分清授权、认证和会话，再用无密钥的本地issuer/client模拟，完整推演state、S256 PKCE、精确回调、一次性code和会话轮换；明确OIDC验证边界。",
  "minutes": 48,
  "tags": [
    "OAuth 2.0",
    "OIDC",
    "PKCE",
    "HTTPS"
  ],
  "scope": "完整可运行承诺是本地授权码与PKCE状态机/HTTP教学模拟，不是生产OAuth或OIDC提供商。固定模拟subject、跳过真实登录和同意；不签发ID Token、不冒充已完成OIDC校验或真实第三方接入。",
  "prerequisites": [
    "HTTP重定向、URL参数与Cookie",
    "JavaScript模块、Map及async/await"
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
      "title": "先定义三件事：授权、认证与本站会话",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "OAuth是委托授权协议。它让一个应用在约定范围内访问受保护资源，回答“这个应用能做什么”；认证回答“这位用户是谁”；本站会话则记录“后续请求如何认出已经登录的用户”。用户点击第三方登录时，这三件事常常连在一起发生，但凭据、校验和退出规则各有职责。"
        },
        {
          "type": "paragraph",
          "text": "例如知识库网站想让你从资料提供商读取个人资料。浏览器把你带去提供商，同意后网站获得一个访问凭据，随后按提供商定义的资料接口获取信息。这条OAuth链可以存在，但一个access token本身不能被随意当成另一个系统的身份证。OIDC在OAuth之上定义认证层，后文单独说它需要哪些验证。"
        },
        {
          "type": "paragraph",
          "text": "本文先把授权码加PKCE走通。我们实现两个只监听本机的HTTP端点：4310是模拟issuer，4311是客户端。issuer预先把demo-user-1视为已认证并同意，profile也是教学私有契约。这样不需要账号或密钥就能验证交换与拒绝路径，同时不会把本地模拟说成真实用户认证。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "持有内容",
            "用途与接收者"
          ],
          "rows": [
            [
              "浏览器事务",
              "随机state；服务端保存对应verifier",
              "把本浏览器发起请求和回调关联起来"
            ],
            [
              "授权码code",
              "短期随机交换凭据",
              "只交给令牌端点兑换，不能直接当资料"
            ],
            [
              "access token",
              "本实验为服务端Map中的随机索引",
              "只交给受保护的profile资源端点"
            ],
            [
              "本站session ID",
              "Cookie中随机索引，服务端保留用户与token",
              "本站后续/me识别会话"
            ],
            [
              "ID Token",
              "本文不签发",
              "OIDC的认证声明，需要独立完整验证"
            ]
          ]
        }
      ]
    },
    {
      "id": "journey",
      "title": "把正常路径走完：一次请求经过谁",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/oauth-login/flow.svg",
          "title": "授权码与PKCE：跳转带回code，后端完成兑换",
          "alt": "浏览器通过客户端建立state与verifier事务，发往模拟issuer，issuer将code和state返回注册回调；客户端先校验state后以verifier兑换，读取模拟profile并轮换会话。",
          "caption": "模拟登录与同意被简化；图中的两个端口不是Cookie信任隔离，HTTPS与真实认证不由本机HTTP演示证明。"
        },
        {
          "type": "paragraph",
          "text": "从初始未登录开始：GET /login创建sid、state和verifier；sid写入HttpOnly Cookie，其余放在客户端服务端的事务记录。浏览器被重定向到/authorize，只携带challenge，不携带verifier。issuer检查client和注册回调，保存code对应的challenge与有效期，再把浏览器送回/callback?code=...&state=...。"
        },
        {
          "type": "paragraph",
          "text": "客户端回调先根据Cookie找事务，比较state和有效期，再消耗这个事务。通过后才从服务端向/token提交code、原verifier和同一个redirect_uri。issuer验证绑定关系并一次性消费code，返回access token；客户端用它请求固定profile端点，建立新会话并轮换sid。token始终留在服务端Map，不放在回调URL或返回JSON里。"
        },
        {
          "type": "paragraph",
          "text": "用户以后访问/me携带的是本站session ID，已经不是重新跑OAuth。旧授权码不会在每个页面请求上使用。这个区分解释了为什么“清除本站Cookie”和“撤销提供商token”是两件操作：本文logout删除本站记录，但没有提供商撤销端点，不声称外部token随之失效。"
        }
      ]
    },
    {
      "id": "proof",
      "title": "PKCE、state 与 nonce：先建立各自的绑定关系",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "PKCE把授权请求中的challenge与兑换时的verifier绑定。客户端先产生高熵verifier，用SHA-256计算并按Base64URL编码为challenge；issuer保存challenge，收到verifier后重新算一次。只有code没有verifier的人，在本实验中不能换到token。我们固定S256，不提供降级成plain的分支。"
        },
        {
          "type": "code",
          "code": "import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';\nexport const CLIENT_ID = 'atlas-local-client';\nexport const REDIRECT_URI = 'http://127.0.0.1:4311/callback';\nexport function random() { return randomBytes(32).toString('base64url'); }\nexport function challenge(verifier) {\n  return createHash('sha256').update(verifier, 'ascii').digest('base64url');\n}\nexport class ProtocolError extends Error {\n  constructor(code) { super(code); this.code = code; }\n}\nfunction requireValue(condition, code) {\n  if (!condition) throw new ProtocolError(code);\n}\nfunction equal(a, b) {\n  return typeof a === 'string' && typeof b === 'string' &&\n    Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));\n}",
          "filename": "protocol.mjs · 参数与比较",
          "purpose": "完整公共参数、随机值、SHA256 challenge与安全比较。与后面的Issuer、Client按顺序合并就是完整protocol.mjs。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "randomBytes(32)生成32字节随机值，Base64URL后是43字符。challenge采用ascii输入，与RFC定义的verifier字符范围一致。equal先比较UTF-8字节长度，再调用timingSafeEqual，避免Unicode恶意state触发缓冲区长度异常。测试也用RFC7636公开向量核对challenge，不仅比较“自己算与自己算相等”。"
        },
        {
          "type": "paragraph",
          "text": "state绑定浏览器事务和回调。攻击者拿另一次授权返回的code拼到你的回调时，若state与本浏览器保存事务不一致，客户端应在兑换之前拒绝。PKCE则主要约束code的兑换者；两项在此实现都保留。它们的防护前提仍包括verifier保密、事务来源可信和回调正确注册。"
        },
        {
          "type": "paragraph",
          "text": "nonce属于OIDC认证请求与返回身份声明的关联机制。本文没有ID Token，所以没有假装填一个nonce就完成认证验证。真实OIDC需要生成、保存并按流程验证nonce；它既不替代签名验证，也不应被state的成功比较所替代。"
        },
        {
          "type": "reference",
          "title": "参数出处：RFC7636 §4与附录B（S256与测试向量）",
          "url": "https://www.rfc-editor.org/rfc/rfc7636.html#section-4"
        }
      ]
    },
    {
      "id": "issuer-code",
      "title": "issuer 怎样拒绝错误交换：代码与具体分支",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export class Issuer {\n  constructor(now = Date.now) { this.now = now; this.codes = new Map(); this.tokens = new Map(); }\n  authorize(params) {\n    requireValue(params.client_id === CLIENT_ID, 'invalid_client');\n    requireValue(params.redirect_uri === REDIRECT_URI, 'invalid_redirect_uri');\n    requireValue(params.response_type === 'code', 'unsupported_response_type');\n    requireValue(params.code_challenge_method === 'S256', 'invalid_challenge_method');\n    requireValue(/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge ?? ''), 'invalid_challenge');\n    requireValue(typeof params.state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(params.state), 'invalid_state');\n    requireValue(this.codes.size < 1000, 'issuer_capacity');\n    const code = random();\n    this.codes.set(code, {clientId: CLIENT_ID, redirect: REDIRECT_URI,\n      challenge: params.code_challenge, subject: 'demo-user-1', expires: this.now() + 60_000});\n    const callback = new URL(REDIRECT_URI);\n    callback.searchParams.set('code', code); callback.searchParams.set('state', params.state);\n    return callback.href;\n  }\n  exchange(params) {\n    requireValue(params.grant_type === 'authorization_code', 'unsupported_grant_type');\n    const item = this.codes.get(params.code);\n    requireValue(item && item.expires > this.now(), 'invalid_grant');\n    requireValue(params.client_id === item.clientId && params.redirect_uri === item.redirect, 'invalid_grant');\n    requireValue(typeof params.code_verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(params.code_verifier), 'invalid_verifier');\n    requireValue(equal(challenge(params.code_verifier), item.challenge), 'invalid_grant');\n    requireValue(this.tokens.size < 1000, 'issuer_capacity');\n    this.codes.delete(params.code); // A successful exchange consumes the code once.\n    const token = random();\n    this.tokens.set(token, {subject: item.subject, expires: this.now() + 300_000});\n    return {access_token: token, token_type: 'Bearer', expires_in: 300};\n  }\n  profile(token) {\n    const item = this.tokens.get(token);\n    requireValue(item && item.expires > this.now(), 'invalid_token');\n    return {sub: item.subject, name: 'Local Demo User'};\n  }\n}",
          "filename": "protocol.mjs · Issuer",
          "purpose": "完整教学授权服务器状态机。authorize省略真实用户登录/同意，固定subject；兑换校验、期限与一次性消费全部保留。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入客户端发来的正确参数：client_id固定、redirect_uri与注册值逐字相等、response_type=code、方法S256，challenge和state符合本实验43字符约束，于是生成code并把challenge与subject存入Map。issuer返回的Location只根据固定REDIRECT_URI构造，不根据用户任意return_to重定向。这里43字符state是实验约束，不能误写成OAuth对所有state的统一长度要求。"
        },
        {
          "type": "paragraph",
          "text": "兑换时先查code是否存在且未过期，再对照client和redirect_uri。然后校验verifier长度/字符范围，计算challenge并比较。正确后先检查token记录容量，再删除code并生成token。因此第二次用同一个code一定查不到记录。错误verifier在本实验中不会消费code，合法客户端仍可尝试正确交换；生产实现还需要速率限制与失败策略。"
        },
        {
          "type": "paragraph",
          "text": "试着把callback改成/other：授权入口直接invalid_redirect_uri，不能把code发送到错误回调。若授权时正确、只在/token换redirect，仍会invalid_grant。两个入口都要检查，因为授权阶段和兑换阶段是两份独立请求。代码只识别一个预注册client，不支持动态注册或多issuer；内存上限1000条，到期不自动清理，适合短时教学、需要重启清空。"
        },
        {
          "type": "reference",
          "title": "安全依据：RFC9700，精确重定向、PKCE与授权码保护",
          "url": "https://www.rfc-editor.org/rfc/rfc9700.html"
        }
      ]
    },
    {
      "id": "session",
      "title": "客户端的关键边界：校验回调后再建立会话",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export class Client {\n  constructor(now = Date.now) { this.now = now; this.sessions = new Map(); }\n  begin() {\n    requireValue(this.sessions.size < 1000, 'client_capacity');\n    const sid = random(), verifier = random(), state = random();\n    this.sessions.set(sid, {transaction: {verifier, state, expires: this.now() + 120_000}});\n    return {sid, params: {client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,\n      response_type: 'code', state, code_challenge: challenge(verifier), code_challenge_method: 'S256'}};\n  }\n  async callback(sid, params, exchange, profile) {\n    const session = this.sessions.get(sid), tx = session?.transaction;\n    requireValue(tx && tx.expires > this.now(), 'missing_transaction');\n    requireValue(equal(params.state, tx.state), 'state_mismatch');\n    // Consume the browser transaction on a matching callback, including denial.\n    delete session.transaction;\n    if (params.error) throw new ProtocolError('authorization_denied');\n    requireValue(typeof params.code === 'string' && params.code.length === 43, 'missing_code');\n    const tokens = await exchange({grant_type: 'authorization_code', client_id: CLIENT_ID,\n      redirect_uri: REDIRECT_URI, code: params.code, code_verifier: tx.verifier});\n    requireValue(tokens?.token_type === 'Bearer' && typeof tokens.access_token === 'string', 'invalid_token_response');\n    const user = await profile(tokens.access_token);\n    requireValue(user && typeof user.sub === 'string' && user.sub.length > 0, 'invalid_profile');\n    const nextSid = random();\n    this.sessions.delete(sid); // Rotate session ID after establishing the local demo session.\n    this.sessions.set(nextSid, {user, accessToken: tokens.access_token, expires: this.now() + 300_000});\n    return {sid: nextSid, user};\n  }\n  me(sid) {\n    const session = this.sessions.get(sid);\n    return session?.user && session.expires > this.now() ? session.user : null;\n  }\n  logout(sid) { this.sessions.delete(sid); }\n}",
          "filename": "protocol.mjs · Client",
          "purpose": "完整客户端状态机，包含事务、拒绝回调、调用令牌/资源端点、会话轮换、有效期与退出。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入一条state正确的回调：sessions.get(sid)找到尚未过期的transaction；比较state通过后删除transaction，再处理error或code。消耗事务意味着同一浏览器交易只能完成一次。若提供商拒绝授权，返回authorization_denied，不能继续拿空code兑换。若state不匹配则根本不调用exchange，测试里用调用次数0验证这一点。"
        },
        {
          "type": "paragraph",
          "text": "这里把exchange与profile作为参数传入，是为了隔离协议规则与HTTP。测试可以用真正Issuer对象验证规则；实际server适配用固定本机地址发请求。客户端不能接受浏览器提交的任意token_endpoint或issuer URL，再把verifier送去那里。profile必须返回稳定sub，随后以新sid存会话并删除旧sid，降低会话固定风险。"
        },
        {
          "type": "paragraph",
          "text": "这一教学profile只对同一个模拟issuer有意义。真实系统映射外部身份时，应采用可信issuer与稳定subject组成的键；邮箱可变、可复用且可能未验证，不能只凭相同邮箱自动合并账号。本站记录是否允许某个角色或资源访问，还需要自己的授权逻辑。"
        }
      ]
    },
    {
      "id": "http-adapter",
      "title": "HTTP适配完整放在这里：谁能看到Cookie和token",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import http from 'node:http';\nimport {Issuer, Client, ProtocolError} from './protocol.mjs';\nconst issuer = new Issuer(), client = new Client();\nfunction respond(res, status, data, headers = {}) {\n  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers});\n  res.end(JSON.stringify(data));\n}\nfunction cookie(sid) { return `atlas_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=300`; }\nfunction session(req) { return /(?:^|;\\s*)atlas_sid=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1]; }\nasync function body(req) {\n  let value = '';\n  for await (const chunk of req) {\n    value += chunk;\n    if (Buffer.byteLength(value) > 8192) throw new ProtocolError('body_too_large');\n  }\n  return Object.fromEntries(new URLSearchParams(value));\n}\nasync function localCall(path, params) {\n  const res = await fetch(`http://127.0.0.1:4310${path}`, params);\n  const data = await res.json();\n  if (!res.ok) throw new ProtocolError(data.error ?? 'issuer_error');\n  return data;\n}\nconst issuerServer = http.createServer(async (req, res) => {\n  try {\n    const url = new URL(req.url, 'http://127.0.0.1:4310');\n    if (req.method === 'GET' && url.pathname === '/authorize') {\n      // Teaching shortcut: a fixed demo subject is already authenticated and consents.\n      res.writeHead(302, {Location: issuer.authorize(Object.fromEntries(url.searchParams)), 'Cache-Control': 'no-store'}); res.end();\n    } else if (req.method === 'POST' && url.pathname === '/token') {\n      respond(res, 200, issuer.exchange(await body(req)));\n    } else if (req.method === 'GET' && url.pathname === '/profile') {\n      respond(res, 200, issuer.profile(/^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]));\n    } else respond(res, 404, {error: 'not_found'});\n  } catch (error) { respond(res, 400, {error: error instanceof ProtocolError ? error.code : 'internal'}); }\n});\nconst clientServer = http.createServer(async (req, res) => {\n  try {\n    const url = new URL(req.url, 'http://127.0.0.1:4311');\n    if (req.method === 'GET' && url.pathname === '/login') {\n      const start = client.begin();\n      res.writeHead(302, {'Set-Cookie': cookie(start.sid), Location: `http://127.0.0.1:4310/authorize?${new URLSearchParams(start.params)}`, 'Cache-Control': 'no-store'}); res.end();\n    } else if (req.method === 'GET' && url.pathname === '/callback') {\n      const result = await client.callback(session(req), Object.fromEntries(url.searchParams),\n        params => localCall('/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(params), signal: AbortSignal.timeout(2000)}),\n        token => localCall('/profile', {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(2000)}));\n      respond(res, 200, {demo: true, user: result.user}, {'Set-Cookie': cookie(result.sid)});\n    } else if (req.method === 'GET' && url.pathname === '/me') {\n      const user = client.me(session(req)); respond(res, user ? 200 : 401, user ? {user} : {error: 'not_logged_in'});\n    } else if (req.method === 'POST' && url.pathname === '/logout') {\n      if (req.headers.origin !== 'http://127.0.0.1:4311') throw new ProtocolError('origin_mismatch');\n      client.logout(session(req)); respond(res, 200, {ok: true}, {'Set-Cookie': 'atlas_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});\n    } else respond(res, 404, {error: 'not_found', help: 'GET /login starts a LOCAL SIMULATION with a fixed user; no real authentication.'});\n  } catch (error) { respond(res, 400, {error: error instanceof ProtocolError ? error.code : 'upstream_or_internal'}); }\n});\nissuerServer.listen(4310, '127.0.0.1');\nclientServer.listen(4311, '127.0.0.1', () => console.log('LOCAL SIMULATION: http://127.0.0.1:4311/login ; Ctrl-C stops both.'));\nfunction close() { issuerServer.close(); clientServer.close(); }\nprocess.on('SIGTERM', close); process.on('SIGINT', close);",
          "filename": "server.mjs",
          "purpose": "完整本机HTTP适配。两个端点在同一进程、同一loopback主机，无真实账号；外部token仅留在服务端。",
          "language": "javascript",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "浏览器只看到302、Cookie、code与state；兑换请求由客户端后端调用localCall完成，带2秒AbortSignal预算，目标固定为4310。回调成功返回demo和user，不返回access_token。响应设no-store，避免把这类过程当可公开缓存内容。Cookie有HttpOnly和SameSite=Lax，以支持跨站顶层GET回调；真实HTTPS部署还必须设置Secure，这个本机HTTP例子没有设置。"
        },
        {
          "type": "paragraph",
          "text": "两个端口同属127.0.0.1，Cookie不会按端口隔离，因此issuer请求也可能携带该主机Cookie。本例两个服务都由同一个教学进程控制，不能用它证明不同站点隔离。真实提供商通常位于不同主机/站点，浏览器Cookie策略需要实际验证。HTTP smoke手工携带Cookie，只验证适配链和状态，不模拟浏览器SameSite行为。"
        },
        {
          "type": "paragraph",
          "text": "错误响应仅暴露分类，不记录原始code、token或Cookie。真实生产还需受信反向代理配置、TLS、请求限速、状态存储清理、日志关联和可靠会话存储；这些不由本实验的Map和HTTP回调替代。"
        }
      ]
    },
    {
      "id": "oidc-boundary",
      "title": "OIDC需要另外验证什么：不要把解码当信任",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "OIDC的ID Token是一份认证声明，不能因为JWT能解码、里面有sub，就宣布用户通过认证。真实客户端必须按受信issuer配置和相应流程校验签名/算法、issuer、audience、有效期以及发送过的nonce等；还要处理多audience时的azp规则、时钟容差、密钥轮换和流程相关声明。验证规则应由成熟实现承担，并结合提供商元数据核对。"
        },
        {
          "type": "table",
          "headers": [
            "输入",
            "只读取内容能得到什么",
            "建立信任还缺什么"
          ],
          "rows": [
            [
              "任意JWT文本",
              "header/payload中的自报值",
              "可信密钥、算法约束、签名与声明校验"
            ],
            [
              "正确签名但aud属于别的应用",
              "内容确为某个issuer签发",
              "目标受众不是本站，仍应拒绝"
            ],
            [
              "签名和aud正确但nonce不匹配",
              "令牌本身有来源",
              "与本次认证请求的关联失败"
            ],
            [
              "本例随机access token",
              "Map索引",
              "它不是ID Token，没有OIDC认证声明"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "本文故意不提供一个手写JWT验证器，也没有省略验证后声称已完成OIDC。读者可以完整运行OAuth交换模型，OIDC在这里是职责导读；接真实身份提供商时，应使用符合所选应用类型的库，并另外交付签名、issuer/audience/nonce错误用例。此处没有运行真实提供商登录。"
        },
        {
          "type": "reference",
          "title": "规范出处：OpenID Connect Core §3.1.3.7 ID Token Validation",
          "url": "https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation"
        }
      ]
    },
    {
      "id": "run",
      "title": "从运行到反例：把正常与拒绝结果都核对",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/oauth-login\nnode --version\nnpm ci\nnpm test\nnpm start\n# 另开终端，在同一目录：\nnpm run smoke",
          "filename": "终端",
          "purpose": "Node22.12.0实跑，无第三方依赖；固定4310/4311，端口占用需先停止自己的旧实验。",
          "language": "bash",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "浏览器打开http://127.0.0.1:4311/login，应完成本机跳转并看到demo:true和固定用户；再访问/me应看到同一用户。smoke记录：login302→authorize302→callback200→me200，旧回调重放400。它是本地HTTP结果，不是第三方互操作认证。"
        },
        {
          "type": "paragraph",
          "text": "10项纯协议测试实际通过：RFC7636向量、正常交换与会话轮换、错误state提前拒绝、缺失Cookie事务、错误回调和PKCE方法、verifier错误与code重用、code/事务过期、授权拒绝、缺code/错误token响应、Unicode恶意state。所有用例只调用自建模拟对象和端点。"
        },
        {
          "type": "table",
          "headers": [
            "你来判断",
            "解析"
          ],
          "rows": [
            [
              "拿到code为什么还不能调用profile？",
              "code是短期交换凭据，profile只接受issuer记录的access token。先兑换并校验绑定。"
            ],
            [
              "state正确是否等于ID Token可信？",
              "不等于。state关联浏览器事务；OIDC还需要独立签名和声明验证。"
            ],
            [
              "退出本站后，issuer token是否撤销？",
              "本例没有撤销接口；本站删除记录不代表所有凭据副本或提供商会话失效。"
            ]
          ]
        }
      ]
    },
    {
      "id": "tradeoffs",
      "title": "把实验结论带回真实系统",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "采用后端会话能让浏览器少接触外部token，但后端仍要保护Cookie使用的CSRF边界和凭据存储。纯浏览器公开客户端无法保密client secret，应按其应用类型选择授权码与PKCE等流程；服务端保密客户端还需按提供商规则进行客户端认证。本文固定无secret教学客户端，不省略后就宣称满足保密客户端部署。"
        },
        {
          "type": "paragraph",
          "text": "最后把信任链写成一句可检查的话：来自本浏览器的未过期事务，收到了state匹配的回调；预注册issuer确认code与verifier/redirect绑定；按该提供商契约读取稳定主体；本站再建立自己的有限期会话。每一个分号前后都有独立拒绝路径。真正接入时从这些边界补生产实现，而不是把一段成功跳转录像当安全验收。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "RFC7636 PKCE",
      "url": "https://www.rfc-editor.org/rfc/rfc7636.html"
    },
    {
      "title": "RFC9700 OAuth安全实践",
      "url": "https://www.rfc-editor.org/rfc/rfc9700.html"
    },
    {
      "title": "OpenID Connect Core",
      "url": "https://openid.net/specs/openid-connect-core-1_0.html"
    }
  ],
  "status": "review",
  "kind": "tutorial",
  "labMinutes": 25,
  "versions": [
    "OAuth 2.0 Authorization Code / RFC 7636 S256",
    "安全建议参考 RFC 9700",
    "Node.js 22.12.0，标准库，无第三方依赖"
  ],
  "verifiedAt": "2026-10-23",
  "examples": [
    {
      "label": "本地issuer/client完整项目",
      "path": "oauth-login.zip"
    },
    {
      "label": "运行说明与模拟边界",
      "path": "oauth-login/README.md"
    }
  ]
};
export default article;
