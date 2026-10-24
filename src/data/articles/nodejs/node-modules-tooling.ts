import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "node-modules-tooling",
  "topic": "nodejs",
  "title": "Node.js 模块与工程：ESM、CommonJS 和 TypeScript 构建",
  "description": "把源文件、类型检查、模块解析和运行时输入分开：交付一个可构建的笔记解析 CLI，复现路径后缀、包导出和类型边界的失败。",
  "minutes": 40,
  "labMinutes": 25,
  "tags": [
    "Node.js",
    "ESM",
    "CommonJS",
    "TypeScript",
    "NodeNext",
    "运行时校验"
  ],
  "scope": "围绕单包、非打包器的 TypeScript CLI，解释 ESM/CJS 识别、相对路径、NodeNext、exports 与不可信输入。双格式 npm 库、复杂循环依赖和自定义 loader 不在本篇实现范围。",
  "prerequisites": [
    "会读 import/export 与基础 TypeScript 类型",
    "理解上一章的 Node 进程与普通 JS 执行"
  ],
  "questionIds": [],
  "kind": "series",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0",
    "TypeScript 5.7.3",
    "@types/node 22.10.5"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    {
      "label": "完整示例与行为测试",
      "path": "node-modules-tooling.zip"
    },
    {
      "label": "运行说明",
      "path": "node-modules-tooling/README.md"
    }
  ],
  "sections": [
    {
      "id": "layers",
      "title": "模块工程是什么：把编写、检查和执行连起来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "模块是代码组织和依赖关系的单位：一个文件公开哪些能力、另一个文件怎样找到它，以及加载后拿到什么值。Node.js 同时支持 CommonJS 与 ECMAScript modules。TypeScript 在这个基础上增加静态类型和编译步骤；它不会把运行时加载规则、文件存在性和外部输入验证全部接管。工程配置真正要做的，是让这些阶段对同一组文件达成一致。"
        },
        {
          "type": "paragraph",
          "text": "可以把工作分成三层。作者在 src 下编写 TS，编译器用类型与模块规则检查源码，运行时执行 dist 下已经生成的 JS。即使编辑器能跳到目标文件，也不表示 Node 会按同样的方法加载。一个常见失败是源码写 ./notes，构建工具替你找到了 notes.ts，但产物仍留下 ./notes，最终 Node 的 ESM 加载报错。问题发生在层与层的接缝。"
        },
        {
          "type": "paragraph",
          "text": "这一篇沿用知识笔记案例，输入是一段 JSON，输出是整理后的标题与标签。它刻意不使用打包器和 TS 执行器：先让读者看见真正输出了哪些文件，再讨论为什么某些前端工程里的写法搬到 Node 就失败。这里锁定 Node 22.12.0、TypeScript 5.7.3；选固定版本是为了复现规则，不表示这两个版本永远是新项目的唯一选择。"
        },
        {
          "type": "figure",
          "src": "figures/node-modules-tooling/pipeline.svg",
          "title": "三个阶段各自回答不同问题",
          "alt": "TS 源码经 tsc 检查输出 JS，Node 按实际 JS 路径加载，外部 JSON 另经 parseNote 运行时校验。",
          "caption": "流程对应配套工程。没有 bundler 隐藏路径变化，也没有把类型声明当作输入校验器。"
        }
      ]
    },
    {
      "id": "formats",
      "title": "先确定每个文件是什么模块，再选择加载方式",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本例在 package.json 显式写 type: module，让此包范围内的普通 .js 产物按 ESM 解释；需要明确 CommonJS 的文件用 .cjs，需要明确 ESM 的文件也可以用 .mjs。TS 侧的 .mts、.cts 可用于明确对应格式，但这个入门工程统一用受包配置约束的 .ts。显式约定比依赖 Node 对模糊输入的自动判断更容易排查。"
        },
        {
          "type": "table",
          "headers": [
            "观察对象",
            "本例如何使用",
            "容易混淆的地方"
          ],
          "rows": [
            [
              ".mjs / .cjs",
              "顺序实验与 legacy 适配明确使用后缀",
              "文件内容看起来相近，运行上下文可能不同"
            ],
            [
              "type: module",
              "让 dist/*.js 按 ESM 运行",
              "不是开启 TypeScript 类型支持"
            ],
            [
              "import / export",
              "应用的主模块格式",
              "ESM 默认没有 CommonJS 的 require 变量"
            ],
            [
              "module.exports",
              "只放在 legacy.cjs",
              "不是 ESM 的 export default 语法别名"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "CommonJS 使用 require 与 module.exports；ESM 使用 import/export 并建立模块绑定关系。二者还有加载、缓存和循环依赖方面的差异，所以不应靠全文替换关键字迁移。本例只在一个适配边界消费旧 CJS 对象：默认导入拿到它公开的 module.exports，再正常调用。没有依赖对 CJS 命名导出的静态推测。"
        },
        {
          "type": "code",
          "code": "module.exports = { label: 'legacy-notes', normalize: value => value.trim() };",
          "language": "js",
          "filename": "examples/node-modules-tooling/legacy.cjs",
          "purpose": "完整旧模块，导出字符串整理能力；它本身没有第三方依赖。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import legacy from './legacy.cjs';\nconsole.log(legacy.normalize('  bridged  '));",
          "language": "js",
          "filename": "examples/node-modules-tooling/bridge.mjs",
          "purpose": "完整 ESM 适配入口。运行 node bridge.mjs，输出 bridged。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "不要把这个示例再反推成“require 永远不能碰 ESM”。Node 22.12.0 对满足条件的同步 ESM 已有 require 支持，带顶层 await 等情况仍有约束；这不是本篇交付的兼容策略。已有 CJS 应用需要接 ESM 时，可以先审查目标包的导出与异步初始化方式，再选动态 import 或符合固定版本条件的桥接，不应把所有包一律改后缀。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0：ESM 与 CommonJS 互操作",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/esm.html#interoperability-with-commonjs",
          "note": "本文实际验证的是 ESM 默认导入本地 .cjs，不声称测试所有双格式包。"
        }
      ]
    },
    {
      "id": "build",
      "title": "NodeNext 的意义：按目标运行环境检查模块，而不是模拟浏览器打包",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TypeScript 的 module 影响产物与模块语义，moduleResolution 决定编译器怎样理解导入目标。这里配套使用 NodeNext，使编译器依据 Node 风格的包和文件格式规则处理源码。它比“编辑器不报错就行”更贴近最终运行环境，但仍要实际运行产物：编译成功是必要证据的一部分，不是所有运行依赖都存在的保证。"
        },
        {
          "type": "code",
          "code": "{\n  \"name\": \"node-modules-tooling\",\n  \"version\": \"1.0.0\",\n  \"private\": true,\n  \"type\": \"module\",\n  \"engines\": {\n    \"node\": \"22.12.0\"\n  },\n  \"exports\": {\n    \".\": \"./dist/notes.js\"\n  },\n  \"scripts\": {\n    \"build\": \"tsc -p tsconfig.json\",\n    \"test\": \"npm run build && node --test test.mjs\",\n    \"start\": \"npm run build && node dist/main.js\"\n  },\n  \"devDependencies\": {\n    \"typescript\": \"5.7.3\",\n    \"@types/node\": \"22.10.5\"\n  }\n}",
          "language": "json",
          "filename": "examples/node-modules-tooling/package.json",
          "purpose": "完整项目清单：运行时与编译器版本、构建命令、公开入口都在这里。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "{\n  \"compilerOptions\": {\n    \"target\": \"ES2022\",\n    \"module\": \"NodeNext\",\n    \"moduleResolution\": \"NodeNext\",\n    \"strict\": true,\n    \"verbatimModuleSyntax\": true,\n    \"rootDir\": \"src\",\n    \"outDir\": \"dist\",\n    \"declaration\": true,\n    \"noEmitOnError\": true,\n    \"types\": [\n      \"node\"\n    ]\n  },\n  \"include\": [\n    \"src/**/*.ts\"\n  ]\n}",
          "language": "json",
          "filename": "examples/node-modules-tooling/tsconfig.json",
          "purpose": "完整编译设置。noEmitOnError 防止本次有类型错误时继续生成新产物；旧 dist 不会因此自动删除。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "target=ES2022 决定语言输出目标；它不会给旧运行时补所有 API。types 指向 Node 的类型声明，不等于安装了一个 Node 运行时。rootDir 与 outDir 把业务源码和生成文件分开，declaration 生成配套声明。strict 帮助发现不确定值和错误调用，verbatimModuleSyntax 让类型导入与值导入更明确：仅用于类型的依赖应写 import type。"
        },
        {
          "type": "paragraph",
          "text": "NodeNext 的含义会随 TypeScript 版本演进，因此不能用一份最新在线文档推断任意旧编译器的全部行为。本文选择的路径、类型擦除和包导出用例已经在 5.7.3 执行；升级编译器时先重跑这组用例。如果项目由 bundler 接管模块解析，应按那个宿主设计配置，不能为消除一个报错就随意切换 moduleResolution。"
        },
        {
          "type": "reference",
          "title": "TypeScript 官方模块参考",
          "url": "https://www.typescriptlang.org/docs/handbook/modules/reference.html",
          "note": "配置原理的参考；具体 5.7.3 行为以锁文件和配套编译测试复现。"
        }
      ]
    },
    {
      "id": "paths",
      "title": "为什么 TS 源码里写 ./notes.js，而真实源文件叫 notes.ts",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "这里导入的是将来给 Node 执行的路径。编译器能够把 .js 的模块说明符对应回 notes.ts 进行类型检查，产物则保留 ./notes.js；Node 最后看到的确实是 dist/notes.js。这个分工让检查与执行都能找到各自阶段的文件。它不是要求把 TS 源文件先手工复制成 JS，也不是靠文件名碰巧相同蒙混过关。"
        },
        {
          "type": "code",
          "code": "import { parseNote } from './notes.js';\nimport type { Note } from './notes.js';\nconst raw: unknown = JSON.parse(process.argv[2] ?? '{\"title\":\"Learn Node\",\"tags\":[\"node\"]}');\nconst note: Note = parseNote(raw);\nconsole.log(JSON.stringify(note));",
          "language": "ts",
          "filename": "examples/node-modules-tooling/src/main.ts",
          "purpose": "完整 CLI 入口：公开输入先是 unknown，调用 parseNote 后才是 Note。仅类型使用 import type。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "import { parseNote } from './notes.js';\nconst raw = JSON.parse(process.argv[2] ?? '{\"title\":\"Learn Node\",\"tags\":[\"node\"]}');\nconst note = parseNote(raw);\nconsole.log(JSON.stringify(note));",
          "language": "js",
          "filename": "dist/main.js · TypeScript 5.7.3 实际生成",
          "purpose": "与上面的完整源码对照：类型声明被移除，相对导入的 .js 后缀保留。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "在 ESM 中，相对导入应提供完整文件后缀，也不要把目录默认 index 当作必然会补齐。示例有两层失败验证：failures/extension.ts 故意省略后缀，编译器报 TS2835；另一个子进程直接 import ./dist/notes，Node 报 ERR_MODULE_NOT_FOUND。前者检查源码约定，后者检查运行时真实规则，不能互相代替。"
        },
        {
          "type": "paragraph",
          "text": "编辑器的 paths 别名也是类似问题：它主要帮助编译器理解名字，不会自动让 Node 获得同一套路由。单包的短相对路径足够清楚时，本篇先不引入别名。如果以后要用包级 imports、构建重写或自定义 loader，应把产物里残留的说明符也纳入测试，否则本地 tsx 能运行、部署 node 却失败的情况仍会出现。"
        },
        {
          "type": "reference",
          "title": "Node 22.12.0：ESM 相对说明符的后缀要求",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/esm.html#mandatory-file-extensions",
          "note": "完整错误实验随 ZIP 提供，引用用于追溯规则。"
        }
      ]
    },
    {
      "id": "runtime-input",
      "title": "类型检查不会替你审查 JSON：把边界落到一个完整函数",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Note 描述程序内部已经认可的数据形状。外部 JSON 并没有因为你写了 Note 就变得可信：字段可能缺失，标签可能是数字，标题可能为空。把 JSON.parse 的结果直接断言为 Note，只是告诉编译器“请相信我”；它没有插入检查。我们让输入保持 unknown，只有实际检查成功后才返回一个新的 Note 对象。"
        },
        {
          "type": "code",
          "code": "export type Note = { title: string; tags: string[] };\nexport function parseNote(input: unknown): Note {\n  if (typeof input !== 'object' || input === null || Array.isArray(input)) {\n    throw new TypeError('note must be an object');\n  }\n  const value = input as Record<string, unknown>;\n  if (typeof value.title !== 'string' || value.title.trim().length === 0 || value.title.length > 80) {\n    throw new TypeError('title must contain 1..80 characters');\n  }\n  if (!Array.isArray(value.tags) || value.tags.length > 5 || !Array.from(value.tags).every(tag => typeof tag === 'string')) {\n    throw new TypeError('tags must contain at most 5 strings');\n  }\n  return { title: value.title.trim(), tags: [...value.tags] };\n}",
          "language": "ts",
          "filename": "examples/node-modules-tooling/src/notes.ts",
          "purpose": "完整类型与运行时边界。校验标题、标签数量和每个元素，返回新对象与新数组。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "以 {title:\"  notes  \",tags:[\"node\"]} 为例：先排除 null、数组和基本类型；确认标题是字符串、去空格后非空、原值长度不超过 80；再确认 tags 是最多五项的数组，每项都是字符串。返回值只选择允许的字段，并复制标签数组。因此调用者随后修改原数组，不会改变已经构造的 Note。这里的长度是 JavaScript 字符串的 UTF-16 代码单元数，不是用户可见字素的数量。"
        },
        {
          "type": "paragraph",
          "text": "Array.from 后再检查标签，是为了让稀疏数组中的空位也变成可检查的 undefined；否则直接 every 会跳过空位。正常 JSON 不会生成稀疏数组，但公开函数还可能被其他 JS 代码调用，测试也覆盖这种输入。这个细节说明运行时校验应按函数真正承诺的入口设计，而不是只验证一份碰巧正确的样本。"
        },
        {
          "type": "paragraph",
          "text": "null、空标题、数字标签、超过长度的标题都会抛 TypeError；额外字段在本例被忽略而不是向后传播。是否拒绝未知字段属于接口策略，本篇选择只返回白名单字段。HTTP 下一章采用拒绝未知字段的严格请求契约，并分别返回语法与业务错误；不要把两种策略混写成同一条固定规则。"
        },
        {
          "type": "paragraph",
          "text": "同时，failures/type.ts 把 tags:[3] 写成静态已知的 Note，编译测试得到 TS2322。于是两条证据对应两个问题：静态输入由编译器提前拦截，运行时未知输入由 parseNote 拦截。需要大量嵌套对象、联合类型或共享协议时，可以选 JSON Schema 等校验工具；那时要维护的是“实际校验与类型一致”，不能只把手写检查换成漂亮的声明。"
        }
      ]
    },
    {
      "id": "package-boundary",
      "title": "exports 是公开接口，不是文件保险箱",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "package.json 的 exports 在本例只公开包根入口。运行包名 node-modules-tooling 时，Node 会进入 dist/notes.js；直接请求 node-modules-tooling/dist/notes.js 则得到 ERR_PACKAGE_PATH_NOT_EXPORTED。测试利用包内自引用复现这两条路径，不需要先把包发布到 npm，也不把网络发布混进模块规则实验。"
        },
        {
          "type": "code",
          "code": "node --input-type=module -e \"const {parseNote}=await import('node-modules-tooling');console.log(parseNote({title:'ok',tags:[]}).title)\"\n# ok\nnode --input-type=module -e \"await import('node-modules-tooling/dist/notes.js')\"\n# ERR_PACKAGE_PATH_NOT_EXPORTED",
          "language": "sh",
          "filename": "终端 · 包公开路径实验",
          "purpose": "先 npm run build，再在本示例目录执行。第二条预期以非零状态退出。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "这让维护者可以调整内部目录而保持公开入口稳定，但没有建立操作系统权限边界。拥有文件访问权限的人仍可能通过绝对路径读取文件；exports 约束的是包说明符的公开解析。它也不会自动构建 dist。若压缩包遗漏源码、锁文件或构建步骤，公开路径写得再正确，第一次干净安装仍会失败。"
        },
        {
          "type": "paragraph",
          "text": "本例不发布 npm 包，也不提供 import/require 条件各走一份代码的双格式包。后者要额外处理类型入口、共享状态是否重复实例化、条件分支和消费者测试。等确实有 CJS 消费者时再引入它，比一开始复制两份未经验证的产物更容易确认责任。"
        }
      ]
    },
    {
      "id": "module-state",
      "title": "模块会复用，但模块级状态不会自动按请求隔离",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "模块加载还有一条容易影响服务行为的规则：相同模块标识通常复用已加载实例。比如在模块顶层建立一个对象，两个调用者导入后看到的是同一个对象。它适合放共享配置或有明确生命周期的客户端，但不适合偷偷存“当前请求用户”。用户之间共享了错误状态，和 TypeScript 有没有检查过类型没有直接关系。"
        },
        {
          "type": "code",
          "code": "export const state = { count: 0 };\nexport function increment() { state.count += 1; }",
          "language": "js",
          "filename": "examples/node-modules-tooling/counter.mjs",
          "purpose": "完整可变状态实验模块。下面的两次相同 URL 导入共享 count，不同查询后缀建立另一个模块实例。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "const first = await import('./counter.mjs');\nconst again = await import('./counter.mjs');\nconst separate = await import('./counter.mjs?separate');\nfirst.increment();\nconsole.log(first === again, again.state.count, separate.state.count);\n// true 1 0",
          "language": "js",
          "filename": "counter.mjs 的调用实验",
          "purpose": "在示例目录以 node --input-type=module 执行，或运行包含该断言的 npm test。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "先看普通路径：first 与 again 使用同一个解析 URL，二者是同一模块命名空间，状态由零增加到一。再看反例：给 URL 加 separate 查询后缀，Node 把它当作另一个标识，这份 state 仍为零。它解释了为什么一些热加载技巧会重复初始化资源：名字看起来仍是同一个文件，运行时看到的模块身份却已经不同。"
        },
        {
          "type": "paragraph",
          "text": "不要因此为每个请求加一个随机查询参数。那会绕开复用、建立新的模块状态，也没有为旧实例提供自动销毁协议。连接、计时器或缓存应由明确的应用工厂创建，并在关闭时归还；请求数据则通过函数参数或适当的请求上下文传递。下一篇 HTTP 工厂正是这样创建 active 集合，而不是用一个导出的全局变量记录当前用户。"
        },
        {
          "type": "paragraph",
          "text": "本实验没有展开 CommonJS 的 require.cache 删除、复杂循环依赖和打包后重复副本。排查重复初始化时，先记录真实解析位置和模块格式，再检查是否有不同包版本、不同入口或 URL 变化。只看 import 那一行的短字符串，可能还不足以确定最终模块身份。"
        }
      ]
    },
    {
      "id": "reproduce",
      "title": "从锁文件安装，再检查产物，最后运行正常与失败输入",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/node-modules-tooling\nnvm use\nnpm ci\nnpm test\nnpm start\nnode dist/main.js '{\"title\":\"  notes  \",\"tags\":[\"node\"]}'\nnode dist/main.js '{\"title\":\"\",\"tags\":[]}'",
          "language": "sh",
          "filename": "终端 · 完整验证流程",
          "purpose": "前一条自定义输入输出 {\"title\":\"notes\",\"tags\":[\"node\"]}；最后一条预期 TypeError 与非零退出。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "本机已在 Node 22.12.0 执行 npm ci、构建和 7 项测试：运行时校验与数组隔离、类型擦除及产物执行、无后缀路径失败、公开与私有包路径、CJS 桥接、两类预期编译失败、模块标识与状态共享。TypeScript 固定 5.7.3，Node 声明固定 22.10.5。npm audit 当前结果为零告警，但它不代表程序不存在逻辑或供应链风险。"
        },
        {
          "type": "paragraph",
          "text": "noEmitOnError 不会删除过去成功生成的 dist；构建失败后继续 node dist/main.js，可能运行旧代码。干净验证应清除本例的 dist 后重新构建，或在全新的解压目录 npm ci 再测试。锁文件用于固定解析结果，npm ci 要求它与 package.json 一致；不要通过随意改成 npm install 来掩盖不一致。生成文件不需要当作源码提交。"
        },
        {
          "type": "paragraph",
          "text": "CLI 的异常目前交给进程以非零状态结束：它没有长期连接，也没有成功写入后的业务恢复。下一章进入长期运行的 HTTP 服务后，不能再把一个坏请求的 TypeError 当作整个进程应该退出的理由。届时要把输入错误转成稳定响应，把取消传进正在等待的操作，并保证每个请求的资源在同一个出口释放。页面、图形已检查桌面和手机视口；未验证的平台仍按范围说明保留。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Node 22.12.0 packages：模块与包导出",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/packages.html"
    },
    {
      "title": "TypeScript 官方：模块理论",
      "url": "https://www.typescriptlang.org/docs/handbook/modules/theory.html"
    },
    {
      "title": "TypeScript 5.7 发布说明",
      "url": "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html"
    }
  ]
};
export default article;
