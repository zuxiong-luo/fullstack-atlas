import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "agent-context-memory",
  "topic": "ai",
  "title": "Agent 工程 05：显式记忆、用户隔离与删除边界",
  "description": "实现由用户主动维护的 SQLite 记忆，区分请求上下文、恢复快照和长期记忆，并沿真实查询证明用户隔离。",
  "minutes": 45,
  "tags": [
    "AI",
    "Agent",
    "Memory",
    "SQLite",
    "用户隔离",
    "删除"
  ],
  "scope": "Agent workshop v2 双语言本地知识库助手；默认确定性 mock。核验 macOS 14.5 x64、Python 3.12.14 / SQLite 3.53.1、Node.js 22.12.0 / SQLite 3.47.0。代码为本仓库教学实现，非外部框架源码；真实模型质量、生产认证与容器未验收。",
  "prerequisites": [
    "HTTP JSON 请求与 async/await",
    "第 3 章的授权检索、模型适配和结构化结果校验"
  ],
  "kind": "series",
  "status": "review",
  "verifiedAt": "2026-10-23",
  "versions": [
    "Python 3.12.14 / FastAPI 0.161.1 / httpx 0.28.1",
    "Node.js 22.12.0 / Fastify 5.12.7 / TypeScript 5.7.2",
    "shared/v2/CONTRACT.md；章节能力由 CHAPTER=2..8 开放"
  ],
  "labMinutes": 45,
  "examples": [
    {
      "label": "双语言完整项目与共享用例 ZIP",
      "path": "agent-workshop.zip"
    },
    {
      "label": "Python v2 运行说明",
      "path": "agent-workshop/python-v2/README.md"
    },
    {
      "label": "TypeScript v2 运行说明",
      "path": "agent-workshop/typescript-v2/README.md"
    }
  ],
  "sections": [
    {
      "id": "s12-292236",
      "title": "记忆是什么：先把三种保存的数据分开",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Agent 里的记忆，是为了未来请求而保留、能够再次读取的信息。例如“我希望示例优先使用 TypeScript”，可以由用户明确保存，之后查看、修改或删除。它和模型当前看到的提示词不是同一个对象：数据库负责保存，程序决定是否读取，提示词组装才决定是否发送给模型。保存成功并不等于模型已经学会。"
        },
        {
          "type": "paragraph",
          "text": "本章在上一章的 SQLite 项目里增加一张 memory 表和三类 HTTP 操作：写入、列表、删除。我们选择显式记忆：只有用户主动 POST 的文本才存入，模型回答不会偷偷写入。默认问答也不会自动读取这张表。先把管理与隔离做可靠，再决定哪些内容值得用于生成。"
        },
        {
          "type": "table",
          "headers": [
            "数据",
            "生命周期与用途",
            "当前实现是否用于生成"
          ],
          "rows": [
            [
              "本次 question + evidence",
              "本次请求的输入与已授权证据",
              "是"
            ],
            [
              "runs.evidence 检查点",
              "任务恢复时复用的证据快照",
              "resume 时是"
            ],
            [
              "memory(owner,id,text)",
              "用户显式管理、跨请求保留的信息",
              "默认不自动加入问答"
            ]
          ]
        },
        {
          "type": "figure",
          "src": "figures/agent-context-memory/boundaries.svg",
          "title": "保存记忆与发送给模型是两条路径",
          "alt": "授权用户写入 memory 并按 owner 查看和删除；问答从 question 到授权检索再到 provider，没有从 memory 自动进入 provider 的箭头。",
          "caption": "依据 app、Store 与 Service 的实际调用关系；各框是独立数据路径，问答没有从 memory 读取并传给 provider 的通路。"
        }
      ]
    },
    {
      "id": "s13-350593",
      "title": "记忆结构与身份：同一个 pref 可以属于两个人",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "表只有 owner、id、text 三列，主键是 (owner,id)。owner 来自服务端认证映射，id 是用户管理这条记忆的稳定名字。Alice 和 Bob 都可以有 pref；Alice 再写 pref 更新自己的文本，Bob 的行不受影响。这个结构适合小型显式偏好记录，尚未存来源、过期时间、向量或审计历史。"
        },
        {
          "type": "paragraph",
          "text": "这里最关键的判断不在“id 看起来难不难猜”，而在每条 SELECT、UPDATE、DELETE 是否把 owner 一起放入条件。HTTP 不接受客户端提交 owner 字段，公开教学令牌 demo-alice / demo-bob 只用于把两个主体的行为演示清楚。真实站点仍需要可信登录、令牌验证与撤销。"
        },
        {
          "type": "code",
          "code": "\"\"\"Shared v2 contract: strict shape, Unicode code point lengths, explicit errors.\"\"\"\nimport json\nimport re\nfrom pathlib import Path\nSHARED=Path(__file__).resolve().parent.parent/'shared'/'v2'\ndef read_shared(name):\n    return json.loads((SHARED/name).read_text(encoding='utf-8'))\nDOCUMENTS=read_shared('documents.json')\nclass ServiceError(Exception):\n    def __init__(self,status,code,message=None):\n        self.status,self.code,self.message=status,code,message or code\n        super().__init__(code)\ndef fail(status,code):\n    raise ServiceError(status,code)\ndef strict_json(raw):\n    def bad(value): raise ValueError('Invalid JSON constant')\n    if isinstance(raw,(bytes,bytearray)):raw=raw.decode('utf-8')\n    return json.loads(raw,parse_constant=bad)\ndef exact(value,keys):\n    if not isinstance(value,dict) or set(value)!=set(keys):fail(400,'INVALID_REQUEST')\n    return value\ndef trim(value):return value.strip('\\u0009\\u000a\\u000b\\u000c\\u000d\\u0020\\u00a0\\u1680\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff')\ndef well_formed(value):return all(not 0xD800<=ord(char)<=0xDFFF for char in value)\ndef text(value,maximum=2000):\n    if not isinstance(value,str) or not well_formed(value):fail(400,'INVALID_REQUEST')\n    value=trim(value)\n    if not 1<=len(value)<=maximum:fail(400,'INVALID_REQUEST')\n    return value\ndef identifier(value):\n    value=text(value,64)\n    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',value):fail(400,'INVALID_REQUEST')\n    return value\ndef question_body(raw):return {'question':text(exact(raw,['question'])['question'])}\ndef run_body(raw):\n    body=exact(raw,['request_id','question']);return {'request_id':identifier(body['request_id']),'question':text(body['question'])}\ndef memory_body(raw):\n    body=exact(raw,['id','text']);return {'id':identifier(body['id']),'text':text(body['text'])}\ndef evidence_of(documents):return [{k:d[k] for k in ('id','title','text')} for d in documents]\ndef parse_answer(raw,evidence):\n    try:value=strict_json(raw)\n    except (ValueError,TypeError,UnicodeError):fail(502,'MODEL_FORMAT_ERROR')\n    if not isinstance(value,dict) or set(value)!={'answer','citations'}:fail(502,'MODEL_SCHEMA_ERROR')\n    answer=value['answer'];citations=value['citations']\n    if not isinstance(answer,str) or not well_formed(answer) or not 1<=len(trim(answer))<=4000 or not isinstance(citations,list) or any(not isinstance(x,str) or not well_formed(x) or not x for x in citations) or len(set(citations))!=len(citations):fail(502,'MODEL_SCHEMA_ERROR')\n    if not set(citations)<={d['id'] for d in evidence}:fail(502,'UNSUPPORTED_CITATION')\n    return {'answer':trim(answer),'citations':citations}\n",
          "language": "python",
          "filename": "python-v2/contracts.py",
          "purpose": "严格 id/text 与额外字段校验（Python）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {existsSync,readFileSync} from 'node:fs';\nexport const shared = [new URL('../../shared/v2/',import.meta.url),new URL('../../../shared/v2/',import.meta.url)].find(url=>existsSync(new URL('CONTRACT.md',url)))!;\nif(!shared)throw new Error('shared/v2 contract not found');\nexport const readShared=(file:string):any=>JSON.parse(readFileSync(new URL(file,shared),'utf8'));\nexport type Document={id:string;owner:string;title:string;text:string;keywords:string[]};\nexport type Evidence=Pick<Document,'id'|'title'|'text'>;\nexport type Input={question:string;evidence:Evidence[]};\nexport type Answer={answer:string;citations:string[]};\nexport const documents:Document[]=readShared('documents.json');\nexport const cp=(text:string)=>Array.from(text).length;\nexport const wellFormed=(value:string)=>Array.from(value).every(char=>{const point=char.codePointAt(0)!;return point<0xD800||point>0xDFFF});\nexport class ServiceError extends Error {constructor(public status:number,public code:string,message=code){super(message);}}\nexport const fail=(status:number,code:string):never=>{throw new ServiceError(status,code)};\nexport const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);\nexport function exact(value:unknown,keys:string[]):Record<string,unknown>{\n if(!object(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(400,'INVALID_REQUEST');\n return value as Record<string,unknown>;\n}\nexport function text(value:unknown,max=2000):string {\n if(typeof value!=='string')fail(400,'INVALID_REQUEST');const result=(value as string).trim();\n if(!wellFormed(result)||cp(result)<1||cp(result)>max)fail(400,'INVALID_REQUEST');return result;\n}\nexport function id(value:unknown):string {const result=text(value,64);if(!/^[A-Za-z0-9_-]{1,64}$/.test(result))fail(400,'INVALID_REQUEST');return result;}\nexport function questionBody(raw:unknown){const body=exact(raw,['question']);return{question:text(body.question)}}\nexport function runBody(raw:unknown){const body=exact(raw,['request_id','question']);return{request_id:id(body.request_id),question:text(body.question)}}\nexport function memoryBody(raw:unknown){const body=exact(raw,['id','text']);return{id:id(body.id),text:text(body.text)}}\nexport function parseAnswer(raw:string,evidence:Evidence[]):Answer {\n let value:unknown;try{value=JSON.parse(raw)}catch{fail(502,'MODEL_FORMAT_ERROR')}\n if(!object(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'answer')||!Object.hasOwn(value,'citations')||typeof value.answer!=='string'||!value.answer.trim()||!wellFormed(value.answer)||cp(value.answer.trim())>4000||!Array.isArray(value.citations)||value.citations.some(item=>typeof item!=='string'||!item||!wellFormed(item))||new Set(value.citations).size!==value.citations.length)fail(502,'MODEL_SCHEMA_ERROR');\n const answer=value as {answer:string;citations:string[]};const allowed=new Set(evidence.map(d=>d.id));\n if(answer.citations.some(item=>!allowed.has(item)))fail(502,'UNSUPPORTED_CITATION');\n return{answer:answer.answer.trim(),citations:answer.citations};\n}\nexport const evidenceOf=(docs:Document[]):Evidence[]=>docs.map(({id,title,text})=>({id,title,text}));\n",
          "language": "typescript",
          "filename": "typescript-v2/src/contracts.ts",
          "purpose": "严格 id/text 与额外字段校验（TypeScript）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "\"\"\"Short SQLite transactions claim a lease; external model calls hold no transaction.\"\"\"\nimport json\nimport sqlite3\nimport time\nfrom pathlib import Path\nfrom contracts import fail\nclass Store:\n    def __init__(self,path=':memory:',now=None):\n        self.now=now or (lambda:int(time.time()*1000))\n        if path!=':memory:':Path(path).parent.mkdir(parents=True,exist_ok=True)\n        self.db=sqlite3.connect(path,timeout=1,isolation_level=None,check_same_thread=False)\n        self.db.row_factory=sqlite3.Row\n        self.db.executescript('''PRAGMA busy_timeout=1000;PRAGMA journal_mode=WAL;\n        CREATE TABLE IF NOT EXISTS runs(owner TEXT NOT NULL,request_id TEXT NOT NULL,question TEXT NOT NULL,status TEXT NOT NULL,checkpoint TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '[]',answer TEXT,citations TEXT,epoch INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,request_id));\n        CREATE TABLE IF NOT EXISTS memory(owner TEXT NOT NULL,id TEXT NOT NULL,text TEXT NOT NULL,PRIMARY KEY(owner,id));''')\n    def _tx(self,work):\n        self.db.execute('BEGIN IMMEDIATE')\n        try:result=work();self.db.execute('COMMIT');return result\n        except BaseException:self.db.execute('ROLLBACK');raise\n    def get(self,owner,id):\n        row=self.db.execute('SELECT * FROM runs WHERE owner=? AND request_id=?',(owner,id)).fetchone()\n        return dict(row) if row else None\n    def ensure(self,owner,id,question):\n        def operation():\n            found=self.get(owner,id)\n            if found:\n                if found['question']!=question:fail(409,'IDEMPOTENCY_CONFLICT')\n                return found\n            self.db.execute(\"INSERT INTO runs(owner,request_id,question,status,checkpoint) VALUES(?,?,?,'queued','queued')\",(owner,id,question))\n            return self.get(owner,id)\n        return self._tx(operation)\n    def claim(self,owner,id,lease_ms):\n        def operation():\n            found=self.get(owner,id)\n            if not found:fail(404,'RUN_NOT_FOUND')\n            if found['status']=='completed':return found\n            now=self.now()\n            if found['lease_until']>now:fail(409,'RUN_BUSY')\n            self.db.execute('UPDATE runs SET epoch=epoch+1,lease_until=? WHERE owner=? AND request_id=?',(now+lease_ms,owner,id))\n            return self.get(owner,id)\n        return self._tx(operation)\n    def retrieved(self,run,evidence):\n        count=self.db.execute(\"UPDATE runs SET status='retrieved',checkpoint='retrieved',evidence=? WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?\",(json.dumps(evidence,ensure_ascii=True),run['owner'],run['request_id'],run['epoch'],self.now())).rowcount\n        if not count:fail(409,'STALE_RUN')\n    def complete(self,run,answer):\n        count=self.db.execute(\"UPDATE runs SET status='completed',checkpoint='done',answer=?,citations=?,lease_until=0 WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?\",(answer['answer'],json.dumps(answer['citations']),run['owner'],run['request_id'],run['epoch'],self.now())).rowcount\n        if not count:fail(409,'STALE_RUN')\n    def release(self,run):self.db.execute('UPDATE runs SET lease_until=0 WHERE owner=? AND request_id=? AND epoch=?',(run['owner'],run['request_id'],run['epoch']))\n    def put_memory(self,owner,id,text):\n        self.db.execute('INSERT INTO memory(owner,id,text) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET text=excluded.text',(owner,id,text));return {'id':id,'text':text}\n    def memory(self,owner):return [dict(row) for row in self.db.execute('SELECT id,text FROM memory WHERE owner=? ORDER BY id',(owner,))]\n    def delete_memory(self,owner,id):\n        if not self.db.execute('DELETE FROM memory WHERE owner=? AND id=?',(owner,id)).rowcount:fail(404,'MEMORY_NOT_FOUND')\n    def close(self):self.db.close()\ndef public_run(run):return {'request_id':run['request_id'],'status':run['status'],'answer':run['answer'],'citations':json.loads(run['citations']) if run['citations'] else [],'checkpoint':run['checkpoint']}\n",
          "language": "python",
          "filename": "python-v2/store.py",
          "purpose": "完整表结构、owner 条件查询、upsert 与删除（Python）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {DatabaseSync} from 'node:sqlite';\nimport {fail,type Answer,type Evidence} from './contracts.js';\nexport type Run={owner:string;request_id:string;question:string;status:'queued'|'retrieved'|'completed';checkpoint:'queued'|'retrieved'|'done';evidence:string;answer:string|null;citations:string|null;epoch:number;lease_until:number};\nexport class Store {\n readonly db:DatabaseSync;\n constructor(path:string=':memory:',readonly now:()=>number=Date.now){\n  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA busy_timeout=1000; PRAGMA journal_mode=WAL;\n   CREATE TABLE IF NOT EXISTS runs(owner TEXT NOT NULL,request_id TEXT NOT NULL,question TEXT NOT NULL,status TEXT NOT NULL,checkpoint TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '[]',answer TEXT,citations TEXT,epoch INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,request_id));\n   CREATE TABLE IF NOT EXISTS memory(owner TEXT NOT NULL,id TEXT NOT NULL,text TEXT NOT NULL,PRIMARY KEY(owner,id));`);\n }\n private tx<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result}catch(error){this.db.exec('ROLLBACK');throw error}}\n get(owner:string,id:string):Run|undefined{return this.db.prepare('SELECT * FROM runs WHERE owner=? AND request_id=?').get(owner,id) as Run|undefined;}\n ensure(owner:string,id:string,question:string):Run {\n  return this.tx(()=>{const found=this.get(owner,id);if(found){if(found.question!==question)fail(409,'IDEMPOTENCY_CONFLICT');return found;}\n   this.db.prepare(\"INSERT INTO runs(owner,request_id,question,status,checkpoint) VALUES(?,?,?,'queued','queued')\").run(owner,id,question);return this.get(owner,id)!;\n  });\n }\n claim(owner:string,id:string,leaseMs:number):Run {\n  return this.tx(()=>{const found=this.get(owner,id);if(!found)fail(404,'RUN_NOT_FOUND');if(found!.status==='completed')return found!;\n   if(found!.lease_until>this.now())fail(409,'RUN_BUSY');\n   this.db.prepare('UPDATE runs SET epoch=epoch+1,lease_until=? WHERE owner=? AND request_id=?').run(this.now()+leaseMs,owner,id);return this.get(owner,id)!;\n  });\n }\n retrieved(run:Run,evidence:Evidence[]) {\n  const changed=this.db.prepare(\"UPDATE runs SET status='retrieved',checkpoint='retrieved',evidence=? WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?\").run(JSON.stringify(evidence),run.owner,run.request_id,run.epoch,this.now()).changes;\n  if(!changed)fail(409,'STALE_RUN');\n }\n complete(run:Run,answer:Answer){\n  const changed=this.db.prepare(\"UPDATE runs SET status='completed',checkpoint='done',answer=?,citations=?,lease_until=0 WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?\").run(answer.answer,JSON.stringify(answer.citations),run.owner,run.request_id,run.epoch,this.now()).changes;\n  if(!changed)fail(409,'STALE_RUN');\n }\n release(run:Run){this.db.prepare('UPDATE runs SET lease_until=0 WHERE owner=? AND request_id=? AND epoch=?').run(run.owner,run.request_id,run.epoch);}\n putMemory(owner:string,id:string,text:string){this.db.prepare('INSERT INTO memory(owner,id,text) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET text=excluded.text').run(owner,id,text);return{id,text};}\n memory(owner:string){return this.db.prepare('SELECT id,text FROM memory WHERE owner=? ORDER BY id').all(owner) as {id:string;text:string}[];}\n deleteMemory(owner:string,id:string){if(!this.db.prepare('DELETE FROM memory WHERE owner=? AND id=?').run(owner,id).changes)fail(404,'MEMORY_NOT_FOUND');}\n close(){this.db.close();}\n}\nexport function publicRun(run:Run){return{request_id:run.request_id,status:run.status,answer:run.answer,citations:run.citations?JSON.parse(run.citations):[],checkpoint:run.checkpoint};}\n",
          "language": "typescript",
          "filename": "typescript-v2/src/store.ts",
          "purpose": "完整表结构、owner 条件查询、upsert 与删除（TypeScript）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入两次写入看 SQL：第一次 (alice,pref,TypeScript first) 插入；第二次 (alice,pref,Python first) 命中复合主键，用 excluded.text 覆盖文本。GET 只选 owner=alice 且按 id 排序；DELETE 的 WHERE 也必须同时含 owner 与 id。删除零行统一为 MEMORY_NOT_FOUND，避免把“别人的存在状态”当成查询结果透露出去。"
        }
      ]
    },
    {
      "id": "memory-http",
      "title": "从认证到数据库：完整 HTTP 调用者",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "应用入口先确定 owner，再解析大小受限的 UTF-8 JSON，最后执行 memoryBody。body 加上 owner=bob 会因为额外字段被拒绝，而不是覆盖当前身份。空字符串、过长文本、非法 ID 与孤立 Unicode 代理字符也不会进入数据库。当前 memory.text 上限为 2000 个 Unicode 码点；合法 emoji 算一个码点，不按 UTF-16 code unit 误计。"
        },
        {
          "type": "code",
          "code": "\"\"\"FastAPI HTTP boundary; all backend state remains outside GitHub Pages.\"\"\"\nimport json\nimport os\nfrom contextlib import asynccontextmanager\nfrom fastapi import FastAPI,Request\nfrom fastapi.responses import Response\nfrom contracts import ServiceError,fail,strict_json,identifier,question_body,run_body,memory_body\nfrom service import Service\nfrom store import Store,public_run\nfrom tools import execute_tool\nfrom providers import provider_from_env\nMAX_REQUEST_BYTES=64*1024\ndef send(body,status=200):return Response(json.dumps(body,ensure_ascii=True),status_code=status,media_type='application/json')\nasync def read_body(request):\n    data=bytearray()\n    async for chunk in request.stream():\n        if len(data)+len(chunk)>MAX_REQUEST_BYTES:fail(413,'PAYLOAD_TOO_LARGE')\n        data.extend(chunk)\n    if not data:return None\n    if request.headers.get('content-type','').split(';',1)[0].strip().lower()!='application/json':fail(400,'INVALID_REQUEST')\n    try:return strict_json(data)\n    except (ValueError,TypeError,UnicodeError):fail(400,'INVALID_REQUEST')\ndef create_app(service=None):\n    selected=service or Service(chapter=int(os.getenv('CHAPTER','8')),store=Store(os.getenv('SQLITE_PATH','data/agent.sqlite')),provider=provider_from_env(),timeout_ms=int(os.getenv('MODEL_TIMEOUT_MS','3000')),lease_ms=int(os.getenv('LEASE_MS','10000')),max_concurrent=int(os.getenv('MAX_CONCURRENT','2')),max_context_chars=int(os.getenv('MAX_CONTEXT_CHARS','12000')),max_model_calls=int(os.getenv('MAX_MODEL_CALLS','1')))\n    @asynccontextmanager\n    async def lifespan(app):\n        yield\n        await selected.close()\n    app=FastAPI(title='Agent workshop chapters 02-08',docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)\n    app.state.service=selected\n    @app.api_route('/{path:path}',methods=['GET','POST','DELETE','PUT','PATCH','OPTIONS','HEAD'])\n    async def endpoint(path,request:Request):\n        try:\n            method=request.method;url='/'+path\n            if url=='/health' and method=='GET':return send({'status':'ok','chapter':selected.chapter})\n            owner={'Bearer demo-alice':'alice','Bearer demo-bob':'bob'}.get(request.headers.get('authorization'))\n            if not owner:fail(401,'UNAUTHORIZED')\n            body=await read_body(request) if method=='POST' else None\n            if url=='/v2/tools' and method=='POST' and selected.chapter>=2:return send({'ok':True,'result':execute_tool(owner,body)})\n            if url=='/v2/answers' and method=='POST' and selected.chapter>=3:return send({'ok':True,'result':await selected.answer(owner,question_body(body)['question'])})\n            if url=='/v2/runs' and method=='POST' and selected.chapter>=4:\n                incoming=run_body(body);return send({'ok':True,'run':await selected.run(owner,incoming['request_id'],incoming['question'])})\n            parts=url.split('/')\n            if len(parts)==4 and parts[1:3]==['v2','runs'] and method=='GET' and selected.chapter>=4:\n                run=selected.store.get(owner,identifier(parts[3]))\n                if not run:fail(404,'RUN_NOT_FOUND')\n                return send({'ok':True,'run':public_run(run)})\n            if len(parts)==5 and parts[1:3]==['v2','runs'] and parts[4]=='resume' and method=='POST' and selected.chapter>=4:\n                if body is not None:fail(400,'INVALID_REQUEST')\n                return send({'ok':True,'run':await selected.run(owner,identifier(parts[3]))})\n            if url=='/v2/memory' and selected.chapter>=5:\n                if method=='GET':return send({'ok':True,'result':selected.store.memory(owner)})\n                if method=='POST':\n                    incoming=memory_body(body);return send({'ok':True,'result':selected.store.put_memory(owner,incoming['id'],incoming['text'])})\n            if len(parts)==4 and parts[1:3]==['v2','memory'] and method=='DELETE' and selected.chapter>=5:\n                selected.store.delete_memory(owner,identifier(parts[3]));return send({'ok':True,'deleted':True})\n            fail(404,'ROUTE_NOT_FOUND')\n        except ServiceError as error:return send({'ok':False,'error':{'code':error.code,'message':error.message}},error.status)\n        except Exception:return send({'ok':False,'error':{'code':'INTERNAL_ERROR','message':'INTERNAL_ERROR'}},500)\n    return app\n",
          "language": "python",
          "filename": "python-v2/app.py",
          "purpose": "完整鉴权、章门槛、写入、读取与删除入口（Python）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import Fastify from 'fastify';\nimport {Service,type Options} from './service.js';\nimport {ServiceError,fail,id,memoryBody,questionBody,runBody} from './contracts.js';\nimport {executeTool} from './tools.js';\nimport {publicRun} from './store.js';\nexport function buildApp(options:Options={}){\n const service=new Service(options),app=Fastify({bodyLimit:64*1024,logger:false});\n app.removeAllContentTypeParsers();\n app.addContentTypeParser('application/json',{parseAs:'buffer'},(_request,body,done)=>{\n  try{const bytes=body as Buffer;done(null,bytes.length?JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)):undefined)}\n  catch{done(new ServiceError(400,'INVALID_REQUEST'),undefined)}\n });\n app.decorateRequest('owner','');\n const owner=(request:unknown)=>(request as {owner:string}).owner;\n app.addHook('onRequest',async request=>{\n  if(request.routeOptions.url==='/health')return;\n  const identity=new Map([['Bearer demo-alice','alice'],['Bearer demo-bob','bob']]).get(request.headers.authorization??'');\n  if(!identity)fail(401,'UNAUTHORIZED');(request as unknown as {owner:string}).owner=identity!;\n });\n app.setErrorHandler((error,_request,reply)=>{\n  const err=error as Error&{code?:string;statusCode?:number};\n  const known=error instanceof ServiceError?error:err.code==='FST_ERR_CTP_BODY_TOO_LARGE'?new ServiceError(413,'PAYLOAD_TOO_LARGE'):err.statusCode===400||err.code?.startsWith('FST_ERR_CTP')?new ServiceError(400,'INVALID_REQUEST'):new ServiceError(500,'INTERNAL_ERROR');\n  reply.code(known.status).send({ok:false,error:{code:known.code,message:known.message}});\n });\n app.setNotFoundHandler((_req,reply)=>reply.code(404).send({ok:false,error:{code:'ROUTE_NOT_FOUND',message:'ROUTE_NOT_FOUND'}}));\n app.get('/health',async()=>({status:'ok',chapter:service.chapter}));\n if(service.chapter>=2)app.post('/v2/tools',async request=>({ok:true,result:executeTool(owner(request),request.body)}));\n if(service.chapter>=3)app.post('/v2/answers',async request=>({ok:true,result:await service.answer(owner(request),questionBody(request.body).question)}));\n if(service.chapter>=4){\n  app.post('/v2/runs',async request=>{const body=runBody(request.body);return{ok:true,run:await service.run(owner(request),body.request_id,body.question)}});\n  app.get('/v2/runs/:id',async request=>{const run=service.store.get(owner(request),id((request.params as {id:string}).id));if(!run)fail(404,'RUN_NOT_FOUND');return{ok:true,run:publicRun(run!)}});\n  app.post('/v2/runs/:id/resume',async request=>{if(request.body!==undefined&&request.body!==null)fail(400,'INVALID_REQUEST');return{ok:true,run:await service.run(owner(request),id((request.params as {id:string}).id))}});\n }\n if(service.chapter>=5){\n  app.post('/v2/memory',async request=>{const body=memoryBody(request.body);return{ok:true,result:service.store.putMemory(owner(request),body.id,body.text)}});\n  app.get('/v2/memory',async request=>({ok:true,result:service.store.memory(owner(request))}));\n  app.delete('/v2/memory/:id',async request=>{service.store.deleteMemory(owner(request),id((request.params as {id:string}).id));return{ok:true,deleted:true}});\n }\n app.addHook('onClose',async()=>service.store.close());\n return{app,service};\n}\n",
          "language": "typescript",
          "filename": "typescript-v2/src/app.ts",
          "purpose": "完整鉴权、章门槛、写入、读取与删除入口（TypeScript）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这套 API 直接接受用户显式文字，没有“模型建议写入”的通路。如果未来让模型提议记忆，也应把提议和用户确认分开保存：模型返回“用户已同意”并不能改变授权事实。当前代码没有这个审批系统，因此文章只对眼前已经实现的三类操作作保证。"
        }
      ]
    },
    {
      "id": "memory-run",
      "title": "走一遍真实输入：写、改、跨用户读、删",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "# 从仓库根目录开始；两个服务任选一个，另开终端发请求。\ncd examples/agent-workshop/python-v2\npython3.12 -m venv .venv\n.venv/bin/python -m pip install -r requirements.lock\nCHAPTER=5 SQLITE_PATH=data/chapter5.sqlite PORT=8002 .venv/bin/python server.py\n\n# TypeScript：在另一个终端从仓库根目录开始\ncd examples/agent-workshop/typescript-v2\nnpm ci\nnpm run build\nCHAPTER=5 DATABASE_PATH=data/chapter5.sqlite PORT=4340 npm start",
          "language": "bash",
          "purpose": "启动第 5 章；Node 内置 SQLite 实验开关已经放在 npm scripts 中",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "# 以下请求都发给 Python；改端口 4340 可执行同一套 TypeScript 行为。\ncurl -s http://127.0.0.1:8002/v2/memory  -H 'Authorization: Bearer demo-alice' -H 'Content-Type: application/json'  --data '{\"id\":\"pref\",\"text\":\"TypeScript first\"}'\ncurl -s http://127.0.0.1:8002/v2/memory  -H 'Authorization: Bearer demo-alice' -H 'Content-Type: application/json'  --data '{\"id\":\"pref\",\"text\":\"Python first\"}'\ncurl -s http://127.0.0.1:8002/v2/memory -H 'Authorization: Bearer demo-alice'\ncurl -s -X DELETE http://127.0.0.1:8002/v2/memory/pref -H 'Authorization: Bearer demo-bob'\ncurl -s -X DELETE http://127.0.0.1:8002/v2/memory/pref -H 'Authorization: Bearer demo-alice'\ncurl -s http://127.0.0.1:8002/v2/memory -H 'Authorization: Bearer demo-alice'\n",
          "language": "bash",
          "purpose": "在同一 ID 上验证更新、owner 隔离及删除",
          "kind": "runnable"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "数据库变化",
            "预期 HTTP JSON 关键结果"
          ],
          "rows": [
            [
              "Alice 首次写 pref",
              "插入 Alice 一行",
              "200 result={id:pref,text:TypeScript first}"
            ],
            [
              "Alice 再写 pref",
              "更新同一行 text",
              "200 result={id:pref,text:Python first}"
            ],
            [
              "Alice GET",
              "无变化",
              "200 result=[{id:pref,text:Python first}]"
            ],
            [
              "Bob DELETE Alice 的 pref",
              "零行变化",
              "404 MEMORY_NOT_FOUND"
            ],
            [
              "Alice DELETE pref",
              "删除 Alice 的这一行",
              "200 {ok:true,deleted:true}"
            ],
            [
              "Alice 再 GET",
              "仍无记录",
              "200 {ok:true,result:[]}"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "列表返回值是数组而不是把记忆混入所有聊天历史。这个接口可以独立做成“我的偏好”设置页，用户能直接知道保存了什么。列表按 id 排序，便于两语言共享用例逐项比较，也避免把 SQLite 未承诺的自然行顺序当成 API 约定。"
        }
      ]
    },
    {
      "id": "s13-387507",
      "title": "为什么存了偏好，答案没有变化：看实际上下文组装",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "假设 Alice 保存“回答全部使用中文”，然后问 lease worker recovery，默认 mock 仍返回证据原文。这个结果符合实现：Service.answer 读取问题与检索器输出，respond 组装 question/evidence；其中没有 store.memory(owner)。下面给出完整调用模块与检索实现，你可以直接追踪进入模型的字段。"
        },
        {
          "type": "code",
          "code": "\"\"\"Chapter gates and bounded orchestration. Default provider is deterministic mock.\"\"\"\nimport asyncio\nimport inspect\nimport json\nfrom contracts import ServiceError,fail,parse_answer\nfrom retrieval import KeywordRetriever\nfrom providers import MockProvider,invoke\nfrom store import Store,public_run\nclass Service:\n    def __init__(self,*,chapter=8,store=None,provider=None,retriever=None,timeout_ms=3000,lease_ms=10000,max_concurrent=2,max_context_chars=12000,max_model_calls=1,after_retrieved=None):\n        for name,value,low,high in [('chapter',chapter,2,8),('timeout_ms',timeout_ms,1,60000),('lease_ms',lease_ms,1,120000),('max_concurrent',max_concurrent,1,100),('max_context_chars',max_context_chars,1,1000000),('max_model_calls',max_model_calls,0,100)]:\n            if type(value) is not int or not low<=value<=high:raise ValueError('Invalid '+name)\n        self.chapter,self.store,self.provider,self.retriever=chapter,store or Store(),provider or MockProvider(),retriever or KeywordRetriever()\n        self.timeout_ms,self.lease_ms=timeout_ms,lease_ms\n        self.max_concurrent,self.max_context_chars,self.max_model_calls=max_concurrent,max_context_chars,max_model_calls\n        self.after_retrieved=after_retrieved;self.active=0;self.background=set()\n    async def _in_slot(self,operation):\n        if self.chapter<8:return await operation(self._track)\n        if self.active>=self.max_concurrent:fail(503,'SERVICE_BUSY')\n        self.active+=1;holds=[]\n        def hold(task):holds.append(task);self._track(task)\n        try:return await operation(hold)\n        finally:\n            pending={task for task in holds if not task.done()}\n            if not pending:self.active-=1\n            else:\n                # Timeout may return before a cancellation-resistant provider settles.\n                def settled(task):\n                    pending.discard(task)\n                    if not pending:self.active-=1\n                for task in tuple(pending):task.add_done_callback(settled)\n    def _track(self,task):\n        self.background.add(task)\n        def finish(completed):\n            self.background.discard(completed)\n            if not completed.cancelled():completed.exception()  # consume late errors\n        task.add_done_callback(finish)\n    async def _respond(self,question,evidence,hold):\n        context_chars=len(question)+sum(len(item[k]) for item in evidence for k in ('id','title','text'))\n        if self.chapter>=8 and context_chars>self.max_context_chars:fail(400,'CONTEXT_TOO_LARGE')\n        if not evidence:return {'answer':'没有找到可引用的资料。','citations':[],'evidence':[],'metrics':{'retrieved':0,'model_calls':0,'context_chars':context_chars}}\n        if self.chapter>=8 and self.max_model_calls<1:fail(400,'MODEL_BUDGET_EXCEEDED')\n        raw=await invoke(self.provider,{'question':question,'evidence':evidence},self.timeout_ms,hold)\n        return {**parse_answer(raw,evidence),'evidence':evidence,'metrics':{'retrieved':len(evidence),'model_calls':1,'context_chars':context_chars}}\n    async def answer(self,owner,question):\n        async def work(hold):return await self._respond(question,await self.retriever.search(owner,question),hold)\n        return await self._in_slot(work)\n    async def run(self,owner,id,question=None):\n        initial=self.store.get(owner,id) if question is None else self.store.ensure(owner,id,question)\n        if not initial:fail(404,'RUN_NOT_FOUND')\n        if initial['status']=='completed':return public_run(initial)\n        async def work(hold):\n            claim=self.store.claim(owner,id,self.lease_ms)\n            if claim['status']=='completed':return public_run(claim)\n            try:\n                if claim['checkpoint']=='retrieved':evidence=json.loads(claim['evidence'])\n                else:\n                    evidence=await self.retriever.search(owner,claim['question']);self.store.retrieved(claim,evidence)\n                    if self.after_retrieved:\n                        value=self.after_retrieved(self.store.get(owner,id))\n                        if inspect.isawaitable(value):await value\n                result=await self._respond(claim['question'],evidence,hold);self.store.complete(claim,result)\n                return public_run(self.store.get(owner,id))\n            finally:self.store.release(claim)\n        return await self._in_slot(work)\n    async def close(self):\n        tasks=tuple(self.background)\n        for task in tasks:task.cancel()\n        if tasks:await asyncio.wait(tasks,timeout=.2)\n        # Late provider tasks never write SQLite; only a fenced run could commit.\n        self.store.close()\n",
          "language": "python",
          "filename": "python-v2/service.py",
          "purpose": "完整问答/恢复流程；观察传给 provider 的只有 question 和 evidence（Python）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {cp,fail,parseAnswer,type Answer,type Evidence} from './contracts.js';\nimport {KeywordRetriever,type Retriever} from './retrieval.js';\nimport {invoke,mockProvider,type Provider} from './providers.js';\nimport {Store,publicRun,type Run} from './store.js';\ntype Hold=(promise:Promise<unknown>)=>void;\nexport type Options={chapter?:number;store?:Store;provider?:Provider;retriever?:Retriever;timeoutMs?:number;leaseMs?:number;maxConcurrent?:number;maxContextChars?:number;maxModelCalls?:number;afterRetrieved?:(run:Run)=>Promise<void>|void};\nexport class Service {\n readonly chapter:number;readonly store:Store;readonly provider:Provider;readonly retriever:Retriever;\n readonly timeoutMs:number;readonly leaseMs:number;readonly maxConcurrent:number;readonly maxContextChars:number;readonly maxModelCalls:number;\n active=0;\n constructor(readonly options:Options={}){\n  this.chapter=options.chapter??8;this.store=options.store??new Store();this.provider=options.provider??mockProvider;this.retriever=options.retriever??new KeywordRetriever();\n  this.timeoutMs=options.timeoutMs??3000;this.leaseMs=options.leaseMs??10000;this.maxConcurrent=options.maxConcurrent??2;this.maxContextChars=options.maxContextChars??12000;this.maxModelCalls=options.maxModelCalls??1;\n  for(const [name,value,min,max]of [['chapter',this.chapter,2,8],['timeoutMs',this.timeoutMs,1,60000],['leaseMs',this.leaseMs,1,120000],['maxConcurrent',this.maxConcurrent,1,100],['maxContextChars',this.maxContextChars,1,1000000],['maxModelCalls',this.maxModelCalls,0,100]] as const)if(!Number.isInteger(value)||value<min||value>max)throw new Error('Invalid '+name);\n }\n private async inSlot<T>(fn:(hold:Hold)=>Promise<T>):Promise<T>{\n  if(this.chapter<8)return fn(()=>{});\n  if(this.active>=this.maxConcurrent)fail(503,'SERVICE_BUSY');this.active++;\n  const holds:Promise<unknown>[]=[];\n  try{return await fn(promise=>holds.push(promise))}\n  finally {if(holds.length)void Promise.allSettled(holds).then(()=>{this.active--});else this.active--;}\n }\n private async respond(question:string,evidence:Evidence[],hold:Hold){\n  const context_chars=cp(question)+evidence.reduce((n,item)=>n+cp(item.id)+cp(item.title)+cp(item.text),0);\n  if(this.chapter>=8&&context_chars>this.maxContextChars)fail(400,'CONTEXT_TOO_LARGE');\n  if(!evidence.length)return{answer:'没有找到可引用的资料。',citations:[],evidence,metrics:{retrieved:0,model_calls:0,context_chars}};\n  if(this.chapter>=8&&this.maxModelCalls<1)fail(400,'MODEL_BUDGET_EXCEEDED');\n  const raw=await invoke(this.provider,{question,evidence},this.timeoutMs,hold);\n  return{...parseAnswer(raw,evidence),evidence,metrics:{retrieved:evidence.length,model_calls:1,context_chars}};\n }\n async answer(owner:string,question:string){return this.inSlot(async hold=>this.respond(question,await this.retriever.search(owner,question),hold));}\n async run(owner:string,id:string,question?:string){\n  const initial=question===undefined?this.store.get(owner,id):this.store.ensure(owner,id,question);\n  if(!initial)fail(404,'RUN_NOT_FOUND');if(initial!.status==='completed')return publicRun(initial!);\n  return this.inSlot(async hold=>{\n   const claim=this.store.claim(owner,id,this.leaseMs);if(claim.status==='completed')return publicRun(claim);\n   try {\n    let evidence:Evidence[];\n    if(claim.checkpoint==='retrieved')evidence=JSON.parse(claim.evidence);\n    else {evidence=await this.retriever.search(owner,claim.question);this.store.retrieved(claim,evidence);await this.options.afterRetrieved?.(this.store.get(owner,id)!);}\n    const result=await this.respond(claim.question,evidence,hold);this.store.complete(claim,result as Answer);return publicRun(this.store.get(owner,id)!);\n   }finally{this.store.release(claim);}\n  });\n }\n}\n",
          "language": "typescript",
          "filename": "typescript-v2/src/service.ts",
          "purpose": "完整问答/恢复流程；观察传给 provider 的只有 question 和 evidence（TypeScript）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "\"\"\"Deterministic keyword baseline. No embeddings or model-quality claim.\"\"\"\nimport unicodedata\nfrom typing import Protocol\nfrom contracts import DOCUMENTS,evidence_of\nclass Retriever(Protocol):\n    async def search(self,owner:str,question:str)->list[dict]:...\nclass KeywordRetriever:\n    def __init__(self,documents=None):self.documents=DOCUMENTS if documents is None else documents\n    async def search(self,owner,question):\n        normalized=unicodedata.normalize('NFKC',question).lower()\n        scored=[(sum(word in normalized for word in d['keywords']),d) for d in self.documents if d['owner'] in {'public',owner}]\n        scored.sort(key=lambda item:(-item[0],item[1]['id']))\n        return evidence_of([d for score,d in scored if score>0][:3])\n",
          "language": "python",
          "filename": "python-v2/retrieval.py",
          "purpose": "当前检索只来自共享文档样本，不读取 memory 表（Python）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import {documents,type Document,type Evidence,evidenceOf} from './contracts.js';\nexport interface Retriever {search(owner:string,question:string):Promise<Evidence[]>;}\nexport class KeywordRetriever implements Retriever {\n constructor(private docs:Document[]=documents){}\n async search(owner:string,question:string):Promise<Evidence[]> {\n  const normalized=question.normalize('NFKC').toLowerCase();\n  const ranked=this.docs.filter(d=>d.owner==='public'||d.owner===owner).map(doc=>({doc,score:doc.keywords.filter(k=>normalized.includes(k)).length})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||(a.doc.id<b.doc.id?-1:a.doc.id>b.doc.id?1:0));\n  return evidenceOf(ranked.slice(0,3).map(row=>row.doc));\n }\n}\n",
          "language": "typescript",
          "filename": "typescript-v2/src/retrieval.ts",
          "purpose": "当前检索只来自共享文档样本，不读取 memory 表（TypeScript）。下列为此项目完整模块，保留导入与失败分支；依赖同文展示的模块及锁定安装的运行库。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "如果要加入偏好，程序需要新增一条明确的数据通路：读取当前 owner 的记忆，筛选允许的类型与数量，再作为低信任数据组装输入，同时把它计入上下文预算。它还需要决定“偏好与当前明确请求冲突时听谁的”。当前没有这些实现，所以这里不提供一段看似已经生效的伪提示词来混淆状态。"
        },
        {
          "type": "paragraph",
          "text": "压缩对话也类似。把旧对话生成摘要会损失细节，摘要还可能把模型推测写成用户事实。现有项目没有对话摘要、向量记忆或自动遗忘；需要这些能力时，应先定义原始来源、版本和可撤回关系，再做摘要质量评测。删掉全文只留下摘要，无法保证原事实还能被恢复。"
        }
      ]
    },
    {
      "id": "s13-377441",
      "title": "删除具体删除了什么：数据库行、快照与副本",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "DELETE 改变的是当前 memory 表中这一位 owner 的这一条逻辑记录。下一次列表不再返回它，这是本示例验证的删除语义。SQLite 页、WAL、备份、文件系统快照与已经发出的模型请求，都是不同的副本边界；删一行不会自动把这些位置一并清空。"
        },
        {
          "type": "reference",
          "title": "SQLite 官方：secure_delete 的范围与限制",
          "url": "https://www.sqlite.org/pragma.html#pragma_secure_delete",
          "note": "出处用于区分逻辑删除与底层数据擦除；本项目没有执行物理抹除或备份清理，不声称 DELETE 能覆盖这些副本。"
        },
        {
          "type": "paragraph",
          "text": "本项目的问答默认没读取 memory，所以不存在“之前自动加入提示词的偏好”这条隐含副本。与此同时，runs.evidence 仍保存检索资料快照：即使源文档之后变了，旧任务的恢复也会复用旧证据。这说明删除与恢复目标可能相互牵制，需要明确保留策略，而不是笼统地说“所有内容都已忘记”。"
        },
        {
          "type": "table",
          "headers": [
            "位置",
            "当前 DELETE 是否覆盖",
            "需要额外解决什么"
          ],
          "rows": [
            [
              "memory 当前逻辑行",
              "是，只限当前 owner/id",
              "用户确认与业务删除审计可后续加"
            ],
            [
              "其他 owner 同名 ID",
              "否",
              "保持主体隔离"
            ],
            [
              "runs 检查点与已完成答案",
              "否",
              "保留期限、撤权、级联删除策略"
            ],
            [
              "WAL / 备份 / 远端模型副本",
              "否",
              "运维清理、加密与服务商数据政策"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "方案取舍也因此很具体：显式小表容易解释、容易验证，适合教学和可见偏好；真实长期记忆若包含敏感事实，则要在入库前建立数据分类、同意和保留政策。这些是另一个实现阶段，不能拿本章 CRUD 的通过记录代替。"
        }
      ]
    },
    {
      "id": "s14-419470",
      "title": "测试、理解检查与下一步",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "# Python v2 目录\n.venv/bin/python -m pytest -q tests/test_app.py tests/test_store.py\n# TypeScript v2 目录\nnpm test\n# 两端所有测试还会读取 shared/v2/http-cases.json 中的 memory 隔离/删除案例。\n",
          "language": "bash",
          "purpose": "验证读写、同名隔离、额外 owner 字段拒绝及默认不注入问答",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本轮 Python 全部 36 项测试通过，TypeScript 全部 33 项通过并完成 build；共享 HTTP 用例覆盖 Alice 写入、列表、Bob 删除失败和 Alice 删除。还单独验证显式记忆不改变默认问答输入。代码检查关注 SQL owner 条件、HTTP 身份来源与实际提示词组装，不把“有两个用户测试”当成生产认证已完成。"
        },
        {
          "type": "paragraph",
          "text": "检查一：Bob 知道 Alice 的 pref ID，为什么仍删不掉？解析：服务端从 Bob 令牌得到 owner=bob，DELETE 条件是 owner=bob AND id=pref，无法命中 Alice 行。若 Bob 自己有同名记录，删除的是 Bob 的记录。"
        },
        {
          "type": "paragraph",
          "text": "检查二：删掉记忆能否承诺之前生成的答案也被删除？解析：不能。memory 与 runs 是两张不同用途的表，本实现没有级联清理旧任务。用户界面应准确写“删除这条保存的记忆”，而不是宣称所有副本被抹除。"
        },
        {
          "type": "paragraph",
          "text": "下一章用共享样本评测检索，而后继续检验提示注入和工具权限。先保住数据的来源和边界，评测才知道在评什么，也能区分“检索没找到”“引用不支持”和“记忆压根没有参与”。"
        }
      ]
    }
  ],
  "questionIds": [
    "agent-context-memory-memory",
    "agent-context-memory-compression"
  ],
  "references": [
    {
      "title": "SQLite：事务与 BEGIN IMMEDIATE",
      "url": "https://www.sqlite.org/lang_transaction.html"
    },
    {
      "title": "Python 3.12：Task 取消与等待",
      "url": "https://docs.python.org/3.12/library/asyncio-task.html"
    },
    {
      "title": "SQLite：secure_delete",
      "url": "https://www.sqlite.org/pragma.html#pragma_secure_delete"
    }
  ]
};
export default article;
