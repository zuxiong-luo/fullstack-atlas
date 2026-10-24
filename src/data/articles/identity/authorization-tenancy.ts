import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "authorization-tenancy",
  "topic": "identity",
  "title": "权限与多租户：从 RBAC 到资源所有权和服务端授权",
  "description": "把身份、租户成员资格、角色与对象关系分开，用真实HTTP和PostgreSQL17受限角色/RLS验证读取、列表、条件写入、撤权和连接池隔离。",
  "scope": "把身份、租户成员资格、角色与对象关系分开，用真实HTTP和PostgreSQL17受限角色/RLS验证读取、列表、条件写入、撤权和连接池隔离。 配套数据均为本机虚构数据，不修改本站鉴权，也不处理真实用户凭据。",
  "minutes": 58,
  "tags": [
    "RBAC",
    "多租户",
    "对象授权",
    "RLS",
    "最小权限"
  ],
  "prerequisites": [
    "理解HTTP请求/响应、Cookie与基本JavaScript",
    "阅读过会话文章；授权篇另外需要基础SQL与事务概念"
  ],
  "kind": "tutorial",
  "status": 'complete',
  "versions": [
    "Node.js 22.12.0",
    "pg 8.13.1",
    "PostgreSQL 17.4"
  ],
  "verifiedAt": "2026-10-24",
  "labMinutes": 35,
  "questionIds": [],
  "examples": [
    {
      "label": "下载完整源码ZIP",
      "path": "authorization-tenancy.zip"
    },
    {
      "label": "运行、验证与限制",
      "path": "authorization-tenancy/README.md"
    }
  ],
  "references": [
    {
      "title": "OWASP：Authorization Cheat Sheet",
      "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html"
    },
    {
      "title": "PostgreSQL17：行安全策略",
      "url": "https://www.postgresql.org/docs/17/ddl-rowsecurity.html"
    },
    {
      "title": "PostgreSQL17：CREATE POLICY",
      "url": "https://www.postgresql.org/docs/17/sql-createpolicy.html"
    },
    {
      "title": "node-postgres：事务必须使用同一连接",
      "url": "https://node-postgres.com/features/transactions"
    },
    {
      "title": "node-postgres：参数化查询",
      "url": "https://node-postgres.com/features/queries"
    }
  ],
  "sections": [
    {
      "id": "authorization",
      "title": "权限判断是什么：认证成功只是知道了你是谁",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "认证确认请求代表哪个主体，授权判断这个主体能否对某个资源执行某个动作。主体可以是用户或服务，资源可以是文档、任务或租户配置。拿到合法会话并不代表可以读取所有文档；界面隐藏删除按钮，也不能阻止调用者自己构造HTTP请求。因此决定性判断必须放在服务端受信边界，并覆盖每条实际读写路径。"
        },
        {
          "type": "paragraph",
          "text": "多租户让这个问题多一个维度：同一应用服务多个组织，A组织的管理员通常只管理A，不自动成为全站管理员。一个完整决策至少需要主体、目标租户、动作、资源和上下文。本文用文档服务贯穿：red租户有alice编辑者、bob查看者、sue管理员和erin编辑者；blue租户有carol管理员。每篇文档还标明所属租户、拥有者与是否租户内共享。"
        },
        {
          "type": "paragraph",
          "text": "RBAC把动作授予角色，例如viewer只能读、editor可写、admin可管理，但角色本身仍不能回答“这篇私有文档属于谁”。我们让查看者读共享文档，拥有者读自己的私有文档，同租户管理员可读租户内全部；写入只允许编辑者修改自己的文档，或管理员修改同租户文档。没有明确规则的动作默认拒绝。"
        }
      ]
    },
    {
      "id": "matrix",
      "title": "先写权限矩阵，避免每个接口各猜一套规则",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "主体与资源关系",
            "读私有文档",
            "读共享文档",
            "改文档正文"
          ],
          "rows": [
            [
              "同租户viewer",
              "只允许自己拥有",
              "允许",
              "拒绝"
            ],
            [
              "同租户editor",
              "只允许自己拥有",
              "允许",
              "只允许自己拥有"
            ],
            [
              "同租户admin",
              "允许",
              "允许",
              "允许"
            ],
            [
              "无该租户成员资格",
              "拒绝",
              "拒绝",
              "拒绝"
            ],
            [
              "未知角色/动作",
              "拒绝",
              "拒绝",
              "拒绝"
            ]
          ],
          "caption": "共享只表示租户内可读，不表示匿名、跨租户或所有成员可编辑。"
        },
        {
          "type": "paragraph",
          "text": "客户端可以选择想访问哪个租户，但不能把选择直接变成权限。服务端从验证过的会话取得user，再查询这个user在目标租户的成员记录。query参数里的role=admin、body里的owner或自称tenantId都不是授权事实。本例为了把焦点放在授权，随机令牌只由测试夹具为虚构主体签发；完整登录、轮换与过期由前文处理，不能把此处的测试issue当成公开注册接口。"
        },
        {
          "type": "paragraph",
          "text": "资源标识也不是权限。把短ID换成UUID能减少猜测，但合法用户仍可能通过链接、日志或列表得到别人的ID。检查必须在读该资源的路径上重复执行，列表则应在SQL中先过滤再返回。先取出整个租户的数据，再让前端藏起私有项，已经越过了保密边界。"
        }
      ]
    },
    {
      "id": "model",
      "title": "数据模型承载归属，受限数据库角色承载最小权限",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "sql",
          "filename": "examples/authorization-tenancy/schema.sql",
          "purpose": "真实表、角色与虚构数据：文档有tenant/owner关系，角色受限；数据库迁移由测试管理员执行，应用连接不拥有表。",
          "kind": "excerpt",
          "code": "CREATE ROLE atlas_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\nREVOKE CREATE ON SCHEMA public FROM PUBLIC;\nCREATE TABLE memberships(\n tenant_id text NOT NULL,user_id text NOT NULL,\n role text NOT NULL CHECK(role IN('viewer','editor','admin')),\n PRIMARY KEY(tenant_id,user_id)\n);\nCREATE TABLE documents(\n id text PRIMARY KEY,tenant_id text NOT NULL,owner_id text NOT NULL,\n visibility text NOT NULL CHECK(visibility IN('private','shared')),\n body text NOT NULL CHECK(length(body)<=200),version integer NOT NULL DEFAULT 1 CHECK(version>=1),\n FOREIGN KEY(tenant_id,owner_id) REFERENCES memberships(tenant_id,user_id)\n);\nINSERT INTO memberships VALUES\n ('red','alice','editor'),('red','bob','viewer'),('red','sue','admin'),('red','erin','editor'),('blue','carol','admin');\nINSERT INTO documents(id,tenant_id,owner_id,visibility,body) VALUES\n ('a1','red','alice','private','Alice private'),('a2','red','alice','shared','Red shared'),\n ('e1','red','erin','private','Erin private'),('b1','blue','carol','private','Blue secret');"
        },
        {
          "type": "paragraph",
          "text": "文档包含tenant_id、owner_id和visibility，联合外键保证文档拥有者确实是该租户成员。正文长度与版本也有约束。这些规则保证数据形状与关系成立，不自动实现“用户能否修改”的决策：一个符合外键的行仍可能被无权用户读取，因此我们随后增加查询谓词和行安全策略。"
        },
        {
          "type": "paragraph",
          "text": "atlas_app是真实LOGIN角色，明确不是超级用户、不能创建角色或数据库，也没有BYPASSRLS。应用只获SELECT以及正文、版本两列的UPDATE，不获更改tenant/owner或修改成员资格的权限。迁移账户与运行账户分开很重要：如果用表拥有者或超级用户验证RLS，再看见全表可读，得出的不是RLS无用，而是验证角色不对。"
        },
        {
          "type": "paragraph",
          "text": "夹具创建私有PGDATA与0700的Unix socket目录，使用端口编号55443但不开放TCP监听；认证trust只存在这个临时目录对应的教学实例，不修改用户现有PostgreSQL。测试结束关闭连接池并删除实例。它验证真实PostgreSQL17.4行为，不能把同机隔离夹具表述成已经验收生产多节点数据库。"
        }
      ]
    },
    {
      "id": "context",
      "title": "每次请求建立可信上下文，事务结束就归还空白连接",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/authorization-tenancy/service.mjs",
          "purpose": "写入输入白名单、可信用户/租户检查与同一连接事务上下文；set_config第三参数true表示仅当前事务有效。",
          "kind": "excerpt",
          "code": "export class HttpError extends Error{constructor(status,code){super(code);this.status=status;}}\nconst key=/^[a-z][a-z0-9-]{0,31}$/;\nexport function validateWrite(value){\n if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='body,version'||\n    typeof value.body!=='string'||value.body.length>200||!Number.isSafeInteger(value.version)||value.version<1)throw new HttpError(422,'BAD_INPUT');\n return {body:value.body,version:value.version};\n}\nexport async function inTenant(pool,user,tenant,action){\n if(!key.test(user)||!key.test(tenant))throw new HttpError(400,'BAD_ID');\n const db=await pool.connect();\n try{\n  await db.query('BEGIN');\n  // Values come from a verified server-side session and a separately checked membership.\n  await db.query(\"SELECT set_config('app.user_id',$1,true),set_config('app.tenant_id',$2,true)\",[user,tenant]);\n  const {rows}=await db.query('SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2',[tenant,user]);\n  if(rows.length!==1||!['viewer','editor','admin'].includes(rows[0].role))throw new HttpError(403,'TENANT_FORBIDDEN');\n  const result=await action(db,rows[0].role);await db.query('COMMIT');return result;\n }catch(error){await db.query('ROLLBACK');throw error;}\n finally{db.release();}\n}"
        },
        {
          "type": "paragraph",
          "text": "inTenant先从池借一个db连接，再BEGIN，使用参数化set_config设置当前用户与租户。这里user来自服务端令牌映射，tenant还要查membership。成员不存在或角色未知就拒绝，不依赖前端导航是否给这个租户入口。整个事务中的角色查询、文档操作、COMMIT/ROLLBACK都使用同一个db，而不是交给pool.query随机借连接。"
        },
        {
          "type": "paragraph",
          "text": "连接池会重复使用会话。如果把租户上下文SET成连接级变量，A请求释放连接后，B可能接着继承A。我们用事务局部配置，在成功和失败路径都结束事务，最后release；测试故意把池限制为一个连接，先用red，再在事务外查文档应为0行，再切blue只看到b1。这个实验比“每次请求新连接所以没出事”更能验证池复用边界。"
        },
        {
          "type": "paragraph",
          "text": "自定义GUC不是不可伪造的数据库身份。拥有应用SQL执行权的人可以改变它，所以RLS在本文是防止受控查询遗漏条件的一道兜底，前提是请求经过可信中间层、使用参数化SQL且不能执行任意语句。不能把应用账户、配置参数和所有权隔离混为一谈，更不能宣称它能抵御已完全控制应用进程的攻击者。"
        }
      ]
    },
    {
      "id": "rls",
      "title": "RLS怎样兜住漏掉租户条件的查询",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "sql",
          "filename": "examples/authorization-tenancy/schema.sql",
          "purpose": "全部RLS与授权配置：membership只看当前用户；documents对读写分别设置策略，WITH CHECK约束写入后的行；无策略/无列权限的动作保持拒绝。",
          "kind": "excerpt",
          "code": "ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;\nALTER TABLE memberships FORCE ROW LEVEL SECURITY;\nCREATE POLICY own_memberships ON memberships FOR SELECT TO atlas_app\n USING(user_id=current_setting('app.user_id',true));\nALTER TABLE documents ENABLE ROW LEVEL SECURITY;\nALTER TABLE documents FORCE ROW LEVEL SECURITY;\nCREATE POLICY visible_documents ON documents FOR SELECT TO atlas_app USING(\n tenant_id=current_setting('app.tenant_id',true)\n AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=documents.tenant_id AND\n   (documents.visibility='shared' OR documents.owner_id=m.user_id OR m.role='admin'))\n);\nCREATE POLICY writable_documents ON documents FOR UPDATE TO atlas_app USING(\n tenant_id=current_setting('app.tenant_id',true)\n AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=documents.tenant_id AND\n   m.role IN('editor','admin') AND (documents.owner_id=m.user_id OR m.role='admin'))\n) WITH CHECK(\n tenant_id=current_setting('app.tenant_id',true)\n AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=documents.tenant_id AND\n   m.role IN('editor','admin') AND (documents.owner_id=m.user_id OR m.role='admin'))\n);\nGRANT USAGE ON SCHEMA public TO atlas_app;\nGRANT SELECT ON memberships,documents TO atlas_app;\nGRANT UPDATE(body,version) ON documents TO atlas_app;\n-- No INSERT/DELETE, tenant/owner updates or membership administration is granted."
        },
        {
          "type": "paragraph",
          "text": "成员表策略只让当前用户看见自己的成员记录；文档SELECT策略要求tenant等于当前事务租户，并且当前成员具有共享、拥有者或管理员关系。UPDATE策略再要求editor/admin且符合拥有者规则。已有行用USING筛选，变更后的行用WITH CHECK检查；列级授权另外阻止改租户和拥有者。策略写出来还不够，必须真正ENABLE ROW LEVEL SECURITY，本例还显式FORCE。"
        },
        {
          "type": "paragraph",
          "text": "策略默认是permissive，多条同类型策略可能按OR合并；不要为调试留一个USING(true)再期待另一条宽松策略把它限制住。本例按命令分清SELECT和UPDATE，没有给INSERT/DELETE建许可，也没有授相应表权限。PostgreSQL的表所有者、超级用户和BYPASSRLS等例外要另查，TRUNCATE等表级操作也不是靠行过滤防护。"
        },
        {
          "type": "paragraph",
          "text": "我们专门执行一个忘写WHERE的SELECT：在sue/red上下文里只能得到a1、a2、e1；直接按外国ID b1更新得到0行；试图改tenant_id或成员role则是42501权限错误。它们测试的是实际数据库行为，和服务端是否隐藏按钮无关。RLS不是理由让应用故意不写筛选，正文查询仍保留显式tenant与关系条件，使逻辑可读并减少依赖单点配置。"
        }
      ]
    },
    {
      "id": "read",
      "title": "列表与单条读取必须遵循同一可见性规则",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/authorization-tenancy/service.mjs",
          "purpose": "读取与列表实际SQL：租户、拥有者/共享/角色都在数据库查询内完成，不返回全部行再让界面过滤。",
          "kind": "excerpt",
          "code": "export async function readDocument(pool,user,tenant,id){\n if(!key.test(id))throw new HttpError(400,'BAD_ID');\n return inTenant(pool,user,tenant,async(db,role)=>{\n  const {rows}=await db.query(`SELECT id,tenant_id,owner_id,visibility,body,version FROM documents\n    WHERE id=$1 AND tenant_id=$2 AND (owner_id=$3 OR visibility='shared' OR $4='admin')`,[id,tenant,user,role]);\n  if(rows.length!==1)throw new HttpError(404,'DOCUMENT_NOT_FOUND');return rows[0];\n });\n}\nexport async function listDocuments(pool,user,tenant){\n return inTenant(pool,user,tenant,async(db,role)=>(await db.query(`SELECT id,body,version FROM documents\n  WHERE tenant_id=$1 AND (owner_id=$2 OR visibility='shared' OR $3='admin') ORDER BY id`,[tenant,user,role])).rows);\n}"
        },
        {
          "type": "paragraph",
          "text": "alice读自己的私有a1成功；bob读同租户共享a2成功，读a1为404；bob的列表也只出现a2。sue虽然是red管理员，也不能把路径改成blue就看到b1；没有blue成员资格先返回403，留在red路径猜b1则返回404。这里区分“未加入所选租户”和“这个已获准租户内没有可访问资源”，并不对陌生文档ID透露其真实所属组织。"
        },
        {
          "type": "paragraph",
          "text": "404是对外错误策略，不意味着内部审计可以丢掉原因。正式系统通常需要记录主体、租户、动作、结果与请求关联ID，并避免把令牌、私有正文直接写日志。夹具只保留有上限的错误码/状态观察记录来验证不泄漏令牌，未声称交付完整审计、告警或法规合规系统。"
        }
      ]
    },
    {
      "id": "write",
      "title": "修改必须把授权条件放进产生效果的那条语句",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/authorization-tenancy/service.mjs",
          "purpose": "完整条件写入：只收body/version，角色检查后UPDATE仍带tenant、owner和version；只有仍具写权的资源才能获知版本冲突。",
          "kind": "excerpt",
          "code": "export async function updateDocument(pool,user,tenant,id,value){\n if(!key.test(id))throw new HttpError(400,'BAD_ID');const write=validateWrite(value);\n return inTenant(pool,user,tenant,async(db,role)=>{\n  if(!['editor','admin'].includes(role))throw new HttpError(403,'WRITE_FORBIDDEN');\n  const {rows}=await db.query(`UPDATE documents SET body=$1,version=version+1\n   WHERE id=$2 AND tenant_id=$3 AND version=$4 AND (owner_id=$5 OR $6='admin')\n   RETURNING id,body,version`,[write.body,id,tenant,write.version,user,role]);\n  if(rows.length===1)return rows[0];\n  // Only disclose a conflict to someone who is still authorized to write this exact resource.\n  const visible=await db.query(`SELECT 1 FROM documents WHERE id=$1 AND tenant_id=$2 AND (owner_id=$3 OR $4='admin')`,[id,tenant,user,role]);\n  if(!visible.rowCount)throw new HttpError(404,'DOCUMENT_NOT_FOUND');throw new HttpError(409,'VERSION_CONFLICT');\n });\n}"
        },
        {
          "type": "paragraph",
          "text": "一个常见漏洞是先SELECT检查拥有者，随后UPDATE只写WHERE id：中间归属变化或代码复用就可能绕过原来的判断。本文在实际UPDATE里再次限定租户、拥有者/管理员以及version，并由RLS复核。输入只允许body、version，不能把整个JSON对象直接展开进更新列，否则调用者会顺便修改owner、tenant或role。"
        },
        {
          "type": "paragraph",
          "text": "修改成功返回新版本。若版本已变，我们只对仍有该对象写权限的调用者返回409；无权猜另一个编辑者的私有对象时返回404，而不是用“版本过期”泄漏对象存在。viewer即使读到共享文档也没有写权限，先返回403。版本号解决丢更新冲突，授权条件解决能不能写，两者不能互相替代。"
        },
        {
          "type": "figure",
          "src": "figures/authorization-tenancy/mechanism.svg",
          "title": "从会话身份到资源写入，每一层都缩小权限",
          "alt": "会话只给主体；成员记录给租户角色；资源关系与版本进入UPDATE；受限角色和RLS在数据库再检查，blue管理员不自动拥有red权限",
          "caption": "会话只给主体；成员记录给租户角色；资源关系与版本进入UPDATE；受限角色和RLS在数据库再检查，blue管理员不自动拥有red权限；只描述本夹具职责，不把客户端限制替代服务端授权。"
        },
        {
          "type": "paragraph",
          "text": "降权和撤权不能永久封存在旧令牌的role里。本例令牌只映射user，每次请求从数据库读取当前成员资格；把alice从editor降到viewer后，同一令牌下次写入立即拒绝，删除bob成员记录后下次读取拒绝。这里说的是后续请求，不保证已经开始的事务被实时撤销：并发撤权涉及隔离快照、策略子查询和正在进行的操作，需要额外的锁定或版本协议。"
        }
      ]
    },
    {
      "id": "http",
      "title": "HTTP边界：把错误收口，但别吞掉授权判断",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/authorization-tenancy/server.mjs",
          "purpose": "完整请求体边界：限制1024原始字节，有界收集后严格UTF-8解码与JSON解析；不能逐网络块解码字符串。",
          "kind": "excerpt",
          "code": "async function input(req,onBodyChunk){\n if(!/^application\\/json(?:\\s*;|$)/i.test(req.headers['content-type']??''))throw new HttpError(415,'JSON_REQUIRED');\n let bytes=0;const chunks=[];const timer=setTimeout(()=>req.destroy(new Error('body timeout')),1500);\n try{for await(const chunk of req){bytes+=chunk.length;if(bytes>1024)throw new HttpError(413,'BODY_LIMIT');chunks.push(Buffer.from(chunk));onBodyChunk?.(chunk.length);}}\n finally{clearTimeout(timer);}\n try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new HttpError(400,'BAD_JSON');}\n}"
        },
        {
          "type": "paragraph",
          "text": "网络分片不保证落在字符边界。独立审稿发现逐块text+=Buffer会把“你好”切开的多字节序列变成替代字符，已经修为一次严格解码。新增真实HTTP测试在第一个汉字首字节后停住，等服务端收到再发送剩余数据，确认数据库正文原样保存；非法UTF-8则400，不静默损坏数据。观察回调只用于本地测试屏障，不是远程输入可指定的钩子。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/authorization-tenancy/server.mjs",
          "purpose": "完整HTTP入口与虚构会话夹具：读取Bearer映射主体、路由选择租户、读写调用统一服务；未知方法拒绝，敏感响应no-store。",
          "kind": "excerpt",
          "code": "export async function startServer(pool,{onBodyChunk}={}){\n const sessions=new Map(),audit=[]; // Fictional bounded test principals, not a production login system.\n function issue(user){const token=randomBytes(24).toString('base64url');sessions.set(token,user);return token;}\n function json(res,status,value){if(res.destroyed)return;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));}\n const server=createServer((req,res)=>{\n  req.on('error',()=>{});\n  void handle(req,res).catch(error=>{\n   const status=error instanceof HttpError?error.status:500,code=error instanceof HttpError?error.message:'INTERNAL';\n   if(audit.length>=100)audit.shift();audit.push({method:req.method,status,code});\n   json(res,status,{error:code});\n  });\n });\n server.requestTimeout=3000;server.headersTimeout=3000;\n async function handle(req,res){\n  const match=/^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization??''),user=match&&sessions.get(match[1]);\n  if(!user)throw new HttpError(401,'AUTH_REQUIRED');\n  const url=new URL(req.url,'http://loopback.invalid'),route=/^\\/tenants\\/([a-z][a-z0-9-]{0,31})\\/docs(?:\\/([a-z][a-z0-9-]{0,31}))?$/.exec(url.pathname);\n  if(!route)throw new HttpError(404,'NOT_FOUND');\n  const [,tenant,id]=route;\n  if(req.method==='GET'){json(res,200,id?await readDocument(pool,user,tenant,id):await listDocuments(pool,user,tenant));return;}\n  if(req.method==='PATCH'&&id){json(res,200,await updateDocument(pool,user,tenant,id,await input(req,onBodyChunk)));return;}\n  throw new HttpError(405,'METHOD_NOT_ALLOWED');\n }\n server.listen(0,'127.0.0.1');await once(server,'listening');\n return {base:`http://127.0.0.1:${server.address().port}`,issue,revoke:token=>sessions.delete(token),audit,\n  async close(){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});sessions.clear();}};\n}"
        },
        {
          "type": "paragraph",
          "text": "授权服务抛出的HttpError保留401、403、404、409等已知分类；数据库内部异常对外收敛成INTERNAL，不把SQL、连接信息或策略细节拼进响应。输入体限制1024字节且有读取期限，实际字段另检查；保护资源不能因为拒绝路径就允许无限读取请求体。示例只覆盖小型JSON正文，不是完整反滥用网关。"
        },
        {
          "type": "paragraph",
          "text": "此例用显式Bearer头，不会由浏览器像Cookie那样自动附带给任意目标请求，因此不能照搬会话文章的Cookie CSRF流程；若以后改成Cookie认证，必须重新评估Origin、CSRF、SameSite与CORS。令牌存放、过期、密钥轮换、跨服务委托同样需要单独设计。我们没有因为这里验证授权通过，就宣称整个身份系统已经达到生产要求。"
        }
      ]
    },
    {
      "id": "verification",
      "title": "真实拒绝用例比一条成功请求更能说明权限边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "filename": "终端 · 本地复现",
          "purpose": "下载ZIP解压后，在Node22.12环境运行；测试应11项通过。夹具建立私有数据库后自动清理。",
          "kind": "runnable",
          "code": "cd authorization-tenancy\nnpm ci --ignore-scripts\nnpm test\n# tests 11; pass 11; fail 0"
        },
        {
          "type": "paragraph",
          "text": "实际在macOS14.5、Node22.12.0、pg8.13.1、PostgreSQL17.4通过11项测试，包含一个父测试与10组场景。测试不仅请求成功：还包含伪造身份、客户自称管理员、跨租户路径、同租户私人对象、列表过滤、查看者写入、批量赋值、陈旧版本、下一请求撤权、RLS宽查询、列权限、单连接池上下文清理和令牌撤销。"
        },
        {
          "type": "paragraph",
          "text": "数据库使用真实受限LOGIN角色连接，而非SET ROLE后仍把超级用户当应用；各连接显式指向私有socket与55443，无默认5432连接。清洁安装和schema初始化步骤在ZIP中，测试结束自动关闭服务、池与数据库。浏览器只负责发HTTP，决定性授权在后端，所以这组Node集成测试可直接验证服务端边界；未验证跨进程部署、连接池代理或生产身份提供商。"
        },
        {
          "type": "paragraph",
          "text": "你可以从一个小改动检查自己的理解：让red增加一种auditor角色。不要只把字符串塞进允许角色列表；先规定它能读什么、能否写，再更新服务层、RLS与拒绝测试。只有矩阵、SQL效果和测试证据一起变化，角色扩展才是明确的新权限，而不是某个else分支意外放行。"
        },
        {
          "type": "reference",
          "title": "OWASP：Authorization Cheat Sheet",
          "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：行安全策略",
          "url": "https://www.postgresql.org/docs/17/ddl-rowsecurity.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "PostgreSQL17：CREATE POLICY",
          "url": "https://www.postgresql.org/docs/17/sql-createpolicy.html",
          "note": ""
        },
        {
          "type": "reference",
          "title": "node-postgres：事务必须使用同一连接",
          "url": "https://node-postgres.com/features/transactions",
          "note": ""
        },
        {
          "type": "reference",
          "title": "node-postgres：参数化查询",
          "url": "https://node-postgres.com/features/queries",
          "note": ""
        }
      ]
    }
  ]
};
export default article;
