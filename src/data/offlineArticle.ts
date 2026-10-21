import type {Article} from './articles';

export const offlineArticle:Article={
 id:'offline-first-static-site',topic:'operations',
 title:'让网站断网后也能打开：从构建清单到完整离线快照',
 description:'以 Fullstack Atlas 为例，拆解一键下载、Service Worker 请求拦截、缓存版本更新和失败恢复，解释离线阅读为什么远不止缓存一个 HTML。',
 minutes:30,tags:['Service Worker','Cache Storage','离线访问','PWA','GitHub Pages','版本一致性'],
 scope:'基于本站 2026 年 10 月的实际实现。示例注明了节选或伪代码；同时记录当前限制与后续改进方向，不将简化实现描述为完整的安全或同步系统。',
 prerequisites:['JavaScript Promise 与 async/await','HTTP 请求、响应头和缓存基础','React 与 Vite 构建产物'],
 questionIds:['http-cache','cache-isolation','web-performance'],
 sections:[
 {id:'goal',title:'先定义“离线可用”到底包括什么',paragraphs:[
 '这个个人站点最初的需求很直接：有时只有手机、有时网络不稳定，希望提前保存内容，之后仍能阅读文章、复习知识和运行代码。判断方案是否完成，不能只看当前页面在断网后还留在屏幕上，而应关闭或刷新页面，再打开之前没有访问过的内容。',
 '本站的离线范围包括构建出来的 HTML、CSS、JavaScript、图标、文章数据，以及代码实验室的延迟加载模块、TypeScript Worker 和本地 React 运行时。文章数据编译在 JavaScript 中，因此清单不必为每篇文章单独列一个文件。',
 'GitHub Discussions、外部参考网站和邮件发送不属于这个范围。缓存应用代码不会把远端服务搬到本机；代码实验本身若主动调用网络，也仍然可能失败。这里实现的是静态内容与本地运行能力的离线使用。'],takeaway:'验收标准是断网后重新加载并访问未打开过的功能，而不是断网前的 DOM 还在。'},
 {id:'layers',title:'把三种存储与两类 Worker 分清楚',paragraphs:[
 'HTTP 缓存由浏览器按响应头等规则管理，适合减少重复传输，但它并不是用户明确选择保存的完整网站版本。Cache Storage 则允许应用用请求作为键保存 Response，并在请求拦截时主动选择返回哪个副本。',
 '本站用 localStorage 保存笔记、收藏、进度和代码草稿，用 sessionStorage 保存当前标签页的简单登录状态。它们与离线资源缓存分开，所以“清除离线内容”只删除本站对应的 Cache Storage，不主动删除笔记。浏览器清除整个站点数据则可能同时删除这些数据。',
 'Service Worker 是浏览器管理的事件驱动脚本，负责拦截其作用范围内的请求；它不是常驻进程，也不能直接操作页面 DOM。实验室里的 Web Worker 负责代码执行或类型检查，是另一种职责。不要因为名字都带 Worker，就认为缓存控制和计算任务必须放在同一个线程里。'],code:'构建产物 → Cache Storage → 断网后的页面与代码资源\n学习记录 → localStorage → 笔记、进度、草稿\n登录状态 → sessionStorage → 当前标签页的展示权限\n\nService Worker：处理安装、消息与 fetch 事件\nWeb Worker：执行 JS / TS 实验或类型检查',language:'职责划分'},
 {id:'manifest',title:'构建时生成清单，才能缓存“还没访问过”的资源',paragraphs:[
 '如果只缓存用户实际请求过的文件，第一次进入文章页可能正常，但离线后第一次打开 React 实验室仍会失败，因为懒加载的编译器从未下载。解决办法是在构建完成后扫描整个 dist 目录，而不是只扫描首页的 script 标签。',
 'scripts/offline.mjs 会递归收集构建文件、排序，将文件路径和内容输入 SHA-256，取摘要前 16 位作为版本标识，并累计文件字节数。路径参与摘要可以反映资源改名；排序让文件系统遍历顺序不影响结果。这个摘要用于区分版本，客户端目前不拿它校验每个下载文件的完整性。',
 '清单本身和 sw.js 不进入内容清单，避免生成过程自引用。清单输出后再复制 Service Worker 脚本到 dist。这里的 offline-manifest.json 是本站自己的资源清单，不是用于安装图标、名称等信息的 Web App Manifest；支持离线并不要求先“安装到桌面”。'],code:'// scripts/offline.mjs 中的核心逻辑，省略递归函数\nconst files = (await walk("dist"))\n  .filter(p => !p.endsWith("/sw.js") &&\n               !p.endsWith("/offline-manifest.json"))\n  .sort();\nconst hash = createHash("sha256");\nlet bytes = 0;\nfor (const file of files) {\n  const content = await readFile(file);\n  bytes += content.length;\n  hash.update(file);\n  hash.update(content);\n}\nconst manifest = {\n  version: hash.digest("hex").slice(0, 16),\n  bytes,\n  files: files.map(p => "./" + p.slice(5))\n};',language:'JavaScript'},
 {id:'scope',title:'注册位置决定了 GitHub Pages 子目录能否正确工作',paragraphs:[
 '项目站点部署在 /fullstack-atlas/ 下，而不是域名根目录。若把脚本地址写成 /sw.js，就会请求错误位置；若缓存资源写成 /assets/xxx.js，也会绕过项目目录。因此本站以 document.baseURI 解析相对地址，并让 Service Worker 的 scope 对准当前项目目录。',
 '正常部署需要 HTTPS；本机 localhost 或回环地址可用于开发测试。本站开发服务器不启用这套离线流程，避免旧缓存盖住 Vite 热更新。实际验证应执行生产构建，再使用 preview 服务。',
 '注册成功不等于所有页面已经受控。脚本要经历安装和激活。本站在 install 中调用 skipWaiting，在 activate 中通过 clients.claim 请求接管页面；页面端等待 worker 激活后再发送下载消息。更复杂的产品应评估立即接管是否会造成新 Worker 与旧页面协议不兼容。'],code:'// Offline.tsx 注册片段\nconst registration = await navigator.serviceWorker.register(\n  new URL("sw.js", document.baseURI).href,\n  { scope: new URL(".", document.baseURI).pathname }\n);\n\n// scripts/sw.js 生命周期片段\nself.addEventListener("install", () => self.skipWaiting());\nself.addEventListener("activate", event => {\n  event.waitUntil(self.clients.claim());\n});',language:'JavaScript'},
 {id:'messages',title:'点击下载后，页面怎样知道进度和结果',paragraphs:[
 '页面与 Service Worker 通过 postMessage 通信。本站为每次操作创建 MessageChannel，把其中一个端口传给 Worker，页面保留另一个端口接收结果。STATUS 查询已安装版本，DOWNLOAD 下载整站内容，CLEAR 清除本站离线缓存。',
 '每成功保存一个资源，Worker 回传已完成数量与总数。页面据此显示百分比，因此它是“文件数量进度”，不是字节进度。一个很大的编译器文件可能让百分比停留较久，这不一定代表卡死。',
 'Worker 用 event.waitUntil 让异步任务属于当前消息事件。页面为等待设置超时，每收到进度就延长等待；超时会结束页面的等待，并不代表底层下载已被取消。当前 busy 标记可以防止同一 Worker 实例重叠执行修改操作，但不是跨重启的持久锁，也没有实现断点续传。'],code:'// 通信结构示意，省略超时与错误处理\nconst channel = new MessageChannel();\nchannel.port1.onmessage = event => {\n  const { progress, total, done, error } = event.data;\n  // 更新进度、展示成功或失败\n};\nworker.postMessage({ type: "DOWNLOAD" }, [channel.port2]);\n\n// Worker 下载一个资源后\nport.postMessage({ progress: completed, total });',language:'JavaScript'},
 {id:'snapshot',title:'先下载到候选缓存，完成后才让它对外可见',paragraphs:[
 '直接在旧缓存里逐个覆盖文件很危险：假设新的 HTML 已写入，但对应脚本下载失败，原本可用的离线版本也可能被破坏。本站为每次下载建立独立缓存，名称包含应用 scope、版本号和时间戳，旧缓存保持不动。',
 '每个资源使用 no-store 获取，检查 HTTP 状态，并拒绝 opaque 响应。还会检查资源是否同源、是否位于本站作用范围内。资源全部保存以后，才写入 offline-ready 元数据标记。只有有此标记的缓存才会进入可用版本列表。',
 '下载期间发生错误，会删除这次的候选缓存并报告失败，旧完整版本继续可用。如果浏览器中途终止 Worker，清理逻辑可能没机会运行；没有标记的残留缓存不会被使用，但目前需要清除离线内容才能统一回收。这个设计提供“完整版本才发布”的应用层约定，不是 Cache Storage 支持了跨文件数据库事务。'],code:'// 事务式发布思路，伪代码\nconst candidate = await caches.open(uniqueCacheName);\ntry {\n  for (const url of manifest.files) {\n    const response = await fetch(url, { cache: "no-store" });\n    if (!response.ok) throw new Error("下载失败");\n    await candidate.put(url, response);\n  }\n  // 最后写完成标记；此前不参与请求响应\n  await candidate.put(READY_URL, new Response(JSON.stringify(metadata)));\n} catch (error) {\n  await caches.delete(uniqueCacheName);\n  throw error;\n}',language:'JavaScript'},
 {id:'fetch',title:'真正断网时，请求如何返回缓存',paragraphs:[
 'fetch 事件只处理同源、作用范围内的 GET 请求，并排除 sw.js 和离线清单。导航请求统一映射到本站 index.html，其余请求按照资源 URL 查找。本站使用 hash 路由，#article/xxx 不会发送到服务器，首页脚本加载后再解析它并显示对应内容。',
 '请求处理按保存时间从新到旧扫描完整缓存，找到资源就直接返回，没有命中才请求网络。这是一种以已安装快照为优先的策略：即使在线，也优先使用用户保存的内容版本，从而减少新首页与旧脚本混用。',
 '当前保留最新与前一份完整缓存，使已打开的旧页面有机会找到原来的哈希资源。不过这只是有限兼容：长期打开的页面若跨越多个版本，仍可能需要刷新；相同 URL 的无哈希资源也不能保证按每个标签页固定版本。不要把它说成严格的多版本会话隔离。'],code:'// scripts/sw.js 中的请求处理核心，省略前置过滤\nconst list = await installed();\nconst target = request.mode === "navigate"\n  ? new URL("./index.html", self.registration.scope).href\n  : request;\nfor (const item of list) {\n  const hit = await item.cache.match(target, { ignoreVary: true });\n  if (hit) return hit;\n}\nreturn fetch(request);',language:'JavaScript'},
 {id:'vary',title:'为什么缓存显示成功，刷新后却可能白屏',paragraphs:[
 '调试离线功能时，页面能显示 HTML，却没有执行脚本，是一个非常有用的线索。它说明“有首页缓存”和“依赖资源能被正确匹配”是两件事。可以逐个检查脚本请求、Cache Storage 中的键以及响应头，而不是反复重装 Service Worker。',
 'Cache.match 默认会考虑响应的 Vary。预览服务可能返回 Vary: Origin，预下载请求和浏览器加载模块的请求头又可能不同，导致 URL 一致但缓存不命中。本站对清单中的同源静态资源使用 ignoreVary: true，避免这种匹配差异。',
 '这个选择有明确前提：相同 URL 对应相同的公开静态内容。如果响应会随语言、用户、授权信息等变化，忽略 Vary 可能把错误版本交给用户。这段实现不应该直接复制到登录 API 或按用户返回数据的缓存层。'],takeaway:'缓存键必须覆盖真正影响响应的输入；忽略响应差异只能用于确定不需要这些差异的资源。'},
 {id:'update',title:'内容更新与 Service Worker 更新是两条流程',paragraphs:[
 '文章发布后，GitHub Pages 提供新的构建资源与离线清单，但已经安装快照的浏览器仍优先读取旧内容。用户要在离线阅读页面点击“下载最新离线版本”，等待成功，再刷新页面切换。这是当前明确采用的更新方式，不是自动实时同步。',
 '离线清单不从本站缓存响应，更新请求还使用 no-store，以便尝试读取线上清单。sw.js 由浏览器的注册与更新流程管理；它不在内容快照内。内容版本摘要不包含 Worker 本身，因此不能只看离线版本号判断 Worker 脚本是否更新。',
 '当前下载只检查响应是否成功，没有逐文件摘要校验。如果下载期间线上部署切换，缺失资源会让候选版本失败，但全部返回 200 也不代表绝对没有跨发布混用。更严格的实现应使用不可变版本目录、每文件摘要和服务端保留策略，再验证清单与资源属于同一次发布。',
 '后续还可以增加“发现新版本”的提醒，或者把下载、验证、切换拆成明确按钮。自动更新能省操作，但需要处理读到一半的文章和未保存状态；保持可预测的更新行为比单纯追求自动化更重要。']},
 {id:'storage',title:'保存成功不等于永久保存，也不等于文件下载',paragraphs:[
 'Cache Storage 存在于当前浏览器和来源的存储空间中，不是 Downloads 目录里的压缩包。它不能自动跨手机和电脑同步。更换浏览器、清理站点数据或在存储压力下被回收，都可能需要重新下载。',
 '下载前本站尝试调用 navigator.storage.persist() 申请持久化存储。是否批准由浏览器决定；返回 false 不代表不能使用缓存，只表示没有获得持久化保障。用户主动清除站点数据仍会删除内容。当前页面没有展示申请结果，后续可补充状态和容量预估。',
 '界面中的 MB 来自构建文件原始字节数之和，不等于压缩后的网络流量，也不等于缓存元数据开销。为了让从未打开的代码实验也能离线运行，需要一并保存较大的编译器与 Worker。更精细的产品可以把“只保存文章”和“包含代码实验”做成两个下载包。',
 '域名变化也意味着来源变化。本站从旧 GitHub 用户名切换到新用户名以后，新域名无法直接读取旧域名的笔记和缓存；学习记录需要通过已有的 JSON 导出与导入迁移，离线资源则在新域名重新下载。']},
 {id:'auth',title:'登录限制的是入口，不是已下载内容的保密性',paragraphs:[
 '本站未登录时隐藏深度研习、个人笔记和离线阅读入口，直接访问也会被页面拦截；下载按钮再次检查当前登录状态。由于这是纯静态个人站点，登录校验与内容都在客户端，功能定位是学习内容的展示控制。',
 '下载整站会把相应静态代码和文章数据保存到浏览器，退出登录不会抹除这份资源。缓存也没有按账号加密或隔离。本文不展示实际账号密码；但需要认识到，把口令写入前端本身就无法形成可靠的访问控制。',
 '若未来存放真正的私人资料，需要重新设计服务端授权、按用户隔离的数据存储、退出清理和离线许可。离线设备无法实时感知服务端撤权，已交付的明文也无法保证远程收回。这些是产品与安全设计问题，不能靠隐藏按钮解决。']},
 {id:'verify',title:'如何验证离线能力，而不是被热缓存骗过',paragraphs:[
 '第一步，执行 npm run build，再启动 npm run preview。在登录后的离线阅读页完成整站下载，确认显示保存时间和资源数量。开发服务故意不支持这套缓存流程，所以不要直接用 npm run dev 的页面作为验收依据。',
 '第二步，在浏览器开发者工具切到 Offline 或暂时停止本地预览服务，重新加载页面。再打开此前没访问过的文章与 JS、TS、React 实验。仅切换 hash 路由不足以验证首页缓存；仅看文章也不足以验证懒加载资源。',
 '第三步，模拟更新时某个资源返回 503，确认新下载报错后旧版本仍能离线使用。检查缓存中没有完成标记的候选项是否被忽略。再测试清除本站缓存不会删除另一个应用的缓存，也不会主动删除个人笔记。',
 '本站的自动测试用模拟 Cache Storage 与网络验证了：项目子路径导航及未打开的懒加载资源能被读取、下载失败保留旧快照、清除只作用于本站缓存。此前还通过停止本地预览服务后重载做过浏览器验证。模拟测试不能覆盖所有浏览器配额、休眠、跨标签页竞争和 Worker 升级行为，真实设备验证仍有必要。'],code:'npm run build\nnpm run preview -- --port 4174\n\n# 浏览器中登录 → 离线阅读 → 下载全部内容\n# 完成后切断网络或停止 preview，再重新加载\n# 检查文章、直接链接、JS / TS / React、旧版本回退\n\nnpm test',language:'验证步骤'},
 {id:'limits',title:'从可用原型走向长期维护，还需要补什么',paragraphs:[
 '优先处理可恢复性：清理过期的不完整候选缓存，给下载提供取消与重试，避免一次失败占用过多空间。若资源越来越大，再考虑有上限的并行下载、按包下载和断点续传，而不是立即增加复杂度。',
 '版本方面，可以给清单附加每文件摘要，并让页面明确知道自己运行哪个版本。当前 skipWaiting 和 clients.claim 很适合简单协议，但若消息结构升级，应该增加协议版本协商或在用户确认后切换，避免旧页面调用新 Worker 时发生不兼容。',
 '用户体验方面，应能区分“当前网络不可达”“尚未下载”“本地版本较旧”“浏览器拒绝持久化”与“资源下载失败”。navigator.onLine 只能提供网络状态提示，不能保证某个服务可达，因此仍要根据具体请求的成功或失败显示反馈。',
 '源码阅读顺序可以从 scripts/offline.mjs 开始，了解清单怎样生成；再读 src/components/Offline.tsx，理解页面通信；最后读 scripts/sw.js 和 src/lib/offline.test.ts，检查缓存发布、读取与失败路径。把这几条路径连起来，就能明确判断：离线时返回什么、在线时怎样更新、失败时还能保住什么。']}
 ],
 references:[
 {title:'本站源码：构建离线清单',url:'https://github.com/zuxiong-luo/fullstack-atlas/blob/main/scripts/offline.mjs'},
 {title:'本站源码：Service Worker',url:'https://github.com/zuxiong-luo/fullstack-atlas/blob/main/scripts/sw.js'},
 {title:'本站源码：离线管理页面',url:'https://github.com/zuxiong-luo/fullstack-atlas/blob/main/src/components/Offline.tsx'},
 {title:'MDN：使用 Service Worker',url:'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers'},
 {title:'MDN：Cache.match 与 ignoreVary',url:'https://developer.mozilla.org/en-US/docs/Web/API/Cache/match'},
 {title:'MDN：StorageManager.persist',url:'https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist'}
 ]
};
