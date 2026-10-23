import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "offline-first-static-site",
  "topic": "operations",
  "title": "让网站断网后也能打开：从构建清单到完整离线快照",
  "description": "以 Fullstack Atlas 为例，拆解一键下载、Service Worker 请求拦截、缓存版本更新和失败恢复，解释离线阅读为什么远不止缓存一个 HTML。",
  "minutes": 55,
  "tags": [
    "Service Worker",
    "Cache Storage",
    "离线访问",
    "PWA",
    "GitHub Pages",
    "版本一致性"
  ],
  "scope": "基于本站 2026 年 10 月的实际实现。示例注明了节选或伪代码；同时记录当前限制与后续改进方向，不将简化实现描述为完整的安全或同步系统。",
  "prerequisites": [
    "JavaScript Promise 与 async/await",
    "HTTP 请求、响应头和缓存基础",
    "React 与 Vite 构建产物"
  ],
  "questionIds": [
    "http-cache",
    "cache-isolation",
    "web-performance"
  ],
  "sections": [
    {
      "id": "goal",
      "title": "先定义“离线可用”到底包括什么",
      "blocks": [
        {
          "type": "paragraph",
          "text": "离线访问，是在源站暂时不可达时，浏览器仍能取得应用需要的资源并重新启动页面。它包括两个独立环节：提前把需要的资源保存下来，以及在以后请求发生时选择这些本地副本。Service Worker 负责请求与事件，Cache Storage 保存响应；提前开过页面并不自动等于已经完成这两个环节。"
        },
        {
          "type": "paragraph",
          "text": "这个个人站点最初的需求很直接：有时只有手机、有时网络不稳定，希望提前保存内容，之后仍能阅读文章、复习知识和运行代码。判断方案是否完成，不能只看当前页面在断网后还留在屏幕上，而应关闭或刷新页面，再打开之前没有访问过的内容。"
        },
        {
          "type": "paragraph",
          "text": "本站的离线范围包括构建出来的 HTML、CSS、JavaScript、图标、文章数据，以及代码实验室的延迟加载模块、TypeScript Worker 和本地 React 运行时。文章数据编译在 JavaScript 中，因此清单不必为每篇文章单独列一个文件。"
        },
        {
          "type": "paragraph",
          "text": "GitHub Discussions、外部参考网站和邮件发送不属于这个范围。缓存应用代码不会把远端服务搬到本机；代码实验本身若主动调用网络，也仍然可能失败。这里实现的是静态内容与本地运行能力的离线使用。"
        },
        {
          "type": "callout",
          "title": "这里要记住",
          "text": "验收标准是断网后重新加载并访问未打开过的功能，而不是断网前的 DOM 还在。"
        },
        {
          "type": "figure",
          "src": "figures/offline-first-static-site/snapshot.svg",
          "title": "从构建清单到完整快照发布",
          "alt": "清单列出资源，候选缓存逐个下载，全部成功写ready，失败删除候选，fetch只读有完成标记的缓存。",
          "caption": "与本站脚本对应的结构示意；没有将Cache Storage描述成数据库事务。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "layers",
      "title": "把三种存储与两类 Worker 分清楚",
      "blocks": [
        {
          "type": "paragraph",
          "text": "HTTP 缓存由浏览器按响应头等规则管理，适合减少重复传输，但它并不是用户明确选择保存的完整网站版本。Cache Storage 则允许应用用请求作为键保存 Response，并在请求拦截时主动选择返回哪个副本。"
        },
        {
          "type": "paragraph",
          "text": "本站用 localStorage 保存笔记、收藏、进度和代码草稿，用 sessionStorage 保存当前标签页的简单登录状态。它们与离线资源缓存分开，所以“清除离线内容”只删除本站对应的 Cache Storage，不主动删除笔记。浏览器清除整个站点数据则可能同时删除这些数据。"
        },
        {
          "type": "paragraph",
          "text": "Service Worker 是浏览器管理的事件驱动脚本，负责拦截其作用范围内的请求；它不是常驻进程，也不能直接操作页面 DOM。实验室里的 Web Worker 负责代码执行或类型检查，是另一种职责。不要因为名字都带 Worker，就认为缓存控制和计算任务必须放在同一个线程里。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "保存什么",
            "谁来读取",
            "清除离线包的影响"
          ],
          "rows": [
            [
              "Cache Storage",
              "页面和静态资源 Response",
              "Service Worker 的 fetch 处理",
              "本站命名空间资源被清理"
            ],
            [
              "localStorage",
              "笔记、进度、代码草稿",
              "应用状态逻辑",
              "不主动清理"
            ],
            [
              "sessionStorage",
              "当前标签页的展示登录状态",
              "页面入口校验",
              "不主动清理"
            ],
            [
              "Web Worker",
              "运行中的计算与消息",
              "实验室",
              "不是持久离线存储"
            ]
          ]
        }
      ],
      "paragraphs": []
    },
    {
      "id": "manifest",
      "title": "构建时生成清单，才能缓存“还没访问过”的资源",
      "blocks": [
        {
          "type": "paragraph",
          "text": "如果只缓存用户实际请求过的文件，第一次进入文章页可能正常，但离线后第一次打开 React 实验室仍会失败，因为懒加载的编译器从未下载。解决办法是在构建完成后扫描整个 dist 目录，而不是只扫描首页的 script 标签。"
        },
        {
          "type": "paragraph",
          "text": "scripts/offline.mjs 会递归收集构建文件、排序，将文件路径和内容输入 SHA-256，取摘要前 16 位作为版本标识，并累计文件字节数。路径参与摘要可以反映资源改名；排序让文件系统遍历顺序不影响结果。这个摘要用于区分版本，客户端目前不拿它校验每个下载文件的完整性。"
        },
        {
          "type": "paragraph",
          "text": "清单本身和 sw.js 不进入内容清单，避免生成过程自引用。清单输出后再复制 Service Worker 脚本到 dist。这里的 offline-manifest.json 是本站自己的资源清单，不是用于安装图标、名称等信息的 Web App Manifest；支持离线并不要求先“安装到桌面”。"
        },
        {
          "type": "code",
          "filename": "scripts/offline.mjs",
          "purpose": "本站完整构建清单脚本，按TypeScript打印器等价排版。含目录递归、排序、摘要和Worker复制；需在站点生产构建后执行。",
          "code": "import { readdir, readFile, writeFile } from 'node:fs/promises';\nimport { createHash } from 'node:crypto';\nasync function walk(dir) { const out = []; for (const e of await readdir(dir, { withFileTypes: true })) {\n    const p = dir + '/' + e.name;\n    if (e.isDirectory())\n        out.push(...await walk(p));\n    else\n        out.push(p);\n} return out; }\nconst files = (await walk('dist')).filter(p => !p.endsWith('/sw.js') && !p.endsWith('/offline-manifest.json')).sort();\nconst hash = createHash('sha256');\nlet bytes = 0;\nfor (const f of files) {\n    const b = await readFile(f);\n    bytes += b.length;\n    hash.update(f);\n    hash.update(b);\n}\nconst manifest = { version: hash.digest('hex').slice(0, 16), bytes, files: files.map(p => './' + p.slice(5)) };\nawait writeFile('dist/offline-manifest.json', JSON.stringify(manifest));\nawait writeFile('dist/sw.js', await readFile('scripts/sw.js', 'utf8'));\n",
          "kind": "excerpt",
          "language": "javascript"
        },
        {
          "type": "paragraph",
          "text": "带入一个最小产物目录：index.html、assets/main.js、assets/lab.js。walk 会收进三者，即使浏览器从未打开实验室；排序后，文件路径和文件内容一起参与摘要。随后 files 改成以 ./ 开头的相对路径，部署到 /fullstack-atlas/ 或其他目录时都以 Worker scope 解析。新增一张图会改变摘要和资源列表，不需要手动维护每篇文章的下载地址。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "scope",
      "title": "注册位置决定了 GitHub Pages 子目录能否正确工作",
      "blocks": [
        {
          "type": "paragraph",
          "text": "项目站点部署在 /fullstack-atlas/ 下，而不是域名根目录。若把脚本地址写成 /sw.js，就会请求错误位置；若缓存资源写成 /assets/xxx.js，也会绕过项目目录。因此本站以 document.baseURI 解析相对地址，并让 Service Worker 的 scope 对准当前项目目录。"
        },
        {
          "type": "paragraph",
          "text": "正常部署需要 HTTPS；本机 localhost 或回环地址可用于开发测试。本站开发服务器不启用这套离线流程，避免旧缓存盖住 Vite 热更新。实际验证应执行生产构建，再使用 preview 服务。"
        },
        {
          "type": "paragraph",
          "text": "注册成功不等于所有页面已经受控。脚本要经历安装和激活。本站在 install 中调用 skipWaiting，在 activate 中通过 clients.claim 请求接管页面；页面端等待 worker 激活后再发送下载消息。更复杂的产品应评估立即接管是否会造成新 Worker 与旧页面协议不兼容。"
        },
        {
          "type": "code",
          "filename": "src/components/Offline.tsx · 完整通信函数",
          "purpose": "页面与Worker实际通信实现，含类型、注册/激活、进度、超时与端口清理；仅等价排版。",
          "code": "import { useEffect, useState } from 'react';\ntype Snapshot = {\n    version: string;\n    bytes: number;\n    savedAt: number;\n    count: number;\n};\nasync function request(type: string, onProgress?: (n: number, total: number) => void): Promise<Snapshot | null> {\n    if (!('serviceWorker' in navigator))\n        throw new Error('当前浏览器不支持离线缓存，请使用 HTTPS 或本机预览。');\n    const registration = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: new URL('.', document.baseURI).pathname });\n    const worker = registration.active || registration.installing || registration.waiting;\n    if (!worker)\n        throw new Error('离线服务启动失败');\n    if (worker.state !== 'activated')\n        await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('离线服务启动超时')), 15000); worker.addEventListener('statechange', () => { if (worker.state === 'activated') {\n            clearTimeout(timer);\n            resolve();\n        } if (worker.state === 'redundant') {\n            clearTimeout(timer);\n            reject(new Error('离线服务安装失败'));\n        } }); });\n    return new Promise((resolve, reject) => { const channel = new MessageChannel(); let timer: ReturnType<typeof setTimeout>; const fail = () => { channel.port1.close(); reject(new Error('下载超时，请检查网络后重试。')); }; const arm = () => { clearTimeout(timer); timer = setTimeout(fail, 120000); }; arm(); channel.port1.onmessage = e => { arm(); if (e.data.progress)\n        onProgress?.(e.data.progress, e.data.total); if (e.data.done || e.data.error) {\n        clearTimeout(timer);\n        channel.port1.close();\n        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.installed);\n    } }; worker.postMessage({ type }, [channel.port2]); });\n}\n",
          "kind": "excerpt",
          "language": "tsx"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "messages",
      "title": "点击下载后，页面怎样知道进度和结果",
      "blocks": [
        {
          "type": "paragraph",
          "text": "页面与 Service Worker 通过 postMessage 通信。本站为每次操作创建 MessageChannel，把其中一个端口传给 Worker，页面保留另一个端口接收结果。STATUS 查询已安装版本，DOWNLOAD 下载整站内容，CLEAR 清除本站离线缓存。"
        },
        {
          "type": "paragraph",
          "text": "每成功保存一个资源，Worker 回传已完成数量与总数。页面据此显示百分比，因此它是“文件数量进度”，不是字节进度。一个很大的编译器文件可能让百分比停留较久，这不一定代表卡死。"
        },
        {
          "type": "paragraph",
          "text": "Worker 用 event.waitUntil 让异步任务属于当前消息事件。页面为等待设置超时，每收到进度就延长等待；超时会结束页面的等待，并不代表底层下载已被取消。当前 busy 标记可以防止同一 Worker 实例重叠执行修改操作，但不是跨重启的持久锁，也没有实现断点续传。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "snapshot",
      "title": "先下载到候选缓存，完成后才让它对外可见",
      "blocks": [
        {
          "type": "code",
          "filename": "scripts/sw.js · 初始化和已完成版本查询",
          "purpose": "完整前半段：命名空间、完成标记及 installed()。后面两段按原文件顺序接上即是完整Worker；仅等价排版，无逻辑省略。",
          "code": "const PREFIX = 'atlas-offline:' + self.registration.scope;\nconst META = new URL('./offline-ready', self.registration.scope).href;\nlet busy = false;\nself.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', event => event.waitUntil(self.clients.claim()));\nasync function installed() { const keys = (await caches.keys()).filter(k => k.startsWith(PREFIX)); const result = []; for (const k of keys) {\n    const c = await caches.open(k);\n    const marker = await c.match(META);\n    if (marker)\n        result.push({ key: k, cache: c, meta: await marker.json() });\n} return result.sort((a, b) => b.meta.savedAt - a.meta.savedAt); }\n",
          "kind": "excerpt",
          "language": "javascript"
        },
        {
          "type": "paragraph",
          "text": "直接在旧缓存里逐个覆盖文件很危险：假设新的 HTML 已写入，但对应脚本下载失败，原本可用的离线版本也可能被破坏。本站为每次下载建立独立缓存，名称包含应用 scope、版本号和时间戳，旧缓存保持不动。"
        },
        {
          "type": "paragraph",
          "text": "每个资源使用 no-store 获取，检查 HTTP 状态，并拒绝 opaque 响应。还会检查资源是否同源、是否位于本站作用范围内。资源全部保存以后，才写入 offline-ready 元数据标记。只有有此标记的缓存才会进入可用版本列表。"
        },
        {
          "type": "paragraph",
          "text": "下载期间发生错误，会删除这次的候选缓存并报告失败，旧完整版本继续可用。如果浏览器中途终止 Worker，清理逻辑可能没机会运行；没有标记的残留缓存不会被使用，但目前需要清除离线内容才能统一回收。这个设计提供“完整版本才发布”的应用层约定，不是 Cache Storage 支持了跨文件数据库事务。"
        },
        {
          "type": "code",
          "filename": "scripts/sw.js · 完整消息处理",
          "purpose": "完整 STATUS/DOWNLOAD/CLEAR、资源检查、失败删除、完成标记和旧版本回收。busy是该Worker实例内标志。",
          "code": "self.addEventListener('message', event => {\n    const port = event.ports[0];\n    if (!port)\n        return;\n    const reply = data => port.postMessage(data);\n    event.waitUntil((async () => {\n        let acquired = false;\n        try {\n            if (event.data.type === 'STATUS') {\n                const list = await installed();\n                reply({ done: true, installed: list[0]?.meta || null });\n                return;\n            }\n            if (busy)\n                throw new Error('已有缓存操作正在进行，请稍后再试。');\n            busy = true;\n            acquired = true;\n            if (event.data.type === 'CLEAR') {\n                for (const key of await caches.keys())\n                    if (key.startsWith(PREFIX))\n                        await caches.delete(key);\n                reply({ done: true, installed: null });\n                return;\n            }\n            if (event.data.type !== 'DOWNLOAD')\n                throw new Error('未知操作');\n            const response = await fetch(new URL('./offline-manifest.json', self.registration.scope), { cache: 'no-store' });\n            if (!response.ok)\n                throw new Error('无法获取离线清单');\n            const manifest = await response.json();\n            if (!Array.isArray(manifest.files) || !manifest.files.length || typeof manifest.version !== 'string')\n                throw new Error('离线清单无效');\n            const key = PREFIX + manifest.version + ':' + Date.now();\n            const cache = await caches.open(key);\n            try {\n                for (let i = 0; i < manifest.files.length; i++) {\n                    const url = new URL(manifest.files[i], self.registration.scope);\n                    if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope))\n                        throw new Error('离线资源越界');\n                    const r = await fetch(url, { cache: 'no-store' });\n                    if (!r.ok || r.type === 'opaque')\n                        throw new Error('下载失败：' + url.pathname);\n                    await cache.put(url, r);\n                    reply({ progress: i + 1, total: manifest.files.length });\n                }\n                const meta = { version: manifest.version, bytes: manifest.bytes, savedAt: Date.now(), count: manifest.files.length };\n                await cache.put(META, new Response(JSON.stringify(meta)));\n                reply({ done: true, installed: meta });\n            }\n            catch (e) {\n                await caches.delete(key);\n                throw e;\n            }\n            // Keep one previous complete version for already-open tabs.\n            const complete = await installed();\n            for (const old of complete.slice(2))\n                await caches.delete(old.key);\n        }\n        catch (e) {\n            reply({ error: e.message || '离线操作失败' });\n        }\n        finally {\n            if (acquired)\n                busy = false;\n        }\n    })());\n});\n",
          "kind": "excerpt",
          "language": "javascript"
        },
        {
          "type": "table",
          "headers": [
            "时点",
            "候选v2",
            "旧v1",
            "installed()选择"
          ],
          "rows": [
            [
              "下载前",
              "不存在",
              "有ready",
              "v1"
            ],
            [
              "已下载HTML，JS未完成",
              "没有ready",
              "保持不动",
              "v1"
            ],
            [
              "JS下载503",
              "候选删除",
              "保持不动",
              "v1"
            ],
            [
              "全部成功",
              "最后写ready",
              "暂时保留",
              "最新v2优先"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "读这一段时注意三个位置。key 总是为本次候选新建，避免覆盖旧缓存；await cache.put(META, ...) 放在资源循环之后，决定它何时可对外提供；catch 中删除的是 key 对应候选，不会把旧完整版本一起抹掉。busy 的 finally 只在当前操作成功取得标志后复位，避免并发请求误释放别人的占用。这个约定使普通下载失败可恢复，但不保证浏览器进程被终止时还能运行清理代码。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "fetch",
      "title": "真正断网时，请求如何返回缓存",
      "blocks": [
        {
          "type": "paragraph",
          "text": "fetch 事件只处理同源、作用范围内的 GET 请求，并排除 sw.js 和离线清单。导航请求统一映射到本站 index.html，其余请求按照资源 URL 查找。本站使用 hash 路由，#article/xxx 不会发送到服务器，首页脚本加载后再解析它并显示对应内容。"
        },
        {
          "type": "paragraph",
          "text": "请求处理按保存时间从新到旧扫描完整缓存，找到资源就直接返回，没有命中才请求网络。这是一种以已安装快照为优先的策略：即使在线，也优先使用用户保存的内容版本，从而减少新首页与旧脚本混用。"
        },
        {
          "type": "paragraph",
          "text": "当前保留最新与前一份完整缓存，使已打开的旧页面有机会找到原来的哈希资源。不过这只是有限兼容：长期打开的页面若跨越多个版本，仍可能需要刷新；相同 URL 的无哈希资源也不能保证按每个标签页固定版本。不要把它说成严格的多版本会话隔离。"
        },
        {
          "type": "code",
          "filename": "scripts/sw.js · 完整fetch处理",
          "purpose": "完整过滤和读取路径；POST、跨源、scope之外以及Worker和清单请求交还浏览器网络管理。",
          "code": "self.addEventListener('fetch', event => {\n    const request = event.request;\n    const url = new URL(request.url);\n    if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope) || url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/offline-manifest.json'))\n        return;\n    event.respondWith((async () => {\n        const list = await installed();\n        const target = request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : request;\n        // An installed snapshot stays internally consistent; refresh it explicitly.\n        for (const item of list) {\n            const hit = await item.cache.match(target, { ignoreVary: true });\n            if (hit)\n                return hit;\n        }\n        return fetch(request);\n    })());\n});\n",
          "kind": "excerpt",
          "language": "javascript"
        },
        {
          "type": "paragraph",
          "text": "带入 /fullstack-atlas/#article/react-hooks-queue：浏览器发给服务器的导航不含 hash。拦截器把导航统一映射为 scope 下的 index.html，拿到页面后由 React 解析 hash。接下来模块请求 assets/lab-xxx.js，按资源 URL 命中缓存。某资源找不到时才 fetch(request)；若此刻真的离线，该请求依然会失败，不能靠导航回退弥补缺少的编译器。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "vary",
      "title": "为什么缓存显示成功，刷新后却可能白屏",
      "blocks": [
        {
          "type": "paragraph",
          "text": "调试离线功能时，页面能显示 HTML，却没有执行脚本，是一个非常有用的线索。它说明“有首页缓存”和“依赖资源能被正确匹配”是两件事。可以逐个检查脚本请求、Cache Storage 中的键以及响应头，而不是反复重装 Service Worker。"
        },
        {
          "type": "paragraph",
          "text": "Cache.match 默认会考虑响应的 Vary。预览服务可能返回 Vary: Origin，预下载请求和浏览器加载模块的请求头又可能不同，导致 URL 一致但缓存不命中。本站对清单中的同源静态资源使用 ignoreVary: true，避免这种匹配差异。"
        },
        {
          "type": "paragraph",
          "text": "这个选择有明确前提：相同 URL 对应相同的公开静态内容。如果响应会随语言、用户、授权信息等变化，忽略 Vary 可能把错误版本交给用户。这段实现不应该直接复制到登录 API 或按用户返回数据的缓存层。"
        },
        {
          "type": "callout",
          "title": "这里要记住",
          "text": "缓存键必须覆盖真正影响响应的输入；忽略响应差异只能用于确定不需要这些差异的资源。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "update",
      "title": "内容更新与 Service Worker 更新是两条流程",
      "blocks": [
        {
          "type": "paragraph",
          "text": "文章发布后，GitHub Pages 提供新的构建资源与离线清单，但已经安装快照的浏览器仍优先读取旧内容。用户要在离线阅读页面点击“下载最新离线版本”，等待成功，再刷新页面切换。这是当前明确采用的更新方式，不是自动实时同步。"
        },
        {
          "type": "paragraph",
          "text": "离线清单不从本站缓存响应，更新请求还使用 no-store，以便尝试读取线上清单。sw.js 由浏览器的注册与更新流程管理；它不在内容快照内。内容版本摘要不包含 Worker 本身，因此不能只看离线版本号判断 Worker 脚本是否更新。"
        },
        {
          "type": "paragraph",
          "text": "当前下载只检查响应是否成功，没有逐文件摘要校验。如果下载期间线上部署切换，缺失资源会让候选版本失败，但全部返回 200 也不代表绝对没有跨发布混用。更严格的实现应使用不可变版本目录、每文件摘要和服务端保留策略，再验证清单与资源属于同一次发布。"
        },
        {
          "type": "paragraph",
          "text": "后续还可以增加“发现新版本”的提醒，或者把下载、验证、切换拆成明确按钮。自动更新能省操作，但需要处理读到一半的文章和未保存状态；保持可预测的更新行为比单纯追求自动化更重要。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "storage",
      "title": "保存成功不等于永久保存，也不等于文件下载",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Cache Storage 存在于当前浏览器和来源的存储空间中，不是 Downloads 目录里的压缩包。它不能自动跨手机和电脑同步。更换浏览器、清理站点数据或在存储压力下被回收，都可能需要重新下载。"
        },
        {
          "type": "paragraph",
          "text": "下载前本站尝试调用 navigator.storage.persist() 申请持久化存储。是否批准由浏览器决定；返回 false 不代表不能使用缓存，只表示没有获得持久化保障。用户主动清除站点数据仍会删除内容。当前页面没有展示申请结果，后续可补充状态和容量预估。"
        },
        {
          "type": "paragraph",
          "text": "界面中的 MB 来自构建文件原始字节数之和，不等于压缩后的网络流量，也不等于缓存元数据开销。为了让从未打开的代码实验也能离线运行，需要一并保存较大的编译器与 Worker。更精细的产品可以把“只保存文章”和“包含代码实验”做成两个下载包。"
        },
        {
          "type": "paragraph",
          "text": "域名变化也意味着来源变化。本站从旧 GitHub 用户名切换到新用户名以后，新域名无法直接读取旧域名的笔记和缓存；学习记录需要通过已有的 JSON 导出与导入迁移，离线资源则在新域名重新下载。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "auth",
      "title": "登录限制的是入口，不是已下载内容的保密性",
      "blocks": [
        {
          "type": "paragraph",
          "text": "本站未登录时隐藏深度研习、个人笔记和离线阅读入口，直接访问也会被页面拦截；下载按钮再次检查当前登录状态。由于这是纯静态个人站点，登录校验与内容都在客户端，功能定位是学习内容的展示控制。"
        },
        {
          "type": "paragraph",
          "text": "下载整站会把相应静态代码和文章数据保存到浏览器，退出登录不会抹除这份资源。缓存也没有按账号加密或隔离。本文不展示实际账号密码；但需要认识到，把口令写入前端本身就无法形成可靠的访问控制。"
        },
        {
          "type": "paragraph",
          "text": "若未来存放真正的私人资料，需要重新设计服务端授权、按用户隔离的数据存储、退出清理和离线许可。离线设备无法实时感知服务端撤权，已交付的明文也无法保证远程收回。这些是产品与安全设计问题，不能靠隐藏按钮解决。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "verify",
      "title": "如何验证离线能力，而不是被热缓存骗过",
      "blocks": [
        {
          "type": "paragraph",
          "text": "第一步，执行 npm run build，再启动 npm run preview。在登录后的离线阅读页完成整站下载，确认显示保存时间和资源数量。开发服务故意不支持这套缓存流程，所以不要直接用 npm run dev 的页面作为验收依据。"
        },
        {
          "type": "paragraph",
          "text": "第二步，在浏览器开发者工具切到 Offline 或暂时停止本地预览服务，重新加载页面。再打开此前没访问过的文章与 JS、TS、React 实验。仅切换 hash 路由不足以验证首页缓存；仅看文章也不足以验证懒加载资源。"
        },
        {
          "type": "paragraph",
          "text": "第三步，模拟更新时某个资源返回 503，确认新下载报错后旧版本仍能离线使用。检查缓存中没有完成标记的候选项是否被忽略。再测试清除本站缓存不会删除另一个应用的缓存，也不会主动删除个人笔记。"
        },
        {
          "type": "paragraph",
          "text": "本站的自动测试用模拟 Cache Storage 与网络验证了：项目子路径导航及未打开的懒加载资源能被读取、下载失败保留旧快照、清除只作用于本站缓存。此前还通过停止本地预览服务后重载做过浏览器验证。模拟测试不能覆盖所有浏览器配额、休眠、跨标签页竞争和 Worker 升级行为，真实设备验证仍有必要。"
        },
        {
          "type": "code",
          "kind": "runnable",
          "language": "bash",
          "filename": "终端",
          "purpose": "主站生产构建使用固定4173端口；独立协议测试无需npm依赖。第一次使用在联网时下载。",
          "code": "npm run build\nnpm run preview\n# 浏览器打开 http://127.0.0.1:4173/#offline\n# 登录并完成整站下载，刷新，再停止preview验证缓存启动\nnode --test examples/offline-first-static-site/test.mjs"
        },
        {
          "type": "paragraph",
          "text": "独立示例使用本站 sw.js 的副本，在受控 Cache Storage 与网络中执行同一脚本，新增七条确定性检查：完整导航/懒资源、503保留旧版、不完整候选不可读、清单越界拒绝、请求过滤、只保留两版、命名空间清理。它不模拟HTTP响应的Vary匹配与浏览器配额，因此这两项仍须真实浏览器验证。"
        }
      ],
      "paragraphs": []
    },
    {
      "id": "limits",
      "title": "从可用原型走向长期维护，还需要补什么",
      "blocks": [
        {
          "type": "paragraph",
          "text": "优先处理可恢复性：清理过期的不完整候选缓存，给下载提供取消与重试，避免一次失败占用过多空间。若资源越来越大，再考虑有上限的并行下载、按包下载和断点续传，而不是立即增加复杂度。"
        },
        {
          "type": "paragraph",
          "text": "版本方面，可以给清单附加每文件摘要，并让页面明确知道自己运行哪个版本。当前 skipWaiting 和 clients.claim 很适合简单协议，但若消息结构升级，应该增加协议版本协商或在用户确认后切换，避免旧页面调用新 Worker 时发生不兼容。"
        },
        {
          "type": "paragraph",
          "text": "用户体验方面，应能区分“当前网络不可达”“尚未下载”“本地版本较旧”“浏览器拒绝持久化”与“资源下载失败”。navigator.onLine 只能提供网络状态提示，不能保证某个服务可达，因此仍要根据具体请求的成功或失败显示反馈。"
        },
        {
          "type": "paragraph",
          "text": "前面已经给出构建脚本、页面通信函数和完整 Worker，无需离开正文补读关键实现。源码链接只用于核对文件与上下文。工程下一步可增加逐文件摘要、候选残留回收和取消协议；这些是明确的新能力，不应读作当前已经实现。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "为什么下载了index.html仍可能离线白屏？",
              "入口还需要JS、CSS及延迟资源。清单必须覆盖整个构建依赖，而不是只存HTML。"
            ],
            [
              "ready为什么最后写？",
              "installed仅接受带标记的缓存，下载中的候选即使已有部分资源也不会成为导航版本。"
            ],
            [
              "页面在线却仍显示旧内容，可能是什么？",
              "当前策略优先读取已安装快照。先检查离线版本并主动更新，不要直接认定部署未成功。"
            ]
          ]
        }
      ],
      "paragraphs": []
    }
  ],
  "references": [
    {
      "title": "本站源码：构建离线清单",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/blob/main/scripts/offline.mjs"
    },
    {
      "title": "本站源码：Service Worker",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/blob/main/scripts/sw.js"
    },
    {
      "title": "本站源码：离线管理页面",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/blob/main/src/components/Offline.tsx"
    },
    {
      "title": "MDN：使用 Service Worker",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers"
    },
    {
      "title": "MDN：Cache.match 与 ignoreVary",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Cache/match"
    },
    {
      "title": "MDN：StorageManager.persist",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist"
    }
  ],
  "status": "review",
  "kind": "tutorial",
  "verifiedAt": "2026-10-23",
  "labMinutes": 25,
  "versions": [
    "本站静态构建与Service Worker实现，2026-10-23",
    "Node.js22；现代安全上下文浏览器"
  ],
  "examples": [
    {
      "label": "离线协议独立测试ZIP",
      "path": "offline-first-static-site.zip"
    }
  ]
};
export default article;
