import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "agent-tools-mcp",
  "topic": "ai",
  "title": "Agent 工程 02：只读工具执行器、参数校验与 MCP 子集",
  "description": "先定义工具与执行职责，再用同一lookup_document实现HTTP和MCP stdio两种入口，完整展示双语言参数、白名单和文档权限拒绝路径。",
  "minutes": 48,
  "tags": [
    "AI",
    "Tool Calling",
    "MCP",
    "JSON Schema",
    "幂等"
  ],
  "scope": "实现范围是单一只读lookup_document与MCP2025-06-18 stdio tools子集；HTTP通过demo令牌映射身份，stdio由启动环境固定。没有自动LLM规划循环、任意网络/文件/shell、写工具或完整MCP协议。",
  "prerequisites": [
    "理解第01章的结构化输出和错误分类",
    "会看HTTP JSON和函数调用；本文会定义MCP角色"
  ],
  "sections": [
    {
      "id": "s16-473090",
      "title": "工具是什么：把一项可控业务能力变成函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Agent里的工具，是宿主程序暴露给调用方的一项能力，包含名字、参数、结果和失败规则。模型可以提出调用哪个工具、填什么参数；实际执行、当前身份和资源权限由程序决定。把这两层分开，才知道“模型说完成”与“业务真的完成”的证据分别在哪里。"
        },
        {
          "type": "paragraph",
          "text": "这一章在第01章结构化输出之后，先建立最小执行层。我们只开放lookup_document(document_id)：读取一份公开或本人文档。HTTP调用者可以手动请求它，MCP client也可以通过协议请求它；本章没有让LLM自动规划并循环调用工具。先把执行边界跑通，再讨论更复杂编排，避免用一个成功对话假装交付整个Agent。"
        },
        {
          "type": "paragraph",
          "text": "固定数据来自shared/v2/documents.json，六份人工教学文档；lease-guide公开，alice-note只对Alice，bob-note只对Bob。HTTP的Bearer demo-alice由服务器映射为alice，不接受body.owner。stdio不携带HTTP令牌，它从启动环境MCP_OWNER取得固定身份。这些都是本机教学身份，不是生产登录实现。"
        },
        {
          "type": "figure",
          "src": "figures/agent-tools-mcp/execution.svg",
          "title": "两种连接方式，共用一个工具执行器",
          "alt": "HTTP与MCP stdio分别取得受信owner后进入同一工具函数，验证名字、document_id和public/owner范围，成功只返回id/title/text；资料内容不能修改策略。",
          "caption": "MCP只是适配层，不能使一个不被允许的文档或工具自动可信。"
        }
      ]
    },
    {
      "id": "s10-233147",
      "title": "先收窄契约，再看每一条拒绝发生在哪",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "{\n  \"name\": \"lookup_document\",\n  \"arguments\": {\n    \"document_id\": \"lease-guide\"\n  }\n}",
          "filename": "POST /v2/tools · 请求",
          "purpose": "固定名字与参数；没有owner、path、url或command字段。",
          "language": "json",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "输入",
            "程序决定",
            "HTTP结果"
          ],
          "rows": [
            [
              "Alice查lease-guide",
              "public允许",
              "200 result:{id,title,text}"
            ],
            [
              "Alice查bob-note",
              "不属于public或alice",
              "403 DOCUMENT_FORBIDDEN"
            ],
            [
              "Alice查不存在ID",
              "同样不对外确认存在性",
              "403 DOCUMENT_FORBIDDEN"
            ],
            [
              "name=shell",
              "不在白名单",
              "403 TOOL_FORBIDDEN"
            ],
            [
              "arguments多url字段",
              "结构不符合精确契约",
              "400 INVALID_REQUEST"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "为什么连不存在和越权都用同一个错误？调用者不该借这个接口枚举私有文档是否存在。为什么不提供read(path)或fetch(url)？因为当前任务只需要按ID读取已配置文档；若允许任意路径或URL，就把文件系统或网络访问政策也引进了这一章，需要另一套边界与验证。能力范围应该由业务需要决定。"
        },
        {
          "type": "code",
          "code": "import {existsSync,readFileSync} from 'node:fs';\nexport const shared = [new URL('../../shared/v2/',import.meta.url),new URL('../../../shared/v2/',import.meta.url)].find(url=>existsSync(new URL('CONTRACT.md',url)))!;\nif(!shared)throw new Error('shared/v2 contract not found');\nexport const readShared=(file:string):any=>JSON.parse(readFileSync(new URL(file,shared),'utf8'));\nexport type Document={id:string;owner:string;title:string;text:string;keywords:string[]};\nexport type Evidence=Pick<Document,'id'|'title'|'text'>;\nexport type Input={question:string;evidence:Evidence[]};\nexport type Answer={answer:string;citations:string[]};\nexport const documents:Document[]=readShared('documents.json');\nexport const cp=(text:string)=>Array.from(text).length;\nexport const wellFormed=(value:string)=>Array.from(value).every(char=>{const point=char.codePointAt(0)!;return point<0xD800||point>0xDFFF});\nexport class ServiceError extends Error {constructor(public status:number,public code:string,message=code){super(message);}}\nexport const fail=(status:number,code:string):never=>{throw new ServiceError(status,code)};\nexport const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);\nexport function exact(value:unknown,keys:string[]):Record<string,unknown>{\n if(!object(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(400,'INVALID_REQUEST');\n return value as Record<string,unknown>;\n}\nexport function text(value:unknown,max=2000):string {\n if(typeof value!=='string')fail(400,'INVALID_REQUEST');const result=(value as string).trim();\n if(!wellFormed(result)||cp(result)<1||cp(result)>max)fail(400,'INVALID_REQUEST');return result;\n}\nexport function id(value:unknown):string {const result=text(value,64);if(!/^[A-Za-z0-9_-]{1,64}$/.test(result))fail(400,'INVALID_REQUEST');return result;}",
          "filename": "typescript-v2/src/contracts.ts · 输入公共层",
          "purpose": "实际文件从import到ID校验的连续原码。包含文档/类型、共享数据加载、错误、对象精确字段、码点长度和ID检查。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "\"\"\"Shared v2 contract: strict shape, Unicode code point lengths, explicit errors.\"\"\"\nimport json\nimport re\nfrom pathlib import Path\nSHARED=Path(__file__).resolve().parent.parent/'shared'/'v2'\ndef read_shared(name):\n    return json.loads((SHARED/name).read_text(encoding='utf-8'))\nDOCUMENTS=read_shared('documents.json')\nclass ServiceError(Exception):\n    def __init__(self,status,code,message=None):\n        self.status,self.code,self.message=status,code,message or code\n        super().__init__(code)\ndef fail(status,code):\n    raise ServiceError(status,code)\ndef strict_json(raw):\n    def bad(value): raise ValueError('Invalid JSON constant')\n    if isinstance(raw,(bytes,bytearray)):raw=raw.decode('utf-8')\n    return json.loads(raw,parse_constant=bad)\ndef exact(value,keys):\n    if not isinstance(value,dict) or set(value)!=set(keys):fail(400,'INVALID_REQUEST')\n    return value\ndef trim(value):return value.strip('\\u0009\\u000a\\u000b\\u000c\\u000d\\u0020\\u00a0\\u1680\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff')\ndef well_formed(value):return all(not 0xD800<=ord(char)<=0xDFFF for char in value)\ndef text(value,maximum=2000):\n    if not isinstance(value,str) or not well_formed(value):fail(400,'INVALID_REQUEST')\n    value=trim(value)\n    if not 1<=len(value)<=maximum:fail(400,'INVALID_REQUEST')\n    return value\ndef identifier(value):\n    value=text(value,64)\n    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',value):fail(400,'INVALID_REQUEST')\n    return value\ndef question_body(raw):return {'question':text(exact(raw,['question'])['question'])}\ndef run_body(raw):\n    body=exact(raw,['request_id','question']);return {'request_id':identifier(body['request_id']),'question':text(body['question'])}\ndef memory_body(raw):\n    body=exact(raw,['id','text']);return {'id':identifier(body['id']),'text':text(body['text'])}\ndef evidence_of(documents):return [{k:d[k] for k in ('id','title','text')} for d in documents]",
          "filename": "python-v2/contracts.py · 输入公共层",
          "purpose": "对应Python连续原码；trim显式采用与ECMAScript一致的空白字符集，避免两端默认strip规则不同。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "具体输入document_id=\" lease-guide \"会先trim再匹配ASCII ID规则；带../或未知字段会拒绝。数组不是参数对象，额外owner也不会改变身份。解析还拒绝非法UTF8、BOM/UTF16和JSON转义后的孤立surrogate，合法emoji配对可通过。TypeScript用Array.from统计码点，Python字符串长度按码点计；这不等于token或用户感知字素簇。数据与Schema来自同一shared版本，业务授权仍要由下面的函数完成。"
        }
      ]
    },
    {
      "id": "executor",
      "title": "双语言执行器：成功读取和越权反例都走同一函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {documents,exact,fail,id,type Document,type Evidence,wellFormed} from './contracts.js';\nexport function lookup(owner:string,documentId:string,docs:Document[]=documents):Evidence {\n const doc=docs.find(item=>item.id===documentId&&(item.owner==='public'||item.owner===owner));\n if(!doc)fail(403,'DOCUMENT_FORBIDDEN');const {id,title,text}=doc!;return{id,title,text};\n}\nexport function executeTool(owner:string,raw:unknown,docs:Document[]=documents):Evidence {\n const request=exact(raw,['name','arguments']);\n if(typeof request.name!=='string'||!wellFormed(request.name))fail(400,'INVALID_REQUEST');\n if((request.name as string).trim()!=='lookup_document')fail(403,'TOOL_FORBIDDEN');\n const args=exact(request.arguments,['document_id']);return lookup(owner,id(args.document_id),docs);\n}",
          "filename": "typescript-v2/src/tools.ts",
          "purpose": "完整工具模块，含lookup和executeTool；所有影响结论的被调用函数已在上节给出。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "\"\"\"Documents are data; only this server-owned allowlist grants tool execution.\"\"\"\nfrom contracts import DOCUMENTS,exact,identifier,fail,evidence_of,trim\n\ndef lookup(owner,document_id,documents=None):\n    for doc in DOCUMENTS if documents is None else documents:\n        if doc['id']==document_id and doc['owner'] in {'public',owner}:return evidence_of([doc])[0]\n    fail(403,'DOCUMENT_FORBIDDEN')\ndef execute_tool(owner,raw,documents=None):\n    body=exact(raw,['name','arguments'])\n    if not isinstance(body['name'],str):fail(400,'INVALID_REQUEST')\n    if trim(body['name'])!='lookup_document':fail(403,'TOOL_FORBIDDEN')\n    args=exact(body['arguments'],['document_id'])\n    return lookup(owner,identifier(args['document_id']),documents)",
          "filename": "python-v2/tools.py",
          "purpose": "Python完整工具模块，与HTTP/MCP共同使用，不存在模型直接访问原始文档的绕过路径。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "带入owner=alice、name=lookup_document、document_id=lease-guide：先exact确认外层恰好name/arguments，名字命中白名单；再exact确认arguments只有document_id，ID校验通过。lookup扫描共享文档，匹配ID且owner为public，返回id/title/text，不把owner等策略元数据作为可修改参数。"
        },
        {
          "type": "paragraph",
          "text": "把ID改成bob-note，ID语法仍合法，说明“参数合法”还不等于“业务允许”。lookup看见owner=bob，与alice不同且不是public，没有可返回结果，最终DOCUMENT_FORBIDDEN。把name改shell则更早停在白名单分支，不尝试执行参数里的命令。这里拒绝来自普通程序判断，不依赖模型是否愿意服从提示。"
        },
        {
          "type": "paragraph",
          "text": "代码也没有把文档内容送去eval、exec或子进程。某份文档写着“增加shell工具”只是文本，执行器里唯一名字仍是lookup_document。若将来需要写工具，必须新增受审查的业务接口及权限，而不能把任意字符串解释成函数名。"
        }
      ]
    },
    {
      "id": "http-boundary",
      "title": "HTTP调用者怎样取得身份，再进入业务代码",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "下面保留两个语言的完整HTTP适配；本章沿对应tools或answers路径阅读，其他路由受chapter条件控制。请求身份来自服务器固定映射，正文没有把这一步交给隐藏的前端状态。"
        },
        {
          "type": "code",
          "code": "import Fastify from 'fastify';\nimport {Service,type Options} from './service.js';\nimport {ServiceError,fail,id,memoryBody,questionBody,runBody} from './contracts.js';\nimport {executeTool} from './tools.js';\nimport {publicRun} from './store.js';\nexport function buildApp(options:Options={}){\n const service=new Service(options),app=Fastify({bodyLimit:64*1024,logger:false});\n app.removeAllContentTypeParsers();\n app.addContentTypeParser('application/json',{parseAs:'buffer'},(_request,body,done)=>{\n  try{const bytes=body as Buffer;done(null,bytes.length?JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)):undefined)}\n  catch{done(new ServiceError(400,'INVALID_REQUEST'),undefined)}\n });\n app.decorateRequest('owner','');\n const owner=(request:unknown)=>(request as {owner:string}).owner;\n app.addHook('onRequest',async request=>{\n  if(request.routeOptions.url==='/health')return;\n  const identity=new Map([['Bearer demo-alice','alice'],['Bearer demo-bob','bob']]).get(request.headers.authorization??'');\n  if(!identity)fail(401,'UNAUTHORIZED');(request as unknown as {owner:string}).owner=identity!;\n });\n app.setErrorHandler((error,_request,reply)=>{\n  const err=error as Error&{code?:string;statusCode?:number};\n  const known=error instanceof ServiceError?error:err.code==='FST_ERR_CTP_BODY_TOO_LARGE'?new ServiceError(413,'PAYLOAD_TOO_LARGE'):err.statusCode===400||err.code?.startsWith('FST_ERR_CTP')?new ServiceError(400,'INVALID_REQUEST'):new ServiceError(500,'INTERNAL_ERROR');\n  reply.code(known.status).send({ok:false,error:{code:known.code,message:known.message}});\n });\n app.setNotFoundHandler((_req,reply)=>reply.code(404).send({ok:false,error:{code:'ROUTE_NOT_FOUND',message:'ROUTE_NOT_FOUND'}}));\n app.get('/health',async()=>({status:'ok',chapter:service.chapter}));\n if(service.chapter>=2)app.post('/v2/tools',async request=>({ok:true,result:executeTool(owner(request),request.body)}));\n if(service.chapter>=3)app.post('/v2/answers',async request=>({ok:true,result:await service.answer(owner(request),questionBody(request.body).question)}));\n if(service.chapter>=4){\n  app.post('/v2/runs',async request=>{const body=runBody(request.body);return{ok:true,run:await service.run(owner(request),body.request_id,body.question)}});\n  app.get('/v2/runs/:id',async request=>{const run=service.store.get(owner(request),id((request.params as {id:string}).id));if(!run)fail(404,'RUN_NOT_FOUND');return{ok:true,run:publicRun(run!)}});\n  app.post('/v2/runs/:id/resume',async request=>{if(request.body!==undefined&&request.body!==null)fail(400,'INVALID_REQUEST');return{ok:true,run:await service.run(owner(request),id((request.params as {id:string}).id))}});\n }\n if(service.chapter>=5){\n  app.post('/v2/memory',async request=>{const body=memoryBody(request.body);return{ok:true,result:service.store.putMemory(owner(request),body.id,body.text)}});\n  app.get('/v2/memory',async request=>({ok:true,result:service.store.memory(owner(request))}));\n  app.delete('/v2/memory/:id',async request=>{service.store.deleteMemory(owner(request),id((request.params as {id:string}).id));return{ok:true,deleted:true}});\n }\n app.addHook('onClose',async()=>service.store.close());\n return{app,service};\n}",
          "filename": "typescript-v2/src/app.ts",
          "purpose": "完整Fastify HTTP边界：64KiB、fatal UTF8/JSON、身份映射、错误分类与章门槛。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "\"\"\"FastAPI HTTP boundary; all backend state remains outside GitHub Pages.\"\"\"\nimport json\nimport os\nfrom contextlib import asynccontextmanager\nfrom fastapi import FastAPI,Request\nfrom fastapi.responses import Response\nfrom contracts import ServiceError,fail,strict_json,identifier,question_body,run_body,memory_body\nfrom service import Service\nfrom store import Store,public_run\nfrom tools import execute_tool\nfrom providers import provider_from_env\nMAX_REQUEST_BYTES=64*1024\ndef send(body,status=200):return Response(json.dumps(body,ensure_ascii=True),status_code=status,media_type='application/json')\nasync def read_body(request):\n    data=bytearray()\n    async for chunk in request.stream():\n        if len(data)+len(chunk)>MAX_REQUEST_BYTES:fail(413,'PAYLOAD_TOO_LARGE')\n        data.extend(chunk)\n    if not data:return None\n    if request.headers.get('content-type','').split(';',1)[0].strip().lower()!='application/json':fail(400,'INVALID_REQUEST')\n    try:return strict_json(data)\n    except (ValueError,TypeError,UnicodeError):fail(400,'INVALID_REQUEST')\ndef create_app(service=None):\n    selected=service or Service(chapter=int(os.getenv('CHAPTER','8')),store=Store(os.getenv('SQLITE_PATH','data/agent.sqlite')),provider=provider_from_env(),timeout_ms=int(os.getenv('MODEL_TIMEOUT_MS','3000')),lease_ms=int(os.getenv('LEASE_MS','10000')),max_concurrent=int(os.getenv('MAX_CONCURRENT','2')),max_context_chars=int(os.getenv('MAX_CONTEXT_CHARS','12000')),max_model_calls=int(os.getenv('MAX_MODEL_CALLS','1')))\n    @asynccontextmanager\n    async def lifespan(app):\n        yield\n        await selected.close()\n    app=FastAPI(title='Agent workshop chapters 02-08',docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)\n    app.state.service=selected\n    @app.api_route('/{path:path}',methods=['GET','POST','DELETE','PUT','PATCH','OPTIONS','HEAD'])\n    async def endpoint(path,request:Request):\n        try:\n            method=request.method;url='/'+path\n            if url=='/health' and method=='GET':return send({'status':'ok','chapter':selected.chapter})\n            owner={'Bearer demo-alice':'alice','Bearer demo-bob':'bob'}.get(request.headers.get('authorization'))\n            if not owner:fail(401,'UNAUTHORIZED')\n            body=await read_body(request) if method=='POST' else None\n            if url=='/v2/tools' and method=='POST' and selected.chapter>=2:return send({'ok':True,'result':execute_tool(owner,body)})\n            if url=='/v2/answers' and method=='POST' and selected.chapter>=3:return send({'ok':True,'result':await selected.answer(owner,question_body(body)['question'])})\n            if url=='/v2/runs' and method=='POST' and selected.chapter>=4:\n                incoming=run_body(body);return send({'ok':True,'run':await selected.run(owner,incoming['request_id'],incoming['question'])})\n            parts=url.split('/')\n            if len(parts)==4 and parts[1:3]==['v2','runs'] and method=='GET' and selected.chapter>=4:\n                run=selected.store.get(owner,identifier(parts[3]))\n                if not run:fail(404,'RUN_NOT_FOUND')\n                return send({'ok':True,'run':public_run(run)})\n            if len(parts)==5 and parts[1:3]==['v2','runs'] and parts[4]=='resume' and method=='POST' and selected.chapter>=4:\n                if body is not None:fail(400,'INVALID_REQUEST')\n                return send({'ok':True,'run':await selected.run(owner,identifier(parts[3]))})\n            if url=='/v2/memory' and selected.chapter>=5:\n                if method=='GET':return send({'ok':True,'result':selected.store.memory(owner)})\n                if method=='POST':\n                    incoming=memory_body(body);return send({'ok':True,'result':selected.store.put_memory(owner,incoming['id'],incoming['text'])})\n            if len(parts)==4 and parts[1:3]==['v2','memory'] and method=='DELETE' and selected.chapter>=5:\n                selected.store.delete_memory(owner,identifier(parts[3]));return send({'ok':True,'deleted':True})\n            fail(404,'ROUTE_NOT_FOUND')\n        except ServiceError as error:return send({'ok':False,'error':{'code':error.code,'message':error.message}},error.status)\n        except Exception:return send({'ok':False,'error':{'code':'INTERNAL_ERROR','message':'INTERNAL_ERROR'}},500)\n    return app",
          "filename": "python-v2/app.py",
          "purpose": "完整FastAPI对应边界。客户端body中的owner不会被用来改写身份；未开放路由与业务错误保留明确分类。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "读请求时先找认证：Bearer demo-alice映射alice，缺失或未知令牌401；再看严格body解析和相应路由。HTTP工具只调用executeTool，问答只调用Service.answer；没有把模型自由文本传给函数分派器。教学令牌不是真实登录，部署时必须替换认证层。"
        }
      ]
    },
    {
      "id": "s18-384953",
      "title": "MCP做哪一层：消息协议，不是业务授权",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "MCP把工具发现、调用等交互标准化。host是承载AI应用的宿主，client负责某条协议连接，server暴露能力。本项目的stdio进程是server：client通过initialize了解版本/能力，tools/list查看工具Schema，tools/call发送参数。程序声明tools能力，并不声明资源、提示或任意执行能力。"
        },
        {
          "type": "paragraph",
          "text": "这里固定2025-06-18的stdio子集：每行一个JSON-RPC2.0消息，stdout只放协议响应，日志走stderr；通知没有response。输入错误用协议错误，工具已经被调用但权限不允许时用isError工具结果。以下两份完整适配器复用前面的executeTool，不另外写一套权限。"
        },
        {
          "type": "code",
          "code": "import {createInterface} from 'node:readline';import {executeTool} from './tools.js';import {ServiceError,object,readShared} from './contracts.js';\nconst owner=process.env.MCP_OWNER??'alice';if(!['alice','bob'].includes(owner))throw new Error('MCP_OWNER must be alice or bob');\nconst reply=(id:unknown,result:unknown)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\\n');\nconst error=(id:unknown,code:number,message:string)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}})+'\\n');\nlet initialized=false;\nconst input=createInterface({input:process.stdin,crlfDelay:Infinity});\nfor await(const line of input){\n if(Buffer.byteLength(line)>64*1024){error(null,-32600,'Request too large');continue}\n let request:any;try{request=JSON.parse(line)}catch{error(null,-32700,'Parse error');continue}\n if(!object(request)||request.jsonrpc!=='2.0'||typeof request.method!=='string'){error(object(request)?request.id??null:null,-32600,'Invalid Request');continue}\n const notification=!Object.hasOwn(request,'id');\n if(notification)continue\n const id=request.id;\n if(id!==null&&typeof id!=='string'&&!(typeof id==='number'&&Number.isFinite(id))){error(null,-32600,'Invalid Request ID');continue}\n if(request.method==='initialize'){\n  if(!object(request.params)){error(id,-32602,'Invalid params');continue}\n  initialized=true;reply(id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'atlas-local-tools-subset',version:'2.0.0'}});continue;\n }\n if(!initialized){error(id,-32002,'Not initialized');continue}\n if(request.method==='tools/list'){reply(id,{tools:[{name:'lookup_document',description:'Read a public or owner document by ID',inputSchema:{...readShared('schema.json').$defs.lookupArguments,$defs:{id:readShared('schema.json').$defs.id}}}]});continue}\n if(request.method==='tools/call'){\n  if(!object(request.params)||typeof request.params.name!=='string'||!object(request.params.arguments)){error(id,-32602,'Invalid params');continue}\n  try{reply(id,{content:[{type:'text',text:JSON.stringify(executeTool(owner,request.params))}],isError:false})}\n  catch(err){if(err instanceof ServiceError&&err.code==='INVALID_REQUEST')error(id,-32602,'Invalid params');else reply(id,{content:[{type:'text',text:JSON.stringify({error:{code:err instanceof ServiceError?err.code:'INTERNAL_ERROR'}})}],isError:true})}continue;\n }\n error(id,-32601,'Method not found');\n}",
          "filename": "typescript-v2/src/mcp.ts",
          "purpose": "完整stdio适配器。initialize、通知、tools/list、tools/call、协议错误和工具执行错误均保留。",
          "language": "typescript",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "\"\"\"Local MCP 2025-06-18 tools-only stdio subset; protocol stdout, logs stderr.\"\"\"\nimport json\nimport math\nimport os\nimport sys\nfrom contracts import ServiceError,read_shared,strict_json\nfrom tools import execute_tool\n\ndef run():\n    owner=os.getenv('MCP_OWNER','alice')\n    if owner not in {'alice','bob'}:raise ValueError('MCP_OWNER must be alice or bob')\n    initialized=False\n    def reply(id,result):print(json.dumps({'jsonrpc':'2.0','id':id,'result':result},ensure_ascii=True),flush=True)\n    def error(id,code,message):print(json.dumps({'jsonrpc':'2.0','id':id,'error':{'code':code,'message':message}}),flush=True)\n    while True:\n        # Bound the protocol frame, and drain oversized lines without retaining them.\n        line=sys.stdin.buffer.readline(64*1024+2)\n        if not line:break\n        if len(line.rstrip(b'\\r\\n'))>64*1024:\n            while line and not line.endswith(b'\\n'):line=sys.stdin.buffer.readline(64*1024+2)\n            error(None,-32600,'Request too large');continue\n        try:request=strict_json(line)\n        except (ValueError,UnicodeError):error(None,-32700,'Parse error');continue\n        if not isinstance(request,dict) or request.get('jsonrpc')!='2.0' or not isinstance(request.get('method'),str):error(request.get('id') if isinstance(request,dict) else None,-32600,'Invalid Request');continue\n        method=request['method']\n        if 'id' not in request:\n            continue\n        id=request['id'];params=request.get('params')\n        if id is not None and (type(id) not in (int,float,str) or (type(id) is float and not math.isfinite(id))):\n            error(None,-32600,'Invalid Request');continue\n        if method=='initialize':\n            if not isinstance(params,dict):error(id,-32602,'Invalid params');continue\n            initialized=True;reply(id,{'protocolVersion':'2025-06-18','capabilities':{'tools':{'listChanged':False}},'serverInfo':{'name':'atlas-local-tools-subset','version':'2.0.0'}});continue\n        if not initialized:error(id,-32002,'Not initialized');continue\n        if method=='tools/list':\n            schema=read_shared('schema.json');reply(id,{'tools':[{'name':'lookup_document','description':'Read a public or owner document by ID','inputSchema':{**schema['$defs']['lookupArguments'],'$defs':{'id':schema['$defs']['id']}}}]});continue\n        if method=='tools/call':\n            if not isinstance(params,dict) or not isinstance(params.get('name'),str) or not isinstance(params.get('arguments'),dict):error(id,-32602,'Invalid params');continue\n            try:reply(id,{'content':[{'type':'text','text':json.dumps(execute_tool(owner,params),ensure_ascii=True)}],'isError':False})\n            except ServiceError as exc:\n                if exc.code=='INVALID_REQUEST':error(id,-32602,'Invalid params')\n                else:reply(id,{'content':[{'type':'text','text':json.dumps({'error':{'code':exc.code}})}],'isError':True})\n            continue\n        error(id,-32601,'Method not found')\nif __name__=='__main__':run()",
          "filename": "python-v2/mcp_stdio.py",
          "purpose": "Python完整stdio适配；身份由环境固定，输入边界与工具授权复用。",
          "language": "python",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "正常tools/call拿到content中JSON文本{id,title,text}，isError=false。未知shell或越权文档得到isError=true和错误分类；参数结构错误为-32602，未知method为-32601。声明的inputSchema带有ID定义，客户端能解析引用，但服务端仍会再校验，不能因为工具列表写了Schema就信任所有调用。"
        },
        {
          "type": "paragraph",
          "text": "本实现不覆盖完整会话协商、HTTP传输、OAuth、分页或取消协议，也没有通过完整MCP兼容认证。stdio子进程真实测试证明的是这个明确子集的消息与授权行为；接第三方服务时，还需单独验证对方身份、数据去向和权限范围。"
        },
        {
          "type": "reference",
          "title": "协议出处：MCP2025-06-18 stdio transport",
          "url": "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"
        },
        {
          "type": "reference",
          "title": "协议出处：MCP2025-06-18 tools",
          "url": "https://modelcontextprotocol.io/specification/2025-06-18/server/tools"
        }
      ]
    },
    {
      "id": "s13-336859",
      "title": "重试之前先确定有没有副作用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "当前工具只读，所以失败后按预算再次读取通常不会重复创建业务对象。但这不意味着所有工具都能直接重试。如果改成创建报告、发邮件或扣款，超时只说明调用方没及时拿到结果，不能证明动作未发生；写工具需要自己的幂等键、结果查询和明确确认规则。第04章才引入持久run检查点，不把这一章的只读函数冒充写操作恢复系统。"
        },
        {
          "type": "paragraph",
          "text": "当前工具只读取六份受控样本，没有任意网络请求；HTTP整个请求有64KiB限制。第08章进一步限制模型并发、上下文码点和调用次数；这些预算不能据此称作操作系统沙箱。若未来工具输出来自大数据源，还需独立的返回大小、分页和读取预算，不能把所有数据一次灌入上下文。"
        },
        {
          "type": "paragraph",
          "text": "日志与错误要提供分类而非泄密。教学HTTP禁用正文日志，MCP stdout保持协议纯净；测试不把真实令牌、API key或私人正文作为断言输出。若要增加审计，可以记录工具名、业务关联ID、结果类别与耗时，详细资料按访问策略单独存储。"
        }
      ]
    },
    {
      "id": "s13-376761",
      "title": "运行与验收：看实际拒绝，不只看一句回答",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/agent-workshop/typescript-v2\nnpm ci\nnpm test\nnpm run build\nCHAPTER=2 PORT=4340 npm start\n# 独立stdio：MCP_OWNER=alice npm run --silent mcp",
          "filename": "TypeScript终端",
          "purpose": "Node22.12需要experimental-sqlite flag，npm scripts已包含。此章HTTP只开放工具，不开放answers/run/memory。",
          "language": "bash",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "cd examples/agent-workshop/python-v2\npython3.12 -m venv .venv\n.venv/bin/pip install -r requirements.lock\n.venv/bin/python -m pytest -q\nCHAPTER=2 PORT=4341 .venv/bin/python server.py\n# 独立stdio：MCP_OWNER=alice .venv/bin/python mcp_stdio.py",
          "filename": "Python终端",
          "purpose": "使用锁定依赖和Python3.12；若解释器名称不同，替换为实际3.12路径。",
          "language": "bash",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"initialize\", \"params\": {\"protocolVersion\": \"2025-06-18\", \"capabilities\": {}, \"clientInfo\": {\"name\": \"reader\", \"version\": \"1\"}}}\n{\"jsonrpc\": \"2.0\", \"method\": \"notifications/initialized\"}\n{\"jsonrpc\": \"2.0\", \"id\": 2, \"method\": \"tools/call\", \"params\": {\"name\": \"lookup_document\", \"arguments\": {\"document_id\": \"lease-guide\"}}}",
          "filename": "stdio输入（三个JSON对象，各占一行）",
          "purpose": "复制到stdio输入；通知没有id，因此只收到initialize和tools/call两条响应。",
          "language": "json",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "共享HTTP用例直接读取shared/v2/http-cases.json，验证公开读取、越权、shell、额外参数和未鉴权。stdio测试实际启动子进程，检查握手、通知不回复、工具列表、成功读取、越权与两类错误码。第02章请求answers应404，这也是验收的一部分：后续功能尚未开放，不能仅在菜单隐藏。"
        },
        {
          "type": "table",
          "headers": [
            "检查问题",
            "解析"
          ],
          "rows": [
            [
              "MCP server列出了shell，客户端就能放心授权吗？",
              "不能。发现能力与本应用允许的能力是两层；本执行器仍只认lookup_document。"
            ],
            [
              "document_id格式正确就能读吗？",
              "还要检查当前owner与存储文档归属。Bob文档可以语法合法而业务拒绝。"
            ],
            [
              "模型说已读取是否证明工具真的执行？",
              "不能。需要执行器的返回或错误轨迹；本章用HTTP/stdio实际结果验收。"
            ]
          ]
        }
      ]
    }
  ],
  "questionIds": [
    "agent-tools-mcp-trust",
    "agent-tools-mcp-retry"
  ],
  "references": [
    {
      "title": "MCP2025-06-18传输",
      "url": "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"
    },
    {
      "title": "MCP2025-06-18工具",
      "url": "https://modelcontextprotocol.io/specification/2025-06-18/server/tools"
    }
  ],
  "status": "review",
  "kind": "series",
  "labMinutes": 30,
  "verifiedAt": "2026-10-23",
  "versions": [
    "shared/v2/CONTRACT.md · Agent02—08契约",
    "TypeScript 5.7.2 / Fastify 5.12.7 / Node.js 22.12.0",
    "Python 3.12.14 / FastAPI 0.161.1 / HTTPX 0.28.1"
  ],
  "examples": [
    {
      "label": "双语言工程完整下载",
      "path": "agent-workshop.zip"
    },
    {
      "label": "TypeScript v2运行与边界",
      "path": "agent-workshop/typescript-v2/README.md"
    },
    {
      "label": "Python v2运行与边界",
      "path": "agent-workshop/python-v2/README.md"
    }
  ]
};
export default article;
