import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "sessions-lifecycle",
  "topic": "identity",
  "title": "登录态与会话：Cookie、Session、JWT，以及续期和退出",
  "description": "实现一套真实HTTPS会话：随机ID、双期限、轮换、CSRF与退出；再用完整JWT验MAC、声明和撤销对照两种状态成本。",
  "minutes": 43,
  "labMinutes": 40,
  "tags": [
    "Cookie",
    "Session",
    "JWT",
    "CSRF",
    "会话轮换",
    "撤销",
    "身份认证"
  ],
  "scope": "单进程教学账户与内存会话，真实loopback HTTPS；覆盖会话和JWT生命周期关键路径，不交付生产身份平台、分布式会话存储或JWT refresh-token服务。",
  "prerequisites": [
    "理解HTTP请求与响应",
    "能运行Node.js项目；不要求会写密码学算法"
  ],
  "questionIds": [],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0（内嵌OpenSSL 3.0.15+quic）",
    "OpenSSL命令行3.6.1",
    "macOS14.5 x86_64"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    { "label": "完整源码 ZIP", "path": "sessions-lifecycle.zip" },
    {
      "label": "完整loopback实验与验证说明",
      "path": "sessions-lifecycle/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "登录态是什么：把一次身份确认连接到后续请求",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "登录态是服务端在后续请求中识别访问者及其当前认证状态的机制。HTTP不会因为上一次请求验证过密码，就天然记得下一次请求属于谁。应用需要一个可验证的凭据，以及判断凭据是否仍有效的规则。前端显示“欢迎回来”，只是界面表现；服务端必须独立决定这个请求能否继续。"
        },
        {
          "type": "paragraph",
          "text": "Session通常指服务端维护的会话状态。Cookie是浏览器保存并按规则随请求附带的小段数据；它可以携带Session ID，也能携带其他内容。JWT则是一种声明令牌格式，可用JWS保护完整性，也可结合JWE加密。三者不在同一个层次，所以“用Cookie还是用JWT”并不是一个天然互斥的问题。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "回答的问题",
            "本例选择"
          ],
          "rows": [
            [
              "Cookie",
              "浏览器怎样保存和附带值",
              "只携带随机不透明ID"
            ],
            [
              "Session",
              "用户与期限、撤销状态放在哪里",
              "服务端Map，查到记录再信任"
            ],
            [
              "JWT",
              "怎样携带可验证的声明",
              "独立Bearer分支，固定HS256与声明规则"
            ],
            [
              "OAuth/OIDC",
              "跨系统授权与身份协议怎样进行",
              "本篇不实现，另有本站OAuth章节"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "我们做一个私人笔记服务：alice能读自己的1号笔记，不能读bob的2号笔记。先完成登录、续期、退出和权限判断，再比较JWT分支。教学密码明确写在项目中，仅用于loopback数据；没有复用本站口令，也没有接入真实账号。每个成功和失败都有实际请求验证。"
        }
      ]
    },
    {
      "id": "cookie",
      "title": "Cookie只是载体，属性分别约束什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "服务端通过Set-Cookie返回随机ID，浏览器后续按域、路径和安全策略决定是否附带。Session ID本身不包含用户名或权限；服务端拿到它后去查记录。拿到ID的攻击者可能重放，所以传输、脚本可见性和生命周期都需要约束。数据库里只存ID的摘要，可以减小会话存储只读泄漏时直接暴露可重放原值的风险，但不能替代访问控制。"
        },
        {
          "type": "code",
          "code": "__Host-atlas_sid=<随机值>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300",
          "language": "http",
          "filename": "Set-Cookie示意",
          "purpose": "只是说明头字段形状；实际代码按剩余绝对期限计算Max-Age，不把尖括号示意值当真实ID。",
          "kind": "pseudocode"
        },
        {
          "type": "paragraph",
          "text": "Secure要求浏览器在合适的安全连接上下文发送；HttpOnly限制脚本直接通过document.cookie读取；SameSite=Lax减少某些跨站附带场景。__Host-前缀要求支持该规则的浏览器检查Secure、Path=/且不带Domain，有助于收窄Cookie作用域。它们不是“设置后所有攻击消失”的总开关。"
        },
        {
          "type": "paragraph",
          "text": "例如同站点的不同子域仍可能是不同源，SameSite与同源不是一个概念。HttpOnly也无法阻止已在当前源执行的XSS脚本发起合法外观的请求。Max-Age控制浏览器保留多久，服务器仍要校验自己的到期状态；客户端修改本地时间或保留一份旧Cookie，不能让服务端记录重新有效。"
        },
        {
          "type": "reference",
          "title": "MDN：Set-Cookie属性及__Host-前缀",
          "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie"
        }
      ]
    },
    {
      "id": "state",
      "title": "会话记录：身份、两种期限和一个独立的CSRF值",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/sessions-lifecycle/state.svg",
          "title": "建立、续期、过期与退出的两侧状态",
          "alt": "登录创建随机ID与服务端记录；每次请求验证状态与所有权；刷新换ID且保留绝对截止，退出删除记录并让浏览器过期Cookie。",
          "caption": "Map只属于本进程；图示不是分布式存储承诺。下方JWT分支的立即撤销同样需要状态。"
        },
        {
          "type": "code",
          "code": "import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';\nconst random=()=>randomBytes(32).toString('base64url');\nconst digest=value=>createHash('sha256').update(value).digest('hex');\nconst validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);\nexport class Sessions {\n  constructor({now=Date.now,idleMs=60000,absoluteMs=300000,maxSessions=1000}={}) {\n    this.now=now;this.idleMs=idleMs;this.absoluteMs=absoluteMs;this.maxSessions=maxSessions;\n    this.records=new Map();\n  }\n  prune() {\n    const now=this.now();\n    for(const [key,record] of this.records) {\n      if(now>=record.idleUntil||now>=record.absoluteUntil)this.records.delete(key);\n    }\n  }\n  create(user,{absoluteUntil=this.now()+this.absoluteMs}={}) {\n    this.prune();\n    if(this.records.size>=this.maxSessions)throw new Error('SESSION_CAPACITY');\n    const id=random(),csrf=random(),now=this.now();\n    const record={user,csrf,absoluteUntil,idleUntil:Math.min(now+this.idleMs,absoluteUntil)};\n    this.records.set(digest(id),record);\n    return {id,...record};\n  }\n  get(id,{touch=false}={}) {\n    if(!validId(id))return null;\n    const record=this.records.get(digest(id));\n    if(!record)return null;\n    if(this.now()>=record.idleUntil||this.now()>=record.absoluteUntil) {\n      this.records.delete(digest(id));return null;\n    }\n    if(touch)record.idleUntil=Math.min(this.now()+this.idleMs,record.absoluteUntil);\n    return record;\n  }\n  rotate(id) {\n    const record=this.get(id);\n    if(!record)return null;\n    this.remove(id);\n    return this.create(record.user,{absoluteUntil:record.absoluteUntil});\n  }\n  remove(id) { if(validId(id))this.records.delete(digest(id)); }\n  matchesCsrf(record,token) {\n    if(!validId(token))return false;\n    return timingSafeEqual(Buffer.from(record.csrf),Buffer.from(token));\n  }\n}\nexport const cookieName='__Host-atlas_sid';\nexport function readCookie(header='') {\n  const values=header.split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));\n  return values.length===1?values[0].slice(cookieName.length+1):undefined;\n}\nexport function sessionCookie(session,now) {\n  const seconds=Math.max(0,Math.ceil((session.absoluteUntil-now)/1000));\n  return `${cookieName}=${session.id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;\n}\nexport const clearCookie=`${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;",
          "language": "js",
          "filename": "examples/sessions-lifecycle/sessions.mjs",
          "purpose": "完整会话和Cookie实现：32字节随机值、摘要键、空闲/绝对期限、原子式单进程轮换，以及重复Cookie名的保守拒绝。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "create为ID和CSRF分别生成32字节随机值。ID用于定位服务端会话，CSRF值用于确认特定写请求经过本应用认可的页面流程，二者不共用同一个字符串。记录含user、idleUntil和absoluteUntil；服务端只通过自己生成的ID建立身份，绝不接受客户端提出“请采用这个已知ID”。"
        },
        {
          "type": "paragraph",
          "text": "get先检查格式并查摘要，随后检查两种期限；到期就删除。认证请求传touch:true，会把空闲截止更新到当前时间加idleMs，但最多到absoluteUntil。也就是说，持续活动可以维持短期会话，却不能无限延长一次认证的总寿命。超时判断只依赖服务器时钟，不靠浏览器是否及时删了Cookie。"
        },
        {
          "type": "paragraph",
          "text": "rotate先确认旧ID有效，再删除旧摘要键，生成新ID与CSRF，同时沿用原absoluteUntil。这让登录或续期前窃取的旧ID不能继续使用，也阻止每次刷新重新获得一整段绝对寿命。本例在单进程同步Map操作间没有await；多实例存储必须提供比较并替换或事务语义，不能把这段内存代码直接当成Redis/数据库的原子实现。"
        },
        {
          "type": "paragraph",
          "text": "prune清理过期记录，容量最多1000条，避免示例无限保存会话。这个数字是教学容量，不是生产调优结果。进程重启会失去Map里的会话，属于当前实现的明确行为；需要跨实例或重启保持登录时，应设计共享存储及故障策略。"
        }
      ]
    },
    {
      "id": "requests",
      "title": "把登录、认证和资源所有权落实到HTTP处理",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import { createServer } from 'node:https';\nimport { once } from 'node:events';\nimport { randomBytes,scrypt,timingSafeEqual } from 'node:crypto';\nimport { promisify } from 'node:util';\nimport { Sessions,readCookie,sessionCookie,clearCookie } from './sessions.mjs';\nimport { createTokens } from './jwt.mjs';\nimport { temporaryCertificates } from './certificates.mjs';\nconst derive=promisify(scrypt);\nconst credentials={alice:'classroom-only-42',bob:'classroom-only-43'};\nconst notes=new Map([['1',{owner:'alice',title:'Alice private note'}],['2',{owner:'bob',title:'Bob private note'}]]);\nclass HttpError extends Error { constructor(status,code){super(code);this.status=status;} }\nasync function input(req) {\n  if(!/^application\\/json(?:\\s*;|$)/i.test(req.headers['content-type']??''))throw new HttpError(415,'JSON_REQUIRED');\n  const text=await new Promise((resolve,reject)=>{\n    let bytes=0;const chunks=[];\n    const cleanup=()=>{clearTimeout(timer);req.off('data',data);req.off('end',end);req.off('error',fail);req.off('close',closed);};\n    const fail=error=>{cleanup();reject(error);req.resume();};\n    const data=chunk=>{bytes+=chunk.length;if(bytes>1024)fail(new HttpError(413,'BODY_LIMIT'));else chunks.push(chunk);};\n    const end=()=>{cleanup();resolve(Buffer.concat(chunks).toString('utf8'));};\n    const closed=()=>{if(!req.complete)fail(new HttpError(400,'INCOMPLETE_BODY'));};\n    const timer=setTimeout(()=>fail(new HttpError(408,'BODY_TIMEOUT')),1500);\n    req.on('data',data);req.once('end',end);req.once('error',fail);req.once('close',closed);\n  });\n  try {const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}\n  catch {throw new HttpError(400,'BAD_JSON');}\n}\nfunction json(res,status,value,cookie) {\n  if(res.destroyed||res.writableEnded)return;\n  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','connection':'close',...(cookie?{'set-cookie':cookie}:{})});\n  res.end(JSON.stringify(value));\n}\nexport async function startApp({now=Date.now,idleMs=60000,absoluteMs=300000}={}) {\n  const certificates=await temporaryCertificates();\n  const sessions=new Sessions({now,idleMs,absoluteMs});\n  const tokens=createTokens({now});\n  const users=new Map();\n  for(const [user,password] of Object.entries(credentials)) {\n    const salt=randomBytes(16);users.set(user,{salt,hash:await derive(password,salt,32)});\n  }\n  const dummy=users.get('alice');\n  async function login(value) {\n    if(Object.keys(value).sort().join(',')!=='password,user'||typeof value.user!=='string'||typeof value.password!=='string'||value.user.length>40||value.password.length>100)throw new HttpError(422,'BAD_CREDENTIAL_INPUT');\n    const stored=users.get(value.user)??dummy;\n    const hash=await derive(value.password,stored.salt,32);\n    if(!timingSafeEqual(hash,stored.hash)||!users.has(value.user))throw new HttpError(401,'BAD_CREDENTIALS');\n    return value.user;\n  }\n  const server=createServer({key:certificates.key,cert:certificates.cert,minVersion:'TLSv1.3'},(req,res)=>{\n    req.on('error',()=>{});\n    void handle(req,res).catch(error=>json(res,error instanceof HttpError?error.status:500,{error:error instanceof HttpError?error.message:'INTERNAL'}));\n  });\n  server.headersTimeout=5000;server.requestTimeout=5000;\n  let origin;\n  function current(req) {\n    const id=readCookie(req.headers.cookie),session=sessions.get(id,{touch:true});\n    if(!session)throw new HttpError(401,'SESSION_REQUIRED');\n    return {id,session};\n  }\n  function csrf(req,session) {\n    if(!sessions.matchesCsrf(session,req.headers['x-csrf-token']))throw new HttpError(403,'CSRF_REQUIRED');\n  }\n  function bearer(req) {\n    const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization??'');\n    try { if(!match)throw 0;return {token:match[1],claims:tokens.verify(match[1])}; }\n    catch { throw new HttpError(401,'JWT_REQUIRED'); }\n  }\n  async function handle(req,res) {\n    if(req.method==='POST'&&req.headers.origin!==origin)throw new HttpError(403,'ORIGIN_REQUIRED');\n    if(req.method==='POST'&&(req.url==='/login'||req.url==='/jwt/login')) {\n      const user=await login(await input(req));\n      if(res.destroyed)return;\n      if(req.url==='/jwt/login'){json(res,200,{accessToken:tokens.issue(user),expiresIn:30});return;}\n      sessions.remove(readCookie(req.headers.cookie));\n      const fresh=sessions.create(user);\n      json(res,200,{user,csrfToken:fresh.csrf},sessionCookie(fresh,now()));return;\n    }\n    if(req.method==='GET'&&req.url==='/me') {\n      const {session}=current(req);json(res,200,{user:session.user,csrfToken:session.csrf});return;\n    }\n    if(req.method==='POST'&&req.url==='/refresh') {\n      const {id,session}=current(req);csrf(req,session);\n      const fresh=sessions.rotate(id);\n      json(res,200,{user:fresh.user,csrfToken:fresh.csrf},sessionCookie(fresh,now()));return;\n    }\n    if(req.method==='POST'&&req.url==='/logout') {\n      const {id,session}=current(req);csrf(req,session);sessions.remove(id);\n      json(res,200,{loggedOut:true},clearCookie);return;\n    }\n    if(req.method==='GET'&&/^\\/notes\\/[12]$/.test(req.url)) {\n      const {session}=current(req),note=notes.get(req.url.slice(-1));\n      if(note.owner!==session.user)throw new HttpError(404,'NOTE_NOT_FOUND');\n      json(res,200,{title:note.title});return;\n    }\n    if(req.method==='GET'&&req.url==='/jwt/me') {json(res,200,{user:bearer(req).claims.sub});return;}\n    if(req.method==='POST'&&req.url==='/jwt/logout') {tokens.revoke(bearer(req).token);json(res,200,{loggedOut:true});return;}\n    throw new HttpError(404,'NOT_FOUND');\n  }\n  try { server.listen(0,'127.0.0.1');await once(server,'listening');origin=`https://localhost:${server.address().port}`; }\n  catch(error) {await certificates.dispose();throw error;}\n  return {\n    port:server.address().port,origin,ca:certificates.ca,\n    async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await certificates.dispose();},\n  };\n}",
          "language": "js",
          "filename": "examples/sessions-lifecycle/server.mjs",
          "purpose": "完整服务：教学账户的scrypt校验、受限输入、固定Origin、CSRF、Session/JWT路由和笔记所有权。证书辅助与上一篇相同，客户端完整实现随后提供。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "登录路径先验证Origin和JSON输入，再校验教学账户的scrypt结果。账户不存在也使用已有记录做一次派生，避免直接跳过口令计算；这不等于整个接口已经被证明恒定时间。验证成功后删除当前Cookie可能对应的旧记录，再新建随机会话；客户端先传一个攻击者选定的ID，也不会被采用。"
        },
        {
          "type": "paragraph",
          "text": "scrypt用了随机盐，比较用timingSafeEqual；密码没有明文存进会话。但这里仍是公开教学凭据，不包含注册、找回密码、撞库限制、MFA和密钥托管。scrypt异步调用仍消耗线程池与内存，本例没有交付生产登录防护与容量治理，不应作为公网账号系统直接部署。"
        },
        {
          "type": "paragraph",
          "text": "GET /me通过current重新查记录。GET /notes/1或2还比较note.owner与session.user，不允许“已经登录就读任何笔记”。返回404是本例减少对象存在性泄漏的接口策略，并不意味着所有系统必须用404而不能403。授权仍由服务端数据决定，不能从客户端提交的user字段直接取得。"
        },
        {
          "type": "paragraph",
          "text": "响应统一Cache-Control: no-store，避免把会话或CSRF响应当公共缓存内容。res.destroyed后不再建立新的登录状态，清理客户端已离开时无意义的继续处理。请求体累计最多1024字节，还有正文接收时限；它们只是教学边界，不构成代理、连接池和攻击流量的完整容量设计。"
        }
      ]
    },
    {
      "id": "csrf",
      "title": "为什么有SameSite，还要检查Origin和CSRF",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "CSRF利用的是浏览器可能自动附带会话Cookie。攻击页面不必读到Cookie原值，只要能诱使浏览器对目标发出携带凭据的写请求，就可能造成副作用。CORS主要管跨源读取许可，不能把“攻击者读不到响应”当作请求没有到达服务端的证据。"
        },
        {
          "type": "paragraph",
          "text": "本服务要求所有POST的Origin精确等于启动时配置出的https://localhost:端口。这个值来自服务端自身监听配置，不从攻击者提供的Host头随意推导。登录还限定JSON输入；有会话的refresh和logout额外要求x-csrf-token等于会话中的随机值。缺Origin的非浏览器调用也拒绝，这是本例明确选择的客户端契约。"
        },
        {
          "type": "paragraph",
          "text": "固定Origin是浏览器请求来源边界，不是客户端身份证书：非浏览器程序可以自己写Origin，因此它仍需有效会话、CSRF或Bearer凭据。反过来，来自当前源的XSS脚本可以读/me获得CSRF值并发请求，HttpOnly与CSRF都不是XSS修复。脚本注入要在另一个信任边界处理。"
        },
        {
          "type": "code",
          "code": "import { request } from 'node:https';\nexport function send(app,path,{method='GET',cookie,csrf,bearer,origin=app.origin,body}={}) {\n  return new Promise((resolve,reject)=>{\n    const text=body===undefined?'':JSON.stringify(body);\n    const req=request({hostname:'127.0.0.1',port:app.port,servername:'localhost',ca:app.ca,agent:false,\n      path,method,rejectUnauthorized:true,\n      headers:{...(origin===null?{}:{origin}),'content-type':'application/json',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(bearer?{authorization:'Bearer '+bearer}:{}),...(body===undefined?{}:{'content-length':Buffer.byteLength(text)})},\n    },res=>{\n      let data='';res.setEncoding('utf8');res.on('data',chunk=>{data+=chunk;});res.once('error',reject);\n      res.once('end',()=>resolve({status:res.statusCode,body:JSON.parse(data),cookie:res.headers['set-cookie']?.[0],cache:res.headers['cache-control']}));\n    });\n    req.setTimeout(4000,()=>req.destroy(new Error('TEST_TIMEOUT')));req.once('error',reject);req.end(text);\n  });\n}\nexport const cookiePair=response=>response.cookie.split(';')[0];",
          "language": "js",
          "filename": "examples/sessions-lifecycle/client.mjs",
          "purpose": "完整真实HTTPS测试客户端：手动附带Cookie、Origin和CSRF；它不具备浏览器Cookie jar，不把响应头测试冒充SameSite执行验证。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "测试先带旧Cookie、不带CSRF调用refresh，得到403；再带正确CSRF但把Origin改为evil.invalid，也得到403。真正成功时返回新Cookie和新CSRF。网络连接本身真实走TLS，安全失败来自服务端判断；浏览器是否按SameSite自动附带，是另一项尚需浏览器验证的行为。"
        },
        {
          "type": "reference",
          "title": "MDN：CSRF的前提及防护边界",
          "url": "https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF"
        }
      ]
    },
    {
      "id": "expiry",
      "title": "续期不是复制旧凭据，退出也不是只删页面状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "默认空闲寿命60秒、绝对寿命300秒。实验把它缩成10秒与25秒，并注入服务器now函数精确推演；网络仍是真实HTTPS，没有把请求伪装成内存函数调用。首次登录后刚好过10秒未活动，旧ID应401；在9秒和18秒分别刷新，可以继续访问，但25秒的绝对截止仍然到期。"
        },
        {
          "type": "paragraph",
          "text": "普通已认证请求也会更新空闲期限，所以另一个用例在9秒和18秒读取/me，18秒时仍有效，25秒时失败。touch逻辑只改服务端空闲截止，Cookie的Max-Age仍按原绝对截止计算。这样客户端保留了Cookie，也必须服从服务器的更早失效判断。"
        },
        {
          "type": "callout",
          "title": "本例把什么算作活动",
          "text": "current在Cookie认证通过后立即touch，早于后续CSRF和资源所有权检查。因此有效Cookie对应的请求即使最终403或404，也可能续空闲期限；它不会越过绝对期限。这是一种明确的活动策略，不是“业务操作成功才续期”。若产品要求后者，应先用touch:false查询，在通过请求与资源校验后显式续期，并增加拒绝请求不续期的测试。"
        },
        {
          "type": "paragraph",
          "text": "轮换还要处理并发。两个浏览器标签可能同时拿旧ID刷新，本例只允许其中一个消费成功，另一个401。读者需要知道这种行为会要求客户端串行化刷新或在失败后重读共享状态；不能悄悄放宽为新旧ID都永久有效来掩盖竞争。生产若需要短宽限，应明确重放风险、单次使用与存储原子性，另做测试。"
        },
        {
          "type": "paragraph",
          "text": "退出时同时删除服务器记录并设置同作用域Cookie的Max-Age=0。只删localStorage或前端状态，服务端旧凭据仍能重放；只删服务器记录，浏览器还可能继续发送一个无效ID。清除客户端是体验与范围管理，服务器拒绝旧ID才是撤销的关键证据。"
        },
        {
          "type": "code",
          "code": "const login=await send(app,'/login',{method:'POST',body:{user:'alice',password:'classroom-only-42'}});\nconst cookie=cookiePair(login);\nconst renewed=await send(app,'/refresh',{method:'POST',cookie,csrf:login.body.csrfToken});\nconsole.log(renewed.status); // 200\nconsole.log((await send(app,'/me',{cookie})).status); // 401：旧ID已失效\nconst freshCookie=cookiePair(renewed);\nawait send(app,'/logout',{method:'POST',cookie:freshCookie,csrf:renewed.body.csrfToken});\nconsole.log((await send(app,'/me',{cookie:freshCookie})).status); // 401",
          "language": "js",
          "filename": "客户端顺序推演",
          "purpose": "app由正文startApp创建，send和cookiePair完整实现已给出；不要把示例教学凭据替换为真实个人密码写入仓库。",
          "kind": "excerpt"
        }
      ]
    },
    {
      "id": "jwt",
      "title": "JWT先验完整性与声明，再谈登录状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "JWT分支把部分声明放进令牌。常见JWS紧凑形式是header.payload.signature三段base64url，编码不是加密，任何拿到令牌的人都能读出明文声明。本例HS256实际使用HMAC完整性保护，验证者拥有同一份秘密时，也拥有签发能力；它不同于让公钥验证者无法签发的非对称签名部署。"
        },
        {
          "type": "paragraph",
          "text": "因此不会把密钥放进浏览器，更不会只decode后就信任sub。服务端先固定允许HS256与本例typ，再检查MAC，之后核对issuer、audience、subject和时间。令牌里的alg不能决定服务器随意改用别的算法；未支持的扩展头也拒绝。"
        },
        {
          "type": "code",
          "code": "import { randomBytes,createHmac,timingSafeEqual } from 'node:crypto';\nconst encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');\nconst decode=segment=>{\n  if(!/^[A-Za-z0-9_-]+$/.test(segment))throw new Error('JWT_INVALID');\n  const bytes=Buffer.from(segment,'base64url');\n  if(bytes.toString('base64url')!==segment)throw new Error('JWT_INVALID');\n  return JSON.parse(bytes.toString('utf8'));\n};\nexport function createTokens({key=randomBytes(32),now=Date.now}={}) {\n  if(!Buffer.isBuffer(key)||key.length<32)throw new Error('strong server key required');\n  const secret=Buffer.from(key),revoked=new Map();\n  const mac=input=>createHmac('sha256',secret).update(input).digest();\n  const seconds=()=>Math.floor(now()/1000);\n  function prune() { for(const [id,expiry] of revoked)if(expiry<=seconds())revoked.delete(id); }\n  function issue(sub) {\n    prune();\n    if(!['alice','bob'].includes(sub))throw new Error('JWT_INVALID');\n    const iat=seconds();\n    const claims={iss:'atlas-session-lab',aud:'atlas-notes',sub,iat,exp:iat+30,jti:randomBytes(16).toString('base64url')};\n    const input=encode({alg:'HS256',typ:'JWT'})+'.'+encode(claims);\n    return input+'.'+mac(input).toString('base64url');\n  }\n  function verify(token) {\n    prune();\n    if(typeof token!=='string'||token.length>4096)throw new Error('JWT_INVALID');\n    const parts=token.split('.');\n    if(parts.length!==3)throw new Error('JWT_INVALID');\n    const [h,p,s]=parts,header=decode(h);\n    if(Object.keys(header??{}).sort().join(',')!=='alg,typ'||header?.alg!=='HS256'||header?.typ!=='JWT')throw new Error('JWT_INVALID');\n    if(!/^[A-Za-z0-9_-]+$/.test(s))throw new Error('JWT_INVALID');\n    const signature=Buffer.from(s,'base64url'),expected=mac(h+'.'+p);\n    if(signature.toString('base64url')!==s||signature.length!==expected.length||!timingSafeEqual(signature,expected))throw new Error('JWT_INVALID');\n    const claims=decode(p),current=seconds();\n    if(claims?.iss!=='atlas-session-lab'||claims?.aud!=='atlas-notes'||\n       !['alice','bob'].includes(claims?.sub)||\n       !Number.isSafeInteger(claims?.iat)||!Number.isSafeInteger(claims?.exp)||\n       claims.iat>current||claims.exp<=current||claims.exp<=claims.iat||claims.exp-claims.iat>30||\n       typeof claims.jti!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(claims.jti)||revoked.has(claims.jti))throw new Error('JWT_INVALID');\n    return claims;\n  }\n  function revoke(token) { const claims=verify(token);revoked.set(claims.jti,claims.exp); }\n  return {issue,verify,revoke};\n}",
          "language": "js",
          "filename": "examples/sessions-lifecycle/jwt.mjs",
          "purpose": "完整教学JWT签发、验证与撤销。固定HS256及iss/aud，限制长度、段数、规范base64url、时间类型、最长30秒寿命和jti；生产应优先使用成熟库并保留等价策略测试。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "verify先限制4096字符与三个片段，再检查header。它对原始h.p计算HMAC，比较签名长度与timingSafeEqual；只有完整性通过，才把payload当成经过本发行者认可的声明继续校验。声明合法性也不能省：给另一个API的aud、另一个发行者的iss、未来iat或到期exp，都不应获得本服务的身份。"
        },
        {
          "type": "paragraph",
          "text": "时间使用NumericDate秒，示例将now毫秒向下取整，exp为iat+30，并采用零额外时钟宽限。实际部署需要同步时钟，若允许偏差应给出有限规则；不能让“容忍误差”成为永不过期。本例jti为随机唯一标识，用于区分单枚令牌，不能拿它当用户ID。"
        },
        {
          "type": "reference",
          "title": "RFC7519：JWT声明与NumericDate",
          "url": "https://www.rfc-editor.org/rfc/rfc7519.html"
        },
        {
          "type": "reference",
          "title": "RFC8725：算法验证、声明与跨用途混淆防护",
          "url": "https://www.rfc-editor.org/rfc/rfc8725.html"
        }
      ]
    },
    {
      "id": "jwt-lifecycle",
      "title": "JWT退出为何常常又需要服务端状态",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "只校验签名和exp的资源服务，在令牌过期前无法知道用户刚刚点了退出。客户端删除它自己的副本，也不能收回攻击者已经复制的副本。要立即拒绝这枚令牌，就需要撤销列表、会话版本、共享状态查询或更短有效期等明确策略。JWT格式没有提供免费即时撤销。"
        },
        {
          "type": "paragraph",
          "text": "本例revoke先验证令牌，再将jti保存到撤销表直到exp。verify每次检查这个表；过期条目被清理。这确实实现当前进程内立即退出，也明确重新引入状态。多实例要共享撤销信息并定义延迟和故障策略，否则A实例退出、B实例仍接受的情况不会被一份Map代码自动消除。"
        },
        {
          "type": "paragraph",
          "text": "签名密钥换掉会使旧MAC不再通过，但那是大范围失效，不是只让一个用户退出。生产通常需要密钥版本、过渡期、发布与紧急撤销策略。示例启动时随机生成内存密钥，重启后旧JWT全部失效；这不属于可持久化密钥轮换实现。"
        },
        {
          "type": "paragraph",
          "text": "这里JWT只提供30秒Access Token，不实现Refresh Token服务；到期需要重新登录。/refresh是前面的不透明Session轮换接口，不是拿JWT无限续命。如果以后加入Refresh Token，它也应有自己的存储、单次轮换、重放检测和绝对期限，不能把长寿命JWT直接当作“永远能换新票”的万能凭据。"
        },
        {
          "type": "paragraph",
          "text": "Bearer请求在本例显式用Authorization附带，浏览器不会像Cookie那样仅凭站点关系自动加上它，因此CSRF前提不同；把JWT存进Cookie，又会回到相应Cookie发送规则。localStorage中的值则可能被同源脚本读取。应根据客户端类型和威胁模型选择载体，而不是声称JWT天然不怕XSS或Cookie天然不需要CSRF。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "验证从重放、伪造和越权走到真实响应",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "test('JWT verification policy is more than JSON decoding',()=>{\n  let time=1000000;const key=randomBytes(32),tokens=createTokens({key,now:()=>time});\n  const token=tokens.issue('alice');assert.equal(tokens.verify(token).sub,'alice');\n  const [h,p,s]=token.split('.');\n  const payload=JSON.parse(Buffer.from(p,'base64url'));\n  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');\n  const reSign=(header,claims)=>{const input=encode(header)+'.'+encode(claims);return input+'.'+createHmac('sha256',key).update(input).digest('base64url');};\n  assert.throws(()=>tokens.verify(h+'.'+encode({...payload,sub:'bob'})+'.'+s));\n  assert.throws(()=>tokens.verify(reSign({alg:'none',typ:'JWT'},payload)));\n  for(const wrong of [{aud:'other-api'},{iss:'other-issuer'},{exp:payload.iat},{iat:payload.iat+60,exp:payload.iat+90}]) {\n    assert.throws(()=>tokens.verify(reSign({alg:'HS256',typ:'JWT'},{...payload,...wrong})));\n  }\n  assert.throws(()=>createTokens({key:randomBytes(32),now:()=>time}).verify(token));\n  tokens.revoke(token);assert.throws(()=>tokens.verify(token));\n  const later=tokens.issue('alice');time+=30000;assert.throws(()=>tokens.verify(later));\n});",
          "language": "js",
          "filename": "examples/sessions-lifecycle/test.mjs",
          "purpose": "JWT验证策略的实际完整反例：有MAC仍需查声明，未知算法/扩展头拒绝，变更payload但不重签会失败，不同密钥、撤销和过期也失败。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "上面的reSign仅在测试里持有本次随机教学密钥，用来证明“即使完整性合法，错误aud/iss仍会拒绝”。攻击者并不因此获得真实服务密钥。另一个用例只改sub不改MAC，验证的则是攻击者无法仅改base64url正文切换身份。两类测试回答的不是同一个问题。"
        },
        {
          "type": "table",
          "headers": [
            "真实HTTPS路径",
            "期望",
            "验证边界"
          ],
          "rows": [
            [
              "传攻击者指定Cookie再登录",
              "新ID，旧指定ID401",
              "登录不接管攻击者挑选的身份凭据"
            ],
            [
              "旧ID刷新后再次访问",
              "401",
              "轮换是真撤销，不只是返回另一个字符串"
            ],
            [
              "Alice读取Bob的笔记",
              "404",
              "身份认证之外仍有资源授权"
            ],
            [
              "未到空闲期限的活动与刷新",
              "有效，但绝对截止25秒后401",
              "续期不突破总寿命"
            ],
            [
              "退出后用保存的旧Cookie",
              "401",
              "服务器状态已删除"
            ],
            [
              "JWT签发→使用→撤销→重放",
              "200→200→200→401",
              "jti撤销状态实际参与验证"
            ],
            [
              "JWT到期，伪造，错误用途或密钥",
              "拒绝",
              "decode、签名与声明判断各有职责"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "HTTP测试客户端手动发送Cookie，断言的是Set-Cookie属性文本与服务端行为，不是浏览器执行Secure、SameSite、Cookie前缀或跨站发送的证明。浏览器策略需要真实源、浏览器和跨源交互另外验证；本次图形也已完成网站桌面与390px手机视口检查，仍不等于跨源Cookie发送策略实测。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行、限制与选择方案的依据",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/sessions-lifecycle\nnvm use\nnpm ci\nopenssl version\nnpm test\nnpm start\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "Node22.12.0、OpenSSL CLI3.6.1已验证。每次listen(0)与临时教学CA，不改系统信任、本站鉴权或现有4173。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "网络生命周期测试覆盖9个子场景，另有1个独立JWT策略测试，含父测试Node报告11项。npm start只打印状态：login200、own note200、other user note404、logout200、old cookie401，不输出可重用Cookie、JWT、CSRF或私钥。服务和证书在finally里关闭清理；系统强杀或断电不保证JavaScript收尾。"
        },
        {
          "type": "paragraph",
          "text": "对单体Web应用，共享会话存储通常能直接表达撤销、用户状态和期限；对需要跨服务验证的场景，受约束的短期JWT可减少部分查询，但会带来发行者、受众、密钥与撤销的运维责任。本例对比这两套代价，没有宣布一种格式适合所有系统。"
        },
        {
          "type": "paragraph",
          "text": "仍缺生产级凭据生命周期、限速/MFA、持久化存储、分布式原子轮换、跨实例撤销、密码重置、审计和密钥托管，也没有做公网或手机真机验收。服务端示例只用于隔离学习；公开GitHub Pages不会运行它，离线下载也不会替你安装OpenSSL或建立一个后端身份服务。"
        },
        {
          "type": "paragraph",
          "text": "你可以遮住测试输出推演一次：攻击者保留旧Cookie，用户刷新后它是否还能访问？不能，因为服务器已删旧ID。只把JWT从本地删掉，另一份复制品是否立即失效？只有签名/到期校验时不会，本文的jti撤销表才让它失败。把这两个问题都回答清楚，才真正说明了“退出登录”在你的系统里意味着什么。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "MDN Set-Cookie",
      "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie"
    },
    {
      "title": "MDN CSRF",
      "url": "https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF"
    },
    {
      "title": "JWT RFC7519",
      "url": "https://www.rfc-editor.org/rfc/rfc7519.html"
    },
    {
      "title": "JWT BCP RFC8725",
      "url": "https://www.rfc-editor.org/rfc/rfc8725.html"
    },
    {
      "title": "Node22.12 Crypto",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/crypto.html"
    },
    {
      "title": "Node22.12 HTTPS",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/https.html"
    }
  ]
};
export default article;
