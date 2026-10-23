import type {Article} from '../../articleTypes';
const article:Article={
  "id": "electron-trust-boundary",
  "topic": "flutter",
  "title": "Electron 权限边界：从进程与隔离到安全的报表导出",
  "description": "用锁定Electron45.0.0的完整本地项目，串起沙箱renderer、preload窄API、sender/frame校验、角色授权、固定路径与无覆盖导出。",
  "minutes": 48,
  "labMinutes": 30,
  "tags": [
    "Electron 45.0.0",
    "IPC",
    "contextBridge",
    "进程隔离",
    "桌面安全"
  ],
  "scope": "本地打包资源、reader演示角色、小CSV导出；交付开发运行项目和分层测试，不实现生产登录、长任务取消、代码签名或自动更新。真实运行环境与尚未验证能力单独记录。",
  "prerequisites": [
    "浏览器来源与脚本基础",
    "Node文件系统和Promise",
    "了解页面与系统权限差别"
  ],
  "sections": [
    {
      "id": "s17-482283",
      "title": "Electron是什么：浏览器界面与系统权限分层协作",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Electron把Chromium界面和Node系统能力组织成桌面应用。主进程管理应用生命周期、窗口和系统资源；每个页面在渲染进程里显示；preload在页面加载前建立有限的桥接能力。preload和页面主世界可以处于同一个渲染进程里的不同JavaScript上下文，它不是额外的第三个操作系统进程。先分清进程与上下文，才能理解隔离究竟限制了什么。"
        },
        {
          "type": "paragraph",
          "text": "它的作用是让网页技术做出可以调用本地能力的应用，但这些能力不必全部交给页面。普通网页发生XSS时，攻击代码通常在浏览器允许的范围里活动；若页面还能随意require文件系统、执行shell，影响就会扩展到本机。本文把“渲染内容可能已被攻击”作为前提，检查它通过我们主动暴露的接口还能做什么。"
        },
        {
          "type": "paragraph",
          "text": "贯穿案例是一项CSV报表导出：桌面角色固定为演示reader，只能导出summary；finance报表需要admin。界面只能提交reportId，主进程选择数据和目录，导出完成后返回filename与bytes。既不让页面选任意磁盘路径，也不让它提供任意要写入的文本。这个范围足够展示真实桌面程序和IPC，但没有把本地演示角色当作生产登录系统。"
        },
        {
          "type": "paragraph",
          "text": "运行版本固定Electron45.0.0、宿主工具Node22.12.0。Electron内部还有自己的Chromium与Node版本，以实际smoke日志为准；它们和终端Node是不同运行时。示例使用本地打包资源，不请求远程业务接口，不需要服务端密钥，也不能直接放进本站浏览器实验室运行。"
        },
        {
          "type": "figure",
          "src": "figures/electron-trust-boundary/processes.svg",
          "title": "三个职责与两道信任边界",
          "alt": "沙箱renderer通过contextBridge中的exportReport与openHelp调用隔离preload，再经固定IPC进入主进程；主进程校验来源、参数、权限和路径后返回有限结果。",
          "caption": "本例结构与执行顺序示意，无时间比例。preload是渲染进程内的隔离上下文。"
        },
        {
          "type": "reference",
          "title": "Electron进程模型",
          "url": "https://www.electronjs.org/docs/latest/tutorial/process-model",
          "note": "Electron官方资料，仅作机制与API出处；本例固定45.0.0，关键代码全部在本页。"
        },
        {
          "type": "reference",
          "title": "官方安全清单：权限、来源与安全默认值",
          "url": "https://www.electronjs.org/docs/latest/tutorial/security",
          "note": "Electron官方资料，仅作机制与API出处；本例固定45.0.0，关键代码全部在本页。"
        }
      ]
    },
    {
      "id": "project",
      "title": "先准备一个可运行的最小桌面项目",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "json",
          "filename": "examples/electron-trust-boundary/package.json",
          "purpose": "固定官方npm Electron版本，没有额外打包框架或大型工具链。",
          "kind": "excerpt",
          "code": "{\"name\":\"electron-trust-boundary-example\",\"version\":\"1.0.0\",\"private\":true,\"main\":\"main.cjs\",\"engines\":{\"node\":\">=22.12.0 <23\"},\"scripts\":{\"start\":\"electron .\",\"test\":\"node --test test/policy.test.cjs\",\"smoke\":\"node test/run-smoke.cjs\"},\"devDependencies\":{\"electron\":\"45.0.0\"}}\n"
        },
        {
          "type": "code",
          "language": "text",
          "filename": "项目目录",
          "kind": "excerpt",
          "purpose": "下面直接展示全部生产关键文件；test目录提供自动化入口，style.css只负责外观。",
          "code": "main.cjs\npreload.cjs\npolicy.cjs\nexport-service.cjs\nindex.html / renderer.js / style.css\ntest/policy.test.cjs\ntest/run-smoke.cjs / smoke-main.cjs\npackage.json / package-lock.json / .nvmrc"
        },
        {
          "type": "code",
          "language": "bash",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "从仓库根目录开始。独立ZIP解压后进入示例目录即可，从nvm use开始。首次运行可能下载Electron官方二进制。",
          "code": "cd examples/electron-trust-boundary\nnvm use\nnpm ci\nnpx electron --version\nnpm test\nnpm run smoke\nnpm start"
        },
        {
          "type": "paragraph",
          "text": "没有nvm时准备对应Node并跳过第一步。Electron45的npm包可能在首次运行时才下载平台二进制，因此npm ci完成不等于桌面运行时已经可用。应保留HTTPS校验和包内官方checksum校验，不通过关闭证书、沙箱或系统安全保护解决下载问题。具体安装记录和设备见VERIFICATION.md。"
        },
        {
          "type": "paragraph",
          "text": "正常启动后出现报表ID输入框和导出按钮。初始summary可导出一次；再次导出返回ALREADY_EXISTS，原文件不覆盖。终端会打印主进程选择的导出目录，位于app.getPath(\"userData\")下的exports。程序不提供任意路径接口或自动删除已有文件功能，读者如需重做，可选择新的测试用户目录或自行管理自己的导出文件。"
        }
      ]
    },
    {
      "id": "s16-422260",
      "title": "窗口、沙箱与资源来源：在主进程建立外层约束",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/electron-trust-boundary/main.cjs",
          "purpose": "完整主进程入口，包括固定资源协议、窗口设置、权限/导航约束、IPC注册与生命周期。--smoke分支只启动随项目附带的测试。",
          "kind": "excerpt",
          "code": "const {app,BrowserWindow,ipcMain,shell,protocol,net}=require('electron');\nconst path=require('node:path');\nconst {pathToFileURL}=require('node:url');\nconst {assertSender,externalURL,BoundaryError}=require('./policy.cjs');\nconst {createExportHandler}=require('./export-service.cjs');\nprotocol.registerSchemesAsPrivileged([{scheme:'atlas',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);\nconst entryURL='atlas://app/index.html';\nlet win;\nconst smoke=process.argv.includes('--smoke');\napp.whenReady().then(async()=>{\n const assets={'/index.html':'index.html','/renderer.js':'renderer.js','/style.css':'style.css'};\n protocol.handle('atlas',request=>{\n  const url=new URL(request.url),file=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:null;\n  if(request.method!=='GET'||url.hostname!=='app'||url.username||url.password||url.port||url.search||!file)return new Response('Not found',{status:404});\n  return net.fetch(pathToFileURL(path.join(__dirname,file)).href);\n });\n win=new BrowserWindow({width:840,height:680,show:!smoke,webPreferences:{\n  preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false,\n }});\n const contents=win.webContents;\n contents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));\n contents.session.setPermissionCheckHandler(()=>false);\n contents.setWindowOpenHandler(()=>({action:'deny'}));\n contents.on('will-navigate',event=>event.preventDefault());\n contents.on('will-redirect',event=>event.preventDefault());\n contents.on('will-attach-webview',event=>event.preventDefault());\n ipcMain.handle('reports:export',createExportHandler({getWindow:()=>win,entryURL,exportDir:smoke?process.env.ELECTRON_SMOKE_DIR:path.join(app.getPath('userData'),'exports')}));\n ipcMain.handle('reports:help',async event=>{\n  try{assertSender(event,win,entryURL);await shell.openExternal(externalURL('https://www.electronjs.org/docs/latest/tutorial/security'));return {ok:true};}\n  catch(error){return {ok:false,code:error instanceof BoundaryError?error.code:'OPEN_FAILED',message:'无法打开帮助'};}\n });\n if(!smoke)console.log('Exports directory:',path.join(app.getPath('userData'),'exports'));\n await win.loadURL(entryURL);\n if(smoke)await require('./test/smoke-main.cjs').run({app,win,entryURL});\n}).catch(error=>{console.error('[startup failed]',error);app.exit(1);});\napp.on('window-all-closed',()=>app.quit());\n"
        },
        {
          "type": "paragraph",
          "text": "先看窗口配置中的三个独立开关。nodeIntegration:false让普通页面不获得Node集成；contextIsolation:true让preload与页面主世界分开；sandbox:true保留渲染进程的Chromium沙箱。preload仍能require Electron提供的受限桥接模块，但不应把它当成有完整Node能力的第二个主进程。显式写出这些配置，既方便核对，也避免靠记忆推断某个版本的默认值。"
        },
        {
          "type": "paragraph",
          "text": "本例通过atlas://app/index.html加载页面。protocol只映射index.html、renderer.js、style.css三个固定资源，拒绝其它路径、主机、非GET请求及query。映射表没有把URL路径拼进磁盘路径；%2e%2e之类输入无法借它变成任意文件读取。底层net.fetch读取的是主进程选定的本地固定文件，浏览器脚本没有获得文件系统API。"
        },
        {
          "type": "paragraph",
          "text": "新窗口默认deny；页面发起的导航、重定向与webview挂载被阻止；权限请求和检查均拒绝。帮助按钮不依赖在应用窗口中加载远程文档，而是请求主进程打开一个固定HTTPS地址。这里把可信源缩到打包页面，后面IPC仍然逐次校验实际调用者。"
        },
        {
          "type": "paragraph",
          "text": "注册安全协议并不等于任意协议处理逻辑都安全；真正限制读取范围的是那张固定资产表。沙箱也不替代业务授权：如果桥接API主动让页面执行任意命令，页面即使仍在沙箱里，也能通过你的主进程完成那项危险操作。"
        },
        {
          "type": "reference",
          "title": "进程沙箱与preload可用能力",
          "url": "https://www.electronjs.org/docs/latest/tutorial/sandbox",
          "note": "Electron官方资料，仅作机制与API出处；本例固定45.0.0，关键代码全部在本页。"
        },
        {
          "type": "reference",
          "title": "contextIsolation的作用",
          "url": "https://www.electronjs.org/docs/latest/tutorial/context-isolation",
          "note": "Electron官方资料，仅作机制与API出处；本例固定45.0.0，关键代码全部在本页。"
        }
      ]
    },
    {
      "id": "s19-463235",
      "title": "IPC接口先收窄，再在主进程逐项校验",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/electron-trust-boundary/preload.cjs",
          "purpose": "完整preload，只有两个固定业务方法。没有暴露ipcRenderer、任意channel、event对象或文件路径。",
          "kind": "excerpt",
          "code": "const {contextBridge,ipcRenderer}=require('electron');\ncontextBridge.exposeInMainWorld('reports',{\n exportReport:reportId=>ipcRenderer.invoke('reports:export',{reportId}),\n openHelp:()=>ipcRenderer.invoke('reports:help'),\n});\n"
        },
        {
          "type": "paragraph",
          "text": "页面只能调用window.reports.exportReport(id)和openHelp()。前者固定转换成reports:export通道与{reportId}；后者根本不接收URL。攻击页面可以反复调用这些允许的方法，却不能借一个通用invoke(channel,payload)去探测其它主进程通道。contextBridge传递的是受控API，这和把整个ipcRenderer对象交出去是不同的能力边界。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/electron-trust-boundary/policy.cjs",
          "purpose": "完整策略代码。来源、输入、路径与外部链接分别有独立判断；导出服务消费这些判断。",
          "kind": "excerpt",
          "code": "const path=require('node:path');\nclass BoundaryError extends Error{constructor(code,message){super(message);this.code=code;}}\nfunction assertSender(event,win,entryURL){\n if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame?.url!==entryURL)throw new BoundaryError('UNAUTHORIZED','当前页面不能调用这个能力');\n}\nfunction reportId(payload){\n if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==1||typeof payload.reportId!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(payload.reportId))throw new BoundaryError('INVALID_INPUT','报表ID格式错误');\n return payload.reportId;\n}\nfunction safeTarget(root,id){\n // 即使调用者漏过一层校验，也不会接受路径片段。\n const name=reportId({reportId:id})+'.csv';\n const target=path.resolve(root,name),relative=path.relative(root,target);\n if(relative.startsWith('..')||path.isAbsolute(relative))throw new BoundaryError('INVALID_PATH','导出路径超出范围');\n return target;\n}\nfunction externalURL(value){\n if(typeof value!=='string')throw new BoundaryError('INVALID_URL','链接不可打开');\n let url;try{url=new URL(value);}catch{throw new BoundaryError('INVALID_URL','链接不可打开');}\n if(url.protocol!=='https:'||url.hostname!=='www.electronjs.org'||url.port||url.username||url.password||url.pathname!=='/docs/latest/tutorial/security'||url.search||url.hash)throw new BoundaryError('INVALID_URL','只允许固定的官方安全文档');\n return url.href;\n}\nmodule.exports={BoundaryError,assertSender,reportId,safeTarget,externalURL};\n"
        },
        {
          "type": "paragraph",
          "text": "来源检查同时看三件事：event.sender必须是当前可信窗口的webContents，senderFrame必须正是它的mainFrame，而且frame URL必须等于固定入口。只检查URL不够：另一个窗口也可以加载同一页面；只检查webContents也不够：它可能包含来自其它frame的调用。窗口已销毁、未知webContents或其它frame都会在访问报表前被拒绝。"
        },
        {
          "type": "paragraph",
          "text": "参数检查要求只有reportId一个字段，且是长度1～40、以小写字母开始的限定ID。这里只把它当资源标识，不允许斜杠、反斜杠、百分号编码或绝对路径。额外path字段也会失败。输入校验回答格式合法与否，reader是否允许看finance还要由下一节的角色表判断。"
        },
        {
          "type": "paragraph",
          "text": "safeTarget在主进程选定的根下计算目标，并再次验证ID与相对路径。externalURL解析URL后限定https、精确hostname和文档路径，拒绝凭据、任意端口及查询参数。比较hostname而不是字符串包含electronjs.org，可以拒绝electronjs.org.evil.example这样的伪装。当前openHelp连这个字符串输入都不接收，URL校验作为主进程的额外约束保留。"
        },
        {
          "type": "reference",
          "title": "IPC与固定能力封装",
          "url": "https://www.electronjs.org/docs/latest/tutorial/ipc",
          "note": "Electron官方资料，仅作机制与API出处；本例固定45.0.0，关键代码全部在本页。"
        },
        {
          "type": "reference",
          "title": "contextBridge API与可传递类型",
          "url": "https://www.electronjs.org/docs/latest/api/context-bridge",
          "note": "Electron官方资料，仅作机制与API出处；本例固定45.0.0，关键代码全部在本页。"
        }
      ]
    },
    {
      "id": "export",
      "title": "真正写入：谁选内容、谁选路径、怎样处理重复",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/electron-trust-boundary/export.svg",
          "title": "从请求到文件发布的正常与拒绝路径",
          "alt": "summary先通过来源、格式和reader权限，取得单任务槽位，在主进程固定目录写临时文件后以不覆盖hard link发布。未知窗口、finance、路径输入、重复文件分别被拒绝。",
          "caption": "本例结构与执行顺序示意，无时间比例。preload是渲染进程内的隔离上下文。"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/electron-trust-boundary/export-service.cjs",
          "purpose": "完整服务，包括资源表、授权、并发槽位、临时文件、无覆盖发布、错误转换与finally释放。",
          "kind": "excerpt",
          "code": "const fs=require('node:fs/promises');\nconst {constants}=require('node:fs');\nconst {randomUUID}=require('node:crypto');\nconst path=require('node:path');\nconst {BoundaryError,assertSender,reportId,safeTarget}=require('./policy.cjs');\n// 主进程维护可导出资源和用户权限；renderer提交ID而非文件路径/内容。\nconst reports={\n summary:{roles:['reader','admin'],text:'month,total\\n2026-09,12\\n2026-10,18\\n'},\n finance:{roles:['admin'],text:'internal-only\\nconfidential\\n'},\n};\nfunction createExportHandler({getWindow,entryURL,exportDir,role='reader'}){\n let busy=false;\n return async(event,payload)=>{\n  let ownsSlot=false;\n  try{\n   const win=getWindow();assertSender(event,win,entryURL);const id=reportId(payload);\n   const report=Object.hasOwn(reports,id)?reports[id]:null;if(!report||!report.roles.includes(role))throw new BoundaryError('FORBIDDEN','无权导出此报表');\n   if(busy)throw new BoundaryError('BUSY','已有导出正在处理');busy=true;ownsSlot=true;\n   await fs.mkdir(exportDir,{recursive:true,mode:0o700});const root=await fs.realpath(exportDir);\n   const target=safeTarget(root,id);\n   if(win.isDestroyed())throw new BoundaryError('WINDOW_CLOSED','窗口已经关闭');\n   // 先完整写临时文件，再用不覆盖的hard link发布最终名字。\n   const temp=path.join(root,'.tmp-'+randomUUID());\n   let file;\n   try{\n    file=await fs.open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);\n    try{await file.writeFile(report.text,'utf8');}finally{await file.close();}\n    if(win.isDestroyed())throw new BoundaryError('WINDOW_CLOSED','窗口已经关闭');\n    try{await fs.link(temp,target);}\n    catch(error){if(error.code==='EEXIST'||error.code==='ELOOP')throw new BoundaryError('ALREADY_EXISTS','目标已经存在，示例不会覆盖');throw error;}\n   }finally{await fs.unlink(temp).catch(()=>{});}\n   return {ok:true,filename:id+'.csv',bytes:Buffer.byteLength(report.text)};\n  }catch(error){\n   if(error instanceof BoundaryError)return {ok:false,code:error.code,message:error.message};\n   console.error('[export failed]',error);return {ok:false,code:'IO_ERROR',message:'导出失败，请检查应用目录权限'};\n  }finally{if(ownsSlot)busy=false;}\n };\n}\nmodule.exports={createExportHandler};\n"
        },
        {
          "type": "paragraph",
          "text": "带入一次正常调用：固定窗口主frame提交{reportId:\"summary\"}。assertSender通过，reportId通过，主进程表中summary允许reader。busy从false变true后，服务建立exports目录并取得其realpath，safeTarget得到这个根里的summary.csv。到这里，调用者没有提供任何绝对路径，也没有提供要导出的报表内容。"
        },
        {
          "type": "paragraph",
          "text": "随后在同一目录创建随机临时文件。O_EXCL要求它尚不存在，O_NOFOLLOW拒绝跟随最后一级符号链接，mode 0600将文件权限收窄到当前用户。写入并关闭后，fs.link(temp,target)把完整文件发布为summary.csv：如果目标已经存在，即使它是符号链接，也只会失败，不会顺着链接改写其它位置。finally清理临时名字，正常返回filename与字节数。"
        },
        {
          "type": "paragraph",
          "text": "这里采用“临时文件写完再发布”而不是直接写最终文件，防止普通写入异常给用户留下看似已经成功的半份CSV。进程被强制结束时仍可能留下临时文件；没有fsync就不能承诺断电后的持久性。hard link还要求文件系统支持这一能力，本例只在记录的本地设备环境验证，不把它推广为所有网络盘的保证。"
        },
        {
          "type": "paragraph",
          "text": "busy是主进程的一次任务槽位，不是按钮disabled的替代名字。两个调用同时到达，后到的返回BUSY；只有真正持有槽位的那次调用才在finally释放。若让拒绝的调用也把busy设回false，就可能在第一份文件还没写完时放进第三个任务。与此独立，文件名的O_EXCL/link不覆盖策略防止已有结果被重写。"
        },
        {
          "type": "paragraph",
          "text": "把输入改为finance：来源与格式仍可能合法，但角色表拒绝，返回FORBIDDEN。输入constructor也不会读到对象原型的成员，因为资源表用Object.hasOwn检查自身属性。把ID改为../secret在格式层被拒绝；在导出目录放一个summary.csv符号链接，发布阶段返回ALREADY_EXISTS，链接指向的文件保持原内容。"
        },
        {
          "type": "paragraph",
          "text": "realpath界定了本次选定的真实目录；它不是防御同一操作系统用户恶意替换目录的完整方案。威胁模型是被攻击的renderer通过已暴露接口发请求，未假设攻击者已经能任意修改应用用户目录或替换主进程代码。这个边界必须说清，不能从一个路径校验函数推导整台电脑已经可信。"
        }
      ]
    },
    {
      "id": "renderer",
      "title": "界面只负责输入、反馈与固定能力调用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "html",
          "filename": "examples/electron-trust-boundary/index.html",
          "purpose": "完整页面。CSP从none开始，只允许本地脚本/样式/图片，不允许网络连接、frame、对象或表单导航。",
          "kind": "excerpt",
          "code": "<!doctype html>\n<html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><title>Electron 权限边界实验</title>\n<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\">\n<link rel=\"stylesheet\" href=\"style.css\"></head><body>\n<h1>报表导出：页面提出请求，主进程决定权限</h1>\n<p>演示角色为 reader。只允许导出 summary，finance 为受限资源。</p>\n<label>报表ID <input id=\"report-id\" value=\"summary\" maxlength=\"40\"></label>\n<button id=\"export\">导出到应用目录</button><button id=\"help\">官方安全文档</button>\n<p id=\"status\" role=\"status\">等待操作。导出文件不会覆盖。</p>\n<p>界面没有 Node 文件系统能力，只获得 exportReport 与 openHelp 两个固定方法。</p>\n<script src=\"renderer.js\"></script></body></html>\n"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "examples/electron-trust-boundary/renderer.js",
          "purpose": "完整界面逻辑。显示返回值用textContent，避免把报表ID或错误当HTML执行。",
          "kind": "excerpt",
          "code": "const input=document.querySelector('#report-id'),button=document.querySelector('#export'),status=document.querySelector('#status');\nbutton.addEventListener('click',async()=>{\n button.disabled=true;status.textContent='正在导出…';\n try{\n  const result=await window.reports.exportReport(input.value);\n  status.textContent=result.ok?`已导出 ${result.filename}（${result.bytes} 字节）`:`${result.code}：${result.message}`;\n }catch{status.textContent='通信失败，主进程可能已经退出';}\n finally{button.disabled=false;}\n});\ndocument.querySelector('#help').addEventListener('click',async()=>{\n try{const result=await window.reports.openHelp();status.textContent=result.ok?'已请求系统浏览器打开固定官方文档':result.message;}catch{status.textContent='无法联系主进程';}\n});\n"
        },
        {
          "type": "paragraph",
          "text": "点击导出后，按钮先禁用，页面显示正在处理。成功时显示主进程返回的文件名与字节数；业务拒绝显示稳定错误码；通信异常则提示主进程可能已退出。页面没有拼磁盘路径，也没有在收到错误时替换成另一个更宽泛的通道。"
        },
        {
          "type": "paragraph",
          "text": "CSP把脚本限制为固定本地文件，拒绝inline script与动态执行等入口；它降低不可信内容变成脚本的机会，但我们仍按页面可能被攻陷设计IPC。textContent确保错误消息是文字。攻击者如果已控制renderer，仍能调用允许的summary导出和固定帮助能力，因此业务API的数量、权限与资源上限依然重要。"
        },
        {
          "type": "paragraph",
          "text": "本例help按钮只打开Electron官方安全文档。smoke不会调用它，避免自动弹系统浏览器；策略测试会覆盖允许与禁止的URL，实际系统浏览器交接留给人工点击。没有测试过这一步，就不声称外部浏览器在所有系统上都已验收。"
        }
      ]
    },
    {
      "id": "s10-264569",
      "title": "主进程生命周期与长任务边界",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "主进程还要处理窗口事件与IPC，所以本例使用异步文件API，没有把长CSV计算压到事件循环里。现在报表是固定小字符串，异步写入足够；如果换成上百万行转换、压缩或索引，单纯把函数写成async不会让CPU循环让出线程，应评估worker_threads或utilityProcess，并明确任务ID、并发上限、取消和资源回收。"
        },
        {
          "type": "paragraph",
          "text": "窗口在读写前销毁会被来源或窗口检查拒绝，临时文件发布前也会再检查一次。关闭窗口与系统终止仍可能发生在检查之后，不能因此承诺取消操作在任意时刻都原子成功。这个小示例没有长任务进度订阅、可取消导出或自动更新程序；这些能力没有实现，就不会靠一段建议把它们标成已完成。"
        },
        {
          "type": "paragraph",
          "text": "示例在所有窗口关闭时退出，导出处理函数在app.ready后只注册一次。若业务程序支持关闭后重新建立窗口，应避免每次建窗重复ipcMain.handle注册；可以保留一个读取当前可信窗口的处理器，或者明确解除旧注册。生产发布还需处理代码签名、公证、安装器与更新来源，本项目交付开发运行实例，不把npm start当成完成桌面分发。"
        }
      ]
    },
    {
      "id": "s14-430459",
      "title": "按攻击者能提交的输入验证，再检查结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本机macOS14.5、x86_64已实际运行：Electron45.0.0、Chromium156.0.8078.48、内嵌Node24.22.0。5项策略/文件系统测试通过，真实Electron smoke也通过；检查内容与限制如下。没有用普通Node对象模拟来代替这次真实进程启动。"
        },
        {
          "type": "figure",
          "src": "figures/electron-trust-boundary/runtime-smoke.png",
          "title": "实际Electron窗口：按钮触发IPC后成功导出34字节CSV",
          "alt": "真实Electron窗口显示summary报表和已导出summary.csv 34字节的状态，界面提示没有Node文件系统能力。",
          "caption": "2026-10-23，macOS14.5 x86_64，来自真实Electron45 smoke的capturePage，不是设计稿。"
        },
        {
          "type": "table",
          "headers": [
            "输入/状态",
            "预期结果",
            "验证目标"
          ],
          "rows": [
            [
              "可信主frame + summary",
              "ok，创建完整summary.csv",
              "正常链路"
            ],
            [
              "另一个webContents，哪怕URL相同",
              "UNAUTHORIZED",
              "调用来源"
            ],
            [
              "finance或未知资源",
              "FORBIDDEN",
              "格式与权限分离"
            ],
            [
              "../x、额外path字段",
              "INVALID_INPUT",
              "路径不由renderer决定"
            ],
            [
              "同时两次导出",
              "一份执行，其它BUSY",
              "主进程并发槽位"
            ],
            [
              "已有summary或目标符号链接",
              "ALREADY_EXISTS，外部文件不变",
              "不覆盖与链接边界"
            ],
            [
              "目录不可用",
              "IO_ERROR，无内部绝对路径",
              "错误收敛"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "先运行npm test。策略测试使用临时目录和真实文件系统，检查来源、主frame、路径/输入、角色、并发、重复与符号链接，结束后清理。这里用普通对象模拟Ipc事件，只能验证策略函数对这些输入的判断；它不证明浏览器中真的没有Node能力。"
        },
        {
          "type": "paragraph",
          "text": "再运行npm run smoke。它启动真正的Electron与沙箱renderer，检查主世界没有require/process、桥接只有两个方法，通过真实IPC导出summary并核对文件，拒绝finance、路径输入和重复目标；再建立第二个相同URL的真实webContents，确认它仍被UNAUTHORIZED拒绝。它会输出实际Electron/Chromium/Node、架构和检查列表，并保存临时窗口截图。具体是否已在本机通过，以VERIFICATION.md的实际记录为准。"
        },
        {
          "type": "paragraph",
          "text": "理解检查一：另一个窗口也加载atlas://app/index.html，能否凭URL相同导出？解析：不能，assertSender还要求event.sender是当前主窗口的webContents，mainFrame引用也匹配；测试的第二个真实窗口正好验证这一点。"
        },
        {
          "type": "paragraph",
          "text": "理解检查二：renderer不再有Node，为什么还要在主进程限制finance？解析：renderer仍然有exportReport桥接方法，沙箱不负责解释业务ID；如果主进程照单全收，攻击脚本仍能通过IPC拿到本不该导出的数据。格式校验和业务授权在同一正常来源下仍是必要的。"
        },
        {
          "type": "paragraph",
          "text": "理解检查三：把button.disabled删掉会不会让两份任务覆盖文件？解析：busy仍在主进程限制同时执行，不覆盖发布仍限制最终名字。界面禁用主要减少重复交互，不能作为信任边界。用户需要允许重复导出时，应由主进程设计唯一输出ID和资源策略，再扩展API。"
        },
        {
          "type": "paragraph",
          "text": "现在这项能力可以逐层解释：页面提交有限意图，preload固定通道，主进程验证来源与参数、确认角色、选定数据和位置，异步写完后发布文件，最后返回可公开的结果。读者可以直接沿正文代码推演正常与拒绝路径；外部链接仅用于核对Electron的机制与API出处。"
        }
      ]
    }
  ],
  "questionIds": [
    "electron-trust-boundary-ipc",
    "electron-trust-boundary-lifecycle"
  ],
  "references": [
    {
      "title": "Electron安全指南",
      "url": "https://www.electronjs.org/docs/latest/tutorial/security"
    },
    {
      "title": "Electron进程模型",
      "url": "https://www.electronjs.org/docs/latest/tutorial/process-model"
    },
    {
      "title": "Electron隔离与桥接",
      "url": "https://www.electronjs.org/docs/latest/tutorial/context-isolation"
    }
  ],
  "status": "review",
  "kind": "tutorial",
  "versions": [
    "Electron 45.0.0",
    "工具Node.js 22.12.0",
    "macOS 14.5 x86_64（运行情况见核验记录）"
  ],
  "verifiedAt": "2026-10-23",
  "examples": [
    {
      "label": "完整Electron项目ZIP",
      "path": "electron-trust-boundary.zip"
    },
    {
      "label": "运行与复现说明",
      "path": "electron-trust-boundary/README.md"
    },
    {
      "label": "设备与实际验证记录",
      "path": "electron-trust-boundary/VERIFICATION.md"
    }
  ]
};
export default article;
